// Grab frames from a capture clip into one contact sheet, for reviewing motion without a video player.
// Usage: node tools/frames.mjs clip.webm out.png [--at=0.5,1,1.5,2] [--w=200]
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [clip, out] = args.filter((a) => !a.startsWith('--'));
const at = (opts.at || '0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5').split(',').map(Number), w = +(opts.w || 200);
const b64 = fs.readFileSync(clip).toString('base64');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Math.min(8, at.length) * (w + 4) + 4, height: 300 } });
await p.setContent(`<body style="margin:0;background:#111;color:#ccc;font:11px system-ui"><video id="v" src="data:video/webm;base64,${b64}" muted style="display:none"></video><div id="g" style="display:flex;flex-wrap:wrap;gap:4px;padding:4px"></div></body>`);
await p.evaluate(async ({ at, w }) => {
  const v = document.getElementById('v');
  await new Promise((r) => { if (v.readyState >= 1) r(); else v.onloadedmetadata = r; });
  for (const t of at) {
    v.currentTime = t; await new Promise((r) => { v.onseeked = r; });
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * v.videoHeight / v.videoWidth);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    const d = document.createElement('div'); d.append(c, Object.assign(document.createElement('div'), { textContent: t + 's' }));
    document.getElementById('g').append(d);
  }
}, { at, w });
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('wrote', out);
