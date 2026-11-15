import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {birdPosition,createNature,createWaterfall} from './nature';

test('both flocks clear island buildings across a full flight cycle',()=>{
  for(let i=0;i<8;i++)for(let t=0;t<100;t+=.25)assert.ok(birdPosition(i,t).y>7.5);
});
test('shared bird assets, low quality count and reduced motion',()=>{
  const root=new THREE.Group(),garden=new THREE.Group();root.add(garden);const nature=createNature(root,garden);
  nature.update(.016,4,{quality:'low',reducedMotion:true,finalReveal:true});
  assert.equal(nature.birds.children.filter(b=>b.visible).length,4);
  nature.birds.updateMatrixWorld(true);
  const positions=nature.birds.children.map(b=>b.position.clone());
  nature.update(1,4,{quality:'high',reducedMotion:true});
  assert.equal(nature.birds.children.filter(b=>b.visible).length,8);
  nature.birds.children.forEach((b,i)=>assert.ok(b.position.equals(positions[i])));
  const first=nature.birds.children[0].children[0] as THREE.Mesh;
  const last=nature.birds.children[7].children[0] as THREE.Mesh;
  assert.equal(first.geometry,last.geometry);assert.equal((first.material as THREE.MeshStandardMaterial).vertexColors,true);assert.equal((last.material as THREE.MeshStandardMaterial).vertexColors,true);
});
test('waterfall uses closed volume and only runs for accepted water flow',()=>{
  const parent=new THREE.Group();const waterfall=createWaterfall(parent,new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial());
  const streams=parent.children[0];
  assert.ok(streams.children.slice(0,7).every(m=>(m as THREE.Mesh).geometry instanceof THREE.TubeGeometry));
  waterfall.update(1,false,false,false);assert.equal(streams.visible,false);
  waterfall.update(2,true,true,false);assert.equal(streams.visible,true);
  const p=streams.children[8].position.clone();waterfall.update(100,true,true,false);assert.ok(streams.children[8].position.equals(p));
});

function visitorFixture(){
  const root=new THREE.Group(),garden=new THREE.Group();root.add(garden);const nature=createNature(root,garden);
  const contact=new THREE.Vector3(-4,3,2);
  nature.setPerches([{id:'test-roof',position:contact,yaw:.7,approach:[new THREE.Vector3(-4,9,2),new THREE.Vector3(-4,4,2),contact.clone()]}]);
  return {nature,contact};
}

test('an existing bird lands with exact foot contact then flushes along the corridor continuously',()=>{
  const {nature,contact}=visitorFixture();let time=0;
  nature.update(.1,4,{finalReveal:true,time});let previous=nature.birds.children[0].position.clone();
  for(let frame=0;frame<1600&&!nature.birdAvailable(time);frame++){
    time+=.1;nature.update(.1,4,{time,quality:'low'});
    const p=nature.birds.children[0].position;assert.ok(p.distanceTo(previous)<.4,'no route teleport');previous.copy(p);
    assert.equal(nature.birds.children.filter(b=>b.visible).length,4);assert.equal(nature.birds.children.length,8);
  }
  assert.ok(nature.birdAvailable(time));assert.ok(previous.equals(contact));assert.equal(nature.birds.children[0].rotation.y,.7);
  assert.equal(nature.birdHits.length,1);assert.equal(nature.birdHits[0].userData.birdIndex,0);
  assert.equal(nature.flushBird(time,1),false);assert.equal(nature.flushBird(time),true);assert.equal(nature.flushBird(time),false);assert.equal(nature.birdHits[0].visible,false);
  for(let frame=0;frame<550;frame++){
    time+=.1;nature.update(.1,4,{time});const p=nature.birds.children[0].position;
    assert.ok(p.distanceTo(previous)<.4,'departure and overhead rejoin continuous');previous.copy(p);
  }
});

test('reduced-motion flush reacts in place and reset restores the supported resting state',()=>{
  const {nature,contact}=visitorFixture();let time=0;
  for(let frame=0;frame<1600&&!nature.birdAvailable(time);frame++){time+=.1;nature.update(.1,4,{time});}
  assert.ok(nature.birdAvailable(time));nature.update(.1,4,{time,reducedMotion:true});assert.equal(nature.flushBird(time),true);
  for(let frame=0;frame<30;frame++){time+=.1;nature.update(.1,4,{time,reducedMotion:true,quality:'low'});assert.ok(nature.birds.children[0].position.equals(contact));}
  assert.equal(nature.birdAvailable(time),false);time+=3;nature.update(.1,4,{time,reducedMotion:true});assert.ok(nature.birdAvailable(time));
  nature.resetBirds();assert.equal(nature.birdHits[0].visible,true);assert.equal(nature.birdAvailable(time),true);
  nature.update(.1,0,{time:0,reducedMotion:true});assert.ok(nature.birds.children[0].position.equals(contact));
});

test('an unvalidated low corridor cannot trigger a landing',()=>{
  const root=new THREE.Group(),garden=new THREE.Group();const nature=createNature(root,garden);
  nature.setPerches([{id:'unsafe',position:new THREE.Vector3(),yaw:0,approach:[new THREE.Vector3(0,2,0)]}]);
  for(let i=0;i<500;i++)nature.update(.1,4,{time:i*.1});
  assert.equal(nature.birdAvailable(50),false);assert.ok(nature.birds.children[0].position.y>7.5);
});

 test('turning reduced motion on mid-flight fades to a usable supported perch',()=>{const {nature,contact}=visitorFixture();nature.update(.1,4,{time:0});assert.equal(nature.flushBird(0),true);nature.update(.1,4,{time:.1});for(let i=0;i<60;i++)nature.update(.1,4,{time:.2+i*.1,reducedMotion:true});assert.equal(nature.birdHits[0].visible,true);assert.ok(nature.birdAvailable(6.2));assert.ok(nature.birds.children[0].position.equals(contact));assert.equal(nature.flushBird(6.2),true);});
