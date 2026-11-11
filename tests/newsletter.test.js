import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { defaultConfig, createApp } from '../server/index.js';
import { NEWSLETTER_CONSENT_VERSION } from '../public/newsletter-policy.js';
import { priceNewsletterItems, priceBundleItems, summarizePricing } from '../public/bundle-pricing.js';
import { orderEmail } from '../server/mail-templates.js';
import { Payments } from '../server/payments.js';
const signup = { firstName:'Anna',lastName:'Muster',email:'anna@example.test',consent:true,consentVersion:NEWSLETTER_CONSENT_VERSION };
const recipient = { name:'Anna Muster',email:signup.email,phone:'+4915112345678',street:'Testweg 1',postalCode:'10115',city:'Berlin',country:'DE' };
const design = {kind:'fixed',designId:'nach-dem-sturm',modelId:'iphone-14-pro',backgroundId:'light-blue'};
const config = () => ({...defaultConfig(),storageMode:'sqlite',shopMode:'test',paymentMode:'local',podbaseMode:'local',printMode:'preview',mailMode:'local',newsletterMode:'local',dataDir:resolve('test-results','newsletter-'+randomUUID()),serverless:true,autoShip:false});
async function setup(t,overrides={}) {const shop=await Shop.create({...config(),...overrides});t.after(()=>shop.close());const {session}=await shop.createSession();return {shop,session};}
async function activate(shop,session) {
 await shop.newsletter.subscribe(signup,session,'fixture-ip');
 const mail=await shop.s.get("SELECT body FROM mail_outbox WHERE kind='newsletter-confirm' ORDER BY created DESC");
 const token=/#token=([A-Za-z0-9_-]{43})/.exec(mail.body)[1];await shop.newsletter.confirm(token);
 return {token,...await shop.s.get('SELECT * FROM newsletter_subscribers WHERE email=?',signup.email)};
}
const paid=o=>({id:'paid-'+o.id,orderId:o.id,paymentId:o.payment_id,amount:o.amount,currency:'EUR',completed:true});

test('Double opt-in speichert Namen und Einwilligung; Replay sendet keinen zweiten Code; Abmeldung bleibt möglich',async t=>{
 const {shop,session}=await setup(t);
 await assert.rejects(shop.newsletter.subscribe({...signup,consent:false},session,'ip'),/Einwilligung/);
 assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM newsletter_subscribers')).n,0);
 await shop.newsletter.subscribe(signup,session,'ip');
 let sub=await shop.s.get('SELECT * FROM newsletter_subscribers');assert.equal(sub.status,'pending');assert.equal(sub.code,null);assert.equal(sub.first_name,'Anna');
 const token=/#token=([A-Za-z0-9_-]{43})/.exec((await shop.s.get('SELECT body FROM mail_outbox')).body)[1];
 await Promise.all([shop.newsletter.confirm(token),shop.newsletter.confirm(token)]);
 sub=await shop.s.get('SELECT * FROM newsletter_subscribers');assert.equal(sub.status,'active');assert.match(sub.code,/^LICHT-[A-F0-9]{20}$/);
 assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM mail_outbox')).n,2);
 assert.equal((await shop.s.get("SELECT COUNT(*) AS n FROM newsletter_consents WHERE action='confirmed'")).n,1);
 await shop.newsletter.subscribe({...signup,firstName:'Attacker'},session,'ip');assert.equal((await shop.s.get('SELECT first_name FROM newsletter_subscribers')).first_name,'Anna');
 const welcome=await shop.s.get("SELECT body FROM mail_outbox WHERE kind='newsletter-welcome'");assert.match(welcome.body,/Bundle-Rabatten/);
 const unsubscribe=/#token=([A-Za-z0-9_-]{43})/.exec(welcome.body)[1];
 await shop.newsletter.unsubscribe(unsubscribe);await shop.newsletter.unsubscribe(unsubscribe);
 assert.equal((await shop.s.get('SELECT status FROM newsletter_subscribers')).status,'unsubscribed');
 assert.equal((await shop.s.get("SELECT COUNT(*) AS n FROM newsletter_consents WHERE action='unsubscribed'")).n,1);
 assert.equal((await shop.newsletter.discount(sub.code,signup.email,priceBundleItems([{unitPrice:2999,quantity:1}]))).items[0].pricing.total,2849);
 await assert.rejects(shop.newsletter.confirm(token),/abgelaufen/);
});

test('Nur bestätigte passende E-Mail; 5 % centgenau auf Standard, Wunschtext und MagSafe, keine Rabattkombination',async t=>{
 const {shop,session}=await setup(t),sub=await activate(shop,session);
 for(const price of [3499,3999,4499]) {
  const result=await shop.newsletter.discount(sub.code.toLowerCase(),signup.email.toUpperCase(),priceBundleItems([{unitPrice:price,quantity:1}]));
  assert.equal(summarizePricing(result.items).total,price-Math.round(price*.05));assert.equal(summarizePricing(result.items).source,'newsletter');
 }
 await assert.rejects(shop.newsletter.discount(sub.code,'other@example.test',[{unitPrice:2999,quantity:1}]),/E-Mail/);
 for(const quantity of [2,3,4]) await assert.rejects(shop.newsletter.discount(sub.code,signup.email,priceBundleItems([{unitPrice:2999,quantity}])),/kombinierbar/);
 assert.throws(()=>priceNewsletterItems([{unitPrice:2499,compareAtPrice:2999,quantity:1}]),/reduzierte/);
 assert.throws(()=>priceNewsletterItems([{unitPrice:2499,reduced:true,quantity:1}]),/reduzierte/);
 await shop.s.run('UPDATE newsletter_subscribers SET confirmed_at=NULL');
 await assert.rejects(shop.newsletter.discount(sub.code,signup.email,[{unitPrice:2999,quantity:1}]),/E-Mail/);
});

test('Paralleler Checkout reserviert nur einmal, Abbruch gibt Code frei, Zahlung löst ihn endgültig ein; Mail und Stripe stimmen überein',async t=>{
 const {shop,session}=await setup(t),sub=await activate(shop,session);
 await shop.saveCart(session,design);
 const input={recipient,method:'card',newsletterCode:sub.code,amount:1};
 const results=await Promise.allSettled([shop.checkout(session,input),shop.checkout(session,input)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 let order=await shop.s.get('SELECT * FROM orders');assert.equal(order.amount,3324);
 assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n,1);
 await shop.s.run("UPDATE orders SET status='cancelled' WHERE id=?",order.id);await shop.newsletter.release(order.id);
 await assert.rejects(shop.acceptPayment(paid(order)),/abgebrochen/);
 const next=await shop.checkout(session,input);order=await shop.s.get('SELECT * FROM orders WHERE id=?',next.orderId);
 const calls=[],payments=new Payments({paymentMode:'sandbox',stripeKey:'sk_test_fixture',baseUrl:'https://www.archenlicht.de'});
 payments.sdk={coupons:{create:async(p)=>{calls.push(p);return {id:'coupon',livemode:false,...p};}},checkout:{sessions:{create:async p=>{calls.push(p);return {id:'cs_test_fixture',livemode:false,url:'https://checkout.stripe.com/c/pay/fixture'};}}}};
 await payments.create(order);assert.equal(calls[0].amount_off,175);assert.equal(calls[0].name,'Newsletter-Rabatt 5 %');assert.equal(calls[1].line_items[0].price_data.unit_amount,3499);assert.deepEqual(calls[1].discounts,[{coupon:'coupon'}]);
 await shop.acceptPayment(paid(order));await shop.acceptPayment(paid(order));
 const mail=orderEmail({order,kind:'confirmation',statusUrl:'https://www.archenlicht.de/bestellung/fixture'});assert.match(mail.text,/Newsletter-Rabatt \(5 %\): −1,75/);assert.match(mail.text,/Gesamt: 33,24/);assert.doesNotMatch(mail.text,/Bundle-Rabatt/);
 assert.ok((await shop.s.get('SELECT redeemed_at FROM newsletter_redemptions')).redeemed_at);
 await assert.rejects(shop.newsletter.discount(sub.code,signup.email,[{unitPrice:2999,quantity:1}]),/bereits eingelöst/);
});

test('Newsletter nutzt Resend mit unveränderlichem Wiederholungsschlüssel, unabhängig von Bestell-Testempfängern',async t=>{
 const {shop,session}=await setup(t,{newsletterMode:'resend',resendKey:'re_fixture',resendWebhook:'whsec_fixture',mailPublicUrl:'https://www.archenlicht.de',mailTestRecipients:['info@archenlicht.de']});
 const original=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async (url,options)=>{assert.equal(url,'https://api.resend.com/emails');calls.push({key:options.headers['Idempotency-Key'],body:JSON.parse(options.body)});if(calls.length===1)throw new Error('Ambiguous network result');return Response.json({id:'fixture-'+calls.length});};
 await shop.newsletter.subscribe(signup,session,'ip');assert.equal(calls.length,1);
 await shop.s.run('UPDATE mail_deliveries SET next_attempt=0');await shop.mailer.flush();assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 const confirm=/#token=([A-Za-z0-9_-]{43})/.exec(calls[1].body.text)[1];await shop.newsletter.confirm(confirm);assert.equal(calls.length,3);assert.equal(calls[2].body.to[0],signup.email);
 assert.equal(calls[2].body.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');assert.match(calls[2].body.from,/info@archenlicht.de/);
 await shop.newsletter.confirm(confirm);await shop.mailer.flush();assert.equal(calls.length,3);
});

test('API erzwingt CSRF; GET-Link bestätigt nichts; One-Click-Abmeldung ist idempotent; Ratenlimit bleibt gespeichert',async t=>{
 const app=await createApp(config());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
 const base=`http://127.0.0.1:${app.server.address().port}`,res=await fetch(base+'/api/bootstrap'),state=await res.json(),cookie=res.headers.get('set-cookie').split(';')[0];
 const send=(path,body={},csrf=true)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:base,...(csrf?{'X-CSRF-Token':state.csrf}:{})},body:JSON.stringify(body)});
 assert.equal((await send('/api/newsletter/subscribe',signup,false)).status,403);
 assert.equal((await send('/api/newsletter/subscribe',signup)).status,200);
 const mail=await app.shop.s.get('SELECT body FROM mail_outbox'),token=/#token=([A-Za-z0-9_-]{43})/.exec(mail.body)[1];
 assert.equal((await fetch(base+'/newsletter/bestaetigen#token='+token)).status,200);assert.equal((await app.shop.s.get('SELECT status FROM newsletter_subscribers')).status,'pending');
 assert.equal((await send('/api/newsletter/confirm',{token})).status,200);
 const welcome=await app.shop.s.get("SELECT body FROM mail_outbox WHERE kind='newsletter-welcome'"),unsub=/#token=([A-Za-z0-9_-]{43})/.exec(welcome.body)[1];
 assert.equal((await fetch(base+'/api/newsletter/one-click?token='+unsub,{method:'POST',body:'List-Unsubscribe=One-Click'})).status,200);
 assert.equal((await app.shop.s.get('SELECT status FROM newsletter_subscribers')).status,'unsubscribed');
 await send('/api/newsletter/subscribe',signup);await send('/api/newsletter/subscribe',signup);
 assert.equal((await send('/api/newsletter/subscribe',signup)).status,429);
});

test('Abgelaufene Bestätigung bleibt gesperrt, unbestätigte Daten und Mailpayloads werden gelöscht',async t=>{
 const {shop,session}=await setup(t);await shop.newsletter.subscribe(signup,session,'ip');
 const token=/#token=([A-Za-z0-9_-]{43})/.exec((await shop.s.get('SELECT body FROM mail_outbox')).body)[1];
 await shop.s.run('UPDATE newsletter_subscribers SET confirm_expires=0,requested_at=0');
 await assert.rejects(shop.newsletter.confirm(token),/abgelaufen/);await shop.newsletter.cleanup();
 for(const table of ['newsletter_subscribers','newsletter_consents','newsletter_mail','mail_outbox'])assert.equal((await shop.s.get(`SELECT COUNT(*) AS n FROM ${table}`)).n,0);
});
