import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const finish=(color:string,roughness=.9,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const sphere=new THREE.SphereGeometry(1,16,12),box=new THREE.BoxGeometry(1,1,1);
export function piece(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,position=V(),scale=V(1,1,1)) {
 const object=new THREE.Mesh(geometry,material);object.position.copy(position);object.scale.copy(scale);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
}
export const oval=(p:THREE.Object3D,m:THREE.Material,pos:THREE.Vector3,scale:THREE.Vector3)=>piece(p,sphere,m,pos,scale);
export const block=(p:THREE.Object3D,m:THREE.Material,pos:THREE.Vector3,scale:THREE.Vector3)=>piece(p,box,m,pos,scale);
export function rod(p:THREE.Object3D,m:THREE.Material,a:THREE.Vector3,b:THREE.Vector3,r=.015){const d=b.clone().sub(a),o=piece(p,new THREE.CylinderGeometry(r,r,d.length(),8),m,a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;}
/** Batch only explicitly static leaves, preserving every actor pivot. */
export function batch(group:THREE.Group) {
 group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),parts=new Map<THREE.Material,THREE.BufferGeometry[]>(),remove:THREE.Mesh[]=[];
 group.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;let parent=o.parent;while(parent&&parent!==group){if(parent.userData.livePivot)return;parent=parent.parent;}if(o.userData.livePivot)return;const source=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();source.applyMatrix4(inverse.clone().multiply(o.matrixWorld));source.deleteAttribute('uv');let entries=parts.get(o.material);if(!entries)parts.set(o.material,entries=[]);entries.push(source);remove.push(o);});
 remove.forEach(o=>o.removeFromParent());for(const [material,geometries]of parts){const combined=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(combined)piece(group,combined,material);}
}
const hitMaterial=new THREE.MeshBasicMaterial({visible:false});
export function hitBox(parent:THREE.Object3D,action:string,size:THREE.Vector3,position=V()) {const hit=piece(parent,new THREE.BoxGeometry(size.x,size.y,size.z),hitMaterial,position);hit.userData.livePivot=true;hit.userData.livingAction=action;hit.castShadow=false;hit.receiveShadow=false;return hit;}
export function visibleThroughParents(object:THREE.Object3D){for(let node:THREE.Object3D|null=object;node;node=node.parent)if(!node.visible)return false;return true;}
export function visibleMeshes(object:THREE.Object3D){const meshes:THREE.Mesh[]=[];object.traverseVisible(o=>{if(o instanceof THREE.Mesh&&!(o.material instanceof THREE.MeshBasicMaterial&&o.material.visible===false))meshes.push(o)});return meshes;}
