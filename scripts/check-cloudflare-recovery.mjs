import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import { migrationConfig } from '../cloudflare/migration-config.js';

const base = 'https://archenlicht-shop-preview.jonas-herliz2910.workers.dev';
const env = parseEnv(await readFile('cloudflare/.dev.vars', 'utf8'));
assert.match(env.DATABASE_SCHEMA, /^cf_preview_[a-z0-9_]{1,40}$/);
const out = 'test-results/cloudflare-shop-deployed'; await mkdir(out, { recursive: true });
const auth = 'Basic ' + Buffer.from('preview:' + env.MIGRATION_ACCESS_PASSWORD).toString('base64');
function client() {
  const cookies = new Map(); let csrf = '';
  return async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { Authorization: auth, Origin: base, Cookie: [...cookies].map(([k,v]) => k+'='+v).join('; '), ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
    for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0], index = pair.indexOf('='); cookies.set(pair.slice(0,index),pair.slice(index+1)); }
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`Preview HTTP ${response.status}`);
    if (data.csrf) csrf = data.csrf;
    return data;
  };
}
const mode = process.argv[2];
assert.ok(['prepare', 'check', 'parallel'].includes(mode));
if (mode === 'parallel') {
  const clients = Array.from({ length: 6 }, client), start = performance.now();
  const states = await Promise.all(clients.map(call => call('/api/bootstrap')));
  for (const state of states) { assert.equal(state.mode, 'test'); assert.equal(state.isolatedPreview, true); }
  assert.equal(new Set(states.map(s => s.csrf)).size, clients.length);
  const bootstrapMs = Math.round(performance.now() - start);
  const inputs = ['nach-dem-sturm','getragen','absetzen'].map((designId,i) => ({ kind: 'custom', designId, modelId: 'iphone-14-pro', backgroundId: ['black','light-blue','mint'][i], customText: 'Unverwechselbarer Test ' + (i + 1), magsafe: i === 1 }));
  const previewsStart = performance.now();
  const previews = await Promise.all(inputs.map((input,i) => clients[i]('/api/preview','POST',input)));
  for (let i=0;i<inputs.length;i++) for (const key of ['designId','backgroundId','customText','magsafe']) assert.equal(previews[i].configuration[key], inputs[i][key]);
  assert.equal(new Set(previews.map(p => p.hash)).size, 3);
  const previewsMs = Math.round(performance.now() - previewsStart), pngStart = performance.now();
  const pngs = await Promise.all(previews.map((preview,i) => clients[i](preview.pngUrl)));
  for (const png of pngs) assert.equal(png.subarray(1,4).toString(), 'PNG');
  const report = { completed: new Date().toISOString(), simultaneousSessions: 6, simultaneousDistinctPrints: 3, bootstrapMs, previewsMs, pngMs: Math.round(performance.now()-pngStart), passed: true, note: 'Small concurrency check, network wall times only; not a load-capacity guarantee.' };
  await writeFile(out+'/parallel.json',JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
} else {
  // Native code accesses only the isolated schema. It records a simulated paid
  // fixture without running fulfillment, so the deployed alarm must recover it.
  const config = { ...defaultConfig(), ...migrationConfig(env,base), dataDir: resolve(out,'recovery-native') };
  assert.equal(config.shopMode,'test'); assert.equal(config.podbaseMode,'local'); assert.equal(config.mailMode,'local');
  const shop = await Shop.create(config);
  try {
    if (mode === 'prepare') {
      const call = client(), health = await call('/api/health');
      assert.equal(health.mode,'test'); assert.equal(health.simulatedPayments,true); assert.equal(health.simulatedFulfillment,true);
      await call('/api/bootstrap');
      await call('/api/cart','POST',{kind:'fixed',designId:'nach-dem-sturm',modelId:'iphone-14-pro',backgroundId:'light-blue',magsafe:true});
      const checkout = await call('/api/checkout','POST',{method:'card',recipient:{name:'Alarm Recovery Fixture',email:'recovery@example.test',phone:'01721234567',street:'Testweg 1',postalCode:'10115',city:'Berlin',country:'DE'}});
      const order = await shop.s.get('SELECT * FROM orders WHERE id=?',checkout.orderId);
      assert.equal(order.mode,'test');
      await shop.acceptPayment({id:'recovery-'+order.id,orderId:order.id,paymentId:order.payment_id,completed:true,amount:order.amount,currency:'EUR'},{flush:false});
      const leaseUntil = Date.now()+65000;
      await shop.s.run('UPDATE fulfillment SET lease_until=? WHERE order_id=?',leaseUntil,order.id);
      assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders WHERE external_id=?',order.id)).n,0);
      const fixture = {orderId:order.id,leaseUntil,preparedAt:new Date().toISOString(),schema:env.DATABASE_SCHEMA};
      await writeFile(out+'/recovery-fixture.json',JSON.stringify(fixture,null,2));
      console.log('Simulated paid fixture persisted with a 65-second lease. Redeploy now; check polls the database only.');
    } else {
      const fixture = JSON.parse(await readFile(out+'/recovery-fixture.json','utf8'));
      assert.equal(fixture.schema,env.DATABASE_SCHEMA);
      const deadline=Date.now()+120000;let job;
      do {job=await shop.s.get('SELECT state,provider_id,attempts,updated FROM fulfillment WHERE order_id=?',fixture.orderId);if(job?.state==='production')break;await new Promise(r=>setTimeout(r,5000));}while(Date.now()<deadline);
      assert.equal(job?.state,'production');assert.equal(job.attempts,1);assert.ok(job.updated>=fixture.leaseUntil);
      assert.equal((await shop.s.get('SELECT COUNT(*) AS n FROM provider_orders WHERE external_id=?',fixture.orderId)).n,1);
      const report={...fixture,processedAtCloudflare:new Date(job.updated).toISOString(),observedAtLocal:new Date().toISOString(),attempts:job.attempts,state:job.state,passed:true,noShopRequestsDuringObservation:true,timestampNote:'Worker and test machine use different clocks; timestamps are not an elapsed-time measurement.'};
      await writeFile(out+'/recovery.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    }
  } finally {await shop.close();}
}
