import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DESIGNS, MODELS } from '../server/catalog.js';
import { renderLayout } from '../server/layout.js';

test('Die CDN-Ausgabe enthält gültige Bundles und unveränderte öffentliche Motive, keine Sitzung',()=>{
 const result=spawnSync(process.execPath,['scripts/build-web.mjs'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const index=readFileSync('dist/index.html','utf8');
 assert.match(index,/<title>Archenlicht/);assert.equal(index.includes('<!--PAGE_TITLE-->'),false);
 assert.equal((index.match(/rel="stylesheet"/g)||[]).length,1);
 for(const [,path] of index.matchAll(/(?:src|href)="(\/_app\/[^" ]+)"/g))assert.ok(existsSync(resolve('dist','.'+path)),path);
 const startup=readFileSync(resolve('dist','.'+index.match(/src="(\/_app\/startup-[^"]+)"/)[1]),'utf8');
 assert.match(startup,/api\/bootstrap/);assert.ok(startup.indexOf('fetch(')<startup.indexOf('import('));
 assert.equal(/sessionExpires|"csrf"|archenlicht_session/.test(index),false);
 for(const design of DESIGNS){
  assert.match(readFileSync(`dist/_pages/kollektion/${design.id}.html`,'utf8'),new RegExp(`<title>${design.title}`));
  assert.equal(readFileSync(`dist/assets/design-${design.id}.svg`,'utf8'),renderLayout({kind:'fixed',designId:design.id,modelId:MODELS[0].id}).svg);
 }
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.equal(config.outputDirectory,'dist');
 assert.ok(config.rewrites.find(r=>r.source==='/api/:path*').destination.includes('/api/shop'));
 assert.equal(config.headers.some(r=>r.source==='/api/:path*'&&r.headers.some(h=>h.key==='Cache-Control'&&h.value.includes('public'))),false);
});
