// Captures screenshots and short motion clips for the visual project hub (hub/).
//
// Usage:  node tools/capture.mjs --set=<name> [--url=http://localhost:5173/] [--only=phone-start,clip-walk-stop]
// Writes hub/media/<set>/*.png, *.webm and capture.json (test conditions). Without --url it starts
// its own Vite dev server on port 5198. Clips are recorded from the game canvas with MediaRecorder,
// so they contain the 3D view only (no HUD) and start after loading.
//
// Two scene lists: "baseline" drives the old sandbox build (tag baseline-sandbox-2026-09-30);
// any other set drives the opening-slice route using the checkpoints the game exposes.
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SET = argv.set || 'slice';
const OUT = path.join(ROOT, 'hub', 'media', SET);
fs.mkdirSync(OUT, { recursive: true });
const ONLY = argv.only ? String(argv.only).split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[capture]', ...a);

async function startServer() {
  if (argv.url) return { url: argv.url, stop: () => {} };
  const p = spawn('npx', ['vite', '--port', '5198', '--strictPort'], { cwd: ROOT, shell: true });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('vite did not start')), 30000);
    p.stdout.on('data', (d) => { if (String(d).includes('5198')) { clearTimeout(to); res(); } });
  });
  return { url: 'http://localhost:5198/', stop: () => { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', p.pid, '/f', '/t']) : p.kill(); } catch {} } };
}

const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 720 } },
};

const server = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const meta = { set: SET, date: new Date().toISOString(), commit: tryGit('git rev-parse --short HEAD'), url: server.url, items: [] };
function tryGit(cmd) { try { return execSync(cmd, { cwd: ROOT }).toString().trim(); } catch { return null; } }

async function open(view, query) {
  const ctx = await browser.newContext(VIEWS[view]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(server.url + '?fresh=1&autostart=1&' + query);
  await page.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
  await sleep(1500);
  return { ctx, page, errors };
}
const st = (page) => page.evaluate(() => window.__game.state());

const held = new Set();
async function setKeys(page, keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
/** Walk toward (x,z) with WASD relative to the camera's yaw (works for the old rotated camera and the fixed one). */
async function walkTo(page, x, z, { tol = 1.2, timeout = 40000, extra = [] } = {}) {
  const t0 = Date.now(); let lastD = Infinity, lastT = Date.now(), side = 0;
  while (Date.now() - t0 < timeout) {
    const s = await st(page);
    if (s.arrived) { await setKeys(page, []); return true; }
    const dd = Math.hypot(x - s.pos[0], z - s.pos[1]);
    if (dd < lastD - 0.3) { lastD = dd; lastT = Date.now(); }
    if (Date.now() - lastT > 2000) { // stuck: log it, sidestep and retry (like a player would)
      log('stuck near', s.pos, 'heading for', [x, z]); meta.stuck = [...(meta.stuck || []), { pos: s.pos, target: [x, z] }];
      if (++side > 4) { await setKeys(page, []); return false; }
      await setKeys(page, [side % 2 ? 'a' : 'd']); await sleep(600); lastT = Date.now(); lastD = Infinity;
    }
    const yaw = await page.evaluate(() => window.__game.camera.yaw || 0);
    const F = [-Math.sin(yaw), -Math.cos(yaw)], R = [Math.cos(yaw), -Math.sin(yaw)];
    const dx = x - s.pos[0], dz = z - s.pos[1], d = Math.hypot(dx, dz);
    if (d < tol) { await setKeys(page, []); return true; }
    const f = (dx * F[0] + dz * F[1]) / d, r = (dx * R[0] + dz * R[1]) / d;
    const keys = [...extra];
    if (f > 0.38) keys.push('w'); if (f < -0.38) keys.push('s');
    if (r > 0.38) keys.push('d'); if (r < -0.38) keys.push('a');
    await setKeys(page, keys);
    await sleep(60);
  }
  await setKeys(page, []);
  return false;
}

async function shot(page, name, note, view) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  meta.items.push({ type: 'image', name, file: `media/${SET}/${name}.png`, view, note, pos: (await st(page)).pos });
  log('shot', name);
}

async function clip(page, name, note, view, body) {
  await page.evaluate(() => {
    const c = document.getElementById('game');
    const stream = c.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
    window.__rec = { r, chunks: [] };
    r.ondataavailable = (e) => { if (e.data.size) window.__rec.chunks.push(e.data); };
    r.start(250);
  });
  const t0 = Date.now();
  const fps0 = await page.evaluate(() => window.__game.perf.fps);
  await body();
  const dur = (Date.now() - t0) / 1000;
  const b64 = await page.evaluate(async () => {
    const { r, chunks } = window.__rec;
    await new Promise((res) => { r.onstop = res; r.stop(); });
    const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  fs.writeFileSync(path.join(OUT, `${name}.webm`), Buffer.from(b64, 'base64'));
  const fps1 = await page.evaluate(() => window.__game.perf.fps);
  meta.items.push({ type: 'video', name, file: `media/${SET}/${name}.webm`, view, note, seconds: +dur.toFixed(1), fps: [fps0, fps1] });
  log('clip', name, dur.toFixed(1) + 's');
}

/** Standard motion test used for every set, so clips are comparable: walk up-screen, stop, then turn in a square. */
async function motionTest(page) {
  await setKeys(page, ['w']); await sleep(3000);
  await setKeys(page, []); await sleep(1300);
  for (const k of ['d', 's', 'a', 'w']) { await setKeys(page, [k]); await sleep(1100); }
  await setKeys(page, []); await sleep(1200);
}

try {
  if (SET === 'baseline') {
    const B = [
      ['phone-start', 'phone', '', 'Start at the pavilion shelter, default camera (yaw 45°, phone default height level).'],
      ['phone-street', 'phone', 'at=40,1', 'Coral Palm Drive, the main street.'],
      ['phone-woods', 'phone', 'at=-100,8', 'Slash Pine Woods by the woodshed.'],
      ['desktop-start', 'desktop', '', 'Desktop start view (1280×720).'],
      ['desktop-street', 'desktop', 'at=40,1', 'Desktop view of the street.'],
    ];
    for (const [name, view, q, note] of B) {
      if (!want(name)) continue;
      const { ctx, page } = await open(view, q);
      await shot(page, name, note, view);
      await ctx.close();
    }
    if (want('clip-walk-stop')) {
      const { ctx, page, errors } = await open('phone', 'at=-60,20');
      await clip(page, 'clip-walk-stop', 'Motion test: W for 3 s, release, then D/S/A/W 1.1 s each. Keyboard input in a 390×844 emulated phone viewport.', 'phone', () => motionTest(page));
      await shot(page, 'phone-after-motion', 'Footprints left by the motion test.', 'phone');
      if (errors.length) meta.errors = errors;
      await ctx.close();
    }
  } else {
    // opening slice: checkpoints come from the game (window.__game.route)
    const { ctx, page, errors } = await open('phone', '');
    const route = await page.evaluate(() => window.__game.route.marks);
    if (want('phone-start')) await shot(page, 'phone-start', 'Start at the shelter.', 'phone');
    if (want('clip-walk-stop')) {
      await clip(page, 'clip-walk-stop', 'Motion test: W for 3 s, release, then D/S/A/W 1.1 s each. Keyboard input in a 390×844 emulated phone viewport.', 'phone', () => motionTest(page));
      await shot(page, 'phone-after-motion', 'Footprints left by the motion test.', 'phone');
    }
    await ctx.close();
    if (want('clip-gait-close')) {
      // a test-only close camera (?cam=) so the feet and prints can be judged; not the game camera
      const o = await open('phone', 'cam=34,7,0.6,0&at=-8.5,15');
      await clip(o.page, 'clip-gait-close', 'Close test camera (?cam=34,7,0.6,0): walk north 2.5 s, jog (Shift) 2 s, release, then D and S. Keyboard input.', 'phone', async () => {
        await setKeys(o.page, ['w']); await sleep(2500); await setKeys(o.page, ['w', 'Shift']); await sleep(2000);
        await setKeys(o.page, []); await sleep(1200); await setKeys(o.page, ['d']); await sleep(900); await setKeys(o.page, ['s']); await sleep(1000); await setKeys(o.page, []); await sleep(900);
      });
      await shot(o.page, 'phone-gait-close', 'Close test camera: prints left by the gait clip.', 'phone');
      meta.gait = (await st(o.page)).gait;
      await o.ctx.close();
    }
    for (const m of route) {
      const name = `phone-${m.id}`;
      if (!want(name)) continue;
      const o = await open('phone', `at=${m.x},${m.z}`);
      await shot(o.page, name, m.note, 'phone');
      await o.ctx.close();
    }
    if (want('desktop-start')) { const o = await open('desktop', ''); await shot(o.page, 'desktop-start', 'Desktop start view (1280×720).', 'desktop'); await o.ctx.close(); }
    if (want('clip-route')) {
      // the whole route, walked with keyboard toward each waypoint in turn (recorded in two halves to keep files small)
      const o = await open('phone', '');
      const wps = await o.page.evaluate(() => window.__game.route.walk);
      const half = Math.ceil(wps.length / 2);
      for (const [part, list] of [['a', wps.slice(0, half)], ['b', wps.slice(half)]]) {
        await clip(o.page, `clip-route-${part}`, `Route walk part ${part.toUpperCase()}: keyboard steering toward route waypoints (agent-driven, not a human player).`, 'phone', async () => {
          for (const [x, z, act] of list) {
            await walkTo(o.page, x, z, { tol: 1.6 });
            if (act === 'interact') { await o.page.keyboard.down('e'); await sleep(900); await o.page.keyboard.up('e'); await sleep(600); }
          }
        });
      }
      await shot(o.page, 'phone-arrival', 'After walking the whole route: the arrival state.', 'phone');
      meta.routeState = await st(o.page);
      await o.ctx.close();
    }
    if (errors.length) meta.errors = errors;
  }
} finally {
  const prev = fs.existsSync(path.join(OUT, 'capture.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'capture.json'))) : null;
  if (prev && ONLY) { const names = new Set(meta.items.map((i) => i.name)); meta.items = [...prev.items.filter((i) => !names.has(i.name)), ...meta.items]; }
  fs.writeFileSync(path.join(OUT, 'capture.json'), JSON.stringify(meta, null, 2));
  await browser.close();
  server.stop();
}
