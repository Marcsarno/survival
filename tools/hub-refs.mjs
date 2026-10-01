// Copies Marc's concept-art references into hub/refs-local/ so the hub can show them.
// The folder is gitignored: concept art stays out of the repo (CLAUDE.md). On a machine without the
// source folder the hub shows a "missing locally" placeholder instead.
//
// Usage: node tools/hub-refs.mjs [--src="C:/Users/marc7/Documents/Codex/2026-09-29/okay-so-there-s-a-few/outputs"]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = process.argv.find((a) => a.startsWith('--src='));
const SRC = arg ? arg.slice(6) : 'C:/Users/marc7/Documents/Codex/2026-09-29/okay-so-there-s-a-few/outputs';
const OUT = path.join(ROOT, 'hub', 'refs-local');
fs.mkdirSync(OUT, { recursive: true });

// keep in sync with HUB.art.refs / HUB.characters.future in hub/data.js
const FILES = [
  // the opening redesign (2026-09-30): three simplified concept references
  'opening-redesign-handoff/01-woods-and-log.png', 'opening-redesign-handoff/02-bunny-discovery.png', 'opening-redesign-handoff/03-car-and-house.png',
  'concept-art/01-rescue-approach.png', 'concept-art/06-snowy-woodland.png', 'concept-art/02-family-homecoming.png', 'concept-art/03-supply-route.png',
  'concept-art/home-and-decisions/09-home-woodland.png', 'concept-art/home-and-decisions/10-home-house.png', 'concept-art/home-and-decisions/11-home-pavilion.png',
  'concept-art/home-and-decisions/12-gameplay-two-routes.png', 'concept-art/environment-studies/03-night-lantern.png', 'concept-art/environment-studies/05-residential-street.png',
  'concept-art/environment-studies/01-morning-pond.png', 'concept-art/environment-studies/references/01-wood-shelter.png',
  'asset-reference-library/characters.jpg', 'asset-reference-library/previews/C13.webp', 'asset-reference-library/previews/C14.webp',
];
let n = 0;
for (const f of FILES) {
  const from = path.join(SRC, f);
  if (!fs.existsSync(from)) { console.log('missing', f); continue; }
  fs.copyFileSync(from, path.join(OUT, path.basename(f))); n++;
}
console.log(`copied ${n}/${FILES.length} references to hub/refs-local/`);
