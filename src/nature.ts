import * as THREE from 'three';
import {markGroundObject} from './island-grounding';

export interface NatureOptions { reducedMotion?: boolean; quality?: 'low'|'medium'|'high'; finalReveal?: boolean }
const TAU = Math.PI * 2;

/** Both flight envelopes stay outside the island or above its tallest roofs. */
export function birdPosition(index: number, time: number, lift = 0) {
  const flock = index < 4 ? 0 : 1;
  const slot = index % 4;
  const angle = time * .115 + slot * .16 + flock * 2.8;
  return new THREE.Vector3(
    (flock ? 14.3 : -9) + Math.cos(angle) * (flock ? 4.4 : 5.1) + slot * .18,
    8.1 + flock * .7 + Math.sin(angle * 1.7 + slot * .3) * .55 + slot * .18 + lift,
    (flock ? -2 : 2) + Math.sin(angle) * (flock ? 3.6 : 5.3),
  );
}

/** A waiting orbit above the garden makes the reward launch continuous and visible.
 * Even its lowest point clears the arch/tree; the climb stays east of the lighthouse.
 * Smootherstep also matches the high route's velocity when the eight-second lift ends.
 */
export function gardenBirdPosition(index:number,time:number,revealAge:number){
  const slot=index%4,angle=time*.3+slot*.35;
  const progress=THREE.MathUtils.smootherstep(revealAge,0,8);
  const spread=Math.sin(progress*Math.PI);
  const waiting=new THREE.Vector3(
    14.3+Math.cos(angle)*.85+(slot-1.5)*(.24+spread*.5),
    4.65+slot*.13+Math.sin(angle*1.2)*.07,
    -1.3+Math.sin(angle)*.7+(slot-1.5)*spread*.2,
  );
  return waiting.lerp(birdPosition(index,time),progress);
}

export function createNature(root: THREE.Group, garden: THREE.Group) {
  const birds = new THREE.Group(); birds.name = 'Two quiet flocks'; birds.userData.dynamic = true; root.add(birds);
  const bodyGeometry = new THREE.SphereGeometry(1, 8, 5);
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, .34,.015,-.07, .22,0,.11, .07,0,.14],3));
  wingGeometry.setIndex([0,1,2,0,2,3]); wingGeometry.computeVertexNormals();
  const birdMaterial = new THREE.MeshStandardMaterial({color:'#eee4cf',roughness:1,side:THREE.DoubleSide});
  const wingMaterial = new THREE.MeshStandardMaterial({color:'#60766b',roughness:1,side:THREE.DoubleSide});
  const flock = Array.from({length:8},(_,index)=>{
    const bird = new THREE.Group(); bird.name = `Island bird ${index+1}`; birds.add(bird);
    const body = new THREE.Mesh(bodyGeometry,birdMaterial);body.scale.set(.065,.065,.17);bird.add(body);
    const wings = [-1,1].map(side=>{const pivot=new THREE.Group();const wing=new THREE.Mesh(wingGeometry,wingMaterial);wing.scale.x=side;pivot.add(wing);bird.add(pivot);return pivot;});
    return {bird,wings};
  });

  const blooms = new THREE.Group(); blooms.name='Garden opening flowers'; blooms.userData.dynamic=true; garden.add(blooms);
  const petalGeometry = new THREE.SphereGeometry(1,7,5);
  const petalMaterial = new THREE.MeshStandardMaterial({color:'#e5bfad',roughness:.9});
  const centerMaterial = new THREE.MeshStandardMaterial({color:'#e9cc83',roughness:.9});
  const stemsMaterial = new THREE.MeshStandardMaterial({color:'#77964e',roughness:1});
  const stemsGeometry = new THREE.CylinderGeometry(.018,.025,.28,5);
  const flowers = Array.from({length:14},(_,i)=>{
    const a=i/14*TAU;const flower=new THREE.Group();flower.position.set(Math.cos(a)*(1.25+(i%3)*.17),.12,Math.sin(a)*1.15);markGroundObject(flower,{kind:'flower',radius:.11,id:`garden-bloom-${i}`});blooms.add(flower);
    const stem=new THREE.Mesh(stemsGeometry,stemsMaterial);stem.position.y=.14;flower.add(stem);
    const head=new THREE.Group();head.position.y=.29;flower.add(head);
    for(let p=0;p<5;p++){const pa=p/5*TAU;const petal=new THREE.Mesh(petalGeometry,petalMaterial);petal.position.set(Math.cos(pa)*.075,0,Math.sin(pa)*.075);petal.scale.set(.095,.035,.055);petal.rotation.y=-pa;head.add(petal);}
    const center=new THREE.Mesh(petalGeometry,centerMaterial);center.scale.set(.045,.04,.045);head.add(center);return head;
  });
  const glowMaterial=new THREE.MeshBasicMaterial({color:'#ffe7aa',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const glow=new THREE.Mesh(new THREE.ConeGeometry(.9,3.8,16,1,true),glowMaterial);glow.position.set(0,1.55,1.45);glow.rotation.x=-Math.PI/2;glow.userData.dynamic=true;garden.add(glow);
  const light=new THREE.PointLight('#ffe1a1',0,5,2);light.position.set(0,1.65,.6);garden.add(light);
  let triggered=false,revealAge=0,flightTime=0;
  function update(dt:number,stage:number,options:NatureOptions){
    if(stage<4){triggered=false;revealAge=0;}
    if(stage>=4&&options.finalReveal)triggered=true;
    if(triggered)revealAge=options.reducedMotion?8:Math.min(8,revealAge+Math.min(dt,.1));
    if(!options.reducedMotion)flightTime+=Math.min(dt,.1);
    const progress=THREE.MathUtils.smoothstep(revealAge,0,5);
    glowMaterial.opacity=progress*.065;light.intensity=progress*1.2;
    flowers.forEach((head,i)=>{const opening=THREE.MathUtils.smoothstep(revealAge, i*.09,3+i*.09);head.scale.set(.25+.75*opening,.55+.45*opening,.25+.75*opening);});
    flock.forEach(({bird,wings},i)=>{
      bird.visible=options.quality!=='low'||i%4<2;
      const t=options.reducedMotion?0:flightTime;
      const age=options.reducedMotion?0:revealAge;
      const p=i>=4?gardenBirdPosition(i,t,age):birdPosition(i,t);
      const next=i>=4?gardenBirdPosition(i,t+.1,age+(triggered&&!options.reducedMotion?.1:0)):birdPosition(i,t+.1);
      bird.position.copy(p);bird.lookAt(next);
      bird.rotation.z=Math.sin(t*.2+i*.4)*.09;
      const flap=options.reducedMotion?.18:Math.sin(t*5.2+i*.8)*.38+.12;
      wings[0].rotation.z=-flap;wings[1].rotation.z=flap;
    });
  }
  return {update,birds};
}

/** Closed tubular ribbons remain dimensional from every orbit angle. */
export function createWaterfall(parent:THREE.Group,water:THREE.Material,foamMaterial:THREE.Material){
  const streams=new THREE.Group();streams.name='Sculpted waterfall';parent.add(streams);
  const ribbons:THREE.Mesh[]=[];
  for(let i=0;i<7;i++){
    const x=(i-3)*.145;
    const points=Array.from({length:10},(_,j)=>new THREE.Vector3(x+Math.sin(j*.9+i)*.045,-j*.53,-.3+Math.min(j,2)*.42+j*.025+Math.sin(j*.7+i)*.055));
    const ribbon=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.085+(i%3)*.012,6,false),water);ribbon.scale.z=.78;streams.add(ribbon);ribbons.push(ribbon);
  }
  const particleGeometry=new THREE.IcosahedronGeometry(1,0);
  const foam=Array.from({length:25},(_,i)=>{const f=new THREE.Mesh(particleGeometry,foamMaterial);f.scale.set(.025+(i%3)*.012,.09+(i%4)*.03,.035);streams.add(f);return f;});
  const sprayMaterial=new THREE.MeshBasicMaterial({color:'#e5f2df',transparent:true,opacity:.075,depthWrite:false});
  const spray=Array.from({length:6},(_,i)=>{const puff=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),sprayMaterial);puff.position.set(Math.sin(i*2.1)*.46,-4.55+(i%2)*.14,.65+Math.cos(i*1.7)*.18);puff.scale.set(.4,.19,.3);streams.add(puff);return puff;});
  let spillZ=(y:number)=>-.234+Math.min(-y/.53,2)*.328-y*.037;
  /** Sample the entire cliff silhouette once, not only the grassy top at the outlet. */
  function fitToCliff(frame:THREE.Group,meshes:THREE.Mesh[]){
    frame.updateWorldMatrix(true,true);parent.updateWorldMatrix(true,true);
    const inverse=frame.matrixWorld.clone().invert(),direction=new THREE.Vector3(0,0,-1).transformDirection(frame.matrixWorld);
    const origin=parent.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse),profile:number[]=[],n=40;
    const samples:{y:number;z:number;cliffZ:number|null}[]=[];
    for(let j=0;j<=n;j++){
      const y=-j/n*4.77,base=-.234+Math.min(-y/.53,2)*.328-y*.037;
      let front=-Infinity;
      for(const x of [-.58,-.44,-.29,-.145,0,.145,.29,.44,.58]){
        const rayOrigin=new THREE.Vector3(origin.x+x,origin.y+y,origin.z+15).applyMatrix4(frame.matrixWorld);
        const hit=new THREE.Raycaster(rayOrigin,direction,0,35).intersectObjects(meshes,false)[0];
        if(hit)front=Math.max(front,hit.point.clone().applyMatrix4(inverse).z-origin.z);
      }
      const z=Math.max(base,front+.15);profile.push(z);samples.push({y,z,cliffZ:Number.isFinite(front)?front:null});
    }
    spillZ=y=>{const t=THREE.MathUtils.clamp(-y/4.77*n,0,n),i=Math.min(n-1,Math.floor(t));return THREE.MathUtils.lerp(profile[i],profile[i+1],t-i);};
    ribbons.forEach((ribbon,i)=>{
      const points=Array.from({length:n+1},(_,j)=>{const y=-j/n*4.77;return new THREE.Vector3((i-3)*.145+Math.sin(j*.25+i)*.025*Math.min(1,j/3),y,spillZ(y));});
      ribbon.geometry.dispose();ribbon.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,false,'catmullrom',.08),80,.085+(i%3)*.012,6,false);ribbon.scale.z=1;
    });
    spray.forEach((p,i)=>p.position.z=spillZ(p.position.y)+.12+Math.cos(i*1.7)*.12);
    streams.userData.cliffClearance=samples;
  }
  function update(time:number,active:boolean,reduced:boolean,low:boolean){streams.visible=active;foam.forEach((f,i)=>{const phase=((reduced?0:time*.36)+i*.173)%1;f.position.set(Math.sin(i*3.4)*.46+Math.sin(phase*7+i)*.035,-phase*4.65,spillZ(-phase*4.65)+.045);f.visible=!low||i%2===0;});spray.forEach((p,i)=>{p.visible=!low||i<3;p.scale.y=.19+(reduced?0:Math.sin(time*.7+i)*.025);});}
  return {update,fitToCliff};
}
