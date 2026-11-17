import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { productionConfig, SHOP_ORIGIN } from '../cloudflare/production-config.js';
import { productionFetch } from '../cloudflare/production-router.js';
import { createApp } from '../server/index.js';
import { Shop } from '../server/shop.js';
import { nodeHandlerResponse } from '../cloudflare/node-handler.js';
import { encryptBackup, decryptBackup } from '../scripts/shop-backup.mjs';

const env = {
  DATABASE_URL: 'postgresql://fixture', DATABASE_SCHEMA: 'public', CRON_SECRET: 'fixture-job-secret-with-at-least-32-characters',
  STRIPE_SECRET_KEY: 'rk_live_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  PODBASE_API_KEY: 'podbase_fixture', PODBASE_STORE_ID: 'PUS-AAA-BBB-CCCC',
  RESEND_API_KEY: 're_fixture', RESEND_WEBHOOK_SECRET: 'whsec_Zml4dHVyZQ==', MAIL_ENABLED_SINCE: '2026-11-10T16:18:00.988Z'
};

test('Production reuses existing accounts, defaults to closed sales and rejects staging data/placeholders', () => {
  const config = productionConfig(env); Shop.validateMode(config);
  assert.equal(config.existingStoreOnly, true); assert.equal(config.databaseSchema, 'public');
  assert.equal(config.adminPassword, undefined); assert.equal(config.isolatedPreview, undefined);
  assert.equal(config.checkoutEnabled, false); assert.equal(config.podbaseSubmissionEnabled, false);
  assert.equal(config.baseUrl, SHOP_ORIGIN); assert.equal(config.printBaseUrl, SHOP_ORIGIN);
  for (const patch of [{ DATABASE_SCHEMA: 'cf_preview_fixture' }, { DATABASE_URL: '[SENSITIVE]' }, { STRIPE_SECRET_KEY: '' }, { CHECKOUT_ENABLED: 'yes' }]) assert.throws(() => productionConfig({ ...env, ...patch }));
  assert.throws(() => Shop.validateMode(productionConfig({ ...env, STRIPE_SECRET_KEY: 'sk_test_fixture' })));
  assert.throws(() => Shop.validateMode(productionConfig({ ...env, CHECKOUT_ENABLED: 'true' })));
});

test('Production preserves raw webhooks, source IP and Bearer auth without a preview login', async () => {
  const raw = '{"note":"Änderung"}\n'; let called = false;
  const bindings = { SHOP: { idFromName: name => name, get: id => ({ fetch: async r => {
    called = true; assert.equal(id, 'archenlicht-production-v1');
    assert.equal(await r.text(), raw); assert.equal(r.headers.get('stripe-signature'), 'unchanged');
    assert.equal(r.headers.get('x-forwarded-for'), '192.0.2.1'); assert.equal(r.headers.get('authorization'), 'Bearer guest-token');
    return Response.json({ received: true });
  } }) } };
  const response = await productionFetch(new Request(SHOP_ORIGIN + '/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'stripe-signature': 'unchanged', 'cf-connecting-ip': '192.0.2.1', 'x-forwarded-for': 'forged', Authorization: 'Bearer guest-token' } }), bindings);
  assert.equal(response.status, 200); assert.equal(called, true); assert.equal(response.headers.get('www-authenticate'), null);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await productionFetch(new Request('https://unknown.workers.dev/api/health'), bindings)).status, 421);
});

test('Production keeps page-specific HTML, canonical URLs and asset caching', async () => {
  const paths = []; const bindings = { ASSETS: { fetch: async r => { paths.push(new URL(r.url).pathname); return new Response('fixture', { headers: { 'Content-Type': r.url.includes('.html') ? 'text/html' : 'application/javascript' } }); } } };
  const page = await productionFetch(new Request(SHOP_ORIGIN + '/kollektion/nach-dem-sturm'), bindings);
  assert.equal(paths[0], '/_pages/kollektion/nach-dem-sturm.html'); assert.equal(page.headers.get('x-robots-tag'), null);
  assert.equal(page.headers.get('cache-control'), 'no-cache'); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  await productionFetch(new Request(SHOP_ORIGIN + '/bundle/hoffnung/'), bindings); assert.equal(paths[1], '/_pages/bundle/hoffnung.html');
  await productionFetch(new Request(SHOP_ORIGIN + '/'), bindings); assert.equal(paths[2], '/_pages/home.html');
  const asset = await productionFetch(new Request(SHOP_ORIGIN + '/_app/app-HASH.js'), bindings); assert.match(asset.headers.get('cache-control'), /immutable/);
  const redirect = await productionFetch(new Request('https://archenlicht.de/kollektion?source=sonstige'), bindings);
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), SHOP_ORIGIN + '/kollektion?source=sonstige');
});

test('Public production webhooks still reject invalid signatures and jobs stay protected', async t => {
  const app = await createApp({ ...productionConfig(env), storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Fixture-only-password' });
  t.after(() => app.shop.close());
  const bindings = { SHOP: { idFromName: n => n, get: () => ({ fetch: request => nodeHandlerResponse(app.handler, request) }) } };
  for (const provider of ['stripe', 'resend']) {
    const r = await productionFetch(new Request(SHOP_ORIGIN + '/api/webhooks/' + provider, { method: 'POST', body: '{}' }), bindings);
    assert.equal(r.status, 401); assert.equal(r.headers.get('www-authenticate'), null);
  }
  assert.equal((await productionFetch(new Request(SHOP_ORIGIN + '/api/jobs'), bindings)).status, 403);
  const health = await (await productionFetch(new Request(SHOP_ORIGIN + '/api/health'), bindings)).json();
  assert.equal(health.checkoutEnabled, false); assert.equal(health.podbaseOrderSubmissionEnabled, false);
});

test('Backup encryption round-trips data and rejects tampering and a wrong key', () => {
  const key = randomBytes(32), snapshot = { format: 1, tables: [{ name: 'fixture', rows: [{ text: 'Äöü – unverändert' }] }] };
  const bytes = encryptBackup(snapshot, key);
  assert.deepEqual(decryptBackup(bytes, key), snapshot);
  assert.equal(bytes.includes(Buffer.from('unverändert')), false);
  assert.throws(() => decryptBackup(bytes, randomBytes(32)));
  bytes[bytes.length - 1] ^= 1; assert.throws(() => decryptBackup(bytes, key));
});
