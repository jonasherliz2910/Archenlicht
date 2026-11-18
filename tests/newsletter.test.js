import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { defaultConfig, createApp } from '../server/index.js';
import { NEWSLETTER_CONSENT_VERSION } from '../public/newsletter-policy.js';
import { priceNewsletterItems, priceBundleItems, summarizePricing, discountBreakdown } from '../public/bundle-pricing.js';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';
import { orderEmail } from '../server/mail-templates.js';
import { Payments } from '../server/payments.js';
const signup = { firstName:'Anna',lastName:'Muster',email:'anna@example.test',consent:true,consentVersion:NEWSLETTER_CONSENT_VERSION };
const recipient = { name:'Anna Muster',email:signup.email,phone:'+4915112345678',street:'Testweg 1',postalCode:'10115',city:'Berlin',country:'DE' };
const design = {kind:'fixed',designId:'nach-dem-sturm',modelId:'iphone-14-pro',backgroundId:'light-blue'};
// Normal-price fixtures keep testing newsletter redemption outside the opening offer.
const config = () => ({...defaultConfig(),openingOfferEnabled:false,storageMode:'sqlite',shopMode:'test',paymentMode:'local',podbaseMode:'local',printMode:'preview',mailMode:'local',newsletterMode:'local',dataDir:resolve('test-results','newsletter-'+randomUUID()),serverless:true,autoShip:false});
async function setup(t,overrides={}) {const shop=await Shop.create({...config(),...overrides});t.after(()=>shop.close());const {session}=await shop.createSession();return {shop,session};}
async function activate(shop,session) {
 await shop.newsletter.subscribe(signup,session,'fixture-ip');
 const mail=await shop.s.get("SELECT body FROM mail_outbox WHERE kind='newsletter-confirm' ORDER BY created DESC");
 const token=/#token=([A-Za-z0-9_-]{43})/.exec(mail.body)[1];await shop.newsletter.confirm(token);
 return {token,...await shop.s.get('SELECT * FROM newsletter_subscribers WHERE email=?',signup.email)};
}
const paid=o=>({id:'paid-'+o.id,orderId:o.id,paymentId:o.payment_id,amount:o.amount,currency:'EUR',completed:true});

test('Newsletter gilt auf Eröffnungspreise im Servercheckout; der Betrag wird serverseitig berechnet',async t=>{
 const {shop,session}=await setup(t,{openingOfferEnabled:true}),sub=await activate(shop,session);
 await shop.saveCart(session,{...design,reduced:false});
 const checkout=await shop.checkout(session,{recipient,method:'card',newsletterCode:sub.code,amount:1});
 const order=await shop.s.get('SELECT * FROM orders WHERE id=?',checkout.orderId);
 assert.equal(order.amount,2849);
 assert.equal(JSON.parse(order.items)[0].reduced,true);
 assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM newsletter_redemptions')).n,1);
});

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

test('Nur bestätigte passende E-Mail; zusätzlich 5 % centgenau auf alle Varianten, Aktionen und Mengenrabatte',async t=>{
 const {shop,session}=await setup(t),sub=await activate(shop,session);
 for(const price of [3499,3999,4499]) {
  const result=await shop.newsletter.discount(sub.code.toLowerCase(),signup.email.toUpperCase(),priceBundleItems([{unitPrice:price,quantity:1}]));
  assert.equal(summarizePricing(result.items).total,price-Math.round(price*.05));assert.equal(summarizePricing(result.items).source,'newsletter');
 }
 await assert.rejects(shop.newsletter.discount(sub.code,'other@example.test',[{unitPrice:2999,quantity:1}]),/E-Mail/);
 for(const [quantity,total] of [[2,5413],[3,8120],[4,10256]]) {
  const result=await shop.newsletter.discount(sub.code,signup.email,priceBundleItems([{unitPrice:2999,quantity}]));
  assert.equal(summarizePricing(result.items).total,total);
 }
 for (const reduced of [{compareAtPrice:2999},{reduced:true}]) assert.equal(summarizePricing(priceNewsletterItems([{unitPrice:2499,quantity:1,...reduced}])).total,2374);
 await shop.s.run('UPDATE newsletter_subscribers SET confirmed_at=NULL');
 await assert.rejects(shop.newsletter.discount(sub.code,signup.email,[{unitPrice:2999,quantity:1}]),/E-Mail/);
});

test('Feste Dreier-Bundles und gemischte Warenkörbe behalten alle Designs und verteilen beide Rabatte centgenau',()=>{
 for(const bundle of FIXED_BUNDLES) {
  const items=bundle.designs.map(designId=>({unitPrice:2999,quantity:1,reduced:true,configuration:{...design,designId}}));
  const priced=priceBundleItems(items),before=structuredClone(priced),stacked=priceNewsletterItems(priced),summary=summarizePricing(stacked);
  assert.equal(summary.total,7692);assert.equal(summary.discount,1305);
  assert.deepEqual(discountBreakdown(summary),[{source:'bundle',percent:10,discount:900},{source:'newsletter',percent:5,discount:405}]);
  assert.deepEqual(priced,before);
  assert.deepEqual(stacked.map(i=>i.configuration),items.map(i=>i.configuration));
  assert.throws(()=>priceNewsletterItems(stacked),/bereits angewendet/);
 }
 // Split-line rounding must agree with one combined quantity, even at tiny amounts.
 for(const unitPrice of [1,19,101,2499,2999,3499,3999,4499]) for(const quantity of [1,2,3,4,7]) {
  const combined=priceNewsletterItems(priceBundleItems([{unitPrice,quantity}]));
  const split=priceNewsletterItems(priceBundleItems(Array.from({length:quantity},()=>({unitPrice,quantity:1}))));
  assert.equal(summarizePricing(combined).total,summarizePricing(split).total);
  assert.ok(split.every(i=>i.pricing.total>=0));
  assert.equal(split.reduce((sum,i)=>sum+i.pricing.total,0),summarizePricing(split).total);
 }
 const mixed=priceBundleItems([{unitPrice:2999,quantity:2,reduced:true},{unitPrice:4499,quantity:1}]);
 const before=summarizePricing(mixed).total;
 assert.equal(summarizePricing(priceNewsletterItems(mixed)).total,before-Math.round(before*.05));
 assert.throws(()=>priceNewsletterItems([]),/leer/);
 const legacy=[{unitPrice:3499,quantity:1,pricing:{version:'newsletter-5-v1',source:'newsletter',percent:5,subtotal:3499,discount:175,total:3324}}];
 assert.equal(summarizePricing(legacy).total,3324);
 assert.deepEqual(discountBreakdown(summarizePricing(legacy)),[{source:'newsletter',percent:5,discount:175}]);
 const corrupt=priceNewsletterItems(mixed);corrupt[0].pricing.discounts[1].discount++;
 assert.throws(()=>summarizePricing(corrupt),/gespeicherter Rabattpreis/);
});

test('Aktions-Bundle plus Newsletter: Kasse, gespeicherter Auftrag, Stripe und Bestellmail stimmen überein',async t=>{
 const {shop,session}=await setup(t,{openingOfferEnabled:true}),sub=await activate(shop,session);
 const bundle=FIXED_BUNDLES[0];
 for(const designId of bundle.designs) await shop.saveCart(session,{...design,designId});
 const cart=await shop.cart(session),quote=await shop.newsletter.discount(sub.code,signup.email,cart);
 assert.equal(summarizePricing(quote.items).total,7692);
 const checkout=await shop.checkout(session,{recipient,method:'card',newsletterCode:sub.code});
 const order=await shop.s.get('SELECT * FROM orders WHERE id=?',checkout.orderId);
 assert.equal(order.amount,7692);
 const calls=[],payments=new Payments({paymentMode:'sandbox',stripeKey:'sk_test_fixture',baseUrl:'https://www.archenlicht.de'});
 payments.sdk={coupons:{create:async(p,options)=>{calls.push({p,options});return{id:'coupon',livemode:false,...p};}},checkout:{sessions:{create:async p=>{calls.push({p});return{id:'cs_test_stacked',livemode:false,url:'https://checkout.stripe.com/c/pay/fixture'};}}}};
 await payments.create(order);
 assert.equal(calls[0].p.amount_off,1305);assert.equal(calls[0].p.name,'Bundle-Rabatt 10 % + Newsletter-Rabatt 5 %');
 assert.equal(calls[1].p.line_items.reduce((sum,i)=>sum+i.quantity*i.price_data.unit_amount,0)-calls[0].p.amount_off,order.amount);
 const verifiedSession={id:order.payment_id,client_reference_id:order.id,mode:'payment',payment_status:'paid',status:'complete',livemode:false,metadata:{order_id:order.id,tax_treatment:'small_business_de'},automatic_tax:{enabled:false},total_details:{amount_discount:1305,amount_tax:0},amount_subtotal:8997,amount_total:7692,currency:'eur'};
 payments.sdk.checkout.sessions.retrieve=async()=>verifiedSession;
 assert.equal((await payments.verify(order)).completed,true);
 verifiedSession.total_details.amount_discount=900;
 assert.equal((await payments.verify(order)).completed,false);
 const mail=orderEmail({order,kind:'confirmation',statusUrl:'https://www.archenlicht.de/bestellung/fixture'});
 for(const body of [mail.text,mail.html]) {assert.match(body,/Bundle-Rabatt \(10 %\): −9,00/);assert.match(body,/Newsletter-Rabatt \(5 %\): −4,05/);assert.match(body,/Gesamt: 76,92/);}
 shop.config.openingOfferEnabled=false;
 assert.deepEqual(await shop.s.get('SELECT * FROM orders WHERE id=?',order.id),order);
 // A reserved code remains mandatory for payment acceptance even with a bundle.
 await shop.s.run('DELETE FROM newsletter_redemptions WHERE order_id=?',order.id);
 await assert.rejects(shop.acceptPayment(paid(order)),/Rabatt ist dieser Zahlung/);
 await shop.newsletter.reserve(sub.id,order.id);
 await shop.acceptPayment(paid(order));await shop.acceptPayment(paid(order));
 assert.ok((await shop.s.get('SELECT redeemed_at FROM newsletter_redemptions')).redeemed_at);
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
