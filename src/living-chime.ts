import * as THREE from 'three';
import {V,finish,piece,oval,rod,batch,hitBox} from './living-primitives';
import type {IslandWind} from './living-wind';
import type {LivingOptions} from './living-types';

export function createChime(garden:THREE.Group,arch:THREE.Mesh,tree:THREE.Object3D|undefined) {
 garden.updateWorldMatrix(true,true);arch.updateWorldMatrix(true,false);
 const origin=garden.localToWorld(V(-.40,2.05,.15)),direction=V(0,1,0).transformDirection(garden.matrixWorld);
 const support=new THREE.Raycaster(origin,direction,0,1).intersectObject(arch,false)[0];
 const group=new THREE.Group();group.name='Arch wind chime';group.userData.dynamic=true;garden.add(group);
 const brass=finish('#9d997d',.45,.5),cord=finish('#655d4b'),wood=finish('#8f7858');
 const mount=support?garden.worldToLocal(support.point.clone()):V(-.4,2.4,.15);group.position.copy(mount);group.visible=!!support;
 const eye=piece(group,new THREE.TorusGeometry(.055,.012,6,16),brass,V(0,-.04,0));eye.rotation.y=Math.PI/2;
 rod(group,cord,V(0,-.06,0),V(0,-.19,0),.006);
 const sway=new THREE.Group();sway.userData.livePivot=true;sway.position.y=-.19;group.add(sway);
 piece(sway,new THREE.CylinderGeometry(.16,.16,.035,16),wood);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2,r=.123,length=.27+(i%3)*.055,x=Math.cos(a)*r,z=Math.sin(a)*r;rod(sway,cord,V(x,0,z),V(x,-.15,z),.0035);piece(sway,new THREE.CylinderGeometry(.023,.023,length,8,1,true),brass,V(x,-.15-length/2,z));}
 rod(sway,cord,V(),V(0,-.58,0),.004);oval(sway,wood,V(0,-.31,0),V(.06,.035,.06));oval(sway,wood,V(0,-.59,0),V(.06,.1,.015));batch(sway);batch(group);
 const hit=hitBox(group,'chime',V(.7,1.05,.65),V(0,-.34,0));
 const positions=new Float32Array(24),fireflyGeometry=new THREE.BufferGeometry();fireflyGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const material=new THREE.PointsMaterial({color:'#e1d8a0',size:.055,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:true});
 const fireflies=new THREE.Points(fireflyGeometry,material);fireflies.name='Brief garden fireflies';fireflies.visible=false;garden.add(fireflies);
 const center=tree?tree.position.clone().add(V(0,.9,0)):V(1.5,.9,-.35);let triggered=-100,cooldown=0,highlight=false;
 group.userData.attachment=mount.toArray();
 function ring(time:number){if(!group.visible||time<cooldown)return false;triggered=time;cooldown=time+6;return true;}
 function update(time:number,stage:number,wind:IslandWind,options:LivingOptions){const age=time-triggered,active=stage===4&&age>=0&&age<5;
  const response=age<2.5?Math.sin(age*9)*Math.exp(-age*1.8)*.17:0;sway.rotation.z=options.reducedMotion?0:wind.lean*.07+response;sway.rotation.x=options.reducedMotion?0:wind.lean*.025;
  brass.emissive.set('#adad82');brass.emissiveIntensity=highlight?.18:0;hit.visible=group.visible&&stage===4;fireflies.visible=active;
  if(active){const envelope=Math.sin(Math.PI*age/5);material.opacity=envelope*(options.effectiveLighting==='morning'?.27:.64);fireflyGeometry.setDrawRange(0,options.quality==='low'?3:8);for(let i=0;i<8;i++){const a=i*2.399+(options.reducedMotion?0:time*.17),radius=.24+(i%3)*.13;positions[i*3]=center.x+Math.cos(a)*radius;positions[i*3+1]=center.y+(i%4)*.15+(options.reducedMotion?0:Math.sin(time*.8+i)*.06);positions[i*3+2]=center.z+Math.sin(a)*radius;}fireflyGeometry.attributes.position.needsUpdate=true;}
  return age>=0&&age<2.5;
 }
 return{group,hit,ring,update,available:(time:number,stage:number)=>group.visible&&stage===4&&time>=cooldown,highlight:(value:boolean)=>{highlight=value},reset:()=>{triggered=-100;cooldown=0;fireflies.visible=false;sway.rotation.set(0,0,0)},position:()=>group.getWorldPosition(V()).add(V(0,-.45,0))};
}
