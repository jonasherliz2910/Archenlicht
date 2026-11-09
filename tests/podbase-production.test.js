import test from 'node:test';
import assert from 'node:assert/strict';
import { PodbaseAPI, podbasePayload } from '../server/podbase.js';
import { officialTemplate, productionPrint } from '../server/production-print.js';
import { renderLayout } from '../server/layout.js';
import { findModel } from '../server/catalog.js';

test('Echte Übergabe verlangt bezahlten Liveauftrag, passende Originalvorlage und öffentliche PNG', async t => {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ orderId: 'PB-fixture', externalOrderId: 'live-order', status: 'UNAPPROVED' }); };
  const c = { kind: 'custom', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue', customText: 'Du bist geliebt.' };
  const printed = await productionPrint(renderLayout(c), findModel(c.modelId)), template = officialTemplate(c.modelId);
  const item = { configuration: printed.configuration, hash: printed.hash, title: 'Hülle', quantity: 1, unitPrice: 3499, variantId: template.variantId, productId: template.productId };
  const order = { id: 'live-order', mode: 'live', paid_at: Date.now(), recipient: JSON.stringify({ name: 'Test', phone: '+4915112345678', email: 'test@example.test', street: 'Testweg 12', city: 'Berlin', postalCode: '10115' }), items: JSON.stringify([item]) };
  const options = { requireOfficialPrint: true }, base = 'https://www.archenlicht.de';
  const payload = podbasePayload(order, base, options);
  for (const changed of [{ ...order, mode: 'test' }, { ...order, paid_at: null }, { ...order, items: JSON.stringify([{ ...item, variantId: 'PBV-wrong' }]) }, { ...order, items: JSON.stringify([{ ...item, configuration: c }]) }]) assert.throws(() => podbasePayload(changed, base, options));
  assert.throws(() => podbasePayload(order, 'http://localhost:3000', options));
  assert.throws(() => new PodbaseAPI({ apiKey: 'fixture', baseUrl: 'https://foreign.example' }));
  const adapter = new PodbaseAPI({ apiKey: 'fixture', productionApproved: false });
  assert.throws(() => adapter.create(payload), /gesperrt/); assert.equal(calls.length, 0);
  adapter.approved = true;
  assert.equal((await adapter.create(payload)).status, 'UNAPPROVED');
  assert.equal(calls.length, 1); assert.equal(calls[0].options.redirect, 'error');
  assert.match(JSON.parse(calls[0].options.body).items[0].printFile, /\.png$/);
  assert.throws(() => adapter.create({ ...payload, items: [{ ...payload.items[0], printFile: base + '/gestalten' }] }));
  globalThis.fetch = async () => Response.json({ orders: [] });
  await assert.rejects(adapter.find(order.id), /vollständige Antwort/);
});

test('Podbase-Storepräfix wird exakt zugeordnet; fremde Stores und ähnliche Endungen passen nicht', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const storeId = 'PUS-AAA-BBB-CCCC', externalOrderId = 'AL-INTEGRATION-20261109-01';
  const expected = { orderId: 'provider-id', externalOrderId: `${storeId}-${externalOrderId}`, status: 'UNAPPROVED' };
  globalThis.fetch = async url => Response.json(url.includes('?')
    ? { orders: [{ ...expected, externalOrderId: `PUS-OTHER-BBB-CCCC-${externalOrderId}` }, { ...expected, externalOrderId: `${storeId}-OTHER-${externalOrderId}` }, expected], pagination: { page: 0, hasNextPage: false } }
    : expected);
  const api = new PodbaseAPI({ apiKey: 'fixture', storeId });
  const found = await api.find(externalOrderId), direct = await api.get('provider-id');
  assert.equal(found.orderId, 'provider-id'); assert.equal(found.externalOrderId, externalOrderId);
  assert.equal(found.providerExternalOrderId, expected.externalOrderId); assert.deepEqual(direct, found);
  assert.equal(await new PodbaseAPI({ apiKey: 'fixture' }).find(externalOrderId), null);
  assert.throws(() => new PodbaseAPI({ apiKey: 'fixture', storeId: 'wrong-store' }));
});

test('Abgleich prüft alle Seiten und stoppt bei doppelten, unvollständigen oder verschobenen Antworten', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const storeId = 'PUS-AAA-BBB-CCCC', api = new PodbaseAPI({ apiKey: 'fixture', storeId });
  let scenario = 'unique'; const calls = [];
  globalThis.fetch = async url => {
    const page = Number(new URL(url).searchParams.get('page')); calls.push(page);
    if (scenario === 'failed-page' && page === 1) return new Response('', { status: 503 });
    return Response.json({ orders: page === 0 || scenario === 'duplicate'
      ? [{ orderId: 'provider-' + page, externalOrderId: storeId + '-shop-order', status: 'UNAPPROVED' }] : [],
      pagination: { page: scenario === 'wrong-page' ? 8 : page, hasNextPage: page === 0 } });
  };
  assert.equal((await api.find('shop-order')).orderId, 'provider-0'); assert.deepEqual(calls, [0, 1]);
  scenario = 'duplicate'; await assert.rejects(api.find('shop-order'), /Mehrere Podbase/);
  scenario = 'failed-page'; await assert.rejects(api.find('shop-order'), /HTTP 503/);
  scenario = 'wrong-page'; await assert.rejects(api.find('shop-order'), /unerwartete Seite/);
});
