import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderLayout, rasterize } from '../server/layout.js';
import { productionPrint } from '../server/production-print.js';
import { DESIGNS, findModel } from '../server/catalog.js';
import { CASE_COLORS } from '../public/case-colors.js';

const base = process.argv[2] || 'http://127.0.0.1:8792';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('This bulk pixel comparison is local only.');
const out = 'test-results/cloudflare'; await mkdir(out, { recursive: true });
const post = (path, input, extra = {}) => fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Archenlicht-Test': '1', ...extra }, body: JSON.stringify(input) });
const health = await (await fetch(base + '/api/health')).json();
assert.equal(health.mode, 'cloudflare-compatibility-test');
assert.equal(health.checkoutEnabled, false); assert.equal(health.podbaseOrderSubmissionEnabled, false);
assert.equal(health.customerDatabaseConnected, false);
assert.equal((await post('/api/render', {}, { Origin: 'https://example.com' })).status, 403);
assert.equal((await post('/api/checkout', {})).status, 404);
assert.equal((await post('/api/webhooks/stripe', {})).status, 404);
const auth = await (await post('/api/check-password', {})).json();
assert.equal(auth.ok, true); assert.equal(auth.accountCreated, false);
const catalog = await (await fetch(base + '/api/catalog')).json(); assert.equal(catalog.designs.length, 6);
const cases = DESIGNS.flatMap(d => CASE_COLORS.map(color => ({ kind: 'fixed', modelId: 'iphone-14-pro', designId: d.id, backgroundId: color.id, magsafe: false })));
for (const [modelId, magsafe] of [['iphone-14-pro', true], ['google-pixel-9-pro', false], ['samsung-galaxy-s24-ultra', false]]) {
  cases.push({ kind: 'custom', modelId, designId: 'nach-dem-sturm', backgroundId: 'black', magsafe, customText: 'Du bist gehalten. Auch nach dem Sturm.', dedication: 'Für deinen Weg' });
}
const flip = catalog.models.find(m => /Flip/.test(m.name));
if (flip) cases.push({ kind: 'fixed', modelId: flip.id, designId: 'getragen', backgroundId: 'forest', magsafe: false });
const report = { health, auth, catalogModels: catalog.models.length, started: new Date().toISOString(), cases: [] };
for (let i = 0; i < cases.length; i++) {
  const input = cases[i]; let response = await post('/api/render', input);
  if (response.status === 429) { console.log('Rate limit respected; continuing in one minute.'); await new Promise(r => setTimeout(r, 60000)); response = await post('/api/render', input); }
  assert.equal(response.status, 200, response.ok ? '' : await response.text());
  assert.equal(response.headers.get('X-Print-Safety'), 'passed');
  const png = Buffer.from(await response.arrayBuffer()), meta = await sharp(png).metadata();
  const original = await productionPrint(renderLayout(input), findModel(input.modelId));
  assert.equal(meta.width, original.width); assert.equal(meta.height, original.height);
  assert.equal(meta.density, 300); assert.equal(meta.space, 'srgb');
  assert.equal(response.headers.get('X-Print-Template'), original.configuration.productionPrint.templateHash);
  assert.deepEqual(JSON.parse(response.headers.get('X-Print-Placement')), original.configuration.productionPrint.placement);
  const expected = await rasterize(original.svg);
  const pixels = await sharp(png).removeAlpha().raw().toBuffer();
  const reference = await sharp(expected).removeAlpha().raw().toBuffer();
  let difference = 0, bigDifference = 0;
  for (let p = 0; p < pixels.length; p++) { const d = Math.abs(pixels[p] - reference[p]); difference += d; if (d > 40) bigDifference++; }
  const meanDifference = difference / pixels.length, largeDifferenceRatio = bigDifference / pixels.length;
  assert.ok(meanDifference < 2, `Mean pixel difference too high: ${meanDifference}`);
  assert.ok(largeDifferenceRatio < .01, `Too many differing pixels: ${largeDifferenceRatio}`);
  const row = { ...input, width: meta.width, height: meta.height, density: meta.density, meanDifference, largeDifferenceRatio, elapsedMs: Number(response.headers.get('X-Render-Ms')) };
  report.cases.push(row);
  if (input.backgroundId === 'black' || input.backgroundId === 'light-blue' || input.kind === 'custom') await writeFile(`${out}/${i}-${input.designId}-${input.backgroundId}.png`, png);
  await writeFile(`${out}/pixel-comparison.json`, JSON.stringify(report, null, 2));
  console.log(`${i + 1}/${cases.length}: ${input.designId}, ${input.backgroundId}, ${input.modelId}; mean difference ${meanDifference.toFixed(3)}; ${row.elapsedMs} ms`);
}
assert.equal((await post('/api/render', { kind: 'fixed', modelId: 'iphone-18-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue' })).status, 409);
assert.equal((await post('/api/render', { kind: 'custom', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', customText: 'x'.repeat(1000) })).status, 400);
console.log(`Cloudflare test passed: ${report.cases.length} print comparisons, password round-trip and external-service isolation.`);
