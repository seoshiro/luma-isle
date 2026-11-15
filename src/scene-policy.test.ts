import {test} from 'node:test';
import assert from 'node:assert/strict';
import {introSample,INTRO_SECONDS,DISSOLVE_SECONDS,ART_TIMEOUT_MS} from './scene-policy';

test('entry lasts two seconds with strong early pull and a gentle landing',()=>{
 assert.equal(INTRO_SECONDS,2);
 assert.equal(introSample(0,false).progress,0);
 assert.ok(introSample(.5,false).progress>.65);
 assert.ok(introSample(1.8,false).progress>.999);
 assert.equal(introSample(1.99,false).done,false);
 assert.equal(introSample(2,false).done,true);
});
test('FOV begins and finishes at 37 and peaks at 56',()=>{
 assert.equal(introSample(0,false).fov,37);
 assert.equal(introSample(1,false).fov,56);
 assert.equal(introSample(2,false).fov,37);
});
test('reduced motion is only a 250ms dissolve, never a shortened flight',()=>{
 assert.equal(DISSOLVE_SECONDS,.25);
 for(const elapsed of [0,.05,.125,.2,.25,2]){
  const sample=introSample(elapsed,true);assert.equal(sample.progress,1);assert.equal(sample.fov,37);
 }
 assert.equal(introSample(0,true).opacity,0);
 assert.equal(introSample(.125,true).opacity,.5);
 assert.equal(introSample(.25,true).opacity,1);
});
test('completion is bounded and repeated samples are deterministic',()=>{
 for(const reduced of [true,false]){
  assert.deepEqual(introSample(100,reduced),introSample(200,reduced));
  assert.deepEqual(introSample(0,reduced),introSample(0,reduced));
  assert.equal(introSample(-1,reduced).t,0);
 }
 assert.ok(ART_TIMEOUT_MS>=15000&&ART_TIMEOUT_MS<=20000);
});
