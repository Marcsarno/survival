// Agent walk-through of the opening on an emulated phone (keyboard input), with screenshots every few
// seconds and at each beat, and the beat times. A quick end-to-end check, not the full playtest.
// Usage: node tools/walkthrough.mjs [--url=http://localhost:5173/] [--out=dir] [--every=4] [--video] [--firm]
//   --video records the whole run (WebM, 390x844) into the out dir; --firm takes the firm way at the fork
//   --clips records two short canvas clips (3D view only, no HUD) into the out dir: clip-opening.webm
//           (the first 14 s) and clip-run.webm (her call, the run, the house)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fixWebmDuration } from './webm-duration.mjs';
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const URL = (argv.url || 'http://localhost:5173/') + '?capture=1&autostart=1' + (argv.q ? '&' + argv.q : '');
const OUT = argv.out || 'playtest-output/walk'; fs.mkdirSync(OUT, { recursive: true });
const every = +(argv.every || 4) * 1000;
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(argv.desktop ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), ...(argv.video ? { recordVideo: { dir: OUT, size: argv.desktop ? { width: 1280, height: 720 } : { width: 390, height: 844 } } } : {}) });
const p = await ctx.newPage(); const errors = [];
p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(URL);
await p.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
await p.waitForTimeout(800);
const st = () => p.evaluate(() => window.__game.state());
const held = new Set();
const setKeys = async (keys) => { for (const k of [...held]) if (!keys.includes(k)) { await p.keyboard.up(k); held.delete(k); } for (const k of keys) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); } };
let lastShot = 0, n = 0; const shots = []; const seen = new Set();
const rec = { on: null, t0: 0, done: new Set() };
async function recStart(name) {
  await p.evaluate(() => {
    const c = document.getElementById('game'), stream = c.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_800_000 });
    window.__rec = { r, chunks: [] }; r.ondataavailable = (e) => { if (e.data.size) window.__rec.chunks.push(e.data); }; r.start(250);
  });
  rec.on = name; rec.t0 = Date.now();
}
async function recStop() {
  const b64 = await p.evaluate(async () => {
    const { r, chunks } = window.__rec; await new Promise((res) => { r.onstop = res; r.stop(); });
    const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const f = path.join(OUT, `clip-${rec.on}.webm`); fs.writeFileSync(f, Buffer.from(b64, 'base64')); fixWebmDuration(f, (Date.now() - rec.t0) / 1000);
  console.log('clip', f, ((Date.now() - rec.t0) / 1000).toFixed(1) + 's'); rec.done.add(rec.on); rec.on = null;
}
const snap = async (tag) => { const f = path.join(OUT, `${String(n++).padStart(2, '0')}-${tag}.png`); await p.screenshot({ path: f }); shots.push(f); };
async function tick(s) {
  if (argv.clips) {
    if (!rec.on && !rec.done.has('opening')) await recStart('opening');
    else if (rec.on === 'opening' && s.story.time > 14) await recStop();
    else if (!rec.on && !rec.done.has('run') && s.story.flags.urgency != null) await recStart('run');
    else if (rec.on === 'run' && s.story.flags.reveal != null && s.story.time > s.story.flags.reveal + 4) await recStop();
  }
  if (Date.now() - lastShot > every) { lastShot = Date.now(); await snap('t' + Math.round(s.story.time)); }
  for (const bt of s.story.beats) if (!seen.has(bt.id)) { seen.add(bt.id); if (['prints', 'bunny', 'locked', 'reveal', 'argument', 'stay'].includes(bt.id)) { await p.waitForTimeout(bt.id === 'reveal' ? 1600 : 500); await snap(bt.id); } }
}
async function walkTo(x, z, want) {
  const t0 = Date.now(); let best = Infinity, bestT = Date.now(), side = 0;
  while (Date.now() - t0 < 60000) {
    const s = await st(); await tick(s);
    if (s.story.flags.stay != null) { await setKeys([]); return true; }
    if (want && s.prompt?.includes(want)) { await setKeys([]); return true; }
    if (s.frozen || s.seq) { await setKeys([]); await p.waitForTimeout(100); bestT = Date.now(); continue; }
    const dx = x - s.pos[0], dz = z - s.pos[1], d = Math.hypot(dx, dz);
    if (d < (want ? 0.3 : 1.0)) { await setKeys([]); return true; }
    const keys = []; if (-dz / d > 0.38) keys.push('w'); if (dz / d > 0.38) keys.push('s'); if (dx / d > 0.38) keys.push('d'); if (-dx / d > 0.38) keys.push('a');
    await setKeys(keys);
    if (d < best - 0.2) { best = d; bestT = Date.now(); }
    if (Date.now() - bestT > 3000) { if (++side > 4) { await setKeys([]); return false; } await setKeys([side % 2 ? 'a' : 'd']); await p.waitForTimeout(600); bestT = Date.now(); best = Infinity; }
    await p.waitForTimeout(60);
  }
  await setKeys([]); return false;
}
const W = await p.evaluate((firm) => (firm ? window.__game.route.walkFirm : window.__game.route.walk), !!argv.firm);
let ok = true, failAt = null;
for (const [x, z, act] of W) {
  const want = act === 'bunny' ? 'Pick it up' : act === 'gate' ? (await st()).prompt?.includes('Climb') ? 'Climb' : 'gate' : null;
  const r = await walkTo(x, z, want);
  if (!r) { ok = false; failAt = [x, z]; break; }
  if (act) { await p.keyboard.press('e'); for (let i = 0; i < 50; i++) { const s = await st(); await tick(s); if (!s.seq && !s.frozen) break; await p.waitForTimeout(100); } await p.waitForTimeout(400); }
  if ((await st()).story.flags.stay != null) break;
}
for (let i = 0; i < 80; i++) { const s = await st(); await tick(s); if (s.modal === 'end') break; await p.waitForTimeout(150); }
if (rec.on) await recStop();
await snap('end');
const s = await st();
const out = { ok: ok && s.modal === 'end', failAt, endTime: s.story.time, beats: s.story.beats.map((b) => `${b.id}@${b.t}`), lines: s.story.history.map((h) => `${h.start} ${h.who}: ${h.text}`), fps: s.fps, calls: s.calls, tris: s.tris, errors: errors.slice(0, 5), shots: shots.length };
fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
const video = p.video(); await ctx.close(); if (video) { const vp = await video.path(); fs.renameSync(vp, path.join(OUT, 'walk.webm')); console.log('video', path.join(OUT, 'walk.webm')); }
await b.close();
