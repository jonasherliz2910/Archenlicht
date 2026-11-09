import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { deviceProfile, printFrame } from '../public/device-preview.js';
import { caseColor } from '../public/case-colors.js';
import { ShopError } from './layout.js';

export const PODBASE_PRINT_TEMPLATES = JSON.parse(readFileSync(new URL('./podbase-print-templates.json', import.meta.url), 'utf8'));
export const officialTemplate = (modelId, magsafe = false) => (magsafe ? PODBASE_PRINT_TEMPLATES.magsafeTemplates : PODBASE_PRINT_TEMPLATES.templates)?.find(t => t.modelId === modelId);
const masks = new Map();
const digest = text => createHash('sha256').update(text).digest('hex');
const svgDocument = (body, width, height) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

async function allowedPixels(template) {
  if (!masks.has(template.hash)) {
    const { width, height, clearance } = template;
    const guides = `<rect width="${width}" height="${height}" fill="black"/><path d="${template.safeArea.path}" fill="white" stroke="black" stroke-width="${clearance * 2}"/>${template.cameraExclusions.map(c => `<path d="${c.path}" fill="black" stroke="black" stroke-width="${clearance * 2}"/>`).join('')}`;
    if (masks.size >= 8) masks.delete(masks.keys().next().value);
    const promise = sharp(Buffer.from(svgDocument(guides, width, height))).removeAlpha().greyscale().raw().toBuffer();
    masks.set(template.hash, promise);
    promise.catch(() => masks.delete(template.hash));
  }
  return masks.get(template.hash);
}

export async function inspectProductionInk(marks, template) {
  // Include outside pixels so clipping at the canvas boundary cannot pass validation.
  const padding = 96, width = template.width + padding * 2, height = template.height + padding * 2;
  const [ink, allowed] = await Promise.all([
    sharp(Buffer.from(svgDocument(`<g transform="translate(${padding} ${padding})">${marks}</g>`, width, height))).ensureAlpha().raw().toBuffer(),
    allowedPixels(template)
  ]);
  let markedPixels = 0, unsafePixels = 0, outsideCanvasPixels = 0;
  for (let i = 3; i < ink.length; i += 4) {
    if (!ink[i]) continue;
    markedPixels++;
    const pixel = (i - 3) / 4, x = pixel % width - padding, y = Math.floor(pixel / width) - padding;
    if (x < 0 || y < 0 || x >= template.width || y >= template.height) outsideCanvasPixels++;
    else if (allowed[y * template.width + x] < 254) unsafePixels++;
  }
  return { markedPixels, unsafePixels, outsideCanvasPixels, clearance: template.clearance };
}

export async function productionPrint(layout, model) {
  const template = officialTemplate(model.id, layout.configuration.magsafe);
  if (!template) throw new ShopError('Für dieses Modell fehlt noch eine vollständige Druckvorlage. Bitte wähle ein anderes Modell.', 409);
  const safe = template.safeArea.bounds, device = deviceProfile(model), frame = printFrame(model, device);
  const bodyScale = Math.min(safe.width / device.width, safe.height / device.height);
  const original = { scale: frame.scale * bodyScale,
    x: safe.x + (safe.width - device.width * bodyScale) / 2 + frame.x * bodyScale,
    y: safe.y + (safe.height - device.height * bodyScale) / 2 + frame.y * bodyScale };
  const foreground = layout.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/^<rect data-background="[^"]*"[^>]*\/>/, '');
  if (foreground.includes('data-background=')) throw new Error('Background must be separated from printable marks');
  const marksAt = placement => `<g transform="translate(${placement.x} ${placement.y}) scale(${placement.scale})">${foreground}</g>`;
  let placement = original, marks = marksAt(placement), validation = await inspectProductionInk(marks, template);
  if (validation.unsafePixels || validation.outsideCanvasPixels) {
    const margin = template.clearance + 2;
    const area = { x: safe.x + margin, y: Math.max(safe.y + margin, ...template.cameraExclusions.map(c => c.bounds.y + c.bounds.height + margin)), width: safe.width - 2 * margin };
    area.height = safe.y + safe.height - margin - area.y;
    const bounds = layout.contentBounds;
    const maximum = Math.min(original.scale, area.width / bounds.width, area.height / bounds.height);
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = maximum * (1 - attempt * .04);
      if (scale <= 0 || scale < original.scale * .72) break;
      placement = { scale, x: area.x + (area.width - bounds.width * scale) / 2 - bounds.x * scale,
        y: area.y + (area.height - bounds.height * scale) / 2 - bounds.y * scale };
      marks = marksAt(placement); validation = await inspectProductionInk(marks, template);
      if (!validation.unsafePixels && !validation.outsideCanvasPixels) break;
    }
  }
  if (!validation.markedPixels || validation.unsafePixels || validation.outsideCanvasPixels) throw new ShopError('Diese Gestaltung passt nicht sicher in die Druckvorlage. Bitte wähle ein anderes Modell oder kürze deinen Text.', 409);
  const background = caseColor(layout.configuration.backgroundId);
  const svg = svgDocument(`<rect data-background="${background.id}" width="${template.width}" height="${template.height}" fill="${background.hex}"/>${marks}`, template.width, template.height);
  const print = { version: 'podbase-tough-print-v1', templateHash: template.hash, productId: template.productId, variantId: template.variantId,
    width: template.width, height: template.height, density: template.density, placement,
    previewWindow: { x: original.x, y: original.y, width: layout.width * original.scale, height: layout.height * original.scale, outputWidth: layout.width, outputHeight: layout.height },
    validation, physicalSampleApproved: false };
  const configuration = { ...layout.configuration, productionPrint: print };
  return { ...layout, configuration, svg, hash: digest(JSON.stringify(configuration) + svg), width: template.width, height: template.height, officialPrintTemplate: true };
}

export function previewFromProduction(svg, configuration) {
  const window = configuration.productionPrint?.previewWindow;
  if (!window) return svg;
  return svg.replace(/^<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${window.outputWidth}" height="${window.outputHeight}" viewBox="${window.x} ${window.y} ${window.width} ${window.height}">`);
}
