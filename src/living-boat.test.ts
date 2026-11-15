import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createIsland} from './world';
import {installGeometryFixtures,stubSceneCanvas} from './grounding-model-fixtures';
import {createTerrainSurface} from './terrain-surface';
import {createGroundedWatercourse} from './water-support';
import {createBoat,createBoatRoute,BOAT_ENVELOPE} from './living-boat';

test('loaded terrain supports actual bypass water and full boat envelope clears wheel and underpass',async()=>{
 const restore=stubSceneCanvas();try{
  const world=createIsland();await installGeometryFixtures(world);const ground=world.finalizeGrounding();
  const raw=createTerrainSurface(ground.mainSource.sources,{frame:world.root,minY:-6,maxY:.6,minNormalY:.05,componentPolicy:'all',minComponentArea:0});
  const course=createGroundedWatercourse(raw,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));world.root.add(course.group);world.root.updateMatrixWorld(true);
  assert.equal(course.group.userData.boatBypassSupport.missing.length,0);assert.ok(course.group.userData.boatBypassSupport.maximumDepth<.9);
  const route=createBoatRoute(course.boatStations),p=new THREE.Vector3(),t=new THREE.Vector3(),ray=new THREE.Raycaster();
  let minimumWheel=Infinity;
  for(let distance=0;distance<=route.length;distance+=.012){
   route.sample(distance,p,t);const yaw=Math.atan2(t.x,t.z);
   for(const x of [-BOAT_ENVELOPE.halfWidth,0,BOAT_ENVELOPE.halfWidth])for(const z of [-BOAT_ENVELOPE.halfLength,0,BOAT_ENVELOPE.halfLength]){
    const q=new THREE.Vector3(p.x+x*Math.cos(yaw)+z*Math.sin(yaw),p.y,p.z-x*Math.sin(yaw)+z*Math.cos(yaw));
    const terrain=raw.sample(q.x,q.z);if(terrain)assert.ok(terrain.position.y<q.y-.014,'boat hull clears actual terrain');
    if(distance>.12&&distance<route.length-.12){ray.set(new THREE.Vector3(q.x,1,q.z),new THREE.Vector3(0,-1,0));assert.ok(ray.intersectObjects(course.waterHits,false).length,'entire hull is above actual water geometry')}
    if(Math.abs(q.z-2.25)<.325+.01){const radial=Math.hypot(q.x+3.98,p.y+BOAT_ENVELOPE.height+.009-.94);minimumWheel=Math.min(minimumWheel,radial);assert.ok(radial>1.36+.015,`hull clips wheel at ${q.toArray()}`)}
   }
  }
  assert.ok(minimumWheel<Infinity);
  // Actual geometry raycasts verify overhead clearance, not just nominal path height.
  const paths:THREE.Mesh[]=[];for(const name of ['Continuous limestone paths','Grounded path foundations'])world.root.getObjectByName(name)?.traverse(o=>{if(o instanceof THREE.Mesh){const m=new THREE.Mesh(o.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.matrixAutoUpdate=false;m.matrix.copy(o.matrixWorld);m.updateMatrixWorld(true);paths.push(m)}});
  let overheadSamples=0;
  for(let distance=0;distance<=route.length;distance+=.02){route.sample(distance,p,t);if(p.z<2.7||p.z>3.6)continue;for(const dx of [-.06,0,.06])for(const dz of [-.105,0,.105]){ray.set(new THREE.Vector3(p.x+dx,p.y-.015,p.z+dz),new THREE.Vector3(0,1,0));const overhead=ray.intersectObjects(paths,false)[0];if(overhead&&overhead.point.y<.5){overheadSamples++;assert.ok(overhead.point.y>p.y+BOAT_ENVELOPE.height+.009,`boat hits actual underside y=${overhead.point.y}`)}}}
  assert.ok(overheadSamples>20,'actual crossing geometry was tested');
 }finally{restore()}
});

test('one boat, bounded ripple pool, replay, real waterfall fade and reduced-motion dock',()=>{
 const root=new THREE.Group(),water=new THREE.Mesh(new THREE.PlaneGeometry(1,3),new THREE.MeshBasicMaterial()),stations=[{x:0,z:0,width:.4,waterY:.13},{x:0,z:2,width:.4,waterY:.13}];
 const boat=createBoat(root,{boatStations:stations,waterHits:[water]},{position:new THREE.Vector3(0,.13,2.234),profile:[{y:0,z:-.234,cliffZ:null},{y:-2,z:0,cliffZ:-.2}]});
 assert.equal(boat.launch(0),false);boat.update(0,true,false,false);assert.equal(boat.launch(0),true);assert.equal(boat.launch(.5),false);
 const count=root.children.length;for(let i=1;i<200;i++){boat.update(i*.04,true,false,false);boat.ripple(i*.04)}assert.equal(root.children.length,count);
 boat.update(8,true,false,false);assert.equal(boat.available(8).boat,true);assert.equal(boat.launch(8),true);const start=boat.position();boat.update(9,true,true,false);assert.ok(boat.position().distanceTo(start)<1e-9);boat.update(10,true,true,false);assert.equal(boat.available(10.4).boat,true);
 boat.update(11,false,false,false);assert.equal(water.visible,false);assert.equal(boat.available(11).boat,false);
});

test('keyboard ripples stay on dock water while the boat is below the waterfall lip',()=>{
 const root=new THREE.Group(),stations=[{x:0,z:0,width:.4,waterY:.13},{x:0,z:2,width:.4,waterY:.13}],boat=createBoat(root,{boatStations:stations,waterHits:[]},{position:new THREE.Vector3(0,.13,2.234),profile:[{y:0,z:-.234,cliffZ:null},{y:-2,z:0,cliffZ:-.2}]});boat.update(0,true,false,false);boat.launch(0);const time=createBoatRoute(stations).length/.39+.8;boat.update(time,true,false,false);assert.ok(boat.position().y<.1);assert.equal(boat.ripple(time),true);const rings=root.children.filter(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.RingGeometry) as THREE.Mesh[];assert.ok(rings.slice(0,3).every(ring=>Math.abs(ring.position.y-.142)<1e-8&&Math.abs(ring.position.z)<1e-8));
});
