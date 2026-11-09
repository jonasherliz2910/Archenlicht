export const MAX_CUSTOM_TEXT = 180;

// Existing carts remain readable; opening one for editing moves its exact
// verse wording into the new free-text field without inventing a replacement.
export function customTextForEditor(configuration, verses = []) {
  if (typeof configuration.customText === 'string') return configuration.customText;
  const verse = verses.find(v => v.id === configuration.verseId);
  return [configuration.verseExcerpt || verse?.quote, configuration.verseReference || verse?.reference].filter(Boolean).join('\n');
}
