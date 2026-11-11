import { FIXED_BUNDLES, fixedBundle } from './fixed-bundles.js';
import { priceBundleItems, summarizePricing } from './bundle-pricing.js';
import { casePrice, plannedCasePrice, caseAvailable } from './case-options.js';
import { priceMarkup, casePriceMarkup } from './price-display.js';
import { CASE_COLORS, caseColor } from './case-colors.js';
import { modelTrigger, createModelPicker } from './model-picker.js';
import { studioCardMarkup } from './studio-photography.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value / 100);
const price = (state, items, planned = false) => summarizePricing(priceBundleItems(items.map(item => ({ unitPrice: (planned ? plannedCasePrice : casePrice)(state.brand, item), quantity: 1 }))));
const example = (state, planned = false) => price(state, Array.from({ length: 3 }, () => ({ kind: 'fixed', magsafe: false })), planned);
const photo = bundle => `<img src="${bundle.image}" alt="${esc(bundle.title)}: alle drei Motivhüllen nebeneinander auf einem Tisch" width="1448" height="1086" decoding="async">`;
const note = '<p class="bundle-photo-note">Fotomontage mit Originalmotiven · Bildbeispiel: iPhone 14 Pro in Weiß.</p>';
const terms = '<p class="bundle-terms">Jedes Set enthält die drei gezeigten Motive, jeweils eine Hülle. Du wählst Modell, Farbe und MagSafe für jede Hülle einzeln. Ein Dreier-Set erhält 5 % Mengenrabatt; ab vier Hüllen in derselben Bestellung gelten 10 % auf alle Hüllen. Kein zusätzlicher Newsletter-Rabatt. Versand innerhalb Deutschlands inklusive, Lieferung an eine gemeinsame Adresse.</p>';

export function bundleCatalog(state) {
  const pricing = example(state), plannedPricing = example(state, true);
  return `<section class="section-wrap fixed-bundle-page"><header class="fixed-bundle-heading"><span class="eyebrow">DREI MOTIVE. EIN GUTES GEFÜHL.</span><h1>Hoffnung kommt<br>selten allein.</h1><p>Zwei liebevoll zusammengestellte Sets. Je drei Hüllen, die zusammenpassen – für dich oder zum Teilen.</p><span class="bundle-saving-pill">3 Hüllen · 5 % sparen</span></header><div class="fixed-bundle-grid">${FIXED_BUNDLES.map((bundle, index) => `<article class="fixed-bundle-card"><a class="bundle-photo-link" href="/bundle/${bundle.id}" aria-label="${esc(bundle.title)} ansehen">${photo(bundle)}<span class="bundle-set-number">SET 0${index + 1}</span></a><div class="fixed-bundle-copy"><p class="eyebrow">${esc(bundle.subtitle)}</p><h2><a href="/bundle/${bundle.id}">${esc(bundle.title)}</a></h2><ul class="bundle-motif-list">${bundle.designs.map(id => `<li>${esc(state.designs.find(d => d.id === id).title)}</li>`).join('')}</ul><div class="bundle-card-price"><div><small>Einzeln ${money(pricing.subtotal)}</small><span>${priceMarkup(pricing.total, { ...state.brand, from: true, plannedPrice: plannedPricing.total })}</span></div><span>Du sparst ${money(pricing.discount)}</span></div><p class="bundle-card-options">Handymodell, Farbe & MagSafe pro Hülle wählbar.</p><a class="button primary full" href="/bundle/${bundle.id}">Dieses Set entdecken <span aria-hidden="true">→</span></a></div></article>`).join('')}</div>${note}<div class="bundle-bottom-note"><strong>Lieber beide Sets?</strong><p>Mit allen sechs Hüllen erhältst du automatisch 10 % Mengenrabatt im Warenkorb.</p></div>${terms}</section>`;
}

export function createFixedBundleUI({ getState, post, onAdded }) {
  const drafts = new Map();
  let cleanup;
  function draftFor(bundle) {
    if (!drafts.has(bundle.id)) drafts.set(bundle.id, { requestId: crypto.randomUUID(), items: bundle.designs.map((designId, index) => ({ kind: 'fixed', designId, modelId: 'iphone-14-pro', backgroundId: bundle.backgrounds[index], magsafe: false, dedication: '' })) });
    return drafts.get(bundle.id);
  }
  function page(id) {
    const bundle = fixedBundle(id);
    if (!bundle) return '<section class="section-wrap empty-state"><h1>Dieses Bundle ist nicht verfügbar.</h1><a href="/bundle">Zu den beiden Sets</a></section>';
    draftFor(bundle);
    return `<section class="section-wrap fixed-bundle-page" data-fixed-bundle="${bundle.id}"><a href="/bundle" class="back-link">← Alle Bundles</a><div class="bundle-detail-heading"><figure>${photo(bundle)}${note}</figure><div><span class="eyebrow">DEIN FESTES DREIER-SET</span><h1>${esc(bundle.title)}</h1><p class="handwritten">${esc(bundle.subtitle)}</p><p>${esc(bundle.description)}</p><ul class="bundle-motif-list">${bundle.designs.map(id => `<li>${esc(getState().designs.find(d => d.id === id).title)}</li>`).join('')}</ul><span class="bundle-saving-pill">3 Hüllen · 5 % sparen</span><p class="bundle-detail-help">Die Motive stehen fest. Passe unten jede Hülle an das passende Handy an.</p><a href="#bundle-options" class="underlined">Deine drei Hüllen auswählen ↓</a></div></div><div id="bundle-options" class="bundle-options-heading"><span class="eyebrow">DREI HÜLLEN. JEDE FÜR DICH PASSEND.</span><h2>So wird es dein Set.</h2><p>Jede Hülle darf ein anderes Handymodell und eine andere Farbe haben.</p></div><div class="bundle-config-grid" data-bundle-items></div><div class="bundle-buy-bar"><div data-bundle-price aria-live="polite"></div><div class="bundle-buy-action"><p class="bundle-error" data-bundle-error role="status" aria-live="polite"></p><button type="button" class="button primary" data-add-fixed-bundle disabled>Alle 3 Hüllen in den Warenkorb <span aria-hidden="true">→</span></button><small>Versand in Deutschland inklusive</small></div></div>${terms}</section>`;
  }
  function mount() {
    cleanup?.(); cleanup = null;
    const root = document.querySelector('[data-fixed-bundle]'); if (!root) return;
    const bundle = fixedBundle(root.dataset.fixedBundle), draft = draftFor(bundle), state = getState();
    let active = 0, disposed = false, submitting = false;
    const status = draft.items.map(() => ({ revision: 0, ready: false, failed: false }));
    const variant = item => state.variants.find(v => v.design_id === item.designId && v.model_id === item.modelId);
    const available = item => caseAvailable(variant(item), item);
    const error = root.querySelector('[data-bundle-error]'), add = root.querySelector('[data-add-fixed-bundle]');
    function summary() {
      const p = price(state, draft.items), plannedPricing = price(state, draft.items, true);
      root.querySelector('[data-bundle-price]').innerHTML = `<span class="eyebrow">DEIN SET · 3 HÜLLEN</span><div class="bundle-total"><span data-fixed-bundle-total>${priceMarkup(p.total, { ...state.brand, plannedPrice: plannedPricing.total })}</span><span>statt ${money(p.subtotal)} einzeln</span></div><span class="bundle-discount">5 % gespart · ${money(p.discount)}</span>`;
      add.disabled = submitting || status.some(s => !s.ready || s.failed) || draft.items.some(item => !available(item));
      if (draft.items.some(item => !available(item))) error.textContent = 'Eine Hüllenvariante ist gerade nicht verfügbar. Bitte wähle ein verfügbares Modell oder eine andere Hüllenart.';
    }
    function row(index) {
      const item = draft.items[index], design = state.designs.find(d => d.id === item.designId), color = caseColor(item.backgroundId);
      return `<article class="bundle-config-item" data-bundle-slot="${index}"><span class="bundle-item-number">HÜLLE 0${index + 1}</span><h3>${esc(design.title)}</h3><p class="bundle-item-reference">${esc(design.reference)}</p><div class="bundle-item-preview" data-bundle-preview aria-busy="true"><p>Deine Vorschau wird geladen …</p></div><div class="bundle-item-fields">${modelTrigger(state.models, item.modelId, 'bundle-model-picker')}<fieldset class="bundle-color-choice"><legend>Hintergrund: <strong>${esc(color.name)}</strong></legend><div class="bundle-swatches">${CASE_COLORS.map(c => `<button type="button" data-bundle-color="${c.id}" style="--swatch:${c.hex}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${item.backgroundId === c.id}"></button>`).join('')}</div></fieldset><label class="bundle-magsafe"><input type="checkbox" data-bundle-magsafe ${item.magsafe ? 'checked' : ''} ${!variant(item)?.magsafe_available ? 'disabled' : ''}><span><strong>MagSafe-kompatibel</strong><small>+ ${money(state.brand.magsafeSurcharge)}</small></span></label>${!variant(item)?.magsafe_available ? '<p class="bundle-option-help">Für dieses Modell derzeit nicht verfügbar.</p>' : ''}<p class="bundle-unit-price">Einzelpreis: ${casePriceMarkup(state.brand, item)}</p></div></article>`;
    }
    async function preview(index) {
      const ticket = ++status[index].revision, item = { ...draft.items[index] };
      status[index].ready = false; status[index].failed = false; summary();
      try {
        const result = await post('/api/preview', item);
        if (disposed || status[index].revision !== ticket) return;
        const model = state.models.find(m => m.id === item.modelId), target = root.querySelector(`[data-bundle-slot="${index}"] [data-bundle-preview]`);
        target.innerHTML = studioCardMarkup({ designId:item.designId, model, imageUrl:result.svgUrl, backgroundId:item.backgroundId, hash:result.hash, label: `${state.designs.find(d => d.id === item.designId).title}, ${model.name}, ${caseColor(item.backgroundId).name}` });
        target.setAttribute('aria-busy', 'false'); target.dataset.printHash = result.hash;
        status[index].ready = true;
      } catch (e) {
        if (disposed || status[index].revision !== ticket) return;
        status[index].failed = true;
        const target = root.querySelector(`[data-bundle-slot="${index}"] [data-bundle-preview]`);
        target.replaceChildren(); const message = document.createElement('p'); message.textContent = e.message; target.append(message); target.setAttribute('aria-busy', 'false');
        error.textContent = 'Eine Vorschau konnte nicht erstellt werden. Bitte prüfe die markierte Hülle oder lade die Seite neu.';
      }
      if (!disposed) summary();
    }
    function changed(index, focus) {
      draft.requestId = crypto.randomUUID(); error.textContent = '';
      root.querySelector(`[data-bundle-slot="${index}"]`).outerHTML = row(index);
      if (focus) root.querySelector(`[data-bundle-slot="${index}"] ${focus}`)?.focus({ preventScroll: true });
      preview(index);
    }
    root.querySelector('[data-bundle-items]').innerHTML = draft.items.map((_, index) => row(index)).join('');
    const picker = createModelPicker({ id: 'bundle-model-picker', getState: () => ({ ...getState(), mode: getState().checkoutEnabled === false ? 'test' : getState().mode }), getConfiguration: () => draft.items[active], onOpen: trigger => { active = Number(trigger.closest('[data-bundle-slot]').dataset.bundleSlot); }, getTriggers: () => root.querySelectorAll(`[data-bundle-slot="${active}"] [data-model-picker]`), onSelect: id => {
      draft.items[active].modelId = id;
      const reset = draft.items[active].magsafe && !variant(draft.items[active])?.magsafe_available;
      if (reset) draft.items[active].magsafe = false;
      changed(active, '[data-model-picker]');
      if (reset) error.textContent = 'Für dieses Modell ist MagSafe nicht verfügbar. Diese Hülle ist jetzt als Standardhülle ausgewählt.';
    }, onError: e => { error.textContent = e.message; } });
    root.addEventListener('click', async event => {
      const button = event.target.closest('button'); if (!button || button.disabled || submitting) return;
      if (button.dataset.bundleColor) {
        const index = Number(button.closest('[data-bundle-slot]').dataset.bundleSlot);
        draft.items[index].backgroundId = button.dataset.bundleColor;
        changed(index, `[data-bundle-color="${button.dataset.bundleColor}"]`);
      }
      if (button.hasAttribute('data-add-fixed-bundle')) {
        submitting = true; error.textContent = ''; summary(); add.textContent = 'Dein Set wird hinzugefügt …';
        // Disable fields while the immutable request is in flight.
        root.querySelector('[data-bundle-items]').inert = true;
        try {
          const cart = await post('/api/cart/bundle', { bundleId: bundle.id, requestId: draft.requestId, items: draft.items });
          drafts.delete(bundle.id); if (!disposed) await onAdded(cart);
        } catch (e) { if (!disposed) error.textContent = e.message; }
        finally { submitting = false; if (!disposed) { root.querySelector('[data-bundle-items]').inert = false; add.textContent = 'Alle 3 Hüllen in den Warenkorb →'; summary(); } }
      }
    });
    root.addEventListener('change', event => {
      if (!event.target.matches('[data-bundle-magsafe]') || submitting) return;
      const index = Number(event.target.closest('[data-bundle-slot]').dataset.bundleSlot);
      draft.items[index].magsafe = event.target.checked; changed(index, '[data-bundle-magsafe]');
    });
    draft.items.forEach((_, index) => preview(index));
    cleanup = () => { disposed = true; picker.dispose(); };
  }
  return { page, mount };
}
