// Downloads the Poly Haven assets the opening uses (all CC0) and records them in
// assets/source/polyhaven/manifest.json for CREDITS.md.
//
//   textures → assets/source/polyhaven/textures/<id>/{diff,nor,rough}.jpg (1k originals, gitignored;
//              tools/optimize-assets.mjs makes the game's WebP copies in public/assets/textures)
//   hdri     → public/assets/env/<id>.hdr                           (1k, image-based light)
//   models   → assets/source/polyhaven/<id>/ (glTF + textures)      (Blender sources; built into public/assets/models)
//
// Usage: node tools/fetch-polyhaven.mjs [--force]
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FORCE = process.argv.includes('--force');
export const TEXTURES = [
  // ground
  'forest_leaves_02', 'forrest_ground_01', 'brown_mud_leaves_01', 'playground_sand', 'park_dirt',
  // paving
  'concrete_pavement', 'worn_concrete_floor', 'road_damaged', 'concrete_moss',
  // buildings
  'worn_mossy_plasterwall', 'white_plaster_rough_01', 'red_plaster_weathered', 'clay_roof_tiles', 'roof_tiles',
  // wood, bark, metal, fabric
  'weathered_planks', 'wood_planks_grey', 'old_planks_02', 'bark_brown_02', 'palm_bark', 'green_metal_rust', 'rusty_metal', 'terry_cloth',
];
export const HDRIS = ['dikhololo_sunset'];
export const MODELS = ['plastic_monobloc_chair_01', 'metal_trash_can', 'street_lamp_02', 'wooden_picnic_table', 'fern_02', 'shrub_03', 'tree_stump_01', 'rubber_duck_toy', 'utility_box_01', 'trashbag', 'wooden_crate_02', 'dry_branches_medium_01'];

const MAPS = { diff: ['Diffuse', 'diff'], nor: ['nor_gl'], rough: ['Rough', 'rough'] };
const exists = (f) => fs.access(f).then(() => true, () => false);
async function get(url, file) {
  if (!FORCE && await exists(file)) return 0;
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, buf);
  return buf.length;
}
const files = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
const info = async (id) => (await fetch(`https://api.polyhaven.com/info/${id}`)).json();

const manifest = [];
let total = 0;
for (const id of TEXTURES) {
  const f = await files(id);
  for (const [out, keys] of Object.entries(MAPS)) {
    const k = keys.find((x) => f[x]); if (!k) { console.log('no', out, 'for', id); continue; }
    total += await get(f[k]['1k'].jpg.url, path.join(ROOT, 'assets/source/polyhaven/textures', id, `${out}.jpg`));
  }
  const i = await info(id);
  manifest.push({ id, type: 'texture', name: i.name, authors: Object.keys(i.authors || {}), license: 'CC0', page: `https://polyhaven.com/a/${id}`, size_m: i.dimensions?.map((d) => d / 1000) });
  console.log('texture', id);
}
for (const id of HDRIS) {
  const f = await files(id);
  total += await get(f.hdri['1k'].hdr.url, path.join(ROOT, 'public/assets/env', `${id}.hdr`));
  const i = await info(id);
  manifest.push({ id, type: 'hdri', name: i.name, authors: Object.keys(i.authors || {}), license: 'CC0', page: `https://polyhaven.com/a/${id}` });
  console.log('hdri', id);
}
for (const id of MODELS) {
  const f = await files(id);
  const g = f.gltf['1k'].gltf, dir = path.join(ROOT, 'assets/source/polyhaven', id);
  total += await get(g.url, path.join(dir, `${id}.gltf`));
  for (const [rel, inc] of Object.entries(g.include || {})) total += await get(inc.url, path.join(dir, rel));
  const i = await info(id);
  manifest.push({ id, type: 'model', name: i.name, authors: Object.keys(i.authors || {}), license: 'CC0', page: `https://polyhaven.com/a/${id}`, polycount: i.polycount });
  console.log('model', id, i.polycount);
}
await fs.writeFile(path.join(ROOT, 'assets/source/polyhaven/manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`done, ${(total / 1e6).toFixed(1)} MB downloaded`);
