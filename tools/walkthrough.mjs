// Agent walk-through of the opening on an emulated phone (keyboard input), with screenshots every few
// seconds and at each beat, and the beat times. A quick end-to-end check, not the full playtest.
// Usage: node tools/walkthrough.mjs [--url=http://localhost:5173/] [--out=dir] [--every=4]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const URL = (argv.url || 'http://localhost:5173/') + '?capture=1&autostart=1' + (argv.q ? '&' + argv.q : '');
const OUT = argv.out || 'playtest-output/walk'; fs.mkdirSync(OUT, { recursive: true });
const every = +(argv.every || 4) * 1000;
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(argv.desktop ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errors = [];
p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(URL);
await p.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
await p.waitForTimeout(800);
const st = () => p.evaluate(() => window.__game.state());
const held = new Set();
const setKeys = async (keys) => { for (const k of [...held]) if (!keys.includes(k)) { await p.keyboard.up(k); held.delete(k); } for (const k of keys) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); } };
let lastShot = 0, n = 0; const shots = []; const seen = new Set();
const snap = async (tag) => { const f = path.join(OUT, `${String(n++).padStart(2, '0')}-${tag}.png`); await p.screenshot({ path: f }); shots.push(f); };
async function tick(s) {
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
const W = await p.evaluate(() => window.__game.route.walk);
let ok = true, failAt = null;
for (const [x, z, act] of W) {
  const want = act === 'bunny' ? 'Pick it up' : act === 'gate' ? (await st()).prompt?.includes('Climb') ? 'Climb' : 'gate' : null;
  const r = await walkTo(x, z, want);
  if (!r) { ok = false; failAt = [x, z]; break; }
  if (act) { await p.keyboard.press('e'); for (let i = 0; i < 50; i++) { const s = await st(); await tick(s); if (!s.seq && !s.frozen) break; await p.waitForTimeout(100); } await p.waitForTimeout(400); }
  if ((await st()).story.flags.stay != null) break;
}
for (let i = 0; i < 80; i++) { const s = await st(); await tick(s); if (s.modal === 'end') break; await p.waitForTimeout(150); }
await snap('end');
const s = await st();
const out = { ok: ok && s.modal === 'end', failAt, endTime: s.story.time, beats: s.story.beats.map((b) => `${b.id}@${b.t}`), lines: s.story.history.map((h) => `${h.start} ${h.who}: ${h.text}`), fps: s.fps, calls: s.calls, tris: s.tris, errors: errors.slice(0, 5), shots: shots.length };
fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close();
