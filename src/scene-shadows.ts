import * as THREE from 'three';

export const shadowResolution=(quality:'low'|'medium'|'high')=>quality==='high'?2048:quality==='medium'?1536:1024;

/** Fixed island envelope includes open dome/bridge, garden and all cliff casters.
 * Fitting is scene-bound, never camera-bound, so orbiting cannot make shadows swim.
 */
export function fittedShadowBounds(view:THREE.Matrix4,resolution:number) {
  const corners:THREE.Vector3[]=[];
  for(const x of [-12.8,17.6])for(const y of [-6.1,8])for(const z of [-9,8.5])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(view));
  const box=new THREE.Box3().setFromPoints(corners),padding=.6;
  const width=box.max.x-box.min.x+padding*2,height=box.max.y-box.min.y+padding*2;
  const texelX=width/resolution,texelY=height/resolution;
  const centerX=Math.round((box.max.x+box.min.x)*.5/texelX)*texelX,centerY=Math.round((box.max.y+box.min.y)*.5/texelY)*texelY;
  return {left:centerX-width*.5,right:centerX+width*.5,bottom:centerY-height*.5,top:centerY+height*.5,near:Math.max(.1,-box.max.z-1),far:-box.min.z+1};
}

export function configureIslandShadow(sun:THREE.DirectionalLight,quality:'low'|'medium'|'high') {
  const resolution=shadowResolution(quality),shadow=sun.shadow;
  if(shadow.mapSize.x!==resolution){shadow.map?.dispose();shadow.map=null;shadow.mapPass?.dispose();shadow.mapPass=null;shadow.mapSize.set(resolution,resolution);}
  sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);shadow.updateMatrices(sun);
  Object.assign(shadow.camera,fittedShadowBounds(shadow.camera.matrixWorldInverse,resolution));shadow.camera.updateProjectionMatrix();
  // A fitted ~40-unit depth span needs a small real-world separation at grazing
  // stone/arch faces. Normal offset is about two shadow texels, not a large lift.
  // Keep receivers enabled so roots, feet, paths and buildings retain contact.
  shadow.bias=-.00065;shadow.normalBias=quality==='high'?.045:.06;shadow.radius=2;
  return {resolution,...fittedShadowBounds(shadow.camera.matrixWorldInverse,resolution)};
}
