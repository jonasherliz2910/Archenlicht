import { token } from './store.js';
import { MODELS } from './catalog.js';
import { officialTemplate } from './production-print.js';
import { magneticVariant, localVariant } from './case-variants.js';

export function podbasePayload(order, baseUrl, { requireOfficialPrint = false } = {}) {
  const r = JSON.parse(order.recipient);
  const items = JSON.parse(order.items);
  if (requireOfficialPrint) {
    if (order.mode !== 'live' || !order.paid_at) throw new Error('Nur bezahlte Livebestellungen dürfen an Podbase übergeben werden.');
    if (!/^https:\/\/(www\.)?archenlicht\.de$/.test(baseUrl)) throw new Error('Die öffentliche Druckdatei-Adresse fehlt.');
    for (const item of items) {
      const template = officialTemplate(item.configuration.modelId, item.configuration.magsafe), print = item.configuration.productionPrint;
      if (!template || !print || print.templateHash !== template.hash || item.variantId !== template.variantId || item.productId !== template.productId || print.validation?.unsafePixels !== 0 || print.validation?.outsideCanvasPixels !== 0 || !/^[a-f0-9]{64}$/.test(item.hash)) throw new Error('Produkt, Variante und geprüfte Druckdatei stimmen nicht überein.');
    }
  }
  return {
    externalOrderId: order.id,
    buyerInfo: { name: r.name, phone: r.phone, email: r.email },
    deliveryAddress: { line1: r.street, ...(r.line2 ? { line2: r.line2 } : {}), city: r.city, postalCode: r.postalCode, country: 'DE' },
    shippingTypeId: 'PBS-F7-7ZH-223S',
    items: items.map(i => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, printFile: `${baseUrl}/prints/${i.hash}.png`, externalProductId: `${i.configuration.designId}-${i.configuration.modelId}-${i.hash}`, title: i.title }))
  };
}
export class LocalPodbase {
  constructor(store) { this.s = store; this.scenario = 'ok'; }
  async catalog() { return [{ id: 'SIM-TOUGH', title: 'Tough standard · SIMULIERT', variants: MODELS.map(m => ({ id: m.variantId, name: m.name, inStock: true })) }, { id: 'SIM-MAGSAFE', title: 'Magnetische Tough-Hülle · SIMULIERT', variants: MODELS.filter(m => magneticVariant(m.id)).map(m => ({ id: localVariant(m, { magsafe: true }).variantId, name: m.name, inStock: true })) }]; }
  async find(externalId) { const row = (await this.s.get('SELECT * FROM provider_orders WHERE external_id=?', externalId)); return row && { orderId: row.id, externalOrderId: row.external_id, status: row.status, trackingNumber: row.tracking, trackingUrl: null }; }
  async create(payload) {
    const existing = await this.find(payload.externalOrderId);
    if (existing) return existing;
    if (this.scenario === 'reject') { const e = new Error('Testablehnung: Die gewählte Variante ist beim Druckpartner nicht verfügbar.'); e.rejected = true; throw e; }
    const id = `SIM-PB-${token().slice(0, 12)}`;
    (await this.s.run('INSERT INTO provider_orders VALUES(?,?,?,?,?,?)', id, payload.externalOrderId, JSON.stringify(payload), 'APPROVED', null, Date.now()));
    if (this.scenario === 'timeout') { this.scenario = 'ok'; throw new Error('Simulierter Verbindungsabbruch nach Annahme. Abgleich erforderlich.'); }
    return { orderId: id, externalOrderId: payload.externalOrderId, status: 'APPROVED' };
  }
  async get(id) { const row = (await this.s.get('SELECT external_id FROM provider_orders WHERE id=?', id)); return row ? this.find(row.external_id) : null; }
  async advance(orderId) {
    const tracking = `SIM-DE-${orderId.slice(0, 10)}`;
    (await this.s.run("UPDATE provider_orders SET status='FULFILLED',tracking=? WHERE external_id=?", tracking, orderId));
  }
}
// Official schema snapshot: docs/podbase-openapi-2026-11-03.json.
// Instantiation is intentionally absent from the test server: Podbase has no free sandbox.
export class PodbaseAPI {
  constructor({ apiKey, baseUrl = 'https://open-api.podbase.com', productionApproved = false, storeId }) {
    if (baseUrl !== 'https://open-api.podbase.com' || !apiKey || /\s/.test(apiKey)) throw new Error('Ungültige Podbase-Verbindung.');
    if (storeId !== undefined && !/^PUS-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(storeId)) throw new Error('Ungültige Podbase-Store-Kennung.');
    this.apiKey = apiKey; this.baseUrl = baseUrl; this.approved = productionApproved; this.storeId = storeId;
  }
  async request(path, method = 'GET', body) {
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!res.ok) { const e = new Error(`Podbase-Anfrage fehlgeschlagen (HTTP ${res.status}).`); e.rejected = [400, 403, 422].includes(res.status); throw e; }
    return res.json();
  }
  catalog() { return this.request('/catalog'); }
  normalizeOrder(order) {
    // The real API prefixes imported external IDs with its store ID. Only strip
    // the explicitly configured store, never an arbitrary matching suffix.
    const prefix = this.storeId && `${this.storeId}-`, externalId = order?.externalOrderId;
    return prefix && typeof externalId === 'string' && externalId.startsWith(prefix)
      ? { ...order, providerExternalOrderId: externalId, externalOrderId: externalId.slice(prefix.length) }
      : order;
  }
  async get(id) { return this.normalizeOrder(await this.request(`/orders/${encodeURIComponent(id)}`)); }
  async find(externalId, { deadline = Date.now() + 40000 } = {}) {
    let match = null;
    for (let page = 0; page < 1000; page++) {
      if (Date.now() > deadline - 15000) throw new Error('Podbase-Abgleich zeitlich unvollständig. Kein neuer Auftrag wird gesendet.');
      const result = await this.request(`/orders?page=${page}&limit=100`);
      if (!Array.isArray(result.orders) || typeof result.pagination?.hasNextPage !== 'boolean') throw new Error('Podbase-Auftragsabgleich lieferte keine vollständige Antwort.');
      if (result.pagination.page !== undefined && result.pagination.page !== page) throw new Error('Podbase-Auftragsabgleich lieferte eine unerwartete Seite.');
      const matches = result.orders.map(o => this.normalizeOrder(o)).filter(o => o?.externalOrderId === externalId);
      if (matches.length > 1 || (match && matches.length)) throw new Error('Mehrere Podbase-Aufträge zur externen ID gefunden. Manuelle Klärung nötig.');
      if (matches[0]) match = matches[0];
      if (!result.pagination.hasNextPage) return match;
    }
    throw new Error('Podbase-Abgleich unvollständig. Kein neuer Auftrag wird gesendet.');
  }
  create(payload) {
    if (!this.approved) throw new Error('Kostenpflichtige Podbase-Produktion ist gesperrt. Produktionsfreigabe fehlt.');
    if (!payload.externalOrderId || !payload.items?.length || payload.items.some(i => !/^PBP-/.test(i.productId) || !/^PBV-/.test(i.variantId) || !Number.isInteger(i.quantity) || i.quantity < 1 || !/^https:\/\/(www\.)?archenlicht\.de\/prints\/[a-f0-9]{64}\.png$/.test(i.printFile))) throw new Error('Podbase-Auftrag enthält keine gültigen Produktionsdaten.');
    return this.request('/orders', 'POST', payload).then(order => this.normalizeOrder(order));
  }
}
