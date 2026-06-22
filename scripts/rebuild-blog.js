#!/usr/bin/env node
// Re-renderiza TODO el blog (artículos + índice + sitemap) desde blog-state.json
// usando la plantilla actual (scripts/blog-template.js). NO llama a la API.
// Úsalo tras cualquier cambio de diseño para re-skinear todos los posts a la vez.
//
// Si un post del estado no tiene el contenido guardado (intro/sections/conclusion)
// — caso de los artículos generados con la versión vieja — lo extrae del HTML existente.
//
// Uso: node scripts/rebuild-blog.js
const fs   = require('fs');
const path = require('path');

const TOPICS       = require('./blog-topics');
const { articleHtml, buildBlogIndex, FRONTEND_URL } = require('./blog-template');
const STATE_FILE   = path.join(__dirname, 'blog-state.json');
const BLOG_DIR     = path.join(__dirname, '../docs/blog');
const SITEMAP_FILE = path.join(__dirname, '../docs/sitemap.xml');

const TOPIC_BY_ID = Object.fromEntries(TOPICS.map(t => [t.id, t]));

// ── extracción de HTML viejo (solo para posts sin contenido en el estado) ──────

function extractFromHtml(slug) {
  const file = path.join(BLOG_DIR, `${slug}.html`);
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');

  const introM = html.match(/<div class="intro">([\s\S]*?)<\/div>\s*<article/);
  const concM  = html.match(/<div class="conclusion">([\s\S]*?)<\/div>\s*<\/article>/);
  const bodyM  = html.match(/<article class="body">([\s\S]*?)<div class="conclusion">/);

  if (!introM || !concM || !bodyM) return null;

  const intro      = introM[1].trim();
  const conclusion = `<p>${concM[1].replace(/^<p>/, '').replace(/<\/p>$/, '').trim()}</p>`;

  // Las secciones son pares <h2>…</h2> seguidos de su contenido HTML.
  const sections = [];
  const re = /<h2>([\s\S]*?)<\/h2>\s*([\s\S]*?)(?=<h2>|$)/g;
  let m;
  while ((m = re.exec(bodyM[1])) !== null) {
    sections.push({ heading: m[1].trim(), content: m[2].trim() });
  }
  if (sections.length === 0) return null;

  const kwM = html.match(/<meta name="keywords" content="([^"]*)"/);
  const keywords = kwM ? kwM[1].split(',').map(s => s.trim()).filter(Boolean) : [];

  return { intro, sections, conclusion, keywords };
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

function main() {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  let mutatedState = false;

  console.log(`Re-renderizando ${state.posts.length} artículo(s)...\n`);

  for (const post of state.posts) {
    const topic = TOPIC_BY_ID[post.topicId] || { category: post.category, title: post.title };

    // Recuperar contenido si falta (posts generados con versión vieja).
    if (!post.sections || !post.intro || !post.conclusion) {
      const extracted = extractFromHtml(post.slug);
      if (!extracted) {
        console.error(`  ✗ ${post.slug}: sin contenido en estado y no se pudo extraer del HTML — omitido.`);
        continue;
      }
      Object.assign(post, extracted);
      if (!post.keywords?.length) post.keywords = extracted.keywords;
      mutatedState = true;
      console.log(`  ↻ ${post.slug}: contenido extraído del HTML y guardado en el estado.`);
    }

    const article = {
      slug:            post.slug,
      title:           post.title,
      metaDescription: post.metaDescription,
      intro:           post.intro,
      sections:        post.sections,
      conclusion:      post.conclusion,
      keywords:        post.keywords || []
    };

    fs.writeFileSync(path.join(BLOG_DIR, `${post.slug}.html`), articleHtml(article, topic, post.date));
    console.log(`  ✓ docs/blog/${post.slug}.html`);
  }

  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), buildBlogIndex(state.posts));
  console.log('\n✓ docs/blog/index.html');

  updateSitemap(state.posts);
  console.log('✓ docs/sitemap.xml');

  if (mutatedState) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('✓ scripts/blog-state.json (contenido recuperado)');
  }

  console.log('\n✅ Blog re-renderizado con el diseño actual.');
}

main();
