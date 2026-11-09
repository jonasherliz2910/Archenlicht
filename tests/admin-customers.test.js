import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createApp,defaultConfig} from '../server/index.js';
import {passwordHash} from '../server/store.js';
import {adminCustomersPage} from '../public/admin-ui.js';
import {NEWSLETTER_CONSENT_VERSION} from '../public/newsletter-policy.js';
const adminEmail='info@archenlicht.de',adminPassword='Admin-Test-Only-Long-Password!';
const recipient={name:'Anna Kunde',email:'anna@example.test',phone:'0172 1234567',street:'Testweg 1',postalCode:'10115',city:'Berlin',country:'DE'};
const product={kind:'fixed',designId:'nach-dem-sturm',modelId:'iphone-14-pro'};
async function fixture(t) {
 const config={...defaultConfig(),adminEmail,adminPassword,storageMode:'sqlite',dataDir:resolve('test-results','admin-'+randomUUID()),shopMode:'test',podbaseMode:'local',paymentMode:'local',mailMode:'local',newsletterMode:'local',printMode:'preview',serverless:true,autoShip:false};
 const app=await createApp(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const client=()=>{let cookie='',csrf='';return{async call(path,method='GET',data,validCsrf=true){const r=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:base,...(data!==undefined?{'Content-Type':'application/json','X-CSRF-Token':validCsrf?csrf:'invalid'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const body=await r.json();if(body.csrf)csrf=body.csrf;return{status:r.status,body,headers:r.headers};}};};
 const admin=client();await admin.call('/api/bootstrap');assert.equal((await admin.call('/api/auth/login','POST',{email:adminEmail,password:adminPassword})).status,200);
 return {...app,client,admin,config};
}
async function addOrder(shop,session,delivery=recipient) {await shop.saveCart(session,product);return shop.checkout(session,{method:'card',recipient:delivery});}

test('Admin sieht Kundenkonten, Gastkontakte, Lieferdaten, Newsletter und alle Bestellungen; keine Geheimnisse in Antworten',async t=>{
 const {shop,admin}=await fixture(t);
 let {session}=await shop.createSession();const customer=await shop.authenticate(session,{email:recipient.email,password:'Customer-Test-Password!'},true);session=customer.session;
 await shop.saveAddress(session,recipient);await addOrder(shop,session);
 // Gift recipient email differs from the owning account: retain the order in
 // the actual customer's history rather than treating it as an unrelated guest.
 await addOrder(shop,session,{...recipient,name:'Geschenk Empfänger',email:'gift@example.test'});
 const guest=(await shop.createSession()).session;await addOrder(shop,guest,{...recipient,name:'Gast Person',email:'guest@example.test'});
 await shop.newsletter.subscribe({firstName:'Anna',lastName:'Kunde',email:recipient.email,consent:true,consentVersion:NEWSLETTER_CONSENT_VERSION},session,'fixture');
 let r=await admin.call('/api/admin/customers');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.body.total,3);
 const row=r.body.customers.find(c=>c.email===recipient.email);assert.equal(row.order_count,2);assert.equal(row.newsletter_status,'pending');
 const detail=(await admin.call('/api/admin/customers/'+encodeURIComponent(row.contact_key))).body;
 assert.equal(detail.savedAddress.phone,'+491721234567');assert.equal(detail.totalOrders,2);assert.ok(detail.orders.some(o=>o.recipient.email==='gift@example.test'));assert.equal(detail.newsletter.first_name,'Anna');
 const serialized=JSON.stringify({list:r.body,detail});for(const secret of ['password','guest_hash','csrf','confirm_hash','unsubscribe_hash','code_hash','payment_id'])assert.ok(!serialized.includes('"'+secret+'"'),secret);
 r=await admin.call('/api/admin/customers?search=geschenk');assert.equal(r.body.total,1);assert.equal(r.body.customers[0].email,recipient.email);
 assert.equal((await admin.call('/api/admin/customers?filter=guests')).body.total,1);
 assert.equal((await admin.call('/api/admin/customers?filter=newsletter')).body.total,1);
 assert.equal((await admin.call('/api/admin/customers?search='+encodeURIComponent("' OR 1=1 --"))).body.total,0);
 const order=await shop.s.get('SELECT id FROM orders ORDER BY created LIMIT 1');assert.equal((await admin.call('/api/orders/'+order.id)).status,200);
 assert.equal((await admin.call('/api/admin/customers/bad-key')).status,404);
});

test('Gast und Kunde sind serverseitig gesperrt; Rollenmanipulation und bloße Admin-E-Mail gewähren keinen Zugriff',async t=>{
 const {client,shop,admin}=await fixture(t),stranger=client();await stranger.call('/api/bootstrap');
 for(const path of ['/api/admin/customers','/api/admin/customers/account:unknown','/api/admin/orders','/api/admin/mail'])assert.equal((await stranger.call(path)).status,403);
 const customer=await stranger.call('/api/auth/register','POST',{email:'ordinary@example.test',password:'Customer-Test-Password!',role:'admin'});assert.equal(customer.body.user.role,'customer');
 assert.equal((await stranger.call('/api/admin/customers')).status,403);
 assert.equal((await stranger.call('/api/auth/register','POST',{email:adminEmail,password:'Another-Long-Password!',role:'admin'})).status,409);
 assert.equal((await stranger.call('/api/auth/login','POST',{email:adminEmail,password:'Wrong-Long-Password!'})).status,401);
 assert.equal((await stranger.call('/api/admin/customers')).status,403);
 await shop.s.run("UPDATE users SET role='customer' WHERE email=?",adminEmail);assert.equal((await admin.call('/api/admin/customers')).status,403,'A stale session does not retain an old admin role');
});

test('Passwortwechsel verlangt aktuelles Passwort und CSRF, rotiert Sitzung und widerruft andere Anmeldungen',async t=>{
 const {admin,client}=await fixture(t),other=client();await other.call('/api/bootstrap');await other.call('/api/auth/login','POST',{email:adminEmail,password:adminPassword});
 const change={currentPassword:adminPassword,newPassword:'New-Admin-Password-2026!'};
 assert.equal((await admin.call('/api/account/password','POST',change,false)).status,403);
 assert.equal((await admin.call('/api/account/password','POST',{...change,currentPassword:'wrong'})).status,401);
 const result=await admin.call('/api/account/password','POST',change);assert.equal(result.status,200);assert.ok(result.headers.get('set-cookie'));assert.equal(result.body.user.role,'admin');
 assert.equal((await admin.call('/api/admin/customers')).status,200);
 assert.equal((await other.call('/api/admin/customers')).status,403);
 await other.call('/api/bootstrap');
 assert.equal((await other.call('/api/auth/login','POST',{email:adminEmail,password:adminPassword})).status,401);
 assert.equal((await other.call('/api/auth/login','POST',{email:adminEmail,password:change.newPassword})).status,200);
});

test('Anmeldebegrenzung bleibt über neue Browsersitzungen hinweg wirksam',async t=>{
 const {client}=await fixture(t);
 for(let i=0;i<14;i++){const c=client();await c.call('/api/bootstrap');assert.equal((await c.call('/api/auth/login','POST',{email:adminEmail,password:'wrong'})).status,401);}
 const last=client();await last.call('/api/bootstrap');assert.equal((await last.call('/api/auth/login','POST',{email:adminEmail,password:'wrong'})).status,429);
});

test('Kundenliste paginiert vollständig und maskiert dynamische HTML-Inhalte',async t=>{
 const {shop,admin}=await fixture(t),hash=passwordHash('Customer-Test-Password!');
 for(let i=0;i<28;i++)await shop.s.run("INSERT INTO users VALUES(?,?,?,'customer',?)",randomUUID(),`person${i}@example.test`,hash,Date.now()+i);
 const first=(await admin.call('/api/admin/customers')).body,second=(await admin.call('/api/admin/customers?page=2')).body;
 assert.equal(first.customers.length,25);assert.equal(second.customers.length,4);assert.equal(new Set([...first.customers,...second.customers].map(c=>c.email)).size,29);
 const original=globalThis.location;globalThis.location={search:''};t.after(()=>{if(original===undefined)delete globalThis.location;else globalThis.location=original;});
 const html=await adminCustomersPage({user:{role:'admin'}},async()=>({...first,customers:[{...first.customers[0],name:'<script>alert(1)</script>'}]}));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
});
