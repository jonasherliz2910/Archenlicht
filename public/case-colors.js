// Approved palette. IDs, rather than arbitrary CSS, are stored with each order.
export const CASE_COLORS = Object.freeze([
  { id: 'white', name: 'Weiß', hex: '#FAFAF8', ink: '#163E29' },
  { id: 'beige', name: 'Beige', hex: '#DCCDBB', ink: '#163E29' },
  { id: 'black', name: 'Schwarz', hex: '#343638', ink: '#FAFAF8' },
  { id: 'light-blue', name: 'Hellblau', hex: '#C8D9E3', ink: '#163E29' },
  { id: 'dark-blue', name: 'Dunkelblau', hex: '#43566C', ink: '#FAFAF8' },
  { id: 'mint', name: 'Mintgrün', hex: '#C5D7CB', ink: '#163E29' },
  { id: 'forest', name: 'Waldgrün', hex: '#4D6558', ink: '#FAFAF8' },
  { id: 'lilac', name: 'Flieder', hex: '#D6CEE3', ink: '#163E29' },
  { id: 'grey', name: 'Grau', hex: '#CBCDD0', ink: '#163E29' }
].map(color => Object.freeze(color)));
export const caseColor = id => CASE_COLORS.find(color => color.id === (id ?? 'white'));
