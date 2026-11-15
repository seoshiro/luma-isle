import * as THREE from 'three';
import type {finalizeIslandGrounding} from './island-grounding';
import {blockedBy} from './ground-placement';
import {V,finish,piece,oval,block,rod,batch,visibleMeshes} from './living-primitives';
import type {IslandWind} from './living-wind';

/** Small purposeful groups. Every contact is resolved once, before the meadow. */
export function createLivingDecor(root:THREE.Group,ground:ReturnType<typeof finalizeIslandGrounding>,workshop:THREE.Group,trees:THREE.Group[],watercourse:THREE.Group,pig:THREE.Group) {
 const group=new THREE.Group();group.name='Small signs of island life';group.userData.dynamic=true;root.add(group);
 const wood=finish('#987553'),paper=finish('#d6cfad'),ceramic=finish('#768d83'),metal=finish('#898b76',.55,.25),dark=finish('#444f3b'),moss=finish('#64734b'),cap=finish('#ac9478');
 const ray=new THREE.Raycaster(),workshopMeshes=visibleMeshes(workshop),attachments:Record<string,number[][]>={};
 const wall:THREE.Vector3[]=[];for(const z of [2.35,2.95]){ray.set(V(4,.9,z),V(-1,0,0));ray.far=4;const hit=ray.intersectObjects(workshopMeshes,false)[0];if(hit)wall.push(hit.point);}
 if(wall.length===2){const x=Math.max(...wall.map(p=>p.x))+.02;const shelf=new THREE.Group();shelf.name='Wall-mounted workshop shelf';shelf.position.set(x,.94,2.65);shelf.rotation.y=Math.PI/2;group.add(shelf);
  block(shelf,wood,V(0,0,.14),V(.8,.05,.38));for(let i=0;i<2;i++){const anchor=shelf.worldToLocal(wall[i].clone());rod(shelf,metal,anchor,V(i?-.30:.30,-.02,.30),.015);rod(shelf,metal,anchor.clone().add(V(0,-.16,0)),V(i?-.30:.30,-.02,.27),.015);}
  piece(shelf,new THREE.CylinderGeometry(.052,.047,.11,14),ceramic,V(-.25,.08,.17));const rim=piece(shelf,new THREE.TorusGeometry(.052,.007,5,16),ceramic,V(-.25,.138,.17));rim.rotation.x=Math.PI/2;
  const tea=piece(shelf,new THREE.CircleGeometry(.043,14),dark,V(-.25,.135,.17));tea.rotation.x=-Math.PI/2;piece(shelf,new THREE.TorusGeometry(.031,.008,5,14),ceramic,V(-.312,.085,.17));
  const roll=piece(shelf,new THREE.CylinderGeometry(.035,.035,.24,12),paper,V(.04,.061,.14));roll.rotation.z=Math.PI/2;const end=piece(shelf,new THREE.TorusGeometry(.022,.005,4,12),ceramic,V(.165,.061,.14));end.rotation.y=Math.PI/2;
  rod(shelf,wood,V(.18,.04,.28),V(.35,.04,.25),.012);block(shelf,metal,V(.35,.048,.25),V(.045,.035,.095));rod(shelf,metal,V(.21,.038,.06),V(.34,.038,.08),.008);const wrench=piece(shelf,new THREE.TorusGeometry(.022,.007,4,10,Math.PI*1.6),metal,V(.355,.038,.083));wrench.rotation.x=Math.PI/2;attachments.workshopShelf=wall.map(p=>p.toArray());
 }
 // A slender pig-shaped vane is genuinely fixed into the loaded roof ridge.
 ray.set(V(.2,8,2.85),V(0,-1,0));ray.far=8;const roof=ray.intersectObjects(workshopMeshes,false)[0];let vane:THREE.Group|null=null;
 if(roof){const p=roof.point;oval(group,metal,p.clone(),V(.065,.05,.065));rod(group,metal,p.clone().add(V(0,-.025,0)),p.clone().add(V(0,.44,0)),.012);vane=new THREE.Group();vane.userData.livePivot=true;vane.name='Pig weather vane';vane.position.copy(p).add(V(0,.37,0));group.add(vane);
  const shape=new THREE.Shape();shape.moveTo(-.18,-.045);for(const [x,y]of [[-.15,.04],[-.07,.075],[.07,.07],[.12,.12],[.15,.06],[.23,.04],[.25,0],[.19,-.015],[.13,-.055],[.12,-.11],[.08,-.11],[.065,-.055],[-.08,-.06],[-.1,-.11],[-.14,-.11],[-.145,-.05],[-.20,-.025],[-.24,.02],[-.21,.055],[-.19,.025]])shape.lineTo(x,y);shape.closePath();piece(vane,new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false}),metal,V(0,0,-.006));rod(vane,metal,V(-.34,-.14,0),V(.34,-.14,0),.009);attachments.weatherVane=[p.toArray()];batch(vane);
 }
 const tree=trees.filter(t=>t.parent===root&&t.visible).sort((a,b)=>a.position.distanceToSquared(V(1.6,0,5.6))-b.position.distanceToSquared(V(1.6,0,5.6)))[0];
 if(tree){const start=tree.position.clone().add(V(0,1,3));ray.set(start,V(0,0,-1));ray.far=5;const hit=ray.intersectObjects(visibleMeshes(tree),false)[0];if(hit){const home=new THREE.Group();home.name='Tree-mounted birdhouse';home.position.copy(hit.point).add(V(0,0,.13));group.add(home);block(home,wood,V(0,0,0),V(.24,.29,.20));block(home,metal,V(0,-.02,-.14),V(.09,.4,.08));const roofShape=new THREE.Shape();roofShape.moveTo(-.16,0);roofShape.lineTo(.16,0);roofShape.lineTo(0,.14);roofShape.closePath();piece(home,new THREE.ExtrudeGeometry(roofShape,{depth:.29,bevelEnabled:false}),ceramic,V(0,.145,-.145));piece(home,new THREE.CircleGeometry(.047,14),dark,V(0,.04,.105));rod(home,wood,V(0,-.055,.10),V(0,-.055,.18),.011);for(const y of [-.14,.14]){block(home,metal,V(0,y,-.13),V(.27,.025,.035));oval(home,metal,V(0,y,-.155),V(.014,.014,.028));}attachments.birdhouse=[hit.point.toArray()];}}
 const banks=visibleMeshes(watercourse).filter(m=>m.name==='Terrain-seated bed and banks');for(const [x,z]of [[-4.43,-.55],[-4.43,.05],[-4.55,3.65]]){ray.set(V(x,1,z),V(0,-1,0));ray.far=2;const hit=ray.intersectObjects(banks,false)[0];if(hit){const patch=oval(group,moss,hit.point.clone().add(V(0,.009,0)),V(.075,.014,.14));patch.rotation.y=x+z;}}
 if(tree){let made=0;for(let i=0;i<18&&made<3;i++){const angle=i*2.399,p=tree.position.clone().add(V(Math.cos(angle)*1.05,0,Math.sin(angle)*1.05));if(blockedBy(ground.mainMasks,[p.x,p.z],.085))continue;const support=ground.main.sample(p.x,p.z);if(!support)continue;const h=.075+(made%2)*.03;rod(group,paper,support.position.clone(),support.position.clone().add(V(0,h,0)),.012);oval(group,cap,support.position.clone().add(V(0,h,0)),V(.065,.025,.06));ground.mainMasks.push({id:`living-mushroom-${made}`,kind:'circle',center:[p.x,p.z],radius:.09});made++;}}
 if(pig.visible){for(let step=0;step<3;step++)for(const side of [-1,1]){const x=pig.position.x+side*.105,z=pig.position.z-.49-step*.15,support=ground.main.sample(x,z);if(!support)continue;for(const toe of [-1,1]){const print=oval(group,wood,V(x+toe*.014,support.position.y+.002,z),V(.012,.003,.027));print.castShadow=false;}ground.mainMasks.push({id:`keeper-track-${step}-${side}`,kind:'circle',center:[x,z],radius:.045});}}
 batch(group);group.userData.attachments=attachments;
 return{group,update(wind:IslandWind){if(vane)vane.rotation.y=wind.direction+wind.lean*.10;}};
}
