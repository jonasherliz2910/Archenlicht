import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { CASE_COLORS,caseColor } from '../public/case-colors.js';
import { printExclusions } from '../public/device-preview.js';
import { DESIGNS,MODELS } from '../server/catalog.js';
import { designAsset } from '../server/design-assets.js';
import { renderLayout,normalizeConfiguration } from '../server/layout.js';
import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
const fixed={kind:'fixed',designId:'getragen',modelId:'iphone-18-pro-max'};
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

test('Neun erlaubte Farben ändern nur Hintergrund und Textkontrast, niemals die Motivskalierung',async()=>{
  assert.equal(CASE_COLORS.length,9);assert.equal(normalizeConfiguration(fixed).backgroundId,'white');
  assert.throws(()=>normalizeConfiguration({...fixed,backgroundId:'url(evil)'}),/Hintergrundfarben/);
  for(const d of DESIGNS){
    let placement;const hashes=new Set();
    for(const color of CASE_COLORS){
      const l=renderLayout({...fixed,designId:d.id,backgroundId:color.id});
      if(placement)assert.deepEqual(l.imagePlacement,placement);placement=l.imagePlacement;hashes.add(l.hash);
      const {data}=await sharp(Buffer.from(l.svg)).resize(120,240).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const expected=color.hex.slice(1).match(/../g).map(c=>parseInt(c,16));
      assert.deepEqual([...data.subarray(0,3)],expected);
      assert.ok(l.svg.includes(`fill="${color.ink}"`));
      assert.ok(l.svg.includes(designAsset(d.id).dataUrl),'Original artwork remains embedded without recoloring');
    }
    assert.equal(hashes.size,9);
  }
});

test('Alle Motive bleiben bei allen Modellen von Kameras und Falz frei und werden nie größer als zuvor',()=>{
  for(const model of MODELS)for(const d of DESIGNS)for(const kind of ['fixed','custom']){
    const l=renderLayout({...fixed,kind,designId:d.id,modelId:model.id,verseId:'ps23-1',dedication:'Für Anna'}),b=l.contentBounds;
    assert.ok(l.imagePlacement.scale<=l.maximumScale);
    assert.ok(b.x>=model.template.safe-.001&&b.x+b.width<=l.width-model.template.safe+.001);
    assert.ok(b.y>=model.template.safe-.001&&b.y+b.height<=l.height-model.template.safe+.001);
    for(const camera of printExclusions(model))assert.equal(overlap(b,{x:camera.x-40,y:camera.y-40,width:camera.width+80,height:camera.height+80}),false,`${model.id}/${d.id}`);
    if(model.template.foldY)assert.ok(b.y>=model.template.foldY+90,`${d.id}: vollständige Gruppe unter dem Scharnier`);
  }
});

test('Die Hintergrundmaske erhält helle Motivinnenflächen und entfernt nur das äußere Papier',async()=>{
  const samples={'ganz-nah':[[420,650],[530,745],[560,980]],'im-schatten':[[440,1090]],getragen:[[600,850]]};
  for(const [id,points] of Object.entries(samples)){
    const asset=designAsset(id),bytes=Buffer.from(asset.maskDataUrl.split(',')[1],'base64');
    const {data,info}=await sharp(bytes).greyscale().raw().toBuffer({resolveWithObject:true});
    assert.equal(data[0],0);
    for(const [x,y] of points)assert.equal(data[y*info.width+x],255,`${id}: helle Innenfläche bleibt erhalten`);
  }
});

test('Farbe bleibt bei Warenkorb, Bearbeitung und Bestellsnapshot erhalten; alte Druckdatei bleibt unverändert',async()=>{
  const shop=await Shop.create({...defaultConfig(),dataDir:resolve('test-results',randomUUID()),adminPassword:'Nur-Test-Admin-2026!',autoShip:false,paymentMode:'local',podbaseMode:'local',mailMode:'local'});
  try{
    const {session}=await shop.createSession();
    const [before]=await shop.saveCart(session,{...fixed,backgroundId:'mint'});
    const oldSvg=await shop.printFile(before.hash,'svg');
    const [after]=await shop.saveCart(session,{...before.configuration,backgroundId:'black',quantity:2},before.id);
    assert.equal(after.id,before.id);assert.equal(after.configuration.backgroundId,'black');assert.notEqual(after.hash,before.hash);
    assert.equal((await shop.cart(session))[0].configuration.backgroundId,'black');
    const checkout=await shop.checkout(session,{method:'card',recipient:{name:'Mara Mustermann',email:'colors@example.test',phone:'+4915112345678',street:'Testweg 12',postalCode:'10115',city:'Berlin',country:'DE'}});
    const saved=JSON.parse((await shop.s.get('SELECT items FROM orders WHERE id=?',checkout.orderId)).items)[0];
    assert.equal(saved.configuration.backgroundId,'black');assert.equal(saved.hash,after.hash);assert.equal(saved.quantity,2);
    assert.equal(await shop.printFile(before.hash,'svg'),oldSvg);
    assert.ok((await shop.printFile(saved.hash,'svg')).includes(caseColor('black').hex));
  }finally{await shop.close()}
});
