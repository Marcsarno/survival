// Meshopt-compresses every game GLB in place (after `npm run assets`). Keeps node, bone and
// material names intact (no join / flatten / instancing), because the game looks them up by name.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DIR = path.resolve(import.meta.dirname, '..', 'public', 'assets', 'models');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glbopt-'));
let before = 0, after = 0;
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.glb'))) {
  const src = path.join(DIR, f), out = path.join(tmp, f);
  const buf = fs.readFileSync(src);
  if (buf.includes('EXT_meshopt_compression')) { before += buf.length; after += buf.length; continue; } // already done
  execFileSync(process.execPath, [path.resolve(import.meta.dirname, '..', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js'), 'optimize', src, out,
    '--compress', 'meshopt', '--texture-compress', 'false', '--simplify', 'false', '--instance', 'false', '--join', 'false', '--flatten', 'false', '--palette', 'false'], { stdio: 'ignore' });
  before += buf.length; after += fs.statSync(out).size;
  fs.copyFileSync(out, src);
}
console.log(`models: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
