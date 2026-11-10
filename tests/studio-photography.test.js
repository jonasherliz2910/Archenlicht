import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {MODELS} from '../server/catalog.js';
import {STUDIO_SCENES,studioSceneId} from '../public/studio-scenes.js';
import {composeStudioPixels} from '../public/studio-compositor.js';
test('Every offered model selects an existing photographic template, including dual/triple Pixels and Flip',async()=>{
 for(const model of MODELS)assert.ok(STUDIO_SCENES[studioSceneId(model)],model.id);
 const scene=id=>studioSceneId(MODELS.find(m=>m.id===id));
 assert.equal(scene('google-pixel-8'),'pixel-bar-dual');assert.equal(scene('google-pixel-8-pro'),'pixel-bar');
 assert.equal(scene('google-pixel-9'),'pixel-pill-dual');assert.equal(scene('google-pixel-10'),'pixel-pill');
 assert.equal(scene('samsung-galaxy-z-flip8'),'galaxy-flip');
 for(const id of Object.keys(STUDIO_SCENES)){
  const photo=await sharp(`public/assets/studio-v2/${id}.webp`).metadata(),mask=await sharp(`public/assets/studio-v2/${id}-mask.png`).metadata();
  assert.equal(photo.width,1122);assert.equal(photo.height,1402);assert.equal(photo.width,mask.width);assert.equal(photo.height,mask.height);
 }
});
test('Recoloring preserves background and real camera pixels; empty case removes camera independently of print',()=>{
 const scene={photo:Uint8ClampedArray.from([240,240,240,255,30,32,35,255,245,245,245,255]),pixels:Float32Array.from([0,.5,.5,1]),holes:Float32Array.from([4,1,0,8])};
 const texture={data:Uint8ClampedArray.from([52,54,56,255]),width:1,height:1};
 const phone=composeStudioPixels(scene,texture),empty=composeStudioPixels(scene,texture,true);
 assert.deepEqual([...phone.slice(4,8)],[30,32,35,255]);assert.deepEqual([...phone.slice(8)],[245,245,245,255]);
 assert.deepEqual([...empty.slice(4,8)],[245,245,245,255]);assert.deepEqual([...empty.slice(0,4)],[...phone.slice(0,4)]);
 assert.ok(phone[0]<80);assert.ok(phone[0]>40);
});
