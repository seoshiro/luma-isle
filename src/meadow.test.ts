import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createTerrainSurface} from './terrain-surface';
import {distributeOnSurface} from './ground-placement';
import {createMeadow,createMeadowGeometry,meadowDetailScale,meadowWind} from './meadow';

function fixture() {
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(12,12).rotateX(-Math.PI/2));
  const surface=createTerrainSurface([{mesh,role:'ground-top'}],{minY:-1,maxY:1});
  return {surface,hits:distributeOnSurface(surface,{count:240,seed:77})};
}
test('tufts have curved ridged volumetric blades, dark roots, lighter tips and taller accent',()=>{
  const geometries=Array.from({length:5},(_,i)=>createMeadowGeometry(i));
  for(const geometry of geometries) {
    const p=geometry.getAttribute('position'),color=geometry.getAttribute('color');
    assert.ok(geometry.boundingBox!.max.x-geometry.boundingBox!.min.x>.06);
    assert.ok(geometry.boundingBox!.max.z-geometry.boundingBox!.min.z>.06);
    // The four-point base ring has thickness in both horizontal dimensions.
    const a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,1),c=new THREE.Vector3().fromBufferAttribute(p,2);
    assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-6);
    const tip=geometry===geometries[4]?16:12;
    assert.equal(p.getY(0),0);assert.ok(p.getY(tip)>.09);
    assert.ok(color.getY(tip)>color.getY(0));
    const normal=geometry.getAttribute('normal');assert.ok(Array.from(normal.array).every(Number.isFinite));
  }
  assert.ok(geometries[4].boundingBox!.max.y>geometries[0].boundingBox!.max.y*1.5);
  geometries.forEach(g=>g.dispose());
});
test('same hits produce identical stable matrices and rank buffers; geometry stays on its local surface',()=>{
  const {hits}=fixture(),a=createMeadow(hits,{seed:41}),b=createMeadow(hits,{seed:41});
  assert.equal(a.stats.instances,240);assert.ok(a.stats.accents>0);
  assert.equal(a.stats.materials,1);assert.equal(a.stats.groups,a.group.children.length);
  a.group.children.forEach((object,i)=>{
    const first=object as THREE.InstancedMesh,second=b.group.children[i] as THREE.InstancedMesh;
    assert.deepEqual(first.instanceMatrix.array,second.instanceMatrix.array);
    assert.deepEqual(first.geometry.getAttribute('meadowVariation').array,second.geometry.getAttribute('meadowVariation').array);
    assert.equal(first.castShadow,false);assert.equal(first.receiveShadow,true);
    for(let j=0;j<first.count;j++)assert.ok(Math.abs(first.instanceMatrix.array[j*16+13]+.008)<1e-6);
  });a.dispose();b.dispose();
});
test('quality decreases detail while preserving sparse larger accents, and distance is smooth',()=>{
  assert.ok(meadowDetailScale(.5,5,.12,false)<meadowDetailScale(.5,5,.58,false));
  assert.equal(meadowDetailScale(.5,5,.12,true),1);
  for(let d=15;d<48;d+=.01)assert.ok(Math.abs(meadowDetailScale(.5,d,1,false)-meadowDetailScale(.5,d+.01,1,false))<.005);
  assert.equal(meadowDetailScale(.8,60,1,false),0);
  assert.ok(meadowDetailScale(.05,60,.12,true)>0);
});
test('wind has exactly fixed roots and reduced motion removes displacement',()=>{
  for(const time of [0,1,20,500]) {
    assert.equal(meadowWind(0,time,.3,false),0);
    assert.equal(meadowWind(.3,time,.3,true),0);
  }
  assert.notEqual(meadowWind(.3,1,.3,false),0);
});
test('update touches uniforms only, never samples terrain or rebuilds distribution; disposal is idempotent',()=>{
  const {surface,hits}=fixture(),meadow=createMeadow(hits,{maxInstances:100});
  assert.equal(meadow.stats.instances,100);
  surface.sample=()=>{throw new Error('unexpected sampling');};surface.sampleArea=()=>{throw new Error('unexpected sampling');};
  const meshes=[...meadow.group.children] as THREE.InstancedMesh[],versions=meshes.map(m=>m.instanceMatrix.version);
  const material=meshes[0].material as THREE.MeshStandardMaterial;
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
  assert.ok(shader.vertexShader.includes('float meadowDistance'));
  assert.ok(shader.vertexShader.includes('meadowFlex * meadowFlex * meadowWindEnabled'));
  for(let i=0;i<100;i++)meadow.update(i,new THREE.Vector3(0,10,20),{quality:'low',reducedMotion:true});
  assert.ok(meadow.stats.activeInstances<meadow.stats.instances/2);
  assert.ok(meadow.stats.activeTriangles<meadow.stats.triangles/2);
  assert.deepEqual(meshes.map(m=>m.instanceMatrix.version),versions);
  const uniforms=shader.uniforms as Record<string,{value:unknown}>;
  assert.equal(uniforms.meadowWindEnabled.value,0);assert.equal(uniforms.meadowTime.value,0);
  let geometryDisposals=0,materialDisposals=0,instanceDisposals=0;
  meshes.forEach(m=>{m.geometry.addEventListener('dispose',()=>geometryDisposals++);m.addEventListener('dispose',()=>instanceDisposals++);});
  material.addEventListener('dispose',()=>materialDisposals++);
  meadow.dispose();meadow.dispose();
  assert.equal(geometryDisposals,meshes.length);assert.equal(instanceDisposals,meshes.length);assert.equal(materialDisposals,1);
  assert.equal(meadow.stats.disposed,true);assert.equal(meadow.group.children.length,0);
});
test('wind is perceptible, bounded for tall tips and exactly zero at roots',()=>{
  let maximum=0;
  for(let t=0;t<100;t+=.1) {
    maximum=Math.max(maximum,Math.abs(meadowWind(.13,t,.7,false)));
    assert.ok(Math.abs(meadowWind(.4,t,.7,false))<=.014);
    assert.equal(meadowWind(.13,t,.7,false),meadowWind(.4,t,.7,false));
  }
  assert.ok(maximum>.01);
  // With max instance scale 1.2, total XZ sway stays below .019 world units.
  assert.ok(Math.hypot(.014,.006)*1.2<.019);
});
test('clover and optional flowers are volumetric, cheap, eligible only on supplied hits',()=>{
  const clover=createMeadowGeometry(5),flower=createMeadowGeometry(6);
  assert.equal(clover.index!.count/3,96);assert.equal(flower.index!.count/3,56);
  for(const geometry of [clover,flower]) {
    assert.ok(geometry.boundingBox!.max.y>.07);assert.ok(geometry.boundingBox!.max.x>0);
    assert.ok(geometry.boundingBox!.max.z>0);assert.equal(geometry.boundingBox!.min.y,0);
    assert.ok(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite));
    geometry.dispose();
  }
  const {hits}=fixture();let calls=0;
  const meadow=createMeadow(hits,{accentRates:{tall:0,clover:.5,flower:.5},accentEligible:(hit)=>{calls++;return hit.position.x<0;}});
  assert.equal(calls,hits.length);assert.ok(meadow.stats.byType.clover.instances>0);assert.ok(meadow.stats.byType.flower.instances>0);
  assert.ok(meadow.stats.byType.short.instances>0);assert.equal(meadow.stats.byType.tall.instances,0);
  assert.equal(Object.values(meadow.stats.byType).reduce((sum,type)=>sum+type.instances,0),hits.length);
  meadow.dispose();
});
test('centered default region keeps a compact garden in one cell and distant count drops without matrix edits',()=>{
  const {hits}=fixture();
  const compact=hits.map(hit=>({...hit,position:hit.position.clone().multiplyScalar(.2)}));
  const meadow=createMeadow(compact,{accentRates:{tall:0,clover:0,flower:0}});
  assert.equal(meadow.stats.groups,4);
  assert.equal(meadow.stats.triangles,240*130);
  const versions=meadow.group.children.map(mesh=>(mesh as THREE.InstancedMesh).instanceMatrix.version);
  meadow.update(0,new THREE.Vector3(0,0,100));
  assert.ok(meadow.stats.activeInstances<50);
  assert.deepEqual(meadow.group.children.map(mesh=>(mesh as THREE.InstancedMesh).instanceMatrix.version),versions);
  meadow.dispose();
});
