import { token } from './store.js';
import { MODELS } from './catalog.js';

export function podbasePayload(order, baseUrl) {
  const r = JSON.parse(order.recipient);
  return {
    externalOrderId: order.id,
    buyerInfo: { name: r.name, phone: r.phone, email: r.email },
    deliveryAddress: { line1: r.street, ...(r.line2 ? { line2: r.line2 } : {}), city: r.city, postalCode: r.postalCode, country: 'DE' },
    shippingTypeId: 'PBS-F7-7ZH-223S',
    items: JSON.parse(order.items).map(i => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, printFile: `${baseUrl}/prints/${i.hash}.png`, externalProductId: `${i.configuration.designId}-${i.configuration.modelId}-${i.hash}`, title: i.title, price: i.unitPrice }))
  };
}
export class LocalPodbase {
  constructor(store) { this.s = store; this.scenario = 'ok'; }
  async catalog() { return [{ id: 'SIM-TOUGH', title: 'Tough standard · SIMULIERT', variants: MODELS.map(m => ({ id: m.variantId, name: m.name, inStock: true })) }]; }
  async find(externalId) { const row = this.s.get('SELECT * FROM provider_orders WHERE external_id=?', externalId); return row && { orderId: row.id, externalOrderId: row.external_id, status: row.status, trackingNumber: row.tracking, trackingUrl: null }; }
  async create(payload) {
    const existing = await this.find(payload.externalOrderId);
    if (existing) return existing;
    if (this.scenario === 'reject') { const e = new Error('Testablehnung: Die gewählte Variante ist beim Druckpartner nicht verfügbar.'); e.rejected = true; throw e; }
    const id = `SIM-PB-${token().slice(0, 12)}`;
    this.s.run('INSERT INTO provider_orders VALUES(?,?,?,?,?,?)', id, payload.externalOrderId, JSON.stringify(payload), 'APPROVED', null, Date.now());
    if (this.scenario === 'timeout') { this.scenario = 'ok'; throw new Error('Simulierter Verbindungsabbruch nach Annahme. Abgleich erforderlich.'); }
    return { orderId: id, externalOrderId: payload.externalOrderId, status: 'APPROVED' };
  }
  async get(id) { const row = this.s.get('SELECT external_id FROM provider_orders WHERE id=?', id); return row ? this.find(row.external_id) : null; }
  advance(orderId) {
    const tracking = `SIM-DE-${orderId.slice(0, 10)}`;
    this.s.run("UPDATE provider_orders SET status='FULFILLED',tracking=? WHERE external_id=?", tracking, orderId);
  }
}
// Official schema snapshot: docs/podbase-openapi-2026-11-03.json.
// Instantiation is intentionally absent from the test server: Podbase has no free sandbox.
export class PodbaseAPI {
  constructor({ apiKey, baseUrl = 'https://open-api.podbase.com', productionApproved = false }) { this.apiKey = apiKey; this.baseUrl = baseUrl; this.approved = productionApproved; }
  async request(path, method = 'GET', body) {
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { const e = new Error(`Podbase-Anfrage fehlgeschlagen (HTTP ${res.status}).`); e.rejected = [400, 403, 422].includes(res.status); throw e; }
    return res.json();
  }
  catalog() { return this.request('/catalog'); }
  get(id) { return this.request(`/orders/${encodeURIComponent(id)}`); }
  async find(externalId) {
    for (let page = 0; page < 1000; page++) {
      const result = await this.request(`/orders?page=${page}&limit=100`);
      const matches = result.orders.filter(o => o.externalOrderId === externalId);
      if (matches.length > 1) throw new Error('Mehrere Podbase-Aufträge zur externen ID gefunden. Manuelle Klärung nötig.');
      if (matches[0]) return matches[0];
      if (!result.pagination.hasNextPage) return null;
    }
    throw new Error('Podbase-Abgleich unvollständig. Kein neuer Auftrag wird gesendet.');
  }
  create(payload) { if (!this.approved) throw new Error('Kostenpflichtige Podbase-Produktion ist gesperrt. Musterfreigabe fehlt.'); return this.request('/orders', 'POST', payload); }
}
