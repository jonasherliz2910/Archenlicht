import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { buildCloudflareShop } from './build-cloudflare-shop.mjs';

// Use the exact workerd/Miniflare version pinned by Wrangler. No extra install.
const require = createRequire(import.meta.url), wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const env = parseEnv(await readFile('cloudflare/.dev.vars', 'utf8'));
assert.match(env.DATABASE_SCHEMA, /^cf_preview_[a-z0-9_]+$/);
const schema = 'cf_preview_providers_' + randomBytes(8).toString('hex');
const dir = resolve('test-results/cloudflare-providers'); await mkdir(dir, { recursive: true });
const out = await buildCloudflareShop({ providerFixture: true });
const mf = new Miniflare(convertV4MiniflareOptions({
  name: 'local-provider-fixture', compatibilityDate: '2026-11-15', compatibilityFlags: ['nodejs_compat'],
  modules: [{ type: 'ESModule', path: resolve(out, 'worker/worker.js'), contents: await readFile(resolve(out, 'worker/worker.js'), 'utf8') },
    { type: 'CompiledWasm', path: resolve(out, 'worker/resvg.wasm'), contents: await readFile(resolve(out, 'worker/resvg.wasm')) }],
  bindings: { DATABASE_URL: env.DATABASE_URL, DATABASE_SCHEMA: schema },
  durableObjects: { SHOP: { className: 'ProviderFixture', useSQLite: true } },
  serviceBindings: { ASSETS: async request => {
    const path = new URL(request.url).pathname;
    assert.match(path, /^\/_motifs\/[a-z-]+\.png$/);
    return new Response(await readFile(resolve(out, 'public', path.slice(1))), { headers: { 'Content-Type': 'image/png' } });
  } },
  cf: false
}));
const report = { checkedAt: new Date().toISOString(), runtime: 'local Cloudflare workerd / Durable Object / real isolated Neon', providers: 'network-blocked fixtures', checks: [] };
async function call(path, options = {}) {
  const response = await mf.dispatchFetch('https://fixture.invalid' + path, options);
  const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { data = raw.slice(0, 500); }
  return { status: response.status, data };
}
async function scenario(input) { assert.equal((await call('/__fixture/scenario', { method: 'POST', body: JSON.stringify(input) })).status, 200); }
const state = async () => { const r = await call('/__fixture/state'); assert.equal(r.status, 200); return r.data; };
async function stripeHook({ secret = 'whsec_stripe_fixture', age = 0, tamper = false, livemode = true, id = 'evt_fixture' } = {}) {
  const raw = JSON.stringify({ id, type: 'checkout.session.completed', livemode, note: 'Änderung – äöü', data: { object: { id: 'cs_live_fixture1' } } }, null, 2) + '\n';
  const t = Math.floor(Date.now() / 1000) - age;
  const signature = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return call('/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${signature}` }, body: raw + (tamper ? ' ' : '') });
}
async function resendHook({ type = 'email.delivered', id = 'msg_fixture', age = 0, tamper = false } = {}) {
  const raw = JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: 'email-fixture-0' } });
  const t = Math.floor(Date.now() / 1000) - age;
  const signature = createHmac('sha256', Buffer.from('fixture')).update(`${id}.${t}.${raw}`).digest('base64');
  return call('/api/webhooks/resend', { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': String(t), 'svix-signature': `v1,${signature}` }, body: raw + (tamper ? ' ' : '') });
}
try {
  const prepared = await call('/__fixture/prepare', { method: 'POST' }); assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
  let s = await state(); const amount = s.orders[0].amount;
  assert.equal(s.provider.sessions[0].amount_total, amount); assert.equal(s.provider.sessions[0].automatic_tax.enabled, false);
  for (const options of [{ secret: 'wrong' }, { age: 601 }, { tamper: true }]) assert.equal((await stripeHook(options)).status, 401);
  assert.equal((await stripeHook({ livemode: false })).status, 400);
  assert.equal((await stripeHook()).data.pending, true);
  s = await state(); assert.equal(s.orders[0].paid_at, null); assert.equal(s.provider.orders.length, 0); assert.equal(s.provider.mails.length, 0);
  report.checks.push('Stripe SDK checkout, raw UTF-8 signature, stale/tampered/wrong-mode/unpaid rejection');
  await scenario({ session: { status: 'complete', payment_status: 'paid', amount_total: 1 } });
  assert.equal((await stripeHook()).status, 409);
  await scenario({ session: { amount_total: amount } });
  assert.equal((await stripeHook()).status, 200);
  s = await state(); assert.equal(s.jobs[0].state, 'uncertain'); assert.equal(s.provider.orders.length, 1); assert.equal(s.provider.mails.length, 2);
  assert.equal(s.deliveries.filter(d => d.kind === 'fulfillment-error').length, 1, 'Uncertain production triggers one operations alert');
  assert.equal(s.deliveries[0].state, 'queued');
  report.checks.push('Payment amount checked; accepted-but-lost Podbase and Resend replies persisted for recovery');
  assert.equal((await call('/__fixture/alarm', { method: 'POST' })).status, 200);
  s = await state(); assert.equal(s.jobs[0].state, 'awaiting_approval'); assert.equal(s.jobs[0].attempts, 1); assert.equal(s.deliveries[0].state, 'accepted');
  assert.equal((await stripeHook()).status, 200); assert.equal((await stripeHook({ id: 'evt_fixture_second' })).status, 200);
  s = await state();
  assert.equal(s.provider.calls.filter(c => c.origin === 'https://open-api.podbase.com' && c.method === 'POST').length, 1);
  assert.equal(s.provider.mails.length, 2); assert.equal(s.deliveries[0].attempts, 2);
  const item = s.provider.orders[0].items[0], snapshot = JSON.parse(s.orders[0].items)[0];
  assert.equal(item.variantId, 'PBV-37-2QE-224U'); assert.equal(item.printFile, `https://www.archenlicht.de/prints/${snapshot.hash}.png`);
  assert.equal(snapshot.configuration.customText, 'Auch im Sturm bist du geborgen.'); assert.equal(snapshot.configuration.backgroundId, 'light-blue');
  report.checks.push('Durable alarm reconciles without second production POST; mail retries keep identical idempotency key; MagSafe/design/color retained');
  for (const options of [{ age: 601 }, { tamper: true }]) assert.equal((await resendHook(options)).status, 401);
  assert.equal((await resendHook()).status, 200); assert.equal((await resendHook()).status, 200);
  s = await state(); assert.equal(s.deliveries[0].state, 'delivered'); assert.equal(s.events, 1);
  report.checks.push('Resend Svix signatures and delivery callbacks, duplicate protection');
  await scenario({ order: { status: 'FULFILLED' } }); await call('/__fixture/alarm', { method: 'POST' });
  s = await state(); assert.equal(s.provider.mails.length, 2);
  await scenario({ order: { trackingNumber: 'TRACKING-FIXTURE', trackingUrl: 'https://tracking.example.test/fixture' } });
  await call('/__fixture/alarm', { method: 'POST' }); await call('/__fixture/alarm', { method: 'POST' });
  s = await state(); assert.equal(s.orders[0].status, 'shipped'); assert.equal(s.provider.mails.length, 3);
  assert.match(JSON.parse(s.provider.mails[2].payload).text, /TRACKING-FIXTURE/);
  report.checks.push('Shipping email only with tracking; repeated alarms do not duplicate mail');
  const result = await call('/__fixture/alarm', { method: 'POST' }); assert.equal(result.data.nextAlarm, null);
  report.checks.push('No remaining jobs: durable alarm stops');
  report.passed = true;
} finally {
  await mf.dispose();
  // This schema was generated above, is never public and never holds real users.
  assert.match(schema, /^cf_preview_providers_[a-f0-9]{16}$/);
  await neon(env.DATABASE_URL).query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  report.disposableSchemaRemoved = true;
  await writeFile(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
