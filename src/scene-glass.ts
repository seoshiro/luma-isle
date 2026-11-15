import * as THREE from 'three';
import { glassCaptureBounds, glassRectInCanvas } from './glass-policy';
import { getGlassRegions, setGlassRendererStatus } from './glass-regions';

/** One small live framebuffer copy and one optical draw in the EXISTING renderer. */
export function createSceneGlass(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext();
  // Development-only QA route, never a player setting or a production switch.
  let failed = import.meta.env.DEV && new URLSearchParams(location.search).get('glass') === 'fallback';
  let texture: THREE.FramebufferTexture | null = null;
  let viewportDirty = true;
  let wasActive = false;
  let needsValidation = true;
  let canvasBox = { left: 0, top: 0, width: 1, height: 1 };
  const size = new THREE.Vector2();
  const copyOrigin = new THREE.Vector2();
  const savedScissor = new THREE.Vector4();
  const uniforms = {
    sceneTexture: { value: null as THREE.Texture | null },
    viewportSize: { value: new THREE.Vector2(1, 1) },
    bufferSize: { value: new THREE.Vector2(1, 1) },
    captureRect: { value: new THREE.Vector4() },
    glassRects: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    glassCount: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'Luma single-layer live glass',
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    // The copied framebuffer ALREADY contains the original ACES + sRGB output.
    // No colorspace or tonemapping chunks: encode it a second time and the sky changes.
    fragmentShader: `
      uniform sampler2D sceneTexture;
      uniform vec2 viewportSize;
      uniform vec2 bufferSize;
      uniform vec4 captureRect;
      uniform vec4 glassRects[2];
      uniform int glassCount;
      varying vec2 vUv;
      vec3 sceneAt(vec2 screenUv) {
        vec2 uv = (screenUv * bufferSize - captureRect.xy) / captureRect.zw;
        vec2 halfTexel = .5 / captureRect.zw;
        return texture2D(sceneTexture, clamp(uv, halfTexel, 1. - halfTexel)).rgb;
      }
      void main() {
        vec2 pixel = vUv * viewportSize;
        for (int i = 0; i < 2; i++) {
          if (i >= glassCount) break;
          vec4 rect = glassRects[i];
          vec2 halfSize = rect.zw * .5;
          vec2 local = pixel - rect.xy - halfSize;
          float radius = min(halfSize.x, halfSize.y);
          vec2 q = abs(local) - (halfSize - radius);
          float distanceToEdge = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
          float coverage = 1. - smoothstep(-.65, .65, distanceToEdge);
          if (coverage > 0.) {
            float thickness = min(12., radius * .46);
            float t = clamp(-distanceToEdge / thickness, 0., 1.);
            float bend = sin(t * 3.14159265) * (.84 + .16 * cos(t * 3.14159265));
            vec2 normal = normalize(max(q, 0.) + .0001) * sign(local);
            vec2 uv = vUv - normal * bend * 6.2 / viewportSize;
            vec2 soft = vec2(.72 + bend * .35) / viewportSize;
            vec3 softened = sceneAt(uv) * .6;
            softened += sceneAt(uv + vec2(soft.x, 0.)) * .1;
            softened += sceneAt(uv - vec2(soft.x, 0.)) * .1;
            softened += sceneAt(uv + vec2(0., soft.y)) * .1;
            softened += sceneAt(uv - vec2(0., soft.y)) * .1;
            float luminance = dot(softened, vec3(.2126, .7152, .0722));
            softened = mix(vec3(luminance), softened, 1.035);
            gl_FragColor = vec4(mix(sceneAt(vUv), softened, coverage), 1.);
            return;
          }
        }
        // Not a full-screen recomposite: all other original scene pixels survive.
        discard;
      }
    `,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const composite = new THREE.Scene();
  composite.add(quad);
  const camera = new THREE.Camera();
  const invalidateViewport = () => { viewportDirty = true; };
  window.addEventListener('resize', invalidateViewport);
  window.addEventListener('scroll', invalidateViewport, { passive: true });
  setGlassRendererStatus(failed ? 'fallback' : 'pending');

  function fallback() {
    failed = true;
    texture?.dispose();
    texture = null;
    uniforms.sceneTexture.value = null;
    setGlassRendererStatus('fallback');
  }

  return {
    render(scene: THREE.Scene, sceneCamera: THREE.Camera, enabled: boolean) {
      // Keep the existing render, lighting, AA, shadows and color pipeline intact.
      renderer.render(scene, sceneCamera);
      const regions = getGlassRegions();
      if (!enabled || failed || regions.length === 0) { wasActive = false; return; }
      const autoClear = renderer.autoClear;
      const autoReset = renderer.info.autoReset;
      const scissorTest = renderer.getScissorTest();
      renderer.getScissor(savedScissor);
      const shaderError = renderer.debug.onShaderError;
      const checkShaderErrors = renderer.debug.checkShaderErrors;
      let opticalError: unknown = null;
      try {
        renderer.getDrawingBufferSize(size);
        if (viewportDirty || !wasActive || !size.equals(uniforms.bufferSize.value)) {
          const rect = renderer.domElement.getBoundingClientRect();
          canvasBox = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          uniforms.viewportSize.value.set(Math.max(1, rect.width), Math.max(1, rect.height));
          uniforms.bufferSize.value.copy(size);
          viewportDirty = false;
        }
        const ratio = renderer.getPixelRatio();
        const capture = glassCaptureBounds(regions, canvasBox, ratio, size.x, size.y);
        if (!capture) return;
        if (!texture || texture.image.width !== capture.width || texture.image.height !== capture.height) {
          texture?.dispose();
          texture = new THREE.FramebufferTexture(capture.width, capture.height);
          texture.name = 'Luma live dock region';
          texture.colorSpace = THREE.NoColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          uniforms.sceneTexture.value = texture;
          needsValidation = true;
        }
        copyOrigin.set(capture.x, capture.y);
        renderer.copyFramebufferToTexture(texture, copyOrigin);
        uniforms.captureRect.value.set(capture.x, capture.y, capture.width, capture.height);
        uniforms.glassCount.value = regions.length;
        regions.forEach((rect, i) => uniforms.glassRects.value[i].fromArray(glassRectInCanvas(rect, canvasBox)));
        renderer.autoClear = false;
        renderer.setScissor(capture.x / ratio, capture.y / ratio, capture.width / ratio, capture.height / ratio);
        renderer.setScissorTest(true);
        if (needsValidation) {
          renderer.debug.checkShaderErrors = true;
          renderer.debug.onShaderError = () => { throw new Error('Glass shader is unavailable'); };
        }
        renderer.info.autoReset = false;
        renderer.render(composite, camera);
        if (needsValidation && gl.getError() !== gl.NO_ERROR) throw new Error('Glass framebuffer copy is unavailable');
        needsValidation = false;
        wasActive = true;
        setGlassRendererStatus('ready');
      } catch (error) {
        opticalError = error;
        fallback();
      } finally {
        renderer.autoClear = autoClear;
        renderer.info.autoReset = autoReset;
        renderer.setScissor(savedScissor);
        renderer.setScissorTest(scissorTest);
        renderer.debug.onShaderError = shaderError;
        renderer.debug.checkShaderErrors = checkShaderErrors;
      }
      if (opticalError) {
        // Restore the clean scene if the failed pass touched any pixels.
        if (import.meta.env.DEV) console.warn('LUMA glass uses the matte fallback', opticalError);
        renderer.render(scene, sceneCamera);
      }
    },
    fallback,
    dispose() {
      window.removeEventListener('resize', invalidateViewport);
      window.removeEventListener('scroll', invalidateViewport);
      texture?.dispose();
      quad.geometry.dispose();
      material.dispose();
      uniforms.sceneTexture.value = null;
    },
  };
}
