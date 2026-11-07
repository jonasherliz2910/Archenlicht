import opentype from 'opentype.js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findDesign, findModel, findVerse } from './catalog.js';
import { designAsset, DESIGN_PACKAGE } from './design-assets.js';

export const LAYOUT_VERSION = 'archenlicht-package-layout-v4-farbe';
const fontPath = new URL('../public/fonts/Caveat.ttf', import.meta.url);
const font = opentype.loadSync(fileURLToPath(fontPath));
export const FONT_VERSION = `Caveat-${createHash('sha256').update(readFileSync(fontPath)).digest('hex')}`;
export class ShopError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = text => { throw new ShopError(text); };
const labels = { reference: 'Die Versstelle', excerpt: 'Der Versauszug', dedication: 'Die Widmung' };

export function normalizeConfiguration(input) {
  const design = findDesign(input.designId), model = findModel(input.modelId);
  if (!design || !model) fail('Bitte wähle ein vorhandenes Motiv und dein genaues Handymodell.');
  const kind = input.kind === 'custom' ? 'custom' : input.kind === 'fixed' ? 'fixed' : fail('Ungültige Produktart.');
  const dedication = kind === 'custom' ? String(input.dedication || '').trim().normalize('NFC') : '';
  if (dedication.length > 32 || /[<>\r\n\x00-\x1f]/.test(dedication)) fail('Kürze die Widmung auf höchstens 32 Zeichen ohne Zeilenumbruch.');
  const verse = kind === 'custom' ? findVerse(input.verseId) : null;
  if (kind === 'custom' && !verse) fail('Bitte wähle eine Versstelle aus dem geprüften Testbestand.');
  if ('printText' in input || 'quote' in input) fail('Der Drucktext wird unverändert aus der ausgewählten Quelle geladen. Bitte wähle eine kürzere Stelle.');
  const asset = designAsset(design.id);
  return { kind, designId: design.id, modelId: model.id, verseId: verse?.id || null, dedication, layoutVersion: LAYOUT_VERSION, templateVersion: model.templateVersion, artworkVersion: asset.version, artworkHash: asset.hash, fontVersion: FONT_VERSION, verseReference: verse?.reference || design.reference, verseExcerpt: verse?.quote || '', productionApproved: false };
}

const glyphBounds = (text, size) => font.getPath(text, 0, 0, size).getBoundingBox();
const textWidth = (text, size) => { const bounds = glyphBounds(text, size); return Math.max(font.getAdvanceWidth(text, size), bounds.x2 - bounds.x1); };
function wrap(text, size, width) {
  const lines = []; let line = '';
  for (const word of text.trim().split(/\s+/u)) {
    if (textWidth(word, size) > width) return null;
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) > width) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}
export function fitText(text, definition, box, scale, key = 'excerpt') {
  if ([...text].some(character => !font.charToGlyphIndex(character))) fail(`${labels[key]} enthält ein Zeichen, das die mitgelieferte Schrift nicht darstellen kann. Bitte wähle eine andere Stelle oder passe die Widmung an.`);
  for (let sourceSize = definition.maxFont; sourceSize >= definition.minFont - 0.001; sourceSize -= 0.5) {
    const size = sourceSize * scale, lines = wrap(text, size, box.width), lineHeight = size * 1.3;
    if (!lines?.length || lines.length > definition.maxLines || lines.length * lineHeight > box.height + 0.001) continue;
    const metrics = lines.map(line => glyphBounds(line, size));
    const top = Math.min(...metrics.map((bounds, index) => bounds.y1 + index * lineHeight));
    const bottom = Math.max(...metrics.map((bounds, index) => bounds.y2 + index * lineHeight));
    if (bottom - top > box.height + 0.001) continue;
    const baseline = box.y + (box.height - (bottom - top)) / 2 - top;
    const positions = metrics.map((bounds, index) => {
      const x = box.x + box.width / 2 - (bounds.x1 + bounds.x2) / 2, y = baseline + index * lineHeight;
      return { x, baseline: y, bounds: { x: x + bounds.x1, y: y + bounds.y1, width: bounds.x2 - bounds.x1, height: bounds.y2 - bounds.y1 } };
    });
    if (positions.some(p => p.bounds.x < box.x - 0.001 || p.bounds.x + p.bounds.width > box.x + box.width + 0.001 || p.bounds.y < box.y - 0.001 || p.bounds.y + p.bounds.height > box.y + box.height + 0.001)) continue;
    return { key, box, sourceSize, fontSize: size, lineHeight, lines, positions, rotation: 0 };
  }
  fail(`${labels[key]} passt nicht lesbar in die vorgesehene Fläche. ${key === 'dedication' ? 'Bitte kürze die Widmung.' : 'Bitte wähle eine kürzere Versstelle oder einen kürzeren freigegebenen Versauszug.'}`);
}
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
function textBox(definition, image, model) {
  const requested = { x: image.x + definition.x * image.width, y: image.y + definition.y * image.height, width: definition.width * image.width, height: definition.height * image.height };
  const { width, height, safe, camera } = model.template;
  const left = Math.max(requested.x, safe), top = Math.max(requested.y, safe), right = Math.min(requested.x + requested.width, width - safe), bottom = Math.min(requested.y + requested.height, height - safe);
  const box = { x: left, y: top, width: right - left, height: bottom - top };
  if (box.width <= 0 || box.height <= 0 || intersects(box, camera)) fail('Die Textfläche ist für dieses Modell nicht frei. Bitte wähle ein anderes Modell; eine geprüfte Druckvorlage wird benötigt.');
  return box;
}
export function renderLayout(configuration) {
  const c = normalizeConfiguration(configuration), model = findModel(c.modelId), asset = designAsset(c.designId);
  const { width, height } = model.template, source = asset.sourcePixels;
  const area = model.template.artArea || { x: 0, y: 0, width, height };
  const scale = Math.min(area.width / source.width, area.height / source.height);
  const image = { x: area.x + (area.width - source.width * scale) / 2, y: area.y + (area.height - source.height * scale) / 2, width: source.width * scale, height: source.height * scale, scale };
  const values = { reference: c.verseReference, excerpt: c.verseExcerpt, dedication: c.dedication };
  const typography = Object.entries(values).filter(([, value]) => value).map(([key, value]) => fitText(value, asset.boxes[key], textBox(asset.boxes[key], image, model), scale, key));
  const textPaths = typography.map(block => `<g data-field="${block.key}">${block.lines.map((line, index) => font.getPath(line, block.positions[index].x, block.positions[index].baseline, block.fontSize).toSVG(3)).join('')}</g>`).join('');
  // Continue only the blank paper outside the original image by reflecting its
  // empty edges. This retains its color/texture at the join without stretching
  // or cropping the illustration; text is drawn once, after these extensions.
  const bottom = image.y + image.height, right = image.x + image.width;
  const edges = [
    { id: 'top', x: 0, y: 0, width, height: image.y, transform: `translate(0 ${image.y * 2}) scale(1 -1)` },
    { id: 'bottom', x: 0, y: bottom, width, height: height - bottom, transform: `translate(0 ${bottom * 2}) scale(1 -1)` },
    { id: 'left', x: 0, y: 0, width: image.x, height, transform: `translate(${image.x * 2} 0) scale(-1 1)` },
    { id: 'right', x: right, y: 0, width: width - right, height, transform: `translate(${right * 2} 0) scale(-1 1)` }
  ].filter(edge => edge.width > 0.001 && edge.height > 0.001 && !model.template.artArea);
  // Large margins around a reserved display area use the matching base paper.
  // Reflecting these wider regions would duplicate parts of the illustration.
  const clips = edges.map(edge => `<clipPath id="paper-${edge.id}"><rect x="${edge.x}" y="${edge.y}" width="${edge.width}" height="${edge.height}"/></clipPath>`).join('');
  const paper = `<g data-background="extended-paper">${edges.map(edge => `<g clip-path="url(#paper-${edge.id})"><use href="#blank-motif" transform="${edge.transform}"/></g>`).join('')}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><image id="blank-motif" data-artwork="${asset.hash}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" preserveAspectRatio="xMidYMid meet" href="${asset.dataUrl}"/>${clips}</defs><rect width="${width}" height="${height}" fill="${DESIGN_PACKAGE.targetBackground}"/>${paper}<use href="#blank-motif"/><g fill="${DESIGN_PACKAGE.ink}">${textPaths}</g></svg>`;
  const hash = createHash('sha256').update(JSON.stringify(c)).update(svg).digest('hex');
  const printText = [c.verseExcerpt, c.verseReference, c.dedication].filter(Boolean).join('\n');
  return { configuration: c, svg, hash, printText, reference: c.verseReference, width, height, camera: model.template.camera, imagePlacement: image, typography, simulatedTemplate: true, productionApproved: false, sourcePixels: source };
}
export async function rasterize(svg) {
  const input = Buffer.from(svg), { width, height } = await sharp(input).metadata();
  return sharp(input, { density: 300 }).resize(width, height).png().withMetadata({ density: 300 }).toBuffer();
}
