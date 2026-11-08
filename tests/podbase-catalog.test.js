import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PodbaseCatalog, PODBASE_MODEL_MAP } from '../server/podbase-catalog.js';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';
import { LocalPodbase } from '../server/podbase.js';

const key = 'podbase-local-fixture-secret';
const fixture = () => [{ id: PODBASE_MODEL_MAP.productId, title: 'Tough Phone Case', variants: [...new Map(PODBASE_MODEL_MAP.models.map(m => [m.variantId, { id: m.variantId, name: m.catalogName, inStock: true }])).values()] }];
const model = PODBASE_MODEL_MAP.models.find(m => m.modelId === 'iphone-14-pro');
const configuration = { kind: 'fixed', designId: 'nach-dem-sturm', modelId: model.modelId, backgroundId: 'light-blue' };
const recipient = { name: 'Mara Mustermann', email: 'mara@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };

test('Katalog ordnet 74 Modelle einschließlich expliziter Namensvarianten zu; ausschließlich GET', async () => {
  const calls = [];
  const client = new PodbaseCatalog({ apiKey: key }, { fetchImpl: async (url, options) => { calls.push({ url, options }); return Response.json(fixture()); } });
  const snapshot = await client.snapshot({ strict: true });
  assert.equal(snapshot.models.length, 74);
  assert.equal(snapshot.models.filter(m => m.matched && m.inStock).length, 74);
  assert.equal(snapshot.models.filter(m => m.nameMatchRequiresReview).length, 10);
  assert.equal(snapshot.models.every(m => m.productionApproved === false), true);
  assert.equal(calls[0].url, 'https://open-api.podbase.com/catalog');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers['x-api-key'], key);
  assert.equal(client.create, undefined);
  assert.equal(client.summary().orderSubmissionEnabled, false);
  assert.equal(JSON.stringify(snapshot).includes(key), false);
});

test('Fehlende, umbenannte und ausverkaufte Varianten werden nicht still ersetzt', async () => {
  const products = fixture(), variants = products[0].variants;
  variants.find(v => v.id === model.variantId).inStock = false;
  const absent = PODBASE_MODEL_MAP.models[0], renamed = PODBASE_MODEL_MAP.models[1];
  products[0].variants = variants.filter(v => v.id !== absent.variantId);
  variants.find(v => v.id === renamed.variantId).name = 'Unrelated device';
  const client = new PodbaseCatalog({ apiKey: key }, { fetchImpl: async () => Response.json(products) });
  const snapshot = await client.snapshot();
  for (const m of [model, absent, renamed]) assert.equal(snapshot.models.find(v => v.modelId === m.modelId).inStock, false);
  assert.equal(snapshot.models.find(v => v.modelId === absent.modelId).matched, false);
});

test('Parallele Aufrufe teilen einen Abruf; Ablauf und erzwungener Checkout-Abgleich laden neu', async () => {
  let now = Date.now(), calls = 0;
  const client = new PodbaseCatalog({ apiKey: key }, { now: () => now, fetchImpl: async () => { calls++; return Response.json(fixture()); } });
  await Promise.all(Array.from({ length: 15 }, () => client.snapshot()));
  assert.equal(calls, 1);
  await client.snapshot(); assert.equal(calls, 1);
  await client.snapshot({ force: true }); assert.equal(calls, 2);
  now += 300001;
  await client.snapshot(); assert.equal(calls, 3);
});

test('Anbieterausfall, falsche Antwort und mehrdeutige IDs sperren Checkout ohne alten Bestand zu verwenden', async () => {
  for (const failure of ['http', 'network', 'invalid-json', 'duplicate']) {
    let now = Date.now(), fail = false, calls = 0;
    const client = new PodbaseCatalog({ apiKey: key }, { now: () => now, fetchImpl: async () => {
      calls++;
      if (!fail) return Response.json(fixture());
      if (failure === 'http') return new Response('Denied', { status: 403 });
      if (failure === 'network') throw new Error(key);
      if (failure === 'invalid-json') return new Response('The page cannot be found');
      const products = fixture(); products[0].variants.push(products[0].variants[0]); return Response.json(products);
    } });
    await client.snapshot(); fail = true; now += 300001;
    assert.equal(await client.snapshot(), null);
    await assert.rejects(client.snapshot({ force: true, strict: true }), e => e.status === 503 && !e.message.includes(key));
    assert.equal(calls, 2); assert.equal(client.summary().connected, false);
    fail = false; now += 30001;
    assert.ok(await client.snapshot({ strict: true }));
  }
});

test('Schlüssel und Ziel werden geprüft; Produktion kann nicht versehentlich aktiviert werden', () => {
  assert.throws(() => new PodbaseCatalog({ apiKey: '' }), /PODBASE_API_KEY/);
  assert.throws(() => new PodbaseCatalog({ apiKey: key, baseUrl: 'https://example.com' }), /HTTPS/);
  assert.throws(() => Shop.validateMode({ ...defaultConfig(), podbaseMode: 'live' }), /Produktionsaufträge/);
});

async function appFixture(t) {
  const app = await createApp({ ...defaultConfig(), shopMode: 'test', podbaseMode: 'catalog', podbaseKey: key, podbaseBaseUrl: 'https://open-api.podbase.com', mailMode: 'local', paymentMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Podbase-Test-2026!', autoShip: false, serverless: true });
  let products = fixture(), fail = false; const calls = [];
  app.shop.podbaseCatalog.fetch = async (url, options) => { calls.push({ url, method: options.method }); return fail ? new Response('Unavailable', { status: 503 }) : Response.json(products); };
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.server.close(resolve)));
  const base = `http://127.0.0.1:${app.server.address().port}`; let cookie = '', csrf = '';
  async function call(path, body) {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    const data = await res.json(); if (data.csrf) csrf = data.csrf;
    return { status: res.status, data };
  }
  return { ...app, call, calls, products, fail: () => { fail = true; } };
}

test('Shop-Kaufweg speichert echte Varianten-IDs, produziert jedoch ausschließlich lokal; Schlüssel bleibt privat', async t => {
  const { shop, call, calls } = await appFixture(t);
  const bootstrap = await call('/api/bootstrap');
  assert.equal(bootstrap.data.podbase.connected, true);
  assert.equal(bootstrap.data.podbase.availableModels, 74);
  assert.equal(JSON.stringify(bootstrap).includes(key), false);
  assert.equal((await call('/api/admin/podbase')).status, 403);
  assert.equal((await call('/api/health')).data.podbaseOrderSubmissionEnabled, false);
  const cart = await call('/api/cart', configuration);
  assert.equal(cart.status, 200); assert.equal(cart.data[0].variantId, model.variantId);
  const checkout = await call('/api/checkout', { recipient, method: 'card' }); assert.equal(checkout.status, 201);
  const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.data.orderId);
  assert.equal(JSON.parse(order.items)[0].variantId, model.variantId);
  await shop.acceptPayment({ id: 'fixture-paid', orderId: order.id, paymentId: order.payment_id, amount: order.amount, currency: 'EUR', completed: true });
  await shop.tick();
  assert.ok(shop.podbase instanceof LocalPodbase);
  const fulfillment = await shop.s.get('SELECT * FROM fulfillment WHERE order_id=?', order.id);
  assert.match(fulfillment.provider_id, /^SIM-PB-/);
  assert.ok(calls.length >= 2);
  assert.ok(calls.every(c => c.method === 'GET' && c.url.endsWith('/catalog')));
});

test('Bestandswechsel unmittelbar vor Checkout und Verbindungsfehler verhindern eine Zahlung', async t => {
  const { shop, call, products, fail } = await appFixture(t);
  await call('/api/bootstrap'); await call('/api/cart', configuration);
  products[0].variants.find(v => v.id === model.variantId).inStock = false;
  assert.equal((await call('/api/checkout', { recipient, method: 'card' })).status, 409);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
  products[0].variants.find(v => v.id === model.variantId).inStock = true;
  await shop.podbaseCatalog.snapshot({ force: true }); fail();
  assert.equal((await call('/api/checkout', { recipient, method: 'card' })).status, 503);
  const bootstrap = await call('/api/bootstrap');
  assert.equal(bootstrap.status, 200); assert.equal(bootstrap.data.podbase.connected, false);
  assert.ok(bootstrap.data.variants.every(v => v.available === 0));
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
});
