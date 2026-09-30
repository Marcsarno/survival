// Automated playtest for the opening-route slice. Drives the game in Chromium with real keyboard and
// pointer input: start screen, fixed camera, movement feel (acceleration, stopping), collisions, the
// route boundary, the gate, footprints, the full walk to the house, the end card, restart, and an
// emulated portrait touch phone. Writes playtest-output/results.json and screenshots to docs/screenshots/.
//
// Usage:  node tools/playtest.mjs [--headed] [--only=move,route,touch] [--url=http://localhost:5173/]
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
const want = (n) => !ONLY || ONLY.includes(n);

const results = []; const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
function record(name, pass, detail = {}) { results.push({ name, pass, ...detail }); log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(detail).slice(0, 320)); }

async function startServer() {
  if (argv.url) return { url: argv.url, stop: () => {} };
  const p = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: ROOT, shell: true });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('vite did not start')), 30000);
    p.stdout.on('data', (d) => { if (String(d).includes('5199')) { clearTimeout(to); res(); } });
  });
  return { url: 'http://localhost:5199/', stop: () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', p.pid, '/f', '/t']) : p.kill(); } catch {} } };
}

let page, errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => window.__game.state());
const held = new Set();
async function setKeys(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function tap(key, ms = 60) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
async function shot(name) { const f = path.join(SHOTS, `${name}.png`); await page.screenshot({ path: f }); return path.relative(ROOT, f).replace(/\\/g, '/'); }

/** Walk to (x,z) with WASD. The camera never rotates, so W is always north (-z) and D east (+x). */
let walked = 0;
async function walkTo(x, z, { tol = 1.3, timeout = 45000, keys: extra = [] } = {}) {
  const start = Date.now(); let lastD = Infinity, lastProgressT = Date.now(), side = 0, prev = await state();
  while (Date.now() - start < timeout) {
    const s = await state();
    walked += Math.hypot(s.pos[0] - prev.pos[0], s.pos[1] - prev.pos[1]); prev = s;
    const dx = x - s.pos[0], dz = z - s.pos[1], d = Math.hypot(dx, dz);
    if (d < tol || s.arrived) { await setKeys([]); return { ok: true, pos: s.pos }; }
    const keys = [...extra];
    if (-dz / d > 0.38) keys.push('w'); if (dz / d > 0.38) keys.push('s');
    if (dx / d > 0.38) keys.push('d'); if (-dx / d > 0.38) keys.push('a');
    await setKeys(keys);
    if (d < lastD - 0.3) { lastD = d; lastProgressT = Date.now(); }
    if (Date.now() - lastProgressT > 2500) { // stuck: sidestep and retry
      if (++side > 4) { await setKeys([]); return { ok: false, pos: s.pos, stuck: true }; }
      await setKeys([side % 2 ? 'a' : 'd']); await sleep(600); lastProgressT = Date.now(); lastD = Infinity;
    }
    await sleep(60);
  }
  await setKeys([]);
  return { ok: false, pos: prev.pos, timeout: true };
}
async function teleport(x, z) { await page.evaluate(([x, z]) => { const g = window.__game; g.player.setPosition(x, z, Math.PI); g.snapCamera(); }, [x, z]); await sleep(300); }

const server = await startServer();
const browser = await chromium.launch({ headless: !argv.headed, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = server.url + '?capture=1';

  // 1 load and the start card
  const tLoad = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
  const loadWall = Date.now() - tLoad;
  const ui = await page.evaluate(() => ({
    help: !document.getElementById('help').classList.contains('hidden'),
    removed: ['inventory', 'stats', 'btn-map', 'shelter-panel', 'goals', 'map-overlay', 'reticle'].filter((id) => document.getElementById(id)),
    zoomButtons: !!document.querySelector('[data-act="zoomIn"]'),
  }));
  record('load-and-start-card', ui.help, { loadWallMs: loadWall, gameLoadMs: (await state()).loadMs });
  record('no-inventory-or-survival-ui', ui.removed.length === 0 && !ui.zoomButtons, ui);
  await shot('01-start-card');
  await page.click('#btn-start'); await sleep(900);
  await shot('02-start');

  // 2 the camera is fixed: no rotation keys, no zoom, no orbit while walking
  if (want('camera')) {
    const camDir = async () => page.evaluate(() => { const g = window.__game, c = g.camera.cam.position, f = g.camera.focus; return [+(c.x - f.x).toFixed(3), +(c.z - f.z).toFixed(3)]; });
    const a = await camDir();
    for (const k of ['z', 'x', 'c', 'q', 'e']) await tap(k);
    await page.mouse.move(640, 360); await page.mouse.wheel(0, 400); await sleep(300);
    await setKeys(['d']); await sleep(900); await setKeys(['s']); await sleep(700); await setKeys([]); await sleep(400);
    const b = await camDir(), s = await state();
    record('camera-fixed-angle', Math.abs(a[0]) < 0.01 && Math.abs(b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && s.cam.yaw === 0, { before: a, after: b, note: 'camera offset from its focus has no x part: it always looks north' });
    await teleport(-2.4, 13.2);
  }

  // 3 movement feel: acceleration, top speed, stopping, idle prints
  if (want('move')) {
    await teleport(-6, 12); await sleep(400);
    const p0 = await state();
    await setKeys(['w']); await sleep(90);
    const s1 = await state(); await sleep(1100);
    const s2 = await state();
    await setKeys([]);
    const tRel = Date.now(); let s3 = await state(), stopMs = null;
    while (Date.now() - tRel < 1500) { s3 = await state(); if (s3.speed < 0.05) { stopMs = Date.now() - tRel; break; } await sleep(30); }
    const slide = Math.hypot(s3.pos[0] - s2.pos[0], s3.pos[1] - s2.pos[1]);
    record('movement-accelerates', s1.speed < s2.speed * 0.75 && s2.speed > 2.2, { speedAt90ms: s1.speed, speedAt1_2s: s2.speed, ground: s2.ground });
    record('movement-stops-reliably', stopMs !== null && stopMs < 600 && slide < 1.0, { stopMs, slideAfterRelease: +slide.toFixed(2) });
    record('moves-north-with-w', s2.pos[1] < p0.pos[1] - 2 && Math.abs(s2.pos[0] - p0.pos[0]) < 0.3, { from: p0.pos, to: s2.pos });
    const c0 = (await state()).prints; await sleep(2000); const c1 = (await state()).prints;
    record('no-footprints-while-standing', c0 === c1, { before: c0, after: c1 });
    // collision: push west into the shelter wall for 3 s
    await teleport(-10, 8); await setKeys(['a']); await sleep(2600);
    const w1 = await state(); await sleep(500); const w2 = await state(); await setKeys([]);
    record('collision-shelter-wall', w2.pos[0] > -12.8 && Math.abs(w2.pos[0] - w1.pos[0]) < 0.05, { x: w2.pos[0], wallAt: -13, note: 'pushed west into the low stucco wall' });
    // turning: reverse direction; the character should slow and turn rather than snap backwards at full speed
    await teleport(-4, 6); await setKeys(['w']); await sleep(900); await setKeys(['s']); await sleep(120);
    const t1 = await state(); await sleep(700); const t2 = await state(); await setKeys([]);
    record('turning-has-weight', t1.speed < 2.2 && Math.abs(Math.atan2(Math.sin(t2.yaw), Math.cos(t2.yaw))) < 0.6, { speedJustAfterReverse: t1.speed, yawAfter: t2.yaw, note: 'yaw 0 faces south (toward the camera)' });
    await teleport(-2.4, 13.2);
  }

  // 4 the route: shelter → street → gate (blocked, then opened) → woods → deep trail → house
  let arrival = null;
  if (want('route')) {
    await page.evaluate(() => window.__game.resetRoute(false)); await sleep(500);
    walked = 0;
    const W = await page.evaluate(() => window.__game.route.walk);
    const sections = new Set(); let ok = true, failAt = null, gateBlocked = null;
    const tWalk = Date.now();
    for (const [x, z, act] of W) {
      if (act === 'interact') {
        const r = await walkTo(x, z, { tol: 1.0 });
        // before opening: pushing north into the gate must not get through
        await setKeys(['w']); await sleep(1500); await setKeys([]);
        const g0 = await state(); gateBlocked = g0.pos[1] > -90 + 0.2 && !g0.gateOpen;
        await shot('03-gate-closed');
        await tap('e'); await sleep(1400);
        const g1 = await state();
        record('gate-blocks-then-opens', gateBlocked && g1.gateOpen, { zAgainstGate: g0.pos[1], promptWas: g0.prompt, opened: g1.gateOpen });
        if (!r.ok) { ok = false; failAt = [x, z]; break; }
        continue;
      }
      const r = await walkTo(x, z);
      const s = await state(); sections.add(s.section);
      if (s.section === 'street' && !sections.has('_shot2')) { sections.add('_shot2'); await shot('04-street'); }
      if (s.section === 'woods' && !sections.has('_shot3')) { sections.add('_shot3'); await shot('05-woods'); }
      if (s.section === 'deep' && !sections.has('_shot4')) { sections.add('_shot4'); await shot('06-deep-trail'); }
      if (s.section === 'house' && !sections.has('_shot5')) { sections.add('_shot5'); await shot('07-house-approach'); }
      if (!r.ok) { ok = false; failAt = [x, z, r]; break; }
      if (s.arrived) break;
    }
    await sleep(2800);
    arrival = await state();
    const wall = (Date.now() - tWalk) / 1000;
    record('route-walkable-to-house', ok && arrival.arrived, { failAt, sections: [...sections].filter((x) => !x.startsWith('_')), walkTime: arrival.walkTime, wallSeconds: +wall.toFixed(0), routeLength: arrival.routeLength, walkedMeters: +walked.toFixed(0) });
    const endVisible = await page.evaluate(() => !document.getElementById('endcard').classList.contains('hidden') && document.getElementById('end-time').textContent);
    record('end-of-slice-card', !!endVisible, { shownTime: endVisible });
    await shot('08-end-card');
    // footprints: count per distance, spacing and floating
    const pr = await page.evaluate(() => window.__game.printsSample(60));
    const maxFloat = Math.max(...pr.map((p) => Math.abs(p[1])));
    const gaps = []; for (let i = 2; i < pr.length; i++) gaps.push(Math.hypot(pr[i][0] - pr[i - 2][0], pr[i][2] - pr[i - 2][2]));
    const gait = arrival.gait;
    const maxStride = gait.Run.cycle / 2;
    record('footprints-follow-steps', arrival.prints > walked / (maxStride * 1.25) && maxFloat < 0.06 && Math.max(...gaps) < maxStride * 2 * 1.3 + 0.3,
      { prints: arrival.prints, walkedMeters: +walked.toFixed(0), metersPerPrint: +(walked / arrival.prints).toFixed(2), walkClip: gait.Walk, runClip: gait.Run, maxHeightAboveGround: maxFloat, maxSameFootGap: +Math.max(...gaps).toFixed(2), pool: 700 });
    // restart from the end card
    await page.click('#btn-again'); await sleep(1500);
    const rs = await state();
    record('restart-resets-route', Math.hypot(rs.pos[0] + 2.4, rs.pos[1] - 13.2) < 0.2 && !rs.gateOpen && !rs.arrived && rs.prints === 0 && rs.walkTime === 0 && !rs.modal, { pos: rs.pos, gateOpen: rs.gateOpen, prints: rs.prints, modal: rs.modal });
  }

  // 5 route boundaries in the woods and deep trail: push sideways, stay inside the corridor
  if (want('bounds')) {
    const out = [];
    for (const [x, z] of [[-14, -122], [4, -170], [-12, -242]]) {
      for (const k of ['a', 'd']) {
        await teleport(x, z); await setKeys([k]); await sleep(3500); await setKeys([]);
        const s = await state(); out.push({ at: [x, z], key: k, lat: s.lat, w: s.w, pos: s.pos });
      }
    }
    record('route-boundaries-hold', out.every((o) => o.lat <= o.w + 0.05), { samples: out.map((o) => `${o.key}@${o.at}: lat ${o.lat}/${o.w}`) });
    await teleport(-12, -120); await sleep(600); await shot('09-woods-boundary');
  }

  // 6 performance on desktop GPU (headless Chromium)
  const perf = await state();
  record('performance-desktop', perf.fps >= 45, { fps: perf.fps, worstFrameMs: perf.worstFrame, note: 'desktop GPU; screenshots cause some of the worst-frame spikes' });
  record('no-console-errors', errors.length === 0, { errors: errors.slice(0, 5) });

  // 7 emulated portrait phone: touch joystick, buttons, no page scroll (not a physical phone)
  if (want('touch')) {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p2 = await m.newPage(); const errs2 = [];
    p2.on('pageerror', (e) => errs2.push(String(e)));
    await p2.goto(server.url + '?capture=1');
    await p2.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
    await p2.tap('#btn-start'); await sleep(800);
    const before = await p2.evaluate(() => window.__game.state().pos);
    // thumb down low on the left side (floating stick), drag up
    await p2.evaluate(() => {
      const el = document.getElementById('joy-zone');
      const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
      ev('pointerdown', 110, 690); ev('pointermove', 112, 630);
      window.__joyEnd = () => ev('pointerup', 112, 630);
    });
    await sleep(1800);
    const mid = await p2.screenshot({ path: path.join(SHOTS, '10-touch-walking.png') });
    await p2.evaluate(() => window.__joyEnd());
    await sleep(600);
    const after = await p2.evaluate(() => window.__game.state().pos);
    // try to scroll / zoom the page with touch gestures
    await p2.touchscreen.tap(200, 300);
    await p2.mouse.wheel(0, 600);
    const scroll = await p2.evaluate(() => ({ y: scrollY, top: document.scrollingElement.scrollTop, scale: visualViewport?.scale ?? 1 }));
    const touchVisible = await p2.evaluate(() => !document.getElementById('touch').classList.contains('hidden'));
    const moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
    record('touch-joystick-walks-north', touchVisible && moved > 2 && after[1] < before[1] && errs2.length === 0, { moved: +moved.toFixed(2), dz: +(after[1] - before[1]).toFixed(2), note: 'emulated 390x844 touch viewport in Chromium, not a physical phone' });
    record('no-page-scroll-or-zoom', scroll.y === 0 && scroll.top === 0 && scroll.scale === 1, scroll);
    // the E button lights up at the gate
    await p2.evaluate(() => { const g = window.__game; g.player.setPosition(3, -87.4, Math.PI); g.snapCamera(); });
    await sleep(700);
    const ready = await p2.evaluate(() => document.querySelector('#touch [data-act="interact"]').classList.contains('ready'));
    await p2.tap('#touch [data-act="interact"]'); await sleep(900);
    const opened = await p2.evaluate(() => window.__game.state().gateOpen);
    await p2.screenshot({ path: path.join(SHOTS, '11-touch-gate.png') });
    record('touch-interact-button', ready && opened, { eButtonLit: ready, gateOpened: opened });
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
