import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_COLORS } from '../public/case-colors.js';
import { DESIGNS, findModel } from '../server/catalog.js';
import { renderLayout } from '../server/layout.js';
import { officialTemplate, productionPrint, inspectProductionInk } from '../server/production-print.js';

test('iPhone 17 übernimmt die Rasterkonturen und getrennte Standard-/MagSafe-Varianten', async () => {
  const standard = officialTemplate('iphone-17'), magnetic = officialTemplate('iphone-17', true);
  assert.equal(standard.safeArea.extraction, 'closed-raster-outline-v1');
  assert.equal(standard.variantId, 'PBV-4EY-2LR-225P');
  assert.notEqual(magnetic.variantId, standard.variantId);
  assert.notEqual(magnetic.productId, standard.productId);
  assert.deepEqual(magnetic.safeArea, standard.safeArea);
  assert.deepEqual(magnetic.cameraExclusions, standard.cameraExclusions);
  const camera = await inspectProductionInk('<rect x="530" y="540" width="20" height="20"/>', standard);
  const edge = await inspectProductionInk('<rect x="340" y="1700" width="20" height="20"/>', standard);
  const safe = await inspectProductionInk('<rect x="950" y="1750" width="20" height="20"/>', standard);
  assert.ok(camera.unsafePixels > 0); assert.ok(edge.unsafePixels > 0); assert.equal(safe.unsafePixels, 0);
});

test('iPhone 17: jedes Motiv in allen neun Farben und beide Hüllenarten bleibt vollständig druckbar', async () => {
  const model = findModel('iphone-17');
  for (const design of DESIGNS) for (const color of CASE_COLORS) {
    const input = { kind: 'fixed', modelId: model.id, designId: design.id, backgroundId: color.id };
    const layout = renderLayout(input), standard = await productionPrint(layout, model);
    const magnetic = await productionPrint(renderLayout({ ...input, magsafe: true }), model);
    for (const print of [standard, magnetic]) {
      assert.equal(print.configuration.productionPrint.validation.unsafePixels, 0, `${design.id}/${color.id}`);
      assert.equal(print.configuration.productionPrint.validation.outsideCanvasPixels, 0);
      assert.equal(print.printText, layout.printText);
      assert.ok(print.configuration.productionPrint.placement.scale > 0);
      assert.match(print.svg, new RegExp(`fill="${color.hex}"`));
    }
    assert.equal(standard.svg, magnetic.svg, 'MagSafe must not alter artwork or scale');
  }
  for (const magsafe of [false, true]) {
    const input = { kind: 'custom', modelId: model.id, designId: 'nach-dem-sturm', backgroundId: 'black', customText: 'Auch nach dem Sturm bleibt Hoffnung. Du bist auf deinem Weg nicht allein.', dedication: 'Für dich', magsafe };
    const layout = renderLayout(input), print = await productionPrint(layout, model);
    assert.equal(print.printText, layout.printText);
    assert.equal(print.configuration.productionPrint.validation.unsafePixels, 0);
  }
});
