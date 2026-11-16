// Read-only print audit. Add --experimental-loader ./scripts/product-release-loader.mjs
// to repeat with the Cloudflare WASM rasterizer instead of native Sharp.
// Catalog input comes from the GET-only PodbaseCatalog adapter. No order/payment API.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { MODELS, DESIGNS, findModel } from '../server/catalog.js';
import { PODBASE_PRINT_TEMPLATES, productionPrint } from '../server/production-print.js';
import { renderLayout, rasterize } from '../server/layout.js';
import { CASE_COLORS } from '../public/case-colors.js';
import { magneticVariant } from '../server/case-variants.js';

const catalogPath = process.argv[2] || 'test-results/product-release/catalog.json';
const output = process.argv[3] || 'test-results/product-release/print-audit.json';
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
assert.ok(Date.now() - Date.parse(catalog.checkedAt) < 86400000, 'Refresh the read-only catalog snapshot first');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const wasm = process.execArgv.some(arg => arg.includes('product-release-loader.mjs'));
let report = { startedAt: new Date().toISOString(), renderer: wasm ? 'resvg-wasm-2.6.2-srgb300-v1' : 'sharp-native',
  templateFileHash: sha256(await readFile('server/podbase-print-templates.json')),
  catalogCheckedAt: catalog.checkedAt, source: PODBASE_PRINT_TEMPLATES.source,
  cases: [], failed: [], colorGeometryChecks: 0, models: [] };
if (process.argv.includes('--resume')) {
  const previous = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(previous.templateFileHash, report.templateFileHash);
  assert.equal(previous.renderer, report.renderer);
  assert.equal(previous.catalogCheckedAt, report.catalogCheckedAt);
  assert.ok(!previous.finishedAt);
  report = previous;
}
await mkdir(dirname(output), { recursive: true });
const save = () => writeFile(output, JSON.stringify(report, null, 2));
const scenarios = [
  { label: 'fixed', kind: 'fixed' },
  { label: 'custom-text', kind: 'custom', customText: 'Auch nach dem Sturm bleibt Hoffnung. Du bist auf deinem Weg nicht allein.', dedication: 'Von Herzen fuer dich' },
  { label: 'custom-verse', kind: 'custom', verseId: 'ps23-1', dedication: 'Von Herzen fuer dich' }
];
// On the representative iPhone 12, every color must preserve artwork/text
// geometry for every design and text scenario in both case types. Only the
// background rectangle and opaque text ink may change, so one contour scan per
// geometry covers those colors; this is not a physical color reproduction test.
const geometry = svg => svg.replace(/<rect data-background="[^"]*"[^>]*\/>/, '').replace(/<g fill="#[a-fA-F0-9]+">/g, '<g fill="INK">');
for (const model of MODELS) {
  if (report.models.some(row => row.modelId === model.id)) continue;
  const remote = catalog.snapshot.models.find(row => row.modelId === model.id);
  const types = [];
  for (const magsafe of [false, true]) {
    const template = (magsafe ? PODBASE_PRINT_TEMPLATES.magsafeTemplates : PODBASE_PRINT_TEMPLATES.templates).find(t => t.modelId === model.id);
    if (!template) continue;
    const stock = magsafe ? remote?.magsafe : remote;
    const before = report.failed.length;
    assert.ok(stock?.matched && stock.inStock, model.id + ': provider variant unavailable');
    assert.equal(template.productId, stock.productId); assert.equal(template.variantId, stock.variantId);
    if (magsafe) assert.equal(magneticVariant(model.id).variantId, template.variantId);
    assert.equal(template.width, 2000); assert.equal(template.height, 3400); assert.equal(template.density, 300);
    assert.ok(template.clearance >= 45 && template.safeArea.path && template.cameraExclusions.length);
    for (const design of DESIGNS) for (const scenario of scenarios) {
      const input = { ...scenario, designId: design.id, modelId: model.id, magsafe, backgroundId: 'white' };
      try {
        const layout = renderLayout(input), expectedGeometry = sha256(geometry(layout.svg));
        for (const color of model.id === MODELS[0].id ? CASE_COLORS : []) {
          const colored = renderLayout({ ...input, backgroundId: color.id });
          assert.equal(sha256(geometry(colored.svg)), expectedGeometry, `${model.id}/${design.id}/${color.id}: geometry changed`);
          assert.equal(colored.printText, layout.printText);
          report.colorGeometryChecks++;
        }
        const result = await productionPrint(layout, findModel(model.id)), print = result.configuration.productionPrint;
        assert.equal(print.validation.unsafePixels, 0); assert.equal(print.validation.outsideCanvasPixels, 0);
        assert.ok(print.validation.markedPixels > 0); assert.equal(result.printText, layout.printText);
        assert.equal(print.templateHash, template.hash); assert.equal(print.variantId, stock.variantId);
        assert.equal(print.productId, stock.productId); assert.equal(print.physicalSampleApproved, false);
        assert.ok(!result.svg.includes(template.safeArea.path));
        report.cases.push({ modelId: model.id, magsafe, designId: design.id, scenario: scenario.label,
          templateHash: template.hash, validation: print.validation, printHash: result.hash });
        if (model.id === 'iphone-14-pro' && design.id === 'nach-dem-sturm' && scenario.label === 'fixed') {
          const png = await rasterize(result.svg);
          assert.equal(png.readUInt32BE(16), 2000); assert.equal(png.readUInt32BE(20), 3400);
          await writeFile(`${dirname(output)}/iphone-14-pro-${magsafe ? 'magsafe' : 'standard'}.png`, png);
        }
      } catch (error) {
        report.failed.push({ modelId: model.id, magsafe, designId: design.id, scenario: scenario.label, error: error.message });
      }
    }
    types.push({ magsafe, productId: template.productId, variantId: template.variantId, templateHash: template.hash, passed: report.failed.length === before });
  }
  report.models.push({ modelId: model.id, name: model.name, brand: model.brand, types });
  await save();
  console.log(`${model.id}: ${types.length} case types, ${report.cases.length} checks, ${report.failed.length} failures`);
}
report.finishedAt = new Date().toISOString(); report.passed = report.failed.length === 0;
await save();
assert.equal(report.failed.length, 0, JSON.stringify(report.failed));
console.log(`Print audit passed: ${report.cases.length} contour checks; ${report.colorGeometryChecks} color geometry checks.`);
