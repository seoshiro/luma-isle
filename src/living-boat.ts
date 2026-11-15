import * as THREE from 'three';
import type {WaterStation} from './water-support';
import {hitBox,V} from './living-primitives';

export const BOAT_ENVELOPE={halfLength:.105,halfWidth:.055,height:.064,bob:.004};
export function createBoatRoute(stations:WaterStation[]){
 const points=stations.map(s=>V(s.x,s.waterY+.006,s.z)),lengths=[0];
 for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
 const length=lengths.at(-1)!;
 return{length,points,sample(distance:number,out:THREE.Vector3,tangent:THREE.Vector3){const d=THREE.MathUtils.clamp(distance,0,length);let lo=1,hi=lengths.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(lengths[mid]<d)lo=mid+1;else hi=mid}const a=points[lo-1],b=points[lo];out.copy(a).lerp(b,(d-lengths[lo-1])/(lengths[lo]-lengths[lo-1]));tangent.copy(b).sub(a).normalize();return out}};
}
type Course={boatStations:WaterStation[];waterHits:THREE.Mesh[]};
type Fall={position:THREE.Vector3;profile:{y:number;z:number;cliffZ:number|null}[]};
export function createBoat(root:THREE.Object3D,course:Course,fall:Fall){
 const route=createBoatRoute(course.boatStations),group=new THREE.Group();group.name='Paper boat on actual water';group.userData.dynamic=true;root.add(group);
 // A tiny folded paper hull, no tall mast: its entire envelope fits the real underpass.
 const paper=new THREE.MeshStandardMaterial({color:'#f7e8bf',roughness:.91,side:THREE.DoubleSide,transparent:true});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  0,-.012,-.105,-.055,.018,0,0,-.012,.105, 0,-.012,-.105,0,-.012,.105,.055,.018,0,
  0,-.012,-.105,0,.064,0,-.055,.018,0, 0,-.012,-.105,.055,.018,0,0,.064,0,
  0,-.012,.105,-.055,.018,0,0,.064,0, 0,-.012,.105,0,.064,0,.055,.018,0],3));geometry.computeVertexNormals();
 const hull=new THREE.Mesh(geometry,paper);hull.castShadow=false;hull.receiveShadow=true;group.add(hull);
 const hit=hitBox(group,'boat',V(.32,.20,.37),V(0,.03,0));
 const rippleGeometry=new THREE.RingGeometry(.82,1,32);rippleGeometry.rotateX(-Math.PI/2);
 const rings=Array.from({length:6},()=>{const material=new THREE.MeshBasicMaterial({color:'#def1de',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(rippleGeometry,material);mesh.visible=false;root.add(mesh);return{mesh,material,born:-Infinity}});
 const direction=V(),point=V(),dock=route.points[0].clone();group.position.copy(dock);
 const wake=rings.slice(3);
 let active=false,running=false,started=0,lastRipple=-Infinity,highlighted=false,lastTime=0,finished=-Infinity;
 const duration=route.length/.39,fadeDuration=1.6;
 function ripple(time:number,at?:THREE.Vector3){if(!active||time-lastRipple<.65)return false;lastRipple=time;for(let i=0;i<3;i++){const ring=rings[i];ring.born=time+i*.15;ring.mesh.position.copy(at??dock);ring.mesh.position.y=(at?.y??dock.y)+.006}return true}
 function launch(time:number){if(!active||running||time-finished<.3)return false;running=true;started=time;paper.opacity=1;group.visible=true;group.position.copy(dock);ripple(time,dock);return true}
 function reset(){running=false;finished=-Infinity;lastRipple=-Infinity;group.position.copy(dock);group.rotation.set(0,0,0);paper.opacity=1;rings.forEach(r=>{r.born=-Infinity;r.mesh.visible=false})}
 function update(time:number,enabled:boolean,reduced:boolean,low:boolean){
  lastTime=time;active=enabled;course.waterHits.forEach(m=>m.visible=enabled);group.visible=enabled;
  if(!enabled){if(running)reset();rings.forEach(r=>r.mesh.visible=false);return false}
  let moving=false;
  if(running){const elapsed=time-started;
   if(reduced){group.position.copy(dock);if(elapsed>1.6){running=false;finished=time}}
   else if(elapsed<duration){route.sample(elapsed*.39,point,direction);group.position.copy(point);group.position.y+=Math.sin(time*2.1)*.004;group.rotation.set(Math.sin(time*1.7)*.025,Math.atan2(direction.x,direction.z),Math.sin(time*2.3)*.035);moving=true;
    for(let i=3;i<6;i++){const ring=rings[i];ring.mesh.position.copy(point).addScaledVector(direction,-.12-(i-3)*.08);ring.mesh.position.y=point.y-.001;ring.mesh.scale.setScalar(.035+(i-3)*.022);ring.material.opacity=low?0:.13-(i-3)*.025;ring.mesh.visible=!low}
   }else if(elapsed<duration+fadeDuration){const t=(elapsed-duration)/fadeDuration,profile=fall.profile,idx=Math.min(profile.length-2,Math.floor(t*.36*(profile.length-1))),a=profile[idx],b=profile[idx+1];
    if(a&&b){const u=t*.36*(profile.length-1)-idx;group.position.set(fall.position.x,fall.position.y+THREE.MathUtils.lerp(a.y,b.y,u),fall.position.z+THREE.MathUtils.lerp(a.z,b.z,u));}
    paper.opacity=1-THREE.MathUtils.smoothstep(t,0,1);group.rotation.x=t*.6;moving=true;wake.forEach(r=>r.mesh.visible=false);
   }else{running=false;finished=time;group.visible=false;wake.forEach(r=>r.mesh.visible=false)}
  }else{group.position.copy(dock);group.rotation.set(0,0,0);paper.opacity=THREE.MathUtils.smoothstep(time-finished,.3,1.3);wake.forEach(r=>r.mesh.visible=false)}
  for(let i=0;i<3;i++){const ring=rings[i],age=time-ring.born;ring.mesh.visible=age>=0&&age<1.5&&(!low||i===0);if(ring.mesh.visible){ring.mesh.scale.setScalar(.035+age*.09);ring.material.opacity=.28*(1-age/1.5)}}
  paper.emissive.set(highlighted?'#8b672b':'#000000');paper.emissiveIntensity=highlighted?.23:0;
  hit.visible=!running&&time-finished>=.3;return moving;
 }
 return{hits:[hit,...course.waterHits],update,launch,ripple,available:(time:number)=>({boat:active&&!running&&time-finished>=.3,ripple:active&&time-lastRipple>=.65}),highlight(action:'boat'|'ripple'|null){highlighted=action==='boat'},reset,position:()=>group.position.clone()};
}
