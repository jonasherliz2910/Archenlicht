import { matchingFixedBundle } from './fixed-bundles.js';

export const BUNDLE = Object.freeze({ minimumQuantity: 2, percent: 5, higherMinimumQuantity: 4, higherPercent: 10, fixedSetPercent: 10, version: 'bundle-fixed-set-10-v3' });

function lineSubtotal(item) {
  if (!Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Ungültige Preisposition.');
  const subtotal = item.unitPrice * item.quantity;
  if (!Number.isSafeInteger(subtotal)) throw new Error('Ungültiger Positionsbetrag.');
  return subtotal;
}

// Apply only to a current cart. Persist the result with the order so future
// pricing changes never recalculate an existing payment or order confirmation.
export function priceBundleItems(items) {
  const subtotals = items.map(lineSubtotal), subtotal = subtotals.reduce((a, b) => a + b, 0);
  const quantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const percent = quantity >= BUNDLE.higherMinimumQuantity ? BUNDLE.higherPercent : matchingFixedBundle(items) ? BUNDLE.fixedSetPercent : quantity >= BUNDLE.minimumQuantity ? BUNDLE.percent : 0;
  const discount = Math.floor((subtotal * percent + 50) / 100);
  const shares = subtotals.map(value => subtotal ? Math.floor(discount * value / subtotal) : 0);
  let remainder = discount - shares.reduce((a, b) => a + b, 0);
  const ranked = subtotals.map((value, index) => ({ index, remainder: subtotal ? discount * value % subtotal : 0 })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of ranked) if (remainder-- > 0) shares[index]++;
  return items.map((item, index) => ({ ...item, pricing: { version: BUNDLE.version, percent, subtotal: subtotals[index], discount: shares[index], total: subtotals[index] - shares[index] } }));
}

// Old orders without pricing snapshots retain their original full price.
export function summarizePricing(items) {
  let quantity = 0, subtotal = 0, discount = 0, percent = 0, source = null;
  for (const item of items) {
    const base = lineSubtotal(item), p = item.pricing;
    if (p && (p.subtotal !== base || !Number.isSafeInteger(p.discount) || p.discount < 0 || p.discount > base || p.total !== base - p.discount || !Number.isSafeInteger(p.percent) || p.percent < 0 || p.percent > 100)) throw new Error('Ungültiger gespeicherter Bundle-Preis.');
    quantity += item.quantity; subtotal += base; discount += p?.discount || 0; percent = Math.max(percent, p?.percent || 0);
    if (p?.discount) {
      const next = p.source || 'bundle';
      if (source && source !== next) throw new Error('Rabatte können nicht kombiniert werden.');
      source = next;
    }
  }
  return { quantity, subtotal, discount, total: subtotal - discount, percent, isBundle: source === 'bundle', ...(source === 'newsletter' ? { source } : {}) };
}

// Only call after server-side code validation. Never replace a discounted price.
export function priceNewsletterItems(items) {
  const summary = summarizePricing(items);
  if (!items.length || summary.discount || summary.quantity >= BUNDLE.minimumQuantity || items.some(i => i.reduced === true || i.compareAtPrice > i.unitPrice || i.pricing?.percent > 0)) throw new Error('Der Newsletter-Rabatt gilt nur für nicht reduzierte Hüllen und ist nicht mit anderen Rabatten kombinierbar.');
  return items.map(item => {
    const subtotal = lineSubtotal(item), discount = Math.floor((subtotal * 5 + 50) / 100);
    return { ...item, pricing: { version: 'newsletter-5-v1', source: 'newsletter', percent: 5, subtotal, discount, total: subtotal - discount } };
  });
}
