import { deviceProfile, printFrame } from './device-preview.js';
import { caseColor } from './case-colors.js';

// A single offscreen renderer produces stills. No animation loop or third-party
// requests: original print pixels and the selected model define both pictures.
let enginePromise, queue = Promise.resolve();
const imageCache = new Map();
function imageOf(url) {
  if (!imageCache.has(url)) {
    const promise = new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Bild nicht verfügbar')); image.src = url; });
    imageCache.set(url, promise); promise.catch(() => imageCache.delete(url));
    if (imageCache.size > 8) imageCache.delete(imageCache.keys().next().value);
  }
  return imageCache.get(url);
}
function canvasOf(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
async function engine() {
  if (!enginePromise) enginePromise = (async () => {
    const T = await import('./vendor/three/three.module.min.js');
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setSize(900,1125,false); renderer.setPixelRatio(1);
    renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.VSMShadowMap;
    const room=canvasOf(1024,512),rc=room.getContext('2d');rc.fillStyle='#92979b';rc.fillRect(0,0,1024,512);
    rc.fillStyle='#353a40';rc.fillRect(0,360,1024,152);rc.filter='blur(14px)';rc.fillStyle='#ffffff';rc.fillRect(50,80,150,220);rc.fillRect(540,40,260,190);rc.fillRect(930,100,80,270);
    const roomMap=new T.CanvasTexture(room);roomMap.colorSpace=T.SRGBColorSpace;roomMap.mapping=T.EquirectangularReflectionMapping;
    const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(roomMap);pmrem.dispose();roomMap.dispose();
    const lens=new T.Texture(await imageOf('/assets/studio-v1/camera-optics.webp'));lens.colorSpace=T.SRGBColorSpace;lens.needsUpdate=true;
    return {T,renderer,environment,lens};
  })();
  return enginePromise;
}

function roundedPath(T,shape,height,Path=T.Shape) {
  const path=new Path();
  if ('r' in shape) { path.absarc(shape.cx/1000-.5,height-shape.cy/1000,shape.r/1000,0,Math.PI*2,false); return path; }
  const x=shape.x/1000-.5,y=height-(shape.y+shape.height)/1000,w=shape.width/1000,h=shape.height/1000,r=Math.min(shape.radius/1000,w/2,h/2);
  path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);return path;
}
function buildCase(T,profile,texture,lens,hex) {
  const h=profile.height/1000,group=new T.Group(),hardware=new T.Group();group.add(hardware);
  const materials=[],geometries=[];
  const material=options=>{const m=new T.MeshPhysicalMaterial(options);materials.push(m);return m;};
  const side=material({color:hex,roughness:.32,clearcoat:.65,clearcoatRoughness:.2,envMapIntensity:.6});
  const ink=material({map:texture,roughness:.24,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.7});
  const inner=material({color:'#303234',roughness:.48});
  const metal=material({color:'#a4a7a8',metalness:.8,roughness:.26});
  const glass=material({color:'#12171c',metalness:.15,roughness:.16,clearcoat:1});
  const mesh=(geometry,mat,parent=group)=>{geometries.push(geometry);const m=new T.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const extrude=(shape,depth,mat,z,parent=group,bevel=.005)=>{const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:24});const uv=g.attributes.uv,pos=g.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)+.5,pos.getY(i)/h);const m=mesh(g,mat,parent);m.position.z=z;return m;};
  const outline={x:12,y:12,width:976,height:profile.height-24,radius:profile.corner};
  // The rim is hollow; the second still has no phone or camera hardware behind it.
  const wall=roundedPath(T,outline,h);wall.holes.push(roundedPath(T,{x:37,y:37,width:926,height:profile.height-74,radius:Math.max(8,profile.corner-25)},h,T.Path));
  extrude(wall,.09,inner,-.028,group,.005);
  const cover=roundedPath(T,outline,h);cover.holes=profile.openings.map(opening=>roundedPath(T,opening,h,T.Path));
  if(profile.foldY)cover.holes.push(roundedPath(T,{x:18,y:profile.foldY-5,width:964,height:10,radius:2},h,T.Path));
  extrude(cover,.028,[ink,side],.065,group,.012);
  for(const opening of profile.openings){
    const outer='r' in opening?{...opening,r:opening.r+12}:{...opening,x:opening.x-12,y:opening.y-12,width:opening.width+24,height:opening.height+24,radius:opening.radius+12};
    const rim=roundedPath(T,outer,h);rim.holes.push(roundedPath(T,opening,h,T.Path));extrude(rim,.012,side,.093,group,.003);
  }
  const phoneBack=roundedPath(T,{x:25,y:25,width:950,height:profile.height-50,radius:Math.max(8,profile.corner-15)},h);
  extrude(phoneBack,.04,metal,-.015,hardware,.005);
  if(profile.island)extrude(roundedPath(T,profile.island,h),.025,profile.screen?glass:metal,.073,hardware,.006);
  function disk(s,mat,z,depth=.008){const m=mesh(new T.CylinderGeometry(s.r/1000,s.r/1000,depth,64),mat,hardware);m.rotation.x=Math.PI/2;m.position.set(s.cx/1000-.5,h-s.cy/1000,z);return m;}
  const lensFace=new T.MeshBasicMaterial({map:lens,transparent:true,toneMapped:false});materials.push(lensFace);
  for(const s of profile.lenses){disk({...s,r:s.r+4},metal,.112,.025);disk(s,glass,.129,.012);const face=mesh(new T.PlaneGeometry(s.r/500,s.r/500),lensFace,hardware);face.position.set(s.cx/1000-.5,h-s.cy/1000,.137);}
  const flash=material({color:'#f1eee0',roughness:.35,metalness:.1});disk(profile.flash,flash,.11);
  if(profile.sensor)disk(profile.sensor,glass,.11);
  // Subtle controls on the side walls; no logos, fake MagSafe ring or extra art.
  for(const [x,y,length] of [[-.499,h*.67,.2],[.499,h*.64,.25]]){const b=mesh(new T.BoxGeometry(.012,length,.035),side);b.position.set(x,y,.018);}
  group.userData={hardware,materials,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
  return group;
}

async function createStills({preview,model}) {
  const {T,renderer,environment,lens}=await engine(),print=await imageOf(preview.svgUrl),p=deviceProfile(model),h=p.height/1000;
  const textureCanvas=canvasOf(p.width,p.height),ctx=textureCanvas.getContext('2d'),frame=printFrame(model,p),color=caseColor(preview.configuration.backgroundId);
  ctx.fillStyle=color.hex;ctx.fillRect(0,0,p.width,p.height);ctx.drawImage(print,frame.x,frame.y,frame.width,frame.height);
  const texture=new T.CanvasTexture(textureCanvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const scene=new T.Scene();scene.background=new T.Color('#ffffff');scene.environment=environment.texture;
  const body=buildCase(T,p,texture,lens,color.hex);scene.add(body);
  const camera=new T.PerspectiveCamera(32,900/1125,.1,50);camera.position.set(.12,h*.68,4.65);camera.lookAt(0,h*.49,0);
  scene.add(new T.AmbientLight('#ffffff',.65));
  const key=new T.DirectionalLight('#ffffff',3.4);key.position.set(-1.8,10,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=4;key.shadow.camera.bottom=-3;key.shadow.normalBias=.007;key.shadow.bias=-.00005;key.shadow.radius=6;key.shadow.blurSamples=8;scene.add(key);
  const fill=new T.DirectionalLight('#ecf0ff',.7);fill.position.set(3,2,4);scene.add(fill);
  const floorGeometry=new T.PlaneGeometry(200,200),floorMaterial=new T.ShadowMaterial({color:'#343638',opacity:.27}),floor=new T.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
  const shadowCanvas=canvasOf(256,256),sc=shadowCanvas.getContext('2d'),gradient=sc.createRadialGradient(128,128,10,128,128,125);gradient.addColorStop(0,'#00000080');gradient.addColorStop(1,'#00000000');sc.fillStyle=gradient;sc.fillRect(0,0,256,256);
  const shadowMap=new T.CanvasTexture(shadowCanvas),contactGeometry=new T.PlaneGeometry(1.25,.48),contactMaterial=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}),contact=new T.Mesh(contactGeometry,contactMaterial);contact.rotation.x=-Math.PI/2;contact.position.set(0,.001,0);scene.add(contact);
  try {
    return [false,true].map(caseOnly=>{
      body.userData.hardware.visible=!caseOnly;body.rotation.y=caseOnly?-.16:.07;
      // A separately softened floor shadow avoids an unnaturally hard studio
      // outline while keeping artwork and camera glass completely sharp.
      floor.visible=true;contact.visible=true;scene.background=new T.Color('#ffffff');
      body.userData.materials.forEach(m=>{m.colorWrite=false;});
      renderer.render(scene,camera);
      const result=canvasOf(900,1125),out=result.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,900,1125);out.filter='blur(7px)';out.drawImage(renderer.domElement,0,0);out.filter='none';
      body.userData.materials.forEach(m=>{m.colorWrite=true;});floor.visible=false;contact.visible=false;scene.background=null;renderer.setClearColor('#ffffff',0);
      renderer.render(scene,camera);out.drawImage(renderer.domElement,0,0);return result;
    });
  } finally {body.userData.dispose();texture.dispose();floorGeometry.dispose();floorMaterial.dispose();contactGeometry.dispose();contactMaterial.dispose();shadowMap.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();renderer.renderLists.dispose();}
}
export function renderStudioViews(input) {const job=queue.then(()=>input.isCurrent?.()===false?null:createStills(input));queue=job.catch(()=>{});return job;}

export function mountStudioPhotos(root) {
  if(!root?.classList.contains('product-gallery'))return;
  const slides=[...root.querySelectorAll('[data-studio-view]')];let revision=0,disposed=false;
  function invalidate(){revision++;for(const slide of slides){slide.dataset.studioReady='false';slide.setAttribute('aria-busy','true');slide.querySelector('.studio-canvas')?.remove();} }
  return {
    invalidate,
    async update(preview,model,design){
      invalidate();const ticket=revision;
      try {
        const stills=await renderStudioViews({preview,model,isCurrent:()=>!disposed&&ticket===revision});if(!stills||disposed||ticket!==revision)return;
        slides.forEach((slide,index)=>{
          const canvas=stills[index];canvas.className='studio-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${design.title}, ${caseColor(preview.configuration.backgroundId).name}, ${model.name} – ${index?'Hülle mit offener Kameraaussparung':'Hülle am Handy'}, Studiovorschau`);canvas.dataset.printHash=preview.hash;canvas.dataset.model=model.id;slide.prepend(canvas);slide.dataset.studioReady='true';slide.setAttribute('aria-busy','false');
          const thumb=root.querySelector(`[data-preview-thumb-device="${index}"]`);if(thumb){const small=canvasOf(120,150);small.getContext('2d').drawImage(canvas,0,0,120,150);small.dataset.printHash=preview.hash;small.setAttribute('aria-hidden','true');thumb.replaceChildren(small);}
        });
      }catch{if(!disposed&&ticket===revision)for(const slide of slides){slide.dataset.studioReady='fallback';slide.setAttribute('aria-busy','false');}}
    },
    dispose(){disposed=true;revision++;}
  };
}
