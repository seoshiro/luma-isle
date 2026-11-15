import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glassMode, highlightIndex, glassDistance, glassBend, glassRectInCanvas, glassCaptureBounds, validGlassRect } from './glass-policy';
import { getGlassRegions, setGlassRegion, getGlassRendererStatus, setGlassRendererStatus, subscribeGlassRenderer } from './glass-regions';

const canvas = { left: 20, top: 30, width: 800, height: 600 };

test('actual renderer readiness controls optical mode; fallback is always readable', () => {
  assert.equal(glassMode('medium', false, false, 'ready'), 'refractive');
  assert.equal(glassMode('high', false, false, 'pending'), 'frosted');
  assert.equal(glassMode('high', false, false, 'fallback'), 'frosted');
  for (const status of ['ready', 'pending', 'fallback'] as const) {
    assert.equal(glassMode('low', false, false, status), 'matte');
    assert.equal(glassMode('high', true, false, status), 'matte');
    assert.equal(glassMode('high', false, true, status), 'matte');
  }
});

test('the single highlight follows hover, keyboard focus, then bounded progress', () => {
  assert.equal(highlightIndex(2, null, null, 4), 2);
  assert.equal(highlightIndex(2, null, 1, 4), 1);
  assert.equal(highlightIndex(2, 3, 1, 4), 3);
  assert.equal(highlightIndex(4, null, null, 4), 3);
  assert.equal(highlightIndex(-1, null, null, 4), 0);
});

test('capsule distance preserves round ends, straight sides, and mirrored edges', () => {
  assert.equal(glassDistance(170, 35, 340, 70), -35);
  assert.equal(glassDistance(170, 0, 340, 70), 0);
  assert.equal(glassDistance(0, 35, 340, 70), 0);
  assert.ok(glassDistance(0, 0, 340, 70) > 0);
  for (const [x, y] of [[8, 35], [33, 6], [150, 8], [320, 42]]) {
    assert.ok(Math.abs(glassDistance(x, y, 340, 70) - glassDistance(340 - x, y, 340, 70)) < 1e-10);
    assert.ok(Math.abs(glassDistance(x, y, 340, 70) - glassDistance(x, 70 - y, 340, 70)) < 1e-10);
  }
  assert.equal(glassDistance(30, 30, 60, 60), -30);
  assert.equal(glassDistance(30, 0, 60, 60), 0);
});

test('rounded lip is bounded and joins both untouched outside and calm core smoothly', () => {
  for (const inset of [-20, 0, 12, 40]) assert.equal(glassBend(inset), 0);
  assert.ok(glassBend(6) > .8);
  assert.ok(glassBend(.001) < .001);
  assert.ok(glassBend(11.999) < .001);
  for (let inset = 0; inset <= 12; inset += .1) assert.ok(glassBend(inset) >= 0 && glassBend(inset) <= 1);
});

test('DOM rectangles map to bottom-left canvas coordinates, including a displaced host', () => {
  const rect = { left: 120, top: 530, width: 340, height: 70 };
  assert.deepEqual(glassRectInCanvas(rect, canvas), [100, 30, 340, 70]);
  assert.equal(validGlassRect(rect), true);
  assert.equal(validGlassRect({ ...rect, left: NaN }), false);
  assert.equal(validGlassRect({ ...rect, width: 0 }), false);
});

test('copy bounds include both controls and padding without allocating a fullscreen texture', () => {
  const regions = [
    { left: 120, top: 530, width: 340, height: 70 },
    { left: 480, top: 535, width: 60, height: 60 },
  ];
  const bounds = glassCaptureBounds(regions, canvas, 1.5, 1200, 900);
  assert.deepEqual(bounds, { x: 135, y: 30, width: 660, height: 135 });
  assert.ok(bounds!.width * bounds!.height < 1200 * 900 / 10);
});

test('framebuffer copies stay within the viewport on narrow screens and invalid geometry', () => {
  const screen = { left: 0, top: 0, width: 320, height: 600 };
  assert.deepEqual(glassCaptureBounds([{ left: 0, top: 550, width: 320, height: 50 }], screen, 1, 320, 600), { x: 0, y: 0, width: 320, height: 60 });
  assert.equal(glassCaptureBounds([], screen, 1, 320, 600), null);
  assert.equal(glassCaptureBounds([{ left: 0, top: 0, width: NaN, height: 60 }], screen, 1, 320, 600), null);
  assert.equal(glassCaptureBounds([{ left: 900, top: 0, width: 10, height: 10 }], screen, 1, 320, 600), null);
  assert.equal(glassCaptureBounds([{ left: 0, top: 0, width: 60, height: 60 }], screen, NaN, 320, 600), null);
});

test('region registration replaces geometry and releases it without per-frame allocations', () => {
  const rect = { left: 40, top: 500, width: 340, height: 70 };
  try {
    setGlassRegion('test-dock', rect);
    assert.equal(getGlassRegions().length, 1);
    assert.equal(getGlassRegions(), getGlassRegions());
    setGlassRegion('test-dock', { ...rect, width: 280 });
    assert.equal(getGlassRegions()[0].width, 280);
    setGlassRegion('test-photo', { ...rect, left: 410, width: 60, height: 60 });
    assert.equal(getGlassRegions().length, 2);
    setGlassRegion('test-dock', null);
    assert.equal(getGlassRegions().length, 1);
  } finally {
    setGlassRegion('test-dock', null);
    setGlassRegion('test-photo', null);
  }
  assert.equal(getGlassRegions().length, 0);
});

test('renderer status only notifies UI on a real mode change', () => {
  setGlassRendererStatus('pending');
  let calls = 0;
  const unsubscribe = subscribeGlassRenderer(() => calls++);
  try {
    setGlassRendererStatus('ready');
    setGlassRendererStatus('ready');
    assert.equal(getGlassRendererStatus(), 'ready');
    assert.equal(calls, 1);
    setGlassRendererStatus('fallback');
    assert.equal(calls, 2);
  } finally {
    unsubscribe();
    setGlassRendererStatus('pending');
  }
});
