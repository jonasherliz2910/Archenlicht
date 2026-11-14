import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DESIGNS } from '../server/catalog.js';
import { LIFESTYLE_SCENES, lifestyleScenes, inversePerspective, projectToCase } from '../public/lifestyle-scenes.js';

test('Photographic perspective preserves all four print corners and rejects a collapsed frame',()=>{
  for(const scene of Object.values(LIFESTYLE_SCENES)){
    const matrix=inversePerspective(scene.quad);
    scene.quad.forEach(([x,y],i)=>{
      const actual=projectToCase(matrix,x,y), expected=[[0,0],[1,0],[1,1],[0,1]][i];
      actual.forEach((value,j)=>assert.ok(Math.abs(value-expected[j])<1e-8));
    });
    const center=scene.quad.reduce((p,q)=>p.map((v,i)=>v+q[i]/4),[0,0]);
    assert.ok(projectToCase(matrix,...center).every(v=>v>.3&&v<.7));
  }
  assert.throws(()=>inversePerspective([[0,0],[0,0],[0,0],[0,0]]));
});

test('Every motif has a hand and table scene, with usable matching masks',async()=>{
  const used=new Set();
  for(const design of DESIGNS){
    const scenes=lifestyleScenes(design.id);
    assert.equal(scenes.length,2);assert.ok(scenes[0].endsWith('-hand'));assert.ok(scenes[1].endsWith('-table'));
    scenes.forEach(id=>{assert.ok(LIFESTYLE_SCENES[id]);used.add(id);});
  }
  assert.equal(used.size,4);
  for(const id of used){
    const photo=await sharp(`public/assets/lifestyle-v2/${id}.webp`).metadata();
    const {data,info}=await sharp(`public/assets/lifestyle-v2/${id}-mask.png`).greyscale().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,photo.width);assert.equal(info.height,photo.height);
    assert.equal(data[0],0);assert.equal(data.at(-1),0);
    const coverage=data.reduce((n,p)=>n+Number(p>127),0)/data.length;
    assert.ok(coverage>.12&&coverage<.4,`${id}: plausible printable case area below the wider camera island`);
    const [flashX, flashY] = { 'female-hand':[700,300], 'female-table':[855,345], 'male-hand':[700,270], 'male-table':[525,365] }[id];
    assert.equal(data[flashY*info.width+flashX], 0, `${id}: the wide camera island stays unprinted`);
  }
});
