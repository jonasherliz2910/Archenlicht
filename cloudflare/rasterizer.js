import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasm from './resvg.wasm';
import { printPngMetadata } from './png-metadata.js';
// Keep large device masks out of the small shared Workers memory budget.
export const MASK_CACHE_SIZE = 1;

let initialization;
async function image(svg, read) {
  initialization ??= initWasm(wasm);
  await initialization;
  const renderer = new Resvg(svg, { font: { loadSystemFonts: false }, dpi: 300 });
  let rendered;
  try { rendered = renderer.render(); return read(rendered); }
  finally { rendered?.free(); renderer.free(); }
}

export const rasterize = svg => image(svg, rendered => printPngMetadata(rendered.asPng()));
export const rasterPixels = svg => image(svg, rendered => Buffer.from(rendered.pixels));
export const rasterMask = svg => image(svg, rendered => {
  const pixels = rendered.pixels, result = new Uint8Array(pixels.length / 4);
  // The allowed-area mask contains only black and white geometry on opaque black.
  for (let p = 0; p < result.length; p++) result[p] = pixels[p * 4];
  return result;
});
