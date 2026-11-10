// Bake the approved original prints into the generated, blank photo scenes.
// White pixels leave the photograph unchanged; ink inherits the real lighting.
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { renderLayout } from '../server/layout.js';
import { MODELS } from '../server/catalog.js';
import { deviceProfile, printFrame } from '../public/device-preview.js';
import { FIXED_BUNDLES } from '../public/fixed-bundles.js';

const directory = resolve('public/assets/bundles-v1');
const model = MODELS.find(m => m.id === 'iphone-14-pro'), profile = deviceProfile(model), frame = printFrame(model, profile);
const placements = {
  hoffnung: [[135,187,356,695],[548,187,356,695],[964,187,356,695]],
  geborgenheit: [[173,234,316,625],[568,234,316,625],[961,234,316,625]]
};
await mkdir(directory, { recursive: true });
for (const bundle of FIXED_BUNDLES) {
  const { data: original, info } = await sharp(await readFile(resolve(directory, `${bundle.id}-scene.webp`))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(original);
  for (const [index, designId] of bundle.designs.entries()) {
    const print = renderLayout({ kind: 'fixed', designId, modelId: model.id, backgroundId: 'white', magsafe: false, dedication: '' });
    const artwork = await sharp(Buffer.from(print.svg)).resize(Math.round(frame.width), Math.round(frame.height)).png().toBuffer();
    const texture = await sharp({ create: { width: profile.width, height: profile.height, channels: 3, background: '#FAFAF8' } }).composite([{ input: artwork, left: Math.round(frame.x), top: Math.round(frame.y) }]).removeAlpha().raw().toBuffer();
    const [left,top,width,height] = placements[bundle.id][index];
    for (let y=top;y<top+height;y++) for (let x=left;x<left+width;x++) {
      const tx=(x-left+.5)/width*(profile.width-1),ty=(y-top+.5)/height*(profile.height-1);
      const x0=Math.floor(tx),y0=Math.floor(ty),x1=Math.min(x0+1,profile.width-1),y1=Math.min(y0+1,profile.height-1),fx=tx-x0,fy=ty-y0;
      const offset=(y*info.width+x)*3;
      for(let c=0;c<3;c++){
        const a=texture[(y0*profile.width+x0)*3+c]*(1-fx)+texture[(y0*profile.width+x1)*3+c]*fx;
        const b=texture[(y1*profile.width+x0)*3+c]*(1-fx)+texture[(y1*profile.width+x1)*3+c]*fx;
        const ink=a*(1-fy)+b*fy;
        result[offset+c]=Math.max(0,Math.min(255,Math.round(original[offset+c]*ink/(c===2?248:250))));
      }
    }
  }
  await sharp(result,{raw:info}).webp({quality:95}).toFile(resolve(directory,`${bundle.id}.webp`));
  console.log(`${bundle.id}: ${bundle.designs.join(', ')} -> ${info.width} x ${info.height}`);
}
