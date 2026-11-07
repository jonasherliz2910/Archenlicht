import test from 'node:test';
import assert from 'node:assert/strict';
import { Payments, TAX_TREATMENT } from '../server/payments.js';

test('Stripe bestätigt nur den richtigen steuerfreien Test-Checkout und lehnt unerwartete Steuer oder Metadaten ab', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const payments = new Payments({ paymentMode: 'sandbox', stripeKey: 'rk_test_fixture' });
  const order = { id: 'order-fixture', payment_id: 'cs_test_fixture' };
  const session = { id: order.payment_id, client_reference_id: order.id, livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 2990, currency: 'eur', metadata: { order_id: order.id, tax_treatment: TAX_TREATMENT }, automatic_tax: { enabled: false }, total_details: { amount_tax: 0 } };
  for (const [change, valid] of [[{},true], [{ total_details:{amount_tax:477}},false], [{automatic_tax:{enabled:true}},false], [{metadata:{order_id:'foreign-order',tax_treatment:TAX_TREATMENT}},false], [{metadata:{order_id:order.id,tax_treatment:'different'}},false], [{mode:'subscription'},false], [{id:'cs_test_foreign'},false]]) {
    globalThis.fetch = async () => Response.json({ ...session, ...change });
    assert.equal((await payments.verify(order)).completed, valid);
  }
});

test('Stripe-Fehler geben weder API-Schlüssel noch Providerdetails an Kunden weiter', async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async()=>Response.json({error:{type:'invalid_request_error',message:'Private provider details rk_test_fixture customer@example.test'}},{status:400});
  const payments=new Payments({paymentMode:'sandbox',stripeKey:'rk_test_fixture'});
  await assert.rejects(payments.request(client=>client.checkout.sessions.retrieve('cs_test_fixture')),error=>error.status===502&&!/rk_test_|customer@example/.test(error.message));
  assert.throws(()=>new Payments({stripeKey:'rk_live_fixture'}).client,/Sandbox/);
});
