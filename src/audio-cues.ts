import type { IslandCue } from './audio-policy';
const chimeNotes = [659.25, 783.99, 987.77] as const;
const chimeOffsets = [0, .27, .58] as const;
const puff = (t: number, start: number, length: number) => t <= start || t >= start + length ? 0 : Math.sin(Math.PI * (t - start) / length) ** 2;

/** Original, quiet one-shots. No assets, network requests or audio context here. */
export function synthesizeCue(cue: IslandCue, sampleRate: number, variation = 0): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Unsupported sample rate');
  const variant = Math.abs(Math.floor(Number.isFinite(variation) ? variation : 0)) % 3;
  const duration = cue === 'pig' ? .48 : 2.2;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 1717 + variant * 131, filtered = 0, low = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    let value = 0;
    if (cue === 'pig') {
      // Two soft nasal breaths, with a low, wavering voiced component.
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      filtered += (seed / 2147483648 - 1 - filtered) * (1 - Math.exp(-2 * Math.PI * 720 / sampleRate));
      low += (filtered - low) * (1 - Math.exp(-2 * Math.PI * 95 / sampleRate));
      const envelope = puff(t, .012, .21) + .55 * puff(t, .25, .18);
      const fundamental = 93 + variant * 3;
      const phase = 2 * Math.PI * (fundamental * t - 17 * t * t);
      value = envelope * ((filtered - low) * .38 + Math.sin(phase) * .07 + Math.sin(phase * 2) * .018);
    } else {
      for (let note = 0; note < chimeNotes.length; note++) {
        const age = t - chimeOffsets[note];
        if (age <= 0) continue;
        const frequency = chimeNotes[note] * (1 + (variant - 1) * .0015);
        const attack = Math.min(age / .014, 1);
        const decay = Math.exp(-age * 3.8);
        value += attack * decay * (.14 * Math.sin(2 * Math.PI * frequency * age)
          + .023 * Math.sin(2 * Math.PI * frequency * 2.76 * age)
          + .004 * Math.sin(2 * Math.PI * frequency * 5.4 * age));
      }
    }
    const edge = Math.min(1, t / .008, (samples.length - 1 - i) / (sampleRate * .09));
    samples[i] = Math.max(-.35, Math.min(.35, value)) * Math.max(0, edge);
  }
  return samples;
}
