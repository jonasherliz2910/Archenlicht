// Layout coordinates are normalized; font sizes refer to source width 962.
export function fitText(ctx,text,box,width,height,fontFamily){
 const scale=width/962, limit=box.width*width;
 for(let size=box.maxFont;size>=box.minFont;size-=.5){
  ctx.font=(size*scale)+'px '+fontFamily;
  const words=text.trim().split(/\s+/u), lines=[];let line='';
  for(const word of words){
   if(ctx.measureText(word).width>limit){line=null;break;}
   const candidate=line?line+' '+word:word;
   if(ctx.measureText(candidate).width>limit){lines.push(line);line=word;}else line=candidate;
  }
  if(line===null)continue;
  if(line)lines.push(line);
  const lineHeight=size*scale*1.3;
  if(lines.length<=box.maxLines && lineHeight*lines.length<=box.height*height)return {lines,size:size*scale,lineHeight};
 }
 throw new Error('Der Text passt nicht lesbar in die vorgesehene Fläche. Bitte kürzen oder einen kürzeren Versauszug wählen.');
}
export async function renderDesign(canvas,design,values,{showGuides=false}={}){
 await document.fonts.load('30px ArchenlichtCaveat');
 if(!document.fonts.check('30px ArchenlichtCaveat'))throw new Error('Die Schrift konnte nicht geladen werden.');
 const image=new Image();image.src=design.image;await image.decode();
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 if(Math.abs(w/h-image.naturalWidth/image.naturalHeight)>.001)throw new Error('Abweichendes Seitenverhältnis: Es wird eine geprüfte Modellvorlage benötigt.');
 const blocks=[];
 for(const key of ['reference','excerpt','dedication']){
  const value=String(values[key]||'').trim();if(!value)continue;
  const box=design.boxes[key];blocks.push({box,fit:fitText(ctx,value,box,w,h,'ArchenlichtCaveat')});
 }
 ctx.clearRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);ctx.fillStyle='#163E29';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const {box,fit} of blocks){
  ctx.font=fit.size+'px ArchenlichtCaveat';
  const start=box.y*h+(box.height*h-fit.lines.length*fit.lineHeight)/2+fit.lineHeight/2;
  fit.lines.forEach((line,i)=>ctx.fillText(line,(box.x+box.width/2)*w,start+i*fit.lineHeight));
 }
 if(showGuides){ctx.strokeStyle='#B36A53';ctx.lineWidth=1;ctx.setLineDash([6,5]);for(const box of Object.values(design.boxes))ctx.strokeRect(box.x*w,box.y*h,box.width*w,box.height*h);ctx.setLineDash([]);}
}
