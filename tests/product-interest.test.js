import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp, defaultConfig } from '../server/index.js';
import { berlinMonthStart, monthlyProductInterest } from '../server/product-interest.js';

test('Monthly interest starts at Berlin midnight, including summer time and year changes',()=>{
  for(const [now,start] of [
    ['2026-11-10T12:00:00Z','2026-10-31T23:00:00Z'],
    ['2026-07-10T12:00:00Z','2026-06-30T22:00:00Z'],
    ['2026-12-31T23:30:00Z','2026-12-31T23:00:00Z'],
  ])assert.equal(berlinMonthStart(Date.parse(now)),Date.parse(start));
});

test('Public interest uses actual live fixed-product visits; no test data, carts, repeat views, own session, future dates or small counts',async t=>{
  const app=await createApp({...defaultConfig(),storageMode:'sqlite',shopMode:'test',paymentMode:'local',podbaseMode:'local',printMode:'preview',mailMode:'local',newsletterMode:'local',dataDir:resolve('test-results',randomUUID()),serverless:true,autoShip:false});
  const s=app.shop.s,now=Date.parse('2026-11-10T12:00:00Z'),start=berlinMonthStart(now);
  const add=async(id,{mode='live',kind='fixed',type='view',time=now,design='getragen'}={})=>{
    await s.run('INSERT OR IGNORE INTO visits VALUES(?,?,?,?,?)',id,'unbekannt',null,time,mode);
    await s.run('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)',id,type,kind,design,time);
  };
  for(let i=0;i<105;i++)await add('live-'+i);
  await add('live-1');await add('live-1',{type:'cart'});await add('live-1',{kind:'custom'});
  await add('test',{mode:'test'});await add('expired',{time:start-1});await add('future',{time:now+1});await add('cart-only',{type:'cart'});await add('custom-only',{kind:'custom'});
  for(let i=0;i<99;i++)await add('small-'+i,{design:'absetzen'});
  assert.deepEqual(await monthlyProductInterest(s,{mode:'test',now}),{});
  assert.deepEqual(await monthlyProductInterest(s,{mode:'live',now}),{getragen:100});
  // At the threshold the current visit is not counted as another visit.
  await add('one-more',{design:'absetzen'});
  assert.deepEqual(await monthlyProductInterest(s,{mode:'live',now,excludeVisitId:'one-more'}),{getragen:100});
  assert.deepEqual(await monthlyProductInterest(s,{mode:'live',now}),{absetzen:100,getragen:100});
  const admin=randomUUID();
  await s.run('INSERT INTO users VALUES(?,?,?,?,?)',admin,'studio-qa@example.test','not-a-login-hash','admin',now);
  await s.run('INSERT INTO sessions VALUES(?,?,?,?,?,?)',randomUUID(),'qa',admin,'one-more',now+1000,now);
  assert.deepEqual(await monthlyProductInterest(s,{mode:'live',now}),{getragen:100});
  assert.deepEqual(await monthlyProductInterest(s,{mode:'live',now:Date.parse('2026-12-01T00:00:00Z')}),{});
  // Bootstrap does not expose analytics identifiers or seed a popularity claim.
  const {session}=await app.shop.createSession();const state=await app.shop.publicState(session);
  assert.deepEqual(state.productInterest,{});
});
