import {randomUUID} from 'node:crypto';
import {Resend} from 'resend';
import {ShopError} from './layout.js';
import {digest} from './store.js';
import {orderEmail,MAIL_IDENTITY} from './mail-templates.js';

const eventStates={'email.sent':'accepted','email.delivery_delayed':'delayed','email.delivered':'delivered','email.failed':'failed','email.bounced':'bounced','email.complained':'complained','email.suppressed':'suppressed'};
const rank={accepted:1,delayed:2,delivered:3,failed:4,bounced:5,suppressed:5,complained:6};
const retryWindow=23*60*60*1000;
const messageId=/^[a-zA-Z0-9_-]{1,200}$/;

export class Mailer {
  static validate(config) {
    if (config.newsletterMode && !['local','resend'].includes(config.newsletterMode)) throw new Error('NEWSLETTER_MODE muss local oder resend sein.');
    if (config.newsletterMode === 'resend' && (!/^re_[A-Za-z0-9_-]+$/.test(config.resendKey || '') || !/^whsec_[A-Za-z0-9+/=_-]+$/.test(config.resendWebhook || '') || !/^https:\/\/(www\.)?archenlicht\.de$/.test(config.mailPublicUrl || ''))) throw new Error('Für den Newsletter fehlen Resend-Zugangsdaten oder die öffentliche Shopadresse.');
    if(!['local','resend-test'].includes(config.mailMode)) throw new Error('MAIL_MODE muss local oder resend-test sein.');
    if(config.mailMode!=='resend-test') return;
    if(config.shopMode!=='test'||!/^re_[A-Za-z0-9_-]+$/.test(config.resendKey||'')||!/^whsec_[A-Za-z0-9+/=_-]+$/.test(config.resendWebhook||'')) throw new Error('Für den begrenzten Resend-Test fehlen sichere Zugangsdaten.');
    if(!Number.isFinite(Date.parse(config.mailEnabledSince))||!config.mailTestRecipients?.length||config.mailTestRecipients.some(x=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) throw new Error('Resend-Test benötigt Startzeit und ausdrücklich festgelegte Testempfänger.');
    if(!/^https:\/\/(www\.)?archenlicht\.de$/.test(config.mailPublicUrl||'')) throw new Error('Bitte die öffentliche Archenlicht-Adresse für Mail-Statuslinks konfigurieren.');
  }
  constructor(config,store) {this.config=config;this.s=store;this.enabled=config.mailMode==='resend-test';}
  async enqueue(mailId,orderId,kind,body,status) {
    if(!this.enabled) return;
    const order=await this.s.get('SELECT * FROM orders WHERE id=?',orderId);
    if(!order||order.mode!=='test'||order.created<Date.parse(this.config.mailEnabledSince)) return;
    const recipient=JSON.parse(order.recipient),to=kind==='fulfillment-error'?MAIL_IDENTITY.replyTo:recipient.email;
    // Never redirect arbitrary customers' personal order data to a test inbox.
    if(!this.config.mailTestRecipients.includes(recipient.email.toLowerCase())||!this.config.mailTestRecipients.includes(to.toLowerCase())) return;
    const confirmation=kind==='confirmation'?body:(await this.s.get("SELECT body FROM mail_outbox WHERE order_id=? AND kind='confirmation'",orderId))?.body;
    const guestToken=/#token=([A-Za-z0-9_-]{43})/.exec(confirmation||'')?.[1];
    if(kind!=='fulfillment-error'&&!guestToken) throw new Error('Geschützter Bestelllink fehlt in der Testmail.');
    const statusUrl=`${this.config.mailPublicUrl}/bestellung/${order.id}${kind==='fulfillment-error'?'':`#token=${guestToken}`}`;
    const fulfillment=await this.s.get('SELECT tracking FROM fulfillment WHERE order_id=?',order.id);
    const payload=orderEmail({order,kind,statusUrl,tracking:fulfillment?.tracking,reason:kind==='fulfillment-error'?body.split('\n')[2]:undefined});
    const state=status==='pending-payment'?'waiting-payment':'queued';
    await this.s.run('INSERT OR IGNORE INTO mail_deliveries(mail_id,state,payload,created) VALUES(?,?,?,?)',mailId,state,JSON.stringify(payload),Date.now());
    await this.s.run('UPDATE mail_outbox SET recipient=?,subject=?,body=?,status=? WHERE id=?',to,payload.subject,payload.text,state,mailId);
  }
  async release(orderId) {
    if(!this.enabled) return;
    await this.s.run("UPDATE mail_deliveries SET state='queued' WHERE state='waiting-payment' AND mail_id IN (SELECT id FROM mail_outbox WHERE order_id=?)",orderId);
    await this.s.run("UPDATE mail_outbox SET status='queued' WHERE order_id=? AND id IN (SELECT mail_id FROM mail_deliveries WHERE state='queued')",orderId);
  }
  async recordState(mailId,state,error=null) {
    await this.s.run('UPDATE mail_deliveries SET state=?,last_error=?,lease_until=0,lease_token=NULL WHERE mail_id=?',state,error,mailId);
    await this.s.run('UPDATE mail_outbox SET status=? WHERE id=?',`resend-${state}`,mailId);
  }
  async flush({orderId=null,limit=2,newsletterOnly=false}={}) {
    if(!this.enabled && this.config.newsletterMode !== 'resend') return;
    const started=Date.now();
    const jobs=await this.s.all("SELECT d.*,m.order_id,m.kind FROM mail_deliveries d JOIN mail_outbox m ON m.id=d.mail_id LEFT JOIN orders o ON o.id=m.order_id WHERE d.state IN ('queued','sending') AND d.lease_until<? AND d.next_attempt<=? AND (o.paid_at IS NOT NULL OR m.kind IN ('newsletter-confirm','newsletter-welcome'))"+(orderId?' AND o.id=?':'')+(newsletterOnly?" AND m.kind IN ('newsletter-confirm','newsletter-welcome')":'')+' ORDER BY d.created LIMIT 10',started,started,...(orderId?[orderId]:[]));
    let processed=0;
    for(const candidate of jobs) {
      const newsletter = candidate.kind.startsWith('newsletter-');
      if (newsletter ? this.config.newsletterMode !== 'resend' : !this.enabled) continue;
      if(processed++>=limit||Date.now()-started>20000) break;
      const now=Date.now(),lease=randomUUID();
      const claim=await this.s.run("UPDATE mail_deliveries SET state='sending',lease_until=?,lease_token=? WHERE mail_id=? AND state IN ('queued','sending') AND lease_until<?",now+60000,lease,candidate.mail_id,now);
      if(!claim.changes) continue;
      const job=await this.s.get('SELECT * FROM mail_deliveries WHERE mail_id=?',candidate.mail_id),payload=JSON.parse(job.payload);
      if (newsletter) {
        const subscription = await this.s.get('SELECT s.status,s.confirm_hash,s.confirm_expires,n.generation FROM newsletter_mail n JOIN newsletter_subscribers s ON s.id=n.subscriber_id WHERE n.mail_id=?',job.mail_id);
        if (!subscription || subscription.generation !== subscription.confirm_hash || subscription.status !== (candidate.kind === 'newsletter-confirm' ? 'pending' : 'active') || candidate.kind === 'newsletter-confirm' && subscription.confirm_expires < now) { await this.recordState(job.mail_id,'suppressed','Newsletter-Anmeldung nicht mehr aktuell.'); continue; }
      } else if(!this.config.mailTestRecipients.includes(payload.to[0].toLowerCase())) {await this.recordState(job.mail_id,'held','Testempfänger nicht mehr freigegeben.');continue;}
      if(await this.s.get('SELECT address_hash FROM mail_suppressions WHERE address_hash=?',digest(payload.to[0].toLowerCase()))) {await this.recordState(job.mail_id,'suppressed','Adresse nach Rückläufer oder Beschwerde gesperrt.');continue;}
      if(job.first_attempt&&now-job.first_attempt>=retryWindow||job.attempts>=6) {await this.recordState(job.mail_id,'held','Versandstatus manuell bei Resend abgleichen; keine automatische Neusendung.');continue;}
      await this.s.run('UPDATE mail_deliveries SET first_attempt=COALESCE(first_attempt,?),attempts=attempts+1 WHERE mail_id=? AND lease_token=?',now,job.mail_id,lease);
      let response,data;
      try {
        response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${this.config.resendKey}`,'Content-Type':'application/json','Idempotency-Key':`archenlicht-mail-${job.mail_id}`},body:job.payload,redirect:'error',signal:AbortSignal.timeout(8000)});
        data=await response.json();
      } catch { /* The request may have been accepted. Retry the identical payload/key only inside the safe window. */ }
      if(response?.ok&&typeof data?.id==='string'&&messageId.test(data.id)) {
        // If persistence fails, the durable sending lease remains. A later worker
        // repeats the same provider key, never a newly generated one.
        await this.s.tx(async()=>{
          await this.s.run('UPDATE mail_deliveries SET provider_id=?,accepted_at=?,lease_until=0,lease_token=NULL WHERE mail_id=? AND lease_token=?',data.id,Date.now(),job.mail_id,lease);
          await this.recordState(job.mail_id,'accepted');
          await this.reconcile(job.mail_id,data.id);
        });
      } else if(response&&response.status>=400&&response.status<500&&![408,409,429].includes(response.status)) {
        await this.recordState(job.mail_id,'failed',`Resend hat den Versand abgelehnt (HTTP ${response.status}).`);
      } else {
        await this.s.run("UPDATE mail_deliveries SET state='queued',next_attempt=?,lease_until=0,lease_token=NULL,last_error=? WHERE mail_id=? AND lease_token=?",now+Math.min(3600000,30000*2**job.attempts),'Antwort unklar oder vorübergehend nicht verfügbar; identische Anfrage wird wiederholt.',job.mail_id,lease);
        await this.s.run("UPDATE mail_outbox SET status='resend-retry' WHERE id=?",job.mail_id);
      }
    }
  }
  async safeFlush(options) {try {await this.flush(options);}catch {console.error('Mailverarbeitung unterbrochen. Zahlung bleibt bestätigt; dauerhafter Versandauftrag bleibt erhalten.');}}
  async reconcile(mailId,providerId) {
    const row=await this.s.get('SELECT state,payload FROM mail_deliveries WHERE mail_id=?',mailId);
    const events=await this.s.all('SELECT type FROM mail_events WHERE provider_id=?',providerId);
    let state=row.state;
    for(const event of events) if((rank[eventStates[event.type]]||0)>(rank[state]||0)) state=eventStates[event.type];
    if(state!==row.state) await this.recordState(mailId,state);
    if(['bounced','complained','suppressed'].includes(state)) await this.s.run('INSERT OR IGNORE INTO mail_suppressions VALUES(?,?,?)',digest(JSON.parse(row.payload).to[0].toLowerCase()),state,Date.now());
  }
  async webhook(raw,headers) {
    if(!this.config.resendWebhook) throw new ShopError('Der Resend-Zustellnachweis ist noch nicht eingerichtet.',503);
    let event;
    try {event=new Resend(this.config.resendKey||'re_webhook_only').webhooks.verify({payload:raw,headers:{id:headers['svix-id'],timestamp:headers['svix-timestamp'],signature:headers['svix-signature']},webhookSecret:this.config.resendWebhook});}
    catch {throw new ShopError('Ungültige Resend-Webhook-Signatur.',401);}
    if(!event||typeof event!=='object'||Array.isArray(event)) throw new ShopError('Ungültiger Resend-Zustellnachweis.');
    if(!eventStates[event.type]) return {ignored:true};
    const id=headers['svix-id'],providerId=event.data?.email_id;
    if(!messageId.test(id||'')||!messageId.test(providerId||'')) throw new ShopError('Ungültiger Resend-Zustellnachweis.');
    await this.s.tx(async()=>{
      await this.s.run('INSERT OR IGNORE INTO mail_events VALUES(?,?,?,?,?)',id,providerId,event.type,Number.isFinite(Date.parse(event.created_at))?Date.parse(event.created_at):Date.now(),Date.now());
      const delivery=await this.s.get('SELECT mail_id FROM mail_deliveries WHERE provider_id=?',providerId);
      if(delivery) await this.reconcile(delivery.mail_id,providerId);
    });
    return {received:true};
  }
}
