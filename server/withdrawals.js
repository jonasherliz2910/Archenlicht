import { randomUUID } from 'node:crypto';
import { ShopError } from './layout.js';
import { MAIL_IDENTITY } from './mail-templates.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class Withdrawals {
  constructor(shop) { this.shop = shop; this.s = shop.s; }
  async submit(input, session, address) {
    const name = String(input.name || '').trim(), email = String(input.email || '').trim().toLowerCase(), contract = String(input.contract || '').trim(), id = String(input.requestId || '');
    if (!/^[a-f0-9-]{36}$/.test(id) || input.confirm !== true) throw new ShopError('Bitte prüfe und bestätige deinen Widerruf.');
    if (!name || name.length > 120 || /[\x00-\x1f<>]/.test(name) || email.length > 180 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !contract || contract.length > 1500 || /[\x00-\x08\x0b\x0c\x0e-\x1f<>]/.test(contract)) throw new ShopError('Bitte gib deinen Namen, eine gültige E-Mail-Adresse und die Bestellung oder betroffenen Artikel an.');
    const statement = `Hiermit widerrufe ich den Vertrag bzw. den folgenden Teil des Vertrags:\n${contract}\n\nName: ${name}\nE-Mail für die Eingangsbestätigung: ${email}`;
    const same = row => row && row.mode === this.shop.config.shopMode && row.statement === statement && row.session_id === session.id;
    const previous = await this.s.get('SELECT * FROM withdrawals WHERE id=?', id);
    if (previous) {
      if (!same(previous)) throw new ShopError('Diese Anfragekennung wurde bereits verwendet. Bitte lade die Seite neu.', 409);
      await this.shop.mailer.safeFlush({ withdrawalsOnly: true });
      return this.receipt(previous);
    }
    await this.shop.newsletter.limit(`withdrawal:ip:${address}`, 20, 3600000);
    await this.shop.newsletter.limit(`withdrawal:email:${email}`, 6, 3600000);
    let row;
    await this.s.tx(async () => {
      row = await this.s.get('SELECT * FROM withdrawals WHERE id=?', id);
      if (row) { if (!same(row)) throw new ShopError('Diese Anfragekennung wurde bereits verwendet.', 409); return; }
      row = { id, session_id: session.id, mode: this.shop.config.shopMode, name, email, contract, statement, created: Date.now() };
      await this.s.run('INSERT INTO withdrawals(id,session_id,mode,name,email,contract,statement,created) VALUES(?,?,?,?,?,?,?,?)', id, session.id, row.mode, name, email, contract, statement, row.created);
      const receipt = this.receipt(row), test = row.mode === 'test';
      for (const admin of [false, true]) {
        const to = admin ? MAIL_IDENTITY.replyTo : email;
        const kind = admin ? 'withdrawal-notification' : 'withdrawal-receipt';
        const subject = `${test ? '[TEST] ' : ''}Archenlicht – ${admin ? 'Widerruf eingegangen' : 'Eingangsbestätigung deines Widerrufs'} ${id}`;
        const text = `${test ? 'TEST – keine echte Vertragserklärung.\n\n' : ''}${receipt.text}\n\n${admin ? 'Bitte Zuordnung, Produktionsstatus und gesetzliche Rückabwicklung prüfen. Es wurde keine automatische Erstattung oder Produktionsfreigabe ausgelöst.' : 'Dies bestätigt den Eingang deiner Erklärung. Wir bearbeiten deinen Widerruf und melden uns zu den weiteren Schritten. Bei Fragen antworte auf diese E-Mail.'}\n\nArchenlicht · ${MAIL_IDENTITY.operator}\n${MAIL_IDENTITY.address}\n${MAIL_IDENTITY.replyTo}`;
        const payload = { from: MAIL_IDENTITY.from, reply_to: MAIL_IDENTITY.replyTo, to: [to], subject, text, html: `<html lang="de"><body><h1>${admin ? 'Widerruf eingegangen' : 'Eingangsbestätigung'}</h1><div style="white-space:pre-wrap">${escape(text)}</div></body></html>` };
        const mailId = randomUUID(), enabled = this.shop.mailer.enabled;
        await this.s.run('INSERT INTO mail_outbox VALUES(?,NULL,?,?,?,?,?,?)', mailId, kind, to, subject, text, enabled ? 'queued' : 'local-delivered', row.created);
        await this.s.run('INSERT INTO withdrawal_mail VALUES(?,?)', mailId, id);
        if (enabled) await this.s.run("INSERT INTO mail_deliveries(mail_id,state,payload,created) VALUES(?,'queued',?,?)", mailId, JSON.stringify(payload), row.created);
      }
    });
    await this.shop.mailer.safeFlush({ withdrawalsOnly: true });
    return this.receipt(row);
  }
  receipt(row) {
    const time = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'long', timeZone: 'Europe/Berlin' }).format(row.created);
    return { ok: true, id: row.id, receivedAt: new Date(row.created).toISOString(), text: `Eingangsbestätigung des Widerrufs\nVorgang: ${row.id}\nEingegangen am: ${time}\n\n${row.statement}` };
  }
}
