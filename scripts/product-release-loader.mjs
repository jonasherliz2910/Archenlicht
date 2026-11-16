// Offline Node audit using the same rasterizer and WASM as the Cloudflare shop.
// This loader is never included in the deployed application.
import { createRequire } from 'node:module';
import { dirname, resolve as resolvePath } from 'node:path';

const nativeRasterizer = new URL('../server/rasterizer.js', import.meta.url).href;
const cloudRasterizer = new URL('../cloudflare/rasterizer.js', import.meta.url).href;
const require = createRequire(import.meta.url);
const wasmPath = resolvePath(dirname(require.resolve('@resvg/resvg-wasm')), 'index_bg.wasm');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === './resvg.wasm' && context.parentURL === cloudRasterizer) {
    return { url: 'archenlicht-audit:wasm', shortCircuit: true };
  }
  const result = await nextResolve(specifier, context);
  return result.url === nativeRasterizer ? { ...result, url: cloudRasterizer } : result;
}

export async function load(url, context, nextLoad) {
  if (url === 'archenlicht-audit:wasm') return {
    format: 'module', shortCircuit: true,
    source: `import { readFileSync } from 'node:fs'; export default readFileSync(${JSON.stringify(wasmPath)});`
  };
  return nextLoad(url, context);
}
