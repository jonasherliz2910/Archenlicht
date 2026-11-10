import { mkdir, copyFile } from 'node:fs/promises';
const source=new URL('../node_modules/three/',import.meta.url),target=new URL('../public/vendor/three/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['three.module.min.js','three.core.min.js'])await copyFile(new URL('build/'+name,source),new URL(name,target));
await copyFile(new URL('LICENSE',source),new URL('LICENSE',target));
console.log('Pinned Three.js browser modules and license copied locally.');
