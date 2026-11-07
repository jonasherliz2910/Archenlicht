import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DESIGNS, MODELS, VERSES } from '../server/catalog.js';
import { designAsset, DESIGN_PACKAGE } from '../server/design-assets.js';
import { renderLayout, fitText, rasterize, FONT_VERSION, LAYOUT_VERSION } from '../server/layout.js';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import sharp from 'sharp';

const fixed = { kind: 'fixed', designId: 'unter-seinen-fluegeln', modelId: 'iphone-18-pro' };
const custom = { ...fixed, kind: 'custom', verseId: 'jes41-10', dedication: 'Für Änne · 2026' };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('Alle sechs Blankomotive und die Schrift entsprechen unverändert dem gelieferten Designpaket', () => {
  assert.equal(DESIGNS.length, 6);
  for (const design of DESIGNS) {
    const asset = designAsset(design.id), original = readFileSync(`Archenlicht-Designpaket-v2-Farbe/Archenlicht-Designpaket-v2-Farbe/assets/${asset.filename}`), integrated = readFileSync('public' + asset.blankImageUrl);
    assert.equal(digest(integrated), digest(original)); assert.equal(asset.hash, digest(original));
    assert.equal(asset.reference, design.reference); assert.equal(design.productionApproved, false);
    assert.deepEqual(asset.sourcePixels, { width: 962, height: ['unter-seinen-fluegeln', 'getragen'].includes(design.id) ? 1634 : 1635 });
    assert.ok(readFileSync(`public/assets/designpaket-v1/${asset.filename}`).length > 0, 'Vorheriges Paket bleibt erhalten');
  }
  const font = readFileSync('public/fonts/Caveat.ttf');
  assert.equal(digest(font), digest(readFileSync('Archenlicht-Designpaket-v2-Farbe/Archenlicht-Designpaket-v2-Farbe/fonts/Caveat.ttf')));
  assert.equal(FONT_VERSION, `Caveat-${digest(font)}`);
});

test('Texte sind mittig, horizontal, proportional und innerhalb von Textbox, Modellrand und Kameramaske', () => {
  for (const design of DESIGNS) for (const modelId of ['iphone-18-pro-max', 'samsung-galaxy-s26-ultra', 'google-pixel-11-pro-xl', 'samsung-galaxy-z-flip8']) for (const verse of VERSES) {
    const layout = renderLayout({ ...custom, modelId, designId: design.id, verseId: verse.id }), model = MODELS.find(m => m.id === modelId);
    const source = designAsset(design.id).sourcePixels;
    assert.ok(Math.abs(layout.imagePlacement.width / source.width - layout.imagePlacement.height / source.height) < 1e-9);
    assert.deepEqual(layout.sourcePixels, source);
    assert.equal(layout.configuration.layoutVersion, LAYOUT_VERSION); assert.equal(layout.productionApproved, false);
    assert.equal(layout.configuration.verseReference, verse.reference); assert.equal(layout.configuration.verseExcerpt, verse.quote);
    assert.equal(layout.typography.length, 3); assert.equal(/rotate\(|skew|matrix\(/.test(layout.svg), false);
    assert.equal(layout.svg.includes('<text'), false); // All printed text is built from the actual supplied font paths.
    for (const block of layout.typography) {
      const definition = designAsset(design.id).boxes[block.key];
      assert.equal(block.rotation, 0); assert.ok(block.sourceSize >= definition.minFont && block.sourceSize <= definition.maxFont);
      assert.ok(block.lines.length <= definition.maxLines); assert.equal(overlap(block.box, model.template.camera), false);
      for (const position of block.positions) {
        const b = position.bounds;
        assert.ok(Math.abs(b.x + b.width / 2 - block.box.x - block.box.width / 2) < 0.001);
        assert.ok(b.x >= block.box.x - 0.001 && b.y >= block.box.y - 0.001);
        assert.ok(b.x + b.width <= block.box.x + block.box.width + 0.001 && b.y + b.height <= block.box.y + block.box.height + 0.001);
        assert.ok(b.x >= model.template.safe && b.y + b.height <= model.template.height - model.template.safe);
      }
      for (let n = 1; n < block.positions.length; n++) assert.ok(Math.abs(block.positions[n].baseline - block.positions[n - 1].baseline - block.lineHeight) < 0.001);
    }
  }
});

test('Neue Manifestflächen und Bildversatz bleiben auf schmalen und breiten Testflächen proportional; PNG behält die Modellmaße', async () => {
  const model = MODELS[0], previous = model.template;
  try {
    for (const width of [1000, 1400]) {
      model.template = { ...previous, width, camera: { ...previous.camera, x: previous.camera.x * width / previous.width, width: previous.camera.width * width / previous.width } };
      for (const design of DESIGNS) for (const kind of ['fixed', 'custom']) {
        const asset = designAsset(design.id), record = DESIGN_PACKAGE.designs.find(d => d.id === asset.sourceId);
        const layout = renderLayout({ ...custom, kind, designId: design.id, modelId: model.id, verseId: '1kor13-13' }), image = layout.imagePlacement;
        assert.ok(image.x >= -0.001 && image.y >= -0.001);
        assert.ok(image.x + image.width <= layout.width + 0.001 && image.y + image.height <= layout.height + 0.001);
        assert.ok(Math.abs(image.width / asset.sourcePixels.width - image.height / asset.sourcePixels.height) < 1e-9);
        for (const block of layout.typography) {
          const box = asset.boxes[block.key];
          assert.equal(box.y, record.boxes[block.key].y, 'Neue vertikale Position aus v2 bleibt maßgeblich');
          assert.ok(Math.abs(block.box.y - image.y - box.y * image.height) < 0.001);
          assert.ok(Math.abs(block.box.x - image.x - box.x * image.width) < 0.001);
          for (const { bounds } of block.positions) assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= layout.width && bounds.y + bounds.height <= layout.height);
        }
        const png = await rasterize(layout.svg), metadata = await sharp(png).metadata();
        assert.equal(metadata.width, width); assert.equal(metadata.height, model.template.height);
        const actual = await sharp(png).removeAlpha().raw().toBuffer(), expected = await sharp(Buffer.from(layout.svg), { density: 300 }).resize(width, model.template.height).removeAlpha().raw().toBuffer();
        assert.equal(digest(actual), digest(expected), 'SVG und PNG sind identisch gerendert');
      }
    }
  } finally { model.template = previous; }
});

test('Feste Referenz, Wunschvers und optionale Widmung werden getrennt gesetzt; fremde Textmetadaten werden nicht übernommen', () => {
  const standard = renderLayout(fixed), personal = renderLayout({ ...custom, verseReference: 'Fremde Stelle', verseExcerpt: 'Nicht aus der Quelle', artworkHash: 'manipuliert' });
  assert.deepEqual(standard.typography.map(b => [b.key, b.lines]), [['reference', ['Psalm 91,4']]]);
  assert.equal(personal.configuration.verseReference, 'Jesaja 41,10');
  assert.equal(personal.configuration.verseExcerpt, VERSES.find(v => v.id === custom.verseId).quote);
  assert.equal(personal.printText.includes('Psalm 91,4'), false);
  assert.notEqual(personal.configuration.artworkHash, 'manipuliert');
  assert.equal(renderLayout({ ...custom, dedication: '' }).typography.length, 2);
});

test('Papier füllt die Hüllenränder ohne Farbstreifen; größere Texte halten Abstand zu den Dekorzweigen', async () => {
  for (const design of DESIGNS) {
    const asset = designAsset(design.id), layout = renderLayout({ ...custom, designId: design.id, verseId: '1kor13-13' });
    const { data: source, info: sourceInfo } = await sharp('public' + asset.blankImageUrl).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const block of layout.typography) {
      const previousMax = DESIGN_PACKAGE.designs.find(d => d.reference === design.reference).boxes[block.key].maxFont;
      assert.ok(block.sourceSize > previousMax, `${design.id}: ${block.key} soll sichtbar größer sein`);
      // Check real artwork ink around the text, rather than just trusting its
      // proposed box. A little padding prevents letters from touching branches.
      for (const { bounds: b } of block.positions) {
        const { x, y, scale } = layout.imagePlacement, padding = 7;
        const left = Math.max(0, Math.floor((b.x - x) / scale - padding)), right = Math.min(sourceInfo.width, Math.ceil((b.x + b.width - x) / scale + padding));
        const top = Math.max(0, Math.floor((b.y - y) / scale - padding)), bottom = Math.min(sourceInfo.height, Math.ceil((b.y + b.height - y) / scale + padding));
        for (let sy = top; sy < bottom; sy++) for (let sx = left; sx < right; sx++) assert.ok(source[(sy * sourceInfo.width + sx) * 3] > 200, `${design.id}: Dekor berührt ${block.key}`);
      }
    }
    const { data, info } = await sharp(Buffer.from(layout.svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rowMean = y => { const sums = [0, 0, 0]; for (let x = 0; x < info.width; x++) for (let ch = 0; ch < 3; ch++) sums[ch] += data[(y * info.width + x) * 3 + ch] / info.width; return sums; };
    const bandMean = start => { const result = [0, 0, 0]; for (let row = start; row < start + 16; row++) { const mean = rowMean(row); for (let ch = 0; ch < 3; ch++) result[ch] += mean[ch] / 16; } return result; };
    const imageTop = layout.imagePlacement.y, imageBottom = imageTop + layout.imagePlacement.height;
    for (const seam of [imageTop, imageBottom]) {
      const before = bandMean(Math.floor(seam) - 20), after = bandMean(Math.ceil(seam) + 4);
      assert.ok(before.every((value, ch) => Math.abs(value - after[ch]) < 0.35), `${design.id}: sichtbarer Farbsprung am Bildrand`);
    }
    for (const [start, end] of [[0, Math.floor(imageTop) - 2], [Math.ceil(imageBottom) + 2, info.height]]) {
      let min = 255, max = 0;
      for (let y = start; y < end; y++) for (let x = 0; x < info.width; x++) { const value = data[(y * info.width + x) * 3]; min = Math.min(min, value); max = Math.max(max, value); }
      assert.ok(min > 230, `${design.id}: Illustration wurde in den Hintergrund wiederholt`);
      assert.ok(max - min >= 2, `${design.id}: flacher Farbstreifen statt Papierhintergrund`);
    }
  }
});

test('Lange Referenzen werden einzeilig angepasst; dreizeilige Texte passen oder blockieren ohne Abschneiden', () => {
  const definition = designAsset(fixed.designId).boxes.reference;
  const roomy = fitText('1. Thessalonicher 5,16–18', definition, { x: 0, y: 0, width: 1000, height: 120 }, 1, 'reference');
  const width = roomy.positions[0].bounds.width * 0.82;
  const fitted = fitText('1. Thessalonicher 5,16–18', definition, { x: 0, y: 0, width, height: 120 }, 1, 'reference');
  assert.equal(fitted.lines.length, 1); assert.ok(fitted.sourceSize < definition.maxFont && fitted.sourceSize >= definition.minFont);
  const excerpt = designAsset(fixed.designId).boxes.excerpt, box = { x: 0, y: 0, width: 280, height: 155 };
  const three = fitText('Sei getrost und unverzagt. Fürchte dich nicht, denn ich bin bei dir.', excerpt, box, 1);
  assert.equal(three.lines.length, 3);
  assert.throws(() => fitText('W'.repeat(180), excerpt, box, 1), /passt nicht lesbar/);
  assert.throws(() => fitText('Hoffnung '.repeat(180), excerpt, box, 1), /passt nicht lesbar/);
  assert.throws(() => renderLayout({ ...custom, dedication: '💚' }), /Zeichen/);
});

test('Überlauf verhindert Warenkorbzugang; bereits gespeicherte Druckdateien bleiben nach Layoutänderung unverändert', async () => {
  const shop = (await Shop.create({ ...defaultConfig(), dataDir: resolve('test-results', randomUUID()), adminPassword: 'Nur-Test-Admin-2026!', autoShip: false }));
  const { session } = (await shop.createSession()), asset = designAsset(fixed.designId), oldY = asset.boxes.reference.y;
  try {
    const before = (await shop.preview(custom)), savedSvg = await shop.printFile(before.hash, 'svg');
    VERSES.push({ ...VERSES[0], id: 'overflow-package-test', quote: 'W'.repeat(180) });
    try { (await assert.rejects(async () => (await shop.saveCart(session, { ...custom, verseId: 'overflow-package-test' })), /passt nicht lesbar/)); assert.equal((await shop.cart(session)).length, 0); } finally { VERSES.pop(); }
    asset.boxes.reference.y += 0.005;
    const after = (await shop.preview(custom)); assert.notEqual(after.hash, before.hash);
    assert.equal(await shop.printFile(before.hash, 'svg'), savedSvg);
  } finally { asset.boxes.reference.y = oldY; (await shop.close()); }
});
