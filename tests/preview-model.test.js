import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createApp, defaultConfig } from '../server/index.js';
import { PREVIEW_MODEL } from '../public/preview-model.js';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';

test('Example previews work without a print template, while cart and bundle fulfillment remain blocked', async t => {
  const app = await createApp({ ...defaultConfig(), printMode: 'podbase', podbaseMode: 'local', shopMode: 'test', paymentMode: 'local', mailMode: 'local', newsletterMode: 'local', storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), serverless: true, autoShip: false });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => app.server.close(r)));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const bootstrap = await fetch(base + '/api/bootstrap'), state = await bootstrap.json();
  const headers = { Cookie: bootstrap.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf };
  const post = (path, body) => fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const fixed = { kind: 'fixed', modelId: PREVIEW_MODEL.id, designId: 'nach-dem-sturm', backgroundId: 'black', magsafe: false, dedication: '' };
  for (const kind of ['fixed', 'custom']) for (const magsafe of [false, true]) {
    const input = { ...fixed, kind, magsafe, ...(kind === 'custom' ? { customText: 'Du bist geliebt.', dedication: 'Für Anna' } : {}) };
    const response = await post('/api/preview', input);
    assert.equal(response.status, 200);
    const preview = await response.json();
    assert.equal(preview.exampleOnly, true);
    assert.equal(preview.officialPrintTemplate, false);
    assert.equal(preview.configuration.modelId, PREVIEW_MODEL.id);
    assert.equal(preview.configuration.backgroundId, 'black');
    assert.equal(preview.configuration.magsafe, magsafe);
    assert.equal((await fetch(base + preview.svgUrl)).status, 200);
    const cart = await post('/api/cart', { ...input, exampleOnly: false, officialPrintTemplate: true, hash: preview.hash });
    assert.equal(cart.status, 409);
    assert.match((await cart.json()).error, /Druckvorlage/);
  }
  const unavailable = state.variants.filter(v => v.model_id === PREVIEW_MODEL.id);
  assert.ok(unavailable.length > 0 && unavailable.every(v => !v.available && !v.magsafe_available));
  const bundle = await post('/api/cart/bundle', { bundleId: FIXED_BUNDLES[0].id, requestId: randomUUID(), items: FIXED_BUNDLES[0].designs.map(designId => ({ ...fixed, designId })) });
  assert.equal(bundle.status, 409);
  assert.deepEqual(await (await fetch(base + '/api/cart', { headers })).json(), []);

  // A real model choice replaces only the example model and uses the strict print path.
  const selected = { ...fixed, modelId: 'iphone-14-pro', kind: 'custom', customText: 'Du bist geliebt.', dedication: 'Für Anna', magsafe: true };
  const preview = await (await post('/api/preview', selected)).json();
  assert.equal(preview.exampleOnly, undefined);
  assert.equal(preview.officialPrintTemplate, true);
  const response = await post('/api/cart', selected);
  assert.equal(response.status, 200);
  const [item] = await response.json();
  assert.equal(item.hash, preview.hash);
  for (const field of ['modelId', 'designId', 'backgroundId', 'customText', 'dedication', 'magsafe']) assert.equal(item.configuration[field], selected[field]);
  assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM orders')).n, 0);
  assert.equal((await app.shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n, 0);
});
