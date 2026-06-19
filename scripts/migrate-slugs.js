/**
 * migrate-slugs.js — one-time backfill of slug column for existing negocios.
 *
 * Prerequisites (run once in Supabase SQL editor):
 *   ALTER TABLE negocios ADD COLUMN IF NOT EXISTS slug text;
 *   CREATE UNIQUE INDEX IF NOT EXISTS negocios_slug_idx
 *     ON negocios (slug) WHERE slug IS NOT NULL;
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/migrate-slugs.js
 */

const { createClient } = require('../backend/node_modules/@supabase/supabase-js');
const crypto = require('crypto');
const { slugify } = require('./utils');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function main() {
  const { data, error } = await supabase
    .from('negocios')
    .select('id, nombre')
    .is('slug', null);

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  console.log(`Found ${data.length} negocios without slug.`);

  let ok = 0, fail = 0;
  for (const n of data) {
    const base   = slugify(n.nombre);
    const suffix = crypto.randomBytes(3).toString('hex');
    const slug   = base ? `${base}-${suffix}` : `negocio-${suffix}`;

    const { error: upErr } = await supabase
      .from('negocios').update({ slug }).eq('id', n.id);

    if (upErr) {
      console.warn(`  FAIL ${n.id} (${n.nombre}): ${upErr.message}`);
      fail++;
    } else {
      console.log(`  OK   ${slug}`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed.`);
}

main().catch(e => { console.error(e); process.exit(1); });
