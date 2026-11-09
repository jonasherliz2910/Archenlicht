import { readFileSync } from 'node:fs';
export const PODBASE_MAGSAFE_MAP = JSON.parse(readFileSync(new URL('./podbase-magsafe-map.json', import.meta.url), 'utf8'));
export function magneticVariant(modelId) {
  for (const product of PODBASE_MAGSAFE_MAP.products) {
    const model = product.models.find(m => m.modelId === modelId);
    if (model) return { ...model, productId: product.productId, productName: product.productName };
  }
  return null;
}
export function catalogVariant(snapshot, configuration) {
  const model = snapshot?.models.find(m => m.modelId === configuration.modelId);
  return configuration.magsafe ? model?.magsafe : model;
}
export function localVariant(model, configuration) {
  return configuration.magsafe ? { productId: 'SIM-MAGSAFE', variantId: `SIM-MAGSAFE-${model.id}` } : { productId: model.productId, variantId: model.variantId };
}
