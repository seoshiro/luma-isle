import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {BRIDGE,TERRACE,MAIN_PATHS,GARDEN_PATHS,GARDEN_ORIGIN,GARDEN_CONNECTOR,LEGACY_MAIN_PATHS,LEGACY_GARDEN_PATH,bridgePoint,terraceProfile,legacyPathRandomCount,samplePath,pathFootprint,pointInPolygon,type Point2} from './world-layout';
import {bridgeDeckVertices,createBridgeDeckSection,createPathNetworkGeometry,createPathSeams,createTerraceLayer,unionPathOutlines} from './world-geometry';
import {createIsland} from './world';
import {createInitialState} from './game';

const close=(a:number,b:number,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
test('one bridge definition docks both full-width top edges and the vertical underside',()=>{
  const deck=bridgeDeckVertices();
  for(const i of [0,1,2,3]){const p=bridgePoint(deck[i][0],deck[i][1],-deck[i][2]);close(p[1],i<2?BRIDGE.near[1]:TERRACE.topY)}
  for(const pair of [[0,4],[1,5],[2,6],[3,7]]){const p=pair.map(i=>bridgePoint(deck[i][0],deck[i][1],-deck[i][2]));close(p[0][0],p[1][0]);close(p[0][2],p[1][2])}
  // Exact extrema over the full rotation, not just discrete animation samples.
  // Forward travel is s*cos(angle)-y*sin(angle), with extrema at atan2(-y,s).
  const radial=BRIDGE.run+1.98;
  for(const p of deck){const s=-p[2],y=p[1],critical=Math.atan2(-y,s),angles=[BRIDGE.restAngle,BRIDGE.raisedAngle];if(critical>=BRIDGE.restAngle&&critical<=BRIDGE.raisedAngle)angles.push(critical);for(const angle of angles)assert.ok(radial-(s*Math.cos(angle)-y*Math.sin(angle))>=1.98-1e-9)}
  const approach=samplePath(MAIN_PATHS.find(p=>p.id==='bridge-approach')!).at(-1)!;
  assert.deepEqual(approach.center,BRIDGE.near);close(approach.tangent[0],-BRIDGE.outward[0]);close(approach.tangent[1],-BRIDGE.outward[1]);
  // The far corners are supported along the wide, deliberately flattened face.
  const face=TERRACE.footprint.filter(p=>Math.abs((p[0]-TERRACE.center[0])*BRIDGE.outward[0]+(p[1]-TERRACE.center[2])*BRIDGE.outward[1]-1.98)<1e-7);
  assert.ok(Math.hypot(face[0][0]-face.at(-1)![0],face[0][1]-face.at(-1)![1])>BRIDGE.width+.3);
});

test('terrace layers share identical seam vertices and a vertical docking plane',()=>{
  const base=createTerraceLayer(TERRACE.baseRadius,TERRACE.seamRadius,TERRACE.bottomY,TERRACE.seamY),rim=createTerraceLayer(TERRACE.seamRadius,TERRACE.topRadius,TERRACE.seamY,TERRACE.topY,true);
  const seam=(g:THREE.BufferGeometry)=>{const p=g.getAttribute('position'),set=new Set<string>();for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-(TERRACE.seamY-TERRACE.center[1]))<1e-6)set.add(`${p.getX(i)},${p.getZ(i)}`);return[...set].sort()};
  assert.deepEqual(seam(base),seam(rim));
  for(const r of [TERRACE.topRadius,TERRACE.seamRadius,TERRACE.baseRadius]){const profile=terraceProfile(r);assert.equal(profile.length,terraceProfile(TERRACE.topRadius).length);close(Math.max(...profile.map(p=>p[0]*BRIDGE.outward[0]+p[1]*BRIDGE.outward[1])),1.98)}
});

test('complete deck volume and rails clear terrace and workshop during every raised pose',()=>{
  const samples:{x:number;y:number;s:number}[]=[];
  for(let i=0;i<=40;i++)for(let j=0;j<=8;j++)for(const lower of [false,true])samples.push({x:-BRIDGE.width/2+BRIDGE.width*j/8,y:lower?-BRIDGE.thickness:0,s:BRIDGE.length*i/40-(lower?BRIDGE.thickness*Math.tan(BRIDGE.restAngle):0)});
  for(const x of [-.635,.635])for(const y of [-.215,.905])for(let i=0;i<=20;i++)samples.push({x,y,s:.18+(BRIDGE.length-.36)*i/20});
  for(let step=0;step<=100;step++)for(const p of samples){const q=bridgePoint(p.x,p.y,p.s,BRIDGE.restAngle+(BRIDGE.raisedAngle-BRIDGE.restAngle)*step/100);
    if(q[1]<TERRACE.topY-1e-6&&q[1]>TERRACE.bottomY){const outward=(q[0]-TERRACE.center[0])*BRIDGE.outward[0]+(q[2]-TERRACE.center[2])*BRIDGE.outward[1];assert.ok(outward>=1.98-1e-6,`deck/rail entered terrace: ${q}`)}
    assert.ok(!(q[0]>-1.99&&q[0]<2.39&&q[2]>.31&&q[2]<4.69&&q[1]>0&&q[1]<3.63),`bridge entered workshop bounds: ${q}`);
    // The planting mask conservatively encloses every animated sample.
    assert.ok(pointInPolygon([q[0],q[2]],BRIDGE.sweep),`sweep mask misses ${q}`);
  }
});

test('rounded routes retain exact perpendicular width and form closed nonoverlapping network boundaries',()=>{
  for(const path of [...MAIN_PATHS,GARDEN_CONNECTOR,...GARDEN_PATHS]){
    const samples=samplePath(path),outline=pathFootprint(path);assert.deepEqual(samples[0].center,path.points[0]);assert.deepEqual(samples.at(-1)!.center,path.points.at(-1));
    for(let i=0;i<samples.length;i++){const a=outline[i],b=outline[outline.length-1-i];close(Math.hypot(a[0]-b[0],a[1]-b[1]),path.width);close(Math.hypot(...samples[i].tangent),1)}
  }
  const loops=unionPathOutlines(MAIN_PATHS.map(pathFootprint));assert.equal(loops.length,1,'main and both approaches must be one joined surface');
  const geometry=createPathNetworkGeometry(MAIN_PATHS),position=geometry.getAttribute('position');assert.ok(position.count>50);for(let i=0;i<position.count;i++)assert.ok(Number.isFinite(position.getY(i)));
  assert.ok(geometry.getAttribute('normal').getY(0)>0);
  const seams=createPathSeams(MAIN_PATHS);assert.ok(seams.index&&seams.index.count>0);assert.ok(seams.getAttribute('normal').getY(0)>.9);
});

test('garden connector has identical docking edges and goes around lighthouse foundation',()=>{
  const main=MAIN_PATHS[0],garden=GARDEN_PATHS[0];assert.deepEqual(GARDEN_CONNECTOR.points[0],main.points.at(-1));
  assert.deepEqual(GARDEN_CONNECTOR.points.at(-1),garden.points[0].map((n,i)=>n+GARDEN_ORIGIN[i]));assert.equal(GARDEN_CONNECTOR.width,main.width);assert.equal(GARDEN_CONNECTOR.width,garden.width);
  const start=samplePath(GARDEN_CONNECTOR)[0],end=samplePath(main).at(-1)!;close(start.tangent[0],end.tangent[0]);close(start.tangent[1],end.tangent[1]);
  for(const p of pathFootprint(GARDEN_CONNECTOR))assert.ok(Math.hypot(p[0]-7.3,p[1]+.35)>1.25,'connector cuts lighthouse base');
});

test('legacy random budgets remain exactly the original two calls per slab',()=>{
  const original=(points:readonly (readonly number[])[])=>{let count=0;for(let i=1;i<points.length;i++){const n=Math.ceil(new THREE.Vector3(...points[i] as [number,number,number]).distanceTo(new THREE.Vector3(...points[i-1] as [number,number,number]))/.28);for(let j=0;j<n;j++)count+=2}return count};
  for(const points of [...LEGACY_MAIN_PATHS,LEGACY_GARDEN_PATH])assert.equal(legacyPathRandomCount(points),original(points));
});

test('deck top normals face up and initial completed saves/replay share the same terminal pose',()=>{
  const section=createBridgeDeckSection(0,BRIDGE.length),normal=section.getAttribute('normal');close(normal.getY(0),1);
  const previous=globalThis.document;Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})}});
  try{
    const world=createIsland(),state=createInitialState();state.stage=4;const bridge=world.root.getObjectByName('Folding bridge')!;assert.ok(bridge);
    const paths:THREE.Object3D[]=[];world.root.traverse(o=>{if(o.userData.pathDefinitions)paths.push(o)});assert.equal(paths.length,3);assert.ok(paths.every(p=>p.children.length===2&&p.children.every(c=>c instanceof THREE.Mesh)),'independent path and seam meshes support fitting and normal scene disposal');
    world.update(state,10,.016);close(bridge.rotation.x,BRIDGE.restAngle);world.replay('workshop');close(bridge.rotation.x,BRIDGE.raisedAngle);
    world.update(state,10.2,.2);assert.ok(bridge.rotation.x<BRIDGE.raisedAngle&&bridge.rotation.x>BRIDGE.restAngle);
    for(let i=0;i<800;i++)world.update(state,10.2+i/60,1/60);close(bridge.rotation.x,BRIDGE.restAngle);
    world.replay('workshop');world.update(state,30,.016,{reducedMotion:true});close(bridge.rotation.x,BRIDGE.restAngle);
  }finally{Object.defineProperty(globalThis,'document',{configurable:true,value:previous})}
});
