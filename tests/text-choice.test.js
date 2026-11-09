import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createTextChoice, applyTextChoice, hasConfiguredText } from '../public/custom-text.js';
import { renderLayout } from '../server/layout.js';
import { VERSES } from '../server/catalog.js';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';

const base = { kind: 'custom', designId: 'nach-dem-sturm', modelId: 'iphone-14-pro', backgroundId: 'light-blue', dedication: 'Für Anna' };
test('Beim Wechsel bleiben beide Entwürfe erhalten; nur der aktive Text wird gedruckt', () => {
  const choice = createTextChoice(base, VERSES);
  let config = applyTextChoice(base, choice);
  assert.equal(choice.mode, 'suggested'); assert.ok(hasConfiguredText(config, VERSES));
  choice.mode = 'custom'; config = applyTextChoice(config, choice);
  assert.equal(hasConfiguredText(config, VERSES), false);
  choice.customText = 'Deine eigenen Worte.'; config = applyTextChoice(config, choice);
  assert.equal(renderLayout(config).printText, 'Deine eigenen Worte.\nFür Anna');
  choice.mode = 'suggested'; choice.verseId = 'jos1-6';
  config = applyTextChoice(renderLayout(config).configuration, choice);
  assert.ok(!Object.hasOwn(config, 'customText'));
  const verse = VERSES.find(v => v.id === choice.verseId);
  assert.equal(renderLayout(config).printText, `${verse.quote}\n${verse.reference}\nFür Anna`);
  choice.mode = 'custom'; config = applyTextChoice(renderLayout(config).configuration, choice);
  assert.equal(config.customText, 'Deine eigenen Worte.'); assert.ok(!Object.hasOwn(config, 'verseId'));
  assert.equal(renderLayout(config).printText, 'Deine eigenen Worte.\nFür Anna');
  assert.equal(hasConfiguredText({ ...base, verseId: 'missing' }, VERSES), false);
});

test('Beratener Vers und eigener Text bleiben beim Speichern und Bearbeiten getrennt; die Situation geht nicht in den Warenkorb', async () => {
  const shop = await Shop.create({ ...defaultConfig(), shopMode: 'test', podbaseMode: 'local', mailMode: 'local', paymentMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Text-Choice-Test-2026!', autoShip: false });
  try {
    const { session } = await shop.createSession();
    const situation = 'Ein Neuanfang macht mir Angst.';
    const result = shop.advise(session, situation);
    assert.equal(result.simulated, true); assert.equal(result.recommendations.length, 3);
    const verse = result.recommendations[0];
    let cart = await shop.saveCart(session, { ...base, verseId: verse.id });
    assert.equal(cart[0].printText, `${verse.quote}\n${verse.reference}\nFür Anna`);
    assert.equal(createTextChoice(cart[0].configuration, VERSES).mode, 'suggested');
    assert.ok(!JSON.stringify(cart).includes(situation));
    const choice = createTextChoice(cart[0].configuration, VERSES);
    choice.mode = 'custom'; choice.customText = 'Du bist geliebt.';
    cart = await shop.saveCart(session, applyTextChoice(cart[0].configuration, choice), cart[0].id);
    assert.equal(cart.length, 1); assert.equal(cart[0].printText, 'Du bist geliebt.\nFür Anna');
    assert.equal(createTextChoice(cart[0].configuration, VERSES).mode, 'custom');
    choice.mode = 'suggested';
    cart = await shop.saveCart(session, applyTextChoice(cart[0].configuration, choice), cart[0].id);
    assert.equal(cart.length, 1); assert.equal(cart[0].configuration.verseId, verse.id);
    assert.ok(!Object.hasOwn(cart[0].configuration, 'customText'));
    shop.advisorScenario = 'unavailable';
    assert.deepEqual(shop.advise(session, situation).recommendations, []);
    assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
  } finally { await shop.close(); }
});
