import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import { TAX_TREATMENT } from '../server/payments.js';

test('Echte Stripe-Sandbox: Gast und Konto erhalten gehosteten EUR-Checkout ohne Umsatzsteuer; ausstehende Zahlungen bleiben offen', { skip: process.env.RUN_STRIPE_SANDBOX_TESTS !== '1' }, async t => {
  assert.match(process.env.STRIPE_SECRET_KEY || '', /^(sk|rk)_test_/);
  const shop = await Shop.create({ ...defaultConfig(), shopMode: 'test', mailMode: 'local', podbaseMode: 'local', printMode: 'preview', storageMode: 'sqlite', paymentMode: 'sandbox', dataDir: resolve('test-results', 'stripe-' + randomUUID()), adminPassword: 'Nur-Test-Admin-2026!', autoShip: false, baseUrl: 'https://archenlicht.de' });
  const sessions = [], customers = [], coupons = [];
  t.after(async () => {
    for (const id of sessions) await shop.payments.request(client => client.checkout.sessions.expire(id));
    for (const id of coupons) await shop.payments.request(client => client.coupons.del(id));
    for (const id of customers) await shop.payments.request(client => client.customers.del(id));
    await shop.close();
  });
  const recipient = { name: 'Stripe Prüfkauf', email: 'stripe-smoke@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };
  for (const account of [false, true]) {
    let { session } = await shop.createSession();
    if (account) ({ session } = await shop.authenticate(session, { email: `stripe-${randomUUID()}@example.test`, password: 'Nur-Test-Konto-2026!' }, true));
    await shop.saveCart(session, { kind: 'fixed', designId: 'unter-seinen-fluegeln', modelId: 'iphone-18-pro' });
    await shop.saveCart(session, { kind: 'custom', designId: 'getragen', modelId: 'google-pixel-11-pro-xl', verseId: 'jes41-10', dedication: 'Für Änne' });
    const checkout = await shop.checkout(session, { recipient, method: 'stripe', saveAddress: account }, { returnOrigin: 'https://archenlicht.vercel.app' });
    assert.match(checkout.url, /^https:\/\/checkout\.stripe\.com\//);
    const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId); sessions.push(order.payment_id);
    const remote = await shop.payments.request(client => client.checkout.sessions.retrieve(order.payment_id));
    for (const discount of remote.discounts || []) if (typeof discount.coupon === 'string') coupons.push(discount.coupon);
    if (remote.customer) customers.push(remote.customer);
    assert.equal(remote.livemode, false); assert.equal(remote.mode, 'payment'); assert.equal(remote.currency, 'eur'); assert.equal(remote.amount_total, 6173); assert.equal(remote.amount_subtotal, 6498); assert.equal(remote.total_details.amount_discount, 325);
    assert.equal(remote.automatic_tax.enabled, false); assert.equal(remote.total_details.amount_tax, 0); assert.equal(remote.metadata.tax_treatment, TAX_TREATMENT);
    assert.match(remote.custom_text.submit.message, /Kleinunternehmer/); assert.match(remote.success_url, /^https:\/\/archenlicht\.vercel\.app\//);
    assert.equal(Boolean(remote.customer), account);
    if (account) assert.equal(remote.saved_payment_method_options.payment_method_save, 'enabled');
    const items = await shop.payments.request(client => client.checkout.sessions.listLineItems(order.payment_id));
    assert.deepEqual(items.data.map(item => item.amount_subtotal).sort(), [2999, 3499]);
    assert.equal((await shop.payments.verify(order)).completed, false);
    assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM fulfillment')).n, 0);
    assert.equal((await shop.s.get('SELECT tax_treatment FROM stripe_payments WHERE order_id=?', order.id)).tax_treatment, TAX_TREATMENT);
  }
});
