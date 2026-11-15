import * as THREE from 'three';

/** World-space masonry also survives the UV-less static geometry batches. */
export function createSupportStoneMaterial(color='#baa98b') {
  const material=new THREE.MeshStandardMaterial({color,roughness:.98});
  material.name='Weathered support limestone';
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSupportPoint; varying vec3 vSupportNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvSupportPoint=(modelMatrix*vec4(transformed,1.0)).xyz; vSupportNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader='varying vec3 vSupportPoint; varying vec3 vSupportNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 supportN=abs(normalize(vSupportNormal));
      float supportU=supportN.x>supportN.z?vSupportPoint.z:vSupportPoint.x;
      float supportRow=floor(vSupportPoint.y/.245);
      vec2 supportCell=vec2(supportU/.49+mod(supportRow,2.0)*.5,vSupportPoint.y/.245);
      vec2 supportEdge=min(fract(supportCell),1.0-fract(supportCell));
      float supportJoint=1.0-smoothstep(.012,.032,min(supportEdge.x*.49,supportEdge.y*.245));
      float supportBlock=fract(sin(dot(floor(supportCell),vec2(127.1,311.7)))*43758.5453);
      float supportGrain=sin(vSupportPoint.x*47.0+sin(vSupportPoint.z*31.0))*sin(vSupportPoint.y*61.0+vSupportPoint.z*19.0);
      float supportVertical=1.0-smoothstep(.55,.88,supportN.y);
      diffuseColor.rgb*=1.0+supportVertical*((supportBlock-.5)*.10-supportJoint*.18)+supportGrain*.018;
    `);
  };
  material.customProgramCacheKey=()=> 'luma-supported-limestone-v1';
  return material;
}
