/* Static assembler: layout.html + src/pages/*.html -> dist/
   Each page fragment opens with a JSON front-matter comment. */
import { readFile, writeFile, readdir, mkdir, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const SRC  = join(root, 'src');
const OUT  = join(root, 'dist');

const layout = await readFile(join(SRC, 'layout.html'), 'utf8');
const files  = (await readdir(join(SRC, 'pages'))).filter((f) => f.endsWith('.html')).sort();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(join(root, 'assets'), join(OUT, 'assets'), { recursive: true });

const built = [];

for (const file of files) {
  const raw = await readFile(join(SRC, 'pages', file), 'utf8');
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->\s*/);
  if (!m) { throw new Error(`${file}: missing front-matter comment`); }

  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length);
  const slug = file.replace(/\.html$/, '');

  let html = layout
    .replaceAll('{{TITLE}}', meta.title)
    .replaceAll('{{DESC}}', meta.desc)
    .replaceAll('{{SLUG}}', slug)
    .replaceAll('{{CANON}}', slug === 'index' ? '' : file)
    .replace('{{BODY}}', body);

  // Mark the active nav item.
  html = html.replace(
    new RegExp(`(<a class="nav__link" data-nav="${slug}")`),
    '<a class="nav__link is-current" aria-current="page" data-nav="' + slug + '"'
  );

  await writeFile(join(OUT, file), html, 'utf8');
  built.push({ file, bytes: html.length, title: meta.title });
}

// The phone-preview harness is authored outside dist/ so that a rebuild can
// never ship it by accident; copy it in so deploys still carry it.
const preview = join(root, 'preview.html');
try {
  await cp(preview, join(OUT, 'preview.html'));
  console.log('  preview.html    (review harness)');
} catch { /* optional */ }

// sitemap + robots — free SEO for a business that has never had a site.
const today = new Date().toISOString().slice(0, 10);
const urls = built.map(({ file }) => {
  const loc = file === 'index.html' ? '' : file;
  const pri = file === 'index.html' ? '1.0' : '0.8';
  return `  <url><loc>https://bouzoukidetroit.com/${loc}</loc><lastmod>${today}</lastmod><priority>${pri}</priority></url>`;
}).join('\n');

await writeFile(join(OUT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`, 'utf8');

await writeFile(join(OUT, 'robots.txt'),
`User-agent: *
Allow: /
Sitemap: https://bouzoukidetroit.com/sitemap.xml
`, 'utf8');

console.log(`built ${built.length} pages -> dist/`);
for (const b of built) { console.log(`  ${b.file.padEnd(14)} ${String(b.bytes).padStart(7)} B  ${b.title}`); }
