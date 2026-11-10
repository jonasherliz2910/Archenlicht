import { caseColor } from './case-colors.js';
import { deviceProfile, printFrame } from './device-preview.js';
import { LIFESTYLE_MODEL, LIFESTYLE_SCENES, lifestyleScenes, inversePerspective, projectToCase } from './lifestyle-scenes.js';

const sourceWidth=1122,sourceHeight=1402,renderWidth=840;
const assets=new Map(), scenes=new Map();
function loadImage(url) {
  if(!assets.has(url)){
    const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Das Foto konnte nicht geladen werden.'));img.src=url;});
    assets.set(url,promise);promise.catch(()=>assets.delete(url));
    if(assets.size>6)assets.delete(assets.keys().next().value);
  }
  return assets.get(url);
}
const canvasOf=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;};

async function prepareScene(id) {
  if(!LIFESTYLE_SCENES[id])throw new Error('Unbekannte Fotoansicht.');
  if(!scenes.has(id)){
    const promise=(async()=>{
      const scene=LIFESTYLE_SCENES[id];
      const [image,maskImage]=await Promise.all([loadImage(`/assets/lifestyle-v1/${id}.webp`),loadImage(`/assets/lifestyle-v1/${id}-mask.png`)]);
      const width=renderWidth,height=Math.round(width*sourceHeight/sourceWidth), scale=width/sourceWidth;
      const canvas=canvasOf(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(image,0,0,width,height);const photo=ctx.getImageData(0,0,width,height);
      const maskCanvas=canvasOf(width,height),maskContext=maskCanvas.getContext('2d',{willReadFrequently:true});
      // Reviewed segmentation includes the rounded side walls, while excluding
      // skin, background and camera hardware. White is printable, black is not.
      maskContext.drawImage(maskImage,0,0,width,height);
      const mask=maskContext.getImageData(0,0,width,height).data, matrix=inversePerspective(scene.quad), pixels=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const offset=(y*width+x)*4;if(!mask[offset])continue;
        const [u,v]=projectToCase(matrix,(x+.5)/scale,(y+.5)/scale);
        pixels.push(offset,Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v)),mask[offset]/255);
      }
      return {width,height,photo,pixels:new Float32Array(pixels)};
    })();
    scenes.set(id,promise);promise.catch(()=>scenes.delete(id));
  }
  return scenes.get(id);
}

export async function renderLifestylePhoto({sceneId,imageUrl,model,backgroundId,canvas}) {
  const [scene,print]=await Promise.all([prepareScene(sceneId),loadImage(imageUrl)]);
  const profile=deviceProfile(LIFESTYLE_MODEL), frame=printFrame(model,profile), color=caseColor(backgroundId);
  const texture=canvasOf(profile.width,profile.height), tc=texture.getContext('2d',{willReadFrequently:true});
  tc.fillStyle=color.hex;tc.fillRect(0,0,texture.width,texture.height);
  tc.drawImage(print,frame.x,frame.y,frame.width,frame.height);
  const tex=tc.getImageData(0,0,texture.width,texture.height), result=new Uint8ClampedArray(scene.photo.data);
  for(let i=0;i<scene.pixels.length;i+=4){
    const offset=scene.pixels[i],tx=scene.pixels[i+1]*(tex.width-1),ty=scene.pixels[i+2]*(tex.height-1),alpha=scene.pixels[i+3];
    const x=Math.floor(tx),y=Math.floor(ty),fx=tx-x,fy=ty-y,x1=Math.min(x+1,tex.width-1),y1=Math.min(y+1,tex.height-1);
    for(let channel=0;channel<3;channel++){
      const a=tex.data[(y*tex.width+x)*4+channel]*(1-fx)+tex.data[(y*tex.width+x1)*4+channel]*fx;
      const b=tex.data[(y1*tex.width+x)*4+channel]*(1-fx)+tex.data[(y1*tex.width+x1)*4+channel]*fx;
      const ink=a*(1-fy)+b*fy,base=scene.photo.data[offset+channel];
      const shaded=ink*base/250+Math.max(0,base-240)*(1-ink/255)*.45;
      result[offset+channel]=base*(1-alpha)+shaded*alpha;
    }
  }
  // Render offscreen first; the caller only publishes the latest configuration.
  const output=canvas||canvasOf(scene.width,scene.height);output.width=scene.width;output.height=scene.height;
  output.getContext('2d').putImageData(new ImageData(result,scene.width,scene.height),0,0);
  return output;
}

export function mountLifestylePhotos(root) {
  if(!root)return;
  const entries=[...root.querySelectorAll('[data-lifestyle-view]')].map(slide=>({slide,canvas:slide.querySelector('canvas'),status:slide.querySelector('[data-photo-status]'),thumbnail:root.querySelector(`[data-lifestyle-thumbnail="${slide.dataset.lifestyleView}"]`),thumbnailStatus:root.querySelector(`[data-thumbnail-status="${slide.dataset.lifestyleView}"]`),visible:false,rendered:0}));
  let revision=0,current=null,disposed=false;
  async function draw(entry) {
    if(!current||(!entry.visible&&!entry.thumbnail)||entry.rendered===revision||disposed)return;
    const ticket=revision, snapshot=current;entry.rendered=ticket;
    const view=Number(entry.slide.dataset.lifestyleView), sceneId=lifestyleScenes(snapshot.preview.configuration.designId)[view];
    try{
      const result=await renderLifestylePhoto({sceneId,imageUrl:snapshot.preview.svgUrl,model:snapshot.model,backgroundId:snapshot.preview.configuration.backgroundId});
      if(disposed||ticket!==revision)return;
      entry.canvas.width=result.width;entry.canvas.height=result.height;
      entry.canvas.getContext('2d').drawImage(result,0,0);
      entry.canvas.setAttribute('aria-label',`${snapshot.design.title}, ${caseColor(snapshot.preview.configuration.backgroundId).name}, ${view?'auf einem Tisch':'in einer Hand'} – Designbeispiel am iPhone 14 Pro`);
      entry.canvas.dataset.printHash=snapshot.preview.hash;
      entry.canvas.dataset.scene=sceneId;entry.canvas.hidden=false;entry.status.hidden=true;
      if(entry.thumbnail){
        entry.thumbnail.width=160;entry.thumbnail.height=Math.round(160*result.height/result.width);
        entry.thumbnail.getContext('2d').drawImage(result,0,0,entry.thumbnail.width,entry.thumbnail.height);
        entry.thumbnail.dataset.printHash=snapshot.preview.hash;entry.thumbnail.hidden=false;
        if(entry.thumbnailStatus)entry.thumbnailStatus.hidden=true;
      }
      entry.slide.setAttribute('aria-busy','false');
    }catch{
      if(disposed||ticket!==revision)return;
      entry.status.textContent='Das Foto konnte nicht geladen werden. Deine Gestaltung siehst du in den ersten beiden Ansichten.';entry.slide.setAttribute('aria-busy','false');
    }
  }
  const observer=new IntersectionObserver(items=>{
    for(const item of items){const entry=entries.find(e=>e.slide===item.target);entry.visible=item.isIntersecting;draw(entry);}
  },{root:root.querySelector('.preview-track'),threshold:.05});
  entries.forEach(e=>observer.observe(e.slide));
  function invalidate(message='Dein Foto wird vorbereitet …') {
    revision++;current=null;
    for(const e of entries){e.canvas.hidden=true;e.canvas.removeAttribute('data-print-hash');e.status.hidden=false;e.status.textContent=message;e.slide.setAttribute('aria-busy','true');if(e.thumbnail){e.thumbnail.hidden=true;e.thumbnail.removeAttribute('data-print-hash');if(e.thumbnailStatus)e.thumbnailStatus.hidden=false;}}
  }
  return {
    invalidate,
    update(preview,model,design){invalidate();current={preview,model,design};entries.forEach(draw);},
    dispose(){disposed=true;revision++;observer.disconnect();}
  };
}
