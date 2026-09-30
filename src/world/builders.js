import * as THREE from 'three';
import { mtx, stdMat } from './batcher.js';
import { PAL } from '../palette.js';
import { roofTexture, plankTexture, signTexture, graffitiTexture, shade } from './textures.js';
import { mulberry32, pick } from '../core/util.js';

// Builders add merged geometry to a Batcher (b) and colliders to Collision (col).
// Local coordinates: +z is the "front" of a structure. A parent matrix positions it in the world.

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const SNOW = () => stdMat(PAL.snow, { roughness: 0.8 });
const DRIFT = new THREE.IcosahedronGeometry(1, 0);

/** place a unit box: center (x,y,z) in local space, size (sx,sy,sz) */
function box(b, P, mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, opts) {
  b.add(BOX, mat, P.clone().multiply(mtx(x, y, z, ry, sx, sy, sz, rx, rz)), opts);
}
function cyl(b, P, mat, x, y, z, r, h, segs = 6, rx = 0, rz = 0, ry = 0) {
  b.add(segs === 8 ? CYL8 : CYL6, mat, P.clone().multiply(mtx(x, y, z, ry, r * 2, h, r * 2, rx, rz)));
}
/** world-space collider for a local box */
function colBox(col, P, x, z, hw, hd, ry = 0, tag) {
  const v = new THREE.Vector3(x, 0, z).applyMatrix4(P);
  const rot = Math.atan2(P.elements[8], P.elements[10]) + ry; // parent yaw
  return col.box(v.x, v.z, hw, hd, rot, tag);
}
export function worldPos(P, x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(P); }
export function yawOf(P) { return Math.atan2(P.elements[8], P.elements[10]); }

// ------------------------------------------------------------------ roofs
function hipRoofGeometry(w, d, rise, flatTop = 0) {
  // w along x, d along z, eaves at y=0, ridge along the longer axis
  const swap = d > w; if (swap) [w, d] = [d, w];
  const hw = w / 2, hd = d / 2, rl = Math.max(0, hw - hd) + flatTop * hd; // ridge half length
  const rz = flatTop * hd * 0.6;
  const E = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]];
  const R = [[-rl, rise, -rz], [rl, rise, -rz], [rl, rise, rz], [-rl, rise, rz]];
  const pos = [], uv = [];
  const slope = Math.hypot(hd - rz, rise);
  const quad = (a, b, c, d2, vA, vB, vC, vD) => { // two triangles
    for (const [p, t] of [[a, vA], [b, vB], [c, vC], [a, vA], [c, vC], [d2, vD]]) { pos.push(...p); uv.push(...t); }
  };
  // front (z+) and back (z-) trapezoids; left/right triangles (or trapezoids when flatTop)
  const U = (x) => x / 5;
  quad(E[3], E[2], R[2], R[3], [U(E[3][0]), 0], [U(E[2][0]), 0], [U(R[2][0]), 1], [U(R[3][0]), 1]);
  quad(E[1], E[0], R[0], R[1], [U(-E[1][0]), 0], [U(-E[0][0]), 0], [U(-R[0][0]), 1], [U(-R[1][0]), 1]);
  quad(E[2], E[1], R[1], R[2], [U(E[2][2]), 0], [U(E[1][2]), 0], [U(R[1][2]), 1], [U(R[2][2]), 1]);
  quad(E[0], E[3], R[3], R[0], [U(-E[0][2]), 0], [U(-E[3][2]), 0], [U(-R[3][2]), 1], [U(-R[0][2]), 1]);
  if (flatTop) quad(R[3], R[2], R[1], R[0], [0, 1], [1, 1], [1, 1], [0, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  if (swap) g.rotateY(Math.PI / 2);
  g.userData = { slope, rl, swap };
  return g;
}

export function roof(b, P, w, d, y, rise, seed, snow = 0.6, flatTop = 0) {
  const g = hipRoofGeometry(w, d, rise, flatTop);
  const mat = stdMat('#ffffff', { map: roofTexture(seed % 4, snow), roughness: 0.85 });
  b.add(g, mat, P.clone().multiply(mtx(0, y, 0)));
  // underside (soffit)
  box(b, P, stdMat(PAL.trim), 0, y - 0.06, 0, w - 0.1, 0.12, d - 0.1);
  // ridge cap
  const rl = g.userData.rl;
  if (rl > 0.1) {
    if (g.userData.swap) box(b, P, stdMat(PAL.tile), 0, y + rise + 0.05, 0, 0.28, 0.16, rl * 2 + 0.2);
    else box(b, P, stdMat(PAL.tile), 0, y + rise + 0.05, 0, rl * 2 + 0.2, 0.16, 0.28);
  }
}

// ------------------------------------------------------------------ house
export function house(b, col, P, o) {
  const rng = mulberry32(o.seed || 1);
  const w = o.w || 11, d = o.d || 9, h = o.h || 3.1;
  const wall = stdMat(o.color || pick(rng, PAL.stucco));
  const trim = stdMat(PAL.trim), glass = stdMat(PAL.window, { roughness: 0.3 }), board = stdMat(PAL.board);
  const dark = stdMat(PAL.metal), snow = SNOW();
  box(b, P, wall, 0, h / 2, 0, w, h, d);
  box(b, P, stdMat(shade(o.color || PAL.stucco[0], 0.8)), 0, 0.18, 0, w + 0.08, 0.36, d + 0.08); // base band
  roof(b, P, w + 1.0, d + 1.0, h, o.rise || (Math.min(w, d) * 0.3), o.seed || 1, o.snow ?? 0.62, o.flatTop || 0);
  const boardedP = o.boarded ?? 0.5;
  const windowAt = (x, z, ry, ww = 1.3, wh = 1.15) => {
    const loc = P.clone().multiply(mtx(x, 0, z, ry));
    box(b, loc, trim, 0, 1.65, 0.02, ww + 0.22, wh + 0.22, 0.08);
    box(b, loc, glass, 0, 1.65, 0.07, ww, wh, 0.06);
    box(b, loc, snow, 0, 1.0, 0.13, ww + 0.25, 0.06, 0.18); // snowy sill
    if (rng() < boardedP) {
      box(b, loc, board, 0, 1.65, 0.12, ww + 0.35, 0.2, 0.05, 0, 0, 0.55);
      box(b, loc, board, 0, 1.65, 0.13, ww + 0.35, 0.2, 0.05, 0, 0, -0.55);
      box(b, loc, board, 0, 1.25, 0.12, ww + 0.3, 0.18, 0.05);
    }
  };
  // front: door + windows (+ garage)
  const garage = o.garage ?? true;
  const doorX = garage ? w * 0.12 : 0;
  box(b, P, stdMat(PAL.door), doorX, 1.08, d / 2 + 0.03, 1.0, 2.16, 0.08);
  box(b, P, trim, doorX, 1.1, d / 2 + 0.01, 1.3, 2.4, 0.04);
  for (const s of [-1, 1]) { // wall lanterns
    box(b, P, dark, doorX + s * 0.9, 2.0, d / 2 + 0.1, 0.16, 0.26, 0.16);
    box(b, P, stdMat('#6b5a3a'), doorX + s * 0.9, 1.98, d / 2 + 0.19, 0.1, 0.16, 0.02);
  }
  box(b, P, stdMat(PAL.concrete), doorX, 0.08, d / 2 + 0.7, 1.8, 0.16, 1.3); // step
  // projecting garage wing with its own roof (L-shaped ranch houses, concept 05)
  const wing = garage && (o.wing ?? rng() < 0.6);
  const wingD = 3.6, gz = wing ? d / 2 + wingD - 1.0 : d / 2;
  if (wing) {
    const wx = -w / 2 + 1.95, wz = d / 2 + wingD / 2 - 1.0;
    box(b, P, wall, wx, h * 0.45, wz, 3.9, h * 0.9, wingD);
    box(b, P, stdMat(shade(o.color || PAL.stucco[0], 0.8)), wx, 0.18, wz, 3.98, 0.36, wingD + 0.08);
    roof(b, P.clone().multiply(mtx(wx, 0, wz)), 4.7, wingD + 0.9, h * 0.9, 1.2, (o.seed || 1) + 3, o.snow ?? 0.62);
    colBox(col, P, wx, wz, 1.97, wingD / 2 + 0.03, 0, 'house');
  }
  if (garage) {
    const gx = -w / 2 + 1.9;
    box(b, P, stdMat(pick(rng, PAL.garage)), gx, 1.15, gz + 0.04, 2.9, 2.3, 0.08);
    for (let i = 1; i < 4; i++) box(b, P, stdMat(shade(PAL.garage[0], 0.75)), gx, 0.1 + i * 0.55, gz + 0.09, 2.85, 0.04, 0.02);
    if (rng() < 0.4) { // boarded garage (concept 05)
      box(b, P, board, gx, 1.2, gz + 0.13, 3.2, 0.22, 0.05, 0, 0, 0.62);
      box(b, P, board, gx, 1.2, gz + 0.14, 3.2, 0.22, 0.05, 0, 0, -0.62);
    }
    windowAt(w * 0.36, d / 2, 0, 1.2, 1.1);
  } else {
    windowAt(-w * 0.3, d / 2, 0); windowAt(w * 0.3, d / 2, 0);
  }
  windowAt(-w / 2, 0, -Math.PI / 2, 1.2, 1.0); windowAt(w / 2, 0, Math.PI / 2, 1.2, 1.0);
  windowAt(-w * 0.25, -d / 2, Math.PI); windowAt(w * 0.25, -d / 2, Math.PI, 1.6, 1.4);
  if (o.porch) { // covered entry with two columns
    const pz = d / 2 + 1.4;
    for (const s of [-1, 1]) cyl(b, P, trim, doorX + s * 1.3, 1.3, pz, 0.14, 2.6, 8);
    box(b, P, trim, doorX, 2.65, d / 2 + 0.8, 3.2, 0.2, 1.8);
    box(b, P, snow, doorX, 2.8, d / 2 + 0.85, 3.3, 0.12, 1.9);
  }
  // AC unit on the side
  if (rng() < 0.6) {
    box(b, P, stdMat('#b8b6b0'), w / 2 + 0.45, 0.45, -d * 0.2, 0.8, 0.8, 0.8);
    box(b, P, snow, w / 2 + 0.45, 0.88, -d * 0.2, 0.84, 0.08, 0.84);
  }
  colBox(col, P, 0, 0, w / 2 + 0.05, d / 2 + 0.05, 0, 'house');
  // snow drifted against the walls
  const drift = (x, z, sx, sz, ry) => b.add(DRIFT, SNOW(), P.clone().multiply(mtx(x, 0.02, z, ry, sx, 0.28 + rng() * 0.12, sz)));
  for (let i = 0; i < 3; i++) drift(-w / 2 + 1 + rng() * (w - 2), -d / 2 - 0.3, 0.7 + rng() * 0.8, 0.45, rng());
  for (const sx of [-1, 1]) drift(sx * (w / 2 + 0.3), -d / 4 + rng() * d / 2, 0.45, 0.7 + rng() * 0.6, rng());
  if (!garage || rng() < 0.5) drift(w / 2 - 0.8, d / 2 + 0.3, 0.8, 0.4, 0.2);
  return { door: worldPos(P, doorX, 0, d / 2 + 1.3), doorX, garage: garage ? worldPos(P, -w / 2 + 1.9, 0, gz + 1.5) : null };
}

// ------------------------------------------------------------------ small props
export function mailbox(b, col, P, color = '#3a3a3c') {
  box(b, P, stdMat(PAL.woodDark), 0, 0.55, 0, 0.1, 1.1, 0.1);
  box(b, P, stdMat(color), 0, 1.15, 0, 0.26, 0.26, 0.5);
  box(b, P, SNOW(), 0, 1.31, 0, 0.3, 0.06, 0.54);
  box(b, P, stdMat('#8a2a22'), 0.14, 1.25, 0.1, 0.02, 0.18, 0.05);
  colBox(col, P, 0, 0, 0.18, 0.28);
}
export function trashBin(b, col, P, tipped = false) {
  const g = stdMat('#3f5a45');
  if (tipped) { box(b, P, g, 0, 0.35, 0, 0.62, 0.62, 1.05, 0, Math.PI / 2); colBox(col, P, 0, 0, 0.35, 0.55); return; }
  box(b, P, g, 0, 0.5, 0, 0.6, 1.0, 0.6); box(b, P, stdMat('#324838'), 0, 1.04, 0, 0.66, 0.08, 0.68);
  box(b, P, SNOW(), 0, 1.11, 0, 0.62, 0.07, 0.62);
  colBox(col, P, 0, 0, 0.34, 0.34);
}
export function bench(b, col, P) {
  const w = stdMat(PAL.woodLight), m = stdMat(PAL.metal);
  for (const s of [-0.75, 0.75]) { box(b, P, m, s, 0.25, 0, 0.08, 0.5, 0.5); box(b, P, m, s, 0.6, -0.22, 0.08, 0.6, 0.06); }
  for (let i = 0; i < 3; i++) box(b, P, w, 0, 0.5, -0.18 + i * 0.16, 1.8, 0.05, 0.13);
  for (let i = 0; i < 2; i++) box(b, P, w, 0, 0.75 + i * 0.18, -0.25, 1.8, 0.12, 0.04);
  box(b, P, SNOW(), 0, 0.55, 0, 1.7, 0.05, 0.42);
  colBox(col, P, 0, 0, 0.95, 0.32);
}
export function picnicTable(b, col, P, snowy = true) {
  const w = stdMat(PAL.woodLight);
  box(b, P, w, 0, 0.75, 0, 1.9, 0.07, 0.8);
  for (const s of [-1, 1]) {
    box(b, P, w, 0, 0.45, s * 0.7, 1.9, 0.06, 0.28);
    box(b, P, w, s * 0.75, 0.38, 0, 0.08, 0.76, 1.6, 0, 0.0, 0);
  }
  if (snowy) { box(b, P, SNOW(), 0, 0.82, 0, 1.8, 0.07, 0.72); box(b, P, SNOW(), 0, 0.5, 0.7, 1.8, 0.05, 0.24); }
  colBox(col, P, 0, 0, 1.0, 0.9);
}
export function crate(b, col, P, s = 0.7, color = PAL.woodLight) {
  const m = stdMat(color), dk = stdMat(shade(color, 0.7));
  box(b, P, m, 0, s / 2, 0, s, s, s);
  box(b, P, dk, 0, s / 2, s / 2 + 0.01, s * 1.02, 0.08, 0.02);
  box(b, P, dk, 0, s / 2, -s / 2 - 0.01, s * 1.02, 0.08, 0.02);
  box(b, P, SNOW(), 0, s + 0.03, 0, s * 0.95, 0.06, s * 0.95);
  colBox(col, P, 0, 0, s / 2 + 0.05, s / 2 + 0.05);
}
export function utilityPole(b, col, P, h = 8.5) {
  const w = stdMat('#6a5240');
  cyl(b, P, w, 0, h / 2, 0, 0.14, h, 6);
  box(b, P, w, 0, h - 0.6, 0, 1.9, 0.12, 0.14);
  box(b, P, stdMat('#6d6d6a'), 0.5, h - 1.2, 0.2, 0.35, 0.5, 0.35);
  col.circle(worldPos(P, 0, 0, 0).x, worldPos(P, 0, 0, 0).z, 0.22);
  return [worldPos(P, -0.85, h - 0.5, 0), worldPos(P, 0.85, h - 0.5, 0)];
}
export function streetSign(b, col, P, text) {
  cyl(b, P, stdMat('#6c7076'), 0, 1.4, 0, 0.04, 2.8, 6);
  const mat = stdMat('#ffffff', { map: signTexture(text, '', '#2f5f3a', '#f3f1ea', 512, 128) });
  b.add(new THREE.PlaneGeometry(1.4, 0.35), mat, P.clone().multiply(mtx(0, 2.7, 0.03)));
  b.add(new THREE.PlaneGeometry(1.4, 0.35), mat, P.clone().multiply(mtx(0, 2.7, -0.03, Math.PI)));
  col.circle(worldPos(P, 0, 0, 0).x, worldPos(P, 0, 0, 0).z, 0.12);
}
export function boardSign(b, col, P, text, sub, color = '#e8e2d0') {
  const w = stdMat(PAL.woodDark);
  for (const s of [-1, 1]) box(b, P, w, s * 1.0, 1.0, 0, 0.14, 2.0, 0.14);
  const mat = stdMat('#ffffff', { map: signTexture(text, sub, color, '#3a2e24') });
  box(b, P, stdMat(PAL.wood), 0, 1.6, 0, 2.3, 1.1, 0.08);
  b.add(new THREE.PlaneGeometry(2.1, 1.0), mat, P.clone().multiply(mtx(0, 1.6, 0.05)));
  b.add(new THREE.PlaneGeometry(2.1, 1.0), mat, P.clone().multiply(mtx(0, 1.6, -0.05, Math.PI)));
  box(b, P, SNOW(), 0, 2.19, 0, 2.35, 0.08, 0.16);
  colBox(col, P, 0, 0, 1.2, 0.15);
}
export function graffiti(b, P, text, w = 3, h = 1.5, color) {
  const mat = stdMat('#ffffff', { map: graffitiTexture(text, color), transparent: true, alphaTest: 0.3 });
  b.add(new THREE.PlaneGeometry(w, h), mat, P, { cast: false });
}

// ------------------------------------------------------------------ fences & walls
/** Low stucco wall with capped pillars (South Florida yard wall). */
export function stuccoWall(b, col, x0, z0, x1, z1, h = 0.9, color = PAL.stucco[0], pillars = true) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const P = mtx((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  const m = stdMat(color), cap = stdMat(shade(color, 1.08));
  box(b, P, m, 0, h / 2, 0, 0.28, h, L);
  box(b, P, SNOW(), 0, h + 0.04, 0, 0.34, 0.08, L);
  if (pillars) {
    const n = Math.max(1, Math.round(L / 3.2));
    for (let i = 0; i <= n; i++) {
      const z = -L / 2 + (L * i) / n;
      box(b, P, m, 0, (h + 0.35) / 2, z, 0.5, h + 0.35, 0.5);
      box(b, P, cap, 0, h + 0.4, z, 0.62, 0.1, 0.62);
      box(b, P, SNOW(), 0, h + 0.5, z, 0.58, 0.12, 0.58);
    }
  }
  const c = colBox(col, P, 0, 0, 0.25, L / 2);
  c.low = true; // does not block line of sight
}
export function woodFence(b, col, x0, z0, x1, z1, h = 1.8, color = PAL.wood) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const P = mtx((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  const m = stdMat(color), dk = stdMat(shade(color, 0.75));
  const n = Math.max(1, Math.round(L / 2.4));
  for (let i = 0; i <= n; i++) {
    const z = -L / 2 + (L * i) / n;
    box(b, P, dk, 0, h / 2 + 0.05, z, 0.14, h + 0.1, 0.14);
    box(b, P, SNOW(), 0, h + 0.13, z, 0.16, 0.06, 0.16);
  }
  box(b, P, m, 0.05, h / 2, 0, 0.06, h * 0.95, L);
  for (let i = 0; i < Math.floor(L / 0.18); i += 3) box(b, P, dk, 0.09, h / 2, -L / 2 + i * 0.18 + 0.09, 0.02, h * 0.95, 0.03);
  box(b, P, SNOW(), 0.05, h + 0.01, 0, 0.1, 0.05, L);
  colBox(col, P, 0, 0, 0.12, L / 2);
}
export function railFence(b, col, x0, z0, x1, z1, h = 1.05, color = PAL.wood) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const P = mtx((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  const m = stdMat(color), dk = stdMat(shade(color, 0.8));
  const n = Math.max(1, Math.round(L / 2.6));
  for (let i = 0; i <= n; i++) {
    const z = -L / 2 + (L * i) / n;
    box(b, P, dk, 0, h / 2, z, 0.16, h, 0.16); box(b, P, SNOW(), 0, h + 0.04, z, 0.2, 0.08, 0.2);
  }
  for (const y of [h * 0.45, h * 0.85]) { box(b, P, m, 0.02, y, 0, 0.08, 0.12, L); box(b, P, SNOW(), 0.02, y + 0.08, 0, 0.1, 0.04, L); }
  const c = colBox(col, P, 0, 0, 0.12, L / 2); c.low = true;
}
export function metalFence(b, col, x0, z0, x1, z1, h = 1.1, color = '#3d4448') {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const P = mtx((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  const m = stdMat(color);
  const n = Math.max(1, Math.round(L / 2.2));
  for (let i = 0; i <= n; i++) box(b, P, m, 0, h / 2 + 0.05, -L / 2 + (L * i) / n, 0.09, h + 0.1, 0.09);
  box(b, P, m, 0, h, 0, 0.05, 0.05, L); box(b, P, m, 0, 0.15, 0, 0.05, 0.05, L);
  for (let z = -L / 2; z < L / 2; z += 0.14) box(b, P, m, 0, h / 2, z, 0.025, h - 0.1, 0.025);
  const c = colBox(col, P, 0, 0, 0.1, L / 2); c.low = true;
}
export function hedgeRow(inst, col, x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(L / 1.9));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    inst.add('hedge', mtx(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, ry + Math.PI / 2, (L / n) / 2 * 1.02, 1, 1));
  }
  const c = col.box((x0 + x1) / 2, (z0 + z1) / 2, 0.5, L / 2, ry); c.low = true;
}

// ------------------------------------------------------------------ playground
export function swingSet(b, col, P) {
  const teal = stdMat('#3f7a78'), red = stdMat('#9a3b30'), chain = stdMat('#6c7076'), seat = stdMat('#2d2d2f');
  for (const s of [-1.9, 1.9]) {
    box(b, P, teal, s, 1.2, 0.7, 0.12, 2.6, 0.12, 0, 0.3);
    box(b, P, teal, s, 1.2, -0.7, 0.12, 2.6, 0.12, 0, -0.3);
  }
  box(b, P, red, 0, 2.45, 0, 4.1, 0.14, 0.14);
  box(b, P, SNOW(), 0, 2.55, 0, 4.0, 0.06, 0.16);
  for (const [x, tilt] of [[-0.8, 0], [0.8, 0.25]]) {
    for (const cz of [-0.18, 0.18]) box(b, P, chain, x, 1.55, cz + tilt * 0.3, 0.02, 1.75, 0.02, 0, tilt);
    box(b, P, seat, x, 0.65, tilt * 0.55, 0.3, 0.05, 0.5);
  }
  colBox(col, P, -1.9, 0, 0.2, 1.0); colBox(col, P, 1.9, 0, 0.2, 1.0);
}
export function slideTower(b, col, P) {
  const post = stdMat('#6b4a33'), teal = stdMat('#3f7a78'), red = stdMat('#9a3b30');
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) box(b, P, post, x, 1.5, z, 0.14, 3.0, 0.14);
  box(b, P, stdMat(PAL.woodLight), 0, 1.4, 0, 1.8, 0.1, 1.8);
  box(b, P, red, 0, 1.85, 0.85, 1.7, 0.7, 0.06); box(b, P, red, -0.85, 1.85, 0, 0.06, 0.7, 1.7);
  roof(b, P, 2.2, 2.2, 3.0, 0.8, 5, 0.9);
  // slide
  box(b, P, teal, 2.2, 0.75, 0, 3.3, 0.08, 0.8, 0, 0, -0.43);
  box(b, P, SNOW(), 2.2, 0.8, 0, 3.2, 0.04, 0.6, 0, 0, -0.43);
  // stairs
  for (let i = 0; i < 6; i++) box(b, P, stdMat(PAL.woodLight), -0.3, 0.2 + i * 0.22, -1.1 - i * 0.2, 0.8, 0.06, 0.25);
  colBox(col, P, 0, 0, 1.0, 1.0); colBox(col, P, 2.2, 0, 1.4, 0.45);
}
export function climbArch(b, col, P) {
  const red = stdMat('#9a3b30');
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI, x = Math.cos(a) * 1.3, y = Math.sin(a) * 1.3;
    box(b, P, red, x, y, 0, 0.1, 0.1, 1.2);
    if (i < 8) {
      const a2 = ((i + 1) / 8) * Math.PI, x2 = Math.cos(a2) * 1.3, y2 = Math.sin(a2) * 1.3;
      const ang = Math.atan2(y2 - y, x2 - x);
      for (const z of [-0.6, 0.6]) box(b, P, red, (x + x2) / 2, (y + y2) / 2, z, 0.55, 0.07, 0.07, 0, 0, ang);
    }
  }
  colBox(col, P, 0, 0, 1.35, 0.65);
}

// ------------------------------------------------------------------ shelter pavilion
export function pavilion(b, col, P) {
  const post = stdMat('#6b4a33'), slab = stdMat(PAL.concrete);
  box(b, P, slab, 0, 0.1, 0, 11.5, 0.2, 8.5);
  box(b, P, slab, 0, 0.05, 5.0, 3.4, 0.1, 1.6); // front steps
  for (const x of [-5, 0, 5]) for (const z of [-3.6, 3.6]) {
    box(b, P, post, x, 1.7, z, 0.32, 3.2, 0.32);
    box(b, P, stdMat(PAL.concrete), x, 0.3, z, 0.5, 0.2, 0.5);
    colBox(col, P, x, z, 0.22, 0.22, 0, 'post');
  }
  for (const z of [-3.6, 3.6]) box(b, P, post, 0, 3.3, z, 10.8, 0.3, 0.24);
  for (const x of [-5, 0, 5]) box(b, P, post, x, 3.3, 0, 0.24, 0.3, 7.5);
  roof(b, P, 12.8, 9.4, 3.45, 2.2, 7, 0.55);
  // tarp wall on the north (back) side — the family's windbreak
  const tarp = stdMat(PAL.canvas, { side: THREE.DoubleSide });
  box(b, P, tarp, -2.5, 1.6, -3.75, 4.8, 2.9, 0.05);
  box(b, P, tarp, 2.5, 1.5, -3.75, 4.8, 2.7, 0.05, 0, 0, 0.02);
  box(b, P, post, 0, 3.05, -3.8, 10.4, 0.06, 0.06);
  colBox(col, P, 0, -3.75, 5.2, 0.1);
}

// ------------------------------------------------------------------ pharmacy
export function pharmacy(b, col, P) {
  const w = 26, d = 16, h = 5.2;
  const wall = stdMat('#d99a82'), trim = stdMat('#efe3cf'), glass = stdMat(PAL.window, { roughness: 0.3 }), board = stdMat(PAL.board);
  box(b, P, wall, 0, h / 2, 0, w, h, d);
  box(b, P, trim, 0, h + 0.3, 0, w + 0.4, 0.6, d + 0.4); // parapet
  box(b, P, SNOW(), 0, h + 0.62, 0, w + 0.2, 0.1, d + 0.2);
  box(b, P, stdMat('#dfe4ec'), 0, h + 0.35, 0, w - 0.6, 0.35, d - 0.6); // snowy roof
  for (const [x, z] of [[-6, -3], [4, 2], [8, -4]]) {
    box(b, P, stdMat('#b8b6b0'), x, h + 1.0, z, 2.0, 1.1, 1.4); box(b, P, SNOW(), x, h + 1.6, z, 2.05, 0.12, 1.45);
  }
  // front canopy
  box(b, P, trim, -2, 3.6, d / 2 + 1.6, 12, 0.35, 3.4);
  box(b, P, SNOW(), -2, 3.83, d / 2 + 1.6, 12, 0.12, 3.4);
  for (const x of [-7.6, 3.6]) { box(b, P, trim, x, 1.8, d / 2 + 3.0, 0.3, 3.6, 0.3); colBox(col, P, x, d / 2 + 3.0, 0.2, 0.2); }
  // doors and windows
  box(b, P, glass, -2, 1.3, d / 2 + 0.04, 3.4, 2.6, 0.06);
  box(b, P, stdMat(PAL.metal), -2, 1.3, d / 2 + 0.07, 0.08, 2.6, 0.04);
  for (const x of [6, 10]) {
    box(b, P, glass, x, 1.8, d / 2 + 0.04, 3.2, 2.0, 0.06);
    box(b, P, board, x, 1.8, d / 2 + 0.1, 3.6, 0.28, 0.06, 0, 0, 0.5);
    box(b, P, board, x, 1.8, d / 2 + 0.11, 3.6, 0.28, 0.06, 0, 0, -0.5);
  }
  box(b, P, glass, -9.5, 1.8, d / 2 + 0.04, 3.2, 2.0, 0.06);
  // sign with a red cross
  const sign = stdMat('#ffffff', { map: signTexture('PELICAN', 'PHARMACY', '#efe3cf', '#9a2f26') });
  b.add(new THREE.PlaneGeometry(6, 1.6), sign, P.clone().multiply(mtx(4, 4.4, d / 2 + 0.06)));
  box(b, P, trim, -10, 4.4, d / 2 + 0.2, 1.4, 1.4, 0.3);
  box(b, P, stdMat('#b8322a'), -10, 4.4, d / 2 + 0.37, 0.9, 0.3, 0.05);
  box(b, P, stdMat('#b8322a'), -10, 4.4, d / 2 + 0.37, 0.3, 0.9, 0.05);
  box(b, P, board, 12.99, 1.4, 3, 0.06, 2.4, 1.2); // side door
  colBox(col, P, 0, 0, w / 2, d / 2, 0, 'building');
  return { door: worldPos(P, -2, 0, d / 2 + 1.2), side: worldPos(P, w / 2 + 1.2, 0, 3) };
}

export function dumpster(b, col, P) {
  const g = stdMat('#3d5a4a');
  box(b, P, g, 0, 0.7, 0, 2.2, 1.4, 1.3);
  box(b, P, stdMat('#2d4439'), 0, 1.45, 0.05, 2.3, 0.12, 1.4, 0, -0.12);
  box(b, P, SNOW(), 0, 1.55, 0.05, 2.2, 0.1, 1.3, 0, -0.12);
  colBox(col, P, 0, 0, 1.15, 0.7);
}
export function bollard(b, col, P) {
  cyl(b, P, stdMat('#c9a13a'), 0, 0.45, 0, 0.12, 0.9, 8);
  cyl(b, P, SNOW(), 0, 0.93, 0, 0.13, 0.06, 8);
  const v = worldPos(P, 0, 0, 0); col.circle(v.x, v.z, 0.16).low = true;
}
export function cart(b, col, P) {
  const m = stdMat('#8a8f96');
  box(b, P, m, 0, 0.75, 0, 0.6, 0.5, 0.9); box(b, P, stdMat(PAL.metal), 0, 0.3, 0, 0.5, 0.05, 0.8);
  for (const [x, z] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) box(b, P, stdMat('#1c1c1e'), x, 0.08, z, 0.06, 0.14, 0.14);
  box(b, P, m, 0, 1.05, -0.5, 0.6, 0.05, 0.05);
  colBox(col, P, 0, 0, 0.35, 0.5).low = true;
}

// ------------------------------------------------------------------ beach & canal
export function lifeguardTower(b, col, P) {
  const wood = stdMat('#cfc4ae'), hut = stdMat('#7fb3c2'), trim = stdMat('#e8e2d0');
  for (const [x, z] of [[-1.3, -1.1], [1.3, -1.1], [1.3, 1.1], [-1.3, 1.1]]) box(b, P, wood, x, 1.1, z, 0.2, 2.2, 0.2);
  box(b, P, wood, 0, 2.25, 0, 3.4, 0.14, 2.8);
  box(b, P, hut, 0, 3.25, -0.2, 2.6, 1.9, 2.0);
  box(b, P, stdMat(PAL.window), 0, 3.4, 0.82, 1.8, 0.8, 0.04);
  box(b, P, trim, 0, 4.3, -0.2, 3.0, 0.18, 2.5);
  box(b, P, SNOW(), 0, 4.42, -0.2, 3.0, 0.1, 2.5);
  box(b, P, wood, 0, 1.1, 2.6, 1.0, 0.1, 3.0, 0, 0.72); // ramp
  box(b, P, wood, 0, 2.6, 1.35, 3.4, 0.08, 0.08);
  cyl(b, P, stdMat(PAL.metalLight), 1.5, 5.0, -1.2, 0.03, 2.0);
  box(b, P, stdMat('#c93a2e'), 1.8, 5.6, -1.2, 0.6, 0.35, 0.02);
  colBox(col, P, 0, 0, 1.5, 1.3);
}
export function duneFence(b, col, x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const P = mtx((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  const m = stdMat('#8a7358');
  for (let z = -L / 2; z <= L / 2; z += 0.22) box(b, P, m, 0, 0.5, z, 0.04, 1.0 + ((z * 7) % 0.2), 0.06, 0, 0, 0.04);
  box(b, P, stdMat('#6b6b6b'), 0, 0.3, 0, 0.02, 0.03, L); box(b, P, stdMat('#6b6b6b'), 0, 0.8, 0, 0.02, 0.03, L);
  const c = colBox(col, P, 0, 0, 0.1, L / 2); c.low = true;
}
export function dock(b, col, P, len = 5, wid = 2.6) {
  const deck = stdMat('#ffffff', { map: plankTexture(8, 0.5, '#7a5a40') });
  box(b, P, deck, 0, 0.35, len / 2, wid, 0.12, len, Math.PI / 2 * 0);
  for (const x of [-wid / 2, wid / 2]) for (let z = 0; z <= len; z += len / 2) {
    cyl(b, P, stdMat('#5e4633'), x, 0.0, z, 0.13, 2.0, 6);
    cyl(b, P, SNOW(), x, 1.02, z, 0.14, 0.08, 6);
  }
}
export function seawall(b, x0, z, x1, h = 0.7) {
  const P = mtx((x0 + x1) / 2, 0, z, 0);
  box(b, P, stdMat('#bdb8ae'), 0, h / 2 - 0.35, 0, x1 - x0, h + 0.7, 0.8);
  box(b, P, SNOW(), 0, h + 0.02, -0.1, x1 - x0, 0.06, 0.6);
}
export function patioSet(b, col, P) {
  const w = stdMat('#8a6a50'), cush = stdMat('#e4e0d6');
  // adirondack chair
  box(b, P, w, -1.2, 0.35, 0, 0.7, 0.08, 0.7, 0, -0.15); box(b, P, w, -1.2, 0.7, -0.35, 0.7, 0.8, 0.08, 0, -0.35);
  box(b, P, SNOW(), -1.2, 0.42, 0, 0.62, 0.05, 0.6, 0, -0.15);
  // deck box
  box(b, P, stdMat('#4a4a4c'), 1.0, 0.35, -0.3, 1.2, 0.7, 0.6); box(b, P, SNOW(), 1.0, 0.73, -0.3, 1.2, 0.08, 0.6);
  // lounger
  box(b, P, w, 0.2, 0.3, 1.4, 0.7, 0.1, 1.9); box(b, P, cush, 0.2, 0.38, 1.4, 0.65, 0.08, 1.8);
  box(b, P, SNOW(), 0.2, 0.44, 1.4, 0.6, 0.06, 1.7);
  colBox(col, P, -1.2, 0, 0.4, 0.4); colBox(col, P, 1.0, -0.3, 0.62, 0.32); colBox(col, P, 0.2, 1.4, 0.38, 0.95);
}
export function woodshed(b, col, P) {
  // open-front woodshed like concept "01-wood-shelter": corrugated roof, stacked log ends
  const post = stdMat('#5e4130'), plank = stdMat('#ffffff', { map: plankTexture(9, 0, '#6b4a33') });
  for (const x of [-3, 0, 3]) { box(b, P, post, x, 1.4, 1.2, 0.2, 2.8, 0.2); box(b, P, post, x, 1.2, -1.2, 0.2, 2.4, 0.2); }
  box(b, P, plank, 0, 1.2, -1.3, 6.4, 2.4, 0.1);
  box(b, P, plank, -3.2, 1.2, 0, 0.1, 2.4, 2.6); box(b, P, plank, 3.2, 1.2, 0, 0.1, 2.4, 2.6);
  box(b, P, stdMat('#7d8288'), 0, 2.75, 0, 7.0, 0.08, 3.4, 0, 0.14);
  box(b, P, SNOW(), 0, 2.85, 0, 6.9, 0.12, 3.3, 0, 0.14);
  const logEnd = stdMat('#c9965f'), bark = stdMat('#5e4130');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
    const x = -2.8 + c * 0.4 + (r % 2) * 0.2; if (x > 2.8) continue;
    const y = 0.2 + r * 0.36;
    b.add(CYL8, bark, P.clone().multiply(mtx(x, y, -0.3, 0, 0.36, 1.6, 0.36, Math.PI / 2)));
    b.add(CYL8, logEnd, P.clone().multiply(mtx(x, y, 0.51, 0, 0.3, 0.02, 0.3, Math.PI / 2)));
  }
  colBox(col, P, 0, -0.2, 3.3, 1.3, 0, 'building');
}
export function tent(b, col, P, color = '#6a7a5a') {
  // two sloped canvas panels (A-frame) along local z
  const m = stdMat(color, { side: THREE.DoubleSide });
  box(b, P, m, -0.62, 0.72, 0, 0.05, 1.7, 2.4, 0, 0, -0.72);
  box(b, P, m, 0.62, 0.72, 0, 0.05, 1.7, 2.4, 0, 0, 0.72);
  box(b, P, SNOW(), 0, 1.42, 0, 0.35, 0.1, 2.3);
  colBox(col, P, 0, 0, 1.2, 1.3);
}

// ------------------------------------------------------------------ set dressing
export function pottedPlant(b, inst, col, P, plant = 'croton', s = 0.55) {
  const pot = stdMat('#b0613d');
  b.add(new THREE.CylinderGeometry(0.26, 0.19, 0.42, 8), pot, P.clone().multiply(mtx(0, 0.21, 0)));
  b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8), stdMat('#c07049'), P.clone().multiply(mtx(0, 0.42, 0)));
  const v = worldPos(P, 0, 0.4, 0);
  inst.add(plant, mtx(v.x, 0.4, v.z, Math.random() * 6, s, s, s));
  col.circle(v.x, v.z, 0.3).low = true;
}
export function bicycle(b, col, P, color = '#8a2f2a') {
  const frame = stdMat(color, { roughness: 0.5, metalness: 0.3 }), tire = stdMat('#1c1c1e');
  const wheel = new THREE.TorusGeometry(0.33, 0.035, 6, 14);
  for (const x of [-0.52, 0.52]) b.add(wheel, tire, P.clone().multiply(mtx(x, 0.35, 0)));
  const bar = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); box(b, P, frame, (x0 + x1) / 2, (y0 + y1) / 2, 0, L, 0.035, 0.035, 0, 0, Math.atan2(y1 - y0, x1 - x0)); };
  bar(-0.52, 0.35, 0, 0.35); bar(0, 0.35, 0.38, 0.78); bar(-0.2, 0.8, 0.38, 0.78); bar(-0.52, 0.35, -0.2, 0.8); bar(0, 0.35, -0.2, 0.8); bar(0.38, 0.78, 0.52, 0.35);
  box(b, P, tire, -0.2, 0.86, 0, 0.22, 0.05, 0.1); box(b, P, frame, 0.42, 0.95, 0, 0.05, 0.05, 0.5);
  box(b, P, SNOW(), -0.2, 0.9, 0, 0.18, 0.03, 0.08);
  colBox(col, P, 0, 0, 0.8, 0.2).low = true;
}
export function frozenPool(b, col, P, w = 6, d = 3.4) {
  const coping = stdMat('#d9d3c7');
  box(b, P, coping, 0, 0.08, -d / 2 - 0.2, w + 0.8, 0.16, 0.4); box(b, P, coping, 0, 0.08, d / 2 + 0.2, w + 0.8, 0.16, 0.4);
  box(b, P, coping, -w / 2 - 0.2, 0.08, 0, 0.4, 0.16, d); box(b, P, coping, w / 2 + 0.2, 0.08, 0, 0.4, 0.16, d);
  box(b, P, stdMat('#9fc6d6', { roughness: 0.25 }), 0, 0.09, 0, w, 0.04, d, 0, 0, 0, { cast: false });
  for (let i = 0; i < 5; i++) box(b, P, SNOW(), -w / 2 + 0.8 + i * 1.1, 0.12, (i % 2 ? 0.6 : -0.8), 0.9 + (i % 3) * 0.3, 0.03, 0.7, i * 0.7, 0, 0, { cast: false });
  for (const s of [-0.25, 0.25]) box(b, P, stdMat('#9a9ea3', { metalness: 0.6, roughness: 0.4 }), w / 2 - 0.5 + s, 0.45, -d / 2 - 0.15, 0.04, 0.8, 0.04);
  colBox(col, P, 0, 0, w / 2 + 0.2, d / 2 + 0.2).low = true; // walkable ice would be fun, but keep players out
}
export function stormDrain(b, P) {
  box(b, P, stdMat('#2a2b2e'), 0, 0.045, 0, 0.9, 0.02, 0.45, 0, 0, 0, { cast: false });
  for (let i = -3; i <= 3; i++) box(b, P, stdMat('#4a4c50'), i * 0.12, 0.055, 0, 0.04, 0.02, 0.42, 0, 0, 0, { cast: false });
}
