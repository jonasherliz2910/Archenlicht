const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value / 100);

// Advertise the actual opening price. A recently raised price is not an
// established former price; no invented comparison price or countdown is shown.
export function priceMarkup(amount, { openingOffer = false, from = false } = {}) {
  const value = `${from ? 'ab ' : ''}${money(amount)}`;
  return openingOffer
    ? `<span class="opening-price"><span class="opening-price-label">Eröffnungspreis</span><strong class="opening-price-value">${value}</strong></span>`
    : value;
}

export const newsletterEligible = items => items.length > 0 && !items.some(item => item.reduced === true || item.compareAtPrice > item.unitPrice || item.pricing?.discount > 0) && items.reduce((sum, item) => sum + item.quantity, 0) < 2;
