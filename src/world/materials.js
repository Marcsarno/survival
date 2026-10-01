import * as THREE from 'three';

// The material library. Kit GLBs (blender/build_kit.py) are exported without images; each mesh's
// material NAME picks its material here, so a texture loads once however many assets use it.
// Textures are Poly Haven CC0 sets in public/assets/textures/<id>/{diff,nor}.webp plus the
// generated foliage atlases in public/assets/textures/foliage/*.webp (tools/optimize-assets.mjs). Vertex colors (tint, grime) multiply.
// repeat: texture repeats per UV unit (Blender UVs are in meters, see blender/kit/common.py).
export const LIB = {
  // stucco: one calm plaster (diff_soft: low contrast) for every house; the color comes from each house's
  // vertex tint (faded cream, sand, pale teal); broad weathering darkens bases and streaks (weather)
  Stucco: { tex: 'white_plaster_rough_01', kind: 'diff_soft', repeat: 0.35, rough: 0.95, color: [1.42, 1.34, 1.2], weather: 1 },
  StuccoWhite: { tex: 'white_plaster_rough_01', kind: 'diff_soft', repeat: 0.35, rough: 0.95, color: [1.45, 1.41, 1.34], weather: 1 },   // (the plaster is mid grey: lift it so tints read as faded cream, sand, teal)
  StuccoPink: { tex: 'white_plaster_rough_01', kind: 'diff_soft', repeat: 0.35, rough: 0.95, color: [1.45, 1.28, 1.2], weather: 1 },
  RoofTile: { tex: 'clay_roof_tiles', kind: 'diff_soft', repeat: 0.45, rough: 0.88, color: [0.95, 0.84, 0.76], normalScale: 0.6 },
  RoofFlat: { tex: 'white_plaster_rough_01', kind: 'diff_soft', repeat: 0.5, rough: 0.95, color: '#a59e92' },
  Trim: { color: '#d9d3c5', rough: 0.75 },
  Wood: { tex: 'weathered_planks', repeat: 0.6, rough: 0.9 },
  WoodGrey: { tex: 'wood_planks_grey', repeat: 0.75, rough: 0.9 },
  WoodOld: { tex: 'old_planks_02', repeat: 0.6, rough: 0.9 },
  Bark: { tex: 'bark_brown_02', repeat: 1.3, rough: 0.95 },
  PalmBark: { tex: 'palm_bark', repeat: [0.8, 1.2], rough: 0.95 },
  MetalGreen: { tex: 'green_metal_rust', repeat: 1.2, rough: 0.6, metal: 0.35 },
  MetalRust: { tex: 'rusty_metal', repeat: 1.0, rough: 0.7, metal: 0.4 },
  Concrete: { tex: 'concrete_pavement', repeat: 0.55, rough: 0.9 },
  ConcreteWorn: { tex: 'white_plaster_rough_01', kind: 'diff_soft', repeat: 0.4, rough: 0.92, color: [0.86, 0.85, 0.82] },
  Fabric: { normalOnly: 'terry_cloth', repeat: 6, rough: 1.0, color: '#ffffff' },   // the Poly Haven cloth is blue: keep only its weave
  // foliage (generated atlases, blender/kit/foliage.py)
  Leaves: { tex: 'foliage/leaves', alpha: true, rough: 0.8, wind: 1, color: [1.08, 1.06, 0.98] },
  LeavesAutumn: { tex: 'foliage/leaves_autumn', alpha: true, rough: 0.8, wind: 1, color: [1.0, 0.96, 0.9] },
  BroadLeaf: { tex: 'foliage/broad', alpha: true, rough: 0.65, wind: 0.5, color: [1.1, 1.1, 1.02] },
  PalmFrond: { tex: 'foliage/frond', alpha: true, rough: 0.75, wind: 1.6, color: [1.08, 1.08, 1.0] },
  FanLeaf: { tex: 'foliage/fan', alpha: true, rough: 0.8, wind: 0.6, color: [1.08, 1.08, 1.0] },
  Grass: { tex: 'foliage/grass', alpha: true, rough: 0.9, wind: 0.8, color: [1.05, 1.05, 1.0] },
  Glass: { color: '#16191c', rough: 0.12, env: 1.4 },
  Paint: { color: '#ffffff', rough: 0.72 },
  Plastic: { color: '#ffffff', rough: 0.5, double: true },
  Rubber: { color: '#1c1c1c', rough: 0.9 },
  Metal: { color: '#8a8a8c', rough: 0.45, metal: 0.7 },
  WindowGlow: { glow: '#ffb468' },
  LampGlow: { glow: '#ffd08a' },
};

const loader = new THREE.TextureLoader();
const texCache = new Map();
export const shared = { time: { value: 0 }, wind: { value: 1 } };
let anisotropy = 4;
export function setAnisotropy(a) { anisotropy = a; }

/** Load a texture once per (path, color space, repeat). (A clone made before the image arrives never uploads, so each repeat is its own load; the browser cache serves the file.) */
export function tex(path, srgb = true, repeat = 1) {
  const r = Array.isArray(repeat) ? repeat : [repeat, repeat];
  const key = path + '|' + srgb + '|' + r.join(',');
  if (!texCache.has(key)) {
    const t = loader.load(path);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.repeat.set(...r);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return texCache.get(key);
}
/** runtime texture path (WebP made by tools/optimize-assets.mjs) */
export const T = (id, kind = 'diff') => (id.startsWith('foliage/') ? `./assets/textures/${id}.webp` : `./assets/textures/${id}/${kind}.webp`);

const matCache = new Map();
/** The shared material for a library name (vertex colors on). */
export function libMaterial(name) {
  if (matCache.has(name)) return matCache.get(name);
  const d = LIB[name];
  if (!d) return null;
  let m;
  if (d.glow) {
    m = new THREE.MeshBasicMaterial({ color: d.glow, toneMapped: false });
    m.userData.glow = true;
  } else {
    const o = { color: Array.isArray(d.color) ? new THREE.Color(...d.color) : (d.color || '#ffffff'), roughness: d.rough ?? 0.85, metalness: d.metal ?? 0, vertexColors: true, envMapIntensity: d.env ?? 1 };
    if (d.normalOnly) o.normalMap = tex(T(d.normalOnly, 'nor'), false, d.repeat ?? 1);
    if (d.tex) {
      o.map = tex(T(d.tex, d.kind || 'diff'), true, d.repeat ?? 1);
      if (!d.alpha) o.normalMap = tex(T(d.tex, 'nor'), false, d.repeat ?? 1);
      if (d.normalScale) o.normalScale = new THREE.Vector2(d.normalScale, d.normalScale);
    }
    if (d.alpha) { o.alphaTest = 0.45; o.side = THREE.DoubleSide; }
    if (d.double) o.side = THREE.DoubleSide;
    m = new THREE.MeshStandardMaterial(o);
    if (d.wind) addWind(m, d.wind);
    if (d.weather) addWeathering(m);
  }
  m.name = name;
  matCache.set(name, m);
  return m;
}

/** Foliage sway: displaces vertices by height above the ground, in world space, with a slow gust. */
export function addWind(m, strength = 1) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.time; s.uniforms.uWind = shared.wind;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          mat4 mw = modelMatrix;
          #ifdef USE_INSTANCING
            mw = modelMatrix * instanceMatrix;
          #endif
          vec4 wp = mw * vec4(transformed, 1.0);
          float h = max(0.0, wp.y - 0.4);
          float gust = 0.6 + 0.4 * sin(uTime * 0.35 + wp.x * 0.05);
          float s = sin(uTime * 1.25 + wp.x * 0.31 + wp.z * 0.23) + 0.45 * sin(uTime * 2.9 + wp.x * 1.7 + wp.y * 1.3);
          vec3 off = vec3(s * 0.016, 0.0, s * 0.011) * h * gust * uWind * ${strength.toFixed(2)};
          transformed += (inverse(mat3(mw)) * off);
        }`);
    // Leaf cards are double-sided and carry custom "clump" normals (out of the canopy, up). three.js flips the
    // normal on back faces, which turned every card seen from behind dark (the speckled, near-black shrubs):
    // keep the authored normal on both sides.
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      #ifdef DOUBLE_SIDED
        normal *= faceDirection; nonPerturbedNormal = normal;
      #endif`);
  };
  m.customProgramCacheKey = () => 'wind' + strength;
}

/** Broad, restrained wear on stucco (world space, so it never repeats with the texture): darker and a
 *  little greener toward the ground, soft vertical rain streaks under the eaves, large faint blotches. */
export function addWeathering(m) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWW = (modelMatrix * wp).xyz;
        }`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWW;
      float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(wh(i), wh(i+vec2(1,0)), f.x), mix(wh(i+vec2(0,1)), wh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float h = vWW.y, u = vWW.x + vWW.z;
          float base = smoothstep(0.0, 0.55, h + (wn(vec2(u * 1.3, 0.0)) - 0.5) * 0.3);           // splash line, uneven (the kit's vertex grime adds to it)
          diffuseColor.rgb *= mix(vec3(0.82, 0.8, 0.72), vec3(1.0), base);
          float streak = wn(vec2(u * 2.6, h * 0.35)) * smoothstep(1.2, 2.6, h) * (0.6 + 0.4 * wn(vec2(u * 0.5, 3.0)));
          diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.45, 0.9, streak);
          diffuseColor.rgb *= 0.95 + 0.08 * wn(vec2(u * 0.25, h * 0.3));
        }`);
  };
  m.customProgramCacheKey = () => 'weather';
}

/** Swap a loaded GLB's materials for library materials by name (images were not exported). */
export function applyLibrary(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    // the Blender exporter writes an empty white COLOR_0 next to ours (COLOR_1): use ours
    const g = o.geometry;
    if (g.attributes.color_1 && !g.userData.colorFixed) { g.setAttribute('color', g.attributes.color_1); g.deleteAttribute('color_1'); g.userData.colorFixed = true; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      const base = (m.name || '').replace(/\.\d+$/, '');
      return libMaterial(base) || m;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
    const mm = out[0];
    o.castShadow = !mm.userData?.glow; o.receiveShadow = true;
  });
}
