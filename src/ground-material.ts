import * as THREE from 'three';
import type {TerrainSurface,TerrainSource} from './terrain-surface';

/** Broad, low-contrast meadow variation; no high-frequency carpet texture. */
export function meadowGroundColor(x:number,z:number) {
  const broad=Math.sin(x*.43+Math.sin(z*.31)*.8)*Math.cos(z*.38-x*.11);
  const secondary=Math.sin(x*1.15+z*.71)*Math.sin(z*.93)*.035;
  const color=new THREE.Color('#7e975e').lerp(new THREE.Color('#98ab73'),.38+broad*.17+secondary);
  const soil=THREE.MathUtils.smoothstep(Math.sin(x*.8+2)*Math.cos(z*.62-1),.76,1)*.22;
  return color.lerp(new THREE.Color('#958361'),soil);
}

function textureSampler(material:THREE.Material|THREE.Material[]) {
  const m=Array.isArray(material)?material[0]:material;
  if(!(m instanceof THREE.MeshStandardMaterial)||!m.map?.image)return null;
  try {
    const image=m.map.image as CanvasImageSource&{width:number;height:number};
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
    context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    return (u:number,v:number)=>{
      const x=THREE.MathUtils.clamp(Math.floor(u*canvas.width),0,canvas.width-1);
      // GLTFLoader sets flipY=false: v=0 is the first decoded image row.
      const y=THREE.MathUtils.clamp(Math.floor(v*canvas.height),0,canvas.height-1),offset=(y*canvas.width+x)*4;
      const r=pixels.data[offset],g=pixels.data[offset+1],b=pixels.data[offset+2];
      return g>r*1.075&&g>b*1.2;
    };
  }catch{return null;}
}

/** Split face indices into meadow and original cliff material. Original UV/stone
 * atlas remains untouched. No overlay, vertex displacement or shell holes.
 */
export function calmTerrainMaterial(sources:readonly TerrainSource[],surface:TerrainSurface,frame:THREE.Object3D,loaded:boolean) {
  frame.updateWorldMatrix(true,false);const inverse=frame.matrixWorld.clone().invert();
  const selected=new Map<THREE.Mesh,Set<number>>();
  for(const face of surface.faces){const set=selected.get(face.source);if(set)set.add(face.sourceTriangle);else selected.set(face.source,new Set([face.sourceTriangle]));}
  const originalGeometries=new Set<THREE.BufferGeometry>(),materials:THREE.MeshStandardMaterial[]=[];
  const diagnostics={meadowTriangles:0,preservedTriangles:0,greenFragmentsRecolored:0};
  for(const {mesh}of sources){
    const original=mesh.geometry,geometry=original.clone(),p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),index=geometry.getIndex();
    mesh.updateWorldMatrix(true,false);const transform=inverse.clone().multiply(mesh.matrixWorld),positions:THREE.Vector3[]=[],colors:number[]=[];
    for(let i=0;i<p.count;i++){const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform);positions.push(point);const c=meadowGroundColor(point.x,point.z);colors.push(c.r,c.g,c.b);}
    const meadowIndices:number[]=[],stoneIndices:number[]=[],faces=selected.get(mesh)??new Set<number>(),isGreen=loaded?textureSampler(mesh.material):null;
    const count=index?.count??p.count;
    for(let i=0;i<count;i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      const greenAtCenter=isGreen&&uv?isGreen(ids.reduce((sum,id)=>sum+uv.getX(id),0)/3,ids.reduce((sum,id)=>sum+uv.getY(id),0)/3):true;
      let meadow=faces.has(i/3)&&greenAtCenter;
      if(!meadow&&isGreen&&uv){
        const local=ids.map(id=>positions[id]),center=new THREE.Vector3().add(local[0]).add(local[1]).add(local[2]).multiplyScalar(1/3);
        const under=surface.sample(center.x,center.z);
        // Only green protrusions immediately above the selected meadow are recolored.
        // Stone UV patches and all low cliff vegetation retain their original atlas.
        if(under&&center.y>=under.position.y-.025&&center.y<=under.position.y+.48){
          const green=isGreen(ids.reduce((sum,id)=>sum+uv.getX(id),0)/3,ids.reduce((sum,id)=>sum+uv.getY(id),0)/3);
          if(green){meadow=true;diagnostics.greenFragmentsRecolored++;}
        }
      }
      (meadow?meadowIndices:stoneIndices).push(...ids);
    }
    const meadow=new THREE.MeshStandardMaterial({name:'Quiet meadow earth',color:0xffffff,vertexColors:true,roughness:1,metalness:0});materials.push(meadow);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex([...stoneIndices,...meadowIndices]);geometry.clearGroups();
    const oldMaterial=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    if(stoneIndices.length)geometry.addGroup(0,stoneIndices.length,0);
    if(meadowIndices.length)geometry.addGroup(stoneIndices.length,meadowIndices.length,1);
    mesh.geometry=geometry;mesh.material=[oldMaterial,meadow];originalGeometries.add(original);
    diagnostics.meadowTriangles+=meadowIndices.length/3;diagnostics.preservedTriangles+=stoneIndices.length/3;
  }
  return {diagnostics,originalGeometries,materials};
}
