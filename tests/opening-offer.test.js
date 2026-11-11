import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import { Payments } from '../server/payments.js';
import { orderEmail } from '../server/mail-templates.js';
import { priceNewsletterItems, summarizePricing } from '../public/bundle-pricing.js';
import { priceMarkup, newsletterEligible } from '../public/price-display.js';

const fixed = { kind: 'fixed', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue' };
const recipient = { name: 'Aktion Test', email: 'aktion@example.test', phone: '01721234567', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };
async function setup(t) {
  const shop = await Shop.create({ ...defaultConfig(), openingOfferEnabled: true, shopMode: 'test', storageMode: 'sqlite', paymentMode: 'local', podbaseMode: 'local', printMode: 'preview', mailMode: 'local', newsletterMode: 'local', dataDir: resolve('test-results', randomUUID()), serverless: true, autoShip: false });
  t.after(() => shop.close());
  return { shop, session: (await shop.createSession()).session };
}

test('Opening prices reach every variant; the server marks reductions and ignores forged customer prices', async t => {
  const { shop, session } = await setup(t);
  const state = await shop.publicState(session);
  assert.equal(state.brand.fixedPrice, 2999); assert.equal(state.brand.customPrice, 3499); assert.equal(state.brand.openingOffer, true);
  assert.equal(state.brand.compareAtPrice, undefined);
  for (const [kind, magsafe, price] of [['fixed', false, 2999], ['fixed', true, 3499], ['custom', false, 3499], ['custom', true, 3999]]) {
    const [item] = await shop.saveCart(session, { ...fixed, kind, magsafe, ...(kind === 'custom' ? { customText: 'Du bist getragen.' } : {}), unitPrice: 1, reduced: false, openingOffer: false });
    assert.equal(item.unitPrice, price); assert.equal(item.reduced, true); assert.equal(item.openingOffer, true);
    assert.equal(newsletterEligible([item]), false);
    assert.throws(() => priceNewsletterItems([item]), /nicht reduzierte/);
    const html = priceMarkup(price, state.brand);
    assert.match(html, /Eröffnungspreis/); assert.doesNotMatch(html, /<del|<s>|statt|Countdown/);
    await shop.removeCart(session, item.id);
  }
});

test('Bundle reductions apply to opening prices with exact cents and survive an end of the promotion', async t => {
  const { shop, session } = await setup(t);
  for (const [quantity, total] of [[2, 5698], [3, 8547], [4, 10796]]) {
    const cart = await shop.saveCart(session, { ...fixed, quantity });
    assert.equal(summarizePricing(cart).total, total);
    const checkout = await shop.checkout(session, { recipient, method: 'card' });
    const saved = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
    assert.equal(saved.amount, total);
    assert.equal(JSON.parse(saved.items)[0].openingOffer, true);
    await shop.removeCart(session, cart[0].id);
  }
  const before = await shop.s.all('SELECT id,amount,items FROM orders ORDER BY id');
  shop.config.openingOfferEnabled = false;
  const [item] = await shop.saveCart(session, fixed);
  assert.equal(item.unitPrice, 3499); assert.equal(item.openingOffer, false); assert.equal(item.reduced, false);
  assert.equal(newsletterEligible([item]), true);
  assert.equal(summarizePricing(priceNewsletterItems([item])).total, 3324);
  assert.doesNotMatch(priceMarkup(item.unitPrice, shop.brand), /Eröffnungspreis/);
  assert.deepEqual(await shop.s.all('SELECT id,amount,items FROM orders ORDER BY id'), before);
});

test('Stripe and order emails use the stored opening price without creating an extra discount coupon', async t => {
  const { shop, session } = await setup(t);
  await shop.saveCart(session, fixed);
  const checkout = await shop.checkout(session, { recipient, method: 'card' });
  const order = await shop.s.get('SELECT * FROM orders WHERE id=?', checkout.orderId);
  const calls = [], payments = new Payments({ paymentMode: 'sandbox', stripeKey: 'sk_test_fixture', baseUrl: 'https://www.archenlicht.de' });
  payments.sdk = {
    coupons: { create: async () => { throw new Error('No extra coupon for a single opening-price case'); } },
    checkout: { sessions: { create: async params => { calls.push(params); return { id: 'cs_test_opening', livemode: false, url: 'https://checkout.stripe.com/c/pay/fixture' }; } } }
  };
  shop.config.openingOfferEnabled = false;
  await payments.create(order);
  assert.equal(calls[0].line_items[0].price_data.unit_amount, 2999);
  assert.equal(calls[0].discounts, undefined);
  assert.match(orderEmail({ order, kind: 'confirmation', statusUrl: 'https://www.archenlicht.de/bestellung/fixture' }).text, /Gesamt: 29,99/);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
});
