import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DESIGN_PACKAGE, designAsset } from '../server/design-assets.js';
import { PODBASE_PRINT_TEMPLATES } from '../server/print-templates.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function buildCloudflareShop({ providerFixture = false, production = false, sandbox = false } = {}) {
if (Number(providerFixture) + Number(production) + Number(sandbox) > 1) throw new Error('Build environments must remain separate.');
const out = resolve(root, providerFixture ? 'test-results/cloudflare-providers/build' : sandbox ? 'test-results/cloudflare-acceptance/build' : production ? 'dist-cloudflare-production' : 'dist-cloudflare-shop');
await mkdir(resolve(out, 'worker'), { recursive: true });
await cp(resolve(root, 'dist'), resolve(out, 'public'), { recursive: true });
const font = await readFile(resolve(root, 'public/fonts/Caveat.ttf'));
const fontHash = createHash('sha256').update(font).digest('hex');
const assets = DESIGN_PACKAGE.designs.map(record => {
  const { dataUrl, maskDataUrl, renderDataUrl, ...asset } = designAsset(record.id.replace(/^\d+-/, '').toLowerCase());
  return asset;
});
const generated = new Map([
  [resolve(root, 'server/design-assets.js'), `import {createHash} from 'node:crypto';
    export const DESIGN_PACKAGE=${JSON.stringify(DESIGN_PACKAGE)}; const assets=${JSON.stringify(assets)};
    export function designAsset(id){const a=assets.find(a=>a.id===id);if(!a)throw new Error('Unbekanntes Motiv.');return a;}
    export async function prepareDesign(id,binding){
      const asset=designAsset(id); if(asset.renderDataUrl)return;
      const response=await binding.fetch(new Request('https://assets.invalid/_motifs/'+asset.id+'.png'));
      if(!response.ok)throw new Error('Originalmotiv nicht geladen.');
      const bytes=Buffer.from(await response.arrayBuffer());
      if(createHash('sha256').update(bytes).digest('hex')!==asset.renderHash)throw new Error('Originalmotiv-Pruefsumme stimmt nicht.');
      for(const previous of assets)delete previous.renderDataUrl;
      asset.renderDataUrl='data:image/png;base64,'+bytes.toString('base64');
    }`],
  [resolve(root, 'server/layout-font.js'), `import opentype from 'opentype.js';const bytes=Buffer.from(${JSON.stringify(font.toString('base64'))},'base64');export const font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));export const FONT_VERSION=${JSON.stringify('Caveat-' + fontHash)};`],
  [resolve(root, 'server/print-templates.js'), `export const PODBASE_PRINT_TEMPLATES=${JSON.stringify(PODBASE_PRINT_TEMPLATES)};`],
  [resolve(root, 'server/store.js'), `export {token,digest,passwordHash,passwordMatches} from './server/credentials.js';export function openStore(){throw new Error('Cloudflare migration requires isolated PostgreSQL.');}`]
]);
for (const [name, json] of [['case-variants', 'podbase-magsafe-map'], ['podbase-catalog', 'podbase-model-map']]) {
  const path = resolve(root, `server/${name}.js`), source = await readFile(path, 'utf8');
  const literal = JSON.stringify(JSON.parse(await readFile(resolve(root, `server/${json}.json`), 'utf8')));
  const expression = `JSON.parse(readFileSync(new URL('./${json}.json', import.meta.url), 'utf8'))`;
  if (!source.includes(expression)) throw new Error(`Unexpected resource loading in ${name}`);
  generated.set(path, source.replace("import { readFileSync } from 'node:fs';", '').replace(expression, literal));
}
const result = await build({
  entryPoints: [resolve(root, providerFixture ? 'tests/fixtures/cloudflare-providers-worker.js' : sandbox ? 'cloudflare/sandbox-worker.js' : production ? 'cloudflare/production-worker.js' : 'cloudflare/shop-worker.js')], outfile: resolve(out, 'worker/worker.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true,
  external: ['node:*', 'cloudflare:*'],
  plugins: [{ name: 'cloudflare-shop-resources', setup(b) {
    b.onResolve({ filter: /(?:design-assets|layout-font|print-templates|rasterizer|store|case-variants|podbase-catalog)\.js$/ }, args => {
      const path = resolve(args.resolveDir, args.path);
      if (generated.has(path)) return { path, namespace: 'shop-resource' };
      if (path === resolve(root, 'server/rasterizer.js')) return { path: resolve(root, 'cloudflare/rasterizer.js') };
    });
    b.onLoad({ filter: /.*/, namespace: 'shop-resource' }, args => ({ contents: generated.get(args.path), loader: 'js', resolveDir: args.path.endsWith('store.js') ? root : dirname(args.path) }));
    b.onResolve({ filter: /\/resvg\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
  } }]
});
const inputs = Object.keys(result.metafile.inputs), worker = await readFile(resolve(out, 'worker/worker.js'), 'utf8');
if (worker.includes('node:sqlite') || inputs.some(path => /node_modules\/.*(?:sharp|@vercel\/functions)/.test(path.replaceAll('\\', '/')))) throw new Error('Native or Vercel runtime dependency remains.');
if (!providerFixture && inputs.some(path => path.replaceAll('\\', '/').includes('tests/fixtures/'))) throw new Error('Provider fixtures must never enter the deployable shop.');
await cp(resolve(dirname(fileURLToPath(import.meta.resolve('@resvg/resvg-wasm'))), 'index_bg.wasm'), resolve(out, 'worker/resvg.wasm'));
await mkdir(resolve(out, 'public/_motifs'), { recursive: true });
for (const asset of assets) await cp(resolve(root, `public/assets/design-foregrounds-v3/${asset.id}.png`), resolve(out, `public/_motifs/${asset.id}.png`));
await writeFile(resolve(out, 'public/robots.txt'), production ? 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /prints/\nDisallow: /konto\nDisallow: /admin\nDisallow: /bestellung/\n' : 'User-agent: *\nDisallow: /\n');
await writeFile(resolve(out, 'public/_headers'), `/*
${production ? '' : '  X-Robots-Tag: noindex, nofollow\n'}  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
`);
let fileCount = 0, largestBytes = 0;
async function checkAssets(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await checkAssets(path);
    else { const size = (await stat(path)).size; fileCount++; largestBytes = Math.max(size, largestBytes); if (size > 25 * 1024 * 1024) throw new Error(`Static asset too large: ${relative(root, path)}`); }
  }
}
await checkAssets(resolve(out, 'public'));
if (fileCount > 20000) throw new Error('Too many static files for Workers Free.');
await writeFile(resolve(out, 'build-info.json'), JSON.stringify({ mode: sandbox ? 'protected-stripe-sandbox' : production ? 'production-no-routes' : 'protected-shop-migration', fileCount, largestBytes, fontHash, inputs }, null, 2));
console.log(`Cloudflare ${sandbox ? 'protected Stripe sandbox' : production ? 'production (no routes)' : 'protected preview'} build: ${fileCount} static files; native SQLite/Sharp and Vercel runtime excluded. No provider credentials embedded.`);
return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildCloudflareShop({ production: process.argv.includes('--production'), sandbox: process.argv.includes('--sandbox') });
