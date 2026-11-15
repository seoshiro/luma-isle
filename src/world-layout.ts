/** Authoritative circulation surfaces. All Y coordinates are walking surfaces. */
export type Point3 = readonly [number, number, number];
export type Point2 = readonly [number, number];
export interface PathDefinition {id:string; points:readonly Point3[]; width:number; cornerRadius?:number}
const center:Point3=[.1,1.6,-3.7];
const near:Point3=[3.35,.34,-.45];
const radius=2.2, cut=.9, radial=Math.hypot(near[0]-center[0],near[2]-center[2]);
const outward:Point2=[(near[0]-center[0])/radial,(near[2]-center[2])/radial];
const far:Point3=[center[0]+outward[0]*radius*cut,1.805,center[2]+outward[1]*radius*cut];
const run=Math.hypot(far[0]-near[0],far[2]-near[2]),rise=far[1]-near[1];
const length=Math.hypot(run,rise),restAngle=Math.atan2(rise,run),raisedAngle=1.5;
const width=1.18,thickness=.13,yaw=Math.atan2(outward[0],outward[1]);

export function bridgePoint(x:number,y:number,s:number,angle=restAngle):Point3 {
  const forward=s*Math.cos(angle)-y*Math.sin(angle);
  return [near[0]+outward[1]*x-outward[0]*forward,near[1]+y*Math.cos(angle)+s*Math.sin(angle),near[2]-outward[0]*x-outward[1]*forward];
}
function cross(a:Point2,b:Point2,c:Point2){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
export function convexHull(points:readonly Point2[]):Point2[]{
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const lo:Point2[]=[],hi:Point2[]=[];
  for(const p of sorted){while(lo.length>1&&cross(lo.at(-2)!,lo.at(-1)!,p)<=0)lo.pop();lo.push(p)}
  for(const p of sorted.reverse()){while(hi.length>1&&cross(hi.at(-2)!,hi.at(-1)!,p)<=0)hi.pop();hi.push(p)}
  return [...lo.slice(0,-1),...hi.slice(0,-1)];
}
const sweepPoints:Point2[]=[];
for(let i=0;i<=64;i++)for(const x of [-.66,.66])for(const y of [-.2,.95])for(const s of [0,length]){
  const p=bridgePoint(x,y,s,restAngle+(raisedAngle-restAngle)*i/64);sweepPoints.push([p[0],p[2]]);
}
export const BRIDGE={near,far,width,thickness,run,length,restAngle,raisedAngle,yaw,outward,sweep:convexHull(sweepPoints)};

/** A common clipped 24-sided profile gives every terrace layer matching facets. */
export function terraceProfile(r:number):Point2[]{
  const polygon:Point2[]=Array.from({length:24},(_,i)=>[Math.sin(i*Math.PI/12)*radius,Math.cos(i*Math.PI/12)*radius] as Point2);
  const clipped:Point2[]=[];const limit=radius*cut;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[0]*outward[0]+a[1]*outward[1]-limit,db=b[0]*outward[0]+b[1]*outward[1]-limit;
    if(da<=1e-9)clipped.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}
  }
  // Match vertex topology, but keep the docking wall vertical through the rim/base.
  // A scaled cut plane would flare into the underside of an otherwise exact deck.
  return clipped.map(p=>{const x=p[0]*r/radius,z=p[1]*r/radius,excess=Math.max(0,x*outward[0]+z*outward[1]-limit);return[x-excess*outward[0],z-excess*outward[1]]});
}
export const TERRACE={center,topY:1.805,seamY:1.455,bottomY:.05,topRadius:radius,seamRadius:2.35,baseRadius:2.8,footprint:terraceProfile(radius).map(p=>[p[0]+center[0],p[1]+center[2]] as Point2),baseFootprint:terraceProfile(2.8).map(p=>[p[0]+center[0],p[1]+center[2]] as Point2)};

export const MAIN_PATHS:readonly PathDefinition[]=[
  // The mill doorstep and water crossing sit over measured GLB stone, not the old cliff edge.
  {id:'main',width:.9,cornerRadius:.65,points:[[-6.15,.17,2.2],[-5.45,.36,3.1],[-3.2,.36,3.1],[-2,.17,4.7],[2,.17,4.5],[4,.17,2],[7,.17,1.6]]},
  {id:'bridge-approach',width:BRIDGE.width,cornerRadius:.5,points:[[4,.17,2],[4.05,.2,.25],BRIDGE.near]},
];
export const GARDEN_ORIGIN:Point3=[14.3,.1,-1.6];
export const GARDEN_PATHS:readonly PathDefinition[]=[{id:'garden',width:.9,cornerRadius:.6,points:[[-2,.14,.3],[.1,.14,.3],[1.1,.14,-.3]]}];
export const GARDEN_DOCK=GARDEN_PATHS[0].points[0].map((n,i)=>n+GARDEN_ORIGIN[i]) as unknown as Point3;
export const GARDEN_CONNECTOR:PathDefinition={id:'garden-connector',width:.9,cornerRadius:.65,points:[MAIN_PATHS[0].points.at(-1)!,[9.2,.17,1.6-2.2*.4/3],[9.8,.19,-.8],[11.5,.22,-1.3],GARDEN_DOCK]};

export interface PathSample {center:Point3;tangent:Point2}
const mix=(a:Point3,b:Point3,t:number):Point3=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const distance=(a:Point3,b:Point3)=>Math.hypot(b[0]-a[0],b[2]-a[2]);
/** Circular corner fillets maintain a true perpendicular width, unlike slab yaw jitter. */
export function samplePath(path:PathDefinition,step=.14):PathSample[]{
  const controls=path.points,centers:Point3[]=[controls[0]];
  const line=(end:Point3)=>{const start=centers.at(-1)!,n=Math.max(1,Math.ceil(distance(start,end)/step));for(let i=1;i<=n;i++)centers.push(mix(start,end,i/n))};
  for(let i=1;i<controls.length-1;i++){
    const a=controls[i-1],b=controls[i],c=controls[i+1],l0=distance(a,b),l1=distance(b,c);
    const incoming:Point2=[(b[0]-a[0])/l0,(b[2]-a[2])/l0],outgoing:Point2=[(c[0]-b[0])/l1,(c[2]-b[2])/l1];
    const turn=Math.atan2(incoming[0]*outgoing[1]-incoming[1]*outgoing[0],incoming[0]*outgoing[0]+incoming[1]*outgoing[1]);
    if(Math.abs(turn)<1e-5){line(b);continue}
    const desired=Math.max(path.cornerRadius??.6,path.width*.65),trim=Math.min(desired*Math.tan(Math.abs(turn)/2),l0*.4,l1*.4),r=trim/Math.tan(Math.abs(turn)/2);
    const start=mix(b,a,trim/l0),end=mix(b,c,trim/l1);line(start);
    const sign=Math.sign(turn),cx=start[0]-incoming[1]*r*sign,cz=start[2]+incoming[0]*r*sign,angle=Math.atan2(start[2]-cz,start[0]-cx),n=Math.max(3,Math.ceil(Math.abs(turn)*r/step));
    for(let j=1;j<=n;j++){const t=j/n;centers.push([cx+Math.cos(angle+turn*t)*r,start[1]+(end[1]-start[1])*t,cz+Math.sin(angle+turn*t)*r])}
  }
  line(controls.at(-1)!);
  return centers.map((p,i)=>{const a=centers[Math.max(0,i-1)],b=centers[Math.min(centers.length-1,i+1)],d=distance(a,b);return{center:p,tangent:[(b[0]-a[0])/d,(b[2]-a[2])/d]}});
}
export function pathFootprint(path:PathDefinition):Point2[]{
  const samples=samplePath(path),left:Point2[]=[],right:Point2[]=[];
  for(const {center:p,tangent:t} of samples){left.push([p[0]-t[1]*path.width/2,p[2]+t[0]*path.width/2]);right.push([p[0]+t[1]*path.width/2,p[2]-t[0]*path.width/2])}
  return [...left,...right.reverse()];
}
export function pointInPolygon(point:Point2,polygon:readonly Point2[]):boolean {
  let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
/** Retain the legacy random stream so geometry repairs do not reseed trees/clouds. */
export function legacyPathRandomCount(points:readonly Point3[]):number {let count=0;for(let i=1;i<points.length;i++)count+=2*Math.ceil(Math.hypot(...points[i].map((n,j)=>n-points[i-1][j]))/.28);return count}
export const LEGACY_MAIN_PATHS:readonly (readonly Point3[])[]=[
  [[-5.5,.08,4],[-2,.08,4.7],[2,.08,4.5],[4,.08,2],[7,.08,1.2]],
  [[1,.08,2],[2,.1,.3],[1.9,.25,-.65]],[[1.9,1.1,-3.2],[.5,1.8,-3.7]],[[-4.9,.08,3.5],[-7,.08,3.9]],
];
export const LEGACY_GARDEN_PATH:readonly Point3[]=[[-2,.05,.3],[.1,.05,.3],[1.1,.05,-.3]];
