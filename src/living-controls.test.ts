import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LivingControls, type LivingControlsProps } from './LivingControls.tsx';
import { copy } from './i18n.ts';
import { noLivingActions } from './living-types.ts';

const props = (): LivingControlsProps => ({ action: 'pig', secondary: 'door', present: noLivingActions(), available: noLivingActions(), copy: copy.en.living, onAction: () => {}, onFocus: () => {} });
test('unsupported geometry has no misleading permanent waiting control', () => {
  const absent = props();
  assert.equal(renderToStaticMarkup(createElement(LivingControls, absent)), '');
  const onlyDoor = renderToStaticMarkup(createElement(LivingControls, { ...absent, present: { ...absent.present, door: true }, available: { ...absent.available, door: true } }));
  assert.match(onlyDoor, /Look behind the island/);
  assert.doesNotMatch(onlyDoor, /Greet the little guardian|In a moment/);
});
test('cooldown is labeled and focusable, but only scene-available controls can act or highlight', () => {
  const base = props(), actions: string[] = [], highlights: (string | null)[] = [];
  const controlProps = { ...base, present: { ...base.present, pig: true }, onAction: (action: string) => actions.push(action), onFocus: (action: string | null) => highlights.push(action) };
  const cooling = LivingControls(controlProps)!;
  const button = cooling.props.children[0];
  assert.equal(button.props['aria-disabled'], true);
  assert.equal(button.props.disabled, undefined, 'temporary cooldown does not drop keyboard focus');
  button.props.onClick(); button.props.onFocus(); button.props.onPointerEnter();
  assert.deepEqual(actions, []); assert.deepEqual(highlights, []);
  const markup = renderToStaticMarkup(cooling);
  assert.match(markup, /aria-label="Greet the little guardian\. In a moment"/);
  const ready = LivingControls({ ...controlProps, available: { ...base.available, pig: true } })!;
  const activeButton = ready.props.children[0];
  activeButton.props.onFocus(); activeButton.props.onClick(); activeButton.props.onBlur();
  assert.deepEqual(actions, ['pig']); assert.deepEqual(highlights, ['pig', null]);
});

test('water exposes an independent keyboard ripple without a boat dependency', () => {
  const base = props();
  const water = LivingControls({ ...base, action: 'boat', secondary: 'ripple', present: { ...base.present, ripple: true }, available: { ...base.available, ripple: true } })!;
  const markup = renderToStaticMarkup(water);
  assert.match(markup, /Touch the water/);
  assert.doesNotMatch(markup, /Launch the paper boat|In a moment/);
  const actions: string[] = [];
  const active = LivingControls({ ...base, action: 'boat', secondary: 'ripple', present: { ...base.present, ripple: true }, available: { ...base.available, ripple: true }, onAction: value => actions.push(value) })!;
  active.props.children[1].props.onClick();
  assert.deepEqual(actions, ['ripple']);
});
