import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IslandAudio } from './audio.ts';
import type { IslandAudioOptions } from './audio-policy.ts';

class Param {
  value = 0;
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
}
class Gain {
  gain = new Param(); target: unknown; disconnected = false;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
}
class Source {
  buffer: unknown; loop = false; target: unknown; onended: (() => void) | null = null; stopped = false; started = false; disconnected = false;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start() { this.started = true; }
  stop() { this.stopped = true; this.onended?.(); }
}
class Context {
  static all: Context[] = [];
  state = 'running'; sampleRate = 12000; currentTime = 0; destination = {}; onstatechange: (() => void) | null = null;
  sources: Source[] = []; gains: Gain[] = [];
  constructor() { Context.all.push(this); }
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const samples = Array.from({ length: channels }, () => new Float32Array(length));
    return { sampleRate, length, duration: length / sampleRate, numberOfChannels: channels, getChannelData: (index: number) => samples[index] };
  }
  async decodeAudioData() { return this.createBuffer(1, this.sampleRate * 32, this.sampleRate); }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
const base: IslandAudioOptions = { enabled: true, volume: .3, stage: 0, lighting: 'morning', reducedMotion: false, sceneAvailable: true };
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('one context owns ambience and accepted cues; mute, hide and disposal stop every source', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const oldFetch = globalThis.fetch;
  const doc = { hidden: false };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  globalThis.fetch = async () => new Response(new ArrayBuffer(0), { status: 200 });
  Context.all = [];
  const errors: (string | null)[] = [], audio = new IslandAudio(base, error => errors.push(error));
  t.after(() => {
    audio.dispose(); globalThis.fetch = oldFetch;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldContext) Object.defineProperty(globalThis, 'AudioContext', oldContext); else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  audio.update(base);
  assert.equal(audio.playCue('pig'), false);
  assert.equal(Context.all.length, 0, 'preferences and cue calls cannot create a context');
  audio.unlock(); await settle();
  const context = Context.all[0], master = context.gains[0];
  assert.equal(Context.all.length, 1); assert.equal(context.sources.length, 2);
  assert.equal(audio.playCue('pig'), true);
  const firstCount = context.sources.length;
  assert.equal(audio.playCue('pig'), false); assert.equal(context.sources.length, firstCount);
  assert.equal(audio.playCue('chime'), false, 'garden is not yet open');
  context.currentTime = 3;
  assert.equal(audio.playCue('pig'), true);
  for (const source of context.sources) {
    assert.ok(source.started);
    assert.equal((source.target as Gain).target, master);
  }
  assert.equal(master.target, context.destination);
  audio.update({ ...base, volume: .1 }); assert.equal(master.gain.value, .1);
  const opened = { ...base, stage: 4 as const };
  audio.update(opened);
  assert.equal(audio.playCue('chime'), true);
  assert.equal(audio.playCue('chime'), false);
  doc.hidden = true;
  assert.equal(audio.playCue('pig'), false, 'visibility gate is immediate before event delivery');
  audio.update(opened); await settle();
  assert.equal(context.state, 'suspended');
  assert.ok(context.sources.every(source => source.stopped && source.disconnected));
  const hiddenSources = context.sources.length;
  t.mock.timers.tick(60000); await settle();
  assert.equal(context.sources.length, hiddenSources, 'hidden tab has no pending birds or one-shot timers');
  doc.hidden = false; audio.update(opened); await settle();
  assert.equal(Context.all.length, 1, 'visibility resumes the same context');
  audio.update({ ...opened, enabled: false }); await settle();
  assert.equal(context.state, 'closed'); assert.ok(context.sources.every(source => source.stopped));
  assert.equal(audio.playCue('pig'), false);
  audio.update(opened); assert.equal(Context.all.length, 1, 'reenabling requires another gesture');
  audio.unlock(); await settle();
  const second = Context.all[1]; assert.equal(Context.all.length, 2);
  audio.update({ ...opened, reducedMotion: true }); await settle();
  assert.equal(second.state, 'closed'); assert.ok(second.sources.every(source => source.stopped));
  assert.equal(audio.playCue('chime'), false);
  const stoppedSources = second.sources.length;
  t.mock.timers.tick(60000); await settle();
  assert.equal(second.sources.length, stoppedSources, 'disposal leaves no scheduled source');
  assert.deepEqual(errors.filter(Boolean), []);
});

test('a stale initial or repeat resume rejection cannot close a newly unlocked context', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const oldFetch = globalThis.fetch;
  const owners: IslandAudio[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  globalThis.fetch = async () => new Response(new ArrayBuffer(0), { status: 200 });
  t.after(() => {
    owners.forEach(owner => owner.dispose()); globalThis.fetch = oldFetch;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldContext) Object.defineProperty(globalThis, 'AudioContext', oldContext); else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  for (const phase of ['initial', 'repeat'] as const) {
    let deferNext = phase === 'initial', rejectOld!: (reason: Error) => void;
    class DeferredContext extends Context {
      override resume(): Promise<void> {
        if (!deferNext) return super.resume();
        deferNext = false;
        return new Promise<void>((_resolve, reject) => { rejectOld = reject; });
      }
    }
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: DeferredContext });
    Context.all = [];
    const errors: (string | null)[] = [], audio = new IslandAudio(base, error => errors.push(error));
    owners.push(audio);
    audio.unlock(); await settle();
    const old = Context.all[0];
    if (phase === 'repeat') { deferNext = true; audio.unlock(); }
    audio.update({ ...base, enabled: false });
    assert.equal(old.state, 'closed');
    audio.update(base); audio.unlock(); await settle();
    const current = Context.all[1];
    assert.equal(current.state, 'running');
    rejectOld(new Error(`Obsolete ${phase} resume rejected`)); await settle();
    assert.equal(current.state, 'running', `${phase}: old rejection must not dispose the new owner`);
    assert.equal(Context.all.length, 2);
    assert.equal(audio.playCue('pig'), true, `${phase}: new context can still play accepted cues`);
    assert.deepEqual(errors.filter(Boolean), [], `${phase}: stale rejection cannot show an error for new audio`);
    audio.dispose();
  }
});
