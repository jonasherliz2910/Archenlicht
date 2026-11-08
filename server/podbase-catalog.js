import { readFileSync } from 'node:fs';
import { ShopError } from './layout.js';

export const PODBASE_MODEL_MAP = JSON.parse(readFileSync(new URL('./podbase-model-map.json', import.meta.url), 'utf8'));
const normalize = name => name.trim().replace(/\s+/g, ' ').toLowerCase();
const unavailable = () => new ShopError('Die Verfügbarkeit beim Druckpartner kann gerade nicht geprüft werden. Bitte versuche es in Kürze erneut.', 503);

// A separate GET-only connection. This object has no order API and cannot
// submit customer data, create orders or release production.
export class PodbaseCatalog {
  static validate({ apiKey, baseUrl = 'https://open-api.podbase.com' }) {
    if (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey.trim())) throw new Error('Für PODBASE_MODE=catalog fehlt ein gültiger PODBASE_API_KEY.');
    if (baseUrl.replace(/\/$/, '') !== 'https://open-api.podbase.com') throw new Error('Der Podbase-Katalog darf nur über die offizielle HTTPS-Adresse verbunden werden.');
  }
  constructor(config, { fetchImpl = (...args) => fetch(...args), now = Date.now } = {}) {
    PodbaseCatalog.validate(config);
    this.key = config.apiKey.trim(); this.fetch = fetchImpl; this.now = now;
    this.cached = null; this.pending = null; this.retryAfter = 0;
  }
  summary(snapshot = this.cached) {
    return { mode: 'catalog', connected: Boolean(snapshot), checkedAt: snapshot?.checkedAt || null,
      mappedModels: snapshot?.models.filter(m => m.matched).length || 0,
      availableModels: snapshot?.models.filter(m => m.inStock).length || 0,
      totalModels: PODBASE_MODEL_MAP.models.length, fulfillmentMode: 'simulated', orderSubmissionEnabled: false };
  }
  async load() {
    const response = await this.fetch('https://open-api.podbase.com/catalog', {
      method: 'GET', headers: { 'x-api-key': this.key, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw unavailable();
    const products = await response.json();
    if (!Array.isArray(products)) throw unavailable();
    const matches = products.filter(p => p.id === PODBASE_MODEL_MAP.productId);
    if (matches.length !== 1 || !Array.isArray(matches[0].variants)) throw unavailable();
    const variants = matches[0].variants;
    if (variants.some(v => typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.inStock !== 'boolean') || new Set(variants.map(v => v.id)).size !== variants.length) throw unavailable();
    const models = PODBASE_MODEL_MAP.models.map(mapping => {
      const variant = variants.find(v => v.id === mapping.variantId && normalize(v.name) === normalize(mapping.catalogName));
      return { ...mapping, productId: PODBASE_MODEL_MAP.productId, matched: Boolean(variant), inStock: variant?.inStock === true, productionApproved: false };
    });
    return { checkedAt: new Date(this.now()).toISOString(), expiresAt: this.now() + 300000, models };
  }
  async snapshot({ force = false, strict = false } = {}) {
    if (this.retryAfter > this.now()) { if (strict) throw unavailable(); return null; }
    if (!force && this.cached?.expiresAt > this.now()) return this.cached;
    if (!this.pending) {
      this.pending = this.load().then(snapshot => { this.cached = snapshot; this.retryAfter = 0; return snapshot; })
        .catch(() => { this.cached = null; this.retryAfter = this.now() + 30000; return null; })
        .finally(() => { this.pending = null; });
    }
    const snapshot = await this.pending;
    if (!snapshot && strict) throw unavailable();
    return snapshot;
  }
}
