import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';
import { priceBundleItems, priceNewsletterItems, summarizePricing } from '../public/bundle-pricing.js';
import { podbasePayload } from '../server/podbase.js';
import { orderEmail } from '../server/mail-templates.js';

const configuration = () => ({ ...defaultConfig(), shopMode: 'test', paymentMode: 'local', podbaseMode: 'local', printMode: 'preview', mailMode: 'local', newsletterMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), serverless: true, autoShip: false });
const selection = (index = 0) => ({ bundleId: FIXED_BUNDLES[index].id, requestId: randomUUID(), items: FIXED_BUNDLES[index].designs.map((designId, i) => ({ kind: 'fixed', designId, modelId: ['iphone-14-pro', 'samsung-galaxy-s25', 'google-pixel-9'][i], backgroundId: ['light-blue', 'mint', 'lilac'][i], magsafe: i === 0 })) });
const recipient = { name: 'Bundle Test', email: 'bundle@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };
async function fixture(t) { const shop = await Shop.create(configuration()); t.after(() => shop.close()); return { shop, session: (await shop.createSession()).session }; }

test('Fixed sets preserve all three models, colours, prints and MagSafe through cart and Podbase payload', async t => {
  const { shop, session } = await fixture(t), first = selection();
  const cart = await shop.saveFixedBundle(session, { ...first, unitPrice: 1, discount: 100 });
  assert.equal(cart.length, 3);
  for (const [i, item] of cart.entries()) {
    for (const name of ['designId', 'modelId', 'backgroundId', 'magsafe']) assert.equal(item.configuration[name], first.items[i][name]);
    assert.equal(item.quantity, 1); assert.equal(item.unitPrice, i === 0 ? 3499 : 2999);
  }
  assert.equal(summarizePricing(cart).percent, 10); assert.equal(summarizePricing(cart).total, 8547);
  const checkout = await shop.checkout(session, { recipient, method: 'card' });
  const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
  const stored = JSON.parse(order.items);
  assert.equal(order.amount, 8547);
  assert.equal(summarizePricing(stored).total, order.amount);
  const mail = orderEmail({ order, kind: 'confirmation', statusUrl: 'https://example.test/order' });
  assert.match(mail.text, /Bundle-Rabatt \(10 %\): −9,50/);
  assert.match(mail.text, /85,47/);
  assert.deepEqual(stored.map(i => i.configuration), cart.map(i => i.configuration));
  assert.deepEqual(stored.map(i => i.hash), cart.map(i => i.hash));
  const payload = podbasePayload(order, 'https://example.test');
  assert.equal(payload.items.length, 3); assert.ok(payload.items.every(i => i.quantity === 1));
  assert.deepEqual(payload.items.map(i => i.productId), cart.map(i => i.productId));
  const both = await shop.saveFixedBundle(session, selection(1));
  assert.equal(both.length, 6); assert.equal(summarizePricing(both).percent, 10);
  assert.deepEqual(both.map(i => i.configuration.designId), FIXED_BUNDLES.flatMap(b => b.designs));
});

test('Both complete sets get 10 percent, while duplicates, custom cases and incomplete sets keep normal quantity pricing', () => {
  for (const bundle of FIXED_BUNDLES) {
    const original = bundle.designs.map(designId => ({ configuration: { kind: 'fixed', designId }, unitPrice: 2999, quantity: 1 }));
    const priced = priceBundleItems(original);
    assert.deepEqual(summarizePricing(priced), { quantity: 3, subtotal: 8997, discount: 900, total: 8097, percent: 10, isBundle: true });
    assert.deepEqual(priceBundleItems(priced), priced, 'Discount is not compounded');
    assert.equal(summarizePricing(priceBundleItems([...original].reverse())).percent, 10);
    assert.throws(() => priceNewsletterItems(priced), /nicht.*kombinierbar/);
    const old = original.map(item => ({ ...item, pricing: { version: 'bundle-5-10-v2', percent: 5, subtotal: 2999, discount: 150, total: 2849 } }));
    assert.equal(summarizePricing(old).total, 8547, 'Existing order snapshots keep their original 5 percent');
    for (const items of [original.slice(0, 2), [original[0], original[0], original[2]], [original[0], original[1], { ...original[2], configuration: { ...original[2].configuration, kind: 'custom' } }]]) {
      assert.equal(summarizePricing(priceBundleItems(items.map(item => ({ ...item, bundleId: bundle.id, discount: 100 })))).percent, 5);
    }
  }
});

test('Editing fit, colour or MagSafe keeps set savings; changing a motif or removing a case recalculates them', async t => {
  const { shop, session } = await fixture(t), input = selection();
  let cart = await shop.saveFixedBundle(session, input);
  const item = cart[0], changed = { ...input.items[0], modelId: 'iphone-15', backgroundId: 'black', magsafe: false };
  cart = await shop.saveCart(session, changed, item.id);
  assert.equal(summarizePricing(cart).percent, 10); assert.equal(summarizePricing(cart).total, 8097);
  cart = await shop.saveCart(session, { ...changed, designId: 'getragen' }, item.id);
  assert.equal(summarizePricing(cart).percent, 5);
  cart = await shop.saveCart(session, changed, item.id);
  assert.equal(summarizePricing(cart).percent, 10);
  cart = await shop.removeCart(session, item.id);
  assert.equal(summarizePricing(cart).percent, 5); assert.equal(summarizePricing(cart).total, 5698);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
});

test('A fixed set is atomic; altered motifs, missing choices and unavailable third case never leave a partial set', async t => {
  const { shop, session } = await fixture(t);
  for (const change of [p => p.items.pop(), p => { p.items[0].designId = 'getragen'; }, p => { p.items[0].quantity = 2; }, p => { p.items[0].customText = 'Changed'; }, p => { p.items[1].backgroundId = 'unknown'; }]) {
    const input = selection(); change(input);
    await assert.rejects(() => shop.saveFixedBundle(session, input));
    assert.equal((await shop.cart(session)).length, 0);
  }
  const input = selection();
  await shop.s.run('UPDATE variants SET available=0 WHERE model_id=? AND design_id=?', input.items[2].modelId, input.items[2].designId);
  await assert.rejects(() => shop.saveFixedBundle(session, input), /nicht verfügbar/);
  assert.equal((await shop.cart(session)).length, 0);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
});

test('Retrying a bundle request is idempotent and the cart limit applies to the whole set', async t => {
  const { shop, session } = await fixture(t), input = selection();
  await Promise.all([shop.saveFixedBundle(session, input), shop.saveFixedBundle(session, input), shop.saveFixedBundle(session, input)]);
  assert.equal((await shop.cart(session)).length, 3);
  const edited = structuredClone(input); edited.items[0].backgroundId = 'black';
  await assert.rejects(() => shop.saveFixedBundle(session, edited), /bereits verändert/);
  assert.equal((await shop.cart(session))[0].configuration.backgroundId, 'light-blue');
  for (let i = 0; i < 15; i++) await shop.s.run('INSERT INTO cart VALUES(?,?,?,?,?)', randomUUID(), session.id, JSON.stringify({ ...input.items[0], dedication: '' }), 1, Date.now());
  await assert.rejects(() => shop.saveFixedBundle(session, selection(1)), /20 Positionen/);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM cart WHERE session_id=?', session.id)).n, 18);
});

test('The bundle endpoint requires CSRF and returns exactly three correctly priced cases', async t => {
  const app = await createApp(configuration()); await new Promise(r => app.server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => app.server.close(r)));
  const base = `http://127.0.0.1:${app.server.address().port}`, bootstrap = await fetch(base + '/api/bootstrap'), state = await bootstrap.json();
  for (const bundle of FIXED_BUNDLES) {
    const page = await fetch(base + '/bundle/' + bundle.id); assert.equal(page.status, 200);
    assert.ok((await page.text()).includes(`${bundle.title} · Dreier-Bundle | Archenlicht`));
  }
  assert.equal((await fetch(base + '/bundle/unknown')).status, 404);
  const headers = { Cookie: bootstrap.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' }, body = JSON.stringify(selection());
  assert.equal((await fetch(base + '/api/cart/bundle', { method: 'POST', headers, body })).status, 403);
  const response = await fetch(base + '/api/cart/bundle', { method: 'POST', headers: { ...headers, 'X-CSRF-Token': state.csrf }, body });
  assert.equal(response.status, 200); const cart = await response.json();
  assert.equal(cart.length, 3); assert.equal(summarizePricing(cart).total, 8547);
  assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
});
