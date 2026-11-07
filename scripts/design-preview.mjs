import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DESIGNS, MODELS } from '../server/catalog.js';
import { renderLayout, rasterize } from '../server/layout.js';

const dir = 'docs/previews/designpaket-v2-farbe'; mkdirSync(dir, { recursive: true });
const tiles = [], report = [];
for (let i = 0; i < DESIGNS.length; i++) for (let row = 0; row < 2; row++) {
  const design = DESIGNS[i], kind = row ? 'custom' : 'fixed';
  const layout = renderLayout({ kind, designId: design.id, modelId: 'google-pixel-11-pro-xl', verseId: '1kor13-13', dedication: 'Für Anna · 2026' });
  const buffer = await rasterize(layout.svg);
  writeFileSync(`${dir}/${design.id}-${kind}.png`, buffer);
  tiles.push({ input: await sharp(buffer).resize(240, 480).png().toBuffer(), left: 12 + i * 252, top: 12 + row * 492 });
  report.push({ designId: design.id, kind, hash: layout.hash, configuration: layout.configuration, sourcePixels: layout.sourcePixels, canvas: { width: layout.width, height: layout.height }, imagePlacement: layout.imagePlacement, typography: layout.typography, productionApproved: layout.productionApproved });
}
await sharp({ create: { width: 1524, height: 996, channels: 3, background: '#e8ece0' } }).composite(tiles).png().toFile(`${dir}/vergleich.png`);
const fixedTiles = await Promise.all(DESIGNS.map(async (design, i) => ({ input: await sharp(`${dir}/${design.id}-fixed.png`).resize(220, 440).png().toBuffer(), top: 20, left: 20 + i * 240 })));
await sharp({ create: { width: 1460, height: 480, channels: 3, background: '#faf8f3' } }).composite(fixedTiles).png().toFile('docs/previews/motiv-entwuerfe.png');
writeFileSync(`${dir}/layout-pruefung.json`, JSON.stringify(report, null, 2) + '\n');
const geometryTiles = [], geometryReport = [], model = MODELS[0], previous = model.template;
try {
  for (const [shapeIndex, width] of [1000, 1400].entries()) {
    model.template = { ...previous, width, camera: { ...previous.camera, x: previous.camera.x * width / previous.width, width: previous.camera.width * width / previous.width } };
    const shape = shapeIndex ? 'breit' : 'schmal';
    for (let i = 0; i < DESIGNS.length; i++) for (const [kindIndex, kind] of ['fixed', 'custom'].entries()) {
      const layout = renderLayout({ kind, designId: DESIGNS[i].id, modelId: model.id, verseId: '1kor13-13', dedication: 'Für Anna · 2026' });
      const buffer = await rasterize(layout.svg);
      writeFileSync(`${dir}/${DESIGNS[i].id}-${shape}-${kind}.png`, buffer);
      const tileWidth = width / previous.height * 480;
      geometryTiles.push({ input: await sharp(buffer).resize(tileWidth, 480).png().toBuffer(), left: 12 + i * 292 + (280 - tileWidth) / 2, top: 12 + (shapeIndex * 2 + kindIndex) * 492 });
      geometryReport.push({ geometryFixture: shape, realPodbaseTemplate: false, designId: DESIGNS[i].id, kind, canvas: { width: layout.width, height: layout.height }, sourcePixels: layout.sourcePixels, imagePlacement: layout.imagePlacement, typography: layout.typography, hash: layout.hash, productionApproved: false });
    }
  }
} finally { model.template = previous; }
await sharp({ create: { width: 1764, height: 1992, channels: 3, background: '#e8ece0' } }).composite(geometryTiles).png().toFile(`${dir}/schmal-breit.png`);
writeFileSync(`${dir}/geometrie-pruefung.json`, JSON.stringify(geometryReport, null, 2) + '\n');
console.log('Designpaket v2: 12 Shopentwürfe und 24 schmale/breite Geometrieproben erstellt. Im Geometriebild: schmal fest/personalisiert, breit fest/personalisiert. Synthetische Testflächen, keine Produktionsfreigabe.');
