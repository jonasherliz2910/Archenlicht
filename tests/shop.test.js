import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import sharp from 'sharp';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';
import { renderLayout, rasterize } from '../server/layout.js';
import { VERSES, DESIGNS, MODELS } from '../server/catalog.js';
import { PodbaseAPI } from '../server/podbase.js';
import { Payments } from '../server/payments.js';

const recipient = { name: 'Mara Mustermann', email: 'mara@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };
const fixed = { kind: 'fixed', designId: 'unter-seinen-fluegeln', modelId: 'iphone-15', dedication: '' };
const custom = { kind: 'custom', designId: 'nach-dem-sturm', modelId: 'samsung-galaxy-s24', verseId: 'jes41-10', dedication: 'Für Anna · 2026' };
function configuration() { return { ...defaultConfig(), dataDir: resolve('test-results', randomUUID()), adminPassword: 'Nur-Test-Admin-2026!', autoShip: false }; }
async function setup(t) {
  const config = configuration(), app = (await createApp(config)); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(async resolve => (await app.server.close(resolve))); });
  function client() {
    let cookie = '', csrf = '';
    return {
      async call(path, method = 'GET', body, headers = {}) {
        const response = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        const data = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
        if (data?.csrf) csrf = data.csrf;
        return { status: response.status, data, headers: response.headers };
      },
      get cookie() { return cookie; }, get csrf() { return csrf; }
    };
  }
  return { ...app, config, base, client };
}
async function putCart(c, configuration, quantity = 1) { const r = await c.call('/api/cart', 'POST', { ...configuration, quantity }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; }
async function checkout(c, method = 'paypal') { const r = await c.call('/api/checkout', 'POST', { recipient, method }); assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data; }

test('Beide vollständigen Kaufwege, identische Druckdatei, Konto, Gastlink, Versand und Kennzahlen', async t => {
  const { shop, client, base } = await setup(t), guest = client(), account = client();
  await guest.call('/api/bootstrap?source=tiktok&campaign=fluegel');
  await guest.call('/api/events', 'POST', { type: 'view', kind: 'fixed', designId: fixed.designId });
  const fixedCart = await putCart(guest, fixed);
  assert.equal(fixedCart[0].printText, 'Psalm 91,4'); assert.equal(fixedCart[0].unitPrice, 2999);
  const first = await checkout(guest);
  await guest.call(`/api/orders/${first.orderId}`); // Returning to status never fulfills.
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
  const confirms = await Promise.all(Array.from({ length: 6 }, () => guest.call(`/api/orders/${first.orderId}/confirm`, 'POST', {})));
  for (const r of confirms) assert.equal(r.status, 200);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM payment_events')).n, 1);
  assert.equal((await shop.s.get("SELECT COUNT(*) AS n FROM mail_outbox WHERE kind='confirmation' AND status='local-delivered'")).n, 1);
  await account.call('/api/bootstrap?source=gemeinde&campaign=gemeinde-test');
  const privateText = 'Ein Neuanfang mit Angst PRIVATE-SITUATION-8891';
  const advice = await account.call('/api/advisor', 'POST', { situation: privateText });
  assert.equal(advice.status, 200); assert.equal(advice.data.recommendations.length, 3); assert.equal(new Set(advice.data.recommendations.map(v => v.id)).size, 3);
  for (const v of advice.data.recommendations) assert.equal(v.quote, VERSES.find(x => x.id === v.id).quote);
  const oldCookie = account.cookie;
  const registered = await account.call('/api/auth/register', 'POST', { email: 'anna@example.test', password: 'Nur-Test-Anna-2026!' });
  assert.equal(registered.status, 200); assert.notEqual(account.cookie, oldCookie); assert.equal(registered.data.user.role, 'customer');
  await account.call('/api/events', 'POST', { type: 'view', kind: 'custom', designId: custom.designId });
  const initial = await putCart(account, { ...custom, verseId: advice.data.recommendations[0].id });
  const updated = await account.call(`/api/cart/${initial[0].id}`, 'PUT', { ...custom, quantity: 1, dedication: 'Für Anna · 2027' });
  assert.equal(updated.status, 200); assert.equal(updated.data.length, 1); assert.equal(updated.data[0].id, initial[0].id); assert.match(updated.data[0].printText, /2027/);
  const second = await checkout(account, 'card');
  assert.equal((await account.call(`/api/orders/${second.orderId}/confirm`, 'POST', {})).status, 200);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 2);
  const saved = JSON.parse((await shop.s.get('SELECT items FROM orders WHERE id=?', second.orderId)).items)[0];
  assert.equal(saved.hash, updated.data[0].hash); assert.equal(saved.printText, updated.data[0].printText); assert.equal(saved.configuration.dedication, 'Für Anna · 2027');
  const payload = JSON.parse((await shop.s.get('SELECT payload FROM provider_orders WHERE external_id=?', second.orderId)).payload);
  assert.equal(payload.buyerInfo.phone, recipient.phone); assert.equal(payload.externalOrderId, second.orderId); assert.equal(payload.shippingTypeId, 'PBS-F7-7ZH-223S'); assert.match(payload.items[0].printFile, new RegExp(`${saved.hash}\\.png$`));
  assert.equal(payload.items[0].productId, 'SIM-TOUGH'); assert.equal(payload.items[0].quantity, 1); assert.ok(payload.items[0].externalProductId);
  const png = await fetch(`${base}/prints/${saved.hash}.png`), pngBytes = Buffer.from(await png.arrayBuffer());
  assert.equal(png.status, 200); const metadata = await sharp(pngBytes).metadata(); assert.equal(metadata.width, 1200); assert.equal(metadata.height, 2400); assert.equal(metadata.density, 300);
  const svg = await (await fetch(`${base}/prints/${saved.hash}.svg`)).text();
  assert.deepEqual(await sharp(pngBytes).raw().toBuffer(), await sharp(await rasterize(svg)).raw().toBuffer());
  assert.equal(svg.includes('Archenlicht'), false); assert.equal(svg.includes('<text'), false); // All printed type is outlined.
  assert.equal((await account.call('/api/account/orders')).data.length, 1);
  assert.equal((await account.call(`/api/orders/${first.orderId}`)).status, 404);
  assert.equal((await guest.call(`/api/orders/${second.orderId}`)).status, 404);
  const mail = (await shop.s.get("SELECT body FROM mail_outbox WHERE order_id=? AND kind='confirmation'", first.orderId)).body;
  const guestToken = /#token=([\w-]+)/.exec(mail)[1], outsider = client(); await outsider.call('/api/bootstrap');
  assert.equal((await outsider.call(`/api/orders/${first.orderId}`)).status, 404);
  assert.equal((await outsider.call(`/api/orders/${first.orderId}`, 'GET', undefined, { Authorization: `Bearer ${guestToken}` })).status, 200);
  assert.equal((await outsider.call(`/api/orders/${first.orderId}`)).status, 200);
  assert.equal((await outsider.call('/api/admin/analytics')).status, 403);
  for (const order of [first, second]) { (await shop.podbase.advance(order.orderId)); await shop.tick(); await shop.tick(); }
  for (const [c, o] of [[guest, first], [account, second]]) { const view = (await c.call(`/api/orders/${o.orderId}`)).data; assert.equal(view.status, 'shipped'); assert.match(view.fulfillment.tracking, /^SIM-DE-/); }
  assert.equal((await shop.s.get("SELECT COUNT(*) AS n FROM mail_outbox WHERE kind='shipping'")).n, 2);
  for (let n = 0; n < 4; n++) await guest.call(`/api/orders/${first.orderId}`);
  await guest.call(`/api/orders/${first.orderId}/purpose`, 'POST', { purpose: 'Als Geschenk' });
  const admin = client(); await admin.call('/api/bootstrap');
  assert.equal((await admin.call('/api/auth/login', 'POST', { email: 'jonas@archenlicht.test', password: 'Nur-Test-Admin-2026!' })).status, 200);
  const a = (await admin.call('/api/admin/analytics')).data;
  assert.equal(a.paidOrders, 2); assert.equal(a.units, 2); assert.equal(a.revenue, 6498); assert.equal(a.sources.find(s => s.source === 'tiktok').paidOrders, 1); assert.equal(a.sources.find(s => s.source === 'gemeinde').paidOrders, 1);
  assert.equal(a.products.find(p => p.id === 'fixed').cartVisits, 1); assert.equal(a.products.find(p => p.id === 'custom').cartVisits, 1);
  assert.equal(a.purposes.find(p => p.purpose === 'Als Geschenk').orders, 1);
  for (const name of ['orders', 'events', 'mail_outbox', 'visits', 'sessions', 'users', 'assets', 'provider_orders', 'feedback', 'account_profiles', 'payment_customers', 'local_payment_methods', 'checkout_preferences']) assert.equal(JSON.stringify((await shop.s.all(`SELECT * FROM ${name}`))).includes('PRIVATE-SITUATION-8891'), false, `Situation leaked into ${name}`);
  assert.equal((await account.call('/api/advisor')).data.situation, privateText);
  await account.call('/api/auth/logout', 'POST', {}); assert.equal((await account.call('/api/advisor')).data.situation, '');
  assert.equal((await account.call('/api/account/orders')).status, 401);
  assert.equal((await account.call('/api/auth/login', 'POST', { email: 'anna@example.test', password: 'Nur-Test-Anna-2026!' })).status, 200);
  assert.equal((await account.call('/api/account/orders')).data[0].id, second.orderId);
});

test('Beratungsausfall, fehlende Treffer und Sitzung verwerfen Situationen', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap');
  shop.advisorScenario = 'unavailable'; let result = await c.call('/api/advisor', 'POST', { situation: 'Angst vor einem Neuanfang' });
  assert.equal(result.data.recommendations.length, 0); assert.equal(result.data.designs.length, 6); assert.match(result.data.reason, /nicht erreichbar/);
  shop.advisorScenario = 'ok'; result = await c.call('/api/advisor', 'POST', { situation: 'Quantencomputer Fußball xyz' });
  assert.equal(result.data.designs.length, 6); assert.match(result.data.reason, /keine passende/);
  const sid = (await shop.s.all('SELECT id FROM sessions'))[0].id; assert.ok(shop.situations.get(sid));
  (await shop.s.run('UPDATE sessions SET expires=? WHERE id=?', Date.now() - 1, sid)); (await shop.cleanup());
  assert.equal(shop.situations.size, 0); assert.equal((await shop.s.get('SELECT id FROM sessions WHERE id=?', sid)), undefined);
});

test('Druckgrenzen, Metadaten, verfügbare Varianten und ausschließlich DE werden serverseitig geprüft', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap');
  assert.equal((await c.call('/api/preview', 'POST', { ...custom, dedication: 'x'.repeat(33) })).status, 400);
  assert.equal((await c.call('/api/preview', 'POST', { ...custom, dedication: '💚' })).status, 400);
  assert.equal((await c.call('/api/preview', 'POST', { ...custom, printText: 'Fremder Drucktext' })).status, 400);
  VERSES.push({ ...VERSES[0], id: 'long-test', quote: 'Hoffnung '.repeat(250) });
  try { assert.equal((await c.call('/api/preview', 'POST', { ...custom, verseId: 'long-test' })).status, 400); } finally { VERSES.pop(); }
  await putCart(c, fixed);
  (await shop.s.run('UPDATE variants SET available=0 WHERE model_id=? AND design_id=?', fixed.modelId, fixed.designId));
  assert.equal((await c.call('/api/checkout', 'POST', { recipient, method: 'paypal' })).status, 409);
  assert.equal((await c.call('/api/cart')).data[0].available, false);
  (await shop.s.run('UPDATE variants SET available=1 WHERE model_id=? AND design_id=?', fixed.modelId, fixed.designId));
  assert.equal((await c.call('/api/checkout', 'POST', { recipient: { ...recipient, country: 'AT' }, method: 'card' })).status, 400);
  assert.equal((await c.call('/api/checkout', 'POST', { recipient: { ...recipient, phone: '' }, method: 'card' })).status, 400);
  assert.equal((await c.call('/api/checkout', 'POST', { recipient: { ...recipient, phone: '01511234567' }, method: 'card' })).status, 400);
});

test('Abgebrochene Zahlung und ungeprüfte Rückkehr lösen keinen Druckauftrag aus', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap'); await putCart(c, fixed); const o = await checkout(c);
  assert.equal((await c.call(`/bestellung/${o.orderId}`)).status, 200);
  await c.call(`/api/orders/${o.orderId}/cancel`, 'POST', {});
  assert.equal((await c.call(`/api/orders/${o.orderId}/confirm`, 'POST', {})).status, 409);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
  assert.equal((await c.call('/api/cart')).data.length, 1);
});

test('Betrag, Währung, Bestellbezug, Provider-ID und Status müssen stimmen', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap'); await putCart(c, fixed); const o = await checkout(c);
  const row = (await shop.s.get('SELECT * FROM orders WHERE id=?', o.orderId)), valid = { id: 'evt-test', orderId: row.id, paymentId: row.payment_id, amount: row.amount, currency: 'EUR', completed: true };
  for (const changes of [{ amount: 1 }, { currency: 'USD' }, { orderId: randomUUID() }, { paymentId: 'other' }, { completed: false }]) (await assert.rejects(async () => (await shop.acceptPayment({ ...valid, ...changes })), /nicht überein/));
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM fulfillment')).n, 0);
  (await shop.acceptPayment(valid)); const duplicate = (await shop.acceptPayment({ ...valid, id: 'evt-another-provider-event' })); assert.equal(duplicate.duplicate, true);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM fulfillment')).n, 1);
});

test('Podbase-Ablehnung bleibt bezahlter offener Fall mit genau einer Admin-Nachricht', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap'); await putCart(c, fixed); const o = await checkout(c);
  shop.podbase.scenario = 'reject'; await c.call(`/api/orders/${o.orderId}/confirm`, 'POST', {}); await shop.tick();
  const order = (await shop.s.get('SELECT * FROM orders WHERE id=?', o.orderId)), job = (await shop.s.get('SELECT * FROM fulfillment WHERE order_id=?', o.orderId));
  assert.ok(order.paid_at); assert.equal(order.status, 'paid'); assert.equal(job.state, 'rejected'); assert.match(job.error, /Testablehnung/);
  const mails = (await shop.s.all("SELECT * FROM mail_outbox WHERE kind='fulfillment-error'")); assert.equal(mails.length, 1); assert.match(mails[0].body, new RegExp(order.number)); assert.match(mails[0].body, /Geschützter Auftragslink/);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
});

test('Unterbrochene Podbase-Antwort wird vor jedem weiteren Auftrag abgeglichen', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap'); await putCart(c, fixed); const o = await checkout(c);
  shop.podbase.scenario = 'timeout'; await c.call(`/api/orders/${o.orderId}/confirm`, 'POST', {});
  assert.equal((await shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', o.orderId)).state, 'uncertain');
  await shop.tick(); await shop.tick();
  assert.equal((await shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', o.orderId)).state, 'production');
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders WHERE external_id=?', o.orderId)).n, 1);
  assert.equal((await shop.s.get('SELECT attempts FROM fulfillment WHERE order_id=?', o.orderId)).attempts, 1);
});

test('Neustart nach Annahme: SQLite-Job und Anbieterabgleich verhindern doppelte Produktion', async () => {
  const config = configuration(); let shop = (await Shop.create(config)); const { session } = (await shop.createSession());
  (await shop.saveCart(session, fixed)); const checkoutResult = await shop.checkout(session, { recipient, method: 'paypal' }); const o = (await shop.s.get('SELECT * FROM orders WHERE id=?', checkoutResult.orderId));
  (await shop.acceptPayment({ id: 'evt-restart', orderId: o.id, paymentId: o.payment_id, amount: o.amount, currency: 'EUR', completed: true }));
  shop.podbase.scenario = 'timeout'; await shop.tick(); (await shop.close());
  shop = (await Shop.create(config)); try { await shop.tick(); assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1); assert.equal((await shop.s.get('SELECT state FROM fulfillment')).state, 'production'); assert.equal((await shop.s.get('SELECT attempts FROM fulfillment')).attempts, 1); } finally { (await shop.close()); }
});

test('Parallele Worker beanspruchen einen Auftrag nur einmal und versenden eine Mail', async () => {
  const config = configuration(), a = (await Shop.create(config)), b = (await Shop.create(config));
  try {
    const { session } = (await a.createSession()); (await a.saveCart(session, fixed)); const result = await a.checkout(session, { recipient, method: 'card' }); const o = (await a.s.get('SELECT * FROM orders WHERE id=?', result.orderId));
    (await a.acceptPayment({ id: 'evt-workers', orderId: o.id, paymentId: o.payment_id, amount: o.amount, currency: 'EUR', completed: true }));
    await Promise.all([(await a.tick()), (await b.tick())]); assert.equal((await a.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 1); assert.equal((await a.s.get('SELECT attempts FROM fulfillment')).attempts, 1);
    (await a.podbase.advance(o.id)); await Promise.all([(await a.tick()), (await b.tick())]); assert.equal((await a.s.get("SELECT COUNT(*) AS n FROM mail_outbox WHERE kind='shipping'")).n, 1);
  } finally { (await a.close()); (await b.close()); }
});

test('Unklarer Versand ohne Treffer wird gehalten; entfernte Variante nach Zahlung wird nicht produziert', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap'); await putCart(c, fixed); const r = await checkout(c);
  const o = (await shop.s.get('SELECT * FROM orders WHERE id=?', r.orderId));
  (await shop.acceptPayment({ id: 'evt-unknown', orderId: o.id, paymentId: o.payment_id, amount: o.amount, currency: 'EUR', completed: true }));
  (await shop.s.run("UPDATE fulfillment SET state='sending' WHERE order_id=?", o.id)); await shop.tick();
  assert.equal((await shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', o.id)).state, 'uncertain'); assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
  await putCart(c, custom); const second = await checkout(c); (await shop.s.run('UPDATE variants SET available=0 WHERE model_id=? AND design_id=?', custom.modelId, custom.designId));
  await c.call(`/api/orders/${second.orderId}/confirm`, 'POST', {}); assert.equal((await shop.s.get('SELECT state FROM fulfillment WHERE order_id=?', second.orderId)).state, 'rejected');
});

test('Ein Fulfillmentauftrag enthält alle Warenkorbpositionen und deren Stückzahlen', async t => {
  const { shop, client } = await setup(t), c = client(); await c.call('/api/bootstrap'); await putCart(c, fixed, 2); await putCart(c, custom, 3); const o = await checkout(c);
  await c.call(`/api/orders/${o.orderId}/confirm`, 'POST', {});
  const provider = (await shop.s.all('SELECT * FROM provider_orders')); assert.equal(provider.length, 1); const payload = JSON.parse(provider[0].payload);
  assert.equal(payload.items.length, 2); assert.deepEqual(payload.items.map(i => i.quantity), [2, 3]); assert.equal((await shop.s.get('SELECT amount FROM orders WHERE id=?', o.orderId)).amount, 14845);
});

test('CSRF, geschützte Adminaktionen, fremde Positionen und private Dateien', async t => {
  const { client } = await setup(t), a = client(), b = client(); await a.call('/api/bootstrap'); await b.call('/api/bootstrap');
  const row = (await putCart(a, fixed))[0]; assert.equal((await b.call(`/api/cart/${row.id}`, 'PUT', fixed)).status, 404);
  assert.equal((await b.call('/api/admin/test', 'POST', { podbase: 'reject' })).status, 403);
  assert.equal((await a.call('/api/cart', 'POST', fixed, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await a.call('/api/cart', 'POST', fixed, { 'X-CSRF-Token': 'wrong' })).status, 403);
  for (const path of ['/data/test/shop.sqlite', '/server/index.js', '/.env', '/fonts/not-here.ttf']) assert.equal((await a.call(path)).status, 404);
  const response = await a.call('/api/bootstrap'); assert.match(response.headers.get('set-cookie') || a.cookie, /archenlicht_session=/); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('Stripe-Signaturprüfung lehnt Fälschungen und alte Events ab; Produktionsadapter bleibt gesperrt', async () => {
  const payments = new Payments({ stripeWebhook: 'only-a-local-fixture' }), raw = JSON.stringify({ id: 'evt-test' }), timestamp = Math.floor(Date.now() / 1000), sig = createHmac('sha256', 'only-a-local-fixture').update(`${timestamp}.${raw}`).digest('hex');
  assert.equal(payments.verifyStripeSignature(raw, `t=${timestamp},v1=${sig}`), true); assert.equal(payments.verifyStripeSignature(`${raw} `, `t=${timestamp},v1=${sig}`), false); assert.equal(payments.verifyStripeSignature(raw, `t=1,v1=${sig}`), false);
  (await assert.rejects(async () => (await Shop.create({ ...configuration(), shopMode: 'live' })), /Livebetrieb/));
  assert.throws(() => new PodbaseAPI({ apiKey: 'fake' }).create({}), /gesperrt/);
});

test('Alle Testlayouts sind für alle Modelle und Verse konsistent und enthalten keinen Markenaufdruck', () => {
  for (const d of DESIGNS) for (const m of MODELS) { const l = renderLayout({ ...fixed, designId: d.id, modelId: m.id }); assert.equal(l.printText, d.reference); assert.equal(l.configuration.templateVersion, m.templateVersion); assert.equal(l.svg.includes('archenlicht'), false); }
  for (const v of VERSES) { const l = renderLayout({ ...custom, verseId: v.id }); assert.equal(l.printText.replaceAll('\n', ' '), `${v.quote} ${v.reference} ${custom.dedication}`); assert.match(v.source, /^https:\/\/www.die-bibel.de\//); assert.equal(v.liveApproved, false); }
});

test('Google Pixel: Modellwahl, Kameravorschau, Warenkorbbearbeitung und beide Hüllenarten bis zum Testversand', async t => {
  const { shop, client } = await setup(t), c = client(), boot = await c.call('/api/bootstrap');
  const pixels = boot.data.models.filter(m => m.brand === 'Google');
  assert.equal(pixels.length, 20); assert.equal(boot.data.models.length, 74);
  assert.equal(new Set(boot.data.models.map(m => m.id)).size, 74);
  assert.equal(new Set(boot.data.models.map(m => m.variantId)).size, 74);
  assert.equal(boot.data.models.find(m => m.id === 'iphone-15').variantId, 'SIM-VARIANT-12');
  assert.equal(boot.data.models.find(m => m.id === 'samsung-galaxy-s21').variantId, 'SIM-VARIANT-20');
  const catalog = await shop.podbase.catalog();
  for (const pixel of pixels) {
    assert.equal(pixel.simulated, true);
    assert.equal(catalog[0].variants.some(v => v.id === pixel.variantId && v.inStock), true);
    assert.equal(boot.data.variants.filter(v => v.model_id === pixel.id && v.available).length, 6);
    const preview = await c.call('/api/preview', 'POST', { ...fixed, modelId: pixel.id });
    assert.equal(preview.status, 200); assert.deepEqual(preview.data.camera, pixel.template.camera);
    assert.equal(preview.data.configuration.templateVersion, 'test-pixel-template-v1');
    assert.ok(preview.data.camera.width > preview.data.camera.height);
  }
  await putCart(c, { ...fixed, modelId: 'google-pixel-8' });
  const rows = await putCart(c, { ...custom, modelId: 'google-pixel-10-pro-xl' }, 2), edit = rows[1];
  const edited = await c.call(`/api/cart/${edit.id}`, 'PUT', { ...custom, modelId: 'google-pixel-10a', quantity: 2 });
  assert.equal(edited.status, 200); assert.equal(edited.data[1].id, edit.id); assert.equal(edited.data[1].model, 'Google Pixel 10a');
  (await shop.s.run('UPDATE variants SET available=0 WHERE model_id=? AND design_id=?', 'google-pixel-10a', custom.designId));
  assert.equal((await c.call('/api/checkout', 'POST', { recipient, method: 'card' })).status, 409);
  (await shop.s.run('UPDATE variants SET available=1 WHERE model_id=? AND design_id=?', 'google-pixel-10a', custom.designId));
  const result = await checkout(c, 'card'), paid = await c.call(`/api/orders/${result.orderId}/confirm`, 'POST', {});
  assert.equal(paid.status, 200); assert.equal(paid.data.amount, 9497);
  const provider = (await shop.s.get('SELECT * FROM provider_orders WHERE external_id=?', result.orderId)), payload = JSON.parse(provider.payload);
  assert.equal(payload.items.length, 2); assert.deepEqual(payload.items.map(i => i.quantity), [1, 2]);
  assert.deepEqual(payload.items.map(i => i.variantId), ['SIM-VARIANT-38', 'SIM-VARIANT-48']);
  assert.equal(paid.data.items[1].hash, edited.data[1].hash);
  const print = await c.call(`/prints/${edited.data[1].hash}.png`);
  assert.equal(print.status, 200); assert.equal((await sharp(print.data).metadata()).width, 1200);
  (await shop.podbase.advance(result.orderId)); await shop.tick();
  const shipped = await c.call(`/api/orders/${result.orderId}`);
  assert.equal(shipped.data.status, 'shipped'); assert.match(shipped.data.fulfillment.tracking, /^SIM-DE-/);
});

test('Aktuelle Apple-, Samsung- und Google-Modelle funktionieren gemeinsam bis zum Testversand', async t => {
  const { shop, client } = await setup(t), c = client(), boot = await c.call('/api/bootstrap');
  const choices = [
    { ...fixed, modelId: 'iphone-18-pro-max' },
    { ...custom, modelId: 'samsung-galaxy-s26-ultra' },
    { ...fixed, modelId: 'google-pixel-11-pro-xl' },
    { ...custom, modelId: 'samsung-galaxy-z-flip8' },
    { ...fixed, modelId: 'iphone-air' },
    { ...custom, modelId: 'samsung-galaxy-a57' }
  ];
  const previews = [];
  for (const choice of choices) {
    assert.ok(boot.data.models.some(m => m.id === choice.modelId && m.simulated));
    const preview = await c.call('/api/preview', 'POST', choice); assert.equal(preview.status, 200);
    previews.push(preview.data); await putCart(c, choice);
  }
  assert.equal(previews[3].configuration.templateVersion, 'test-flip-template-v4');
  for (const unsupported of ['iphone-18', 'google-pixel-11a', 'samsung-galaxy-s27', 'samsung-galaxy-z-fold8']) {
    assert.equal((await c.call('/api/cart', 'POST', { ...fixed, modelId: unsupported })).status, 400);
  }
  const result = await checkout(c, 'paypal'), paid = await c.call(`/api/orders/${result.orderId}/confirm`, 'POST', {});
  assert.equal(paid.status, 200); assert.equal(paid.data.amount, 17545);
  assert.deepEqual(paid.data.items.map(i => i.configuration.modelId), choices.map(c => c.modelId));
  assert.deepEqual(paid.data.items.map(i => i.hash), previews.map(p => p.hash));
  const payload = JSON.parse((await shop.s.get('SELECT payload FROM provider_orders WHERE external_id=?', result.orderId)).payload);
  assert.equal(payload.items.length, 6);
  assert.deepEqual(payload.items.map(i => i.variantId), choices.map(c => boot.data.models.find(m => m.id === c.modelId).variantId));
  (await shop.podbase.advance(result.orderId)); await shop.tick();
  assert.equal((await c.call(`/api/orders/${result.orderId}`)).data.status, 'shipped');
});
