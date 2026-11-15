import * as THREE from 'three';

export const WORKSHOP_CONTROL_Z=4.1;
type Materials={wood:THREE.Material;wood2:THREE.Material;brass:THREE.Material};
const point=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
function addMesh(group:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,position:THREE.Vector3) {
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function rod(group:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,radius:number,material:THREE.Material) {
  const direction=b.clone().sub(a),mesh=addMesh(group,new THREE.CylinderGeometry(radius,radius,direction.length(),10),material,a.clone().add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(point(0,1,0),direction.normalize());return mesh;
}
function facadeHit(slot:THREE.Group,origin:THREE.Vector3) {
  slot.updateWorldMatrix(true,true);
  const meshes:THREE.Mesh[]=[];slot.traverseVisible(object=>{if(object instanceof THREE.Mesh&&!object.userData.dynamic)meshes.push(object);});
  const ray=new THREE.Raycaster(origin,point(0,0,-1),0,3);
  return ray.intersectObjects(meshes,false)[0]?.point;
}

/** Fixed bearing rail, fastened to actual visible porch columns, never to the rotating disks. */
export function createWorkshopRack(root:THREE.Group,workshop:THREE.Group,materials:Materials) {
  const group=new THREE.Group();group.name='Workshop fixed control rack';group.userData.dynamic=true;root.add(group);
  const anchors:THREE.Vector3[]=[];
  for(const x of [-1.08,1.48]){
    const hit=facadeHit(workshop,point(x,1.05,4.08));
    if(!hit)throw new Error('Workshop control rail has no visible porch attachment');
    anchors.push(hit);
    rod(group,hit.clone().add(point(0,0,-.035)),point(x,1.05,3.99),.045,materials.brass);
    const plate=addMesh(group,new THREE.CylinderGeometry(.095,.095,.035,12),materials.brass,hit.clone());plate.rotation.x=Math.PI/2;
  }
  addMesh(group,new THREE.BoxGeometry(2.64,.14,.10),materials.wood2,point(.2,1.05,3.99));
  for(let i=0;i<3;i++){
    const x=-.45+i*.65;
    rod(group,point(x,1.05,4.02),point(x,1.05,WORKSHOP_CONTROL_Z),.044,materials.brass);
    const collar=addMesh(group,new THREE.TorusGeometry(.068,.015,6,16),materials.brass,point(x,1.05,4.058));
    collar.name='Stationary disk bearing';
  }
  group.userData.attachmentPoints=anchors.map(p=>p.toArray());
  return group;
}

/** A shallow fork on a wall escutcheon replaces the unrelated floating brown block. */
export function createObservatoryCradle(root:THREE.Group,observatory:THREE.Group,reward:THREE.Object3D,materials:Materials) {
  const hit=facadeHit(observatory,point(.95,3.4,-1.8));
  if(!hit)throw new Error('Lens cradle has no visible observatory wall attachment');
  const group=new THREE.Group();group.name='Wall-mounted lens cradle';group.userData.dynamic=true;root.add(group);
  const front=hit.z+.16;
  reward.position.z=front;
  const plate=addMesh(group,new THREE.CylinderGeometry(.105,.105,.045,16),materials.brass,hit.clone().add(point(0,-.055,0)));plate.rotation.x=Math.PI/2;
  for(const side of [-1,1]){
    rod(group,point(.95+side*.055,3.335,hit.z-.012),point(.95+side*.105,3.43,front),.022,materials.brass);
    const rest=addMesh(group,new THREE.SphereGeometry(.032,8,6),materials.brass,point(.95+side*.105,3.435,front));rest.scale.y=.65;
  }
  group.userData.attachmentPoints=[hit.toArray()];group.userData.rewardCenter=reward.position.toArray();
  return group;
}
