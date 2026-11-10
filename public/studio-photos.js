import {caseColor} from './case-colors.js';
import {renderStudioPhotographs} from './studio-photography.js';
const canvasOf=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;};
let queue=Promise.resolve();
export function renderStudioViews(input){
 const job=queue.then(()=>input.isCurrent?.()===false?null:renderStudioPhotographs({imageUrl:input.preview.svgUrl,model:input.model,backgroundId:input.preview.configuration.backgroundId,both:true}));
 queue=job.catch(()=>{});return job;
}

export function mountStudioPhotos(root) {
  if(!root)return;
  const slides=[...root.querySelectorAll('[data-studio-view]')];let revision=0,disposed=false;
  function invalidate(){revision++;for(const slide of slides){slide.dataset.studioReady='false';slide.setAttribute('aria-busy','true');slide.querySelector('.studio-canvas')?.remove();} }
  return {
    invalidate,
    async update(preview,model,design){
      invalidate();const ticket=revision;
      try {
        const stills=await renderStudioViews({preview,model,isCurrent:()=>!disposed&&ticket===revision});if(!stills||disposed||ticket!==revision)return;
        slides.forEach((slide,index)=>{
          const canvas=stills[index];canvas.className='studio-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${design.title}, ${caseColor(preview.configuration.backgroundId).name}, ${model.name} – ${index?'Hülle mit offener Kameraaussparung':'Hülle am Handy'}, Fotovorschau`);canvas.dataset.printHash=preview.hash;canvas.dataset.model=model.id;slide.prepend(canvas);slide.dataset.studioReady='true';slide.setAttribute('aria-busy','false');
          const thumb=root.querySelector(`[data-preview-thumb-device="${index}"]`);if(thumb){const small=canvasOf(120,150);small.getContext('2d').drawImage(canvas,0,0,120,150);small.dataset.printHash=preview.hash;small.setAttribute('aria-hidden','true');thumb.replaceChildren(small);}
        });
      }catch{if(!disposed&&ticket===revision)for(const slide of slides){slide.dataset.studioReady='fallback';slide.setAttribute('aria-busy','false');}}
    },
    dispose(){disposed=true;revision++;}
  };
}
