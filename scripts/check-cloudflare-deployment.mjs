import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderLayout, rasterize } from '../server/layout.js';
import { productionPrint } from '../server/production-print.js';
import { DESIGNS, findModel } from '../server/catalog.js';

// Deliberately limited to the separate technical trial, with no provider keys.
const base = 'https://archenlicht-cloudflare-test.jonas-herliz2910.workers.dev';
const out = 'test-results/cloudflare-deployed';
await mkdir(out, { recursive: true });
const get = path => fetch(base + path, { signal: AbortSignal.timeout(45000) });
const post = (path, input, extra = {}) => fetch(base + path, {
  method: 'POST', signal: AbortSignal.timeout(45000),
  headers: { Origin: base, 'Content-Type': 'application/json', 'X-Archenlicht-Test': '1', ...extra },
  body: JSON.stringify(input)
});
const healthResponse = await get('/api/health');
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.mode, 'cloudflare-compatibility-test');
for (const key of ['checkoutEnabled', 'podbaseOrderSubmissionEnabled', 'customerDatabaseConnected']) assert.equal(health[key], false);
const report = { base, started: new Date().toISOString(), health, assets: [], cases: [] };
const save = () => writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await save();
for (const path of ['/', '/test.js', '/style.css', '/logo.webp']) {
  const response = await get(path);
  assert.equal(response.status, 200, `Static asset unavailable: ${path}`);
  const bytes = (await response.arrayBuffer()).byteLength;
  assert.ok(bytes > 0);
  report.assets.push({ path, bytes, contentType: response.headers.get('content-type') });
}
const catalogResponse = await get('/api/catalog');
assert.equal(catalogResponse.status, 200);
const catalog = await catalogResponse.json();
assert.equal(catalog.designs.length, 6);
assert.equal(catalog.colors.length, 9);
report.catalogModels = catalog.models.length;
const passwordResponse = await post('/api/check-password', {});
assert.equal(passwordResponse.status, 200);
report.password = await passwordResponse.json();
assert.equal(report.password.ok, true);
assert.equal(report.password.accountCreated, false);
// Ten prints exercise all original motifs, both text modes and three brands.
const cases = DESIGNS.map(design => ({ kind: 'fixed', modelId: 'iphone-14-pro', designId: design.id, backgroundId: 'black', magsafe: false }));
cases.push({ kind: 'fixed', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue', magsafe: false });
for (const [modelId, magsafe] of [['iphone-14-pro', true], ['google-pixel-9-pro', false], ['samsung-galaxy-s24-ultra', false]]) {
  cases.push({ kind: 'custom', modelId, designId: 'nach-dem-sturm', backgroundId: 'black', magsafe, customText: 'Du bist gehalten. Auch nach dem Sturm.', dedication: 'Für deinen Weg' });
}
for (let i = 0; i < cases.length; i++) {
  const input = cases[i], start = performance.now();
  const response = await post('/api/render', input);
  assert.equal(response.status, 200, response.ok ? '' : await response.text());
  const png = Buffer.from(await response.arrayBuffer());
  const requestWallMs = Math.round(performance.now() - start);
  const metadata = await sharp(png).metadata();
  const original = await productionPrint(renderLayout(input), findModel(input.modelId));
  assert.equal(metadata.width, original.width);
  assert.equal(metadata.height, original.height);
  assert.equal(metadata.density, 300);
  assert.equal(metadata.space, 'srgb');
  assert.equal(response.headers.get('x-print-safety'), 'passed');
  assert.equal(response.headers.get('x-print-template'), original.configuration.productionPrint.templateHash);
  assert.deepEqual(JSON.parse(response.headers.get('x-print-placement')), original.configuration.productionPrint.placement);
  const pixels = await sharp(png).removeAlpha().raw().toBuffer();
  const reference = await sharp(await rasterize(original.svg)).removeAlpha().raw().toBuffer();
  assert.equal(pixels.length, reference.length);
  let difference = 0, largeDifference = 0;
  for (let p = 0; p < pixels.length; p++) {
    const delta = Math.abs(pixels[p] - reference[p]);
    difference += delta;
    if (delta > 40) largeDifference++;
  }
  const meanDifference = difference / pixels.length, largeDifferenceRatio = largeDifference / pixels.length;
  assert.ok(meanDifference < 2, `Mean pixel difference: ${meanDifference}`);
  assert.ok(largeDifferenceRatio < .01, `Large pixel difference ratio: ${largeDifferenceRatio}`);
  const row = { ...input, width: metadata.width, height: metadata.height, dpi: metadata.density, meanDifference, largeDifferenceRatio, requestWallMs };
  report.cases.push(row);
  await writeFile(`${out}/${i}-${input.designId}-${input.backgroundId}.png`, png);
  await save();
  console.log(`${i + 1}/${cases.length}: ${input.designId}, ${input.modelId}, ${requestWallMs} ms round trip; mean pixel difference ${meanDifference.toFixed(4)}`);
}
report.rejections = {
  wrongOrigin: (await post('/api/render', {}, { Origin: 'https://example.com' })).status,
  checkout: (await post('/api/checkout', {})).status,
  stripeWebhook: (await post('/api/webhooks/stripe', {})).status,
  missingTemplate: (await post('/api/render', { kind: 'fixed', modelId: 'iphone-18-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue' })).status,
  excessiveText: (await post('/api/render', { kind: 'custom', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', customText: 'x'.repeat(1000) })).status
};
assert.deepEqual(report.rejections, { wrongOrigin: 403, checkout: 404, stripeWebhook: 404, missingTemplate: 409, excessiveText: 400 });
report.completed = new Date().toISOString();
report.passed = true;
await save();
console.log('Remote trial passed: 10 print comparisons, fixed password check, assets and rejection checks. Timings are network wall times, not CPU usage.');
