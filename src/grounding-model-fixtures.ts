/** Node-only geometry fixtures; not imported by the application bundle. */
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ART_ASSETS,type ArtSlot} from './art';

export async function geometryFixture(file:string) {
  const source=readFileSync(new URL(`../public/models/${file}`,import.meta.url));
  const jsonLength=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+jsonLength).toString());
  delete json.images;delete json.textures;delete json.samplers;
  json.materials=json.materials?.map(()=>({pbrMetallicRoughness:{baseColorFactor:[.7,.7,.7,1],roughnessFactor:1}}));
  const serialized=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(serialized.length/4)*4,32);serialized.copy(padded);
  const binary=source.subarray(20+jsonLength),output=Buffer.alloc(20+padded.length+binary.length);
  output.writeUInt32LE(0x46546c67,0);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
  return (await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'')).scene;
}

export async function installGeometryFixtures(world:{artSlots:Record<Exclude<ArtSlot,'tree'>|'gardenBase',THREE.Group>;artTrees:THREE.Group[]},exclude:readonly ArtSlot[]=[]) {
  for(const spec of ART_ASSETS){
    if(exclude.includes(spec.slot))continue;
    const model=await geometryFixture(spec.file);model.rotation.y=spec.rotation??0;model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=spec.height/size.y;
    const wrapper=new THREE.Group();wrapper.userData.artSlot=spec.slot;wrapper.scale.set(spec.width?spec.width/size.x:scale,scale,spec.depth?spec.depth/size.z:scale);model.position.set(-center.x,-bounds.min.y,-center.z);wrapper.add(model);wrapper.position.set(...(spec.offset??[0,0,0]));if(spec.surfaceY!==undefined)wrapper.position.y-=(spec.surfaceY-bounds.min.y)*scale;
    const targets=spec.slot==='tree'?world.artTrees:[world.artSlots[spec.slot]];
    targets.forEach((slot,i)=>{for(const child of slot.children)if(child.userData.artScaffold)child.visible=false;const copy=i===0?wrapper:wrapper.clone(true);if(spec.slot==='tree')copy.rotation.y=i*2.4;slot.add(copy);});
    if(spec.slot==='island'){const small=wrapper.clone(true);small.scale.set(5.8/size.x,2.2/size.y,4.8/size.z);small.position.set(0,-((spec.surfaceY??bounds.max.y)-bounds.min.y)*2.2/size.y,0);for(const child of world.artSlots.gardenBase.children)if(child.userData.artScaffold)child.visible=false;world.artSlots.gardenBase.add(small);}
  }
}

export function stubSceneCanvas() {
  const previous=globalThis.document;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})}});
  return ()=>Object.defineProperty(globalThis,'document',{configurable:true,value:previous});
}
