import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';
import { summarizePricing } from '../public/bundle-pricing.js';

// Only isolated migration instances; never run fixture purchases on production.
const base = process.argv[2] || 'http://127.0.0.1:8793';
assert.ok(['http://127.0.0.1:8793', 'https://archenlicht-shop-preview.jonas-herliz2910.workers.dev'].includes(base), 'Only the isolated migration preview may be tested.');
const env = parseEnv(await readFile('cloudflare/.dev.vars', 'utf8'));
assert.match(env.DATABASE_SCHEMA, /^cf_preview_[a-z0-9_]{1,40}$/);
const auth = 'Basic ' + Buffer.from('preview:' + env.MIGRATION_ACCESS_PASSWORD).toString('base64');
const report = { base, started: new Date().toISOString(), schema: env.DATABASE_SCHEMA, journeys: [] };
const out = base.startsWith('https:') ? 'test-results/cloudflare-shop-deployed' : 'test-results/cloudflare-shop'; await mkdir(out, { recursive: true });
const client = () => {
  const cookies = new Map(); let csrf = '';
  return async (path, method = 'GET', body, extra = {}) => {
    const response = await fetch(base + path, { method, headers: { Cookie: [...cookies].map(([k,v]) => k+'='+v).join('; '), Origin: base,
      ...(!cookies.has('__Host-archenlicht_migration') ? { Authorization: auth } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }), ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
    for (const header of response.headers.getSetCookie()) { const first = header.split(';')[0], at = first.indexOf('='); cookies.set(first.slice(0,at),first.slice(at+1)); }
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    if (data?.csrf) csrf = data.csrf;
    return { status: response.status, data };
  };
};
assert.equal((await fetch(base + '/api/bootstrap')).status, 401);
const guest = client(), account = client(), stranger = client(), admin = client();
for (const call of [guest, account, stranger, admin]) assert.equal((await call('/api/bootstrap')).status, 200);
const recipient = { name: 'Cloudflare Fixture', email: 'fixture@example.test', phone: '01721234567', street: 'Testweg 1', postalCode: '10115', city: 'Berlin', country: 'DE' };
const fixed = { kind: 'fixed', modelId: 'iphone-14-pro', designId: 'nach-dem-sturm', backgroundId: 'light-blue', magsafe: true };
const custom = { ...fixed, kind: 'custom', designId: 'getragen', customText: 'Du bist gehalten.', dedication: 'Für deinen Weg', backgroundId: 'forest' };
const ids = [];
for (const [call, configuration, name] of [[guest,fixed,'guest-fixed-magsafe'],[account,custom,'account-custom-magsafe']]) {
  if (call === account) assert.equal((await call('/api/auth/register','POST',{email:`cf-${randomUUID()}@example.test`,password:'Fixture-customer-password!'})).status,200);
  assert.equal((await call('/api/cart','POST',configuration,{'X-CSRF-Token':'invalid'})).status,403);
  const cart = await call('/api/cart','POST',configuration);
  assert.equal(cart.status,200,JSON.stringify(cart.data));
  const item=cart.data[0]; assert.equal(item.configuration.printRenderer,'resvg-wasm-2.6.2-srgb300-v1');
  const png=await call(item.pngUrl); assert.equal(png.status,200);
  const metadata=await sharp(png.data).metadata(); assert.equal(metadata.density,300); assert.equal(metadata.space,'srgb');
  const checkout=await call('/api/checkout','POST',{recipient,method:'card',saveAddress:call===account});
  assert.equal(checkout.status,201,JSON.stringify(checkout.data));
  const id=checkout.data.orderId; ids.push(id);
  assert.equal((await stranger(`/api/orders/${id}`)).status,404);
  const paid=await call(`/api/orders/${id}/confirm`,'POST',{}); assert.equal(paid.status,200,JSON.stringify(paid.data));
  assert.equal((await call(`/api/orders/${id}/confirm`,'POST',{})).status,200);
  report.journeys.push({name,orderId:id,printHash:item.hash,width:metadata.width,height:metadata.height,dpi:metadata.density});
  console.log(`Passed ${name}: registration/session, CSRF, print, simulated payment, repeated confirmation and ownership.`);
}
assert.equal((await admin('/api/auth/login','POST',{email:'migration@archenlicht.test',password:env.ADMIN_PASSWORD})).status,200);
const orders=await admin('/api/admin/orders'); assert.equal(orders.status,200);
for(const id of ids) assert.ok(orders.data.some(order=>order.id===id));
const bundleClient=client(); await bundleClient('/api/bootstrap');
const bundle=FIXED_BUNDLES[0];
const items=bundle.designs.map(designId=>({...fixed,designId,magsafe:false}));
const bundleCart=await bundleClient('/api/cart/bundle','POST',{bundleId:bundle.id,requestId:randomUUID(),items});
assert.equal(bundleCart.status,200,JSON.stringify(bundleCart.data)); assert.equal(bundleCart.data.length,3);
const pricing = summarizePricing(bundleCart.data); assert.equal(pricing.percent,10);
assert.equal(pricing.discount,Math.round(pricing.subtotal * .1));
const cancelled=await bundleClient('/api/checkout','POST',{recipient,method:'paypal'});
assert.equal(cancelled.status,201);
assert.equal((await bundleClient(`/api/orders/${cancelled.data.orderId}/cancel`,'POST',{})).status,200);
assert.equal((await bundleClient(`/api/orders/${cancelled.data.orderId}/confirm`,'POST',{})).status,409);
report.journeys.push({name:'three-case-bundle-cancellation',orderId:cancelled.data.orderId,pricing});
report.completed=new Date().toISOString(); report.passed=true;
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log('Protected full-shop runtime checks passed; all provider calls were simulated.');
