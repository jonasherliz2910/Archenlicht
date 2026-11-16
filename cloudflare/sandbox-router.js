import { migrationAccess } from './migration-access.js';
import { SANDBOX_ORIGIN } from './sandbox-config.js';

export async function sandboxFetch(request, env) {
  const url = new URL(request.url);
  if (url.origin !== SANDBOX_ORIGIN) return new Response('Unknown acceptance address.', { status: 421 });
  // Prepared Stripe links have no customer browser session. This neutral return
  // page exposes no order data and never confirms or processes a payment.
  if (request.method === 'GET' && /^\/zahlungsrueckkehr\/[a-f0-9-]{36}$/.test(url.pathname)) return new Response('<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archenlicht – Zahlungstest</title><main><h1>Zurück vom Zahlungstest</h1><p>Die technische Zahlungsbestätigung wird jetzt separat geprüft.</p><p>Bitte schreibe im Chat: <strong>Testzahlung abgeschlossen</strong>.</p><p>Dies ist ein Test. Es wird keine Hülle produziert oder versendet.</p></main></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' } });
  // Stripe cannot use browser Basic authentication. Only this exact POST path
  // bypasses the outer password; the app must verify Stripe's raw signature.
  const webhook = request.method === 'POST' && url.pathname === '/api/webhooks/stripe';
  const access = migrationAccess(request, env.MIGRATION_ACCESS_PASSWORD);
  if (!webhook && !access.authorized) return new Response('Geschützter Archenlicht-Zahlungstest.', { status: 401, headers: {
    'WWW-Authenticate': 'Basic realm="Archenlicht Zahlungstest"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'
  } });
  let response;
  if (/^\/(api|prints|rechtliches)(\/|$)/.test(url.pathname)) {
    const forwarded = new Request(request);
    forwarded.headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
    if (forwarded.headers.get('authorization')?.startsWith('Basic ')) forwarded.headers.delete('authorization');
    response = await env.SHOP.get(env.SHOP.idFromName('stripe-acceptance-v1')).fetch(forwarded);
  } else {
    response = await env.ASSETS.fetch(request);
  }
  const result = new Response(response.body, response);
  result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  result.headers.set('Cache-Control', 'private, no-store');
  if (access.cookie) result.headers.append('Set-Cookie', access.cookie);
  return result;
}
