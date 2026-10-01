// Captures the same views (the opening, the bunny, the house) with each camera candidate on an emulated
// 390x844 phone and composes one comparison sheet per view. Marc stands at the view's checkpoint, at
// rest, facing north; story text is hidden so only the framing differs.
// Usage: node tools/camera-compare.mjs [--url=http://localhost:5173/] [--out=playtest-output/camera] [--sets=pass2,a,b] [--views=street,bunny,yard]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const URL = argv.url || 'http://localhost:5173/';
const OUT = argv.out || 'playtest-output/camera'; fs.mkdirSync(OUT, { recursive: true });
const SETS = (argv.sets || 'pass2,a,b').split(','), VIEWS = (argv.views || 'street,bunny,yard').split(',');
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const files = {};
for (const set of SETS) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(URL + `?capture=1&autostart=1&camset=${set}`);
  await p.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 });
  await p.addStyleTag({ content: '#subtitle,#hint,#prompt,#touch,.hud-top{visibility:hidden!important}' });
  await p.waitForTimeout(1500);
  for (const v of VIEWS) {
    await p.evaluate((id) => { const g = window.__game, m = g.route.marks.find((k) => k.id === id); g.player.setPosition(m.x, m.z, Math.PI); g.snapCamera(); }, v);
    await p.waitForTimeout(900);
    const f = path.join(OUT, `${v}-${set}.png`); await p.screenshot({ path: f }); (files[v] ||= []).push([set, f]);
  }
  if (errors.length) console.log(set, 'errors', errors.slice(0, 3));
  await ctx.close();
}
await b.close();
for (const [v, list] of Object.entries(files)) {
  const W = 390, H = 844, pad = 10, label = 34;
  const tiles = await Promise.all(list.map(async ([set, f]) => ({ set, buf: await sharp(f).resize(W, H).png().toBuffer() })));
  const svg = (t) => Buffer.from(`<svg width="${W}" height="${label}"><rect width="100%" height="100%" fill="#1d1a17"/><text x="10" y="23" font-family="Segoe UI, Arial" font-size="18" fill="#f2e6d0">${t}</text></svg>`);
  const comp = [];
  tiles.forEach((t, i) => { comp.push({ input: svg(`${v} · camera ${t.set}`), left: pad + i * (W + pad), top: pad }); comp.push({ input: t.buf, left: pad + i * (W + pad), top: pad + label }); });
  const out = path.join(OUT, `compare-${v}.jpg`);
  await sharp({ create: { width: pad + tiles.length * (W + pad), height: H + label + pad * 2, channels: 3, background: '#1d1a17' } }).composite(comp).jpeg({ quality: 82 }).toFile(out);
  console.log(out);
}
