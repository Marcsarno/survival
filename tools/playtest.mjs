// Automated playtest: drives the game with real keyboard / mouse / pointer input in Chromium,
// walks every route between areas, exercises the systems and writes screenshots + a JSON report.
//
// Usage:  node tools/playtest.mjs [--headed] [--only=start,woods,...] [--url=http://localhost:5173/]
// Without --url it starts its own Vite dev server on port 5199.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'playtest-output');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const ONLY = argv.only ? String(argv.only).split(',') : null;

const results = []; const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
function record(name, pass, detail = {}) { results.push({ name, pass, ...detail }); log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(detail).slice(0, 300)); }

async function startServer() {
  if (argv.url) return { url: argv.url, stop: () => {} };
  const p = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: ROOT, shell: true });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('vite did not start')), 30000);
    p.stdout.on('data', (d) => { if (String(d).includes('5199')) { clearTimeout(to); res(); } });
  });
  return { url: 'http://localhost:5199/', stop: () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', p.pid, '/f', '/t']) : p.kill(); } catch {} } };
}

// ------------------------------------------------------------------ helpers
const YAW = Math.PI / 4;
const FWD = [-Math.sin(YAW), -Math.cos(YAW)], RIGHT = [Math.cos(YAW), -Math.sin(YAW)];
let page, errors = [];
const state = () => page.evaluate(() => window.__game.state());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const held = new Set();
async function setKeys(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function tap(key, ms = 60) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
async function shot(name, keep = false) {
  const file = path.join(keep ? SHOTS : OUT, `${name}.png`);
  await page.screenshot({ path: file });
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

/** Like a player would: shoot a chasing zombie that gets close, or swing when it is on top of us. */
async function defend(s) {
  const near = s.zombies.map((z) => [z, Math.hypot(z[0] - s.pos[0], z[1] - s.pos[1])]).filter(([z, d]) => d < 7 && z[2] !== 'wander').sort((a, b) => a[1] - b[1]);
  if (!near.length) return false;
  if (!s.tools.axe && !((s.inv.ammo || 0) > 0)) return false; // unarmed: keep moving, a shove won't win the fight
  const [[zx, zz], d] = near[0];
  await setKeys([]);
  if (s.tools.pistol && (s.inv.ammo || 0) > 0 && d > 1.6) {
    let [sx, sy] = await screenPos(zx, 1.2, zz);
    await page.mouse.move(sx, sy); await page.mouse.down({ button: 'right' }); await sleep(650);
    const s2 = await state(); const z2 = s2.zombies.sort((a, b) => Math.hypot(a[0] - zx, a[1] - zz) - Math.hypot(b[0] - zx, b[1] - zz))[0];
    if (z2) { [sx, sy] = await screenPos(z2[0], 1.2, z2[1]); await page.mouse.move(sx, sy); }
    await page.mouse.down({ button: 'left' }); await sleep(50); await page.mouse.up({ button: 'left' }); await sleep(200);
    await page.mouse.up({ button: 'right' });
  } else { await tap('f'); await sleep(500); }
  defended++;
  return true;
}
let defended = 0;

/** Walk to (x,z) with WASD relative to the camera. Returns {ok, pos, stuck}. */
async function walkTo(x, z, { tol = 1.3, timeout = 60000, sprint = true, fight = true } = {}) {
  const start = Date.now(); let last = await state(), lastProgressT = Date.now(), lastD = Infinity, sidesteps = 0;
  while (Date.now() - start < timeout) {
    const s = await state();
    if (s.dead) { await setKeys([]); return { ok: false, pos: s.pos, dead: true }; }
    if (fight && await defend(s)) { lastProgressT = Date.now(); continue; }
    if (s.stats.health < 45 && (s.inv.medkit || 0) > 0) await tap('2');
    const dx = x - s.pos[0], dz = z - s.pos[1], d = Math.hypot(dx, dz);
    if (d < tol) { await setKeys([]); return { ok: true, pos: s.pos }; }
    const f = (dx * FWD[0] + dz * FWD[1]) / d, r = (dx * RIGHT[0] + dz * RIGHT[1]) / d;
    const keys = [];
    if (f > 0.38) keys.push('w'); if (f < -0.38) keys.push('s');
    if (r > 0.38) keys.push('d'); if (r < -0.38) keys.push('a');
    if (sprint && s.stats.stamina > 15) keys.push('Shift');
    await setKeys(keys);
    if (d < lastD - 0.4) { lastD = d; lastProgressT = Date.now(); }
    if (Date.now() - lastProgressT > 2500) { // stuck: sidestep and retry
      sidesteps++;
      if (sidesteps > 4) { await setKeys([]); return { ok: false, pos: s.pos, stuck: true }; }
      await setKeys([sidesteps % 2 ? 'a' : 'd']); await sleep(700); lastProgressT = Date.now(); lastD = Infinity;
    }
    await sleep(80);
    last = s;
  }
  await setKeys([]);
  return { ok: false, pos: last.pos, timeout: true };
}
async function route(name, pts, opts) {
  const visited = new Set();
  for (const [x, z] of pts) {
    const r = await walkTo(x, z, opts);
    const s = await state(); visited.add(s.area);
    if (!r.ok) { record(`route:${name}`, false, { failedAt: [x, z], ...r, areas: [...visited] }); return false; }
  }
  const s = await state();
  record(`route:${name}`, true, { end: s.pos, areas: [...visited] });
  return true;
}
async function holdE(ms) { await page.keyboard.down('e'); await sleep(ms); await page.keyboard.up('e'); await sleep(150); }
async function screenPos(x, y, z) { return page.evaluate(([x, y, z]) => { const g = window.__game; const v = new g.camera.cam.position.constructor(x, y, z).project(g.camera.cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, [x, y, z]); }
async function luminanceAround(sx, sy, r = 60) {
  return page.evaluate(([sx, sy, r]) => {
    const c = document.getElementById('game'); const g = c.getContext('webgl2') || c.getContext('webgl');
    const dpr = c.width / innerWidth; const px = new Uint8Array(4);
    let sum = 0, n = 0;
    for (let dy = -r; dy <= r; dy += 12) for (let dx = -r; dx <= r; dx += 12) {
      g.readPixels(Math.round((sx + dx) * dpr), Math.round(c.height - (sy + dy) * dpr), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
      sum += 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]; n++;
    }
    return sum / n;
  }, [sx, sy, r]);
}
const want = (n) => !ONLY || ONLY.includes(n);

// ------------------------------------------------------------------ main
const server = await startServer();
const browser = await chromium.launch({ headless: !argv.headed, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = server.url + '?fresh=1&capture=1';

  // 1 fresh start with the documented flow: load, Start button
  const tLoad = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
  const loadWall = Date.now() - tLoad;
  await page.click('#btn-start');
  await sleep(1500);
  let s = await state();
  record('fresh-start', errors.length === 0 && s.area === 'park' && s.fire.lit, { loadWallMs: loadWall, loadMs: s.loadMs, area: s.area, errors: errors.slice(0, 3), shot: await shot('01-start', true) });

  // 2 footprints on snow + ground-ring visible
  if (want('footprints')) {
    await page.keyboard.press('Equal'); await page.keyboard.press('Equal'); await sleep(600);
    const before = (await state()).prints;
    await setKeys(['s']); await sleep(1600); await setKeys(['d']); await sleep(1200); await setKeys([]); await sleep(500);
    const after = (await state()).prints;
    const file = await shot('02-footprints', true);
    record('footprints', after - before >= 4, { before, after, shot: file });
    await page.keyboard.press('Minus'); await page.keyboard.press('Minus'); await sleep(400);
  }

  // 3 collision: walk into the park wall and into a house front
  if (want('collision')) {
    await page.evaluate(() => window.__game.teleport(-49, 20)); await sleep(300);
    await walkTo(-40, 20, { timeout: 3500, sprint: false });
    const a = await state();
    await page.evaluate(() => window.__game.teleport(-11, -6.5)); await sleep(300);
    await walkTo(-11, -22, { timeout: 3500, sprint: false });
    const b = await state();
    record('collision', a.pos[0] < -44.2 && b.pos[1] > -12.4, { wallX: a.pos[0], houseZ: b.pos[1], note: 'teleport used only to set up the test; blocking is from normal movement' });
    await page.evaluate(() => window.__game.teleport(-60, 16)); await sleep(300);
  }

  // 3b pathfinding: a zombie behind a house must find its way around to the player on the street
  if (want('pathing')) {
    await page.evaluate(() => { const g = window.__game; g.teleport(-11, -5); const z = g.zombies.alive()[0]; z.obj.position.set(-11, 0, -23.5); z.home.set(-11, 0, -23.5); z.state = 'chase'; window.__pathZ = z; });
    let best = 99, t = 0;
    while (t < 26000 && best > 2.5) {
      const d = await page.evaluate(() => { const g = window.__game, z = window.__pathZ; g.noise = 2.5; g.player.stats.health = 100; return z.obj.position.distanceTo(g.player.pos); });
      best = Math.min(best, d); await sleep(500); t += 500;
    }
    record('zombie-pathfinding', best <= 2.5, { closest: +best.toFixed(2), seconds: t / 1000, note: 'zombie placed behind a house; player noise forced so it hunts (test shortcut)' });
    await page.evaluate(() => { const g = window.__game; g.zombies.resetAll(); g.teleport(-60, 16); });
    await sleep(300);
  }

  // 4 woods loop on foot: park west gate -> trail -> woodshed (wood + axe) -> back to shelter
  if (want('woods')) {
    await route('park-to-woodshed', [[-70, 13], [-80, 12], [-92, 6], [-100, 4]]);
    s = await state();
    const woodBefore = s.inv.wood || 0;
    await walkTo(-103.4, 4, { tol: 0.8 }); await holdE(2900);
    s = await state();
    const woodAfter = s.inv.wood || 0;
    await walkTo(-101.0, 7.3, { tol: 0.6 }); await sleep(200); await tap('e'); await sleep(300);
    const s2 = await state();
    record('gather-wood', woodAfter - woodBefore >= 4, { woodBefore, woodAfter, prompt: s.prompt });
    record('take-axe', s2.tools.axe === true, { tools: s2.tools });
    await shot('03-woodshed', true);
    // chop a dead pine near the trail (needs the axe)
    await walkTo(-92, 5, { tol: 1.2 });
    const w0 = (await state()).inv.wood || 0;
    const rc = await walkTo(-86.7, 0.5, { tol: 0.8 });
    await holdE(3700);
    const sc = await state();
    record('chop-dead-pine', rc.ok && (sc.inv.wood || 0) >= w0 + 4, { woodBefore: w0, woodAfter: sc.inv.wood, prompt: sc.prompt });
    await shot('03b-chopped', true);
    await route('woodshed-to-shelter', [[-92, 6], [-80, 12], [-70, 13], [-60, 12]]);
  }

  // 5 store and use: stash deposit, fire fuel, upgrade
  if (want('shelter')) {
    await walkTo(-58.4, 8.2, { tol: 0.8 }); await tap('e'); await sleep(400);
    const before = await state();
    await page.click('#shelter-panel button[data-act="deposit"]'); await sleep(300);
    const after = await state();
    record('stash-deposit', (after.stash.wood || 0) > (before.stash.wood || 0) && !(after.inv.wood), { stashBefore: before.stash, stashAfter: after.stash });
    await shot('04-stash-panel', true);
    await page.keyboard.press('Escape'); await sleep(200);
    await walkTo(-62, 16.4, { tol: 0.8 });
    const f0 = (await state()).fire.fuel;
    await tap('e'); await sleep(300);
    const f1 = (await state()).fire.fuel;
    record('feed-fire', f1 > f0, { fuelBefore: f0, fuelAfter: f1 });
  }

  // 6 north loop: street -> police cruiser (pistol) -> pharmacy lot (combat) -> service road -> camp -> woods -> shelter
  if (want('north')) {
    await route('shelter-to-cruiser', [[-50, 12], [-46, 1], [-20, 0], [10, 0], [18, -10], [18, -40], [18.6, -54.8]]);
    await walkTo(18.2, -56.0, { tol: 0.7 }); await holdE(1500);
    s = await state();
    record('find-pistol', s.tools.pistol && (s.inv.ammo || 0) >= 4, { tools: s.tools, ammo: s.inv.ammo });
    await shot('05-police-cruiser', true);
    // move into the pharmacy lot and fight
    await walkTo(18, -70, { sprint: false });
    let kills = 0, shotsFired = 0, tookDamage = false; const hp0 = (await state()).stats.health;
    for (let k = 0; k < 14 && kills < 2; k++) {
      s = await state();
      if (s.dead) break;
      const zs = s.zombies.filter((z) => Math.hypot(z[0] - s.pos[0], z[1] - s.pos[1]) < 16);
      if (!zs.length) { await walkTo(18, -78, { sprint: false, timeout: 4000 }); continue; }
      zs.sort((a, b) => Math.hypot(a[0] - s.pos[0], a[1] - s.pos[1]) - Math.hypot(b[0] - s.pos[0], b[1] - s.pos[1]));
      const [zx, zz] = zs[0];
      const [sx, sy] = await screenPos(zx, 1.2, zz);
      await page.mouse.move(sx, sy);
      await page.mouse.down({ button: 'right' }); await sleep(1000);
      const [sx2, sy2] = await screenPos(zx, 1.2, zz); await page.mouse.move(sx2, sy2);
      if (k === 0) await shot('06-aiming', true);
      await page.mouse.down({ button: 'left' }); await sleep(60); await page.mouse.up({ button: 'left' }); shotsFired++;
      await sleep(250);
      await page.mouse.up({ button: 'right' });
      const s2 = await state();
      kills = await page.evaluate(() => window.__game.stats.kills);
      if (s2.stats.health < hp0) tookDamage = true;
    }
    s = await state();
    record('combat', kills >= 1 && !s.dead, { kills, shotsFired, ammoLeft: s.inv.ammo, health: s.stats.health, tookDamage });
    await shot('07-after-fight', true);
    // search pharmacy aisles (medkits) and heal if hurt
    const r = await walkTo(16, -86.8, { tol: 0.9, sprint: false });
    if (r.ok) { await holdE(3100); }
    s = await state();
    const hpBefore = s.stats.health;
    if ((s.inv.medkit || 0) > 0 && hpBefore < 100) { await tap('2'); await sleep(200); }
    const s3 = await state();
    record('pharmacy-loot', (s.inv.medkit || 0) >= 1 || (s.inv.food || 0) >= 1, { inv: s.inv, healedFrom: hpBefore, healedTo: s3.stats.health });
    await route('pharmacy-to-camp-to-woods-to-shelter', [[13, -73], [3, -73], [-20, -78], [-38, -76], [-60, -78], [-86, -78], [-94, -60], [-102, -36], [-104, -12], [-92, 6], [-80, 12], [-66, 14]]);
  }

  // 7 south loop: park south gate -> canal walk -> Hibiscus -> Coral Palm Dr -> beach -> back west
  if (want('south')) {
    await page.evaluate(() => { const g = window.__game; if (g.player.dead) return; }); // (no shortcuts)
    await route('shelter-to-canal', [[-61, 26], [-61, 32], [-52, 40], [-36, 50], [-24, 56], [0, 56.5], [30, 56.5]]);
    await shot('08-canal', true);
    await route('canal-to-beach', [[60, 56.5], [96, 56.5], [106, 52], [112, 40], [113, 10], [113, 2], [124, 0]]);
    await shot('09-beach', true);
    await walkTo(128, 4.8, { tol: 1.0 }); await holdE(2200);
    s = await state();
    record('driftwood', (s.inv.wood || 0) >= 1, { wood: s.inv.wood });
    await route('beach-to-shelter', [[113, 1.4], [108, 1.4], [80, 0], [40, 0], [0, 0], [-40, 0], [-46, 1], [-52, 10], [-60, 16]]);
    s = await state();
    record('areas-visited', s.areas.length >= 7, { areas: s.areas });
  }

  // 8 day / night / lantern / camera
  if (want('night')) {
    await page.evaluate(() => window.__game.teleport(-58, 22)); await sleep(300);
    const day = await shot('10-day', true);
    const [px, py] = await screenPos(-58, 0.5, 22);
    const lumDay = await luminanceAround(px, py);
    await tap('n'); await sleep(1500);
    s = await state();
    const nightOn = s.night;
    await page.evaluate(() => window.__game.teleport(-50, 34)); await sleep(500);
    const [qx, qy] = await screenPos(-50, 0.5, 34);
    const lumNightOff = await luminanceAround(qx, qy);
    await tap('l'); await sleep(700);
    const lumNightOn = await luminanceAround(qx, qy);
    s = await state();
    const night = await shot('11-night-lantern', true);
    record('day-night-lantern', nightOn && s.lanternOn && lumNightOn > lumNightOff + 4 && lumDay > lumNightOff, { lumDay: +lumDay.toFixed(1), lumNightOff: +lumNightOff.toFixed(1), lumNightOn: +lumNightOn.toFixed(1), day, night });
    const c0 = (await state()).cam;
    await page.mouse.move(640, 360); await page.mouse.wheel(0, 300); await sleep(500);
    const c1 = (await state()).cam;
    await tap('x'); await sleep(700); const c2 = (await state()).cam;
    await shot('12-camera-high-rotated', true);
    await tap('z'); await page.mouse.wheel(0, -300); await sleep(500);
    record('camera-controls', c1.level > c0.level && c2.yaw !== c1.yaw, { c0, c1, c2 });
    await tap('l'); await tap('n'); await sleep(500);
  }

  // 9 failure and recovery: drop the pack on death, wake at the shelter
  if (want('recovery')) {
    await page.evaluate(() => { const g = window.__game; g.teleport(10, 1); g.inv.add('food', 1); });
    await sleep(300);
    await page.evaluate(() => window.__game.player.hurt(999));  // test shortcut: simulate a fatal hit
    await sleep(5200);
    s = await state();
    const pack = await page.evaluate(() => window.__game.interact.list.some((i) => i.kind === 'pack' && !i.used));
    record('death-recovery', !s.dead && s.area === 'park' && pack && s.stats.health > 0, { pos: s.pos, pack, hp: s.stats.health, note: 'death triggered with player.hurt(999) as a test shortcut' });
    await shot('13-wake-at-shelter', true);
    await route('recover-pack', [[-52, 10], [-46, 1], [-10, 0], [9.5, 1]]);
    await holdE(1300);
    s = await state();
    record('pack-recovered', (s.inv.food || 0) >= 1, { inv: s.inv });
  }

  // 10 performance sample (real browser GPU in this run)
  s = await state();
  record('self-defense-during-travel', true, { encounters: defended, note: 'times the walker had to shoot or swing at a chasing zombie while travelling' });
  record('performance', s.fps >= 20, { fps: s.fps, worstFrameMs: s.worstFrame, loadMs: s.loadMs, note: 'fps sampled at the end of the desktop run' });
  record('no-console-errors', errors.length === 0, { errors: errors.slice(0, 5) });

  // 11 touch-sized layout (simulated phone viewport, not a real device)
  if (want('touch')) {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p2 = await m.newPage(); const errs2 = [];
    p2.on('pageerror', (e) => errs2.push(String(e)));
    await p2.goto(server.url + '?fresh=1&capture=1');
    await p2.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
    await p2.tap('#btn-start'); await sleep(800);
    const before = await p2.evaluate(() => window.__game.state().pos);
    const joy = await p2.locator('#joy').boundingBox();
    const cx = joy.x + joy.width / 2, cy = joy.y + joy.height / 2;
    // drag the joystick with pointer events
    await p2.evaluate(([cx, cy]) => {
      const el = document.getElementById('joy');
      const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
      ev('pointerdown', cx, cy); ev('pointermove', cx + 40, cy - 30);
      window.__joyEnd = () => ev('pointerup', cx, cy);
    }, [cx, cy]);
    await sleep(1600);
    await p2.evaluate(() => window.__joyEnd());
    const after = await p2.evaluate(() => window.__game.state().pos);
    const touchVisible = await p2.evaluate(() => !document.getElementById('touch').classList.contains('hidden'));
    await p2.screenshot({ path: path.join(SHOTS, '14-touch-layout.png') });
    record('touch-controls', touchVisible && Math.hypot(after[0] - before[0], after[1] - before[1]) > 1 && errs2.length === 0,
      { moved: +Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(2), touchVisible, errors: errs2.slice(0, 3), note: 'simulated 390x844 touch viewport in Chromium, not a physical phone' });
    await m.close();
  }
} catch (e) {
  record('harness-exception', false, { error: String(e.stack || e) });
} finally {
  const summary = { when: new Date().toISOString(), passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(summary, null, 2));
  log(`done: ${summary.passed} passed, ${summary.failed} failed`);
  await browser.close();
  server.stop();
}
