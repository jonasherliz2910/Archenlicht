// Import the reviewed image_gen outputs. No colour correction or repainting:
// retain their RGBA pixels and fit them proportionally inside the approved footprint.
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const folder=process.argv[2];
if(!folder)throw new Error('Usage: node scripts/import-retouched-artwork.mjs <generated-image-directory>');
const files={
 'unter-seinen-fluegeln':'exec-abea797d-fdc7-4512-89df-39aa1b5d2804.png',
 'nach-dem-sturm':'exec-ce359db3-e7b9-4379-b311-d355d48757a5.png',
 absetzen:'exec-e95da443-79e9-4c0f-a718-45100ad0c9dd.png',
 'ganz-nah':'exec-d3d4948a-3372-4bd1-9c78-78e98e1e48bc.png',
 'im-schatten':'exec-eed0e3d0-7446-495a-abca-f49d1848aa7e.png',
 getragen:'exec-44c7f15d-f963-4b74-bca2-36ee0b6dff54.png'
};
const old=JSON.parse(await readFile('public/assets/design-foregrounds-v2/manifest.json','utf8'));
const manifest={},hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const destination='public/assets/design-foregrounds-v3';
await mkdir(destination,{recursive:true});
for(const [id,file] of Object.entries(files)){
 const source=await readFile(resolve(folder,file));
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const canvas=await sharp(`public/assets/design-foregrounds-v2/${id}.png`).metadata();
 let x0=info.width,y0=info.height,x1=-1,y1=-1;
 // Locate visible artwork, excluding effectively invisible generator noise in
 // the empty margins. Keep two extra pixels around it for antialiasing.
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){
  x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
 }
 if(x1<0)throw new Error(`Empty artwork: ${id}`);
 const crop={left:Math.max(0,x0-2),top:Math.max(0,y0-2),width:Math.min(info.width-1,x1+2)-Math.max(0,x0-2)+1,height:Math.min(info.height-1,y1+2)-Math.max(0,y0-2)+1};
 const bounds=old[id].bounds;
 const scale=Math.min(1,bounds.width/crop.width,bounds.height/crop.height);
 const width=Math.floor(crop.width*scale),height=Math.floor(crop.height*scale);
 const left=bounds.x+Math.floor((bounds.width-width)/2),top=bounds.y+Math.floor((bounds.height-height)/2);
 const artwork=await sharp(source).extract(crop).resize(width,height,{fit:'inside'}).png().toBuffer();
 const bytes=await sharp({create:{width:canvas.width,height:canvas.height,channels:4,background:'#00000000'}}).composite([{input:artwork,left,top}]).png().toBuffer();
 await writeFile(`${destination}/${id}.png`,bytes);
 manifest[id]={sourceHash:old[id].sourceHash,renderHash:hash(bytes),bounds,retouch:{method:'image_gen',inputRenderHash:old[id].renderHash,generatedFile:file,generatedHash:hash(source),crop,placement:{left,top,width,height},scale}};
 console.log(`${id}: ${canvas.width}x${canvas.height}, proportional placement, scale ${scale.toFixed(4)}`);
}
await writeFile(`${destination}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
