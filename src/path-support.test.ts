import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGroundedPathFoundation,PATH_WATER_OPENINGS} from './path-support';
import {createTerrainSurface} from './terrain-surface';
import {MAIN_PATHS,GARDEN_PATHS,pointInPolygon,type PathDefinition} from './world-layout';
import {geometryFixture} from './grounding-model-fixtures';

function plane(y=-.3,width=40,depth=40){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2));mesh.position.y=y;return createTerrainSurface([{mesh,role:'island-body'}],{minY:y-.1,maxY:y+.1})}
function edgeCounts(geometry:THREE.BufferGeometry){
  const points=geometry.getAttribute('position'),indices=geometry.index!,edges=new Map<string,number>();
  const key=(i:number)=>`${Math.round(points.getX(i)*1e5)},${Math.round(points.getY(i)*1e5)},${Math.round(points.getZ(i)*1e5)}`;
  for(let i=0;i<indices.count;i+=3)for(let j=0;j<3;j++){const a=key(indices.getX(i+j)),b=key(indices.getX(i+(j+1)%3));assert.notEqual(a,b,'zero-length triangle edge');const edge=a<b?`${a}|${b}`:`${b}|${a}`;edges.set(edge,(edges.get(edge)??0)+1)}
  return edges;
}
function assertClosed(geometry:THREE.BufferGeometry){const edges=edgeCounts(geometry);assert.ok(edges.size>20);for(const [edge,count] of edges)assert.equal(count,2,`unjoined or duplicated boundary ${edge}`)}
const bend:readonly PathDefinition[]=[{id:'bend',width:.8,cornerRadius:.7,points:[[-2,.3,0],[0,.3,0],[1.3,.3,1.2]]},{id:'branch',width:.8,points:[[0,.3,0],[0,.3,-2]]}];

test('one continuous retaining solid follows joined curves, without overlapping station boxes',()=>{
  const result=createGroundedPathFoundation(bend,plane(),{openings:[]});assert.equal(result.diagnostics.components,1);assert.equal(result.diagnostics.skippedComponents,0);assert.ok(result.diagnostics.wallSegments>50);assert.equal(result.geometry.type,'BufferGeometry');assertClosed(result.geometry);
  const p=result.geometry.getAttribute('position'),n=result.geometry.getAttribute('normal');let volume=0;
  for(let i=0;i<n.count;i++){assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)));assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.99);assert.ok(p.getY(i)<=.14+1e-6);assert.ok(p.getY(i)>=-.34-1e-6)}
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),index=result.geometry.index!;
  for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));volume+=a.dot(b.cross(c))/6}
  assert.ok(volume>1,'all faces enclose a positive outward-oriented volume');
});

test('channel opening stays completely empty and both banks have closed abutment faces',()=>{
  const paths:PathDefinition[]=[{id:'crossing',width:.9,points:[[-6,.36,3.1],[-2,.36,3.1]]}],result=createGroundedPathFoundation(paths,plane());
  assert.equal(result.diagnostics.components,2);assertClosed(result.geometry);
  const p=result.geometry.getAttribute('position'),index=result.geometry.index!;let leftFace=0,rightFace=0;
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((s,j)=>s+p.getX(j),0)/3,z=ids.reduce((s,j)=>s+p.getZ(j),0)/3;
    if(x>-5.3+1e-5&&x<-3.2-1e-5)assert.ok(!pointInPolygon([x,z],PATH_WATER_OPENINGS[0]),'foundation blocks flowing water');
    if(ids.every(j=>Math.abs(p.getX(j)+5.3)<1e-5))leftFace++;if(ids.every(j=>Math.abs(p.getX(j)+3.2)<1e-5))rightFace++;
  }
  assert.ok(leftFace>2&&rightFace>2,'both bank ends are deliberate closed faces');
});

test('an enclosed opening also creates a closed hole instead of a filled cap',()=>{
  const route:PathDefinition[]=[{id:'wide',width:2,points:[[-2,.3,0],[2,.3,0]]}];
  const opening:readonly (readonly [number,number])[]=[[-.4,-.3],[.4,-.3],[.4,.3],[-.4,.3]];
  const result=createGroundedPathFoundation(route,plane(),{openings:[opening]});assert.equal(result.diagnostics.components,1);assertClosed(result.geometry);
  const p=result.geometry.getAttribute('position'),indices=result.geometry.index!;
  for(let i=0;i<indices.count;i+=3){const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)],x=ids.reduce((s,j)=>s+p.getX(j),0)/3,z=ids.reduce((s,j)=>s+p.getZ(j),0)/3;if(Math.abs(x)<.4-1e-5&&Math.abs(z)<.3-1e-5)assert.fail('hole was capped')}
});

test('missing ground and excessive depth are reported, never replaced by floating or huge piers',()=>{
  const route:PathDefinition[]=[{id:'unsupported',width:.8,points:[[-2,.3,0],[2,.3,0]]}];
  const absent=createGroundedPathFoundation(route,plane(-.3,1,1),{openings:[]});assert.equal(absent.diagnostics.components,1);assert.ok(absent.diagnostics.trimmedPathSections>0);assert.ok(absent.diagnostics.unsupported.length>0);assertClosed(absent.geometry);assert.ok(absent.geometry.boundingBox!.min.x>=-.5);assert.ok(absent.geometry.boundingBox!.max.x<=.5);
  const deep=createGroundedPathFoundation(route,plane(-4),{openings:[]});assert.equal(deep.geometry.getAttribute('position').count,0);assert.equal(deep.diagnostics.skippedComponents,1);assert.ok(deep.diagnostics.excessiveDepth.length>0);
  assert.throws(()=>createGroundedPathFoundation(route,plane(),{maxBoundarySegment:0}),/positive/);
});

test('real island and garden foundations contact actual transformed stone beneath the accepted routes',async()=>{
  const model=await geometryFixture('island.glb');model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.set(-center.x,-bounds.min.y,-center.z);
  const wrapper=new THREE.Group();wrapper.scale.set(24.5/size.x,5.8/size.y,16/size.z);wrapper.position.y=-(.164-bounds.min.y)*wrapper.scale.y;wrapper.add(model);
  const sources:THREE.Mesh[]=[];model.traverse(o=>{if(o instanceof THREE.Mesh)sources.push(o)});
  const raw=createTerrainSurface(sources.map(mesh=>({mesh,role:'island-body' as const})),{minY:-6,maxY:.6,minNormalY:.05,componentPolicy:'all',minComponentArea:0});
  const main=createGroundedPathFoundation(MAIN_PATHS,raw);assert.equal(main.diagnostics.components,2);assert.deepEqual(main.diagnostics.unsupported,[]);assert.deepEqual(main.diagnostics.excessiveDepth,[]);assertClosed(main.geometry);
  const checkContact=(geometry:THREE.BufferGeometry,terrain:typeof raw)=>{const p=geometry.getAttribute('position'),low=new Map<string,{x:number;y:number;z:number}>();for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),key=`${x},${z}`,old=low.get(key);if(!old||y<old.y)low.set(key,{x,y,z})}for(const p of low.values()){const hit=terrain.sample(p.x,p.z);assert.ok(hit);assert.ok(p.y<=hit.position.y-.039,'foundation bottom floats above its real contact')}};
  checkContact(main.geometry,raw);
  wrapper.scale.set(5.8/size.x,2.2/size.y,4.8/size.z);wrapper.position.y=-(.164-bounds.min.y)*2.2/size.y;wrapper.updateMatrixWorld(true);
  const small=createTerrainSurface(sources.map(mesh=>({mesh,role:'island-body' as const})),{minY:-2.3,maxY:.24,minNormalY:.05,componentPolicy:'all',minComponentArea:0,cellSize:.2});
  const garden=createGroundedPathFoundation(GARDEN_PATHS,small);assert.equal(garden.diagnostics.components,1,JSON.stringify(garden.diagnostics));assert.ok(garden.diagnostics.trimmedPathSections>0);assert.ok(garden.diagnostics.unsupported.some(p=>Math.abs(p[0]+2)<1e-6&&Math.abs(p[1]-.75)<1e-6),'the real unsupported outer entrance corner is reported, not covered by a fake wall');assertClosed(garden.geometry);checkContact(garden.geometry,small);
  assert.equal(garden.diagnostics.supportedRuns.length,1);assert.ok(garden.diagnostics.supportedRuns[0].start[0]>-2&&garden.diagnostics.supportedRuns[0].start[0]<-1.7,'receiving abutment remains within a short deck projection of the saved garden dock');
});
