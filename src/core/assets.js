import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Loads every GLB once. Static models are later instanced; rigged ones are cloned with SkeletonUtils.
export const MODEL_LIST = [
  'pine-1', 'pine-2', 'pine-3', 'fir-1', 'fir-2', 'palm-1', 'palm-2', 'palm-3',
  'shrub-1', 'shrub-2', 'shrub-3', 'agave', 'croton', 'palmetto', 'hedge',
  'rock-1', 'rock-2', 'rock-3', 'snow-mound-1', 'snow-mound-2', 'lantern', 'car-sedan', 'car-suv',
  'stump', 'fallen-log', 'wood-bundle', 'campfire', 'axe', 'pistol', 'medkit', 'food-can', 'matchbox',
  'water-bottle', 'backpack', 'rabbit', 'duck', 'owl', 'iguana', 'flamingo', 'snowman', 'radio', 'snag',
  'player', 'zombie-a', 'zombie-b', 'deer', 'fox', 'wolf', 'dog',
];

export class Assets {
  constructor() { this.models = {}; this.loader = new GLTFLoader(); this.loader.setMeshoptDecoder(MeshoptDecoder); }

  async loadAll(onProgress) {
    let done = 0;
    await Promise.all(MODEL_LIST.map(async (name) => {
      const gltf = await this.loader.loadAsync(`./assets/models/${name}.glb`);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            m.flatShading = true;
            if (m.name.includes('Glow')) { m.emissiveIntensity = 3; m.toneMapped = false; }
            m.needsUpdate = true;
          }
        }
      });
      this.models[name] = gltf;
      done++; onProgress?.(done / MODEL_LIST.length, name);
    }));
  }

  /** Deep clone including skeletons; returns { root, mixer, actions } for rigged models. */
  rigged(name) {
    const src = this.models[name];
    const root = SkeletonUtils.clone(src.scene);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clip of src.animations) {
      const short = clip.name.includes('|') ? clip.name.split('|').pop() : clip.name;
      if (!actions[short]) actions[short] = mixer.clipAction(clip);
    }
    return { root, mixer, actions };
  }

  /** Height of a (possibly skinned) model in its current pose, in world units. */
  static measure(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); tmp.copy(o.boundingBox); }
      else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox); }
      tmp.applyMatrix4(o.matrixWorld); box.union(tmp);
    });
    return box;
  }

  /** Scale a rigged clone so it stands `height` tall with its feet at y=0. */
  static fitHeight(root, mixer, actions, height, pose = 'Idle') {
    const a = actions[pose] || Object.values(actions)[0];
    if (a) { a.play(); mixer.update(0); }
    const b = Assets.measure(root);
    const s = height / Math.max(1e-6, b.max.y - b.min.y);
    root.scale.multiplyScalar(s);
    const c = b.getCenter(new THREE.Vector3());
    root.position.x -= c.x * s; root.position.z -= c.z * s;
    root.position.y -= b.min.y * s;
    if (a) a.stop();
    return s;
  }

  /** Plain clone sharing geometry & materials. */
  clone(name) { return this.models[name].scene.clone(true); }

  /** Flattened list of {geometry, material, matrix} parts for instancing. */
  parts(name) {
    const out = [];
    const scene = this.models[name].scene;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (o.isMesh) out.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() }); });
    return out;
  }
}
