// Visual review helper: screenshots of named spots at chosen hours and camera levels.
// Usage: node tools/shots.mjs [--url=http://localhost:5173/] [--only=street,canal] [--w=1280 --h=720]
// Uses dev teleports (?dev=1) — this is for looking, not for gameplay verification.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'playtest-output', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SPOTS = {
  street: { at: [44, 6], hour: 16.5, level: 2 },
  streetNight: { at: [44, 6], hour: 22, level: 2, lantern: true },
  park: { at: [-58, 20], hour: 9, level: 2 },
  parkNight: { at: [-58, 20], hour: 21.5, level: 2, lantern: false },
  playground: { at: [36, -6], hour: 11, level: 2 },
  pharmacy: { at: [18, -74], hour: 17.5, level: 3 },
  canal: { at: [46, 55], hour: 10, level: 2 },
  canalNight: { at: [46, 55], hour: 23, level: 2, lantern: true },
  beach: { at: [120, -4], hour: 7.2, level: 3 },
  woods: { at: [-100, 8], hour: 15, level: 2 },
  pond: { at: [-112, -33], hour: 8, level: 3 },
  camp: { at: [-38, -74], hour: 18.2, level: 2 },
  cinematic: { at: [47, 7], hour: 16, level: 2, cinematic: true },
  // close-ups for in-game asset checks (cinematic camera)
  closeAim: { at: [20, -66], hour: 11, level: 0, cinematic: true, setup: 'aim' },
  closeLantern: { at: [40, 3], hour: 22.5, level: 0, cinematic: true, lantern: true },
  closeZombie: { at: [30, 2], hour: 12, level: 0, cinematic: true, setup: 'zombie' },
  closeDog: { at: [45, -13.5], hour: 12, level: 0, cinematic: true },
  closeDeer: { at: [0, 0], hour: 12, level: 0, cinematic: true, setup: 'deer' },
  closeDucks: { at: [30, 57.5], hour: 12, level: 0, cinematic: true },
  closeOwl: { at: [-92, -13.5], hour: 23, level: 0, cinematic: true, lantern: true },
  closeCars: { at: [-4, 5], hour: 15, level: 1 },
};
const only = argv.only ? String(argv.only).split(',') : Object.keys(SPOTS);

let url = argv.url, server;
if (!url) {
  server = spawn('npx', ['vite', '--port', '5198', '--strictPort'], { cwd: ROOT, shell: true });
  await new Promise((r) => server.stdout.on('data', (d) => String(d).includes('5198') && r()));
  url = 'http://localhost:5198/';
}
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(argv.w || 1280), height: +(argv.h || 720) } });
await page.goto(url + '?dev=1&fresh=1&autostart=1&capture=1');
await page.waitForFunction(() => window.__game?.started, null, { timeout: 90000 });
for (const name of only) {
  const s = SPOTS[name];
  await page.evaluate((s) => {
    const g = window.__game;
    g.zombies.list.forEach((z) => { if (Math.hypot(z.obj.position.x - s.at[0], z.obj.position.z - s.at[1]) < 12) z.obj.position.x += 30; });
    g.daynight.hour = s.hour; g.camera.level = s.level; g.camera.cinematic = !!s.cinematic;
    g.player.lanternOn = !!s.lantern;
    if (s.setup === 'deer') { const d = g.wildlife.list.find((a) => a.kind === 'deer'); d.obj.position.set(-110, 0, -20); s.at = [-110 + 2.5, -20 + 5]; }
    g.teleport(s.at[0], s.at[1]);
    if (s.setup === 'zombie') { const z = g.zombies.alive()[0]; z.obj.position.set(s.at[0] - 1.2, 0, s.at[1] - 2.8); z.state = 'wander'; z.target = null; z.home.copy(z.obj.position); }
    if (s.setup === 'aim') { g.tools.pistol = true; g.inv.add('ammo', 3); }
    document.getElementById('toasts').innerHTML = '';
  }, s);
  if (s.setup === 'aim') { await page.mouse.move(700, 250); await page.mouse.down({ button: 'right' }); }
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  if (s.setup === 'aim') await page.mouse.up({ button: 'right' });
  console.log('shot', name);
}
await browser.close();
if (server) process.platform === 'win32' ? spawn('taskkill', ['/pid', server.pid, '/f', '/t']) : server.kill();
