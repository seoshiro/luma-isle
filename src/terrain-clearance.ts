import * as THREE from 'three';
import {blockedBy,type GroundMask} from './ground-placement';
import type {TerrainSource,TerrainSurface} from './terrain-surface';

/** Remove tiny embedded GLB foliage fins from clear circulation, never the ground.
 * The base surface is a fixed connected snapshot. Degenerate only rejected faces,
 * retaining vertex positions and source triangle numbering for support/material QA.
 */
export function clearTerrainProtrusions(sources:readonly TerrainSource[],surface:TerrainSurface,frame:THREE.Object3D,masks:readonly GroundMask[]) {
 const bases=new Map<THREE.Mesh,Set<number>>();for(const face of surface.faces){let set=bases.get(face.source);if(!set)bases.set(face.source,set=new Set());set.add(face.sourceTriangle);}
 frame.updateWorldMatrix(true,false);const inverse=frame.matrixWorld.clone().invert();let removed=0;
 for(const {mesh}of sources){const old=mesh.geometry,p=old.getAttribute('position'),oldIndex=old.getIndex();if(!oldIndex)continue;mesh.updateWorldMatrix(true,false);const matrix=inverse.clone().multiply(mesh.matrixWorld),indices=Array.from(oldIndex.array),base=bases.get(mesh)??new Set<number>();let changed=0;
  for(let i=0;i<oldIndex.count;i+=3){if(base.has(i/3))continue;const ids=[indices[i],indices[i+1],indices[i+2]],points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(matrix)),center=points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3);
   if(center.y<-.5||center.y>.65||![center,...points].some(v=>blockedBy(masks,[v.x,v.z],.065)))continue;
   const under=surface.sample(center.x,center.z);if(!under)continue;const low=Math.min(...points.map(v=>v.y)),high=Math.max(...points.map(v=>v.y));
   if(low<under.position.y-.035||high>under.position.y+.48||high<under.position.y+.035)continue;
   indices[i+1]=indices[i];indices[i+2]=indices[i];changed++;
  }
  if(changed){const geometry=old.clone();geometry.setIndex(indices);mesh.geometry=geometry;removed+=changed;}
 }
 return{removedTriangles:removed};
}
