import type { Lighting, Stage } from './game';
export interface IslandAudioOptions {
  enabled: boolean; volume: number; stage: Stage; lighting: Lighting;
  reducedMotion: boolean; sceneAvailable: boolean;
}
export const clampVolume = (volume: number) => Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
export function audioPolicy(options: IslandAudioOptions, visible: boolean, unlocked: boolean) {
  const active = options.enabled && unlocked && visible && !options.reducedMotion && options.sceneAvailable;
  const day = options.lighting === 'morning';
  return { active, master: active ? clampVolume(options.volume) : 0,
    birds: active && day, nature: day ? 1 : options.lighting === 'sunset' ? 0.55 : 0.35,
    water: options.stage > 0 ? 0.13 : 0.08 };
}
/** Five distinct excerpts of the CC0 field recording; no synthesized bird tones. */
export const BIRD_PHRASES = [[1, 3.4], [7, 3.8], [13, 3.3], [19, 4.1], [25, 3.6]] as const;
export const birdDelay = (random: number) => 6000 + Math.max(0, Math.min(1, random)) * 12000;
export type IslandCue = 'pig' | 'chime';
/** Defense in depth: visual actions own their cooldown; audio can never pile up. */
export const CUE_COOLDOWN: Record<IslandCue, number> = { pig: 2.4, chime: 4 };
export function cueAllowed(cue: IslandCue, now: number, previous: number | undefined,
  options: IslandAudioOptions, visible: boolean, unlocked: boolean): boolean {
  const policy = audioPolicy(options, visible, unlocked);
  return policy.active && policy.master > 0 && Number.isFinite(now)
    && (cue !== 'chime' || options.stage === 4)
    && (previous === undefined || now - previous >= CUE_COOLDOWN[cue]);
}
export function choosePhrase(random: number, previous: number): number {
  const count = BIRD_PHRASES.length;
  const candidate = Math.min(count - 2, Math.floor(Math.max(0, random) * (count - 1)));
  return previous < 0 ? candidate : candidate >= previous ? candidate + 1 : candidate;
}
