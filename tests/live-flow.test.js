import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';
import { PODBASE_MODEL_MAP } from '../server/podbase-catalog.js';
import { PODBASE_MAGSAFE_MAP } from '../server/case-variants.js';
import { TAX_TREATMENT } from '../server/payments.js';
import { orderEmail } from '../server/mail-templates.js';
import { neon } from '@neondatabase/serverless';

const recipient = { name: 'Fixture Kunde', email: 'fixture@example.test', phone: '01721234567', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' };
const design = { kind: 'custom', designId: 'nach-dem-sturm', modelId: 'iphone-14-pro', backgroundId: 'light-blue', magsafe: true, customText: 'Auch im Sturm bist du geborgen.' };
const settings = () => ({ ...defaultConfig(), legalContactReady: true, dataDir: resolve('test-results', randomUUID()), storageMode: 'sqlite', serverless: true, shopMode: 'live', paymentMode: 'live', stripeKey: 'rk_live_fixture', stripeWebhook: 'whsec_livefixture', baseUrl: 'https://www.archenlicht.de', printBaseUrl: 'https://www.archenlicht.de', podbaseMode: 'production', podbaseKey: 'podbase_fixture', podbaseStoreId: 'PUS-AAA-BBB-CCCC', podbaseSubmissionEnabled: true, printMode: 'podbase', checkoutEnabled: true, autoShip: true, mailMode: 'resend', resendKey: 're_fixture', resendWebhook: 'whsec_Zml4dHVyZQ==', mailPublicUrl: 'https://www.archenlicht.de', mailEnabledSince: new Date(Date.now() - 1000).toISOString(), adminPassword: 'Fixture-Only-Password!' });
const variants = models => [...new Map(models.map(m => [m.variantId, { id: m.variantId, name: m.catalogName, inStock: true }])).values()];
const products = () => [{ id: PODBASE_MODEL_MAP.productId, variants: variants(PODBASE_MODEL_MAP.models) }, ...PODBASE_MAGSAFE_MAP.products.map(p => ({ id: p.productId, title: p.productName, variants: variants(p.models) }))];

async function fixture(t, overrides = {}) {
  const originalFetch = globalThis.fetch, calls = [], stripe = new Map(), remote = new Map();
  let failAfterCreate = false;
  const config = { ...settings(), ...overrides };
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, options);
    if (config.storageMode === 'postgres' && [new URL(config.databaseUrl).hostname, 'api.c-7.eu-central-1.aws.neon.tech'].includes(new URL(url).hostname)) return originalFetch(url, options);
    const u = new URL(url), method = options.method || 'GET', params = new URLSearchParams(options.body);
    calls.push({ url: String(url), method, body: options.body });
    if (u.origin === 'https://api.stripe.com' && u.pathname === '/v1/checkout/sessions' && method === 'POST') {
      const id = 'cs_live_' + (stripe.size + 1), orderId = params.get('client_reference_id');
      const session = { id, url: 'https://checkout.stripe.com/c/pay/' + id, client_reference_id: orderId, amount_total: Number(params.get('line_items[0][price_data][unit_amount]')), currency: 'eur', mode: 'payment', livemode: true, status: 'open', payment_status: 'unpaid', metadata: { order_id: orderId, tax_treatment: TAX_TREATMENT }, automatic_tax: { enabled: false }, total_details: { amount_tax: 0 }, payment_intent: 'pi_fixture' };
      stripe.set(id, session); return Response.json(session);
    }
    if (u.origin === 'https://api.stripe.com' && method === 'GET' && stripe.has(u.pathname.split('/').at(-1))) return Response.json(stripe.get(u.pathname.split('/').at(-1)));
    if (u.origin === 'https://open-api.podbase.com') {
      if (u.pathname === '/catalog') return Response.json(products());
      if (u.pathname === '/orders' && method === 'GET') return Response.json({ orders: [...remote.values()], pagination: { page: 0, hasNextPage: false } });
      if (u.pathname === '/orders' && method === 'POST') {
        const payload = JSON.parse(options.body), record = { orderId: 'provider-' + remote.size, externalOrderId: config.podbaseStoreId + '-' + payload.externalOrderId, status: 'UNAPPROVED' };
        remote.set(record.orderId, record);
        if (failAfterCreate) throw new Error('Response lost after provider accepted order');
        return Response.json(record);
      }
      if (remote.has(u.pathname.split('/').at(-1))) return Response.json(remote.get(u.pathname.split('/').at(-1)));
    }
    if (url === 'https://api.resend.com/emails') return Response.json({ id: 'mail-' + calls.length });
    throw new Error('Unexpected network request in isolated fixture: ' + u.origin + u.pathname);
  };
  const app = await createApp(config);
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => app.server.close(r)); globalThis.fetch = originalFetch; });
  const { shop } = app, { session } = await shop.createSession();
  await shop.s.run("UPDATE variants SET approval_mode='live' WHERE model_id=? AND design_id=?", design.modelId, design.designId);
  const hook = async (id, type = 'checkout.session.completed', live = true) => {
    const raw = JSON.stringify({ id: 'evt_' + id, type, livemode: live, data: { object: { id } } }), time = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', config.stripeWebhook).update(`${time}.${raw}`).digest('hex');
    return fetch(`http://127.0.0.1:${app.server.address().port}/api/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': `t=${time},v1=${signature}` }, body: raw });
  };
  const order = async () => {
    await shop.saveCart(session, design);
    const checkout = await shop.checkout(session, { recipient, method: 'stripe' });
    return shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
  };
  return { ...app, config, session, calls, stripe, remote, hook, order, loseCreateResponse() { failAfterCreate = true; } };
}

test('Livekauf: signierte Zahlung, exakt eine MagSafe-Übergabe, manuelle Freigabe und Versandmail erst mit echtem Tracking', async t => {
  const f = await fixture(t), order = await f.order(), checkout = f.stripe.get(order.payment_id);
  assert.equal(order.mode, 'live'); assert.equal(order.amount, 4499);
  assert.equal((await f.hook(order.payment_id)).status, 200);
  assert.equal(f.remote.size, 0); // unpaid completion-shaped event has no effect
  Object.assign(checkout, { status: 'complete', payment_status: 'paid' });
  assert.equal((await f.hook(order.payment_id, undefined, false)).status, 400);
  assert.equal((await f.hook(order.payment_id)).status, 200);
  assert.equal((await f.hook(order.payment_id)).status, 200);
  assert.equal(f.remote.size, 1);
  const sent = f.calls.filter(c => c.url === 'https://open-api.podbase.com/orders' && c.method === 'POST');
  assert.equal(sent.length, 1);
  const payload = JSON.parse(sent[0].body), item = JSON.parse(order.items)[0];
  assert.equal(payload.items[0].variantId, 'PBV-37-2QE-224U');
  assert.equal(payload.items[0].printFile, `https://www.archenlicht.de/prints/${item.hash}.png`);
  assert.equal(item.configuration.customText, design.customText); assert.equal(item.configuration.backgroundId, 'light-blue');
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', order.id)).state, 'awaiting_approval');
  let mails = f.calls.filter(c => c.url === 'https://api.resend.com/emails');
  assert.equal(mails.length, 1); assert.doesNotMatch(JSON.parse(mails[0].body).text, /TESTBETRIEB|simuliert|Testbestellung/);
  await f.shop.tick(); assert.equal(f.remote.values().next().value.status, 'UNAPPROVED'); // autoShip never applies to live
  const provider = f.remote.values().next().value;
  provider.status = 'APPROVED'; await f.shop.tick();
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'production');
  provider.status = 'FULFILLED'; await f.shop.tick();
  assert.equal(f.calls.filter(c => c.url === 'https://api.resend.com/emails').length, 1);
  provider.trackingNumber = 'TRACKING-FIXTURE'; provider.trackingUrl = 'https://tracking.example.test/fixture';
  await f.shop.tick(); await f.shop.tick();
  assert.equal((await f.shop.s.get('SELECT status FROM orders WHERE id=?', order.id)).status, 'shipped');
  mails = f.calls.filter(c => c.url === 'https://api.resend.com/emails'); assert.equal(mails.length, 2);
  assert.match(JSON.parse(mails[1].body).text, /TRACKING-FIXTURE/);
  assert.doesNotMatch(JSON.parse(mails[1].body).html, /Testbetrieb|simuliert/);
});

test('Geschlossener Livecheckout und Testdaten können weder Zahlung noch Produktion auslösen', async t => {
  const f = await fixture(t, { checkoutEnabled: false, podbaseSubmissionEnabled: false });
  await assert.rejects(f.shop.checkout(f.session, { recipient, method: 'stripe' }), e => e.status === 503);
  assert.equal(f.calls.length, 0);
  const oldShop = await Shop.create({ ...f.config, shopMode: 'test', paymentMode: 'local', podbaseMode: 'local', mailMode: 'resend-test', mailTestRecipients: [recipient.email], checkoutEnabled: true });
  t.after(() => oldShop.close()); oldShop.mailer.safeFlush = async () => {};
  const { session } = await oldShop.createSession();
  await oldShop.saveCart(session, { ...design, modelId: 'iphone-15', magsafe: false });
  const created = await oldShop.checkout(session, { recipient, method: 'card' }), oldOrder = await oldShop.s.get('SELECT * FROM orders WHERE id=?', created.orderId);
  const event = { id: 'paid_old', orderId: oldOrder.id, paymentId: oldOrder.payment_id, amount: oldOrder.amount, currency: 'EUR', completed: true };
  await oldShop.acceptPayment(event);
  f.config.podbaseSubmissionEnabled = true; // isolation holds even if the worker is active
  await assert.rejects(f.shop.acceptPayment(event), /Zahlungsumgebung/);
  await f.shop.tick(); await f.shop.mailer.flush();
  assert.equal(f.calls.length, 0);
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'ready');
  assert.equal((await f.shop.s.get('SELECT state FROM mail_deliveries')).state, 'queued');
});

test('Livezahlung mit falschem Betrag bleibt unbestätigt; verlorene Podbase-Antwort wird ohne zweites POST abgeglichen', async t => {
  const f = await fixture(t), order = await f.order(), session = f.stripe.get(order.payment_id);
  Object.assign(session, { status: 'complete', payment_status: 'paid', amount_total: 1 });
  assert.equal((await f.hook(order.payment_id)).status, 409); assert.equal(f.remote.size, 0);
  session.amount_total = order.amount; f.loseCreateResponse();
  assert.equal((await f.hook(order.payment_id)).status, 200);
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'uncertain');
  await f.shop.tick();
  assert.equal((await f.shop.s.get('SELECT state FROM fulfillment')).state, 'awaiting_approval');
  assert.equal(f.calls.filter(c => c.url === 'https://open-api.podbase.com/orders' && c.method === 'POST').length, 1);
});

test('Startkonfiguration lehnt vermischte Schlüssel, Testadapter und offene Kasse ohne Übergabe ab', () => {
  const config = settings(); assert.doesNotThrow(() => Shop.validateMode(config));
  for (const change of [{ stripeKey: 'rk_test_fixture' }, { stripeWebhook: '' }, { shopMode: 'test' }, { paymentMode: 'sandbox' }, { podbaseMode: 'local' }, { podbaseSubmissionEnabled: false }, { printMode: 'preview' }, { mailMode: 'resend-test' }, { baseUrl: 'http://localhost:3000' }]) assert.throws(() => Shop.validateMode({ ...config, ...change }));
  const mail = orderEmail({ order: { mode: 'live', number: 'AL-FIXTURE', amount: 3999, recipient: JSON.stringify(recipient), items: '[]' }, kind: 'fulfillment-error', statusUrl: 'https://www.archenlicht.de/bestellung/fixture', reason: 'Manuelle Klärung' });
  assert.deepEqual(mail.to, ['info@archenlicht.de']); assert.doesNotMatch(mail.text, /simuliert|Testbetrieb/);
});

test('NeonLive: Zahlungsbestätigung und unfreigegebener Auftrag überstehen neue Serverinstanz', { skip: process.env.RUN_LIVE_POSTGRES_TESTS !== '1' }, async t => {
  assert.ok(process.env.DATABASE_URL);
  const schema = 'archenlicht_live_check_' + randomUUID().replaceAll('-', '');
  let restarted;
  t.after(async () => {
    await restarted?.close();
    assert.match(schema, /^archenlicht_live_check_[a-f0-9]{32}$/);
    await neon(process.env.DATABASE_URL).query(`DROP SCHEMA "${schema}" CASCADE`);
  });
  const f = await fixture(t, { storageMode: 'postgres', databaseUrl: process.env.DATABASE_URL, databaseSchema: schema });
  const order = await f.order();
  Object.assign(f.stripe.get(order.payment_id), { status: 'complete', payment_status: 'paid' });
  assert.equal((await f.hook(order.payment_id)).status, 200);
  restarted = await Shop.create(f.config);
  await restarted.tick();
  const persisted = await restarted.s.get('SELECT * FROM orders WHERE id=?', order.id);
  assert.equal(persisted.mode, 'live'); assert.ok(persisted.paid_at);
  assert.equal((await restarted.s.get('SELECT state FROM fulfillment WHERE order_id=?', order.id)).state, 'awaiting_approval');
  assert.equal(f.calls.filter(c => c.url === 'https://open-api.podbase.com/orders' && c.method === 'POST').length, 1);
  assert.equal(f.calls.filter(c => c.url === 'https://api.resend.com/emails').length, 1);
});
