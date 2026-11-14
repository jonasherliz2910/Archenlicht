import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createApp, defaultConfig } from '../server/index.js';

test('Öffentliche Dateien fragen keine Kundensitzung ab; Bootstrap bleibt privat und ungecacht',async t=>{
 const app=await createApp({...defaultConfig(),storageMode:'sqlite',dataDir:resolve('test-results',randomUUID()),publicDir:resolve('public'),shopMode:'test',paymentMode:'local',podbaseMode:'local',mailMode:'local',newsletterMode:'local',serverless:true,adminPassword:'Performance-fixture-2026!'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const boot=await fetch(base+'/api/bootstrap'),state=await boot.json(),cookie=boot.headers.get('set-cookie').split(';')[0];
 assert.match(boot.headers.get('cache-control'),/no-store/);
 let lookups=0;const original=app.shop.session.bind(app.shop);app.shop.session=(...args)=>{lookups++;return original(...args);};
 for(const path of ['/kollektion/nach-dem-sturm','/style.css','/fonts/DMSans.woff2','/assets/web-v1/archenlicht-logo.webp']){
  const response=await fetch(base+path,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(response.headers.has('set-cookie'),false);await response.arrayBuffer();
 }
 assert.equal(lookups,0);
 const own=await fetch(base+'/api/bootstrap',{headers:{Cookie:cookie}});assert.equal(lookups,1);assert.equal((await own.json()).csrf,state.csrf);
 const other=await fetch(base+'/api/bootstrap');assert.notEqual((await other.json()).csrf,state.csrf);assert.match(other.headers.get('cache-control'),/no-store/);
});
