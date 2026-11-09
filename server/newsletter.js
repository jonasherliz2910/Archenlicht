import { randomUUID, randomBytes } from 'node:crypto';
import { token, digest } from './store.js';
import { ShopError } from './layout.js';
import { newsletterEmail } from './newsletter-templates.js';
import { NEWSLETTER_CONSENT, NEWSLETTER_CONSENT_VERSION } from '../public/newsletter-policy.js';
import { priceNewsletterItems } from '../public/bundle-pricing.js';

const HOUR = 3600000, DAY = 24 * HOUR;
const accepted = { ok: true, message: 'Wenn eine Bestätigung erforderlich ist, erhältst du eine E-Mail. Bitte prüfe auch deinen Spamordner. Bereits bestätigte Anmeldungen erhalten keinen weiteren Willkommenscode.' };
export class Newsletter {
  constructor(config, store, mailer) { this.config = config; this.s = store; this.mailer = mailer; }
  async limit(key, max, duration) {
    const now = Date.now(), id = digest(`newsletter:${key}`);
    await this.s.run('INSERT INTO newsletter_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN newsletter_limits.expires<=? THEN 1 ELSE newsletter_limits.attempts+1 END,expires=CASE WHEN newsletter_limits.expires<=? THEN excluded.expires ELSE newsletter_limits.expires END', id, now + duration, now, now);
    if ((await this.s.get('SELECT attempts FROM newsletter_limits WHERE id=?', id)).attempts > max) throw new ShopError('Zu viele Versuche. Bitte probiere es später erneut.', 429);
  }
  async subscribe(input, session, address) {
    if (input.website) return accepted; // Invisible honeypot, never disclose its purpose to bots.
    const first = String(input.firstName || '').trim(), last = String(input.lastName || '').trim(), email = String(input.email || '').trim().toLowerCase();
    if (![first, last].every(n => n.length > 0 && n.length <= 80 && !/[\x00-\x1f<>]/.test(n)) || email.length > 180 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new ShopError('Bitte gib deinen Vor- und Nachnamen und eine gültige E-Mail-Adresse ein.');
    if (input.consent !== true || input.consentVersion !== NEWSLETTER_CONSENT_VERSION) throw new ShopError('Bitte bestätige die Newsletter-Einwilligung. Lade die Seite bei Bedarf neu.');
    // These counters survive function restarts and newly created browser sessions.
    await this.limit(`ip:${address}`, 5, HOUR); await this.limit(`session:${session.id}`, 3, HOUR); await this.limit('daily-total', 200, DAY);
    await this.s.tx(async () => {
      const now = Date.now(), existing = await this.s.get('SELECT * FROM newsletter_subscribers WHERE email=?', email);
      if (existing?.status === 'active' || existing && now - existing.requested_at < DAY || await this.s.get('SELECT address_hash FROM mail_suppressions WHERE address_hash=?', digest(email))) return;
      const confirmToken = token(), unsubscribeToken = token(), id = existing?.id || randomUUID();
      if (existing) await this.s.run("UPDATE newsletter_subscribers SET first_name=?,last_name=?,status='pending',confirm_hash=?,confirm_expires=?,unsubscribe_hash=?,consent_version=?,requested_at=? WHERE id=?", first, last, digest(confirmToken), now + 2 * DAY, digest(unsubscribeToken), NEWSLETTER_CONSENT_VERSION, now, id);
      else await this.s.run("INSERT INTO newsletter_subscribers(id,email,first_name,last_name,status,confirm_hash,confirm_expires,unsubscribe_hash,consent_version,requested_at) VALUES(?,?,?,?,'pending',?,?,?,?,?)", id, email, first, last, digest(confirmToken), now + 2 * DAY, digest(unsubscribeToken), NEWSLETTER_CONSENT_VERSION, now);
      const subscriber = await this.s.get('SELECT * FROM newsletter_subscribers WHERE id=?', id);
      await this.s.run('INSERT INTO newsletter_consents VALUES(?,?,?,?,?,?)', randomUUID(), id, 'requested', NEWSLETTER_CONSENT_VERSION, NEWSLETTER_CONSENT, now);
      await this.queue(subscriber, 'newsletter-confirm', { confirmToken, unsubscribeToken });
    });
    await this.mailer.safeFlush({ newsletterOnly: true });
    return { ...accepted, ...(this.config.newsletterMode !== 'resend' ? { message: 'Lokaler Test: Die Bestätigung wurde im Testpostfach gespeichert. Es wurde keine E-Mail versendet.' } : {}) };
  }
  async queue(subscriber, kind, tokens) {
    const id = digest(`${subscriber.id}:${subscriber.confirm_hash}:${kind}`), payload = newsletterEmail({ subscriber, kind, base: this.config.mailPublicUrl || this.config.baseUrl, ...tokens });
    const external = this.config.newsletterMode === 'resend';
    const row = await this.s.run('INSERT OR IGNORE INTO mail_outbox VALUES(?,NULL,?,?,?,?,?,?)', id, kind, subscriber.email, payload.subject, payload.text, external ? 'queued' : 'local-delivered', Date.now());
    if (!row.changes) return;
    await this.s.run('INSERT INTO newsletter_mail VALUES(?,?,?)', id, subscriber.id, subscriber.confirm_hash);
    if (external) await this.s.run("INSERT INTO mail_deliveries(mail_id,state,payload,created) VALUES(?,'queued',?,?)", id, JSON.stringify(payload), Date.now());
  }
  async confirm(value) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(value || '')) throw new ShopError('Der Bestätigungslink ist ungültig.', 400);
    await this.s.tx(async () => {
      const sub = await this.s.get('SELECT * FROM newsletter_subscribers WHERE confirm_hash=?', digest(value));
      if (!sub || sub.status === 'unsubscribed' || sub.confirm_expires < Date.now()) throw new ShopError('Dieser Link ist abgelaufen. Bitte melde dich erneut zum Newsletter an.', 410);
      if (sub.status === 'active') return;
      const code = sub.code || `LICHT-${randomBytes(10).toString('hex').toUpperCase()}`, unsubscribeToken = token(), now = Date.now();
      await this.s.run("UPDATE newsletter_subscribers SET status='active',code=?,code_hash=?,unsubscribe_hash=?,confirmed_at=COALESCE(confirmed_at,?),unsubscribed_at=NULL WHERE id=?", code, digest(code), digest(unsubscribeToken), now, sub.id);
      await this.s.run('INSERT INTO newsletter_consents VALUES(?,?,?,?,?,?)', randomUUID(), sub.id, 'confirmed', sub.consent_version, NEWSLETTER_CONSENT, now);
      await this.queue({ ...sub, code }, 'newsletter-welcome', { unsubscribeToken });
    });
    await this.mailer.safeFlush({ newsletterOnly: true });
    return { ok: true, message: this.config.newsletterMode === 'resend' ? 'Deine Anmeldung ist bestätigt. Dein persönlicher 5-%-Code kommt per E-Mail.' : 'Deine Testanmeldung ist bestätigt. Der Code liegt im lokalen Testpostfach.' };
  }
  async unsubscribe(value) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(value || '')) throw new ShopError('Der Abmeldelink ist ungültig.');
    await this.s.tx(async () => {
      const sub = await this.s.get('SELECT * FROM newsletter_subscribers WHERE unsubscribe_hash=?', digest(value));
      if (!sub) throw new ShopError('Der Abmeldelink ist ungültig. Bitte wende dich an info@archenlicht.de.', 404);
      if (sub.status === 'unsubscribed') return;
      await this.s.run("UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribed_at=? WHERE id=?", Date.now(), sub.id);
      await this.s.run('INSERT INTO newsletter_consents VALUES(?,?,?,?,?,?)', randomUUID(), sub.id, 'unsubscribed', sub.consent_version, '', Date.now());
      await this.s.run("UPDATE mail_deliveries SET state='suppressed' WHERE mail_id IN (SELECT mail_id FROM newsletter_mail WHERE subscriber_id=?) AND state IN ('queued','sending')", sub.id);
    });
    return { ok: true, message: 'Du bist vom Newsletter abgemeldet. Dein bereits erhaltener Rabattcode bleibt gültig, sofern er noch nicht eingelöst wurde.' };
  }
  async discount(code, email, items) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^LICHT-[A-F0-9]{20}$/.test(normalized)) throw new ShopError('Bitte prüfe deinen Newsletter-Code und deine E-Mail-Adresse.');
    const sub = await this.s.get('SELECT * FROM newsletter_subscribers WHERE code_hash=? AND email=? AND confirmed_at IS NOT NULL', digest(normalized), String(email || '').trim().toLowerCase());
    if (!sub) throw new ShopError('Bitte prüfe deinen Newsletter-Code und deine E-Mail-Adresse.');
    let priced;
    try { priced = priceNewsletterItems(items); } catch (e) { throw new ShopError(e.message, 409); }
    const reservation = await this.s.get('SELECT r.order_id,r.redeemed_at,o.status FROM newsletter_redemptions r JOIN orders o ON o.id=r.order_id WHERE r.subscriber_id=? AND r.mode=?', sub.id, this.config.shopMode);
    if (reservation) throw new ShopError(reservation.redeemed_at ? 'Dieser Newsletter-Code wurde bereits eingelöst.' : 'Dein Code ist für eine begonnene Zahlung reserviert. Bitte schließe diese ab oder brich sie über den Shop ab. Bei Stripe wird er nach Ablauf der Zahlung wieder frei.', 409);
    return { subscriberId: sub.id, items: priced };
  }
  // Must run inside the same transaction that inserts the immutable order.
  async reserve(subscriberId, orderId) {
    const inserted = await this.s.run('INSERT OR IGNORE INTO newsletter_redemptions VALUES(?,?,?,NULL)', subscriberId, this.config.shopMode, orderId);
    if (!inserted.changes) throw new ShopError('Der Newsletter-Code ist bereits eingelöst oder für eine Zahlung reserviert.', 409);
  }
  async release(orderId) { await this.s.run("DELETE FROM newsletter_redemptions WHERE order_id=? AND redeemed_at IS NULL AND order_id IN (SELECT id FROM orders WHERE paid_at IS NULL AND status IN ('cancelled','expired','payment_failed'))", orderId); }
  async cleanup() {
    await this.s.run('DELETE FROM newsletter_limits WHERE expires<?', Date.now());
    // Pending, never-confirmed signups are removed after 30 days. Mail payloads
    // containing confirmation links are removed first to avoid retaining PII.
    const stale = await this.s.all("SELECT id FROM newsletter_subscribers WHERE confirmed_at IS NULL AND requested_at<?", Date.now() - 30 * DAY);
    for (const { id } of stale) await this.s.tx(async () => {
      if (!(await this.s.get('SELECT id FROM newsletter_subscribers WHERE id=? AND confirmed_at IS NULL AND requested_at<?', id, Date.now() - 30 * DAY))) return;
      await this.s.run('DELETE FROM mail_deliveries WHERE mail_id IN (SELECT mail_id FROM newsletter_mail WHERE subscriber_id=?)', id);
      const mails = await this.s.all('SELECT mail_id FROM newsletter_mail WHERE subscriber_id=?', id);
      await this.s.run('DELETE FROM newsletter_subscribers WHERE id=? AND confirmed_at IS NULL', id);
      for (const mail of mails) await this.s.run('DELETE FROM mail_outbox WHERE id=?', mail.mail_id);
    });
  }
}
