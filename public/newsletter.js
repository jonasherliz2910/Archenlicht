import { NEWSLETTER_CONSENT, NEWSLETTER_CONSENT_VERSION, NEWSLETTER_TERMS } from './newsletter-policy.js';
import { summarizePricing } from './bundle-pricing.js';
import { readConsent } from './cookie-policy.js';

const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value / 100);
const signup = () => `<span class="eyebrow">POST, DIE HOFFNUNG MACHT</span><h1 id="newsletter-title">Ein kleiner Lichtblick.<br>Und 5 % für dich.</h1><p>Entdecke neue Motive, kleine Impulse und Angebote von Archenlicht. Melde dich kostenlos an und bestätige deine Anmeldung anschließend per E-Mail. Erst danach erhältst du deinen persönlichen 5-%-Rabattcode.</p><form id="newsletter-form"><div class="newsletter-names"><label>Vorname<input name="firstName" autocomplete="given-name" maxlength="80" required></label><label>Nachname<input name="lastName" autocomplete="family-name" maxlength="80" required></label></div><label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" maxlength="180" required></label><div class="newsletter-honey" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="newsletter-consent"><input type="checkbox" name="consent" required><span>${NEWSLETTER_CONSENT} Mehr in unseren <a href="/datenschutz">Datenschutzhinweisen</a>.</span></label><p class="newsletter-terms">${NEWSLETTER_TERMS}</p><p class="newsletter-status" role="status" aria-live="polite"></p><button type="submit" class="button primary full">Kostenlos anmelden</button><p class="newsletter-help">Öffne danach unsere E-Mail und bestätige deine Anmeldung über den Link. Dein Code kommt anschließend in einer zweiten E-Mail.</p></form>`;

export function createNewsletterUI({ post }) {
  let timer, dialog, previousFocus, linkToken, linkPath, quoteSequence = 0;
  const seen = () => { try { return sessionStorage.getItem('archenlicht-newsletter-dismissed') === '1'; } catch { return true; } };
  const dismiss = () => { try { sessionStorage.setItem('archenlicht-newsletter-dismissed', '1'); } catch {} };
  function bindForm(root) {
    const form = root.querySelector('#newsletter-form'); if (!form) return;
    form.addEventListener('submit', async event => {
      event.preventDefault(); event.stopImmediatePropagation();
      const values = Object.fromEntries(new FormData(form)), button = form.querySelector('[type=submit]'), status = form.querySelector('[role=status]');
      button.disabled = true; status.textContent = 'Deine Anmeldung wird gespeichert …';
      try {
        const result = await post('/api/newsletter/subscribe', { ...values, consent: values.consent === 'on', consentVersion: NEWSLETTER_CONSENT_VERSION });
        dismiss(); form.replaceChildren(); const message = document.createElement('p'); message.className = 'newsletter-success'; message.setAttribute('role','status'); message.tabIndex = -1; message.textContent = result.message; form.append(message); message.focus();
      } catch (e) { status.textContent = e.message; button.disabled = false; }
    });
  }
  function close() { if (dialog?.open) { dismiss(); dialog.close(); } dialog?.remove(); dialog = null; }
  function show() {
    if (!readConsent(document.cookie) || !eligible() || seen() || document.querySelector('dialog[open]')) return;
    previousFocus = document.activeElement;
    dialog = document.createElement('dialog'); dialog.className = 'newsletter-dialog'; dialog.setAttribute('aria-labelledby','newsletter-title');
    dialog.innerHTML = `<button type="button" class="newsletter-close" aria-label="Newsletter-Fenster schließen">×</button><div class="newsletter-content">${signup()}</div><button type="button" class="text-button newsletter-later">Vielleicht später</button>`;
    document.body.append(dialog); bindForm(dialog);
    dialog.querySelector('.newsletter-close').onclick = close;
    dialog.querySelector('.newsletter-later').onclick = close;
    dialog.addEventListener('close', () => { dismiss(); document.body.classList.remove('newsletter-open'); previousFocus?.focus?.({ preventScroll: true }); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
    dialog.showModal(); document.body.classList.add('newsletter-open'); dialog.querySelector('.newsletter-close').focus({preventScroll:true});
  }
  function eligible() { return /^\/(?:kollektion(?:\/[a-z-]+)?|gestalten|bundle(?:\/[a-z-]+)?)?$/.test(location.pathname); }
  function page() {
    if (location.pathname === '/newsletter') return `<section class="section-wrap newsletter-page">${signup()}</section>`;
    const confirm = location.pathname === '/newsletter/bestaetigen';
    const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(location.hash);
    if (match) { linkToken = match[1]; linkPath = location.pathname; history.replaceState(null,'',location.pathname); }
    return `<section class="section-wrap newsletter-page"><span class="eyebrow">DEIN ARCHENLICHT-NEWSLETTER</span><h1>${confirm ? 'Deine Anmeldung bestätigen.' : 'Vom Newsletter abmelden.'}</h1><p>${confirm ? 'Mit einem Klick bestätigst du, dass du den kostenlosen Archenlicht-Newsletter erhalten möchtest.' : 'Du kannst dich jederzeit abmelden. Deinen bereits erhaltenen Rabattcode behältst du.'}</p><p class="newsletter-status" role="status"></p>${linkToken && linkPath === location.pathname ? `<button type="button" class="button primary" id="newsletter-link-action">${confirm ? 'Anmeldung bestätigen' : 'Jetzt abmelden'}</button>` : '<p>Bitte öffne den vollständigen Link aus deiner E-Mail.</p>'}<p><a href="/newsletter">Zur Newsletter-Anmeldung</a> · <a href="/kollektion">Zur Kollektion</a></p></section>`;
  }
  function mountCheckout() {
    const form = document.querySelector('#checkout-form'); if (!form) return;
    const entry = form.querySelector('[name=newsletterEntry]'), code = form.querySelector('[name=newsletterCode]'), email = form.querySelector('[name=email]');
    const apply = form.querySelector('#newsletter-apply'), remove = form.querySelector('#newsletter-remove'), status = form.querySelector('#newsletter-code-status');
    const row = document.querySelector('#newsletter-discount-row'), total = document.querySelector('[data-checkout-total]'), submit = form.querySelector('[type=submit]');
    if (!entry || !total) return;
    const originalButton = submit.innerHTML, originalTotal = total.textContent;
    function clear() { ++quoteSequence; code.value = ''; row.replaceChildren(); total.textContent = originalTotal; submit.innerHTML = originalButton; remove.hidden = true; status.textContent = ''; }
    entry.addEventListener('input', clear); email.addEventListener('input', clear); email.addEventListener('change', clear);
    remove.onclick = () => { clear(); entry.value = ''; status.textContent = 'Newsletter-Code entfernt.'; };
    apply.onclick = async () => {
      clear(); const sequence = ++quoteSequence; apply.disabled = true; status.textContent = 'Code wird geprüft …';
      try {
        const result = await post('/api/newsletter/quote', { code: entry.value, email: email.value });
        if (sequence !== quoteSequence || !form.isConnected) return;
        const pricing = summarizePricing(result.items); code.value = entry.value.trim();
        const label = document.createElement('span'), value = document.createElement('strong'); label.textContent = 'Newsletter-Rabatt (5 %)'; value.textContent = `−${money(pricing.discount)}`; row.append(label,value);
        total.textContent = money(pricing.total); submit.textContent = `Zur Testzahlung · ${money(pricing.total)} →`; remove.hidden = false; status.textContent = 'Dein persönlicher 5-%-Rabatt ist angewendet.';
      } catch (e) { if (sequence === quoteSequence) status.textContent = e.message; }
      finally { if (apply.isConnected) apply.disabled = false; }
    };
    form.addEventListener('submit', event => {
      if (entry.value.trim() && !code.value) { event.preventDefault(); event.stopImmediatePropagation(); status.textContent = 'Bitte wende den eingegebenen Code zuerst an oder entferne ihn.'; apply.focus(); }
    });
  }
  function mount() {
    clearTimeout(timer); close(); ++quoteSequence;
    bindForm(document); mountCheckout();
    const button = document.querySelector('#newsletter-link-action');
    if (button) button.onclick = async () => {
      button.disabled = true; const status = document.querySelector('.newsletter-page [role=status]');
      try { const result = await post(location.pathname.endsWith('bestaetigen') ? '/api/newsletter/confirm' : '/api/newsletter/unsubscribe', { token: linkToken }); status.textContent = result.message; button.remove(); dismiss(); }
      catch (e) { status.textContent = e.message; button.disabled = false; }
    };
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (readConsent(document.cookie) && eligible() && !seen() && !document.querySelector('#cookie-dialog[open]')) timer = setTimeout(show, 6000);
  }
  window.addEventListener('archenlicht:consent-change', schedule);
  window.addEventListener('archenlicht:consent-open', () => { clearTimeout(timer); close(); });
  return { page, mount };
}
