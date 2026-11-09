import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {BUNDLE,priceBundleItems,summarizePricing} from '../public/bundle-pricing.js';
import {Shop} from '../server/shop.js';
import {defaultConfig} from '../server/index.js';
import {Payments,TAX_TREATMENT} from '../server/payments.js';
import {orderEmail} from '../server/mail-templates.js';
import {podbasePayload} from '../server/podbase.js';
const fixed={kind:'fixed',designId:'nach-dem-sturm',modelId:'iphone-14-pro',backgroundId:'black'};
const custom={kind:'custom',designId:'getragen',modelId:'samsung-galaxy-s25',backgroundId:'lilac',customText:'Du bist geliebt.',dedication:'Für Anna',magsafe:true};
const recipient={name:'Bundle Test',email:'bundle@example.test',phone:'+4915112345678',street:'Testweg 12',postalCode:'10115',city:'Berlin',country:'DE'};
const price=(...items)=>summarizePricing(priceBundleItems(items));

test('Bundle ab zwei Stück: 5 % einmal auf die Summe, centgenau auch bei gemischten Mengen',()=>{
 assert.equal(BUNDLE.minimumQuantity,2);assert.equal(price({unitPrice:2999,quantity:1}).discount,0);
 assert.deepEqual(price({unitPrice:2999,quantity:2}),{quantity:2,subtotal:5998,discount:300,total:5698,percent:5,isBundle:true});
 assert.equal(price({unitPrice:2999,quantity:1},{unitPrice:3999,quantity:1}).total,6648);
 // Eleven units expose rounding mistakes from discounting each unit separately.
 const items=priceBundleItems([{unitPrice:2999,quantity:10},{unitPrice:2999,quantity:1}]);
 assert.equal(summarizePricing(items).discount,1649);assert.equal(summarizePricing(items).total,31340);
 assert.equal(items.reduce((s,i)=>s+i.pricing.total,0),31340);
 assert.deepEqual(priceBundleItems(items),items,'Reapplying cannot compound the discount');
 assert.equal(summarizePricing([{unitPrice:2999,quantity:2}]).discount,0,'Historical snapshots are not discounted retroactively');
 assert.throws(()=>summarizePricing([{unitPrice:2999,quantity:1,pricing:{subtotal:2999,discount:500,total:1,percent:5}}]),/gespeicherter/);
});

test('Jede Bundle-Hülle behält eigene Gestaltung; Entfernen, Snapshot, Mail und Podbase bleiben konsistent',async t=>{
 const shop=await Shop.create({...defaultConfig(),shopMode:'test',paymentMode:'local',podbaseMode:'local',mailMode:'local',storageMode:'sqlite',dataDir:resolve('test-results',randomUUID()),autoShip:false});t.after(()=>shop.close());
 const {session}=await shop.createSession();const [first]=await shop.saveCart(session,{...fixed,unitPrice:1,pricing:{discount:99999}});
 let cart=await shop.saveCart(session,custom);assert.equal(summarizePricing(cart).total,6648);assert.equal(cart[0].hash,first.hash);
 assert.notEqual(cart[0].hash,cart[1].hash);assert.equal(cart[1].configuration.customText,custom.customText);assert.equal(cart[1].configuration.magsafe,true);
 const second=cart[1];cart=await shop.saveCart(session,{...custom,backgroundId:'mint'},second.id);assert.equal(cart[0].hash,first.hash);assert.notEqual(cart[1].hash,second.hash);
 cart=await shop.removeCart(session,first.id);assert.equal(summarizePricing(cart).discount,0);assert.equal(summarizePricing(cart).total,3999);
 cart=await shop.saveCart(session,{...fixed,quantity:2});
 const expected=summarizePricing(cart);assert.equal(expected.subtotal,9997);assert.equal(expected.total,9497);
 const checkout=await shop.checkout(session,{method:'card',recipient,amount:1,discount:9999});
 const order=await shop.s.get('SELECT * FROM orders WHERE id=?',checkout.orderId),saved=JSON.parse(order.items);
 assert.equal(order.amount,9497);assert.deepEqual(saved.map(i=>i.pricing),cart.map(i=>i.pricing));
 await shop.removeCart(session,cart[1].id);assert.equal((await shop.s.get('SELECT amount FROM orders WHERE id=?',order.id)).amount,9497);
 const payload=podbasePayload(order,'https://example.test');assert.deepEqual(payload.items.map(i=>i.quantity),saved.map(i=>i.quantity));
 for(const [n,item] of saved.entries()){assert.equal(payload.items[n].variantId,item.variantId);assert.ok(payload.items[n].printFile.endsWith(item.hash+'.png'));}
 const mail=orderEmail({order,kind:'confirmation',statusUrl:'https://example.test/order'});assert.match(mail.text,/Bundle-Rabatt \(5 %\): −5,00/);assert.match(mail.html,/94,97/);
 await assert.rejects(shop.acceptPayment({id:'wrong',orderId:order.id,paymentId:order.payment_id,amount:9997,currency:'EUR',completed:true}),/Betrag/);
 const event={id:'bundle-paid',orderId:order.id,paymentId:order.payment_id,amount:9497,currency:'EUR',completed:true};
 await shop.acceptPayment(event);await shop.acceptPayment(event);await shop.tick();assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders')).n,1);
});

test('Stripe erhält denselben Rabattbetrag separat und prüft ihn bei Zahlungsbestätigung',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const requests=[];
 const items=priceBundleItems([{title:'Motiv',model:'iPhone 14 Pro',configuration:fixed,unitPrice:2999,quantity:10},{title:'Wunschvers',model:'Pixel 9 Pro',configuration:custom,unitPrice:3999,quantity:1}]);
 const pricing=summarizePricing(items),order={id:'bundle-stripe',mode:'test',payment_method:'stripe',payment_id:'cs_test_bundle',amount:pricing.total,recipient:JSON.stringify(recipient),items:JSON.stringify(items)};
 let discount=pricing.discount;
 globalThis.fetch=async(url,options={})=>{
  const params=new URLSearchParams(options.body),path=new URL(url).pathname;requests.push({path,params,headers:options.headers});
  if(path==='/v1/coupons')return Response.json({id:'coupon_bundle',livemode:false,amount_off:pricing.discount,currency:'eur',metadata:{order_id:order.id}});
  if(options.method==='POST')return Response.json({id:'cs_test_bundle',livemode:false,url:'https://checkout.stripe.com/c/pay/cs_test_bundle'});
  return Response.json({id:order.payment_id,client_reference_id:order.id,mode:'payment',payment_status:'paid',status:'complete',livemode:false,metadata:{order_id:order.id,tax_treatment:TAX_TREATMENT},automatic_tax:{enabled:false},amount_total:order.amount,amount_subtotal:pricing.subtotal,total_details:{amount_tax:0,amount_discount:discount},currency:'eur'});
 };
 const payments=new Payments({paymentMode:'sandbox',stripeKey:'sk_test_fixture',baseUrl:'https://example.test'});
 await payments.create(order);await payments.create(order);
 const coupons=requests.filter(r=>r.path==='/v1/coupons'),sessions=requests.filter(r=>r.path==='/v1/checkout/sessions');
 assert.equal(coupons[0].params.get('amount_off'),String(pricing.discount));assert.equal(coupons[0].params.get('max_redemptions'),'1');
 assert.equal(new Headers(coupons[0].headers).get('Idempotency-Key'),new Headers(coupons[1].headers).get('Idempotency-Key'));
 assert.equal(sessions[0].params.get('discounts[0][coupon]'),'coupon_bundle');assert.equal(sessions[0].params.get('line_items[0][price_data][unit_amount]'),'2999');assert.equal(sessions[0].params.get('line_items[0][quantity]'),'10');
 assert.equal((await payments.verify(order)).completed,true);discount--;assert.equal((await payments.verify(order)).completed,false);
 await assert.rejects(payments.create({...order,amount:1}),/Bestellbetrag/);
});
