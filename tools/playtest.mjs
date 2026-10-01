// Compact automated playtest for the opening (neighborhood pass). Drives the game in Chromium with real
// keyboard and pointer input: load and start, the fixed camera, Marc's walk, collisions, the locked gate,
// the climb and climbing back, the run after her call, mud against firm ground, the swing and the tree
// sway still moving, a full play-through to the end card with beat times, restart, muted play, and an
// emulated portrait touch phone. Agent-driven, not a human playtest.
//
// Usage: node tools/playtest.mjs [--url=http://localhost:5173/] [--headed]
// Without --url it starts its own Vite dev server on port 5199. Results: playtest-output/results.json.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'playtest-output'), SHOTS = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const results = [], runs = {}, t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const record = (name, pass, detail = {}) => { results.push({ name, pass, ...detail }); log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(detail).slice(0, 300)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  if (argv.url) return { url: argv.url, stop: () => {} };
  const p = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: ROOT, shell: true });
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('vite did not start')), 30000); p.stdout.on('data', (d) => { if (String(d).includes('5199')) { clearTimeout(to); res(); } }); });
  return { url: 'http://localhost:5199/', stop: () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', p.pid, '/f', '/t']) : p.kill(); } catch {} } };
}

let page; const errors = [];
const state = (pg = page) => pg.evaluate(() => window.__game.state());
const held = new Set();
async function setKeys(keys) { for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); } for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } }
async function teleport(x, z) { await page.evaluate(([x, z]) => { const g = window.__game; g.player.setPosition(x, z, Math.PI); g.snapCamera(); }, [x, z]); await sleep(250); }
async function walkTo(x, z, want) {
  const start = Date.now(); let best = Infinity, bestT = Date.now(), side = 0;
  while (Date.now() - start < 60000) {
    const s = await state();
    if (s.story.flags.stay != null) { await setKeys([]); return true; }
    if (want && s.prompt?.includes(want)) { await setKeys([]); return true; }
    if (s.frozen || s.seq) { await setKeys([]); await sleep(100); bestT = Date.now(); continue; }
    const dx = x - s.pos[0], dz = z - s.pos[1], d = Math.hypot(dx, dz);
    if (d < (want ? 0.3 : 1.0)) { await setKeys([]); return true; }
    const keys = []; if (-dz / d > 0.38) keys.push('w'); if (dz / d > 0.38) keys.push('s'); if (dx / d > 0.38) keys.push('d'); if (-dx / d > 0.38) keys.push('a');
    await setKeys(keys);
    if (d < best - 0.2) { best = d; bestT = Date.now(); }
    if (Date.now() - bestT > 3000) { if (++side > 4) { await setKeys([]); return false; } await setKeys([side % 2 ? 'a' : 'd']); await sleep(600); bestT = Date.now(); best = Infinity; }
    await sleep(60);
  }
  await setKeys([]); return false;
}
async function fresh(q = '') { await page.goto(server.url + '?capture=1' + q); await page.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 }); }

const server = await startServer();
const browser = await chromium.launch({ headless: !argv.headed, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const tl = Date.now(); await fresh(); const loadWall = Date.now() - tl;
  const s0 = await state();
  record('load-and-start-card', s0.modal === 'help', { loadWallMs: loadWall, gameLoadMs: s0.loadMs });
  await page.click('#btn-start'); await sleep(1200);
  const s1 = await state();
  record('audio-starts-on-start-click', s1.audio.state === 'running', { audio: s1.audio.state });
  record('starts-in-the-neighborhood-mid-search', s1.story.flags.search != null && s1.subtitle === 'Marc: Arianna?' && s1.section === 'street', { subtitle: s1.subtitle, section: s1.section, ground: s1.ground });
  await page.screenshot({ path: path.join(SHOTS, 'p3-01-start.png') });

  // camera never rotates
  const camDir = () => page.evaluate(() => { const g = window.__game, c = g.camera.cam.position, f = g.camera.focus; return [+(c.x - f.x).toFixed(3), +(c.z - f.z).toFixed(3)]; });
  const a = await camDir(); for (const k of ['q', 'z', 'x']) await page.keyboard.press(k); await page.mouse.wheel(0, 400);
  await setKeys(['d']); await sleep(800); await setKeys([]); await sleep(300);
  const b = await camDir();
  record('camera-fixed-angle', Math.abs(a[0]) < 0.01 && Math.abs(b[0]) < 0.01, { before: a, after: b });

  // the walk while searching: a methodical pace (Shift does nothing)
  await teleport(-1.0, 3.6); await setKeys(['d']); await sleep(2500); const w1 = await state(); await setKeys(['d', 'Shift']); await sleep(1200); const w2 = await state(); await setKeys([]);
  record('methodical-walk-while-searching', w1.speed > 1.0 && w1.speed < 1.45 && w2.speed < 1.45 && !w1.running, { walkSpeed: w1.speed, withShift: w2.speed, clipNaturalSpeed: w1.walkSpeed });
  // collisions: the boarded house wall and the neighbor's fence along the side passage, the car
  await teleport(2.6, -13); await setKeys(['a']); await sleep(2000); const c1 = await state(); await setKeys([]);
  await teleport(2.6, -13); await setKeys(['d']); await sleep(2000); const c2 = await state(); await setKeys([]);
  await teleport(1.4, -0.8); await setKeys(['d']); await sleep(2000); const c3 = await state(); await setKeys([]);
  record('collisions-hold', c1.pos[0] > 1.0 && c2.pos[0] < 4.2 && c3.pos[0] < 2.4, { houseWallX: c1.pos[0], fenceX: c2.pos[0], carX: c3.pos[0] });

  // the gate: locked first, then climbed; no getting through otherwise; and back over from the far side
  await teleport(1.0, -32.9); await setKeys(['w']); await sleep(1500); const g0 = await state(); await setKeys([]);
  await page.keyboard.press('e'); await sleep(4200); const g1 = await state();
  await page.keyboard.press('e'); await sleep(3600); const g2 = await state();
  record('gate-locked-then-climb', g0.pos[1] > -34 && g1.story.flags.locked != null && g1.prompt?.includes('Climb') && g2.pos[1] < -34.4 && Math.abs(g2.y) < 0.02 && !g2.seq,
    { againstGateZ: g0.pos[1], promptAfterTry: g1.prompt, afterClimb: g2.pos, y: g2.y });
  await setKeys(['s']); await sleep(900); await setKeys([]); await page.keyboard.press('e'); await sleep(3600); const g3 = await state();
  record('backtrack-over-the-gate', g3.pos[1] > -33.8 && !g3.seq && Math.abs(g3.y) < 0.02, { afterClimbBack: g3.pos });

  // after her call he runs; mud drags at him, the firm way does not
  const run = async (x, z, keys, ms) => { await teleport(x, z); await page.evaluate(() => { window.__game.player.running = true; }); await setKeys(keys); await sleep(ms); const r = await state(); await setKeys([]); await page.evaluate(() => { window.__game.player.running = false; }); return r; };
  const firm = await run(9.9, -52.2, ['w'], 1600), mud = await run(2.25, -52.8, ['w'], 1800);
  record('run-and-mud', firm.speed > 2.5 && firm.ground === 'concrete' && mud.ground === 'mud' && mud.speed < 1.4 && mud.speed > 0.6, { firmSpeed: firm.speed, firmGround: firm.ground, mudSpeed: mud.speed, mudGround: mud.ground, runClipSpeed: firm.runSpeed });

  // the world still moves on its own: the swing sways, the trees sway (wind shader on the leaf materials)
  const wm = await page.evaluate(async () => {
    const g = window.__game, sw = g.level.dynamic.swings[0], a = sw.rotation.x, t0 = performance.now();
    await new Promise((r) => setTimeout(r, 600));
    const leaves = []; g.scene.traverse((o) => { if (o.isMesh && ['Leaves', 'LeavesAutumn', 'PalmFrond'].includes(o.material?.name)) leaves.push(o.material.customProgramCacheKey()); });
    return { swingA: +a.toFixed(3), swingB: +sw.rotation.x.toFixed(3), leafMaterials: leaves.length, wind: leaves.every((k) => k.includes('wind')), ms: Math.round(performance.now() - t0) };
  });
  record('swing-and-trees-still-move', Math.abs(wm.swingA - wm.swingB) > 0.01 && wm.leafMaterials > 0 && wm.wind, wm);

  // a full play-through with normal controls
  await fresh(); await page.click('#btn-start'); await sleep(400);
  const W = await page.evaluate(() => window.__game.route.walk);
  await page.evaluate(() => { window.__samples = []; setInterval(() => { const g = window.__game; window.__samples.push({ speed: g.player.speed, running: g.player.running, ground: g.groundAt(g.player.pos.x, g.player.pos.z), urgent: g.story.flags.urgency != null, revealed: g.story.flags.reveal != null }); }, 200); });
  let failAt = null; const tw = Date.now();
  for (const [x, z, act] of W) {
    const want = act === 'bunny' ? 'Pick it up' : act === 'gate' ? ((await state()).prompt?.includes('Climb') ? 'Climb' : 'gate') : null;
    const r = await walkTo(x, z, want);
    if (!r) { failAt = [x, z]; break; }
    if (act) { await page.keyboard.press('e'); for (let i = 0; i < 60; i++) { const s = await state(); if (!s.seq && !s.frozen) break; await sleep(100); } await sleep(300); }
    if ((await state()).story.flags.stay != null) break;
  }
  for (let i = 0; i < 80; i++) { if ((await state()).modal === 'end') break; await sleep(150); }
  const end = await state();
  runs.full = { beats: end.story.beats, endTime: end.story.time, lines: end.story.history, wallSeconds: +((Date.now() - tw) / 1000).toFixed(0) };
  const ids = end.story.beats.map((x) => x.id);
  const need = ['search', 'prints', 'call2', 'creak', 'locked', 'over', 'park', 'bunny', 'urgency', 'fork', 'reveal', 'argument', 'stay', 'end'];
  const overlap = end.story.history.some((h, i) => i && h.start < end.story.history[i - 1].end - 0.01);
  record('play-through-to-the-end', !failAt && end.modal === 'end' && need.every((n) => ids.includes(n)) && !overlap,
    { failAt, endTime: end.story.time, beats: end.story.beats.map((x) => `${x.id}@${x.t}`).join(' '), missing: need.filter((n) => !ids.includes(n)), overlap });
  await page.screenshot({ path: path.join(SHOTS, 'p3-09-end-card.png') });
  const smp = await page.evaluate(() => window.__samples), searching = smp.filter((x) => !x.urgent), runPart = smp.filter((x) => x.urgent && !x.revealed && x.ground !== 'mud');
  const maxB = Math.max(...searching.map((x) => x.speed)), maxR = Math.max(0, ...runPart.map((x) => x.speed));
  record('searching-walk-then-run', maxB < 1.5 && maxR > 2.5, { maxSpeedWhileSearching: +maxB.toFixed(2), maxSpeedAfterHerCall: +maxR.toFixed(2), way: end.story.beats.find((x) => x.id === 'fork')?.way });
  await page.click('#btn-again'); await sleep(1500);
  const rs = await state();
  record('restart-resets', Math.hypot(rs.pos[0] - 0.8, rs.pos[1] + 0.3) < 0.3 && rs.story.beats.length <= 1 && !rs.carrying && !rs.running && !rs.modal && rs.prompt == null, { pos: rs.pos, beats: rs.story.beats.map((x) => x.id), running: rs.running });

  // muted: the text carries every line (there are no voices)
  await page.click('#btn-mute'); await sleep(2200); const m = await state();
  record('muted-play-has-text', m.audio.muted && m.story.history.length >= 1, { muted: m.audio.muted, lines: m.story.history.length });
  const perf = await state();
  record('performance-desktop', perf.fps >= 45, { fps: perf.fps, worstFrameMs: perf.worstFrame, drawCalls: perf.calls, tris: perf.tris, note: 'desktop GPU, headless Chromium' });
  record('no-console-errors', errors.length === 0, { errors: errors.slice(0, 5) });

  // emulated portrait phone
  const mc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await mc.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(String(e)));
  await p2.goto(server.url + '?capture=1'); await p2.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
  await p2.tap('#btn-start'); await sleep(800);
  const before = await state(p2);
  await p2.evaluate(() => { const el = document.getElementById('joy-zone'); const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true })); ev('pointerdown', 110, 690); ev('pointermove', 112, 620); window.__joyEnd = () => ev('pointerup', 112, 620); });
  await sleep(2200); await p2.screenshot({ path: path.join(SHOTS, 'p3-10-touch.png') }); await p2.evaluate(() => window.__joyEnd()); await sleep(600);
  const after = await state(p2);
  await p2.evaluate(() => { const g = window.__game; g.player.setPosition(2.3, -46.9, Math.PI); g.snapCamera(); }); await sleep(500);
  const lit = await p2.evaluate(() => document.querySelector('#touch [data-act="interact"]').classList.contains('ready'));
  await p2.tap('#touch [data-act="interact"]'); await sleep(1500);
  const bun = await state(p2);
  record('touch-walk-and-interact', after.pos[1] < before.pos[1] - 1 && lit && bun.carrying && e2.length === 0, { moved: +(before.pos[1] - after.pos[1]).toFixed(2), eLitAtBunny: lit, carrying: bun.carrying, note: 'emulated 390x844, not a physical phone' });
  await mc.close();
} catch (e) {
  record('harness-exception', false, { error: String(e.stack || e) });
} finally {
  const summary = { when: new Date().toISOString(), passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results, runs };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(summary, null, 2));
  log(`done: ${summary.passed} passed, ${summary.failed} failed`);
  await browser.close(); server.stop();
}
