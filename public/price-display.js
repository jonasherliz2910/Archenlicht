import { casePrice, plannedCasePrice } from './case-options.js';

const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value / 100);

// Make the nature of the reference amount visible, including on mobile.
// It is a planned price, not an invented former price or sales history.
export function priceMarkup(amount, { openingOffer = false, plannedPrice, from = false } = {}) {
  const value = `${from ? 'ab ' : ''}${money(amount)}`;
  const comparison = openingOffer && Number.isSafeInteger(plannedPrice) && plannedPrice > amount;
  return openingOffer
    ? `<span class="opening-price"><span class="opening-price-label">Eröffnungspreis</span><span class="opening-price-amounts"><strong class="opening-price-value">${value}</strong>${comparison ? `<s class="opening-price-planned" aria-label="Geplanter Preis nach der Eröffnungsaktion: ${money(plannedPrice)}">${from ? 'ab ' : ''}${money(plannedPrice)}</s>` : ''}</span>${comparison ? '<span class="opening-price-explanation">Geplanter Preis nach der Eröffnungsaktion</span>' : ''}</span>`
    : `<strong class="regular-price">${value}</strong>`;
}

export const casePriceMarkup = (brand, configuration) => priceMarkup(casePrice(brand, configuration), { ...brand, plannedPrice: plannedCasePrice(brand, configuration) });
export const linePriceMarkup = item => priceMarkup(item.unitPrice * item.quantity, { ...item, plannedPrice: item.plannedUnitPrice * item.quantity });

export const newsletterEligible = items => items.length > 0 && !items.some(item => item.reduced === true || item.compareAtPrice > item.unitPrice || item.pricing?.discount > 0) && items.reduce((sum, item) => sum + item.quantity, 0) < 2;
