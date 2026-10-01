import * as THREE from 'three';
import { applyLibrary, tex, T } from './materials.js';
import { mulberry32 } from '../core/util.js';

// The opening, neighborhood pass (Marc's revision of 2026-10-01): Marc already searching inside an
// abandoned South Florida neighborhood at golden hour. Meters; +x east, +z south; the camera always
// looks north. (The pass-2 seawall walk is at git tag baseline-opening-pass2-2026-10-01.)
//
//   1 the street: the boarded-up house ahead behind its low garden wall, the gate broken open; a car on a
//     flat tire beside it, nosed into the broken fence, a suitcase dropped open; a copper oak in the
//     front yard; small muddy prints through the gate
//   2 round the house: the side passage between its wall and the neighbor's fence, leaves drifted in
//   3 the neglected backyard; the route bends around a fallen limb to a locked gate: try it, climb it
//   4 a small neighborhood park: the swing still moving off to the right; the bunny by a broken fence
//   5 her call; Marc runs. Through the fence: a short muddy passage straight on, or firm ground around
//      the walled garden
//   6 the yard: the house top-right, its front facing south-west; lit windows, a figure, "Stay there."
//
// Assets are the Blender kit (public/assets/models/kit, blender/build_kit.py) placed here.

// ------------------------------------------------------------------ layout
export const SPAWN = { x: 0.8, z: -0.3, yaw: Math.PI };
export const BOARDED = { x: -4.0, z: -13.2 };                    // the boarded house (10 x 8), front facing the street
export const PASS = { x0: 1.0, x1: 4.2, z0: -9.2, z1: -17.2 };      // the side passage (its east wall, the neighbor's fence)
const FRONT_Z = -3.4, FGATE = [0.0, 1.8];                       // the low front garden wall and its broken gate
export const GATE = { x0: 0.45, x1: 1.6, z: -34, h: 1.75 };      // the locked gate out of the backyard
export const PLAY = { x: 5.2, z: -41.4, rx: 2.6, rz: 1.8 };       // the swing set (dirt under it)
export const BUNNY = { x: 2.55, z: -48.1 };
const PARK_N = -49.2, GAP = [0.7, 2.9];                          // the park's broken north fence and its gap
export const MUD = { x0: 0.75, x1: 3.75, z0: -52.4, z1: -60.6 }; // the muddy passage (straight on)
const GARDEN = { x0: 3.9, x1: 8.6, z0: -52.6, z1: -60.6 };       // the walled garden between the two ways
export const FIRM = [[2.2, -51], [9.9, -51.1], [9.9, -60.8], [6.8, -63.6]]; // the firm way around
export const HOUSE = { x: 12.6, z: -74.2, rot: -Math.PI / 4, w: 12, d: 9 };
const fwd = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };        // the house front faces south-west
const side = { x: Math.SQRT1_2, z: Math.SQRT1_2 };        // the house's local +x (toward the carport, south-east)
const hp = (lx, lf) => ({ x: HOUSE.x + side.x * lx + fwd.x * lf, z: HOUSE.z + side.z * lx + fwd.z * lf });
export const DOOR = hp(-0.3, HOUSE.d / 2 + 0.4);
export const WALK_TO_DOOR = [[5.2, -64.6], hp(-0.3, HOUSE.d / 2 + 2.2)].map((p) => (Array.isArray(p) ? p : [p.x, p.z]));
const BOUNDS = { x0: -40, x1: 44, z0: -104, z1: 24 };

/** Corridor safety nets (polylines of [x, z, half-width]); walls, fences and houses do the real work. */
export const ROUTE = [
  [0.9, 3.6, 3.2], [0.9, -1.0, 2.6], [0.9, -3.4, 1.4], [1.8, -6.4, 2.8], [2.6, -9.8, 1.6], [2.6, -17.6, 1.6], [0.4, -23, 4.6], [-0.2, -28, 4.6], [1.0, -32.4, 2.6],
  [1.0, -34.8, 1.8], [1.4, -40, 5], [2.0, -46.6, 4.4], [1.8, -49.4, 1.3], [2.0, -50.9, 1.9], [2.25, -55, 1.7], [2.3, -60.4, 1.7], [4.4, -63.6, 4.2], [7.6, -69.4, 5],
];
const FIRM_ROUTE = [[2.0, -50.9, 1.9], [9.9, -51.1, 1.5], [9.9, -60.8, 1.4], [6.8, -63.6, 4.0]];

/** Camera and mood by area (first match with z > z1). bias pulls the camera focus toward a point (weight w). */
export const ZONES = [
  { id: 'street', name: 'The street', z1: -3.6, zoom: 1.06, fog: 48, bias: { x: SPAWN.x, z: -12, w: 0.09 } },   // a little north: the boarded windows clear the top edge
  { id: 'frontyard', name: 'The front yard', z1: -9.6, zoom: 1.0, fog: 46 },
  { id: 'passage', name: 'The side passage', z1: -18.5, zoom: 0.96, fog: 44 },
  { id: 'backyard', name: 'The backyard', z1: -34.2, zoom: 1.0, fog: 46 },
  { id: 'park', name: 'The park', z1: -49.6, zoom: 1.04, fog: 48, bias: { x: PLAY.x, z: PLAY.z, w: 0.14 } },
  { id: 'lane', name: 'Mud or firm ground', z1: -61.6, zoom: 0.98, fog: 46 },
  { id: 'yard', name: 'The house', z1: -Infinity, zoom: 1.1, fog: 52, bias: { x: HOUSE.x, z: HOUSE.z, w: 0.26 } },
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
    if (d < bd) { bd = d; best = { d, px, pz, t, g }; }
  }
  const { g, t } = best;
  return { ...best, s: g.s0 + g.L * t, w: g.aw + (g.bw - g.aw) * t };
}
const ROUTE_S = segs(ROUTE), FIRM_S = segs(FIRM_ROUTE);
export const ROUTE_LENGTH = ROUTE_S.reduce((a, g) => a + g.L, 0);
export const nearest = (x, z) => nearestOn(ROUTE_S, x, z);
export const progressAt = (x, z) => Math.max(0, Math.min(1, nearestOn(ROUTE_S, x, z).s / ROUTE_LENGTH));
/** (kept for the audio API: there is no water in this opening) */
export const seaDist = () => 99;
export function clampToRoute(x, z, r) {
  // inside either corridor (the main way, or the firm way around the garden) is fine
  let best = null;
  for (const S of [ROUTE_S, FIRM_S]) {
    const n = nearestOn(S, x, z), lim = n.w - r;
    if (n.d <= lim) return { x, z, hit: false };
    const k = lim / n.d, c = { x: n.px + (x - n.px) * k, z: n.pz + (z - n.pz) * k, hit: true, e: n.d - lim };
    if (!best || c.e < best.e) best = c;
  }
  return best;
}
const inRect = (x, z, r, grow = 0) => x > Math.min(r.x0, r.x1) - grow && x < Math.max(r.x0, r.x1) + grow && z < Math.max(r.z0, r.z1) + grow && z > Math.min(r.z0, r.z1) - grow;
function distSeg(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L ? ((x - ax) * dx + (z - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
const distPoly = (x, z, pts) => { let d = Infinity; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(x, z, ...pts[i], ...pts[i + 1])); return d; };

// paved areas: [x0, z0, x1, z1] rectangles (walks, the driveway, the street) and the firm way
const PAVED = [
  [-40, 2.3, 44, 4.0],          // sidewalk
  [-40, 4.0, 44, 11.6],         // street (asphalt)
  [4.4, 4.0, 7.8, -3.0],        // the teal house driveway apron
  [-4.4, -3.4, -3.2, -7.4],     // the boarded house front walk
];
/** small mud patches with her prints, and the muddy passage */
export const MUD_PATCHES = [[1.0, -4.6, 0.95, 0.7], [2.3, -8.4, 0.8, 0.6], [2.6, -14.6, 0.75, 0.6], [1.15, -32.6, 1.1, 0.75], [2.2, -46.9, 0.9, 0.6]];
const inEllipse = (x, z, cx, cz, rx, rz) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1;
const TRAIL = [[0.9, -3.4], [1.8, -6.4], [2.6, -9.8], [2.6, -17.6], [0.4, -23], [-0.2, -28], [1.0, -33.4], [1.0, -35], [1.2, -40], [2.0, -46.6], [1.8, -49.6], [2.0, -51]];
/** Surface under (x, z): concrete, mud, leaves (worn dirt trails and leaf drifts), or grass. Drives footsteps, pace and prints. */
export function groundKind(x, z) {
  if (PAVED.some((r) => inRect(x, z, { x0: r[0], z0: r[1], x1: r[2], z1: r[3] })) || distPoly(x, z, FIRM.slice(0, 3)) < 1.05 || distSeg(x, z, ...WALK_TO_DOOR[0], ...WALK_TO_DOOR[1]) < 0.75) return 'concrete';
  if (inRect(x, z, MUD, -0.05) || MUD_PATCHES.some(([cx, cz, rx, rz]) => inEllipse(x, z, cx, cz, rx, rz))) return 'mud';
  if (distPoly(x, z, TRAIL) < 1.1) return 'leaves';
  return 'grass';
}
export const groundHeight = () => 0;

/** Checkpoints for captures and tests, and a waypoint list for agent walks. */
export const LEVEL_TEST = {
  marks: [
    { id: 'street', x: SPAWN.x, z: SPAWN.z, note: 'Start: the boarded house, the car on a flat tire, the suitcase, the broken fence, the copper oak, prints into the side passage.' },
    { id: 'frontyard', x: 1.6, z: -5.6, note: 'Through the broken gate: the boarded front, the copper oak, prints toward the side of the house.' },
    { id: 'passage', x: 2.6, z: -13, note: 'The side passage between the house and the fence.' },
    { id: 'backyard', x: 0.2, z: -24, note: 'The neglected backyard; the route bends to the gate.' },
    { id: 'gate', x: 1.0, z: -33.2, note: 'The locked gate.' },
    { id: 'park', x: 1.2, z: -39, note: 'The park: the swing still moving off to the right.' },
    { id: 'bunny', x: 2.2, z: -46.6, note: 'The bunny by the broken fence.' },
    { id: 'fork', x: 2.0, z: -51.2, note: 'Mud straight on, or firm ground around the walled garden.' },
    { id: 'yard', x: 4.6, z: -63.8, note: 'The house top-right, its front facing south-west.' },
  ],
  walk: [
    [0.9, -3.0], [1.9, -6.6], [2.6, -10], [2.6, -17.2], [0.4, -22.8], [-0.2, -28], [1.0, -33.2, 'gate'], [1.0, -33.2, 'gate'], [1.2, -38.4], [1.3, -42.6],
    [2.3, -46.9, 'bunny'], [1.8, -49.6], [2.2, -55], [2.3, -60.6], [WALK_TO_DOOR[0][0], WALK_TO_DOOR[0][1]], [WALK_TO_DOOR[1][0], WALK_TO_DOOR[1][1]],
  ],
  /** the other way at the fork: the firm ground around the walled garden */
  walkFirm: [
    [0.9, -3.0], [1.9, -6.6], [2.6, -10], [2.6, -17.2], [0.4, -22.8], [-0.2, -28], [1.0, -33.2, 'gate'], [1.0, -33.2, 'gate'], [1.2, -38.4], [1.3, -42.6],
    [2.3, -46.9, 'bunny'], [1.8, -49.6], [2.4, -51], [9.9, -51.2], [9.9, -60.6], [WALK_TO_DOOR[0][0], WALK_TO_DOOR[0][1]], [WALK_TO_DOOR[1][0], WALK_TO_DOOR[1][1]],
  ],
};

// ------------------------------------------------------------------ build
export const KIT = [
  'oak_a', 'oak_b', 'oak_c', 'oak_autumn_a', 'oak_autumn_b', 'palm_a', 'palm_b', 'palm_c', 'shrub_a', 'shrub_b', 'shrub_c', 'shrub_rust', 'palmetto_a', 'palmetto_b',
  'broadleaf_a', 'broadleaf_b', 'tuft_a', 'tuft_b', 'tuft_c',
  'house_boarded', 'house_teal', 'house_sand', 'house_hostage', 'house_white', 'house_tan', 'house_pink', 'pumphouse', 'garden_wall', 'garden_wall_low',
  'fence_privacy', 'fence_privacy_broken', 'gate', 'gate_post',
  'swingset', 'swing_seat', 'swing_seat_broken', 'bench', 'bunny', 'branch', 'suitcase_open', 'box_cardboard',
  'chair', 'trash_can', 'trashbag', 'crate', 'utility_box', 'stump', 'car_white', 'stationwagon',
].map((n) => 'kit/' + n);

export function buildLevel(scene, assets, col) {
  const rng = mulberry32(2026);
  // the vehicles keep their own paint: age it (dust, matte)
  for (const n of ['kit/car_white', 'kit/stationwagon']) assets.models[n]?.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) if (!m.userData.aged) { m.userData.aged = true; m.color?.multiply(n === 'kit/car_white' ? new THREE.Color(0.7, 0.67, 0.6) : new THREE.Color(0.84, 0.81, 0.75)); m.roughness = Math.max(m.roughness ?? 0.7, 0.75); m.metalness = Math.min(m.metalness ?? 0, 0.12); }
  });
  const P = new Placer(scene, assets);
  const lights = [], dynamic = {}, interact = [];
  const blocked = [];
  const free = (x, z, r) => !blocked.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < r + br);
  const block = (x, z, r) => blocked.push([x, z, r]);
  const put = (name, x, z, ry = 0, s = 1, colR = 0, y = 0) => { P.add(name, x, y, z, ry, s); if (colR) col.circle(x, z, colR * s, name); block(x, z, Math.max(0.6, colR * s + 0.4)); };
  const putBox = (name, x, z, ry, hw, hd, s = 1, y = 0) => { P.add(name, x, y, z, ry, s); col.box(x, z, hw * s, hd * s, ry, name); block(x, z, Math.max(hw, hd) * s + 0.4); };
  /** a run of modular pieces (length L each, origin at the piece center) along a polyline; skip(x, z) leaves gaps */
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
  const house = (name, x, z, ry, size, tag) => { P.single(name, x, 0, z, ry); col.box(x, z, size[0] / 2 + 0.1, size[1] / 2 + 0.1, ry, tag || 'house'); block(x, z, Math.max(...size) / 2 + 1.2); };
  const tufts = new Tufts(P, rng, free), litter = new Litter(scene, rng);

  // ============================================================ ground
  const ground = terrain(scene);
  paving(scene, rng);

  // ============================================================ 1 the street and the first screen
  // the boarded house straight ahead behind its low front wall; the copper oak in the overgrown front yard
  house('kit/house_boarded', BOARDED.x, BOARDED.z, 0, [10, 8]);
  for (const s_ of [-1, 1]) col.circle(BOARDED.x + 0.2 + s_ * 1.35, BOARDED.z + 4 + 1.5, 0.18);      // portico columns
  put('kit/oak_autumn_a', -3.7, 2.9, 0.4, 0.85, 0.42);                 // in the verge: its canopy hangs over the wall and the gate
  run('kit/garden_wall_low', [[-13, FRONT_Z], [FGATE[0], FRONT_Z]], 3, 0.14, (x) => x > -4.9 && x < -2.7);   // open at the front walk
  // the front gate: posts, the leaf hanging open on one hinge
  for (const x of FGATE) { P.add('kit/gate_post', x, 0, FRONT_Z, 0, 1); col.circle(x, FRONT_Z, 0.1); }
  P.add('kit/gate', FGATE[0] + 0.06, 0, FRONT_Z - 0.05, -1.9, 1); P.tilt('kit/gate', 0, 0.07);
  // the neighbor's board fence: broken in where the car hit it, then the passage's east side all the way back
  run('kit/fence_privacy_broken', [[FGATE[1] + 0.05, FRONT_Z], [PASS.x1, FRONT_Z]], 2.4, 0.08);
  run('kit/fence_privacy_broken', [[PASS.x1, FRONT_Z], [PASS.x1, -5.8]], 2.4, 0.08);
  run('kit/fence_privacy', [[PASS.x1, -5.8], [PASS.x1, -34]], 2.4, 0.08);
  // the interrupted-life cluster: the car down on a flat front tire with its nose in the fence, a suitcase dropped open, a box
  P.add('kit/car_white', 3.3, 0, -0.7, 0.05, 1); P.tilt('kit/car_white', 0.035, -0.045); col.box(3.3, -0.7, 0.95, 2.15, 0.05, 'car');
  put('kit/suitcase_open', 1.95, -1.5, 0.5, 1, 0.38);
  put('kit/box_cardboard', 2.0, -0.2, -0.3, 1, 0.28); P.tilt('kit/box_cardboard', 0, 0.25);
  P.add('kit/fence_privacy_broken', 3.2, 0.02, -4.4, 0.15, 1); P.tilt('kit/fence_privacy_broken', -1.45, 0);
  // the teal house next door; trees framing the street
  house('kit/house_teal', 10.6, -12, 0, [11, 8]);
  put('kit/palm_b', 6.4, -5.2, 1.2, 1, 0.3); put('kit/palm_c', -9.6, -1.4, 2.2, 0.95, 0.3);
  put('kit/utility_box', 6.2, 2.0, Math.PI, 1, 0.3);
  // across the street (south), only their roofs and trees at the bottom edge
  house('kit/house_sand', -13, 19, Math.PI, [10, 8]); house('kit/house_white', 9, 19.5, Math.PI, [10, 8]);
  put('kit/oak_b', -3, 14.8, 1, 0.9, 0.4); put('kit/palm_a', 15.5, 14.5, 0, 1, 0.3);
  // further along the street
  house('kit/house_tan', -18, -12.5, 0, [13, 9]); house('kit/house_pink', 23, -12.5, 0, [11, 8]);

  // ============================================================ 2 round the house: the passage
  put('kit/trash_can', 3.7, -12.4, 0, 1, 0); P.tilt('kit/trash_can', 1.5, 0.3); col.box(3.55, -12.2, 0.5, 0.3, 0.3);
  put('kit/trashbag', 3.75, -13.4, 0.4, 1, 0.25); put('kit/trashbag', 2.3, -10.9, 2.1, 0.8, 0);
  col.box(BOARDED.x + 5.45, BOARDED.z - 1.2, 0.42, 0.42, 0, 'ac');            // the boarded house's AC unit stands in the passage
  put('kit/shrub_rust', 2.5, -17.0, 1.1, 0.8, 0.3);

  // ============================================================ 3 the backyard
  // the back fence with the gate, the yard's west fence; a shed; a fallen limb the route bends around
  run('kit/fence_privacy', [[-13, -34], [GATE.x0 - 0.08, -34]], 2.4, 0.1);
  run('kit/fence_privacy', [[GATE.x1 + 0.08, -34], [PASS.x1, -34]], 2.4, 0.1);
  run('kit/fence_privacy', [[-13, -14], [-13, -34]], 2.4, 0.1);
  for (const x of [GATE.x0 - 0.04, GATE.x1 + 0.04]) { P.add('kit/gate_post', x, 0, GATE.z, 0, 1); col.circle(x, GATE.z, 0.1); }
  dynamic.gate = P.single('kit/gate', GATE.x0, 0, GATE.z, 0);
  dynamic.gateCollider = col.box((GATE.x0 + GATE.x1) / 2, GATE.z, (GATE.x1 - GATE.x0) / 2, 0.1, 0, 'gate');
  interact.push({ id: 'gate', kind: 'gate', label: 'Open the gate', reach: (p, yaw) => {
    const along = p.x > GATE.x0 + 0.05 && p.x < GATE.x1 - 0.05, d = Math.abs(p.z - GATE.z), sideS = Math.sign(p.z - GATE.z) || 1;
    const facing = Math.cos(yaw) * -sideS;
    return along && d < 1.5 && (d < 0.8 || facing > 0.2) ? d : Infinity;
  } });
  putBox('kit/pumphouse', -8.2, -27.5, Math.PI / 2, 1.45, 1.75);
  // the fallen limb: snapped branches scaled up, lying where they came down against the east fence
  P.add('kit/branch', 3.6, 0, -20.6, 1.75, 2.6); P.add('kit/branch', 3.2, 0, -24.8, 1.2, 2.1); col.box(3.55, -22.6, 0.45, 2.1, 0);
  put('kit/oak_b', -9.5, -19.5, 2.2, 1.0, 0.45); put('kit/palm_a', -3.9, -31.6, 0.6, 1, 0.3);
  put('kit/chair', -4.2, -15.8, 2.4, 1, 0.3); P.tilt('kit/chair', 1.3, 0.2);
  put('kit/stump', -5.6, -23.6, 0.3, 1, 0.35);

  // ============================================================ 4 the park and the bunny
  run('kit/fence_privacy', [[-7, -34], [-13, -34]], 2.4, 0.1);
  run('kit/fence_privacy', [[PASS.x1, -34], [15, -34]], 2.4, 0.1);
  run('kit/fence_privacy', [[-7, -34], [-7, PARK_N]], 2.4, 0.1);
  run('kit/fence_privacy', [[15, -34], [15, PARK_N]], 2.4, 0.1);
  run('kit/fence_privacy', [[-7, PARK_N], [GAP[0] - 2.4, PARK_N]], 2.4, 0.1);
  run('kit/fence_privacy_broken', [[GAP[0] - 2.4, PARK_N], [GAP[0], PARK_N]], 2.4, 0.08);
  run('kit/fence_privacy_broken', [[GAP[1], PARK_N], [GAP[1] + 2.4, PARK_N]], 2.4, 0.08);
  run('kit/fence_privacy', [[GAP[1] + 2.4, PARK_N], [15, PARK_N]], 2.4, 0.1);
  P.add('kit/fence_privacy_broken', 1.5, 0.03, -50.1, 0.25, 1); P.tilt('kit/fence_privacy_broken', -1.5, 0);   // the panel that fell out of the gap
  // the swing set, off to the right of the way through
  P.add('kit/swingset', PLAY.x, 0, PLAY.z, 0, 1);
  for (const [dx, dz] of [[-1.7, 0.85], [-1.7, -0.85], [1.7, 0.85], [1.7, -0.85]]) col.circle(PLAY.x + dx, PLAY.z + dz, 0.12);
  dynamic.swings = [P.single('kit/swing_seat', PLAY.x - 0.8, 2.35, PLAY.z, 0), P.single('kit/swing_seat_broken', PLAY.x + 0.8, 2.35, PLAY.z, 0)];
  putBox('kit/bench', -4.6, -41.6, Math.PI / 2, 0.85, 0.35);
  put('kit/trash_can', -4.6, -44, 0.3, 1, 0.32);
  put('kit/oak_c', 13.6, -38.2, 2.0, 0.95, 0.5); put('kit/oak_autumn_b', -4.2, -36.8, 1.4, 1.0, 0.4);   // (nothing tall south of the firm way: it would stand under the camera)
  put('kit/palm_b', 13.2, -36.6, 0.4, 1, 0.3);
  // the bunny, sitting up against the broken fence
  dynamic.bunny = P.single('kit/bunny', BUNNY.x, 0, BUNNY.z, Math.PI * 0.85);
  dynamic.bunnyHome = { x: BUNNY.x, z: BUNNY.z, ry: Math.PI * 0.85 };
  interact.push({ id: 'bunny', kind: 'bunny', x: BUNNY.x, z: BUNNY.z, r: 2.0, label: 'Pick it up', once: true });

  // ============================================================ 5 mud or firm ground
  house('kit/house_sand', -4.4, -57, 0, [10, 8]);
  run('kit/garden_wall', [[GARDEN.x0, GARDEN.z0], [GARDEN.x0, GARDEN.z1]], 3, 0.14);
  run('kit/garden_wall', [[GARDEN.x1, GARDEN.z0], [GARDEN.x1, GARDEN.z1]], 3, 0.14);
  run('kit/garden_wall', [[GARDEN.x0, GARDEN.z0], [GARDEN.x1, GARDEN.z0]], 3, 0.14);
  run('kit/garden_wall', [[GARDEN.x0, GARDEN.z1], [GARDEN.x1, GARDEN.z1]], 3, 0.14);
  put('kit/shrub_rust', 6.0, -56.8, 3.0, 1.6, 0.5); put('kit/broadleaf_b', 7.3, -58.8, 1.0, 1.1, 0);   // (nothing tall here: it would sit right under the camera in the yard)
  house('kit/house_white', 17.1, -56.5, 0, [10, 8]);   // (its AC unit stands clear of the firm way)
  put('kit/shrub_rust', 7.9, -51.7, 0.2, 0.8, 0); put('kit/broadleaf_a', 10.9, -61.8, 1.2, 1.0, 0);

  // ============================================================ 6 the yard and the house
  {
    const h = HOUSE;
    P.single('kit/house_hostage', h.x, 0, h.z, h.rot);
    col.box(h.x, h.z, h.w / 2 + 0.1, h.d / 2 + 0.1, h.rot, 'house');
    const cp = hp(6 + 1.75, -0.3); P.add('kit/stationwagon', cp.x, 0, cp.z, h.rot + Math.PI / 2, 1); col.box(cp.x, cp.z, 2.3, 1.0, h.rot + Math.PI / 2);
    for (const lf of [h.d / 2 + 0.4, 0, -h.d / 2 + 0.4]) { const q = hp(6 + 3.3, lf); col.circle(q.x, q.z, 0.12); }   // carport posts
    for (const s of [-1, 1]) { const q = hp(-0.3 + s * 1.35, h.d / 2 + 1.5); col.circle(q.x, q.z, 0.18); }             // portico columns
    dynamic.house = P.lastSingle();
    lights.push({ ...hp(-3.6, h.d / 2 + 1.0), y: 1.7, color: '#ffae5c', intensity: 5, distance: 7, kind: 'window' });
    lights.push({ ...hp(3.3, h.d / 2 + 1.0), y: 1.7, color: '#ffae5c', intensity: 4, distance: 6, kind: 'window2' });
    lights.push({ ...hp(0.6, h.d / 2 + 0.6), y: 2.0, color: '#ffc27a', intensity: 4, distance: 6, kind: 'porch' });
    dynamic.figure = windowFigure(scene, hp(-3.6, h.d / 2 + 0.032), h.rot);
    dynamic.doorCrack = doorCrack(scene, hp(0.14, h.d / 2 + 0.06), h.rot);
    run('kit/fence_privacy', [[-1.2, -61.4], [-1.2, -84]], 2.4, 0.1);
    run('kit/fence_privacy', [[21.6, -61], [21.6, -84]], 2.4, 0.1);
    for (const [x, z, n, s] of [[21.6, -66.4, 'palm_b', 1.05], [3.0, -76.4, 'oak_b', 1], [18.6, -86, 'oak_c', 1], [0.8, -67.2, 'palmetto_b', 1.1], [16.2, -64.6, 'broadleaf_b', 1.1], [1.6, -71.8, 'shrub_b', 1.2]])
      put('kit/' + n, x, z, rng() * 6.28, s, n.startsWith('palm_') ? 0.3 : n.startsWith('oak') ? 0.5 : 0.4);
    put('kit/crate', 15.2, -68.4, 0.4, 1, 0.35); put('kit/chair', 10.6, -67.4, -0.6, 1, 0.3);
    const a = hp(-5.4, h.d / 2 + 0.9), b2 = hp(4.6, h.d / 2 + 0.9); put('kit/shrub_c', a.x, a.z, 0.3, 1.3, 0.5); put('kit/broadleaf_a', b2.x, b2.z, 1.3, 1.1, 0.4);
  }
  // beyond: houses and trees up the frame, so the view never ends in empty ground
  house('kit/house_tan', -14, -76, Math.PI / 2, [13, 9]); house('kit/house_pink', -17, -44, Math.PI / 2, [11, 8]);
  house('kit/house_white', 27, -40, -Math.PI / 2, [10, 8]); house('kit/house_sand', 31, -74, -Math.PI / 2, [10, 8]);
  house('kit/house_teal', 6, -95, 0, [11, 8]);

  // ============================================================ planting: a small consistent set, clustered with intent
  const plant = [
    // the street front yards
    [-7.6, -7.8, 'broadleaf_b', 1.1], [-0.4, -8.2, 'shrub_a', 0.85], [-7.6, -4.6, 'shrub_b', 1.1], [0.5, -8.6, 'broadleaf_a', 0.8], [8.2, -6.4, 'broadleaf_a', 1.0], [10.4, -6.6, 'shrub_c', 1.1], [15.4, -7.2, 'shrub_b', 1.2],
    [-1.6, 0.8, 'tuft_b', 1.2], [-1.0, -4.4, 'tuft_b', 1.0], [5.2, 1.0, 'palmetto_a', 0.9],
    // the backyard
    [-11.2, -24.8, 'shrub_b', 1.5], [-10.4, -31.2, 'broadleaf_b', 1.2], [-2.6, -18.8, 'broadleaf_a', 1.0], [1.4, -27.6, 'shrub_rust', 1.0], [-6.8, -32.6, 'shrub_a', 1.3], [-0.6, -32.8, 'palmetto_b', 1.0],
    // the park
    [-5.6, -38.4, 'shrub_b', 1.4], [13.4, -40.6, 'shrub_a', 1.4], [12.8, -47.8, 'broadleaf_b', 1.2], [-5.6, -47.4, 'shrub_c', 1.3], [5.2, -47.8, 'shrub_rust', 0.9], [-1.4, -45.8, 'palmetto_a', 0.9],
    // the yard
    [5.8, -65.6, 'shrub_rust', 0.9],
  ];
  for (const [x, z, n, s] of plant) if (free(x, z, 0.35)) put('kit/' + n, x, z, rng() * 6.28, s, n.startsWith('tuft') || n.startsWith('palmetto') || n.startsWith('broadleaf') ? 0 : 0.45);
  // raised grass in selected clusters: wall and fence bases, the curb, neglected corners
  tufts.along([[PASS.x0 + 0.2, -10.2], [PASS.x0 + 0.2, -17.8]], 0.55, 0.15);
  tufts.along([[PASS.x1 - 0.22, -6], [PASS.x1 - 0.22, -17.5]], 0.5, 0.15);
  tufts.along([[-12.6, -3.7], [-0.3, -3.7]], 0.5, 0.25); tufts.along([[-11.4, 2.0], [-1.4, 2.0]], 0.7, 0.3); tufts.along([[8.4, 2.0], [16, 2.0]], 0.6, 0.3);
  tufts.along([[-12.6, -20], [-12.6, -33.4]], 0.6, 0.3); tufts.along([[-12, -33.6], [-1, -33.6]], 0.6, 0.3); tufts.along([[GATE.x1 + 0.3, -33.6], [2.1, -33.6]], 0.8, 0.2);
  tufts.along([[-6.6, -35], [-6.6, -48.6]], 0.55, 0.3); tufts.along([[-6.6, -48.8], [0.4, -48.8]], 0.5, 0.25); tufts.along([[3.2, -48.8], [14.6, -48.8]], 0.5, 0.25);
  tufts.along([[MUD.x0 + 0.15, -52.6], [MUD.x0 + 0.15, -60.4]], 0.6, 0.18); tufts.along([[MUD.x1 - 0.12, -52.6], [MUD.x1 - 0.12, -60.4]], 0.6, 0.15);
  tufts.along([[8.85, -52.6], [8.85, -60.4]], 0.8, 0.15); tufts.along([[-0.9, -62], [-0.9, -80]], 0.6, 0.3);
  tufts.patch(-6, -27, 3.5, 14); tufts.patch(-3.5, -20.5, 2, 8); tufts.patch(-2.2, -6.8, 2.6, 12); tufts.patch(-8.5, -6, 2.5, 8); tufts.patch(10.8, -44, 2.5, 9); tufts.patch(-3.5, -46.5, 2, 7); tufts.patch(5.6, -45.6, 1.6, 7); tufts.patch(-1.8, -40.5, 1.6, 7); tufts.patch(4.8, -37.2, 1.4, 5); tufts.patch(8.5, -66.6, 2.2, 8); tufts.patch(1.2, -64.8, 1.4, 6); tufts.patch(17, -67, 3, 10); tufts.patch(2.5, -78, 3, 8);
  // fallen leaves: drifts against walls and in corners, a pool under each copper tree, sparse on the paths
  litter.drift([[PASS.x0 + 0.35, -10.2], [PASS.x0 + 0.35, -17.5]], 1.2, 0.5); litter.drift([[PASS.x1 - 0.35, -6], [PASS.x1 - 0.35, -17]], 1.4, 0.45);
  litter.drift([[-12.4, FRONT_Z - 0.4], [-0.2, FRONT_Z - 0.4]], 1.3, 0.55); litter.pool(-3.6, 2.0, 2.8, 12); litter.pool(-1.6, -5.2, 2.4, 8); litter.pool(-4.2, -36.8, 2.8, 14); litter.pool(4.6, -45.6, 1.6, 6); litter.pool(10.5, -46.5, 2.0, 7); litter.pool(-1.6, -27.5, 1.8, 6); litter.pool(6.0, -56.8, 2.0, 6);
  litter.drift([[-12.4, -33.4], [-1, -33.4]], 1.6, 0.6); litter.drift([[-6.4, -48.6], [14.4, -48.6]], 1.5, 0.5); litter.drift([[9.0, -51.6], [9.0, -60]], 2, 0.4);
  litter.scatter([[0.9, 1.5], ...TRAIL.slice(0, 9)], 3.4, 1.2);
  litter.scatter([[-11, 3.2], [16, 3.2]], 3.6, 0.9); litter.drift([[-12, 4.3], [18, 4.3]], 3.6, 0.35);
  litter.drift([[-0.6, -62.6], [8, -62.6]], 2.2, 0.5); litter.pool(3.0, -76.4, 2.8, 10);

  // scatter: trees and shrubs on all the land off the route and off buildings, denser further from the way
  for (let z = BOUNDS.z1 - 2; z > BOUNDS.z0 + 2; z -= 3.2) for (let x = BOUNDS.x0 + 2; x < BOUNDS.x1 - 2; x += 3.2) {
    const px = x + (rng() - 0.5) * 2.8, pz = z + (rng() - 0.5) * 2.8;
    const n = nearest(px, pz);
    if (n.d < n.w + 1.6 || !free(px, pz, 1.6) || (pz > 2 && pz < 13) || inRect(px, pz, { x0: -1.5, x1: 22, z0: -61, z1: -86 }) || inRect(px, pz, { x0: -7, x1: 15, z0: -34, z1: -49.2 }) || inRect(px, pz, { x0: 1, x1: 11, z0: -50, z1: -62 })) continue;
    if (rng() > 0.4) continue;
    // a tall canopy shows several meters up-screen of its trunk: keep canopies off the way
    const cn = nearest(px, pz - 7), tall = cn.d > cn.w + 2;
    const r = rng();
    const name = tall && r < 0.28 ? pick(rng, ['kit/oak_a', 'kit/oak_b', 'kit/oak_c', 'kit/oak_c']) : tall && r < 0.36 ? 'kit/oak_autumn_b' : tall && r < 0.52 ? pick(rng, ['kit/palm_a', 'kit/palm_b', 'kit/palm_c']) : r < 0.8 ? pick(rng, ['kit/shrub_a', 'kit/shrub_b', 'kit/broadleaf_b']) : pick(rng, ['kit/palmetto_a', 'kit/palmetto_b']);
    put(name, px, pz, rng() * 6.28, 0.85 + rng() * 0.35, n.d < n.w + 4 ? 0.45 : 0);
  }

  P.finalize(); litter.finalize();
  return { lights, dynamic, interact, ground };
}

// ------------------------------------------------------------------ pieces
const pick = (rng, a) => a[Math.floor(rng() * a.length)];

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
        im.castShadow = part.castShadow; im.receiveShadow = part.receiveShadow; im.computeBoundingSphere();
        this.scene.add(im);
      }
    }
  }
}

/** Raised grass clumps (three kit tufts) in selected places: along a line (a wall base, a curb) or a loose patch. */
class Tufts {
  constructor(P, rng, free) { this.P = P; this.rng = rng; this.free = free; }
  _one(x, z, s = 1) { const r = this.rng(), n = r < 0.45 ? 'kit/tuft_a' : r < 0.8 ? 'kit/tuft_b' : 'kit/tuft_c'; this.P.add(n, x, 0, z, this.rng() * 6.28, s * (0.75 + this.rng() * 0.5)); }
  along(pts, every = 0.6, jitter = 0.25) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let d = this.rng() * every; d < L; d += every * (0.6 + this.rng() * 0.9)) {
        if (this.rng() < 0.3) { d += every * 2; continue; }          // gaps: clusters, not a hedge
        const t = d / L; this._one(ax + (bx - ax) * t + (this.rng() - 0.5) * jitter, az + (bz - az) * t + (this.rng() - 0.5) * jitter);
      }
    }
  }
  patch(cx, cz, r, n) { for (let i = 0; i < n; i++) { const a = this.rng() * 6.28, d = r * Math.sqrt(this.rng()); const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (this.free(x, z, 0.1)) this._one(x, z, 1.1); } }
}

/** Fallen-leaf ground decals: flat alpha-cut quads from a 2x2 atlas (dense drifts, sparse scatters). One InstancedMesh per atlas cell. */
class Litter {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng; this.list = [[], [], [], []];
    this.mat = new THREE.MeshStandardMaterial({ map: tex(T('foliage/litter'), true, 1), alphaTest: 0.5, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mat.color.setRGB(1.05, 1.0, 0.95);
  }
  _add(cell, x, z, s) { this.list[cell].push([x, z, s, this.rng() * 6.28, (this.rng() - 0.5) * 0.004]); }
  drift(pts, every, s) { this._walk(pts, every, (x, z) => this._add(this.rng() < 0.7 ? 0 : 1, x, z, s * (1.3 + this.rng() * 0.8))); }
  scatter(pts, every, s) { this._walk(pts, every, (x, z) => this._add(2 + (this.rng() < 0.5 ? 0 : 1), x + (this.rng() - 0.5) * 1.6, z + (this.rng() - 0.5) * 1.2, s * (1.4 + this.rng() * 0.8))); }
  pool(cx, cz, r, n) { for (let i = 0; i < n; i++) { const a = this.rng() * 6.28, d = r * Math.sqrt(this.rng()); this._add(d < r * 0.6 ? (this.rng() < 0.5 ? 0 : 1) : 2 + (this.rng() < 0.5 ? 0 : 1), cx + Math.cos(a) * d, cz + Math.sin(a) * d * 0.85, 1.6 + this.rng() * 1.2); } }
  _walk(pts, every, fn) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let d = this.rng() * every; d < L; d += every * (0.7 + this.rng() * 0.6)) { const t = d / L; fn(ax + (bx - ax) * t, az + (bz - az) * t); }
    }
  }
  finalize() {
    this.list.forEach((items, cell) => {
      if (!items.length) return;
      const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, u0 = (cell % 2) * 0.5, v0 = (1 - Math.floor(cell / 2)) * 0.5;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
      const im = new THREE.InstancedMesh(g, this.mat, items.length), m = new THREE.Matrix4(), q = new THREE.Quaternion();
      items.forEach(([x, z, s, ry, dy], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); m.compose(new THREE.Vector3(x, 0.045 + dy + i * 0.00002, z), q, new THREE.Vector3(s, 1, s)); im.setMatrixAt(i, m); });
      im.receiveShadow = true; im.userData.noSeeThrough = true; im.computeBoundingSphere(); this.scene.add(im);
    });
  }
}

/** Splat-mapped ground: a worn grass base, bare earth, leaf-littered dirt trails, wet mud. Macro variation breaks it up. */
function terrain(scene) {
  const W = BOUNDS.x1 - BOUNDS.x0, D = BOUNDS.z1 - BOUNDS.z0, PX = 6;
  const c = document.createElement('canvas'); c.width = Math.round(W * PX); c.height = Math.round(D * PX);
  const g = c.getContext('2d');
  const toC = (x, z) => [(x - BOUNDS.x0) * PX, (BOUNDS.z1 - z) * PX];
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const rng = mulberry32(77);
  g.globalCompositeOperation = 'lighter';
  const blob = (x, z, r, color, a = 1, sq = 1) => { const [cx, cz] = toC(x, z), gr = g.createRadialGradient(cx, cz, 0, cx, cz, r * PX); gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cz, r * PX, r * PX * sq, 0, 0, Math.PI * 2); g.fill(); };
  const stroke = (pts, w, color) => { g.strokeStyle = color; g.lineWidth = w * PX; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => { const [cx, cz] = toC(x, z); i ? g.lineTo(cx, cz) : g.moveTo(cx, cz); }); g.stroke(); };
  // B: bare earth: patches everywhere, along every wall and fence base, worn under trees and the swing
  for (let i = 0; i < 320; i++) blob(BOUNDS.x0 + rng() * W, BOUNDS.z0 + rng() * D, 1 + rng() * 3.2, 'rgba(0,0,255,A)', 0.3 + rng() * 0.45);
  g.filter = 'blur(5px)';
  for (const pts of [[[PASS.x0 + 0.3, -10], [PASS.x0 + 0.3, -18]], [[PASS.x1 - 0.3, -3.6], [PASS.x1 - 0.3, -34]], [[-13, FRONT_Z - 0.3], [0, FRONT_Z - 0.3]], [[-13, -33.6], [15, -33.6]], [[-6.7, -34], [-6.7, -49]], [[-7, PARK_N + 0.3], [15, PARK_N + 0.3]], [[-11.5, 2.0], [16, 2.0]]]) stroke(pts, 1.0, 'rgba(0,0,255,0.6)');
  stroke(TRAIL, 1.5, 'rgba(0,0,255,0.42)');   // worn, not paved: the noise breaks it into patches
  for (const [x, z, r] of [[-3.7, 2.4, 2.4], [-4.2, -36.8, 2.8], [PLAY.x, PLAY.z, 2.6], [-4.4, -42.6, 2.2], [10.5, -38.5, 2.0], [3.6, -43.4, 1.6], [12, -47, 2.2], [-2.5, -26, 2.5], [-6, -30.5, 2.4], [-9.5, -19.5, 3], [3.0, -76.4, 3], [6.5, -63.5, 3.5]]) blob(x, z, r, 'rgba(0,0,255,A)', 0.85);
  // R: leaf litter worked into the trails and drifted against walls; heavy under the copper trees
  stroke(TRAIL, 1.2, 'rgba(255,0,0,0.3)');
  for (const [x, z, r] of [[-3.7, 2.2, 3.0], [-2.0, -5.4, 2.6], [-4.2, -36.8, 3.2], [6.3, -56.8, 3], [3.1, -14, 1.4], [-12, -33, 2.2]]) blob(x, z, r, 'rgba(255,0,0,A)', 0.8);
  // G: wet mud: the passage straight on, the little patches with her prints
  g.filter = 'blur(3px)';
  { const [x0, z0] = toC(MUD.x0 + 0.1, MUD.z0 - 0.1), [x1, z1] = toC(MUD.x1 - 0.1, MUD.z1 + 0.1); g.fillStyle = 'rgba(0,255,0,0.95)'; g.fillRect(x0, z0, x1 - x0, z1 - z0); }
  for (const [cx, cz, rx, rz] of MUD_PATCHES) blob(cx, cz, rx * 1.05, 'rgba(0,255,0,A)', 1, rz / rx);
  blob(2.2, -61.6, 1.6, 'rgba(0,255,0,A)', 0.7, 0.6); blob(2.3, -51.6, 1.3, 'rgba(0,255,0,A)', 0.6, 0.6);
  g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  const mask = new THREE.CanvasTexture(c); mask.colorSpace = THREE.NoColorSpace; mask.flipY = false;

  const seg = 1.0, nx = Math.round(W / seg), nz = Math.round(D / seg);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate(BOUNDS.x0 + W / 2, 0, BOUNDS.z0 + D / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = 0.03 * Math.sin(x * 0.4) * Math.cos(z * 0.33) + 0.02 * Math.sin(x * 1.3 + z * 0.7);
    if (inRect(x, z, MUD, 0.3)) y -= 0.06;                // the mud sits a little low
    if (z > 4.2 && z < 11.4) y = -0.14;                   // the street, below the curb
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const uni = {
    tGrass: { value: tex(T('forrest_ground_01', 'diff')) }, tLeaves: { value: tex(T('forest_leaves_02', 'diff')) }, tDirt: { value: tex(T('park_dirt', 'diff')) }, tMud: { value: tex(T('brown_mud_leaves_01', 'diff')) },
    nGrass: { value: tex(T('forrest_ground_01', 'nor'), false) }, nLeaves: { value: tex(T('forest_leaves_02', 'nor'), false) }, nMud: { value: tex(T('brown_mud_leaves_01', 'nor'), false) },
    tMask: { value: mask }, uBounds: { value: new THREE.Vector4(BOUNDS.x0, BOUNDS.z1, W, D) },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform sampler2D tGrass, tLeaves, tDirt, tMud, nGrass, nLeaves, nMud, tMask; uniform vec4 uBounds;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
      vec4 splat; float wetness, puddle;`)
      .replace('#include <map_fragment>', `
        vec2 wuv = vW.xz;
        vec2 muv = vec2((vW.x - uBounds.x) / uBounds.z, (uBounds.y - vW.z) / uBounds.w);
        vec4 mk = texture2D(tMask, muv);
        float n1 = vn(wuv * 0.45), n2 = vn(wuv * 1.7), n3 = vn(wuv * 0.11);
        // the grass base: olive and sage, with dry straw patches; never one flat lawn color
        vec3 grass = mix(texture2D(tGrass, wuv / 2.2).rgb, texture2D(tGrass, wuv / 6.3 + 0.37).rgb, 0.45);
        grass *= mix(vec3(0.8, 0.97, 0.7), vec3(1.16, 1.02, 0.74), smoothstep(0.3, 0.7, n3 + (n1 - 0.5) * 0.55));   // sage and olive against dry straw
        vec3 dirt = texture2D(tDirt, wuv / 2.4).rgb * vec3(1.0, 0.94, 0.86);
        vec3 leaves = mix(texture2D(tLeaves, wuv / 2.6).rgb, texture2D(tLeaves, wuv / 7.7).rgb, 0.3) * vec3(1.02, 0.86, 0.72);
        vec3 mud = texture2D(tMud, wuv / 1.9).rgb * vec3(0.5, 0.42, 0.33);
        float wd = smoothstep(0.25, 0.7, mk.b + (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.2);
        float wl = smoothstep(0.3, 0.7, mk.r + (n2 - 0.5) * 0.5);
        float wm = smoothstep(0.35, 0.6, mk.g + (n2 - 0.5) * 0.3);
        vec3 col = mix(grass, dirt, wd);
        col = mix(col, leaves, wl * 0.85);
        col = mix(col, mud, wm);
        puddle = smoothstep(0.52, 0.6, vn(wuv * 0.8 + 3.1)) * smoothstep(0.8, 0.95, mk.g);   // standing water in the deepest mud
        col *= 1.0 - 0.5 * puddle;
        wetness = wm;
        splat = vec4(wl, wm, wd, 0.0);
        diffuseColor.rgb *= col * (0.9 + 0.2 * n3);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, mix(0.45, 0.04, puddle), wetness);')
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 ng = texture2D(nGrass, vW.xz / 2.2).xyz * 2.0 - 1.0;
          vec3 nl = texture2D(nLeaves, vW.xz / 2.6).xyz * 2.0 - 1.0;
          vec3 nm = texture2D(nMud, vW.xz / 1.9).xyz * 2.0 - 1.0;
          vec3 nt = normalize(mix(mix(ng, nl, splat.x), nm, splat.y * 0.7) * vec3(1.0, 1.0, 1.0));
          vec3 nw = normalize(vec3(nt.x, nt.z, -nt.y));
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }`);
  };
  const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.name = 'terrain'; mesh.userData.noSeeThrough = true;
  scene.add(mesh);
  return mesh;
}

/** Broken paving: the sidewalk, the driveway, the walks and the firm way are separate slabs (seams, a few
 *  missing or cracked, chipped corners, small heaves), with raised edges; the street is cracked asphalt behind a curb. */
function paving(scene, rng) {
  const pos = [], uv = [], nor = [];
  const quad = (pts, y) => {   // a slab top (fan) plus a short skirt so the edges catch light
    const n = pts.length;
    for (let i = 1; i < n - 1; i++) for (const k of [0, i + 1, i]) { const [x, z, dy] = pts[k]; pos.push(x, y + dy, z); uv.push(x, z); nor.push(0, 1, 0); }
    for (let i = 0; i < n; i++) {
      const [ax, az, ady] = pts[i], [bx, bz, bdy] = pts[(i + 1) % n], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez) || 1, nx = ez / L, nz = -ex / L;
      for (const [x, yy, z, u] of [[ax, y + ady, az, 0], [bx, y + bdy, bz, L], [bx, -0.06, bz, L], [ax, y + ady, az, 0], [bx, -0.06, bz, L], [ax, -0.06, az, 0]]) { pos.push(x, yy, z); uv.push(u + ax + az, yy); nor.push(nx, 0, nz); }
    }
  };
  /** a strip of slabs from (ax, az) to (bx, bz), width w, slab length L */
  const strip = (ax, az, bx, bz, w, L, { missing = 0.06, chip = 0.35, crack = 0.18, y = 0.05 } = {}) => {
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, px = -dz, pz = dx, n = Math.max(1, Math.round(len / L)), sl = len / n, gap = 0.03;
    for (let i = 0; i < n; i++) {
      if (rng() < missing) continue;
      const s0 = i * sl + gap, s1 = (i + 1) * sl - gap, hw = w / 2 - gap;
      const P = (s, t) => [ax + dx * s + px * t, az + dz * s + pz * t];
      const heave = () => (rng() - 0.3) * 0.03;
      let pts = [[...P(s0, -hw), heave()], [...P(s1, -hw), heave()], [...P(s1, hw), heave()], [...P(s0, hw), heave()]];
      if (rng() < chip) {   // a chipped corner: replace it with two points along its edges (still convex)
        const k = Math.floor(rng() * 4), a = pts[k], b = pts[(k + 1) % 4], c2 = pts[(k + 3) % 4], f1 = 0.12 + rng() * 0.2, f2 = 0.12 + rng() * 0.2;
        const out = [];
        pts.forEach((q, j) => { if (j !== k) out.push(q); else out.push([a[0] + (c2[0] - a[0]) * f2, a[1] + (c2[1] - a[1]) * f2, a[2]], [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1, a[2]]); });
        pts = out;
      }
      if (rng() < crack && pts.length === 4) {   // a crack across: two pieces, one sunk a little
        const m0 = [(pts[0][0] + pts[1][0]) / 2 + (rng() - 0.5) * 0.2, (pts[0][1] + pts[1][1]) / 2, 0], m1 = [(pts[3][0] + pts[2][0]) / 2, (pts[3][1] + pts[2][1]) / 2 + (rng() - 0.5) * 0.2, 0];
        const sink = -0.015 - rng() * 0.02;
        quad([pts[0], [m0[0] - dx * 0.012, m0[1] - dz * 0.012, pts[0][2]], [m1[0] - dx * 0.012, m1[1] - dz * 0.012, pts[3][2]], pts[3]], y);
        quad([[m0[0] + dx * 0.012, m0[1] + dz * 0.012, sink], pts[1], pts[2], [m1[0] + dx * 0.012, m1[1] + dz * 0.012, sink]], y);
        continue;
      }
      quad(pts, y);
    }
  };
  strip(-40, 3.15, 44, 3.15, 1.65, 1.5);                         // the sidewalk
  strip(6.1, 2.3, 6.1, -3.0, 3.3, 1.8, { missing: 0.0, crack: 0.35 });     // the teal driveway apron
  strip(-3.8, -3.6, -3.8, -7.4, 1.2, 1.0, { missing: 0.15 });    // the boarded house walk
  for (let i = 0; i < FIRM.length - 2; i++) strip(...FIRM[i], ...FIRM[i + 1], 1.7, 1.2, { missing: 0.05 });   // the firm way around the garden
  strip(WALK_TO_DOOR[0][0], WALK_TO_DOOR[0][1], WALK_TO_DOOR[1][0], WALK_TO_DOOR[1][1], 1.3, 1.0, { missing: 0.08 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const cm = new THREE.MeshStandardMaterial({ map: tex(T('white_plaster_rough_01', 'diff_soft'), true, 0.3), normalMap: tex(T('concrete_pavement', 'nor'), false, 0.25), roughness: 0.93, color: '#cfcbc2' });
  const slabs = new THREE.Mesh(geo, cm); slabs.receiveShadow = true; slabs.castShadow = false; slabs.userData.noSeeThrough = true; scene.add(slabs);
  // the curb and the asphalt
  const curb = new THREE.Mesh(new THREE.BoxGeometry(84, 0.3, 0.32), new THREE.MeshStandardMaterial({ map: tex(T('white_plaster_rough_01', 'diff_soft'), true, [8, 0.1]), roughness: 0.9, color: '#c9c4ba' }));
  curb.position.set(2, 0.0, 4.15); curb.receiveShadow = true; curb.castShadow = true; curb.userData.noSeeThrough = true; scene.add(curb);
  const ag = new THREE.PlaneGeometry(84, 7.4); ag.rotateX(-Math.PI / 2);
  const am = new THREE.MeshStandardMaterial({ map: tex(T('road_damaged', 'diff_soft'), true, [84 / 5, 7.4 / 5]), normalMap: tex(T('road_damaged', 'nor'), false, [84 / 5, 7.4 / 5]), roughness: 0.95, color: '#a8a49c' });
  const asphalt = new THREE.Mesh(ag, am); asphalt.position.set(2, -0.1, 8.0); asphalt.receiveShadow = true; asphalt.userData.noSeeThrough = true; scene.add(asphalt);
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
