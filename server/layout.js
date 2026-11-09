import opentype from 'opentype.js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findDesign, findModel, findVerse } from './catalog.js';
import { designAsset } from './design-assets.js';
import { caseColor } from '../public/case-colors.js';
import { printExclusions } from '../public/device-preview.js';
import { MAX_CUSTOM_TEXT } from '../public/custom-text.js';

export const LAYOUT_VERSION = 'archenlicht-package-layout-v7-soft-edges';
const fontPath = new URL('../public/fonts/Caveat.ttf', import.meta.url);
const font = opentype.loadSync(fileURLToPath(fontPath));
export const FONT_VERSION = `Caveat-${createHash('sha256').update(readFileSync(fontPath)).digest('hex')}`;
export class ShopError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = text => { throw new ShopError(text); };
const labels = { reference: 'Die Versstelle', excerpt: 'Der Versauszug', dedication: 'Die Widmung', customText: 'Dein Text' };

export function normalizeConfiguration(input, { allowEmptyCustomText = false } = {}) {
  const design = findDesign(input.designId), model = findModel(input.modelId);
  if (!design || !model) fail('Bitte wähle ein vorhandenes Motiv und dein genaues Handymodell.');
  const kind = input.kind === 'custom' ? 'custom' : input.kind === 'fixed' ? 'fixed' : fail('Ungültige Produktart.');
  const dedication = kind === 'custom' ? String(input.dedication || '').trim().normalize('NFC') : '';
  if (dedication.length > 32 || /[<>\r\n\x00-\x1f]/.test(dedication)) fail('Kürze die Widmung auf höchstens 32 Zeichen ohne Zeilenumbruch.');
  const freeText = kind === 'custom' && Object.hasOwn(input, 'customText');
  let customText;
  if (freeText) {
    if (typeof input.customText !== 'string') fail('Bitte gib deinen Wunschtext als Text ein.');
    customText = input.customText.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim();
    if (!customText && !allowEmptyCustomText) fail('Bitte gib deinen eigenen Spruch, Vers oder eine Bibelstelle ein.');
    if (customText.length > MAX_CUSTOM_TEXT) fail(`Dein Text darf höchstens ${MAX_CUSTOM_TEXT} Zeichen enthalten. Bitte kürze ihn.`);
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/.test(customText)) fail('Dein Text enthält unsichtbare Steuerzeichen. Bitte entferne sie.');
  }
  const verse = kind === 'custom' && !freeText ? findVerse(input.verseId) : null;
  if (kind === 'custom' && !freeText && !verse) fail('Bitte gib deinen eigenen Spruch, Vers oder eine Bibelstelle ein.');
  if ('printText' in input || 'quote' in input) fail('Der Drucktext wird unverändert aus der ausgewählten Quelle geladen. Bitte wähle eine kürzere Stelle.');
  const asset = designAsset(design.id);
  const background = caseColor(input.backgroundId);
  if (!background) fail('Bitte wähle eine der angebotenen Hintergrundfarben.');
  return { kind, designId: design.id, modelId: model.id, backgroundId: background.id, verseId: verse?.id || null, dedication, layoutVersion: freeText ? 'archenlicht-free-text-v1' : LAYOUT_VERSION, templateVersion: model.templateVersion, artworkVersion: asset.version, artworkHash: asset.hash, renderHash: asset.renderHash, maskHash: asset.maskHash, fontVersion: FONT_VERSION, verseReference: freeText ? '' : verse?.reference || design.reference, verseExcerpt: freeText ? '' : verse?.quote || '', ...(freeText ? { customText } : {}), productionApproved: false };
}

const glyphBounds = (text, size) => font.getPath(text, 0, 0, size).getBoundingBox();
const textWidth = (text, size) => { const bounds = glyphBounds(text, size); return Math.max(font.getAdvanceWidth(text, size), bounds.x2 - bounds.x1); };
function wrap(text, size, width, preserveLines = false) {
  if (preserveLines) {
    const paragraphs = text.split('\n').map(line => line.trim() ? wrap(line, size, width) : ['']);
    return paragraphs.some(lines => !lines) ? null : paragraphs.flat();
  }
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
  if ([...text].some(character => !(key === 'customText' && character === '\n') && !font.charToGlyphIndex(character))) fail(`${labels[key]} enthält ein Zeichen, das die Schrift nicht darstellen kann. Bitte entferne Sonderzeichen wie Emojis oder verwende andere Zeichen.`);
  for (let sourceSize = definition.maxFont; sourceSize >= definition.minFont - 0.001; sourceSize -= 0.5) {
    const size = sourceSize * scale, lines = wrap(text, size, box.width, key === 'customText'), lineHeight = size * 1.3;
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
  fail(`${labels[key]} passt nicht lesbar in die vorgesehene Fläche. ${key === 'dedication' ? 'Bitte kürze die Widmung.' : key === 'customText' ? 'Bitte kürze deinen Text oder verwende weniger Zeilenumbrüche.' : 'Bitte wähle eine kürzere Versstelle oder einen kürzeren freigegebenen Versauszug.'}`);
}
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
function textBox(definition, image, model) {
  const requested = { x: image.x + definition.x * image.width, y: image.y + definition.y * image.height, width: definition.width * image.width, height: definition.height * image.height };
  const { width, height, safe } = model.template;
  const left = Math.max(requested.x, safe), top = Math.max(requested.y, safe), right = Math.min(requested.x + requested.width, width - safe), bottom = Math.min(requested.y + requested.height, height - safe);
  const box = { x: left, y: top, width: right - left, height: bottom - top };
  if (box.width <= 0 || box.height <= 0 || printExclusions(model).some(camera => intersects(box, camera))) fail('Die Textfläche ist für dieses Modell nicht frei. Bitte wähle ein anderes Modell; eine geprüfte Druckvorlage wird benötigt.');
  return box;
}

function artworkPlacement(asset, model, values) {
  const { width, height, safe, bleed, artArea } = model.template, source = asset.sourcePixels;
  // The boat's long, thin wave uses more width than its visual weight suggests.
  // Allow that illustration 10% more size, while keeping its ends 20 units
  // inside the bleed boundary. Text retains the original safe inset below.
  const largerBoat = asset.id === 'nach-dem-sturm';
  const illustrationInset = largerBoat ? Math.min(safe, bleed + 20) : safe;
  const boxes = [asset.inkBounds, ...Object.entries(values).filter(([, value]) => value).map(([key]) => {
    const b = asset.boxes[key];
    return { x:b.x*source.width, y:b.y*source.height, width:b.width*source.width, height:b.height*source.height };
  })];
  const group = { x:Math.min(...boxes.map(b=>b.x)), y:Math.min(...boxes.map(b=>b.y)) };
  group.width = Math.max(...boxes.map(b=>b.x+b.width))-group.x;
  group.height = Math.max(...boxes.map(b=>b.y+b.height))-group.y;
  const maximumScale = Math.min(width/source.width, height/source.height) * (largerBoat ? 1.1 : 1);
  const imageAt = (scale,x,y) => ({x,y,width:source.width*scale,height:source.height*scale,scale});
  const boundsAt = image => ({x:image.x+group.x*image.scale,y:image.y+group.y*image.scale,width:group.width*image.scale,height:group.height*image.scale});
  let image = imageAt(maximumScale,(width-source.width*maximumScale)/2,(height-source.height*maximumScale)/2);
  const bounds = boundsAt(image), clearance = 45;
  const cameras = printExclusions(model).map(b=>({x:b.x-clearance,y:b.y-clearance,width:b.width+clearance*2,height:b.height+clearance*2}));
  const collides = cameras.some(b=>intersects(bounds,b));
  const outside = bounds.x < illustrationInset || bounds.y < safe || bounds.x+bounds.width > width-illustrationInset || bounds.y+bounds.height > height-safe;
  if (artArea || collides || outside) {
    const top = Math.max(safe, ...cameras.map(b=>b.y+b.height));
    const area = artArea
      ? { ...artArea, ...(largerBoat ? {x:illustrationInset,width:width-2*illustrationInset} : {}) }
      : {x:illustrationInset,y:top,width:width-2*illustrationInset,height:height-safe-top};
    // Fit visible artwork AND all active text boxes as one proportional group.
    // Empty source paper may extend beyond the canvas; no printed mark does.
    const scale = Math.min(maximumScale,area.width/group.width,area.height/group.height);
    image = imageAt(scale, area.x+(area.width-group.width*scale)/2-group.x*scale, area.y+(area.height-group.height*scale)/2-group.y*scale);
  }
  const contentBounds = boundsAt(image);
  if (cameras.some(b=>intersects(contentBounds,b)) || contentBounds.x < illustrationInset-.001 || contentBounds.x+contentBounds.width > width-illustrationInset+.001 || contentBounds.y < safe-.001 || contentBounds.y+contentBounds.height > height-safe+.001) fail('Das Motiv passt nicht vollständig in die freie Fläche dieses Modells.');
  return { image, contentBounds, maximumScale, illustrationInset };
}
export function renderLayout(configuration, options) {
  const c = normalizeConfiguration(configuration, options), model = findModel(c.modelId);
  let asset = designAsset(c.designId);
  const { width, height } = model.template, source = asset.sourcePixels;
  const freeText = Object.hasOwn(c, 'customText');
  if (freeText) {
    let box = asset.boxes.reference;
    if (c.customText) {
      try { fitText(c.customText, box, { x: 0, y: 0, width: box.width * source.width, height: box.height * source.height }, 1, 'customText'); }
      catch (error) { if (!error.message.includes('passt nicht lesbar')) throw error; box = { ...asset.boxes.excerpt, maxFont: asset.boxes.reference.maxFont }; }
    }
    asset = { ...asset, boxes: { ...asset.boxes, customText: box } };
  }
  const values = freeText ? { customText: c.customText, dedication: c.dedication } : { reference: c.verseReference, excerpt: c.verseExcerpt, dedication: c.dedication };
  const { image, contentBounds, maximumScale, illustrationInset } = artworkPlacement(asset, model, values), { scale } = image;
  const background = caseColor(c.backgroundId);
  const typography = Object.entries(values).filter(([, value]) => value).map(([key, value]) => fitText(value, asset.boxes[key], textBox(asset.boxes[key], image, model), scale, key));
  const textPaths = typography.map(block => `<g data-field="${block.key}">${block.lines.map((line, index) => font.getPath(line, block.positions[index].x, block.positions[index].baseline, block.fontSize).toSVG(3)).join('')}</g>`).join('');
  const placement = 'x="'+image.x+'" y="'+image.y+'" width="'+image.width+'" height="'+image.height+'" preserveAspectRatio="xMidYMid meet"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect data-background="${background.id}" width="${width}" height="${height}" fill="${background.hex}"/><image data-artwork="${asset.hash}" data-render="${asset.renderHash}" ${placement} href="${asset.renderDataUrl}"/><g fill="${background.ink}">${textPaths}</g></svg>`;
  const hash = createHash('sha256').update(JSON.stringify(c)).update(svg).digest('hex');
  const printText = (freeText ? [c.customText, c.dedication] : [c.verseExcerpt, c.verseReference, c.dedication]).filter(Boolean).join('\n');
  return { configuration: c, svg, hash, printText, reference: c.verseReference, width, height, camera: model.template.camera, imagePlacement: image, contentBounds, maximumScale, illustrationInset, typography, simulatedTemplate: true, productionApproved: false, sourcePixels: source };
}
export async function rasterize(svg) {
  const input = Buffer.from(svg), { width, height } = await sharp(input).metadata();
  return sharp(input, { density: 300 }).resize(width, height).png().withMetadata({ density: 300 }).toBuffer();
}
