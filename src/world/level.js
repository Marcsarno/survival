import * as THREE from 'three';
import { libMaterial, applyLibrary, tex, shared, T } from './materials.js';
import { mulberry32 } from '../core/util.js';

// The opening, pass 2 (Marc's direction of 2026-09-30): a methodical walk through a Florida canal
// neighborhood at golden hour. Meters; +x east, +z south; the camera always looks north.
//
//   1 the seawall promenade (canal, dock and rowboat, a toppled chair and cooler, a fallen lamp)
//   2 the pump house, then east into the park through a split-rail fence; her small prints in the
//     playground sand; a swing still moving
//   3 north up a leafy lane between a big oak and a house: the bunny by a broken fence
//   4 a locked gate in a privacy fence: try it, then climb it
//   5 the yard: the house top-right, its front facing south-west; lit windows, a figure, "Stay there."
//
// Assets are the Blender kit (public/assets/models/kit, built by blender/build_kit.py) placed here.

// ------------------------------------------------------------------ layout
export const SPAWN = { x: -0.6, z: 9.5, yaw: Math.PI };
export const SEA = [[-3.6, 32], [-3.8, 16], [-3.4, 6], [-2.3, -4], [-0.4, -12], [1.2, -20], [1.8, -30], [1.4, -42], [0.2, -56], [-1.5, -70], [-3, -100]];
const PROM_W = 3.8;                       // promenade width (east of the seawall)
const PUMP = { x: 2.6, z: -30.2 };        // pump house, door facing the promenade
export const PARK = { x0: 8, x1: 31, z0: -24, z1: -54 };
const PARK_GAP = [-25.6, -28.4];          // west rail-fence opening (z range)
const PARK_N_GAP = [16.6, 20.6];          // north rail-fence opening (x range)
export const PLAY = { x: 19.6, z: -38, rx: 5.0, rz: 4.4 };
export const PATH = [[2.4, -25.2], [8.6, -27], [12.6, -30.2], [14.6, -35.2], [13.9, -41], [15.3, -47], [17.8, -52.4], [19.1, -56.5], [20.2, -61.2], [22.2, -66], [23.2, -68.8]];
export const BUNNY = { x: 21.55, z: -61.9 };
export const GATE = { x0: 22.6, x1: 23.8, z: -70.2, h: 1.75 };
export const HOUSE = { x: 33.6, z: -84.6, rot: -Math.PI / 4, w: 12, d: 9 };
const fwd = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };        // the house front faces south-west
const side = { x: Math.SQRT1_2, z: Math.SQRT1_2 };        // the house's local +x (toward the carport, south-east)
const hp = (lx, lf) => ({ x: HOUSE.x + side.x * lx + fwd.x * lf, z: HOUSE.z + side.z * lx + fwd.z * lf });
export const DOOR = hp(-0.3, HOUSE.d / 2 + 0.4);
export const WALK_TO_DOOR = [[24.2, -72.6], hp(-0.3, HOUSE.d / 2 + 2.2)].map((p) => (Array.isArray(p) ? p : [p.x, p.z]));
const BOUNDS = { x0: -48, x1: 54, z0: -104, z1: 36 };

/** Corridor safety net (polyline [x, z, half-width]); visible fences, walls and water sit inside it. */
export const ROUTE = [
  [0.8, 30, 3.6], [0.6, 16, 3.6], [0.9, 4, 3.6], [1.9, -4, 3.5], [3.4, -12, 3.4], [4.6, -20, 3.4], [4.6, -25.5, 3.0],
  [9.5, -27, 3.4], [16, -32, 9], [17, -42, 9.5], [17.5, -50, 6], [19.1, -56.5, 2.6], [20.2, -61.2, 2.6], [22.2, -66, 2.4], [23.2, -69.4, 1.9],
  [23.2, -71.2, 2.2], [26, -75.5, 5.5], [29, -79.5, 5.5],
];

/** Camera and mood by area (first match with z > z1). bias pulls the camera focus toward a point (weight w). */
export const ZONES = [
  { id: 'seawall', name: 'The seawall', z1: -24, zoom: 1.0, fog: 70, bias: { x: -0.5, z: -10, w: 0.12 } },
  { id: 'park', name: 'The park', z1: -54.5, zoom: 1.12, fog: 70, bias: { x: 20, z: -38, w: 0.22 } },
  { id: 'lane', name: 'The lane', z1: -70.2, zoom: 0.95, fog: 60 },
  { id: 'yard', name: 'The house', z1: -Infinity, zoom: 1.18, fog: 70, bias: { x: 33, z: -84, w: 0.3 } },
];
export const zoneAt = (z) => ZONES.find((s) => z > s.z1);

// ------------------------------------------------------------------ geometry helpers
const segs = (pts) => {
  const out = []; let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, aw = 0] = pts[i], [bx, bz, bw = 0] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    out.push({ ax, az, bx, bz, aw, bw, L, s0: s, dx: (bx - ax) / L, dz: (bz - az) / L }); s += L;
  }
  return out;
};
function nearestOn(S, x, z) {
  let best = null, bd = Infinity;
  for (const g of S) {
    let t = ((x - g.ax) * g.dx + (z - g.az) * g.dz) / g.L; t = Math.max(0, Math.min(1, t));
    const px = g.ax + g.dx * g.L * t, pz = g.az + g.dz * g.L * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { d, px, pz, t, g, side: (x - g.ax) * g.dz - (z - g.az) * g.dx }; }
  }
  const { g, t } = best;
  return { ...best, s: g.s0 + g.L * t, w: g.aw + (g.bw - g.aw) * t };
}
const ROUTE_S = segs(ROUTE), SEA_S = segs(SEA), PATH_S = segs(PATH);
export const ROUTE_LENGTH = ROUTE_S.reduce((a, g) => a + g.L, 0);
export const nearest = (x, z) => nearestOn(ROUTE_S, x, z);
export const progressAt = (x, z) => Math.max(0, Math.min(1, nearestOn(ROUTE_S, x, z).s / ROUTE_LENGTH));
/** Signed distance from the seawall's land edge: negative over the water (west of it). */
export const seaDist = (x, z) => { const n = nearestOn(SEA_S, x, z); return n.side < 0 ? n.d : -n.d; };
export function clampToRoute(x, z, r) {
  const n = nearest(x, z), lim = n.w - r;
  if (n.d <= lim) return { x, z, hit: false };
  const k = lim / n.d;
  return { x: n.px + (x - n.px) * k, z: n.pz + (z - n.pz) * k, hit: true };
}
const inEllipse = (x, z, e, grow = 0) => ((x - e.x) / (e.rx + grow)) ** 2 + ((z - e.z) / (e.rz + grow)) ** 2 < 1;
const onProm = (x, z) => { const d = seaDist(x, z); return d > 0 && d < PROM_W && z > -26.2 && z < 30; };
const onWalk = (x, z) => { // the concrete link from the promenade to the park, and the house walk
  const a = distSeg(x, z, 2.4, -25.2, 8.4, -26.9) < 1.15;
  const b = distSeg(x, z, WALK_TO_DOOR[0][0], WALK_TO_DOOR[0][1], WALK_TO_DOOR[1][0], WALK_TO_DOOR[1][1]) < 0.75;
  return a || b;
};
function distSeg(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L ? ((x - ax) * dx + (z - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
/** Surface under (x, z): concrete, sand, leaves (the paths), or grass. Drives footsteps and pace. */
export function groundKind(x, z) {
  if (onProm(x, z) || onWalk(x, z)) return 'concrete';
  if (inEllipse(x, z, PLAY)) return 'sand';
  if (nearestOn(PATH_S, x, z).d < 1.3) return 'leaves';
  return 'grass';
}
export const groundHeight = () => 0;

/** Checkpoints for captures and tests, and a waypoint list for agent walks. */
export const LEVEL_TEST = {
  marks: [
    { id: 'seawall', x: SPAWN.x, z: SPAWN.z, note: 'Start on the seawall promenade: the canal, the dock and rowboat, a toppled chair and cooler.' },
    { id: 'pump', x: 3.6, z: -22, note: 'The pump house at the end of the promenade; the path turns east into the park.' },
    { id: 'park', x: 13.5, z: -33, note: 'The park: the playground, her small prints in the sand, a swing still moving.' },
    { id: 'lane', x: 19.6, z: -57.5, note: 'The leafy lane between the big oak and a house.' },
    { id: 'bunny', x: 20.4, z: -60.4, note: 'The bunny by the broken fence.' },
    { id: 'gate', x: 23.2, z: -68.9, note: 'The locked gate.' },
    { id: 'yard', x: 24.6, z: -73.4, note: 'Over the gate: the house top-right, its front facing south-west.' },
  ],
  walk: [
    [0.9, 2], [1.9, -5], [3.3, -12], [4.4, -19], [4.2, -24.4], [8.6, -27], [12.6, -30.2], [14.6, -35.2], [13.9, -41], [15.3, -47], [17.8, -52.4],
    [19.1, -56.5], [20.3, -60.4, 'bunny'], [22.2, -66], [23.2, -69.1, 'gate'], [23.2, -69.1, 'gate'], [WALK_TO_DOOR[0][0], WALK_TO_DOOR[0][1]], [WALK_TO_DOOR[1][0], WALK_TO_DOOR[1][1]],
  ],
};

// ------------------------------------------------------------------ build
export const KIT = [
  'oak_a', 'oak_b', 'oak_c', 'palm_a', 'palm_b', 'palm_c', 'shrub_a', 'shrub_b', 'shrub_c', 'palmetto_a', 'palmetto_b',
  'house_hostage', 'house_pink', 'house_white', 'house_tan', 'pumphouse', 'stucco_wall', 'fence_privacy', 'fence_privacy_broken', 'fence_rail', 'gate', 'gate_post',
  'swingset', 'swing_seat', 'swing_seat_broken', 'slide', 'tire_tunnel', 'bucket', 'bench', 'cooler', 'dock', 'bunny', 'branch',
  'chair', 'trash_can', 'utility_box', 'picnic_table', 'fern', 'crate', 'duck', 'trashbag', 'stump', 'street_lamp_fallen',
  'stationwagon', 'broken_car', 'van', 'rowboat',
].map((n) => 'kit/' + n);

export function buildLevel(scene, assets, col) {
  const rng = mulberry32(2026);
  // the vehicles keep their own paint: age it (dust, matte)
  for (const n of ['kit/car_white', 'kit/stationwagon', 'kit/broken_car', 'kit/van', 'kit/rowboat']) assets.models[n]?.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) if (!m.userData.aged) { m.userData.aged = true; m.color?.multiply(new THREE.Color(0.86, 0.82, 0.74)); m.roughness = Math.max(m.roughness ?? 0.7, 0.72); m.metalness = Math.min(m.metalness ?? 0, 0.15); }
  });
  const P = new Placer(scene, assets);
  const lights = [], dynamic = {}, interact = [];
  const blocked = [];
  const free = (x, z, r) => !blocked.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < r + br);
  const block = (x, z, r) => blocked.push([x, z, r]);
  const put = (name, x, z, ry = 0, s = 1, colR = 0, y = 0) => { P.add(name, x, y, z, ry, s); if (colR) col.circle(x, z, colR * s, name); block(x, z, Math.max(0.8, colR * s + 0.5)); };
  const putBox = (name, x, z, ry, hw, hd, s = 1, y = 0) => { P.add(name, x, y, z, ry, s); col.box(x, z, hw * s, hd * s, ry, name); block(x, z, Math.max(hw, hd) * s + 0.5); };
  /** a run of modular pieces (length L each, origin at the piece center) along a polyline */
  const run = (name, pts, L, colHalf = 0.12, skip = () => false, yaw0 = 0) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / L));
      const ry = Math.atan2(-(bz - az), bx - ax) + yaw0;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (skip(x, z)) continue;
        P.add(name, x, 0, z, ry, 1, [len / n / L, 1, 1]);
        col.box(x, z, len / n / 2, colHalf, ry); block(x, z, len / n / 2);
      }
    }
  };

  // ============================================================ ground, water, the seawall
  const ground = terrain(scene);
  dynamic.water = water(scene);
  seawall(scene, col, P, run);
  promenade(scene);

  // ============================================================ 1 the seawall promenade
  // backyard fences close the promenade's east side; palms and scrub on the verge in front of them
  run('kit/fence_privacy', [[7.2, 30], [7.2, -22.6]], 2.4, 0.1);
  for (const [x, z, n] of [[5.9, 21, 'palm_a'], [6.1, 7.5, 'palm_b'], [5.6, -6.5, 'palm_c'], [6.4, -16, 'palm_a']]) put('kit/' + n, x, z, rng() * 6.28, 1, 0.3);
  for (const [x, z] of [[6.2, 25], [6, 14.5], [6.5, 2], [6.3, -10.5], [6.6, -20.6]]) put(pick(rng, ['kit/shrub_a', 'kit/shrub_b', 'kit/palmetto_a']), x, z, rng() * 6.28, 0.9 + rng() * 0.3, 0.5);
  houseAt(P, col, block, 'kit/house_tan', 16, 6, -Math.PI / 2);           // backs onto the promenade fence
  houseAt(P, col, block, 'kit/house_white', 15, -14, -Math.PI / 2);
  // the toppled plastic chair and the cooler against the parapet; the fallen street lamp across the verge
  { const c = seaPoint(1.5, 3.2); put('kit/chair', c.x, c.z, 2.3, 1, 0.35, 0); P.tilt('kit/chair', 1.25, 0.2); }
  { const c = seaPoint(0.85, 1.6); put('kit/cooler', c.x, c.z, -0.15, 1, 0.38); }
  put('kit/street_lamp_fallen', 4.3, -1.5, -0.95, 1); col.box(3.3, -1.9, 2.2, 0.18, 0.62);
  put('kit/trashbag', 5.4, 12.6, 1.2, 1, 0.3);
  // the dock and the rowboat out on the canal
  { const d = seaPoint(-0.05, -3.2); P.add('kit/dock', d.x, 0, d.z, -Math.PI / 2 + 0.12, 1); }
  { const b = seaPoint(-5.6, -0.5); dynamic.boat = P.single('kit/rowboat', b.x, -0.62, b.z, 0.2); }
  // the pump house closes the promenade; the path turns east
  putBox('kit/pumphouse', PUMP.x, PUMP.z, 0, 1.75, 1.45);
  put('kit/utility_box', PUMP.x + 2.3, PUMP.z + 1.0, 0, 1, 0.35);
  put('kit/palm_b', 6.6, -31.5, 1, 1.05, 0.3);

  // ============================================================ 2 the park
  // the rail fence, with an opening on the west (from the promenade) and on the north (to the lane)
  run('kit/fence_rail', [[PARK.x0, PARK.z0], [PARK.x0, PARK_GAP[0]]], 3, 0.1);
  run('kit/fence_rail', [[PARK.x0, PARK_GAP[1]], [PARK.x0, PARK.z1]], 3, 0.1);
  run('kit/fence_rail', [[PARK.x0, PARK.z1], [PARK_N_GAP[0], PARK.z1]], 3, 0.1);
  run('kit/fence_rail', [[PARK_N_GAP[1], PARK.z1], [PARK.x1, PARK.z1]], 3, 0.1);
  run('kit/fence_rail', [[PARK.x0, PARK.z0], [PARK.x1, PARK.z0]], 3, 0.1);
  run('kit/fence_privacy', [[PARK.x1, PARK.z0], [PARK.x1, PARK.z1]], 2.4, 0.1);
  // playground
  P.add('kit/swingset', PLAY.x + 0.4, 0, PLAY.z + 4.0, 0, 1); col.circle(PLAY.x - 1.3, PLAY.z + 4.85, 0.12); col.circle(PLAY.x - 1.3, PLAY.z + 3.15, 0.12); col.circle(PLAY.x + 2.1, PLAY.z + 4.85, 0.12); col.circle(PLAY.x + 2.1, PLAY.z + 3.15, 0.12);
  dynamic.swings = [P.single('kit/swing_seat', PLAY.x - 0.4, 2.35, PLAY.z + 4.0, 0), P.single('kit/swing_seat_broken', PLAY.x + 1.2, 2.35, PLAY.z + 4.0, 0)];
  putBox('kit/slide', PLAY.x + 4.4, PLAY.z - 0.4, Math.PI * 0.95, 1.4, 0.5);
  put('kit/tire_tunnel', PLAY.x - 2.6, PLAY.z - 2.6, 0.5, 1, 0.55);
  put('kit/bucket', PLAY.x + 1.2, PLAY.z - 2.4, 0, 1); P.tilt('kit/bucket', 1.4, 0.4);
  put('kit/duck', PLAY.x + 2.6, PLAY.z + 1.6, 2.1, 1);
  putBox('kit/bench', 10.9, -38.4, -Math.PI / 2, 0.85, 0.35);
  put('kit/trash_can', 11.1, -40.6, 0.3, 1, 0.32);
  putBox('kit/picnic_table', 17.6, -27.2, 0.25, 1.0, 0.8);
  put('kit/oak_a', 9.8, -43.2, 0.8, 1, 0.45);
  put('kit/oak_c', 27.6, -49.5, 2.0, 1, 0.5);
  put('kit/oak_b', 26.8, -28.5, 4.1, 0.95, 0.45);
  put('kit/palm_a', 15.2, -24.9, 0.3, 1, 0.3);
  for (const [x, z] of [[9.3, -32], [9.4, -50.5], [29.8, -40], [24.5, -52.6], [12.8, -52.8], [29.5, -26]]) put(pick(rng, ['kit/shrub_a', 'kit/shrub_b', 'kit/shrub_c', 'kit/palmetto_b']), x, z, rng() * 6.28, 0.9 + rng() * 0.4, 0.5);
  houseAt(P, col, block, 'kit/house_pink', 39, -36, -Math.PI / 2);
  P.add('kit/van', 36.4, 0, -25.8, -0.1, 1); col.box(36.4, -25.8, 2.6, 1.1, 0.1);

  // ============================================================ 3 the lane and the bunny
  put('kit/oak_a', 15.2, -60.6, 2.6, 1.15, 0.55);                // the big trunk on the left (concept 02)
  houseAt(P, col, block, 'kit/house_white', 29.2, -60.6, -Math.PI / 2, 'house_white');
  run('kit/fence_privacy_broken', [[22.4, -58.4], [22.3, -64.4]], 2.4, 0.08);
  dynamic.bunny = P.single('kit/bunny', BUNNY.x, 0, BUNNY.z, Math.PI / 2 + 0.35);
  dynamic.bunnyHome = { x: BUNNY.x, z: BUNNY.z, ry: Math.PI / 2 + 0.35 };
  P.single('kit/branch', BUNNY.x - 0.9, 0, BUNNY.z - 0.9, 2.1);
  interact.push({ id: 'bunny', kind: 'bunny', x: BUNNY.x, z: BUNNY.z, r: 2.2, label: 'Pick it up', once: true });
  for (const [x, z, n] of [[17.4, -57.4, 'shrub_b'], [17.6, -64, 'fern'], [18.2, -66.8, 'shrub_a'], [24.1, -57.6, 'palmetto_a'], [16.4, -67.2, 'shrub_c']]) put('kit/' + n, x, z, rng() * 6.28, 1, n === 'fern' ? 0 : 0.5);
  run('kit/fence_privacy', [[11.4, -54.6], [11.4, -70.2]], 2.4, 0.1);

  // ============================================================ 4 the gate
  run('kit/fence_privacy', [[11.4, -70.2], [GATE.x0 - 0.08, -70.2]], 2.4, 0.1);
  run('kit/fence_privacy', [[GATE.x1 + 0.08, -70.2], [34.6, -70.2]], 2.4, 0.1);
  for (const x of [GATE.x0 - 0.04, GATE.x1 + 0.04]) { P.add('kit/gate_post', x, 0, GATE.z, 0, 1); col.circle(x, GATE.z, 0.1); }
  dynamic.gate = P.single('kit/gate', GATE.x0, 0, GATE.z, 0);
  dynamic.gateCollider = col.box((GATE.x0 + GATE.x1) / 2, GATE.z, (GATE.x1 - GATE.x0) / 2, 0.1, 0, 'gate');
  interact.push({ id: 'gate', kind: 'gate', label: 'Open the gate', reach: (p, yaw) => {
    const along = p.x > GATE.x0 + 0.1 && p.x < GATE.x1 - 0.1, d = Math.abs(p.z - GATE.z), sideS = Math.sign(p.z - GATE.z) || 1;
    const facing = Math.cos(yaw) * -sideS;
    return along && d < 1.5 && (d < 0.8 || facing > 0.2) ? d : Infinity;
  } });

  // ============================================================ 5 the yard and the house
  {
    const h = HOUSE;
    P.single('kit/house_hostage', h.x, 0, h.z, h.rot);
    col.box(h.x, h.z, h.w / 2 + 0.1, h.d / 2 + 0.1, h.rot, 'house');
    const cp = hp(6 + 1.75, -0.3); P.add('kit/stationwagon', cp.x, 0, cp.z, h.rot + Math.PI / 2, 1); col.box(cp.x, cp.z, 2.3, 1.0, h.rot + Math.PI / 2);
    for (const lx of [6 + 3.3]) for (const lf of [h.d / 2 + 0.4, 0, -h.d / 2 + 0.4]) { const q = hp(lx, lf); col.circle(q.x, q.z, 0.12); } // carport posts
    for (const s of [-1, 1]) { const q = hp(-0.3 + s * 1.35, h.d / 2 + 1.5); col.circle(q.x, q.z, 0.18); }                      // portico columns
    dynamic.house = P.lastSingle();
    const front = hp(0, h.d / 2);
    lights.push({ ...hp(-3.6, h.d / 2 + 1.0), y: 1.7, color: '#ffae5c', intensity: 5, distance: 7, kind: 'window' });
    lights.push({ ...hp(3.3, h.d / 2 + 1.0), y: 1.7, color: '#ffae5c', intensity: 4, distance: 6, kind: 'window2' });
    lights.push({ ...hp(0.6, h.d / 2 + 0.6), y: 2.0, color: '#ffc27a', intensity: 4, distance: 6, kind: 'porch' });
    dynamic.figure = windowFigure(scene, hp(-3.6, h.d / 2 + 0.032), h.rot);
    dynamic.doorCrack = doorCrack(scene, hp(0.14, h.d / 2 + 0.06), h.rot);
    // the walk to the door, a broken car half-hidden in the side yard, scrub and palms framing the house
    houseAt(P, col, block, 'kit/house_tan', 11, -84, Math.PI / 2);
    run('kit/fence_privacy', [[18.8, -70.2], [18.8, -92]], 2.4, 0.1);
    P.add('kit/broken_car', 20.9, 0, -80.5, 1.45, 1); col.box(20.9, -80.5, 2.2, 1.0, 1.45);
    for (const [x, z, n, s] of [[37.8, -73.2, 'palm_b', 1.05], [25.6, -88.5, 'oak_b', 1], [42, -92, 'oak_c', 1], [20.4, -74.2, 'shrub_b', 1], [26.8, -77.2, 'shrub_a', 0.8], [32.5, -75, 'palmetto_b', 1], [44, -79, 'palm_a', 1], [21, -86.5, 'shrub_c', 1.1]]) put('kit/' + n, x, z, rng() * 6.28, s, n.startsWith('palm_') ? 0.3 : n.startsWith('oak') ? 0.5 : n.startsWith('palmetto') ? 0 : 0.5);
    put('kit/crate', 36.4, -80.2, 0.4, 1, 0.35); put('kit/chair', 31.9, -79.9, -0.6, 1, 0.3);
  }

  // ============================================================ dressing: shrub masses and ground plants hugging the route
  const dress = [
    // promenade verge (east side), between the palms
    [5.6, 18, 'shrub_b', 1.7], [5.4, 10.6, 'shrub_a', 1.5], [5.8, 4.4, 'palmetto_b', 1.2], [5.2, -2.4, 'shrub_c', 1.6], [5.6, -9, 'shrub_b', 1.8], [5.2, -13.2, 'fern', 1.6], [5.9, -18.6, 'shrub_a', 1.6], [4.9, 24, 'palmetto_a', 1.2],
    // around the pump house and the park entrance
    [0.6, -27.4, 'shrub_b', 1.4], [6.2, -24.1, 'palmetto_b', 1.1], [9.6, -24.9, 'shrub_c', 1.5], [9.2, -29.4, 'fern', 1.5],
    // the park: masses along the fences and around the bench
    [9.4, -35.2, 'shrub_b', 1.9], [9.6, -46, 'shrub_a', 1.7], [12.2, -51.8, 'shrub_b', 1.6], [26.4, -52.6, 'shrub_c', 1.8], [29.6, -45, 'shrub_b', 2.0], [29.2, -33.2, 'shrub_a', 1.8], [24.2, -25.4, 'palmetto_b', 1.3], [12.4, -44.6, 'fern', 1.4], [17.2, -45.6, 'palmetto_a', 1.0], [25.4, -45.4, 'fern', 1.4],
    // the lane: close on both sides
    [17.6, -55.2, 'fern', 1.5], [17.2, -62.6, 'shrub_b', 1.6], [18.6, -65.2, 'palmetto_b', 1.2], [24.0, -55.6, 'shrub_a', 1.4], [23.7, -66.6, 'fern', 1.3], [16.9, -68.6, 'shrub_c', 1.6],
    // the yard: foundation shrubs, scrub along the side fence
    [20.0, -72.4, 'shrub_b', 1.6], [19.8, -77.4, 'palmetto_b', 1.3], [30.6, -74.0, 'shrub_a', 1.5], [34.2, -76.6, 'fern', 1.5], [23.3, -79.6, 'shrub_c', 1.4],
  ];
  for (const [x, z, n, s] of dress) if (free(x, z, 0.6)) put('kit/' + n, x, z, rng() * 6.28, s, n === 'fern' || n.startsWith('palmetto') ? 0 : 0.6);
  { const a = hp(-5.4, HOUSE.d / 2 + 0.9), b2 = hp(4.6, HOUSE.d / 2 + 0.9); put('kit/shrub_c', a.x, a.z, 0.3, 1.3, 0.5); put('kit/shrub_a', b2.x, b2.z, 1.3, 1.2, 0.5); }

  // ============================================================ the wider neighborhood and the far bank
  houseAt(P, col, block, 'kit/house_pink', 18, 22, -Math.PI / 2);
  for (let i = 0; i < 46; i++) { // the far bank of the canal: palms, oaks, scrub
    const z = 34 - rng() * 136, x = -31 - rng() * 14;
    put(pick(rng, ['kit/palm_a', 'kit/palm_b', 'kit/oak_b', 'kit/shrub_b', 'kit/oak_c', 'kit/palm_c']), x, z, rng() * 6.28, 0.9 + rng() * 0.3);
  }
  // scatter: trees and scrub everywhere that is land, off the route, off buildings
  for (let z = BOUNDS.z1 - 2; z > BOUNDS.z0 + 2; z -= 3.4) for (let x = 6; x < BOUNDS.x1 - 2; x += 3.4) {
    const px = x + (rng() - 0.5) * 3, pz = z + (rng() - 0.5) * 3;
    const n = nearest(px, pz);
    if (n.d < n.w + 1.4 || !free(px, pz, 1.4) || inEllipse(px, pz, PLAY, 2.5) || seaDist(px, pz) < PROM_W + 1) continue;
    if (px > PARK.x0 && px < PARK.x1 && pz < PARK.z0 && pz > PARK.z1) { if (rng() > 0.12) continue; }
    else if (rng() > 0.45) continue;
    // a tall canopy shows about 7 m up-screen of its trunk: keep canopies off the route
    const cn = nearest(px, pz - 7), tall = cn.d > cn.w + 1.5;
    const r = rng();
    const name = tall && r < 0.3 ? pick(rng, ['kit/oak_a', 'kit/oak_b', 'kit/oak_c']) : tall && r < 0.5 ? pick(rng, ['kit/palm_a', 'kit/palm_b', 'kit/palm_c']) : r < 0.82 ? pick(rng, ['kit/shrub_a', 'kit/shrub_b', 'kit/shrub_c']) : pick(rng, ['kit/palmetto_a', 'kit/palmetto_b']);
    put(name, px, pz, rng() * 6.28, 0.85 + rng() * 0.35, n.d < n.w + 4 ? 0.45 : 0);
  }

  P.finalize();
  return { lights, dynamic, interact, ground };
}

// ------------------------------------------------------------------ pieces
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
/** a point d meters east of the seawall's land edge (negative: out over the water), at about z */
function seaPoint(d, z) {
  const g = SEA_S.find((q) => z <= q.az && z >= q.bz) || SEA_S[0];
  const t = (z - g.az) / (g.bz - g.az || 1), x = g.ax + (g.bx - g.ax) * t;
  return { x: x - g.dz * d, z: z + g.dx * d };   // (-dz, dx) points east, onto the land
}

function houseAt(P, col, block, name, x, z, ry, tag) {
  P.single(name, x, 0, z, ry);
  const w = { 'kit/house_tan': [13, 9], 'kit/house_white': [10, 8], 'kit/house_pink': [11, 8], 'kit/house_hostage': [12, 9] }[name] || [10, 8];
  col.box(x, z, w[0] / 2 + 0.1, w[1] / 2 + 0.1, ry, tag || 'house'); block(x, z, Math.max(...w) / 2 + 1.5);
}

/** Places assets: clones for one-offs, chunked InstancedMeshes for repeated ones. */
class Placer {
  constructor(scene, assets) { this.scene = scene; this.assets = assets; this.items = new Map(); this.singles = []; this._last = null; }
  add(name, x, y, z, ry = 0, s = 1, scaleV = null) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), scaleV ? new THREE.Vector3(...scaleV).multiplyScalar(s) : new THREE.Vector3(s, s, s));
    if (!this.items.has(name)) this.items.set(name, []);
    this.items.get(name).push(m); this._last = { name, m };
    return m;
  }
  /** tilt the last placed instance about its local x (pitch) and z (roll) */
  tilt(name, pitch, roll) { const it = this._last; if (!it || it.name !== name) return; it.m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, 0, roll))); }
  last() { return this._last; }
  /** a separate object (for things that move or change: the gate, the bunny, swings, the house) */
  single(name, x, y, z, ry = 0, s = 1) {
    const o = this.assets.clone(name); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s);
    applyLibrary(o); this.scene.add(o); this.singles.push(o); this._lastSingle = o;
    return o;
  }
  lastSingle() { return this._lastSingle; }
  finalize() {
    const CH = 32;
    for (const [name, list] of this.items) {
      const src = this.assets.clone(name); applyLibrary(src); src.updateMatrixWorld(true);
      const parts = []; src.traverse((o) => { if (o.isMesh) parts.push(o); });
      if (list.length < 3) {
        for (const m of list) { const o = src.clone(); o.matrixAutoUpdate = false; o.matrix.copy(m); this.scene.add(o); }
        continue;
      }
      const chunks = new Map();
      for (const m of list) { const p = new THREE.Vector3().setFromMatrixPosition(m), k = Math.floor(p.x / CH) + ',' + Math.floor(p.z / CH); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(m); }
      for (const ms of chunks.values()) for (const part of parts) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, ms.length);
        ms.forEach((m, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, part.matrixWorld)));
        im.castShadow = part.castShadow; im.receiveShadow = true; im.computeBoundingSphere();
        this.scene.add(im);
      }
    }
  }
}

/** Splat-mapped ground: grass base, leaf-litter paths, playground sand, bare dirt; macro variation. */
function terrain(scene) {
  const W = BOUNDS.x1 - BOUNDS.x0, D = BOUNDS.z1 - BOUNDS.z0, PX = 5;
  const c = document.createElement('canvas'); c.width = Math.round(W * PX); c.height = Math.round(D * PX);
  const g = c.getContext('2d');
  const toC = (x, z) => [(x - BOUNDS.x0) * PX, (BOUNDS.z1 - z) * PX];
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const rng = mulberry32(77);
  // B: bare dirt patches, under trees, along fences and the side yard
  g.globalCompositeOperation = 'lighter';
  const blob = (x, z, r, color, a = 1) => { const [cx, cz] = toC(x, z), gr = g.createRadialGradient(cx, cz, 0, cx, cz, r * PX); gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(cx, cz, r * PX, 0, Math.PI * 2); g.fill(); };
  for (let i = 0; i < 260; i++) blob(BOUNDS.x0 + rng() * W, BOUNDS.z0 + rng() * D, 1.5 + rng() * 4, 'rgba(0,0,255,A)', 0.35 + rng() * 0.4);
  for (const [x, z, r] of [[9.8, -43.2, 4], [15.2, -60.6, 4.5], [27.6, -49.5, 4], [26.8, -28.5, 3.5], [21, -80, 5], [25.6, -88.5, 4], [30, -76, 4]]) blob(x, z, r, 'rgba(0,0,255,A)', 0.9);
  // R: leaf litter along the park path and the lane, and around the big oaks
  const stroke = (pts, w, color) => { g.strokeStyle = color; g.lineWidth = w * PX; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => { const [cx, cz] = toC(x, z); i ? g.lineTo(cx, cz) : g.moveTo(cx, cz); }); g.stroke(); };
  g.filter = 'blur(6px)';
  stroke(PATH.slice(1), 2.4, 'rgba(255,0,0,0.95)');
  stroke([[23.2, -70.6], [24.4, -72.6], [27, -76]], 2.6, 'rgba(255,0,0,0.7)');
  for (const [x, z, r] of [[15.2, -60.6, 5.5], [9.8, -43.2, 4.5], [21.5, -63, 3.5]]) blob(x, z, r, 'rgba(255,0,0,A)', 0.8);
  // G: playground sand
  g.fillStyle = 'rgba(0,255,0,1)'; const [px, pz] = toC(PLAY.x, PLAY.z); g.beginPath(); g.ellipse(px, pz, PLAY.rx * PX, PLAY.rz * PX, 0, 0, Math.PI * 2); g.fill();
  g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  const mask = new THREE.CanvasTexture(c); mask.colorSpace = THREE.NoColorSpace; mask.flipY = false;

  const seg = 1.0, nx = Math.round(W / seg), nz = Math.round(D / seg);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate(BOUNDS.x0 + W / 2, 0, BOUNDS.z0 + D / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), sd = seaDist(x, z);
    let y = 0.02 * Math.sin(x * 0.3) * Math.cos(z * 0.25);
    if (sd < -0.3 && x > -30) y = -2.4;            // canal bed
    if (x <= -30) y = 0.15;                         // far bank
    if (sd < 0 && x > -30 && x < -29) y = -1.0;
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const uni = {
    tGrass: { value: tex(T('forrest_ground_01', 'diff')) }, tLeaves: { value: tex(T('forest_leaves_02', 'diff')) }, tSand: { value: tex(T('playground_sand', 'diff')) }, tDirt: { value: tex(T('brown_mud_leaves_01', 'diff')) },
    nGrass: { value: tex(T('forrest_ground_01', 'nor'), false) }, nLeaves: { value: tex(T('forest_leaves_02', 'nor'), false) },
    tMask: { value: mask }, uBounds: { value: new THREE.Vector4(BOUNDS.x0, BOUNDS.z1, W, D) },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform sampler2D tGrass, tLeaves, tSand, tDirt, nGrass, nLeaves, tMask; uniform vec4 uBounds;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
      vec4 splat; float macro;`)
      .replace('#include <map_fragment>', `
        vec2 wuv = vW.xz;
        vec2 muv = vec2((vW.x - uBounds.x) / uBounds.z, (uBounds.y - vW.z) / uBounds.w);
        vec4 mk = texture2D(tMask, muv);
        float n1 = vn(wuv * 0.35), n2 = vn(wuv * 1.3);
        macro = 0.82 + 0.3 * vn(wuv * 0.06) + 0.1 * (n2 - 0.5);
        vec3 grass = mix(texture2D(tGrass, wuv / 2.0).rgb, texture2D(tGrass, wuv / 7.1 + 0.37).rgb, 0.4) * vec3(0.9, 0.96, 0.82);
        vec3 leaves = mix(texture2D(tLeaves, wuv / 3.0).rgb, texture2D(tLeaves, wuv / 8.3).rgb, 0.3) * vec3(0.86, 0.8, 0.74);
        vec3 sand = texture2D(tSand, wuv / 2.07).rgb;
        vec3 dirt = texture2D(tDirt, wuv / 1.8).rgb;
        float wl = smoothstep(0.2, 0.6, mk.r + (n1 - 0.5) * 0.5);
        float ws = smoothstep(0.35, 0.65, mk.g + (n2 - 0.5) * 0.25);
        float wd = smoothstep(0.25, 0.75, mk.b + (n1 - 0.5) * 0.6) * (1.0 - wl);
        vec3 col = mix(grass, dirt, wd);
        col = mix(col, leaves, wl);
        col = mix(col, sand, ws);
        splat = vec4(wl, ws, wd, 0.0);
        diffuseColor.rgb *= col * macro;`)
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 ng = texture2D(nGrass, vW.xz / 2.0).xyz * 2.0 - 1.0;
          vec3 nl = texture2D(nLeaves, vW.xz / 3.0).xyz * 2.0 - 1.0;
          vec3 nt = normalize(mix(ng, nl, splat.x) * vec3(0.9, 0.9, 1.0));
          vec3 nw = normalize(vec3(nt.x, nt.z, -nt.y));
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }`);
  };
  const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.name = 'terrain'; mesh.userData.noSeeThrough = true;
  scene.add(mesh);
  return mesh;
}

/** The canal: dark green water with two scrolling procedural normal maps and the sky in it. */
function water(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256), rng = mulberry32(5);
  const waves = Array.from({ length: 9 }, () => ({ kx: Math.round((rng() - 0.5) * 12), kz: Math.round((rng() - 0.5) * 12) || 1, ph: rng() * 6.28, a: 0.3 + rng() })) ;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) { const t = (w.kx * x + w.kz * y) / 256 * Math.PI * 2 + w.ph, cs = Math.cos(t) * w.a; dx += cs * w.kx; dy += cs * w.kz; }
    const n = new THREE.Vector3(-dx * 0.012, -dy * 0.012, 1).normalize(), i = (y * 256 + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const nm = new THREE.CanvasTexture(c); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.colorSpace = THREE.NoColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: '#1f3c36', roughness: 0.1, metalness: 0.05, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.9 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.time;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = texture2D(normalMap, vNormalMapUv * 1.0 + vec2(uTime * 0.012, uTime * 0.007)).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(normalMap, vNormalMapUv * 2.3 + vec2(-uTime * 0.017, uTime * 0.011)).xyz * 2.0 - 1.0;
        mapN = normalize(vec3((mapN.xy + mapN2.xy) * normalScale, 1.0));
        normal = normalize(tbn * mapN);`);
  };
  const geo = new THREE.PlaneGeometry(80, 150); geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 15);
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(-22, -0.72, -34); mesh.receiveShadow = true; mesh.userData.noSeeThrough = true;
  scene.add(mesh);
  return mesh;
}

/** The seawall: a concrete face from the promenade down into the canal, a stucco parapet with pillars on top. */
function seawall(scene, col, P, run) {
  const pos = [], uv = [], idx = [];
  let s = 0, v = 0;
  const pts = SEA;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    if (i) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    pos.push(x, 0.02, z, x, -1.9, z);
    uv.push(s / 2, 0.98, s / 2, 0);
    if (i) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    v += 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const face = new THREE.MeshStandardMaterial({ map: tex(T('concrete_moss', 'diff'), true, [1, 1]), normalMap: tex(T('concrete_moss', 'nor'), false), roughness: 0.95, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, face); m.receiveShadow = true; m.userData.noSeeThrough = true; scene.add(m);
  // the parapet: stucco wall modules along the land edge, with a gap for the dock
  run('kit/stucco_wall', SEA.slice(0, 7).map(([x, z]) => [x + 0.15, z]), 3, 0.14, (x, z) => z < -1.6 && z > -4.8);
}

/** The concrete promenade between the seawall and the verge, and its link to the park path. */
function promenade(scene) {
  const pos = [], uv = [], idx = [];
  let s = 0, v = 0;
  const pts = SEA.slice(0, 7);
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    if (i) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const ex = dz / L * -1, ez = -dx / L * -1; // east (land) side normal
    for (const k of [0, PROM_W]) { pos.push(x + ex * k, 0.03, z + ez * k); uv.push(k, -s); }
    if (i) idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
    v += 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const cm = new THREE.MeshStandardMaterial({ map: tex(T('concrete_pavement', 'diff'), true, 1 / 1.8), normalMap: tex(T('concrete_pavement', 'nor'), false, 1 / 1.8), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, cm); m.receiveShadow = true; m.userData.noSeeThrough = true; scene.add(m);
  // the link east to the park, and the cracked walk to the house door
  const slab = (ax, az, bx, bz, w, mat) => {
    const L = Math.hypot(bx - ax, bz - az), geo = new THREE.PlaneGeometry(w, L); geo.rotateX(-Math.PI / 2);
    const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * w / 2, u.getY(i) * L / 2);
    const mm = new THREE.Mesh(geo, mat); mm.position.set((ax + bx) / 2, 0.035, (az + bz) / 2); mm.rotation.y = Math.atan2(bx - ax, bz - az); mm.receiveShadow = true; mm.userData.noSeeThrough = true; scene.add(mm);
  };
  slab(2.0, -25.1, 8.8, -27.0, 2.3, cm);
  const wm = new THREE.MeshStandardMaterial({ map: tex(T('concrete_pavement', 'diff'), true, 0.6), normalMap: tex(T('concrete_pavement', 'nor'), false, 0.6), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, color: '#f2ece0', side: THREE.DoubleSide });
  slab(WALK_TO_DOOR[0][0], WALK_TO_DOOR[0][1], WALK_TO_DOOR[1][0], WALK_TO_DOOR[1][1], 1.4, wm);
}

/** A dark figure in a lit window that slides out of view (the window plane clips it). */
function windowFigure(scene, at, rot) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(30,18,10,0.9)';
  g.beginPath(); g.ellipse(64, 36, 14, 17, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(24, 112); g.quadraticCurveTo(30, 62, 64, 57); g.quadraticCurveTo(98, 62, 104, 112); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.21), m);
  mesh.position.set(at.x, 1.52, at.z); mesh.rotation.y = rot; mesh.renderOrder = 2; mesh.userData.noSeeThrough = true; scene.add(mesh);
  const f = { mesh, t: -1 };
  f.withdraw = () => { if (f.t < 0) f.t = 0; };
  f.update = (dt) => { if (f.t < 0) return; f.t = Math.min(1, f.t + dt / 0.9); const e = f.t * f.t * (3 - 2 * f.t); t.offset.x = 0.78 * e; };
  f.reset = () => { f.t = -1; t.offset.x = 0; };
  return f;
}
function doorCrack(scene, at, rot) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.0), new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false, transparent: true, opacity: 0 }));
  m.position.set(at.x, 1.08, at.z); m.rotation.y = rot; m.userData.noSeeThrough = true; scene.add(m);
  return m;
}
