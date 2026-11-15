import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioPolicy, birdDelay, BIRD_PHRASES, choosePhrase, type IslandAudioOptions } from './audio-policy.ts';
const base: IslandAudioOptions = { enabled: true, volume: .3, stage: 0, lighting: 'morning', reducedMotion: false, sceneAvailable: true };
test('sound requires gesture, visible scene, explicit preference and normal motion', () => {
  assert.equal(audioPolicy(base, true, false).active, false);
  assert.equal(audioPolicy(base, false, true).active, false);
  for (const patch of [{ enabled: false }, { reducedMotion: true }, { sceneAvailable: false }]) assert.equal(audioPolicy({ ...base, ...patch }, true, true).master, 0);
  assert.equal(audioPolicy(base, true, true).master, .3);
  assert.equal(audioPolicy({ ...base, volume: NaN }, true, true).master, 0);
});
test('evening and night silence birds and lower nature', () => {
  for (const lighting of ['sunset', 'night'] as const) {
    const policy = audioPolicy({ ...base, lighting }, true, true);
    assert.equal(policy.birds, false); assert.ok(policy.nature < 1);
  }
});
test('five non-overlapping phrases and bounded sparse interval without immediate repeats', () => {
  assert.equal(BIRD_PHRASES.length, 5);
  for (const [, duration] of BIRD_PHRASES) assert.ok(duration < birdDelay(0) / 1000);
  for (let i = 0; i <= 100; i++) {
    assert.ok(birdDelay(i / 100) >= 6000 && birdDelay(i / 100) <= 18000);
    for (let previous = 0; previous < 5; previous++) {
      const next = choosePhrase(i / 100, previous);
      assert.notEqual(next, previous); assert.ok(next >= 0 && next < 5);
    }
  }
});
