import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createIsland} from './world';
import {createInitialState} from './game';
import {installGeometryFixtures,stubSceneCanvas} from './grounding-model-fixtures';
import {meadowGroundColor} from './ground-material';
import {BRIDGE} from './world-layout';
import {maskDistance} from './ground-placement';

test('loaded terrain supports all retained decor, clears bench and keeps garden tree to the side',async()=>{
  const restore=stubSceneCanvas();
  try{
    const world=createIsland();await installGeometryFixtures(world);
    let lightVolumeCount=0;world.root.traverse(object=>{
      if(object instanceof THREE.Mesh&&object.geometry instanceof THREE.ConeGeometry&&object.geometry.parameters.height===9){
        lightVolumeCount++;assert.equal(object.castShadow,false,'transparent light volume cannot cast an opaque cone shadow');
      }
    });assert.equal(lightVolumeCount,1);
    const state=createInitialState();state.stage=4;world.update(state,5,.016,{reducedMotion:true});
    const ground=world.finalizeGrounding(),report=ground.report;
    assert.deepEqual(report.unplaced,[]);assert.equal(report.source.main,'loaded');
    assert.equal(report.records.filter(r=>r.kind==='tree').length,11);
    world.root.updateMatrixWorld(true);
    world.root.traverse(object=>{
      if(object.userData.groundObject?.kind!=='tree')return;
      const origin=object.getWorldPosition(new THREE.Vector3());let crownRadius=0;
      object.traverseVisible(child=>{if(!(child instanceof THREE.Mesh))return;const p=child.geometry.getAttribute('position');for(let i=0;i<p.count;i++){
        const vertex=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(child.matrixWorld).sub(origin);
        crownRadius=Math.max(crownRadius,Math.hypot(vertex.x,vertex.z));
      }});
      assert.ok(maskDistance({id:'entire-bridge-motion',kind:'polygon',points:BRIDGE.sweep},[origin.x,origin.z])-crownRadius>=.299,`${object.userData.groundObject.id}: complete loaded crown clears walking deck and raised bridge`);
    });
    const bench=report.records.find(r=>r.kind==='bench')!,benchTree=report.records.find(r=>r.id==='tree:4.000,5.000')!,gardenTree=report.records.find(r=>r.id==='tree:0.600,-0.900')!;
    assert.ok(Math.hypot(bench.to[0]-benchTree.to[0],bench.to[2]-benchTree.to[2])>1.4);
    assert.ok(benchTree.to[2]>5.9,'close-grass camera keeps its original clear meadow');
    assert.ok(gardenTree.to[0]>1.5,'crown stays beside, not directly behind the arch');
    assert.ok(report.records.find(r=>r.id==='cypress:-5.400,4.300')!.to[2]<3.2,'cypress no longer occupies waterfall path or a cliff cylinder');
    assert.ok(report.records.find(r=>r.id==='lamp:-3.000,4.800')!.to[1]>-.1,'lamp has no cliff pedestal');
    const count=world.root.children.length;assert.equal(world.finalizeGrounding(),ground);assert.equal(world.root.children.length,count);
    const positions=ground.mainSource.sources[0].mesh.geometry.getAttribute('position').array.slice();
    const meadow=world.finalizeMeadow();
    assert.deepEqual(ground.mainSource.sources[0].mesh.geometry.getAttribute('position').array,positions,'material split never moves terrain vertices');
    assert.equal(meadow.stats.main.instances,1800);assert.equal(meadow.stats.garden.instances,170);
    assert.ok(meadow.stats.main.groups+meadow.stats.garden.groups<=60);
    assert.ok(meadow.stats.main.triangles+meadow.stats.garden.triangles<270000);
    world.updateMeadow(3,new THREE.Vector3(8,1.25,6.1),{quality:'low',reducedMotion:true});
    assert.ok(meadow.stats.main.activeInstances<700);world.disposeMeadow();assert.equal(meadow.stats.main.disposed,true);
    assert.equal(state.stage,4);
  }finally{restore();}
});

test('intentional procedural terrain/tree fallback is grounded and distribution repeats after re-entry',async()=>{
  const restore=stubSceneCanvas();
  try{
    let prior:number[][]|null=null;
    for(let run=0;run<2;run++){
      const world=createIsland();await installGeometryFixtures(world,['island','tree']);
      const ground=world.finalizeGrounding();assert.equal(ground.report.source.main,'procedural');assert.deepEqual(ground.report.unplaced,[]);
      const positions=ground.report.records.map(r=>r.to);if(prior)assert.deepEqual(positions,prior);prior=positions;
      const meadow=world.finalizeMeadow();assert.ok(meadow.stats.main.instances>1500);world.disposeMeadow();
    }
  }finally{restore();}
});

test('meadow earth variation is continuous and broad rather than pixel-grain noise',()=>{
  const a=meadowGroundColor(2,3),b=meadowGroundColor(2.001,3.001),c=meadowGroundColor(7,9);
  const delta=(p:THREE.Color,q:THREE.Color)=>Math.abs(p.r-q.r)+Math.abs(p.g-q.g)+Math.abs(p.b-q.b);
  assert.ok(delta(a,b)<.001);assert.ok(delta(a,c)>.005);
});
