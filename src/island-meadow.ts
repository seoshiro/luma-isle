import * as THREE from 'three';
import {calmTerrainMaterial} from './ground-material';
import {distributeOnSurface,maskDistance,type GroundMask} from './ground-placement';
import {createMeadow,type MeadowQuality} from './meadow';
import type {finalizeIslandGrounding} from './island-grounding';

export function createIslandMeadow(ground:ReturnType<typeof finalizeIslandGrounding>,root:THREE.Group,garden:THREE.Group) {
  const started=performance.now();
  const mainMaterial=calmTerrainMaterial(ground.mainSource.sources,ground.main,root,ground.mainSource.loaded);
  const gardenMaterial=calmTerrainMaterial(ground.gardenSource.sources,ground.small,garden,ground.gardenSource.loaded);
  const originals=new Set([...mainMaterial.originalGeometries,...gardenMaterial.originalGeometries]);
  root.traverse(o=>{if(o instanceof THREE.Mesh)originals.delete(o.geometry);});originals.forEach(geometry=>geometry.dispose());
  const accentMasks=(masks:readonly GroundMask[])=>masks.filter(mask=>/^(tree:|rock:|shrub:|path-)/.test(mask.id));
  const make=(surface:typeof ground.main,masks:readonly GroundMask[],count:number,seed:string)=>{
    const accents=accentMasks(masks);
    const hits=distributeOnSurface(surface,{count,seed,masks,edgeRadius:.055,clearance:.085,minimumSpacing:.085,maxAttempts:count*48,accept:(hit,random)=>{
      const p=hit.position,density=.7+Math.sin(p.x*.85+Math.sin(p.z*.7))*.17+Math.cos(p.z*1.25-p.x*.27)*.1;
      return hit.normal.y>.84&&random()<density;
    }});
    return createMeadow(hits,{seed,regionSize:12,maxInstances:count,accentRates:{tall:.035,clover:.025,flower:.008},accentEligible:hit=>accents.some(mask=>maskDistance(mask,[hit.position.x,hit.position.z])<.65),nearDistance:14,farDistance:52});
  };
  const main=make(ground.main,ground.mainMasks,1800,'main-meadow-42');
  const small=make(ground.small,ground.gardenMasks,170,'garden-meadow-17');
  root.add(main.group);garden.add(small.group);
  const stats={main:main.stats,garden:small.stats,materials:{main:mainMaterial.diagnostics,garden:gardenMaterial.diagnostics},milliseconds:performance.now()-started};
  root.userData.meadowStats=stats;
  const mainCamera=new THREE.Vector3(),gardenCamera=new THREE.Vector3();
  function update(time:number,cameraWorld:THREE.Vector3,options:{quality:'low'|'medium'|'high';reducedMotion:boolean}){
    mainCamera.copy(cameraWorld);root.worldToLocal(mainCamera);gardenCamera.copy(cameraWorld);garden.worldToLocal(gardenCamera);
    main.update(time,mainCamera,options);small.update(time,gardenCamera,options);
  }
  return {stats,update,dispose(){main.dispose();small.dispose();}};
}
