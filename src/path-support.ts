import * as THREE from 'three';
import {pathFootprint,pointInPolygon,samplePath,type PathDefinition,type Point2,type Point3} from './world-layout';
import {unionPathOutlines} from './world-geometry';
import type {TerrainSurface} from './terrain-surface';

export interface PathFoundationOptions {
  slabThickness?:number;
  embedDepth?:number;
  maxFoundationHeight?:number;
  maxBoundarySegment?:number;
  /** Polygons in the same reference frame as paths and terrain. */
  openings?:readonly (readonly Point2[])[];
}
export interface PathFoundationDiagnostics {
  components:number;
  wallSegments:number;
  groundSamples:number;
  skippedComponents:number;
  trimmedPathSections:number;
  unsupported:Point2[];
  excessiveDepth:Point2[];
  supportedRuns:{pathId:string;start:Point3;end:Point3}[];
  maximumHeight:number;
}
export const PATH_WATER_OPENINGS:readonly (readonly Point2[])[]=[[
  [-5.3,2.45],[-3.2,2.45],[-3.2,4],[-5.3,4],
]];
const signedArea=(p:readonly Point2[])=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1]},0)/2;
const cross=(a:Point2,b:Point2)=>a[0]*b[1]-a[1]*b[0];
const key=(p:Point2)=>`${Math.round(p[0]*1e7)},${Math.round(p[1]*1e7)}`;
const mix=(a:Point2,b:Point2,t:number):Point2=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

/** Retain actual boundary edges, adding reversed cut edges to close bank abutments. */
function subtractOpenings(subjects:readonly Point2[][],openings:readonly (readonly Point2[])[]):Point2[][] {
  if(!openings.length)return subjects.map(p=>[...p]);
  const masks=unionPathOutlines(openings),rings=[...subjects.map(p=>({points:p,mask:false})),...masks.map(p=>({points:p,mask:true}))];
  const edges:{a:Point2;b:Point2;used:boolean}[]=[];
  rings.forEach((ring,index)=>ring.points.forEach((a,i)=>{
    const b=ring.points[(i+1)%ring.points.length],v:Point2=[b[0]-a[0],b[1]-a[1]],cuts=[0,1];
    rings.forEach((other,j)=>{if(j===index)return;other.points.forEach((c,k)=>{
      const d=other.points[(k+1)%other.points.length],w:Point2=[d[0]-c[0],d[1]-c[1]],offset:Point2=[c[0]-a[0],c[1]-a[1]],denominator=cross(v,w);
      if(Math.abs(denominator)<1e-12)return;
      const t=cross(offset,w)/denominator,u=cross(offset,v)/denominator;
      if(t>1e-9&&t<1-1e-9&&u>=-1e-9&&u<=1+1e-9)cuts.push(t);
    })});
    cuts.sort((x,y)=>x-y);
    for(let j=1;j<cuts.length;j++){
      if(cuts[j]-cuts[j-1]<1e-9)continue;
      const middle=mix(a,b,(cuts[j]+cuts[j-1])/2);
      const keep=ring.mask?subjects.some(p=>pointInPolygon(middle,p)):!masks.some(p=>pointInPolygon(middle,p));
      if(!keep)continue;
      const start=mix(a,b,cuts[j-1]),end=mix(a,b,cuts[j]);
      edges.push({a:ring.mask?end:start,b:ring.mask?start:end,used:false});
    }
  }));
  const next=new Map<string,typeof edges>();for(const e of edges){const k=key(e.a);if(!next.has(k))next.set(k,[]);next.get(k)!.push(e)}
  const loops:Point2[][]=[];
  for(const first of edges){if(first.used)continue;let edge:typeof first|undefined=first;const loop:Point2[]=[],start=key(first.a);
    while(edge&&!edge.used){edge.used=true;loop.push(edge.a);if(key(edge.b)===start)break;edge=next.get(key(edge.b))?.find(e=>!e.used)}
    if(!edge||key(edge.b)!==start)throw new Error('Path foundation has an open cut boundary');
    if(loop.length>2&&Math.abs(signedArea(loop))>1e-10)loops.push(loop);
  }
  return loops;
}
function densify(points:readonly Point2[],step:number):Point2[]{
  const result:Point2[]=[];points.forEach((a,i)=>{const b=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let j=0;j<n;j++)result.push(mix(a,b,j/n))});return result;
}
function makeHeightSampler(paths:readonly PathDefinition[]){
  const segments=paths.flatMap(path=>{const samples=samplePath(path);return samples.slice(1).map((b,i)=>({a:samples[i].center,b:b.center}))});
  return (p:Point2)=>{let distance=Infinity,height=0;for(const {a,b} of segments){const dx=b[0]-a[0],dz=b[2]-a[2],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[2])*dz)/(dx*dx+dz*dz),0,1),d=(p[0]-a[0]-dx*t)**2+(p[1]-a[2]-dz*t)**2;if(d<distance){distance=d;height=a[1]+(b[1]-a[1])*t}}return height};
}
function onSegment(p:Point2,a:Point2,b:Point2):number|null {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;if(length<1e-14)return null;
  const t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length;
  return t>1e-8&&t<1-1e-8&&Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)<1e-8*Math.sqrt(length)?t:null;
}

/**
 * A single unioned solid per supported bank. The wall follows the accepted route,
 * not rotated station boxes. No unknown ground is silently bridged by a deep pier.
 */
export function createGroundedPathFoundation(paths:readonly PathDefinition[],terrain:Pick<TerrainSurface,'sample'>,options:PathFoundationOptions={}) {
  const slab=options.slabThickness??.16,embed=options.embedDepth??.04,maxHeight=options.maxFoundationHeight??1.25,step=options.maxBoundarySegment??.14;
  if(![slab,embed,maxHeight,step].every(n=>Number.isFinite(n)&&n>0))throw new Error('Foundation dimensions must be positive and finite');
  const diagnostics:PathFoundationDiagnostics={components:0,wallSegments:0,groundSamples:0,skippedComponents:0,trimmedPathSections:0,unsupported:[],excessiveDepth:[],supportedRuns:[],maximumHeight:0};
  const positions:number[]=[],indices:number[]=[],heightAt=makeHeightSampler(paths),missing=new Map<string,Point2>(),tooDeep=new Map<string,Point2>();
  const sampleCache=new Map<string,number|null>();
  const groundAt=(p:Point2)=>{const k=key(p);if(sampleCache.has(k))return sampleCache.get(k)!;diagnostics.groundSamples++;const y=terrain.sample(p[0],p[1])?.position.y;const result=y!==undefined&&Number.isFinite(y)?y:null;sampleCache.set(k,result);return result};
  const openings=options.openings??PATH_WATER_OPENINGS,supportedFootprints:Point2[][]=[];
  // A path may have a short bridge-like lip beyond a real shore. Start its
  // foundation at the first completely supported cross-section instead of
  // refusing the entire garden or inventing a wall under an empty corner.
  for(const path of paths){
    const stations=samplePath(path),footprint=pathFootprint(path),count=stations.length;
    const valid=stations.map(({center:p,tangent:t})=>{
      let supported=true;
      for(const offset of [-.5,-.25,0,.25,.5]){
        const q:Point2=[p[0]-t[1]*path.width*offset,p[2]+t[0]*path.width*offset];
        if(openings.some(o=>pointInPolygon(q,o)))continue;
        const ground=groundAt(q);
        if(ground===null){missing.set(key(q),q);supported=false;continue}
        const depth=heightAt(q)-slab-ground;diagnostics.maximumHeight=Math.max(diagnostics.maximumHeight,depth);
        if(depth>maxHeight){tooDeep.set(key(q),q);supported=false}
      }
      return supported;
    });
    if(valid.every(Boolean)){supportedFootprints.push(footprint);diagnostics.supportedRuns.push({pathId:path.id,start:stations[0].center,end:stations.at(-1)!.center});continue}
    let start=-1,runs=0;
    for(let i=0;i<=count;i++){
      if(i<count&&valid[i]){if(start<0)start=i;continue}
      if(start>=0){if(i-start>=2){const left=footprint.slice(start,i),right=Array.from({length:i-start},(_,j)=>footprint[footprint.length-1-(start+j)]).reverse();supportedFootprints.push([...left,...right]);diagnostics.supportedRuns.push({pathId:path.id,start:stations[start].center,end:stations[i-1].center});runs++}start=-1}
      if(i<count&&(i===0||valid[i-1]))diagnostics.trimmedPathSections++;
    }
    if(!runs)diagnostics.skippedComponents++;
  }
  const outlines=supportedFootprints.length?subtractOpenings(unionPathOutlines(supportedFootprints),openings):[];
  const outers=outlines.filter(p=>signedArea(p)>0),holes=outlines.filter(p=>signedArea(p)<0);
  for(const outline of outers){
    const contours=[densify(outline,step),...holes.filter(p=>pointInPolygon(p[0],outline)).map(p=>densify(p,step))];
    const boundary=contours.flat(),points:Point2[]=[...boundary],top:number[]=[],bottom:number[]=[],capTriangles:number[][]=[];
    const initial=THREE.ShapeUtils.triangulateShape(contours[0].map(p=>new THREE.Vector2(...p)),contours.slice(1).map(c=>c.map(p=>new THREE.Vector2(...p))));
    // Earcut may omit collinear contour vertices. Split its cap edges at every
    // boundary vertex, so sidewalls and caps share the same geometric edge graph.
    for(const tri of initial){
      const ta=boundary[tri[0]],tb=boundary[tri[1]],tc=boundary[tri[2]];
      if(Math.abs((tb[0]-ta[0])*(tc[1]-ta[1])-(tb[1]-ta[1])*(tc[0]-ta[0]))<1e-10)continue;
      const perimeter:number[]=[];
      for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],intermediate:{index:number;t:number}[]=[];boundary.forEach((p,index)=>{if(index===a||index===b)return;const t=onSegment(p,boundary[a],boundary[b]);if(t!==null)intermediate.push({index,t})});intermediate.sort((a,b)=>a.t-b.t);perimeter.push(a,...intermediate.map(p=>p.index))}
      const center:Point2=[tri.reduce((sum,i)=>sum+boundary[i][0],0)/3,tri.reduce((sum,i)=>sum+boundary[i][1],0)/3],centerIndex=points.length;points.push(center);
      for(let j=0;j<perimeter.length;j++)capTriangles.push([centerIndex,perimeter[j],perimeter[(j+1)%perimeter.length]]);
    }
    let valid=true;
    for(const p of points){const upper=heightAt(p)-slab,ground=groundAt(p);top.push(upper);
      if(ground===null){missing.set(key(p),p);bottom.push(upper);valid=false;continue}
      const depth=upper-ground;diagnostics.maximumHeight=Math.max(diagnostics.maximumHeight,depth);
      if(depth>maxHeight){tooDeep.set(key(p),p);valid=false}
      // Already-grounded slabs get a tiny fully buried closure, never a raised lip.
      bottom.push(Math.min(ground-embed,upper-.008));
    }
    if(!valid){diagnostics.skippedComponents++;continue}
    diagnostics.components++;
    const wallBase=positions.length/3;
    for(let i=0;i<boundary.length;i++)positions.push(points[i][0],top[i],points[i][1],points[i][0],bottom[i],points[i][1]);
    let ringOffset=0;
    for(const contour of contours){for(let i=0;i<contour.length;i++){const a=wallBase+(ringOffset+i)*2,b=wallBase+(ringOffset+(i+1)%contour.length)*2;indices.push(a,b,a+1,b,b+1,a+1);diagnostics.wallSegments++}ringOffset+=contour.length}
    // Separate cap normals preserve clean bank corners and smoothly joined walls.
    const topBase=positions.length/3;points.forEach((p,i)=>positions.push(p[0],top[i],p[1]));
    const bottomBase=positions.length/3;points.forEach((p,i)=>positions.push(p[0],bottom[i],p[1]));
    for(const tri of capTriangles){let [a,b,c]=tri;const p=points[a],q=points[b],r=points[c];if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])>0)[b,c]=[c,b];indices.push(topBase+a,topBase+b,topBase+c,bottomBase+a,bottomBase+c,bottomBase+b)}
  }
  diagnostics.unsupported=[...missing.values()];diagnostics.excessiveDepth=[...tooDeep.values()];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {geometry,diagnostics};
}
