import * as THREE from 'three';
import {getWaterFlow,type GameState} from './game';
import type {finalizeIslandGrounding} from './island-grounding';
import type {createNature} from './nature';
import type {createGroundedWatercourse} from './water-support';
import {createPig} from './living-pig';
import {createBoat} from './living-boat';
import {createChime} from './living-chime';
import {createSecretDoor} from './living-door';
import {createPerches} from './living-perches';
import {createLivingDecor} from './living-decor';
import {islandWind} from './living-wind';
import {visibleMeshes} from './living-primitives';
import {noLivingActions,type LivingAction,type LivingEvent,type LivingOptions} from './living-types';

type Parts={garden:THREE.Group;arch:THREE.Mesh;island:THREE.Group;workshop:THREE.Group;nature:ReturnType<typeof createNature>;course:ReturnType<typeof createGroundedWatercourse>;waterfall:THREE.Group;trees:THREE.Group[];buildings:THREE.Group[]};
export function createLivingScene(root:THREE.Group,ground:ReturnType<typeof finalizeIslandGrounding>,parts:Parts) {
 const diagnostics:{part:string;error:string}[]=[];
 function optional<T>(name:string,create:()=>T):T|null {const before=new Set([...root.children,...parts.garden.children]);try{return create()}catch(error){for(const parent of [root,parts.garden])for(const child of [...parent.children])if(!before.has(child))child.removeFromParent();diagnostics.push({part:name,error:String(error)});return null;}}
 const pig=optional('keeper',()=>createPig(root,ground.main,ground.mainMasks));
 const chime=optional('chime',()=>createChime(parts.garden,parts.arch,parts.trees.find(tree=>tree.parent===parts.garden)));
 const door=optional('secret door',()=>createSecretDoor(root,parts.island));
 const obstacles=[...parts.buildings.flatMap(visibleMeshes),...parts.trees.flatMap(visibleMeshes)];
 const perches=optional('bird perches',()=>createPerches(root,parts.workshop,parts.course.group,obstacles));
 if(perches)parts.nature.setPerches(perches.perches);
 const boat=parts.course.boatStations.length>1&&!root.userData.livingBypassBlocked?optional('paper boat',()=>createBoat(root,parts.course,{position:parts.waterfall.position.clone(),profile:parts.waterfall.getObjectByName('Sculpted waterfall')?.userData.cliffClearance??[]})):null;
 const absentPig=new THREE.Group();absentPig.visible=false;
 const decor=optional('small decoration',()=>createLivingDecor(root,ground,parts.workshop,parts.trees,parts.course.group,pig?.group??absentPig));
 const hits:THREE.Mesh[]=[...(pig?[pig.hit]:[]),...(chime?[chime.hit]:[]),...(door?[door.hit]:[]),...parts.nature.birdHits,...(boat?.hits??[])];
 root.userData.livingDiagnostics=diagnostics;
 let state:GameState|null=null,now=0,options:LivingOptions|null=null;
 function presence(){return{...noLivingActions(),pig:!!pig?.group.visible,chime:!!chime?.group.visible,door:!!door?.group.visible,bird:!!perches?.perches.length,boat:!!boat,ripple:!!boat};}
 function available(){const value=noLivingActions();value.pig=pig?.available(now)??false;value.chime=chime?.available(now,state?.stage??0)??false;value.door=door?.available(now)??false;value.bird=parts.nature.birdAvailable(now);if(boat)Object.assign(value,boat.available(now));return value;}
 function interact(action:LivingAction,point?:THREE.Vector3,index?:number):LivingEvent|null {
  if(!options||!state)return null;
  if(action==='boat'&&boat?.launch(now))return{action,cue:'boat'};
  if(action==='ripple'&&boat?.ripple(now,point))return{action,cue:'water'};
  if(action==='pig'&&pig?.react(now,options.camera))return{action,cue:'pig'};
  if(action==='chime'&&state.stage===4&&chime?.ring(now))return{action,cue:'chime'};
  if(action==='door'&&door?.open(now))return{action,cue:'door',discovery:'secretDoor'};
  if(action==='bird'&&parts.nature.flushBird(now,index))return{action,cue:'bird'};
  return null;
 }
 function update(next:GameState,time:number,_dt:number,nextOptions:LivingOptions){
  state=next;now=time;options=nextOptions;const wind=islandWind(time,nextOptions.reducedMotion);decor?.update(wind);
  const pigActive=pig?.update(time,nextOptions.reducedMotion),chimeActive=chime?.update(time,next.stage,wind,nextOptions),doorActive=door?.update(time,nextOptions.effectiveLighting,nextOptions.reducedMotion);
  boat?.update(time,getWaterFlow(next.gates).wheel,nextOptions.reducedMotion,nextOptions.quality==='low');
  return{shadowActive:!!(pigActive||chimeActive||doorActive)};
 }
 function highlight(action:LivingAction|null){pig?.highlight(action==='pig');chime?.highlight(action==='chime');door?.highlight(action==='door');parts.nature.highlightBird(action==='bird');boat?.highlight(action==='boat'||action==='ripple'?action:null);}
 function reset(){pig?.reset();chime?.reset();door?.reset();boat?.reset();parts.nature.resetBirds();highlight(null);}
 function focus(action:LivingAction){if(action==='bird'&&parts.nature.birdHits[0]?.parent)return{target:parts.nature.birdHits[0].parent.getWorldPosition(new THREE.Vector3()),offset:new THREE.Vector3(.6,5,1.3)};if(action==='door'&&door)return{target:door.position(),offset:door.viewOffset};if(action==='pig'&&pig)return{target:pig.position(),offset:new THREE.Vector3(3,2.2,4)};return null;}
 return{hits,presence,available,interact,update,highlight,reset,focus};
}
