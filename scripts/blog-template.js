// Plantillas HTML del blog, alineadas con el sistema de diseño (ver DESIGN.md).
// Paleta de páginas de contenido (familia #0F1117), fuente Inter, logo bandera SVG.
// Usado por generate-blog.js (genera) y rebuild-blog.js (re-skinea desde el estado).

const FRONTEND_URL = 'https://criptomapavenezuela.com';

const LOGO_SVG = `<svg width="26" height="17" viewBox="0 0 26 17" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;flex-shrink:0">
        <rect width="26" height="5.67" fill="#CF9B00"/>
        <rect y="5.67" width="26" height="5.67" fill="#003893"/>
        <rect y="11.33" width="26" height="5.67" fill="#CF142B"/>
        <circle cx="2.8"  cy="8.8"  r="0.72" fill="white"/>
        <circle cx="5.7"  cy="7.9"  r="0.72" fill="white"/>
        <circle cx="8.6"  cy="7.3"  r="0.72" fill="white"/>
        <circle cx="11.5" cy="7.0"  r="0.72" fill="white"/>
        <circle cx="14.5" cy="7.0"  r="0.72" fill="white"/>
        <circle cx="17.4" cy="7.3"  r="0.72" fill="white"/>
        <circle cx="20.3" cy="7.9"  r="0.72" fill="white"/>
        <circle cx="23.2" cy="8.8"  r="0.72" fill="white"/>
      </svg>`;

// Iconos Font Awesome por categoría (pill de sección)
const CAT_ICON = {
  'Bitcoin':               'fa-brands fa-bitcoin',
  'Finanzas personales':   'fa-solid fa-wallet',
  'Pagos cripto':          'fa-solid fa-money-bill-transfer',
  'Wallets':               'fa-solid fa-shield-halved',
  'Stablecoins':           'fa-solid fa-coins',
  'Educación cripto':      'fa-solid fa-graduation-cap',
  'Cripto en Venezuela':   'fa-solid fa-map-location-dot'
};

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio',
                'julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

function year() {
  // Año fijo derivado del último post para evitar Date.now en builds reproducibles.
  return new Date().getFullYear();
}

// CSS compartido — refleja los tokens y componentes de quienes-somos.html
const BASE_CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary:  #CF142B;
      --accent:   #F7931A;
      --blue:     #003893;
      --bg:       #0F1117;
      --surface:  #1C1F26;
      --surface2: #252930;
      --border:   #2E3340;
      --text:     #E8EAED;
      --muted:    #9AA0AC;
      --success:  #22C55E;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* ── Header ── */
    header {
      background: rgba(15,17,23,.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 100;
      border-bottom: 1px solid var(--border);
    }
    .header-inner {
      max-width: 900px; margin: 0 auto; padding: 0 24px;
      height: 60px; display: flex; align-items: center; gap: 12px;
    }
    .logo {
      display: flex; align-items: center; gap: 9px;
      font-weight: 800; font-size: 17px; text-decoration: none;
      color: var(--text); letter-spacing: -.3px;
    }
    .back-btn {
      margin-left: auto; display: flex; align-items: center; gap: 6px;
      color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500;
      transition: color .15s, border-color .15s;
      border: 1px solid var(--border); padding: 6px 14px; border-radius: 8px;
    }
    .back-btn:hover { color: var(--text); border-color: var(--accent); }

    main { flex: 1; }
    a { color: var(--accent); }

    /* ── Footer ── */
    footer {
      background: var(--surface); border-top: 1px solid var(--border);
      padding: 20px; text-align: center; font-size: 12px; color: var(--muted);
    }
    footer a { color: var(--muted); text-decoration: none; }
    footer a:hover { color: var(--text); }

    /* ── CTA box ── */
    .cta-box {
      background: linear-gradient(135deg, rgba(247,147,26,.08) 0%, rgba(0,56,147,.06) 100%);
      border: 1px solid rgba(247,147,26,.2); border-radius: 20px;
      padding: 48px 40px; text-align: center; position: relative; overflow: hidden;
    }
    .cta-box::before {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 0%, rgba(247,147,26,.07) 0%, transparent 60%);
    }
    .cta-box h2 {
      font-size: clamp(22px, 4vw, 30px); font-weight: 800;
      letter-spacing: -.02em; margin-bottom: 12px; position: relative;
    }
    .cta-box p { font-size: 16px; color: var(--muted); margin-bottom: 28px; position: relative; }
    .cta-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--accent); color: #fff; text-decoration: none;
      font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px;
      transition: opacity .15s, transform .15s; position: relative;
    }
    .cta-btn:hover { opacity: .9; transform: translateY(-1px); }`;

function headerHtml(backHref, backLabel) {
  return `<header>
  <div class="header-inner">
    <a class="logo" href="${FRONTEND_URL}/">
      ${LOGO_SVG}
      CriptoMapa
    </a>
    <a class="back-btn" href="${backHref}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg>
      ${backLabel}
    </a>
  </div>
</header>`;
}

function footerHtml() {
  return `<footer>
  <p>© ${year()} CriptoMapa Venezuela ·
     <a href="${FRONTEND_URL}/blog/">Blog</a> ·
     <a href="${FRONTEND_URL}/faq.html">FAQ</a> ·
     <a href="${FRONTEND_URL}/quienes-somos.html">Quiénes somos</a> ·
     <a href="${FRONTEND_URL}/terms.html">Términos</a> ·
     <a href="${FRONTEND_URL}/privacy.html">Privacidad</a></p>
</footer>`;
}

const ctaBox = `  <div class="cta-box">
    <h2>¿Tu negocio acepta cripto?</h2>
    <p>Regístralo gratis y aparece en el mapa para que más clientes te encuentren en toda Venezuela.</p>
    <a class="cta-btn" href="${FRONTEND_URL}/">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Registrar mi negocio
    </a>
  </div>`;

// ── Artículo individual ──────────────────────────────────────────────────────

function articleHtml(article, topic, date) {
  const url     = `${FRONTEND_URL}/blog/${article.slug}.html`;
  const catIcon = CAT_ICON[topic.category] || 'fa-solid fa-newspaper';
  const sections = article.sections.map(s =>
    `      <h2>${s.heading}</h2>\n      ${s.content}`
  ).join('\n\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} | CriptoMapa Venezuela</title>
  <meta name="description" content="${article.metaDescription}">
  <meta name="keywords" content="${article.keywords.join(', ')}">
  <meta name="theme-color" content="#0F1117">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:title"       content="${article.title}">
  <meta property="og:description" content="${article.metaDescription}">
  <meta property="og:url"         content="${url}">
  <meta property="og:type"        content="article">
  <meta property="og:site_name"   content="CriptoMapa Venezuela">
  <meta property="og:image"       content="${FRONTEND_URL}/og-image.png">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:site"       content="@criptomapavzla">
  <meta name="twitter:title"      content="${article.title}">
  <meta name="twitter:description" content="${article.metaDescription}">
  <meta name="twitter:image"      content="${FRONTEND_URL}/og-image.png">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(article.title)},
    "description": ${JSON.stringify(article.metaDescription)},
    "url": ${JSON.stringify(url)},
    "datePublished": "${date}",
    "dateModified": "${date}",
    "author": { "@type": "Organization", "name": "CriptoMapa Venezuela", "url": "${FRONTEND_URL}" },
    "publisher": { "@type": "Organization", "name": "CriptoMapa Venezuela", "url": "${FRONTEND_URL}" },
    "keywords": ${JSON.stringify(article.keywords.join(', '))}
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <style>
${BASE_CSS}

    /* ── Article hero ── */
    .art-hero {
      position: relative; overflow: hidden;
      max-width: 760px; margin: 0 auto; padding: 64px 24px 32px;
    }
    .art-hero-glow { position: absolute; inset: 0; pointer-events: none; }
    .art-hero-glow::before {
      content: ''; position: absolute; top: -40px; left: 30%;
      width: 500px; height: 300px;
      background: radial-gradient(ellipse, rgba(247,147,26,.10) 0%, transparent 70%);
    }
    .art-hero-glow::after {
      content: ''; position: absolute; top: 20px; left: 0;
      width: 350px; height: 180px;
      background: radial-gradient(ellipse, rgba(0,56,147,.08) 0%, transparent 70%);
    }

    .breadcrumb {
      position: relative; font-size: 13px; color: var(--muted); margin-bottom: 20px;
    }
    .breadcrumb a { color: var(--muted); text-decoration: none; }
    .breadcrumb a:hover { color: var(--accent); }

    .section-pill {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid rgba(247,147,26,.35); background: rgba(247,147,26,.07);
      color: var(--accent); font-size: 11px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase;
      padding: 5px 12px; border-radius: 100px; margin-bottom: 18px;
      position: relative;
    }

    .art-hero h1 {
      position: relative;
      font-size: clamp(28px, 5vw, 44px); font-weight: 900;
      line-height: 1.12; letter-spacing: -.03em; margin-bottom: 16px;
    }
    .art-date { position: relative; font-size: 14px; color: var(--muted); }

    /* ── Article body ── */
    .art-body { max-width: 760px; margin: 0 auto; padding: 16px 24px 64px; }
    .intro {
      font-size: 19px; line-height: 1.65; color: var(--text);
      border-left: 3px solid var(--accent); padding-left: 18px; margin-bottom: 40px;
    }
    .intro p { margin: 0; }

    .prose h2 {
      font-size: clamp(22px, 3.5vw, 28px); font-weight: 800;
      letter-spacing: -.02em; line-height: 1.25;
      margin: 44px 0 16px; padding-left: 14px; border-left: 3px solid var(--accent);
    }
    .prose p { font-size: 17px; color: var(--muted); line-height: 1.8; margin-bottom: 18px; }
    .prose strong { color: var(--text); font-weight: 700; }
    .prose em { color: var(--text); }
    .prose ul, .prose ol { margin: 0 0 20px; padding-left: 4px; list-style: none; display: flex; flex-direction: column; gap: 12px; }
    .prose ol { counter-reset: li; }
    .prose li { font-size: 17px; color: var(--muted); line-height: 1.7; display: flex; align-items: flex-start; gap: 12px; }
    .prose ul li::before {
      content: ''; flex-shrink: 0; width: 18px; height: 18px; margin-top: 4px;
      background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3); border-radius: 50%;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='8' viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L3.5 6.5L9 1' stroke='%2322C55E' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: center;
    }
    .prose ol li { counter-increment: li; }
    .prose ol li::before {
      content: counter(li); flex-shrink: 0; width: 22px; height: 22px; margin-top: 2px;
      display: flex; align-items: center; justify-content: center;
      background: var(--accent); color: #fff; border-radius: 50%; font-size: 12px; font-weight: 700;
    }
    .prose li strong { color: var(--text); }

    .conclusion {
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 28px 28px; margin: 40px 0;
    }
    .conclusion p { font-size: 17px; color: var(--text-2, #C4C7CE); line-height: 1.75; margin: 0; }

    @media (max-width: 600px) {
      .art-hero { padding: 44px 20px 24px; }
      .art-body { padding: 12px 20px 48px; }
      .cta-box { padding: 36px 20px; }
      .intro { font-size: 17px; }
      .prose p, .prose li { font-size: 16px; }
    }
  </style>
</head>
<body>

${headerHtml(`${FRONTEND_URL}/blog/`, 'Volver al blog')}

<main>
  <div class="art-hero">
    <div class="art-hero-glow"></div>
    <nav class="breadcrumb">
      <a href="${FRONTEND_URL}/">Inicio</a> ›
      <a href="${FRONTEND_URL}/blog/">Blog</a> ›
      ${topic.category}
    </nav>
    <div class="section-pill"><i class="${catIcon}"></i> ${topic.category}</div>
    <h1>${article.title}</h1>
    <div class="art-date"><i class="fa-regular fa-calendar"></i> ${formatDate(date)}</div>
  </div>

  <article class="art-body">
    <div class="intro">${article.intro}</div>
    <div class="prose">
${sections}
    </div>
    <div class="conclusion">${article.conclusion}</div>
  </article>

  <div class="art-body" style="padding-top:0">
${ctaBox}
  </div>
</main>

${footerHtml()}

</body>
</html>`;
}

// ── Índice del blog ────────────────────────────────────────────────────────

function buildBlogIndex(posts) {
  const cards = [...posts].reverse().map(p => {
    const catIcon = CAT_ICON[p.category] || 'fa-solid fa-newspaper';
    return `      <a class="post-card" href="${FRONTEND_URL}/blog/${p.slug}.html">
        <div class="post-cat"><i class="${catIcon}"></i> ${p.category}</div>
        <h2>${p.title}</h2>
        <p>${p.metaDescription}</p>
        <div class="post-foot">
          <time datetime="${p.date}">${formatDate(p.date)}</time>
          <span class="read-more">Leer <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg></span>
        </div>
      </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog – CriptoMapa Venezuela</title>
  <meta name="description" content="Guías y artículos sobre Bitcoin, criptomonedas, wallets, pagos cripto y finanzas personales en Venezuela.">
  <meta name="theme-color" content="#0F1117">
  <link rel="canonical" href="${FRONTEND_URL}/blog/">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:title"       content="Blog – CriptoMapa Venezuela">
  <meta property="og:description" content="Guías y artículos sobre Bitcoin, criptomonedas y finanzas en Venezuela.">
  <meta property="og:url"         content="${FRONTEND_URL}/blog/">
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="CriptoMapa Venezuela">
  <meta property="og:image"       content="${FRONTEND_URL}/og-image.png">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:site"       content="@criptomapavzla">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <style>
${BASE_CSS}

    /* ── Page hero ── */
    .hero {
      position: relative; text-align: center; overflow: hidden;
      padding: 80px 24px 48px;
    }
    .hero-glow { position: absolute; inset: 0; pointer-events: none; }
    .hero-glow::before {
      content: ''; position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
      width: 700px; height: 360px;
      background: radial-gradient(ellipse, rgba(247,147,26,.12) 0%, transparent 70%);
    }
    .hero-glow::after {
      content: ''; position: absolute; top: 30px; left: 50%; transform: translateX(-50%);
      width: 400px; height: 200px;
      background: radial-gradient(ellipse, rgba(0,56,147,.1) 0%, transparent 70%);
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 7px; position: relative;
      border: 1px solid rgba(247,147,26,.35); background: rgba(247,147,26,.07);
      color: var(--accent); font-size: 12px; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase;
      padding: 6px 16px; border-radius: 100px; margin-bottom: 24px;
    }
    .hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.4); } }

    .hero h1 {
      position: relative; font-size: clamp(34px, 6vw, 56px); font-weight: 900;
      line-height: 1.1; letter-spacing: -.03em; margin-bottom: 16px;
    }
    .hero h1 .grad {
      background: linear-gradient(135deg, #F7931A 0%, #FFD166 50%, #F7931A 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .hero p { position: relative; font-size: clamp(15px, 2.5vw, 18px); color: var(--muted); line-height: 1.7; max-width: 520px; margin: 0 auto; }

    /* ── Grid ── */
    .content { max-width: 900px; margin: 0 auto; padding: 24px 24px 80px; }
    .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 18px; }

    .post-card {
      display: flex; flex-direction: column; gap: 10px; text-decoration: none;
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 24px 22px; transition: border-color .2s, transform .2s;
    }
    .post-card:hover { border-color: rgba(247,147,26,.4); transform: translateY(-2px); }
    .post-cat {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
      color: var(--accent);
    }
    .post-card h2 { font-size: 17px; font-weight: 800; line-height: 1.35; color: var(--text); letter-spacing: -.01em; }
    .post-card p { font-size: 14px; color: var(--muted); line-height: 1.6; flex: 1; }
    .post-foot {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 12px; color: var(--muted); margin-top: 6px;
    }
    .read-more { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-weight: 600; }

    .empty { text-align: center; color: var(--muted); padding: 60px 0; }

    @media (max-width: 600px) {
      .hero { padding: 56px 20px 36px; }
      .content { padding: 20px 20px 64px; }
    }
  </style>
</head>
<body>

${headerHtml(`${FRONTEND_URL}/`, 'Volver al mapa')}

<main>
  <section class="hero">
    <div class="hero-glow"></div>
    <div class="hero-badge"><span class="hero-badge-dot"></span> Aprende cripto</div>
    <h1>Blog de <span class="grad">CriptoMapa</span></h1>
    <p>Guías prácticas sobre Bitcoin, wallets, pagos cripto y finanzas personales, pensadas para venezolanos.</p>
  </section>

  <div class="content">
    ${posts.length === 0
      ? '<div class="empty"><p>Próximamente nuevos artículos…</p></div>'
      : `<div class="post-grid">\n${cards}\n    </div>`}
  </div>
</main>

${footerHtml()}

</body>
</html>`;
}

module.exports = { articleHtml, buildBlogIndex, formatDate, FRONTEND_URL };
