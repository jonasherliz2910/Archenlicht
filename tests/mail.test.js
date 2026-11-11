import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {resolve} from 'node:path';
import {Shop} from '../server/shop.js';
import {Mailer} from '../server/mail.js';
import {orderEmail} from '../server/mail-templates.js';
import {createApp,defaultConfig} from '../server/index.js';

const secret=`whsec_${Buffer.alloc(32,7).toString('base64')}`;
const recipient={name:'Mara Mustermann',email:'info@archenlicht.de',phone:'+4915112345678',street:'Testweg 12',postalCode:'10115',city:'Berlin',country:'DE'};
const design={kind:'custom',designId:'nach-dem-sturm',modelId:'iphone-18-pro-max',verseId:'ps23-1',dedication:'Für Anna',backgroundId:'black'};
const config=()=>({...defaultConfig(),dataDir:resolve('test-results',randomUUID()),storageMode:'sqlite',databaseUrl:undefined,serverless:true,adminPassword:'Mail-Test-2026!',autoShip:false,paymentMode:'local',podbaseMode:'local',mailMode:'resend-test',resendKey:'re_fixture',resendWebhook:secret,mailPublicUrl:'https://www.archenlicht.de',mailTestRecipients:['info@archenlicht.de'],mailEnabledSince:new Date(Date.now()-1000).toISOString()});
async function setup(t,overrides={}) {const settings={...config(),...overrides},shop=await Shop.create(settings);t.after(()=>shop.close());return {shop,settings};}
async function checkout(shop,email=recipient.email) {const {session}=await shop.createSession();await shop.saveCart(session,design);const result=await shop.checkout(session,{recipient:{...recipient,email},method:'card'});return await shop.s.get('SELECT * FROM orders WHERE id=?',result.orderId);}
const event=order=>({id:'paid-'+order.id,orderId:order.id,paymentId:order.payment_id,amount:order.amount,currency:'EUR',completed:true});
function mockSend(t,handler) {const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const calls=[];globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');calls.push({key:options.headers['Idempotency-Key'],body:options.body,payload:JSON.parse(options.body)});return handler?handler(calls.at(-1),calls.length):Response.json({id:'email-'+calls.length});};return calls;}
function signed(type,emailId,id='msg_'+randomUUID(),time=Math.floor(Date.now()/1000)) {const body=JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:emailId}}),signature=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${time}.${body}`).digest('base64');return {body,headers:{'svix-id':id,'svix-timestamp':String(time),'svix-signature':'v1,'+signature}};}

test('Bestellmail erst nach Zahlung, mit identischen Positionen, Betreiber und persönlichem Statuslink; Replay versendet nicht erneut',async t=>{
  const {shop}=await setup(t),calls=mockSend(t),order=await checkout(shop);
  await shop.mailer.flush();assert.equal(calls.length,0);
  await shop.acceptPayment(event(order));await shop.acceptPayment({...event(order),id:'another-event'});
  assert.equal(calls.length,1);const p=calls[0].payload;
  assert.deepEqual(p.to,['info@archenlicht.de']);assert.equal(p.from,'Archenlicht <info@archenlicht.de>');assert.equal(p.reply_to,'info@archenlicht.de');
  assert.match(p.subject,/\[TEST\]/);assert.match(p.text,/Herzly Marketing GbR/);assert.match(p.text,/Julian Isaak und Laura Herliz/);assert.match(p.text,/Stettiner Straße 27/);
  assert.match(p.text,/34,99/);assert.match(p.text,/iPhone 18 Pro Max/);assert.match(p.text,/Schwarz/);assert.match(p.text,/Für Anna/);assert.match(p.text,/§ 19 UStG/);
  assert.match(p.text,new RegExp(`https://www.archenlicht.de/bestellung/${order.id}#token=[A-Za-z0-9_-]{43}`));
  assert.equal((await shop.s.get('SELECT state FROM mail_deliveries')).state,'accepted');
});

test('Testversand schließt fremde Empfänger und alte Bestellungen aus; Fehlkonfiguration bleibt gesperrt',async t=>{
  const {shop}=await setup(t),calls=mockSend(t),foreign=await checkout(shop,'customer@example.test');await shop.acceptPayment(event(foreign));
  await shop.alert(foreign,'Testfehler');await shop.mailer.flush();
  assert.equal(calls.length,0);assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM mail_deliveries')).n,0);
  const {shop:old}=await setup(t,{mailMode:'local'}),order=await checkout(old);await old.acceptPayment(event(order));
  old.config.mailMode='resend-test';old.config.mailEnabledSince=new Date(Date.now()+1000).toISOString();old.mailer=new Mailer(old.config,old.s);
  await old.tick();await old.podbase.advance(order.id);await old.tick();assert.equal(calls.length,0);
  for(const change of [{mailTestRecipients:[]},{mailEnabledSince:''},{resendKey:''},{resendWebhook:''},{mailPublicUrl:'https://evil.example'}])assert.throws(()=>Mailer.validate({...config(),...change}));
});

test('Verlorene Versandantwort ändert Zahlung nicht; Wiederholung benutzt denselben Inhalt und Schlüssel, alte Unklarheit wird gehalten',async t=>{
  const {shop}=await setup(t),calls=mockSend(t,(_call,n)=>{if(n===1)throw new Error('Provider response lost re_private');return Response.json({id:'same-provider-email'});}),order=await checkout(shop);
  await shop.acceptPayment(event(order));assert.ok((await shop.s.get('SELECT paid_at FROM orders WHERE id=?',order.id)).paid_at);
  assert.equal((await shop.s.get('SELECT state FROM mail_deliveries')).state,'queued');
  await shop.s.run('UPDATE mail_deliveries SET next_attempt=0');await shop.mailer.flush();
  assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.equal(calls[0].body,calls[1].body);
  await shop.s.run("UPDATE mail_deliveries SET state='sending',first_attempt=?,next_attempt=0,lease_until=0",Date.now()-24*3600000);await shop.mailer.flush();
  assert.equal(calls.length,2);assert.equal((await shop.s.get('SELECT state FROM mail_deliveries')).state,'held');
});

test('Parallele Mailworker und Neustart erzeugen keine zweite Sendung',async t=>{
  const {shop,settings}=await setup(t),second=await Shop.create(settings);t.after(()=>second.close());
  const calls=mockSend(t,async()=>{await new Promise(r=>setTimeout(r,15));return Response.json({id:'concurrent-email'});});
  shop.mailer.safeFlush=async()=>{};const order=await checkout(shop);await shop.acceptPayment(event(order));
  await Promise.all([shop.mailer.flush(),second.mailer.flush()]);assert.equal(calls.length,1);
  const restarted=await Shop.create(settings);t.after(()=>restarted.close());await restarted.mailer.flush();assert.equal(calls.length,1);
});

test('Signierte Zustellung vor Versandantwort wird abgeglichen; alte Ereignisse setzen Status nicht zurück; Rückläufer sperren Folgemails',async t=>{
  const {shop}=await setup(t),calls=mockSend(t,async()=>{const early=signed('email.delivered','early-email');await shop.mailer.webhook(early.body,early.headers);return Response.json({id:'early-email'});});
  const order=await checkout(shop);await shop.acceptPayment(event(order));assert.equal((await shop.s.get('SELECT state FROM mail_deliveries')).state,'delivered');
  const sent=signed('email.sent','early-email');await shop.mailer.webhook(sent.body,sent.headers);await shop.mailer.webhook(sent.body,sent.headers);assert.equal((await shop.s.get('SELECT state FROM mail_deliveries')).state,'delivered');
  assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM mail_events')).n,2);
  const bounced=signed('email.bounced','early-email');await shop.mailer.webhook(bounced.body,bounced.headers);
  await shop.tick();await shop.podbase.advance(order.id);await shop.tick();assert.equal(calls.length,1);
  assert.equal((await shop.s.get("SELECT d.state FROM mail_deliveries d JOIN mail_outbox m ON m.id=d.mail_id WHERE m.kind='shipping'")).state,'suppressed');
  await assert.rejects(shop.mailer.webhook(bounced.body+' ',bounced.headers),e=>e.status===401);
  const old=signed('email.delivered','early-email','msg_old',Math.floor(Date.now()/1000)-1000);await assert.rejects(shop.mailer.webhook(old.body,old.headers),e=>e.status===401);
});

test('Resend-Webhook ist ohne Sitzung erreichbar, verlangt aber die korrekte Signatur',async t=>{
  const app=await createApp({...config(),mailMode:'local'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
  const url=`http://127.0.0.1:${app.server.address().port}/api/webhooks/resend`,valid=signed('email.delivered','fixture-email');
  const rejected=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:valid.body});assert.equal(rejected.status,401);
  const accepted=await fetch(url,{method:'POST',headers:{...valid.headers,'content-type':'application/json'},body:valid.body});assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{received:true});
});

test('Mailvorlagen maskieren HTML, zeigen simuliertes Tracking und senden Adminhinweise an Archenlicht',()=>{
  const order={mode:'test',number:'AL-TEST',amount:2999,recipient:JSON.stringify({...recipient,name:'<script>alert(1)</script>'}),items:JSON.stringify([{quantity:1,title:'Getragen',model:'iPhone 15',configuration:{backgroundId:'mint'},printText:'Für <Anna>',unitPrice:2999}])};
  const p=orderEmail({order,kind:'shipping',statusUrl:'https://www.archenlicht.de/bestellung/test',tracking:'SIM-DE-TEST'});
  assert.ok(!p.html.includes('<script>'));assert.match(p.html,/&lt;script&gt;/);assert.match(p.text,/keine echte Sendung/);assert.match(p.text,/SIM-DE-TEST/);
  const admin=orderEmail({order,kind:'fulfillment-error',statusUrl:'https://www.archenlicht.de/bestellung/test',reason:'Druckpartner nicht erreichbar'});assert.deepEqual(admin.to,['info@archenlicht.de']);assert.match(admin.text,/Druckpartner nicht erreichbar/);
});
