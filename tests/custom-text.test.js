import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { renderLayout, normalizeConfiguration } from '../server/layout.js';
import { MODELS, DESIGNS, VERSES } from '../server/catalog.js';
import { designAsset } from '../server/design-assets.js';
import { customTextForEditor, MAX_CUSTOM_TEXT } from '../public/custom-text.js';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';

const custom = { kind: 'custom', designId: 'nach-dem-sturm', modelId: 'iphone-14-pro', backgroundId: 'light-blue', customText: 'Du bist geliebt.', dedication: '' };
test('Freier Text ersetzt alle vorgegebenen Worte und bleibt als Drucktext unverändert erhalten', () => {
  for (const customText of ['Psalm 23,1', 'Du bist geliebt.', 'Heute & morgen.', 'Für Änne\nBleib behütet.', 'Glaube\n\nLiebe']) {
    const result = renderLayout({ ...custom, customText, verseId: 'ps23-1', verseReference: 'IGNORED', verseExcerpt: 'IGNORED' });
    assert.equal(result.printText, customText); assert.equal(result.configuration.customText, customText);
    assert.equal(result.configuration.verseId, null); assert.equal(result.configuration.verseReference, '');
    assert.deepEqual(result.typography.flatMap(t => t.lines).join(' ').replace(/\s+/g, ' '), customText.replace(/\s+/g, ' '));
    assert.equal(result.typography[0].rotation, 0);
    assert.equal(renderLayout(result.configuration).hash, result.hash);
  }
  assert.equal(renderLayout({ ...custom, customText: '  Fu\u0308r dich\r\nHeute.  ' }).printText, 'Für dich\nHeute.');
  assert.equal(renderLayout({ ...custom, dedication: 'Für Anna' }).printText, 'Du bist geliebt.\nFür Anna');
});

test('180-Zeichen-Grenze, fehlende Eingabe, Steuerzeichen, Emojis und Überlauf werden serverseitig geprüft', () => {
  for (const customText of ['', '   ', null, {}, 123, 'A'.repeat(MAX_CUSTOM_TEXT + 1), 'Text\u202Eabc', '💚', 'W'.repeat(180), 'eins\nzwei\ndrei\nvier']) {
    assert.throws(() => renderLayout({ ...custom, customText }), { status: 400 });
  }
  assert.throws(() => normalizeConfiguration({ ...custom, customText: '' }), /Bitte gib/);
  const empty = renderLayout({ ...custom, customText: '' }, { allowEmptyCustomText: true });
  assert.equal(empty.printText, ''); assert.equal(empty.typography.length, 0);
  assert.notEqual(renderLayout(custom).hash, renderLayout({ ...custom, customText: 'Du bist wertvoll.' }).hash);
  assert.doesNotMatch(renderLayout({ ...custom, customText: '<b>Liebe</b>' }).svg, /<b>Liebe<\/b>/);
});

test('Kurze und mehrzeilige Wunschtexte passen auf alle 74 Modellprofile und 6 Motive, einschließlich Flip-Hälfte', () => {
  for (const model of MODELS) for (const design of DESIGNS) for (const customText of ['Psalm 23,1', 'Der Herr ist mein Hirte; mir wird nichts mangeln.']) {
    const result = renderLayout({ ...custom, modelId: model.id, designId: design.id, customText, dedication: 'Für Anna' });
    assert.ok(result.imagePlacement.scale <= result.maximumScale + 0.001);
    for (const block of result.typography) for (const p of block.positions) {
      assert.ok(p.bounds.x >= block.box.x - .001 && p.bounds.y >= block.box.y - .001);
      assert.ok(p.bounds.x + p.bounds.width <= block.box.x + block.box.width + .001);
      assert.ok(p.bounds.y + p.bounds.height <= block.box.y + block.box.height + .001);
      assert.equal(block.rotation, 0);
    }
    const block = result.typography[0], boxes = designAsset(design.id).boxes;
    assert.ok(block.sourceSize >= Math.min(boxes.reference.minFont, boxes.excerpt.minFont));
    if (model.template.foldY) assert.ok(result.contentBounds.y >= model.template.artArea.y);
  }
});

test('Bestehende Versgestaltungen bleiben lesbar; Bearbeiten übernimmt deren Wortlaut in das Freitextfeld', () => {
  const { customText, ...base } = custom;
  const old = renderLayout({ ...base, verseId: 'ps23-1' }), verse = VERSES.find(v => v.id === 'ps23-1');
  assert.equal(old.printText, `${verse.quote}\n${verse.reference}`);
  assert.equal(customTextForEditor(old.configuration, VERSES), old.printText);
  assert.equal(customTextForEditor({ ...old.configuration, customText: '' }, VERSES), '');
  assert.equal(customTextForEditor(custom), customText);
  const fixed = renderLayout({ ...base, kind: 'fixed' });
  assert.equal(fixed.printText, 'Markus 4,39');
  assert.equal(renderLayout({ ...base, kind: 'fixed', customText: 'Ignored' }).hash, fixed.hash);
});

test('Freitext bleibt von Vorschau über Warenkorbänderung und Checkout bis zum gespeicherten Druckauftrag identisch', async () => {
  const shop = await Shop.create({ ...defaultConfig(), shopMode: 'test', podbaseMode: 'local', mailMode: 'local', paymentMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Free-Text-Test-2026!', autoShip: false });
  try {
    const { session } = await shop.createSession();
    const empty = await shop.preview({ ...custom, customText: '' }); assert.equal(empty.printText, '');
    await assert.rejects(shop.saveCart(session, { ...custom, customText: '' }), /Bitte gib/);
    const before = await shop.preview(custom), oldFile = await shop.printFile(before.hash, 'svg');
    let cart = await shop.saveCart(session, custom); assert.equal(cart[0].hash, before.hash);
    cart = await shop.saveCart(session, { ...custom, customText: 'Für dich.\nHeute und jeden Tag.', dedication: 'Deine Anna' }, cart[0].id);
    assert.equal(cart.length, 1); assert.notEqual(cart[0].hash, before.hash);
    assert.equal(await shop.printFile(before.hash, 'svg'), oldFile);
    const order = await shop.checkout(session, { method: 'card', recipient: { name: 'Mara Mustermann', email: 'mara@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' } });
    const stored = await shop.s.get('SELECT * FROM orders WHERE id=?', order.orderId), item = JSON.parse(stored.items)[0];
    assert.equal(item.hash, cart[0].hash); assert.equal(item.printText, cart[0].printText);
    assert.equal(item.configuration.customText, 'Für dich.\nHeute und jeden Tag.');
    await shop.acceptPayment({ id: 'evt-free-text', orderId: stored.id, paymentId: stored.payment_id, completed: true, amount: stored.amount, currency: 'EUR' });
    await shop.tick();
    const provider = await shop.s.get('SELECT * FROM provider_orders WHERE external_id=?', stored.id);
    assert.match(provider.id, /^SIM-/); assert.ok(provider.payload.includes(item.hash));
    assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 1);
  } finally { await shop.close(); }
});
