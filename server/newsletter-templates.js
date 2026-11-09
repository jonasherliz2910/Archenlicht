import { MAIL_IDENTITY } from './mail-templates.js';
import { NEWSLETTER_TERMS } from '../public/newsletter-policy.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function newsletterEmail({ subscriber, kind, base, confirmToken, unsubscribeToken }) {
  const confirm = kind === 'newsletter-confirm', actionUrl = `${base}/newsletter/${confirm ? 'bestaetigen' : 'abmelden'}#token=${confirm ? confirmToken : unsubscribeToken}`;
  const subject = confirm ? 'Archenlicht – Bitte bestätige deine Newsletter-Anmeldung' : 'Willkommen bei Archenlicht – dein persönlicher 5-%-Code';
  const heading = confirm ? 'Ein kleiner Schritt fehlt noch.' : 'Schön, dass du dabei bist.';
  const intro = confirm ? 'Für diese E-Mail-Adresse wurde der kostenlose Archenlicht-Newsletter angefragt. Bitte bestätige die Anmeldung nur, wenn du sie selbst vorgenommen hast. Der Link ist 48 Stunden gültig. Ohne Bestätigung wirst du nicht angemeldet. Wenn du die Anmeldung nicht angefragt hast, ignoriere diese Nachricht.' : `Hallo ${subscriber.first_name}, deine Newsletter-Anmeldung ist bestätigt. Hier ist dein persönlicher Willkommenscode:`;
  const action = confirm ? 'Newsletter-Anmeldung bestätigen' : 'Vom Newsletter abmelden';
  const instructions = 'Trage den Code an der Kasse unter „Newsletter-Rabatt“ ein und verwende dieselbe E-Mail-Adresse wie bei deiner Newsletter-Anmeldung.';
  const footer = `Archenlicht · ${MAIL_IDENTITY.operator}\nVertreten durch ${MAIL_IDENTITY.representatives}\n${MAIL_IDENTITY.address}\n${MAIL_IDENTITY.replyTo}`;
  const text = [heading, intro, ...(!confirm ? [subscriber.code, instructions, NEWSLETTER_TERMS] : []), `${action}: ${actionUrl}`, `Datenschutz: ${base}/datenschutz`, footer].join('\n\n');
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px 12px;background:#f8f5ec;color:#163e29;font-family:Arial,sans-serif;line-height:1.6"><div style="max-width:560px;margin:auto;padding:28px;background:#fffdf8;border:1px solid #dce2d8;border-radius:12px"><p style="font:30px Georgia,serif">Archenlicht</p><h1 style="font:28px Georgia,serif">${heading}</h1><p>${esc(intro)}</p>${!confirm ? `<p style="padding:18px;background:#e9eee5;font-size:22px;letter-spacing:2px;overflow-wrap:anywhere"><strong>${esc(subscriber.code)}</strong></p><p>${instructions}</p><p style="font-size:13px">${NEWSLETTER_TERMS}</p>` : ''}<p><a href="${esc(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#163e29;color:white;border-radius:4px">${action}</a></p><p style="font-size:12px;white-space:pre-line">${esc(footer)}<br><a href="${base}/datenschutz">Datenschutz</a> · <a href="${base}/impressum">Impressum</a></p></div></body></html>`;
  return { from: MAIL_IDENTITY.from, reply_to: MAIL_IDENTITY.replyTo, to: [subscriber.email], subject, html, text, ...(!confirm ? { headers: { 'List-Unsubscribe': `<${base}/api/newsletter/one-click?token=${unsubscribeToken}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}) };
}
