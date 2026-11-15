import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeCue } from './audio-cues.ts';

test('quiet original cue buffers are finite, short, bounded and click-free at their edges', () => {
  for (const cue of ['pig', 'chime'] as const) for (const rate of [22050, 44100, 48000]) {
    const samples = synthesizeCue(cue, rate);
    assert.equal(samples.length, Math.ceil(rate * (cue === 'pig' ? .48 : 2.2)));
    let peak = 0, power = 0;
    for (const sample of samples) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); power += sample * sample; }
    assert.ok(peak > .03 && peak <= .35, `${cue}: ${peak}`);
    assert.ok(Math.sqrt(power / samples.length) < .1);
    assert.equal(samples[0], 0);
    assert.equal(Math.abs(samples.at(-1)!), 0);
    assert.deepEqual(synthesizeCue(cue, rate, 0), samples);
    assert.notDeepEqual(synthesizeCue(cue, rate, 1), samples);
  }
});
test('cue synthesis rejects malformed sample rates and normalizes variation safely', () => {
  for (const rate of [0, NaN, Infinity, -1, 7999, 192001]) assert.throws(() => synthesizeCue('pig', rate), RangeError);
  assert.deepEqual(synthesizeCue('pig', 8000, NaN), synthesizeCue('pig', 8000, 0));
});
