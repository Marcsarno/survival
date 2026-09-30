import * as THREE from 'three';
import { Batcher, Instancer, mtx, stdMat } from './batcher.js';
import * as B from './builders.js';
import { buildGround, surface, polySurface, water, distToPolyline, WORLD } from './ground.js';
import { mulberry32, pointInPoly, pick } from '../core/util.js';
import { PAL } from '../palette.js';
import { concreteTexture } from './textures.js';

// World layout (meters). +x east, +z south. Camera looks from the south-east by default.
//
//             N  (pharmacy, service road, camp)
//   woods  |  park  | Coral Palm Drive ........ | beach | sea
//             S  (canal homes, canal)

export const AREAS = [
  { id: 'camp', name: 'Abandoned Camp', sub: 'Someone left in a hurry', poly: [[-52, -90], [-26, -90], [-26, -68], [-52, -68]] },
  { id: 'pond', name: 'Frozen Pond', sub: 'Thin ice, open water', poly: [[-138, -56], [-102, -56], [-102, -22], [-138, -22]] },
  { id: 'park', name: 'Pavilion Park', sub: 'Shelter · stash · fire', poly: [[-78, -6], [-44, -6], [-44, 30], [-78, 30]] },
  { id: 'playground', name: 'Sunflower Tot Lot', sub: 'Abandoned playground', poly: [[25, -31], [53, -31], [53, -7], [25, -7]] },
  { id: 'pharmacy', name: 'Pelican Pharmacy', sub: 'Supply stop · danger', poly: [[-2, -112], [40, -112], [40, -68], [-2, -68]] },
  { id: 'beach', name: 'Deerfield Beach Access', sub: 'Driftwood and cold surf', poly: [[108, -130], [150, -130], [150, 120], [108, 120]] },
  { id: 'canal', name: 'Canal Homes', sub: 'Docks along the intracoastal', poly: [[-40, 30], [108, 30], [108, 78], [-40, 78]] },
  { id: 'hibiscus', name: 'Hibiscus Lane', sub: '', poly: [[-2, -68], [40, -68], [40, -7], [-2, -7]] },
  { id: 'cpd', name: 'Coral Palm Drive', sub: 'Stucco houses, tile roofs', poly: [[-44, -26], [108, -26], [108, 30], [-44, 30]] },
  { id: 'service', name: 'Service Road', sub: 'A back way through the scrub', poly: [[-80, -96], [2, -96], [2, -62], [-80, -62]] },
  { id: 'woods', name: 'Slash Pine Woods', sub: 'Firewood · wildlife', poly: [[-150, -130], [-44, -130], [-44, -6], [-78, -6], [-78, 40], [-150, 40]] },
];
export function areaAt(x, z) { return AREAS.find((a) => pointInPoly(x, z, a.poly)) || null; }

export const SHELTER = { x: -62, z: 10, fire: { x: -62, z: 18.2 }, stash: { x: -58.2, z: 7.4 }, bed: { x: -65.6, z: 7.6 }, rack: { x: -54.2, z: 12 }, post: { x: -55.5, z: 21.5 } };
export const START = { x: -60, z: 14.5 };

const WATER_POLYS = [
  [[-40, 60], [104, 60], [104, 76], [-40, 76]],           // canal
  [[134, -130], [150, -130], [150, 120], [134, 120]],    // sea (within ground bounds)
];
const TRAILS = [
  [[-78, 12], [-92, 6], [-104, -12], [-102, -36], [-94, -60], [-86, -78], [-60, -78], [-30, -78], [2, -78]], // woods loop + service road
  [[-61, 30], [-52, 40], [-36, 50], [-24, 56]],   // park south path to canal walk
];

export function buildWorld(scene, assets, col) {
  const b = new Batcher(scene), inst = new Instancer(scene, assets);
  const rng = mulberry32(2026);
  const interact = [], zombieSpawns = [], animalSpawns = [], lights = [], dynamic = {};
  const addI = (o) => { interact.push({ id: interact.length, used: false, r: 1.7, hold: 0, ...o }); return interact[interact.length - 1]; };
  const place = (name, x, z, ry = rng() * Math.PI * 2, s = 1, colR = 0) => {
    inst.add(name, mtx(x, 0, z, ry, s, s, s));
    if (colR) col.circle(x, z, colR * s);
  };
  const blocked = [];   // circles we don't want vegetation in
  const free = (x, z, r = 2) => !blocked.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < r + br);
  const block = (x, z, r) => blocked.push([x, z, r]);

  // -------------------------------------------------------------- ground & surfaces
  // Coral Palm Drive (x -44..110), Hibiscus Lane (z -70..52)
  surface(scene, 'asphalt', 33, 0, 154, 8, 0, 0.04, 9);
  surface(scene, 'asphalt', 18, -9, 7, 122, 0, 0.041, 9);
  for (const s of [-1, 1]) {
    surface(scene, 'concrete', 33, s * 5.4, 154, 1.8, 0, 0.05, 3.6);
    b.add(new THREE.BoxGeometry(1, 1, 1), stdMat('#a9a59d'), mtx(33, 0.08, s * 4.35, 0, 154, 0.16, 0.3));
  }
  for (const s of [-1, 1]) surface(scene, 'concrete', 18 + s * 5.1, -12, 1.8, 104, 0, 0.051, 3.6);
  // canal promenade and seawall
  surface(scene, 'concrete', 36, 56.5, 140, 4.2, 0, 0.05, 4);
  B.seawall(b, -40, 59.6, 104);
  // far bank seawall
  B.seawall(b, -40, 76.4, 104);
  // pharmacy lot + service road dirt is just trail snow
  surface(scene, 'lot', 18, -78, 32, 16, 0, 0.045, 8);
  // beach sand
  polySurface(scene, 'sand', [[112, -130], [150, -130], [150, 120], [112, 120], [110, 40], [114, 8], [112, -8], [110, -40]], 0.035, 12);
  // beach access pavers & park paths
  surface(scene, 'paver', 113, 0, 6, 5, 0, 0.05, 4);
  surface(scene, 'concrete', -48, 1, 8, 5, 0, 0.05, 4);
  // water
  const canal = water(scene, WATER_POLYS[0], PAL.water, -0.45);
  const sea = water(scene, [[134, -300], [420, -300], [420, 300], [134, 300]], '#3d7f95', -0.3, 3.5);
  // ice sheets along the canal edges
  const iceMat = new THREE.MeshStandardMaterial({ color: PAL.ice, roughness: 0.35, flatShading: true, transparent: true, opacity: 0.9 });
  for (let x = -38; x < 102; x += 6 + rng() * 5) {
    const g = new THREE.CircleGeometry(1.5 + rng() * 2.2, 5 + Math.floor(rng() * 3)); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, iceMat); m.position.set(x, -0.33, 61 + rng() * 1.5); m.scale.z = 0.5; m.userData.noSeeThrough = true; scene.add(m);
  }
  // collisions: water, sea, world edge
  col.box(32, 68, 72, 8.2, 0, 'water');
  col.box(141, -5, 7.5, 130, 0, 'water');
  col.box(0, WORLD.z0 + 1, 160, 2); col.box(0, WORLD.z1 - 1, 160, 2);
  col.box(WORLD.x0 + 1, 0, 2, 140); col.box(WORLD.x1 - 1, 0, 2, 140);
  col.box(-48, 70, 8, 10); // west end of canal: close it with rocks/brush
  for (let i = 0; i < 6; i++) place(pick(rng, ['rock-3', 'rock-2']), -44 + rng() * 6, 62 + rng() * 14, undefined, 1.2);

  // -------------------------------------------------------------- Pavilion Park (shelter)
  {
    const P = mtx(SHELTER.x, 0, SHELTER.z, 0);
    B.pavilion(b, col, P);
    block(SHELTER.x, SHELTER.z + 4, 12);
    B.picnicTable(b, col, mtx(SHELTER.x - 1.5, 0.2, SHELTER.z + 0.3, 0.05), false);
    // stash crates inside the pavilion
    for (const [dx, dz, s] of [[3.6, -2.4, 0.8], [4.5, -2.5, 0.65], [4.2, -1.6, 0.55]]) B.crate(b, col, mtx(SHELTER.x + dx, 0.2, SHELTER.z + dz, 0.2 * dx), s, dx > 4 ? '#4f5a42' : PAL.woodLight);
    addI({ kind: 'stash', x: SHELTER.stash.x, z: SHELTER.stash.z, r: 2.2, label: 'Open shelter stash' });
    // fire pit with rock ring and log benches
    const fp = SHELTER.fire;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; place('rock-1', fp.x + Math.cos(a) * 1.1, fp.z + Math.sin(a) * 1.1, a, 0.45); }
    const fire = assets.clone('campfire'); fire.position.set(fp.x, 0, fp.z); scene.add(fire);
    dynamic.fire = fire;
    col.circle(fp.x, fp.z, 1.2, 'fire');
    for (const [dx, dz, ry] of [[-2.6, 0.5, 1.2], [2.6, 0.4, -1.3], [0, 2.8, 0.1]]) place('fallen-log', fp.x + dx, fp.z + dz, ry, 0.75, 0);
    addI({ kind: 'fire', x: fp.x, z: fp.z, r: 2.8, label: 'Tend fire' });
    addI({ kind: 'bed', x: SHELTER.bed.x, z: SHELTER.bed.z, r: 2.0, label: 'Rest' });
    addI({ kind: 'build', x: SHELTER.x + 1.5, z: SHELTER.z + 3.6, r: 2.2, label: 'Improve shelter' });
    // park perimeter: low stucco walls with gaps (east -> street, west -> woods trail, south -> canal path)
    const wc = PAL.stucco[0];
    B.stuccoWall(b, col, -78, -6, -44, -6, 0.9, wc);
    B.stuccoWall(b, col, -44, -6, -44, -4.5, 0.9, wc); B.stuccoWall(b, col, -44, 5.5, -44, 30, 0.9, wc);
    B.stuccoWall(b, col, -78, -6, -78, 9, 0.9, wc); B.stuccoWall(b, col, -78, 17, -78, 30, 0.9, wc);
    B.stuccoWall(b, col, -78, 30, -65, 30, 0.9, wc); B.stuccoWall(b, col, -57, 30, -44, 30, 0.9, wc);
    B.boardSign(b, col, mtx(-47.5, 0, 8.2, -Math.PI / 2 + 0.3), 'PAVILION PARK', 'City of Deerfield · Est. 1974');
    B.bench(b, col, mtx(-50, 0, 22, -0.4)); B.trashBin(b, col, mtx(-48.5, 0, 24.5));
    B.mailbox(b, col, mtx(-46.2, 0, 7.2, -Math.PI / 2));
    for (const [x, z] of [[-74, -2], [-48, -2], [-74, 26], [-47, 27], [-68, 26], [-70, 2]]) { place(pick(rng, ['palm-1', 'palm-2', 'palm-3']), x, z, undefined, 1, 0.35); block(x, z, 2); }
    for (const [x, z] of [[-70, 20], [-52, 3], [-50, 16], [-72, 12.5]]) place(pick(rng, ['shrub-1', 'shrub-2', 'agave', 'croton']), x, z, undefined, 1, 0.5);
    lights.push({ x: fp.x, y: 1.2, z: fp.z, color: PAL.fireLight, intensity: 30, distance: 16, kind: 'fire' });
    lights.push({ x: SHELTER.x + 3.2, y: 2.6, z: SHELTER.z - 2.4, color: PAL.lanternLight, intensity: 18, distance: 13, kind: 'shelterLamp' });
    const lamp = assets.clone('lantern'); lamp.position.set(SHELTER.x + 3.2, 3.0, SHELTER.z - 2.4); scene.add(lamp);
    // upgrade visuals (hidden until built)
    dynamic.upgrades = buildUpgradeVisuals(scene, assets);
  }

  // -------------------------------------------------------------- Coral Palm Drive houses
  const housesN = [-30, -11, 62, 81, 99], housesS = [-30, -11, 32, 50, 68, 86, 102];
  let hs = 1;
  const mkHouse = (x, z, ry, opts = {}) => {
    const P = mtx(x, 0, z, ry);
    const w = 10 + rng() * 3, d = 8.5 + rng() * 1.5;
    const res = B.house(b, col, P, { w, d, seed: hs++, garage: rng() < 0.7, porch: rng() < 0.35, boarded: 0.55, ...opts });
    block(x, z, Math.max(w, d) / 2 + 1.5);
    return { P, w, d, res };
  };
  const lootTable = [
    { food: 1 }, { wood: 1 }, { water: 1 }, { food: 1, matches: 1 }, { scrap: 1 }, { oil: 1 }, {}, { food: 2 }, { medkit: 1 }, { ammo: 2 }, { blanket: 1 }, { tarp: 1 },
  ];
  let lootI = 0;
  const nextLoot = () => lootTable[(lootI++ * 7) % lootTable.length];
  const carColors = PAL.carPaint;
  const car = (x, z, ry, kind, colorI, loot) => {
    const c = assets.clone(kind === 'suv' ? 'car-suv' : 'car-sedan');
    const color = carColors[colorI % carColors.length];
    c.traverse((o) => { if (o.isMesh && o.material.name === 'CarPaint') o.material = paintMat(o.material, color); });
    c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c);
    col.box(x, z, kind === 'suv' ? 2.35 : 2.25, 0.95, ry, 'car');
    block(x, z, 3);
    const back = new THREE.Vector3(-2.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, 0, z));
    if (loot) addI({ kind: 'search', x: back.x, z: back.z, r: 1.9, hold: 1.4, label: 'Search car trunk', loot });
    return c;
  };
  const houseLot = (x, side) => {
    // side: -1 north of CPD (front faces +z), +1 south (front faces -z)
    const z = side * 16.8, ry = side < 0 ? 0 : Math.PI;
    const { P, w, d, res } = mkHouse(x, z, ry);
    addI({ kind: 'search', x: res.door.x, z: res.door.z, r: 1.8, hold: 2.2, label: 'Search porch & entry', loot: nextLoot() });
    if (res.garage) {
      // pavers driveway from garage to street
      const gx = res.garage.x, dz = side * 4.35, len = Math.abs(res.garage.z - dz);
      surface(scene, 'paver', gx, (res.garage.z + dz) / 2, 3.4, len, 0, 0.046, 3.4);
      if (rng() < 0.6) car(gx, (res.garage.z + dz) / 2 + side * 0.3, Math.PI / 2 + (rng() - 0.5) * 0.2, rng() < 0.3 ? 'suv' : 'sedan', hs, rng() < 0.7 ? nextLoot() : null);
    }
    // walkway, mailbox, hedges and palms in the front yard
    const doorX = res.door.x;
    surface(scene, 'concrete', doorX, side * 8.4, 1.4, 5.4, 0, 0.047, 2);
    B.mailbox(b, col, mtx(doorX + 1.6, 0, side * 6.9, side < 0 ? 0 : Math.PI), pick(rng, ['#3a3a3c', '#5a4a3a', '#2f4a5a']));
    if (rng() < 0.5) addI({ kind: 'search', x: doorX + 1.6, z: side * 6.0, r: 1.4, hold: 0.8, label: 'Check mailbox', loot: rng() < 0.5 ? { matches: 1 } : { ammo: 1 } });
    const hy = side * (z > 0 ? 7.2 : 7.2);
    if (rng() < 0.7) B.hedgeRow(inst, col, x + w / 2 - 2.8, hy, x + w / 2 - 0.2, hy);
    place(pick(rng, ['palm-1', 'palm-2', 'palm-3']), x - w / 2 + 0.6, side * 7.8, undefined, 1, 0.35);
    if (rng() < 0.6) place(pick(rng, ['palm-2', 'palm-3']), x + w / 2 + 1.5, side * 9.2, undefined, 1, 0.35);
    for (let k = 0; k < 3; k++) place(pick(rng, ['croton', 'agave', 'shrub-1', 'palmetto']), x - w / 2 + 2 + rng() * (w - 4), z - side * (d / 2 + 0.9), undefined, 0.8 + rng() * 0.4, 0);
    if (rng() < 0.5) B.trashBin(b, col, mtx(doorX - 2.2, 0, side * 6.8), rng() < 0.3);
    // potted plants by the door, and sometimes a bike left against the side of the house
    for (const s of [-1, 1]) if (rng() < 0.75) B.pottedPlant(b, inst, col, P.clone().multiply(mtx(res.doorX + s * 1.25, 0, d / 2 + 0.5)), pick(rng, ['croton', 'agave', 'palmetto']), 0.45 + rng() * 0.2);
    if (rng() < 0.3) B.bicycle(b, col, P.clone().multiply(mtx(w / 2 + 0.55, 0, d / 2 - 1.5, Math.PI / 2 + 0.15, 1, 1, 1, 0, 0.12)), pick(rng, ['#8a2f2a', '#2f5f8a', '#3f7a4a', '#c9a13a']));
    // side & back yard fences (privacy) between lots
    const bz0 = z + side * (d / 2 - 1), bz1 = z + side * (d / 2 + 5.5);
    B.woodFence(b, col, x - w / 2 - 2.8, bz0, x - w / 2 - 2.8, bz1);
    B.woodFence(b, col, x - w / 2 - 2.8, bz1, x + w / 2 + 2.8, bz1);
    return { P, w, d };
  };
  for (const x of housesN) houseLot(x, -1);
  for (const x of housesS) houseLot(x, 1);
  // utility poles with sagging wires along the north sidewalk
  const poleTops = [];
  for (let x = -40; x <= 106; x += 18) poleTops.push(B.utilityPole(b, col, mtx(x, 0, -6.9, 0)));
  wires(scene, poleTops);
  for (let x = -38; x < 108; x += 24 + rng() * 6) for (const s of [-1, 1]) if (Math.abs(x - 18) > 6) B.stormDrain(b, mtx(x, 0, s * 3.75));
  B.streetSign(b, col, mtx(22.6, 0, -5.4), 'HIBISCUS LN');
  B.streetSign(b, col, mtx(13.4, 0, 5.4, Math.PI / 2), 'CORAL PALM DR');
  // abandoned cars on the street
  car(-6, 1.8, 0.1, 'sedan', 3, { food: 1 });
  car(44, -2.2, Math.PI + 0.3, 'suv', 5, { water: 1, oil: 1 });
  car(76, 1.2, -0.25, 'sedan', 6, { scrap: 1, food: 1 });
  car(95, -1.6, Math.PI - 0.1, 'sedan', 1, null);
  for (let i = 0; i < 18; i++) { const x = -40 + rng() * 146, z = (rng() < 0.5 ? -1 : 1) * (2.5 + rng() * 1.2); if (free(x, z, 1)) place('snow-mound-1', x, z, undefined, 0.6 + rng() * 0.5); }

  // -------------------------------------------------------------- South Florida details
  {
    const iguanaLines = [
      'Stiff as a board, belly-up under the palm. Iguanas lock up in the cold and drop from the trees. This one might thaw by spring.',
      'Another frozen iguana. Somewhere a local news crew would have loved this.',
      'The iguana twitches one claw when you nudge it. Still alive — just very, very cold.',
      'A green iguana, frosted like a cake decoration. The palms have been raining them.',
      'Even the iguanas gave up on Florida this winter.',
    ];
    [[-46, 25.5, 0.4], [27.5, 9.4, 2.1], [30.4, -26.4, 1.2], [45.4, 51.6, -0.6], [119.6, -18.4, 2.8]].forEach(([x, z, ry], i) => {
      place('iguana', x, z, ry, 1);
      addI({ kind: 'note', x, z, r: 1.6, label: 'Poke the frozen iguana', text: iguanaLines[i] });
    });
    for (const [x, z, ry] of [[35, 9.2, 0.5], [36.1, 9.9, -0.3], [-8, -8.8, 2.4], [66.5, 9.4, 1.0], [-3.2, -9.0, 3.3], [68, 49.8, 0.2]]) place('flamingo', x, z, ry, 1);
    place('snowman', 55, 9.6, Math.PI + 0.3, 1, 0.45);
    addI({ kind: 'note', x: 55, z: 9.6, r: 1.9, label: 'Look at the snowman', text: 'Bottle-cap buttons, a beach-bucket hat, a carrot nose. Kids built this, and not long ago. The first snowman this street has ever seen.' });
    place('snowman', 46.5, -25.5, 0.4, 0.8, 0.4);
    place('radio', 123.4, -10.4, -1.2, 1.2, 0);
    B.crate(b, col, mtx(123.4, 0, -10.4, 0.2), 0.5);
    addI({ kind: 'radio', x: 123.4, z: -9.4, r: 1.8, label: 'Turn the radio dial' });
  }

  // -------------------------------------------------------------- Sunflower Tot Lot (playground)
  {
    const cx = 39, cz = -19;
    surface(scene, 'rubber', cx, cz, 22, 18, 0, 0.045, 5);
    B.metalFence(b, col, 27, -8, 36, -8); B.metalFence(b, col, 42, -8, 51, -8);
    B.metalFence(b, col, 27, -8, 27, -30); B.metalFence(b, col, 51, -8, 51, -30); B.metalFence(b, col, 27, -30, 51, -30);
    B.swingSet(b, col, mtx(33, 0, -22, 0.05));
    B.slideTower(b, col, mtx(44, 0, -21, Math.PI));
    B.climbArch(b, col, mtx(36, 0, -13.5, 0.3));
    B.bench(b, col, mtx(30, 0, -10.5, Math.PI)); B.bench(b, col, mtx(48, 0, -27.5, 0));
    B.trashBin(b, col, mtx(40.5, 0, -10, 0.8), true);
    B.boardSign(b, col, mtx(39, 0, -6.6, 0), 'SUNFLOWER TOT LOT', 'Play nice · Stay warm', '#e9d9a8');
    for (const [x, z] of [[29, -28], [49, -10], [49.5, -28.5]]) place('palm-2', x, z, undefined, 0.9, 0.35);
    for (const [x, z] of [[53, -12], [53, -20], [53, -27], [25, -14], [25, -22]]) place(pick(rng, ['shrub-1', 'shrub-2']), x, z, undefined, 1.1, 0.6);
    block(cx, cz, 13);
    // the hiker's pack on the bench, and a note from a kid
    addI({ kind: 'tool', tool: 'backpack', x: 30, z: -11.4, r: 1.6, label: 'Take hiking backpack', model: 'backpack', my: 0.55, mry: 0.4 });
    addI({ kind: 'note', x: 44, z: -16.5, r: 1.8, label: 'Read chalk drawing', text: 'Chalk on the slide platform, half under snow: a family of four stick figures and a sun. "WE WENT TO GRANDMAS — L."' });
    animalSpawns.push({ kind: 'dog', x: 47, z: -12, stray: true });
  }

  // -------------------------------------------------------------- Hibiscus Lane north (houses, police car)
  const sideHouse = (x, z, ry, loot) => {
    const { res } = mkHouse(x, z, ry, { garage: rng() < 0.5 });
    addI({ kind: 'search', x: res.door.x, z: res.door.z, r: 1.8, hold: 2.2, label: 'Search porch & entry', loot });
    place(pick(rng, ['palm-1', 'palm-3']), x + (ry > 0 ? 7 : -7), z - 5, undefined, 1, 0.35);
  };
  sideHouse(3.5, -32, Math.PI / 2, { food: 1, water: 1 });
  sideHouse(3.5, -52, Math.PI / 2, { oil: 1 });
  sideHouse(33, -46, -Math.PI / 2, { blanket: 1, food: 1 });
  sideHouse(33, -62, -Math.PI / 2, { matches: 2 });
  B.woodFence(b, col, -2.5, -24, -2.5, -64); B.woodFence(b, col, 39, -34, 39, -70);
  {
    const pc = car(17, -58, 0.35, 'sedan', 0, null);
    pc.traverse((o) => { if (o.isMesh && o.material.name.startsWith('CarPaint')) o.material = paintMat(o.material, '#e8e6e0'); });
    // light bar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 1.2), stdMat('#2b3a8a')); bar.position.set(17 - 0.2, 1.62, -58.1); bar.rotation.y = 0.35; scene.add(bar);
    addI({ kind: 'tool', tool: 'pistol', x: 18.2, z: -56.2, r: 1.8, hold: 1.2, label: 'Search police cruiser', ammo: 5 });
  }

  // -------------------------------------------------------------- Pelican Pharmacy
  {
    const P = mtx(18, 0, -96, 0);
    const ph = B.pharmacy(b, col, P);
    block(18, -96, 16);
    addI({ kind: 'search', x: ph.door.x, z: ph.door.z, r: 2.2, hold: 2.8, label: 'Search pharmacy aisles', loot: { medkit: 2, food: 2, water: 1 } });
    addI({ kind: 'search', x: ph.side.x, z: ph.side.z, r: 2.0, hold: 2.2, label: 'Pry open stockroom door', loot: { ammo: 6, oil: 1, matches: 2 } });
    for (let x = 4; x <= 34; x += 3.5) B.bollard(b, col, mtx(x, 0, -86.2));
    B.dumpster(b, col, mtx(35.5, 0, -99, Math.PI / 2));
    addI({ kind: 'search', x: 34, z: -99, r: 1.8, hold: 1.2, label: 'Dig through dumpster', loot: { scrap: 2, food: 1 } });
    B.cart(b, col, mtx(24, 0, -80, 0.8)); B.cart(b, col, mtx(9, 0, -74, -0.4));
    car(8, -80, Math.PI / 2 + 0.1, 'sedan', 2, { food: 1 });
    car(29, -76, Math.PI / 2 - 0.2, 'suv', 4, { water: 1 });
    car(22, -71.5, 0.1, 'sedan', 6, null);
    B.graffiti(b, mtx(31.05, 2.2, -92, Math.PI / 2), 'NO MEDS LEFT', 4, 1.6);
    for (const [x, z] of [[2, -104], [36, -106], [0, -88]]) place('palm-1', x, z, undefined, 1, 0.35);
    for (const [x, z, night] of [[18, -80], [10, -84, true], [28, -84], [23, -75, true], [14, -76]]) zombieSpawns.push({ x, z, area: 'pharmacy', night });
  }

  // -------------------------------------------------------------- Service road and abandoned camp
  {
    const cx = -40, cz = -80;
    B.tent(b, col, mtx(cx - 5, 0, cz - 3, 0.4), '#6a7a5a'); B.tent(b, col, mtx(cx + 4, 0, cz - 5, -0.3), '#7a5a4a');
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; place('rock-1', cx + Math.cos(a) * 0.9, cz + 1 + Math.sin(a) * 0.9, a, 0.4); }
    place('wood-bundle', cx, cz + 1, 0.3, 0.9);
    B.crate(b, col, mtx(cx + 3, 0, cz + 2, 0.3), 0.7); B.crate(b, col, mtx(cx + 3.8, 0, cz + 2.7, 0.9), 0.55, '#4f5a42');
    addI({ kind: 'search', x: cx + 3, z: cz + 3.2, r: 1.8, hold: 1.8, label: 'Search camp crates', loot: { tarp: 1, food: 1, blanket: 1 } });
    B.boardSign(b, col, mtx(cx - 1, 0, cz - 8.5, 0.1), 'EVAC CONVOY', 'Ft. Lauderdale → north. Gone 3 wks.', '#d9d0b8');
    addI({ kind: 'note', x: cx - 1, z: cz - 7, r: 2.0, label: 'Read the sign', text: 'Hand-painted: "CONVOY LEFT FOR ORLANDO. WAITED 3 DAYS. IF YOU READ THIS, THE PHARMACY LOT IS NOT SAFE AT NIGHT."' });
    block(cx, cz, 9);
    for (let x = -76; x < 0; x += 5 + rng() * 4) {
      for (const s of [-1, 1]) {
        const z = -78 + s * (6 + rng() * 5);
        if (free(x, z, 2)) place(pick(rng, ['palmetto', 'agave', 'shrub-3', 'fir-1', 'pine-1']), x, z, undefined, 0.8 + rng() * 0.5, 0.4);
      }
    }
    B.railFence(b, col, -20, -71, 2, -71); B.railFence(b, col, -20, -85, 2, -85);
    zombieSpawns.push({ x: -30, z: -76, area: 'service' });
  }

  // -------------------------------------------------------------- Canal homes
  {
    const xs = [-24, -6, 32, 50, 68, 86];
    xs.forEach((x, i) => {
      const P = mtx(x, 0, 41, Math.PI);   // front faces north (toward the alley); backyards face the canal
      const w = 10.5 + rng() * 2, d = 9;
      B.house(b, col, P, { w, d, seed: 40 + i, garage: false, boarded: 0.6 });
      block(x, 41, 8);
      // back patio (south side) + dock
      surface(scene, 'paver', x, 49.5, w - 1, 4.4, 0, 0.046, 3.4);
      B.patioSet(b, col, mtx(x - 1.5, 0, 49.5, 0.1));
      if (i % 2 === 0) B.dock(b, col, mtx(x + 2, 0, 59.4, 0), 5, 2.4);
      else B.frozenPool(b, col, mtx(x + 3.6, 0, 50.8), 4.2, 2.3);
      addI({ kind: 'search', x: x + 1.0, z: 48.5, r: 1.8, hold: 1.6, label: 'Search patio deck box', loot: [{ oil: 1 }, { blanket: 1 }, { food: 1, water: 1 }, { wood: 2 }, { ammo: 2 }, { tarp: 1 }][i] });
      // divider fences toward the promenade
      B.woodFence(b, col, x + w / 2 + 1.6, 45.5, x + w / 2 + 1.6, 52.5);
      place(pick(rng, ['palm-1', 'palm-2', 'palm-3']), x - w / 2 + 0.2, 53, undefined, 1, 0.35);
      if (rng() < 0.7) place(pick(rng, ['shrub-1', 'croton']), x + w / 2 - 1, 52.8, undefined, 1, 0.5);
    });
    // back fences of Coral Palm south houses already sit near z~26. Alley shrubs:
    for (let x = -30; x < 95; x += 7 + rng() * 6) if (free(x, 31, 2)) place(pick(rng, ['shrub-2', 'palmetto', 'fir-1']), x, 30 + rng() * 3, undefined, 1, 0.5);
    // far bank houses (not reachable) give the canal a skyline
    for (let x = -30; x < 100; x += 17) {
      B.house(b, { box() { return {}; }, circle() { return {}; } }, mtx(x + rng() * 3, 0, 86, Math.PI * 0 + 0), { w: 11, d: 9, seed: 60 + x, garage: false, boarded: 0.4 });
      place(pick(rng, ['palm-1', 'palm-3']), x + 7, 79, undefined, 1, 0);
    }
    for (const [x, z] of [[30, 64], [42, 70], [60, 66], [10, 68], [-10, 71]]) animalSpawns.push({ kind: 'duck', x, z, water: [[-38, 61], [102, 75]] });
    zombieSpawns.push({ x: 60, z: 55, area: 'canal' });
    B.boardSign(b, col, mtx(22, 0, 53.2, 0), 'CANAL WALK', 'No swimming · No wake');
  }

  // -------------------------------------------------------------- Beach
  {
    for (const z of [-4.5, 4.5]) for (let x = 110; x <= 112; x += 2) B.bollard(b, col, mtx(x, 0, z * 0.6));
    B.bollard(b, col, mtx(111, 0, 0));
    B.duneFence(b, col, 116, -60, 116, -6); B.duneFence(b, col, 116, 6, 116, 60);
    B.lifeguardTower(b, col, mtx(126, 0, -14, -Math.PI / 2));
    addI({ kind: 'search', x: 124, z: -11.6, r: 1.8, hold: 1.6, label: 'Search lifeguard stand', loot: { ammo: 4, tarp: 1 } });
    block(126, -14, 5);
    // snack hut
    {
      const P = mtx(122, 0, 22, -Math.PI / 2);
      B.house(b, col, P, { w: 6, d: 5, h: 2.8, seed: 90, garage: false, boarded: 1, color: '#9fc9c4', rise: 1.4 });
      addI({ kind: 'search', x: 118.5, z: 22, r: 1.9, hold: 1.8, label: 'Search snack hut', loot: { food: 2, water: 2, oil: 1 } });
      block(122, 22, 5);
    }
    // driftwood (firewood source)
    for (const [x, z, ry] of [[128, 4, 0.4], [124, 36, -0.8], [130, -34, 1.2], [121, -48, 0.1], [127, 52, 2.1]]) {
      place('fallen-log', x, z, ry, 0.9, 0);
      addI({ kind: 'wood', x, z, r: 2.0, hold: 2.0, label: 'Gather driftwood', amount: [1, 2] });
    }
    for (let i = 0; i < 26; i++) { const x = 114 + rng() * 18, z = -100 + rng() * 200; if (free(x, z, 3)) place(pick(rng, ['agave', 'palmetto']), x, z, undefined, 0.6 + rng() * 0.4); }
    for (const [x, z] of [[118, -20], [119, 14], [114, -70], [117, 70], [115, 44]]) place(pick(rng, ['palm-1', 'palm-2', 'palm-3']), x, z, undefined, 1.1, 0.35);
    // houses that stop the beach from being open to the north/south of the access
    for (const [x, z] of [[100, -40], [100, 40]]) mkHouse(x, z, z < 0 ? 0 : Math.PI, { garage: false });
    zombieSpawns.push({ x: 124, z: -30, area: 'beach', night: true }); zombieSpawns.push({ x: 126, z: 30, area: 'beach', night: true });
    B.boardSign(b, col, mtx(108.5, 0, -6.5, -0.4), 'BEACH ACCESS 7', 'Deerfield Beach');
  }

  // -------------------------------------------------------------- Slash Pine Woods + pond + woodshed
  {
    const pond = { x: -120, z: -39, r: 12 };
    // frozen pond: ice disk with an open-water hole
    const ice = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 11), new THREE.MeshStandardMaterial({ color: '#cfe3ee', roughness: 0.25, flatShading: true }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(pond.x, 0.03, pond.z); ice.receiveShadow = true; ice.userData.noSeeThrough = true; scene.add(ice);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(3.4, 7), new THREE.MeshStandardMaterial({ color: '#23485a', roughness: 0.2, flatShading: true }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(pond.x + 4, 0.05, pond.z + 2); hole.userData.noSeeThrough = true; scene.add(hole);
    col.circle(pond.x + 4, pond.z + 2, 3.1, 'water');
    addI({ kind: 'well', x: pond.x + 4, z: pond.z - 1.6, r: 2.2, hold: 1.6, label: 'Break the skim ice and fill a bottle' });
    block(pond.x, pond.z, pond.r + 2);
    for (let i = 0; i < 14; i++) { const a = rng() * Math.PI * 2; place(pick(rng, ['rock-1', 'rock-2']), pond.x + Math.cos(a) * (pond.r + 0.6), pond.z + Math.sin(a) * (pond.r + 0.6), undefined, 0.8, 0); }
    for (const [dx, dz] of [[3, 3], [5, 1], [4.5, 3.2]]) animalSpawns.push({ kind: 'duck', x: pond.x + dx, z: pond.z + dz, water: [[pond.x + 1.5, pond.z - 0.5], [pond.x + 6.5, pond.z + 4.5]] });
    // woodshed (concept "01-wood-shelter"): stacked firewood, lantern, the axe in a chopping stump
    const ws = { x: -106, z: 4 };
    B.woodshed(b, col, mtx(ws.x, 0, ws.z, Math.PI / 2 + 0.15));
    block(ws.x, ws.z, 7);
    addI({ kind: 'wood', x: ws.x + 2.2, z: ws.z, r: 2.4, hold: 2.5, label: 'Take split firewood', amount: [4, 4], uses: 1 });
    place('stump', ws.x + 4.2, ws.z + 2.2, 0.3, 1.2, 0.45);
    addI({ kind: 'tool', tool: 'axe', x: ws.x + 4.2, z: ws.z + 2.2, r: 1.8, label: 'Pull axe from stump', model: 'axe', my: 0.95, mrx: 0.5, mry: 0.2 });
    const wsLamp = assets.clone('lantern'); wsLamp.position.set(ws.x + 1.4, 1.4, ws.z - 1.6); scene.add(wsLamp);
    B.crate(b, col, mtx(ws.x + 2, 0, ws.z - 2.4, 0.2), 0.6);
    addI({ kind: 'search', x: ws.x + 2.6, z: ws.z - 2.9, r: 1.6, hold: 1.2, label: 'Check crate', loot: { matches: 2, oil: 1 } });
    // forest: pines/firs everywhere in the woods except trails, pond and structures
    const woodsPoly = AREAS.find((a) => a.id === 'woods').poly;
    let placed = 0;
    for (let i = 0; i < 2200 && placed < 340; i++) {
      const x = -150 + rng() * 106, z = -130 + rng() * 170;
      if (!pointInPoly(x, z, woodsPoly)) continue;
      if (distToPolyline(x, z, TRAILS[0]) < 6.5) continue;
      if (!free(x, z, 1.6)) continue;
      if (x > -80 && z > -8 && z < 32) continue; // park wall side
      const r = rng();
      const name = r < 0.62 ? pick(rng, ['pine-1', 'pine-2', 'pine-3']) : r < 0.85 ? pick(rng, ['fir-1', 'fir-2']) : r < 0.93 ? 'rock-2' : 'shrub-3';
      place(name, x, z, undefined, 0.85 + rng() * 0.35, name.startsWith('rock') ? 0.9 : 0.4);
      block(x, z, name.startsWith('pine') ? 2.2 : 1.4);
      placed++;
    }
    // fallen logs near the trail (firewood)
    let logs = 0;
    for (let i = 0; i < 200 && logs < 9; i++) {
      const t = rng(); const seg = Math.floor(t * (TRAILS[0].length - 1));
      const [ax, az] = TRAILS[0][seg], [bx, bz] = TRAILS[0][seg + 1];
      if (ax > -80) continue;
      const f = rng(); const x = ax + (bx - ax) * f + (rng() - 0.5) * 12, z = az + (bz - az) * f + (rng() - 0.5) * 12;
      if (distToPolyline(x, z, TRAILS[0]) < 2.5 || !free(x, z, 2)) continue;
      place('fallen-log', x, z, undefined, 1, 0);
      col.circle(x, z, 0.6).low = true;
      addI({ kind: 'wood', x, z, r: 2.0, hold: 2.2, label: 'Gather wood', amount: [1, 3] });
      block(x, z, 2); logs++;
    }
    for (let i = 0; i < 12; i++) { const x = -145 + rng() * 60, z = -120 + rng() * 150; if (free(x, z, 1)) place('stump', x, z, undefined, 0.9 + rng() * 0.4, 0.4); }
    for (const [x, z] of [[-112, -20], [-96, -52], [-126, -70], [-110, 10], [-90, -30]]) animalSpawns.push({ kind: 'deer', x, z });
    for (const [x, z] of [[-98, -70], [-84, 20]]) animalSpawns.push({ kind: 'fox', x, z });
    for (const [x, z] of [[-90, -10], [-104, -40], [-70, 24], [-60, 36], [-116, -12]]) animalSpawns.push({ kind: 'rabbit', x, z });
    animalSpawns.push({ kind: 'owl', x: -93.5, z: -16.5, perch: 3.2 });
    for (const [x, z] of [[-136, -100], [-130, -110]]) animalSpawns.push({ kind: 'wolf', x, z, night: true });
    for (const [x, z] of [[-112, -64], [-126, -12], [-96, -90]]) zombieSpawns.push({ x, z, area: 'woods', night: true });
    addI({ kind: 'note', x: -94, z: -58, r: 2.0, label: 'Look at tracks', text: 'Deer tracks cross the trail here — and a line of dragging bootprints that never stops to rest. The frozen walk these woods at night.' });
  }

  // -------------------------------------------------------------- neighborhood vegetation fill
  for (let i = 0; i < 260; i++) {
    const x = -44 + rng() * 154, z = -70 + rng() * 128;
    if (Math.abs(z) < 7.5 || Math.abs(x - 18) < 6.5) continue;          // roads & walks
    if (z > 53 && z < 60) continue;                                       // promenade
    if (!free(x, z, 1.4)) continue;
    const a = areaAt(x, z)?.id;
    if (a === 'pharmacy' || a === 'playground') continue;
    place(pick(rng, ['shrub-1', 'shrub-2', 'agave', 'croton', 'palmetto', 'snow-mound-2', 'palm-2']), x, z, undefined, 0.8 + rng() * 0.5, 0.45);
    block(x, z, 1.2);
  }
  // woods edge tree wall between neighborhood (north of CPD houses) and service road
  for (let x = -44; x < 108; x += 4 + rng() * 3) {
    const z = -30 - rng() * 6;
    if (Math.abs(x - 18) < 8 || (x > 24 && x < 54) || !free(x, z, 1.5)) continue;
    place(pick(rng, ['pine-1', 'pine-2', 'fir-2', 'palm-3']), x, z, undefined, 0.9 + rng() * 0.3, 0.45);
  }
  for (let x = 40; x < 108; x += 3.5 + rng() * 3) { const z = -38 - rng() * 30; if (free(x, z, 1.5)) place(pick(rng, ['pine-1', 'pine-3', 'fir-2', 'palm-1']), x, z, undefined, 1, 0.45); }
  col.box(74, -52, 33, 20); // dense scrub block north-east (not explorable)
  for (let x = -44; x < -2; x += 3.5 + rng() * 2) for (let z = -62; z > -70; z -= 4) if (free(x, z, 1.5)) place(pick(rng, ['pine-2', 'fir-1', 'shrub-3']), x, z, undefined, 1, 0.45);

  // snow banks along curbs, then the terrain itself (after all paved surfaces are registered)
  snowBanks(scene, rng);
  const ground = buildGround(scene, { waterPolys: WATER_POLYS, trailLines: TRAILS });
  b.finalize();
  inst.finalize();
  // a lone lantern that walks the far canal bank at night (unreachable): someone else is out there
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(2.2); glow.position.set(0, 1.2, 79.5); glow.visible = false; scene.add(glow);
  dynamic.farLantern = glow;
  return { interact, zombieSpawns, animalSpawns, lights, dynamic, water: [canal, sea], ground, trails: TRAILS };
}

/** Jagged plowed-snow banks along road edges (concept: clear-ish center, drifts at the curb). */
function snowBanks(scene, rng) {
  const edges = [ // [x0, z0, x1, z1, inward normal x, z]
    [-44, -4, 12, -4, 0, 1], [24, -4, 110, -4, 0, 1], [-44, 4, 12, 4, 0, -1], [24, 4, 110, 4, 0, -1],
    [14.5, -70, 14.5, -6, 1, 0], [21.5, -70, 21.5, -6, -1, 0], [14.5, 6, 14.5, 52, 1, 0], [21.5, 6, 21.5, 52, -1, 0],
  ];
  const pos = [];
  for (const [x0, z0, x1, z1, nx, nz] of edges) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.9);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, ex = x0 + (x1 - x0) * t, ez = z0 + (z1 - z0) * t;
      const d = 0.25 + Math.pow(rng(), 2) * 1.8 + (Math.sin(i * 0.7) > 0.6 ? 0.8 : 0);
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
  gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.2, 'rgba(255,190,110,0.8)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
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

/** Shelter upgrade models: hidden groups toggled by the shelter system. */
function buildUpgradeVisuals(scene, assets) {
  const mk = () => { const g = new THREE.Group(); g.visible = false; scene.add(g); return g; };
  const { x, z } = SHELTER;
  const boards = mk();
  const plank = stdMat(PAL.board);
  for (let i = 0; i < 9; i++) { // board walls on the west and east ends
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 7.2), plank);
      m.position.set(x + s * 5.55, 0.4 + i * 0.3, z); m.rotation.x = (i % 3 - 1) * 0.015; m.castShadow = true; boards.add(m);
    }
  }
  const tarp = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.05), stdMat(PAL.tarpBlue)); tarp.position.set(x - 3, 1.45, z + 3.8); tarp.rotation.x = 0.05; boards.add(tarp);
  const rack = mk();
  const rackWood = stdMat(PAL.woodDark);
  for (const dx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), rackWood); p.position.set(SHELTER.rack.x + dx * 1.1, 0.7, SHELTER.rack.z); rack.add(p); }
  const logs = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 7), stdMat(c % 2 ? '#7a5238' : '#6b4a33'));
    l.rotation.x = Math.PI / 2; l.position.set(SHELTER.rack.x - 0.9 + c * 0.36, 0.2 + r * 0.3, SHELTER.rack.z); l.castShadow = true; rack.add(l); logs.push(l);
  }
  rack.userData.logs = logs;
  const bed = mk();
  const cot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 2.1), stdMat('#5a6a4a')); cot.position.set(SHELTER.bed.x, 0.38, SHELTER.bed.z); bed.add(cot);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.1, 1.4), stdMat('#8a3a34')); blanket.position.set(SHELTER.bed.x, 0.6, SHELTER.bed.z + 0.3); bed.add(blanket);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), stdMat('#e4e0d6')); pillow.position.set(SHELTER.bed.x, 0.62, SHELTER.bed.z - 0.8); bed.add(pillow);
  const post = mk();
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.0, 0.16), stdMat(PAL.woodDark)); pole.position.set(SHELTER.post.x, 1.5, SHELTER.post.z); post.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), stdMat(PAL.woodDark)); arm.position.set(SHELTER.post.x + 0.4, 2.9, SHELTER.post.z); post.add(arm);
  const lamp = assets.clone('lantern'); lamp.position.set(SHELTER.post.x + 0.8, 2.85, SHELTER.post.z); post.add(lamp);
  return { boards, rack, bed, post };
}
