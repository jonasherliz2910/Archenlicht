import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND, DESIGNS, MODELS, VERSES, findDesign, findModel } from './catalog.js';
import { ShopError, renderLayout, rasterize, normalizeConfiguration } from './layout.js';
import { openStore, token, digest, passwordHash, passwordMatches } from './store.js';
import { LocalPodbase, podbasePayload } from './podbase.js';
import { Payments } from './payments.js';

export class Shop {
  constructor(config) {
    if (config.shopMode !== 'test') throw new Error('Livebetrieb ist bis zur vollständigen Freigabe der Live-Voraussetzungen gesperrt.');
    if (!['local', 'sandbox'].includes(config.paymentMode)) throw new Error('PAYMENT_MODE muss local oder sandbox sein.');
    if (config.podbaseMode !== 'local' || config.mailMode !== 'local') throw new Error('Produktion und echter Mailversand benötigen eine separate Freigabe. Bitte lokale Adapter verwenden.');
    this.config = config; this.s = openStore(config.dataDir, config); this.podbase = new LocalPodbase(this.s); this.payments = new Payments(config, this.s);
    this.situations = new Map(); this.advisorScenario = 'ok'; this.busy = false;
    mkdirSync(join(config.dataDir, 'prints'), { recursive: true });
  }
  createSession(source = 'unbekannt', campaign = null) {
    const secret = token(), id = digest(secret), visit = randomUUID(), now = Date.now(), csrf = token();
    this.s.tx(() => { this.s.run('INSERT INTO visits VALUES(?,?,?,?,?)', visit, source, campaign, now, 'test'); this.s.run('INSERT INTO sessions VALUES(?,?,?,?,?,?)', id, csrf, null, visit, now + this.config.sessionHours * 3600000, now); });
    return { secret, session: this.s.get('SELECT * FROM sessions WHERE id=?', id) };
  }
  session(secret) { return secret ? this.s.get('SELECT * FROM sessions WHERE id=? AND expires>?', digest(secret), Date.now()) : null; }
  user(session) { return session?.user_id ? this.s.get('SELECT id,email,role FROM users WHERE id=?', session.user_id) : null; }
  requireUser(session) { const user = this.user(session); if (!user) throw new ShopError('Bitte melde dich zuerst in deinem Kundenkonto an.', 401); return user; }
  accountDetails(session) {
    const user = this.user(session); if (!user) return null;
    const profile = this.s.get('SELECT address,address_version FROM account_profiles WHERE user_id=?', user.id);
    return { address: profile?.address ? JSON.parse(profile.address) : null, addressVersion: profile?.address_version || 0 };
  }
  saveAddress(session, input) {
    const user = this.requireUser(session), recipient = this.validateRecipient(input);
    this.s.run('INSERT INTO account_profiles VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET address=excluded.address,address_version=account_profiles.address_version+1,updated=excluded.updated', user.id, JSON.stringify(recipient), Date.now());
    return this.accountDetails(session);
  }
  removeAddress(session) {
    const user = this.requireUser(session);
    // Keep the revision so a delayed checkout cannot restore an address after deletion.
    this.s.run('INSERT INTO account_profiles VALUES(?,NULL,1,?) ON CONFLICT(user_id) DO UPDATE SET address=NULL,address_version=account_profiles.address_version+1,updated=excluded.updated', user.id, Date.now());
    return this.accountDetails(session);
  }
  requireAdmin(session) { if (this.user(session)?.role !== 'admin') throw new ShopError('Diese Ansicht ist nur für Jonas zugänglich.', 403); }
  cleanup(now = Date.now()) {
    this.s.run('DELETE FROM sessions WHERE expires<?', now);
    for (const [id, value] of this.situations) if (value.expires <= now || !this.s.get('SELECT id FROM sessions WHERE id=?', id)) this.situations.delete(id);
  }
  publicState(session) {
    const variants = this.s.all('SELECT * FROM variants');
    return { brand: BRAND, designs: DESIGNS, models: MODELS, verses: VERSES, variants, mode: 'test', paymentMode: this.config.paymentMode, csrf: session.csrf, user: this.user(session), account: this.accountDetails(session), cart: this.cart(session), sessionExpires: session.expires, sessionHours: this.config.sessionHours };
  }
  track(session, type, kind, designId) {
    if (!['view', 'cart'].includes(type) || !['fixed', 'custom'].includes(kind) || !findDesign(designId)) throw new ShopError('Ungültiges Ereignis.');
    this.s.run('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)', session.visit_id, type, kind, designId, Date.now());
  }
  assertAvailable(c) {
    const variant = this.s.get('SELECT * FROM variants WHERE model_id=? AND design_id=?', c.modelId, c.designId);
    if (!variant?.available || !variant.print_approved || variant.approval_mode !== this.config.shopMode) throw new ShopError('Dieses Motiv ist für dein Handymodell gerade nicht verfügbar. Bitte wähle ein anderes Modell oder Motiv.', 409);
  }
  preview(input) {
    const layout = renderLayout(input);
    this.s.run('INSERT OR IGNORE INTO assets VALUES(?,?,?,?,?)', layout.hash, JSON.stringify(layout.configuration), layout.printText, layout.svg, Date.now());
    return { configuration: layout.configuration, hash: layout.hash, svgUrl: `/prints/${layout.hash}.svg`, pngUrl: `/prints/${layout.hash}.png`, printText: layout.printText, camera: layout.camera, layoutVersion: layout.configuration.layoutVersion, productionApproved: layout.productionApproved, sourcePixels: layout.sourcePixels, simulated: true };
  }
  async printFile(hash, format) {
    const asset = this.s.get('SELECT * FROM assets WHERE hash=?', hash);
    if (!asset) throw new ShopError('Druckdatei nicht gefunden.', 404);
    if (format === 'svg') return asset.svg;
    const path = join(this.config.dataDir, 'prints', `${hash}.png`);
    if (!existsSync(path)) { const buffer = await rasterize(asset.svg); try { writeFileSync(path, buffer, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
    return readFileSync(path);
  }
  cart(session) {
    return this.s.all('SELECT * FROM cart WHERE session_id=? ORDER BY created', session.id).map(row => {
      const c = JSON.parse(row.configuration), p = this.preview(c), model = findModel(c.modelId), d = findDesign(c.designId), variant = this.s.get('SELECT * FROM variants WHERE model_id=? AND design_id=?', c.modelId, c.designId);
      return { id: row.id, configuration: c, ...p, title: c.kind === 'custom' ? `Dein Wunschvers · ${d.title}` : d.title, model: model.name, quantity: row.quantity, unitPrice: c.kind === 'custom' ? BRAND.customPrice : BRAND.fixedPrice, productId: model.productId, variantId: model.variantId, available: Boolean(variant?.available && variant.print_approved && variant.approval_mode === 'test') };
    });
  }
  saveCart(session, input, existingId) {
    const c = normalizeConfiguration(input); this.assertAvailable(c); this.preview(c);
    const quantity = Number(input.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new ShopError('Bitte wähle zwischen 1 und 10 Hüllen.');
    if (existingId) {
      if (!this.s.get('SELECT id FROM cart WHERE id=? AND session_id=?', existingId, session.id)) throw new ShopError('Warenkorbposition nicht gefunden.', 404);
      this.s.run('UPDATE cart SET configuration=?,quantity=? WHERE id=? AND session_id=?', JSON.stringify(c), quantity, existingId, session.id);
    } else {
      if (this.s.get('SELECT COUNT(*) AS n FROM cart WHERE session_id=?', session.id).n >= 20) throw new ShopError('Dein Warenkorb enthält bereits 20 Positionen.');
      this.s.run('INSERT INTO cart VALUES(?,?,?,?,?)', randomUUID(), session.id, JSON.stringify(c), quantity, Date.now());
    }
    this.track(session, 'cart', c.kind, c.designId); return this.cart(session);
  }
  removeCart(session, id) { this.s.run('DELETE FROM cart WHERE id=? AND session_id=?', id, session.id); return this.cart(session); }
  authenticate(session, input, register = false) {
    const email = String(input.email || '').trim().toLowerCase(), password = String(input.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) throw new ShopError('Bitte gib eine gültige E-Mail-Adresse ein.');
    let user = this.s.get('SELECT * FROM users WHERE email=?', email);
    if (register) {
      if (password.length < 12 || password.length > 128) throw new ShopError('Bitte verwende ein Passwort mit 12 bis 128 Zeichen.');
      if (user) throw new ShopError('Dieses Konto kann nicht angelegt werden. Bitte versuche die Anmeldung.', 409);
      const id = randomUUID(); this.s.run('INSERT INTO users VALUES(?,?,?,?,?)', id, email, passwordHash(password), 'customer', Date.now()); user = this.s.get('SELECT * FROM users WHERE id=?', id);
    } else if (!user || password.length > 128 || !passwordMatches(password, user.password)) throw new ShopError('E-Mail oder Passwort stimmt nicht.', 401);
    // Rotate both session cookie and CSRF after authentication; retain the existing cart and visit.
    const secret = token(), newId = digest(secret), csrf = token();
    this.s.tx(() => {
      this.s.run('INSERT INTO sessions VALUES(?,?,?,?,?,?)', newId, csrf, user.id, session.visit_id, session.expires, session.created);
      this.s.run('UPDATE cart SET session_id=? WHERE session_id=?', newId, session.id);
      this.s.run('UPDATE orders SET session_id=? WHERE session_id=?', newId, session.id);
      this.s.run('UPDATE order_access SET session_id=? WHERE session_id=?', newId, session.id);
      this.s.run('DELETE FROM sessions WHERE id=?', session.id);
    });
    const current = this.situations.get(session.id); if (current) { this.situations.set(newId, current); this.situations.delete(session.id); }
    return { secret, session: this.s.get('SELECT * FROM sessions WHERE id=?', newId) };
  }
  advise(session, description) {
    const situation = String(description || '').trim();
    if (situation.length > 1000) throw new ShopError('Bitte beschreibe deine Situation in höchstens 1.000 Zeichen.');
    this.situations.set(session.id, { text: situation, expires: session.expires });
    if (this.advisorScenario === 'unavailable') return { reason: 'Die Beratung ist gerade nicht erreichbar. Entdecke unsere sechs kuratierten Motive.', recommendations: [], designs: DESIGNS, simulated: true };
    const text = situation.toLocaleLowerCase('de');
    const families = { angst: ['angst', 'sorg', 'fürcht', 'prüf'], ruhe: ['stress', 'erschöpf', 'müde', 'ruhe', 'last', 'pause'], neuanfang: ['neu', 'beginn', 'umzug', 'arbeit', 'zukunft', 'mut'], einsam: ['allein', 'einsam', 'nähe', 'geborgen'], liebe: ['lieb', 'hochzeit', 'geschenk', 'freund', 'familie'], trauer: ['trauer', 'verlust', 'gestorben', 'schwer', 'krank'], vertrauen: ['gott', 'glaub', 'vertrau', 'hoffnung'] };
    const topics = Object.entries(families).filter(([, words]) => words.some(w => text.includes(w))).map(([topic]) => topic);
    if (!situation || !topics.length || this.advisorScenario === 'no-match') return { reason: 'Für diese Beschreibung finden wir im geprüften Testbestand keine passende Auswahl. Hier sind die sechs kuratierten Motive.', recommendations: [], designs: DESIGNS, simulated: true };
    const ranked = VERSES.map((v, i) => ({ v, i, score: v.tags.filter(t => topics.includes(t)).length })).sort((a, b) => b.score - a.score || a.i - b.i);
    return { recommendations: ranked.slice(0, 3).map(x => x.v), simulated: true, notice: 'Lokale Testberatung · regelbasierte Auswahl, keine externe KI. Zitate stammen unverändert aus dem Testbestand.' };
  }
  validateRecipient(input) {
    const fields = ['name', 'email', 'phone', 'street', 'postalCode', 'city', 'country'];
    const r = Object.fromEntries(fields.map(f => [f, String(input[f] || '').trim()]));
    if (Object.values(r).some(v => !v || v.length > 180 || /[\x00-\x1f<>]/.test(v))) throw new ShopError('Bitte fülle alle Lieferdaten korrekt aus.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw new ShopError('Bitte prüfe deine E-Mail-Adresse.');
    if (!/^\+[1-9]\d{6,14}$/.test(r.phone.replaceAll(' ', ''))) throw new ShopError('Bitte gib deine Telefonnummer mit Landesvorwahl an, zum Beispiel +4915112345678.');
    r.phone = r.phone.replaceAll(' ', '');
    if (r.country !== 'DE' || !/^\d{5}$/.test(r.postalCode)) throw new ShopError('Wir versenden ausschließlich innerhalb Deutschlands. Bitte prüfe Land und Postleitzahl.');
    return r;
  }
  async checkout(session, input) {
    const items = this.cart(session); if (!items.length) throw new ShopError('Dein Warenkorb ist noch leer.');
    for (const i of items) this.assertAvailable(i.configuration);
    const providerCatalog = await this.podbase.catalog();
    for (const i of items) {
      const product = providerCatalog.find(p => p.id === i.productId), variant = product?.variants.find(v => v.id === i.variantId);
      if (!variant || variant.inStock !== true) throw new ShopError('Dein Handymodell ist im aktuellen Druckpartner-Katalog nicht bestellbar. Bitte bearbeite den Warenkorb.', 409);
      i.productId = product.id; i.variantId = variant.id;
    }
    const recipient = this.validateRecipient(input.recipient || {});
    if (!['paypal', 'card'].includes(input.method)) throw new ShopError('Bitte wähle PayPal oder Kartenzahlung.');
    if (input.saveAddress !== undefined && typeof input.saveAddress !== 'boolean') throw new ShopError('Bitte entscheide, ob du die Lieferdaten speichern möchtest.');
    const user = this.user(session), saveAddress = input.saveAddress === true;
    if (saveAddress && !user) throw new ShopError('Zum Speichern der Lieferdaten ist ein Kundenkonto erforderlich.', 401);
    const customerId = user && input.method === 'card' ? await this.payments.customerFor(user) : null;
    if (user) this.s.run('INSERT OR IGNORE INTO account_profiles VALUES(?,NULL,0,?)', user.id, Date.now());
    const addressVersion = this.accountDetails(session)?.addressVersion || 0;
    const id = randomUUID(), guestToken = token(), amount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), now = Date.now();
    const number = `AL-${new Intl.DateTimeFormat('de', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(now)}-${token().replace(/[-_]/g, '').slice(0, 9).toUpperCase()}`;
    const visit = this.s.get('SELECT source FROM visits WHERE id=?', session.visit_id);
    const snapshot = items.map(({ id, configuration, hash, title, model, quantity, unitPrice, printText, productId, variantId }) => ({ id, configuration, hash, title, model, quantity, unitPrice, printText, productId, variantId }));
    this.s.tx(() => {
      this.s.run('INSERT INTO orders(id,number,session_id,user_id,guest_hash,recipient,items,amount,currency,status,payment_method,source,visit_id,mode,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, number, session.id, session.user_id, digest(guestToken), JSON.stringify(recipient), JSON.stringify(snapshot), amount, 'EUR', 'awaiting_payment', input.method, visit.source, session.visit_id, 'test', now);
      this.s.run('INSERT INTO checkout_preferences VALUES(?,?,?,?,?)', id, user?.id || null, saveAddress ? 1 : 0, addressVersion, customerId);
      this.mail(id, 'confirmation', recipient.email, `Testbestellung ${number} bestätigt`, `SIMULIERTE E-MAIL · kein echter Versand.\nDeine Testbestellung ${number} ist bezahlt.\nPersönlicher Statuslink: ${this.config.baseUrl}/bestellung/${id}#token=${guestToken}\nGeschenkkarte 10 × 15 cm zum Selbstbeschriften inklusive.`, 'pending-payment');
    });
    const order = this.s.get('SELECT * FROM orders WHERE id=?', id);
    try {
      const payment = await this.payments.create(order, { customerId });
      if (!payment.url) throw new ShopError('Die Testzahlung konnte nicht eingerichtet werden.', 502);
      this.s.run('UPDATE orders SET payment_id=? WHERE id=?', payment.id, id);
      return { orderId: id, number, url: payment.url, simulated: payment.simulated };
    } catch (e) { this.s.run("UPDATE orders SET status='payment_setup_failed' WHERE id=?", id); throw e; }
  }
  acceptPayment(event) {
    return this.s.tx(() => {
      const order = this.s.get('SELECT * FROM orders WHERE id=?', event.orderId);
      if (!order || !event.id || typeof event.paymentId !== 'string' || !event.completed || event.amount !== order.amount || event.currency !== 'EUR' || event.paymentId !== order.payment_id) throw new ShopError('Zahlungsstatus, Betrag, Währung oder Bestellbezug stimmen nicht überein.', 409);
      const preferences = this.s.get('SELECT * FROM checkout_preferences WHERE order_id=?', order.id);
      if (this.config.paymentMode === 'sandbox' && preferences?.customer_id && event.customerId !== preferences.customer_id) throw new ShopError('Die Zahlung gehört nicht zum vorgesehenen Stripe-Kundenkonto.', 409);
      if (this.s.get('SELECT id FROM payment_events WHERE id=?', event.id)) return { duplicate: true };
      this.s.run('INSERT INTO payment_events VALUES(?,?,?,?,?)', event.id, order.id, event.paymentId, 'COMPLETED', Date.now());
      if (order.paid_at) return { duplicate: true };
      // A deactivated variant after provider handoff is held for manual handling, never sent to production.
      const available = JSON.parse(order.items).every(i => { const v = this.s.get('SELECT * FROM variants WHERE model_id=? AND design_id=?', i.configuration.modelId, i.configuration.designId); return v?.available && v.print_approved && v.approval_mode === 'test'; });
      this.s.run("UPDATE orders SET status='paid',paid_at=? WHERE id=?", Date.now(), order.id);
      if (preferences?.save_address && preferences.user_id === order.user_id) this.s.run('UPDATE account_profiles SET address=?,address_version=address_version+1,updated=? WHERE user_id=? AND address_version=?', order.recipient, Date.now(), order.user_id, preferences.address_version);
      if (this.config.paymentMode === 'local' && event.saveCard === true && order.user_id && order.payment_method === 'card') this.s.run('INSERT OR IGNORE INTO local_payment_methods VALUES(?,?,?,?,?,?,?)', `SIM-CARD-${digest(order.user_id).slice(0, 24)}`, order.user_id, 'visa', '4242', 12, new Date().getUTCFullYear() + 4, Date.now());
      this.s.run('INSERT INTO fulfillment(order_id,state,error,updated) VALUES(?,?,?,?)', order.id, available ? 'ready' : 'rejected', available ? null : 'Variante nach Zahlungsbeginn weggefallen. Bitte Erstattung oder Ersatz klären.', Date.now());
      this.s.run("UPDATE mail_outbox SET status='local-delivered' WHERE order_id=? AND kind='confirmation'", order.id);
      const purchased = JSON.parse(order.items).map(i => i.id);
      for (const itemId of purchased) this.s.run('DELETE FROM cart WHERE id=? AND session_id=?', itemId, order.session_id);
      if (!available) this.alert(order, 'Variante nach Zahlungsbeginn weggefallen.');
      return { duplicate: false };
    });
  }
  authorizeOrder(session, id, guestSecret) {
    const o = this.s.get('SELECT * FROM orders WHERE id=?', id);
    const capabilityValid = o && guestSecret && digest(guestSecret) === o.guest_hash;
    const grant = session && this.s.get('SELECT order_id FROM order_access WHERE session_id=? AND order_id=?', session.id, id);
    if (!o || !(o.session_id === session?.id || (o.user_id && o.user_id === session?.user_id) || this.user(session)?.role === 'admin' || grant || capabilityValid)) throw new ShopError('Bestellung nicht gefunden oder Zugriff nicht erlaubt.', 404);
    if (capabilityValid && session) this.s.run('INSERT OR IGNORE INTO order_access VALUES(?,?)', session.id, id);
    return o;
  }
  confirmLocalPayment(session, order, input) {
    if (this.config.paymentMode !== 'local') throw new ShopError('Lokale Testbestätigungen sind im Sandbox-Modus gesperrt.', 403);
    if (order.status === 'cancelled') throw new ShopError('Diese Zahlung wurde abgebrochen. Bitte beginne im Warenkorb erneut.', 409);
    if (input.saveCard !== undefined && typeof input.saveCard !== 'boolean') throw new ShopError('Ungültige Speicherauswahl.');
    if (input.saveCard || input.savedCardId) {
      if (!order.user_id || session.user_id !== order.user_id || order.payment_method !== 'card') throw new ShopError('Gespeicherte Karten gehören ausschließlich zum eigenen Kundenkonto.', 403);
      if (input.savedCardId && (typeof input.savedCardId !== 'string' || !/^SIM-CARD-[a-f0-9]{24}$/.test(input.savedCardId))) throw new ShopError('Karte nicht gefunden.', 404);
      if (input.savedCardId && !this.s.get('SELECT id FROM local_payment_methods WHERE id=? AND user_id=?', input.savedCardId, session.user_id)) throw new ShopError('Karte nicht gefunden.', 404);
      if (input.savedCardId && input.saveCard) throw new ShopError('Bitte verwende eine gespeicherte Karte oder speichere eine neue Demo-Karte.');
    }
    return this.acceptPayment({ id: `local-completed-${order.payment_id}`, orderId: order.id, paymentId: order.payment_id, amount: order.amount, currency: 'EUR', completed: true, saveCard: input.saveCard === true });
  }
  orderView(order, session) {
    const fulfillment = this.s.get('SELECT * FROM fulfillment WHERE order_id=?', order.id);
    return { id: order.id, number: order.number, amount: order.amount, currency: order.currency, status: order.status, paid: Boolean(order.paid_at), method: order.payment_method, canSaveCard: Boolean(session?.user_id && session.user_id === order.user_id && order.payment_method === 'card'), items: JSON.parse(order.items), recipient: JSON.parse(order.recipient), purpose: order.purpose, created: order.created, fulfillment, simulated: true };
  }
  mail(orderId, kind, recipient, subject, body, status = 'local-delivered') { this.s.run('INSERT OR IGNORE INTO mail_outbox VALUES(?,?,?,?,?,?,?,?)', randomUUID(), orderId, kind, recipient, subject, body, status, Date.now()); }
  alert(order, reason) { this.mail(order.id, 'fulfillment-error', this.config.adminEmail, `Handlungsbedarf · ${order.number}`, `SIMULIERTE ADMIN-E-MAIL\nBestellung ${order.number} wurde bezahlt, bleibt aber offen.\n${reason}\nGeschützter Auftragslink (Admin-Anmeldung): ${this.config.baseUrl}/bestellung/${order.id}`); }
  async tick() {
    if (this.busy) return; this.busy = true;
    try {
      this.cleanup();
      const jobs = this.s.all("SELECT f.*,o.paid_at FROM fulfillment f JOIN orders o ON o.id=f.order_id WHERE f.state IN ('ready','sending','uncertain','production') AND f.lease_until<? ORDER BY f.updated LIMIT 10", Date.now());
      for (const job of jobs) {
        const claimed = this.s.run("UPDATE fulfillment SET lease_until=?,state=CASE WHEN state='ready' THEN 'sending' ELSE state END WHERE order_id=? AND lease_until<?", Date.now() + 30000, job.order_id, Date.now());
        if (!claimed.changes) continue;
        const order = this.s.get('SELECT * FROM orders WHERE id=?', job.order_id);
        try {
          if (job.state === 'production') {
            if (this.config.autoShip && Date.now() - job.paid_at > 16000) this.podbase.advance(order.id);
            const remote = await this.podbase.get(job.provider_id);
            if (!remote || remote.externalOrderId !== order.id) throw new Error('Anbieter-ID und externe Bestell-ID passen nicht zusammen.');
            if (['REJECTED', 'CANCELED'].includes(remote.status)) { const e = new Error('Podbase hat den bereits übergebenen Auftrag abgelehnt oder storniert.'); e.rejected = true; throw e; }
            if (remote.status === 'FULFILLED' && remote.trackingNumber) {
              this.s.tx(() => {
                this.s.run("UPDATE fulfillment SET state='shipped',tracking=?,tracking_url=?,updated=? WHERE order_id=?", remote.trackingNumber, remote.trackingUrl, Date.now(), order.id);
                this.s.run("UPDATE orders SET status='shipped' WHERE id=?", order.id);
                this.mail(order.id, 'shipping', JSON.parse(order.recipient).email, `Testversand · ${order.number}`, `SIMULIERTE VERSANDMAIL\nDeine Testhülle ist unterwegs.\nSendungsnummer: ${remote.trackingNumber}\nDies ist kein echter Versand. Dein persönlicher Statuslink steht in der Bestellbestätigung.`);
              });
            }
          } else {
            // Reconcile before every possible create, including restarts and unknown network outcomes.
            let remote = await this.podbase.find(order.id);
            if (!remote && ['sending', 'uncertain'].includes(job.state)) { this.s.run("UPDATE fulfillment SET state='uncertain',error=? WHERE order_id=?", 'Unklarer Übermittlungsstatus. Abgleich ergab noch keinen Auftrag; keine automatische Neusendung.', order.id); this.alert(order, 'Übermittlung unklar. Bitte beim Anbieter prüfen, bevor erneut gesendet wird.'); continue; }
            if (!remote) {
              for (const item of JSON.parse(order.items)) this.assertAvailable(item.configuration);
              this.s.run("UPDATE fulfillment SET state='sending',attempts=attempts+1,updated=? WHERE order_id=?", Date.now(), order.id);
              remote = await this.podbase.create(podbasePayload(order, this.config.printBaseUrl || this.config.baseUrl));
            }
            if (remote.externalOrderId && remote.externalOrderId !== order.id) throw new Error('Externe Bestell-ID im Anbieterabgleich stimmt nicht überein.');
            this.s.run("UPDATE fulfillment SET state='production',provider_id=?,error=NULL,updated=? WHERE order_id=?", remote.orderId, Date.now(), order.id);
            this.s.run("UPDATE orders SET status='production' WHERE id=?", order.id);
          }
        } catch (e) {
          const rejected = Boolean(e.rejected || e.status === 409), reason = rejected ? e.message : 'Antwort unterbrochen. Der Anbieterstatus wird vor einer erneuten Übergabe abgeglichen.';
          this.s.run('UPDATE fulfillment SET state=?,error=?,updated=? WHERE order_id=?', rejected ? 'rejected' : 'uncertain', reason, Date.now(), order.id);
          this.alert(order, reason);
        } finally { this.s.run('UPDATE fulfillment SET lease_until=0 WHERE order_id=?', order.id); }
      }
    } finally { this.busy = false; }
  }
  analytics(from, to) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new ShopError('Bitte wähle einen gültigen Zeitraum.');
    const visits = this.s.all("SELECT * FROM visits WHERE created>=? AND created<? AND mode='test'", from, to);
    const events = this.s.all('SELECT e.* FROM events e JOIN visits v ON v.id=e.visit_id WHERE e.created>=? AND e.created<? AND v.mode=?', from, to, 'test');
    const orders = this.s.all("SELECT * FROM orders WHERE paid_at>=? AND paid_at<? AND mode='test'", from, to);
    const count = predicate => new Set(events.filter(predicate).map(e => e.visit_id)).size;
    const breakdown = (kind, designId) => {
      const matches = i => (!kind || i.configuration.kind === kind) && (!designId || i.configuration.designId === designId);
      const paid = orders.filter(o => JSON.parse(o.items).some(matches));
      const viewIds = new Set(events.filter(e => e.type === 'view' && (!kind || e.kind === kind) && (!designId || e.design_id === designId)).map(e => e.visit_id)), views = viewIds.size;
      return { views, cartVisits: count(e => e.type === 'cart' && (!kind || e.kind === kind) && (!designId || e.design_id === designId)), paidOrders: paid.length, paidVisits: new Set(paid.filter(o => viewIds.has(o.visit_id)).map(o => o.visit_id)).size, units: paid.reduce((sum, o) => sum + JSON.parse(o.items).filter(matches).reduce((s, i) => s + i.quantity, 0), 0), denominator: views };
    };
    return { mode: 'test', from, to, visits: visits.length, paidOrders: orders.length, paidVisits: new Set(orders.map(o => o.visit_id)).size, revenue: orders.reduce((s, o) => s + o.amount, 0), units: orders.reduce((s, o) => s + JSON.parse(o.items).reduce((a, i) => a + i.quantity, 0), 0), products: ['fixed', 'custom'].map(kind => ({ id: kind, ...breakdown(kind) })), designs: DESIGNS.map(d => ({ id: d.id, title: d.title, ...breakdown(null, d.id) })), sources: ['tiktok', 'gemeinde', 'sonstige', 'unbekannt'].map(source => ({ source, visits: visits.filter(v => v.source === source).length, paidOrders: orders.filter(o => o.source === source).length, paidVisits: new Set(orders.filter(o => o.source === source && visits.some(v => v.id === o.visit_id)).map(o => o.visit_id)).size })), purposes: ['Für mich', 'Als Geschenk', 'Beides', 'Keine Angabe'].map(purpose => ({ purpose, orders: orders.filter(o => o.purpose === purpose).length })), feedback: this.s.all('SELECT reason,COUNT(*) AS count FROM feedback WHERE created>=? AND created<? GROUP BY reason', from, to), openCases: this.s.all("SELECT o.id,o.number,f.state,f.error FROM fulfillment f JOIN orders o ON o.id=f.order_id WHERE f.state IN ('rejected','uncertain')"), definitions: `Besuch = neue technisch notwendige Sitzung (${this.config.sessionHours} h, keine IP/kein Fingerprint). Produktansicht und Warenkorbzugang = höchstens einmal je Besuch, Produktart und Motiv. Bezahlt = serverseitig bestätigte Bestellung im Zeitraum der Zahlung. Stück = Summe ihrer Mengen. Kaufquote = im Zeitraum kaufende Besuche mit Produktansicht im selben Zeitraum / Besuche mit Produktansicht. Herkunftsquote = im Zeitraum kaufende Besuche aus den im Zeitraum gestarteten Sitzungen / im Zeitraum gestartete Sitzungen der Quelle. Absolute Bestellzahlen richten sich unabhängig davon nach dem Zahlungszeitpunkt. Testdaten sind getrennt; Livebetrieb ist gesperrt.` };
  }
  close() { this.situations.clear(); this.s.close(); }
}
