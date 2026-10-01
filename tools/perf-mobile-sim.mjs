// Rough phone approximation: 390x844 touch viewport, CPU throttled 4x via DevTools, real desktop GPU.
// Usage: node tools/perf-mobile-sim.mjs [url]   (needs `npm run dev` running unless a url is given)
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const t0 = Date.now();
await p.goto((process.argv[2] || 'http://localhost:5173/') + '?fresh=1&autostart=1');
await p.waitForFunction(() => window.__game?.started, null, { timeout: 120000 });
const load = Date.now() - t0;
const out = [];
const marks = await p.evaluate(() => window.__game.route.marks.map((m) => [m.x, m.z, m.id]));
for (const [x, z, id] of marks) {
  await p.evaluate(([x, z]) => { const g = window.__game; g.player.setPosition(x, z, Math.PI); g.snapCamera(); g.perf.worst = 0; }, [x, z]);
  await p.waitForTimeout(3500);
  const s = await p.evaluate(() => { const g = window.__game; return { fps: g.perf.fps, worstMs: Math.round(g.perf.worst), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, px: g.renderer.getPixelRatio(), low: g.quality.low }; });
  out.push({ at: id, ...s });
}
console.log(JSON.stringify({ loadMs: load, samples: out }, null, 1));
await b.close();
