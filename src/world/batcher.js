import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Collects static procedural geometry and merges it per (chunk, material) to keep draw calls low.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export function mtx(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

const matCache = new Map();
export function stdMat(color, opts = {}) {
  const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...opts });
  // plain colored materials get baked into vertex colors and share one material (far fewer draw calls)
  m.userData.bake = Object.keys(opts).every((k) => k === 'roughness');
  matCache.set(key, m);
  return m;
}

const BAKED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, flatShading: true });
BAKED.name = 'bakedVertexColor';

export class Batcher {
  constructor(scene, chunk = 48) { this.scene = scene; this.chunk = chunk; this.buckets = new Map(); }

  /** geometry is transformed by parent (Matrix4) then local matrix. */
  add(geo, mat, matrix, opts = {}) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (mat.userData.bake) {
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      mat = BAKED;
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(_p);
    const key = `${Math.floor(c.x / this.chunk)},${Math.floor(c.z / this.chunk)}|${mat.uuid}|${opts.cast === false ? 0 : 1}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { mat, geos: [], cast: opts.cast !== false });
    this.buckets.get(key).geos.push(g);
  }

  finalize() {
    const meshes = [];
    for (const { mat, geos, cast } of this.buckets.values()) {
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh); meshes.push(mesh);
      for (const g of geos) g.dispose();
    }
    this.buckets.clear();
    return meshes;
  }
}

/**
 * Instanced placement of GLB models (all mesh parts of a model share the instance transforms).
 * Instances are grouped per model and per chunk of the ground, so chunks outside the view
 * (and outside the shadow camera) are culled.
 */
export class Instancer {
  constructor(scene, assets, chunk = 48) { this.scene = scene; this.assets = assets; this.chunk = chunk; this.lists = new Map(); }
  add(name, matrix) {
    const e = matrix.elements, key = name + '|' + Math.floor(e[12] / this.chunk) + ',' + Math.floor(e[14] / this.chunk);
    if (!this.lists.has(key)) this.lists.set(key, { name, mats: [] });
    this.lists.get(key).mats.push(matrix);
  }
  finalize() {
    const out = [];
    for (const { name, mats } of this.lists.values()) {
      for (const part of this.assets.parts(name)) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, mats.length);
        const tmp = new THREE.Matrix4();
        mats.forEach((m, i) => im.setMatrixAt(i, tmp.multiplyMatrices(m, part.matrix)));
        im.castShadow = true; im.receiveShadow = true;
        im.computeBoundingSphere();
        this.scene.add(im); out.push(im);
      }
    }
    return out;
  }
}
