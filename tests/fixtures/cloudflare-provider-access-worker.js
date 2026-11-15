// Temporary read-only connectivity probe, deployed/deleted by the matching
// checker. No API keys are stored in bindings, source, logs or responses.
async function get(url, headers) {
  let phase = 'fetch';
  try {
    const response = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    phase = 'json';
    const body = await response.json();
    return { status: response.status, body };
  } catch (error) { return { status: 0, body: {}, failure: { phase, name: error.name } }; }
}
export default {
  async fetch(request, env) {
    const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Archenlicht-Probe': 'read-only' };
    const bytes = new TextEncoder().encode(request.headers.get('authorization') || '');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (!env.PROBE_TOKEN_HASH || hash !== env.PROBE_TOKEN_HASH || new URL(request.url).pathname !== '/check' || request.method !== 'POST') return new Response('Not found', { status: 404, headers });
    let input;
    try {
      const text = await request.text(); if (text.length > 5000) throw new Error(); input = JSON.parse(text);
      if (!/^(sk|rk)_live_[A-Za-z0-9_]{20,}$/.test(input.stripe) || !/^re_[A-Za-z0-9_-]+$/.test(input.resend) || typeof input.podbase !== 'string' || /\s/.test(input.podbase)) throw new Error();
    } catch { return Response.json({ error: 'Invalid probe input' }, { status: 400, headers }); }
    const stripeHeaders = { Authorization: 'Bearer ' + input.stripe, 'Stripe-Version': '2026-10-28.endive' };
    const [account, webhooks, catalog, orders, resend] = await Promise.all([
      get('https://api.stripe.com/v1/account', stripeHeaders),
      get('https://api.stripe.com/v1/webhook_endpoints?limit=100', stripeHeaders),
      get('https://open-api.podbase.com/catalog', { 'x-api-key': input.podbase }),
      get('https://open-api.podbase.com/orders?page=0&limit=1', { 'x-api-key': input.podbase }),
      get('https://api.resend.com/domains', { Authorization: 'Bearer ' + input.resend })
    ]);
    return Response.json({ checkedAt: new Date().toISOString(), readOnly: true,
      stripe: { status: account.status, failure: account.failure, chargesEnabled: account.body.charges_enabled, payoutsEnabled: account.body.payouts_enabled,
        webhookStatus: webhooks.status, endpoints: webhooks.body.data?.filter(w => w.url === 'https://www.archenlicht.de/api/webhooks/stripe').map(w => ({ url: w.url, active: w.status === 'enabled', live: w.livemode, events: w.enabled_events })) },
      podbase: { catalogStatus: catalog.status, failure: catalog.failure, catalogProducts: Array.isArray(catalog.body) ? catalog.body.length : null,
        orderReadStatus: orders.status, returnedOrderStates: orders.body.orders?.map(o => o.status) },
      resend: { status: resend.status, failure: resend.failure, restriction: resend.body.name === 'restricted_api_key' ? 'sending-only' : null,
        domains: resend.body.data?.filter(d => d.name === 'archenlicht.de').map(d => ({ name: d.name, status: d.status })) }
    }, { headers });
  }
};
