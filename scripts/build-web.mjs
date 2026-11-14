import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { DESIGNS, MODELS } from '../server/catalog.js';
import { renderLayout } from '../server/layout.js';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';

// The editable source and the full-resolution production assets stay intact.
// Only this generated directory is used as the CDN's public output.
const out = resolve('dist');
await mkdir(out, { recursive: true });
await cp(resolve('public'), out, { recursive: true });
const js = await build({ entryPoints: { app: 'public/app.js', cookies: 'public/cookie-consent.js' }, bundle: true, minify: true, format: 'esm', target: ['es2022'], outdir: resolve(out, '_app'), entryNames: '[name]-[hash]', metafile: true });
const script = name => '/' + Object.keys(js.metafile.outputs).find(file => basename(file).startsWith(name + '-')).replaceAll('\\', '/').split('dist/')[1];
const startup = (await readFile('public/startup.js', 'utf8')).replace("'./app.js'", JSON.stringify(script('app')));
const startFile = `/_app/startup-${createHash('sha256').update(startup).digest('hex').slice(0, 16)}.js`;
await writeFile(resolve(out, '.' + startFile), startup);
const cssFiles = ['style', 'bundle', 'prices', 'newsletter', 'cookie-consent', 'admin'];
const styles = await build({ stdin: { contents: cssFiles.map(name => `@import './${name}.css';`).join('\n'), resolveDir: resolve('public'), loader: 'css', sourcefile: 'shop.css' }, bundle: true, minify: true, external: ['/fonts/*'], write: false });
const css = styles.outputFiles[0].contents;
const styleFile = `/_app/shop-${createHash('sha256').update(css).digest('hex').slice(0, 16)}.css`;
await writeFile(resolve(out, '.' + styleFile), css);
let html = (await readFile('public/index.html', 'utf8'))
  .replace(/    <link rel="stylesheet"[^>]+>\r?\n/g, '')
  .replace('    <script type="module" src="/startup.js">', `    <link rel="stylesheet" href="${styleFile}" />\n    <script type="module" src="${startFile}">`)
  .replace('src="/cookie-consent.js"', `src="${script('cookies')}"`);
const defaultTitle = 'Archenlicht · Ein Vers für deinen Alltag';
await writeFile(resolve(out, 'index.html'), html.replace('<!--PAGE_TITLE-->', defaultTitle));
for (const path of ['kollektion', 'gestalten', 'bundle', ...DESIGNS.map(d => `kollektion/${d.id}`), ...FIXED_BUNDLES.map(b => `bundle/${b.id}`)]) {
  const design = DESIGNS.find(d => path === `kollektion/${d.id}`), bundle = FIXED_BUNDLES.find(b => path === `bundle/${b.id}`);
  const title = design ? `${design.title} · ${design.reference} | Archenlicht` : bundle ? `${bundle.title} · Dreier-Bundle | Archenlicht` : defaultTitle;
  const file = resolve(out, '_pages', path + '.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html.replace('<!--PAGE_TITLE-->', title));
}
for (const design of DESIGNS) {
  const { svg } = renderLayout({ kind: 'fixed', designId: design.id, modelId: MODELS[0].id });
  await writeFile(resolve(out, 'assets', `design-${design.id}.svg`), svg);
}
console.log(`Webausgabe erstellt: ${Object.keys(js.metafile.outputs).length} JavaScript-Bundles, ein Stylesheet, statische Shopseiten und sechs unveränderte Motivvorschauen.`);
