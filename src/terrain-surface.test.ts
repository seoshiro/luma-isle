import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createTerrainSurface,surfaceRandom} from './terrain-surface';

const plane=(width=4,depth=4,y=0):THREE.Mesh=>{
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2));
  mesh.position.y=y;return mesh;
};
const source=(mesh:THREE.Mesh)=>({mesh,role:'island-body' as const});
const close=(actual:number,expected:number,epsilon=1e-6)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);

test('terrain uses exact parent/world transforms and a requested reference frame',()=>{
  const frame=new THREE.Group();frame.position.set(8,3,-2);frame.rotation.y=.4;frame.scale.set(1.2,.7,1.6);
  const mesh=plane();mesh.position.set(1,.2,2);mesh.scale.set(2,1,.5);frame.add(mesh);
  const local=createTerrainSurface([source(mesh)],{frame,minY:0,maxY:1});
  close(local.sample(1,2)!.position.y,.2);
  close(local.diagnostics.projectedArea,16);
  const worldPoint=frame.localToWorld(new THREE.Vector3(1,.2,2));
  const world=createTerrainSurface([source(mesh)],{minY:2,maxY:5});
  close(world.sample(worldPoint.x,worldPoint.z)!.position.y,worldPoint.y);
  assert.deepEqual(mesh.position.toArray(),[1,.2,2]);
  assert.deepEqual(mesh.scale.toArray(),[2,1,.5]);
});

test('mirrored transforms retain upward ground and singular transforms are rejected',()=>{
  const mesh=plane();mesh.scale.x=-1;
  const surface=createTerrainSurface([source(mesh)],{minY:-1,maxY:1});
  assert.equal(surface.faces.length,2);close(surface.sample(0,0)!.normal.y,1);
  mesh.scale.y=0;
  assert.throws(()=>createTerrainSurface([source(mesh)],{minY:-1,maxY:1}),/singular/);
});

test('ground height band and connected meadow reject cliffs and detached raised fragments',()=>{
  const main=plane(4,4),shelf=plane(3,3,-2),fragment=plane(.3,.3,.3),steep=plane();
  fragment.position.x=6;steep.rotation.z=1.25;steep.position.x=10;
  const surface=createTerrainSurface([main,shelf,fragment,steep].map(source),{minY:-.5,maxY:.6});
  assert.equal(surface.faces.length,2);assert.equal(surface.diagnostics.components,2);
  assert.equal(surface.sample(6,0),null);assert.equal(surface.sample(10,0),null);
  close(surface.sample(0,0)!.position.y,0);
  assert.ok(surface.diagnostics.rejectedHeight>0);
  // An unrelated scene roof is deliberately absent from explicit terrain sources.
  const roof=plane(10,10,3),scene=new THREE.Group();scene.add(main,roof);
  assert.equal(createTerrainSurface([source(main)],{minY:-.5,maxY:4}).faces.length,2);
});

test('UV-seam duplicate positions join topological components without changing source vertices',()=>{
  const mesh=plane();mesh.geometry=mesh.geometry.toNonIndexed();
  const original=Array.from(mesh.geometry.getAttribute('position').array);
  const surface=createTerrainSurface([source(mesh)],{minY:-1,maxY:1});
  assert.equal(surface.diagnostics.components,1);assert.equal(surface.faces.length,2);
  assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),original);
  const geometry=surface.createGeometry();assert.equal(geometry.getAttribute('position').count,6);geometry.dispose();
});

test('surface queries preserve holes, choose the upper face and area samples are seeded',()=>{
  const a=plane(2,2),b=plane(2,2);a.position.x=-2;b.position.x=2;
  const surface=createTerrainSurface([a,b].map(source),{minY:-1,maxY:1,componentPolicy:'all'});
  assert.equal(surface.sample(0,0),null);assert.ok(surface.sample(-2,0));assert.ok(surface.sample(2,0));
  const seedA=surfaceRandom('meadow'),seedB=surfaceRandom('meadow');
  for(let i=0;i<100;i++){
    const first=surface.sampleArea(seedA)!,second=surface.sampleArea(seedB)!;
    assert.deepEqual(first.position.toArray(),second.position.toArray());
    assert.ok(surface.sample(first.position.x,first.position.z));
    close(first.barycentric.reduce((sum,n)=>sum+n,0),1);
  }
  const upper=plane(2,2,.3);
  const stacked=createTerrainSurface([source(plane()),source(upper)],{minY:-1,maxY:1,componentPolicy:'all'});
  close(stacked.sample(0,0)!.position.y,.3);
});

test('empty and invalid surfaces fail safely',()=>{
  const empty=createTerrainSurface([],{minY:-1,maxY:1});
  assert.equal(empty.sample(0,0),null);assert.equal(empty.sampleArea(surfaceRandom(1)),null);
  assert.throws(()=>createTerrainSurface([],{minY:1,maxY:0}),/height/);
  assert.throws(()=>createTerrainSurface([],{minY:0,maxY:1,cellSize:0}),/cellSize/);
  assert.throws(()=>createTerrainSurface([],{minY:0,maxY:1,minNormalY:0}),/minNormalY/);
});

/** Read only the bundled geometry. No loader, DOM, textures or network needed. */
function bundledIsland() {
  const bytes=readFileSync(new URL('../public/models/island.glb',import.meta.url));
  const jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  const binary=bytes.subarray(28+jsonLength);
  const read=(accessorIndex:number)=>{
    const accessor=gltf.accessors[accessorIndex],view=gltf.bufferViews[accessor.bufferView];
    const elements=accessor.type==='VEC3'?3:1,bytesPerElement=accessor.componentType===5126?4:2;
    const result:number[]=[];
    for(let i=0;i<accessor.count;i++)for(let j=0;j<elements;j++){
      const offset=(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??elements*bytesPerElement)+j*bytesPerElement;
      result.push(accessor.componentType===5126?binary.readFloatLE(offset):binary.readUInt16LE(offset));
    }
    return result;
  };
  const primitive=gltf.meshes[0].primitives[0];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(read(primitive.attributes.POSITION),3));geometry.setIndex(read(primitive.indices));
  geometry.computeBoundingBox();const bounds=geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const mesh=new THREE.Mesh(geometry);mesh.position.set(-center.x,-bounds.min.y,-center.z);
  const wrapper=new THREE.Group();wrapper.scale.set(24.5/size.x,5.8/size.y,16/size.z);wrapper.position.y=-(.164-bounds.min.y)*wrapper.scale.y;wrapper.add(mesh);
  return {mesh,wrapper};
}

test('real island GLB selects its connected meadow and reproduces audited support failures',()=>{
  const {mesh}=bundledIsland();
  const surface=createTerrainSurface([source(mesh)],{minY:-.48,maxY:.6});
  assert.equal(surface.diagnostics.sourceTriangles,34494);
  assert.ok(surface.faces.length>4500&&surface.faces.length<5200);
  assert.ok(surface.diagnostics.projectedArea>200&&surface.diagnostics.projectedArea<220);
  assert.equal(surface.sample(-8,3),null,'mill-left tree has no ground');
  assert.equal(surface.sample(-5.4,4.3),null,'cliff below cypress is not meadow');
  close(surface.sample(4.1,4.6)!.position.y,-.017,.004);
  close(surface.sample(4,5)!.position.y,.007,.004);
  assert.equal(surface.sample(-3,4.8),null,'low shelf below first lamp is excluded');
  mesh.geometry.dispose();
});
