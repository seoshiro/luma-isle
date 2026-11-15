import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BRIDGE,TERRACE,MAIN_PATHS,GARDEN_PATHS,GARDEN_CONNECTOR,pathFootprint,type PathDefinition} from './world-layout';
import {createTerrainSurface,surfaceRandom,type TerrainSurface,type TerrainSource,type SurfacePoint2,type SurfacePoint3} from './terrain-surface';
import {checkGrounding,findGrounding,diskProbes,rectangleProbes,blockedBy,type GroundMask,type GroundingRequest} from './ground-placement';
import {meadowGroundColor} from './ground-material';
import {createGroundedPathFoundation,type PathFoundationDiagnostics} from './path-support';
import {createSupportStoneMaterial} from './support-stone';

export type GroundKind='tree'|'cypress'|'shrub'|'rock'|'lamp'|'bench'|'pot'|'flower';
export interface GroundObjectSpec {kind:GroundKind;radius:number;id?:string;preferred?:SurfacePoint2;searchRadius?:number}
export function markGroundObject<T extends THREE.Object3D>(object:T,spec:GroundObjectSpec):T {
  object.userData.dynamic=true;
  object.userData.groundObject={...spec,id:spec.id??`${spec.kind}:${object.position.x.toFixed(3)},${object.position.z.toFixed(3)}`};
  return object;
}

export interface GroundingRecord {id:string;kind:GroundKind;from:number[];to:number[];supported:boolean;reason:string;contactGap:number;footprintRadius:number;footContacts?:SurfacePoint3[];supportPad?:boolean}
export interface GroundingReport {records:GroundingRecord[];unplaced:string[];pathSupports:number;pathUnsupported:SurfacePoint2[];pathFoundations:{frame:string;diagnostics:PathFoundationDiagnostics}[];milliseconds:number;surfaces:{main:number;garden:number};source:{main:'loaded'|'procedural';garden:'loaded'|'procedural'}}
type Slots={island:THREE.Group;gardenBase:THREE.Group;mill:THREE.Group;workshop:THREE.Group;observatory:THREE.Group;lighthouse:THREE.Group};

function visibleMeshes(object:THREE.Object3D,ignoreDynamic=false) {
  const meshes:THREE.Mesh[]=[];
  const visit=(node:THREE.Object3D)=>{if(!node.visible)return;if(node instanceof THREE.Mesh)meshes.push(node);if(!ignoreDynamic||node===object||!node.userData.dynamic)node.children.forEach(visit);};
  visit(object);return meshes;
}

function terrainSources(slot:THREE.Group):{sources:TerrainSource[];loaded:boolean} {
  const loaded=slot.children.find(child=>child.userData.artSlot==='island');
  if(loaded)return {sources:visibleMeshes(loaded).map(mesh=>({mesh,role:'island-body'})),loaded:true};
  const meshes:THREE.Mesh[]=[];slot.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.groundTop)meshes.push(o);});
  return {sources:meshes.map(mesh=>({mesh,role:'ground-top'})),loaded:false};
}

/** Use transformed visible geometry, not stale unscaled model bounding boxes. */
export function transformedFootprint(object:THREE.Object3D,frame:THREE.Object3D,id:string,minHeight=-Infinity,maxHeight=Infinity):GroundMask|null {
  frame.updateWorldMatrix(true,false);object.updateWorldMatrix(true,true);
  const inverse=frame.matrixWorld.clone().invert(),point=new THREE.Vector3();
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const mesh of visibleMeshes(object,true)){
    const p=mesh.geometry.getAttribute('position'),transform=inverse.clone().multiply(mesh.matrixWorld);
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(transform);
      if(point.y<minHeight||point.y>maxHeight)continue;
      minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minZ=Math.min(minZ,point.z);maxZ=Math.max(maxZ,point.z);
    }
  }
  return Number.isFinite(minX)?{id,kind:'box',center:[(minX+maxX)/2,(minZ+maxZ)/2],halfSize:[(maxX-minX)/2,(maxZ-minZ)/2]}:null;
}

function waterMasks():GroundMask[] {
  const river=new THREE.CatmullRomCurve3([[2,.09,-3.25],[1.85,.09,-1.7],[.2,.09,-1.6],[-1.9,.09,-2.4],[-3.9,.09,-3.4]].map(p=>new THREE.Vector3(...p)));
  const masks:GroundMask[]=[{id:'upper-stream',kind:'path',points:river.getPoints(60).map(p=>[p.x,p.z]),width:1.2},
    {id:'sluice-channel',kind:'box',center:[-3.9,-.1],halfSize:[.9,3.5]},
    {id:'waterfall-channel',kind:'box',center:[-4.3,4.45],halfSize:[.93,1.6]},
    {id:'water-wheel',kind:'box',center:[-3.98,2.25],halfSize:[1.39,.36]},
  ];
  for(let j=0;j<3;j++)masks.push({id:`water-branch-${j}`,kind:'box',center:[-3.1,-1.85+j*1.35],halfSize:[.85,.4],yaw:-.35});
  return masks;
}

function pathMasks(definitions:readonly PathDefinition[]):GroundMask[] {return definitions.map(path=>({id:`path-${path.id}`,kind:'polygon',points:pathFootprint(path)}));}

function treeFootprint(object:THREE.Object3D,frame:THREE.Object3D,fallbackRadius:number) {
  object.updateWorldMatrix(true,true);frame.updateWorldMatrix(true,false);
  const inverse=frame.matrixWorld.clone().invert(),origin=object.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
  const points:THREE.Vector3[]=[];
  for(const mesh of visibleMeshes(object)){
    const p=mesh.geometry.getAttribute('position'),matrix=inverse.clone().multiply(mesh.matrixWorld);
    for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix).sub(origin));
  }
  if(!points.length)return {radius:fallbackRadius,crownRadius:fallbackRadius*2.8,contacts:[[0,0,0]] as SurfacePoint3[]};
  const minimum=Math.min(...points.map(p=>p.y));
  // The band's actual root vertices, not the canopy/global bounding-box minimum alone.
  const roots=points.filter(p=>p.y<=minimum+.11*object.scale.y);
  const radius=Math.max(.16,...roots.map(p=>Math.hypot(p.x,p.z)))+.035;
  const sectors=new Map<number,THREE.Vector3>();
  for(const root of roots){const sector=Math.floor((Math.atan2(root.z,root.x)+Math.PI)/(Math.PI*2)*12)%12;const old=sectors.get(sector);if(!old||root.y<old.y)sectors.set(sector,root);}
  const contacts:SurfacePoint3[]=[...sectors.values()].map(p=>[p.x,p.y,p.z]);
  const crownRadius=Math.max(radius,...points.map(p=>Math.hypot(p.x,p.z)));
  return {radius,crownRadius,contacts:contacts.length?contacts:[[0,minimum,0] as SurfacePoint3]};
}

/** A solid low planting collar follows terrain at its perimeter; not a fake contact shadow. */
function plantingCollar(frame:THREE.Group,surface:TerrainSurface,center:SurfacePoint2,radius:number,topY:number,material:THREE.Material,organic=false) {
  const positions:number[]=[],indices:number[]=[],colors:number[]=[],n=24;
  const middleColor=organic?new THREE.Color('#707953'):new THREE.Color(0xffffff);
  positions.push(center[0],topY,center[1]);colors.push(middleColor.r,middleColor.g,middleColor.b);
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,inner=organic?radius-.018:radius;
    let outer=organic?radius*(1.16+.075*Math.sin(a*3)+.035*Math.cos(a*5)):radius;
    let x=center[0]+Math.cos(a)*outer,z=center[1]+Math.sin(a)*outer,hit=surface.sample(x,z);
    while(!hit&&outer>inner){outer-=.025;x=center[0]+Math.cos(a)*outer;z=center[1]+Math.sin(a)*outer;hit=surface.sample(x,z);}
    if(!hit)return null;
    positions.push(center[0]+Math.cos(a)*inner,topY,center[1]+Math.sin(a)*inner,x,Math.min(topY-.018,hit.position.y-.025),z);
    const edgeColor=organic?meadowGroundColor(x,z):middleColor;
    colors.push(middleColor.r,middleColor.g,middleColor.b,edgeColor.r,edgeColor.g,edgeColor.b);
  }
  for(let i=0;i<n;i++){const a=1+i*2,b=1+(i+1)%n*2;indices.push(0,b,a,a,b,a+1,b,b+1,a+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Ground-following planting collar';mesh.receiveShadow=true;mesh.castShadow=true;frame.add(mesh);return mesh;
}

function batchGroundDecor(frame:THREE.Group,objects:THREE.Object3D[]) {
  frame.updateWorldMatrix(true,true);const inverse=frame.matrixWorld.clone().invert();
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const removedGeometries=new Set<THREE.BufferGeometry>();
  for(const object of objects){
    for(const mesh of visibleMeshes(object)){
      if(Array.isArray(mesh.material))continue;
      removedGeometries.add(mesh.geometry);
      const geometry=mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      const nonIndexed=geometry.index?geometry.toNonIndexed():geometry;
      if(nonIndexed!==geometry)geometry.dispose();
      nonIndexed.deleteAttribute('uv');
      if(!(mesh.material instanceof THREE.MeshStandardMaterial&&mesh.material.vertexColors))nonIndexed.deleteAttribute('color');
      const list=batches.get(mesh.material);if(list)list.push(nonIndexed);else batches.set(mesh.material,[nonIndexed]);
    }
    object.removeFromParent();
  }
  const group=new THREE.Group();group.name='Grounded static decoration';group.userData.dynamic=true;frame.add(group);
  for(const [material,geometries]of batches){const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}}
  let sceneRoot:THREE.Object3D=frame;while(sceneRoot.parent)sceneRoot=sceneRoot.parent;
  sceneRoot.traverse(o=>{if(o instanceof THREE.Mesh)removedGeometries.delete(o.geometry);});
  removedGeometries.forEach(geometry=>geometry.dispose());
  return group;
}

function widerGrounding(surface:TerrainSurface,request:GroundingRequest,seed:string) {
  const random=surfaceRandom(seed),candidates:SurfacePoint2[]=[];
  for(let i=0;i<900;i++){const hit=surface.sampleArea(random);if(hit&&!blockedBy(request.masks??[],[hit.position.x,hit.position.z],request.clearance??0))candidates.push([hit.position.x,hit.position.z]);}
  candidates.sort((a,b)=>Math.hypot(a[0]-request.center[0],a[1]-request.center[1])-Math.hypot(b[0]-request.center[0],b[1]-request.center[1]));
  let result=checkGrounding(surface,request,true);
  for(const center of candidates){result=checkGrounding(surface,{...request,center},true);if(result.supported)break;}
  return result;
}

/** Continuous bank walls follow the actual stone and leave the water crossing open. */
function supportPaths(frame:THREE.Group,surface:TerrainSurface,definitions:readonly PathDefinition[],material:THREE.Material,report:GroundingReport) {
  const {geometry,diagnostics}=createGroundedPathFoundation(definitions,surface);
  const group=new THREE.Group();group.name='Grounded path foundations';group.userData.dynamic=true;
  group.userData.supportDiagnostics=diagnostics;frame.add(group);
  if(geometry.getAttribute('position').count){
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }else geometry.dispose();
  report.pathSupports+=diagnostics.wallSegments;
  report.pathUnsupported.push(...diagnostics.unsupported,...diagnostics.excessiveDepth);
  report.pathFoundations.push({frame:definitions===GARDEN_PATHS?'garden-local':'main',diagnostics});
  return group;
}

export function finalizeIslandGrounding(root:THREE.Group,garden:THREE.Group,slots:Slots) {
  const started=performance.now(),mainSource=terrainSources(slots.island),gardenSource=terrainSources(slots.gardenBase);
  const main=createTerrainSurface(mainSource.sources,{frame:root,minY:-.48,maxY:.6});
  const small=createTerrainSurface(gardenSource.sources,{frame:garden,minY:-.19,maxY:.24,cellSize:.2});
  const rawMain=createTerrainSurface(mainSource.sources,{frame:root,minY:-6,maxY:.6,minNormalY:.05,componentPolicy:'all',minComponentArea:0});
  const rawSmall=createTerrainSurface(gardenSource.sources,{frame:garden,minY:-2.3,maxY:.24,minNormalY:.05,componentPolicy:'all',minComponentArea:0,cellSize:.2});
  const report:GroundingReport={records:[],unplaced:[],pathSupports:0,pathUnsupported:[],pathFoundations:[],milliseconds:0,surfaces:{main:main.faces.length,garden:small.faces.length},source:{main:mainSource.loaded?'loaded':'procedural',garden:gardenSource.loaded?'loaded':'procedural'}};
  const mainMasks:GroundMask[]=[...pathMasks(MAIN_PATHS),...pathMasks([GARDEN_CONNECTOR]),...waterMasks(),{id:'terrace-base',kind:'polygon',points:TERRACE.baseFootprint},{id:'bridge-motion',kind:'polygon',points:BRIDGE.sweep},
    {id:'bench-clearance',kind:'box',center:[4.1,4.45],halfSize:[.95,.75]}];
  for(const name of ['mill','workshop','lighthouse']as const){const mask=transformedFootprint(slots[name],root,`building-${name}`,-.1,1.15);if(mask)mainMasks.push(mask);}
  const gardenMasks:GroundMask[]=[...pathMasks(GARDEN_PATHS),{id:'garden-arch',kind:'box',center:[0,.15],halfSize:[1.05,.55]}];
  const supportMaterial=createSupportStoneMaterial();
  const soilMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1});
  const frames=[{frame:root,surface:main,raw:rawMain,masks:mainMasks},{frame:garden,surface:small,raw:rawSmall,masks:gardenMasks}];
  for(const {frame,surface,raw,masks}of frames){
    const objects:THREE.Object3D[]=[];frame.traverse(o=>{if(o.userData.groundObject&&(frame===garden||!garden.getObjectById(o.id)))objects.push(o);});
    // Preserve furniture first, then trees; small decoration adapts to their actual footprint.
    const priority:Record<GroundKind,number>={bench:0,lamp:1,tree:2,cypress:3,pot:4,rock:5,shrub:6,flower:7};
    objects.sort((a,b)=>priority[(a.userData.groundObject as GroundObjectSpec).kind]-priority[(b.userData.groundObject as GroundObjectSpec).kind]);
    const staticObjects:THREE.Object3D[]=[];
    for(const object of objects){
      const spec=object.userData.groundObject as GroundObjectSpec,from=object.position.toArray();
      const tree=spec.kind==='tree'?treeFootprint(object,frame,spec.radius):null;
      const radius=tree?.radius??spec.radius;
      const contacts:SurfacePoint3[]=tree?.contacts??(spec.kind==='bench'?[[-.6,-.02,-.15],[.6,-.02,-.15],[-.6,-.02,.15],[.6,-.02,.15]]:spec.kind==='lamp'||spec.kind==='pot'?diskProbes(spec.kind==='pot'?.13:.17,.045).map(([x,z])=>[x,0,z] as SurfacePoint3):[[0,0,0]]);
      const footprint=spec.kind==='bench'?rectangleProbes(.8,.35,.18):diskProbes(radius,Math.max(.09,radius/3));
      const center:SurfacePoint2=spec.preferred??[object.position.x,object.position.z];
      const ownMasks=masks.filter(mask=>!(spec.kind==='bench'&&mask.id==='bench-clearance'));
      // A crown may overhang a route, but must never occupy the garden arch itself.
      const extraMasks:GroundMask[]=[];
      const crownExclusions=tree&&frame===root?[{mask:{id:'bridge-crown-clearance',kind:'polygon' as const,points:BRIDGE.sweep},padding:tree.crownRadius+.3}]:[];
      const request:GroundingRequest={center,footprint,contacts,masks:[...ownMasks,...extraMasks],centerExclusions:crownExclusions,clearance:spec.kind==='lamp'?.12:.035,maxSlope:spec.kind==='tree'?.77:.6,maxHeightRange:spec.kind==='tree'?.45:.24,maxContactGap:spec.kind==='tree'?.2:spec.kind==='bench'?.075:.3,penetration:spec.kind==='tree'?.035:.015};
      let result=checkGrounding(surface,request);
      let supportPad=false;
      if(!result.supported)result=findGrounding(surface,request,{radius:spec.searchRadius??(spec.kind==='tree'?3.8:spec.kind==='lamp'?1.7:spec.kind==='bench'?.5:2.8),step:spec.kind==='tree'?.24:.18,seed:spec.id});
      if(!result.supported)result=widerGrounding(surface,request,spec.id!);
      if(!result.supported){report.unplaced.push(spec.id!);object.visible=false;}else{
        object.position.set(result.position.x,result.position.y,result.position.z);
        if(spec.kind==='tree'&&result.contactGap>.06)plantingCollar(frame,surface,[result.position.x,result.position.z],radius,result.position.y+.035,soilMaterial,true);
        if((spec.kind==='lamp'||spec.kind==='pot')&&result.contactGap>.012){const pad=plantingCollar(frame,surface,[result.position.x,result.position.z],spec.kind==='pot'?.15:.18,result.position.y+.006,supportMaterial);if(pad){pad.name=`${spec.kind==='pot'?'Pot':'Lamp'} stone foot pad`;pad.userData.supports=spec.id;supportPad=true;}}
        if(spec.kind==='bench'&&result.contactGap>.02)for(const offset of [-.6,.6]){
          const x=result.position.x+offset,z=result.position.z,top=result.position.y-.02;
          const feet=rectangleProbes(.075,.22,.1).map(([dx,dz])=>surface.sample(x+dx,z+dz)).filter((hit):hit is NonNullable<typeof hit>=>!!hit);
          if(feet.length){const bottom=Math.min(...feet.map(hit=>hit.position.y))-.025;if(top-bottom>.025){const pad=new THREE.Mesh(new THREE.BoxGeometry(.15,top-bottom,.44),supportMaterial);pad.name='Bench stone foot pad';pad.position.set(x,(top+bottom)/2,z);pad.castShadow=true;pad.receiveShadow=true;frame.add(pad);}}
        }
        const exclusion=spec.kind==='bench'?{id:spec.id!,kind:'box' as const,center:[object.position.x,object.position.z]as SurfacePoint2,halfSize:[.95,.65]as SurfacePoint2}:{id:spec.id!,kind:'circle' as const,center:[object.position.x,object.position.z]as SurfacePoint2,radius:spec.kind==='shrub'?radius*.6:radius+(spec.kind==='tree'?.12:.06)};
        masks.push(exclusion);
      }
      report.records.push({id:spec.id!,kind:spec.kind,from,to:object.position.toArray(),supported:result.supported,reason:result.reason,contactGap:result.contactGap,footprintRadius:radius,...(spec.kind==='lamp'||spec.kind==='pot'?{supportPad,footContacts:contacts.map(([x,y,z])=>[x+object.position.x,y+object.position.y,z+object.position.z] as SurfacePoint3)}:{})});
      if(spec.kind!=='tree'&&spec.kind!=='flower')staticObjects.push(object);
    }
    batchGroundDecor(frame,staticObjects);
  }
  supportPaths(root,rawMain,MAIN_PATHS,supportMaterial,report);
  supportPaths(garden,rawSmall,GARDEN_PATHS,supportMaterial,report);
  report.milliseconds=performance.now()-started;
  root.userData.groundingReport=report;
  return {main,small,mainMasks,gardenMasks,mainSource,gardenSource,report};
}
