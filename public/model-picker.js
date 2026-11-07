const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const brands = [{ id: 'Apple', name: 'Apple', family: 'iPhone' }, { id: 'Samsung', name: 'Samsung', family: 'Galaxy' }, { id: 'Google', name: 'Google', family: 'Pixel' }];
const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('+', ' plus ').replace(/[^a-z0-9]+/g, ' ').trim();
const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const device = brand => `<svg class="model-device" viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="5" y="2" width="22" height="44" rx="5"/>${brand === 'Google' ? '<rect x="7.5" y="9" width="17" height="5" rx="2.5"/>' : '<rect x="8" y="6" width="8" height="9" rx="2"/>'}<path d="M13 41h6"/></svg>`;

function modelOrder(model) {
  const family = model.brand === 'Samsung' ? model.name.includes('Galaxy S') ? 0 : model.name.includes('Galaxy Z') ? 1 : 2 : 0;
  const galaxyA = model.name.match(/Galaxy A(\d)(\d)$/);
  const generation = galaxyA ? Number(galaxyA[2]) : Number(model.name.match(/\d+/)?.[0]) || (model.name === 'iPhone Air' ? 17 : 0);
  const edition = galaxyA ? -Number(galaxyA[1]) : /Pro Max|Ultra|Pro XL/.test(model.name) ? 0 : /Pro/.test(model.name) ? 1 : /Plus/.test(model.name) ? 2 : /FE|Edge|\d[a-z]$/i.test(model.name) ? 4 : 3;
  return [family, -generation, edition];
}
export function filterModels(models, { brand, query = '' } = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return models.filter(model => {
    if (!words.length) return !brand || model.brand === brand;
    const parts = normalize(`${model.brand} ${model.name}`).split(' '), searchable = parts.join('');
    return words.every(word => word.length === 1 ? parts.some(part => part.startsWith(word)) : searchable.includes(word));
  }).sort((a, b) => {
    if (a.brand !== b.brand) return brands.findIndex(x => x.id === a.brand) - brands.findIndex(x => x.id === b.brand);
    const aa = modelOrder(a), bb = modelOrder(b);
    for (let n = 0; n < aa.length; n++) if (aa[n] !== bb[n]) return aa[n] - bb[n];
    return a.name.localeCompare(b.name, 'de', { numeric: true });
  });
}
export function modelAvailable(variants, modelId, designId, mode = 'test') {
  const variant = variants.find(v => v.model_id === modelId && v.design_id === designId);
  return Boolean(variant?.available && variant.print_approved && variant.approval_mode === mode);
}
export function modelTriggerContent(model) {
  return `${device(model?.brand)}<span class="model-trigger-copy"><small>DEIN HANDYMODELL</small><strong>${esc(model?.name || 'Modell auswählen')}</strong></span><span class="model-trigger-change">Ändern <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span>`;
}
export function modelTrigger(models, selected) {
  const model = models.find(m => m.id === selected);
  return `<button type="button" class="model-trigger" data-model-picker aria-haspopup="dialog" aria-controls="phone-model-picker" aria-label="Handymodell ändern, derzeit ${esc(model?.name || 'kein Modell')}">${modelTriggerContent(model)}</button>`;
}
function cards(models, selected, variants, designId, mode) {
  return models.map(model => {
    const available = modelAvailable(variants, model.id, designId, mode), chosen = model.id === selected;
    return `<button type="button" class="model-option ${chosen ? 'is-selected' : ''}" data-pick-model="${esc(model.id)}" aria-pressed="${chosen}" ${available ? '' : 'disabled'}>${device(model.brand)}<span><small>${esc(model.brand)}</small><strong>${esc(model.name.replace(/^Samsung Galaxy |^Google /, ''))}</strong>${available ? '' : '<em>Zurzeit nicht verfügbar</em>'}</span><span class="model-option-check">${chosen ? check : ''}</span></button>`;
  }).join('');
}

export function createModelPicker({ getState, getConfiguration, onSelect, onError }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'phone-model-picker'; dialog.className = 'model-picker';
  dialog.setAttribute('aria-labelledby', 'model-picker-title'); dialog.setAttribute('aria-describedby', 'model-picker-description');
  dialog.innerHTML = `<div class="model-picker-surface"><div class="model-picker-header"><div><span class="eyebrow">DIE RICHTIGE PASSFORM</span><h2 id="model-picker-title" tabindex="-1">Welches Handy begleitet dich?</h2><p id="model-picker-description">Wähle deine Marke und dein genaues Modell.</p></div><button type="button" class="model-picker-close" data-picker-close aria-label="Modellauswahl schließen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><div class="model-picker-tools"><div class="model-brands" role="group" aria-label="Handymarke"></div><label class="model-search" for="model-picker-search">${searchIcon}<input id="model-picker-search" type="search" placeholder="Modell suchen, z. B. iPhone 18 oder S26" aria-label="In allen Handymodellen suchen" autocomplete="off" spellcheck="false" maxlength="80"></label><div class="model-results-heading"><span id="model-results-count" role="status" aria-live="polite"></span><span>Neuere Modelle zuerst</span></div></div><div class="model-picker-scroll"><div class="model-options" role="group" aria-label="Handymodelle"></div></div><div class="model-picker-footer"><span class="model-selection-check">${check}</span><p class="model-picker-selected"></p><small>Exaktes Modell unter<br>Einstellungen → Geräteinfo prüfen.</small></div></div>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input'), list = dialog.querySelector('.model-options'), brandList = dialog.querySelector('.model-brands');
  let activeBrand, previousFocus;
  function paint() {
    const state = getState(), configuration = getConfiguration(); if (!configuration) return;
    const query = input.value.trim(), models = filterModels(state.models, { brand: activeBrand, query });
    brandList.innerHTML = brands.map(brand => `<button type="button" data-picker-brand="${brand.id}" aria-pressed="${!query && brand.id === activeBrand}"><strong>${brand.name}</strong><span>${brand.family} <i>·</i> ${state.models.filter(m => m.brand === brand.id).length}</span></button>`).join('');
    list.innerHTML = models.length ? cards(models, configuration.modelId, state.variants, configuration.designId, state.mode) : `<div class="model-empty">${searchIcon}<h3>Dein Modell ist noch nicht dabei.</h3><p>Versuche einen kürzeren Namen oder wähle eine Marke.</p><button type="button" class="text-button" data-clear-model-search>Suche zurücksetzen</button></div>`;
    dialog.querySelector('#model-results-count').textContent = `${models.length} ${models.length === 1 ? 'Modell' : 'Modelle'}${query ? ' · alle Marken' : ` · ${activeBrand}`}`;
    const selected = state.models.find(m => m.id === configuration.modelId);
    dialog.querySelector('.model-picker-selected').textContent = `Aktuell ausgewählt: ${selected?.name || 'kein Modell'}`;
  }
  function close() { if (dialog.open) dialog.close(); }
  function sync() {
    const state = getState(), configuration = getConfiguration(); if (!configuration) return;
    const model = state.models.find(m => m.id === configuration.modelId);
    for (const trigger of document.querySelectorAll('[data-model-picker]')) {
      trigger.innerHTML = modelTriggerContent(model);
      trigger.setAttribute('aria-label', `Handymodell ändern, derzeit ${model?.name || 'kein Modell'}`);
    }
  }
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (event.target === dialog || button?.hasAttribute('data-picker-close')) return close();
    if (!button || button.disabled) return;
    if (button.dataset.pickerBrand) { activeBrand = button.dataset.pickerBrand; input.value = ''; paint(); brandList.querySelector(`[data-picker-brand="${activeBrand}"]`)?.focus(); dialog.querySelector('.model-picker-scroll').scrollTop = 0; }
    if (button.hasAttribute('data-clear-model-search')) { input.value = ''; paint(); input.focus(); }
    if (button.dataset.pickModel) {
      const state = getState(), configuration = getConfiguration(), model = state.models.find(m => m.id === button.dataset.pickModel);
      if (!model || !modelAvailable(state.variants, model.id, configuration.designId, state.mode)) return;
      close();
      try { await onSelect(model.id); sync(); } catch (error) { onError?.(error); }
    }
  });
  input.addEventListener('input', () => { paint(); dialog.querySelector('.model-picker-scroll').scrollTop = 0; });
  // Prevent Enter in the search field from submitting an unrelated shop form.
  input.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
  dialog.addEventListener('close', () => { document.body.classList.remove('choosing-model'); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-model-picker]'); if (!trigger || dialog.open || !getConfiguration()) return;
    previousFocus = trigger; input.value = ''; activeBrand = getState().models.find(m => m.id === getConfiguration().modelId)?.brand || 'Apple';
    paint(); dialog.querySelector('.model-picker-scroll').scrollTop = 0;
    dialog.showModal(); document.body.classList.add('choosing-model'); dialog.querySelector('#model-picker-title').focus({ preventScroll: true });
  });
  return { close, sync };
}
