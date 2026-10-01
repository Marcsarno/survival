// Quick look: loads the game in an emulated phone (or desktop) viewport, optionally at ?at=x,z,
// takes a screenshot and prints the state and any errors. --marks shoots every checkpoint.
// Development aid, not the playtest.
// Usage: node tools/smoke.mjs [--at=x,z] [--out=file.png] [--marks=dir] [--desktop] [--wait=1500] [--q=extra&query]
import { chromium } from 'playwright';
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const base = (argv.url || 'http://localhost:5173/') + '?capture=1&autostart=1' + (argv.q ? '&' + argv.q : '');
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(argv.desktop ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(base + (argv.at ? '&at=' + argv.at : ''));
await page.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 90000 }).catch((e) => errors.push('load: ' + e.message));
await page.waitForTimeout(+(argv.wait || 1500));
if (argv.marks) {
  const marks = await page.evaluate(() => window.__game.route.marks);
  for (const m of marks) {
    await page.evaluate(([x, z]) => { const g = window.__game; g.player.setPosition(x, z, Math.PI); g.snapCamera(); }, [m.x, m.z]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${argv.marks}/${m.id}.png` });
  }
}
if (argv.out) await page.screenshot({ path: argv.out });
const s = await page.evaluate(() => window.__game?.state()).catch((e) => ({ err: String(e) }));
console.log(JSON.stringify({ pos: s.pos, ground: s.ground, section: s.section, hour: s.hour, fps: s.fps, calls: s.calls, loadMs: s.loadMs, subtitle: s.subtitle, hint: s.hint, prompt: s.prompt, beats: s.story?.beats }, null, 0));
console.log('errors:', errors.slice(0, 10));
await browser.close();
