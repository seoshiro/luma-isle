import { copy } from './i18n.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, gameReducer, parseSave, serializeSave, getWaterFlow, isLighthouseAligned, PUZZLES, LIGHTHOUSE_TARGET, LIGHTHOUSE_TOLERANCE, type GameAction, type GameState } from './game.ts';

const atStage = (stage: number) => {
  let state = createInitialState();
  for (let i = 0; i < stage; i++) state = gameReducer(state, { type: 'ASSIST', puzzle: PUZZLES[i] });
  return state;
};
test('initial saves are independent and sound defaults off', () => {
  const first = createInitialState(), second = createInitialState();
  first.gates[0] = true;
  assert.equal(second.gates[0], false);
  assert.equal(second.settings.sound, false);
  assert.equal(second.settings.volume, 0.3);
  assert.equal(second.stage, 0);
  assert.equal(second.entered, false);
  assert.equal(second.secretFound, false);
});
test('old eight-field v1 saves migrate without changing settings or progress', () => {
  for (let stage = 0; stage <= 4; stage++) {
    const state = atStage(stage);
    state.entered = true;
    state.settings = { ...state.settings, language: 'en', volume: .61, lighting: 'night' };
    const legacy = JSON.parse(serializeSave(state)); delete legacy.secretFound;
    assert.equal(Object.keys(legacy).length, 8);
    assert.deepEqual(parseSave(JSON.stringify(legacy)), state);
    delete legacy.settings.volume;
    assert.deepEqual(parseSave(JSON.stringify(legacy)), { ...state, settings: { ...state.settings, volume: .3 } });
    legacy.unrecognized = false;
    assert.equal(parseSave(JSON.stringify(legacy)), null);
  }
});
test('manual QA legacy fixtures are valid two-mechanism saves outside the bundle', () => {
  for (const [name, volume, language] of [['with-volume', .42, 'en'], ['without-volume', .3, 'ru']] as const) {
    const raw = readFileSync(new URL(`../tests/fixtures/legacy-v1-${name}.json`, import.meta.url), 'utf8');
    assert.equal(Object.hasOwn(JSON.parse(raw), 'secretFound'), false);
    const migrated = parseSave(raw);
    assert.ok(migrated);
    assert.equal(migrated.stage, 2);
    assert.equal(migrated.settings.volume, volume);
    assert.equal(migrated.settings.language, language);
    assert.equal(migrated.secretFound, false);
  }
});
test('secret discovery is optional, idempotent and survives save export/import at every stage', () => {
  for (let stage = 0; stage <= 4; stage++) {
    const before = atStage(stage), found = gameReducer(before, { type: 'DISCOVER_SECRET' });
    assert.deepEqual(found, { ...before, secretFound: true });
    assert.equal(gameReducer(found, { type: 'DISCOVER_SECRET' }), found);
    assert.deepEqual(parseSave(serializeSave(found)), found);
    assert.deepEqual(gameReducer(before, { type: 'REPLACE', state: found }), found);
    const reset = gameReducer(found, { type: 'RESET' });
    assert.equal(reset.secretFound, false);
    assert.equal(reset.stage, 0);
    assert.equal(gameReducer(reset, { type: 'DISCOVER_SECRET' }).secretFound, true);
  }
});
test('discovery migration accepts only the exact optional boolean field', () => {
  const state = atStage(2);
  for (const value of [null, 0, 1, 'true', [], {}, { secretDoor: true }])
    assert.equal(parseSave(JSON.stringify({ ...state, secretFound: value })), null);
  for (const value of [{ ...state, discoveries: { secretDoor: true } }, { ...state, secretFound: true, extra: false },
    { ...state, settings: { ...state.settings, secretFound: true } }]) assert.equal(parseSave(JSON.stringify(value)), null);
});
test('legacy v1 volume migration preserves progress and rejects malformed volume', () => {
  const state = atStage(2);
  const legacy = JSON.parse(serializeSave(state)); delete legacy.settings.volume;
  assert.deepEqual(parseSave(JSON.stringify(legacy)), state);
  for (const volume of [-1, 1.01, null, '0.3']) assert.equal(parseSave(JSON.stringify({ ...state, settings: { ...state.settings, volume } })), null);
  for (const volume of [0, .3, 1]) {
    const next = gameReducer(state, { type: 'SET_SETTINGS', settings: { volume } });
    assert.equal(parseSave(serializeSave(next))?.settings.volume, volume);
  }
});
test('all eight water combinations match the visible channel graph', () => {
  for (let bits = 0; bits < 8; bits++) {
    const gates = [!!(bits & 1), !!(bits & 2), !!(bits & 4)] as GameState['gates'];
    const flow = getWaterFlow(gates);
    assert.equal(flow.wheel, bits === 5);
    assert.equal(flow.inlet, gates[0]);
    assert.equal(flow.channel, gates[0] && !gates[1]);
    assert.equal(flow.spill, gates[0] && gates[1]);
    const state = createInitialState();
    state.gates = [!gates[0], gates[1], gates[2]];
    const result = gameReducer(state, { type: 'TOGGLE_GATE', index: 0 });
    assert.deepEqual(result.gates, gates);
    assert.equal(result.stage, bits === 5 ? 1 : 0);
  }
});
test('completed puzzles are immutable and future mechanisms are locked', () => {
  const actions: GameAction[] = [{ type: 'TOGGLE_GATE', index: 0 }, { type: 'ROTATE_DISK', index: 0 }, { type: 'ROTATE_RING', index: 0 }, { type: 'SET_LIGHTHOUSE_ANGLE', angle: 90 }];
  for (let stage = 0; stage <= 4; stage++) {
    const state = atStage(stage);
    for (let puzzle = 0; puzzle < 4; puzzle++) {
      if (stage !== puzzle) assert.equal(gameReducer(state, actions[puzzle]), state);
      if (stage !== puzzle) assert.equal(gameReducer(state, { type: 'ASSIST', puzzle: PUZZLES[puzzle] }), state);
    }
  }
});
test('manual rotation completes bridge and stars exactly once', () => {
  let state = atStage(1);
  for (let index = 0; index < 3; index++) {
    while (state.disks[index] !== 0) state = gameReducer(state, { type: 'ROTATE_DISK', index });
  }
  assert.equal(state.stage, 2);
  for (let index = 0; index < 2; index++) {
    while (state.rings[index] !== 0) state = gameReducer(state, { type: 'ROTATE_RING', index });
  }
  assert.equal(state.stage, 3);
  assert.deepEqual(state.disks, [0, 0, 0]);
  assert.equal(gameReducer(state, { type: 'ASSIST', puzzle: 'stars' }), state);
});
test('lighthouse accepts the inclusive lenient target and rejects near misses', () => {
  for (const offset of [-LIGHTHOUSE_TOLERANCE, 0, LIGHTHOUSE_TOLERANCE]) {
    assert.equal(gameReducer(atStage(3), { type: 'SET_LIGHTHOUSE_ANGLE', angle: LIGHTHOUSE_TARGET + offset }).stage, 4);
  }
  assert.equal(gameReducer(atStage(3), { type: 'SET_LIGHTHOUSE_ANGLE', angle: LIGHTHOUSE_TARGET + LIGHTHOUSE_TOLERANCE + .1 }).stage, 3);
  assert.equal(isLighthouseAligned(LIGHTHOUSE_TARGET + 360), true);
  assert.equal(isLighthouseAligned(NaN), false);
});
test('bad runtime action values cannot mutate state', () => {
  for (const index of [-1, 3, .5, NaN, Infinity]) {
    const state = atStage(0);
    assert.equal(gameReducer(state, { type: 'TOGGLE_GATE', index }), state);
  }
  for (const [stage, type, length] of [[1, 'ROTATE_DISK', 3], [2, 'ROTATE_RING', 2]] as const) {
    const state = atStage(stage);
    for (const index of [-1, length, .5, NaN, Infinity]) assert.equal(gameReducer(state, { type, index }), state);
  }
  const state = atStage(3);
  for (const angle of [-1, 361, NaN, Infinity]) assert.equal(gameReducer(state, { type: 'SET_LIGHTHOUSE_ANGLE', angle }), state);
  for (const settings of [{ sound: 'yes' }, { language: 'fr' }, { quality: null }, { lighting: 'noon' }, { hidden: true }]) {
    assert.equal(gameReducer(state, { type: 'SET_SETTINGS', settings } as unknown as GameAction), state);
  }
});
test('every stage and intermediate position round-trips, including settings and entry', () => {
  for (let stage = 0; stage <= 4; stage++) {
    let state = atStage(stage);
    if (stage === 0) state = gameReducer(state, { type: 'TOGGLE_GATE', index: 1 });
    if (stage === 1) state = gameReducer(state, { type: 'ROTATE_DISK', index: 1 });
    if (stage === 2) state = gameReducer(state, { type: 'ROTATE_RING', index: 1 });
    if (stage === 3) state = gameReducer(state, { type: 'SET_LIGHTHOUSE_ANGLE', angle: 92.5 });
    state = gameReducer(state, { type: 'ENTER' });
    state = gameReducer(state, { type: 'SET_SETTINGS', settings: { language: 'en', sound: true, quality: 'high', lighting: 'night' } });
    assert.deepEqual(parseSave(serializeSave(state)), state);
  }
});
test('corrupt, missing, unknown-version, and out-of-order saves are rejected', () => {
  const base = createInitialState();
  const invalid: unknown[] = [null, [], {}, 'hello', { ...base, version: 2 }, { ...base, stage: 5 }, { ...base, stage: .5 },
    { ...base, gates: [false, 0, false] }, { ...base, gates: [false, false] }, { ...base, disks: [0, 4, 1] },
    { ...base, rings: [0, 8] }, { ...base, entered: 'true' }, { ...base, lighthouseAngle: -1 }, { ...base, lighthouseAngle: 361 },
    { ...base, settings: { ...base.settings, sound: 1 } }, { ...base, extra: true }, { ...base, stage: 3 },
    { ...base, gates: [true, false, true] }, { ...base, disks: [1, 1, 1] }, { ...base, rings: [1, 1] },
    { ...atStage(1), disks: [0, 0, 0] }, { ...atStage(2), rings: [0, 0] }, { ...atStage(3), lighthouseAngle: LIGHTHOUSE_TARGET },
    { ...atStage(4), lighthouseAngle: 0 }];
  for (const value of invalid) assert.equal(parseSave(JSON.stringify(value)), null, JSON.stringify(value));
  for (const raw of ['', '{', 'undefined', ' '.repeat(16385)]) assert.equal(parseSave(raw), null);
  for (const key of Object.keys(base)) {
    if (key === 'secretFound') continue; // The one deliberately additive v1 field.
    const value = { ...base } as Record<string, unknown>; delete value[key];
    assert.equal(parseSave(JSON.stringify(value)), null);
  }
});
test('reset preserves preferences; validated replacement cannot admit corrupt imports', () => {
  const completed = atStage(4);
  completed.settings.language = 'en'; completed.entered = true;
  const reset = gameReducer(completed, { type: 'RESET' });
  assert.equal(reset.stage, 0); assert.equal(reset.settings.language, 'en'); assert.equal(reset.entered, true);
  assert.equal(gameReducer(reset, { type: 'REPLACE', state: { ...completed, stage: 0 } }), reset);
  assert.deepEqual(gameReducer(reset, { type: 'REPLACE', state: completed }), completed);
});

test('arrival branding uses LUMA in both languages, without obsolete pig branding', () => {
  assert.equal(copy.ru.enter, '\u0412\u043e\u0439\u0442\u0438 \u0432 \u043c\u0438\u0440 LUMA');
  assert.equal(copy.en.enter, 'Enter the world of LUMA');
  for (const language of ['ru', 'en'] as const) {
    const { enter, eyebrow, tagline, preparing } = copy[language];
    assert.doesNotMatch(JSON.stringify({ enter, eyebrow, tagline, preparing }), /\u0441\u0432\u0438\u043d|\bpig(?:s)?\b|\bswine\b/i);
  }
});
test('living actions and feedback have complete Russian and English copy', () => {
  assert.equal(copy.ru.living.secret, 'Кажется, здесь кто-то живёт');
  for (const language of ['ru', 'en'] as const) {
    const living = copy[language].living;
    for (const action of ['pig', 'boat', 'chime', 'bird', 'door', 'ripple'] as const) {
      assert.ok(living.actions[action].length > 3);
      assert.ok(living.feedback[action].length > 3);
    }
    assert.ok(living.waiting.length > 3);
    assert.ok(living.secret.length > 3);
  }
});
