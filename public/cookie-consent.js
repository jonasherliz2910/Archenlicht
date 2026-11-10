import { CONSENT_COOKIE, CONSENT_VERSION, CONSENT_MAX_AGE, readConsent } from './cookie-policy.js';

// Independent of the shop bootstrap: visitors can choose even while the API loads.
const dialog = document.querySelector('#cookie-dialog');
const statistics = dialog.querySelector('[name=statistics]');
const details = dialog.querySelector('details');
let previousFocus;

function open() {
  if (dialog.open) return;
  previousFocus = document.activeElement;
  statistics.checked = readConsent(document.cookie)?.statistics === true;
  details.open = false;
  window.dispatchEvent(new Event('archenlicht:consent-open'));
  dialog.showModal();
  document.body.classList.add('cookie-dialog-open');
  dialog.querySelector('h2').focus({ preventScroll: true });
}

function choose(allowed) {
  const value = `${CONSENT_VERSION}.${allowed ? 'statistics' : 'necessary'}.${Date.now()}`;
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  dialog.close();
  document.body.classList.remove('cookie-dialog-open');
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  // Read back the cookie. If storage is blocked, no optional tracking is enabled.
  window.dispatchEvent(new CustomEvent('archenlicht:consent-change', { detail: readConsent(document.cookie) }));
}

dialog.querySelector('[data-cookie-accept]').addEventListener('click', () => choose(true));
dialog.querySelector('[data-cookie-necessary]').addEventListener('click', () => choose(false));
dialog.querySelector('[data-cookie-save]').addEventListener('click', () => choose(statistics.checked));
dialog.addEventListener('cancel', event => { event.preventDefault(); choose(false); });
document.addEventListener('click', event => {
  if (event.target.closest('[data-cookie-settings]')) { event.preventDefault(); open(); }
});
// Legal information stays readable without having to make a choice first.
function showIfNeeded() {
  if (!readConsent(document.cookie) && !['/datenschutz', '/impressum'].includes(location.pathname)) open();
}
window.addEventListener('archenlicht:page-ready', showIfNeeded);
showIfNeeded();
