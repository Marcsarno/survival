import * as THREE from 'three';

// Screen-space "see-through" circle around the player: fragments of occluders (trees, roofs, walls)
// that are closer to the camera than the player get dithered away inside a soft circle.
// Shadow passes use separate depth materials, so shadows are unaffected.
export const seeThrough = {
  uPlayerPx: { value: new THREE.Vector2(-9999, -9999) },
  uPlayerDepth: { value: 0 },
  uRadius: { value: 120 },
};

const patched = new WeakSet();
/** nearFade: also thin out fragments well in front of Marc (tree canopies between him and the camera). */
export function makeSeeThrough(mat, { nearFade = false } = {}) {
  if (!mat || patched.has(mat) || !mat.isMeshStandardMaterial) return;
  patched.add(mat);
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.() || '';
  mat.onBeforeCompile = (s, r) => {
    prev?.(s, r);
    s.uniforms.uPlayerPx = seeThrough.uPlayerPx;
    s.uniforms.uPlayerDepth = seeThrough.uPlayerDepth;
    s.uniforms.uRadius = seeThrough.uRadius;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uPlayerPx; uniform float uPlayerDepth; uniform float uRadius;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float dpx = distance(gl_FragCoord.xy, uPlayerPx);
          if (vViewPosition.z < uPlayerDepth - 1.2 && dpx < uRadius) {
            float edge = smoothstep(uRadius * 0.55, uRadius, dpx);        // 0 in the middle -> 1 at the rim
            float bayer = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) * 2.0, 4.0) / 4.0;
            if (bayer + 0.12 > edge) discard;
          }
          ${nearFade ? `if (vViewPosition.z < uPlayerDepth - 3.0) {
            float k = clamp((uPlayerDepth - 3.0 - vViewPosition.z) / 6.0, 0.0, 1.0) * 0.75;
            float b2 = mod(floor(gl_FragCoord.x) * 3.0 + floor(gl_FragCoord.y) * 2.0, 5.0) / 5.0;
            if (b2 < k) discard;
          }` : ''}
        }`);
  };
  mat.customProgramCacheKey = () => prevKey + '|seethrough' + (nearFade ? 'N' : '');
  mat.needsUpdate = true;
}

/** Update each frame with the player's pixel position (drawing-buffer pixels) and view depth. */
export function updateSeeThrough(camera, renderer, target) {
  camera.updateMatrixWorld();
  const v = target.clone().project(camera);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  seeThrough.uPlayerPx.value.set((v.x + 1) / 2 * size.x, (v.y + 1) / 2 * size.y);
  const vp = target.clone().applyMatrix4(camera.matrixWorldInverse);
  seeThrough.uPlayerDepth.value = -vp.z;
  seeThrough.uRadius.value = 0.19 * size.y;
}
