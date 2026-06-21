#!/usr/bin/env node
// Genera artículos de blog SEO-optimizados usando Claude API.
// Uso: COUNT=2 node scripts/generate-blog.js
const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');

const TOPICS       = require('./blog-topics');
const STATE_FILE   = path.join(__dirname, 'blog-state.json');
const BLOG_DIR     = path.join(__dirname, '../docs/blog');
const SITEMAP_FILE = path.join(__dirname, '../docs/sitemap.xml');
const FRONTEND_URL = 'https://criptomapavenezuela.com';
const COUNT        = parseInt(process.env.COUNT || '2', 10);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── state ────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { usedTopics: [], posts: [] };
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function pickTopics(state, count) {
  const used = new Set(state.usedTopics);
  let available = TOPICS.filter(t => !used.has(t.id));
  if (available.length === 0) {
    console.log('Todos los temas usados — reiniciando ciclo.');
    state.usedTopics = [];
    available = [...TOPICS];
  }
  // Fisher-Yates shuffle (seeded by process.pid for reproducibility in tests)
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

// ── generation ───────────────────────────────────────────────────────────────

async function generateArticle(topic) {
  const prompt = `Eres un experto en criptomonedas y finanzas personales que escribe para venezolanos. \
Genera un artículo de blog SEO-optimizado en español sobre el siguiente tema.

Tema: ${topic.title}
Categoría: ${topic.category}
Keywords objetivo: ${topic.keywords.join(', ')}
Contexto: ${topic.context}

Requisitos del artículo:
- Entre 900 y 1300 palabras en total
- Lenguaje claro, directo y práctico; sin tecnicismos innecesarios
- Ejemplos reales aplicables en Venezuela
- Menciona CriptoMapa Venezuela (https://criptomapavenezuela.com) de forma natural como el directorio para encontrar negocios que aceptan cripto en Venezuela — solo si el contexto lo permite
- Estructurado con secciones H2 claras que respondan preguntas que venezolanos buscan en Google
- Contenido evergreen: no debe depender de fechas, precios actuales ni eventos específicos
- Cada sección debe tener al menos 2 párrafos o una lista con al menos 4 ítems
- El contenido HTML puede usar: <p>, <ul>, <ol>, <li>, <strong>, <em> — nada más

Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones adicionales:
{
  "title": "título SEO del artículo (60-70 caracteres)",
  "slug": "slug-url-amigable-sin-tildes",
  "metaDescription": "descripción meta de 150-160 caracteres que invita a leer",
  "intro": "<p>párrafo introductorio que engancha al lector en 2-4 oraciones</p>",
  "sections": [
    {
      "heading": "título H2 de la sección",
      "content": "<p>contenido HTML de la sección</p>"
    }
  ],
  "conclusion": "<p>conclusión que resume el valor del artículo y tiene un llamado a la acción</p>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(raw);
}

// ── HTML builders ────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d} de ${months[m - 1]} de ${y}`;
}

function articleHtml(article, topic, date) {
  const url      = `${FRONTEND_URL}/blog/${article.slug}.html`;
  const sections = article.sections.map(s =>
    `<h2>${s.heading}</h2>\n    ${s.content}`
  ).join('\n\n    ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} | CriptoMapa Venezuela</title>
  <meta name="description" content="${article.metaDescription}">
  <meta name="keywords" content="${article.keywords.join(', ')}">
  <link rel="canonical" href="${url}">

  <meta property="og:title"       content="${article.title}">
  <meta property="og:description" content="${article.metaDescription}">
  <meta property="og:url"         content="${url}">
  <meta property="og:type"        content="article">
  <meta property="og:site_name"   content="CriptoMapa Venezuela">
  <meta property="og:image"       content="${FRONTEND_URL}/og-image.png">
  <meta name="twitter:card"       content="summary">
  <meta name="twitter:title"      content="${article.title}">
  <meta name="twitter:description" content="${article.metaDescription}">

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

  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.75}
    a{color:#F7931A;text-decoration:none}
    a:hover{text-decoration:underline}

    header{background:#1e293b;border-bottom:1px solid #334155;padding:0 1rem}
    .hdr{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:.75rem;height:56px}
    .logo{display:flex;align-items:center;gap:.5rem;color:#f1f5f9;font-weight:700;font-size:1rem}
    .logo:hover{text-decoration:none}
    .badge{background:#F7931A;color:#000;font-size:.65rem;font-weight:800;padding:2px 6px;border-radius:4px}

    nav.bc{background:#1e293b;border-bottom:1px solid #0f172a;padding:.45rem 1rem;font-size:.78rem;color:#64748b}
    nav.bc .inner{max-width:860px;margin:0 auto}
    nav.bc a{color:#64748b}
    nav.bc a:hover{color:#F7931A}

    main{max-width:860px;margin:0 auto;padding:2rem 1rem 4rem}

    .meta{font-size:.78rem;color:#64748b;margin-bottom:1.25rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
    .cat{background:#1e293b;color:#94a3b8;padding:2px 8px;border-radius:4px;font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}

    h1{font-size:clamp(1.45rem,4vw,1.9rem);color:#f1f5f9;line-height:1.3;margin-bottom:1rem}

    .intro{font-size:1.05rem;color:#94a3b8;border-left:3px solid #334155;padding-left:1rem;margin-bottom:2rem}
    .intro p{color:#94a3b8}

    .body h2{font-size:1.15rem;color:#f1f5f9;margin:2rem 0 .65rem;border-left:3px solid #F7931A;padding-left:.75rem}
    .body p{color:#cbd5e1;margin-bottom:1rem}
    .body ul,.body ol{margin:.5rem 0 1rem 1.4rem;color:#cbd5e1}
    .body li{margin-bottom:.3rem}
    .body strong{color:#f1f5f9}
    .body em{color:#94a3b8}

    .conclusion{background:#1e293b;border-radius:8px;padding:1.25rem 1.5rem;margin-top:2rem}
    .conclusion p{color:#cbd5e1;margin:0}

    .cta{background:linear-gradient(135deg,#1e293b 0%,#0f2040 100%);border:1px solid rgba(247,147,26,.2);border-radius:12px;padding:2rem;text-align:center;margin-top:3rem}
    .cta h3{color:#f1f5f9;margin-bottom:.4rem;font-size:1.05rem}
    .cta p{color:#94a3b8;font-size:.875rem;margin-bottom:1.25rem}
    .cta-btn{display:inline-block;background:#F7931A;color:#000;font-weight:700;padding:11px 26px;border-radius:8px;font-size:.9rem}
    .cta-btn:hover{background:#e8850f;text-decoration:none}

    footer{background:#1e293b;border-top:1px solid #334155;padding:1.5rem 1rem;text-align:center;color:#64748b;font-size:.78rem}
    footer a{color:#64748b}
    footer a:hover{color:#F7931A}
    .flinks{display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;margin-bottom:.6rem}
  </style>
</head>
<body>

<header>
  <div class="hdr">
    <a href="${FRONTEND_URL}" class="logo">🗺️ <span>CriptoMapa</span><span class="badge">VE</span></a>
    <span style="margin-left:auto;font-size:.8rem">
      <a href="${FRONTEND_URL}/blog/" style="color:#94a3b8">← Blog</a>
    </span>
  </div>
</header>

<nav class="bc">
  <div class="inner">
    <a href="${FRONTEND_URL}">Inicio</a> ›
    <a href="${FRONTEND_URL}/blog/">Blog</a> ›
    ${article.title}
  </div>
</nav>

<main>
  <div class="meta">
    <span class="cat">${topic.category}</span>
    <time datetime="${date}">${formatDate(date)}</time>
  </div>

  <h1>${article.title}</h1>

  <div class="intro">${article.intro}</div>

  <article class="body">
    ${sections}
    <div class="conclusion">${article.conclusion}</div>
  </article>

  <div class="cta">
    <h3>¿Buscas negocios que acepten cripto en Venezuela?</h3>
    <p>Encuentra tiendas, restaurantes y servicios que aceptan Bitcoin, USDT y más en tu ciudad.</p>
    <a href="${FRONTEND_URL}" class="cta-btn">Ver el mapa →</a>
  </div>
</main>

<footer>
  <div class="flinks">
    <a href="${FRONTEND_URL}">Mapa</a>
    <a href="${FRONTEND_URL}/blog/">Blog</a>
    <a href="${FRONTEND_URL}/faq.html">FAQ</a>
    <a href="${FRONTEND_URL}/quienes-somos.html">Quiénes somos</a>
  </div>
  © ${new Date().getFullYear()} CriptoMapa Venezuela
</footer>

</body>
</html>`;
}

function buildBlogIndex(posts) {
  const cards = [...posts].reverse().map(p => `
    <article class="card">
      <div class="card-cat">${p.category}</div>
      <h2><a href="${FRONTEND_URL}/blog/${p.slug}.html">${p.title}</a></h2>
      <p>${p.metaDescription}</p>
      <div class="card-foot">
        <time datetime="${p.date}">${formatDate(p.date)}</time>
        <a href="${FRONTEND_URL}/blog/${p.slug}.html">Leer →</a>
      </div>
    </article>`).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog — CriptoMapa Venezuela</title>
  <meta name="description" content="Guías y artículos sobre Bitcoin, criptomonedas, finanzas personales y pagos cripto en Venezuela.">
  <link rel="canonical" href="${FRONTEND_URL}/blog/">
  <meta property="og:title"       content="Blog — CriptoMapa Venezuela">
  <meta property="og:description" content="Guías y artículos sobre Bitcoin, criptomonedas y finanzas en Venezuela.">
  <meta property="og:url"         content="${FRONTEND_URL}/blog/">
  <meta property="og:type"        content="website">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6}
    a{color:#F7931A;text-decoration:none}
    a:hover{text-decoration:underline}

    header{background:#1e293b;border-bottom:1px solid #334155;padding:0 1rem}
    .hdr{max-width:900px;margin:0 auto;display:flex;align-items:center;gap:.75rem;height:56px}
    .logo{display:flex;align-items:center;gap:.5rem;color:#f1f5f9;font-weight:700;font-size:1rem}
    .logo:hover{text-decoration:none}
    .badge{background:#F7931A;color:#000;font-size:.65rem;font-weight:800;padding:2px 6px;border-radius:4px}

    main{max-width:900px;margin:0 auto;padding:2.5rem 1rem 4rem}
    .page-hdr{margin-bottom:2rem}
    .page-hdr h1{font-size:1.75rem;color:#f1f5f9;margin-bottom:.35rem}
    .page-hdr p{color:#94a3b8;font-size:.9rem}

    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr));gap:1.25rem}
    .card{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:1.4rem;display:flex;flex-direction:column;gap:.55rem}
    .card-cat{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#F7931A}
    .card h2{font-size:.95rem;line-height:1.4}
    .card h2 a{color:#f1f5f9}
    .card h2 a:hover{color:#F7931A;text-decoration:none}
    .card p{color:#94a3b8;font-size:.845rem;flex:1}
    .card-foot{display:flex;justify-content:space-between;align-items:center;font-size:.78rem;color:#64748b;margin-top:.35rem}
    .card-foot a{font-size:.8rem}

    .empty{text-align:center;color:#64748b;padding:4rem 0;font-size:.9rem}

    footer{background:#1e293b;border-top:1px solid #334155;padding:1.5rem 1rem;text-align:center;color:#64748b;font-size:.78rem}
    footer a{color:#64748b}
    footer a:hover{color:#F7931A}
    .flinks{display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;margin-bottom:.6rem}
  </style>
</head>
<body>

<header>
  <div class="hdr">
    <a href="${FRONTEND_URL}" class="logo">🗺️ <span>CriptoMapa</span><span class="badge">VE</span></a>
    <span style="margin-left:auto">
      <a href="${FRONTEND_URL}" style="font-size:.8rem;color:#94a3b8">← Volver al mapa</a>
    </span>
  </div>
</header>

<main>
  <div class="page-hdr">
    <h1>Blog</h1>
    <p>Guías y artículos sobre Bitcoin, criptomonedas y finanzas en Venezuela.</p>
  </div>
  ${posts.length === 0
    ? '<div class="empty"><p>Próximamente…</p></div>'
    : `<div class="grid">${cards}</div>`}
</main>

<footer>
  <div class="flinks">
    <a href="${FRONTEND_URL}">Mapa</a>
    <a href="${FRONTEND_URL}/blog/">Blog</a>
    <a href="${FRONTEND_URL}/faq.html">FAQ</a>
    <a href="${FRONTEND_URL}/quienes-somos.html">Quiénes somos</a>
  </div>
  © ${new Date().getFullYear()} CriptoMapa Venezuela
</footer>

</body>
</html>`;
}

// ── sitemap ──────────────────────────────────────────────────────────────────

function updateSitemap(posts) {
  const xml   = fs.readFileSync(SITEMAP_FILE, 'utf8');
  const lines = xml.split('\n').filter(l => !l.includes(`${FRONTEND_URL}/blog`));

  const blogLines = [
    `<url><loc>${FRONTEND_URL}/blog/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...posts.map(p =>
      `<url><loc>${FRONTEND_URL}/blog/${p.slug}.html</loc><lastmod>${p.date}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
    )
  ];

  const closingIdx = lines.findIndex(l => l.includes('</urlset>'));
  lines.splice(closingIdx, 0, ...blogLines);
  fs.writeFileSync(SITEMAP_FILE, lines.join('\n'));
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY no configurado');
    process.exit(1);
  }

  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

  const state  = loadState();
  const topics = pickTopics(state, COUNT);

  console.log(`Generando ${topics.length} artículo(s)...\n`);

  const today = new Date().toISOString().split('T')[0];

  for (const topic of topics) {
    console.log(`→ [${topic.id}] "${topic.title}"`);
    try {
      const article = await generateArticle(topic);

      // Ensure slug uniqueness
      let slug = (article.slug || '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80) || topic.id;
      if (state.posts.find(p => p.slug === slug)) {
        slug += '-' + crypto.randomBytes(2).toString('hex');
      }
      article.slug = slug;

      fs.writeFileSync(path.join(BLOG_DIR, `${slug}.html`), articleHtml(article, topic, today));

      state.usedTopics.push(topic.id);
      state.posts.push({
        slug,
        title:           article.title,
        metaDescription: article.metaDescription,
        category:        topic.category,
        date:            today,
        topicId:         topic.id
      });

      console.log(`  ✓ docs/blog/${slug}.html`);
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), buildBlogIndex(state.posts));
  console.log('\n✓ docs/blog/index.html');

  updateSitemap(state.posts);
  console.log('✓ docs/sitemap.xml');

  saveState(state);
  console.log('✓ scripts/blog-state.json');

  console.log(`\n✅ Listo — ${topics.length} artículo(s) generados.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
