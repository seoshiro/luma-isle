import * as THREE from 'three';
import {BRIDGE,TERRACE,pathFootprint,samplePath,pointInPolygon,terraceProfile,type PathDefinition,type Point2,type Point3} from './world-layout';

const area=(p:readonly Point2[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2;
const key=(p:Point2)=>`${Math.round(p[0]*1e6)},${Math.round(p[1]*1e6)}`;
const lerp=(a:Point2,b:Point2,t:number):Point2=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const cross=(a:Point2,b:Point2)=>a[0]*b[1]-a[1]*b[0];
/** Union ribbon outlines before triangulation, eliminating doubled T-junction surfaces. */
export function unionPathOutlines(input:readonly (readonly Point2[])[]):Point2[][] {
  const polygons=input.map(p=>area(p)>0?[...p]:[...p].reverse());
  const edges:{a:Point2;b:Point2;used:boolean}[]=[];
  polygons.forEach((polygon,index)=>polygon.forEach((a,i)=>{
    const b=polygon[(i+1)%polygon.length],v:Point2=[b[0]-a[0],b[1]-a[1]],cuts=[0,1];
    polygons.forEach((other,otherIndex)=>{if(otherIndex===index)return;other.forEach((c,j)=>{
      const d=other[(j+1)%other.length],w:Point2=[d[0]-c[0],d[1]-c[1]],offset:Point2=[c[0]-a[0],c[1]-a[1]],denom=cross(v,w);
      if(Math.abs(denom)<1e-10)return;const t=cross(offset,w)/denom,u=cross(offset,v)/denom;
      if(t>1e-8&&t<1-1e-8&&u>=-1e-8&&u<=1+1e-8)cuts.push(t);
    })});
    cuts.sort((x,y)=>x-y);
    for(let j=1;j<cuts.length;j++){if(cuts[j]-cuts[j-1]<1e-8)continue;const middle=lerp(a,b,(cuts[j]+cuts[j-1])/2);
      if(polygons.some((p,k)=>k!==index&&pointInPolygon(middle,p)))continue;
      edges.push({a:lerp(a,b,cuts[j-1]),b:lerp(a,b,cuts[j]),used:false});
    }
  }));
  const outgoing=new Map<string,typeof edges>();for(const e of edges){const k=key(e.a);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k)!.push(e)}
  const loops:Point2[][]=[];
  for(const first of edges){if(first.used)continue;const loop:Point2[]=[],start=key(first.a);let edge:typeof first|undefined=first;
    while(edge&&!edge.used){edge.used=true;loop.push(edge.a);if(key(edge.b)===start)break;edge=outgoing.get(key(edge.b))?.find(e=>!e.used)}
    if(!edge||key(edge.b)!==start)throw new Error('Open path boundary');if(loop.length>=3)loops.push(loop);
  }
  return loops;
}
function stationHeight(point:Point2,paths:readonly PathDefinition[]):number {
  let nearest=Infinity,height=paths[0].points[0][1];
  for(const path of paths){const points=samplePath(path);for(let i=1;i<points.length;i++){
    const a=points[i-1].center,b=points[i].center,dx=b[0]-a[0],dz=b[2]-a[2],t=THREE.MathUtils.clamp(((point[0]-a[0])*dx+(point[1]-a[2])*dz)/(dx*dx+dz*dz),0,1),d=Math.hypot(point[0]-a[0]-dx*t,point[1]-a[2]-dz*t);
    if(d<nearest){nearest=d;height=a[1]+(b[1]-a[1])*t}
  }}return height;
}
export function createPathNetworkGeometry(paths:readonly PathDefinition[],thickness=.16):THREE.BufferGeometry {
  const loops=unionPathOutlines(paths.map(pathFootprint)),positions:number[]=[],indices:number[]=[];
  for(const loop of loops){
    const offset=positions.length/3,n=loop.length;for(const p of loop){const y=stationHeight(p,paths);positions.push(p[0],y,p[1],p[0],y-thickness,p[1])}
    const triangles=THREE.ShapeUtils.triangulateShape(loop.map(p=>new THREE.Vector2(...p)),[]);
    for(const tri of triangles){const [a,b,c]=tri,p=loop[a],q=loop[b],r=loop[c];const clockwise=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])<0;indices.push(...(clockwise?[a,b,c]:[a,c,b]).map(i=>offset+i*2))}
    for(let i=0;i<n;i++){const a=offset+i*2,b=offset+(i+1)%n*2;indices.push(a,b,a+1,b,b+1,a+1)}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createPathSeams(paths:readonly PathDefinition[]):THREE.BufferGeometry {
  const positions:number[]=[],indices:number[]=[],outlines=paths.map(pathFootprint);
  paths.forEach((path,index)=>{const samples=samplePath(path,.28);for(let i=1;i<samples.length-1;i++){
    const {center:p,tangent:t}=samples[i];if(outlines.some((outline,j)=>j!==index&&pointInPolygon([p[0],p[2]],outline)))continue;
    const offset=positions.length/3;
    for(const [side,along] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const x=p[0]-t[1]*path.width*.49*side+t[0]*.004*along,z=p[2]+t[0]*path.width*.49*side+t[1]*.004*along;positions.push(x,stationHeight([x,z],paths)+.002,z)}
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createTerraceLayer(bottomRadius:number,topRadius:number,bottomY:number,topY:number,capTop=false):THREE.BufferGeometry {
  const lower=terraceProfile(bottomRadius),upper=terraceProfile(topRadius),positions:number[]=[],indices:number[]=[];
  for(let i=0;i<lower.length;i++)positions.push(lower[i][0],bottomY-TERRACE.center[1],lower[i][1],upper[i][0],topY-TERRACE.center[1],upper[i][1]);
  for(let i=0;i<lower.length;i++){const a=i*2,b=(i+1)%lower.length*2;indices.push(a,b,a+1,b,b+1,a+1)}
  if(capTop){const center=positions.length/3;positions.push(0,topY-TERRACE.center[1],0);for(let i=0;i<upper.length;i++)indices.push(center,i*2+1,((i+1)%upper.length)*2+1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();return flat;
}
/** Both terminal faces are vertical at rest, so neither deck thickness enters a dock. */
export function bridgeDeckVertices(start=0,end=BRIDGE.length):Point3[]{
  const half=BRIDGE.width/2,h=BRIDGE.thickness,shear=h*Math.tan(BRIDGE.restAngle);
  return [[-half,0,-start],[half,0,-start],[half,0,-end],[-half,0,-end],[-half,-h,-start+shear],[half,-h,-start+shear],[half,-h,-end+shear],[-half,-h,-end+shear]];
}
export function createBridgeDeckSection(start:number,end:number):THREE.BufferGeometry {
  const vertices=bridgeDeckVertices(start,end),positions=vertices.flat(),indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
