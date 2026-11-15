import { useCallback, useEffect, useRef, useState } from 'react';
import { audioPolicy, BIRD_PHRASES, birdDelay, choosePhrase, cueAllowed, type IslandAudioOptions, type IslandCue } from './audio-policy';
import { synthesizeCue } from './audio-cues';

type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type AudioOptions = IslandAudioOptions & { sceneFailed?: boolean };
/** One context per mounted owner, created ONLY by unlockAudioFromGesture. */
export class IslandAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private voices = new Set<Voice>();
  private cueBuffers = new Map<string, AudioBuffer>();
  private lastCue: Partial<Record<IslandCue, number>> = {};
  private cueVariation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallySuspended = false;
  private previous = -1;
  private playing = false;
  private generation = 0;
  constructor(private options: AudioOptions, private report: (error: string | null) => void) {}

  update(options: AudioOptions) {
    this.options = options;
    if (!options.enabled || options.reducedMotion || options.sceneFailed) { this.dispose(); return; }
    const policy = audioPolicy(options, !document.hidden, !!this.context);
    if (!policy.active) {
      this.stopVoices();
      this.intentionallySuspended = true;
      const context = this.context;
      if (context?.state === 'running') void context.suspend().then(() => {
        // Intro/visibility can change before the suspend promise settles.
        if (this.context === context) this.update(this.options);
      }).catch(() => { if (this.context === context) this.dispose(); });
      return;
    }
    if (!this.context) return;
    const context = this.context;
    if (context.state === 'suspended') void context.resume().then(() => {
      if (this.context !== context) return;
      this.intentionallySuspended = false;
      this.update(this.options);
    }).catch(() => { if (this.context === context) this.dispose(); });
    if (this.master) this.master.gain.setTargetAtTime(policy.master, this.context.currentTime, 0.08);
    // Restart the sparse mix on lighting/stage change, never on volume changes.
    this.start();
  }

  unlock() {
    // Called synchronously from a real button click, before React commits enabled=true.
    if (document.hidden || this.options.reducedMotion || !this.options.sceneAvailable || this.options.sceneFailed) return;
    if (this.context) {
      const context = this.context;
      void context.resume().catch(() => { if (this.context === context) this.dispose(); });
      return;
    }
    try {
      const context = new AudioContext();
      this.context = context;
      this.master = context.createGain(); this.master.gain.value = 0; this.master.connect(context.destination);
      context.onstatechange = () => {
        if (this.context !== context) return;
        if (context.state === 'closed' || (context.state as string) === 'interrupted'
          || (context.state === 'suspended' && !document.hidden && !this.intentionallySuspended)) this.dispose();
      };
      // resume must happen in the gesture's stack, not after fetch/decode.
      void context.resume().catch(() => {
        if (this.context !== context) return;
        this.report('Audio could not start. Try enabling sound again.'); this.dispose();
      });
      const generation = ++this.generation;
      const abort = new AbortController(); this.abort = abort;
      this.report(null);
      // Bounds fetch headers, response bodies AND decode. decodeAudioData itself
      // is not abortable; generation guards discard any late result after close.
      this.loadTimer = setTimeout(() => {
        if (generation !== this.generation || this.context !== context) return;
        this.report('Audio loading timed out. Try enabling sound again.');
        this.dispose();
      }, 15000);
      void Promise.all(['huamei', 'swale', 'wind'].map(async name => {
        const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}audio/${name}.ogg`, { signal: abort.signal });
        if (!response.ok) throw new Error(`Audio ${name}: HTTP ${response.status}`);
        return context.decodeAudioData(await response.arrayBuffer());
      })).then(buffers => {
        if (generation !== this.generation || this.context !== context) return;
        if (this.loadTimer !== null) clearTimeout(this.loadTimer);
        this.loadTimer = null;
        // Fade the loop seam in the recorded ambience; no synthetic replacement.
        for (const buffer of buffers.slice(1)) {
          const fade = Math.min(Math.floor(buffer.sampleRate * 0.4), Math.floor(buffer.length / 2));
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (let i = 0; i < fade; i++) { const level = i / fade; samples[i] *= level; samples[samples.length - 1 - i] *= level; }
          }
        }
        this.buffers = buffers; this.update(this.options);
      }).catch(error => {
        if (abort.signal.aborted || generation !== this.generation) return;
        this.report(error instanceof Error ? error.message : 'Audio unavailable'); this.dispose();
      });
    } catch { this.report('Audio is unavailable in this browser.'); this.dispose(); }
  }

  /** Only a successfully accepted scene reaction calls this; never unlocks audio. */
  playCue(cue: IslandCue): boolean {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.master || this.options.sceneFailed
      || !cueAllowed(cue, context.currentTime, this.lastCue[cue], this.options, !document.hidden, true)) return false;
    const variant = this.cueVariation++ % 3, key = `${cue}:${variant}`;
    let buffer = this.cueBuffers.get(key);
    if (!buffer) {
      const samples = synthesizeCue(cue, context.sampleRate, variant);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      this.cueBuffers.set(key, buffer);
    }
    this.lastCue[cue] = context.currentTime;
    this.master.gain.setTargetAtTime(audioPolicy(this.options, !document.hidden, true).master, context.currentTime, .04);
    this.voice(buffer, cue === 'pig' ? .5 : .42, false, 0, buffer.duration);
    return true;
  }

  private mixKey = '';
  private start() {
    const context = this.context, master = this.master;
    const policy = audioPolicy(this.options, !document.hidden, !!context);
    if (!context || !master || context.state !== 'running' || !policy.active || this.buffers.length !== 3) return;
    const key = `${this.options.lighting}:${this.options.stage}`;
    if (this.playing && key === this.mixKey) return;
    this.stopVoices(); this.playing = true; this.mixKey = key;
    master.gain.setTargetAtTime(policy.master, context.currentTime, 0.08);
    this.voice(this.buffers[1], policy.water * policy.nature, true);
    this.voice(this.buffers[2], 0.035 * policy.nature, true);
    if (policy.birds) this.scheduleBird();
  }

  private voice(buffer: AudioBuffer, level: number, loop = false, offset = 0, duration?: number) {
    const context = this.context, master = this.master;
    if (!context || !master) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.loop = loop;
    source.connect(gain); gain.connect(master);
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + (loop ? 1 : 0.12));
    if (duration) { gain.gain.setValueAtTime(level, now + duration - 0.25); gain.gain.linearRampToValueAtTime(0, now + duration); }
    const voice = { source, gain }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(now, offset, duration);
  }

  private scheduleBird() {
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!audioPolicy(this.options, !document.hidden, !!this.context).birds || !this.playing) return;
      this.previous = choosePhrase(Math.random(), this.previous);
      const [offset, duration] = BIRD_PHRASES[this.previous];
      this.voice(this.buffers[0], 0.32 + Math.random() * 0.1, false, offset, duration);
      // 6–18 seconds between starts, always longer than the longest excerpt.
      this.scheduleBird();
    }, birdDelay(Math.random()));
  }

  private stopVoices() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.playing = false;
    for (const { source, gain } of this.voices) {
      source.onended = null;
      try { source.stop(); } catch { /* already ended */ }
      source.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }

  dispose() {
    ++this.generation; this.abort?.abort(); this.abort = null;
    if (this.loadTimer !== null) clearTimeout(this.loadTimer);
    this.loadTimer = null; this.intentionallySuspended = false;
    this.stopVoices(); this.buffers = []; this.cueBuffers.clear(); this.lastCue = {};
    const context = this.context; this.context = null;
    this.master?.disconnect(); this.master = null;
    if (context) { context.onstatechange = null; if (context.state !== 'closed') void context.close().catch(() => {}); }
  }
}

export function useIslandAudio(options: AudioOptions) {
  const owner = useRef<IslandAudio | null>(null);
  const latest = useRef(options); latest.current = options;
  const [audioError, setAudioError] = useState<string | null>(null);
  useEffect(() => {
    const audio = new IslandAudio(latest.current, setAudioError); owner.current = audio;
    const visibility = () => audio.update(latest.current);
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); audio.dispose(); owner.current = null; };
  }, []);
  useEffect(() => { owner.current?.update(options); }, [options.enabled, options.volume, options.stage, options.lighting, options.reducedMotion, options.sceneAvailable, options.sceneFailed]);
  const unlockAudioFromGesture = useCallback(() => owner.current?.unlock(), []);
  const playCue = useCallback((cue: IslandCue) => owner.current?.playCue(cue) ?? false, []);
  return { unlockAudioFromGesture, playCue, audioError };
}
