import { inversePerspective, projectToCase } from './lifestyle-scenes.js';

// Same deterministic print composition in the browser and catalog export.
export function prepareStudioMap(photo,mask,width,height,quad,sourceWidth=1122) {
 const matrix=inversePerspective(quad),scale=width/sourceWidth,pixels=[],holes=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const offset=(y*width+x)*4;
  if(mask[offset]){
   const [u,v]=projectToCase(matrix,(x+.5)/scale,(y+.5)/scale);
   pixels.push(offset,Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v)),mask[offset]/255);
  }
  if(mask[offset+1])holes.push(offset,mask[offset+1]/255,mask[offset+2]/255,(y*width+Math.round(width*.08))*4);
 }
 return {photo,width,height,pixels:new Float32Array(pixels),holes:new Float32Array(holes)};
}
export function composeStudioPixels(scene,texture,caseOnly=false) {
 const result=new Uint8ClampedArray(scene.photo),{pixels,holes}=scene;
 for(let i=0;i<pixels.length;i+=4){
  const offset=pixels[i],tx=pixels[i+1]*(texture.width-1),ty=pixels[i+2]*(texture.height-1),alpha=pixels[i+3];
  const x=Math.floor(tx),y=Math.floor(ty),fx=tx-x,fy=ty-y,x1=Math.min(x+1,texture.width-1),y1=Math.min(y+1,texture.height-1);
  for(let c=0;c<3;c++){
   const a=texture.data[(y*texture.width+x)*4+c]*(1-fx)+texture.data[(y*texture.width+x1)*4+c]*fx;
   const b=texture.data[(y1*texture.width+x)*4+c]*(1-fx)+texture.data[(y1*texture.width+x1)*4+c]*fx;
   const ink=a*(1-fy)+b*fy,base=scene.photo[offset+c];
   const specular=Math.pow(Math.max(0,(base-237)/18),2)*95;
   const shaded=ink*base/250+specular*(1-ink/255);
   result[offset+c]=base*(1-alpha)+shaded*alpha;
  }
 }
 if(caseOnly)for(let i=0;i<holes.length;i+=4){
  const offset=holes[i],alpha=holes[i+1],rim=holes[i+2],background=holes[i+3];
  for(let c=0;c<3;c++)result[offset+c]=result[offset+c]*(1-alpha)+(scene.photo[background+c]*(1-rim*.52))*alpha;
 }
 return result;
}
