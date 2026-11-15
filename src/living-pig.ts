import * as THREE from 'three';
import {findGrounding,rectangleProbes,type GroundMask} from './ground-placement';
import type {TerrainSurface} from './terrain-surface';
import {V,finish,piece,oval,block,batch,hitBox} from './living-primitives';

/** A small, planted resident. Idle motion stays in its rib cage/head, never its feet. */
export function createPig(root:THREE.Group,surface:TerrainSurface,masks:GroundMask[]) {
 const yaw=0,feet=[[-.15,-.22],[.15,-.22],[-.15,.23],[.15,.23]] as const;
 const placement=findGrounding(surface,{center:[2.8005306251746345,1.1195372364625462],yaw,footprint:rectangleProbes(.29,.59,.12),contacts:feet.map(([x,z])=>[x,0,z]),masks:masks.filter(mask=>mask.id!=='living-keeper-reserve'),clearance:.035,maxSlope:.5,maxHeightRange:.14,maxContactGap:.13,penetration:0},{radius:.7,step:.14,seed:'island-keeper'});
 const group=new THREE.Group();group.name='Little island keeper';group.userData.dynamic=true;group.position.copy(placement.position);group.rotation.y=yaw;root.add(group);group.visible=placement.supported;
 const pink=finish('#bc8e87'),light=finish('#c59a91'),snoutMaterial=finish('#ad7e78'),hoof=finish('#75675b'),sage=finish('#718777'),dark=finish('#443d38');
 const body=new THREE.Group();body.name='Quiet breathing';body.userData.livePivot=true;group.add(body);oval(body,pink,V(0,.34,-.025),V(.265,.23,.395));oval(body,light,V(0,.38,-.22),V(.23,.19,.19));batch(body);
 // Every hoof is seated individually, once, on the loaded top surface.
 const footContacts:number[][]=[];
 feet.forEach(([x,z])=>{const wx=placement.position.x+Math.cos(yaw)*x+Math.sin(yaw)*z,wz=placement.position.z-Math.sin(yaw)*x+Math.cos(yaw)*z,hit=surface.sample(wx,wz);const y=(hit?.position.y??placement.position.y)-placement.position.y;footContacts.push([wx,y+placement.position.y,wz]);oval(group,pink,V(x,y+.145,z),V(.073,.16,.079));oval(group,hoof,V(x,y+.033,z+.005),V(.062,.033,.067));});
 const head=new THREE.Group();head.name='Keeper head';head.userData.livePivot=true;head.position.set(0,.42,.27);group.add(head);
 oval(head,light,V(0,0,.045),V(.205,.18,.22));oval(head,snoutMaterial,V(0,-.045,.24),V(.13,.085,.06));for(const side of [-1,1]){oval(head,dark,V(side*.045,-.035,.292),V(.012,.019,.007));oval(head,dark,V(side*.164,.047,.135),V(.014,.017,.014));}batch(head);
 const ears=[-1,1].map(side=>{const ear=new THREE.Group();ear.userData.livePivot=true;ear.position.set(side*.13,.135,.005);head.add(ear);const shape=oval(ear,pink,V(side*.028,.035,.012),V(.075,.075,.035));shape.rotation.z=-side*.62;shape.rotation.x=.38;oval(ear,snoutMaterial,V(side*.028,.035,.040),V(.045,.042,.009)).rotation.z=-side*.62;batch(ear);return ear});
 const scarf=piece(group,new THREE.TorusGeometry(.186,.035,6,22),sage,V(0,.405,.20),V(1,1,.85));scarf.rotation.x=Math.PI/2;
 const knot=oval(group,sage,V(.19,.36,.22),V(.06,.07,.06));knot.rotation.z=-.3;
 const triangle=new THREE.BufferGeometry();triangle.setAttribute('position',new THREE.Float32BufferAttribute([.15,.35,.24,.25,.32,.25,.22,.19,.26,.15,.35,.247,.22,.19,.267,.25,.32,.257],3));triangle.computeVertexNormals();piece(group,triangle,sage);
 const tail=piece(group,new THREE.TorusGeometry(.055,.018,6,16,Math.PI*1.65),pink,V(.04,.4,-.42));tail.rotation.y=.55;
 const hit=hitBox(group,'pig',V(.84,.9,1.2),V(0,.40,.08));batch(group);
 const hoverMaterial=light;let reactionAt=-100,cooldownUntil=0,highlight=false,look=.1;
 group.userData.footContacts=footContacts;group.userData.placement={supported:placement.supported,reason:placement.reason,position:placement.position.toArray()};
 if(placement.supported)masks.push({id:'living-keeper-rest',kind:'circle',center:[placement.position.x,placement.position.z],radius:.78});
 function react(time:number,camera:THREE.Vector3){if(!group.visible||time<cooldownUntil)return false;reactionAt=time;cooldownUntil=time+3.5;const local=group.worldToLocal(camera.clone());look=THREE.MathUtils.clamp(Math.atan2(local.x,local.z),-.8,.8);return true;}
 function update(time:number,reduced:boolean){const age=time-reactionAt,active=age<1.55,envelope=active?Math.sin(Math.PI*Math.min(1,age/1.55)):0;body.scale.y=1+(reduced?0:Math.sin(time*1.8)*.012);head.rotation.y=envelope*look;head.rotation.x=active?-.09*envelope:reduced?0:Math.max(0,Math.sin(time*.58))*.12;ears.forEach((ear,i)=>{ear.rotation.z=envelope*Math.sin(age*13+i*.7)*.16*(reduced?.3:1)});hoverMaterial.emissive.set('#b9ac85');hoverMaterial.emissiveIntensity=highlight?.12:0;return active;}
 return {group,hit,react,update,available:(time:number)=>group.visible&&time>=cooldownUntil,highlight:(value:boolean)=>{highlight=value},reset:()=>{reactionAt=-100;cooldownUntil=0;head.rotation.set(0,0,0)},position:()=>group.getWorldPosition(V()).add(V(0,.35,0))};
}
