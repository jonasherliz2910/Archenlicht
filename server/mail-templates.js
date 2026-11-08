import {caseColor} from '../public/case-colors.js';
import {TAX_NOTICE} from './payments.js';

export const MAIL_IDENTITY = Object.freeze({
  from: 'Archenlicht <info@archenlicht.de>', replyTo: 'info@archenlicht.de',
  operator: 'Herzly Marketing GbR', representatives: 'Julian Isaak und Laura Herliz',
  address: 'Stettiner Straße 27, 36251 Bad Hersfeld'
});
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);

// Only test orders can enter the current mail adapter. These templates never
// claim a real charge, real manufacturing, or actual shipment in that mode.
export function orderEmail({order,kind,statusUrl,tracking,reason}) {
  if(order.mode!=='test') throw new Error('Diese Mailvorlagen sind noch nicht für Livebestellungen freigegeben.');
  if(!['confirmation','shipping','fulfillment-error'].includes(kind)) throw new Error('Unbekannte Bestellnachricht.');
  const recipient=JSON.parse(order.recipient),items=JSON.parse(order.items),admin=kind==='fulfillment-error';
  const heading=kind==='confirmation'?'Danke für deine Testbestellung.':kind==='shipping'?'Dein Test-Versandstatus.':'Eine Testbestellung braucht Aufmerksamkeit.';
  const subject=`[TEST] Archenlicht – ${kind==='confirmation'?'Bestellbestätigung':kind==='shipping'?'Simulierter Versand':'Handlungsbedarf'} ${order.number}`;
  const intro=kind==='confirmation'?'Die Testzahlung wurde bestätigt. Es wurde kein echtes Geld abgebucht.':kind==='shipping'?'Der Shop hat den Versandablauf simuliert. Es wurde keine echte Sendung verschickt.':`Die Testbestellung wurde bezahlt, ihre Verarbeitung ist noch offen. ${reason||'Bitte den Auftrag im geschützten Bereich prüfen.'}`;
  const lines=items.map(i=>`${i.quantity} × ${i.title}\n${i.model} · ${caseColor(i.configuration?.backgroundId)?.name||'Weiß'}\nDrucktext: ${i.printText}\n${money(i.unitPrice*i.quantity)}`);
  const table=items.map(i=>`<tr><td style="padding:18px 0;border-bottom:1px solid #dce2d8"><strong>${escape(i.quantity)} × ${escape(i.title)}</strong><br><span>${escape(i.model)} · ${escape(caseColor(i.configuration?.backgroundId)?.name||'Weiß')}</span><br><span style="white-space:pre-line">${escape(i.printText)}</span></td><td style="padding:18px 0;border-bottom:1px solid #dce2d8;text-align:right;vertical-align:top;white-space:nowrap">${escape(money(i.unitPrice*i.quantity))}</td></tr>`).join('');
  const address=`${recipient.name}\n${recipient.street}\n${recipient.postalCode} ${recipient.city}\nDeutschland`;
  const footer=`Archenlicht · ${MAIL_IDENTITY.operator}\nVertreten durch ${MAIL_IDENTITY.representatives}\n${MAIL_IDENTITY.address}\n${MAIL_IDENTITY.replyTo}`;
  const trackingText=kind==='shipping'?`Simulierte Sendungsnummer: ${tracking||'Noch nicht vorhanden'}`:'';
  const text=[heading,'TESTBETRIEB – keine echte Zahlung, Produktion oder Lieferung.',`Bestellnummer: ${order.number}`,intro,...lines,`Gesamt: ${money(order.amount)}`,TAX_NOTICE,'Deutschlandversand und Kartenbeilage sind im Testpreis enthalten.',`Lieferdaten der Testbestellung:\n${address}`,trackingText,`${admin?'Geschützter Auftragslink (Admin-Anmeldung)':'Deine Bestellung ansehen'}: ${statusUrl}`,'Bei Fragen antworte einfach auf diese E-Mail.',footer].filter(Boolean).join('\n\n');
  const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;padding:24px 12px;background:#f5f4ef;color:#163e29;font-family:Arial,sans-serif;font-size:16px;line-height:1.6"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:#fffdf7;border:1px solid #dce2d8;border-radius:12px"><tr><td style="padding:28px"><div style="font-family:Georgia,serif;font-size:30px">Archenlicht</div><p style="font-size:12px;letter-spacing:1px;color:#63775f">EIN KLEINER BEGLEITER. EINE GROSSE ZUSAGE.</p><p style="padding:12px;background:#e9eee5;font-size:14px"><strong>Testbetrieb</strong><br>Keine echte Zahlung, Produktion oder Lieferung.</p><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:normal;line-height:1.3">${escape(heading)}</h1><p>Bestellnummer: <strong>${escape(order.number)}</strong></p><p>${escape(intro)}</p><table style="width:100%;border-collapse:collapse;font-size:14px">${table}</table><p style="font-size:20px"><strong>Gesamt: ${escape(money(order.amount))}</strong></p><p style="font-size:13px">${escape(TAX_NOTICE)}<br>Deutschlandversand und Kartenbeilage sind im Testpreis enthalten.</p><h2 style="font-size:17px">Lieferdaten der Testbestellung</h2><p style="white-space:pre-line">${escape(address)}</p>${trackingText?`<p>${escape(trackingText)}</p>`:''}<p style="margin:28px 0"><a href="${escape(statusUrl)}" style="display:inline-block;padding:13px 20px;background:#163e29;color:#fff;text-decoration:none;border-radius:4px">${admin?'Auftrag prüfen':'Bestellung ansehen'}</a></p><p>Bei Fragen antworte einfach auf diese E-Mail.</p><hr style="border:0;border-top:1px solid #dce2d8"><p style="font-size:12px;color:#536451">Archenlicht · ${escape(MAIL_IDENTITY.operator)}<br>Vertreten durch ${escape(MAIL_IDENTITY.representatives)}<br>${escape(MAIL_IDENTITY.address)}<br><a href="mailto:${MAIL_IDENTITY.replyTo}" style="color:#163e29">${MAIL_IDENTITY.replyTo}</a></p></td></tr></table></body></html>`;
  return {from:MAIL_IDENTITY.from,reply_to:MAIL_IDENTITY.replyTo,to:[admin?MAIL_IDENTITY.replyTo:recipient.email],subject,html,text};
}
