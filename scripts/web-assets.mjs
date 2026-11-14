import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
await mkdir('public/assets/web-v1', { recursive: true });
await sharp('public/assets/archenlicht-logo.png').resize({width:528}).webp({lossless:true}).toFile('public/assets/web-v1/archenlicht-logo.webp');
await sharp('public/assets/archenlicht-logo.png').resize({width:96}).png().toFile('public/assets/web-v1/favicon.png');
for(const file of ['public/assets/web-v1/archenlicht-logo.webp','public/assets/web-v1/favicon.png'])console.log(`${file}: ${(await stat(file)).size} bytes`);
