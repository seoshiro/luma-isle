import { validGlassRect, type GlassRect, type GlassRendererStatus } from './glass-policy';

// DOM only supplies two small rectangles, never pixels or a second renderer.
const regions = new Map<string, GlassRect>();
let snapshot: readonly GlassRect[] = [];
let status: GlassRendererStatus = 'pending';
const listeners = new Set<() => void>();

export function setGlassRegion(id: string, rect: GlassRect | null) {
  if (rect && validGlassRect(rect)) regions.set(id, rect);
  else regions.delete(id);
  snapshot = [...regions.values()].slice(0, 2);
}
export const getGlassRegions = () => snapshot;
export const getGlassRendererStatus = () => status;
export function setGlassRendererStatus(value: GlassRendererStatus) {
  if (status === value) return;
  status = value;
  listeners.forEach(listener => listener());
}
export function subscribeGlassRenderer(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
