import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { Payments, TAX_TREATMENT, STRIPE_API_VERSION } from '../server/payments.js';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';

test('Karte und PayPal verwenden ausschließlich Stripe Checkout mit serverseitigen Positionen und Idempotenz', async t => {
  const original = globalThis.fetch, requests = [];
  globalThis.fetch = async (url, options) => { if (String(url).startsWith('https://api.stripe.com/')) options = { ...options, body: new URLSearchParams(options.body) }; requests.push({ url, options }); return Response.json({ livemode: false, id: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' }); };
  t.after(() => { globalThis.fetch = original; });
  const p = new Payments({ paymentMode: 'sandbox', stripeKey: 'sk_test_fixture', baseUrl: 'http://localhost:3000' });
  for (const method of ['card', 'paypal']) {
    const order = { id: `order-${method}`, payment_method: method, amount: 6498, recipient: JSON.stringify({ email: 'test@example.test' }), items: JSON.stringify([{ title: 'Unter seinen Flügeln', model: 'iPhone 15', unitPrice: 2999, quantity: 1 }, { title: 'Wunschvers', model: 'Samsung Galaxy S24', unitPrice: 3499, quantity: 1 }]) };
    const result = await p.create(order), request = requests.at(-1), params = request.options.body;
    assert.equal(result.id, 'cs_test_fixture'); assert.equal(request.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(params.has('payment_method_types[0]'), false); assert.equal(params.get('automatic_tax[enabled]'), 'false'); assert.equal(params.get('adaptive_pricing[enabled]'), 'false'); assert.equal(params.get('line_items[0][price_data][tax_behavior]'), 'inclusive'); assert.equal(new Headers(request.options.headers).get('Stripe-Version'), STRIPE_API_VERSION); assert.equal(params.get('client_reference_id'), order.id);
    assert.equal(params.get('line_items[0][price_data][unit_amount]'), '2999'); assert.equal(params.get('line_items[1][price_data][unit_amount]'), '3499'); assert.equal(params.get('line_items[1][quantity]'), '1');
    assert.equal(params.get('line_items[0][price_data][currency]'), 'eur'); assert.equal(params.get('locale'), 'de');
    assert.equal(new Headers(request.options.headers).get('Idempotency-Key'), `checkout-${order.id}`);
    assert.equal(new Headers(request.options.headers).get('Authorization'), 'Bearer sk_test_fixture');
  }
});

test('Stripe-Rückprüfung erfordert paid, complete und Testmodus; Live-Schlüssel werden abgewiesen', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const p = new Payments({ paymentMode: 'sandbox', stripeKey: 'sk_test_fixture' }), order = { id: 'order-123', payment_id: 'cs_test_fixture', payment_method: 'paypal' };
  for (const [paid, status, live, valid] of [['paid', 'complete', false, true], ['unpaid', 'complete', false, false], ['paid', 'open', false, false], ['paid', 'complete', true, false]]) {
    globalThis.fetch = async () => Response.json({ id: 'cs_test_fixture', client_reference_id: 'order-123', amount_total: 3499, currency: 'eur', mode: 'payment', metadata: { order_id: order.id, tax_treatment: TAX_TREATMENT }, automatic_tax: { enabled: false }, total_details: { amount_tax: 0 }, payment_status: paid, status, livemode: live });
    const result = await p.verify(order); assert.equal(result.completed, valid); assert.equal(result.amount, 3499); assert.equal(result.orderId, 'order-123');
  }
  assert.throws(() => new Payments({ paymentMode: 'sandbox', stripeKey: 'sk_live_not-allowed' }).client, /Sandbox/);
});

test('Stripe-Kartenspeicherung bleibt freiwillig; derselbe Kunde erhält bestehende Karten ohne Off-Session-Belastung', async t => {
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, options) => { if (String(url).startsWith('https://api.stripe.com/')) options = { ...options, body: new URLSearchParams(options.body) }; calls.push({ url, options }); return Response.json({ livemode: false, id: 'cs_test_saved', url: 'https://checkout.stripe.com/c/pay/cs_test_saved' }); };
  t.after(() => { globalThis.fetch = original; });
  const p = new Payments({ paymentMode: 'sandbox', stripeKey: 'sk_test_fixture', baseUrl: 'http://localhost:3000' });
  const order = { id: 'saved-card-order', payment_method: 'card', recipient: JSON.stringify({ email: 'recipient@example.test' }), items: JSON.stringify([{ title: 'Hülle', model: 'iPhone 15', unitPrice: 2999, quantity: 1 }]) };
  await p.create(order, { customerId: 'cus_owner' });
  const params = calls[0].options.body;
  assert.equal(params.get('customer'), 'cus_owner'); assert.equal(params.has('customer_email'), false);
  assert.equal(params.get('saved_payment_method_options[payment_method_save]'), 'enabled');
  assert.equal(params.get('saved_payment_method_options[payment_method_remove]'), 'enabled');
  assert.equal(params.get('saved_payment_method_options[allow_redisplay_filters][0]'), 'always');
  assert.equal(params.has('payment_intent_data[setup_future_usage]'), false); // No automatic saving or permission for later unattended charges.
  await p.create(order); assert.equal(calls[1].options.body.has('saved_payment_method_options[payment_method_save]'), false); // Guests have no account-linked saving.
});

test('Stripe-Kundenbindung, sichere Kartenanzeige und Entfernen prüfen Eigentümer sowie Zahlungsbezug', async t => {
  const original = globalThis.fetch, requests = [], customers = new Map();
  let checkoutSession;
  globalThis.fetch = async (url, options) => { if (String(url).startsWith('https://api.stripe.com/')) options = { ...options, body: new URLSearchParams(options.body) };
    const path = new URL(url).pathname, params = options.body;
    requests.push({ path, options });
    if (path === '/v1/customers') {
      const key = new Headers(options.headers).get('Idempotency-Key');
      if (!customers.has(key)) customers.set(key, { id: `cus_account_${customers.size + 1}`, livemode: false });
      return Response.json(customers.get(key));
    }
    if (path === '/v1/checkout/sessions') {
      checkoutSession = { id: 'cs_test_owner', client_reference_id: params.get('client_reference_id'), amount_total: 3499, currency: 'eur', mode: 'payment', metadata: { order_id: params.get('client_reference_id'), tax_treatment: TAX_TREATMENT }, automatic_tax: { enabled: false }, total_details: { amount_tax: 0 }, payment_intent: 'pi_fixture', payment_status: 'paid', status: 'complete', livemode: false, customer: params.get('customer') };
      return Response.json({ livemode: false, id: checkoutSession.id, url: 'https://checkout.stripe.com/c/pay/cs_test_owner' });
    }
    if (path === '/v1/checkout/sessions/cs_test_owner') return Response.json(checkoutSession);
    const method = { id: 'pm_owner', type: 'card', customer: 'cus_account_1', allow_redisplay: 'always', livemode: false, card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2032, fingerprint: 'must-not-leak', number: '4242424242424242', cvc: 'must-not-leak' } };
    if (path === '/v1/payment_methods') return Response.json({ data: [method, { ...method, id: 'pm_foreign', customer: 'cus_someone_else' }, { ...method, id: 'pm_no_consent', allow_redisplay: 'limited' }], has_more: false });
    if (path === '/v1/payment_methods/pm_owner') return Response.json(method);
    if (path === '/v1/payment_methods/pm_foreign') return Response.json({ ...method, id: 'pm_foreign', customer: 'cus_someone_else' });
    if (path === '/v1/payment_methods/pm_owner/detach') return Response.json({ ...method, customer: null });
    throw new Error(`Unerwartete Stripe-Fixture: ${path}`);
  };
  const shop = (await Shop.create({ ...defaultConfig(), paymentMode: 'sandbox', stripeKey: 'sk_test_fixture', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Nur-Test-Admin-2026!', autoShip: false }));
  t.after(async () => { (await shop.close()); globalThis.fetch = original; });
  const created = (await shop.createSession()), { session } = (await shop.authenticate(created.session, { email: 'owner@example.test', password: 'Nur-Test-Owner-2026!' }, true)), user = (await shop.user(session));
  const ids = await Promise.all([shop.payments.customerFor(user), shop.payments.customerFor(user)]);
  assert.equal(new Set(ids).size, 1); assert.equal(customers.size, 1);
  assert.equal(requests[0].options.body.get('email'), 'owner@example.test'); assert.equal(requests[0].options.body.get('metadata[shop_user_id]'), user.id);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM payment_customers')).n, 1);
  const cards = await shop.payments.cardsFor(user);
  assert.equal(cards.length, 1); assert.equal(cards[0].id, 'pm_owner');
  assert.equal(JSON.stringify(cards).includes('fingerprint'), false); assert.equal(JSON.stringify(cards).includes('4242424242424242'), false); assert.equal(JSON.stringify(cards).includes('must-not-leak'), false);
  await assert.rejects(shop.payments.removeCard(user, 'pm_foreign'), /nicht gefunden/);
  assert.equal(requests.some(r => r.path === '/v1/payment_methods/pm_foreign/detach'), false);
  await shop.payments.removeCard(user, 'pm_owner'); assert.equal(requests.at(-1).path, '/v1/payment_methods/pm_owner/detach');
  (await shop.saveCart(session, { kind: 'fixed', designId: 'unter-seinen-fluegeln', modelId: 'iphone-15' }));
  const result = await shop.checkout(session, { method: 'card', customerId: 'cus_someone_else', recipient: { name: 'Empfänger', email: 'recipient@example.test', phone: '+4915112345678', street: 'Weg 12', postalCode: '10115', city: 'Berlin', country: 'DE' } });
  assert.equal(checkoutSession.customer, ids[0]);
  const order = (await shop.s.get('SELECT * FROM orders WHERE id=?', result.orderId));
  checkoutSession.customer = 'cus_someone_else'; (await assert.rejects(async () => (await shop.acceptPayment({ id: 'evt_wrong_customer', orderId: order.id, paymentId: order.payment_id, amount: 3499, currency: 'EUR', customerId: checkoutSession.customer, completed: true })), /Stripe-Kundenkonto/));
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM fulfillment')).n, 0);
  checkoutSession.customer = ids[0]; (await shop.acceptPayment(await shop.payments.verify(order)));
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM fulfillment')).n, 1);
});

test('Stripe-Webhook: Signatur + unabhängiger API-Abgleich für PayPal; Replay erzeugt einen Druckauftrag', async t => {
  const original = globalThis.fetch, secret = 'whsec_local-fixture', config = { ...defaultConfig(), paymentMode: 'sandbox', stripeKey: 'sk_test_fixture', stripeWebhook: secret, dataDir: resolve('test-results', randomUUID()), adminPassword: 'Nur-Test-Admin-2026!', autoShip: false };
  let remote;
  globalThis.fetch = async (url, options) => { if (String(url).startsWith('https://api.stripe.com/')) options = { ...options, body: new URLSearchParams(options.body) };
    if (String(url).startsWith('https://api.stripe.com/')) {
      if (options.method === 'POST') { remote = { id: 'cs_test_paypal', client_reference_id: options.body.get('client_reference_id'), amount_total: 3499, currency: 'eur', mode: 'payment', metadata: { order_id: options.body.get('client_reference_id'), tax_treatment: TAX_TREATMENT }, automatic_tax: { enabled: false }, total_details: { amount_tax: 0 }, payment_intent: 'pi_fixture', payment_status: 'unpaid', status: 'open', livemode: false }; return Response.json({ livemode: false, id: remote.id, url: 'https://checkout.stripe.com/c/pay/cs_test_paypal' }); }
      return Response.json(remote);
    }
    return original(url, options);
  };
  const app = (await createApp(config)); await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => { globalThis.fetch = original; await new Promise(async r => (await app.server.close(r))); });
  const base = `http://127.0.0.1:${app.server.address().port}`; let cookie, csrf;
  const call = async (path, body) => { const r = await original(base + path, { method: body ? 'POST' : 'GET', headers: { Cookie: cookie || '', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, body: body ? JSON.stringify(body) : undefined }); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; const data = await r.json(); if (data.csrf) csrf = data.csrf; return { status: r.status, data }; };
  await call('/api/bootstrap'); await call('/api/cart', { kind: 'fixed', modelId: 'iphone-15', designId: 'unter-seinen-fluegeln' });
  const checkout = await call('/api/checkout', { method: 'paypal', recipient: { name: 'Test Person', email: 'test@example.test', phone: '+4915112345678', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' } });
  assert.equal(checkout.status, 201); assert.match(checkout.data.url, /^https:\/\/checkout.stripe.com/);
  assert.equal((await call(`/api/orders/${checkout.data.orderId}/confirm`, {})).status, 403);
  const timestamp = Math.floor(Date.now() / 1000), event = { id: 'evt_stripe_paypal_test', type: 'checkout.session.completed', livemode: false, data: { object: { id: remote.id, amount_total: 1, fixture_padding: 'x'.repeat(24000) } } }, raw = JSON.stringify(event);
  const webhook = signature => original(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: raw });
  assert.equal((await webhook(`t=${timestamp},v1=invalid`)).status, 401);
  const sig = `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`;
  assert.equal((await webhook(sig)).status, 200); assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM fulfillment')).n, 0); // Remote still unpaid.
  remote.payment_status = 'paid'; remote.status = 'complete';
  assert.equal((await webhook(sig)).status, 200); assert.equal((await webhook(sig)).status, 200);
  await app.shop.tick(); assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1); assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM payment_events')).n, 1);
  assert.equal((await app.shop.s.get('SELECT amount FROM orders')).amount, 3499); // Amount comes from Stripe API, never forged webhook fields.
  const record = await app.shop.s.get('SELECT * FROM stripe_payments WHERE order_id=?', checkout.data.orderId);
  assert.equal(record.tax_treatment, TAX_TREATMENT); assert.equal(record.tax_amount, 0); assert.equal(record.payment_intent_id, 'pi_fixture'); assert.ok(record.verified_at);
  remote.status = 'expired'; remote.payment_status = 'unpaid';
  const expiredRaw = JSON.stringify({ ...event, id: 'evt_late_expired', type: 'checkout.session.expired' });
  const expiredSig = `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${expiredRaw}`).digest('hex')}`;
  const late = await original(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': expiredSig }, body: expiredRaw });
  assert.equal(late.status, 200); assert.notEqual((await app.shop.s.get('SELECT status FROM orders WHERE id=?', checkout.data.orderId)).status, 'expired');
});
