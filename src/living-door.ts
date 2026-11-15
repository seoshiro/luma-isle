import * as THREE from 'three';
import {V,finish,piece,oval,block,batch,hitBox,visibleMeshes} from './living-primitives';
import type {Lighting} from './game';

/** A tiny scene attached to nine real cliff hits. This is not a top-surface guess. */
export function createSecretDoor(root:THREE.Group,island:THREE.Group) {
 root.updateWorldMatrix(true,true);const meshes=visibleMeshes(island),ray=new THREE.Raycaster();let mounted:{x:number;y:number;z:number;samples:number[][]}|null=null;
 for(const x of [-2,4,-7,6,-1.4]){if(mounted)break;for(const y of [-1.4,-2.2,-2.6,-1.8]){
  const samples:number[][]=[];for(const dx of [-.42,0,.42])for(const dy of [0,.42,.85]){ray.set(V(x+dx,y+dy,-20),V(0,0,1));ray.far=25;const hit=ray.intersectObjects(meshes,false)[0];if(hit)samples.push(hit.point.toArray());}
  if(samples.length!==9)continue;const depths=samples.map(p=>p[2]);if(Math.max(...depths)-Math.min(...depths)>.29)continue;
  mounted={x,y,z:Math.min(...depths)-.025,samples};break;
 }}
 const group=new THREE.Group();group.name='Secret cliff home';group.userData.dynamic=true;root.add(group);group.visible=!!mounted;group.position.set(mounted?.x??0,mounted?.y??-1.6,mounted?.z??-7);group.rotation.y=Math.PI;
 const stone=finish('#acaa8c'),wood=finish('#77604b'),dark=finish('#293d36'),metal=finish('#a69d6f',.6,.25),glow=finish('#c5af72');glow.emissive.set('#ffbd70');
 const shape=new THREE.Shape();shape.moveTo(-.29,0);shape.lineTo(.29,0);shape.lineTo(.29,.53);shape.absarc(0,.53,.29,0,Math.PI,false);shape.lineTo(-.29,0);
 const hollow=piece(group,new THREE.ShapeGeometry(shape,16),dark,V(0,0,.035));hollow.castShadow=false;
 for(const side of [-1,1])block(group,stone,V(side*.345,.285,-.095),V(.13,.58,.40));
 const archShape=new THREE.Shape();archShape.absarc(0,0,.41,0,Math.PI,false);archShape.absarc(0,0,.28,Math.PI,0,true);archShape.closePath();piece(group,new THREE.ExtrudeGeometry(archShape,{depth:.36,bevelEnabled:false,curveSegments:16}),stone,V(0,.53,-.29));
 block(group,stone,V(0,-.075,.14),V(.96,.15,.77));for(const side of [-1,1]){const bracket=block(group,stone,V(side*.28,-.19,-.06),V(.18,.29,.4));bracket.rotation.x=-.15;}
 const hinge=new THREE.Group();hinge.userData.livePivot=true;hinge.position.set(-.29,0,.055);group.add(hinge);
 piece(hinge,new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelThickness:.008,bevelSize:.012,bevelSegments:1,curveSegments:12}),wood,V(.29,0,0));
 for(const x of [.15,.29,.43])block(hinge,metal,V(x,.24,.055),V(.005,.4,.006));
 const rim=piece(hinge,new THREE.TorusGeometry(.105,.018,6,20),metal,V(.29,.58,.068));
 piece(hinge,new THREE.CircleGeometry(.089,20),glow,V(.29,.58,.071));block(hinge,metal,V(.29,.58,.08),V(.012,.18,.012));block(hinge,metal,V(.29,.58,.08),V(.18,.012,.012));oval(hinge,metal,V(.49,.29,.075),V(.025,.025,.017));batch(hinge);
 const peek=new THREE.Group();peek.userData.livePivot=true;peek.position.set(.11,.30,.055);group.add(peek);oval(peek,dark,V(0,.05,0),V(.085,.12,.028));for(const side of [-1,1]){oval(peek,dark,V(side*.057,.15,0),V(.027,.047,.023));oval(peek,metal,V(side*.029,.065,.028),V(.008,.01,.006));}batch(peek);peek.visible=false;batch(group);
 const hit=hitBox(group,'door',V(1,1.16,.44),V(0,.39,.15));group.userData.wallSamples=mounted?.samples??[];group.userData.mountSupported=!!mounted;
 let openedAt=-100,cooldown=0,highlight=false;
 function open(time:number){if(!group.visible||time<cooldown)return false;openedAt=time+.55;cooldown=time+5.5;return true;}
 function update(time:number,lighting:Lighting,reduced:boolean){const age=time-openedAt;const opening=age<0?0:age<.55?THREE.MathUtils.smoothstep(age,0,.55):age<1.55?1:1-THREE.MathUtils.smoothstep(age,1.55,2.3);hinge.rotation.y=-opening*(reduced?.24:.57);peek.visible=age>.4&&age<1.75;peek.position.x=.11+opening*.035;glow.emissiveIntensity=lighting==='morning'?.06:lighting==='sunset'?.55:1.15;wood.emissive.set('#a79a74');wood.emissiveIntensity=highlight?.11:0;return age>=0&&age<2.35;}
 return {group,hit,open,update,available:(time:number)=>group.visible&&time>=cooldown,highlight:(value:boolean)=>{highlight=value},reset:()=>{openedAt=-100;cooldown=0;hinge.rotation.y=0;peek.visible=false},position:()=>group.getWorldPosition(V()).add(V(0,.4,0)),viewOffset:V(-1.6,1.5,-5.3)};
}
