// Reproducible renderer assets: keep the original drawings and remove the
// photographed paper matte from antialiasing and translucent watercolor.
import sharp from 'sharp';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),output=new URL('public/assets/design-foregrounds-v2/',root);
const manifest=JSON.parse(await readFile(new URL('server/design-package.json',root),'utf8'));
const masks=JSON.parse(await readFile(new URL('public/assets/design-masks-v1/manifest.json',root),'utf8'));
await mkdir(output,{recursive:true});const records={};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t)};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function enclosedInterior(rgb,width,height,id){
  const size=width*height,ink=Buffer.alloc(size),outside=new Uint8Array(size),queue=new Int32Array(size);
  for(let i=0;i<size;i++)ink[i]=rgb[i*3]<150&&rgb[i*3+1]<175&&rgb[i*3+2]<160?255:0;
  // Close short intentional line breaks before finding interiors. Shrink by
  // one extra pixel afterwards so this protection never creates an outer rim.
  const barrier=await sharp(ink,{raw:{width,height,channels:1}}).greyscale().erode(10).raw().toBuffer();
  let head=0,tail=0;const visit=i=>{if(!barrier[i]&&!outside[i]){outside[i]=1;queue[tail++]=i}};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x)}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1)}
  while(head<tail){const i=queue[head++],x=i%width;if(x)visit(i-1);if(x<width-1)visit(i+1);if(i>=width)visit(i-width);if(i<size-width)visit(i+width)}
  const filled=Buffer.from(outside.map(v=>v?0:255));
  const solid=await sharp(filled,{raw:{width,height,channels:1}}).greyscale().dilate(11).blur(.6).raw().toBuffer();
  if(id==='ganz-nah'){
    // The child's arm joins an intentionally open contour. Seed its interior
    // locally, bounded by the original ink, rather than fading it with clothing.
    const skin=Buffer.alloc(size);head=0;tail=0;
    const add=i=>{const x=i%width,y=Math.floor(i/width);if(x>=425&&x<=695&&y>=1015&&y<=1190&&!barrier[i]&&!skin[i]){skin[i]=255;queue[tail++]=i}};
    for(const [x,y] of [[575,1100],[600,1110],[630,1130]])add(y*width+x);
    while(head<tail){const i=queue[head++];add(i-1);add(i+1);add(i-width);add(i+width)}
    const protectedSkin=await sharp(skin,{raw:{width,height,channels:1}}).greyscale().erode(8).blur(.6).raw().toBuffer();
    for(let i=0;i<size;i++)solid[i]=Math.max(solid[i],protectedSkin[i]);
  }
  return solid;
}
for(const record of manifest.designs){
  const id=record.id.replace(/^\d+-/,'').toLowerCase(),filename=record.image.split('/').pop();
  const original=await readFile(new URL(`public/assets/designpaket-v2-farbe/${filename}`,root));
  const {data,info:{width,height}}=await sharp(original).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const maskPath=new URL(`public/assets/design-masks-v1/${id}.png`,root);
  // libvips morphology expands the black background here: a white interior
  // core retreats two pixels, so pale paper cannot form a sticker-like rim.
  const core=await sharp(await readFile(maskPath)).greyscale().threshold(128).dilate(2).blur(.6).raw().toBuffer();
  const enclosed=await enclosedInterior(data,width,height,id);
  const hull=id==='nach-dem-sturm'?await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M350 875 Q350 936 386 967 C450 1002 546 1003 585 965 Q602 933 606 899 Z" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer():null;
  const rgba=Buffer.alloc(width*height*4),bounds=masks[id].bounds;
  for(let y=0;y<height;y++){
    const paper=[0,0,0];
    for(let x=0;x<60;x++)for(let c=0;c<3;c++)paper[c]+=(data[(y*width+x)*3+c]+data[(y*width+width-1-x)*3+c])/120;
    for(let x=0;x<width;x++){
      const i=y*width+x,j=i*3,k=i*4;
      if(x<bounds.x||x>=bounds.x+bounds.width||y<bounds.y||y>=bounds.y+bounds.height)continue;
      const r=data[j],g=data[j+1],b=data[j+2];
      const distance=Math.max(0,paper[0]-r,paper[1]-g,paper[2]-b);
      // Spatial wash selection avoids per-pixel hue thresholds, which would
      // create speckling where watercolor pigment varies slightly.
      const contrast=hull&&y<1120&&hull[k+3]<128?110:150;
      const colorAlpha=smooth((distance-3)/7)*Math.max((distance-3)/(contrast-3),distance/255);
      let interior=core[i]/255;
      // The water is a transparent wash, not an opaque pale sticker. Keep
      // the outlined boat itself and the separate decorative leaves opaque.
      if(hull&&y<1120)interior*=hull[k+3]/255;
      if(id==='ganz-nah'&&y<1205)interior*=1-smooth((y-1095)/65);
      if(id==='getragen'&&y<1150)interior*=1-smooth((y-1020)/85);
      if(id==='getragen'&&x>600&&y<900)interior*=smooth((y-(640+(x-660)*.8))/85);
      // Enclosed skin, wool and other pale fills stay solid even where the
      // adjoining open watercolor edge fades into the case background.
      let protectedInterior=enclosed[i]/255*core[i]/255;
      if(hull&&y<1120)protectedInterior*=hull[k+3]/255;
      interior=Math.max(interior,protectedInterior);
      const alpha=Math.min(1,Math.max(interior,colorAlpha));
      const edgeFade=id==='im-schatten'&&y>900&&y<1220?smooth((x-y+975)/50):1;
      rgba[k+3]=Math.round(alpha*edgeFade*255);
      if(alpha>0)for(let c=0;c<3;c++)rgba[k+c]=Math.max(0,Math.min(255,Math.round((data[j+c]-(1-alpha)*paper[c])/alpha)));
    }
  }
  const png=await sharp(rgba,{raw:{width,height,channels:4}}).png().toBuffer();
  await writeFile(new URL(`${id}.png`,output),png);
  records[id]={sourceHash:digest(original),renderHash:digest(png),bounds};
}
await writeFile(new URL('manifest.json',output),JSON.stringify(records,null,2)+'\n');
console.log('Six matte-corrected RGBA renderer assets generated.');
