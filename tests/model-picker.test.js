import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS } from '../server/catalog.js';
import { filterModels, modelAvailable, modelAvailabilityMode } from '../public/model-picker.js';

test('Modellsuche findet Schreibweisen ohne Leerzeichen und Plus-Symbol über Markengrenzen hinweg', () => {
  assert.deepEqual(filterModels(MODELS, { brand: 'Apple', query: 'S26+' }).map(m => m.id), ['samsung-galaxy-s26-plus']);
  assert.deepEqual(filterModels(MODELS, { query: ' PIXEL11 pro XL ' }).map(m => m.id), ['google-pixel-11-pro-xl']);
  assert.deepEqual(filterModels(MODELS, { query: 'iPhone18 pro max' }).map(m => m.id), ['iphone-18-pro-max']);
  assert.equal(filterModels(MODELS, { query: 'nicht vorhandenes Modell' }).length, 0);
  assert.equal(filterModels(MODELS, { brand: 'Samsung', query: '  ' }).every(m => m.brand === 'Samsung'), true);
});

test('Modellansicht sortiert nach Marke und Generation ohne gespeicherte Modell-/Varianten-IDs zu verändern', () => {
  const original = MODELS.map(m => [m.id, m.variantId]);
  assert.equal(filterModels(MODELS, { brand: 'Apple' })[0].id, 'iphone-18-pro-max');
  assert.equal(filterModels(MODELS, { brand: 'Samsung' })[0].id, 'samsung-galaxy-s26-ultra');
  assert.equal(filterModels(MODELS, { brand: 'Google' })[0].id, 'google-pixel-11-pro-xl');
  const a = filterModels(MODELS, { query: 'Samsung A' });
  assert.equal(a.every(m => /galaxy-a/.test(m.id)), true);
  assert.ok(a.findIndex(m => m.id === 'samsung-galaxy-a37') < a.findIndex(m => m.id === 'samsung-galaxy-a56'));
  assert.deepEqual(MODELS.map(m => [m.id, m.variantId]), original);
});

test('Modellkarten lassen nur vorhandene, verfügbare und für das Motiv freigegebene Varianten zu', () => {
  const variant = { model_id: 'google-pixel-11', design_id: 'getragen', available: 1, print_approved: 1, approval_mode: 'test' };
  assert.equal(modelAvailable([variant], variant.model_id, variant.design_id), true);
  assert.equal(modelAvailable([{ ...variant, available: 0 }], variant.model_id, variant.design_id), false);
  assert.equal(modelAvailable([{ ...variant, print_approved: 0 }], variant.model_id, variant.design_id), false);
  assert.equal(modelAvailable([variant], variant.model_id, 'ganz-nah'), false);
  assert.equal(modelAvailable([variant], variant.model_id, variant.design_id, 'live'), false);
});

test('Geschlossener Live-Shop erlaubt Vorschauvarianten, geöffneter Live-Shop verlangt Produktionsfreigabe', () => {
  const variant = { model_id: 'iphone-14-pro', design_id: 'getragen', available: 1, print_approved: 1, approval_mode: 'test' };
  const closed = { mode: 'live', checkoutEnabled: false, variantMode: 'test' };
  assert.equal(modelAvailable([variant], variant.model_id, variant.design_id, modelAvailabilityMode(closed)), true);
  // Compatibility with an older bootstrap response during deployment.
  assert.equal(modelAvailabilityMode({ mode: 'live', checkoutEnabled: false }), 'test');
  const open = { mode: 'live', checkoutEnabled: true, variantMode: 'live' };
  assert.equal(modelAvailable([variant], variant.model_id, variant.design_id, modelAvailabilityMode(open)), false);
  assert.equal(modelAvailable([{ ...variant, approval_mode: 'live' }], variant.model_id, variant.design_id, modelAvailabilityMode(open)), true);
  for (const blocked of [{ available: 0 }, { print_approved: 0 }]) assert.equal(modelAvailable([{ ...variant, ...blocked }], variant.model_id, variant.design_id, modelAvailabilityMode(closed)), false);
  assert.equal(modelAvailable([{ ...variant, available: 0, magsafe_available: 1 }], variant.model_id, variant.design_id, modelAvailabilityMode(closed)), true);
});
