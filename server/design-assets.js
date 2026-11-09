import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

export const DESIGN_PACKAGE = JSON.parse(readFileSync(new URL('./design-package.json', import.meta.url), 'utf8'));
export const ARTWORK_VERSION = 'archenlicht-designpaket-v2-farbe';
// Shop adjustment requested by Jonas: larger lettering, while retaining the
// supplied text areas and keeping the original package manifest untouched.
const typography = { reference: { minFont: 28, maxFont: 48 }, excerpt: { minFont: 27, maxFont: 36 }, dedication: { minFont: 25, maxFont: 30 } };
const assets = new Map();
const masks = JSON.parse(readFileSync(new URL('../public/assets/design-masks-v1/manifest.json', import.meta.url), 'utf8'));
const foregrounds = JSON.parse(readFileSync(new URL('../public/assets/design-foregrounds-v3/manifest.json', import.meta.url), 'utf8'));
for (const record of DESIGN_PACKAGE.designs) {
  const id = record.id.replace(/^\d+-/, '').toLowerCase(), filename = basename(record.image);
  const sourcePixels = record.sourcePixels;
  const bytes = readFileSync(new URL(`../public/assets/designpaket-v2-farbe/${filename}`, import.meta.url));
  if (!Number.isInteger(sourcePixels?.width) || !Number.isInteger(sourcePixels?.height) || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== sourcePixels.width || bytes.readUInt32BE(20) !== sourcePixels.height) throw new Error(`Die Blankovorlage ${filename} stimmt nicht mit dem Designpaket überein.`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const mask = masks[id], maskBytes = readFileSync(new URL(`../public/assets/design-masks-v1/${id}.png`, import.meta.url));
  if (mask.sourceHash !== hash || createHash('sha256').update(maskBytes).digest('hex') !== mask.maskHash) throw new Error(`Die Hintergrundmaske für ${id} passt nicht zur Originalvorlage.`);
  const foreground = foregrounds[id], foregroundBytes = readFileSync(new URL(`../public/assets/design-foregrounds-v3/${id}.png`, import.meta.url));
  if (foreground.sourceHash !== hash || createHash('sha256').update(foregroundBytes).digest('hex') !== foreground.renderHash || foregroundBytes.readUInt32BE(16) !== sourcePixels.width || foregroundBytes.readUInt32BE(20) !== sourcePixels.height) throw new Error(`Die freigestellte Druckebene für ${id} passt nicht zur Originalvorlage.`);
  for (const box of Object.values(record.boxes)) if (!(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= 1.000001 && box.y + box.height <= 1.000001 && box.minFont > 0 && box.maxFont >= box.minFont && box.maxLines >= 1)) throw new Error(`Ungültige Textfläche in ${filename}.`);
  const boxes = Object.fromEntries(Object.entries(record.boxes).map(([key, box]) => [key, { ...box, ...typography[key] }]));
  // The new hand motif's branches extend slightly into the suggested box.
  // Keep a real gap while preserving its new vertical placement from v2.
  if (id === 'im-schatten') Object.assign(boxes.reference, { x: 0.37, width: 0.26 });
  assets.set(id, { ...record, boxes, sourcePixels: { ...sourcePixels }, id, sourceId: record.id, filename, hash, version: `${ARTWORK_VERSION}-${hash.slice(0, 12)}`, renderHash: foreground.renderHash, renderDataUrl: `data:image/png;base64,${foregroundBytes.toString('base64')}`, maskHash: mask.maskHash, inkBounds: mask.bounds, maskDataUrl: `data:image/png;base64,${maskBytes.toString('base64')}`, blankImageUrl: `/assets/designpaket-v2-farbe/${filename}`, dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, productionApproved: false });
}
export function designAsset(id) {
  const asset = assets.get(id);
  if (!asset) throw new Error(`Die Blankovorlage für ${id} fehlt. Es wird kein Ersatzmotiv verwendet.`);
  return asset;
}
