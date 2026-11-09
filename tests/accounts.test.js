import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createApp, defaultConfig } from '../server/index.js';
import { Shop } from '../server/shop.js';
import { podbasePayload } from '../server/podbase.js';

const delivery = { name: 'Anna Mustermann', email: 'anna@example.test', phone: '+4915112345678', street: 'Hoffnungsweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' };
const product = { kind: 'fixed', designId: 'unter-seinen-fluegeln', modelId: 'iphone-15' };

test('Deutsche Telefonnummern mit 0 und +49 werden vor Speicherung und Lieferung vereinheitlicht', async t => {
  const { shop, account, checkout } = await fixture(t), { c } = await account();
  for (const phone of ['0172 1234567', '+49 172 1234567', '0049 172 1234567', '0172-1234567', '(0172) 1234567', '0172/1234567']) {
    const saved = await c.call('/api/account/address', 'PUT', { recipient: { ...delivery, phone } });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.address.phone, '+491721234567');
  }
  assert.equal(shop.validateRecipient({ ...delivery, phone: '030 1234567' }).phone, '+49301234567');
  assert.equal(shop.validateRecipient({ ...delivery, phone: '+43 664 1234567' }).phone, '+436641234567');
  for (const phone of ['1721234567', '+49 0172 1234567', '0172abc1234567', '0', '++491721234567', '0172123456789012345']) assert.throws(() => shop.validateRecipient({ ...delivery, phone }), /Telefonnummer/);
  for (const phone of ['0172 1234567', '+49 172 1234567']) {
    const id = await checkout(c, { recipient: { ...delivery, phone } });
    const order = await shop.s.get('SELECT * FROM orders WHERE id=?', id);
    assert.equal(JSON.parse(order.recipient).phone, '+491721234567');
    assert.equal(podbasePayload(order, 'https://www.archenlicht.de').buyerInfo.phone, '+491721234567');
  }
});
const configForTest = () => ({ ...defaultConfig(), dataDir: resolve('test-results', randomUUID()), paymentMode: 'local', adminPassword: 'Nur-Test-Admin-2026!', autoShip: false });
async function fixture(t) {
  const config = configForTest(), app = (await createApp(config));
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(async r => (await app.server.close(r))); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '', csrf = '';
    return {
      async call(path, method = 'GET', body) {
        const r = await fetch(base + path, { method, headers: { Cookie: cookie, ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
        const data = await r.json(); if (data.csrf) csrf = data.csrf;
        return { status: r.status, data };
      }
    };
  }
  const account = async (email = `kunde-${randomUUID()}@example.test`) => {
    const c = client(); await c.call('/api/bootstrap');
    const r = await c.call('/api/auth/register', 'POST', { email, password: 'Nur-Test-Kundenkonto-2026!' });
    assert.equal(r.status, 200); return { c, email, user: r.data.user };
  };
  const checkout = async (c, options = {}) => {
    assert.equal((await c.call('/api/cart', 'POST', product)).status, 200);
    const r = await c.call('/api/checkout', 'POST', { method: 'card', recipient: delivery, ...options });
    assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data.orderId;
  };
  const confirm = (c, id, options = {}) => c.call(`/api/orders/${id}/confirm`, 'POST', options);
  return { ...app, config, client, account, checkout, confirm };
}

test('Lieferdaten nur mit Opt-in nach Zahlung; spätere Sitzung erhält die gespeicherten Angaben', async t => {
  const { account, checkout, confirm } = await fixture(t), { c, email } = await account();
  let id = await checkout(c); assert.equal((await confirm(c, id)).status, 200);
  assert.equal((await c.call('/api/account/address')).data.address, null);
  assert.equal((await c.call('/api/account/payment-methods')).data.length, 0);
  id = await checkout(c, { saveAddress: true });
  assert.equal((await c.call('/api/account/address')).data.address, null); // Pending payment cannot save it.
  assert.equal((await confirm(c, id)).status, 200);
  assert.deepEqual((await c.call('/api/bootstrap')).data.account.address, delivery);
  await c.call('/api/auth/logout', 'POST', {});
  assert.equal((await c.call('/api/bootstrap')).data.account, null);
  assert.equal((await c.call('/api/auth/login', 'POST', { email, password: 'Nur-Test-Kundenkonto-2026!' })).status, 200);
  assert.deepEqual((await c.call('/api/bootstrap')).data.account.address, delivery);
  const gift = { ...delivery, name: 'Mara Geschenk', street: 'Geschenkweg 22' };
  id = await checkout(c, { recipient: gift }); assert.equal((await confirm(c, id)).status, 200);
  assert.deepEqual((await c.call('/api/account/address')).data.address, delivery); // A different recipient never silently overwrites the profile.
});

test('Keine Speicherung bei Abbruch; geänderte oder entfernte Kontoadresse wird nicht von verspäteter Zahlung überschrieben', async t => {
  const { account, checkout, confirm, shop } = await fixture(t), { c } = await account();
  const cancelled = await checkout(c, { saveAddress: true }); await c.call(`/api/orders/${cancelled}/cancel`, 'POST', {});
  assert.equal((await c.call('/api/account/address')).data.address, null);
  const pending = await checkout(c, { saveAddress: true });
  const changed = { ...delivery, street: 'Neuer Weg 42' };
  assert.equal((await c.call('/api/account/address', 'PUT', { recipient: changed })).status, 200);
  assert.equal((await confirm(c, pending)).status, 200);
  assert.deepEqual((await c.call('/api/account/address')).data.address, changed);
  const another = await checkout(c, { saveAddress: true });
  assert.equal((await c.call('/api/account/address', 'DELETE', {})).status, 200);
  assert.equal((await confirm(c, another)).status, 200);
  assert.equal((await c.call('/api/account/address')).data.address, null);
  assert.equal(JSON.parse((await shop.s.get('SELECT recipient FROM orders WHERE id=?', pending)).recipient).street, delivery.street); // Order snapshot remains correct.
  assert.equal((await c.call('/api/account/address', 'PUT', { recipient: { ...delivery, country: 'AT' } })).status, 400);
});

test('Demo-Karte wird nur ausdrücklich gespeichert, wiederverwendet und entfernt; keine echten Kartendaten', async t => {
  const { account, checkout, confirm, shop } = await fixture(t), { c, email } = await account();
  const first = await checkout(c); assert.equal((await confirm(c, first)).status, 200);
  assert.deepEqual((await c.call('/api/account/payment-methods')).data, []);
  const second = await checkout(c); assert.equal((await confirm(c, second, { saveCard: true })).status, 200);
  const cards = (await c.call('/api/account/payment-methods')).data;
  assert.equal(cards.length, 1); assert.equal(cards[0].simulated, true); assert.equal(cards[0].last4, '4242'); assert.equal(cards[0].brand, 'visa');
  assert.deepEqual(Object.keys(cards[0]).sort(), ['id', 'brand', 'last4', 'expMonth', 'expYear', 'simulated'].sort());
  await c.call('/api/auth/logout', 'POST', {});
  await c.call('/api/auth/login', 'POST', { email, password: 'Nur-Test-Kundenkonto-2026!' });
  const third = await checkout(c); assert.equal((await confirm(c, third, { savedCardId: cards[0].id })).status, 200);
  assert.equal((await c.call('/api/account/payment-methods')).data.length, 1);
  assert.equal((await c.call(`/api/account/payment-methods/${cards[0].id}`, 'DELETE', {})).status, 200);
  assert.equal((await c.call('/api/account/payment-methods')).data.length, 0);
  await confirm(c, second, { saveCard: true }); // Replaying an old payment must not restore a deleted card.
  assert.equal((await c.call('/api/account/payment-methods')).data.length, 0);
  const localData = JSON.stringify((await shop.s.all('SELECT * FROM local_payment_methods')));
  assert.equal(localData.includes('4242424242424242'), false);
  assert.equal((await shop.s.all('PRAGMA table_info(local_payment_methods)')).some(c => /cvc|cvv|number|pan/i.test(c.name)), false);
});

test('Gespeicherte Adressen und Karten sind kontogebunden; Gäste können sie nicht hinterlegen', async t => {
  const { account, checkout, confirm, client } = await fixture(t), a = await account(), b = await account();
  const id = await checkout(a.c, { saveAddress: true }); assert.equal((await confirm(a.c, id, { saveCard: true })).status, 200);
  assert.equal((await b.c.call('/api/account/address')).data.address, null);
  assert.deepEqual((await b.c.call('/api/account/payment-methods')).data, []);
  const card = (await a.c.call('/api/account/payment-methods')).data[0];
  assert.equal((await b.c.call(`/api/account/payment-methods/${card.id}`, 'DELETE', {})).status, 404);
  const otherOrder = await checkout(b.c);
  assert.equal((await confirm(b.c, otherOrder, { savedCardId: card.id })).status, 404);
  assert.equal((await b.c.call(`/api/orders/${otherOrder}`)).data.paid, false);
  const guest = client(); await guest.call('/api/bootstrap'); await guest.call('/api/cart', 'POST', product);
  assert.equal((await guest.call('/api/checkout', 'POST', { recipient: delivery, method: 'card', saveAddress: true })).status, 401);
  for (const path of ['/api/account/address', '/api/account/payment-methods']) assert.equal((await guest.call(path)).status, 401);
  const guestCheckout = await guest.call('/api/checkout', 'POST', { recipient: delivery, method: 'card' });
  assert.equal((await confirm(guest, guestCheckout.data.orderId, { saveCard: true })).status, 403);
  assert.equal((await guest.call(`/api/orders/${guestCheckout.data.orderId}`)).data.paid, false);
  const paypalOrder = await checkout(a.c, { method: 'paypal' });
  assert.equal((await confirm(a.c, paypalOrder, { saveCard: true })).status, 403);
});

test('Gespeicherte Kontodaten überstehen Neustarts ohne bestehende Nutzer oder Bestellungen zu verändern', async () => {
  const config = configForTest(); let shop = (await Shop.create(config));
  const first = (await shop.createSession()), authenticated = (await shop.authenticate(first.session, { email: 'persist@example.test', password: 'Nur-Test-Persistenz-2026!' }, true));
  (await shop.saveAddress(authenticated.session, delivery)); const userId = authenticated.session.user_id; (await shop.close());
  shop = (await Shop.create(config));
  try { const created = (await shop.createSession()), loggedIn = (await shop.authenticate(created.session, { email: 'persist@example.test', password: 'Nur-Test-Persistenz-2026!' })); assert.equal(loggedIn.session.user_id, userId); assert.deepEqual((await shop.accountDetails(loggedIn.session)).address, delivery); } finally { (await shop.close()); }
});
