/**
 * build-pages.js — static SEO page generator for MapaCripto Venezuela.
 *
 * Consumes the public API and writes pre-rendered HTML into docs/:
 *   docs/negocio/{slug}/index.html
 *   docs/ciudad/{slug}/index.html
 *   docs/categoria/{tipo}/index.html
 *   docs/sitemap.xml
 *
 * Usage:
 *   node scripts/build-pages.js
 *   API_URL=http://localhost:3000 node scripts/build-pages.js
 */

const fs   = require('fs');
const path = require('path');

const API_BASE = (process.env.API_URL || 'https://api.criptomapavenezuela.com').replace(/\/$/, '');
const SITE_URL = 'https://criptomapavenezuela.com';
const DOCS_DIR = path.join(__dirname, '..', 'docs');

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escJson(obj) {
  return JSON.stringify(obj, null, 2).replace(/<\/script>/gi, '<\\/script>');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

function mkdir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function write(filePath, content) {
  mkdir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

// ── Data maps ─────────────────────────────────────────────────────────────────

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

const TIPO_EMOJI = {
  restaurante:'🍽', farmacia:'💊', ferreteria:'🔧', tecnologia:'💻',
  servicio:'🛠', tienda:'🏪', hotel:'🏨', transporte:'🚗',
  emprendedor:'💡', otro:'📍', docente:'👨‍🏫', plomero:'🪠',
  electricista:'⚡', ac_tecnico:'❄️', mecanico:'🔩', programador:'👨‍💻',
  disenador:'🎨', fotografo:'📸', estetica:'💇', entrenador:'🏋️',
  medico:'🩺', abogado:'⚖️', servicios_hogar:'🧹', marketing:'📱', otro_prof:'👤',
};

const CRIPTOS_META = {
  BTC:        { label:'Bitcoin',     color:'#F7931A', border:'#F7931A44', bg:'#f7931a18' },
  USDT:       { label:'USDT',        color:'#26A17B', border:'#26A17B44', bg:'#26a17b18' },
  USDC:       { label:'USDC',        color:'#2775CA', border:'#2775CA44', bg:'#2775ca18' },
  BinancePay: { label:'Binance Pay', color:'#F3BA2F', border:'#F3BA2F44', bg:'#f3ba2f18' },
  Otros:      { label:'Otros',       color:'#9AA0AC', border:'#9AA0AC44', bg:'#9aa0ac18' },
};

// ── Shared HTML partials ──────────────────────────────────────────────────────

const HEADER_SVG = `<svg width="26" height="17" viewBox="0 0 26 17" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;flex-shrink:0">
  <rect width="26" height="5.67" fill="#CF9B00"/>
  <rect y="5.67" width="26" height="5.67" fill="#003893"/>
  <rect y="11.33" width="26" height="5.67" fill="#CF142B"/>
  <circle cx="2.8" cy="8.8" r="0.72" fill="white"/>
  <circle cx="5.7" cy="7.9" r="0.72" fill="white"/>
  <circle cx="8.6" cy="7.3" r="0.72" fill="white"/>
  <circle cx="11.5" cy="7.0" r="0.72" fill="white"/>
  <circle cx="14.5" cy="7.0" r="0.72" fill="white"/>
  <circle cx="17.4" cy="7.3" r="0.72" fill="white"/>
  <circle cx="20.3" cy="7.9" r="0.72" fill="white"/>
  <circle cx="23.2" cy="8.8" r="0.72" fill="white"/>
</svg>`;

function header(backHref, backLabel) {
  return `<header>
  <div class="header-inner">
    <a class="logo" href="/">${HEADER_SVG} MapaCripto</a>
    <a class="back-btn" href="${esc(backHref)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg>
      ${esc(backLabel)}
    </a>
  </div>
</header>`;
}

function footer() {
  return `<footer>
  <p>© 2025 CriptoMapa Venezuela ·
    <a href="/quienes-somos.html">Quiénes somos</a> ·
    <a href="/terms.html">Términos</a> ·
    <a href="/privacy.html">Privacidad</a>
  </p>
</footer>`;
}

// ── Base CSS (shared across all generated pages) ──────────────────────────────

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --accent: #F7931A; --bg: #0F1117; --surface: #1C1F26; --surface2: #252930;
  --border: #2E3340; --text: #E8EAED; --muted: #9AA0AC;
  --success: #22C55E; --error: #EF4444;
}
body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); min-height: 100dvh; display: flex; flex-direction: column; }
header { background: var(--surface); position: relative; flex-shrink: 0; }
header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(to right, #CF9B00 33%, #003893 33% 66%, #CF142B 66%); }
.header-inner { max-width: 860px; margin: 0 auto; padding: 0 20px; height: 56px; display: flex; align-items: center; gap: 12px; }
.logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; text-decoration: none; color: var(--text); }
.back-btn { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color .15s; }
.back-btn:hover { color: var(--text); }
main { flex: 1; max-width: 720px; width: 100%; margin: 0 auto; padding: 32px 20px 64px; }
.section { margin-bottom: 28px; }
.section-title { font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }
.divider { border: none; border-top: 1px solid var(--border); margin: 28px 0; }
footer { background: var(--surface); border-top: 1px solid var(--border); padding: 16px 20px; text-align: center; font-size: 12px; color: var(--muted); flex-shrink: 0; }
footer a { color: var(--muted); text-decoration: none; }
footer a:hover { color: var(--text); }
`;

// ── Negocio page template ─────────────────────────────────────────────────────

function renderContact(c) {
  if (!c) return '';
  const e = esc(c);
  if (/^https?:\/\//i.test(c)) {
    const icon = /instagram/i.test(c) ? '📸' : /wa\.me|whatsapp/i.test(c) ? '💬' : /t\.me|telegram/i.test(c) ? '✈️' : '🔗';
    return `<a href="${e}" target="_blank" rel="noopener noreferrer">${icon} ${e}</a>`;
  }
  if (/^@\w/.test(c)) return `<a href="https://instagram.com/${esc(c.slice(1))}" target="_blank" rel="noopener noreferrer">📸 ${e}</a>`;
  if (/^\+?[\d\s\-()+]{6,}$/.test(c)) return `📞 <a href="tel:${c.replace(/[^\d+]/g, '')}">${e}</a>`;
  return `📞 ${e}`;
}

function getWaLink(c) {
  if (!c) return null;
  if (/wa\.me/i.test(c)) return c.startsWith('http') ? c : 'https://' + c;
  if (/^\+?[\d\s\-()+]{7,}$/.test(c)) {
    const d = c.replace(/\D/g, '');
    const intl = d.startsWith('58') ? d : '58' + d.replace(/^0/, '');
    return `https://wa.me/${intl}`;
  }
  return null;
}

function negocioPage(n) {
  const emoji    = TIPO_EMOJI[n.tipo] || '📍';
  const tipoLbl  = TIPO_LABEL[n.tipo] || n.tipo;
  const criptos  = (n.criptos || []).join(', ');
  const url      = `${SITE_URL}/negocio/${n.slug}/`;
  const wa       = getWaLink(n.contacto);

  const metaDesc = truncate(
    `${n.nombre} acepta ${criptos} en Venezuela.${n.ciudad ? ` Ubicado en ${n.ciudad}.` : ''} ${n.descripcion || ''}`.trim(),
    155
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': n.online ? 'OnlineBusiness' : 'LocalBusiness',
    name: n.nombre,
    description: n.descripcion || `${n.nombre} acepta criptomonedas en Venezuela.`,
    url,
    ...(n.logo_url ? { image: n.logo_url } : {}),
    currenciesAccepted: criptos || 'Criptomonedas',
    paymentAccepted: 'Criptomonedas',
    ...(!n.online && n.ciudad ? {
      address: { '@type': 'PostalAddress', addressLocality: n.ciudad, addressCountry: 'VE' },
    } : {}),
    ...(!n.online && n.lat && n.lng ? {
      geo: { '@type': 'GeoCoordinates', latitude: n.lat, longitude: n.lng },
    } : {}),
  };

  const criptosHtml = (n.criptos || []).map(id => {
    const m = CRIPTOS_META[id] || { label: id, color: '#9AA0AC', border: '#9AA0AC44', bg: '#9aa0ac18' };
    return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:700;background:${m.bg};color:${m.color};border:1px solid ${m.border}">${esc(m.label)}</span>`;
  }).join('');

  const shareText = encodeURIComponent(
    `🗺️ ${n.nombre} acepta criptomonedas en Venezuela!\n${n.ciudad ? `📍 ${n.ciudad}\n` : ''}\n${url}`
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(n.nombre)} – acepta cripto en Venezuela | MapaCripto</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta property="og:type" content="business.business">
  <meta property="og:title" content="${esc(n.nombre)} | MapaCripto Venezuela">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(n.nombre)} | MapaCripto Venezuela">
  <meta name="twitter:description" content="${esc(metaDesc)}">
  <link rel="canonical" href="${esc(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script type="application/ld+json">${escJson(jsonLd)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_CSS}
    .profile-hero { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 28px; }
    .profile-logo { width: 96px; height: 96px; border-radius: 16px; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0; background: var(--surface2); }
    .profile-logo-placeholder { width: 96px; height: 96px; border-radius: 16px; background: var(--surface2); border: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 36px; }
    .profile-info h1 { font-size: clamp(20px, 5vw, 28px); font-weight: 800; line-height: 1.2; margin-bottom: 8px; }
    .badge-tipo { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: var(--surface2); color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .4px; }
    .profile-meta { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .desc-text { font-size: 15px; color: var(--muted); line-height: 1.75; }
    .contact-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .contact-info { font-size: 15px; font-weight: 500; word-break: break-all; }
    .contact-info a { color: var(--accent); text-decoration: none; }
    .contact-info a:hover { text-decoration: underline; }
    .btn-wa { display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 20px; border-radius: 10px; white-space: nowrap; }
    .maps-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); color: var(--text); text-decoration: none; font-size: 14px; font-weight: 600; }
    .maps-btn:hover { border-color: var(--accent); }
    .share-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn-share { flex: 1; min-width: 120px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-family: inherit; }
    .btn-share-wa  { background: #25D366; color: #fff; }
    .btn-share-x   { background: #000; color: #fff; }
    .btn-mapa { display: block; text-align: center; padding: 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-weight: 700; font-size: 14px; }
    .btn-mapa:hover { background: var(--surface2); }
    .owner-box { margin-top: 40px; border: 1px dashed var(--border); border-radius: 14px; padding: 20px; text-align: center; }
    .owner-box p { font-size: 13px; color: var(--muted); line-height: 1.6; }
    .owner-box a { color: var(--accent); }
    .rating-display { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .stars-display { font-size: 20px; letter-spacing: 2px; color: #F7931A; }
    .rating-avg { font-size: 18px; font-weight: 700; color: var(--text); margin-right: 4px; }
    .rating-meta { font-size: 13px; color: var(--muted); }
    .stars-input { display: flex; gap: 6px; margin-top: 12px; display: none; }
    .star-btn { font-size: 28px; background: none; border: none; cursor: pointer; color: var(--border); transition: color .1s, transform .1s; padding: 2px; }
    .star-btn:hover, .star-btn.hov { color: #F7931A; transform: scale(1.15); }
    .star-btn.sel { color: #F7931A; }
    .rating-hint { font-size: 12px; color: var(--muted); margin-top: 8px; }
    .rating-thanks { font-size: 13px; color: var(--success); font-weight: 600; margin-top: 10px; display: none; }
    @media (max-width: 500px) { .profile-hero { flex-direction: column; } .profile-logo, .profile-logo-placeholder { width: 72px; height: 72px; } }
  </style>
</head>
<body>
${header('/', 'Volver al mapa')}
<main>
  <div class="profile-hero">
    ${n.logo_url
      ? `<img class="profile-logo" src="${esc(n.logo_url)}" alt="${esc(n.nombre)}" width="96" height="96">`
      : `<div class="profile-logo-placeholder">${emoji}</div>`}
    <div class="profile-info">
      <h1>${esc(n.nombre)}</h1>
      <span class="badge-tipo">${emoji} ${esc(tipoLbl)}</span>
      ${n.online
        ? `<p class="profile-meta">🌐 Tienda online</p>`
        : n.ciudad ? `<p class="profile-meta">🏙️ ${esc(n.ciudad)}</p>` : ''}
    </div>
  </div>

  ${criptosHtml ? `
  <div class="section">
    <div class="section-title">Acepta</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${criptosHtml}</div>
  </div>` : ''}

  ${n.descripcion ? `
  <div class="section">
    <div class="section-title">Descripción</div>
    <p class="desc-text">${esc(n.descripcion)}</p>
  </div>` : ''}

  ${n.contacto ? `
  <div class="section">
    <div class="section-title">Contacto</div>
    <div class="contact-card">
      <div class="contact-info">${renderContact(n.contacto)}</div>
      ${wa ? `<a class="btn-wa" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ''}
    </div>
  </div>` : ''}

  ${!n.online && n.lat && n.lng ? `
  <div class="section">
    <div class="section-title">Ubicación</div>
    <a class="maps-btn" href="https://maps.google.com/?q=${encodeURIComponent(n.lat + ',' + n.lng)}" target="_blank" rel="noopener noreferrer">
      🗺️ Ver en Google Maps
    </a>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Valoraciones</div>
    <div id="rating-display" class="rating-display">
      <span class="rating-meta">Cargando…</span>
    </div>
    <div id="rating-input" class="stars-input">
      <button class="star-btn" onclick="rate(1)">★</button>
      <button class="star-btn" onclick="rate(2)">★</button>
      <button class="star-btn" onclick="rate(3)">★</button>
      <button class="star-btn" onclick="rate(4)">★</button>
      <button class="star-btn" onclick="rate(5)">★</button>
    </div>
    <p class="rating-hint">Toca las estrellas para dejar tu valoración.</p>
    <p class="rating-thanks" id="rating-thanks">¡Gracias por tu valoración! ⭐</p>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-title">Compartir</div>
    <div class="share-row">
      ${wa
        ? `<a class="btn-share btn-share-wa" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>`
        : `<a class="btn-share btn-share-wa" href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>`}
      <a class="btn-share btn-share-x" href="https://twitter.com/intent/tweet?text=${shareText}" target="_blank" rel="noopener noreferrer">𝕏 Twitter</a>
    </div>
  </div>

  <a class="btn-mapa" href="/">🗺️ Ver en el mapa interactivo →</a>

  <div class="owner-box">
    <p>¿Eres el dueño de este negocio?<br>
      Usa el enlace de edición que recibiste al registrarte para actualizar tus datos.
      Si lo perdiste escríbenos a <a href="mailto:criptomapavenezuela@proton.me">criptomapavenezuela@proton.me</a>.
    </p>
  </div>
</main>
${footer()}
<script>
const API = 'https://api.criptomapavenezuela.com';
const NID = '${esc(String(n.id))}';
(async () => {
  try {
    const r = await fetch(API + '/api/negocios/' + NID + '/rating');
    const d = await r.json();
    const el = document.getElementById('rating-display');
    if (d.avg !== null && d.count > 0) {
      const stars = '★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg));
      el.innerHTML = '<span class="stars-display">' + stars + '</span><span class="rating-avg">' + d.avg + '</span><span class="rating-meta">(' + d.count + ' valoraciones)</span>';
    } else {
      el.innerHTML = '<span class="rating-meta">Sin valoraciones aún — sé el primero.</span>';
    }
    document.getElementById('rating-input').style.display = 'flex';
  } catch {}
  fetch(API + '/api/negocios/' + NID + '/view', { method: 'POST' }).catch(() => {});
})();
function rate(stars) {
  document.getElementById('rating-input').style.display = 'none';
  document.getElementById('rating-thanks').style.display = 'block';
  fetch(API + '/api/negocios/' + NID + '/rating', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stars }),
  }).then(r => r.json()).then(d => {
    if (!d.ok) return;
    const el = document.getElementById('rating-display');
    const s = '★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg));
    el.innerHTML = '<span class="stars-display">' + s + '</span><span class="rating-avg">' + d.avg + '</span><span class="rating-meta">(' + d.count + ' valoraciones)</span>';
  }).catch(() => {});
}
</script>
</body>
</html>`;
}

// ── Ciudad page template ──────────────────────────────────────────────────────

function ciudadPage(ciudad, negocios) {
  const url      = `${SITE_URL}/ciudad/${slugify(ciudad)}/`;
  const title    = `Negocios que aceptan cripto en ${ciudad} | MapaCripto Venezuela`;
  const metaDesc = `Directorio de negocios y profesionales que aceptan Bitcoin, USDT y otras criptomonedas en ${ciudad}, Venezuela. ${negocios.length} registrados.`;

  const cards = negocios.map(n => {
    const emoji   = TIPO_EMOJI[n.tipo] || '📍';
    const tipoLbl = TIPO_LABEL[n.tipo] || n.tipo;
    const href    = n.slug ? `/negocio/${n.slug}/` : `/negocio.html?id=${n.id}`;
    return `<a class="biz-card" href="${esc(href)}">
      ${n.logo_url
        ? `<img class="biz-logo" src="${esc(n.logo_url)}" alt="${esc(n.nombre)}" width="52" height="52" loading="lazy">`
        : `<div class="biz-logo-ph">${emoji}</div>`}
      <div class="biz-info">
        <div class="biz-name">${esc(n.nombre)}</div>
        <div class="biz-tipo">${emoji} ${esc(tipoLbl)}</div>
        ${(n.criptos || []).slice(0, 3).map(c => `<span class="biz-chip">${esc(c)}</span>`).join('')}
      </div>
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <link rel="canonical" href="${esc(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_CSS}
    main { max-width: 860px; }
    .page-title { font-size: clamp(22px,5vw,32px); font-weight: 800; margin-bottom: 6px; }
    .page-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }
    .biz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .biz-card { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; text-decoration: none; color: var(--text); transition: border-color .15s; }
    .biz-card:hover { border-color: var(--accent); }
    .biz-logo { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
    .biz-logo-ph { width: 52px; height: 52px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .biz-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .biz-tipo { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .biz-chip { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: var(--surface2); color: var(--muted); border: 1px solid var(--border); margin-right: 4px; }
    .btn-mapa { display: inline-flex; align-items: center; gap: 8px; margin-top: 32px; padding: 12px 24px; border-radius: 12px; background: var(--surface); border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-weight: 700; font-size: 14px; }
    .btn-mapa:hover { background: var(--surface2); }
  </style>
</head>
<body>
${header('/', 'Volver al mapa')}
<main>
  <h1 class="page-title">Cripto en ${esc(ciudad)}</h1>
  <p class="page-sub">${negocios.length} negocio${negocios.length !== 1 ? 's' : ''} aceptando criptomonedas en ${esc(ciudad)}, Venezuela</p>
  <div class="biz-grid">${cards || '<p style="color:var(--muted)">Sin negocios registrados aún en esta ciudad.</p>'}</div>
  <a class="btn-mapa" href="/?ciudad=${encodeURIComponent(ciudad)}">🗺️ Ver en el mapa interactivo →</a>
</main>
${footer()}
</body>
</html>`;
}

// ── Categoría page template ───────────────────────────────────────────────────

function categoriaPage(tipo, negocios) {
  const label    = TIPO_LABEL[tipo] || tipo;
  const url      = `${SITE_URL}/categoria/${tipo}/`;
  const title    = `${label} que aceptan cripto en Venezuela | MapaCripto`;
  const metaDesc = `Directorio de ${label.toLowerCase()} que aceptan Bitcoin, USDT y otras criptomonedas en Venezuela. ${negocios.length} registrados.`;

  const cards = negocios.map(n => {
    const emoji = TIPO_EMOJI[n.tipo] || '📍';
    const href  = n.slug ? `/negocio/${n.slug}/` : `/negocio.html?id=${n.id}`;
    return `<a class="biz-card" href="${esc(href)}">
      ${n.logo_url
        ? `<img class="biz-logo" src="${esc(n.logo_url)}" alt="${esc(n.nombre)}" width="52" height="52" loading="lazy">`
        : `<div class="biz-logo-ph">${emoji}</div>`}
      <div class="biz-info">
        <div class="biz-name">${esc(n.nombre)}</div>
        ${n.ciudad ? `<div class="biz-tipo">📍 ${esc(n.ciudad)}</div>` : ''}
        ${(n.criptos || []).slice(0, 3).map(c => `<span class="biz-chip">${esc(c)}</span>`).join('')}
      </div>
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <link rel="canonical" href="${esc(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_CSS}
    main { max-width: 860px; }
    .page-title { font-size: clamp(22px,5vw,32px); font-weight: 800; margin-bottom: 6px; }
    .page-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }
    .biz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .biz-card { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; text-decoration: none; color: var(--text); transition: border-color .15s; }
    .biz-card:hover { border-color: var(--accent); }
    .biz-logo { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
    .biz-logo-ph { width: 52px; height: 52px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .biz-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .biz-tipo { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .biz-chip { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: var(--surface2); color: var(--muted); border: 1px solid var(--border); margin-right: 4px; }
    .btn-mapa { display: inline-flex; align-items: center; gap: 8px; margin-top: 32px; padding: 12px 24px; border-radius: 12px; background: var(--surface); border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-weight: 700; font-size: 14px; }
    .btn-mapa:hover { background: var(--surface2); }
  </style>
</head>
<body>
${header('/', 'Volver al mapa')}
<main>
  <h1 class="page-title">${esc(label)} · Cripto Venezuela</h1>
  <p class="page-sub">${negocios.length} ${esc(label.toLowerCase())}${negocios.length !== 1 ? 's' : ''} aceptando criptomonedas en Venezuela</p>
  <div class="biz-grid">${cards || '<p style="color:var(--muted)">Sin negocios registrados en esta categoría aún.</p>'}</div>
  <a class="btn-mapa" href="/?tipo=${encodeURIComponent(tipo)}">🗺️ Ver en el mapa interactivo →</a>
</main>
${footer()}
</body>
</html>`;
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

function sitemap(negocios, ciudades, categorias) {
  const today = new Date().toISOString().slice(0, 10);
  const urls  = [
    `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${SITE_URL}/quienes-somos.html</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
  ];
  for (const n of negocios) {
    if (n.slug) urls.push(`<url><loc>${SITE_URL}/negocio/${n.slug}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  for (const c of ciudades) {
    if (c.slug) urls.push(`<url><loc>${SITE_URL}/ciudad/${c.slug}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }
  for (const c of categorias) {
    urls.push(`<url><loc>${SITE_URL}/categoria/${c.tipo}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching data from ${API_BASE}…`);

  const [negocios, ciudades, categorias] = await Promise.all([
    fetchJSON(`${API_BASE}/api/negocios`),
    fetchJSON(`${API_BASE}/api/ciudades`),
    fetchJSON(`${API_BASE}/api/categorias`),
  ]);

  console.log(`  ${negocios.length} negocios · ${ciudades.length} ciudades · ${categorias.length} categorías`);

  // Wipe and recreate generated directories (handles deletions cleanly)
  for (const dir of ['negocio', 'ciudad', 'categoria']) {
    const d = path.join(DOCS_DIR, dir);
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
    fs.mkdirSync(d);
  }

  // ── Negocio pages
  let ok = 0, skip = 0;
  for (const n of negocios) {
    if (!n.slug) { skip++; continue; }
    try {
      write(path.join(DOCS_DIR, 'negocio', n.slug, 'index.html'), negocioPage(n));
      ok++;
    } catch (e) {
      console.warn(`  SKIP negocio ${n.slug}: ${e.message}`);
      skip++;
    }
  }
  console.log(`  negocio/: ${ok} generated, ${skip} skipped (no slug)`);

  // ── Ciudad pages
  let cOk = 0;
  for (const c of ciudades) {
    if (!c.slug) continue;
    const cityNegocios = negocios.filter(n => n.ciudad && slugify(n.ciudad) === c.slug);
    try {
      write(path.join(DOCS_DIR, 'ciudad', c.slug, 'index.html'), ciudadPage(c.ciudad, cityNegocios));
      cOk++;
    } catch (e) {
      console.warn(`  SKIP ciudad ${c.slug}: ${e.message}`);
    }
  }
  console.log(`  ciudad/: ${cOk} generated`);

  // ── Categoria pages
  let catOk = 0;
  for (const c of categorias) {
    const catNegocios = negocios.filter(n => n.tipo === c.tipo);
    try {
      write(path.join(DOCS_DIR, 'categoria', c.tipo, 'index.html'), categoriaPage(c.tipo, catNegocios));
      catOk++;
    } catch (e) {
      console.warn(`  SKIP categoria ${c.tipo}: ${e.message}`);
    }
  }
  console.log(`  categoria/: ${catOk} generated`);

  // ── Sitemap
  write(path.join(DOCS_DIR, 'sitemap.xml'), sitemap(negocios, ciudades, categorias));
  console.log('  sitemap.xml generated');

  console.log('\nBuild complete ✓');
}

main().catch(e => { console.error(e.message); process.exit(1); });
