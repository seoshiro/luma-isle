export const INTRO_SECONDS = 2;
export const DISSOLVE_SECONDS = .25;
export const ART_TIMEOUT_MS = 18000;
const clamp = (n:number)=>Math.max(0,Math.min(1,n));
/** Fast early translation, with a zero-velocity landing. */
export function introSample(elapsed:number,reducedMotion:boolean){
 const t=clamp(elapsed/(reducedMotion?DISSOLVE_SECONDS:INTRO_SECONDS));
 return {t,progress:reducedMotion?1:1-Math.pow(1-t,4),fov:reducedMotion?37:37+19*Math.pow(Math.sin(Math.PI*t),1.25),opacity:reducedMotion?t:1,done:t===1};
}
