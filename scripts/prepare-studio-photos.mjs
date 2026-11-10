import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {STUDIO_SCENES,STUDIO_SOURCE} from '../public/studio-scenes.js';
const dest=resolve('public/assets/studio-v2'),qa=resolve(process.env.STUDIO_WORK_DIR||'test-results/studio-v2');
await mkdir(dest,{recursive:true});await mkdir(qa,{recursive:true});
const sources=JSON.parse(await readFile('docs/studio-photo-sources.json','utf8'));
const shape=s=>s.path?`<path d="${s.path}"/>`:'r'in s?`<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`:`<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}"/>`;
const svg=body=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${STUDIO_SOURCE.width}" height="${STUDIO_SOURCE.height}"><rect width="100%" height="100%" fill="black"/><g fill="white">${body}</g></svg>`);
for(const source of sources){
 const scene=STUDIO_SCENES[source.id];if(!scene)throw new Error(source.id);
 await sharp(source.source).resize(STUDIO_SOURCE.width,STUDIO_SOURCE.height).webp({quality:95}).toFile(resolve(dest,`${source.id}.webp`));
 await sharp(svg(`<path d="${scene.body}"/>`)).png().toFile(resolve(qa,`${source.id}-body.png`));
 await sharp(svg(scene.openings.map(shape).join(''))).png().toFile(resolve(qa,`${source.id}-camera.png`));
}
console.log(`${sources.length} photographs and mask seeds prepared.`);
