import { createHmac, timingSafeEqual } from 'node:crypto';
import { ShopError } from './layout.js';
import { BRAND } from './catalog.js';
import { digest } from './store.js';

export class Payments {
  constructor(config, store = null) { this.config = config; this.store = store; }
  get provider() { return this.config.paymentMode === 'local' ? 'local' : 'stripe_test'; }
  async storedCustomer(user) { return user && (await this.store?.get('SELECT customer_id FROM payment_customers WHERE user_id=? AND provider=?', user.id, this.provider))?.customer_id; }
  async customerFor(user) {
    if (!user) return null;
    const existing = (await this.storedCustomer(user));
    if (existing) return existing;
    const customer = this.config.paymentMode === 'local'
      ? { id: `SIM-CUSTOMER-${digest(user.id).slice(0, 24)}` }
      : await this.stripe('customers', 'POST', { email: user.email, 'metadata[shop_user_id]': user.id }, `customer-${digest(user.id)}`);
    if (!customer.id || (this.config.paymentMode !== 'local' && customer.livemode !== false)) throw new ShopError('Das Stripe-Testkundenkonto konnte nicht eingerichtet werden.', 502);
    (await this.store.run('INSERT OR IGNORE INTO payment_customers VALUES(?,?,?)', user.id, this.provider, customer.id));
    return (await this.storedCustomer(user));
  }
  async cardsFor(user) {
    const customerId = (await this.storedCustomer(user));
    if (!customerId) return [];
    if (this.config.paymentMode === 'local') return (await this.store.all('SELECT id,brand,last4,exp_month AS expMonth,exp_year AS expYear FROM local_payment_methods WHERE user_id=? ORDER BY created DESC', user.id)).map(c => ({ ...c, simulated: true }));
    const cards = []; let cursor = '';
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ customer: customerId, type: 'card', allow_redisplay: 'always', limit: '100', ...(cursor ? { starting_after: cursor } : {}) });
      const result = await this.stripe(`payment_methods?${query}`);
      for (const method of result.data) if (method.customer === customerId && method.type === 'card' && method.allow_redisplay === 'always' && method.livemode === false) cards.push({ id: method.id, brand: method.card.brand, last4: method.card.last4, expMonth: method.card.exp_month, expYear: method.card.exp_year, simulated: false });
      if (!result.has_more) return cards;
      cursor = result.data.at(-1)?.id;
      if (!cursor) break;
    }
    throw new ShopError('Deine gespeicherten Karten konnten gerade nicht vollständig geladen werden.', 502);
  }
  async removeCard(user, id) {
    const customerId = (await this.storedCustomer(user));
    if (!customerId) throw new ShopError('Karte nicht gefunden.', 404);
    if (this.config.paymentMode === 'local') {
      const row = (await this.store.get('SELECT id FROM local_payment_methods WHERE id=? AND user_id=?', id, user.id));
      if (!row) throw new ShopError('Karte nicht gefunden.', 404);
      (await this.store.run('DELETE FROM local_payment_methods WHERE id=? AND user_id=?', id, user.id));
    } else {
      if (!/^pm_[A-Za-z0-9_]{1,120}$/.test(id)) throw new ShopError('Karte nicht gefunden.', 404);
      const method = await this.stripe(`payment_methods/${encodeURIComponent(id)}`);
      if (method.customer !== customerId || method.type !== 'card' || method.livemode !== false) throw new ShopError('Karte nicht gefunden.', 404);
      await this.stripe(`payment_methods/${encodeURIComponent(id)}/detach`, 'POST', {});
    }
  }
  async stripe(path, method = 'GET', params, idempotency) {
    const key = this.config.stripeKey;
    if (!key?.startsWith('sk_test_')) throw new ShopError('Für Stripe fehlen die Sandbox-Zugangsdaten.', 503);
    const response = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) }, body: params ? new URLSearchParams(params) : undefined, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new ShopError('Stripe Checkout ist vorübergehend nicht erreichbar. Prüfe im Sandbox-Modus auch die aktivierten Zahlungsmethoden.', 502);
    return response.json();
  }
  async create(order, { customerId = null } = {}) {
    const base = this.config.baseUrl;
    if (this.config.paymentMode === 'local') return { id: `SIM-${order.payment_method}-${order.id}`, url: `/testzahlung/${order.id}`, simulated: true };
    const items = JSON.parse(order.items);
    const params = { mode: 'payment', locale: 'de', 'payment_method_types[0]': order.payment_method === 'paypal' ? 'paypal' : 'card', client_reference_id: order.id, 'metadata[order_id]': order.id, customer_email: JSON.parse(order.recipient).email, success_url: `${base}/zahlungsrueckkehr/${order.id}`, cancel_url: `${base}/warenkorb?zahlung=abgebrochen` };
    if (customerId && order.payment_method === 'card') {
      delete params.customer_email;
      params.customer = customerId;
      params['saved_payment_method_options[payment_method_save]'] = 'enabled';
      params['saved_payment_method_options[payment_method_remove]'] = 'enabled';
      params['saved_payment_method_options[allow_redisplay_filters][0]'] = 'always';
    }
    items.forEach((item, index) => { const prefix = `line_items[${index}]`; params[`${prefix}[price_data][currency]`] = 'eur'; params[`${prefix}[price_data][unit_amount]`] = String(item.unitPrice); params[`${prefix}[price_data][product_data][name]`] = `${BRAND.name} · ${item.title} · ${item.model}`; params[`${prefix}[quantity]`] = String(item.quantity); });
    const data = await this.stripe('checkout/sessions', 'POST', params, `checkout-${order.id}`);
    return { id: data.id, url: data.url, simulated: false };
  }
  async verify(order) {
    if (this.config.paymentMode === 'local') throw new ShopError('Lokale Zahlungsereignisse müssen separat bestätigt werden.', 400);
    const s = await this.stripe(`checkout/sessions/${encodeURIComponent(order.payment_id)}`);
    return { id: `stripe-${s.id}`, paymentId: s.id, orderId: s.client_reference_id, amount: s.amount_total, currency: s.currency?.toUpperCase(), customerId: typeof s.customer === 'object' ? s.customer?.id : s.customer, completed: s.payment_status === 'paid' && s.status === 'complete' && s.livemode === false };
  }
  verifyStripeSignature(raw, signature) {
    if (!this.config.stripeWebhook || !signature) return false;
    const parts = signature.split(',').map(x => x.split('=')), timestamp = parts.find(([k]) => k === 't')?.[1];
    if (!timestamp || !Number.isFinite(Number(timestamp)) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const expected = createHmac('sha256', this.config.stripeWebhook).update(`${timestamp}.${raw}`).digest();
    return parts.filter(([k]) => k === 'v1').some(([, value]) => { const actual = Buffer.from(value, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); });
  }
}
