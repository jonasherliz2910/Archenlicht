import test from 'node:test';
import assert from 'node:assert/strict';
import { Payments, TAX_TREATMENT } from '../server/payments.js';

test('Live-Adapter trennt Schlüssel, Kundenkonten, Bestellungen und Stripe-Antworten vom Testbetrieb', async t => {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  const config = { shopMode: 'live', paymentMode: 'live', stripeKey: 'sk_live_fixture', baseUrl: 'https://www.archenlicht.de' };
  const payments = new Payments(config);
  assert.equal(payments.provider, 'stripe_live');
  assert.equal(new Payments({ paymentMode: 'sandbox' }).provider, 'stripe_test');
  assert.throws(() => new Payments({ ...config, shopMode: 'test' }).client, /gesperrt/);
  assert.throws(() => new Payments({ ...config, stripeKey: 'sk_test_fixture' }).client, /Live/);
  const order = { id: 'live-order', mode: 'live', payment_id: 'cs_live_fixture', recipient: JSON.stringify({ email: 'live@example.test' }), items: JSON.stringify([{ title: 'Test fixture', model: 'iPhone 14 Pro', quantity: 1, unitPrice: 3499 }]) };
  const session = { id: order.payment_id, url: 'https://checkout.stripe.com/c/pay/cs_live_fixture', client_reference_id: order.id, livemode: true, mode: 'payment', payment_status: 'paid', status: 'complete', metadata: { order_id: order.id, tax_treatment: TAX_TREATMENT }, automatic_tax: { enabled: false }, total_details: { amount_tax: 0 }, amount_total: 3499, currency: 'eur' };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json(session); };
  assert.equal((await payments.create(order)).id, order.payment_id);
  assert.equal(new Headers(calls[0].options.headers).get('Authorization'), 'Bearer sk_live_fixture');
  assert.equal((await payments.verify(order)).completed, true);
  await assert.rejects(payments.create({ ...order, mode: 'test' }), /Zahlungsumgebung/);
  await assert.rejects(payments.verify({ ...order, mode: 'test' }), /Zahlungsumgebung/);
  for (const override of [{ livemode: false }, { total_details: { amount_tax: 557 } }, { payment_status: 'unpaid' }]) {
    globalThis.fetch = async () => Response.json({ ...session, ...override });
    assert.equal((await payments.verify(order)).completed, false);
  }
  globalThis.fetch = async () => Response.json({ ...session, livemode: false, id: 'cs_test_fixture' });
  await assert.rejects(payments.create(order), /nicht eingerichtet/);
});
