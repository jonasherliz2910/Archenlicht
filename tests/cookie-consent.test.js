import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp, defaultConfig } from '../server/index.js';
import { readConsent, CONSENT_MAX_AGE } from '../public/cookie-policy.js';

test('Only current, explicit cookie choices enable statistics', () => {
  const now = Date.now(), cookie = value => `archenlicht_consent=${value}`;
  assert.equal(readConsent(cookie(`v1.statistics.${now}`), now).statistics, true);
  assert.equal(readConsent(cookie(`v1.necessary.${now}`), now).statistics, false);
  for (const value of ['', 'true', `v0.statistics.${now}`, `v1.all.${now}`, `v1.statistics.${now + 120000}`, `v1.statistics.${now - CONSENT_MAX_AGE * 1000}`]) assert.equal(readConsent(cookie(value), now), null, value);
});

test('Statistics require consent; cart, login and checkout work before and after withdrawal', async t => {
  const app = await createApp({ ...defaultConfig(), storageMode: 'sqlite', shopMode: 'test', paymentMode: 'local', podbaseMode: 'local', printMode: 'preview', mailMode: 'local', newsletterMode: 'local', dataDir: resolve('test-results', randomUUID()), serverless: true, autoShip: false });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => app.server.close(r)));
  const base = `http://127.0.0.1:${app.server.address().port}`, shop = app.shop;
  let sessionCookie = '', choice = '', csrf;
  const call = async (path, body) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: `${sessionCookie}; ${choice}`, ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.headers.get('set-cookie')) sessionCookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    assert.ok(response.ok, JSON.stringify(data));
    if (data.csrf) csrf = data.csrf;
    return data;
  };
  const counts = async () => ({ visits: (await shop.s.get('SELECT COUNT(*) AS n FROM visits')).n, events: (await shop.s.get('SELECT COUNT(*) AS n FROM events')).n });
  const event = { type: 'view', kind: 'fixed', designId: 'nach-dem-sturm' };
  const item = { kind: 'fixed', designId: 'nach-dem-sturm', modelId: 'iphone-14-pro', backgroundId: 'light-blue', quantity: 1 };
  const recipient = { name: 'Cookie Test', email: 'cookie@example.test', phone: '+491721234567', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' };

  await call('/api/bootstrap?source=tiktok&campaign=no-consent');
  await call('/api/events', event); // Direct API callers cannot bypass the choice.
  await call('/api/cart', item);
  assert.deepEqual(await counts(), { visits: 0, events: 0 });
  const first = await call('/api/checkout', { recipient, method: 'card' });
  const beforeOrder = await shop.s.get('SELECT * FROM orders WHERE id=?', first.orderId);
  const sessionBefore = await shop.session(sessionCookie.split('=')[1]);
  assert.equal(beforeOrder.source, 'unbekannt');
  assert.notEqual(beforeOrder.visit_id, sessionBefore.visit_id);

  choice = `archenlicht_consent=v1.statistics.${Date.now()}`;
  await call('/api/privacy/consent', { source: 'gemeinde', campaign: 'consented' });
  await call('/api/events', event);
  await call('/api/events', event);
  assert.deepEqual(await counts(), { visits: 1, events: 1 });
  const visit = await shop.s.get('SELECT * FROM visits');
  assert.equal(visit.campaign, 'consented');
  assert.equal(visit.source, 'gemeinde');
  await call('/api/auth/register', { email: 'cookie@example.test', password: 'Cookie-Test-Password-2026!' });
  await call('/api/cart', item);
  assert.deepEqual(await counts(), { visits: 1, events: 2 });
  const approved = await call('/api/checkout', { recipient, method: 'card' });
  const approvedOrder = await shop.s.get('SELECT * FROM orders WHERE id=?', approved.orderId);
  assert.equal(approvedOrder.visit_id, visit.id);
  assert.equal(approvedOrder.source, 'gemeinde');

  choice = `archenlicht_consent=v1.necessary.${Date.now()}`;
  await call('/api/privacy/consent', {});
  await call('/api/events', { ...event, designId: 'getragen' });
  await call('/api/cart', { ...item, designId: 'getragen' });
  assert.deepEqual(await counts(), { visits: 1, events: 2 });
  const declined = await call('/api/checkout', { recipient, method: 'card' });
  const declinedOrder = await shop.s.get('SELECT * FROM orders WHERE id=?', declined.orderId);
  assert.notEqual(declinedOrder.visit_id, visit.id);
  assert.equal(declinedOrder.source, 'unbekannt');
  assert.ok((await call('/api/cart')).length);
  assert.equal((await call('/api/bootstrap')).user.email, 'cookie@example.test');
  for (const invalid of ['', `archenlicht_consent=v1.statistics.${Date.now() - CONSENT_MAX_AGE * 1000}`]) {
    choice = invalid;
    await call('/api/bootstrap?source=tiktok');
    await call('/api/events', { ...event, designId: 'getragen' });
    assert.deepEqual(await counts(), { visits: 1, events: 2 });
  }
  choice = `archenlicht_consent=v1.statistics.${Date.now()}`;
  await call('/api/privacy/consent', {});
  assert.equal((await counts()).visits, 2); // A new opt-in does not resume the withdrawn visit.
});
