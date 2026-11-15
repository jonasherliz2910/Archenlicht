import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { nodeHandlerResponse } from '../cloudflare/node-handler.js';
import { migrationConfig } from '../cloudflare/migration-config.js';
import { migrationAccess } from '../cloudflare/migration-access.js';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';

test('Migration uses isolated data and simulated services even when live settings are supplied', () => {
  const env = { DATABASE_URL: 'postgresql://fixture', DATABASE_SCHEMA: 'cf_preview_fixture', ADMIN_PASSWORD: 'Test-only-admin-password', MIGRATION_ACCESS_PASSWORD: 'Test-only-migration-access-password', SHOP_MODE: 'live', PAYMENT_MODE: 'live', PODBASE_SUBMISSION_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_live_fixture' };
  const config = migrationConfig(env, 'https://migration.example');
  assert.equal(config.shopMode, 'test'); assert.equal(config.paymentMode, 'local');
  assert.equal(config.isolatedPreview, true);
  assert.equal(config.podbaseMode, 'local'); assert.equal(config.mailMode, 'local');
  assert.equal(config.podbaseSubmissionEnabled, false); assert.equal(config.stripeKey, undefined);
  assert.throws(() => migrationConfig({ ...env, DATABASE_SCHEMA: 'public' }, 'https://migration.example'));
  assert.throws(() => migrationConfig({ ...env, MIGRATION_ACCESS_PASSWORD: '' }, 'https://migration.example'));
});

test('Staging login cookie expires, rejects tampering and allows shop Bearer capabilities', () => {
  const password = 'Test-only-migration-access-password', now = 1794760000;
  const request = headers => new Request('https://migration.example/', { headers });
  assert.equal(migrationAccess(request({}), password, now).authorized, false);
  const auth = migrationAccess(request({ Authorization: 'Basic ' + Buffer.from('preview:' + password).toString('base64') }), password, now);
  assert.equal(auth.authorized, true); assert.match(auth.cookie, /Secure; HttpOnly; SameSite=Strict/);
  const cookie = auth.cookie.split(';')[0];
  assert.equal(migrationAccess(request({ Cookie: cookie, Authorization: 'Bearer guest-capability' }), password, now + 1).authorized, true);
  assert.equal(migrationAccess(request({ Cookie: cookie }), password, now + 7200).authorized, false);
  assert.equal(migrationAccess(request({ Cookie: cookie + 'x' }), password, now + 1).authorized, false);
  assert.equal(migrationAccess(request({ Cookie: cookie }), password + 'rotated', now + 1).authorized, false);
});

test('Fetch adapter preserves raw bytes, response headers and HEAD behavior', async () => {
  const body = '{"id":"evt_fixture", "value":"Ä"}\n';
  const response = await nodeHandlerResponse(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), body);
    assert.equal(req.headers['stripe-signature'], 'fixture-signature');
    res.setHeader('Set-Cookie', ['one=1; HttpOnly', 'two=2; Secure']);
    res.writeHead(202, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  }, new Request('https://migration.example/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'fixture-signature' }, body }));
  assert.equal(response.status, 202); assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(await response.json(), { ok: true });
  const head = await nodeHandlerResponse((_req, res) => { res.writeHead(200); res.end('body'); }, new Request('https://migration.example/', { method: 'HEAD' }));
  assert.equal(await head.text(), '');
});

test('Existing session, CSRF, registration, cart and print routes work through Fetch adapter', async t => {
  const base = 'https://migration.example';
  const app = await createApp({ ...defaultConfig(), dataDir: resolve('test-results', randomUUID()), storageMode: 'sqlite', baseUrl: base, serverless: true, adminPassword: 'Test-only-admin-password', printRenderer: 'resvg-fixture-v1' });
  t.after(() => app.shop.close());
  let cookie = '', csrf = '';
  const call = async (path, method = 'GET', body, extra = {}) => {
    const headers = { Cookie: cookie, Origin: base, ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }), ...extra };
    const response = await nodeHandlerResponse(app.handler, new Request(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
    if (data?.csrf) csrf = data.csrf;
    return { status: response.status, data };
  };
  assert.equal((await call('/api/bootstrap')).status, 200);
  assert.equal((await call('/api/auth/register', 'POST', { email: 'migration-fixture@example.test', password: 'Fixture-customer-password!' })).status, 200);
  const input = { kind: 'custom', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue', magsafe: true, customText: 'Ein unveränderter Testtext.' };
  assert.equal((await call('/api/cart', 'POST', input, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await call('/api/cart', 'POST', input, { 'X-CSRF-Token': 'wrong' })).status, 403);
  const cart = await call('/api/cart', 'POST', input);
  assert.equal(cart.status, 200); assert.equal(cart.data.length, 1);
  assert.equal(cart.data[0].configuration.printRenderer, 'resvg-fixture-v1');
  assert.equal(cart.data[0].configuration.customText, input.customText);
  const originalHash = cart.data[0].hash;
  app.shop.config.printRenderer = 'resvg-fixture-v2';
  assert.notEqual((await app.shop.preview(input)).hash, originalHash);
  app.shop.config.printRenderer = 'resvg-fixture-v1';
  assert.equal((await app.shop.preview(input)).hash, originalHash);
  assert.equal((await call(cart.data[0].svgUrl)).status, 200);
  assert.equal((await call('/api/jobs')).status, 403);
  assert.equal((await call('/api/auth/logout', 'POST', {})).status, 200);
});

test('Renderer migration preserves stored PNGs and refuses to regenerate legacy print hashes', async () => {
  const bytes = Buffer.from('immutable-existing-print');
  let cached = { content: bytes.toString('base64') };
  const shop = Object.assign(Object.create(Shop.prototype), {
    config: { printRenderer: 'resvg-fixture-v1' },
    s: { remote: true, get: async sql => sql.includes('FROM assets') ? { svg: '<svg/>', configuration: '{}' } : cached,
      run: async () => assert.fail('Existing print must not be rewritten') }
  });
  assert.deepEqual(await shop.printFile('legacy-hash', 'png'), bytes);
  cached = null;
  await assert.rejects(() => shop.printFile('legacy-hash', 'png'), error => error.status === 409);
  assert.equal(await shop.printFile('legacy-hash', 'svg'), '<svg/>');
});
