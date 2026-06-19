const express  = require('express');
const cors     = require('cors');
const crypto   = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { TwitterApi } = require('twitter-api-v2');
const { Resend } = require('resend');

const app = express();

const ALLOWED_ORIGINS = ['https://criptomapavenezuela.com', 'http://localhost:5500', 'http://127.0.0.1:5500'];
app.use(cors({
  origin: (origin, cb) => (!origin || ALLOWED_ORIGINS.includes(origin)) ? cb(null, true) : cb(new Error('CORS')),
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
}));
app.use(express.json({ limit: '5mb' }));

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend    = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CRON_SECRET    = process.env.CRON_SECRET;
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;

// Warn on startup if optional-but-important env vars are missing
if (!ADMIN_PASSWORD)         console.warn('WARN: ADMIN_PASSWORD not set — admin routes will always return 401');
if (!ADMIN_EMAIL)            console.warn('WARN: ADMIN_EMAIL not set — admin notifications disabled');
if (!process.env.RESEND_API_KEY)     console.warn('WARN: RESEND_API_KEY not set — all emails disabled');
if (!process.env.ANTHROPIC_API_KEY)  console.warn('WARN: ANTHROPIC_API_KEY not set — moderation will default to pendiente');
const FRONTEND_URL   = 'https://criptomapavenezuela.com';
const API_URL        = 'https://api.criptomapavenezuela.com';
const BUCKET = 'logos';

const ALLOWED_TIPOS = new Set([
  'restaurante','farmacia','ferreteria','tecnologia','servicio','tienda',
  'hotel','transporte','emprendedor','otro',
  'docente','plomero','electricista','ac_tecnico','mecanico','programador',
  'disenador','fotografo','estetica','entrenador','medico','abogado',
  'servicios_hogar','marketing','otro_prof',
]);
const ALLOWED_CRIPTOS = new Set(['BTC','USDT','USDC','BinancePay','Otros']);
const ALLOWED_MIMES   = new Set(['image/jpeg','image/png','image/webp','image/gif']);

// Columnas públicas — edit_token nunca se expone al cliente
const PUBLIC_COLS = 'id,slug,nombre,tipo,criptos,descripcion,lat,lng,contacto,ciudad,online,logo_url,estado,created_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

const inVenezuela = (lat, lng) =>
  lat >= 0.6 && lat <= 12.2 && lng >= -73.4 && lng <= -59.8;

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

const TIPO_LABEL = {
  restaurante:'Restaurante', farmacia:'Farmacia', ferreteria:'Ferretería',
  tecnologia:'Tecnología', servicio:'Servicio', tienda:'Tienda',
  hotel:'Hotel', transporte:'Transporte', emprendedor:'Emprendedor', otro:'Otro',
  docente:'Docente', plomero:'Plomero', electricista:'Electricista',
  ac_tecnico:'Técnico A/C', mecanico:'Mecánico', programador:'Programador',
  disenador:'Diseñador', fotografo:'Fotógrafo', estetica:'Estética',
  entrenador:'Entrenador', medico:'Médico', abogado:'Abogado',
  servicios_hogar:'Servicios del hogar', marketing:'Marketing', otro_prof:'Profesional',
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const escEmail = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') ?? '';

function validateBody({ nombre, tipo, criptos, descripcion, lat, lng, ciudad, contacto }) {
  if (!nombre?.trim() || !tipo || !criptos?.length || lat == null || lng == null)
    return 'Faltan campos requeridos.';
  if (!ALLOWED_TIPOS.has(tipo))  return 'Tipo de negocio inválido.';
  if (!Array.isArray(criptos) || !criptos.every(c => ALLOWED_CRIPTOS.has(c)))
    return 'Criptomonedas inválidas.';
  if (nombre.trim().length > 120)    return 'Nombre demasiado largo.';
  if (descripcion?.length > 500)     return 'Descripción demasiado larga.';
  if (ciudad?.length > 80)           return 'Ciudad demasiado larga.';
  if (contacto?.length > 200)        return 'Contacto demasiado largo.';
  if (!inVenezuela(parseFloat(lat), parseFloat(lng)))
    return 'Las coordenadas deben estar dentro de Venezuela.';
  return null;
}

function validateEmail(email) {
  if (!email) return 'El correo electrónico es requerido.';
  if (!EMAIL_RE.test(email.trim())) return 'Correo electrónico inválido.';
  return null;
}

function requireAdmin(req, res, next) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!ADMIN_PASSWORD || token.length !== ADMIN_PASSWORD.length ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ADMIN_PASSWORD))) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

async function moderate(nombre, tipo, ciudad, descripcion) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: 'Eres un moderador de contenido. Analiza los datos del negocio que recibirás y responde ÚNICAMENTE con la palabra APROBAR o RECHAZAR. No agregues ningún otro texto.',
      messages: [{
        role: 'user',
        content: `Negocio venezolano para mapa de criptomonedas:
\`\`\`
Nombre: ${nombre.slice(0, 120)}
Tipo: ${tipo}
Ciudad: ${(ciudad || '(no indicada)').slice(0, 80)}
Descripción: ${(descripcion || '(ninguna)').slice(0, 500)}
\`\`\`
¿Es un negocio legítimo con contenido apropiado?`,
      }],
    });
    return msg.content[0].text.trim().toUpperCase().startsWith('APROBAR') ? 'activo' : 'pendiente';
  } catch (e) {
    console.error('Moderation error:', e.message);
    return 'pendiente';
  }
}

async function uploadLogo(logo_base64) {
  if (!logo_base64) return null;
  try {
    const comma     = logo_base64.indexOf(',');
    const mimeMatch = logo_base64.slice(0, comma).match(/^data:([^;]+);base64$/);
    const mime      = mimeMatch?.[1].toLowerCase() ?? '';
    if (!ALLOWED_MIMES.has(mime)) { console.warn('MIME rechazado:', mime); return null; }
    const buf = Buffer.from(logo_base64.slice(comma + 1), 'base64');
    if (buf.length > 4 * 1024 * 1024) { console.warn('Logo demasiado grande'); return null; }
    const ext  = { 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[mime] ?? 'jpg';
    const path = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
    if (error) { console.error('Upload error:', error.message); return null; }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error('Logo exception:', e.message);
    return null;
  }
}

async function sendPingEmail({ email, nombre, edit_token, id, slug }) {
  if (!resend) { console.warn('Resend not configured — skipping email'); return false; }
  if (!EMAIL_RE.test(email)) { console.warn('sendPingEmail: email inválido:', email); return false; }
  const confirmUrl = `${API_URL}/api/confirm/${encodeURIComponent(edit_token)}`;
  const editUrl    = `${FRONTEND_URL}/?edit=${encodeURIComponent(edit_token)}`;
  const profileUrl = slug
    ? `${FRONTEND_URL}/negocio/${slug}/`
    : `${FRONTEND_URL}/negocio.html?id=${id}`;
  const nombreSafe = escEmail(nombre);
  try {
    await resend.emails.send({
      from: 'CriptoMapa Venezuela <noreply@criptomapavenezuela.com>',
      to:   email,
      subject: `¿${nombre} sigue activo en CriptoMapa Venezuela? ⚡`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <div style="background:#F7931A;padding:20px 24px;border-radius:10px 10px 0 0">
            <span style="color:#fff;font-weight:700;font-size:18px">🗺️ MapaCripto Venezuela</span>
          </div>
          <div style="background:#f9f9f9;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e5e5e5;border-top:none">
            <p style="margin:0 0 16px">Hola, hace 6 meses registraste <strong>${nombreSafe}</strong> en el mapa de negocios cripto de Venezuela.</p>
            <p style="margin:0 0 24px;color:#555">Para mantener el directorio actualizado necesitamos saber si el negocio sigue activo. Si no recibimos respuesta en <strong>30 días</strong>, lo marcaremos como inactivo y dejará de aparecer en el mapa.</p>
            <a href="${confirmUrl}" style="display:inline-block;background:#F7931A;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-size:15px">
              ✅ Sí, seguimos activos
            </a>
            <p style="margin:28px 0 8px;font-size:13px;color:#777">¿Quieres actualizar la información del negocio?</p>
            <a href="${editUrl}" style="font-size:13px;color:#F7931A">Editar mi perfil →</a>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
            <p style="font-size:12px;color:#999;margin:0">
              Ver perfil público: <a href="${profileUrl}" style="color:#999">${profileUrl}</a><br>
              Si ya no operás, podés ignorar este correo.
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error('Ping email error:', e.message);
    return false;
  }
}

async function sendRejectionEmail({ email, nombre, id }) {
  if (!resend || !email || !EMAIL_RE.test(email)) return;
  const nombreSafe = escEmail(nombre);
  const profileUrl = `${FRONTEND_URL}/negocio.html?id=${id}`;
  try {
    await resend.emails.send({
      from: 'CriptoMapa Venezuela <noreply@criptomapavenezuela.com>',
      to:   email,
      subject: `Tu registro en CriptoMapa Venezuela no fue aprobado`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <div style="background:#0A0C10;padding:20px 24px;border-radius:10px 10px 0 0">
            <span style="color:#F7931A;font-weight:700;font-size:18px">MapaCripto Venezuela</span>
          </div>
          <div style="background:#f9f9f9;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e5e5e5;border-top:none">
            <p style="margin:0 0 16px">Hola, tu registro <strong>${nombreSafe}</strong> fue revisado por nuestro equipo y no pudo ser aprobado en este momento.</p>
            <p style="margin:0 0 24px;color:#555">Esto puede deberse a información incompleta, contenido no relacionado con el mapa, o una ubicación fuera de Venezuela. Si crees que es un error, puedes volver a registrarte con información más detallada.</p>
            <a href="${FRONTEND_URL}" style="display:inline-block;background:#F7931A;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px">
              Volver al mapa
            </a>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
            <p style="font-size:12px;color:#999;margin:0">Si tienes dudas, responde a este correo.</p>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Rejection email error:', e.message);
  }
}

async function sendAdminNotification({ nombre, tipo, ciudad, estado, id }) {
  if (!resend) return;
  const tipoLabel   = TIPO_LABEL[tipo] || tipo;
  const estadoColor = estado === 'activo' ? '#22c55e' : '#F7931A';
  const estadoLabel = estado === 'activo' ? 'Activo (aprobado por IA)' : 'Pendiente de revisión';
  const profileUrl  = `${FRONTEND_URL}/negocio.html?id=${id}`;
  const adminUrl    = `${FRONTEND_URL}/?admin=1`;
  const nombreSafe  = escEmail(nombre);
  const ciudadSafe  = escEmail(ciudad || '—');
  const tipoSafe    = escEmail(tipoLabel);
  try {
    await resend.emails.send({
      from: 'CriptoMapa Venezuela <noreply@criptomapavenezuela.com>',
      to:   ADMIN_EMAIL,
      subject: `Nuevo registro: ${nombre}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <div style="background:#0A0C10;padding:20px 24px;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:12px">
            <span style="color:#F7931A;font-weight:700;font-size:18px">MapaCripto Venezuela</span>
          </div>
          <div style="background:#f9f9f9;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e5e5e5;border-top:none">
            <p style="margin:0 0 4px;font-size:13px;color:#888">Nuevo registro en el mapa</p>
            <h2 style="margin:0 0 20px;font-size:22px;color:#111">${nombreSafe}</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
              <tr>
                <td style="padding:8px 0;color:#666;font-size:13px;width:110px">Tipo</td>
                <td style="padding:8px 0;font-weight:600;font-size:13px">${tipoSafe}</td>
              </tr>
              <tr style="border-top:1px solid #eee">
                <td style="padding:8px 0;color:#666;font-size:13px">Ciudad</td>
                <td style="padding:8px 0;font-weight:600;font-size:13px">${ciudadSafe}</td>
              </tr>
              <tr style="border-top:1px solid #eee">
                <td style="padding:8px 0;color:#666;font-size:13px">Estado</td>
                <td style="padding:8px 0;font-size:13px">
                  <span style="background:${estadoColor}20;color:${estadoColor};font-weight:700;padding:3px 10px;border-radius:20px;font-size:12px">${estadoLabel}</span>
                </td>
              </tr>
            </table>
            ${estado === 'pendiente' ? `
            <a href="${adminUrl}" style="display:inline-block;background:#F7931A;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;margin-bottom:16px">
              Revisar en el panel admin
            </a>
            ` : `
            <a href="${profileUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;margin-bottom:16px">
              Ver perfil publicado
            </a>
            `}
            <p style="margin:16px 0 0;font-size:12px;color:#aaa">
              ${estado === 'pendiente' ? 'La IA lo marcó como pendiente — requiere tu revisión manual.' : 'La IA lo aprobó automáticamente y ya es visible en el mapa.'}
            </p>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Admin notification error:', e.message);
  }
}

async function postTweet(negocio) {
  if (!process.env.X_API_KEY) return;
  try {
    const client = new TwitterApi({
      appKey:       process.env.X_API_KEY,
      appSecret:    process.env.X_API_SECRET,
      accessToken:  process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_SECRET,
    });
    const criptos = (negocio.criptos || []).join(', ');
    let text = `🆕 Nuevo negocio en el mapa!\n\n🏪 ${negocio.nombre}`;
    if (negocio.ciudad)      text += `\n📍 ${negocio.ciudad}`;
    if (criptos)             text += `\n💰 Acepta: ${criptos}`;
    if (negocio.descripcion) text += `\n\n${negocio.descripcion.slice(0, 80)}${negocio.descripcion.length > 80 ? '…' : ''}`;
    text += `\n\n🗺️ criptomapavenezuela.com\n#CriptoVenezuela #Bitcoin #Venezuela`;
    await client.v2.tweet(text);
    console.log('Tweet publicado:', negocio.nombre);
  } catch (e) {
    console.error('Tweet error:', e.message);
  }
}

// ── GET /api/negocios ─────────────────────────────────────────────────────────
app.get('/api/negocios', async (req, res) => {
  try {
    const { ciudad, tipo, cripto } = req.query;
    let q = supabase.from('negocios').select(PUBLIC_COLS).eq('estado', 'activo');
    if (ciudad) q = q.ilike('ciudad', `%${ciudad}%`);
    if (tipo   && ALLOWED_TIPOS.has(tipo))   q = q.eq('tipo', tipo);
    if (cripto && ALLOWED_CRIPTOS.has(cripto)) q = q.contains('criptos', [cripto]);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /api/negocios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /api/negocios ────────────────────────────────────────────────────────
app.post('/api/negocios', async (req, res) => {
  try {
    const { nombre, tipo, criptos, descripcion, lat, lng,
            contacto, ciudad, online, logo_base64, email } = req.body;

    const err = validateBody(req.body);
    if (err) return res.status(400).json({ error: err });
    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ error: emailErr });

    const latN = parseFloat(lat), lngN = parseFloat(lng);
    const slugSuffix = crypto.randomBytes(3).toString('hex');
    const slugBase   = slugify(nombre.trim());
    const slug       = slugBase ? `${slugBase}-${slugSuffix}` : `negocio-${slugSuffix}`;

    const [estado, logo_url, edit_token] = await Promise.all([
      moderate(nombre, tipo, ciudad, descripcion),
      uploadLogo(logo_base64),
      Promise.resolve(crypto.randomBytes(24).toString('base64url')),
    ]);

    const { data, error } = await supabase.from('negocios').insert([{
      nombre:      nombre.trim(),
      tipo, criptos, slug,
      descripcion: descripcion?.trim() || null,
      lat: latN, lng: lngN,
      contacto:    contacto?.trim() || null,
      ciudad:      ciudad?.trim() || null,
      online:      online === true || online === 'true',
      logo_url, estado, edit_token,
      email:       email?.trim()  || null,
    }]).select().single();

    if (error) throw error;
    await Promise.all([
      data.estado === 'activo' ? postTweet(data) : Promise.resolve(),
      sendAdminNotification(data),
    ]);
    res.json({ ok: true, estado: data.estado, id: data.id, edit_token: data.edit_token, slug: data.slug });
  } catch (err) {
    console.error('POST /api/negocios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/negocios/edit/:token — datos para pre-rellenar el formulario ─────
app.get('/api/negocios/edit/:token', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('negocios')
      .select(PUBLIC_COLS)
      .eq('edit_token', req.params.token)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Enlace de edición inválido.' });
    res.json(data);
  } catch (err) {
    console.error('GET /edit/:token:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── PATCH /api/negocios/edit/:token — guardar cambios ────────────────────────
app.patch('/api/negocios/edit/:token', async (req, res) => {
  try {
    const { nombre, tipo, criptos, descripcion, lat, lng,
            contacto, ciudad, online, logo_base64 } = req.body;

    const err = validateBody(req.body);
    if (err) return res.status(400).json({ error: err });

    // Verificar que el token existe y traer estado y logo actual
    const { data: existing } = await supabase
      .from('negocios').select('id, logo_url, estado, nombre, slug')
      .eq('edit_token', req.params.token).single();
    if (!existing) return res.status(404).json({ error: 'Enlace de edición inválido.' });

    const latN = parseFloat(lat), lngN = parseFloat(lng);
    const trimmedNombre = nombre.trim();

    // Regenerar slug si cambió el nombre (reutiliza el mismo sufijo de 6 chars)
    const slugSuffix = existing.slug ? existing.slug.slice(-6) : crypto.randomBytes(3).toString('hex');
    const newSlug = trimmedNombre !== existing.nombre
      ? (slugify(trimmedNombre) ? `${slugify(trimmedNombre)}-${slugSuffix}` : `negocio-${slugSuffix}`)
      : null;

    // No re-moderar si ya estaba activo — evita desapublicar por una corrección menor
    const [estado, newLogo] = await Promise.all([
      existing.estado === 'activo'
        ? Promise.resolve('activo')
        : moderate(nombre, tipo, ciudad, descripcion),
      uploadLogo(logo_base64),
    ]);

    const { data, error } = await supabase.from('negocios').update({
      nombre:      trimmedNombre,
      tipo, criptos,
      descripcion: descripcion?.trim() || null,
      lat: latN, lng: lngN,
      contacto:    contacto?.trim() || null,
      ciudad:      ciudad?.trim() || null,
      online:      online === true || online === 'true',
      logo_url:    newLogo ?? existing.logo_url,
      estado,
      ...(newSlug ? { slug: newSlug } : {}),
    }).eq('edit_token', req.params.token).select().single();

    if (error) throw error;
    res.json({ ok: true, estado: data.estado });
  } catch (err) {
    console.error('PATCH /edit:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/negocios/:id — perfil público (acepta UUID o slug) ──
app.get('/api/negocios/:id', async (req, res) => {
  try {
    const param = req.params.id;
    let q = supabase.from('negocios').select(PUBLIC_COLS).eq('estado', 'activo');
    q = UUID_RE.test(param) ? q.eq('id', param) : q.eq('slug', param);
    const { data, error } = await q.single();
    if (error || !data) return res.status(404).json({ error: 'Negocio no encontrado.' });
    res.json(data);
  } catch (err) {
    console.error('GET /negocios/:id:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/negocios/:id/rating — calificación promedio ─────
app.get('/api/negocios/:id/rating', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ratings').select('stars').eq('negocio_id', req.params.id);
    if (error) return res.status(500).json({ error: 'Error interno.' });
    if (!data.length) return res.json({ avg: null, count: 0 });
    const avg = data.reduce((s, r) => s + r.stars, 0) / data.length;
    res.json({ avg: Math.round(avg * 10) / 10, count: data.length });
  } catch (err) {
    console.error('GET /negocios/:id/rating:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /api/negocios/:id/rating — enviar calificación ──────
app.post('/api/negocios/:id/rating', async (req, res) => {
  const stars = parseInt(req.body.stars, 10);
  if (!stars || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'Calificación inválida (1-5).' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress || 'unknown';
  const ip_hash = crypto.createHash('sha256').update(ip).digest('hex');
  const { error } = await supabase.from('ratings').upsert(
    { negocio_id: req.params.id, stars, ip_hash },
    { onConflict: 'negocio_id,ip_hash' }
  );
  if (error) return res.status(500).json({ error: 'Error al guardar.' });
  const { data, error: fetchErr } = await supabase.from('ratings').select('stars').eq('negocio_id', req.params.id);
  if (fetchErr || !data) return res.status(500).json({ error: 'Error al calcular calificación.' });
  const avg = data.reduce((s, r) => s + r.stars, 0) / data.length;
  res.json({ ok: true, avg: Math.round(avg * 10) / 10, count: data.length });
});

// ── POST /api/negocios/:id/view — registrar visita ───────────
app.post('/api/negocios/:id/view', async (req, res) => {
  await supabase.from('views').insert({ negocio_id: req.params.id });
  res.json({ ok: true });
});

// ── GET /api/negocios/edit/:token/stats — estadísticas ───────
app.get('/api/negocios/edit/:token/stats', async (req, res) => {
  const { data: neg } = await supabase
    .from('negocios').select('id').eq('edit_token', req.params.token).single();
  if (!neg) return res.status(404).json({ error: 'Token inválido.' });
  const since7  = new Date(Date.now() - 7  * 864e5).toISOString();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [v7, v30, rat] = await Promise.all([
    supabase.from('views').select('*', { count: 'exact', head: true })
      .eq('negocio_id', neg.id).gte('viewed_at', since7),
    supabase.from('views').select('*', { count: 'exact', head: true })
      .eq('negocio_id', neg.id).gte('viewed_at', since30),
    supabase.from('ratings').select('stars').eq('negocio_id', neg.id),
  ]);
  const rData = rat.data || [];
  const rating = rData.length
    ? { avg: Math.round(rData.reduce((s, r) => s + r.stars, 0) / rData.length * 10) / 10, count: rData.length }
    : { avg: null, count: 0 };
  res.json({ views_7d: v7.count || 0, views_30d: v30.count || 0, rating });
});

// ── GET /api/admin/pendientes ─────────────────────────────────────────────────
app.get('/api/admin/pendientes', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('negocios').select(PUBLIC_COLS).eq('estado', 'pendiente')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: 'Error interno del servidor.' });
  res.json(data);
});

// ── GET /api/admin/activos ────────────────────────────────────────────────────
app.get('/api/admin/activos', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('negocios').select(PUBLIC_COLS).eq('estado', 'activo')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Error interno del servidor.' });
  res.json(data);
});

// ── PATCH /api/negocios/:id — acción admin ────────────────────────────────────
app.patch('/api/negocios/:id', requireAdmin, async (req, res) => {
  const { estado, contacto, nombre, descripcion, ciudad } = req.body;
  const updates = {};
  if (estado !== undefined) {
    if (!['activo', 'rechazado'].includes(estado))
      return res.status(400).json({ error: 'Estado inválido.' });
    updates.estado = estado;
  }
  if (contacto  !== undefined) updates.contacto  = contacto  || null;
  if (nombre    !== undefined) updates.nombre    = nombre    || null;
  if (descripcion !== undefined) updates.descripcion = descripcion || null;
  if (ciudad    !== undefined) updates.ciudad    = ciudad    || null;
  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'Nada que actualizar.' });
  const { data, error } = await supabase
    .from('negocios').update(updates)
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Error interno del servidor.' });
  if (updates.estado === 'activo')    await postTweet(data);
  if (updates.estado === 'rechazado') await sendRejectionEmail(data);
  res.json({ ok: true, data });
});

// ── DELETE /api/negocios/:id — eliminar negocio (admin) ──────────────────────
app.delete('/api/negocios/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('negocios').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error interno del servidor.' });
  res.json({ ok: true });
});

// ── GET /api/confirm/:token — confirmar que el negocio sigue activo ───────────
app.get('/api/confirm/:token', async (req, res) => {
  const { data, error } = await supabase
    .from('negocios')
    .update({ last_confirmed_at: new Date().toISOString(), ping_sent_at: null })
    .eq('edit_token', req.params.token)
    .eq('estado', 'activo')
    .select('id,nombre')
    .single();
  if (error || !data) {
    return res.redirect(`${FRONTEND_URL}/?confirm=error`);
  }
  res.redirect(`${FRONTEND_URL}/?confirm=ok&nombre=${encodeURIComponent(data.nombre)}`);
});

// ── GET /api/cron/ping — renovación semestral (ejecuta el cron de Vercel) ─────
app.get('/api/cron/ping', async (req, res) => {
  const auth = req.headers['authorization'] || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const now     = new Date();
  const sixMonthsAgo  = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 1. Marcar como inactivos los que no respondieron al ping en 30 días
  const { data: expired } = await supabase
    .from('negocios')
    .update({ estado: 'inactivo' })
    .eq('estado', 'activo')
    .lt('ping_sent_at', thirtyDaysAgo.toISOString())
    .select('id,nombre');

  // 2. Enviar ping a los que llevan 6 meses sin confirmar y aún no han recibido ping
  // Dos queries para evitar OR anidado: nunca confirmados + confirmados hace >6 meses
  const base = supabase.from('negocios').select('id,nombre,email,edit_token,slug')
    .eq('estado', 'activo').is('ping_sent_at', null);
  const [{ data: neverConfirmed }, { data: oldConfirmed }] = await Promise.all([
    base.is('last_confirmed_at', null).lt('created_at', sixMonthsAgo.toISOString()),
    supabase.from('negocios').select('id,nombre,email,edit_token,slug')
      .eq('estado', 'activo').is('ping_sent_at', null)
      .lt('last_confirmed_at', sixMonthsAgo.toISOString()),
  ]);
  const seen  = new Set();
  const stale = [...(neverConfirmed || []), ...(oldConfirmed || [])].filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id); return true;
  });

  let sent = 0;
  for (const neg of (stale || [])) {
    if (!neg.email) continue;
    const ok = await sendPingEmail(neg);
    if (ok) {
      await supabase.from('negocios')
        .update({ ping_sent_at: now.toISOString() })
        .eq('id', neg.id);
      sent++;
    }
  }

  console.log(`Cron ping: ${sent} emails sent, ${(expired || []).length} marked inactivo`);
  res.json({ ok: true, sent, expired: (expired || []).length });
});

// ── Shared helper: count active negocios by ciudad ───────────────────────────
async function getCiudadCounts() {
  const { data, error } = await supabase
    .from('negocios').select('ciudad')
    .eq('estado', 'activo').not('ciudad', 'is', null).neq('ciudad', '');
  if (error) throw error;
  const counts = {};
  for (const { ciudad } of data) {
    const c = ciudad.trim();
    if (!c) continue;
    const key = c.toLowerCase();
    if (!counts[key]) counts[key] = { ciudad: c, count: 0 };
    counts[key].count++;
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count);
}

// ── GET /api/stats/ciudades — ranking de ciudades (widget panel) ──────────────
app.get('/api/stats/ciudades', async (req, res) => {
  try {
    res.json((await getCiudadCounts()).slice(0, 15));
  } catch (err) {
    console.error('GET /api/stats/ciudades:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/ranking — alias limpio para app / consumidores externos ──────────
app.get('/api/ranking', async (req, res) => {
  try {
    res.json((await getCiudadCounts()).slice(0, 15));
  } catch (err) {
    console.error('GET /api/ranking:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/ciudades — todas las ciudades con conteo y slug ──────────────────
app.get('/api/ciudades', async (req, res) => {
  try {
    const all = await getCiudadCounts();
    res.json(all.map(c => ({ ciudad: c.ciudad, slug: slugify(c.ciudad), count: c.count })));
  } catch (err) {
    console.error('GET /api/ciudades:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/categorias — tipos de negocio con conteo ────────────────────────
app.get('/api/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('negocios').select('tipo').eq('estado', 'activo');
    if (error) throw error;
    const counts = {};
    for (const { tipo } of data) {
      if (tipo) counts[tipo] = (counts[tipo] || 0) + 1;
    }
    const result = Object.entries(counts)
      .map(([tipo, count]) => ({ tipo, label: TIPO_LABEL[tipo] || tipo, count }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (err) {
    console.error('GET /api/categorias:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`CriptoMapa Venezuela API → http://localhost:${PORT}`));
}

module.exports = app;
