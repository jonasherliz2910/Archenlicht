import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ShopRequestQueue } from '../cloudflare/shop-request-queue.js';
import { createApp, defaultConfig } from '../server/index.js';
import { nodeHandlerResponse } from '../cloudflare/node-handler.js';
import { JobScheduler } from '../cloudflare/job-scheduler.js';

for (const entry of ['request', 'alarm']) test(`A provider can fetch the saved PNG synchronously during a ${entry}`, async t => {
  const app = await createApp({ ...defaultConfig(), storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), serverless: true, autoShip: false, adminPassword: 'Fixture-only-password' });
  t.after(() => app.shop.close());
  const queue = new ShopRequestQueue();
  const fetchPrint = request => queue.fetch(request, () => nodeHandlerResponse(app.handler, request));
  const { session } = await app.shop.createSession();
  await app.shop.saveCart(session, { kind: 'fixed', modelId: 'iphone-16-pro-max', designId: 'im-schatten', backgroundId: 'beige' });
  const checkout = await app.shop.checkout(session, { method: 'card', recipient: { name: 'Callback Fixture', email: 'callback@example.test', phone: '01721234567', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' } });
  const order = await app.shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
  await app.shop.acceptPayment({ id: 'callback-' + order.id, orderId: order.id, paymentId: order.payment_id, completed: true, currency: 'EUR', amount: order.amount }, { flush: false });
  let creates = 0, downloads = 0;
  const originalCreate = app.shop.podbase.create.bind(app.shop.podbase);
  app.shop.podbase.create = async payload => {
    creates++;
    for (const item of payload.items) {
      // Mirrors a provider awaiting download during POST /orders, before it
      // stores the order or returns. The old single queue deadlocks here.
      const response = await fetchPrint(new Request(item.printFile));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      const png = Buffer.from(await response.arrayBuffer());
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      downloads++;
    }
    return originalCreate(payload);
  };
  let timer;
  const storage = { values: new Map(), next: null, async get(key) { return this.values.get(key); }, async put(key, value) { this.values.set(key, value); }, async getAlarm() { return this.next; }, async setAlarm(next) { this.next = next; }, async deleteAlarm() { this.next = null; } };
  const scheduler = new JobScheduler(storage, async () => app.shop);
  await scheduler.arm('https://shop.example');
  try {
    await Promise.race([
      entry === 'alarm' ? queue.serial(() => scheduler.run()) : queue.fetch(new Request('https://shop.example/api/webhooks/stripe', { method: 'POST' }), () => app.shop.tick({ orderId: order.id })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Provider print callback deadlocked')), 8000); })
    ]);
  } finally { clearTimeout(timer); }
  assert.equal((await app.shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', order.id)).state, 'production');
  await queue.serial(() => app.shop.tick({ orderId: order.id }));
  assert.equal(creates, 1); assert.equal(downloads, 1);
  assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1);
});

test('Only exact immutable GET/HEAD print paths bypass active business work', async () => {
  const queue = new ShopRequestQueue();
  let release;
  const business = queue.serial(() => new Promise(resolve => { release = resolve; }));
  await Promise.resolve();
  const hash = 'a'.repeat(64), completed = [];
  const requests = [
    ['GET', '/api/health'], ['POST', `/prints/${hash}.png`], ['GET', '/prints/other'],
    ['GET', `/prints/${hash}.png/extra`], ['GET', `/prints/${hash}.png`], ['HEAD', `/prints/${hash}.preview.svg`]
  ].map(([method, path], i) => queue.fetch(new Request('https://shop.example' + path, { method }), () => { completed.push(i); }));
  await Promise.resolve();
  assert.deepEqual(completed, [4, 5]);
  release(); await business; await Promise.all(requests);
  assert.deepEqual(completed, [4, 5, 0, 1, 2, 3]);
});
