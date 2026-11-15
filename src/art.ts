import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {ART_TIMEOUT_MS} from './scene-policy';
function disposeArt(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value)}}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
export type ArtSlot='mill'|'workshop'|'observatory'|'lighthouse'|'tree'|'island';
export interface ArtSpec {slot:ArtSlot;file:string;height:number;surfaceY?:number;width?:number;depth?:number;rotation?:number;offset?:[number,number,number]}
// Only verified, locally bundled assets belong in this list. No external runtime calls.
export const ART_ASSETS:ArtSpec[]=[{slot:"mill",file:"mill.glb",height:3.8,rotation:-Math.PI/2,offset:[-.4,0,-.2]},{slot:"workshop",file:"workshop.glb",height:3.3,rotation:-Math.PI/2},{slot:"observatory",file:"observatory.glb",height:2.4,width:3.3,depth:3.15,rotation:-Math.PI/2},{slot:"lighthouse",file:"lighthouse.glb",height:4.0,width:2.0,depth:2.0,rotation:-Math.PI/2},{slot:"island",file:"island.glb",height:5.8,width:24.5,depth:16,surfaceY:.164},{slot:"tree",file:"tree.glb",height:3.35}];
export async function loadIslandArt(slots:Record<Exclude<ArtSlot,"tree">|"gardenBase",THREE.Group>,trees:THREE.Group[],isDisposed:()=>boolean,signal?:AbortSignal){
 const loader=new GLTFLoader();const loaded:string[]=[],failed:string[]=[];
 await Promise.all(ART_ASSETS.map(async spec=>{
  const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  let candidate:THREE.Object3D|undefined;let adopted=false;
  const timeout=setTimeout(abort,ART_TIMEOUT_MS);
  try{
   // A timed, abortable fetch avoids GLTFLoader's unbounded FileLoader request.
   // Bundled GLBs are self contained, so abort does not leave external texture fetches.
   const url=`${import.meta.env.BASE_URL}models/${spec.file}`;
   const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`Model HTTP ${response.status}`);
   const bytes=await response.arrayBuffer();
   const parsing=loader.parseAsync(bytes,url.slice(0,url.lastIndexOf('/')+1));
   const gltf=await new Promise<Awaited<typeof parsing>>((resolve,reject)=>{
    const cancel=()=>reject(new DOMException('Model load cancelled or timed out','AbortError'));
    controller.signal.addEventListener('abort',cancel,{once:true});
    if(controller.signal.aborted)cancel();
    parsing.then(result=>{controller.signal.removeEventListener('abort',cancel);if(controller.signal.aborted||isDisposed()){disposeArt(result.scene);cancel()}else resolve(result)},error=>{controller.signal.removeEventListener('abort',cancel);reject(error)});
   });
   candidate=gltf.scene;if(isDisposed()||controller.signal.aborted)return;
   const model=gltf.scene;model.name=`Higgsfield ${spec.slot}`;model.rotation.y=spec.rotation??0;model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<.001)throw new Error('Empty model');
   const scale=spec.height/size.y;const wrapper=new THREE.Group();wrapper.name=`Generated art: ${spec.slot}`;wrapper.scale.set(spec.width?spec.width/size.x:scale,scale,spec.depth?spec.depth/size.z:scale);model.position.set(-center.x,-bounds.min.y,-center.z);wrapper.add(model);wrapper.position.set(...(spec.offset??[0,0,0]));if(spec.surfaceY!==undefined)wrapper.position.y-=(spec.surfaceY-bounds.min.y)*scale;
   model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true}});
   const targets=spec.slot==="tree"?trees:[slots[spec.slot]];targets.forEach((slot,i)=>{for(const child of slot.children)if(child.userData.artScaffold)child.visible=false;const art=i===0?wrapper:wrapper.clone(true);if(spec.slot==="tree")art.rotation.y=i*2.4;slot.add(art)});if(spec.slot==="island"){const small=wrapper.clone(true);small.scale.set(5.8/size.x,2.2/size.y,4.8/size.z);small.position.set(0,-((spec.surfaceY??bounds.max.y)-bounds.min.y)*2.2/size.y,0);for(const child of slots.gardenBase.children)if(child.userData.artScaffold)child.visible=false;slots.gardenBase.add(small)}loaded.push(spec.slot);
   adopted=true;
  }catch(error){failed.push(spec.slot);if(!isDisposed())console.warn(`LUMA art fallback: ${spec.slot}`,error);}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);if(candidate&&!adopted)disposeArt(candidate)}
 }));return {loaded,failed};
}
