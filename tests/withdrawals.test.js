import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { createApp, defaultConfig } from '../server/index.js';
import { contractInformation, LEGAL_PAGES, OPERATOR, CONTACT } from '../public/legal-content.js';
import { orderEmail } from '../server/mail-templates.js';

const config = () => ({...defaultConfig(),storageMode:'sqlite',shopMode:'test',paymentMode:'local',podbaseMode:'local',printMode:'preview',mailMode:'local',newsletterMode:'local',serverless:true,autoShip:false,adminPassword:'Withdrawal-test-password!',dataDir:resolve('test-results',randomUUID())});
const input = () => ({requestId:randomUUID(),name:'Anna Beispiel',email:'anna@example.test',contract:'AL-BEISPIEL: Nur die Hülle für iPhone 14 Pro, 1 Stück.',confirm:true});
async function fixture(t, overrides={}) {const shop=await Shop.create({...config(),...overrides});t.after(()=>shop.close());const {session}=await shop.createSession();return {shop,session};}

test('Guest withdrawal is durable, idempotent and independent of payments; input is not used to disclose order data', async t => {
  const {shop,session}=await fixture(t), value=input();
  const [first,concurrent]=await Promise.all([shop.withdrawals.submit(value,session,'fixture-ip'),shop.withdrawals.submit(value,session,'fixture-ip')]);
  assert.deepEqual(concurrent,first);
  const repeat=await shop.withdrawals.submit(value,session,'fixture-ip');
  assert.deepEqual(repeat,first);assert.match(first.text,/Nur die Hülle/);assert.match(first.text,/Eingegangen am:/);assert.ok(Date.parse(first.receivedAt));
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM withdrawals')).n,1);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM mail_outbox')).n,2);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM orders')).n,0);
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n,0);
  await assert.rejects(shop.withdrawals.submit({...value,email:'changed@example.test'},session,'fixture-ip'),/bereits verwendet/);
  await assert.rejects(shop.withdrawals.submit({...input(),confirm:false},session,'fixture-ip'),/bestätige/);
  await assert.rejects(shop.withdrawals.submit({...input(),contract:'<script>alert(1)</script>'},session,'fixture-ip'),/Bitte gib/);
});

test('Withdrawal receipts and operator notifications use durable Resend retry keys and respect mode isolation', async t => {
  const {shop,session}=await fixture(t,{mailMode:'resend-test',resendKey:'re_fixture',resendWebhook:'whsec_fixture',mailPublicUrl:'https://www.archenlicht.de',mailTestRecipients:['anna@example.test','info@archenlicht.de'],mailEnabledSince:new Date(Date.now()-1000).toISOString()});
  const original=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=original);
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');calls.push({key:options.headers['Idempotency-Key'],body:options.body});throw new Error('response lost');};
  const value=input(),receipt=await shop.withdrawals.submit(value,session,'fixture-ip');
  assert.equal(calls.length,2);
  const messages=calls.map(c=>JSON.parse(c.body));assert.deepEqual(messages.map(m=>m.to[0]).sort(),['anna@example.test','info@archenlicht.de']);
  assert.ok(messages.every(m=>m.text.includes(receipt.text)));
  await shop.s.run('UPDATE mail_deliveries SET next_attempt=0');
  // Old test mail must not be sent when the process is serving the live shop.
  shop.config.shopMode='live';await shop.mailer.flush();assert.equal(calls.length,2);shop.config.shopMode='test';
  globalThis.fetch=async(url,options)=>{calls.push({key:options.headers['Idempotency-Key'],body:options.body});return Response.json({id:'mail-'+calls.length});};
  await shop.mailer.flush({withdrawalsOnly:true});
  assert.equal(calls.length,4);assert.deepEqual(calls.slice(2).sort((a,b)=>a.key.localeCompare(b.key)),calls.slice(0,2).sort((a,b)=>a.key.localeCompare(b.key)));
  await shop.withdrawals.submit(value,session,'fixture-ip');assert.equal(calls.length,4);
});

test('Withdrawal endpoint enforces CSRF and keeps admin records private; public downloads work without login', async t => {
  const app=await createApp(config());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
  const base=`http://127.0.0.1:${app.server.address().port}`,boot=await fetch(base+'/api/bootstrap'),state=await boot.json(),cookie=boot.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/vertrag-widerrufen')).status,200);
  assert.equal((await fetch(base+'/api/admin/withdrawals',{headers:{cookie}})).status,403);
  const value=input(),headers={cookie,'Content-Type':'application/json',Origin:base};
  assert.equal((await fetch(base+'/api/withdrawals',{method:'POST',headers,body:JSON.stringify(value)})).status,403);
  const response=await fetch(base+'/api/withdrawals',{method:'POST',headers:{...headers,'x-csrf-token':state.csrf},body:JSON.stringify(value)});
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
  const download=await fetch(base+'/rechtliches/vertragsinformationen.txt');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal(await download.text(),contractInformation());
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{...headers,'x-csrf-token':state.csrf},body:JSON.stringify({email:'jonas@archenlicht.test',password:'Withdrawal-test-password!'})});
  assert.equal(login.status,200);const adminCookie=login.headers.get('set-cookie').split(';')[0];
  const admin=await fetch(base+'/api/admin/withdrawals',{headers:{cookie:adminCookie}});assert.equal(admin.status,200);assert.equal((await admin.json())[0].name,value.name);
});

test('Legal content preserves customer choices and excludes withdrawn private telephone; live mail carries an immutable durable copy', () => {
  assert.equal(OPERATOR.phone,'');assert.doesNotMatch(CONTACT,/Telefon:/);
  assert.throws(()=>Shop.validateMode({...config(),shopMode:'live',checkoutEnabled:true,legalContactReady:false}),/Geschäfts-Telefonnummer/);
  const all=JSON.stringify(LEGAL_PAGES);assert.doesNotMatch(all,/ec\.europa\.eu\/consumers\/odr|lokalen SQLite/);assert.doesNotMatch(LEGAL_PAGES['/impressum'][1],/tel:/);
  assert.match(all,/5–10 Werktage/);assert.match(all,/Sie tragen die unmittelbaren Kosten/);assert.match(all,/Podbase, UAB/);
  const item={title:'Getragen',model:'iPhone 14 Pro',quantity:1,unitPrice:2999,configuration:{kind:'fixed'},printText:'Psalm 23'};
  const order={mode:'live',number:'AL-TEST',items:JSON.stringify([item]),recipient:JSON.stringify({name:'Anna',email:'anna@example.test',street:'Testweg 1',postalCode:'10115',city:'Berlin'}),amount:2999};
  const mail=orderEmail({order,kind:'confirmation',statusUrl:'https://www.archenlicht.de/bestellung/fixture'});
  assert.match(mail.text,/Muster-Widerrufsformular/);assert.equal(Buffer.from(mail.attachments[0].content,'base64').toString('utf8'),contractInformation());
  assert.equal(orderEmail({order,kind:'shipping',statusUrl:'https://www.archenlicht.de/'}).attachments,undefined);
});
