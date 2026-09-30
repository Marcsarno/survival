import * as THREE from 'three';
import { Batcher, Instancer, mtx, stdMat } from './batcher.js';
import * as B from './builders.js';
import { buildGround, surface, polySurface, surfaceKindAt } from './ground.js';
import { mulberry32, pick, smoothstep } from '../core/util.js';
import { PAL } from '../palette.js';

// The opening route (meters). +x east, -z north. Travel is north, which is up-screen.
//
//   Shelter (pavilion, fire) → wall gap → short dead-end street with four houses → backyard gate
//   → pine woods (pond, old woodshed) → deeper snowy trail → clearing with the house.
//
// Each point is [x, z, w, tw]. w is the walkable half-width: an outer safety limit that always sits
// behind a visible boundary (walls, fences, a dense tree band on a rising bank). tw is the packed-trail
// half-width (0 means pavement or yard). Travel between points is monotonic in z, which atZ() relies on.
export const ROUTE = [
  [-1, 14, 15, 0], [-1, 2, 15, 0], [0, -10, 15, 0],
  [0, -12, 24, 0], [1, -24, 24, 0], [2, -50, 24, 0], [3, -78, 24, 0], [3, -89, 24, 0],
  [3, -93, 5.5, 1.6], [-3, -102, 6, 2.2], [-14, -122, 6.5, 2.2], [-15, -140, 12, 2.2], [-4, -160, 6, 2.2], [8, -180, 9, 2.2], [6, -202, 5.5, 2.0],
  [-6, -222, 4.6, 1.6], [-13, -242, 4.6, 1.5], [-9, -262, 4.6, 1.5], [2, -280, 5, 1.5],
  [9, -293, 11, 1.4], [10, -304, 19, 1.2], [10, -312, 19, 0],
];
export const SECTIONS = [ // by z: first match with z > z1
  { id: 'shelter', name: 'Shelter', z1: -10 },
  { id: 'street', name: 'Neighborhood edge', z1: -90 },
  { id: 'woods', name: 'Woods', z1: -206 },
  { id: 'deep', name: 'Deeper snowy trail', z1: -288 },
  { id: 'house', name: 'The house', z1: -Infinity },
];
export const sectionAt = (z) => SECTIONS.find((s) => z > s.z1);

export const START = { x: -2.4, z: 13.2, yaw: Math.PI }; // by the fire, facing north
export const SHELTER_FIRE = { x: 0, z: 10.5 };
export const HOUSE = { x: 10, z: -321, arrive: { x: 10, z: -313.6, r: 2.6 } };
const CLEARING = { x: 10, z: -310 };
export const GATE = { x0: 1.8, x1: 4.2, z: -90 };
const POND = { x: -23.5, z: -140, r: 6 };
const BOUNDS = { x0: -66, x1: 66, z0: -372, z1: 42 };

// ------------------------------------------------------------------ route geometry
const SEGS = [];
{
  let s = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [ax, az, aw, at] = ROUTE[i], [bx, bz, bw, bt] = ROUTE[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    SEGS.push({ ax, az, bx, bz, aw, bw, at, bt, L, s0: s, dx: (bx - ax) / L, dz: (bz - az) / L });
    s += L;
  }
}
export const ROUTE_LENGTH = SEGS.reduce((a, g) => a + g.L, 0);

/** Nearest point on the centerline: distance d, interpolated widths, arc length s, and the point itself. */
export function nearest(x, z) {
  let best = null, bd = Infinity;
  for (const g of SEGS) {
    let t = ((x - g.ax) * g.dx + (z - g.az) * g.dz) / g.L; t = Math.max(0, Math.min(1, t));
    const px = g.ax + g.dx * g.L * t, pz = g.az + g.dz * g.L * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { d, px, pz, t, g }; }
  }
  const { g, t } = best;
  return { d: bd, px: best.px, pz: best.pz, s: g.s0 + g.L * t, w: g.aw + (g.bw - g.aw) * t, tw: g.at + (g.bt - g.at) * t };
}

/** Point on the centerline at a given z, offset sideways (positive = east of travel). */
export function atZ(z, lateral = 0) {
  const g = SEGS.find((q) => z <= q.az && z >= q.bz) || SEGS[SEGS.length - 1];
  const t = (z - g.az) / (g.bz - g.az || 1);
  return { x: g.ax + (g.bx - g.ax) * t - g.dz * lateral, z: g.az + (g.bz - g.az) * t + g.dx * lateral };
}

/** Keep a circle inside the route corridor. Only reached behind a visible boundary. */
export function clampToRoute(x, z, r) {
  const n = nearest(x, z), lim = n.w - r;
  if (n.d <= lim) return { x, z, hit: false };
  const k = lim / n.d;
  return { x: n.px + (x - n.px) * k, z: n.pz + (z - n.pz) * k, hit: true };
}

// flat pockets inside the banked woods (the pond, the woodshed, the house clearing)
const WOODSHED = atZ(-176, 6.8);
const FLATS = [{ x: POND.x, z: POND.z, r: POND.r + 1 }, { x: WOODSHED.x, z: WOODSHED.z, r: 5 }, { x: CLEARING.x, z: CLEARING.z, r: 17 }];
const wildness = (z) => smoothstep(-91, -101, z) * (1 - 0.7 * smoothstep(-288, -298, z));
/** Authored terrain: the woods trail runs in a shallow valley between rising, tree-covered banks. */
export function terrainHeight(x, z) {
  const wild = wildness(z); if (wild <= 0) return 0;
  const n = nearest(x, z);
  let h = 2.0 * smoothstep(n.tw + 1.6, n.w + 3, n.d) + 1.8 * smoothstep(n.w + 3, n.w + 18, n.d);
  for (const f of FLATS) h *= smoothstep(f.r, f.r + 6, Math.hypot(x - f.x, z - f.z));
  if (n.tw) h -= 0.12 * (1 - smoothstep(n.tw - 0.4, n.tw + 0.5, n.d)); // the packed trail sits a little lower
  return wild * h;
}
const deepness = (z) => smoothstep(-200, -214, z) * (1 - smoothstep(-284, -292, z));

/** Ground type for speed, footprints and step sounds. */
export function groundKind(x, z) {
  const k = surfaceKindAt(x, z);
  if (k !== 'snow') return 'paved';
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r) return 'ice';
  const n = nearest(x, z), deep = deepness(z) > 0.5;
  if (n.tw && n.d < n.tw) return deep ? 'deepTrail' : 'trail';
  return deep ? 'deep' : 'snow';
}

/** Checkpoints for captures and the playtest, and a walkable waypoint list from start to arrival. */
export const ROUTE_TEST = {
  marks: [
    { id: 'shelter', x: START.x, z: START.z, note: 'Shelter: pavilion, fire, low stucco walls. The start.' },
    { id: 'street', x: 1.5, z: -40, note: 'Neighborhood edge: the dead-end street.' },
    { id: 'gate', x: 3, z: -86.5, note: 'The backyard gate into the woods (closed).' },
    { id: 'woods', x: -12, z: -120, note: 'Woods: the trail bends west between banks of pines.' },
    { id: 'pond', x: -18, z: -140, note: 'The frozen pond opens the view to the west.' },
    { id: 'deep', x: -10, z: -232, note: 'Deeper snowy trail: drifts, dead pines, slower going.' },
    { id: 'glimpse', x: 4, z: -287, note: 'First glimpse: warm light ahead through the trees.' },
    { id: 'house', x: 10, z: -301, note: 'The house in its clearing.' },
  ],
  walk: [
    [-4.4, 9.4], [-8, 4], [-8, -5], [-0.3, -9], [0.5, -16], [1.5, -40], [2.8, -70], [3, -87.4, 'interact'], [3, -94],
    [-3, -102], [-14, -122], [-15, -140], [-4, -160], [8, -180], [6, -202], [-6, -222], [-13, -242], [-9, -262], [2, -280], [9, -293], [10, -304], [10, -313],
  ],
};

// ------------------------------------------------------------------ build
export function buildRoute(scene, assets, col) {
  const b = new Batcher(scene), inst = new Instancer(scene, assets);
  const rng = mulberry32(2026);
  const interact = [], animalSpawns = [], lights = [], dynamic = {};
  const blocked = [];
  const free = (x, z, r = 2) => !blocked.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < r + br);
  const block = (x, z, r) => blocked.push([x, z, r]);
  const place = (name, x, z, ry = rng() * Math.PI * 2, s = 1, colR = 0, sink = 0.12) => {
    inst.add(name, mtx(x, terrainHeight(x, z) - sink, z, ry, s, s, s));
    if (colR) col.circle(x, z, colR * s, 'tree');
  };

  // ============================================================ SHELTER
  {
    const P = mtx(0, 0, 2, 0);
    B.pavilion(b, col, P);
    block(0, 2, 8); block(SHELTER_FIRE.x, SHELTER_FIRE.z, 3);
    B.picnicTable(b, col, mtx(-1.6, 0.2, 2.4, 0.05), false);
    for (const [dx, dz, s, c] of [[3.6, -0.6, 0.8, PAL.woodLight], [4.5, -0.3, 0.65, '#4f5a42'], [4.2, 0.6, 0.55, PAL.woodLight], [-4.4, -0.4, 0.7, '#4f5a42']]) B.crate(b, col, mtx(dx, 0.2, dz, 0.2 * dx), s, c);
    const fp = SHELTER_FIRE;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; place('rock-1', fp.x + Math.cos(a) * 1.1, fp.z + Math.sin(a) * 1.1, a, 0.45, 0, 0); }
    const fire = assets.clone('campfire'); fire.position.set(fp.x, 0, fp.z); scene.add(fire); dynamic.fire = fire;
    col.circle(fp.x, fp.z, 1.2, 'fire');
    for (const [dx, dz, ry] of [[-2.6, 0.5, 1.2], [2.6, 0.4, -1.3], [0.3, 2.7, 0.1]]) { place('fallen-log', fp.x + dx, fp.z + dz, ry, 0.75, 0, 0); col.circle(fp.x + dx, fp.z + dz, 0.45).low = true; }
    lights.push({ x: fp.x, y: 1.2, z: fp.z, color: PAL.fireLight, intensity: 30, distance: 17, kind: 'fire' });
    lights.push({ x: 3.2, y: 2.6, z: -0.4, color: PAL.lanternLight, intensity: 16, distance: 12, kind: 'shelterLamp' });
    const lamp = assets.clone('lantern'); lamp.position.set(3.2, 3.0, -0.4); scene.add(lamp);
    // low stucco walls; the only way out is the gap in the north wall
    const wc = PAL.stucco[0];
    B.stuccoWall(b, col, -13, 20, 13, 20, 0.9, wc);
    B.stuccoWall(b, col, -13, 20, -13, -10, 0.9, wc); B.stuccoWall(b, col, 13, 20, 13, -10, 0.9, wc);
    B.stuccoWall(b, col, -13, -10, -1.8, -10, 0.9, wc); B.stuccoWall(b, col, 1.8, -10, 13, -10, 0.9, wc);
    surface(scene, 'concrete', 0, -11.5, 3.2, 3.4, 0, 0.05, 3);
    B.bench(b, col, mtx(-9, 0, 15, 0.4)); B.trashBin(b, col, mtx(10.5, 0, 17.5));
    for (const [x, z] of [[-10.5, 17], [10.8, 13], [-10.8, -6.5], [10.5, -7], [-10, 6], [9.8, 2]]) { place(pick(rng, ['palm-1', 'palm-2', 'palm-3']), x, z, undefined, 1, 0.35); block(x, z, 2); }
    for (const [x, z] of [[-7, 18], [6.5, 18.2], [-11.5, 1], [11.6, -2.5], [-8, -8.5], [8.5, -8.5]]) place(pick(rng, ['shrub-1', 'agave', 'croton', 'palmetto']), x, z, undefined, 0.9, 0.5);
  }

  // ============================================================ NEIGHBORHOOD EDGE
  const car = (x, z, ry, kind, color) => {
    const c = assets.clone(kind === 'suv' ? 'car-suv' : 'car-sedan');
    c.traverse((o) => { if (o.isMesh && o.material.name === 'CarPaint') o.material = paintMat(o.material, color); });
    c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c);
    col.box(x, z, kind === 'suv' ? 2.35 : 2.25, 0.95, ry, 'car'); block(x, z, 3);
    return c;
  };
  {
    surface(scene, 'asphalt', 1.5, -44, 6, 64, 0, 0.04, 9);
    const cul = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; cul.push([2.5 + Math.cos(a) * 8.5, -80 + Math.sin(a) * 8.5]); }
    polySurface(scene, 'asphalt', cul, 0.039, 9);
    for (const s of [-1, 1]) {
      surface(scene, 'concrete', 1.5 + s * 3.8, -42, 1.4, 60, 0, 0.05, 3.6);
      b.add(new THREE.BoxGeometry(1, 1, 1), stdMat('#a9a59d'), mtx(1.5 + s * 3.05, 0.08, -42, 0, 0.3, 0.16, 60));
    }
    // four houses, the last traces of ordinary family life before the woods
    const lot = (x, z, side, o) => { // side -1: west (front faces east), +1: east (front faces west)
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const res = B.house(b, col, mtx(x, 0, z, ry), { w: 11, d: 9, boarded: 0.6, ...o });
      block(x, z, 8);
      const edge = side < 0 ? -2.9 : 5.9;
      if (res.garage) {
        const gx = res.garage.x, L = Math.abs(gx - edge);
        surface(scene, 'paver', (gx + edge) / 2, res.garage.z, L + 1.6, 3.4, 0, 0.046, 3.4);
        res.drive = { x: (gx + edge) / 2, z: res.garage.z };
      }
      const dx = res.door.x, L = Math.abs(dx - edge);
      surface(scene, 'concrete', (dx + edge) / 2, res.door.z, L, 1.4, 0, 0.047, 2);
      B.mailbox(b, col, mtx(edge - side * 0.8, 0, res.door.z + 1.6, side < 0 ? Math.PI / 2 : -Math.PI / 2), pick(rng, ['#3a3a3c', '#5a4a3a', '#2f4a5a']));
      place(pick(rng, ['palm-1', 'palm-2', 'palm-3']), edge - side * 2.2, z + 4.5, undefined, 1, 0.35);
      for (let k = 0; k < 3; k++) place(pick(rng, ['croton', 'agave', 'shrub-1', 'palmetto']), x - side * 5.2, z - 4 + rng() * 8, undefined, 0.8 + rng() * 0.4, 0);
      return res;
    };
    const w1 = lot(-9.8, -30, -1, { seed: 3, garage: true, wing: false });
    const w2 = lot(-9.8, -57, -1, { seed: 5, garage: true, porch: true });
    lot(12.8, -37, 1, { seed: 8, garage: false, porch: true });
    const e2 = lot(12.8, -63, 1, { seed: 11, garage: true });
    if (w1.drive) car(w1.drive.x + 0.5, w1.drive.z, 0.05, 'sedan', '#6d7a88');
    if (e2.drive) car(e2.drive.x - 0.4, e2.drive.z, Math.PI + 0.1, 'suv', '#7a3b36');
    car(3.4, -50, Math.PI / 2 + 0.08, 'sedan', '#556b5a');
    car(-1.5, -83.5, 0.5, 'suv', '#c9c4b8');
    // backyard fences close the street in; the north fence has the gate
    B.woodFence(b, col, -20, -11, -13, -11); B.woodFence(b, col, 13, -11, 23, -11);
    B.woodFence(b, col, -20, -11, -20, -90); B.woodFence(b, col, 23, -11, 23, -90);
    B.woodFence(b, col, -20, -90, GATE.x0 - 0.1, -90); B.woodFence(b, col, GATE.x1 + 0.1, -90, 23, -90);
    B.woodFence(b, col, -20, -43.5, -15.5, -43.5);
    // traces of the kids who lived here
    place('snowman', 7.9, -31, -1.2, 1, 0.45);
    B.swingSet(b, col, mtx(19.5, 0, -50, Math.PI / 2 + 0.1));
    B.bicycle(b, col, mtx(-5.9, 0, -62, 0.2, 1, 1, 1, 0, 0.12), '#2f5f8a');
    for (const [x, z, ry] of [[-4.6, -25.6, 0.5], [-5.2, -24.8, -0.3]]) place('flamingo', x, z, ry, 1, 0, 0);
    B.trashBin(b, col, mtx(-2.6, 0, -46, 0.3), true); B.trashBin(b, col, mtx(5.8, 0, -44, 0));
    const poleTops = [];
    for (const z of [-16, -34, -52, -70]) poleTops.push(B.utilityPole(b, col, mtx(6.5, 0, z, 0)));
    wires(scene, poleTops);
    B.streetSign(b, col, mtx(-2.6, 0, -14, 0), 'DEAD END');
    snowBanks(scene, rng, [[-1.5, -13, -1.5, -71, 1, 0], [4.5, -13, 4.5, -71, -1, 0]]);
    for (let i = 0; i < 10; i++) { const x = -1 + rng() * 5, z = -16 - rng() * 56; if (free(x, z, 1)) place('snow-mound-1', x, z, undefined, 0.5 + rng() * 0.4, 0, 0.05); }
    // behind the backyard fences: overgrowth and the edge of the woods
    for (let i = 0; i < 240; i++) {
      const x = BOUNDS.x0 + rng() * (BOUNDS.x1 - BOUNDS.x0), z = 40 - rng() * 132;
      const inside = (x > -21 && x < 24 && z < -9) || (x > -14.5 && x < 14.5 && z < 21);
      if (inside || !free(x, z, 1.6)) continue;
      const name = z < -60 && rng() < 0.6 ? pick(rng, ['pine-1', 'pine-2', 'fir-1']) : pick(rng, ['palm-1', 'palm-2', 'palm-3', 'shrub-2', 'pine-2', 'croton', 'palmetto']);
      place(name, x, z, undefined, 0.85 + rng() * 0.35, 0); block(x, z, 1.8);
    }
  }

  // ============================================================ THE GATE (route interaction)
  {
    for (const x of [GATE.x0 - 0.1, GATE.x1 + 0.1]) { b.add(new THREE.BoxGeometry(1, 1, 1), stdMat(PAL.woodDark), mtx(x, 1.0, GATE.z, 0, 0.2, 2.0, 0.2)); col.circle(x, GATE.z, 0.14); }
    dynamic.gate = makeGate(scene, col, GATE.x0, GATE.x1, GATE.z);
    interact.push({ id: 'gate', kind: 'gate', x: (GATE.x0 + GATE.x1) / 2, z: GATE.z + 2.2, r: 2.8, label: 'Open the gate' });
  }

  // ============================================================ WOODS AND DEEP TRAIL
  {
    // the frozen pond, a clearing that opens the view to the west
    const ice = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 11), new THREE.MeshStandardMaterial({ color: '#6f95b6', roughness: 0.12, metalness: 0.35, flatShading: true }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(POND.x, 0.04, POND.z); ice.receiveShadow = true; ice.userData.noSeeThrough = true; scene.add(ice);
    block(POND.x, POND.z, POND.r + 1.5);
    for (let i = 0; i < 12; i++) { const a = rng() * Math.PI * 2; place(pick(rng, ['rock-1', 'rock-2']), POND.x + Math.cos(a) * (POND.r + 0.7), POND.z + Math.sin(a) * (POND.r + 0.7), undefined, 0.8, 0.5, 0.05); }
    // an old woodshed beside the trail, long abandoned (unlit)
    const ws = WOODSHED;
    B.woodshed(b, col, mtx(ws.x, 0, ws.z, -Math.PI / 2 + 0.1)); block(ws.x, ws.z, 6);
    place('stump', ws.x - 3.2, ws.z + 2.4, 0.3, 1.2, 0.45, 0);
    // old split-rail fence along stretches of the trail (concept 06)
    for (const [za, zb, side] of [[-104, -118, 1], [-150, -158, -1], [-164, -172, -1], [-186, -198, 1], [-226, -236, 1]]) {
      const a = atZ(za, side * 3.9), c = atZ(zb, side * 3.9);
      B.railFence(b, col, a.x, a.z, c.x, c.z);
    }
    // fallen logs and stumps near the trail; one log half-blocks the deep trail
    for (const [z, lat, ry, s] of [[-110, -3.6, 0.3, 1], [-131, 3.8, 2.1, 1.1], [-168, 3.6, 1.1, 1], [-195, -3.5, 0.2, 1], [-214, 2.8, 1.4, 1], [-249, -1.6, Math.PI / 2 + 0.25, 1.35], [-268, 2.9, 0.6, 1]]) {
      const p = atZ(z, lat); place('fallen-log', p.x, p.z, ry, s, 0, 0.05);
      const dx = Math.sin(ry + Math.PI / 2), dz = Math.cos(ry + Math.PI / 2);
      for (const k of [-0.9, 0, 0.9]) col.circle(p.x + dx * k * s, p.z + dz * k * s, 0.42).low = true;
      block(p.x, p.z, 2);
    }
    // deep-snow drifts along the edges of the deeper trail
    for (let z = -210; z > -290; z -= 3 + rng() * 3) for (const side of [-1, 1]) {
      const p = atZ(z, side * (2.4 + rng() * 2.5)); if (free(p.x, p.z, 1)) place(pick(rng, ['snow-mound-1', 'snow-mound-2']), p.x, p.z, undefined, 0.8 + rng() * 0.7, 0, 0.1);
    }
    // the forest: sparse trunks inside the corridor, a dense band on the banks, thinner beyond
    for (let z = -93; z > BOUNDS.z0; z -= 2.1) for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 2.1) {
      const px = x + (rng() - 0.5) * 1.9, pz = z + (rng() - 0.5) * 1.9;
      const n = nearest(px, pz);
      if (n.d < n.tw + 1.2 || !free(px, pz, 1.2)) continue;
      if (Math.hypot(px - CLEARING.x, pz - CLEARING.z) < 18.5) continue;
      const band = n.d < n.w - 1 ? 0.14 : n.d < n.w + 7 ? 0.88 : n.d < n.w + 15 ? 0.35 : n.d < n.w + 26 ? 0.08 : 0;
      if (rng() > band) continue;
      const deep = deepness(pz), r = rng();
      let name;
      if (deep > 0.5) name = r < 0.5 ? pick(rng, ['fir-1', 'fir-2']) : r < 0.78 ? pick(rng, ['pine-2', 'pine-3']) : r < 0.9 ? 'snag' : pick(rng, ['rock-2', 'rock-3']);
      else name = r < 0.62 ? pick(rng, ['pine-1', 'pine-2', 'pine-3']) : r < 0.86 ? pick(rng, ['fir-1', 'fir-2']) : r < 0.93 ? pick(rng, ['rock-2', 'shrub-3']) : 'stump';
      const rock = name.startsWith('rock'), near = n.d < n.w + 4;
      place(name, px, pz, undefined, (rock ? 0.9 : 0.85) + rng() * 0.4, near ? (rock ? 0.9 : name === 'stump' ? 0.4 : 0.42) : 0, rock ? 0.25 : 0.15);
      block(px, pz, rock ? 1.3 : 1.05);
    }
    for (let i = 0; i < 14; i++) { const p = atZ(-100 - rng() * 190, (rng() < 0.5 ? -1 : 1) * (2.6 + rng() * 3)); if (free(p.x, p.z, 1)) { place('stump', p.x, p.z, undefined, 0.8 + rng() * 0.4, 0.4, 0.05); block(p.x, p.z, 1); } }
    // harmless wildlife for life and scale
    for (const [z, lat] of [[-150, 6.5], [-190, -6.5]]) { const p = atZ(z, lat); animalSpawns.push({ kind: 'deer', x: p.x, z: p.z }); }
    for (const [z, lat] of [[-112, 5], [-166, -5], [-236, 3.5]]) { const p = atZ(z, lat); animalSpawns.push({ kind: 'rabbit', x: p.x, z: p.z }); }
    const f = atZ(-212, 7); animalSpawns.push({ kind: 'fox', x: f.x, z: f.z });
  }

  // ============================================================ THE HOUSE
  {
    const P = mtx(HOUSE.x, 0, HOUSE.z, 0);
    B.house(b, col, P, { w: 12, d: 9, seed: 21, garage: false, porch: true, boarded: 0, color: '#d9c4a0' });
    block(HOUSE.x, HOUSE.z, 9);
    // warm light in the windows and on the porch: the only warm light since the shelter
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffc27a', toneMapped: false });
    for (const dx of [-3.6, 3.6]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 1.1), glowMat); m.position.set(HOUSE.x + dx, 1.65, HOUSE.z + 4.62); m.userData.noSeeThrough = true; scene.add(m);
    }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.96), glowMat); side.rotation.y = Math.PI / 2; side.position.set(HOUSE.x + 6.13, 1.65, HOUSE.z); scene.add(side);
    for (const s of [-1, 1]) {
      const l = assets.clone('lantern'); l.position.set(HOUSE.x + s * 1.3, 0.25, HOUSE.z + 5.95); l.scale.setScalar(1.1); scene.add(l);
      l.traverse((o) => { if (o.isMesh && o.material.name === 'LanternGlow') { o.material = o.material.clone(); o.material.emissiveIntensity = 3; } });
    }
    lights.push({ x: HOUSE.x, y: 1.3, z: HOUSE.z + 6.4, color: PAL.lanternLight, intensity: 14, distance: 11, kind: 'porch' });
    lights.push({ x: HOUSE.x, y: 1.8, z: HOUSE.z + 5.6, color: '#ffb866', intensity: 7, distance: 8, kind: 'window' });
    const glowTex = glowTexture();
    for (const [dx, y, dz, s] of [[-3.6, 1.65, 4.9, 2.4], [3.6, 1.65, 4.9, 2.4], [-1.3, 0.6, 6.1, 1.6], [1.3, 0.6, 6.1, 1.6]]) {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 }));
      g.scale.setScalar(s); g.position.set(HOUSE.x + dx, y, HOUSE.z + dz); scene.add(g);
    }
    surface(scene, 'paver', HOUSE.x, HOUSE.z + 9.2, 1.8, 7, 0, 0.046, 3.4);
    // yard: a picket of wood fence with a broken front rail, a pickup, crates by the porch
    const fz = HOUSE.z + 13, bz = HOUSE.z - 6; // front and back of the yard
    B.woodFence(b, col, -1, fz, -1, bz, 1.3); B.woodFence(b, col, 21, fz, 21, bz, 1.3);
    B.railFence(b, col, -1, fz, 6.5, fz); B.railFence(b, col, 15.5, fz, 21, fz);
    car(17.2, HOUSE.z + 8.5, Math.PI / 2 + 0.35, 'suv', '#4a4f45');
    B.crate(b, col, mtx(HOUSE.x + 4.2, 0, HOUSE.z + 5.6, 0.3), 0.75); B.crate(b, col, mtx(HOUSE.x + 5.0, 0, HOUSE.z + 6.2, 0.9), 0.55, '#4f5a42');
    B.crate(b, col, mtx(HOUSE.x - 4.6, 0, HOUSE.z + 5.8, -0.2), 0.7);
    place('stump', 2.5, HOUSE.z + 9, 0.3, 1.1, 0.4, 0);
    // a ring of trees closes the clearing; the trail enters from the south
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * 14, x = CLEARING.x + Math.cos(a) * r, z = CLEARING.z - 4 + Math.sin(a) * r;
      if (Math.sin(a) > 0.82 || !free(x, z, 1.3)) continue;
      place(pick(rng, ['pine-1', 'pine-2', 'fir-1', 'fir-2']), x, z, undefined, 0.9 + rng() * 0.35, r < 25 ? 0.42 : 0); block(x, z, 1.3);
    }
    interact.push({ id: 'arrive', kind: 'arrive', x: HOUSE.arrive.x, z: HOUSE.arrive.z, r: HOUSE.arrive.r, auto: true });
  }

  trailRibbon(scene);
  const ground = buildGround(scene, {
    bounds: BOUNDS, heightAt: terrainHeight,
    tintAt: (x, z) => { const n = nearest(x, z); return n.tw ? 1 - smoothstep(n.tw - 0.2, n.tw + 0.9, n.d) : 0; },
    roughAt: (x, z) => deepness(z),
  });
  b.finalize();
  inst.finalize();
  return { interact, animalSpawns, lights, dynamic, ground };
}

// ------------------------------------------------------------------ pieces
/** A single-leaf wooden gate hinged at x0 that swings north. Returns { group, collider, open, target }. */
function makeGate(scene, col, x0, x1, z) {
  const g = new THREE.Group(); g.position.set(x0, 0, z);
  const L = x1 - x0;
  const wood = new THREE.MeshStandardMaterial({ color: PAL.woodLight, roughness: 0.9, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: PAL.woodDark, roughness: 0.9, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: PAL.snow, roughness: 0.8, flatShading: true });
  const add = (mat, x, y, zz, sx, sy, sz, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, zz); m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; g.add(m); };
  const n = Math.round(L / 0.2);
  for (let i = 0; i < n; i++) add(wood, 0.1 + i * (L - 0.2) / (n - 1), 0.9, 0, 0.17, 1.65 - (i % 2) * 0.06, 0.05);
  for (const y of [0.35, 1.45]) add(dark, L / 2, y, 0.05, L, 0.12, 0.06);
  add(dark, L / 2, 0.9, 0.06, Math.hypot(L, 1.1), 0.1, 0.05, Math.atan2(1.1, L));
  add(snow, L / 2, 1.76, 0, L, 0.05, 0.1);
  scene.add(g);
  const collider = col.box((x0 + x1) / 2, z, L / 2, 0.12, 0, 'gate');
  return { group: g, collider, open: 0, target: 0 };
}

/** The packed trail: a ribbon along the centerline from the gate to the house, trampled and a shade darker. */
function trailRibbon(scene) {
  const pos = [], uv = [], idx = [];
  let v = 0, len = 0, prev = null;
  for (let z = -91; z >= -312; z -= 1.2) {
    const c = atZ(z), n = nearest(c.x, c.z), hw = Math.max(0.8, n.tw + 0.25);
    if (prev) len += Math.hypot(c.x - prev.x, c.z - prev.z);
    const ahead = atZ(z - 1), dx = ahead.x - c.x, dz = ahead.z - c.z, L = Math.hypot(dx, dz) || 1;
    const rx = -dz / L, rz = dx / L;
    for (const s of [-1, 1]) {
      const x = c.x + rx * hw * s, zz = c.z + rz * hw * s;
      pos.push(x, terrainHeight(x, zz) + 0.035, zz); uv.push(s < 0 ? 0 : 1, len / 3);
    }
    if (prev) idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
    v += 2; prev = c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: trailTexture(), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.userData.noSeeThrough = true; mesh.renderOrder = 1; scene.add(mesh);
}
function trailTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), rng = mulberry32(7);
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(132,146,178,0)'); grad.addColorStop(0.2, 'rgba(132,146,178,0.75)'); grad.addColorStop(0.5, 'rgba(122,136,170,0.9)');
  grad.addColorStop(0.8, 'rgba(132,146,178,0.75)'); grad.addColorStop(1, 'rgba(132,146,178,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 70; i++) { // old, softened boot marks packed into the trail
    g.fillStyle = 'rgba(110,122,152,' + (0.15 + rng() * 0.2) + ')';
    g.beginPath(); g.ellipse(18 + rng() * 28, rng() * 256, 3 + rng() * 2, 6 + rng() * 3, (rng() - 0.5) * 0.5, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Jagged plowed-snow banks along road edges. edges: [x0, z0, x1, z1, inward normal x, z] */
function snowBanks(scene, rng, edges) {
  const pos = [];
  for (const [x0, z0, x1, z1, nx, nz] of edges) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.9);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, ex = x0 + (x1 - x0) * t, ez = z0 + (z1 - z0) * t;
      const d = 0.25 + Math.pow(rng(), 2) * 1.6 + (Math.sin(i * 0.7) > 0.6 ? 0.7 : 0);
      const cur = [ex, ez, ex + nx * d, ez + nz * d];
      if (prev) {
        const y = 0.07;
        pos.push(prev[0], y, prev[1], cur[0], y, cur[1], cur[2], y + 0.01, cur[3]);
        pos.push(prev[0], y, prev[1], cur[2], y + 0.01, cur[3], prev[2], y + 0.01, prev[3]);
      }
      prev = cur;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: '#eef2fa', roughness: 0.85, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.userData.noSeeThrough = true; scene.add(mesh);
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.2, 'rgba(255,190,110,0.7)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const paintCache = new Map();
function paintMat(base, color) {
  if (!paintCache.has(color)) { const m = base.clone(); m.color = new THREE.Color(color); m.name = 'CarPaint_' + color; paintCache.set(color, m); }
  return paintCache.get(color);
}

function wires(scene, tops) {
  const mat = new THREE.LineBasicMaterial({ color: '#2b2b2e' });
  for (let i = 0; i < tops.length - 1; i++) for (const k of [0, 1]) {
    const a = tops[i][k], c = tops[i + 1][k], pts = [];
    for (let t = 0; t <= 1.0001; t += 0.1) { const p = a.clone().lerp(c, t); p.y -= Math.sin(Math.PI * t) * 0.8; pts.push(p); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
}
