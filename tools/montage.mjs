// Contact sheet of captures, for quick review. Usage: node tools/montage.mjs out.png img1.png img2.png ... [--cols=4] [--w=260]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [out, ...files] = args.filter((a) => !a.startsWith('--'));
const cols = +(opts.cols || 4), w = +(opts.w || 260);
const cells = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f, '.png')}</figcaption></figure>`).join('');
const html = `<body style="margin:0;background:#111;color:#ddd;font:12px system-ui"><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px">${cells}</div>
<style>figure{margin:0}img{width:${w}px;display:block}figcaption{padding:2px 0}</style></body>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: cols * (w + 6) + 6, height: 400 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('wrote', out);
