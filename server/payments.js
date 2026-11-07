import Stripe from 'stripe';
import { ShopError } from './layout.js';
import { BRAND } from './catalog.js';
import { digest } from './store.js';

export const STRIPE_API_VERSION = '2026-10-28.endive';
export const TAX_TREATMENT = 'small_business_de';
export const TAX_NOTICE = 'Kein Umsatzsteuerausweis aufgrund der Kleinunternehmerregelung (§ 19 UStG).';

export class Payments {
  constructor(config, store = null) { this.config = config; this.store = store; }
  get provider() { return this.config.paymentMode === 'local' ? 'local' : 'stripe_test'; }
  get client() {
    if (!/^(sk|rk)_test_[A-Za-z0-9_]+$/.test(this.config.stripeKey || '')) throw new ShopError('Für Stripe fehlen die Sandbox-Zugangsdaten.', 503);
    return this.sdk ||= new Stripe(this.config.stripeKey, { apiVersion: STRIPE_API_VERSION, timeout: 15000, maxNetworkRetries: 1, httpClient: Stripe.createFetchHttpClient((...args) => globalThis.fetch(...args)), appInfo: { name: 'Archenlicht', version: '0.1.0', url: 'https://archenlicht.de' } });
  }
  async request(operation) {
    try { return await operation(this.client); }
    catch (error) {
      if (error instanceof ShopError) throw error;
      // Never expose Stripe errors: they can contain request fields or credentials.
      throw new ShopError('Stripe Checkout ist vorübergehend nicht erreichbar. Bitte versuche es gleich noch einmal.', 502);
    }
  }
  async storedCustomer(user) { return user && (await this.store?.get('SELECT customer_id FROM payment_customers WHERE user_id=? AND provider=?', user.id, this.provider))?.customer_id; }
  async customerFor(user) {
    if (!user) return null;
    const existing = await this.storedCustomer(user); if (existing) return existing;
    const customer = this.config.paymentMode === 'local'
      ? { id: `SIM-CUSTOMER-${digest(user.id).slice(0, 24)}` }
      : await this.request(client => client.customers.create({ email: user.email, metadata: { shop_user_id: user.id } }, { idempotencyKey: `customer-${digest(user.id)}` }));
    if (!customer.id || (this.config.paymentMode !== 'local' && customer.livemode !== false)) throw new ShopError('Das Stripe-Testkundenkonto konnte nicht eingerichtet werden.', 502);
    await this.store.run('INSERT OR IGNORE INTO payment_customers VALUES(?,?,?)', user.id, this.provider, customer.id);
    return this.storedCustomer(user);
  }
  async cardsFor(user) {
    const customerId = await this.storedCustomer(user); if (!customerId) return [];
    if (this.config.paymentMode === 'local') return (await this.store.all('SELECT id,brand,last4,exp_month AS expMonth,exp_year AS expYear FROM local_payment_methods WHERE user_id=? ORDER BY created DESC', user.id)).map(c => ({ ...c, simulated: true }));
    const cards = []; let cursor;
    for (let page = 0; page < 10; page++) {
      const result = await this.request(client => client.paymentMethods.list({ customer: customerId, type: 'card', allow_redisplay: 'always', limit: 100, ...(cursor ? { starting_after: cursor } : {}) }));
      for (const method of result.data) if (method.customer === customerId && method.type === 'card' && method.allow_redisplay === 'always' && method.livemode === false) cards.push({ id: method.id, brand: method.card.brand, last4: method.card.last4, expMonth: method.card.exp_month, expYear: method.card.exp_year, simulated: false });
      if (!result.has_more) return cards;
      cursor = result.data.at(-1)?.id; if (!cursor) break;
    }
    throw new ShopError('Deine gespeicherten Karten konnten gerade nicht vollständig geladen werden.', 502);
  }
  async removeCard(user, id) {
    const customerId = await this.storedCustomer(user); if (!customerId) throw new ShopError('Karte nicht gefunden.', 404);
    if (this.config.paymentMode === 'local') {
      if (!await this.store.get('SELECT id FROM local_payment_methods WHERE id=? AND user_id=?', id, user.id)) throw new ShopError('Karte nicht gefunden.', 404);
      await this.store.run('DELETE FROM local_payment_methods WHERE id=? AND user_id=?', id, user.id);
    } else {
      if (!/^pm_[A-Za-z0-9_]{1,120}$/.test(id)) throw new ShopError('Karte nicht gefunden.', 404);
      const method = await this.request(client => client.paymentMethods.retrieve(id));
      if (method.customer !== customerId || method.type !== 'card' || method.livemode !== false) throw new ShopError('Karte nicht gefunden.', 404);
      await this.request(client => client.paymentMethods.detach(id));
    }
  }
  async create(order, { customerId = null, returnOrigin = this.config.baseUrl } = {}) {
    if (this.config.paymentMode === 'local') return { id: `SIM-${order.payment_method}-${order.id}`, url: `/testzahlung/${order.id}`, simulated: true };
    const base = returnOrigin, recipient = JSON.parse(order.recipient);
    const params = {
      mode: 'payment', locale: 'de', client_reference_id: order.id,
      integration_identifier: 'archenlicht_hosted_bmqnvrta',
      metadata: { order_id: order.id, tax_treatment: TAX_TREATMENT },
      payment_intent_data: { metadata: { order_id: order.id } },
      adaptive_pricing: { enabled: false }, automatic_tax: { enabled: false },
      custom_text: { submit: { message: TAX_NOTICE } },
      success_url: `${base}/zahlungsrueckkehr/${order.id}`, cancel_url: `${base}/warenkorb?zahlung=abgebrochen`,
      ...(customerId ? { customer: customerId, saved_payment_method_options: { payment_method_save: 'enabled', payment_method_remove: 'enabled', allow_redisplay_filters: ['always'] } } : { customer_email: recipient.email }),
      ...(this.config.stripePaymentConfiguration ? { payment_method_configuration: this.config.stripePaymentConfiguration } : {}),
      line_items: JSON.parse(order.items).map(item => ({ quantity: item.quantity, price_data: { currency: 'eur', unit_amount: item.unitPrice, tax_behavior: 'inclusive', product_data: { name: `${BRAND.name} · ${item.title} · ${item.model}` } } }))
    };
    // The shop validates and snapshots the German delivery address before checkout.
    // No duplicate shipping form or automatic customer-address persistence at Stripe.
    const data = await this.request(client => client.checkout.sessions.create(params, { idempotencyKey: `checkout-${order.id}` }));
    if (data.livemode !== false || !/^cs_test_[A-Za-z0-9]+$/.test(data.id || '') || !/^https:\/\/checkout\.stripe\.com\//.test(data.url || '')) throw new ShopError('Die Stripe-Testzahlung konnte nicht eingerichtet werden.', 502);
    return { id: data.id, url: data.url, simulated: false };
  }
  async verify(order) {
    if (this.config.paymentMode === 'local') throw new ShopError('Lokale Zahlungsereignisse müssen separat bestätigt werden.', 400);
    const session = await this.request(client => client.checkout.sessions.retrieve(order.payment_id));
    const taxAmount = session.total_details?.amount_tax;
    const completed = session.id === order.payment_id && session.mode === 'payment' && session.payment_status === 'paid' && session.status === 'complete' && session.livemode === false && session.metadata?.order_id === order.id && session.metadata?.tax_treatment === TAX_TREATMENT && session.automatic_tax?.enabled === false && taxAmount === 0;
    return { id: `stripe-${session.id}`, paymentId: session.id, orderId: session.client_reference_id, amount: session.amount_total, currency: session.currency?.toUpperCase(), customerId: typeof session.customer === 'object' ? session.customer?.id : session.customer, paymentIntentId: typeof session.payment_intent === 'object' ? session.payment_intent?.id : session.payment_intent, taxTreatment: session.metadata?.tax_treatment, taxAmount, completed, status: session.status };
  }
  verifyStripeSignature(raw, signature) {
    if (!this.config.stripeWebhook || !signature) return false;
    const timestamp = /(?:^|,)t=(\d+)(?:,|$)/.exec(signature)?.[1];
    if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    try { Stripe.webhooks.constructEvent(raw, signature, this.config.stripeWebhook); return true; } catch { return false; }
  }
}
