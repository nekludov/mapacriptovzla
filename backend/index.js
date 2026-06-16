const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { TwitterApi } = require('twitter-api-v2');

const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','OPTIONS'] }));
app.use(express.json({ limit: '5mb' }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BUCKET = 'logos';

// Venezuela bounding box (lat: 0.6–12.2, lng: -73.4–-59.8)
const inVenezuela = (lat, lng) =>
  lat >= 0.6 && lat <= 12.2 && lng >= -73.4 && lng <= -59.8;

// ── Auto-tweet cuando se aprueba un negocio ──────────────────────────────────
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

// ── GET /api/negocios ────────────────────────────────────────────────────────
app.get('/api/negocios', async (req, res) => {
  try {
    const { ciudad, tipo, cripto } = req.query;

    let q = supabase.from('negocios').select('*').eq('estado', 'activo');
    if (ciudad) q = q.ilike('ciudad', `%${ciudad}%`);
    if (tipo)   q = q.eq('tipo', tipo);
    if (cripto) q = q.contains('criptos', [cripto]);

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/negocios ───────────────────────────────────────────────────────
app.post('/api/negocios', async (req, res) => {
  try {
    const { nombre, tipo, criptos, descripcion, lat, lng,
            contacto, ciudad, online, logo_base64 } = req.body;

    // Validación básica
    if (!nombre?.trim() || !tipo || !criptos?.length || lat == null || lng == null) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (!inVenezuela(latN, lngN)) {
      return res.status(400).json({ error: 'Las coordenadas deben estar dentro de Venezuela.' });
    }

    // ── Moderación con Claude Haiku
    let estado = 'pendiente';
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
¿Es un negocio legítimo con contenido apropiado?`
        }]
      });
      if (msg.content[0].text.trim().includes('APROBAR')) estado = 'activo';
    } catch (e) {
      console.error('Moderation error:', e.message);
      // Queda en pendiente para revisión manual
    }

    // ── Upload de logo
    let logo_url = null;
    if (logo_base64) {
      try {
        const comma   = logo_base64.indexOf(',');
        const meta    = logo_base64.slice(0, comma);
        const b64data = logo_base64.slice(comma + 1);
        const ext     = meta.includes('png') ? 'png' : 'jpg';
        const mime    = meta.includes('png') ? 'image/png' : 'image/jpeg';
        const buf     = Buffer.from(b64data, 'base64');
        const path    = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });

        if (!upErr) {
          logo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        } else {
          console.error('Storage upload error:', upErr.message);
        }
      } catch (e) {
        console.error('Storage error:', e.message);
      }
    }

    const { data, error } = await supabase.from('negocios').insert([{
      nombre:      nombre.trim(),
      tipo,
      criptos,
      descripcion: descripcion?.trim() || null,
      lat:         latN,
      lng:         lngN,
      contacto:    contacto?.trim() || null,
      ciudad:      ciudad?.trim() || null,
      online:      online === true || online === 'true',
      logo_url,
      estado,
    }]).select().single();

    if (error) throw error;
    if (data.estado === 'activo') postTweet(data);
    res.json({ ok: true, estado: data.estado, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/pendientes ────────────────────────────────────────────────
app.get('/api/admin/pendientes', async (req, res) => {
  if (!ADMIN_PASSWORD || req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  const { data, error } = await supabase
    .from('negocios').select('*').eq('estado', 'pendiente')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PATCH /api/negocios/:id ──────────────────────────────────────────────────
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
  if (error) return res.status(500).json({ error: error.message });
  if (estado === 'activo') postTweet(data);
  res.json({ ok: true, data });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`MapaCripto API → http://localhost:${PORT}`));
}

module.exports = app;
