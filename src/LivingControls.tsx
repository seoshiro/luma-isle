import type { LivingAction, LivingAvailability, LivingPresence } from './living-types';
import type { copy } from './i18n';

export interface LivingControlsProps {
  action: LivingAction;
  secondary: LivingAction | null;
  available: LivingAvailability;
  present: LivingPresence;
  copy: typeof copy.en.living;
  onAction: (action: LivingAction) => void;
  onFocus: (action: LivingAction | null) => void;
}
/** These are accessible handles for the scene's actions, never another game state. */
export function LivingControls({ action, secondary, available, present, copy, onAction, onFocus }: LivingControlsProps) {
  if (!present[action] && !(secondary && present[secondary])) return null;
  const button = (value: LivingAction, secondary = false) => <button key={value} type="button"
    className={`text-button living-button${secondary ? ' living-secondary' : ''}`}
    aria-disabled={!available[value]}
    aria-label={`${copy.actions[value]}${available[value] ? '' : `. ${copy.waiting}`}`}
    onPointerEnter={() => { if (available[value]) onFocus(value); }}
    onPointerLeave={event => { if (document.activeElement !== event.currentTarget) onFocus(null); }}
    onFocus={() => { if (available[value]) onFocus(value); }} onBlur={() => onFocus(null)}
    onClick={() => { if (available[value]) onAction(value); }}>
    <span>{copy.actions[value]}</span>{!available[value] && <small aria-hidden="true">{copy.waiting}</small>}
  </button>;
  return <div className="living-actions" role="group" aria-label={copy.label}>
    {present[action] && button(action)}{secondary && present[secondary] && button(secondary, true)}
  </div>;
}
