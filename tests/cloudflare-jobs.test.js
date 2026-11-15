import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { JobScheduler, pendingWork, mayQueueWork } from '../cloudflare/job-scheduler.js';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';

class Storage {
  values = new Map(); alarm = null;
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, value); }
  async getAlarm() { return this.alarm; }
  async setAlarm(value) { this.alarm = value; }
  async deleteAlarm() { this.alarm = null; }
}
async function fixture(t) {
  const config = { ...defaultConfig(), storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), serverless: true, autoShip: false, adminPassword: 'Job-fixture-admin-only!' };
  let shop = await Shop.create(config);
  t.after(() => shop.close());
  const { session } = await shop.createSession();
  await shop.saveCart(session, { kind: 'fixed', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm' });
  const checkout = await shop.checkout(session, { method: 'card', recipient: { name: 'Job Fixture', email: 'jobs@example.test', phone: '01721234567', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' } });
  const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
  await shop.acceptPayment({ id: 'job-' + order.id, orderId: order.id, paymentId: order.payment_id, completed: true, currency: 'EUR', amount: order.amount }, { flush: false });
  return { get shop() { return shop; }, order, async restart() { await shop.close(); shop = await Shop.create(config); return shop; } };
}
test('A paid job survives a new scheduler and server instance; repeated alarms do not duplicate production', async t => {
  const f = await fixture(t), storage = new Storage();
  await new JobScheduler(storage, async () => f.shop).arm('https://migration.example');
  const scheduled = storage.alarm;
  await new JobScheduler(storage, async () => f.shop).arm('https://migration.example');
  assert.equal(storage.alarm, scheduled, 'A later visit must not postpone pending work');
  await f.restart();
  const scheduler = new JobScheduler(storage, async () => f.shop);
  assert.equal((await scheduler.run()).processed, 1);
  assert.equal((await f.shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1);
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', f.order.id)).state, 'production');
  assert.equal(storage.alarm, null, 'Manual simulation must stop waking after submission');
  await scheduler.run();
  assert.equal((await f.shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1);
});
test('Restart reconciles a lost provider reply before considering another submission', async t => {
  const f = await fixture(t), storage = new Storage();
  f.shop.podbase.scenario = 'timeout'; await f.shop.tick({ orderId: f.order.id });
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'uncertain');
  await f.shop.s.run('UPDATE fulfillment SET updated=?', Date.now() - 301000);
  await f.restart();
  const scheduler = new JobScheduler(storage, async () => f.shop); await scheduler.arm('https://migration.example');
  await scheduler.run();
  assert.equal((await f.shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1);
  assert.equal((await f.shop.s.get('SELECT attempts FROM fulfillment')).attempts, 1);
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'production');
});
test('An active job lease is respected; tracking reconciliation stops after shipment', async t => {
  const f = await fixture(t), storage = new Storage(), lease = Date.now() + 120000;
  await f.shop.s.run('UPDATE fulfillment SET lease_until=?', lease);
  const scheduler = new JobScheduler(storage, async () => f.shop); await scheduler.arm('https://migration.example');
  assert.equal((await scheduler.run()).processed, 0); assert.equal(storage.alarm, lease + 1);
  await f.shop.s.run('UPDATE fulfillment SET lease_until=0'); await scheduler.run();
  f.shop.config.autoShip = true;
  await f.shop.s.run('UPDATE fulfillment SET updated=?', Date.now() - 1801000);
  await f.shop.s.run('UPDATE orders SET paid_at=?', Date.now() - 60000);
  await scheduler.run(); await scheduler.run();
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'shipped');
  assert.equal((await f.shop.s.get("SELECT COUNT(*) AS n FROM mail_outbox WHERE kind='shipping'")).n, 1);
  assert.equal(storage.alarm, null);
});
test('Mail retries honor their lease and retry time; terminal deliveries stop scheduling', async t => {
  const f = await fixture(t), now = Date.now();
  await f.shop.s.run("UPDATE fulfillment SET state='shipped'");
  const mail = await f.shop.s.get("SELECT id FROM mail_outbox WHERE kind='confirmation'");
  await f.shop.s.run("INSERT INTO mail_deliveries(mail_id,state,payload,next_attempt,lease_until,created) VALUES(?,'queued','{}',?,?,?)", mail.id, now + 60000, now + 120000, now);
  f.shop.mailer.enabled = true;
  assert.equal((await pendingWork(f.shop)).mailAt, now + 120001);
  await f.shop.s.run("UPDATE mail_deliveries SET state='held'");
  assert.equal((await pendingWork(f.shop)).nextAt, null);
  f.shop.config.podbaseSubmissionEnabled = false; f.shop.config.shopMode = 'live';
  await f.shop.s.run("UPDATE mail_deliveries SET state='queued'");
  assert.equal((await pendingWork(f.shop)).nextAt, null, 'Test orders cannot schedule live delivery');
});
test('Database outages retain a durable retry with backoff, including across scheduler instances', async () => {
  const storage = new Storage(), now = 1000000, failed = async () => { throw new Error('Unavailable'); };
  await new JobScheduler(storage, failed, () => now).arm('https://migration.example');
  const first = await new JobScheduler(storage, failed, () => now).run();
  const second = await new JobScheduler(storage, failed, () => now).run();
  assert.equal(first.retry, true); assert.equal(second.retry, true);
  assert.equal(first.nextAlarm, now + 60000); assert.equal(second.nextAlarm, now + 120000);
  assert.equal(storage.values.get('job-status').failures, 2);
});
test('Payment and email entry points arm recovery; ordinary preview and authentication do not', () => {
  const req = (path, method = 'POST') => new Request('https://migration.example' + path, { method });
  for (const path of ['/api/checkout', '/api/webhooks/stripe', '/api/webhooks/resend', '/api/newsletter/subscribe', '/api/withdrawals']) assert.equal(mayQueueWork(req(path)), true);
  assert.equal(mayQueueWork(req('/api/orders/fixture', 'GET')), true);
  for (const path of ['/api/preview', '/api/auth/login', '/api/cart']) assert.equal(mayQueueWork(req(path)), false);
});
