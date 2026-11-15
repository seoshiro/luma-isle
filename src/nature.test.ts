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
  assert.equal(first.geometry,last.geometry);assert.equal(first.material,last.material);
});
test('waterfall uses closed volume and only runs for accepted water flow',()=>{
  const parent=new THREE.Group();const waterfall=createWaterfall(parent,new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial());
  const streams=parent.children[0];
  assert.ok(streams.children.slice(0,7).every(m=>(m as THREE.Mesh).geometry instanceof THREE.TubeGeometry));
  waterfall.update(1,false,false,false);assert.equal(streams.visible,false);
  waterfall.update(2,true,true,false);assert.equal(streams.visible,true);
  const p=streams.children[8].position.clone();waterfall.update(100,true,true,false);assert.ok(streams.children[8].position.equals(p));
});
