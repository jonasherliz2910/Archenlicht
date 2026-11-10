import { LEGAL_PAGES, DELIVERY, PERSONALISATION_NOTICE, warrantyHtml } from './legal-content.js';
import { withdrawalPage, mountWithdrawal } from './withdrawal-ui.js';
import { createNewsletterUI } from './newsletter.js';
import { adminCustomersPage, adminSecurityPage } from './admin-ui.js';
import { BUNDLE, priceBundleItems, summarizePricing } from './bundle-pricing.js';
import { MAX_CUSTOM_TEXT, createTextChoice, applyTextChoice, hasConfiguredText } from './custom-text.js';
import { phoneMockup } from './device-preview.js';
import { CASE_COLORS, caseColor } from './case-colors.js';
import { caseLabel, casePrice, caseAvailable } from './case-options.js';
import { mountPreviewGallery } from './preview-gallery.js';
import { modelTrigger, createModelPicker } from './model-picker.js';
import { recipientFields, accountSettings, localCardOptions } from './account-ui.js';
import { readJsonResponse, SHOP_UNAVAILABLE } from './api-client.js';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value / 100);
const date = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(value));
const paths = { arrow: 'M7 17 17 7M7 7h10v10', right: 'M4 12h16m-6-6 6 6-6 6', bag: 'M6 7h12l2 14H4L6 7Zm3 0V5a3 3 0 0 1 6 0v2', user: 'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z', truck: 'M1 4h14v13H1zM15 9h4l4 5v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m13 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0', check: 'm5 12 4 4L19 6', heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', leaf: 'M20 3C9 2 2 8 5 15s13 6 15-12ZM4 21 15 10', close: 'm6 6 12 12M6 18 18 6', menu: 'M4 7h16M4 12h16M4 17h16', shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z M8 12l3 3 5-6', chevron: 'm6 9 6 6 6-6', back: 'M20 12H4m6-6-6 6 6 6', mail: 'M3 5h18v14H3zM3 5l9 8 9-8', edit: 'm16 3 5 5-12 12H4v-5L16 3Z', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z' };
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.heart}"/></svg>`;
const logo = () => `<a href="/" class="wordmark" aria-label="${esc(state.brand.name)} Startseite"><img src="${esc(state.brand.logo)}" alt="${esc(state.brand.name)} – Originalzeichen mit offenem Bootsrumpf" width="176" height="88"></a>`;
let state, config, currentPreview, previewSequence = 0, previewTimer, previewPending = false, currentStep = 0, registerMode = false, statusTimer, routeSequence = 0;
let textChoice, advisorResults, situation = '', adviceOpen = false, advisorPending = false;
const textIsReady = () => hasConfiguredText(config, state.verses);
const caps = new Map();
let expiresTimer, modelPicker, galleryCleanup, newsletterUI;
function armExpiry(data) {
  if (!data?.csrf || !data.sessionExpires) return;
  clearTimeout(expiresTimer);
  expiresTimer = setTimeout(() => { toast('Deine Sitzung ist abgelaufen. Bitte lade die Seite neu.'); }, Math.max(0, data.sessionExpires - Date.now()));
}
function berlinDay(value, next = false) {
  const [year, month, day] = value.split('-').map(Number), utc = Date.UTC(year, month - 1, day + (next ? 1 : 0));
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' });
  let timestamp = utc;
  for (let n = 0; n < 3; n++) { const offset = formatter.formatToParts(timestamp).find(p => p.type === 'timeZoneName').value, match = /GMT([+-])(\d\d):(\d\d)/.exec(offset); timestamp = utc - (match ? (Number(match[2]) * 60 + Number(match[3])) * 60000 * (match[1] === '+' ? 1 : -1) : 0); }
  return timestamp;
}

async function api(path, options = {}) {
  const { body, ...rest } = options;
  let response;
  try { response = await fetch(path, { ...rest, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-CSRF-Token': state?.csrf || '' } : {}), ...rest.headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
  catch (error) { throw new Error(SHOP_UNAVAILABLE, { cause: error }); }
  const data = await readJsonResponse(response);
  armExpiry(data);
  return data;
}
const post = (path, body = {}) => api(path, { method: 'POST', body });
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 4200); }
function header() {
  const label = $('.test-label');
  if (label) label.textContent = state.checkoutEnabled === false ? 'Verkaufsstart in Vorbereitung' : state.mode === 'live' ? 'Versand innerhalb Deutschlands' : 'Testshop · keine echten Zahlungen';
  $('#header').classList.remove('menu-open');
  $('#header').innerHTML = `<div class="header-inner">${logo()}<nav aria-label="Hauptnavigation"><a href="/kollektion" class="${location.pathname.includes('/kollektion') ? 'active' : ''}">Die Kollektion</a><a href="/gestalten" class="${location.pathname === '/gestalten' ? 'active' : ''}">Dein Wunschvers ${icon('spark')}</a><a href="/bundle" class="${location.pathname === '/bundle' ? 'active' : ''}">Bundles</a><a href="/ueber-uns">Unsere Geschichte</a></nav><div class="header-actions"><a href="/konto" aria-label="Mein Konto" title="Mein Konto">${icon('user')}</a><a href="/warenkorb" class="cart-link" aria-label="Warenkorb, ${state.cart.reduce((s, i) => s + i.quantity, 0)} Artikel">${icon('bag')}<span>${state.cart.reduce((s, i) => s + i.quantity, 0)}</span></a><button class="icon-button mobile-menu" aria-label="Menü öffnen" aria-expanded="false" data-action="menu">${icon('menu')}</button></div></div>`;
}
function footer() {
  $('#footer').innerHTML = `<div class="footer-main"><div>${logo()}<p>Ein Vers für den Weg.<br>Ein Stück Hoffnung für deinen Alltag.</p><small>Mit Bedeutung gestaltet. Für dich und deine Lieben.</small></div><div><h3>Entdecken</h3><a href="/kollektion">Die Kollektion</a><a href="/gestalten">Deine Wunschvers-Hülle</a><a href="/ueber-uns">Unsere Geschichte</a><a href="/faq">Häufige Fragen</a><a href="/newsletter">Newsletter · 5 % sichern</a></div><div><h3>Gut zu wissen</h3><a href="/versand">Versand & Geschenkkarte</a><a href="/vertrag-widerrufen" class="withdrawal-link">Vertrag widerrufen</a><a href="/widerruf">Widerruf & Rückgabe</a><a href="/datenschutz">Datenschutz</a><a href="/impressum">Impressum</a><a href="/agb">AGB</a></div><div class="footer-note">${icon('leaf')}<h3>Weniger Lärm.<br>Mehr Bedeutung.</h3><p>Deine Hülle wird erst nach deiner<br>Bestellung für dich gefertigt.</p><span class="draft-note">${state.checkoutEnabled === false ? 'Verkaufsstart in Vorbereitung' : 'Mit Sorgfalt für dich gefertigt'}</span></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(state.brand.name)} · Mit Hoffnung unterwegs.</span><span>Deutschland · EUR €</span><a href="${state.user?.role === 'admin' ? '/admin/kunden' : '/konto'}">${state.user?.role === 'admin' ? 'Administration' : 'Mein Konto'}</a></div>`;
}
const designImage = id => `/assets/design-${id}.svg`;
function phone(id, options = {}) {
  const model = state.models.find(m => m.name === options.model) || state.models.find(m => m.id === 'iphone-15');
  return phoneMockup(model, { imageUrl: options.url || designImage(id), color: caseColor(options.backgroundId)?.hex, className: options.cls || '', caseOnly: Boolean(options.caseOnly), label: options.alt });
}

const botanical = `<svg class="botanical" viewBox="0 0 300 520" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M106 520C197 365 112 194 245 15M145 420C28 432 31 319 45 273C128 290 152 358 145 420ZM159 341C259 366 282 270 272 215C195 219 157 274 159 341ZM163 258C60 266 85 156 98 125C153 152 178 199 163 258ZM184 173C277 190 293 111 286 76C229 80 194 122 184 173ZM220 72C161 79 171 23 191 0C221 21 233 42 220 72Z"/></svg>`;
function productCard(d, index) {
  return `<article class="product-card"><a href="/kollektion/${d.id}" class="product-visual" style="--card-bg:${d.color}"><span class="product-label">${esc(d.label)}</span>${phone(d.id)}<span class="product-open" aria-label="Motiv entdecken">${icon('arrow')}</span><span class="product-number">0${index + 1}</span></a><div class="product-detail"><div><a href="/kollektion/${d.id}"><h3>${esc(d.title)}</h3></a><p>${esc(d.reference)} <span>· Tough-Hülle</span></p></div><span>${money(state.brand.fixedPrice)}</span></div></article>`;
}
function collectionBlock(full = false) {
  return `<section id="kollektion" class="collection section-wrap"><div class="section-heading"><div><span class="eyebrow">DIE ERSTE KOLLEKTION</span><h2>Ruhe und Geborgenheit<span class="serif-dot">.</span></h2></div><p>Sechs Motive. Sechs leise Erinnerungen.<br>An das, was bleibt, wenn alles andere laut wird.</p></div><div class="collection-toolbar"><span>${icon('leaf')} Für iPhone, Samsung & Google Pixel</span><span>6 Motive <i></i> ${money(state.brand.fixedPrice)} inkl. Versand</span></div><div class="product-grid">${state.designs.map(productCard).join('')}</div>${bundleTeaser()}<div class="collection-footnote">Alle Produktbilder zeigen digitale Vorschauen. Verfügbarkeit und Druckfreigabe werden je Modell geprüft.</div></section>`;
}
function bundleDiscountRow(pricing) {
  return pricing.discount ? `<div class="bundle-discount" data-bundle-discount><span>${pricing.source === 'newsletter' ? 'Newsletter' : 'Bundle'}-Rabatt (${pricing.percent} %)</span><strong>−${money(pricing.discount)}</strong></div>` : '';
}
function bundleTeaser() {
  return `<div class="bundle-teaser"><div><span class="eyebrow">FÜR DICH. UND DEINE LIEBSTEN.</span><h3>Mehrere Hüllen. Dein eigenes Bundle.</h3><p>Ab ${BUNDLE.minimumQuantity} Hüllen sparst du ${BUNDLE.percent} %, ab ${BUNDLE.higherMinimumQuantity} Hüllen ${BUNDLE.higherPercent} %. Jede Hülle gestaltest du unabhängig.</p></div><a class="button primary" href="/bundle">Bundle zusammenstellen ${icon('arrow')}</a></div>`;
}
function bundleCartNotice(pricing) {
  return `<div class="bundle-cart-notice" role="status"><div><strong>${pricing.isBundle ? `${pricing.quantity} Hüllen · ${pricing.percent} % Bundle-Rabatt` : 'Noch eine Hülle dazu – 5 % auf dein Bundle sparen'}</strong><p>${pricing.isBundle ? `Du sparst ${money(pricing.discount)} gegenüber dem Einzelkauf. Jede Hülle bleibt einzeln bearbeitbar.` : 'Fertige Motive und eigene Wunschtexte lassen sich frei kombinieren.'}</p></div><a class="button secondary" href="/bundle">${pricing.isBundle ? 'Bundle erweitern' : 'Weitere Hülle auswählen'} ${icon('arrow')}</a></div>`;
}
function bundleOrderSummary(order) {
  const pricing = summarizePricing(order.items);
  return pricing.discount ? `<div class="order-summary bundle-order-summary"><div><span>Hüllen einzeln</span><span>${money(pricing.subtotal)}</span></div>${bundleDiscountRow(pricing)}<div class="total"><strong>Gesamtpreis</strong><strong>${money(order.amount)}</strong></div></div>` : '';
}
function bundlePage() {
  const pricing = summarizePricing(state.cart), example = summarizePricing(priceBundleItems([{ unitPrice: state.brand.fixedPrice, quantity: BUNDLE.higherMinimumQuantity }]));
  return `<section class="section-wrap bundle-page"><div class="bundle-heading"><div><span class="eyebrow">ZUSAMMEN EIN BISSCHEN MEHR HOFFNUNG</span><h1>Dein Bundle.<br>Deine Gestaltung.</h1><p>Für dich, Familie oder Freunde: Spare ab zwei Hüllen 5 % und ab vier Hüllen 10 % auf alle Hüllen deiner Bestellung.</p><p>Modell, Motiv, Farbe, Wunschtext und MagSafe wählst du für jede Hülle einzeln.</p></div><aside class="bundle-example"><span class="handwritten">Gemeinsam sparen</span><strong>−${BUNDLE.higherPercent} %</strong><p>Ab ${BUNDLE.minimumQuantity} Hüllen ${BUNDLE.percent} % · ab ${BUNDLE.higherMinimumQuantity} Hüllen ${BUNDLE.higherPercent} %</p><p>Zum Beispiel ${BUNDLE.higherMinimumQuantity} Standardhüllen</p><div><s>${money(example.subtotal)}</s><b>${money(example.total)}</b></div><small>Versand in Deutschland inklusive</small></aside></div><div class="bundle-steps"><span><b>1</b> Hülle auswählen und gestalten</span><span><b>2</b> Weitere Hüllen hinzufügen</span><span><b>3</b> Automatisch 5 % oder 10 % sparen</span></div><div class="bundle-choices"><a class="bundle-choice" href="/kollektion"><span class="eyebrow">FERTIGE VERSE</span><h2>Aus der Kollektion</h2><p>Wähle dein Motiv, Handymodell und deine Lieblingsfarbe.</p><span class="underlined">Hülle auswählen ${icon('arrow')}</span></a><a class="bundle-choice" href="/gestalten"><span class="eyebrow">DEINE EIGENEN WORTE</span><h2>Persönlich gestalten</h2><p>Schreibe deinen eigenen Text oder wähle einen Vers. Mit optionaler Widmung.</p><span class="underlined">Hülle gestalten ${icon('arrow')}</span></a></div>${state.cart.length ? `<div class="bundle-selection"><div class="section-heading"><div><span class="eyebrow">DEINE AUSWAHL</span><h2>${pricing.quantity} ${pricing.quantity === 1 ? 'Hülle' : 'Hüllen'} im Bundle</h2></div><p>Jede Gestaltung kannst du hier noch bearbeiten.</p></div><div class="checkout-layout"><div>${state.cart.map(i => cartRow(i)).join('')}</div><aside class="order-summary"><h2>Dein Bundle-Preis</h2><div><span>Hüllen einzeln</span><span>${money(pricing.subtotal)}</span></div>${bundleDiscountRow(pricing)}${!pricing.isBundle ? '<p>Ab einer zweiten Hülle erhältst du automatisch 5 % Rabatt.</p>' : ''}<div class="total"><strong>Gesamt</strong><strong data-bundle-total>${money(pricing.total)}</strong></div><small>Versand in Deutschland inklusive</small><a class="button primary full" href="/warenkorb">Zum Warenkorb ${icon('arrow')}</a></aside></div></div>` : '<p class="bundle-empty">Dein Bundle ist noch leer. Wähle oben deine erste Hülle aus.</p>'}<p class="bundle-terms">Der Rabatt gilt automatisch: 5 % bei zwei bis drei Hüllen, 10 % ab vier Hüllen. Die erreichte Stufe gilt für alle Hüllen derselben Bestellung, auch für personalisierte Hüllen und MagSafe. Alle Hüllen werden an dieselbe Lieferadresse geschickt. Unter zwei Hüllen gilt wieder der Einzelpreis. Du brauchst keinen Rabattcode.</p></section>`;
}
function home() {
  return `<section class="hero section-wrap"><div class="hero-copy"><span class="eyebrow"><span class="little-line"></span> CHRISTLICHE HANDYHÜLLEN MIT DEINEM VERS</span><h1>Ein Vers für<br>deinen <em>Alltag.</em></h1><p class="hero-description">Manche Worte tragen uns.<br> Nimm sie mit – auf einer Hülle, die dich erinnert,<br>ermutigt und ein kleines Stück Hoffnung schenkt.</p><div class="hero-buttons"><a class="button primary" href="/kollektion">Kollektion entdecken ${icon('right')}</a><a class="text-button" href="/gestalten">Hülle mit Wunschvers gestalten ${icon('arrow')}</a></div><div class="hero-benefits"><span>${icon('truck')} Versand in DE inklusive</span><span>${icon('gift')} Mit Geschenkkarte</span></div></div><div class="hero-scene"><div class="scene-light"></div><div class="scene-circle"></div><div class="scene-line line-one"></div><div class="scene-line line-two"></div>${botanical}<span class="handwritten scene-note">Für das, was<br>dich trägt.</span><div class="hero-phones">${phone('nach-dem-sturm', { cls: 'hero-phone-back', eager: true })}${phone('unter-seinen-fluegeln', { cls: 'hero-phone-front', eager: true })}</div><div class="scene-caption"><span><i></i> KLEINE ERINNERUNG. GROSSE ZUSAGE.</span><span>Psalm 91,4</span></div></div></section><div class="promise-strip"><span>${icon('heart')} Glaube, der dich begleitet</span><span>${icon('shield')} Eine Hülle. Doppelter Schutz.</span><span>${icon('gift')} Für dich. Oder einen Herzensmenschen.</span></div>${collectionBlock()}<section class="custom-banner section-wrap"><div class="custom-banner-art">${phone('im-schatten')}<span class="handwritten">Dein Vers.<br>Deine Geschichte.</span></div><div><span class="eyebrow">SO PERSÖNLICH WIE DEIN WEG</span><h2>Welche Worte<br>gehen mit dir?</h2><p>Ein Vers, der Mut macht. Ein Name, der dir viel bedeutet. Gestalte einen Begleiter, der deine Geschichte erzählt.</p><a href="/gestalten" class="button primary">Deine Wunschvers-Hülle gestalten ${icon('arrow')}</a><small>${money(state.brand.customPrice)} · Versand & Geschenkkarte inklusive</small></div></section><section class="gift-section section-wrap"><div><span class="eyebrow">HOFFNUNG LÄSST SICH WEITERSCHENKEN</span><h2>Ein kleiner Gruß.<br>Von Herzen.</h2><p>Zu jeder Hülle gehört eine schlichte Geschenkkarte zum Selbstbeschriften. Für die Worte, die nur du sagen kannst.</p><a class="underlined" href="/versand">Mehr über die Geschenkkarte ${icon('arrow')}</a></div><div class="gift-card"><span><img src="${esc(state.brand.logo)}" alt="${esc(state.brand.name)} Original-Logo"></span><span class="handwritten">Ein Vers für dich</span><div class="writing-lines"><i></i><i></i><i></i></div><small>Ein Stück Hoffnung für deinen Weg.</small></div></section>`;
}
const modelChoice = () => modelTrigger(state.models, config.modelId);
function magsafeAvailability() {
  return Boolean(state.variants.find(v => v.model_id === config.modelId && v.design_id === config.designId)?.magsafe_available);
}
function magsafeHelp() {
  return magsafeAvailability() ? 'Mit integriertem Magnetring für kompatibles Zubehör. Kabelloses Laden hängt von deinem Handy und Ladegerät ab.' : 'Für dieses Modell ist die magnetische Hülle derzeit nicht verfügbar. Deine Gestaltung bleibt erhalten.';
}
function magsafeChoice() {
  return `<div class="magsafe-options"><label class="magsafe-choice" for="magsafe"><input type="checkbox" id="magsafe" name="magsafe" aria-describedby="magsafe-help" ${config.magsafe ? 'checked' : ''} ${!magsafeAvailability() && !config.magsafe ? 'disabled' : ''}><span><strong>MagSafe-kompatibel</strong><small>Dein Design bleibt unverändert</small></span><b>+ ${money(state.brand.magsafeSurcharge)}</b></label><p class="field-help" id="magsafe-help">${magsafeHelp()}</p></div>`;
}
function syncCaseSelection() {
  $$('[data-config-price]').forEach(el => { el.textContent = money(casePrice(state.brand, config)); });
  $$('[data-case-label]').forEach(el => { el.textContent = caseLabel(config); });
  const input = $('#magsafe');
  if (input) { input.checked = Boolean(config.magsafe); input.disabled = !magsafeAvailability() && !config.magsafe; }
  if ($('#magsafe-help')) $('#magsafe-help').textContent = magsafeHelp();
}
function colorChoice() {
  const selected = caseColor(config.backgroundId);
  return `<fieldset class="color-choice"><legend>Dein Hintergrund: <strong data-color-name>${esc(selected.name)}</strong></legend><div class="color-options">${CASE_COLORS.map(color => `<button type="button" class="color-option" data-background="${color.id}" aria-pressed="${color.id === selected.id}"><span class="color-swatch" style="--swatch:${color.hex}" aria-hidden="true"></span><span>${esc(color.name)}</span></button>`).join('')}</div></fieldset>`;
}
function previewPanel() {
  const d = state.designs.find(d => d.id === config.designId), model = state.models.find(m => m.id === config.modelId);
  const slides = [false, true].map((caseOnly, index) => `<div class="preview-slide" role="group" aria-roledescription="Bild" aria-label="${index + 1} von 2: ${caseOnly ? 'Nur Hülle' : 'Mit Handy'}"><span class="preview-tag">${caseOnly ? 'DEINE HÜLLE · OFFENE AUSSPARUNG' : 'DEINE HÜLLE AM HANDY'}</span><div id="${caseOnly ? 'case-phone' : 'live-phone'}" class="preview-device">${config.kind === 'custom' && !currentPreview ? '<p class="preview-placeholder">Deine Vorschau wird erstellt …</p>' : phone(d.id, { url: currentPreview?.svgUrl, cls: 'detail-phone', model: model.name, caseOnly, backgroundId: config.backgroundId })}</div><span class="preview-subtitle" data-preview-model>${esc(model.name)}</span></div>`).join('');
  return `<div class="preview-panel"><section class="preview-stage preview-gallery" aria-label="Hüllenansichten" aria-roledescription="Karussell" style="--card-bg:${d.color}"><div class="preview-track" tabindex="0" aria-label="Hüllenansichten: mit Pfeiltasten oder Wischen wechseln">${slides}</div><div class="preview-controls"><button type="button" class="preview-arrow" data-preview-previous aria-label="Vorherige Hüllenansicht">${icon('back')}</button><div class="preview-tabs" role="group" aria-label="Ansicht wählen"><button type="button" data-preview-slide="0" aria-pressed="true">Mit Handy</button><button type="button" data-preview-slide="1" aria-pressed="false">Nur Hülle</button></div><button type="button" class="preview-arrow" data-preview-next aria-label="Nächste Hüllenansicht">${icon('right')}</button></div><p class="preview-hint">Wischen oder Ansicht wählen</p><span class="visually-hidden" data-preview-status aria-live="polite">1 / 2 · Mit Handy</span></section><div class="preview-info">${icon('check')} Dein Motiv und Text bleiben in beiden Ansichten gleich.</div><details class="print-details"><summary>Vollständigen Drucktext ansehen ${icon('chevron')}</summary><pre id="print-text">${esc(currentPreview?.printText || 'Vorschau wird erstellt …')}</pre><p>Gerade ausgerichtet · Schrift und Motiv werden proportional eingesetzt.</p><a id="print-download" ${currentPreview ? '' : 'hidden'} href="${currentPreview?.pngUrl || '#'}" target="_blank" rel="noopener">Druckentwurf vergrößern ${icon('arrow')}</a></details><p class="draft-note">${state.printMode === 'podbase' ? 'Druckdatei mit Original-Podbase-Vorlage geprüft. Die Hüllenansicht bleibt schematisch; Farben und Material können beim fertigen Produkt abweichen.' : 'Illustrative Modellvorschau. Form und Ausschnitt können bei der fertigen Hülle abweichen; die endgültigen Podbase-Vorlagen stehen noch aus.'}</p></div>`;
}

function fixedProduct(d) {
  return `<div class="section-wrap detail-page"><a href="/kollektion" class="back-link">${icon('back')} Zur Kollektion</a><div class="product-layout">${previewPanel()}<div class="product-copy"><span class="eyebrow">RUHE UND GEBORGENHEIT · 0${state.designs.indexOf(d) + 1}/06</span><h1>${esc(d.title)}</h1><p class="verse-title handwritten">${esc(d.reference)}</p><p class="product-poem">${esc(d.note)}</p><div class="price-line"><strong data-config-price aria-live="polite">${money(casePrice(state.brand, config))}</strong><span>Endpreis inkl. Versand in DE & Geschenkkarte</span></div><p class="bundle-product-note">Ab zwei Hüllen 5 %, ab vier Hüllen 10 % sparen – im <a href="/bundle">frei zusammenstellbaren Bundle</a>.</p><div class="divider"></div>${modelChoice()}<p class="field-help">Du findest dein genaues Modell unter Einstellungen → Geräteinformationen.</p>${magsafeChoice()}${colorChoice()}<div class="case-type">${icon('shield')}<div><strong data-case-label>${caseLabel(config)}</strong><span>Schützende Doppelschicht</span></div></div><div id="preview-error" class="form-error" role="alert"></div><button class="button primary full" id="add-cart" data-action="add-cart">${new URLSearchParams(location.search).has('bearbeiten') ? 'Änderung im Warenkorb speichern' : 'In den Warenkorb'} ${icon('bag')}</button><div class="purchase-notes"><span>${icon('truck')} Deutschland · Versand inklusive</span><span>${icon('gift')} 10 × 15 cm Geschenkkarte inklusive</span></div><div class="product-story"><h3>Eine leise Erinnerung für jeden Tag.</h3><p>Eine feine Illustration und eine handschriftliche Versstelle. Ohne Markenaufdruck. Damit das im Mittelpunkt steht, was dir etwas bedeutet.</p></div><a href="/gestalten?motiv=${d.id}" class="underlined">Lieber mit deinem eigenen Wunschvers? ${icon('arrow')}</a></div></div></div><section class="section-wrap related"><span class="eyebrow">AUCH DAS KÖNNTE DICH BEGLEITEN</span><h2>Andere Worte. Dieselbe Hoffnung.</h2><div class="product-grid">${state.designs.filter(x => x.id !== d.id).slice(0, 3).map(productCard).join('')}</div></section>`;
}
function recommendationCards() {
  if (!advisorResults) return '';
  if (!advisorResults.recommendations.length) return '<p class="advisor-message">Für deine Beschreibung gibt es gerade keinen passenden Vorschlag. Du kannst oben einen Vers auswählen oder deinen eigenen Text schreiben.</p>';
  return `<div class="verse-recommendations">${advisorResults.recommendations.map(v => `<button type="button" class="verse-card ${config.verseId === v.id ? 'selected' : ''}" data-verse="${esc(v.id)}" aria-pressed="${config.verseId === v.id}"><span class="eyebrow">${esc(v.reference)}</span><q>${esc(v.quote)}</q><span class="verse-explanation">${esc(v.explanation)}</span><span class="verse-select">${config.verseId === v.id ? `${icon('check')} Ausgewählt` : `Diesen Vers wählen ${icon('arrow')}`}</span></button>`).join('')}</div>`;
}
function textChoiceContent() {
  const choices = `<div class="segmented text-choice" role="group" aria-label="Text für deine Hülle"><button type="button" data-text-mode="suggested" class="${textChoice.mode === 'suggested' ? 'selected' : ''}" aria-pressed="${textChoice.mode === 'suggested'}">${icon('spark')} Vers auswählen</button><button type="button" data-text-mode="custom" class="${textChoice.mode === 'custom' ? 'selected' : ''}" aria-pressed="${textChoice.mode === 'custom'}">${icon('edit')} Eigenen Text schreiben</button></div>`;
  if (textChoice.mode === 'custom') return `${choices}<label for="custom-text">Dein Text</label><textarea id="custom-text" name="customText" rows="4" maxlength="${MAX_CUSTOM_TEXT}" placeholder="Hier ist Platz für deine eigenen Worte …" aria-describedby="custom-text-help custom-text-count" spellcheck="true">${esc(config.customText)}</textarea><div class="input-footnote"><span id="custom-text-help">Schriftgröße und Zeilenumbrüche passen sich automatisch an. Kurze Texte bleiben besonders gut lesbar.</span><span id="custom-text-count">${config.customText.length}/${MAX_CUSTOM_TEXT}</span></div><p class="field-help">Gedruckt wird dein eingegebener Text. Eine Bibelstelle allein wird nicht automatisch um den Vers ergänzt. Prüfe bitte auch die Schreibweise in der Vorschau.</p>`;
  const verse = state.verses.find(v => v.id === config.verseId);
  return `${choices}<label for="verse">Deine Versstelle</label><div class="select-wrap"><select id="verse">${state.verses.map(v => `<option value="${esc(v.id)}" ${v.id === config.verseId ? 'selected' : ''}>${esc(v.reference)} – ${esc(v.quote)}</option>`).join('')}</select>${icon('chevron')}</div><div class="selected-verse"><q>${esc(verse?.quote)}</q><span>${esc(verse?.reference)}</span></div><p class="field-help">Versauszug und Bibelstelle werden zusammen auf deine Hülle gesetzt.</p><a class="underlined" href="${esc(verse?.source)}" target="_blank" rel="noopener noreferrer">Quelle: Luther 1912 ${icon('arrow')}</a><details id="verse-advice" class="verse-advice" ${adviceOpen ? 'open' : ''}><summary>${icon('spark')} Einen Vers für meine Situation finden</summary><form id="advisor-form"><label for="situation">Was bewegt dich gerade?</label><textarea id="situation" name="situation" rows="3" maxlength="1000" placeholder="Zum Beispiel: Ein Neuanfang steht an und ich wünsche mir Mut.">${esc(situation)}</textarea><p class="privacy-note">Deine Beschreibung bleibt nur in der aktuellen Sitzung und wird nicht in der Bestellung gespeichert. Der Berater wählt derzeit aus geprüften Versen, ohne externe KI.</p><button class="button secondary full" type="submit" ${advisorPending ? 'disabled' : ''}>${advisorPending ? 'Verse werden gesucht …' : `Verse vorschlagen ${icon('spark')}`}</button><div class="form-error" role="alert"></div></form><div id="advisor-results" aria-live="polite">${recommendationCards()}</div></details>`;
}
function wizardContent() {
  if (currentStep === 0) return `<h2>Welche Worte tragen dich?</h2><p>Wähle einen Vers, lass dir einen vorschlagen oder schreibe deine eigenen Worte.</p>${textChoiceContent()}`;
  if (currentStep === 1) return `<h2>Ein Bild für deine Worte.</h2><p>Wähle eines unserer sechs Motive.</p><div class="motif-grid">${state.designs.map(d => `<button class="motif-option ${config.designId === d.id ? 'selected' : ''}" data-design="${d.id}"><span data-motif-background style="background:${caseColor(config.backgroundId).hex}"><img src="${esc(d.foregroundImageUrl)}" alt="Blankomotiv ${esc(d.title)}"></span><b>${esc(d.title)}</b>${config.designId === d.id ? icon('check') : ''}</button>`).join('')}</div>${colorChoice()}`;
  if (currentStep === 2) return `<h2>Passt genau zu dir.</h2><p>Wähle dein Smartphone und die passende Hüllenart.</p>${modelChoice()}${magsafeChoice()}<p class="field-help">Wähle Apple, Samsung oder Google und finde dein Modell mit der Suche.</p><div class="info-box">${icon('shield')}<div><strong>Dein Modell bestimmt die Druckfläche.</strong><p>${state.printMode === 'podbase' ? 'Die Druckdatei wird anhand der Originalvorlage für dein Modell geprüft. Modelle ohne vollständige Vorlage sind noch nicht bestellbar.' : 'Die Vorschau passt sich an den Kameraausschnitt an. Im Testbetrieb verwenden wir simulierte Schablonen. Vor Verkauf wird jede Kombination einzeln geprüft.'}</p></div></div>`;
  return `<h2>Ein kleines bisschen persönlicher.</h2><p>Ein Name, ein Datum, ein leiser Gruß. Deine Widmung ist freiwillig.</p><label for="dedication">Deine Widmung <small>optional</small></label><input id="dedication" name="dedication" type="text" maxlength="32" value="${esc(config.dedication)}" placeholder="Zum Beispiel: Für Anna · 2026" autocomplete="off"><div class="input-footnote"><span>Wird separat unter deinem Text gedruckt.</span><span id="dedication-count">${config.dedication.length}/32</span></div><div class="info-box">${icon('gift')}<div><strong>Eine Karte für deine eigenen Worte.</strong><p>Deiner Hülle liegt eine feste, einseitige Geschenkkarte (10 × 15 cm) zum Selbstbeschriften bei. Dafür brauchst du hier keinen Kartentext einzugeben.</p></div></div>`;
}
function customizer() {
  return `<section class="section-wrap customizer-page"><a href="/kollektion" class="back-link">${icon('back')} Zur Kollektion</a><div class="customizer-heading"><span class="eyebrow">DEINE WORTE. DEINE GESCHICHTE.</span><h1>Ein Begleiter, der zu dir passt.</h1><p>Deine personalisierte Hülle · <span data-config-price aria-live="polite">${money(casePrice(state.brand, config))}</span> inkl. Versand & Geschenkkarte</p></div><div class="product-layout">${previewPanel()}<div class="wizard"><div class="wizard-steps" aria-label="Gestaltungsschritte">${['Dein Text', 'Motiv', 'Modell', 'Widmung'].map((label, i) => `<button data-step="${i}" class="${currentStep === i ? 'active' : ''}" aria-current="${currentStep === i ? 'step' : 'false'}"><span>${i < currentStep ? icon('check') : i + 1}</span>${label}</button>`).join('')}</div><div id="wizard-content">${wizardContent()}</div><div id="preview-error" class="form-error" role="alert"></div><div class="wizard-navigation">${currentStep ? `<button class="text-button" data-action="previous-step">${icon('back')} Zurück</button>` : '<span></span>'}${currentStep < 3 ? `<button class="button primary" data-action="next-step">Weiter ${icon('right')}</button>` : `<button class="button primary" id="add-cart" data-action="add-cart">${new URLSearchParams(location.search).has('bearbeiten') ? 'Änderung speichern' : 'In den Warenkorb'} ${icon('bag')}</button>`}</div><p class="wizard-note">Du kannst jede Gestaltung im Warenkorb noch bearbeiten. <a href="/bundle">Ab zwei Hüllen 5 %, ab vier Hüllen 10 % Bundle-Rabatt.</a></p></div></div></section>`;
}
async function updatePreview() {
  const seq = ++previewSequence; previewPending = true;
  const add = $('#add-cart'); if (add) add.disabled = true;
  try {
    const preview = await post('/api/preview', config);
    if (seq !== previewSequence) return;
    currentPreview = preview; previewPending = false;
    if ($('#custom-text')) $('#custom-text').removeAttribute('aria-invalid');
    const d = state.designs.find(d => d.id === config.designId), model = state.models.find(m => m.id === config.modelId);
    if ($('#live-phone')) $('#live-phone').innerHTML = phone(d.id, { url: preview.svgUrl, cls: 'detail-phone', model: model.name, backgroundId: preview.configuration.backgroundId });
    if ($('#case-phone')) $('#case-phone').innerHTML = phone(d.id, { url: preview.svgUrl, cls: 'detail-phone', model: model.name, caseOnly: true, backgroundId: preview.configuration.backgroundId });
    if ($('.preview-stage')) $('.preview-stage').style.setProperty('--card-bg', d.color);
    $$('[data-preview-model]').forEach(label => { label.textContent = model.name; });
    if ($('#print-text')) $('#print-text').textContent = preview.printText;
    if ($('#print-download')) { $('#print-download').href = preview.pngUrl; $('#print-download').hidden = !textIsReady(); }
    const available = state.variants.find(v => v.model_id === config.modelId && v.design_id === config.designId);
    const error = !textIsReady() ? 'Bitte gib deinen eigenen Text ein oder wähle einen Vers aus.' : !caseAvailable(available, config) ? (config.magsafe ? 'MagSafe ist für diese Kombination gerade nicht verfügbar. Entferne den Haken oder wähle ein anderes Modell.' : 'Diese Kombination ist gerade nicht verfügbar. Bitte wähle ein anderes Modell oder Motiv.') : '';
    if ($('#preview-error')) $('#preview-error').textContent = error;
    if ($('#add-cart')) $('#add-cart').disabled = Boolean(error);
  } catch (e) { if (seq === previewSequence) {
    currentPreview = null; previewPending = true;
    if ($('#preview-error')) $('#preview-error').textContent = e.message;
    if ($('#custom-text')) $('#custom-text').setAttribute('aria-invalid', 'true');
    if ($('#print-download')) $('#print-download').hidden = true;
    if ($('#print-text')) $('#print-text').textContent = 'Noch kein gültiger Drucktext – bitte korrigiere deine Eingabe.';
    for (const id of ['#live-phone', '#case-phone']) if ($(id)) $(id).innerHTML = '<p class="preview-placeholder">Bitte passe deinen Text an, damit eine neue Vorschau erstellt werden kann.</p>';
  } }
}
const editLink = i => `${i.configuration.kind === 'custom' ? '/gestalten' : `/kollektion/${i.configuration.designId}`}?bearbeiten=${i.id}`;
function cartRow(i, editable = true) {
  return `<article class="cart-row"><div class="cart-thumb" style="background:${state.designs.find(d => d.id === i.configuration.designId).color}">${phone(i.configuration.designId, { url: `/prints/${i.hash}${i.configuration.productionPrint ? '.preview' : ''}.svg`, model: i.model, backgroundId: i.configuration.backgroundId })}</div><div class="cart-row-copy"><span class="eyebrow">${i.configuration.kind === 'custom' ? 'DEIN WUNSCHVERS' : 'AUS DER KOLLEKTION'}</span><h3>${esc(i.title)}</h3><p>${esc(i.model)} · ${esc(caseLabel(i.configuration))}</p><p class="cart-color">Hintergrund: ${esc(caseColor(i.configuration.backgroundId)?.name || 'Weiß')}</p><pre>${esc(i.printText)}</pre>${!i.available && editable ? '<p class="form-error">Diese Variante ist gerade nicht verfügbar. Bitte bearbeiten oder entfernen.</p>' : ''}${editable ? `<div class="cart-row-actions"><a href="${editLink(i)}">${icon('edit')} Bearbeiten</a><button data-remove="${i.id}">Entfernen</button><label class="quantity-label">Anzahl <select data-quantity="${i.id}" aria-label="Anzahl ${esc(i.title)}">${Array.from({ length: 10 }, (_, n) => `<option ${i.quantity === n + 1 ? 'selected' : ''}>${n + 1}</option>`).join('')}</select></label></div>` : `<small>Anzahl: ${i.quantity}</small>`}</div><strong>${money(i.unitPrice * i.quantity)}</strong></article>`;
}
function cartPage() {
  if (!state.cart.length) return `<section class="empty-state section-wrap">${icon('bag')}<span class="eyebrow">PLATZ FÜR ETWAS BEDEUTUNGSVOLLES</span><h1>Dein Warenkorb wartet auf dich.</h1><p>Finde einen kleinen Begleiter für deinen Alltag.<br>Oder für jemanden, der dir am Herzen liegt.</p><a href="/kollektion" class="button primary">Kollektion entdecken ${icon('right')}</a></section>`;
  const pricing = summarizePricing(state.cart), amount = pricing.total;
  return `<section class="section-wrap cart-page"><a href="/kollektion" class="back-link">${icon('back')} Weiter entdecken</a><span class="eyebrow">DEINE KLEINEN BEGLEITER</span><h1>${pricing.isBundle ? 'Dein Bundle' : 'Dein Warenkorb'}<span class="serif-dot">.</span></h1>${bundleCartNotice(pricing)}${/^([a-f0-9-]{36})$/.test(new URLSearchParams(location.search).get("bestellung") || "") ? `<div class="info-box"><p>Du bist von der Zahlung zurückgekehrt. Wenn du neu bestellen möchtest, brich zuerst die begonnene Zahlung ab. Dadurch wird auch ein reservierter Newsletter-Code wieder frei.</p><button class="button secondary" data-cancel="${esc(new URLSearchParams(location.search).get("bestellung"))}">Begonnene Zahlung abbrechen</button></div>` : ""}<div class="checkout-layout"><div>${state.cart.map(i => cartRow(i)).join('')}<div class="cart-gift">${icon('gift')}<div><strong>Ein kleiner Gruß gehört dazu.</strong><p>Die feste Geschenkkarte zum Selbstbeschriften ist bei jeder Bestellung inklusive.</p></div></div><details class="feedback"><summary>Fehlt noch etwas für deine Entscheidung?</summary><p>Dein Feedback ist freiwillig. Wir schließen aus einem Abbruch nicht auf einen Grund.</p><form id="feedback-form"><select name="reason" aria-label="Freiwilliger Grund"><option>Preis</option><option>Fehlendes Modell</option><option>Gestaltung</option><option>Keine Angabe</option></select><button class="button secondary">Feedback senden</button></form></details></div><aside class="order-summary"><h2>Deine Bestellung</h2><div><span>Hüllen (${state.cart.reduce((s, i) => s + i.quantity, 0)})</span><span>${money(pricing.subtotal)}</span></div>${bundleDiscountRow(pricing)}<div><span>Versand nach Deutschland</span><span>Inklusive</span></div><div><span>Geschenkkarte</span><span>Inklusive</span></div><div class="total"><strong>Gesamt</strong><strong>${money(amount)}</strong></div><small>Endpreis${state.mode === 'live' ? '' : ' · Testbetrieb'}</small><p class="fine-print">${esc(state.taxNotice || '')}</p><a class="button primary full ${state.cart.some(i => !i.available) ? 'disabled' : ''}" href="/kasse">Zur Kasse ${icon('right')}</a>${state.paymentMode === 'local' ? '<span class="payment-label"><b class="paypal-word">PayPal</b><span>VISA</span><span>Mastercard</span></span>' : '<span class="payment-label">Sicher bezahlen mit Stripe</span>'}<p>${icon('shield')} ${state.paymentMode === 'local' ? 'Lokal simulierte Zahlung. Es wird kein Geld abgebucht.' : state.mode === 'live' ? 'Sicherer Checkout über Stripe.' : 'Stripe-Testzahlung. Es wird kein echtes Geld abgebucht.'}</p></aside></div></section>`;
}
function checkoutPage() {
  if (state.checkoutEnabled === false) return `<section class="section-wrap checkout-page"><span class="eyebrow">BALD FÜR DICH DA</span><h1>Wir bereiten den Verkaufsstart vor.</h1><p>Du kannst deine Hülle schon gestalten und im Warenkorb speichern. Bestellungen und Zahlungen sind noch nicht freigeschaltet.</p><a class="button primary" href="/warenkorb">Zurück zum Warenkorb</a></section>`;
  if (!state.cart.length) return cartPage();
  const pricing = summarizePricing(state.cart), total = pricing.total;
  const savedAddress = state.account?.address;
  const saveAddressChoice = state.user ? `<label class="save-choice"><input type="checkbox" name="saveAddress"><span>${savedAddress ? 'Geänderte Lieferdaten für nächste Bestellungen speichern' : 'Lieferdaten für nächste Bestellungen speichern'}<small>Freiwillig. Wird nach erfolgreicher Zahlung in deinem Kundenkonto übernommen.</small></span></label>` : '';
  const cardSavingNote = state.user ? `<p id="card-saving-note" class="card-saving-note" ${state.paymentMode === 'local' ? 'hidden' : ''}>${state.paymentMode === 'local' ? 'Im nächsten Schritt kannst du freiwillig eine Demo-Karte speichern oder eine bereits gespeicherte Demo-Karte auswählen.' : 'Im sicheren Stripe-Checkout kannst du freiwillig eine Karte speichern oder eine bereits hinterlegte Karte verwenden.'}</p>` : '';
  return `<section class="section-wrap checkout-page"><a href="/warenkorb" class="back-link">${icon('back')} Zum Warenkorb</a><span class="eyebrow">FAST BEI DIR</span><h1>Ein guter nächster Schritt.</h1><div class="checkout-layout"><form id="checkout-form"><div class="checkout-account">${icon('user')}<div>${state.user ? `Angemeldet als <b>${esc(state.user.email)}</b>` : `Du bestellst als Gast. <a href="/konto?weiter=kasse">Freiwillig anmelden oder Konto anlegen ${icon('arrow')}</a>`}</div></div><h2>Wohin darf deine Hülle reisen?</h2>${recipientFields(savedAddress || {}, state.user?.email)}${saveAddressChoice}<h2 class="payment-heading">Wie möchtest du bezahlen?</h2>${state.paymentMode !== 'local' ? '<input type="hidden" name="method" value="stripe"><p>Wähle deine Zahlungsart im sicheren Stripe-Checkout.</p>' : `<div class="payment-options"><label><input type="radio" name="method" value="paypal" checked><b class="paypal-word">PayPal</b><span>${state.paymentMode === 'local' ? 'Lokale Testzahlung' : 'PayPal über Stripe Checkout'}</span></label><label><input type="radio" name="method" value="card"><b>Debit- oder Kreditkarte</b><span>${state.paymentMode === 'local' ? 'Lokale Testzahlung' : 'Karte über Stripe Checkout'}</span></label></div>`}${cardSavingNote}<fieldset class="newsletter-code"><legend>Newsletter-Rabatt</legend><label for="newsletter-code">Dein persönlicher Code</label><input id="newsletter-code" name="newsletterEntry" autocomplete="off" maxlength="26" placeholder="LICHT-…" ${pricing.isBundle ? 'disabled' : ''}><input name="newsletterCode" type="hidden" value=""><div class="newsletter-code-actions"><button type="button" id="newsletter-apply" class="button secondary" ${pricing.isBundle ? 'disabled' : ''}>Code anwenden</button><button type="button" id="newsletter-remove" class="text-button" hidden>Entfernen</button></div><p>${pricing.isBundle ? 'Dein Bundle-Rabatt ist bereits aktiv. Ein zusätzlicher Newsletter-Rabatt ist nicht möglich.' : '5 % auf nicht reduzierte Hüllen. Bitte verwende oben die E-Mail-Adresse deiner bestätigten Newsletter-Anmeldung.'}</p><p id="newsletter-code-status" role="status" aria-live="polite"></p></fieldset><p class="test-checkout">${state.paymentMode === 'local' ? 'Dieser Testshop führt dich zu einem lokalen Zahlungssimulator. Gib keine echten Karten- oder PayPal-Daten ein.' : state.mode === 'live' ? 'Du wirst zum sicheren Stripe-Checkout weitergeleitet. Dort bestätigst du deine Zahlung.' : 'Du wirst zum gehosteten Stripe-Testcheckout weitergeleitet. Verwende ausschließlich Testkonten oder Testkarten.'}</p><div class="checkout-legal-info"><p><strong>Lieferzeit:</strong> ${DELIVERY}, ab dem Tag nach Vertragsschluss.</p><p>${PERSONALISATION_NOTICE}</p><p>Mit dem zahlungspflichtigen Bestellabschluss bei Stripe gelten unsere <a href="/agb">AGB</a>. Die <a href="/widerruf">Widerrufsbelehrung und das Musterformular</a> kannst du vorab lesen und speichern.</p>${warrantyHtml()}</div><div id="checkout-error" class="form-error" role="alert"></div><button class="button primary full" type="submit">${state.mode === 'live' ? 'Weiter zur Zahlung' : 'Zur Testzahlung'} · ${money(total)} ${icon('right')}</button><p class="legal-note">${state.mode === 'live' ? 'Bitte prüfe deine Bestellung vor der Zahlung.' : 'Mit dem Fortfahren testest du eine Bestellung.'} <a href="/agb">AGB</a>, <a href="/datenschutz">Datenschutz</a> und <a href="/widerruf">Widerrufsinformationen</a> ${state.mode === 'live' ? 'beachten.' : 'sind als vorbereitete Entwürfe hinterlegt.'}</p></form><aside class="order-summary checkout-review"><h2>${pricing.isBundle ? 'Dein Bundle' : 'Dein kleiner Begleiter'}</h2>${state.cart.map(i => `<div class="checkout-mini"><img src="/prints/${i.hash}${i.configuration.productionPrint ? '.preview' : ''}.svg" alt="Druckvorschau ${esc(i.title)}"><div><b>${esc(i.title)}</b><small>${esc(i.model)} · ${esc(caseLabel(i.configuration))} · ${i.quantity}×</small><pre>${esc(i.printText)}</pre><a href="${editLink(i)}">Bearbeiten</a></div><span>${money(i.unitPrice * i.quantity)}</span></div>`).join('')}${pricing.isBundle ? `<div><span>Hüllen einzeln</span><span>${money(pricing.subtotal)}</span></div>${bundleDiscountRow(pricing)}` : ''}<div id="newsletter-discount-row" class="bundle-discount"></div><div><span>Versand & Geschenkkarte</span><span>Inklusive</span></div><div class="total"><strong>Gesamt</strong><strong data-checkout-total>${money(total)}</strong></div><small>Deutschland · EUR · ${state.mode === 'live' ? 'Endpreis einschließlich Standardversand' : 'Endpreis im Testbetrieb'}</small><p class="fine-print">${esc(state.taxNotice || '')}</p></aside></div></section>`;
}
async function paymentPage(order) {
  const cards = order.canSaveCard ? await api('/api/account/payment-methods') : [];
  return `<section class="payment-simulator section-wrap"><span class="test-badge">LOKALER ZAHLUNGSSIMULATOR</span><h1>Deine ${order.method === 'paypal' ? 'PayPal-' : 'Karten'}Testzahlung.</h1><p>Bestellung ${esc(order.number)}</p><div class="simulator-card"><span class="payment-provider">${order.method === 'paypal' ? '<b class="paypal-word">PayPal</b>' : 'Karten-Testcheckout'}</span><strong class="simulator-amount">${money(order.amount)}</strong><p>Keine Verbindung zu einem Zahlungsanbieter.<br>Keine Abbuchung. Keine echten Zahlungsdaten nötig.</p>${order.canSaveCard ? localCardOptions(cards) : ''}<button class="button primary full" data-confirm="${order.id}">Testzahlung erfolgreich bestätigen ${icon('check')}</button><button class="text-button" data-cancel="${order.id}">Zahlung abbrechen</button><div class="form-error" id="payment-error" role="alert"></div></div><p class="fine-print">Der Server bestätigt Betrag, Währung und Bestellbezug. Ein Aufruf der Erfolgsseite allein löst keinen Druckauftrag aus.</p></section>`;
}
const statusLabels = { awaiting_payment: 'Zahlung steht aus', cancelled: 'Zahlung abgebrochen', payment_setup_failed: 'Zahlung nicht eingerichtet', awaiting_approval: 'Wartet auf Freigabe beim Druckpartner', payment_failed: 'Zahlung fehlgeschlagen', expired: 'Zahlungslink abgelaufen', paid: 'Bezahlt', production: 'In Produktion', shipped: 'Unterwegs' };
function orderPage(order) {
  const f = order.fulfillment, stages = ['Bezahlt', 'In Produktion', 'Unterwegs'], stage = !order.paid ? -1 : f?.state === 'shipped' ? 2 : f?.state === 'production' ? 1 : 0;
  return `<section class="section-wrap status-page"><span class="eyebrow">${order.paid ? 'HOFFNUNG IST AUF DEM WEG' : 'DEINE BESTELLUNG'}</span><h1>${order.paid ? 'Danke. Von Herzen.' : 'Ein Moment für deine Bestellung.'}</h1><p>${esc(order.number)} · ${date(order.created)} · ${money(order.amount)}</p>${order.simulated ? `<span class="test-badge">Zahlung ${state.paymentMode === 'local' ? 'lokal simuliert' : 'in Anbieter-Sandbox'} · Produktion und Tracking simuliert</span>` : ''}<div class="status-progress">${stages.map((s, i) => `<div class="${i <= stage ? 'done' : ''}"><span>${i <= stage ? icon('check') : i + 1}</span><b>${s}</b></div>`).join('')}</div>${f?.error ? `<div class="info-box error-box"><div><strong>Deine bezahlte Bestellung bleibt offen.</strong><p>${esc(f.error)}</p><p>Unser Team prüft die Übergabe an den Druckpartner. Bei Fragen erreichst du uns unter info@archenlicht.de.</p></div></div>` : ''}${f?.tracking ? `<div class="tracking-box">${icon('truck')}<div><strong>Deine ${order.simulated ? 'simulierte ' : ''}Sendungsnummer</strong><code>${esc(f.tracking)}</code>${order.simulated ? '<span>Nur Testdaten – kein echter Paketversand.</span>' : ''}</div></div>` : `<p class="status-message">${order.paid ? order.simulated ? 'Wir gleichen den Teststatus regelmäßig ab.' : f?.state === 'awaiting_approval' ? 'Deine Bestellung ist beim Druckpartner eingegangen und wartet auf unsere Freigabe zur Fertigung.' : 'Wir aktualisieren deinen Bestellstatus. Sobald der Druckpartner den Versand bestätigt, erhältst du eine Nachricht mit der Sendungsnummer.' : `${esc(statusLabels[order.status] || order.status)}. Erst eine serverseitig bestätigte Zahlung startet den Auftrag.`}</p>`}<div class="order-items">${order.items.map(i => cartRow(i, false)).join('')}</div>${bundleOrderSummary(order)}${order.paid ? `<div class="purpose-box"><h2>Für wen ist die Hülle?</h2><p>Wenn du magst, verrate es uns. Diese Angabe ist freiwillig.</p><div>${['Für mich', 'Als Geschenk', 'Beides', 'Keine Angabe'].map(p => `<button data-purpose="${esc(p)}" data-order="${order.id}" class="pill ${order.purpose === p ? 'selected' : ''}">${esc(p)}</button>`).join('')}</div></div>` : ''}<div class="status-footer">${icon('mail')}<p>${order.simulated ? 'Dies ist eine Testbestellung. Testnachrichten werden nur an freigegebene Empfänger verschickt.' : 'Deine Bestellbestätigung wird nach erfolgreicher Zahlung versendet. Die Versandnachricht folgt, sobald eine Sendungsnummer vorliegt.'} Dein persönlicher Statuslink funktioniert auch ohne Kundenkonto.</p></div><a href="/kollektion" class="underlined">Zurück zur Kollektion ${icon('arrow')}</a></section>`;
}
async function accountPage() {
  if (state.user) {
    const [orders, account] = await Promise.all([api('/api/account/orders'), api('/api/account/address')]);
    state.account = account;
    let cards = [], cardsError = '';
    try { cards = await api('/api/account/payment-methods'); } catch (error) { cardsError = error.message; }
    const settings = accountSettings({ address: state.account?.address, email: state.user.email, cards, cardsError, hasPreviousOrder: orders.some(order => order.paid), simulated: state.paymentMode === 'local' });
    return `<section class="section-wrap account-page"><div class="account-heading"><div><span class="eyebrow">SCHÖN, DASS DU DA BIST</span><h1>Deine kleinen Begleiter.</h1><p>${esc(state.user.email)}</p></div><button class="button secondary" data-action="logout">Abmelden</button></div>${state.user.role === 'admin' ? '<a class="button primary" href="/admin/kunden">Administration · Kunden & Bestellungen</a>' : ''}${settings}<h2>Deine Bestellungen</h2>${orders.length ? orders.map(o => `<a class="account-order" href="/bestellung/${o.id}"><span><b>${esc(o.number)}</b><small>${date(o.created)} · ${o.items.length} Position(en)</small></span><span>${esc(statusLabels[o.status] || o.status)}</span><strong>${money(o.amount)} ${icon('arrow')}</strong></a>`).join('') : '<div class="info-box"><p>Hier erscheinen deine Bestellungen, die du mit diesem Konto aufgibst. Gastbestellungen bleiben über ihren persönlichen Link erreichbar.</p></div>'}<a class="underlined" href="/kollektion">Die Kollektion entdecken ${icon('arrow')}</a></section>`;
  }
  const passwordField = `<div class="auth-password-group"><label for="auth-password">Passwort</label><div class="password-field"><input id="auth-password" name="password" type="password" minlength="${registerMode ? '12' : '1'}" maxlength="128" autocomplete="${registerMode ? 'new-password' : 'current-password'}" spellcheck="false" autocapitalize="none" required><button type="button" class="password-toggle" data-action="toggle-password" aria-controls="auth-password" aria-label="Passwort anzeigen" aria-pressed="false">Anzeigen</button></div>${registerMode ? '<small>Mindestens 12 Zeichen.</small>' : ''}</div>`;
  return `<section class="section-wrap auth-page"><div><span class="eyebrow">DEIN PLATZ BEI ARCHENLICHT</span><h1>${registerMode ? 'Ein Konto für deinen Weg.' : 'Willkommen zurück.'}</h1><p>Deine Bestellungen und ihr Versandstatus an einem Ort.<br>Ein Konto ist freiwillig – du kannst immer als Gast bestellen.</p></div><form id="auth-form"><h2>${registerMode ? 'Konto anlegen' : 'Anmelden'}</h2><label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" required></label>${passwordField}<div class="form-error" id="auth-error" role="alert"></div><button class="button primary full">${registerMode ? 'Konto anlegen' : 'Anmelden'} ${icon('right')}</button><button class="text-button" type="button" data-action="toggle-register">${registerMode ? 'Ich habe schon ein Konto' : 'Neu hier? Freiwillig ein Konto anlegen'}</button><p class="fine-print">Verwende für dein Kundenkonto ein eigenes, sicheres Passwort.</p></form></section>`;
}
function table(headers, rows) { return `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
const rate = (num, den) => `${den ? (num / den * 100).toFixed(1).replace('.', ',') : '0'} % <small>(${num}/${den})</small>`;
async function analyticsPage() {
  if (state.user?.role !== 'admin') return `<section class="section-wrap empty-state">${icon('shield')}<h1>Administration.</h1><p>Die Auswertung und das Testpostfach benötigen ein Administratorkonto.</p><a href="/konto" class="button primary">Zur Anmeldung ${icon('right')}</a></section>`;
  const query = new URLSearchParams(location.search), from = query.get('von') ? berlinDay(query.get('von')) : Date.now() - 30 * 86400000, to = query.get('bis') ? berlinDay(query.get('bis'), true) : Date.now() + 86400000;
  const [a, mails] = await Promise.all([api(`/api/admin/analytics?from=${from}&to=${to}`), api(state.mode === 'live' ? '/api/admin/mail-status' : '/api/admin/mail')]);
  const localDate = n => new Date(n).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  return `<section class="section-wrap analytics-page"><span class="eyebrow">ARCHENLICHT · ADMINISTRATION</span><a href="/admin/kunden" class="back-link">← Kundenübersicht</a><h1>Ein Blick auf deinen Shop.</h1><a class="button secondary" href="/admin/widerrufe">Eingegangene Widerrufe</a><div class="analytics-top"><span class="test-badge">${a.mode === 'live' ? 'Livebestellungen · Testdaten ausgeschlossen' : 'Nur Testdaten · echte Verkaufszahlen getrennt'}</span><form id="range-form"><label>Von<input name="von" type="date" value="${query.get('von') || localDate(from)}" required></label><label>Bis<input name="bis" type="date" value="${query.get('bis') || localDate(to)}" required></label><button class="button secondary">Anzeigen</button></form></div><div class="metric-grid">${[['Besuche', a.visits], ['Bezahlte Bestellungen', a.paidOrders], ['Verkaufte Stück', a.units], [a.mode === 'live' ? 'Umsatz' : 'Testumsatz', money(a.revenue)]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><h2>Fertig oder ganz persönlich?</h2>${table(['Produktart', 'Produktbesuche', 'Warenkorbbesuche', 'Bezahlte Bestellungen', 'Stück', 'Kaufquote'], a.products.map(p => [p.id === 'fixed' ? 'Kollektion' : 'Wunschvers', p.views, `${p.cartVisits} <small>(${p.cartVisits}/${p.views} Ansichten)</small>`, p.paidOrders, p.units, rate(p.paidVisits, p.denominator)]))}<h2>Die sechs Motive</h2>${table(['Motiv', 'Produktbesuche', 'Warenkorbbesuche', 'Bezahlte Bestellungen', 'Stück', 'Kaufquote'], a.designs.map(p => [esc(p.title), p.views, p.cartVisits, p.paidOrders, p.units, rate(p.paidVisits, p.denominator)]))}<h2>Woher kommen die Menschen?</h2>${table(['Herkunft', 'Besuche', 'Bezahlte Bestellungen', 'Kaufende Besuche / Besuche'], a.sources.map(s => [({ tiktok: 'TikTok', gemeinde: 'Gemeinde-QR', sonstige: 'Sonstige', unbekannt: 'Unbekannt' })[s.source], s.visits, s.paidOrders, rate(s.paidVisits, s.visits)]))}<div class="analytics-pair"><div><h2>Für wen?</h2>${table(['Kaufanlass', 'Bestellungen'], a.purposes.map(p => [esc(p.purpose), p.orders]))}</div><div><h2>Freiwilliges Feedback</h2>${table(['Genannter Grund', 'Antworten'], a.feedback.map(f => [esc(f.reason), f.count]))}<p class="fine-print">Es werden ausschließlich aktiv abgegebene Antworten gezählt.</p></div></div><details class="info-box"><summary>So werden die Kennzahlen gezählt</summary><p>${esc(a.definitions)}</p></details><h2>Offene bezahlte Fälle</h2>${a.openCases.length ? a.openCases.map(o => `<a class="open-case" href="/bestellung/${o.id}"><b>${esc(o.number)}</b><span>${esc(o.error)}</span>${icon('arrow')}</a>`).join('') : '<p>Keine offenen Problemfälle.</p>'}<h2>${state.mode === 'live' ? 'Bestellmails und Zustellstatus' : 'Lokales Testpostfach'}</h2><p>${state.mode === 'live' ? 'Bestätigungen werden nach Zahlung, Versandnachrichten nach dem Tracking-Nachweis versendet.' : 'Diese Nachrichten wurden lokal gespeichert.'}</p><div class="mail-list">${mails.length ? mails.map(m => `<details><summary>${icon('mail')}<span><b>${esc(m.subject)}</b><small>An: ${esc(m.recipient)} · ${date(m.created)}</small></span>${icon('chevron')}</summary><p>Status: ${esc(m.status)}</p>${m.last_error ? `<p>${esc(m.last_error)}</p>` : ''}<pre>${esc(m.body)}</pre>${m.order_id ? `<a href="/bestellung/${m.order_id}" class="underlined">Geschützte Bestellung öffnen ${icon('arrow')}</a>` : ''}</details>`).join('') : '<p>Noch keine Nachrichten.</p>'}</div>${state.mode === 'test' ? `<h2>Testfälle steuern</h2><div class="test-controls"><label>Beratung<select id="advisor-scenario"><option value="ok">Normal</option><option value="unavailable">Ausfall</option><option value="no-match">Keine passenden Stellen</option></select></label><label>Podbase<select id="podbase-scenario"><option value="ok">Normal</option><option value="reject">Auftrag ablehnen</option><option value="timeout">Antwort nach Annahme unterbrechen</option></select></label><button data-action="test-scenarios" class="button secondary">Testadapter einstellen</button></div><p class="fine-print">Diese Steuerung ist nur mit Jonas’ Administratorkonto verfügbar. Sie verändert ausschließlich lokale Simulationen.</p>` : '<h2>Bestellverarbeitung</h2><p>Unfreigegebene Aufträge werden im Podbase-Portal manuell geprüft und freigegeben.</p><button data-action="sync-orders" class="button secondary">Bestell- und Versandstatus jetzt abgleichen</button>'}</section>`;
}
const infoPages = {
  '/ueber-uns': ['Kleine Dinge. Tiefe Bedeutung.', `<p class="lead">Ein Vers für den Weg. Ein Stück Hoffnung für deinen Alltag.</p><p>Archenlicht entsteht aus einem einfachen Gedanken: Worte können uns begleiten. Auf dem Weg zur Arbeit, zwischen zwei Nachrichten oder mitten in einem neuen Anfang.</p><p>Unsere erste Kollektion „Ruhe und Geborgenheit“ verbindet sechs feine Illustrationen mit handschriftlichen Versstellen. Schlicht genug für jeden Tag. Persönlich genug, um etwas zu bedeuten.</p><h2>Für dich. Und für deine Herzensmenschen.</h2><p>Wähle ein fertiges Motiv oder gestalte deine Hülle mit einem eigenen Wunschvers und einer kurzen Widmung. Eine Geschenkkarte für deine handgeschriebenen Worte gehört immer dazu.</p><p>Archenlicht ist ein Angebot der Herzly Marketing GbR. Wir bereiten den Verkaufsstart vor; den aktuellen Bestellstatus siehst du an der Kasse.</p><a href="/kollektion" class="button primary">Die Kollektion entdecken ${icon('right')}</a>`],
  ...LEGAL_PAGES
};
function faqPage() {
  const questions = [ ['Welche Handymodelle gibt es?', 'Du findest iPhone-, Samsung-Galaxy- und Google-Pixel-Modelle. Die aktuelle Verfügbarkeit der gewählten Hülle wird vor der Zahlung mit dem Druckpartner geprüft. Nicht jede Variante ist für jedes Modell verfügbar.'], ['Was wird auf die Hülle gedruckt?', 'Bei einem fertigen Motiv: Illustration und handschriftliche Versstelle. Bei der personalisierten Hülle: dein ausgewählter Vers oder selbst eingegebener Text, das gewählte Motiv und optional deine Widmung. Die Hüllen tragen keinen Markenaufdruck.'], ['Kann ich meine Gestaltung noch ändern?', 'Ja. „Bearbeiten“ im Warenkorb öffnet deine Gestaltung und aktualisiert danach dieselbe Position. Vor der Zahlung siehst du Vorschau, exaktes Modell und den vollständigen Drucktext.'], ['Brauche ich ein Kundenkonto?', 'Nein. Eine Gastbestellung ist möglich. Dein persönlicher geschützter Statuslink steht in der Bestellbestätigung. Mit einem freiwilligen Konto siehst du deine eigenen Bestellungen und ihren Versandstatus.'], ['Kann ich einen eigenen Spruch oder Vers eingeben?', 'Ja. Wähle „Eigenen Text schreiben“ für deine eigenen Worte. Unter „Vers auswählen“ findest du vorgegebene Verse und Vorschläge zu deiner Situation. Im eigenen Textfeld kannst du auch nur eine Bibelstelle eingeben; wir ergänzen dort keinen Vers automatisch.'], ['Wie wird mein Text angepasst?', 'Die Vorschau passt Schriftgröße und Zeilenumbrüche an die vorgesehene Fläche an. Der Text bleibt gerade und vollständig sichtbar. Wenn er nicht mehr lesbar hineinpasst, bitten wir dich, ihn zu kürzen.'], ['Wie lang darf mein Text sein?', 'Du kannst bis zu 180 Zeichen eingeben. Wie viel lesbar auf deine Hülle passt, hängt von den Wörtern, dem Motiv und dem Modell ab. Die Vorschau prüft das vor dem Hinzufügen zum Warenkorb. Eine zusätzliche Widmung ist freiwillig.'], ['Kann ich die Hülle verschenken?', 'Ja. Zu jeder Bestellung gehört eine schlichte, einseitige Geschenkkarte im Format 10 × 15 cm zum Selbstbeschriften. Die Hülle kann direkt an eine Adresse in Deutschland geliefert werden.'], ['Kann ich hier schon wirklich kaufen?', state.checkoutEnabled === false ? 'Wir bereiten den Verkaufsstart vor. Du kannst Hüllen gestalten und im Warenkorb speichern; Bestellungen und Zahlungen sind noch nicht freigeschaltet.' : state.mode === 'live' ? 'Ja. Nach erfolgreicher Zahlung bestätigen wir deine Bestellung per E-Mail. Die Lieferzeit einschließlich Fertigung und Versand beträgt 5–10 Werktage (Montag bis Freitag, ausgenommen gesetzliche Feiertage).' : 'Dies ist ein Testshop. Die Zahlung und die Fertigung werden simuliert.'] ];
  return `<section class="section-wrap prose-page faq-page"><span class="eyebrow">GUT ZU WISSEN</span><h1>Ein paar Antworten für deinen Weg.</h1>${questions.map(([q, a]) => `<details><summary>${q}${icon('chevron')}</summary><p>${a}</p></details>`).join('')}</section>`;
}
function notFound(message = 'Diese Seite ist gerade nicht zu finden.') { return `<section class="empty-state section-wrap"><span class="eyebrow">EIN KLEINER UMWEG</span><h1>${esc(message)}</h1><a href="/" class="button primary">Zur Startseite ${icon('right')}</a></section>`; }
function startupError() { return `<section class="empty-state section-wrap"><span class="eyebrow">EIN KLEINER UMWEG</span><h1>Der Shop ist gerade nicht erreichbar.</h1><p>Bitte lade die Seite erneut oder versuche es später noch einmal.</p><a href="/" class="button primary" data-reload>Erneut versuchen ${icon('right')}</a></section>`; }
function captureCapability() { if (location.pathname.startsWith('/newsletter')) return; const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(location.hash); if (match) { caps.set(location.pathname.split('/').pop(), match[1]); history.replaceState(null, '', location.pathname + location.search); } }
const orderHeaders = id => caps.has(id) ? { Authorization: `Bearer ${caps.get(id)}` } : {};
async function refreshState() { const data = await api('/api/bootstrap'); state = data; header(); return data; }
async function render({ scroll = true } = {}) {
  modelPicker?.close();
  clearInterval(statusTimer); clearTimeout(previewTimer); ++previewSequence; previewPending = false;
  const sequence = ++routeSequence; captureCapability(); header(); footer();
  let html; const path = location.pathname;
  try {
    if (path === '/') html = home();
    else if (path === '/newsletter' || path === '/newsletter/bestaetigen' || path === '/newsletter/abmelden') html = newsletterUI.page();
    else if (path === '/kollektion') html = `<section class="section-wrap collection-intro"><span class="eyebrow">WORTE, DIE BLEIBEN</span><h1>Für das, was dich trägt.</h1><p>Entdecke unsere christlichen Handyhüllen. Ein leises Motiv, eine starke Zusage.<br>Oder <a href="/gestalten">gestalte deine Hülle mit Wunschvers ${icon('arrow')}</a>.</p></section>${collectionBlock(true)}`;
    else if (path.startsWith('/kollektion/')) {
      const d = state.designs.find(d => d.id === path.split('/')[2]);
      if (!d) html = notFound(); else {
        const edit = state.cart.find(i => i.id === new URLSearchParams(location.search).get('bearbeiten'));
        config = edit ? { ...edit.configuration } : { kind: 'fixed', magsafe: false, designId: d.id, modelId: 'iphone-15', backgroundId: 'white', dedication: '' }; currentPreview = null;
        html = fixedProduct(d); post('/api/events', { type: 'view', kind: config.kind, designId: d.id }).catch(() => {});
      }
    } else if (path === '/gestalten') {
      const query = new URLSearchParams(location.search), edit = state.cart.find(i => i.id === query.get('bearbeiten'));
      config = edit ? { ...edit.configuration } : { kind: 'custom', magsafe: false, designId: state.designs.some(d => d.id === query.get('motiv')) ? query.get('motiv') : 'unter-seinen-fluegeln', modelId: 'iphone-15', backgroundId: 'white', verseId: state.verses[0]?.id, dedication: '' };
      textChoice = createTextChoice(config, state.verses); config = applyTextChoice(config, textChoice);
      advisorResults = null; situation = ''; adviceOpen = false; advisorPending = false; currentStep = 0; currentPreview = null;
      html = customizer(); post('/api/events', { type: 'view', kind: 'custom', designId: config.designId }).catch(() => {});
    } else if (path === '/warenkorb') { await refreshState(); html = cartPage(); }
    else if (path === '/bundle') { await refreshState(); html = bundlePage(); }
    else if (path === '/kasse') { await refreshState(); html = checkoutPage(); }
    else if (path === '/konto') html = await accountPage();
    else if (path === '/admin' || path === '/admin/kunden') html = await adminCustomersPage(state, api);
    else if (path === '/admin/sicherheit') html = adminSecurityPage(state);
    else if (path === '/admin/widerrufe') {
      const entries = await api('/api/admin/withdrawals');
      html = `<section class="section-wrap prose-page"><a href="/auswertung">← Shop-Auswertung</a><h1>Eingegangene Widerrufe</h1><p>Die neuesten 100 Erklärungen. Bitte Zuordnung, Produktionsstatus und Rückabwicklung prüfen. Eine Eingangsbestätigung führt nicht automatisch zu einer Erstattung oder einem Produktionsstopp.</p>${entries.length ? entries.map(entry => `<details><summary>${date(entry.created)} · ${esc(entry.name)} · ${esc(entry.id)}</summary><pre class="withdrawal-receipt">${esc(entry.statement)}</pre><p>Eingang: ${esc(new Date(entry.created).toISOString())}</p><a href="mailto:${esc(entry.email)}">${esc(entry.email)}</a></details>`).join('') : '<p>Noch keine Widerrufe eingegangen.</p>'}</section>`;
    }
    else if (path === '/auswertung') html = await analyticsPage();
    else if (path.startsWith('/testzahlung/')) { const o = await api(`/api/orders/${path.split('/')[2]}`); html = o.paid ? orderPage(o) : await paymentPage(o); }
    else if (path.startsWith('/zahlungsrueckkehr/')) { const id = path.split('/')[2]; try { await post(`/api/orders/${id}/verify`); await refreshState(); } catch (e) { toast(e.message); } return navigate(`/bestellung/${id}`); }
    else if (path.startsWith('/bestellung/')) { const id = path.split('/')[2], o = await api(`/api/orders/${id}`, { headers: orderHeaders(id) }); html = orderPage(o); if ((o.status === 'awaiting_payment' || o.paid) && o.fulfillment?.state !== 'shipped' && !o.fulfillment?.error) statusTimer = setInterval(() => refreshOrder(id), 3500); }
    else if (path === '/vertrag-widerrufen') html = withdrawalPage();
    else if (path === '/faq') html = faqPage();
    else if (infoPages[path]) { const [title, content] = infoPages[path]; html = `<section class="section-wrap prose-page"><span class="eyebrow">ARCHENLICHT</span><h1>${title}</h1>${content}</section>`; }
    else html = notFound();
  } catch (e) { html = notFound(e.message); }
  if (sequence !== routeSequence) return;
  galleryCleanup?.();
  $('#inhalt').innerHTML = html;
  galleryCleanup = mountPreviewGallery($('.preview-gallery'));
  newsletterUI?.mount();
  mountWithdrawal(post);
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  document.title = `${path === '/' ? 'Ein Vers für deinen Alltag' : $('#inhalt h1')?.textContent || 'Shop'} | ${state.brand.name}`;
  if ((path === '/gestalten' || path.startsWith('/kollektion/')) && $('#live-phone')) updatePreview();
}
async function refreshOrder(id) {
  if (location.pathname !== `/bestellung/${id}`) return;
  try { const order = await api(`/api/orders/${id}`, { headers: orderHeaders(id) }); $('#inhalt').innerHTML = orderPage(order); if (order.paid && state.cart.length) await refreshState(); if (order.fulfillment?.state === 'shipped' || order.fulfillment?.error || order.status === 'cancelled') clearInterval(statusTimer); } catch { clearInterval(statusTimer); }
}
function navigate(href) { history.pushState(null, '', href); return render(); }
function rerenderWizard() {
  if ($('#verse-advice')) adviceOpen = $('#verse-advice').open;
  $('#wizard-content').innerHTML = wizardContent();
  $('.wizard-steps').innerHTML = ['Dein Text', 'Motiv', 'Modell', 'Widmung'].map((label, i) => `<button data-step="${i}" class="${currentStep === i ? 'active' : ''}" aria-current="${currentStep === i ? 'step' : 'false'}"><span>${i < currentStep ? icon('check') : i + 1}</span>${label}</button>`).join('');
  $('.wizard-navigation').innerHTML = `${currentStep ? `<button class="text-button" data-action="previous-step">${icon('back')} Zurück</button>` : '<span></span>'}${currentStep < 3 ? `<button class="button primary" data-action="next-step">Weiter ${icon('right')}</button>` : `<button class="button primary" id="add-cart" data-action="add-cart">${new URLSearchParams(location.search).has('bearbeiten') ? 'Änderung speichern' : 'In den Warenkorb'} ${icon('bag')}</button>`}`;
  if ($('#add-cart')) $('#add-cart').disabled = previewPending || !currentPreview || !textIsReady() || !caseAvailable(state.variants.find(v => v.model_id === config.modelId && v.design_id === config.designId), config);
}

async function selectTextChoice(focusSelector) {
  clearTimeout(previewTimer); config = applyTextChoice(config, textChoice);
  currentPreview = null; previewPending = true; rerenderWizard();
  if ($('#print-download')) $('#print-download').hidden = true;
  if ($('#print-text')) $('#print-text').textContent = 'Vorschau wird erstellt …';
  if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
  await updatePreview();
}
document.addEventListener('click', async event => {
  const link = event.target.closest('a');
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !link.target && !link.hasAttribute('download')) {
    if (!state || link.hasAttribute('data-reload')) return;
    const url = new URL(link.href, location.origin);
    if (url.origin === location.origin && !url.pathname.startsWith('/prints/') && !url.pathname.startsWith('/fonts/')) { event.preventDefault(); if (url.hash && url.pathname === location.pathname) { $(url.hash)?.scrollIntoView({ behavior: 'smooth' }); return; } return navigate(url.pathname + url.search + url.hash); }
  }
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  try {
    if (['custom', 'suggested'].includes(button.dataset.textMode)) {
      textChoice.mode = button.dataset.textMode; await selectTextChoice(`[data-text-mode="${textChoice.mode}"]`);
    }
    if (button.dataset.verse && state.verses.some(v => v.id === button.dataset.verse)) {
      textChoice.verseId = button.dataset.verse; await selectTextChoice(`[data-verse="${textChoice.verseId}"]`);
    }
    if (button.dataset.step !== undefined) { currentStep = Number(button.dataset.step); rerenderWizard(); }
    if (button.dataset.design) { config.designId = button.dataset.design; post('/api/events', { type: 'view', kind: 'custom', designId: config.designId }).catch(() => {}); rerenderWizard(); await updatePreview(); }
    if (button.dataset.remove) { state.cart = await api(`/api/cart/${button.dataset.remove}`, { method: 'DELETE', body: {} }); header(); await render({ scroll: false }); }
    if (button.dataset.confirm) {
      button.disabled = true;
      const cardId = $('#local-card-choice')?.value;
      await post(`/api/orders/${button.dataset.confirm}/confirm`, { saveCard: Boolean($('#save-card')?.checked && !$('#save-card')?.disabled), ...(cardId && cardId !== 'new' ? { savedCardId: cardId } : {}) });
      await refreshState(); await navigate(`/bestellung/${button.dataset.confirm}`);
    }
    if (button.dataset.cancel) { await post(`/api/orders/${button.dataset.cancel}/cancel`); toast('Zahlung abgebrochen. Deine Hüllen bleiben im Warenkorb.'); await navigate('/warenkorb'); }
    if (button.dataset.purpose) { await api(`/api/orders/${button.dataset.order}/purpose`, { method: 'POST', body: { purpose: button.dataset.purpose }, headers: orderHeaders(button.dataset.order) }); $$('.purpose-box button').forEach(b => b.classList.toggle('selected', b === button)); toast('Danke für deine freiwillige Angabe.'); }
    if (button.dataset.background) {
      config.backgroundId = button.dataset.background;
      $$('[data-motif-background]').forEach(tile => { tile.style.background = caseColor(config.backgroundId).hex; });
      $$('[data-background]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.background === config.backgroundId)));
      $$('[data-color-name]').forEach(label => { label.textContent = caseColor(config.backgroundId).name; });
      await updatePreview();
    }
    const action = button.dataset.action;
    if (button.dataset.removeCard) {
      button.disabled = true;
      await api(`/api/account/payment-methods/${encodeURIComponent(button.dataset.removeCard)}`, { method: 'DELETE', body: {} });
      toast('Die gespeicherte Karte wurde entfernt.'); await render({ scroll: false });
    }
    if (action === 'remove-address') {
      button.disabled = true;
      state.account = await api('/api/account/address', { method: 'DELETE', body: {} });
      toast('Die gespeicherten Lieferdaten wurden entfernt.'); await render({ scroll: false });
    }
    if (action === 'use-last-address') {
      const orders = await api('/api/account/orders'), previous = orders.find(order => order.paid), form = $('#account-address-form');
      if (!previous || !form) throw new Error('Keine bezahlte Bestellung mit Lieferdaten gefunden.');
      for (const [name, value] of Object.entries(previous.recipient)) { const field = form.elements.namedItem(name); if (field) field.value = value; }
      toast('Bitte prüfe die Angaben und wähle „Lieferdaten speichern“.');
    }
    if (action === 'toggle-password') {
      const password = $('#auth-password');
      if (!password) return;
      const visible = password.type === 'password';
      password.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Verbergen' : 'Anzeigen';
      button.setAttribute('aria-label', visible ? 'Passwort verbergen' : 'Passwort anzeigen');
      button.setAttribute('aria-pressed', String(visible));
    }
    if (action === 'menu') { const open = $('#header').classList.toggle('menu-open'); button.setAttribute('aria-expanded', open); button.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen'); }
    if (action === 'next-step' || action === 'previous-step') {
      if (action === 'next-step' && currentStep === 0 && (!textIsReady() || previewPending || !currentPreview)) { ($('#custom-text') || $('#verse'))?.focus(); throw new Error($('#preview-error')?.textContent || 'Bitte wähle zuerst einen Text und warte auf die Vorschau.'); }
      currentStep += action === 'next-step' ? 1 : -1; rerenderWizard();
    }
    if (action === 'add-cart') {
      if (previewPending || !currentPreview) return;
      button.disabled = true; const id = new URLSearchParams(location.search).get('bearbeiten');
      state.cart = await api(`/api/cart${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: { ...currentPreview.configuration, quantity: state.cart.find(i => i.id === id)?.quantity || 1 } });
      toast(id ? 'Deine Gestaltung wurde aktualisiert.' : 'Dein kleiner Begleiter liegt im Warenkorb.'); await navigate('/warenkorb');
    }
    if (action === 'toggle-register') { registerMode = !registerMode; await render({ scroll: false }); }
    if (action === 'logout') { state = await post('/api/auth/logout'); await navigate('/konto'); }
    if (action === 'sync-orders') { await post('/api/admin/jobs'); toast('Bestellstatus abgeglichen.'); await render({ scroll: false }); }
    if (action === 'test-scenarios') { await post('/api/admin/test', { advisor: $('#advisor-scenario').value, podbase: $('#podbase-scenario').value }); toast('Lokale Testadapter eingestellt.'); }
  } catch (e) { toast(e.message); if (button.isConnected) button.disabled = false; if ($('#payment-error')) $('#payment-error').textContent = e.message; }
});
document.addEventListener('change', async event => {
  const target = event.target;
  try {
    if (target.id === 'magsafe') { config.magsafe = target.checked; syncCaseSelection(); clearTimeout(previewTimer); await updatePreview(); }
    if (target.id === 'verse') { textChoice.verseId = target.value; await selectTextChoice('#verse'); }
    if (target.matches('input[name="method"]') && $('#card-saving-note')) $('#card-saving-note').hidden = target.value !== 'card';
    if (target.id === 'local-card-choice') {
      const isNew = target.value === 'new';
      $('#save-card-choice').hidden = !isNew; $('#save-card').disabled = !isNew; $('#save-card').checked = false;
    }
    if (target.dataset.quantity) { const i = state.cart.find(i => i.id === target.dataset.quantity); state.cart = await api(`/api/cart/${i.id}`, { method: 'PUT', body: { ...i.configuration, quantity: Number(target.value) } }); await render({ scroll: false }); }
  } catch (e) { toast(e.message); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'situation') situation = event.target.value;
  if (event.target.id === 'dedication') { config.dedication = event.target.value; ++previewSequence; $('#dedication-count').textContent = `${config.dedication.length}/32`; previewPending = true; if ($('#add-cart')) $('#add-cart').disabled = true; clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 250); }
  if (event.target.id === 'custom-text') {
    config.customText = event.target.value; textChoice.customText = config.customText; ++previewSequence;
    $('#custom-text-count').textContent = `${config.customText.length}/${MAX_CUSTOM_TEXT}`;
    currentPreview = null; previewPending = true; if ($('#add-cart')) $('#add-cart').disabled = true;
    if ($('#print-download')) $('#print-download').hidden = true;
    clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 250);
  }
});
document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, data = Object.fromEntries(new FormData(form)), button = $('button[type=submit],button:not([type])', form); if (button) button.disabled = true;
  try {
    if (form.id === 'advisor-form') {
      const activeChoice = textChoice; situation = data.situation; advisorPending = true;
      try {
        const result = await post('/api/advisor', { situation });
        if (activeChoice === textChoice) { advisorResults = result; if ($('#advisor-results')) $('#advisor-results').innerHTML = recommendationCards(); }
      } finally {
        if (activeChoice === textChoice) { advisorPending = false; const submit = $('#advisor-form button[type="submit"]'); if (submit) { submit.disabled = false; submit.innerHTML = `Verse vorschlagen ${icon('spark')}`; } }
      }
    }
    if (form.id === 'checkout-form') { const { method, saveAddress, newsletterCode, newsletterEntry, ...recipient } = data; const result = await post('/api/checkout', { recipient, method, newsletterCode, saveAddress: saveAddress === 'on' }); if (result.url.startsWith('/')) await navigate(result.url); else location.assign(result.url); }
    if (form.id === 'account-address-form') { state.account = await api('/api/account/address', { method: 'PUT', body: { recipient: data } }); toast('Deine Lieferdaten wurden gespeichert.'); await render({ scroll: false }); }
    if (form.id === 'auth-form') { state = await post(`/api/auth/${registerMode ? 'register' : 'login'}`, data); const next = new URLSearchParams(location.search).get('weiter'); await navigate(next === 'kasse' ? '/kasse' : state.user?.role === 'admin' ? '/admin/kunden' : '/konto'); }
    if (form.id === 'admin-customer-search') await navigate(`/admin/kunden?${new URLSearchParams(data)}`);
    if (form.id === 'admin-password-form') {
      if (data.newPassword !== data.passwordConfirmation) throw new Error('Die neuen Passwörter stimmen nicht überein.');
      state = await post('/api/account/password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast('Dein Passwort wurde geändert. Andere Sitzungen sind abgemeldet.'); await render({ scroll: false });
    }
    if (form.id === 'feedback-form') { await post('/api/feedback', data); toast('Danke. Dein Feedback hilft uns weiter.'); form.innerHTML = '<p>Danke für dein freiwilliges Feedback.</p>'; }
    if (form.id === 'range-form') { if (data.von > data.bis) throw new Error('Das Enddatum muss nach dem Startdatum liegen.'); await navigate(`/auswertung?${new URLSearchParams(data)}`); }
  } catch (e) { const output = $('.form-error', form); if (output) output.textContent = e.message; else toast(e.message); }
  finally { if (button?.isConnected) button.disabled = false; }
});
window.addEventListener('popstate', () => render());
async function start() {
  try {
    const query = new URLSearchParams(location.search), raw = query.get('utm_source') || query.get('quelle'), source = raw === 'tiktok' ? 'tiktok' : ['gemeinde', 'gemeinde-qr'].includes(raw) ? 'gemeinde' : raw ? 'sonstige' : 'unbekannt';
    const campaign = query.get('utm_campaign') || query.get('gemeinde') || '';
    state = await api(`/api/bootstrap?source=${source}&campaign=${encodeURIComponent(campaign)}`);
    modelPicker = createModelPicker({ getState: () => state, getConfiguration: () => config, onSelect: async id => { config.modelId = id; modelPicker.sync(); syncCaseSelection(); await updatePreview(); }, onError: error => toast(error.message) });
    newsletterUI = createNewsletterUI({ post });
    await render();
  } catch { $('#inhalt').innerHTML = startupError(); }
}
start();
