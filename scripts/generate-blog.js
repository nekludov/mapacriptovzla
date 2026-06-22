#!/usr/bin/env node
// Genera artículos de blog SEO-optimizados usando Claude API.
// El HTML se construye con scripts/blog-template.js (ver DESIGN.md).
// El contenido completo se guarda en blog-state.json para poder re-skinear
// sin volver a llamar la API (ver rebuild-blog.js).
// Uso: COUNT=2 node scripts/generate-blog.js
const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');

const TOPICS       = require('./blog-topics');
const { articleHtml, buildBlogIndex, FRONTEND_URL } = require('./blog-template');
const STATE_FILE   = path.join(__dirname, 'blog-state.json');
const BLOG_DIR     = path.join(__dirname, '../docs/blog');
const SITEMAP_FILE = path.join(__dirname, '../docs/sitemap.xml');
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
- Menciona CriptoMapa Venezuela (${FRONTEND_URL}) de forma natural como el directorio para encontrar negocios que aceptan cripto en Venezuela — solo si el contexto lo permite, sin escribir la URL en el texto (el sitio ya tiene un botón de enlace)
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

      let slug = (article.slug || '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80) || topic.id;
      if (state.posts.find(p => p.slug === slug)) {
        slug += '-' + crypto.randomBytes(2).toString('hex');
      }
      article.slug = slug;

      fs.writeFileSync(path.join(BLOG_DIR, `${slug}.html`), articleHtml(article, topic, today));

      state.usedTopics.push(topic.id);
      // Guardamos el contenido completo para poder re-renderizar sin la API.
      state.posts.push({
        slug,
        title:           article.title,
        metaDescription: article.metaDescription,
        category:        topic.category,
        topicId:         topic.id,
        date:            today,
        intro:           article.intro,
        sections:        article.sections,
        conclusion:      article.conclusion,
        keywords:        article.keywords
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
