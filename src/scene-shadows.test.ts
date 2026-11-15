import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {configureIslandShadow,fittedShadowBounds,shadowResolution} from './scene-shadows';

test('shadow budgets are quality bounded and fitted envelope includes all island corners',()=>{
  assert.equal(shadowResolution('high'),2048);assert.equal(shadowResolution('medium'),1536);assert.equal(shadowResolution('low'),1024);
  const sun=new THREE.DirectionalLight();sun.position.set(-12,22,10);
  const bounds=configureIslandShadow(sun,'high');assert.equal(sun.shadow.mapSize.x,2048);
  for(const x of [-12.8,17.6])for(const y of [-6.1,8])for(const z of [-9,8.5]){
    const p=new THREE.Vector3(x,y,z).applyMatrix4(sun.shadow.camera.matrixWorldInverse);
    assert.ok(p.x>=bounds.left&&p.x<=bounds.right);assert.ok(p.y>=bounds.bottom&&p.y<=bounds.top);assert.ok(-p.z>=bounds.near&&-p.z<=bounds.far);
  }
  assert.deepEqual(fittedShadowBounds(sun.shadow.camera.matrixWorldInverse,2048),fittedShadowBounds(sun.shadow.camera.matrixWorldInverse,2048));
  configureIslandShadow(sun,'medium');assert.equal(sun.shadow.mapSize.x,1536);assert.ok(sun.shadow.normalBias<=.06);assert.equal(sun.shadow.bias,-.00065);
});
