import type { Quality } from './game';

export type GlassMode = 'refractive' | 'frosted' | 'matte';
export type GlassRendererStatus = 'pending' | 'ready' | 'fallback';
export interface GlassRect { left: number; top: number; width: number; height: number }

/** Rendering is an enhancement. Navigation never depends on the optical pass. */
export function glassMode(quality: Quality, reducedMotion: boolean, highContrast: boolean, renderer: GlassRendererStatus): GlassMode {
  if (quality === 'low' || reducedMotion || highContrast) return 'matte';
  return renderer === 'ready' ? 'refractive' : 'frosted';
}

export function highlightIndex(stage: number, hover: number | null, focus: number | null, count: number): number {
  return Math.max(0, Math.min(count - 1, hover ?? focus ?? stage));
}

/** Rounded-rectangle signed distance, in CSS pixels. Negative means inside. */
export function glassDistance(x: number, y: number, width: number, height: number): number {
  const radius = Math.min(width, height) / 2;
  const qx = Math.abs(x - width / 2) - (width / 2 - radius);
  const qy = Math.abs(y - height / 2) - (height / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** A smooth, finite rounded lip: no displacement at its outside or core seam. */
export function glassBend(inset: number, thickness = 12): number {
  if (inset <= 0 || inset >= thickness) return 0;
  const t = inset / thickness;
  return Math.sin(t * Math.PI) * (.84 + .16 * Math.cos(t * Math.PI));
}

/** DOM coordinates become bottom-left CSS-pixel coordinates in the live canvas. */
export function glassRectInCanvas(rect: GlassRect, canvas: GlassRect): [number, number, number, number] {
  return [rect.left - canvas.left, canvas.height - (rect.top - canvas.top) - rect.height, rect.width, rect.height];
}

export function validGlassRect(rect: GlassRect): boolean {
  return Object.values(rect).every(Number.isFinite) && rect.width >= 1 && rect.height >= 1;
}

/** Bounded framebuffer copy, with room for refraction taps, in physical pixels. */
export function glassCaptureBounds(rects: readonly GlassRect[], canvas: GlassRect, ratio: number, bufferWidth: number, bufferHeight: number) {
  if (!rects.length || ratio <= 0 || !Number.isFinite(ratio)) return null;
  const local = rects.filter(validGlassRect).map(rect => glassRectInCanvas(rect, canvas));
  if (!local.length) return null;
  const padding = 10;
  const left = Math.max(0, Math.floor((Math.min(...local.map(rect => rect[0])) - padding) * ratio));
  const bottom = Math.max(0, Math.floor((Math.min(...local.map(rect => rect[1])) - padding) * ratio));
  const right = Math.min(bufferWidth, Math.ceil((Math.max(...local.map(rect => rect[0] + rect[2])) + padding) * ratio));
  const top = Math.min(bufferHeight, Math.ceil((Math.max(...local.map(rect => rect[1] + rect[3])) + padding) * ratio));
  return right > left && top > bottom ? { x: left, y: bottom, width: right - left, height: top - bottom } : null;
}
