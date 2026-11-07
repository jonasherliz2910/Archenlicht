import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { MODELS } from '../server/catalog.js';
import { deviceProfile, phoneMockup } from '../public/device-preview.js';
import { DESIGNS } from '../server/catalog.js';
import { renderLayout } from '../server/layout.js';

const model = id => MODELS.find(m=>m.id===id);
test('Flip-Motiv und Drucktext bleiben vollständig unter dem Außendisplay',()=>{
  const m=model('samsung-galaxy-z-flip8');
  for(const d of DESIGNS)for(const kind of ['fixed','custom']){
    const l=renderLayout({kind,modelId:m.id,designId:d.id,verseId:'ps23-1',dedication:'Anna'});
    assert.ok(l.imagePlacement.y>m.template.camera.y+m.template.camera.height);
    assert.ok(l.imagePlacement.y+l.imagePlacement.height<=m.template.height);
    assert.ok(Math.abs(l.imagePlacement.width/l.sourcePixels.width-l.imagePlacement.height/l.sourcePixels.height)<1e-9);
    for(const block of l.typography)assert.ok(block.box.y>m.template.camera.height);
    assert.equal(l.productionApproved,false);
  }
});
test('Jedes Katalogmodell hat begrenzte Geometrie; markante Kamerafamilien bleiben unterscheidbar',()=>{
  for(const m of MODELS){
    const p=deviceProfile(m);assert.equal(p.modelId,m.id);assert.ok(p.height>p.width*1.8&&p.height<p.width*2.4);
    assert.ok(p.openings.length&&p.lenses.length);
    for(const s of p.openings){
      const [x,y,w,h]='r'in s?[s.cx-s.r,s.cy-s.r,s.r*2,s.r*2]:[s.x,s.y,s.width,s.height];
      assert.ok(x>=0&&y>=0&&x+w<=p.width&&y+h<=p.height,m.id);
    }
  }
  assert.equal(deviceProfile(model('iphone-18-pro-max')).family,'apple-pro-plateau');
  assert.ok(deviceProfile(model('iphone-18-pro-max')).openings[0].width>850);
  assert.equal(deviceProfile(model('iphone-15')).lenses.length,2);
  assert.equal(deviceProfile(model('iphone-16e')).lenses.length,1);
  assert.equal(deviceProfile(model('google-pixel-8')).lenses.length,2);
  assert.equal(deviceProfile(model('google-pixel-8-pro')).lenses.length,3);
  assert.notEqual(deviceProfile(model('iphone-15')).family,deviceProfile(model('iphone-15-pro')).family);
  assert.notEqual(deviceProfile(model('samsung-galaxy-s24-ultra')).corner,deviceProfile(model('samsung-galaxy-s26-ultra')).corner);
});

test('Hüllenansicht hat echte transparente Öffnungen und verwendet dasselbe unverzerrte Motiv',async()=>{
  const png=await sharp({create:{width:1200,height:2400,channels:4,background:'#f8f4e9'}}).png().toBuffer();
  const imageUrl=`data:image/png;base64,${png.toString('base64')}`;
  for(const id of ['iphone-18-pro-max','iphone-15','iphone-16e','samsung-galaxy-s26-ultra','google-pixel-11-pro-xl','samsung-galaxy-z-flip8']){
    const m=model(id),p=deviceProfile(m);
    const withPhone=phoneMockup(m,{imageUrl}),shell=phoneMockup(m,{imageUrl,caseOnly:true});
    assert.ok(withPhone.includes('device-hardware'));assert.ok(!shell.includes('device-hardware'));
    const imageTag=html=>html.match(/<image class="device-artwork"[^>]+/)[0];
    assert.equal(imageTag(withPhone),imageTag(shell));
    const proportions=imageTag(shell).match(/width="([\d.]+)" height="([\d.]+)"/);assert.ok(Math.abs(Number(proportions[1])/Number(proportions[2])-.5)<1e-9);
    const svg=html=>html.slice(html.indexOf('<svg'),html.lastIndexOf('</svg>')+6);
    const a=await sharp(Buffer.from(svg(shell))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const b=await sharp(Buffer.from(svg(withPhone))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const point=p.lenses[0],offset=(Math.round(point.cy)*a.info.width+Math.round(point.cx))*4+3;
    assert.equal(a.data[offset],0,`${id}: Öffnung muss transparent sein`);assert.equal(b.data[offset],255,`${id}: Kamera muss sichtbar sein`);
    assert.equal(a.data[(Math.floor(p.height*.8)*a.info.width+500)*4+3],255,`${id}: Hüllenkörper bleibt sichtbar`);
  }
});
