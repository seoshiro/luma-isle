import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createTerrainSurface, type SurfacePoint2} from './terrain-surface';
import {blockedBy,checkGrounding,diskProbes,distributeOnSurface,findGrounding,maskDistance,placementCandidates,rectangleProbes,type GroundMask} from './ground-placement';

function ground(width=10,depth=10,slope=0) {
  const geometry=new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)positions.setY(i,positions.getX(i)*slope);
  const mesh=new THREE.Mesh(geometry);
  return createTerrainSurface([{mesh,role:'ground-top'}],{minY:-10,maxY:10,minNormalY:.5});
}

test('shared paths, rotated bases and exact polygon masks include edges and padding',()=>{
  const masks:GroundMask[]=[
    {id:'water',kind:'circle',center:[-2,0],radius:.5},
    {id:'building',kind:'box',center:[2,0],halfSize:[1,.3],yaw:Math.PI/2},
    {id:'bridge-sweep',kind:'polygon',points:[[0,1],[1,2],[0,3],[-1,2]]},
    {id:'route',kind:'path',points:[[-4,-2],[0,-2],[1,-3]],width:.8},
  ];
  assert.equal(blockedBy(masks,[-2,0])?.id,'water');
  assert.equal(blockedBy(masks,[2,.9])?.id,'building');
  assert.equal(blockedBy(masks,[2.6,0]),null);
  assert.equal(blockedBy(masks,[0,1])?.id,'bridge-sweep');
  assert.equal(blockedBy(masks,[0,2])?.id,'bridge-sweep');
  assert.equal(blockedBy(masks,[-3,-1.6])?.id,'route');
  assert.equal(blockedBy(masks,[-3,-1.4],.21)?.id,'route');
  assert.ok(maskDistance(masks[2],[2,2])>0);
});

test('multiple contact feet determine support height instead of whole-object bounds',()=>{
  const request={center:[0,0] as const,footprint:rectangleProbes(.75,.3),contacts:[[-.6,-.08,-.2],[.6,-.08,-.2],[-.6,-.08,.2],[.6,-.08,.2]] as const};
  const result=checkGrounding(ground(),request);
  assert.ok(result.supported);assert.ok(Math.abs(result.position.y-.065)<1e-6);
  assert.ok(result.samples.length>10);assert.ok(result.contactGap<1e-6);
});

test('one supported center cannot hide roots or furniture feet outside the real ground',()=>{
  const surface=ground(2,2),result=checkGrounding(surface,{center:[.8,0],footprint:diskProbes(.5,.15),contacts:[[0,0,0]]});
  assert.ok(surface.sample(.8,0));assert.equal(result.supported,false);assert.equal(result.reason,'missing-ground');assert.ok(result.missing.length>0);
});

test('footprint interiors detect path/collision even when the center is clear',()=>{
  const result=checkGrounding(ground(),{center:[0,0],footprint:rectangleProbes(1,.4,.1),contacts:[[0,0,0]],masks:[{id:'lamp-route',kind:'path',points:[[.7,-2],[.7,2]],width:.2}]});
  assert.equal(result.reason,'blocked');assert.equal(result.blockingMask,'lamp-route');
});

test('uneven and steep terrain are rejected rather than concealed by vertical translation',()=>{
  const request={center:[0,0] as const,footprint:rectangleProbes(.7,.3),contacts:[[-.6,0,0],[.6,0,0]] as const};
  const uneven=checkGrounding(ground(10,10,.2),{...request,maxHeightRange:1,maxContactGap:.1});
  assert.equal(uneven.reason,'contact-gap');
  const steep=checkGrounding(ground(10,10,.6),{...request,maxHeightRange:10,maxContactGap:10,maxSlope:.3});
  assert.equal(steep.reason,'steep-ground');
  const relief=checkGrounding(ground(10,10,.2),{...request,maxHeightRange:.1,maxContactGap:10});
  assert.equal(relief.reason,'uneven-ground');
});

test('full canopy clearance is independent of the supported root footprint',()=>{
  const mask:GroundMask={id:'moving-bridge',kind:'box',center:[2,0],halfSize:[.4,1]};
  const request={center:[0,0] as const,footprint:diskProbes(.3),contacts:[[0,0,0]] as const,masks:[mask]};
  assert.ok(checkGrounding(ground(2,2),request).supported);
  const blocked=checkGrounding(ground(2,2),{...request,centerExclusions:[{mask,padding:1.8}]});
  assert.equal(blocked.reason,'blocked');assert.equal(blocked.blockingMask,'moving-bridge');
  assert.ok(checkGrounding(ground(2,2),{...request,centerExclusions:[{mask,padding:1.2}]}).supported,'canopy overhang need not have terrain below it');
});

test('deterministic local relocation finds complete support and preserves nearest-first distance',()=>{
  const center:SurfacePoint2=[2,0];
  const a=placementCandidates(center,2,.25,'tree'),b=placementCandidates(center,2,.25,'tree');
  assert.deepEqual(a,b);assert.deepEqual(a[0],center);
  for(let i=1;i<a.length;i++)assert.ok(Math.hypot(a[i][0]-2,a[i][1])+1e-8>=Math.hypot(a[i-1][0]-2,a[i-1][1]));
  const request={center,footprint:diskProbes(.3),contacts:[[0,0,0]] as const};
  const found=findGrounding(ground(3,3),request,{radius:2,seed:'tree'});
  assert.ok(found.supported);assert.ok(found.position.x<1.21);
  assert.deepEqual(findGrounding(ground(3,3),request,{radius:2,seed:'tree'}).position.toArray(),found.position.toArray());
});

test('distribution is repeatable, respects footprint masks and edges, and has no regular grid',()=>{
  const surface=ground(5,5),masks:GroundMask[]=[{id:'water',kind:'path',points:[[0,-3],[0,3]],width:.6}];
  const options={count:120,seed:'short-grass',masks,edgeRadius:.08,clearance:.04,minimumSpacing:.13};
  const first=distributeOnSurface(surface,options),second=distributeOnSurface(surface,options);
  assert.equal(first.length,120);assert.deepEqual(first.map(h=>h.position.toArray()),second.map(h=>h.position.toArray()));
  first.forEach((hit,i)=>{
    assert.ok(Math.abs(hit.position.x)>.42);assert.ok(Math.abs(hit.position.x)<2.43&&Math.abs(hit.position.z)<2.43);
    for(let j=0;j<i;j++)assert.ok(hit.position.distanceTo(first[j].position)>=.13-1e-8);
  });
  assert.ok(new Set(first.map(h=>Math.round(h.position.x*1000))).size>100);
  assert.equal(distributeOnSurface(surface,{...options,masks:[{id:'all',kind:'circle',center:[0,0],radius:20}],maxAttempts:10}).length,0);
});

test('footprint rotation follows Three.js positive-Y convention and invalid inputs are bounded',()=>{
  const request={center:[0,0] as const,footprint:rectangleProbes(1,.1),contacts:[[0,0,0]] as const,masks:[{id:'obstacle',kind:'circle' as const,center:[0,.8] as const,radius:.1}]};
  assert.ok(checkGrounding(ground(),request).supported);
  assert.equal(checkGrounding(ground(),{...request,yaw:Math.PI/2}).reason,'blocked');
  assert.equal(checkGrounding(ground(),{...request,contacts:[]}).reason,'empty-footprint');
  assert.throws(()=>diskProbes(-1),/Invalid/);assert.throws(()=>rectangleProbes(1,1,0),/Invalid/);
  assert.throws(()=>placementCandidates([0,0],1,0),/Invalid/);
  assert.throws(()=>distributeOnSurface(ground(),{count:-1,seed:0}),/count/);
});
