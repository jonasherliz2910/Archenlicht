import { MAIL_IDENTITY } from './mail-templates.js';
import { NEWSLETTER_TERMS } from '../public/newsletter-policy.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraph = text => `<p style="margin:0 0 20px">${esc(text)}</p>`;
const button = (url, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td bgcolor="#163e29" style="border-radius:4px;text-align:center"><a href="${esc(url)}" style="display:inline-block;padding:14px 22px;border:1px solid #163e29;border-radius:4px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">${esc(label)}</a></td></tr></table>`;

export function newsletterEmail({ subscriber, kind, base, confirmToken, unsubscribeToken }) {
  const confirm = kind === 'newsletter-confirm';
  const origin = base.replace(/\/$/, '');
  const confirmUrl = `${origin}/newsletter/bestaetigen#token=${confirmToken}`;
  const unsubscribeUrl = `${origin}/newsletter/abmelden#token=${unsubscribeToken}`;
  const collectionUrl = `${origin}/kollektion`;
  const subject = confirm ? 'Archenlicht – Bitte bestätige deine Newsletter-Anmeldung' : 'Willkommen bei Archenlicht – dein persönlicher 5-%-Code';
  const heading = confirm ? 'Ein kleiner Schritt fehlt noch.' : 'Schön, dass du dabei bist.';
  const preheader = confirm ? 'Bitte bestätige deine Anmeldung. Erst danach ist dein Newsletter-Abonnement aktiv.' : 'Deine Anmeldung ist bestätigt. Entdecke deinen persönlichen Willkommenscode und die Welt von Archenlicht.';
  const greeting = `Hallo ${subscriber.first_name},`;
  const confirmIntro = 'für diese E-Mail-Adresse wurde der kostenlose Archenlicht-Newsletter angefragt. Bitte bestätige die Anmeldung nur, wenn du sie selbst vorgenommen hast.';
  const confirmHelp = 'Öffne über den Button unsere Website und klicke dort auf „Anmeldung bestätigen“. Erst dann ist dein Abonnement aktiv. Deinen persönlichen 5-%-Rabattcode erhältst du anschließend in einer zweiten E-Mail.';
  const confirmNotice = 'Der Bestätigungslink ist 48 Stunden gültig. Wenn du dich nicht angemeldet hast, ignoriere diese Nachricht. Ohne deine Bestätigung wirst du nicht in den Newsletter aufgenommen.';
  const welcomeIntro = 'deine Newsletter-Anmeldung ist bestätigt. Willkommen bei Archenlicht! Schön, dass wir dich mit kleinen Lichtblicken für deinen Alltag begleiten dürfen.';
  const welcomeStory = 'Archenlicht verbindet christliche Motive und Bibelverse mit einem Begleiter, den du jeden Tag bei dir hast. Ob ein fertiges Design oder deine ganz persönliche Hülle mit Wunschtext: Wähle, was dir etwas bedeutet – für dich selbst oder als Geschenk für einen Menschen, der dir am Herzen liegt.';
  const giftIntro = 'Als Dankeschön für deine Anmeldung erhältst du einmalig 5 % auf nicht reduzierte Hüllen. Hier ist dein persönlicher Willkommenscode:';
  const instructions = [
    'Wähle deine Hülle und gestalte sie mit deinem gewünschten Motiv, Handymodell und Hintergrund.',
    'Trage den Code an der Kasse unter „Newsletter-Rabatt“ ein und verwende dieselbe E-Mail-Adresse wie bei deiner Newsletter-Anmeldung.',
    'Klicke auf „Code anwenden“. Prüfe vor dem Bezahlen, ob dein 5-%-Rabatt in der Bestellübersicht berücksichtigt ist.'
  ];
  const outlook = 'Mit unserem Newsletter erhältst du Neuigkeiten zu neuen Motiven und Produkten, kleine Impulse und Angebote von Archenlicht. Wir freuen uns, ein Stück deines Alltags begleiten zu dürfen.';
  const contact = 'Du hast eine Frage zu deiner Hülle oder deinem Code? Antworte einfach auf diese E-Mail – du erreichst uns unter info@archenlicht.de.';
  const signature = 'Viele Grüße\nDein Archenlicht-Team';
  const footer = `Archenlicht · ${MAIL_IDENTITY.operator}\nVertreten durch ${MAIL_IDENTITY.representatives}\n${MAIL_IDENTITY.address}\n${MAIL_IDENTITY.replyTo}`;
  const text = [
    'ARCHENLICHT', heading, greeting,
    ...(confirm ? [confirmIntro, confirmHelp, `Newsletter-Anmeldung bestätigen: ${confirmUrl}`, confirmNotice] : [
      welcomeIntro, welcomeStory, giftIntro, subscriber.code, 'So löst du deinen Code ein:',
      ...instructions.map((step, index) => `${index + 1}. ${step}`), NEWSLETTER_TERMS,
      `Deine Hülle entdecken: ${collectionUrl}`, 'Darauf kannst du dich freuen', outlook, contact
    ]),
    signature, footer,
    ...(!confirm ? ['Du erhältst diese E-Mail, weil du deine Newsletter-Anmeldung bestätigt hast. Du kannst dich jederzeit abmelden.', `Vom Newsletter abmelden: ${unsubscribeUrl}`] : []),
    `Datenschutz: ${origin}/datenschutz`, `Impressum: ${origin}/impressum`
  ].join('\n\n');
  const content = confirm
    ? `${paragraph(confirmIntro)}${paragraph(confirmHelp)}${button(confirmUrl, 'Newsletter-Anmeldung bestätigen')}<p style="margin:0;font-size:14px;color:#536451">${esc(confirmNotice)}</p>`
    : `${paragraph(welcomeIntro)}${paragraph(welcomeStory)}${paragraph(giftIntro)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;margin:24px 0;background:#e9eee5;border:1px solid #cad5c4;border-radius:8px"><tr><td style="padding:22px 16px;text-align:center"><p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;color:#536451">DEIN 5-%-WILLKOMMENSCODE</p><p style="margin:0;font-family:Consolas,monospace;font-size:16px;line-height:1.6;font-weight:bold;word-break:normal;overflow-wrap:anywhere">${esc(subscriber.code)}</p></td></tr></table>
      <h2 style="margin:28px 0 14px;font-family:Georgia,serif;font-size:23px;font-weight:normal">So löst du deinen Code ein</h2>
      <ol style="margin:0 0 20px;padding-left:22px">${instructions.map(step => `<li style="margin:0 0 12px;padding-left:4px">${esc(step)}</li>`).join('')}</ol>
      <p style="margin:0 0 22px;font-size:13px;color:#536451">${esc(NEWSLETTER_TERMS)}</p>
      ${button(collectionUrl, 'Deine Hülle entdecken')}
      <h2 style="margin:28px 0 14px;font-family:Georgia,serif;font-size:23px;font-weight:normal">Darauf kannst du dich freuen</h2>
      ${paragraph(outlook)}${paragraph(contact)}`;
  const footerLink = (path, label) => `<a href="${esc(path)}" style="display:inline-block;padding:6px 0;color:#536451;text-decoration:underline">${label}</a>`;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
    <body style="margin:0;padding:24px 12px;background:#f3f2ec;color:#163e29;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}</div>
    <!--[if mso]><table role="presentation" align="center" width="600"><tr><td><![endif]-->
    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#fffdf7;border:1px solid #dce2d8;border-radius:10px;table-layout:fixed">
      <tr><td align="center" style="padding:28px 24px 22px;border-bottom:1px solid #dce2d8"><img src="${esc(origin)}/assets/archenlicht-logo.png" width="240" height="120" alt="Archenlicht" style="display:block;width:240px;max-width:100%;height:auto;border:0;margin:0 auto"><p style="margin:12px 0 0;font-size:11px;letter-spacing:1.5px;color:#536451">EIN KLEINER BEGLEITER. EINE GROSSE ZUSAGE.</p></td></tr>
      <tr><td style="padding:28px 24px 32px;overflow-wrap:break-word"><h1 style="margin:0 0 26px;font-family:Georgia,serif;font-size:32px;line-height:1.2;font-weight:normal">${esc(heading)}</h1>${paragraph(greeting)}${content}<p style="margin:26px 0 0;white-space:pre-line">${esc(signature)}</p></td></tr>
      <tr><td style="padding:24px;border-top:1px solid #dce2d8;background:#f3f5ef;font-size:13px;line-height:1.8;color:#536451">
        <p style="margin:0 0 14px"><strong>Archenlicht</strong><br>${esc(MAIL_IDENTITY.operator)}<br>Vertreten durch ${esc(MAIL_IDENTITY.representatives)}<br>${esc(MAIL_IDENTITY.address)}<br><a href="mailto:${esc(MAIL_IDENTITY.replyTo)}" style="color:#536451;text-decoration:underline">${esc(MAIL_IDENTITY.replyTo)}</a></p>
        ${!confirm ? '<p style="margin:0 0 10px">Du erhältst diese E-Mail, weil du deine Newsletter-Anmeldung bestätigt hast. Du kannst dich jederzeit abmelden.</p>' : ''}
        <p style="margin:0">${!confirm ? `${footerLink(unsubscribeUrl, 'Newsletter abmelden')} &nbsp;·&nbsp; ` : ''}${footerLink(`${origin}/datenschutz`, 'Datenschutz')} &nbsp;·&nbsp; ${footerLink(`${origin}/impressum`, 'Impressum')}</p>
      </td></tr>
    </table><!--[if mso]></td></tr></table><![endif]--></body></html>`;
  return {
    from: MAIL_IDENTITY.from, reply_to: MAIL_IDENTITY.replyTo, to: [subscriber.email], subject, html, text,
    ...(!confirm ? { headers: {
      'List-Unsubscribe': `<${origin}/api/newsletter/one-click?token=${unsubscribeToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    } } : {})
  };
}
