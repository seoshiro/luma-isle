import * as THREE from 'three';
import {surfaceRandom, type SurfaceHit, type SurfacePoint2, type SurfacePoint3, type TerrainSurface} from './terrain-surface';

export type GroundMask =
  | {id:string; kind:'circle'; center:SurfacePoint2; radius:number}
  | {id:string; kind:'box'; center:SurfacePoint2; halfSize:SurfacePoint2; yaw?:number}
  | {id:string; kind:'polygon'; points:readonly SurfacePoint2[]}
  | {id:string; kind:'path'; points:readonly SurfacePoint2[]; width:number};

export function segmentDistance(point:SurfacePoint2,a:SurfacePoint2,b:SurfacePoint2) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?THREE.MathUtils.clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length,0,1):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz);
}

/** Negative inside; zero on the edge. Positive padding expands exclusions. */
export function maskDistance(mask:GroundMask,point:SurfacePoint2):number {
  if(mask.kind==='circle') return Math.hypot(point[0]-mask.center[0],point[1]-mask.center[1])-mask.radius;
  if(mask.kind==='box') {
    const yaw=mask.yaw??0,dx=point[0]-mask.center[0],dz=point[1]-mask.center[1];
    const qx=Math.abs(Math.cos(yaw)*dx-Math.sin(yaw)*dz)-mask.halfSize[0];
    const qz=Math.abs(Math.sin(yaw)*dx+Math.cos(yaw)*dz)-mask.halfSize[1];
    return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0);
  }
  if(mask.kind==='path') {
    if(!mask.points.length)return Infinity;
    if(mask.points.length===1)return Math.hypot(point[0]-mask.points[0][0],point[1]-mask.points[0][1])-mask.width/2;
    let distance=Infinity;
    for(let i=1;i<mask.points.length;i++)distance=Math.min(distance,segmentDistance(point,mask.points[i-1],mask.points[i]));
    return distance-mask.width/2;
  }
  if(mask.points.length<3)return Infinity;
  let inside=false,distance=Infinity;
  for(let i=0,j=mask.points.length-1;i<mask.points.length;j=i++){
    const a=mask.points[j],b=mask.points[i];
    distance=Math.min(distance,segmentDistance(point,a,b));
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?-distance:distance;
}

const maskBounds=new WeakMap<object,readonly [number,number,number,number]>();
export function blockedBy(masks:readonly GroundMask[],point:SurfacePoint2,padding=0) {
  return masks.find(mask=>{
    let bounds=maskBounds.get(mask);
    if(!bounds){
      if(mask.kind==='circle')bounds=[mask.center[0]-mask.radius,mask.center[1]-mask.radius,mask.center[0]+mask.radius,mask.center[1]+mask.radius];
      else if(mask.kind==='box'){const c=Math.abs(Math.cos(mask.yaw??0)),s=Math.abs(Math.sin(mask.yaw??0)),x=c*mask.halfSize[0]+s*mask.halfSize[1],z=s*mask.halfSize[0]+c*mask.halfSize[1];bounds=[mask.center[0]-x,mask.center[1]-z,mask.center[0]+x,mask.center[1]+z];}
      else {const radius=mask.kind==='path'?mask.width/2:0;bounds=[Math.min(...mask.points.map(p=>p[0]))-radius,Math.min(...mask.points.map(p=>p[1]))-radius,Math.max(...mask.points.map(p=>p[0]))+radius,Math.max(...mask.points.map(p=>p[1]))+radius];}
      maskBounds.set(mask,bounds);
    }
    return point[0]>=bounds[0]-padding&&point[0]<=bounds[2]+padding&&point[1]>=bounds[1]-padding&&point[1]<=bounds[3]+padding&&maskDistance(mask,point)<=padding;
  })??null;
}

/** Sample the entire footprint, including its interior, not only its center. */
export function diskProbes(radius:number,spacing=.2):SurfacePoint2[] {
  if(!Number.isFinite(radius)||radius<0||!Number.isFinite(spacing)||spacing<=0)throw new Error('Invalid footprint dimensions');
  const points:SurfacePoint2[]=[[0,0]];
  const rings=Math.ceil(radius/spacing);
  for(let ring=1;ring<=rings;ring++){
    const r=radius*ring/rings,count=Math.max(8,Math.ceil(2*Math.PI*r/spacing));
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2;points.push([Math.cos(a)*r,Math.sin(a)*r]);}
  }
  return points;
}

export function rectangleProbes(halfWidth:number,halfDepth:number,spacing=.2):SurfacePoint2[] {
  if([halfWidth,halfDepth].some(n=>!Number.isFinite(n)||n<0)||!Number.isFinite(spacing)||spacing<=0)throw new Error('Invalid footprint dimensions');
  const nx=Math.max(1,Math.ceil(2*halfWidth/spacing)),nz=Math.max(1,Math.ceil(2*halfDepth/spacing)),points:SurfacePoint2[]=[];
  for(let x=0;x<=nx;x++)for(let z=0;z<=nz;z++)points.push([-halfWidth+2*halfWidth*x/nx,-halfDepth+2*halfDepth*z/nz]);
  return points;
}

export interface GroundingRequest {
  center:SurfacePoint2;
  /** THREE positive Y rotation. Coordinates/contacts are already scaled. */
  yaw?:number;
  footprint:readonly SurfacePoint2[];
  /** Actual foot/root contact coordinates, including their local heights. */
  contacts:readonly SurfacePoint3[];
  masks?:readonly GroundMask[];
  /** Independent upper-volume clearance, without requiring terrain below a crown. */
  centerExclusions?:readonly {mask:GroundMask;padding:number}[];
  clearance?:number;
  maxSlope?:number;
  maxHeightRange?:number;
  maxContactGap?:number;
  penetration?:number;
}

export interface GroundingResult {
  supported:boolean;
  reason:'supported'|'empty-footprint'|'missing-ground'|'blocked'|'steep-ground'|'uneven-ground'|'contact-gap';
  position:THREE.Vector3;
  normal:THREE.Vector3;
  samples:readonly SurfaceHit[];
  missing:readonly SurfacePoint2[];
  blockingMask:string|null;
  heightRange:number;
  contactGap:number;
}

function rotatePoint(point:SurfacePoint2,center:SurfacePoint2,yaw:number):SurfacePoint2 {
  return [center[0]+Math.cos(yaw)*point[0]+Math.sin(yaw)*point[1],center[1]-Math.sin(yaw)*point[0]+Math.cos(yaw)*point[1]];
}

export function checkGrounding(surface:TerrainSurface,request:GroundingRequest,stopOnFailure=false):GroundingResult {
  const yaw=request.yaw??0,normal=new THREE.Vector3(),samples:SurfaceHit[]=[],missing:SurfacePoint2[]=[];
  const result:GroundingResult={supported:false,reason:'empty-footprint',position:new THREE.Vector3(request.center[0],0,request.center[1]),normal,samples,missing,blockingMask:null,heightRange:0,contactGap:0};
  if(!request.footprint.length||!request.contacts.length)return result;
  let blocked:string|null=request.centerExclusions?.find(({mask,padding})=>blockedBy([mask],request.center,padding))?.mask.id??null,steep=false;
  const probe=(point:SurfacePoint2)=>{
    const world=rotatePoint(point,request.center,yaw);
    const hit=surface.sample(world[0],world[1]);
    const mask=blockedBy(request.masks??[],world,request.clearance??0);
    blocked??=mask?.id??null;
    if(!hit){missing.push(world);return null;}
    samples.push(hit);normal.add(hit.normal);
    if(hit.normal.y<Math.cos(request.maxSlope??Math.PI/6))steep=true;
    return hit;
  };
  for(const point of request.footprint){probe(point);if(stopOnFailure&&(missing.length||blocked||steep))break;}
  const contactHeights:number[]=[];
  if(!stopOnFailure||!(missing.length||blocked||steep))for(const [x,y,z] of request.contacts){const hit=probe([x,z]);if(hit)contactHeights.push(hit.position.y-y);if(stopOnFailure&&(missing.length||blocked||steep))break;}
  normal.normalize();
  if(samples.length)result.heightRange=Math.max(...samples.map(s=>s.position.y))-Math.min(...samples.map(s=>s.position.y));
  if(contactHeights.length){result.position.y=Math.max(...contactHeights)-(request.penetration??.015);result.contactGap=Math.max(...contactHeights)-Math.min(...contactHeights);}
  result.blockingMask=blocked;
  result.reason=missing.length?'missing-ground':blocked?'blocked':steep?'steep-ground':result.heightRange>(request.maxHeightRange??.22)?'uneven-ground':result.contactGap>(request.maxContactGap??.1)?'contact-gap':'supported';
  result.supported=result.reason==='supported';
  return result;
}

/** Stable near-first search; does not share the world's random stream. */
export function placementCandidates(center:SurfacePoint2,radius:number,step=.25,seed:number|string=0):SurfacePoint2[] {
  if(!Number.isFinite(radius)||radius<0||!Number.isFinite(step)||step<=0)throw new Error('Invalid placement search dimensions');
  const random=surfaceRandom(seed),points:SurfacePoint2[]=[center];
  const rings=Math.ceil(radius/step),phase=random()*Math.PI*2;
  for(let ring=1;ring<=rings;ring++){
    const r=Math.min(radius,ring*step),count=Math.max(8,Math.ceil(2*Math.PI*r/step));
    for(let i=0;i<count;i++){const a=phase+i/count*Math.PI*2+ring*2.399963229728653;points.push([center[0]+Math.cos(a)*r,center[1]+Math.sin(a)*r]);}
  }
  return points;
}

export function findGrounding(surface:TerrainSurface,request:GroundingRequest,options:{radius:number;step?:number;seed?:number|string}) {
  let last=checkGrounding(surface,request);
  for(const center of placementCandidates(request.center,options.radius,options.step,options.seed)){
    const result=checkGrounding(surface,{...request,center},true);
    if(result.supported)return result;
    last=result;
  }
  return last;
}

export interface SurfaceDistributionOptions {
  seed:number|string;
  count:number;
  masks?:readonly GroundMask[];
  clearance?:number;
  edgeRadius?:number;
  minimumSpacing?:number;
  maxAttempts?:number;
  accept?:(hit:SurfaceHit,random:()=>number)=>boolean;
}

/** Immutable distribution returned once; animation should only update uniforms. */
export function distributeOnSurface(surface:TerrainSurface,options:SurfaceDistributionOptions):SurfaceHit[] {
  if(!Number.isInteger(options.count)||options.count<0)throw new Error('Instance count must be a nonnegative integer');
  const random=surfaceRandom(options.seed),result:SurfaceHit[]=[];
  const spacing=options.minimumSpacing??0;
  if([spacing,options.edgeRadius??0,options.clearance??0].some(n=>!Number.isFinite(n)||n<0))throw new Error('Distribution distances must be finite and nonnegative');
  const occupied=new Map<string,SurfacePoint2[]>();
  const edges=options.edgeRadius?diskProbes(options.edgeRadius,Math.max(options.edgeRadius,.04)):[];
  const maxAttempts=options.maxAttempts??Math.max(100,options.count*24);
  if(!Number.isSafeInteger(maxAttempts)||maxAttempts<0)throw new Error('Sampling attempts must be a finite nonnegative integer');
  for(let attempt=0;attempt<maxAttempts&&result.length<options.count;attempt++){
    const hit=surface.sampleArea(random);if(!hit)break;
    const point:SurfacePoint2=[hit.position.x,hit.position.z];
    // Sampling a lower overlapping face must not bury a tuft under the top skin.
    const top=surface.sample(point[0],point[1]);
    if(!top||top.position.y-hit.position.y>1e-5)continue;
    if(blockedBy(options.masks??[],point,(options.clearance??0)+(options.edgeRadius??0)))continue;
    if(edges.some(([x,z])=>!surface.sample(point[0]+x,point[1]+z)))continue;
    const cx=spacing>0?Math.floor(point[0]/spacing):0,cz=spacing>0?Math.floor(point[1]/spacing):0;
    let tooClose=false;
    if(spacing>0)for(let x=cx-1;x<=cx+1&&!tooClose;x++)for(let z=cz-1;z<=cz+1&&!tooClose;z++)tooClose=(occupied.get(`${x},${z}`)??[]).some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<spacing);
    if(tooClose||options.accept&&!options.accept(hit,random))continue;
    result.push(hit);
    if(spacing>0){const key=`${cx},${cz}`,bucket=occupied.get(key);if(bucket)bucket.push(point);else occupied.set(key,[point]);}
  }
  return result;
}
