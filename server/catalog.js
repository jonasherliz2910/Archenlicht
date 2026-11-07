import { designAsset, DESIGN_PACKAGE } from './design-assets.js';

export const BRAND = { name: 'Archenlicht', logo: '/assets/archenlicht-logo.png', collection: 'Ruhe und Geborgenheit', currency: 'EUR', fixedPrice: 2990, customPrice: 3490, colors: { paper: '#FCF8EF', sage: '#A6B99B', forest: '#163E29' } };
export const DESIGNS = [
  { id: 'unter-seinen-fluegeln', title: 'Unter seinen Flügeln', reference: 'Psalm 91,4', art: 'wing', color: '#dfe5d8', ink: '#63775f', note: 'Ein stiller Ort. Ganz nah bei dir.', label: 'Geborgenheit', draft: true },
  { id: 'nach-dem-sturm', title: 'Nach dem Sturm', reference: 'Markus 4,39', art: 'boat', color: '#e5e8e6', ink: '#637b7e', note: 'Auch die Wellen werden wieder still.', label: 'Zuversicht', draft: true },
  { id: 'absetzen', title: 'Absetzen', reference: 'Matthäus 11,28', art: 'bag', color: '#eee2d2', ink: '#9a795c', note: 'Du musst nicht alles alleine tragen.', label: 'Ruhe', draft: true },
  { id: 'ganz-nah', title: 'Ganz nah', reference: 'Psalm 131,2', art: 'mother', color: '#e8dcd6', ink: '#a4786d', note: 'Manchmal ist Nähe alles, was es braucht.', label: 'Nähe', draft: true },
  { id: 'im-schatten', title: 'Im Schatten', reference: 'Psalm 121,5', art: 'leaf', color: '#d8e0ce', ink: '#68765a', note: 'Ein bisschen Schatten. Ein tiefer Atemzug.', label: 'Schutz', draft: true },
  { id: 'getragen', title: 'Getragen', reference: 'Jesaja 40,11', art: 'lamb', color: '#eae4d8', ink: '#8d826a', note: 'Du darfst dich gehalten wissen.', label: 'Vertrauen', draft: true }
].map(design => {
  const asset = designAsset(design.id);
  if (asset.reference !== design.reference) throw new Error(`Die feste Versstelle für ${design.id} stimmt nicht mit dem Designpaket überein.`);
  return { ...design, color: DESIGN_PACKAGE.targetBackground, ink: DESIGN_PACKAGE.ink, blankImageUrl: asset.blankImageUrl, artworkVersion: asset.version, productionApproved: false };
});
const iphones = ['iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max'];
const samsungs = ['Samsung Galaxy S21', 'Samsung Galaxy S21 Ultra', 'Samsung Galaxy S22', 'Samsung Galaxy S22 Ultra', 'Samsung Galaxy S23', 'Samsung Galaxy S23 Ultra', 'Samsung Galaxy S24', 'Samsung Galaxy S24 Ultra', 'Samsung Galaxy S25', 'Samsung Galaxy S25 Ultra', 'Samsung Galaxy A54', 'Samsung Galaxy A55'];
const pixels = ['Google Pixel 6', 'Google Pixel 6 Pro', 'Google Pixel 6a', 'Google Pixel 7', 'Google Pixel 7 Pro', 'Google Pixel 7a', 'Google Pixel 8', 'Google Pixel 8 Pro', 'Google Pixel 8a', 'Google Pixel 9', 'Google Pixel 9 Pro', 'Google Pixel 9 Pro XL', 'Google Pixel 9a', 'Google Pixel 10', 'Google Pixel 10 Pro', 'Google Pixel 10 Pro XL', 'Google Pixel 10a'];
// Keep these original groups in place so existing simulated variant IDs stay unchanged.
const modelGroups = [{ brand: 'Apple', names: iphones }, { brand: 'Samsung', names: samsungs }, { brand: 'Google', names: pixels }];
// Public Podbase Tough listing checked on 2026-11-04; these remain local test variants.
const currentModelGroups = [
  { brand: 'Apple', names: ['iPhone 16e', 'iPhone 17', 'iPhone Air', 'iPhone 17e', 'iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone 18 Pro', 'iPhone 18 Pro Max'] },
  { brand: 'Samsung', names: ['Samsung Galaxy S25 Plus', 'Samsung Galaxy S25 Edge', 'Samsung Galaxy S25 FE', 'Samsung Galaxy S26', 'Samsung Galaxy S26 Plus', 'Samsung Galaxy S26 Ultra', 'Samsung Galaxy S26 FE', 'Samsung Galaxy A56', 'Samsung Galaxy A36', 'Samsung Galaxy A26', 'Samsung Galaxy A17', 'Samsung Galaxy A57', 'Samsung Galaxy A37', 'Samsung Galaxy A27', 'Samsung Galaxy Z Flip8'] },
  { brand: 'Google', names: ['Google Pixel 11', 'Google Pixel 11 Pro', 'Google Pixel 11 Pro XL'] }
];
export const MODELS = [...modelGroups, ...currentModelGroups].flatMap(({ brand, names }) => names.map(name => ({ name, brand }))).map(({ name, brand }, i) => ({
  id: name.toLowerCase().replaceAll(' ', '-'), name, brand,
  productId: 'SIM-TOUGH', variantId: `SIM-VARIANT-${i + 1}`, templateVersion: brand === 'Google' ? 'test-pixel-template-v1' : name.includes('Z Flip') ? 'test-flip-template-v3' : 'test-template-v1',
  template: { width: 1200, height: 2400, bleed: 60, safe: 125, ...(name.includes('Z Flip') ? { artArea: { x: 0, y: 1020, width: 1200, height: 1255 } } : {}), camera: brand === 'Google' ? { x: 80, y: 170, width: 1040, height: 300 } : name.includes('Z Flip') ? { x: 40, y: 0, width: 1120, height: 970 } : { x: 80, y: 80, width: name.includes('Ultra') ? 380 : 460, height: name.includes('Ultra') ? 600 : 510 } },
  simulated: true
}));
// Curated verbatim short excerpts from Luther 1912. Test-only; no modern translation is licensed.
export const VERSES = [
  { id: 'ps23-1', reference: 'Psalm 23,1', quote: 'Der Herr ist mein Hirte; mir wird nichts mangeln.', tags: ['ruhe', 'vertrauen', 'alltag'], explanation: 'Das Bild des Hirten erinnert daran, dass du deinen Weg begleitet gehen darfst.', source: 'https://www.die-bibel.de/bibel/LU12/PSA.23' },
  { id: 'ps56-4', reference: 'Psalm 56,4', quote: 'Wenn ich mich fürchte, so hoffe ich auf dich.', tags: ['angst', 'sorge', 'neuanfang'], explanation: 'Hier darf Angst ausgesprochen werden. Vertrauen kann mitten in der Unsicherheit beginnen.', source: 'https://www.biblegateway.com/passage/?search=Psalm+56%3A4&version=LUTH1912' },
  { id: 'jes41-10', reference: 'Jesaja 41,10', quote: 'fürchte dich nicht, ich bin mit dir', tags: ['angst', 'einsam', 'neuanfang'], explanation: 'Die Zusage von Nähe kann Mut geben, wenn ein nächster Schritt schwerfällt.', source: 'https://www.biblegateway.com/passage/?search=Isaiah+41%3A10&version=LUTH1912' },
  { id: 'mt11-28', reference: 'Matthäus 11,28', quote: 'ich will euch erquicken.', tags: ['ruhe', 'stress', 'erschöpft', 'last'], explanation: 'Diese Einladung richtet sich an Menschen, die viel tragen und sich nach einer Pause sehnen.', source: 'https://www.biblegateway.com/passage/?search=Matthew+11%3A28&version=LUTH1912' },
  { id: 'ps46-2', reference: 'Psalm 46,2', quote: 'Gott ist unsre Zuversicht und Stärke', tags: ['angst', 'trauer', 'stärke'], explanation: 'Der Psalm spricht von Halt in schweren Zeiten, ohne die Schwierigkeiten kleinzureden.', source: 'https://www.biblegateway.com/passage/?search=Psalm+46%3A2&version=LUTH1912' },
  { id: 'jer29-11', reference: 'Jeremia 29,11', quote: 'Gedanken des Friedens und nicht des Leides', tags: ['hoffnung', 'neuanfang', 'zukunft'], explanation: 'Ursprünglich an Menschen im Exil gerichtet, eröffnet diese Stelle einen Blick auf Hoffnung.', source: 'https://www.biblegateway.com/passage/?search=Jeremiah+29%3A11&version=LUTH1912' },
  { id: 'ps139-5', reference: 'Psalm 139,5', quote: 'Von allen Seiten umgibst du mich', tags: ['einsam', 'geborgen', 'familie'], explanation: 'Das Bild des Umgebenseins passt zum Wunsch, sich gesehen und gehalten zu wissen.', source: 'https://www.biblegateway.com/passage/?search=Psalm+139%3A5&version=LUTH1912' },
  { id: '1kor13-13', reference: '1. Korinther 13,13', quote: 'aber die Liebe ist die größte unter ihnen.', tags: ['liebe', 'geschenk', 'familie', 'hochzeit'], explanation: 'Die Liebe steht im Mittelpunkt dieser Stelle – ein Gedanke, den man gut weitergeben kann.', source: 'https://www.biblegateway.com/passage/?search=1+Corinthians+13%3A13&version=LUTH1912' },
  { id: 'jos1-6', reference: 'Josua 1,6', quote: 'Sei getrost und unverzagt', tags: ['mut', 'neuanfang', 'zukunft'], explanation: 'Josua steht vor einer neuen Aufgabe. Diese Ermutigung kann einen Aufbruch begleiten.', source: 'https://www.die-bibel.de/bibel/LU12/JOS.1' }
].map(v => ({ ...v, translation: 'Luther 1912 · Testquelle', rights: 'Nur für den lokalen Test freigegeben', liveApproved: false }));
const sources = { 'ps56-4': 'PSA.56', 'jes41-10': 'ISA.41', 'mt11-28': 'MAT.11', 'ps46-2': 'PSA.46', 'jer29-11': 'JER.29', 'ps139-5': 'PSA.139', '1kor13-13': '1CO.13' };
for (const verse of VERSES) if (sources[verse.id]) verse.source = `https://www.die-bibel.de/bibel/LU12/${sources[verse.id]}`;
export const findDesign = id => DESIGNS.find(x => x.id === id);
export const findModel = id => MODELS.find(x => x.id === id);
export const findVerse = id => VERSES.find(x => x.id === id);
