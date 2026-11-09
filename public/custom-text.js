export const MAX_CUSTOM_TEXT = 180;

// Retained for clients still using the previous editor bundle.
export function customTextForEditor(configuration, verses = []) {
  if (typeof configuration.customText === 'string') return configuration.customText;
  const verse = verses.find(v => v.id === configuration.verseId);
  return [configuration.verseExcerpt || verse?.quote, configuration.verseReference || verse?.reference].filter(Boolean).join('\n');
}

export function createTextChoice(configuration, verses = []) {
  return {
    mode: Object.hasOwn(configuration, 'customText') ? 'custom' : 'suggested',
    customText: typeof configuration.customText === 'string' ? configuration.customText : '',
    verseId: verses.some(v => v.id === configuration.verseId) ? configuration.verseId : verses[0]?.id || null
  };
}

// Only the active choice goes into previews, carts and orders. Keep the other
// draft in the editor so switching modes cannot erase the customer's words.
export function applyTextChoice(configuration, choice) {
  const { customText, verseId, verseReference, verseExcerpt, ...rest } = configuration;
  return { ...rest, ...(choice.mode === 'custom' ? { customText: choice.customText } : { verseId: choice.verseId }) };
}

export function hasConfiguredText(configuration, verses = []) {
  return configuration.kind !== 'custom' || (Object.hasOwn(configuration, 'customText')
    ? Boolean(configuration.customText?.trim())
    : verses.some(v => v.id === configuration.verseId));
}
