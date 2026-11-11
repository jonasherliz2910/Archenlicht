import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { PODBASE_PRINT_TEMPLATES, officialTemplate, productionPrint, previewFromProduction } from '../server/production-print.js';
import { renderLayout, rasterize } from '../server/layout.js';
import { DESIGNS, findModel } from '../server/catalog.js';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import { podbasePayload } from '../server/podbase.js';

const input = { kind: 'custom', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue', customText: 'Du bist geliebt.', dedication: 'Für Anna' };

test('Offizielle Vorlagen enthalten Variantenbezug, Originalkurven und prüfbare Quelldateien', () => {
  assert.equal(PODBASE_PRINT_TEMPLATES.templates.length, 64);
  assert.equal(PODBASE_PRINT_TEMPLATES.missing.length, 10);
  assert.match(PODBASE_PRINT_TEMPLATES.source.guideSha256, /^[a-f0-9]{64}$/);
  for (const t of PODBASE_PRINT_TEMPLATES.templates) {
    assert.ok(findModel(t.modelId)); assert.equal(t.width, 2000); assert.equal(t.height, 3400);
    assert.match(t.variantId, /^PBV-/); assert.ok(t.safeArea.path && t.cameraExclusions.length);
    assert.ok(t.safeArea.bounds.width > 0 && t.safeArea.bounds.height > 0);
  }
  assert.equal(officialTemplate('samsung-galaxy-z-flip8'), undefined);
});

test('Alle belegten Modelle: Motive und Wunschtexte bleiben innerhalb der Original-Druckkurven', async t => {
  for (const template of PODBASE_PRINT_TEMPLATES.templates) {
    const model = findModel(template.modelId);
    for (const design of DESIGNS) {
      const layout = renderLayout({ ...input, kind: 'fixed', designId: design.id, modelId: model.id });
      const actual = await productionPrint(layout, model);
      assert.equal(actual.configuration.productionPrint.validation.unsafePixels, 0, model.id + '/' + design.id);
      assert.equal(actual.configuration.productionPrint.validation.outsideCanvasPixels, 0);
      assert.equal(actual.printText, layout.printText);
      assert.equal(actual.productionApproved, false);
      assert.ok(!actual.svg.includes(template.safeArea.path), 'No guides in print file');
    }
    for (const text of [{ customText: 'Der Herr ist mein Hirte; mir wird nichts mangeln.' }, { verseId: 'ps23-1' }]) {
      const { customText, ...rest } = input;
      const layout = renderLayout({ ...rest, ...text, modelId: model.id });
      const actual = await productionPrint(layout, model);
      assert.equal(actual.printText, layout.printText);
      assert.equal(actual.configuration.productionPrint.validation.unsafePixels, 0);
    }
    t.diagnostic(template.modelId + ' verified');
  }
});

test('PNG ist vollflächig, und die Vorschau stammt aus derselben gespeicherten Druckkomposition', async () => {
  const model = findModel(input.modelId), layout = renderLayout(input);
  const result = await productionPrint(layout, model), png = await rasterize(result.svg), info = await sharp(png).metadata();
  assert.equal(info.width, 2000); assert.equal(info.height, 3400); assert.equal(info.density, 300);
  const { data, info: pixels } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let n = 3; n < data.length; n += pixels.channels) assert.equal(data[n], 255);
  assert.deepEqual([...data.subarray(0, 3)], [200, 217, 227]);
  const preview = previewFromProduction(result.svg, result.configuration);
  assert.equal(preview.slice(preview.indexOf('>') + 1), result.svg.slice(result.svg.indexOf('>') + 1));
  assert.notEqual(result.hash, layout.hash);
});

test('Kaufweg speichert exakt die geprüfte Druckdatei; fehlende Vorlagen sperren den Warenkorb', async () => {
  const shop = await Shop.create({ ...defaultConfig(), printMode: 'podbase', podbaseMode: 'local', shopMode: 'test', paymentMode: 'local', mailMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Print-Template-Test-2026!', autoShip: false });
  try {
    const { session } = await shop.createSession();
    const preview = await shop.preview(input);
    assert.match(preview.svgUrl, /\.preview\.svg$/); assert.equal(preview.officialPrintTemplate, true);
    assert.equal((await sharp(await shop.printFile(preview.hash, 'png')).metadata()).width, 2000);
    const cart = await shop.saveCart(session, input); assert.equal(cart[0].hash, preview.hash);
    await assert.rejects(shop.saveCart(session, { ...input, modelId: 'iphone-18-pro' }), /Druckvorlage/);
    const state = await shop.publicState(session);
    assert.ok(state.variants.filter(v => v.model_id === 'iphone-18-pro').every(v => !v.available));
    const checkout = await shop.checkout(session, { method: 'card', recipient: { name: 'Drucktest', email: 'print@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' } });
    const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
    const item = JSON.parse(order.items)[0]; assert.equal(item.hash, preview.hash);
    assert.equal(item.configuration.productionPrint.templateHash, officialTemplate(input.modelId).hash);
    assert.equal(podbasePayload(order, 'https://www.archenlicht.de').items[0].printFile, `https://www.archenlicht.de/prints/${preview.hash}.png`);
    assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
  } finally { await shop.close(); }
});

test('Alte Warenkörbe bleiben trotz inzwischen fehlender Druckvorlage erreichbar und bearbeitbar', async () => {
  const shop = await Shop.create({ ...defaultConfig(), printMode: 'preview', podbaseMode: 'local', shopMode: 'test', paymentMode: 'local', mailMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Print-Template-Test-2026!', autoShip: false });
  try {
    const { session } = await shop.createSession();
    const cart = await shop.saveCart(session, { ...input, modelId: 'iphone-18-pro' });
    shop.config.printMode = 'podbase';
    const state = await shop.publicState(session);
    assert.equal(state.cart.length, 1); assert.equal(state.cart[0].available, false);
    assert.equal(state.cart[0].officialPrintTemplate, false);
    assert.match(await shop.printFile(state.cart[0].hash, 'svg'), /<svg/);
    await assert.rejects(shop.checkout(session, {}), /Druckvorlage/);
    assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
    const edited = await shop.saveCart(session, input, cart[0].id);
    assert.equal(edited[0].available, true); assert.equal(edited[0].officialPrintTemplate, true);
    assert.deepEqual(await shop.removeCart(session, cart[0].id), []);
  } finally { await shop.close(); }
});
