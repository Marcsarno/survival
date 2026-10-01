// Captures screenshots and short motion clips for the visual project hub (hub/).
//
// Usage:  node tools/capture.mjs --set=<name> [--url=http://localhost:5173/] [--only=phone-start,clip-walk-stop]
// Writes hub/media/<set>/*.png, *.webm and capture.json (test conditions). Without --url it starts
// its own Vite dev server on port 5198. Clips are recorded from the game canvas with MediaRecorder,
// so they contain the 3D view only (no HUD) and start after loading.
//
// Two scene lists: "baseline" drives the old sandbox build (tag baseline-sandbox-2026-09-30);
// any other set plays the redesigned opening on an emulated phone (the slice-v1 sets came from the
// long-route build at tag baseline-opening-route-2026-09-30, whose capture flow is in that tag).
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fixWebmDuration } from './webm-duration.mjs';

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
async function walkTo(page, x, z, { tol = 1.2, timeout = 40000, extra = [], autoRun = false, stopOn = null, each = null } = {}) {
  const t0 = Date.now(); let lastD = Infinity, lastT = Date.now(), side = 0;
  while (Date.now() - t0 < timeout) {
    const s = await st(page);
    if (s.arrived || s.story?.flags?.stay != null || (stopOn && stopOn(s))) { await setKeys(page, []); return true; }
    if (each) { await setKeys(page, []); await each(); lastT = Date.now(); } // stand still while a screenshot is taken
    if (s.frozen || s.traversing) { await setKeys(page, []); await sleep(80); lastT = Date.now(); continue; }
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
    if (autoRun && s.story?.runUnlocked) keys.push('Shift');
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

async function clip(page, name, note, view, body, bitrate = 3_000_000) {
  await page.evaluate((bitrate) => {
    const c = document.getElementById('game');
    const stream = c.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    window.__rec = { r, chunks: [] };
    r.ondataavailable = (e) => { if (e.data.size) window.__rec.chunks.push(e.data); };
    r.start(250);
  }, bitrate);
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
  fixWebmDuration(path.join(OUT, `${name}.webm`), dur); // MediaRecorder leaves the duration out; players need it to seek
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
    // the redesigned opening, played through on an emulated phone with keyboard input (agent-driven)
    const o = await open('phone', '');
    const page = o.page;
    if (want('phone-search')) await shot(page, 'phone-search', 'Start, mid-search: "Arianna?" and small prints across the mud toward the broken fence.', 'phone');
    const W = await page.evaluate(() => window.__game.route.walkMud);
    const beatShots = { log: ['phone-trunk', 'The trunk across the passage; the E prompt teaches stepping over.'], urgency: ['phone-call', 'Arianna calls from ahead; running is revealed as Marc answers.'],
      split: ['phone-split', 'The split: the muddy direct route (her prints) and the sidewalk curving round.'], reveal: ['phone-reveal', 'Rounding the car: the house through the open gate; the figure has left the window.'],
      argument: ['phone-yard-voices', 'The yard approach: voices inside (placeholder lines).'], stay: ['phone-stay', '"Stay there." Marc stops; the door opens a crack.'] };
    const taken = new Set();
    const snap = async () => {
      const s = await st(page);
      for (const [id, [name, note]] of Object.entries(beatShots)) if (s.story.flags[id] != null && !taken.has(id) && want(name)) { taken.add(id); await sleep(id === 'urgency' ? 300 : id === 'argument' ? 400 : id === 'reveal' ? 1300 : 0); await shot(page, name, note, 'phone'); }
      if (!taken.has('figure') && s.pos[1] < -65.6 && s.story.flags.reveal == null && want('phone-figure')) { taken.add('figure'); await shot(page, 'phone-figure', 'On the road, before rounding the car: a figure in the lit window.', 'phone'); }
      if (!taken.has('mud') && s.ground === 'mud' && s.pos[1] < -55 && want('phone-mud-tracks')) { taken.add('mud'); await shot(page, 'phone-mud-tracks', 'Running in the mud: slow going; Marc leaves tracks beside her small prints.', 'phone'); }
    };
    const walk = async (pts) => {
      for (const [x, z, act] of pts) {
        const label = act === 'vault' ? 'Step over' : act === 'bunny' ? 'Pick it up' : null;
        await walkTo(page, x, z, { tol: act ? 0.3 : 1.1, autoRun: true, stopOn: label ? (s) => s.prompt?.includes(label) : null, each: snap });
        if (act) {
          if (act === 'vault' && want('phone-trunk-prompt')) await shot(page, 'phone-trunk-prompt', 'At the trunk: E Step over.', 'phone');
          if (act === 'bunny' && want('phone-bunny')) await shot(page, 'phone-bunny', 'The bunny by the broken fence and a snapped branch: E Pick it up.', 'phone');
          await page.keyboard.down('e'); await sleep(90); await page.keyboard.up('e'); await sleep(1300);
          if (act === 'bunny' && want('phone-bunny-found')) await shot(page, 'phone-bunny-found', '"She wouldn’t leave this." The bunny stays in Marc’s hand.', 'phone');
        }
        await snap();
        if ((await st(page)).story.flags.stay != null) break;
      }
    };
    const iA = W.findIndex((p) => p[2] === 'bunny') + 1, iB = W.findIndex((p) => p[0] === -2.0 && p[1] === -62.5) + 1;
    if (want('clip-opening')) {
      await clip(page, 'clip-opening-a', 'Play-through A: start → trunk → bunny (keyboard, agent steering).', 'phone', () => walk(W.slice(0, iA)), 1_000_000);
      await clip(page, 'clip-opening-b', 'Play-through B: the call, running, the mud route (keyboard, agent steering).', 'phone', () => walk(W.slice(iA, iB)), 1_000_000);
      await clip(page, 'clip-opening-c', 'Play-through C: the car, the reveal, the yard, "Stay there." (keyboard, agent steering).', 'phone', async () => { await walk(W.slice(iB)); for (let i = 0; i < 60 && (await st(page)).story.flags.end == null; i++) { await snap(); await sleep(150); } }, 1_000_000);
    } else await walk(W);
    for (let i = 0; i < 40 && (await st(page)).modal !== 'end'; i++) await sleep(200);
    if (want('phone-end')) await shot(page, 'phone-end', 'The end-of-slice card with the time of each beat.', 'phone');
    meta.playthrough = { route: 'mud', beats: (await st(page)).story.beats, lines: (await st(page)).story.history, endTime: (await st(page)).story.time };
    if (o.errors.length) meta.errors = o.errors;
    await o.ctx.close();
    if (want('clip-sidewalk')) {
      // the other branch: running the sidewalk round the lot
      const q = await open('phone', 'at=-3.1,-44.5');
      await q.page.evaluate(() => window.__game.story.unlockRun());
      await sleep(400);
      await clip(q.page, 'clip-sidewalk', 'The sidewalk route, running (Shift): firm ground, full speed, no tracks.', 'phone', async () => {
        for (const [x, z] of [[1.0, -47.2], [4.2, -49.6], [5.0, -54], [4.2, -58.6], [1.2, -61.6], [-1.6, -63.2], [-1.0, -66.4]]) await walkTo(q.page, x, z, { tol: 1.1, extra: ['Shift'] });
        await sleep(600);
      }, 1_000_000);
      await q.ctx.close();
    }
    if (want('clip-walk-stop')) {
      const q = await open('phone', '');
      await clip(q.page, 'clip-walk-stop', 'Motion test: W for 3 s (across the first mud patch), release, then D/S/A/W 1.1 s each. Keyboard input, 390×844 emulated phone.', 'phone', () => motionTest(q.page), 1_000_000);
      await shot(q.page, 'phone-after-motion', 'Tracks left in the mud by the motion test (distance-based, mud only).', 'phone');
      await q.ctx.close();
    }
    if (want('desktop-start')) { const q = await open('desktop', ''); await shot(q.page, 'desktop-start', 'Desktop start view (1280×720).', 'desktop'); await q.ctx.close(); }
    if (want('desktop-reveal')) { const q = await open('desktop', 'at=-1.2,-66.6'); await sleep(300); await shot(q.page, 'desktop-road', 'Desktop: the road, the car and the house (landscape framing).', 'desktop'); await q.ctx.close(); }
  }
} finally {
  const prev = fs.existsSync(path.join(OUT, 'capture.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'capture.json'))) : null;
  if (prev && ONLY) { const names = new Set(meta.items.map((i) => i.name)); meta.items = [...prev.items.filter((i) => !names.has(i.name)), ...meta.items]; }
  fs.writeFileSync(path.join(OUT, 'capture.json'), JSON.stringify(meta, null, 2));
  await browser.close();
  server.stop();
}
