import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND, REGULAR_BRAND, DESIGNS, MODELS, VERSES, findDesign, findModel } from './catalog.js';
import { ShopError, renderLayout, rasterize, normalizeConfiguration } from './layout.js';
import { token, digest, passwordHash, passwordMatches } from './store.js';
import { createStore } from './async-store.js';
import { designAsset } from './design-assets.js';
import { LocalPodbase, PodbaseAPI, podbasePayload } from './podbase.js';
import { PodbaseCatalog } from './podbase-catalog.js';
import { Payments, TAX_TREATMENT, TAX_NOTICE } from './payments.js';
import { Mailer } from './mail.js';
import { Newsletter } from './newsletter.js';
import { AdminCustomers } from './admin-customers.js';
import { Withdrawals } from './withdrawals.js';
import { officialTemplate, productionPrint, previewFromProduction } from './production-print.js';
import { magneticVariant, catalogVariant, localVariant } from './case-variants.js';
import { casePrice, plannedCasePrice } from '../public/case-options.js';
import { priceBundleItems, summarizePricing } from '../public/bundle-pricing.js';
import { fixedBundleConfigurations } from '../public/fixed-bundles.js';
import { monthlyProductInterest } from './product-interest.js';

export class Shop {
  static async create(config) {
    this.validateMode(config);
    return new this(config, await createStore(config));
  }
  static validateMode(config) {
    if (!['test', 'live'].includes(config.shopMode)) throw new Error('SHOP_MODE muss test oder live sein.');
    if (!['local', 'sandbox', 'live'].includes(config.paymentMode)) throw new Error('Ungültiger Zahlungsmodus.');
    if (!['local', 'catalog', 'production'].includes(config.podbaseMode)) throw new Error('Ungültiger Podbase-Modus. Produktionsaufträge bleiben gesperrt.');
    if (config.shopMode === 'live') {
      if (config.checkoutEnabled === true && config.legalContactReady === false) throw new Error('Vor dem Verkaufsstart fehlt eine freigegebene öffentliche Geschäfts-Telefonnummer.');
      if (config.paymentMode !== 'live' || !/^(sk|rk)_live_[A-Za-z0-9_]+$/.test(config.stripeKey || '') || !/^whsec_[A-Za-z0-9_]+$/.test(config.stripeWebhook || '')) throw new Error('Livebetrieb benötigt Stripe-Liveschlüssel und Live-Webhook.');
      if (config.podbaseMode !== 'production' || config.printMode !== 'podbase' || !/^PUS-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(config.podbaseStoreId || '')) throw new Error('Livebetrieb benötigt Originaldruckvorlagen und den zugeordneten Podbase-Store.');
      if (config.mailMode !== 'resend' || !/^https:\/\/(www\.)?archenlicht\.de$/.test(config.baseUrl) || !/^https:\/\/(www\.)?archenlicht\.de$/.test(config.printBaseUrl)) throw new Error('Livebetrieb benötigt Bestellmails und die öffentliche Shopadresse.');
      if (config.checkoutEnabled === true && config.podbaseSubmissionEnabled !== true) throw new Error('Der Checkout bleibt ohne freigegebene Auftragsübergabe gesperrt.');
    } else if (config.paymentMode === 'live' || config.podbaseMode === 'production' || config.podbaseSubmissionEnabled || config.mailMode === 'resend') throw new Error('Live-Zahlung, Produktion und Live-Bestellmails sind im Testshop gesperrt.');
    if (config.podbaseMode !== 'local') PodbaseCatalog.validate({ apiKey: config.podbaseKey, baseUrl: config.podbaseBaseUrl });
    if (config.printMode && !['preview', 'podbase'].includes(config.printMode)) throw new Error('PRINT_MODE muss preview oder podbase sein.');
    Mailer.validate(config);
  }
  constructor(config, store) {
    Shop.validateMode(config);
    this.config = config; this.s = store;
    this.podbase = config.podbaseMode === 'production' ? new PodbaseAPI({ apiKey: config.podbaseKey, baseUrl: config.podbaseBaseUrl, storeId: config.podbaseStoreId, productionApproved: config.podbaseSubmissionEnabled === true }) : new LocalPodbase(this.s);
    this.payments = new Payments(config, this.s); this.mailer = new Mailer(config, this.s);
    this.newsletter = new Newsletter(config, this.s, this.mailer);
    this.withdrawals = new Withdrawals(this);
    this.adminCustomers = new AdminCustomers(this.s);
    this.podbaseCatalog = config.podbaseMode !== 'local' ? new PodbaseCatalog({ apiKey: config.podbaseKey, baseUrl: config.podbaseBaseUrl }) : null;
    this.situations = new Map(); this.advisorScenario = 'ok'; this.busy = false;
    this.printLayouts = new Map();
    if (!store.remote) mkdirSync(join(config.dataDir, 'prints'), { recursive: true });
  }
  get checkoutEnabled() { return this.config.checkoutEnabled ?? this.config.shopMode === 'test'; }
  get brand() { return this.config.openingOfferEnabled === false ? REGULAR_BRAND : BRAND; }
  // Browsing stays available during launch preparation. Purchasing and paid
  // fulfillment always require approval for the actual order's environment.
  get variantMode() { return this.checkoutEnabled ? this.config.shopMode : 'test'; }
  async createSession() {
    const secret = token(), id = digest(secret), visit = randomUUID(), now = Date.now(), csrf = token();
    await this.s.run('INSERT INTO sessions VALUES(?,?,?,?,?,?)', id, csrf, null, visit, now + this.config.sessionHours * 3600000, now);
    return { secret, session: { id, csrf, user_id: null, visit_id: visit, expires: now + this.config.sessionHours * 3600000, created: now } };
  }
  async recordVisit(session, source = 'unbekannt', campaign = null) {
    if (session.statisticsConsent !== true) return;
    source = ['tiktok', 'gemeinde', 'sonstige'].includes(source) ? source : 'unbekannt';
    campaign = /^[a-zA-Z0-9_-]{1,40}$/.test(campaign || '') ? campaign : null;
    await this.s.run('INSERT OR IGNORE INTO visits VALUES(?,?,?,?,?)', session.visit_id, source, campaign, Date.now(), this.config.shopMode);
  }
  async session(secret) { return secret ? (await this.s.get('SELECT * FROM sessions WHERE id=? AND expires>?', digest(secret), Date.now())) : null; }
  async user(session) { return session?.user_id ? (await this.s.get('SELECT id,email,role FROM users WHERE id=?', session.user_id)) : null; }
  async requireUser(session) { const user = (await this.user(session)); if (!user) throw new ShopError('Bitte melde dich zuerst in deinem Kundenkonto an.', 401); return user; }
  async accountDetails(session) {
    const user = (await this.user(session)); if (!user) return null;
    const profile = (await this.s.get('SELECT address,address_version FROM account_profiles WHERE user_id=?', user.id));
    return { address: profile?.address ? JSON.parse(profile.address) : null, addressVersion: profile?.address_version || 0 };
  }
  async saveAddress(session, input) {
    const user = (await this.requireUser(session)), recipient = this.validateRecipient(input);
    (await this.s.run('INSERT INTO account_profiles VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET address=excluded.address,address_version=account_profiles.address_version+1,updated=excluded.updated', user.id, JSON.stringify(recipient), Date.now()));
    return (await this.accountDetails(session));
  }
  async removeAddress(session) {
    const user = (await this.requireUser(session));
    // Keep the revision so a delayed checkout cannot restore an address after deletion.
    (await this.s.run('INSERT INTO account_profiles VALUES(?,NULL,1,?) ON CONFLICT(user_id) DO UPDATE SET address=NULL,address_version=account_profiles.address_version+1,updated=excluded.updated', user.id, Date.now()));
    return (await this.accountDetails(session));
  }
  async requireAdmin(session) { if ((await this.user(session))?.role !== 'admin') throw new ShopError('Diese Ansicht ist nur mit einem Administratorkonto zugänglich.', 403); }
  async cleanup(now = Date.now()) {
    await this.newsletter.cleanup();
    await this.s.run('DELETE FROM auth_limits WHERE expires<?', now);
    (await this.s.run('DELETE FROM sessions WHERE expires<?', now));
    for (const [id, value] of this.situations) if (value.expires <= now || !(await this.s.get('SELECT id FROM sessions WHERE id=?', id))) this.situations.delete(id);
  }
  async publicState(session) {
    // Optional aggregate information must never block shopping if analytics fail.
    const [productInterest, snapshot, rows, user, account, cart] = await Promise.all([
      monthlyProductInterest(this.s, { mode: this.config.shopMode, excludeVisitId: session.visit_id }).catch(() => ({})),
      this.podbaseCatalog?.snapshot(), this.s.all('SELECT * FROM variants'), this.user(session), this.accountDetails(session), this.cart(session)
    ]);
    const variants = rows.map(v => {
      const ready = Boolean(v.available && v.print_approved && v.approval_mode === this.variantMode);
      const inStock = magsafe => this.podbaseCatalog ? catalogVariant(snapshot, { modelId: v.model_id, magsafe })?.inStock : !magsafe || Boolean(magneticVariant(v.model_id));
      const printable = magsafe => this.config.printMode !== 'podbase' || Boolean(officialTemplate(v.model_id, magsafe));
      return { ...v, available: ready && inStock(false) && printable(false) ? 1 : 0, magsafe_available: ready && inStock(true) && printable(true) ? 1 : 0 };
    });
    const models = MODELS.map(m => this.podbaseCatalog ? { ...m, podbase: snapshot?.models.find(v => v.modelId === m.id) || null } : m);
    return { brand: this.brand, designs: DESIGNS, models, verses: VERSES, variants, productInterest, podbase: { ...(this.podbaseCatalog?.summary(snapshot) || { mode: 'local', connected: false }), fulfillmentMode: this.config.shopMode === 'live' ? 'podbase' : 'simulated', orderSubmissionEnabled: this.config.shopMode === 'live' && this.config.podbaseSubmissionEnabled === true }, mode: this.config.shopMode, variantMode: this.variantMode, checkoutEnabled: this.checkoutEnabled, printMode: this.config.printMode || 'preview', paymentMode: this.config.paymentMode, taxNotice: TAX_NOTICE, csrf: session.csrf, user, account, cart, sessionExpires: session.expires, sessionHours: this.config.sessionHours };
  }
  async track(session, type, kind, designId) {
    if (!['view', 'cart'].includes(type) || !['fixed', 'custom'].includes(kind) || !findDesign(designId)) throw new ShopError('Ungültiges Ereignis.');
    if (session.statisticsConsent !== true) return;
    await this.recordVisit(session);
    (await this.s.run('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)', session.visit_id, type, kind, designId, Date.now()));
  }
  async assertAvailable(c, { mode = this.variantMode } = {}) {
    if (c.magsafe && !magneticVariant(c.modelId)) throw new ShopError('Für dieses Handymodell ist keine MagSafe-kompatible Hülle verfügbar. Entferne den Haken oder wähle ein anderes Modell.', 409);
    if (this.config.printMode === 'podbase' && !officialTemplate(c.modelId, c.magsafe)) throw new ShopError('Für diese Hülle fehlt noch eine vollständige Druckvorlage. Bitte wähle ein anderes Modell oder eine andere Hüllenart.', 409);
    const variant = (await this.s.get('SELECT * FROM variants WHERE model_id=? AND design_id=?', c.modelId, c.designId));
    if (!variant?.available || !variant.print_approved || variant.approval_mode !== mode) throw new ShopError('Dieses Motiv ist für dein Handymodell gerade nicht verfügbar. Bitte wähle ein anderes Modell oder Motiv.', 409);
    if (this.podbaseCatalog) {
      const snapshot = await this.podbaseCatalog.snapshot({ strict: true });
      if (!catalogVariant(snapshot, c)?.inStock) throw new ShopError('Die gewählte Hüllenart ist für dein Modell beim Druckpartner gerade nicht verfügbar. Bitte wähle eine andere Hülle.', 409);
    }
  }
  async preview(input, { printMode = this.config.printMode } = {}) {
    let layout = renderLayout(input, { allowEmptyCustomText: true });
    if (printMode === 'podbase') {
      const key = layout.hash;
      if (!this.printLayouts.has(key)) {
        if (this.printLayouts.size >= 24) this.printLayouts.delete(this.printLayouts.keys().next().value);
        const pending = productionPrint(layout, findModel(layout.configuration.modelId));
        this.printLayouts.set(key, pending); pending.catch(() => this.printLayouts.delete(key));
      }
      layout = await this.printLayouts.get(key);
    }
    let svg = layout.svg;
    if (this.s.remote) {
      const artwork = designAsset(layout.configuration.designId);
      await this.s.run('INSERT OR IGNORE INTO artwork_blobs VALUES(?,?)', artwork.renderHash, artwork.renderDataUrl);
      svg = svg.replace(artwork.renderDataUrl, `artwork-sha256:${artwork.renderHash}`);
    }
    (await this.s.run('INSERT OR IGNORE INTO assets VALUES(?,?,?,?,?)', layout.hash, JSON.stringify(layout.configuration), layout.printText, svg, Date.now()));
    return { configuration: layout.configuration, hash: layout.hash, svgUrl: `/prints/${layout.hash}${layout.officialPrintTemplate ? '.preview' : ''}.svg`, pngUrl: `/prints/${layout.hash}.png`, printText: layout.printText, camera: layout.camera, layoutVersion: layout.configuration.layoutVersion, productionApproved: layout.productionApproved, sourcePixels: layout.sourcePixels, officialPrintTemplate: Boolean(layout.officialPrintTemplate), simulated: true };
  }
  async printFile(hash, format) {
    const asset = (await this.s.get('SELECT * FROM assets WHERE hash=?', hash));
    if (!asset) throw new ShopError('Druckdatei nicht gefunden.', 404);
    if (this.s.remote) {
      const marker = /artwork-sha256:([a-f0-9]{64})/.exec(asset.svg);
      if (marker) {
        const artwork = await this.s.get('SELECT data_url FROM artwork_blobs WHERE hash=?', marker[1]);
        if (!artwork) throw new ShopError('Die gespeicherte Motivdatei ist gerade nicht verfügbar.', 503);
        asset.svg = asset.svg.replace(marker[0], artwork.data_url);
      }
      if (format === 'svg' || format === 'preview.svg') return format === 'svg' ? asset.svg : previewFromProduction(asset.svg, JSON.parse(asset.configuration));
      let cached = await this.s.get('SELECT content FROM print_files WHERE hash=?', hash);
      if (!cached) {
        const content = (await rasterize(asset.svg)).toString('base64');
        await this.s.run('INSERT OR IGNORE INTO print_files VALUES(?,?)', hash, content);
        cached = await this.s.get('SELECT content FROM print_files WHERE hash=?', hash);
      }
      return Buffer.from(cached.content, 'base64');
    }
    if (format === 'svg' || format === 'preview.svg') return format === 'svg' ? asset.svg : previewFromProduction(asset.svg, JSON.parse(asset.configuration));
    const path = join(this.config.dataDir, 'prints', `${hash}.png`);
    if (!existsSync(path)) { const buffer = await rasterize(asset.svg); try { writeFileSync(path, buffer, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
    return readFileSync(path);
  }
  async cart(session) {
    const snapshot = await this.podbaseCatalog?.snapshot();
    return priceBundleItems(await Promise.all((await this.s.all('SELECT * FROM cart WHERE session_id=? ORDER BY created,id', session.id)).map(async row => {
      const c = JSON.parse(row.configuration), model = findModel(c.modelId), d = findDesign(c.designId), variant = (await this.s.get('SELECT * FROM variants WHERE model_id=? AND design_id=?', c.modelId, c.designId));
      let p, printable = true;
      try { p = await this.preview(c); }
      catch (error) {
        if (this.config.printMode !== 'podbase' || !(error instanceof ShopError) || error.status !== 409) throw error;
        // Existing carts must remain viewable/removable after tightening print requirements.
        printable = false; p = await this.preview(c, { printMode: 'preview' });
      }
      const remote = catalogVariant(snapshot, c), provider = this.podbaseCatalog ? remote : localVariant(model, c);
      return { id: row.id, configuration: c, ...p, title: c.kind === 'custom' ? `Dein Wunschvers · ${d.title}` : d.title, model: model.name, quantity: row.quantity, unitPrice: casePrice(this.brand, c), plannedUnitPrice: plannedCasePrice(this.brand, c), reduced: Boolean(this.brand.openingOffer), openingOffer: Boolean(this.brand.openingOffer), productId: provider?.productId || null, variantId: provider?.variantId || null, available: Boolean(printable && (!c.magsafe || magneticVariant(c.modelId)) && variant?.available && variant.print_approved && variant.approval_mode === this.variantMode && (!this.podbaseCatalog || remote?.inStock)) };
    })));
  }
  async saveCart(session, input, existingId) {
    const c = normalizeConfiguration(input); (await this.assertAvailable(c)); (await this.preview(c));
    const quantity = Number(input.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new ShopError('Bitte wähle zwischen 1 und 10 Hüllen.');
    if (existingId) {
      if (!(await this.s.get('SELECT id FROM cart WHERE id=? AND session_id=?', existingId, session.id))) throw new ShopError('Warenkorbposition nicht gefunden.', 404);
      (await this.s.run('UPDATE cart SET configuration=?,quantity=? WHERE id=? AND session_id=?', JSON.stringify(c), quantity, existingId, session.id));
    } else {
      if ((await this.s.get('SELECT COUNT(*) AS n FROM cart WHERE session_id=?', session.id)).n >= 20) throw new ShopError('Dein Warenkorb enthält bereits 20 Positionen.');
      (await this.s.run('INSERT INTO cart VALUES(?,?,?,?,?)', randomUUID(), session.id, JSON.stringify(c), quantity, Date.now()));
    }
    (await this.track(session, 'cart', c.kind, c.designId)); return (await this.cart(session));
  }
  async removeCart(session, id) { (await this.s.run('DELETE FROM cart WHERE id=? AND session_id=?', id, session.id)); return (await this.cart(session)); }
  async saveFixedBundle(session, input) {
    if (!/^[a-f0-9-]{36}$/.test(input.requestId || '')) throw new ShopError('Bitte öffne die Bundle-Auswahl erneut.');
    let configurations;
    try { configurations = fixedBundleConfigurations(input.bundleId, input.items).map(item => normalizeConfiguration(item)); }
    catch (error) { throw new ShopError(error.message); }
    // Validate every printable variant before inserting any of the three rows.
    for (const configuration of configurations) { await this.assertAvailable(configuration); await this.preview(configuration); }
    const rows = configurations.map((configuration, index) => {
      const hex = digest(`${session.id}:${input.requestId}:${index}`);
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      return { id, configuration: JSON.stringify(configuration) };
    });
    await this.s.tx(async () => {
      const existing = await Promise.all(rows.map(row => this.s.get('SELECT * FROM cart WHERE id=? AND session_id=?', row.id, session.id)));
      if (existing.some(Boolean)) {
        if (!existing.every((row, index) => row && row.configuration === rows[index].configuration && row.quantity === 1)) throw new ShopError('Dieses Bundle wurde bereits verändert. Bitte öffne die Bundle-Auswahl erneut.', 409);
        return; // A retried request must not add another three cases.
      }
      if ((await this.s.get('SELECT COUNT(*) AS n FROM cart WHERE session_id=?', session.id)).n > 17) throw new ShopError('Für dieses Bundle werden drei freie Warenkorbpositionen benötigt. Maximal sind 20 Positionen möglich.');
      const now = Date.now();
      for (const [index, row] of rows.entries()) await this.s.run('INSERT INTO cart VALUES(?,?,?,?,?)', row.id, session.id, row.configuration, 1, now + index);
      for (const configuration of configurations) await this.track(session, 'cart', 'fixed', configuration.designId);
    });
    return this.cart(session);
  }
  async limitAuthentication(email, address) {
    const now = Date.now(), duration = 15 * 60000;
    for (const [value, maximum] of [[`ip:${address}`, 50], [`email:${String(email || '').trim().toLowerCase().slice(0, 180)}`, 15]]) {
      const id = digest(`auth:${value}`);
      await this.s.run('INSERT INTO auth_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN auth_limits.expires<=? THEN 1 ELSE auth_limits.attempts+1 END,expires=CASE WHEN auth_limits.expires<=? THEN excluded.expires ELSE auth_limits.expires END', id, now + duration, now, now);
      if ((await this.s.get('SELECT attempts FROM auth_limits WHERE id=?', id)).attempts > maximum) throw new ShopError('Zu viele Anmeldeversuche. Bitte warte 15 Minuten.', 429);
    }
  }
  async authenticate(session, input, register = false) {
    const email = String(input.email || '').trim().toLowerCase(), password = String(input.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) throw new ShopError('Bitte gib eine gültige E-Mail-Adresse ein.');
    let user = (await this.s.get('SELECT * FROM users WHERE email=?', email));
    if (register) {
      if (password.length < 12 || password.length > 128) throw new ShopError('Bitte verwende ein Passwort mit 12 bis 128 Zeichen.');
      if (user) throw new ShopError('Dieses Konto kann nicht angelegt werden. Bitte versuche die Anmeldung.', 409);
      const id = randomUUID(); (await this.s.run('INSERT INTO users VALUES(?,?,?,?,?)', id, email, passwordHash(password), 'customer', Date.now())); user = (await this.s.get('SELECT * FROM users WHERE id=?', id));
    } else if (!user || password.length > 128 || !passwordMatches(password, user.password)) throw new ShopError('E-Mail oder Passwort stimmt nicht.', 401);
    return this.rotateSession(session, user);
  }
  async rotateSession(session, user, { newPassword } = {}) {
    // Rotate cookie and CSRF. Recheck the hash under the transaction lock so an
    // in-flight login cannot restore a session after a password reset.
    const secret = token(), newId = digest(secret), csrf = token();
    (await this.s.tx(async () => {
      const currentUser = await this.s.get('SELECT password FROM users WHERE id=?', user.id);
      if (!currentUser || currentUser.password !== user.password || !(await this.s.get('SELECT id FROM sessions WHERE id=? AND expires>?', session.id, Date.now()))) throw new ShopError('Die Anmeldung hat sich geändert. Bitte melde dich erneut an.', 401);
      if (newPassword) await this.s.run('UPDATE users SET password=? WHERE id=?', newPassword, user.id);
      (await this.s.run('INSERT INTO sessions VALUES(?,?,?,?,?,?)', newId, csrf, user.id, session.visit_id, session.expires, session.created));
      (await this.s.run('UPDATE cart SET session_id=? WHERE session_id=?', newId, session.id));
      (await this.s.run('UPDATE orders SET session_id=? WHERE session_id=?', newId, session.id));
      (await this.s.run('UPDATE order_access SET session_id=? WHERE session_id=?', newId, session.id));
      (await this.s.run('DELETE FROM sessions WHERE id=?', session.id));
      if (newPassword) await this.s.run('DELETE FROM sessions WHERE user_id=? AND id<>?', user.id, newId);
    }));
    const current = this.situations.get(session.id); if (current) { this.situations.set(newId, current); this.situations.delete(session.id); }
    return { secret, session: (await this.s.get('SELECT * FROM sessions WHERE id=?', newId)) };
  }
  async changePassword(session, input) {
    const identity = await this.requireUser(session), user = await this.s.get('SELECT * FROM users WHERE id=?', identity.id);
    const current = String(input.currentPassword || ''), next = String(input.newPassword || '');
    if (current.length > 128 || !passwordMatches(current, user.password)) throw new ShopError('Das aktuelle Passwort stimmt nicht.', 401);
    if (next.length < 12 || next.length > 128) throw new ShopError('Bitte verwende ein neues Passwort mit 12 bis 128 Zeichen.');
    if (next === current) throw new ShopError('Bitte wähle ein anderes neues Passwort.');
    return this.rotateSession(session, user, { newPassword: passwordHash(next) });
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
    r.phone = r.phone.replace(/[\s()\/-]/g, '');
    if (r.phone.startsWith('00')) r.phone = `+${r.phone.slice(2)}`;
    else if (/^0[1-9]/.test(r.phone)) r.phone = `+49${r.phone.slice(1)}`;
    if (!/^\+[1-9]\d{6,14}$/.test(r.phone) || r.phone.startsWith('+490')) throw new ShopError('Bitte prüfe deine Telefonnummer, zum Beispiel 0172 1234567 oder +49 172 1234567 (nach +49 ohne die erste 0).');
    if (r.country !== 'DE' || !/^\d{5}$/.test(r.postalCode)) throw new ShopError('Wir versenden ausschließlich innerhalb Deutschlands. Bitte prüfe Land und Postleitzahl.');
    return r;
  }
  async checkout(session, input, { returnOrigin = this.config.baseUrl } = {}) {
    if (!this.checkoutEnabled) throw new ShopError('Wir bereiten den Verkaufsstart vor. Bestellungen sind noch nicht freigeschaltet.', 503);
    let items = (await this.cart(session)); if (!items.length) throw new ShopError('Dein Warenkorb ist noch leer.');
    for (const i of items) (await this.assertAvailable(i.configuration, { mode: this.config.shopMode }));
    if (items.some(i => !i.available)) throw new ShopError('Bitte bearbeite oder entferne die nicht verfügbaren Hüllen im Warenkorb.', 409);
    if (this.podbaseCatalog) {
      const snapshot = await this.podbaseCatalog.snapshot({ force: true, strict: true });
      for (const item of items) {
        const model = catalogVariant(snapshot, item.configuration);
        if (!model?.inStock) throw new ShopError('Dein Handymodell ist im aktuellen Druckpartner-Katalog nicht bestellbar. Bitte bearbeite den Warenkorb.', 409);
        item.productId = model.productId; item.variantId = model.variantId;
      }
    } else {
      const providerCatalog = await this.podbase.catalog();
      for (const i of items) {
        const product = providerCatalog.find(p => p.id === i.productId), variant = product?.variants.find(v => v.id === i.variantId);
        if (!variant || variant.inStock !== true) throw new ShopError('Dein Handymodell ist im aktuellen Druckpartner-Katalog nicht bestellbar. Bitte bearbeite den Warenkorb.', 409);
        i.productId = product.id; i.variantId = variant.id;
      }
    }
    const recipient = this.validateRecipient(input.recipient || {});
    const newsletterDiscount = input.newsletterCode ? await this.newsletter.discount(input.newsletterCode, recipient.email, items) : null;
    if (newsletterDiscount) items = newsletterDiscount.items;
    if (!(this.config.paymentMode !== 'local' ? ['stripe', 'paypal', 'card'] : ['paypal', 'card']).includes(input.method)) throw new ShopError('Bitte wähle eine verfügbare Zahlungsart.');
    const method = this.config.paymentMode !== 'local' ? 'stripe' : input.method;
    if (input.saveAddress !== undefined && typeof input.saveAddress !== 'boolean') throw new ShopError('Bitte entscheide, ob du die Lieferdaten speichern möchtest.');
    const user = (await this.user(session)), saveAddress = input.saveAddress === true;
    if (saveAddress && !user) throw new ShopError('Zum Speichern der Lieferdaten ist ein Kundenkonto erforderlich.', 401);
    const customerId = user && ['card', 'stripe'].includes(method) ? await this.payments.customerFor(user) : null;
    if (user) (await this.s.run('INSERT OR IGNORE INTO account_profiles VALUES(?,NULL,0,?)', user.id, Date.now()));
    const addressVersion = (await this.accountDetails(session))?.addressVersion || 0;
    const id = randomUUID(), guestToken = token(), amount = summarizePricing(items).total, now = Date.now();
    const number = `AL-${new Intl.DateTimeFormat('de', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(now)}-${token().replace(/[-_]/g, '').slice(0, 9).toUpperCase()}`;
    const visit = session.statisticsConsent === true ? await this.s.get('SELECT source FROM visits WHERE id=?', session.visit_id) : null;
    const snapshot = items.map(({ id, configuration, hash, title, model, quantity, unitPrice, plannedUnitPrice, pricing, reduced, openingOffer, printText, productId, variantId }) => ({ id, configuration, hash, title, model, quantity, unitPrice, plannedUnitPrice, pricing, reduced, openingOffer, printText, productId, variantId }));
    (await this.s.tx(async () => {
      (await this.s.run('INSERT INTO orders(id,number,session_id,user_id,guest_hash,recipient,items,amount,currency,status,payment_method,source,visit_id,mode,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, number, session.id, session.user_id, digest(guestToken), JSON.stringify(recipient), JSON.stringify(snapshot), amount, 'EUR', 'awaiting_payment', method, visit?.source || 'unbekannt', visit ? session.visit_id : randomUUID(), this.config.shopMode, now));
      if (newsletterDiscount) await this.newsletter.reserve(newsletterDiscount.subscriberId, id);
      if (method === 'stripe') await this.s.run('INSERT INTO stripe_payments VALUES(?,NULL,NULL,?,NULL,NULL)', id, TAX_TREATMENT);
      (await this.s.run('INSERT INTO checkout_preferences VALUES(?,?,?,?,?)', id, user?.id || null, saveAddress ? 1 : 0, addressVersion, customerId));
      (await this.mail(id, 'confirmation', recipient.email, `Bestellung ${number}`, `Bestellung ${number}.\nPersönlicher Statuslink: ${this.config.baseUrl}/bestellung/${id}#token=${guestToken}\nGeschenkkarte 10 × 15 cm zum Selbstbeschriften inklusive.`, 'pending-payment'));
    }));
    const order = (await this.s.get('SELECT * FROM orders WHERE id=?', id));
    try {
      const payment = await this.payments.create(order, { customerId, returnOrigin });
      if (!payment.url) throw new ShopError('Die Zahlung konnte nicht eingerichtet werden.', 502);
      await this.s.tx(async () => {
        await this.s.run('UPDATE orders SET payment_id=? WHERE id=?', payment.id, id);
        if (method === 'stripe') await this.s.run('UPDATE stripe_payments SET session_id=? WHERE order_id=?', payment.id, id);
      });
      return { orderId: id, number, url: payment.url, simulated: payment.simulated };
    } catch (e) { (await this.s.run("UPDATE orders SET status='payment_setup_failed' WHERE id=?", id)); throw e; }
  }
  async acceptPayment(event, { flush = true } = {}) {
    const result = (await this.s.tx(async () => {
      const order = (await this.s.get('SELECT * FROM orders WHERE id=?', event.orderId));
      if (order?.mode !== this.config.shopMode) throw new ShopError('Bestellung und Zahlungsumgebung stimmen nicht überein.', 409);
      if (!order || !event.id || typeof event.paymentId !== 'string' || !event.completed || event.amount !== order.amount || event.currency !== 'EUR' || event.paymentId !== order.payment_id) throw new ShopError('Zahlungsstatus, Betrag, Währung oder Bestellbezug stimmen nicht überein.', 409);
      const preferences = (await this.s.get('SELECT * FROM checkout_preferences WHERE order_id=?', order.id));
      if (this.config.paymentMode !== 'local' && preferences?.customer_id && event.customerId !== preferences.customer_id) throw new ShopError('Die Zahlung gehört nicht zum vorgesehenen Stripe-Kundenkonto.', 409);
      if (this.config.paymentMode !== 'local') {
        const payment = await this.s.get('SELECT tax_treatment FROM stripe_payments WHERE order_id=?', order.id);
        if (!payment || payment.tax_treatment !== event.taxTreatment || event.taxAmount !== 0) throw new ShopError('Die steuerliche Behandlung der Zahlung stimmt nicht mit der Bestellung überein.', 409);
      }
      if ((await this.s.get('SELECT id FROM payment_events WHERE id=?', event.id))) return { duplicate: true };
      if (this.config.paymentMode === 'local' && ['cancelled','expired'].includes(order.status)) throw new ShopError('Diese Testzahlung wurde abgebrochen.', 409);
      (await this.s.run('INSERT INTO payment_events VALUES(?,?,?,?,?)', event.id, order.id, event.paymentId, 'COMPLETED', Date.now()));
      if (order.paid_at) return { duplicate: true };
      if (summarizePricing(JSON.parse(order.items)).source === 'newsletter' && !(await this.s.get('SELECT order_id FROM newsletter_redemptions WHERE order_id=?', order.id))) throw new ShopError('Der Rabatt ist dieser Zahlung nicht mehr zugeordnet. Bitte kontaktiere info@archenlicht.de.', 409);
      // A deactivated variant after provider handoff is held for manual handling, never sent to production.
      const available = (await Promise.all(JSON.parse(order.items).map(async i => { const v = (await this.s.get('SELECT * FROM variants WHERE model_id=? AND design_id=?', i.configuration.modelId, i.configuration.designId)); return v?.available && v.print_approved && v.approval_mode === order.mode; }))).every(Boolean);
      (await this.s.run("UPDATE orders SET status='paid',paid_at=? WHERE id=?", Date.now(), order.id));
      await this.s.run('UPDATE newsletter_redemptions SET redeemed_at=? WHERE order_id=? AND redeemed_at IS NULL', Date.now(), order.id);
      if (this.config.paymentMode !== 'local') await this.s.run('UPDATE stripe_payments SET payment_intent_id=?,tax_amount=?,verified_at=? WHERE order_id=?', event.paymentIntentId || null, event.taxAmount, Date.now(), order.id);
      if (preferences?.save_address && preferences.user_id === order.user_id) (await this.s.run('UPDATE account_profiles SET address=?,address_version=address_version+1,updated=? WHERE user_id=? AND address_version=?', order.recipient, Date.now(), order.user_id, preferences.address_version));
      if (this.config.paymentMode === 'local' && event.saveCard === true && order.user_id && order.payment_method === 'card') (await this.s.run('INSERT OR IGNORE INTO local_payment_methods VALUES(?,?,?,?,?,?,?)', `SIM-CARD-${digest(order.user_id).slice(0, 24)}`, order.user_id, 'visa', '4242', 12, new Date().getUTCFullYear() + 4, Date.now()));
      (await this.s.run('INSERT INTO fulfillment(order_id,state,error,updated) VALUES(?,?,?,?)', order.id, available ? 'ready' : 'rejected', available ? null : 'Variante nach Zahlungsbeginn weggefallen. Bitte Erstattung oder Ersatz klären.', Date.now()));
      (await this.s.run("UPDATE mail_outbox SET status=? WHERE order_id=? AND kind='confirmation'", this.mailer.enabled ? 'mail-held' : 'local-delivered', order.id));
      await this.mailer.release(order.id);
      const purchased = JSON.parse(order.items).map(i => i.id);
      for (const itemId of purchased) (await this.s.run('DELETE FROM cart WHERE id=? AND session_id=?', itemId, order.session_id));
      if (!available) (await this.alert(order, 'Variante nach Zahlungsbeginn weggefallen.'));
      return { duplicate: false };
    }));
    // Network delivery happens after the payment transaction has committed.
    if (flush) await this.mailer.safeFlush({ orderId: event.orderId });
    return result;
  }
  async authorizeOrder(session, id, guestSecret) {
    const o = (await this.s.get('SELECT * FROM orders WHERE id=?', id));
    const capabilityValid = o && guestSecret && digest(guestSecret) === o.guest_hash;
    const grant = session && (await this.s.get('SELECT order_id FROM order_access WHERE session_id=? AND order_id=?', session.id, id));
    if (!o || !(o.session_id === session?.id || (o.user_id && o.user_id === session?.user_id) || (await this.user(session))?.role === 'admin' || grant || capabilityValid)) throw new ShopError('Bestellung nicht gefunden oder Zugriff nicht erlaubt.', 404);
    if (capabilityValid && session) (await this.s.run('INSERT OR IGNORE INTO order_access VALUES(?,?)', session.id, id));
    return o;
  }
  async confirmLocalPayment(session, order, input) {
    if (this.config.paymentMode !== 'local') throw new ShopError('Lokale Testbestätigungen sind im Sandbox-Modus gesperrt.', 403);
    if (order.status === 'cancelled') throw new ShopError('Diese Zahlung wurde abgebrochen. Bitte beginne im Warenkorb erneut.', 409);
    if (input.saveCard !== undefined && typeof input.saveCard !== 'boolean') throw new ShopError('Ungültige Speicherauswahl.');
    if (input.saveCard || input.savedCardId) {
      if (!order.user_id || session.user_id !== order.user_id || order.payment_method !== 'card') throw new ShopError('Gespeicherte Karten gehören ausschließlich zum eigenen Kundenkonto.', 403);
      if (input.savedCardId && (typeof input.savedCardId !== 'string' || !/^SIM-CARD-[a-f0-9]{24}$/.test(input.savedCardId))) throw new ShopError('Karte nicht gefunden.', 404);
      if (input.savedCardId && !(await this.s.get('SELECT id FROM local_payment_methods WHERE id=? AND user_id=?', input.savedCardId, session.user_id))) throw new ShopError('Karte nicht gefunden.', 404);
      if (input.savedCardId && input.saveCard) throw new ShopError('Bitte verwende eine gespeicherte Karte oder speichere eine neue Demo-Karte.');
    }
    return (await this.acceptPayment({ id: `local-completed-${order.payment_id}`, orderId: order.id, paymentId: order.payment_id, amount: order.amount, currency: 'EUR', completed: true, saveCard: input.saveCard === true }));
  }
  async orderView(order, session) {
    const fulfillment = (await this.s.get('SELECT * FROM fulfillment WHERE order_id=?', order.id));
    return { id: order.id, number: order.number, amount: order.amount, currency: order.currency, status: order.status, paid: Boolean(order.paid_at), method: order.payment_method, canSaveCard: Boolean(session?.user_id && session.user_id === order.user_id && order.payment_method === 'card'), items: JSON.parse(order.items), recipient: JSON.parse(order.recipient), purpose: order.purpose, created: order.created, fulfillment, simulated: order.mode === 'test', mode: order.mode };
  }
  async mail(orderId, kind, recipient, subject, body, status = 'local-delivered') {
    const id = randomUUID(), initial = this.mailer.enabled && status === 'local-delivered' ? 'mail-held' : status;
    const inserted = await this.s.run('INSERT OR IGNORE INTO mail_outbox VALUES(?,?,?,?,?,?,?,?)', id, orderId, kind, recipient, subject, body, initial, Date.now());
    if (inserted.changes) await this.mailer.enqueue(id, orderId, kind, body, status);
  }
  async alert(order, reason) { (await this.mail(order.id, 'fulfillment-error', this.config.adminEmail, `Handlungsbedarf · ${order.number}`, `SIMULIERTE ADMIN-E-MAIL\nBestellung ${order.number} wurde bezahlt, bleibt aber offen.\n${reason}\nGeschützter Auftragslink (Admin-Anmeldung): ${this.config.baseUrl}/bestellung/${order.id}`)); }
  async tick({ orderId = null, limit = 10, budgetMs = 40000 } = {}) {
    if (this.busy) return; this.busy = true;
    const deadline = Date.now() + budgetMs;
    try {
      (await this.cleanup());
      const enabled = this.config.shopMode !== 'live' || this.config.podbaseSubmissionEnabled === true;
      const jobs = enabled ? (await this.s.all("SELECT f.*,o.paid_at FROM fulfillment f JOIN orders o ON o.id=f.order_id WHERE o.mode=? AND o.paid_at IS NOT NULL AND f.state IN ('ready','sending','uncertain','awaiting_approval','production') AND f.lease_until<?" + (orderId ? ' AND o.id=?' : '') + ' ORDER BY f.updated LIMIT 10', this.config.shopMode, Date.now(), ...(orderId ? [orderId] : []))) : [];
      let processed = 0;
      for (const job of jobs) {
        if (processed++ >= limit || Date.now() > deadline - 16000) break;
        const lease = Date.now() + 60000;
        const claimed = (await this.s.run("UPDATE fulfillment SET lease_until=?,state=CASE WHEN state='ready' THEN 'sending' ELSE state END WHERE order_id=? AND lease_until<?", lease, job.order_id, Date.now()));
        if (!claimed.changes) continue;
        const order = (await this.s.get('SELECT * FROM orders WHERE id=?', job.order_id));
        try {
          if (job.provider_id) {
            if (this.config.shopMode === 'test' && this.config.autoShip && Date.now() - job.paid_at > 16000) (await this.podbase.advance(order.id));
            const remote = await this.podbase.get(job.provider_id);
            if (remote?.orderId !== job.provider_id) throw new Error('Anbieter-ID stimmt nicht mit dem gespeicherten Auftrag überein.');
            await this.applyProviderStatus(order, remote, lease);
          } else {
            // Reconcile before every possible create, including restarts and unknown network outcomes.
            let remote = await this.podbase.find(order.id, { deadline });
            if (!remote && ['sending', 'uncertain'].includes(job.state)) throw new Error('Unklarer Übermittlungsstatus; keine automatische Neusendung.');
            if (!remote) {
              for (const item of JSON.parse(order.items)) (await this.assertAvailable(item.configuration, { mode: order.mode }));
              const payload = podbasePayload(order, this.config.printBaseUrl || this.config.baseUrl, { requireOfficialPrint: this.config.shopMode === 'live' });
              // Fence the single POST: an expired worker must never create an
              // order after another worker has taken over its lease.
              if (Date.now() > deadline - 16000) throw new Error('Zeit für sichere Übergabe abgelaufen.');
              const permitted = await this.s.run("UPDATE fulfillment SET attempts=attempts+1,updated=? WHERE order_id=? AND state='sending' AND lease_until=? AND lease_until>?", Date.now(), order.id, lease, Date.now() + 16000);
              if (!permitted.changes) continue;
              remote = await this.podbase.create(payload);
            }
            await this.applyProviderStatus(order, remote, lease);
          }
        } catch (e) {
          const rejected = Boolean(e.rejected || e.status === 409), reason = rejected ? e.message : 'Antwort unterbrochen. Der Anbieterstatus wird vor einer erneuten Übergabe abgeglichen.';
          const changed = await this.s.run('UPDATE fulfillment SET state=?,error=?,updated=? WHERE order_id=? AND lease_until=?', rejected ? 'rejected' : 'uncertain', reason, Date.now(), order.id, lease);
          if (changed.changes) await this.alert(order, reason);
        } finally { (await this.s.run('UPDATE fulfillment SET lease_until=0 WHERE order_id=? AND lease_until=?', order.id, lease)); }
      }
    } finally { this.busy = false; }
    await this.mailer.safeFlush({ orderId });
  }
  async applyProviderStatus(order, remote, lease) {
    if (!remote?.orderId || remote.externalOrderId !== order.id) throw new Error('Anbieter-ID und externe Bestell-ID passen nicht zusammen.');
    if (['REJECTED', 'CANCELED'].includes(remote.status)) { const error = new Error('Podbase hat den Auftrag abgelehnt oder storniert. Bitte im Anbieterportal prüfen.'); error.rejected = true; throw error; }
    if (!['UNAPPROVED', 'APPROVED', 'FULFILLED'].includes(remote.status)) throw new Error('Unbekannter Anbieterstatus; manuelle Prüfung erforderlich.');
    const shipped = remote.status === 'FULFILLED' && typeof remote.trackingNumber === 'string' && remote.trackingNumber.trim();
    const state = shipped ? 'shipped' : remote.status === 'UNAPPROVED' ? 'awaiting_approval' : 'production';
    const trackingUrl = /^https:\/\/[^\s]+$/.test(remote.trackingUrl || '') ? remote.trackingUrl : null;
    await this.s.tx(async () => {
      const changed = await this.s.run('UPDATE fulfillment SET state=?,provider_id=?,error=NULL,tracking=?,tracking_url=?,updated=? WHERE order_id=? AND lease_until=?', state, remote.orderId, shipped ? remote.trackingNumber : null, shipped ? trackingUrl : null, Date.now(), order.id, lease);
      if (!changed.changes) return;
      await this.s.run('UPDATE orders SET status=? WHERE id=?', state, order.id);
      if (shipped) await this.mail(order.id, 'shipping', JSON.parse(order.recipient).email, `Versand · ${order.number}`, `${order.mode === 'test' ? 'SIMULIERTE VERSANDMAIL\n' : ''}Deine Hülle ist unterwegs.\nSendungsnummer: ${remote.trackingNumber}\nDein persönlicher Statuslink steht in der Bestellbestätigung.`);
    });
  }
  async analytics(from, to) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new ShopError('Bitte wähle einen gültigen Zeitraum.');
    const visits = (await this.s.all("SELECT * FROM visits WHERE created>=? AND created<? AND mode=?", from, to, this.config.shopMode));
    const events = (await this.s.all('SELECT e.* FROM events e JOIN visits v ON v.id=e.visit_id WHERE e.created>=? AND e.created<? AND v.mode=?', from, to, this.config.shopMode));
    const orders = (await this.s.all("SELECT * FROM orders WHERE paid_at>=? AND paid_at<? AND mode=?", from, to, this.config.shopMode));
    const count = predicate => new Set(events.filter(predicate).map(e => e.visit_id)).size;
    const breakdown = (kind, designId) => {
      const matches = i => (!kind || i.configuration.kind === kind) && (!designId || i.configuration.designId === designId);
      const paid = orders.filter(o => JSON.parse(o.items).some(matches));
      const viewIds = new Set(events.filter(e => e.type === 'view' && (!kind || e.kind === kind) && (!designId || e.design_id === designId)).map(e => e.visit_id)), views = viewIds.size;
      return { views, cartVisits: count(e => e.type === 'cart' && (!kind || e.kind === kind) && (!designId || e.design_id === designId)), paidOrders: paid.length, paidVisits: new Set(paid.filter(o => viewIds.has(o.visit_id)).map(o => o.visit_id)).size, units: paid.reduce((sum, o) => sum + JSON.parse(o.items).filter(matches).reduce((s, i) => s + i.quantity, 0), 0), denominator: views };
    };
    return { mode: this.config.shopMode, from, to, visits: visits.length, paidOrders: orders.length, paidVisits: new Set(orders.filter(o => visits.some(v => v.id === o.visit_id)).map(o => o.visit_id)).size, revenue: orders.reduce((s, o) => s + o.amount, 0), units: orders.reduce((s, o) => s + JSON.parse(o.items).reduce((a, i) => a + i.quantity, 0), 0), products: ['fixed', 'custom'].map(kind => ({ id: kind, ...breakdown(kind) })), designs: DESIGNS.map(d => ({ id: d.id, title: d.title, ...breakdown(null, d.id) })), sources: ['tiktok', 'gemeinde', 'sonstige', 'unbekannt'].map(source => ({ source, visits: visits.filter(v => v.source === source).length, paidOrders: orders.filter(o => o.source === source).length, paidVisits: new Set(orders.filter(o => o.source === source && visits.some(v => v.id === o.visit_id)).map(o => o.visit_id)).size })), purposes: ['Für mich', 'Als Geschenk', 'Beides', 'Keine Angabe'].map(purpose => ({ purpose, orders: orders.filter(o => o.purpose === purpose).length })), feedback: (await this.s.all('SELECT reason,COUNT(*) AS count FROM feedback WHERE created>=? AND created<? GROUP BY reason', from, to)), openCases: (await this.s.all("SELECT o.id,o.number,f.state,f.error FROM fulfillment f JOIN orders o ON o.id=f.order_id WHERE f.state IN ('rejected','uncertain')")), definitions: `Besuch = Sitzung mit freiwilliger Statistik-Einwilligung (${this.config.sessionHours} h, keine IP/kein Fingerprint). Produktansicht und Warenkorbzugang = höchstens einmal je Besuch, Produktart und Motiv. Bezahlt = serverseitig bestätigte Bestellung im Zeitraum der Zahlung. Stück = Summe ihrer Mengen. Kaufquote = im Zeitraum kaufende Besuche mit Produktansicht im selben Zeitraum / Besuche mit Produktansicht. Herkunftsquote = im Zeitraum kaufende Besuche aus den im Zeitraum gestarteten Sitzungen / im Zeitraum gestartete Sitzungen der Quelle. Absolute Bestellzahlen richten sich unabhängig davon nach dem Zahlungszeitpunkt. Test- und Livebestellungen werden getrennt ausgewertet.` };
  }
  async close() { this.situations.clear(); (await this.s.close()); }
}
