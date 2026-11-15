/** Deterministic world state. Animation progress never controls logical completion. */
export const SAVE_VERSION = 1 as const;
export const STORAGE_KEY = 'luma-isle.save.v1';
export const WATER_TARGET = [true, false, true] as const;
export const BRIDGE_TARGET = [0, 0, 0] as const;
export const STAR_TARGET = [0, 0] as const;
export const DISK_STEPS = 4;
export const RING_STEPS = 8;
export const LIGHTHOUSE_TARGET = 45;
export const LIGHTHOUSE_TOLERANCE = 6;
export const PUZZLES = ['water', 'bridge', 'stars', 'lighthouse'] as const;
export type Puzzle = typeof PUZZLES[number];
export type Stage = 0 | 1 | 2 | 3 | 4;
export type Language = 'ru' | 'en';
export type Quality = 'low' | 'medium' | 'high';
export type Lighting = 'morning' | 'sunset' | 'night';
export interface Settings { language: Language; sound: boolean; quality: Quality; lighting: Lighting }
export interface GameState {
  version: typeof SAVE_VERSION;
  stage: Stage;
  gates: [boolean, boolean, boolean];
  disks: [number, number, number];
  rings: [number, number];
  lighthouseAngle: number;
  settings: Settings;
  entered: boolean;
}
export type GameAction =
  | { type: 'REPLACE'; state: GameState }
  | { type: 'ENTER' }
  | { type: 'TOGGLE_GATE'; index: number }
  | { type: 'ROTATE_DISK'; index: number }
  | { type: 'ROTATE_RING'; index: number }
  | { type: 'SET_LIGHTHOUSE_ANGLE'; angle: number }
  | { type: 'ASSIST'; puzzle: Puzzle }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'RESET' };
export function createInitialState(): GameState {
  return { version: SAVE_VERSION, stage: 0, gates: [false, false, false], disks: [1, 2, 3], rings: [2, 5], lighthouseAngle: 0,
    settings: { language: 'ru', sound: false, quality: 'medium', lighting: 'morning' }, entered: false };
}
const equal = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const indexValid = (index: number, length: number) => Number.isInteger(index) && index >= 0 && index < length;
export const isWaterAligned = (gates: readonly boolean[]) => equal(gates, WATER_TARGET);
export function isLighthouseAligned(angle: number): boolean {
  if (!Number.isFinite(angle)) return false;
  const difference = ((angle - LIGHTHOUSE_TARGET) % 360 + 360) % 360;
  return Math.min(difference, 360 - difference) <= LIGHTHOUSE_TOLERANCE;
}
/** Matches the visible branching channels: inlet, selected branch, wheel outlet. */
export function getWaterFlow(gates: readonly boolean[]) {
  const inlet = gates[0] === true;
  const channel = inlet && gates[1] === false;
  return { inlet, channel, spill: inlet && gates[1] === true, wheel: channel && gates[2] === true };
}
function finish(state: GameState): GameState {
  const solved = state.stage === 0 ? isWaterAligned(state.gates)
    : state.stage === 1 ? equal(state.disks, BRIDGE_TARGET)
    : state.stage === 2 ? equal(state.rings, STAR_TARGET)
    : state.stage === 3 ? isLighthouseAligned(state.lighthouseAngle) : false;
  return solved ? { ...state, stage: (state.stage + 1) as Stage } : state;
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'REPLACE': return parseSave(serializeSave(action.state)) ?? state;
    case 'ENTER': return state.entered ? state : { ...state, entered: true };
    case 'RESET': return { ...createInitialState(), settings: { ...state.settings }, entered: state.entered };
    case 'SET_SETTINGS': {
      if (!record(action.settings) || Object.keys(action.settings).some(key => !['language', 'sound', 'quality', 'lighting'].includes(key))) return state;
      const settings = { ...state.settings, ...action.settings };
      return validSettings(settings) ? { ...state, settings } : state;
    }
    case 'TOGGLE_GATE': {
      if (state.stage !== 0 || !indexValid(action.index, 3)) return state;
      const gates = [...state.gates] as GameState['gates']; gates[action.index] = !gates[action.index];
      return finish({ ...state, gates });
    }
    case 'ROTATE_DISK': {
      if (state.stage !== 1 || !indexValid(action.index, 3)) return state;
      const disks = [...state.disks] as GameState['disks']; disks[action.index] = (disks[action.index] + 1) % DISK_STEPS;
      return finish({ ...state, disks });
    }
    case 'ROTATE_RING': {
      if (state.stage !== 2 || !indexValid(action.index, 2)) return state;
      const rings = [...state.rings] as GameState['rings']; rings[action.index] = (rings[action.index] + 1) % RING_STEPS;
      return finish({ ...state, rings });
    }
    case 'SET_LIGHTHOUSE_ANGLE':
      if (state.stage !== 3 || !Number.isFinite(action.angle) || action.angle < 0 || action.angle > 360) return state;
      return finish({ ...state, lighthouseAngle: action.angle });
    case 'ASSIST':
      if (state.stage === 4 || PUZZLES[state.stage] !== action.puzzle) return state;
      return finish({ ...state, ...(state.stage === 0 ? { gates: [...WATER_TARGET] as GameState['gates'] }
        : state.stage === 1 ? { disks: [...BRIDGE_TARGET] as GameState['disks'] }
        : state.stage === 2 ? { rings: [...STAR_TARGET] as GameState['rings'] } : { lighthouseAngle: LIGHTHOUSE_TARGET }) });
    default: return state;
  }
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function validSettings(value: unknown): value is Settings {
  return record(value) && exactKeys(value, ['language', 'sound', 'quality', 'lighting']) && ['ru', 'en'].includes(value.language as string)
    && typeof value.sound === 'boolean' && ['low', 'medium', 'high'].includes(value.quality as string)
    && ['morning', 'sunset', 'night'].includes(value.lighting as string);
}
function rotationTuple(value: unknown, count: number, steps: number): value is number[] {
  return Array.isArray(value) && value.length === count && Array.from(value).every(v => Number.isInteger(v) && v >= 0 && v < steps);
}
/** Reject rather than merge corrupt, unknown-version, or logically inconsistent imports. */
export function parseSave(raw: string): GameState | null {
  try {
    if (typeof raw !== 'string' || raw.length > 16384) return null;
    const value: unknown = JSON.parse(raw);
    if (!record(value) || !exactKeys(value, ['version', 'stage', 'gates', 'disks', 'rings', 'lighthouseAngle', 'settings', 'entered'])) return null;
    if (value.version !== SAVE_VERSION || !Number.isInteger(value.stage) || (value.stage as number) < 0 || (value.stage as number) > 4
      || typeof value.entered !== 'boolean' || !validSettings(value.settings)
      || !Array.isArray(value.gates) || value.gates.length !== 3 || !value.gates.every(v => typeof v === 'boolean')
      || !rotationTuple(value.disks, 3, DISK_STEPS) || !rotationTuple(value.rings, 2, RING_STEPS)
      || typeof value.lighthouseAngle !== 'number' || !Number.isFinite(value.lighthouseAngle) || value.lighthouseAngle < 0 || value.lighthouseAngle > 360) return null;
    const state = value as unknown as GameState;
    const initial = createInitialState();
    if ((state.stage >= 1) !== isWaterAligned(state.gates)
      || (state.stage >= 2) !== equal(state.disks, BRIDGE_TARGET)
      || (state.stage >= 3) !== equal(state.rings, STAR_TARGET)
      || (state.stage === 4) !== isLighthouseAligned(state.lighthouseAngle)
      || (state.stage < 1 && !equal(state.disks, initial.disks))
      || (state.stage < 2 && !equal(state.rings, initial.rings))
      || (state.stage < 3 && state.lighthouseAngle !== initial.lighthouseAngle)) return null;
    return state;
  } catch { return null; }
}
export function serializeSave(state: GameState): string { return JSON.stringify(state); }
