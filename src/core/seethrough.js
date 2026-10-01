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
      .replace('#include <common>', `#include <common>
        uniform vec2 uPlayerPx; uniform float uPlayerDepth; uniform float uRadius;
        // 4x4 ordered (Bayer) dither: an even, fine screen with no stripes. (The earlier patterns,
        // mod(x + 2y, 4) and mod(3x + 2y, 5), are diagonal lines: they drew stripes across near canopies.)
        float bayer4(vec2 p) {
          vec2 q = mod(floor(p), 4.0);
          vec4 r = q.y < 1.0 ? vec4(0.0, 8.0, 2.0, 10.0) : q.y < 2.0 ? vec4(12.0, 4.0, 14.0, 6.0) : q.y < 3.0 ? vec4(3.0, 11.0, 1.0, 9.0) : vec4(15.0, 7.0, 13.0, 5.0);
          float v = q.x < 1.0 ? r.x : q.x < 2.0 ? r.y : q.x < 3.0 ? r.z : r.w;
          return (v + 0.5) / 16.0;
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float dpx = distance(gl_FragCoord.xy, uPlayerPx);
          if (vViewPosition.z < uPlayerDepth - 1.2 && dpx < uRadius) {
            float edge = smoothstep(uRadius * 0.55, uRadius, dpx);        // 0 in the middle -> 1 at the rim
            if (bayer4(gl_FragCoord.xy) + 0.06 > edge) discard;
          }
          ${nearFade ? `if (vViewPosition.z < uPlayerDepth - 5.0) {   // only canopies right under the camera (the framing trees further off stay solid)
            float k = clamp((uPlayerDepth - 5.0 - vViewPosition.z) / 3.0, 0.0, 1.0) * 0.9;
            if (bayer4(gl_FragCoord.xy + vec2(1.0, 2.0)) < k) discard;
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
