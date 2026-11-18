import { matchingFixedBundle } from './fixed-bundles.js';

export const BUNDLE = Object.freeze({ minimumQuantity: 2, percent: 5, higherMinimumQuantity: 4, higherPercent: 10, fixedSetPercent: 10, version: 'bundle-fixed-set-10-v3' });

function lineSubtotal(item) {
  if (!Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Ungültige Preisposition.');
  const subtotal = item.unitPrice * item.quantity;
  if (!Number.isSafeInteger(subtotal)) throw new Error('Ungültiger Positionsbetrag.');
  return subtotal;
}

function allocateDiscount(subtotals, discount) {
  const subtotal = subtotals.reduce((a, b) => a + b, 0);
  const shares = subtotals.map(value => subtotal ? Math.floor(discount * value / subtotal) : 0);
  let remainder = discount - shares.reduce((a, b) => a + b, 0);
  const ranked = subtotals.map((value, index) => ({ index, remainder: subtotal ? discount * value % subtotal : 0 })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of ranked) if (remainder-- > 0) shares[index]++;
  return shares;
}

function storedDiscounts(pricing) {
  if (pricing?.version !== 'newsletter-stack-5-v2') return pricing?.discount ? [{ source: pricing.source || 'bundle', percent: pricing.percent, discount: pricing.discount }] : [];
  const parts = pricing.discounts;
  const invalid = () => { throw new Error('Ungültiger gespeicherter Rabattpreis.'); };
  if (pricing.source !== 'newsletter' || pricing.percent !== 5 || !Array.isArray(parts) || !parts.length || parts.length > 2) invalid();
  let remaining = pricing.subtotal;
  const sources = new Set();
  for (const part of parts) {
    if (!part || !['bundle', 'newsletter'].includes(part.source) || sources.has(part.source)
      || !Number.isSafeInteger(part.percent) || part.percent < 0 || part.percent > 100
      || (part.source === 'newsletter' && part.percent !== 5)
      || !Number.isSafeInteger(part.discount) || part.discount < 0 || part.discount > remaining) invalid();
    sources.add(part.source); remaining -= part.discount;
  }
  if (parts.at(-1).source !== 'newsletter' || remaining !== pricing.total) invalid();
  return parts;
}

// Apply only to a current cart. Persist the result with the order so future
// pricing changes never recalculate an existing payment or order confirmation.
export function priceBundleItems(items) {
  const subtotals = items.map(lineSubtotal), subtotal = subtotals.reduce((a, b) => a + b, 0);
  const quantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const percent = quantity >= BUNDLE.higherMinimumQuantity ? BUNDLE.higherPercent : matchingFixedBundle(items) ? BUNDLE.fixedSetPercent : quantity >= BUNDLE.minimumQuantity ? BUNDLE.percent : 0;
  const discount = Math.floor((subtotal * percent + 50) / 100);
  const shares = allocateDiscount(subtotals, discount);
  return items.map((item, index) => ({ ...item, pricing: { version: BUNDLE.version, percent, subtotal: subtotals[index], discount: shares[index], total: subtotals[index] - shares[index] } }));
}

// Old orders without pricing snapshots retain their original full price.
export function summarizePricing(items) {
  let quantity = 0, subtotal = 0, discount = 0, percent = 0, source = null;
  const discounts = new Map();
  let hasComponents = false;
  for (const item of items) {
    const base = lineSubtotal(item), p = item.pricing;
    if (p && (p.subtotal !== base || !Number.isSafeInteger(p.discount) || p.discount < 0 || p.discount > base || p.total !== base - p.discount || !Number.isSafeInteger(p.percent) || p.percent < 0 || p.percent > 100)) throw new Error('Ungültiger gespeicherter Bundle-Preis.');
    quantity += item.quantity; subtotal += base; discount += p?.discount || 0; percent = Math.max(percent, p?.percent || 0);
    hasComponents ||= p?.version === 'newsletter-stack-5-v2';
    for (const part of storedDiscounts(p)) {
      const key = `${part.source}:${part.percent}`;
      const saved = discounts.get(key) || { source: part.source, percent: part.percent, discount: 0 };
      saved.discount += part.discount; discounts.set(key, saved);
    }
    if (p?.discount) {
      const next = p.source || 'bundle';
      if (source && source !== next) throw new Error('Rabatte können nicht kombiniert werden.');
      source = next;
    }
  }
  return { quantity, subtotal, discount, total: subtotal - discount, percent, isBundle: source === 'bundle' || [...discounts.values()].some(d => d.source === 'bundle' && d.discount > 0), ...(source === 'newsletter' ? { source } : {}), ...(hasComponents ? { discounts: [...discounts.values()] } : {}) };
}

// Use stored components for new orders; legacy orders retain their exact totals
// and labels, including already-created Stripe coupons and payment retries.
export function discountBreakdown(pricing) {
  return pricing.discounts || (pricing.discount ? [{ source: pricing.source || 'bundle', percent: pricing.percent, discount: pricing.discount }] : []);
}

// Only call after server-side code validation. Apply once to the remaining
// cart total, after sale prices and bundle discounts, with cent-exact shares.
export function priceNewsletterItems(items) {
  const summary = summarizePricing(items);
  if (!items.length) throw new Error('Dein Warenkorb ist noch leer.');
  if (items.some(item => item.pricing?.source === 'newsletter')) throw new Error('Der Newsletter-Rabatt ist bereits angewendet.');
  const remaining = items.map(item => lineSubtotal(item) - (item.pricing?.discount || 0));
  const shares = allocateDiscount(remaining, Math.floor((summary.total * 5 + 50) / 100));
  return items.map((item, index) => {
    const subtotal = lineSubtotal(item), previous = item.pricing?.discount || 0, discount = previous + shares[index];
    const discounts = [...(item.pricing?.percent ? [{ source: 'bundle', percent: item.pricing.percent, discount: previous }] : []), { source: 'newsletter', percent: 5, discount: shares[index] }];
    return { ...item, pricing: { version: 'newsletter-stack-5-v2', source: 'newsletter', percent: 5, subtotal, discount, total: subtotal - discount, discounts } };
  });
}
