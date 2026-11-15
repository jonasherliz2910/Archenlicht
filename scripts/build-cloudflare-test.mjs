import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DESIGN_PACKAGE, designAsset } from '../server/design-assets.js';
import { PODBASE_PRINT_TEMPLATES } from '../server/print-templates.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = resolve(root, 'dist-cloudflare');
await mkdir(resolve(out, 'worker'), { recursive: true });
await mkdir(resolve(out, 'public'), { recursive: true });
const font = await readFile(resolve(root, 'public/fonts/Caveat.ttf'));
const fontHash = createHash('sha256').update(font).digest('hex');
// Importing the original assets above checks every source/mask/foreground hash.
// Ship unchanged foregrounds as static assets rather than inflating the Worker bundle.
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
  [resolve(root, 'server/layout-font.js'), `import opentype from 'opentype.js'; const bytes=Buffer.from(${JSON.stringify(font.toString('base64'))},'base64'); export const font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)); export const FONT_VERSION=${JSON.stringify('Caveat-' + fontHash)};`],
  [resolve(root, 'server/print-templates.js'), `export const PODBASE_PRINT_TEMPLATES=${JSON.stringify(PODBASE_PRINT_TEMPLATES)};`]
]);
const result = await build({
  entryPoints: [resolve(root, 'cloudflare/worker.js')], outfile: resolve(out, 'worker/worker.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true,
  external: ['node:*', 'cloudflare:*'],
  plugins: [{ name: 'cloudflare-print-resources', setup(b) {
    b.onResolve({ filter: /(?:design-assets|layout-font|print-templates|rasterizer)\.js$/ }, args => {
      const path = resolve(args.resolveDir, args.path);
      if (generated.has(path)) return { path, namespace: 'print-resource' };
      if (path === resolve(root, 'server/rasterizer.js')) return { path: resolve(root, 'cloudflare/rasterizer.js') };
    });
    b.onLoad({ filter: /.*/, namespace: 'print-resource' }, args => ({ contents: generated.get(args.path), loader: 'js', resolveDir: root }));
    b.onResolve({ filter: /\/resvg\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
  } }]
});
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some(path => /(?:^|\/)sharp(?:\/|@)|server\/(?:shop|store|payments|mail|newsletter)\.js/.test(path.replaceAll('\\', '/')))) throw new Error('Production service unexpectedly included in print-only trial.');
const wasm = resolve(dirname(fileURLToPath(import.meta.resolve('@resvg/resvg-wasm'))), 'index_bg.wasm');
await cp(wasm, resolve(out, 'worker/resvg.wasm'));
await cp(resolve(root, 'cloudflare/public'), resolve(out, 'public'), { recursive: true });
await mkdir(resolve(out, 'public/_motifs'), { recursive: true });
for (const asset of assets) await cp(resolve(root, `public/assets/design-foregrounds-v3/${asset.id}.png`), resolve(out, `public/_motifs/${asset.id}.png`));
await cp(resolve(root, 'public/assets/web-v1/archenlicht-logo.webp'), resolve(out, 'public/logo.webp'));
await writeFile(resolve(out, 'build-info.json'), JSON.stringify({ mode: 'print-only-trial', fontHash, renderer: '@resvg/resvg-wasm@2.6.2', motifs: assets.map(({ id, renderHash }) => ({ id, renderHash })), inputs }, null, 2));
console.log('Cloudflare-Drucktest gebaut: 6 Originalmotive, unveränderte Textpfade und Vorlagen. Keine Kundendaten, Zahlungen oder Anbieterzugänge enthalten.');
