import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import { PODBASE_MODEL_MAP, PodbaseCatalog } from '../server/podbase-catalog.js';
import { PODBASE_MAGSAFE_MAP, magneticVariant } from '../server/case-variants.js';
import { renderLayout, normalizeConfiguration } from '../server/layout.js';
import { productionPrint, officialTemplate, PODBASE_PRINT_TEMPLATES } from '../server/production-print.js';
import { BRAND, findModel, DESIGNS } from '../server/catalog.js';
import { Payments } from '../server/payments.js';
import { podbasePayload } from '../server/podbase.js';
import { orderEmail } from '../server/mail-templates.js';
import { casePrice, caseAvailable } from '../public/case-options.js';

const fixed = { kind: 'fixed', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue' };
const custom = { ...fixed, kind: 'custom', customText: 'Nach jedem Sturm\nkommt wieder Licht.', dedication: 'Für Anna' };
const recipient = { name: 'Mara Mustermann', email: 'mara@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };
const fixture = () => [PODBASE_MODEL_MAP, ...PODBASE_MAGSAFE_MAP.products].map(p => ({ id: p.productId, title: p.productName, variants: [...new Map(p.models.map(m => [m.variantId, { id: m.variantId, name: m.catalogName, inStock: true }])).values()] }));
async function setup(t, printMode = 'preview') {
  const shop = await Shop.create({ ...defaultConfig(), printMode, shopMode: 'test', podbaseMode: 'catalog', podbaseKey: 'local-fixture', paymentMode: 'local', mailMode: 'local', storageMode: 'sqlite', databaseUrl: undefined, dataDir: resolve('test-results', randomUUID()), adminPassword: 'MagSafe-Test-2026!', autoShip: false });
  t.after(() => shop.close()); const products = fixture(), calls = [];
  shop.podbaseCatalog.fetch = async (url, options) => { calls.push({ url, method: options.method }); return Response.json(products); };
  return { shop, products, calls, session: (await shop.createSession()).session };
}

test('Vier verbindliche Preise; manipulierte Preise und MagSafe-Werte ersetzen keine Serverberechnung', async t => {
  const { shop, session } = await setup(t);
  for (const [configuration, expected] of [[fixed, 2999], [{ ...fixed, magsafe: true }, 3499], [custom, 3499], [{ ...custom, magsafe: true }, 3999]]) {
    assert.equal(casePrice(BRAND, configuration), expected);
    const cart = await shop.saveCart(session, { ...configuration, unitPrice: 1, productId: 'forged', variantId: 'forged' });
    assert.equal(cart.at(-1).unitPrice, expected);
    assert.notEqual(cart.at(-1).productId, 'forged');
  }
  for (const invalid of ['false', 'true', 1, null, {}]) assert.throws(() => normalizeConfiguration({ ...fixed, magsafe: invalid }), /MagSafe/);
  assert.equal(normalizeConfiguration(fixed).magsafe, false);
  assert.equal(caseAvailable({ available: 0, magsafe_available: 1 }, { magsafe: true }), true);
});

test('MagSafe-Umschalten erhält Motiv, Text, Widmung, Farbe und Vorschau für alle zugeordneten Modelle', () => {
  for (const product of PODBASE_MAGSAFE_MAP.products) for (const mapping of product.models) {
    for (const input of [fixed, custom, { ...custom, customText: undefined, verseId: 'ps23-1' }]) {
      const configuration = { ...input, modelId: mapping.modelId };
      if (configuration.customText === undefined) delete configuration.customText;
      const standard = renderLayout(configuration), magnetic = renderLayout({ ...configuration, magsafe: true });
      assert.equal(magnetic.svg, standard.svg); assert.equal(magnetic.printText, standard.printText);
      assert.deepEqual(magnetic.contentBounds, standard.contentBounds);
      const { magsafe: a, ...before } = standard.configuration, { magsafe: b, ...after } = magnetic.configuration;
      assert.deepEqual(after, before); assert.equal(a, false); assert.equal(b, true);
      assert.notEqual(magnetic.hash, standard.hash);
    }
  }
});

test('Offizielle magnetische Druckvorlagen haben eigene IDs und dieselbe proportionale Gestaltung', async () => {
  assert.equal(PODBASE_PRINT_TEMPLATES.magsafeTemplates.length, 37);
  for (const template of PODBASE_PRINT_TEMPLATES.magsafeTemplates) {
    const model = findModel(template.modelId);
    for (const input of [...DESIGNS.map(d => ({ ...fixed, designId: d.id })), custom]) {
      const layout = renderLayout({ ...input, modelId: model.id, magsafe: true });
      const printed = await productionPrint(layout, model);
      assert.equal(printed.configuration.productionPrint.variantId, magneticVariant(model.id).variantId);
      assert.equal(printed.configuration.productionPrint.validation.unsafePixels, 0);
      assert.equal(printed.configuration.productionPrint.validation.outsideCanvasPixels, 0);
      assert.equal(printed.printText, layout.printText);
    }
  }
  for (const c of [fixed, custom]) {
    const model = findModel(c.modelId);
    const standard = await productionPrint(renderLayout(c), model);
    const magnetic = await productionPrint(renderLayout({ ...c, magsafe: true }), model);
    assert.equal(magnetic.svg, standard.svg);
    assert.notEqual(magnetic.configuration.productionPrint.variantId, standard.configuration.productionPrint.variantId);
  }
});

test('Gemischter Warenkorb bleibt nach Bearbeiten, Zahlung und Wiederholung bei exakt den gewählten Podbase-Produkten', async t => {
  const { shop, session, calls } = await setup(t, 'podbase');
  let cart = await shop.saveCart(session, custom);
  const id = cart[0].id, text = cart[0].printText;
  cart = await shop.saveCart(session, { ...custom, magsafe: true, quantity: 2 }, id);
  assert.equal(cart.length, 1); assert.equal(cart[0].id, id); assert.equal(cart[0].printText, text);
  assert.equal(cart[0].variantId, magneticVariant(custom.modelId).variantId);
  cart = await shop.saveCart(session, { ...custom, magsafe: false }, id);
  assert.equal(cart[0].variantId, PODBASE_MODEL_MAP.models.find(m => m.modelId === custom.modelId).variantId);
  await shop.saveCart(session, { ...custom, magsafe: true, quantity: 2 }, id);
  await shop.saveCart(session, fixed);
  const checkout = await shop.checkout(session, { method: 'card', recipient });
  const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId), items = JSON.parse(order.items);
  assert.equal(order.amount, 10447); assert.equal(items[0].configuration.magsafe, true); assert.equal(items[1].configuration.magsafe, false);
  assert.notEqual(items[0].productId, items[1].productId); assert.notEqual(items[0].variantId, items[1].variantId);
  const event = { id: 'magsafe-payment', orderId: order.id, paymentId: order.payment_id, amount: order.amount, currency: 'EUR', completed: true };
  await shop.acceptPayment(event); await shop.acceptPayment(event); await shop.tick(); await shop.tick();
  const providers = await shop.s.all('SELECT * FROM provider_orders'); assert.equal(providers.length, 1);
  const payload = JSON.parse(providers[0].payload);
  for (const [n, item] of items.entries()) {
    assert.equal(payload.items[n].variantId, item.variantId); assert.equal(payload.items[n].productId, item.productId);
    assert.ok(payload.items[n].printFile.endsWith(`/prints/${item.hash}.png`));
  }
  assert.ok(calls.every(c => c.method === 'GET'));
  const liveFixture = { ...order, mode: 'live', paid_at: Date.now() };
  assert.equal(podbasePayload(liveFixture, 'https://www.archenlicht.de', { requireOfficialPrint: true }).items[0].variantId, items[0].variantId);
  const tampered = structuredClone(items); tampered[0].variantId = items[1].variantId;
  assert.throws(() => podbasePayload({ ...liveFixture, items: JSON.stringify(tampered) }, 'https://www.archenlicht.de', { requireOfficialPrint: true }), /stimmen nicht/);
  const email = orderEmail({ order, kind: 'confirmation', statusUrl: 'https://www.archenlicht.de/bestellung/test' });
  assert.match(email.text, /MagSafe-kompatibel/); assert.match(email.text, /Tough-Standardhülle/);
});

test('Fehlende oder vergriffene magnetische Variante wird vor Zahlung gesperrt; Standard bleibt möglich', async t => {
  const { shop, session, products } = await setup(t);
  await assert.rejects(shop.saveCart(session, { ...custom, magsafe: true, modelId: 'google-pixel-8' }), /MagSafe/);
  const cart = await shop.saveCart(session, { ...custom, magsafe: true });
  const map = magneticVariant(custom.modelId), product = products.find(p => p.id === map.productId);
  product.variants.find(v => v.id === map.variantId).inStock = false;
  await assert.rejects(shop.checkout(session, { method: 'card', recipient }), /nicht bestellbar/);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
  const state = await shop.publicState(session), v = state.variants.find(v => v.model_id === custom.modelId && v.design_id === custom.designId);
  assert.equal(v.available, 1); assert.equal(v.magsafe_available, 0); assert.equal(state.cart[0].available, false);
  await shop.saveCart(session, { ...custom, magsafe: false }, cart[0].id);
  await shop.checkout(session, { method: 'card', recipient });
  product.variants = product.variants.filter(v => v.id !== map.variantId);
  const snapshot = await shop.podbaseCatalog.snapshot({ force: true, strict: true });
  assert.equal(snapshot.models.find(m => m.modelId === custom.modelId).magsafe.matched, false);
});

test('Stripe erhält den berechneten Aufpreis und die ausgewählte Hüllenart; nur lokale Antwort', async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
  let body;
  globalThis.fetch = async (url, options) => { assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions'); body = new URLSearchParams(options.body); return Response.json({ id: 'cs_test_magsafe', url: 'https://checkout.stripe.com/c/pay/cs_test_magsafe', livemode: false }); };
  const payments = new Payments({ paymentMode: 'sandbox', stripeKey: 'sk_test_fixture', baseUrl: 'https://www.archenlicht.de' });
  await payments.create({ id: 'magsafe-order', mode: 'test', recipient: JSON.stringify(recipient), items: JSON.stringify([{ title: 'Nach dem Sturm', model: 'iPhone 14 Pro', configuration: { ...custom, magsafe: true }, unitPrice: casePrice(BRAND, { ...custom, magsafe: true }), quantity: 1 }]) });
  assert.equal(body.get('line_items[0][price_data][unit_amount]'), '3999');
  assert.match(body.get('line_items[0][price_data][product_data][name]'), /MagSafe-kompatibel/);
});
