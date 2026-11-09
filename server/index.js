import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname, sep, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Shop } from './shop.js';
import { ShopError, renderLayout } from './layout.js';
import { DESIGNS, MODELS } from './catalog.js';
import { digest } from './store.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultConfig = () => ({ podbaseKey: process.env.PODBASE_API_KEY, podbaseBaseUrl: process.env.PODBASE_BASE_URL || 'https://open-api.podbase.com', shopMode: process.env.SHOP_MODE || 'test', podbaseMode: process.env.PODBASE_MODE || 'local', printMode: process.env.PRINT_MODE || 'preview', mailMode: process.env.MAIL_MODE || 'local', newsletterMode: process.env.NEWSLETTER_MODE || 'local', resendKey: process.env.RESEND_API_KEY, resendWebhook: process.env.RESEND_WEBHOOK_SECRET, mailPublicUrl: process.env.MAIL_PUBLIC_URL || 'https://www.archenlicht.de', mailTestRecipients: (process.env.MAIL_TEST_RECIPIENTS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean), mailEnabledSince: process.env.MAIL_ENABLED_SINCE, paymentMode: process.env.PAYMENT_MODE || 'local', dataDir: resolve(process.env.DATA_DIR || 'data/test'), adminEmail: process.env.ADMIN_EMAIL || 'jonas@archenlicht.test', adminPassword: process.env.ADMIN_PASSWORD || undefined, sessionHours: Math.min(24, Math.max(1, Number(process.env.SESSION_HOURS) || 2)), baseUrl: process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 3000}`), printBaseUrl: process.env.PRINT_BASE_URL || '', stripeKey: process.env.STRIPE_SECRET_KEY, stripeWebhook: process.env.STRIPE_WEBHOOK_SECRET, stripePaymentConfiguration: process.env.STRIPE_PAYMENT_CONFIGURATION, autoShip: true, storageMode: process.env.STORAGE_MODE || (process.env.VERCEL === '1' ? 'postgres' : 'sqlite'), databaseUrl: process.env.DATABASE_URL, databaseSchema: process.env.DATABASE_SCHEMA || 'public', serverless: process.env.VERCEL === '1', workerSecret: process.env.CRON_SECRET, platformOrigins: [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map(host => `https://${host}`).concat((process.env.SHOP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(value => /^https:\/\/[^/]+$/.test(value))) });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
function send(res, status, data, type = 'application/json; charset=utf-8') { res.writeHead(status, { 'Content-Type': type }); res.end(type.startsWith('application/json') ? JSON.stringify(data) : data); }
async function rawBody(req, limit = 20000) { const chunks = []; let length = 0; for await (const chunk of req) { length += chunk.length; if (length > limit) throw new ShopError('Die Eingabe ist zu groß.', 413); chunks.push(chunk); } return Buffer.concat(chunks).toString('utf8'); }
function readCookie(req, name) { return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1); }
const capability = req => /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '')?.[1];
export async function createApp(config = defaultConfig()) {
  const shop = (await Shop.create(config)); const authLimits = new Map();
  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, config.baseUrl), path = url.pathname, method = req.method;
      if (path === '/api/health') return send(res, 200, { ok: true, mode: 'test', simulatedPayments: config.paymentMode === 'local', simulatedFulfillment: true, podbaseMode: config.podbaseMode, podbaseOrderSubmissionEnabled: false });
      if (path === '/api/jobs') {
        if (!config.workerSecret || req.headers.authorization !== `Bearer ${config.workerSecret}`) throw new ShopError('Zugriff nicht erlaubt.', 403);
        await shop.tick(); return send(res, 200, { ok: true, simulated: true });
      }
      if (path === '/api/newsletter/one-click' && method === 'POST') {
        const raw = await rawBody(req, 1000);
        if (new URLSearchParams(raw).get('List-Unsubscribe') !== 'One-Click') throw new ShopError('Ungültige Abmeldung.');
        return send(res, 200, await shop.newsletter.unsubscribe(url.searchParams.get('token')));
      }
      if (path === '/api/webhooks/resend' && method === 'POST') {
        const raw = await rawBody(req, 256000);
        return send(res, 200, await shop.mailer.webhook(raw, req.headers));
      }
      if (path.startsWith('/api/webhooks/') && method === 'POST') {
        if (config.paymentMode !== 'sandbox') throw new ShopError('Anbieter-Webhooks sind im lokalen Zahlungsmodus gesperrt.', 403);
        const raw = await rawBody(req, 256000); let event; try { event = JSON.parse(raw); } catch { throw new ShopError('Ungültiges Ereignis.'); }
        let order;
        if (path === '/api/webhooks/stripe') {
          if (!shop.payments.verifyStripeSignature(raw, req.headers['stripe-signature'])) throw new ShopError('Ungültige Webhook-Signatur.', 401);
          if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) return send(res, 200, { ignored: true });
          if (!event.id || event.livemode !== false) throw new ShopError('Nur gültige Stripe-Testereignisse sind zulässig.', 400);
          order = (await shop.s.get('SELECT * FROM orders WHERE payment_id=?', event.data?.object?.id || ''));
        }
        if (!order) return send(res, 200, { ignored: true });
        const verified = await shop.payments.verify(order);
        if (!verified.completed) {
          if (event.type === 'checkout.session.expired' && verified.status === 'expired') await shop.s.run("UPDATE orders SET status='expired' WHERE id=? AND paid_at IS NULL", order.id);
          if (event.type === 'checkout.session.async_payment_failed' && verified.status === 'complete') await shop.s.run("UPDATE orders SET status='payment_failed' WHERE id=? AND paid_at IS NULL", order.id);
          await shop.newsletter.release(order.id);
          return send(res, 200, { pending: true });
        }
        (await shop.acceptPayment({ ...verified, id: `${path}:${event.id}` }));
        return send(res, 200, { received: true });
      }
      let secret = readCookie(req, 'archenlicht_session'), session = (await shop.session(secret));
      const setSession = value => res.setHeader('Set-Cookie', `archenlicht_session=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.round(config.sessionHours * 3600)}${config.baseUrl.startsWith('https:') ? '; Secure' : ''}`);
      if (path.startsWith('/api/')) {
        if (!session) {
          const sourceParam = url.searchParams.get('source'), source = ['tiktok', 'gemeinde', 'sonstige'].includes(sourceParam) ? sourceParam : 'unbekannt';
          const campaign = /^[a-zA-Z0-9_-]{1,40}$/.test(url.searchParams.get('campaign') || '') ? url.searchParams.get('campaign') : null;
          const created = (await shop.createSession(source, campaign)); session = created.session; secret = created.secret; setSession(secret);
        }
        let body = {};
        if (!['GET', 'HEAD'].includes(method)) {
          const origin = req.headers.origin;
          const allowed = new Set([new URL(config.baseUrl).origin, ...(config.platformOrigins || []), `http://127.0.0.1:${server.address()?.port}`, `http://localhost:${server.address()?.port}`]);
          if ((origin && !allowed.has(origin)) || req.headers['x-csrf-token'] !== session.csrf) throw new ShopError('Die Sitzung ist abgelaufen. Bitte lade die Seite neu.', 403);
          if (!req.headers['content-type']?.startsWith('application/json')) throw new ShopError('Bitte JSON verwenden.', 415);
          const raw = await rawBody(req); try { body = raw ? JSON.parse(raw) : {}; } catch { throw new ShopError('Ungültige Eingabe.'); }
          if (!body || Array.isArray(body) || typeof body !== 'object') throw new ShopError('Ungültige Eingabe.');
        }
        if (path === '/api/bootstrap' && method === 'GET') return send(res, 200, (await shop.publicState(session)));
        if (path === '/api/newsletter/subscribe' && method === 'POST') return send(res, 200, await shop.newsletter.subscribe(body, session, config.serverless ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress));
        if (path === '/api/newsletter/confirm' && method === 'POST') return send(res, 200, await shop.newsletter.confirm(body.token));
        if (path === '/api/newsletter/unsubscribe' && method === 'POST') return send(res, 200, await shop.newsletter.unsubscribe(body.token));
        if (path === '/api/newsletter/quote' && method === 'POST') {
          await shop.newsletter.limit('quote:' + session.id, 20, 3600000);
          const discount = await shop.newsletter.discount(body.code, body.email, await shop.cart(session));
          return send(res, 200, { items: discount.items });
        }
        if (path === '/api/preview' && method === 'POST') return send(res, 200, (await shop.preview(body)));
        if (path === '/api/events' && method === 'POST') { (await shop.track(session, body.type, body.kind, body.designId)); return send(res, 200, { ok: true }); }
        if (path === '/api/cart' && method === 'GET') return send(res, 200, (await shop.cart(session)));
        if (path === '/api/cart' && method === 'POST') return send(res, 200, (await shop.saveCart(session, body)));
        const cartMatch = /^\/api\/cart\/([a-f0-9-]{36})$/.exec(path);
        if (cartMatch && method === 'PUT') return send(res, 200, (await shop.saveCart(session, body, cartMatch[1])));
        if (cartMatch && method === 'DELETE') return send(res, 200, (await shop.removeCart(session, cartMatch[1])));
        if (path === '/api/advisor' && method === 'POST') return send(res, 200, shop.advise(session, body.situation));
        if (path === '/api/advisor' && method === 'GET') return send(res, 200, { situation: shop.situations.get(session.id)?.text || '', expires: session.expires });
        if (path === '/api/advisor' && method === 'DELETE') { shop.situations.delete(session.id); return send(res, 200, { ok: true }); }
        if (['/api/auth/login', '/api/auth/register'].includes(path) && method === 'POST') {
          const now = Date.now(), attempts = authLimits.get(session.id) || { n: 0, until: now + 900000 };
          if (attempts.until < now) attempts.n = 0;
          if (++attempts.n > 10) throw new ShopError('Zu viele Anmeldeversuche. Bitte warte 15 Minuten.', 429);
          authLimits.set(session.id, attempts);
          const current = (await shop.authenticate(session, body, path.endsWith('/register'))); setSession(current.secret); return send(res, 200, (await shop.publicState(current.session)));
        }
        if (path === '/api/auth/logout' && method === 'POST') { shop.situations.delete(session.id); (await shop.s.run('DELETE FROM sessions WHERE id=?', session.id)); const current = (await shop.createSession()); setSession(current.secret); return send(res, 200, (await shop.publicState(current.session))); }
        if (path === '/api/checkout' && method === 'POST') return send(res, 201, await shop.checkout(session, body, { returnOrigin: req.headers.origin || new URL(config.baseUrl).origin }));
        if (path === '/api/account/address') {
          (await shop.requireUser(session));
          if (method === 'GET') return send(res, 200, (await shop.accountDetails(session)));
          if (method === 'PUT') return send(res, 200, (await shop.saveAddress(session, body.recipient || {})));
          if (method === 'DELETE') return send(res, 200, (await shop.removeAddress(session)));
        }
        if (path === '/api/account/payment-methods' && method === 'GET') return send(res, 200, await shop.payments.cardsFor((await shop.requireUser(session))));
        const cardMatch = /^\/api\/account\/payment-methods\/([A-Za-z0-9_-]{1,140})$/.exec(path);
        if (cardMatch && method === 'DELETE') {
          await shop.payments.removeCard((await shop.requireUser(session)), cardMatch[1]);
          return send(res, 200, { ok: true });
        }
        if (path === '/api/account/orders' && method === 'GET') {
          if (!session.user_id) throw new ShopError('Bitte melde dich an, um deine Bestellungen zu sehen.', 401);
          return send(res, 200, (await Promise.all((await shop.s.all('SELECT * FROM orders WHERE user_id=? ORDER BY created DESC', session.user_id)).map(async o => (await shop.orderView(o, session))))));
        }
        const orderMatch = /^\/api\/orders\/([a-f0-9-]{36})(?:\/(confirm|cancel|purpose|verify))?$/.exec(path);
        if (orderMatch) {
          const order = (await shop.authorizeOrder(session, orderMatch[1], capability(req)));
          if (method === 'GET' && !orderMatch[2]) {
            if (config.serverless) await shop.tick();
            return send(res, 200, await shop.orderView(await shop.s.get('SELECT * FROM orders WHERE id=?', order.id), session));
          }
          if (method === 'POST' && orderMatch[2] === 'confirm') {
            (await shop.confirmLocalPayment(session, order, body));
            await shop.tick(); return send(res, 200, (await shop.orderView((await shop.s.get('SELECT * FROM orders WHERE id=?', order.id)), session)));
          }
          if (method === 'POST' && orderMatch[2] === 'verify') {
            const verified = await shop.payments.verify(order);
            if (verified.completed) (await shop.acceptPayment(verified));
            return send(res, 200, (await shop.orderView((await shop.s.get('SELECT * FROM orders WHERE id=?', order.id)), session)));
          }
          if (method === 'POST' && orderMatch[2] === 'cancel') {
            if (!order.paid_at && config.paymentMode === 'local') {
              await shop.s.run("UPDATE orders SET status='cancelled' WHERE id=?", order.id);
              await shop.newsletter.release(order.id);
            } else if (!order.paid_at) {
              await shop.payments.expire(order);
              await shop.s.run("UPDATE orders SET status='expired' WHERE id=? AND paid_at IS NULL", order.id);
              await shop.newsletter.release(order.id);
            }
            return send(res, 200, { ok: true });
          }
          if (method === 'POST' && orderMatch[2] === 'purpose') {
            if (!order.paid_at || !['Für mich', 'Als Geschenk', 'Beides', 'Keine Angabe'].includes(body.purpose)) throw new ShopError('Ungültige Angabe.');
            (await shop.s.run('UPDATE orders SET purpose=? WHERE id=?', body.purpose, order.id)); return send(res, 200, { ok: true });
          }
        }
        if (path === '/api/feedback' && method === 'POST') { if (!['Preis', 'Fehlendes Modell', 'Gestaltung', 'Keine Angabe'].includes(body.reason)) throw new ShopError('Bitte wähle einen Grund aus.'); (await shop.s.run('INSERT INTO feedback VALUES(?,?,?,?)', crypto.randomUUID(), session.visit_id, body.reason, Date.now())); return send(res, 200, { ok: true }); }
        if (path.startsWith('/api/admin/')) {
          (await shop.requireAdmin(session));
          if (path === '/api/admin/podbase' && method === 'GET') {
            const snapshot = await shop.podbaseCatalog?.snapshot({ force: true });
            return send(res, 200, { ...(shop.podbaseCatalog?.summary(snapshot) || { mode: 'local', connected: false, fulfillmentMode: 'simulated', orderSubmissionEnabled: false }), models: snapshot?.models || [] });
          }
          if (path === '/api/admin/analytics' && method === 'GET') return send(res, 200, (await shop.analytics(Number(url.searchParams.get('from') || Date.now() - 30 * 86400000), Number(url.searchParams.get('to') || Date.now() + 86400000))));
          if (path === '/api/admin/mail' && method === 'GET') return send(res, 200, (await shop.s.all("SELECT * FROM mail_outbox WHERE status='local-delivered' ORDER BY created DESC LIMIT 100")));
          if (path === '/api/admin/mail-status' && method === 'GET') return send(res, 200, await shop.s.all('SELECT m.id,m.order_id,m.kind,m.recipient,m.subject,m.status,d.provider_id,d.attempts,d.last_error,d.accepted_at FROM mail_outbox m JOIN mail_deliveries d ON d.mail_id=m.id ORDER BY m.created DESC LIMIT 100'));
          if (path === '/api/admin/orders' && method === 'GET') return send(res, 200, (await Promise.all((await shop.s.all('SELECT * FROM orders ORDER BY created DESC LIMIT 100')).map(async o => (await shop.orderView(o))))));
          if (path === '/api/admin/test' && method === 'POST') {
            if (['ok', 'reject', 'timeout'].includes(body.podbase)) shop.podbase.scenario = body.podbase;
            if (['ok', 'unavailable', 'no-match'].includes(body.advisor)) shop.advisorScenario = body.advisor;
            if (body.variant) { const { modelId, designId, available } = body.variant; if (!MODELS.some(m => m.id === modelId) || !DESIGNS.some(d => d.id === designId) || typeof available !== 'boolean') throw new ShopError('Ungültige Testvariante.'); (await shop.s.run('UPDATE variants SET available=? WHERE model_id=? AND design_id=?', available ? 1 : 0, modelId, designId)); }
            if (body.advanceOrder) (await shop.podbase.advance(body.advanceOrder));
            if (body.retryOrder) { const f = (await shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', body.retryOrder)); if (f?.state === 'rejected') (await shop.s.run("UPDATE fulfillment SET state='ready',error=NULL WHERE order_id=?", body.retryOrder)); }
            await shop.tick(); return send(res, 200, { ok: true, podbase: shop.podbase.scenario, advisor: shop.advisorScenario });
          }
        }
        throw new ShopError('Diese Seite wurde nicht gefunden.', 404);
      }
      if (!['GET', 'HEAD'].includes(method)) throw new ShopError('Methode nicht erlaubt.', 405);
      const print = /^\/prints\/([a-f0-9]{64})\.(svg|png|preview\.svg)$/.exec(path);
      if (print) { const data = await shop.printFile(print[1], print[2]); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); return send(res, 200, data, print[2].endsWith('svg') ? mime['.svg'] : mime['.png']); }
      const art = /^\/assets\/design-([a-z-]+)\.svg$/.exec(path);
      if (art && DESIGNS.some(d => d.id === art[1])) { const layout = renderLayout({ kind: 'fixed', designId: art[1], modelId: MODELS[0].id }); return send(res, 200, layout.svg, mime['.svg']); }
      const staticPath = resolve(root, 'public', `.${decodeURIComponent(path)}`);
      if (staticPath.startsWith(resolve(root, 'public') + sep) && extname(path)) {
        try { if ((await stat(staticPath)).isFile()) return send(res, 200, await readFile(staticPath), mime[extname(path)] || 'application/octet-stream'); } catch {}
        throw new ShopError('Datei nicht gefunden.', 404);
      }
      let html = await readFile(join(root, 'public/index.html'), 'utf8');
      const product = /^\/kollektion\/([a-z-]+)$/.exec(path), design = product && DESIGNS.find(d => d.id === product[1]);
      const valid = ['/', '/newsletter', '/newsletter/bestaetigen', '/newsletter/abmelden', '/kollektion', '/bundle', '/gestalten', '/warenkorb', '/kasse', '/konto', '/auswertung', '/ueber-uns', '/faq', '/impressum', '/datenschutz', '/agb', '/widerruf', '/versand'].includes(path) || design || /^\/(bestellung|testzahlung|zahlungsrueckkehr)\/[a-f0-9-]{36}$/.test(path);
      html = html.replace('<!--PAGE_TITLE-->', design ? `${design.title} · ${design.reference} | Archenlicht` : 'Archenlicht · Ein Vers für deinen Alltag');
      return send(res, valid ? 200 : 404, html, mime['.html']);
    } catch (e) {
      config.onError?.(e);
      if (res.headersSent) return res.end();
      if (!(e instanceof ShopError)) console.error('Eine Anfrage konnte nicht verarbeitet werden. Keine Eingabedaten protokolliert.');
      send(res, e.status || 500, { error: e instanceof ShopError ? e.message : 'Das hat gerade nicht geklappt. Bitte versuche es erneut.' });
    }
  };
  const server = http.createServer(handler);
  const timer = config.serverless ? null : setInterval(() => shop.tick().catch(() => console.error('Statusabgleich wird erneut versucht.')), 3000); timer?.unref();
  server.on('close', async () => { if (timer) clearInterval(timer); await shop.close(); });
  return { server, shop, handler };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = defaultConfig(), { server } = (await createApp(config));
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
    console.log(`\nArchenlicht · lokaler Testshop\n${config.baseUrl}\nZahlungen: ${config.paymentMode === 'local' ? 'lokal simuliert' : 'Anbieter-Sandbox'} · Podbase-Katalog: ${config.podbaseMode === 'catalog' ? 'verbunden (nur lesend)' : 'lokal simuliert'}; Produktion: simuliert; E-Mails: ${config.mailMode}\nAdminzugang: ${join(config.dataDir, 'admin-access.txt')}\n`);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => (await server.close()));
}
