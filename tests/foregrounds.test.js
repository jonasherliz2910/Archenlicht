import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DESIGNS} from '../server/catalog.js';
import {designAsset} from '../server/design-assets.js';

const bytes=url=>Buffer.from(url.split(',')[1],'base64');

test('Transparente Motive behalten Quellauflösung und helle Innenflächen ohne Papierhintergrund',async()=>{
  const samples={'ganz-nah':[[420,650],[530,745],[560,980],[575,1130],[630,1155]],'im-schatten':[[440,1090]],getragen:[[600,850]]};
  for(const {id} of DESIGNS){
    const asset=designAsset(id);
    const {data,info}=await sharp(bytes(asset.renderDataUrl)).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.channels,4);
    assert.equal(info.width,asset.sourcePixels.width);assert.equal(info.height,asset.sourcePixels.height);
    assert.equal(data[3],0,'Leeres Papier ist vollständig transparent');
    const original=await sharp(bytes(asset.dataUrl)).removeAlpha().raw().toBuffer();
    for(const [x,y] of samples[id]||[]){
      const i=y*info.width+x;
      // The reviewed raster retouch/placement introduces subpixel differences;
      // skin and wool must still be opaque and retain their original pale tone.
      assert.ok(data[i*4+3]>=250,`${id}: Haut und Wolle bleiben deckend`);
      for(let c=0;c<3;c++)assert.ok(Math.abs(data[i*4+c]-original[i*3+c])<=10,`${id}: helle Innenfarbe bleibt erhalten`);
    }
    const b=asset.inkBounds;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x<b.x||x>=b.x+b.width||y<b.y||y>=b.y+b.height)
      assert.equal(data[(y*info.width+x)*4+3],0,`${id}: keine Streupixel außerhalb der sicheren Motivfläche`);
  }
});

test('Wasser unter dem Boot läuft stufenlos aus und bildet auf Schwarz keinen weißen Fleck',async()=>{
  const asset=designAsset('nach-dem-sturm');
  const {data,info}=await sharp(bytes(asset.renderDataUrl)).raw().toBuffer({resolveWithObject:true});
  const original=await sharp(bytes(asset.dataUrl)).removeAlpha().raw().toBuffer();
  const mask=await sharp(bytes(asset.maskDataUrl)).greyscale().raw().toBuffer();
  const levels=new Set(),background=[52,54,56];let oldBright=0,newBright=0;
  // This region was opaque paper in the former mask, underneath the hull.
  for(let y=1005;y<1100;y++)for(let x=250;x<700;x++){
    const i=y*info.width+x,alpha=data[i*4+3]/255,oldAlpha=mask[i]/255;
    levels.add(data[i*4+3]);
    if(background.every((bg,c)=>original[i*3+c]*oldAlpha+bg*(1-oldAlpha)>180))oldBright++;
    if(background.every((bg,c)=>data[i*4+c]*alpha+bg*(1-alpha)>180))newBright++;
  }
  assert.ok(oldBright>1000,'Vergleichsregion erfasst die bisherige helle Papierkante');
  assert.ok(newBright<oldBright*.01,'Heller Papiersaum auf Schwarz ist entfernt');
  assert.ok(levels.size>100,'Feine Aquarellabstufungen statt binärer Freistellung');
});
