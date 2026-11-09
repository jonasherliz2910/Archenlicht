// Input is a read-only /catalog snapshot, never a credential or an order request.
import { readFileSync, writeFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('.tools/podbase-catalog-magsafe.json', 'utf8'));
const standard = JSON.parse(readFileSync('server/podbase-model-map.json', 'utf8'));
const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const products = ['MagSafe Tough Phone Case', 'Magnetic Tough Phone Case'].map(title => {
  const matches = catalog.filter(p => p.title === title);
  if (matches.length !== 1) throw new Error(`Expected one product: ${title}`);
  const product = matches[0];
  const models = standard.models.flatMap(model => {
    const variants = product.variants.filter(v => normalize(v.name) === normalize(model.catalogName));
    if (variants.length > 1) throw new Error(`Ambiguous model: ${model.modelId}`);
    return variants.map(v => ({ modelId: model.modelId, variantId: v.id, catalogName: v.name }));
  });
  return { productId: product.id, productName: title, models };
});
const result = { sourceDate: '2026-11-09', source: 'https://open-api.podbase.com/catalog', products };
writeFileSync('server/podbase-magsafe-map.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(products.map(p => ({ product: p.productName, models: p.models.length }))));
