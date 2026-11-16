import { DESIGNS } from '../server/catalog.js';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';
import { SHOP_ORIGIN } from './production-config.js';

const pages = new Set(['/kollektion', '/gestalten', '/bundle', ...DESIGNS.map(d => '/kollektion/' + d.id), ...FIXED_BUNDLES.map(b => '/bundle/' + b.id)]);
const security = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};

export async function productionFetch(request, env) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || !['www.archenlicht.de', 'archenlicht.de'].includes(url.host)) return new Response('Unbekannte Shopadresse.', { status: 421 });
  const dynamic = /^\/(api|prints|rechtliches)(\/|$)/.test(url.pathname);
  if (!dynamic && url.origin !== SHOP_ORIGIN) return Response.redirect(SHOP_ORIGIN + url.pathname + url.search, 308);
  let response;
  if (dynamic) {
    const forwarded = new Request(request);
    forwarded.headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
    // Webhooks remain public; their original body/signature and guest Bearer links
    // pass through to the existing server's signature/authentication checks.
    response = await env.SHOP.get(env.SHOP.idFromName('archenlicht-production-v1')).fetch(forwarded);
  } else {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Methode nicht erlaubt.', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const path = url.pathname.replace(/\/$/, '');
    if (pages.has(path)) url.pathname = '/_pages' + path + '.html';
    response = await env.ASSETS.fetch(new Request(url, request));
  }
  const result = new Response(response.body, response);
  for (const [key, value] of Object.entries(security)) result.headers.set(key, value);
  if (dynamic) result.headers.set('Cache-Control', 'private, no-store');
  else if (response.ok && /^\/(_app|assets\/web-v1)\//.test(url.pathname)) result.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  else if (response.ok && url.pathname.startsWith('/fonts/')) result.headers.set('Cache-Control', 'public, max-age=86400');
  else if (response.headers.get('content-type')?.includes('text/html')) result.headers.set('Cache-Control', 'no-cache');
  return result;
}
