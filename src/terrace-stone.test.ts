import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createTerraceStonework} from './terrace-stone';
import {createTerraceLayer} from './world-geometry';
import {BRIDGE,TERRACE,terraceProfile} from './world-layout';
import {createIsland} from './world';

const meshes=(root:THREE.Object3D)=>{const result:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)result.push(o)});return result};
const resources=(root:THREE.Object3D)=>{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  for(const mesh of meshes(root)){geometries.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value)}}
  return {geometries,materials,textures};
};
function dispose(root:THREE.Object3D){const r=resources(root);for(const item of [...r.geometries,...r.materials,...r.textures])item.dispose()}

test('stonework leaves both terrace meshes and the exact vertical dock plane unchanged',()=>{
  const terrace=createTerraceStonework(),actual=meshes(terrace),reference=[createTerraceLayer(TERRACE.baseRadius,TERRACE.seamRadius,TERRACE.bottomY,TERRACE.seamY),createTerraceLayer(TERRACE.seamRadius,TERRACE.topRadius,TERRACE.seamY,TERRACE.topY,true)];
  assert.equal(actual.length,2);assert.deepEqual(terrace.position.toArray(),[0,0,0]);assert.deepEqual(terrace.scale.toArray(),[1,1,1]);
  actual.forEach((mesh,index)=>{
    assert.deepEqual(mesh.position.toArray(),[0,0,0]);assert.deepEqual(mesh.scale.toArray(),[1,1,1]);
    assert.deepEqual(mesh.geometry.getAttribute('position').array,reference[index].getAttribute('position').array);
    assert.deepEqual(mesh.geometry.getAttribute('normal').array,reference[index].getAttribute('normal').array);assert.equal(mesh.geometry.index,reference[index].index);
    const p=mesh.geometry.getAttribute('position');let max=-Infinity;
    for(let i=0;i<p.count;i++)max=Math.max(max,p.getX(i)*BRIDGE.outward[0]+p.getZ(i)*BRIDGE.outward[1]);assert.ok(Math.abs(max-1.98)<1e-6);
    assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);
  });
  reference.forEach(g=>g.dispose());dispose(terrace);
});

test('every stonework vertex has finite UVs, with separate side and top material ranges',()=>{
  const terrace=createTerraceStonework(),[body,rim]=meshes(terrace),n=terraceProfile(TERRACE.topRadius).length;
  for(const mesh of [body,rim]){
    const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');assert.equal(uv.count,p.count);assert.equal(uv.itemSize,2);
    for(const value of uv.array)assert.ok(Number.isFinite(value)&&value>=-1e-7&&value<=1+1e-7);
    assert.equal(mesh.userData.dynamic,true,'textured meshes must not enter UV-stripping static batching');
  }
  assert.deepEqual(rim.geometry.groups,[{start:0,count:n*6,materialIndex:0},{start:n*6,count:n*3,materialIndex:1}]);
  assert.equal(rim.geometry.groups.reduce((sum,g)=>sum+g.count,0),rim.geometry.getAttribute('position').count);
  assert.ok(Array.isArray(rim.material)&&rim.material.length===2);dispose(terrace);
});

test('stone maps are deterministic, matte, non-displacing and bounded in memory',()=>{
  const a=createTerraceStonework(),b=createTerraceStonework(),ar=resources(a),br=resources(b),at=[...ar.textures],bt=[...br.textures];
  assert.equal(ar.materials.size,3);assert.equal(at.length,6);let bytes=0;
  at.forEach((texture,i)=>{
    assert.ok(texture instanceof THREE.DataTexture);assert.notEqual(texture,bt[i],'each scene owns its textures');
    assert.deepEqual(texture.image.data,(bt[i] as THREE.DataTexture).image.data);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.magFilter,THREE.LinearFilter);assert.equal(texture.generateMipmaps,true);
    bytes+=(texture.image.data as Uint8Array).byteLength;
  });
  assert.ok(bytes<=3*1024*1024,'small local maps must not become a large new asset workload');
  for(const material of ar.materials){assert.ok(material instanceof THREE.MeshStandardMaterial);assert.equal(material.displacementMap,null);assert.equal(material.metalness,0);assert.equal(material.roughness,1);assert.equal(material.roughnessMap,material.bumpMap);assert.equal(material.map!.colorSpace,THREE.SRGBColorSpace);assert.equal(material.bumpMap!.colorSpace,THREE.NoColorSpace)}
  const wall=(at[0] as THREE.DataTexture).image.data as Uint8Array;let min=255,max=0;for(let i=0;i<wall.length;i+=4){min=Math.min(min,wall[i]);max=Math.max(max,wall[i]);assert.equal(wall[i+3],255)}assert.ok(max-min>60,'broad rock faces and recessed joints must remain readable');
  dispose(a);dispose(b);
});

test('ordinary scene cleanup discovers and disposes every owned stonework resource once',()=>{
  const terrace=createTerraceStonework(),r=resources(terrace),items=[...r.geometries,...r.materials,...r.textures],counts=new Map<object,number>();
  assert.equal(r.geometries.size,2);assert.equal(r.materials.size,3);assert.equal(r.textures.size,6);
  for(const item of items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)!+1))}
  // This is the same public material-resource traversal used by IslandScene cleanup.
  dispose(terrace);for(const count of counts.values())assert.equal(count,1);
});

test('world batching preserves textured pedestal UVs and existing bridge/observatory frames',()=>{
  const previous=globalThis.document;Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})}});
  try{
    const world=createIsland(),terrace=world.root.getObjectByName('Aligned terrace and bridge landing')!,body=world.root.getObjectByName('Observatory rock pedestal') as THREE.Mesh,rim=world.root.getObjectByName('Observatory coping and terrace') as THREE.Mesh;
    assert.ok(terrace&&body&&rim);assert.equal(body.parent,terrace);assert.equal(rim.parent,terrace);assert.equal(body.geometry.getAttribute('uv').count,body.geometry.getAttribute('position').count);assert.equal(rim.geometry.getAttribute('uv').count,rim.geometry.getAttribute('position').count);
    assert.deepEqual(terrace.parent!.position.toArray(),[...TERRACE.center]);assert.deepEqual(world.root.getObjectByName('Shared bridge dock')!.position.toArray(),[...BRIDGE.near]);
    assert.equal(world.root.getObjectByName('Folding bridge')!.rotation.x,BRIDGE.raisedAngle);
    dispose(terrace);
  }finally{Object.defineProperty(globalThis,'document',{configurable:true,value:previous})}
});
