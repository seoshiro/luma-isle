import * as THREE from 'three';
import {surfaceRandom, type SurfaceHit} from './terrain-surface';

export type MeadowQuality = 'low' | 'medium' | 'high';
export type MeadowAccent = 'tall' | 'clover' | 'flower';
export type MeadowType = 'short' | MeadowAccent;
export interface MeadowOptions {
  seed?: string | number;
  /** A measured budget ceiling, never a request to sample additional positions. */
  maxInstances?: number;
  regionSize?: number;
  /** Grid cell centers; default [0,0] keeps a small garden in one cell. */
  regionOrigin?: readonly [number,number];
  accentRates?: Partial<Record<MeadowAccent,number>>;
  /** Called only during construction; false falls back to short grass. */
  accentEligible?: (hit:SurfaceHit,type:MeadowAccent)=>boolean;
  quality?: MeadowQuality;
  reducedMotion?: boolean;
  qualityFractions?: Partial<Record<MeadowQuality, number>>;
  nearDistance?: number;
  farDistance?: number;
}
export interface MeadowStats {
  supplied: number; instances: number; accents: number; groups: number;
  triangles: number; geometries: number; materials: number; disposed: boolean;
  activeInstances: number; activeTriangles: number;
  activeGroups: number;
  byType: Record<MeadowType,{instances:number;groups:number;triangles:number}>;
}
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

/** CPU equivalent of the vertex shader, useful for root/LOD regression tests. */
export function meadowDetailScale(rank:number, distance:number, qualityFraction:number, accent:boolean, near=15, far=48) {
  const distanceWeight = 1 - smooth(near, far, distance);
  const coverage = accent ? .22 + .78 * distanceWeight : distanceWeight * qualityFraction;
  return smooth(rank - .13, rank + .13, coverage);
}
export function meadowWind(height:number, time:number, phase:number, reducedMotion:boolean) {
  const flex=Math.min(1,Math.max(0,height)/.13)**2;
  return reducedMotion ? 0 : flex * (.011 * Math.sin(time * 1.35 + phase) + .003 * Math.sin(time * 2.1 + phase * .6));
}

/** Five curved, diamond-section blades form an opaque, dimensional tuft.
 * Every ring has real depth; this is not crossed billboard geometry.
 */
export function createMeadowGeometry(variant=0) {
  const random=surfaceRandom(`blade-${variant}`), positions:number[]=[], colors:number[]=[], indices:number[]=[];
  const root=new THREE.Color('#536c3e'), tip=new THREE.Color('#8ba667');
  const tall=variant===4, blades=variant>=5?0:tall?6:5, segments=tall?4:3;
  for(let blade=0;blade<blades;blade++) {
    const angle=blade/blades*TAU+random()*.55;
    const height=(tall?.30:.13)*( .78+random()*.45);
    const bend=height*(.32+random()*.35), width=(tall?.019:.016)*( .8+random()*.4);
    const dx=Math.cos(angle), dz=Math.sin(angle), base=positions.length/3;
    const offset=.012+random()*.015;
    for(let ring=0;ring<=segments;ring++) {
      const t=ring/segments, center=offset+bend*t*t;
      const w=width*Math.pow(1-t,.7), depth=w*.27;
      const color=root.clone().lerp(tip, .18+t*.82);
      for(const [side,ridge] of [[-1,0],[0,1],[1,0],[0,-1]]) {
        positions.push(dx*center-dz*w*side+dx*depth*ridge,height*t,dz*center+dx*w*side+dz*depth*ridge);
        colors.push(color.r,color.g,color.b);
      }
      if(ring<segments)for(let side=0;side<4;side++) {
        const a=base+ring*4+side,b=base+ring*4+(side+1)%4,c=a+4,d=b+4;
        indices.push(a,c,b,b,c,d);
      }
    }
    // Close the base; it is embedded slightly into the selected ground.
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  // Low-poly closed octahedra provide clover leaf/petal volume from every view.
  function lobe(cx:number,cy:number,cz:number,sx:number,sy:number,sz:number,angle:number,color:string) {
    const base=positions.length/3,c=new THREE.Color(color);
    for(const [x,y,z] of [[-sx,0,0],[sx,0,0],[0,0,-sz],[0,0,sz],[0,sy,0],[0,-sy,0]]) {
      positions.push(cx+Math.cos(angle)*x+Math.sin(angle)*z,cy+y,cz-Math.sin(angle)*x+Math.cos(angle)*z);
      const shade=y<0?.82:1;colors.push(c.r*shade,c.g*shade,c.b*shade);
    }
    for(const [a,b,c] of [[4,0,3],[4,3,1],[4,1,2],[4,2,0],[5,3,0],[5,1,3],[5,2,1],[5,0,2]])indices.push(base+a,base+b,base+c);
  }
  if(variant===5)for(let stem=0;stem<3;stem++) {
    const angle=stem*TAU/3,cx=Math.cos(angle)*.035,cz=Math.sin(angle)*.035,h=.055+stem*.014;
    lobe(cx,h/2,cz,.004,h/2,.004,0,'#536c3e');
    for(let leaf=0;leaf<3;leaf++) {
      const a=angle+leaf*TAU/3;
      lobe(cx+Math.cos(a)*.025,h,cz+Math.sin(a)*.025,.025,.007,.017,-a,'#77964e');
    }
  }
  if(variant===6) {
    lobe(0,.055,0,.004,.055,.004,0,'#536c3e');
    for(let petal=0;petal<5;petal++) {
      const a=petal*TAU/5;lobe(Math.cos(a)*.019,.11,Math.sin(a)*.019,.019,.006,.011,-a,'#dfd4b9');
    }
    lobe(0,.115,0,.01,.006,.01,0,'#b6a978');
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Construct once after terrain adoption. Inputs have already passed surface,
 * edge, path and footprint validation. Group/camera use the input local frame.
 * Updating uniforms never traverses or resamples terrain or rewrites matrices.
 */
export function createMeadow(placements:readonly SurfaceHit[], options:MeadowOptions={}) {
  const maximum=options.maxInstances??placements.length, regionSize=options.regionSize??8;
  const origin=options.regionOrigin??[0,0],rates={tall:.035,clover:.025,flower:0,...options.accentRates};
  if(Object.values(rates).some(n=>!Number.isFinite(n)||n<0)||Object.values(rates).reduce((a,b)=>a+b,0)>1)throw new Error('Invalid meadow accent rates');
  if(!origin.every(Number.isFinite))throw new Error('Invalid meadow region origin');
  const near=options.nearDistance??15,far=options.farDistance??48;
  if(!Number.isInteger(maximum)||maximum<0)throw new Error('Invalid meadow instance budget');
  if(!Number.isFinite(regionSize)||regionSize<=0)throw new Error('Invalid meadow region size');
  if(!Number.isFinite(near)||!Number.isFinite(far)||near<0||far<=near)throw new Error('Invalid meadow distance range');
  const fractions={low:.12,medium:.58,high:1,...options.qualityFractions};
  if(Object.values(fractions).some(value=>!Number.isFinite(value)||value<0||value>1))throw new Error('Invalid meadow quality fraction');
  const group=new THREE.Group();group.name='Surface-bound dimensional meadow';group.userData.dynamic=true;
  const uniforms={meadowTime:{value:0},meadowWindEnabled:{value:options.reducedMotion?0:1},meadowQuality:{value:fractions[options.quality??'high']},meadowCamera:{value:new THREE.Vector3()},meadowNear:{value:near},meadowFar:{value:far}};
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0});
  material.customProgramCacheKey=()=> 'luma-dimensional-meadow-v2';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`attribute vec3 meadowVariation;
uniform float meadowTime, meadowWindEnabled, meadowQuality, meadowNear, meadowFar;
uniform vec3 meadowCamera;
${shader.vertexShader}`;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float meadowDistance = distance(instanceMatrix[3].xyz, meadowCamera);
float meadowDistanceWeight = 1.0 - smoothstep(meadowNear, meadowFar, meadowDistance);
float meadowCoverage = mix(meadowDistanceWeight * meadowQuality, .22 + .78 * meadowDistanceWeight, meadowVariation.z);
float meadowScale = smoothstep(meadowVariation.x - .13, meadowVariation.x + .13, meadowCoverage);
transformed *= meadowScale;
float meadowFlex = clamp(position.y / .13, 0.0, 1.0);
float meadowBend = meadowFlex * meadowFlex * meadowWindEnabled * meadowScale;
transformed.x += meadowBend * (.011 * sin(meadowTime * 1.35 + meadowVariation.y) + .003 * sin(meadowTime * 2.1 + meadowVariation.y * .6));
transformed.z += meadowBend * .006 * sin(meadowTime * 1.05 + meadowVariation.y);
`);
  };
  const random=surfaceRandom(options.seed??'surface-meadow');
  const buckets=new Map<string,{hit:SurfaceHit;variant:number;rank:number;phase:number;yaw:number;scale:number}[]>();
  // Randomized ranking selects a spatially mixed prefix if callers lower the cap.
  const ranked=placements.map(hit=>({hit,order:random()})).sort((a,b)=>a.order-b.order).slice(0,maximum);
  for(const {hit} of ranked) {
    if(![...hit.position.toArray(),...hit.normal.toArray()].every(Number.isFinite)||hit.normal.lengthSq()<1e-10)throw new Error('Invalid meadow surface placement');
    const chance=random();
    const type:MeadowAccent|null=chance<rates.tall?'tall':chance<rates.tall+rates.clover?'clover':chance<rates.tall+rates.clover+rates.flower?'flower':null;
    const variant=type&&(options.accentEligible?.(hit,type)??true)?({tall:4,clover:5,flower:6}[type]):Math.floor(random()*4);
    const key=`${Math.floor((hit.position.x-origin[0])/regionSize+.5)},${Math.floor((hit.position.z-origin[1])/regionSize+.5)},${variant}`;
    const entry={hit,variant,rank:random()*.94+.03,phase:hit.position.x*.6+hit.position.z*.45,yaw:random()*TAU,scale:.8+random()*.4};
    const bucket=buckets.get(key);if(bucket)bucket.push(entry);else buckets.set(key,[entry]);
  }
  const templates=Array.from({length:7},(_,i)=>createMeadowGeometry(i));
  const geometries:THREE.BufferGeometry[]=[],meshes:THREE.InstancedMesh[]=[];
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),yaw=new THREE.Quaternion(),scale=new THREE.Vector3();
  const stats:MeadowStats={supplied:placements.length,instances:ranked.length,accents:0,groups:buckets.size,triangles:0,geometries:0,materials:1,disposed:false,activeInstances:0,activeTriangles:0,activeGroups:0,byType:{short:{instances:0,groups:0,triangles:0},tall:{instances:0,groups:0,triangles:0},clover:{instances:0,groups:0,triangles:0},flower:{instances:0,groups:0,triangles:0}}};
  for(const [key,entries] of buckets) {
    // Rank-ordered instances allow quality changes to reduce real vertex work.
    entries.sort((a,b)=>a.rank-b.rank);
    const geometry=templates[entries[0].variant].clone();geometries.push(geometry);
    const variation=new Float32Array(entries.length*3);
    const mesh=new THREE.InstancedMesh(geometry,material,entries.length);mesh.name=`Meadow region ${key}`;
    mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.dynamic=true;
    entries.forEach((entry,index)=>{
      const normal=entry.hit.normal.clone().normalize();
      rotation.setFromUnitVectors(UP,normal);yaw.setFromAxisAngle(UP,entry.yaw);rotation.multiply(yaw);
      matrix.compose(entry.hit.position.clone().addScaledVector(normal,-.008),rotation,scale.setScalar(entry.scale));mesh.setMatrixAt(index,matrix);
      variation.set([entry.rank,entry.phase,entry.variant>=4?1:0],index*3);
      if(entry.variant>=4)stats.accents++;
    });
    geometry.setAttribute('meadowVariation',new THREE.InstancedBufferAttribute(variation,3));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    // Include maximum wind displacement in static CPU culling bounds.
    if(mesh.boundingSphere)mesh.boundingSphere.radius+=.08;
    if(mesh.boundingBox)mesh.boundingBox.expandByScalar(.08);
    stats.triangles+=(geometry.index?.count??0)/3*entries.length;
    const type:MeadowType=entries[0].variant<4?'short':entries[0].variant===4?'tall':entries[0].variant===5?'clover':'flower';
    stats.byType[type].instances+=entries.length;stats.byType[type].groups++;stats.byType[type].triangles+=(geometry.index?.count??0)/3*entries.length;
    meshes.push(mesh);group.add(mesh);
  }
  templates.forEach(geometry=>geometry.dispose());stats.geometries=geometries.length;
  function applyQuality(quality:MeadowQuality,camera?:THREE.Vector3) {
    stats.activeInstances=0;stats.activeTriangles=0;stats.activeGroups=0;
    for(const mesh of meshes) {
      const variation=mesh.geometry.getAttribute('meadowVariation');
      // The closest point in this region bounds every instance's coverage.
      // Skip only a suffix already fully collapsed by the shader: no popping.
      const distance=camera&&mesh.boundingBox?mesh.boundingBox.distanceToPoint(camera):0;
      const distanceWeight=1-smooth(near,far,distance);
      const coverage=variation.getZ(0)===0?distanceWeight*fractions[quality]:.22+.78*distanceWeight;
      let low=0,high=variation.count;
      while(low<high){const middle=(low+high)>>>1;if(variation.getX(middle)<coverage+.13)low=middle+1;else high=middle;}
      const count=low;
      mesh.count=count;mesh.visible=count>0;
      stats.activeInstances+=count;stats.activeTriangles+=count*(mesh.geometry.index?.count??0)/3;
      if(count)stats.activeGroups++;
    }
  }
  applyQuality(options.quality??'high');
  function update(timeSeconds:number,cameraPositionLocal:THREE.Vector3,state:{quality?:MeadowQuality;reducedMotion?:boolean}={}) {
    if(stats.disposed)return;
    uniforms.meadowTime.value=state.reducedMotion?0:timeSeconds;
    uniforms.meadowWindEnabled.value=(state.reducedMotion??options.reducedMotion)?0:1;
    uniforms.meadowQuality.value=fractions[state.quality??options.quality??'high'];
    applyQuality(state.quality??options.quality??'high',cameraPositionLocal);
    uniforms.meadowCamera.value.copy(cameraPositionLocal);
  }
  function dispose() {
    if(stats.disposed)return;stats.disposed=true;group.removeFromParent();group.clear();
    meshes.forEach(mesh=>mesh.dispose());geometries.forEach(geometry=>geometry.dispose());material.dispose();
  }
  return {group,update,dispose,stats};
}
