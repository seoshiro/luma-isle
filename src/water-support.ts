import * as THREE from 'three';
import type {TerrainSurface,SurfacePoint3} from './terrain-surface';
import {createSupportStoneMaterial} from './support-stone';

type Ground=Pick<TerrainSurface,'sample'>;
export interface WaterStation {x:number;z:number;width:number;waterY:number}
export interface WaterSupportReport {outlet:SurfacePoint3;supportSamples:SurfacePoint3[];missing:SurfacePoint3[];maximumDepth:number;stations:number}
const station=(z:number):WaterStation=>({x:-3.9-.3*THREE.MathUtils.smoothstep(z,2.4,3.6),z,width:.43+.07*THREE.MathUtils.smoothstep(z,2.5,3.7),waterY:.13-.025*THREE.MathUtils.smoothstep(z,3.25,4)});

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
  const positions:number[]=[],indices:number[]=[];
  const quad=(a:SurfacePoint3,b:SurfacePoint3,c:SurfacePoint3,d:SurfacePoint3)=>{const i=positions.length/3;for(const p of [a,b,c,d])positions.push(...p);indices.push(i,i+1,i+2,i,i+2,i+3);};
  const solidCorners=(corners:SurfacePoint3[])=>{
    if(corners.reduce((area,p,i)=>{const q=corners[(i+1)%corners.length];return area+p[0]*q[2]-q[0]*p[2];},0)<0)corners.reverse();
    const bottoms=corners.map(p=>{const hit=ground.sample(p[0],p[2]);if(!hit){report.missing.push(p);return null;}const bottom:[number,number,number]=[p[0],Math.min(hit.position.y-.04,p[1]-.06),p[2]];report.supportSamples.push([p[0],hit.position.y,p[2]]);report.maximumDepth=Math.max(report.maximumDepth,p[1]-hit.position.y);return bottom;});
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
    if(![-1.85,-.5,.85].some(z=>Math.abs((a.z+b.z)/2-z)<.26))solid(a,b,a.width,a.width+.18,b.width,b.width+.18,bankY(a),bankY(b));
  }
  for(const z of [-1.85,-.5,.85]){
    const c=Math.cos(.35),s=Math.sin(.35),corner=(along:number,across:number,y:number):SurfacePoint3=>[-3.1+c*along-s*across,y,z+s*along+c*across];
    const strip=(left:number,right:number,y:number)=>solidCorners([corner(-.6,left,y),corner(-.6,right,y),corner(.6,right,y),corner(.6,left,y)]);
    strip(-.16,.16,.095);strip(-.28,-.16,.23);strip(.16,.28,.23);
  }
  const stoneGeometry=new THREE.BufferGeometry();stoneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));stoneGeometry.setIndex(indices);stoneGeometry.computeVertexNormals();
  const stone=new THREE.Mesh(stoneGeometry,createSupportStoneMaterial('#c2b398'));stone.name='Terrain-seated bed and banks';stone.castShadow=true;stone.receiveShadow=true;group.add(stone);
  const tail=stations.filter(s=>s.z>=1.04),waterPositions:number[]=[],waterIndices:number[]=[];
  tail.forEach((s,i)=>{waterPositions.push(s.x-s.width,s.waterY,s.z,s.x+s.width,s.waterY,s.z);if(i){const j=i*2;waterIndices.push(j-2,j,j-1,j-1,j,j+1);}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(waterPositions,3));geometry.setIndex(waterIndices);geometry.computeVertexNormals();
  const tailWater=new THREE.Mesh(geometry,water);tailWater.name='Continuous wheel tailrace';tailWater.receiveShadow=true;group.add(tailWater);
  // A thin wet stone lip physically meets the waterfall, rather than a blue box end.
  group.userData.waterSupport=report;
  return {group,tailWater,report};
}
