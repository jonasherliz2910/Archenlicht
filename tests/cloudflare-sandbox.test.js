import test from 'node:test';
import assert from 'node:assert/strict';
import { sandboxConfig, SANDBOX_ORIGIN } from '../cloudflare/sandbox-config.js';
import { sandboxFetch } from '../cloudflare/sandbox-router.js';
import { Shop } from '../server/shop.js';
import { Mailer } from '../server/mail.js';

const env = { DATABASE_URL: 'postgresql://fixture', DATABASE_SCHEMA: 'cf_preview_sandbox_fixture', ADMIN_PASSWORD: 'Test-admin-password',
  MIGRATION_ACCESS_PASSWORD: 'Test-only-acceptance-password', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture' };

test('Acceptance cannot use live credentials, production data or a real print provider', () => {
  const config = sandboxConfig(env);
  Shop.validateMode(config);
  assert.equal(config.paymentMode, 'sandbox'); assert.equal(config.shopMode, 'test');
  assert.equal(config.mailMode, 'local'); assert.equal(config.podbaseMode, 'local');
  assert.equal(config.podbaseSubmissionEnabled, false); assert.equal(config.baseUrl, SANDBOX_ORIGIN);
  for (const invalid of [{ STRIPE_SECRET_KEY: 'sk_live_fixture' }, { DATABASE_SCHEMA: 'public' }, { DATABASE_SCHEMA: 'cf_preview_existing' }, { PODBASE_API_KEY: 'real-key' }, { PODBASE_SUBMISSION_ENABLED: 'true' }]) {
    assert.throws(() => sandboxConfig({ ...env, ...invalid }));
  }
  const mail = sandboxConfig({ ...env, SANDBOX_MAIL_ENABLED: 'true', RESEND_API_KEY: 're_fixture', RESEND_WEBHOOK_SECRET: 'whsec_fixture', MAIL_ENABLED_SINCE: '2026-11-16T18:00:00Z' });
  Shop.validateMode(mail); assert.equal(mail.mailMode, 'resend-test');
  assert.deepEqual(mail.mailTestRecipients, ['info@archenlicht.de']);
  assert.throws(() => Mailer.validate({ ...mail, mailPublicUrl: 'https://untrusted.example' }));
  assert.throws(() => Mailer.validate({ ...mail, shopMode: 'live', mailMode: 'resend' }));
  assert.throws(() => Mailer.validate({ ...mail, isolatedPreview: false }));
});

test('Only Stripe POST webhooks bypass the password and retain their raw signature/body', async () => {
  let calls = 0;
  const raw = '{"note":"Ä – unchanged"}\n';
  const bindings = { ...env, SHOP: { idFromName: x => x, get: () => ({ fetch: async request => {
    calls++; assert.equal(await request.text(), raw); assert.equal(request.headers.get('stripe-signature'), 'original');
    assert.equal(request.headers.get('x-forwarded-for'), 'unknown');
    return Response.json({ error: 'signature rejected' }, { status: 401 });
  } }) }, ASSETS: { fetch: async () => assert.fail('No assets without access') } };
  for (const [path, method] of [['/api/bootstrap','GET'], ['/api/checkout','POST'], ['/api/webhooks/resend','POST'], ['/api/webhooks/stripe','GET'], ['/api/webhooks/stripe/','POST'], ['/','GET']]) {
    assert.equal((await sandboxFetch(new Request(SANDBOX_ORIGIN + path, { method }), bindings)).status, 401);
  }
  assert.equal(calls, 0);
  const response = await sandboxFetch(new Request(SANDBOX_ORIGIN + '/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'original', 'x-forwarded-for': 'forged' }, body: raw }), bindings);
  assert.equal(response.status, 401); assert.equal(calls, 1);
  assert.equal((await sandboxFetch(new Request('https://www.archenlicht.de/api/webhooks/stripe', { method: 'POST' }), bindings)).status, 421);
  const returned = await sandboxFetch(new Request(SANDBOX_ORIGIN + '/zahlungsrueckkehr/00000000-0000-0000-0000-000000000000'), bindings);
  assert.equal(returned.status, 200); assert.equal(calls, 1);
  assert.match(await returned.text(), /separat geprüft/);
});
