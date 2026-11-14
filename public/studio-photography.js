import {caseColor} from './case-colors.js';
import {deviceProfile,printFrame} from './device-preview.js';
import {STUDIO_SCENES,STUDIO_SOURCE,studioSceneId} from './studio-scenes.js';
import {prepareStudioMap,composeStudioPixels} from './studio-compositor.js';
import {PREVIEW_MODEL,PREVIEW_CATALOG} from './preview-model.js';

const photos=new Map(),images=new Map();
const canvasOf=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function loadImage(url){
 if(!images.has(url)){
  const promise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Fotovorlage nicht verfügbar'));image.src=url;});
  images.set(url,promise);promise.catch(()=>images.delete(url));if(images.size>12)images.delete(images.keys().next().value);
 }
 return images.get(url);
}
async function preparePhoto(id){
 if(!photos.has(id)){
  const promise=(async()=>{
   const [photo,mask]=await Promise.all([loadImage(`/assets/studio-v2/${id}.webp`),loadImage(`/assets/studio-v2/${id}-mask.png`)]);
   const width=840,height=Math.round(width*STUDIO_SOURCE.height/STUDIO_SOURCE.width),canvas=canvasOf(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(photo,0,0,width,height);const pixels=ctx.getImageData(0,0,width,height).data;
   ctx.clearRect(0,0,width,height);ctx.drawImage(mask,0,0,width,height);
   return prepareStudioMap(pixels,ctx.getImageData(0,0,width,height).data,width,height,STUDIO_SCENES[id].quad);
  })();
  photos.set(id,promise);promise.catch(()=>photos.delete(id));if(photos.size>3)photos.delete(photos.keys().next().value);
 }
 return photos.get(id);
}
export async function renderStudioPhotographs({imageUrl,model,backgroundId='white',both=false}){
 const id=studioSceneId(model),[scene,print]=await Promise.all([preparePhoto(id),loadImage(imageUrl)]);
 const profile=deviceProfile(model),frame=printFrame(model,profile),texture=canvasOf(profile.width,profile.height),ctx=texture.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle=caseColor(backgroundId).hex;ctx.fillRect(0,0,texture.width,texture.height);ctx.drawImage(print,frame.x,frame.y,frame.width,frame.height);
 const ink=ctx.getImageData(0,0,texture.width,texture.height);
 return (both?[false,true]:[false]).map(caseOnly=>{
  const out=canvasOf(scene.width,scene.height);out.getContext('2d').putImageData(new ImageData(composeStudioPixels(scene,ink,caseOnly),scene.width,scene.height),0,0);out.dataset.scene=id;return out;
 });
}

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function studioCardMarkup({designId,model,imageUrl,backgroundId='white',label,hash=''}){
 const alt=label||`${model.name} – Fotovorschau der Hülle`;
 // Collection images are already composed: fast first paint without a renderer.
 if(!imageUrl&&backgroundId==='white'&&model.id===PREVIEW_MODEL.id)return `<div class="studio-product-photo" data-studio-card-ready="true" data-studio-model="${PREVIEW_MODEL.id}"><img src="${PREVIEW_CATALOG}/${esc(designId)}.webp" width="672" height="840" alt="${esc(alt)}" loading="lazy" decoding="async"></div>`;
 return `<div class="studio-product-photo" data-studio-card data-studio-model="${esc(model.id)}" data-studio-art="${esc(imageUrl||`/assets/design-${designId}.svg`)}" data-studio-color="${esc(backgroundId)}" data-print-hash="${esc(hash)}" data-studio-card-ready="false" role="img" aria-label="${esc(alt)}" aria-busy="true"><span class="studio-card-status">Foto wird vorbereitet …</span></div>`;
}
export function mountStudioCards(root,models){
 const seen=new WeakSet();let disposed=false;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);draw(entry.target);}},{rootMargin:'240px'});
 async function draw(target){
  try{
   const model=models.find(m=>m.id===target.dataset.studioModel);
   const [photo]=await renderStudioPhotographs({model,imageUrl:target.dataset.studioArt,backgroundId:target.dataset.studioColor});
   if(disposed||!target.isConnected)return;photo.setAttribute('aria-hidden','true');target.replaceChildren(photo);target.dataset.studioCardReady='true';target.setAttribute('aria-busy','false');
  }catch{if(!disposed&&target.isConnected){target.textContent='Foto gerade nicht verfügbar';target.dataset.studioCardReady='error';target.setAttribute('aria-busy','false');}}
 }
 function scan(){for(const card of root.querySelectorAll('[data-studio-card]'))if(!seen.has(card)){seen.add(card);observer.observe(card);}}
 const mutation=new MutationObserver(scan);mutation.observe(root,{childList:true,subtree:true});scan();
 return {dispose(){disposed=true;observer.disconnect();mutation.disconnect();}};
}
