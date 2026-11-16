// Local workerd integration fixture. Never used by the deployable shop bundle.
// Provider calls are intercepted by this fixture; only fake credentials enter
// this runtime. PostgreSQL uses its own disposable schema. Unexpected fetches
// are blocked, and native Request construction still validates runtime options.
import { MigrationShop } from '../../cloudflare/shop-worker.js';
import { createApp, defaultConfig } from '../../server/index.js';
import { prepareDesign } from '../../server/design-assets.js';
import { nodeHandlerResponse } from '../../cloudflare/node-handler.js';
import { PODBASE_MODEL_MAP } from '../../server/podbase-catalog.js';
import { PODBASE_MAGSAFE_MAP } from '../../server/case-variants.js';

const networkFetch = globalThis.fetch;
const fixture = { calls: [], sessions: [], orders: [], mails: [], losePodbaseReply: true, loseMailReply: true };
function installMocks(databaseUrl) {
  const neonHost = new URL(databaseUrl).hostname;
  const variants = models => [...new Map(models.map(m => [m.variantId, { id: m.variantId, name: m.catalogName, inStock: true }])).values()];
  globalThis.fetch = async (input, init = {}) => {
    // Let workerd validate actual Request options before returning any mock.
    // This catches unsupported redirect modes that plain JS mocks would hide.
    new Request(input, init);
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = init.method || input.method || 'GET';
    if (url.protocol === 'https:' && (url.hostname === neonHost || /^api\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname))) return networkFetch(input, init);
    const headers = new Headers(init.headers), params = new URLSearchParams(init.body);
    fixture.calls.push({ origin: url.origin, path: url.pathname, method, key: headers.get('idempotency-key') });
    if (url.origin === 'https://api.stripe.com') {
      if (headers.get('authorization') !== 'Bearer rk_live_fixture') throw new Error('Only fake Stripe credentials allowed');
      if (url.pathname === '/v1/checkout/sessions' && method === 'POST') {
        const id = 'cs_live_fixture' + (fixture.sessions.length + 1), orderId = params.get('client_reference_id');
        const session = { id, url: 'https://checkout.stripe.com/c/pay/' + id, client_reference_id: orderId,
          amount_total: Number(params.get('line_items[0][price_data][unit_amount]')), currency: 'eur', mode: 'payment', livemode: true,
          status: 'open', payment_status: 'unpaid', metadata: { order_id: orderId, tax_treatment: params.get('metadata[tax_treatment]') },
          automatic_tax: { enabled: params.get('automatic_tax[enabled]') !== 'false' }, total_details: { amount_tax: 0 }, payment_intent: 'pi_fixture' };
        fixture.sessions.push(session); return Response.json(session);
      }
      const session = fixture.sessions.find(s => url.pathname === '/v1/checkout/sessions/' + s.id);
      if (method === 'GET' && session) return Response.json(session);
    }
    if (url.origin === 'https://open-api.podbase.com') {
      if (headers.get('x-api-key') !== 'podbase_fixture') throw new Error('Only fake Podbase credentials allowed');
      if (url.pathname === '/catalog' && method === 'GET') return Response.json([
        { id: PODBASE_MODEL_MAP.productId, variants: variants(PODBASE_MODEL_MAP.models) },
        ...PODBASE_MAGSAFE_MAP.products.map(p => ({ id: p.productId, title: p.productName, variants: variants(p.models) }))
      ]);
      if (url.pathname === '/orders' && method === 'GET') return Response.json({ orders: fixture.orders, pagination: { page: 0, hasNextPage: false } });
      if (url.pathname === '/orders' && method === 'POST') {
        const payload = JSON.parse(init.body), order = { orderId: 'provider-fixture-' + fixture.orders.length,
          externalOrderId: 'PUS-AAA-BBB-CCCC-' + payload.externalOrderId, status: 'UNAPPROVED', items: payload.items };
        fixture.orders.push(order);
        if (fixture.losePodbaseReply) { fixture.losePodbaseReply = false; throw new Error('Fixture: accepted response lost'); }
        return Response.json(order);
      }
      const order = fixture.orders.find(o => url.pathname === '/orders/' + o.orderId);
      if (method === 'GET' && order) return Response.json(order);
    }
    if (url.origin === 'https://api.resend.com' && url.pathname === '/emails' && method === 'POST') {
      if (headers.get('authorization') !== 'Bearer re_fixture') throw new Error('Only fake Resend credentials allowed');
      const key = headers.get('idempotency-key');
      let mail = fixture.mails.find(m => m.key === key);
      if (mail && mail.payload !== init.body) throw new Error('Idempotent payload changed');
      if (!mail) { mail = { id: 'email-fixture-' + fixture.mails.length, key, payload: init.body }; fixture.mails.push(mail); }
      if (fixture.loseMailReply) { fixture.loseMailReply = false; throw new Error('Fixture: accepted mail response lost'); }
      return Response.json({ id: mail.id });
    }
    throw new Error('Unexpected provider fixture request; network blocked');
  };
}

export class ProviderFixture extends MigrationShop {
  async getApplication() {
    if (!/^cf_preview_providers_[a-f0-9]{16}$/.test(this.env.DATABASE_SCHEMA || '')) throw new Error('Disposable provider-test schema required');
    if (!this.application) installMocks(this.env.DATABASE_URL);
    if (!this.application) this.application = createApp({
      ...defaultConfig(), baseUrl: 'https://www.archenlicht.de', printBaseUrl: 'https://www.archenlicht.de',
      shopMode: 'live', paymentMode: 'live', stripeKey: 'rk_live_fixture', stripeWebhook: 'whsec_stripe_fixture',
      podbaseMode: 'production', podbaseKey: 'podbase_fixture', podbaseStoreId: 'PUS-AAA-BBB-CCCC', podbaseSubmissionEnabled: true,
      mailMode: 'resend', newsletterMode: 'local', resendKey: 're_fixture', resendWebhook: 'whsec_Zml4dHVyZQ==',
      mailPublicUrl: 'https://www.archenlicht.de', mailEnabledSince: '2026-01-01T00:00:00Z',
      storageMode: 'postgres', databaseUrl: this.env.DATABASE_URL, databaseSchema: this.env.DATABASE_SCHEMA,
      printMode: 'podbase', checkoutEnabled: true, autoShip: false, serverless: true, legalContactReady: true,
      adminEmail: 'fixture@example.test', adminPassword: 'Fixture-only-admin-password!', dataDir: '/tmp/provider-fixture',
      printRenderer: 'resvg-wasm-2.6.2-srgb300-v1', printLayoutCacheSize: 2,
      prepareDesign: id => prepareDesign(id, this.env.ASSETS)
    });
    return this.application;
  }
  async handle(request) {
    const { shop, handler } = await this.getApplication();
    const path = new URL(request.url).pathname;
    if (path === '/__fixture/prepare') {
      const design = { kind: 'custom', designId: 'nach-dem-sturm', modelId: 'iphone-14-pro', backgroundId: 'light-blue', magsafe: true, customText: 'Auch im Sturm bist du geborgen.' };
      const { session } = await shop.createSession();
      await shop.s.run("UPDATE variants SET approval_mode='live' WHERE model_id=? AND design_id=?", design.modelId, design.designId);
      await shop.saveCart(session, design);
      const result = await shop.checkout(session, { method: 'stripe', recipient: { name: 'Fixture Kunde', email: 'fixture@example.test', phone: '01721234567', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' } });
      return Response.json({ orderId: result.orderId });
    }
    if (path === '/__fixture/reopen-existing') {
      const before = await shop.s.all('SELECT * FROM users ORDER BY id');
      let missingAdminRejected = false;
      try { await createApp({ ...shop.config, existingStoreOnly: true, adminPassword: undefined, adminEmail: 'missing@example.test' }); }
      catch { missingAdminRejected = true; }
      const reopened = await createApp({ ...shop.config, existingStoreOnly: true, adminPassword: undefined });
      const after = await reopened.shop.s.all('SELECT * FROM users ORDER BY id');
      return Response.json({ missingAdminRejected, accountsUnchanged: JSON.stringify(before) === JSON.stringify(after), accounts: after.length });
    }
    if (path === '/__fixture/state') {
      const orders = await shop.s.all('SELECT id,amount,status,paid_at,items FROM orders');
      const jobs = await shop.s.all('SELECT state,attempts,provider_id FROM fulfillment');
      const deliveries = await shop.s.all('SELECT d.state,d.attempts,d.provider_id,m.kind FROM mail_deliveries d JOIN mail_outbox m ON m.id=d.mail_id ORDER BY d.created');
      const events = await shop.s.get('SELECT COUNT(*) AS n FROM mail_events');
      return Response.json({ orders, jobs, deliveries, events: events.n, provider: fixture });
    }
    if (path === '/__fixture/scenario') {
      const input = await request.json();
      if (input.session) Object.assign(fixture.sessions[0], input.session);
      if (input.order) Object.assign(fixture.orders[0], input.order);
      return Response.json({ ok: true });
    }
    if (path === '/__fixture/alarm') {
      // Only advance retry due dates in this disposable fixture. Real scheduler,
      // database transactions, leases, providers and signatures remain unchanged.
      await shop.s.run('UPDATE fulfillment SET updated=?,lease_until=0', Date.now() - 1801000);
      await shop.s.run('UPDATE mail_deliveries SET next_attempt=0,lease_until=0');
      await this.scheduler.arm('https://www.archenlicht.de');
      return Response.json(await this.scheduler.run());
    }
    return nodeHandlerResponse(handler, new Request('https://www.archenlicht.de' + path, request));
  }
}

export default {
  fetch(request, env) { return env.SHOP.get(env.SHOP.idFromName('provider-fixture')).fetch(request); }
};
