import * as THREE from 'three';
import type {TerrainSurface,SurfacePoint3} from './terrain-surface';
import {createSupportStoneMaterial} from './support-stone';
import {samplePath} from './world-layout';

type Ground=Pick<TerrainSurface,'sample'>;
export interface WaterStation {x:number;z:number;width:number;waterY:number}
export interface WaterSupportReport {outlet:SurfacePoint3;supportSamples:SurfacePoint3[];missing:SurfacePoint3[];maximumDepth:number;stations:number}
const station=(z:number):WaterStation=>({x:-3.9-.3*THREE.MathUtils.smoothstep(z,2.4,3.6),z,width:.43+.07*THREE.MathUtils.smoothstep(z,2.5,3.7),waterY:.13-.025*THREE.MathUtils.smoothstep(z,3.25,4)});
/** These very same stations generate the wet surface and the floating route. */
export function boatBypassStations():WaterStation[]{
  return samplePath({id:'boat-bypass',width:.38,cornerRadius:.22,points:[[-3.9,.13,.95],[-3.9,.13,1.15],[-2.5,.13,1.65],[-2.45,.13,2.25],[-2.65,.13,2.7],[-4,.13,2.92],[station(3.16).x,.13,3.16]]},.045).map(({center:p})=>({x:p[0],waterY:p[1],z:p[2],width:.19}));
}

/** The outlet stops before either bank leaves real terrain. No invisible cliff piers. */
export function supportedWaterStations(ground:Ground) {
  const samples:WaterStation[]=[];
  for(let index=0;index<=128;index++){
    const s=station(-3.4+index*.12);
    const supported=Array.from({length:13},(_,i)=>s.x+(i/12*2-1)*(s.width+.18)).every(x=>{
      const hit=ground.sample(x,s.z);return !!hit&&s.waterY-hit.position.y<=.74;
    });
    if(!supported){if(s.z<1.2)throw new Error('Sluice course has no terrain support');break;}
    samples.push(s);
  }
  if(samples.length<40)throw new Error('Tailrace has no supported outlet');
  return samples;
}

export function createGroundedWatercourse(ground:Ground,water:THREE.Material) {
  const stations=supportedWaterStations(ground),last=stations.at(-1)!;
  const group=new THREE.Group();group.name='Grounded stone watercourse';group.userData.dynamic=true;
  const report:WaterSupportReport={outlet:[last.x,last.waterY,last.z],supportSamples:[],missing:[],maximumDepth:0,stations:stations.length};
  for(const s of stations){const hit=ground.sample(s.x,s.z);if(hit)report.supportSamples.push([s.x,hit.position.y,s.z]);}
  const bypass=boatBypassStations(),bypassReport:WaterSupportReport={outlet:[bypass.at(-1)!.x,.13,3.16],supportSamples:[],missing:[],maximumDepth:0,stations:bypass.length};
  let currentReport=report;
  const positions:number[]=[],indices:number[]=[];
  const quad=(a:SurfacePoint3,b:SurfacePoint3,c:SurfacePoint3,d:SurfacePoint3)=>{const i=positions.length/3;for(const p of [a,b,c,d])positions.push(...p);indices.push(i,i+1,i+2,i,i+2,i+3);};
  const solidCorners=(corners:SurfacePoint3[])=>{
    if(corners.reduce((area,p,i)=>{const q=corners[(i+1)%corners.length];return area+p[0]*q[2]-q[0]*p[2];},0)<0)corners.reverse();
    const bottoms=corners.map(p=>{const hit=ground.sample(p[0],p[2]);if(!hit){currentReport.missing.push(p);return null;}const bottom:[number,number,number]=[p[0],Math.min(hit.position.y-.04,p[1]-.06),p[2]];currentReport.supportSamples.push([p[0],hit.position.y,p[2]]);currentReport.maximumDepth=Math.max(currentReport.maximumDepth,p[1]-hit.position.y);return bottom;});
    if(bottoms.some(p=>!p))return;
    const [a0,b0,c0,d0]=corners,[a1,b1,c1,d1]=bottoms as SurfacePoint3[];
    quad(a0,d0,c0,b0);quad(a1,b1,c1,d1);quad(a0,b0,b1,a1);quad(b0,c0,c1,b1);quad(c0,d0,d1,c1);quad(d0,a0,a1,d1);
  };
  const solid=(a:WaterStation,b:WaterStation,leftA:number,rightA:number,leftB:number,rightB:number,topA:number,topB:number)=>solidCorners([[a.x+leftA,topA,a.z],[a.x+rightA,topA,a.z],[b.x+rightB,topB,b.z],[b.x+leftB,topB,b.z]]);
  for(let i=1;i<stations.length;i++){
    const a=stations[i-1],b=stations[i];
    solid(a,b,-a.width,a.width,-b.width,b.width,a.waterY-.045,b.waterY-.045);
    const bankY=(s:WaterStation)=>s.z>2.55&&s.z<3.6?.19:s.waterY+.13;
    solid(a,b,-a.width-.18,-a.width,-b.width-.18,-b.width,bankY(a),bankY(b));
    // The existing three branch mouths remain open through the east bank.
    if(![-1.85,-.5,.85,1.25,2.92].some(z=>Math.abs((a.z+b.z)/2-z)<.30))solid(a,b,a.width,a.width+.18,b.width,b.width+.18,bankY(a),bankY(b));
  }
  for(const z of [-1.85,-.5,.85]){
    const c=Math.cos(.35),s=Math.sin(.35),corner=(along:number,across:number,y:number):SurfacePoint3=>[-3.1+c*along-s*across,y,z+s*along+c*across];
    const strip=(left:number,right:number,y:number)=>solidCorners([corner(-.6,left,y),corner(-.6,right,y),corner(.6,right,y),corner(.6,left,y)]);
    strip(-.16,.16,.095);strip(-.28,-.16,.23);strip(.16,.28,.23);
  }
  const side=(points:WaterStation[],i:number,offset:number,y:number):SurfacePoint3=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b.x-a.x,b.z-a.z);return[points[i].x+(b.z-a.z)/d*offset,y,points[i].z-(b.x-a.x)/d*offset]};
  currentReport=bypassReport;
  for(let i=1;i<bypass.length;i++){
    const strip=(lo:number,hi:number,y:number)=>solidCorners([side(bypass,i-1,lo,y),side(bypass,i-1,hi,y),side(bypass,i,hi,y),side(bypass,i,lo,y)]);
    strip(-.19,.19,.085);
    // Mouths overlap the old flume without transverse dams or an internal bank.
    if(bypass[i].x>station(bypass[i].z).x+.60){strip(-.27,-.19,.18);strip(.19,.27,.18)}
  }
  const stoneGeometry=new THREE.BufferGeometry();stoneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));stoneGeometry.setIndex(indices);stoneGeometry.computeVertexNormals();
  const stone=new THREE.Mesh(stoneGeometry,createSupportStoneMaterial('#c2b398'));stone.name='Terrain-seated bed and banks';stone.castShadow=true;stone.receiveShadow=true;group.add(stone);
  const tail=stations.filter(s=>s.z>=1.04),waterPositions:number[]=[],waterIndices:number[]=[];
  tail.forEach((s,i)=>{waterPositions.push(s.x-s.width,s.waterY,s.z,s.x+s.width,s.waterY,s.z);if(i){const j=i*2;waterIndices.push(j-2,j,j-1,j-1,j,j+1);}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(waterPositions,3));geometry.setIndex(waterIndices);geometry.computeVertexNormals();
  const tailWater=new THREE.Mesh(geometry,water);tailWater.name='Continuous wheel tailrace';tailWater.receiveShadow=true;group.add(tailWater);
  const surface=(points:WaterStation[],name:string)=>{const vertices:number[]=[],faces:number[]=[];points.forEach((s,i)=>{vertices.push(...side(points,i,-s.width,s.waterY+.001),...side(points,i,s.width,s.waterY+.001));if(i){const j=i*2;faces.push(j-2,j,j-1,j-1,j,j+1)}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(faces);g.computeVertexNormals();const mesh=new THREE.Mesh(g,water);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh};
  const bypassWater=surface(bypass,'Wheel bypass water'),headWater=surface(stations.filter(s=>s.z<=1.16),'Continuous sluice water');
  const waterHits=[headWater,tailWater,bypassWater];waterHits.forEach(mesh=>mesh.userData.livingAction='ripple');
  const boatStations=bypassReport.missing.length||bypassReport.maximumDepth>.9?[]:[...stations.filter(s=>s.z>=-3.17&&s.z<.95),...bypass,...stations.filter(s=>s.z>3.16)];
  // A thin wet stone lip physically meets the waterfall, rather than a blue box end.
  group.userData.waterSupport=report;
  group.userData.boatBypassSupport=bypassReport;
  return {group,tailWater,report,stations,boatStations,waterHits};
}
