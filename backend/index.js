const express  = require('express');
const cors     = require('cors');
const crypto   = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { TwitterApi } = require('twitter-api-v2');

const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','OPTIONS'] }));
app.use(express.json({ limit: '5mb' }));

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
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
const PUBLIC_COLS = 'id,nombre,tipo,criptos,descripcion,lat,lng,contacto,ciudad,online,logo_url,estado,created_at';

// ── Helpers ──────────────────────────────────────────────────────────────────

const inVenezuela = (lat, lng) =>
  lat >= 0.6 && lat <= 12.2 && lng >= -73.4 && lng <= -59.8;

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

async function moderate(nombre, tipo, ciudad, descripcion) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Modera este negocio venezolano para un mapa de criptomonedas. Responde SOLO con "APROBAR" o "RECHAZAR".
Nombre: ${nombre}
Tipo: ${tipo}
Ciudad: ${ciudad || '(no indicada)'}
Descripción: ${descripcion || '(ninguna)'}
¿Es un negocio legítimo con contenido apropiado?`,
      }],
    });
    return msg.content[0].text.trim().includes('APROBAR') ? 'activo' : 'pendiente';
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
            contacto, ciudad, online, logo_base64 } = req.body;

    const err = validateBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const latN = parseFloat(lat), lngN = parseFloat(lng);
    const [estado, logo_url, edit_token] = await Promise.all([
      moderate(nombre, tipo, ciudad, descripcion),
      uploadLogo(logo_base64),
      Promise.resolve(crypto.randomBytes(24).toString('base64url')),
    ]);

    const { data, error } = await supabase.from('negocios').insert([{
      nombre:      nombre.trim(),
      tipo, criptos,
      descripcion: descripcion?.trim() || null,
      lat: latN, lng: lngN,
      contacto:    contacto?.trim() || null,
      ciudad:      ciudad?.trim() || null,
      online:      online === true || online === 'true',
      logo_url, estado, edit_token,
    }]).select().single();

    if (error) throw error;
    if (data.estado === 'activo') postTweet(data);
    res.json({ ok: true, estado: data.estado, id: data.id, edit_token: data.edit_token });
  } catch (err) {
    console.error('POST /api/negocios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/negocios/edit/:token — datos para pre-rellenar el formulario ─────
app.get('/api/negocios/edit/:token', async (req, res) => {
  const { data, error } = await supabase
    .from('negocios')
    .select(PUBLIC_COLS)
    .eq('edit_token', req.params.token)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Enlace de edición inválido.' });
  res.json(data);
});

// ── PATCH /api/negocios/edit/:token — guardar cambios ────────────────────────
app.patch('/api/negocios/edit/:token', async (req, res) => {
  try {
    const { nombre, tipo, criptos, descripcion, lat, lng,
            contacto, ciudad, online, logo_base64 } = req.body;

    const err = validateBody(req.body);
    if (err) return res.status(400).json({ error: err });

    // Verificar que el token existe y traer el logo actual
    const { data: existing } = await supabase
      .from('negocios').select('id, logo_url')
      .eq('edit_token', req.params.token).single();
    if (!existing) return res.status(404).json({ error: 'Enlace de edición inválido.' });

    const latN = parseFloat(lat), lngN = parseFloat(lng);
    const [estado, newLogo] = await Promise.all([
      moderate(nombre, tipo, ciudad, descripcion),
      uploadLogo(logo_base64),
    ]);

    const { data, error } = await supabase.from('negocios').update({
      nombre:      nombre.trim(),
      tipo, criptos,
      descripcion: descripcion?.trim() || null,
      lat: latN, lng: lngN,
      contacto:    contacto?.trim() || null,
      ciudad:      ciudad?.trim() || null,
      online:      online === true || online === 'true',
      logo_url:    newLogo ?? existing.logo_url,
      estado,
    }).eq('edit_token', req.params.token).select().single();

    if (error) throw error;
    res.json({ ok: true, estado: data.estado });
  } catch (err) {
    console.error('PATCH /edit:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /api/admin/pendientes ─────────────────────────────────────────────────
app.get('/api/admin/pendientes', async (req, res) => {
  if (!ADMIN_PASSWORD || req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  const { data, error } = await supabase
    .from('negocios').select(PUBLIC_COLS).eq('estado', 'pendiente')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: 'Error interno del servidor.' });
  res.json(data);
});

// ── PATCH /api/negocios/:id — acción admin ────────────────────────────────────
app.patch('/api/negocios/:id', async (req, res) => {
  const { password, estado } = req.body;
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  if (!['activo', 'rechazado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }
  const { data, error } = await supabase
    .from('negocios').update({ estado })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Error interno del servidor.' });
  if (estado === 'activo') postTweet(data);
  res.json({ ok: true, data });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`MapaCripto API → http://localhost:${PORT}`));
}

module.exports = app;
