import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createIsland} from './world';
import {createInitialState} from './game';
import {installGeometryFixtures,stubSceneCanvas} from './grounding-model-fixtures';
import {islandWind} from './living-wind';
import {visibleThroughParents} from './living-primitives';

test('loaded living details have actual support, one accepted-action path and bounded replay cooldowns',async()=>{
 const restore=stubSceneCanvas();try{
  const world=createIsland();await installGeometryFixtures(world);const ground=world.finalizeGrounding();
  assert.deepEqual(world.root.userData.livingDiagnostics,[]);
  const living=world.living!;assert.deepEqual(living.presence(),{pig:true,boat:true,chime:true,bird:true,door:true,ripple:true});
  const pig=world.root.getObjectByName('Little island keeper')!;assert.equal(pig.userData.placement.supported,true);
  for(const [x,y,z]of pig.userData.footContacts)assert.ok(Math.abs(ground.main.sample(x,z)!.position.y-y)<1e-8);
  const door=world.root.getObjectByName('Secret cliff home')!;assert.equal(door.userData.wallSamples.length,9);assert.equal(door.userData.mountSupported,true);
  const chime=world.root.getObjectByName('Arch wind chime')!;assert.ok(chime.userData.attachment[1]>2.2&&chime.userData.attachment[1]<2.6);
  const perches=world.root.getObjectByName('Two supported bird stops')!;assert.equal(perches.userData.validatedPerches.length,2);
  const decor=world.root.getObjectByName('Small signs of island life')!;assert.deepEqual(Object.keys(decor.userData.attachments).sort(),['birdhouse','weatherVane','workshopShelf']);
  assert.ok(world.root.userData.terrainClearance.removedTriangles>0);
  const islandMeshes:THREE.Mesh[]=[];world.artSlots.island.traverseVisible(o=>{if(o instanceof THREE.Mesh)islandMeshes.push(o)});world.root.updateMatrixWorld(true);
  const trimRay=new THREE.Raycaster(new THREE.Vector3(3.575,1,3.159),new THREE.Vector3(0,-1,0));assert.ok(trimRay.intersectObjects(islandMeshes,false)[0].point.y<.17,'embedded vegetation no longer pierces the real path at the reported QA pixel');
  const state=createInitialState();state.entered=true;const options={quality:'medium' as const,reducedMotion:false,effectiveLighting:'night' as const,camera:new THREE.Vector3(6,2,4)};
  world.update(state,1,.016,options);assert.equal(living.available().boat,false);assert.equal(living.available().chime,false);assert.equal(living.interact('boat'),null);assert.equal(living.interact('chime'),null);
  assert.equal(living.interact('pig')?.cue,'pig');assert.equal(living.interact('pig'),null);assert.equal(living.available().pig,false);
  assert.equal(living.interact('door')?.discovery,'secretDoor');assert.equal(living.interact('door'),null);assert.equal(state.stage,0);assert.equal(state.secretFound,false);
  state.stage=4;state.gates=[true,false,true];world.update(state,10,.016,options);assert.equal(living.interact('boat')?.cue,'boat');assert.equal(living.interact('boat'),null);assert.equal(living.interact('chime')?.cue,'chime');assert.equal(living.interact('chime'),null);
  world.root.updateMatrixWorld(true);const blockedWaterRay=new THREE.Raycaster(new THREE.Vector3(-4.6,5,3.3),new THREE.Vector3(0,-1,0));const solid=blockedWaterRay.intersectObjects(world.occluders.filter(visibleThroughParents),false)[0];assert.ok(solid&&solid.point.y>.3,'procedural crossing belongs to cached input occluders');
  const feet=JSON.stringify(pig.userData.footContacts);ground.main.sample=()=>{throw Error('No per-frame ground queries')};ground.small.sample=()=>{throw Error('No per-frame ground queries')};
  for(let i=0;i<180;i++)world.update(state,10+i/30,1/30,options);assert.equal(JSON.stringify(pig.userData.footContacts),feet);
  living.reset();world.update(state,20,0,{...options,reducedMotion:true,quality:'low'});assert.equal(living.available().pig,true);assert.equal(living.available().boat,true);assert.equal(living.available().chime,true);assert.equal(living.available().bird,true);
  assert.equal(world.root.getObjectByName('Two quiet flocks')!.children.filter(b=>b.visible).length,4);
  assert.equal(living.interact('bird')?.cue,'bird');assert.equal(living.interact('bird'),null);
 }finally{restore()}
});

test('procedural art fallback keeps island grounding and meadow even if a detail is unavailable',async()=>{
 const restore=stubSceneCanvas();try{const world=createIsland();await installGeometryFixtures(world,['island','tree','workshop','observatory']);const ground=world.finalizeGrounding();assert.deepEqual(ground.report.unplaced,[]);assert.ok(world.living);const meadow=world.finalizeMeadow();assert.ok(meadow.stats.main.instances>1500);world.disposeMeadow();}finally{restore()}
});

test('one calm deterministic wind controls gusts and reduced motion stops it',()=>{
 for(let t=0;t<200;t+=.3){assert.deepEqual(islandWind(t),islandWind(t));const w=islandWind(t);assert.ok(w.strength>=.42&&w.strength<=.92);assert.ok(Math.abs(w.lean)<.86);assert.equal(islandWind(t,true).strength,0);assert.equal(islandWind(t,true).lean,0);}
});

test('optional boat failure cannot reveal water while the puzzle is inactive',async()=>{
 const restore=stubSceneCanvas();try{const world=createIsland();await installGeometryFixtures(world);world.root.userData.livingBypassBlocked=true;world.finalizeGrounding();assert.equal(world.living!.presence().boat,false);const state=createInitialState();world.update(state,1,0,{reducedMotion:true});const water=['Continuous sluice water','Continuous wheel tailrace','Wheel bypass water'].map(name=>world.root.getObjectByName(name)!);assert.ok(water.every(mesh=>!mesh.visible));state.gates=[true,false,true];state.stage=1;world.update(state,2,0,{reducedMotion:true});assert.ok(water.every(mesh=>mesh.visible));}finally{restore()}
});
