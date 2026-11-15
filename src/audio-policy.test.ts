import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioPolicy, birdDelay, BIRD_PHRASES, choosePhrase, cueAllowed, CUE_COOLDOWN, type IslandAudioOptions } from './audio-policy.ts';
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
test('one-shots obey the same audio gates, finite times, stage and bounded cooldowns', () => {
  for (const cue of ['pig', 'chime'] as const) {
    const available = { ...base, stage: 4 as const };
    assert.equal(cueAllowed(cue, 0, undefined, available, true, true), true);
    assert.equal(cueAllowed(cue, 1, 0, available, true, true), false);
    assert.equal(cueAllowed(cue, CUE_COOLDOWN[cue], 0, available, true, true), true);
    assert.equal(cueAllowed(cue, NaN, undefined, available, true, true), false);
    assert.equal(cueAllowed(cue, 0, undefined, available, false, true), false);
    assert.equal(cueAllowed(cue, 0, undefined, available, true, false), false);
    for (const patch of [{ enabled: false }, { volume: 0 }, { reducedMotion: true }, { sceneAvailable: false }])
      assert.equal(cueAllowed(cue, 0, undefined, { ...available, ...patch }, true, true), false);
  }
  for (const stage of [0, 1, 2, 3] as const) assert.equal(cueAllowed('chime', 0, undefined, { ...base, stage }, true, true), false);
});
