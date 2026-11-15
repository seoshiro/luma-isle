import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export type ArtSlot='mill'|'workshop'|'observatory'|'lighthouse'|'tree'|'island';
export interface ArtSpec {slot:ArtSlot;file:string;height:number;surfaceY?:number;width?:number;depth?:number;rotation?:number;offset?:[number,number,number]}
// Only verified, locally bundled assets belong in this list. No external runtime calls.
export const ART_ASSETS:ArtSpec[]=[{slot:"mill",file:"mill.glb",height:3.8,rotation:-Math.PI/2,offset:[-.4,0,-.2]},{slot:"workshop",file:"workshop.glb",height:3.3,rotation:-Math.PI/2},{slot:"observatory",file:"observatory.glb",height:2.4,width:3.3,depth:3.15,rotation:-Math.PI/2},{slot:"lighthouse",file:"lighthouse.glb",height:4.0,width:2.0,depth:2.0,rotation:-Math.PI/2},{slot:"island",file:"island.glb",height:5.8,width:24.5,depth:16,surfaceY:.164},{slot:"tree",file:"tree.glb",height:3.35}];
export async function loadIslandArt(slots:Record<Exclude<ArtSlot,"tree">|"gardenBase",THREE.Group>,trees:THREE.Group[],isDisposed:()=>boolean){
 const loader=new GLTFLoader();const loaded:string[]=[],failed:string[]=[];
 await Promise.all(ART_ASSETS.map(async spec=>{
  try{
   const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${spec.file}`);
   if(isDisposed()){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});return;}
   const model=gltf.scene;model.name=`Higgsfield ${spec.slot}`;model.rotation.y=spec.rotation??0;model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<.001)throw new Error('Empty model');
   const scale=spec.height/size.y;const wrapper=new THREE.Group();wrapper.name=`Generated art: ${spec.slot}`;wrapper.scale.set(spec.width?spec.width/size.x:scale,scale,spec.depth?spec.depth/size.z:scale);model.position.set(-center.x,-bounds.min.y,-center.z);wrapper.add(model);wrapper.position.set(...(spec.offset??[0,0,0]));if(spec.surfaceY!==undefined)wrapper.position.y-=(spec.surfaceY-bounds.min.y)*scale;
   model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true}});
   const targets=spec.slot==="tree"?trees:[slots[spec.slot]];targets.forEach((slot,i)=>{for(const child of slot.children)if(child.userData.artScaffold)child.visible=false;const art=i===0?wrapper:wrapper.clone(true);if(spec.slot==="tree")art.rotation.y=i*2.4;slot.add(art)});if(spec.slot==="island"){const small=wrapper.clone(true);small.scale.set(5.8/size.x,2.2/size.y,4.8/size.z);small.position.set(0,-((spec.surfaceY??bounds.max.y)-bounds.min.y)*2.2/size.y,0);for(const child of slots.gardenBase.children)if(child.userData.artScaffold)child.visible=false;slots.gardenBase.add(small)}loaded.push(spec.slot);
  }catch(error){failed.push(spec.slot);console.warn(`LUMA art fallback: ${spec.slot}`,error);}
 }));return {loaded,failed};
}