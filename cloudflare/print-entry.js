import { renderLayout, rasterize, normalizeConfiguration } from '../server/layout.js';
// Supplied by the Cloudflare build; original bytes are verified before use.
import { prepareDesign } from '../server/design-assets.js';
import { productionPrint, officialTemplate } from '../server/production-print.js';
import { DESIGNS, MODELS, findModel } from '../server/catalog.js';
import { CASE_COLORS } from '../public/case-colors.js';

export function catalog() {
  return {
    designs: DESIGNS.map(({ id, title }) => ({ id, title })),
    colors: CASE_COLORS,
    models: MODELS.filter(m => officialTemplate(m.id)).map(m => ({ id: m.id, name: m.name, magsafe: Boolean(officialTemplate(m.id, true)) }))
  };
}
export async function print(input, assetBinding) {
  const configuration = normalizeConfiguration(input);
  await prepareDesign(configuration.designId, assetBinding);
  const layout = renderLayout(input), result = await productionPrint(layout, findModel(layout.configuration.modelId));
  return { png: await rasterize(result.svg), layout: result };
}
