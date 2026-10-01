import * as THREE from 'three';
import { mulberry32, pointInPoly } from '../core/util.js';
import { PAL } from '../palette.js';
import { asphaltTexture, concreteTexture, paverTexture, sandTexture, lotTexture, rubberTexture, mudTexture } from './textures.js';

// Faceted snow terrain plus flat surface overlays (roads, walks, sand, water).
export const WORLD = { x0: -150, x1: 150, z0: -130, z1: 120 };

// Terrain is a regular grid of faceted triangles. groundHeight() interpolates the exact triangle
// the renderer draws, so feet, footprints and props sit on the visible surface.
const CELL = 3.0;
let HG = null, GNX = 0, GNZ = 0;
const hAt = (i, j) => HG[Math.min(GNX, Math.max(0, i)) * (GNZ + 1) + Math.min(GNZ, Math.max(0, j))];

/** Height of what you stand on: a flat surface overlay (road, walk, mud) where there is one, else the terrain. */
export function groundHeight(x, z) {
  const s = surfaceAt(x, z); if (s) return s.y;
  return terrainHeightAt(x, z);
}
function terrainHeightAt(x, z) {
  if (!HG) return 0;
  const fx = (x - WORLD.x0) / CELL, fz = (z - WORLD.z0) / CELL;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= GNX || j >= GNZ) return 0;
  const u = fx - i, v = fz - j;
  const h00 = hAt(i, j), h10 = hAt(i + 1, j), h11 = hAt(i + 1, j + 1), h01 = hAt(i, j + 1);
  if ((i + j) % 2) {
    return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  return v >= u ? h00 + (h11 - h01) * u + (h01 - h00) * v : h00 + (h10 - h00) * u + (h11 - h10) * v;
}

/**
 * bounds: terrain extent (replaces WORLD). heightAt(x, z): authored height added to the small noise
 * (banks either side of the trail). tintAt(x, z): 0..1 packed-trail tint. roughAt(x, z): 0..1 extra bumpiness (drifts).
 */
export function buildGround(scene, { bounds, waterPolys = [], trailLines = [], darkPolys, heightAt, tintAt, roughAt, colorAt, noise = 1 }) {
  if (bounds) Object.assign(WORLD, bounds);
  const rng = mulberry32(99);
  const cell = CELL;
  const nx = Math.ceil((WORLD.x1 - WORLD.x0) / cell), nz = Math.ceil((WORLD.z1 - WORLD.z0) / cell);
  GNX = nx; GNZ = nz; HG = new Float32Array((nx + 1) * (nz + 1));
  const inWaterV = (x, z) => waterPolys.some((p) => pointInPoly(x, z, p));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const x = WORLD.x0 + i * cell, z = WORLD.z0 + j * cell;
    const r = mulberry32(i * 7919 + j * 104729)();
    let h = (0.04 * Math.sin(x * 0.21 + z * 0.13) * Math.cos(z * 0.17 - x * 0.07) + (r - 0.5) * 0.24 * (1 + 1.5 * (roughAt ? roughAt(x, z) : 0))) * noise;
    // pull snow down under pavement so overlays stay visible
    let paved = false;
    for (const [dx, dz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) { const k = surfaceKindAt(x + dx, z + dz); if (k !== 'snow' && k !== 'sand') { paved = true; break; } }
    if (paved) h = -0.06; else if (surfaceKindAt(x, z) === 'sand') h = h * 0.4;
    else if (heightAt) h += heightAt(x, z);
    if (inWaterV(x, z)) h = -0.9;
    HG[i * (nz + 1) + j] = h;
  }
  const pos = [], col = [];
  const base = new THREE.Color(PAL.snow), shade = new THREE.Color('#dde4f1'), blue = new THREE.Color('#d2dcee'), trail = new THREE.Color('#aab5cb');
  const H = (i, j) => hAt(i, j);
  const inWater = (x, z) => waterPolys.some((p) => pointInPoly(x, z, p));
  const nearTrail = tintAt ? (x, z) => tintAt(x, z) > 0.5 : (x, z) => trailLines.some((l) => distToPolyline(x, z, l) < 1.6);
  const c = new THREE.Color();
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = WORLD.x0 + i * cell, z = WORLD.z0 + j * cell;
    const cx = x + cell / 2, cz = z + cell / 2;
    if (inWater(cx, cz)) continue;
    const v = [[x, H(i, j), z], [x + cell, H(i + 1, j), z], [x + cell, H(i + 1, j + 1), z + cell], [x, H(i, j + 1), z + cell]];
    const tris = ((i + j) % 2) ? [[0, 3, 1], [1, 3, 2]] : [[0, 3, 2], [0, 2, 1]];
    for (const t of tris) {
      const r = rng();
      if (colorAt) { colorAt(cx, cz, r, c); for (const k of t) { pos.push(...v[k]); col.push(c.r, c.g, c.b); } continue; }
      c.copy(base).lerp(r < 0.3 ? shade : blue, r * 0.45);
      if (nearTrail(cx, cz)) c.lerp(trail, 0.72);
      if (darkPolys && darkPolys.some((p) => pointInPoly(cx, cz, p))) c.lerp(new THREE.Color('#c3cbd9'), 0.4);
      for (const k of t) { pos.push(...v[k]); col.push(c.r, c.g, c.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true; mesh.name = 'snowGround'; mesh.userData.noSeeThrough = true;
  scene.add(mesh);
  return mesh;
}

export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    let t = L ? ((x - ax) * dx + (z - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

const surfMats = {};
// Snow dusting on road and walk textures. setSurfaceSnow(0) gives bare surfaces (the opening redesign).
let SURF_SNOW = null;
export function setSurfaceSnow(v) { SURF_SNOW = v; }
function surfMat(kind) {
  if (surfMats[kind]) return surfMats[kind];
  const sn = SURF_SNOW;
  const map = { asphalt: () => asphaltTexture(1, sn ?? 0.55), concrete: () => concreteTexture(2, sn ?? 0.6), paver: () => paverTexture(3, sn ?? 0.5), sand: () => sandTexture(4, sn ?? 0.6), lot: () => lotTexture(7), rubber: () => rubberTexture(6), mud: () => mudTexture(8) }[kind]();
  const m = new THREE.MeshStandardMaterial({ map, roughness: kind === 'mud' ? 0.55 : 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  surfMats[kind] = m;
  return m;
}

/** Registry of walkable surface overlays, used for footprint strength and walking speed. */
export const SURFACES = [];
export function surfaceKindAt(x, z) { return surfaceAt(x, z)?.kind ?? 'snow'; }
function surfaceAt(x, z) {
  for (let i = SURFACES.length - 1; i >= 0; i--) {
    const s = SURFACES[i];
    if (s.poly) { if (x >= s.bx0 && x <= s.bx1 && z >= s.bz0 && z <= s.bz1 && pointInPoly(x, z, s.poly)) return s; continue; }
    const dx = x - s.x, dz = z - s.z, c = Math.cos(s.rot), sn = Math.sin(s.rot);
    const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
    if (Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.d / 2) return s;
  }
  return null;
}

/** Axis-aligned or rotated rectangular surface. repeat = meters per texture tile. */
export function surface(scene, kind, x, z, w, d, rot = 0, y = 0.04, repeat = 8) {
  SURFACES.push({ kind, x, z, w, d, rot, y });
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / repeat, uv.getY(i) * d / repeat);
  const mesh = new THREE.Mesh(g, surfMat(kind));
  mesh.position.set(x, y, z); mesh.rotation.y = rot; mesh.userData.noSeeThrough = true;
  mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  scene.add(mesh);
  return mesh;
}

/** Polygon surface (e.g. beach sand), world-space UVs. */
export function polySurface(scene, kind, poly, y = 0.03, repeat = 10) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  SURFACES.unshift({ kind, poly, y, bx0: Math.min(...xs), bx1: Math.max(...xs), bz0: Math.min(...zs), bz1: Math.max(...zs) });
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / repeat, p.getZ(i) / repeat);
  const mesh = new THREE.Mesh(g, surfMat(kind));
  mesh.position.y = y; mesh.receiveShadow = true; mesh.userData.noSeeThrough = true;
  scene.add(mesh);
  return mesh;
}

/** Animated faceted water: vertex waves in the shader, flat shaded. */
export function water(scene, poly, color = PAL.water, y = -0.35, cell = 2.2) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const w = x1 - x0, d = z1 - z0;
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(d / cell)));
  g.rotateX(-Math.PI / 2);
  const rng = mulberry32(5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) + (rng() - 0.5) * cell * 0.5); p.setZ(i, p.getZ(i) + (rng() - 0.5) * cell * 0.5); }
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.94 });
  const uniforms = { uTime: { value: 0 } };
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = uniforms.uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        transformed.y += 0.09 * sin(wp.x * 0.45 + uTime * 1.1) + 0.07 * cos(wp.z * 0.6 + uTime * 0.8);`);
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  mesh.receiveShadow = true;
  mesh.userData.uniforms = uniforms; mesh.userData.noSeeThrough = true;
  scene.add(mesh);
  return mesh;
}
