export const FIXED_BUNDLES = Object.freeze([
  Object.freeze({ id: 'hoffnung', title: 'Hoffnung für deinen Weg', subtitle: 'Geborgen. Ermutigt. Entlastet.', description: 'Drei Erinnerungen daran, dass du getragen bist – mitten im Sturm und auf jedem neuen Weg.', designs: Object.freeze(['unter-seinen-fluegeln', 'nach-dem-sturm', 'absetzen']), backgrounds: Object.freeze(['white', 'white', 'white']), image: '/assets/bundles-v2/hoffnung.webp' }),
  Object.freeze({ id: 'geborgenheit', title: 'In seiner Nähe', subtitle: 'Nah. Behütet. Getragen.', description: 'Drei leise Begleiter voller Nähe und Zuversicht. Für deinen Alltag oder zum Teilen mit deinen Liebsten.', designs: Object.freeze(['ganz-nah', 'im-schatten', 'getragen']), backgrounds: Object.freeze(['white', 'white', 'white']), image: '/assets/bundles-v2/geborgenheit.webp' })
]);

export const fixedBundle = id => FIXED_BUNDLES.find(bundle => bundle.id === id);

// Only the fit, colour and case type vary. Text and motifs belong to the set.
export function fixedBundleConfigurations(id, items) {
  const bundle = fixedBundle(id);
  if (!bundle || !Array.isArray(items) || items.length !== 3) throw new Error('Bitte wähle eines unserer Dreier-Bundles mit allen drei Hüllen.');
  return bundle.designs.map((designId, index) => {
    const item = items[index];
    if (!item || typeof item !== 'object' || item.designId !== designId || (item.kind && item.kind !== 'fixed') || (item.quantity !== undefined && item.quantity !== 1) || item.customText || item.dedication || item.verseId) throw new Error('Die drei Motive dieses Bundles stehen fest. Bitte lade deine Bundle-Auswahl neu.');
    return { kind: 'fixed', designId, modelId: item.modelId, backgroundId: item.backgroundId ?? bundle.backgrounds[index], magsafe: item.magsafe ?? false, dedication: '' };
  });
}
