import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {DESIGNS,MODELS} from '../server/catalog.js';
import {renderLayout} from '../server/layout.js';
import {deviceProfile,printFrame} from '../public/device-preview.js';
import {STUDIO_SCENES,studioSceneId} from '../public/studio-scenes.js';
import {prepareStudioMap,composeStudioPixels} from '../public/studio-compositor.js';
const directory=resolve('public/assets/studio-v2/catalog');await mkdir(directory,{recursive:true});
const model=MODELS.find(m=>m.id==='iphone-15'),profile=deviceProfile(model),frame=printFrame(model,profile),id=studioSceneId(model);
const width=672,height=840;
const photo=await sharp(`public/assets/studio-v2/${id}.webp`).resize(width,height).ensureAlpha().raw().toBuffer();
const mask=await sharp(`public/assets/studio-v2/${id}-mask.png`).resize(width,height).ensureAlpha().raw().toBuffer();
const scene=prepareStudioMap(photo,mask,width,height,STUDIO_SCENES[id].quad);
for(const design of DESIGNS){
 const layout=renderLayout({kind:'fixed',modelId:model.id,designId:design.id,backgroundId:'white',magsafe:false,dedication:''});
 const art=await sharp(Buffer.from(layout.svg)).resize(Math.round(frame.width),Math.round(frame.height)).png().toBuffer();
 const ink=await sharp({create:{width:profile.width,height:profile.height,channels:4,background:'#FAFAF8'}}).composite([{input:art,left:Math.round(frame.x),top:Math.round(frame.y)}]).raw().toBuffer();
 const result=composeStudioPixels(scene,{data:ink,width:profile.width,height:profile.height});
 await sharp(result,{raw:{width,height,channels:4}}).webp({quality:94}).toFile(resolve(directory,`${design.id}.webp`));
 console.log(design.id);
}
