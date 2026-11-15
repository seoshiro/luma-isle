import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createIsland} from './world';
import {createInitialState} from './game';
import {stubSceneCanvas,installGeometryFixtures} from './grounding-model-fixtures';
import {MAIN_PATHS,pathFootprint,pointInPolygon} from './world-layout';
import {WORKSHOP_CONTROL_Z} from './mechanism-support';
import {createTerrainSurface} from './terrain-surface';
import {supportedWaterStations,type WaterSupportReport} from './water-support';
import {createSupportStoneMaterial} from './support-stone';

test('loaded watercourse sits on real rock, joins its fall, and clears the full cliff',async()=>{
  const restore=stubSceneCanvas();try{
    const world=createIsland();await installGeometryFixtures(world);const ground=world.finalizeGrounding();
    const course=world.root.getObjectByName('Grounded stone watercourse')!,report=course.userData.waterSupport as WaterSupportReport;
    assert.deepEqual(report.missing,[]);assert.ok(report.supportSamples.length>700);assert.ok(report.maximumDepth<.9);
    assert.ok(report.outlet[2]>3.8&&report.outlet[2]<4.3,'loaded cliff outlet replaces unsupported z=5.8 sheet');
    const raw=createTerrainSurface(ground.mainSource.sources,{frame:world.root,minY:-6,maxY:.6,minNormalY:.05,componentPolicy:'all',minComponentArea:0});
    const stations=supportedWaterStations(raw);assert.equal(stations.length,report.stations);
    for(const {x,z,width} of stations)for(let i=0;i<=12;i++)assert.ok(raw.sample(x+(i/6-1)*(width+.18),z),'entire bed/bank cross-section is supported');
    const water=course.getObjectByName('Continuous wheel tailrace') as THREE.Mesh;
    assert.ok(!(water.geometry instanceof THREE.BoxGeometry),'water has no exposed rectangular side wall');
    const normal=(course.getObjectByName('Terrain-seated bed and banks') as THREE.Mesh).geometry.getAttribute('normal');
    for(let i=0;i<normal.count;i+=24){assert.ok(normal.getY(i)>.5,'every main/rotated-branch top faces upward, including the bank ramp beneath the crossing');assert.ok(normal.getY(i+4)<0,'every terrain-following solid bottom faces downward');}
    const fall=world.root.getObjectByName('Sculpted waterfall')!;
    const clearances=fall.userData.cliffClearance as {y:number;z:number;cliffZ:number|null}[];
    assert.equal(clearances.length,41);for(const p of clearances)if(p.cliffZ!==null)assert.ok(p.z-p.cliffZ>=.149);
    world.root.updateMatrixWorld(true);
    for(const mesh of fall.children.filter(c=>c instanceof THREE.Mesh&&c.geometry instanceof THREE.TubeGeometry) as THREE.Mesh<THREE.TubeGeometry>[]){
      const start=mesh.geometry.parameters.path.getPoint(0).applyMatrix4(mesh.matrixWorld);
      assert.ok(Math.abs(start.y-report.outlet[1])<1e-7&&Math.abs(start.z-report.outlet[2])<1e-7,'each ribbon starts at the wet stone lip');
    }
    const state=createInitialState();state.gates=[true,false,true];state.stage=1;world.update(state,2,.1,{reducedMotion:true});assert.equal(fall.visible,true);
    state.gates=[false,false,false];world.update(state,3,.1,{reducedMotion:true});assert.equal(fall.visible,false);
  }finally{restore();}
});

test('workshop controls share hitbox pivots and stationary porch support clear of the route',async()=>{
  const restore=stubSceneCanvas();try{
    const world=createIsland();await installGeometryFixtures(world);world.finalizeGrounding();
    const rack=world.root.getObjectByName('Workshop fixed control rack')!;
    assert.equal(rack.userData.attachmentPoints.length,2);assert.ok(rack.userData.attachmentPoints.every((p:number[])=>p[2]>3.95&&p[2]<4.08));
    world.root.updateMatrixWorld(true);
    const paths=MAIN_PATHS.map(pathFootprint);
    rack.traverse(child=>{if(!(child instanceof THREE.Mesh))return;const positions=child.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(child.matrixWorld);
      assert.ok(!paths.some(path=>pointInPolygon([p.x,p.z],path)),'fixed rack leaves the walking path open');
    }});
    const state=createInitialState();state.disks=[1,2,3];state.stage=2;world.update(state,2,.1,{reducedMotion:true});world.replay('workshop');world.update(state,3,.1,{reducedMotion:true});
    for(let i=0;i<3;i++){
      const disk=world.root.getObjectByName(`Workshop disk ${i}`)!,hit=world.actionHits.find(h=>h.userData.action?.type==='ROTATE_DISK'&&h.userData.action.index===i)!;
      assert.equal(disk.position.z,WORKSHOP_CONTROL_Z);assert.deepEqual(disk.position.toArray(),hit.position.toArray());assert.ok(Math.abs(disk.rotation.z+state.disks[i]*Math.PI/2)<.001);
    }
    assert.equal(rack.rotation.z,0);
    const reward=world.root.getObjectByName('Observatory lens reward')!,cradle=world.root.getObjectByName('Wall-mounted lens cradle')!;
    assert.ok(reward.position.z<-2.6);assert.ok(Math.abs(reward.position.z-cradle.userData.attachmentPoints[0][2]-.16)<1e-7);assert.ok(reward.position.x-.2>.6,'reward clears the door');
    state.stage=2;world.update(state,4,.1,{reducedMotion:true});assert.equal(reward.visible,false);state.stage=3;world.update(state,5,.1,{reducedMotion:true});assert.equal(reward.visible,true);
  }finally{restore();}
});

test('actual pot and lamp bases have physical support at every bottom probe, without moving their XZ layout',async()=>{
  const restore=stubSceneCanvas();try{
    const world=createIsland();await installGeometryFixtures(world);const {report,main}=world.finalizeGrounding();
    const feet=report.records.filter(r=>r.kind==='pot'||r.kind==='lamp');assert.equal(feet.length,10);
    for(const record of feet){
      assert.ok(record.footContacts!.length>30,'not a center-only contact claim');
      const pad=world.root.children.find(child=>child.userData.supports===record.id) as THREE.Mesh|undefined;
      assert.equal(!!pad,record.supportPad);
      for(const [x,y,z] of record.footContacts!){const ground=main.sample(x,z)!;assert.ok(ground);if(y-ground.position.y>.012){assert.ok(pad,`${record.id} needs a real foot pad`);const ray=new THREE.Raycaster(new THREE.Vector3(x,y+1,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(pad,false)[0];assert.ok(hit&&hit.point.y>=y-.008,'solid pad meets underside of furniture');}}
    }
    assert.deepEqual(feet.find(r=>r.id==='pot:-0.550,5.350')!.to.filter((_,i)=>i!==1),[.6710120048123727,5.889901678757411]);
  }finally{restore();}
});

test('procedural fallback attaches supports and retains a fully supported longer channel',async()=>{
  const restore=stubSceneCanvas();try{
    const world=createIsland();await installGeometryFixtures(world,['island','tree','workshop','observatory']);const ground=world.finalizeGrounding();
    assert.deepEqual(ground.report.unplaced,[]);assert.ok(world.root.getObjectByName('Grounded stone watercourse')!.userData.waterSupport.outlet[2]>5.9);
    assert.ok(world.root.getObjectByName('Workshop fixed control rack'));assert.ok(world.root.getObjectByName('Wall-mounted lens cradle'));
  }finally{restore();}
});

test('support stone shader is UV independent and leaves terrain geometry untouched',()=>{
  const material=createSupportStoneMaterial();const shader={vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>'};
  material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
  assert.ok(shader.vertexShader.includes('modelMatrix*vec4(transformed'));assert.ok(shader.fragmentShader.includes('supportJoint'));assert.ok(!shader.fragmentShader.includes('vUv'));
});
