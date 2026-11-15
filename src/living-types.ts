import type { Lighting, Quality } from './game';
import type * as THREE from 'three';
export const LIVING_ACTIONS = ['pig','boat','chime','bird','door','ripple'] as const;
export type LivingAction = typeof LIVING_ACTIONS[number];
export type LivingAvailability = Record<LivingAction,boolean>;
export type LivingPresence = Record<LivingAction,boolean>;
export interface LivingEvent { action:LivingAction; cue:'pig'|'boat'|'chime'|'bird'|'door'|'water'; discovery?:'secretDoor' }
export interface LivingOptions { reducedMotion:boolean; quality:Quality; effectiveLighting:Lighting; camera:THREE.Vector3 }
export const noLivingActions = ():LivingAvailability => ({pig:false,boat:false,chime:false,bird:false,door:false,ripple:false});
