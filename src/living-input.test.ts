import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LivingTapGate} from './living-input';
import {visibleThroughParents} from './living-primitives';
const pointer=(id=1,x=0,y=0)=>({pointerId:id,clientX:x,clientY:y,isPrimary:id===1,button:0});
test('living tap cancels drag, multi-touch, pointercancel and reset, never a queued click',()=>{
 const tap=new LivingTapGate();tap.down(pointer(),true);assert.equal(tap.up(pointer(1,3,3),true),true);
 tap.down(pointer(),true);tap.move(pointer(1,7,0));tap.move(pointer());assert.equal(tap.up(pointer(),true),false);
 tap.down(pointer(),true);tap.down(pointer(2),true);assert.equal(tap.up(pointer(2),true),false);assert.equal(tap.up(pointer(),true),false);
 tap.down(pointer(),true);tap.cancel(1);assert.equal(tap.up(pointer(),true),false);
 tap.down(pointer(),true);tap.reset();assert.equal(tap.up(pointer(),true),false);
 tap.down(pointer(),true);assert.equal(tap.up(pointer(),false),false);
 tap.down(pointer(),false);assert.equal(tap.up(pointer(),true),false);
});
test('hidden garden or ancestor disables a locally visible hitbox',()=>{const root=new THREE.Group(),garden=new THREE.Group(),hit=new THREE.Object3D();root.add(garden);garden.add(hit);assert.equal(visibleThroughParents(hit),true);garden.visible=false;assert.equal(visibleThroughParents(hit),false);garden.visible=true;root.visible=false;assert.equal(visibleThroughParents(hit),false);});
