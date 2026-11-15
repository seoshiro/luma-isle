import * as THREE from 'three';
import type {BirdPerch} from './nature';
import {V,finish,block,rod,batch,visibleMeshes} from './living-primitives';

export function createPerches(root:THREE.Group,workshop:THREE.Group,watercourse:THREE.Group,obstacles:THREE.Mesh[]) {
 root.updateWorldMatrix(true,true);const group=new THREE.Group();group.name='Two supported bird stops';group.userData.dynamic=true;root.add(group);const perches:BirdPerch[]=[];
 const down=V(0,-1,0),ray=new THREE.Raycaster();
 const clear=(position:THREE.Vector3)=>{for(const dx of [-.23,0,.23])for(const dz of [-.23,0,.23]){ray.set(V(position.x+dx,9.4,position.z+dz),down);ray.far=Math.max(0,9.4-position.y-.18);if(ray.intersectObjects(obstacles,false).length)return false;}return true;};
 const add=(id:string,position:THREE.Vector3,yaw:number)=>{if(clear(position))perches.push({id,position,yaw,approach:[V(position.x,9.4,position.z),V(position.x,position.y+1.4,position.z),position.clone()]});};
 const channel=visibleMeshes(watercourse).filter(m=>m.name==='Terrain-seated bed and banks');ray.set(V(-3.38,2,-1.05),down);ray.far=3;const bank=ray.intersectObjects(channel,false)[0];if(bank)add('quiet-channel-bank',bank.point.clone().add(V(0,.006,0)),.4);
 const roofMeshes=visibleMeshes(workshop),points:THREE.Vector3[]=[];for(const x of [.04,.36]){ray.set(V(x,8,2.3),down);ray.far=8;const hit=ray.intersectObjects(roofMeshes,false)[0];if(hit)points.push(hit.point);}
 if(points.length===2){const y=Math.max(...points.map(p=>p.y))+.085,position=V(.2,y+.03,2.3);if(clear(position)){const wood=finish('#968167'),metal=finish('#a39776',.6,.25);block(group,wood,V(.2,y,2.3),V(.4,.06,.19));points.forEach(p=>rod(group,metal,p.clone().add(V(0,-.015,0)),V(p.x,y,2.3),.022));group.userData.roofAttachments=points.map(p=>p.toArray());add('workshop-roof-perch',position,.6);}}
 batch(group);group.userData.validatedPerches=perches.map(p=>({id:p.id,position:p.position.toArray(),approach:p.approach.map(v=>v.toArray())}));return{group,perches};
}
