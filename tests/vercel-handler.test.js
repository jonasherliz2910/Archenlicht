import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createVercelHandler } from '../api/shop.js';
import { defaultConfig } from '../server/index.js';

test('Vercel-Einstieg leitet echte API-Pfade und Shop-Unterseiten weiter; Jobzugriff bleibt geschützt', async t => {
  const handler = createVercelHandler({ ...defaultConfig(), storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Nur-Test-Admin-2026!', workerSecret: 'fixture-worker-only', platformOrigins: ['https://preview.example'] });
  const server = http.createServer(handler); await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); await handler.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, boot = await fetch(base + '/api/shop?__shop_path=api/bootstrap&source=tiktok');
  assert.equal(boot.status, 200); const state = await boot.json(); assert.equal(state.designs.length, 6);
  const cookie = boot.headers.get('set-cookie').split(';')[0];
  const preview = await fetch(base + '/api/shop?__shop_path=api/preview', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf, Origin: 'https://preview.example' }, body: JSON.stringify({ kind: 'fixed', designId: 'getragen', modelId: 'google-pixel-11' }) });
  assert.equal(preview.status, 200);
  const product = await fetch(base + '/api/shop?__shop_path=kollektion/getragen'); assert.equal(product.status, 200); assert.match(await product.text(), /Getragen/);
  assert.equal((await fetch(base + '/api/shop?__shop_path=api/jobs')).status, 403);
  assert.equal((await fetch(base + '/api/shop?__shop_path=api/jobs', { headers: { Authorization: 'Bearer fixture-worker-only' } })).status, 200);
  assert.equal((await fetch(base + '/api/shop?__shop_path=server/index.js')).status, 404);
});
