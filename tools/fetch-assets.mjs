// Downloads the selected free models from poly.pizza into assets/source/
// and records the source page, license and creator for credits.
// Usage: node tools/fetch-assets.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets', 'source');

// code = reference number in the asset-reference-library; name = local file name
export const SELECTED = [
  { code: 'C13', id: '5EGWBMpuXq', name: 'adventurer', creator: 'Quaternius' },
  { code: 'C14', id: 'y9KWOVG21R', name: 'hooded-adventurer', creator: 'Quaternius' },
  { code: 'A1', id: 'T6Cs7tmMHJ', name: 'deer', creator: 'Quaternius' },
  { code: 'A2', id: 'Bc97C66HKi', name: 'fox', creator: 'Quaternius' },
  { code: 'A3', id: 'P1gU3Qkr9r', name: 'wolf', creator: 'Quaternius' },
  { code: 'A5', id: 'y4wdQpg767', name: 'dog', creator: 'Quaternius' },
  { code: 'A8', id: '3vvONbRCuEF', name: 'rabbit', creator: 'Poly by Google' },
  { code: 'A13', id: 'frSLi6b6Vid', name: 'duck', creator: 'Poly by Google' },
  { code: 'A12', id: 'fNkq9CwSG6d', name: 'owl', creator: 'Poly by Google' },
  { code: 'T10', id: 'VYslw9DEi6', name: 'palms', creator: 'Quaternius' },
  { code: 'T5', id: 'w8ZaiYjK8C', name: 'pines', creator: 'Quaternius' },
  { code: 'T8', id: 'Mcd2zYqyww', name: 'dead-tree', creator: 'Quaternius' },
  { code: 'F2', id: 'J2h3HrO356', name: 'bushes', creator: 'Quaternius' },
  { code: 'F3', id: 'H4IEAwYl1z', name: 'snowy-bush', creator: 'Quaternius' },
  { code: 'F11', id: 'df8uCl1YpK', name: 'hedge', creator: 'Quaternius' },
  { code: 'F7', id: 'vUJjrRsFp4', name: 'grass', creator: 'Quaternius' },
  { code: 'S1', id: 'W0UYZPYSXf', name: 'axe', creator: 'Quaternius' },
  { code: 'S2', id: 'J3i9KDQ3kt', name: 'pistol', creator: 'Quaternius' },
  { code: 'S4', id: 'cc9Kueieyl', name: 'medkit', creator: 'Quaternius' },
  { code: 'S5', id: '22eU6FjNQ8', name: 'matchbox', creator: 'Quaternius' },
  { code: 'S6', id: 'KpxDpidn1Z', name: 'water-bottle', creator: 'Quaternius' },
  { code: 'S7', id: 'YnowJvWqxE', name: 'food-can', creator: 'Quaternius' },
  { code: 'S8', id: '2g9Jm7kvIU', name: 'backpack', creator: 'Quaternius' },
  { code: 'S10', id: 'nwsYvcI0bC', name: 'fallen-log', creator: 'Quaternius' },
  { code: 'S11', id: 'fei4I7FfrJ', name: 'logs', creator: 'Quaternius' },
  { code: 'S12', id: 'nFvEbUX6LE', name: 'stump', creator: 'Quaternius' },
  { code: 'S16', id: 'k1e0cOzi8A', name: 'bonfire', creator: 'Quaternius' },
  { code: 'S9', id: 'TPqvwkyWdV', name: 'radio', creator: 'Quaternius' },
  // opening redesign, pass 2: vehicles and the rowboat (retextured in blender/kit/props.py)
  { code: 'V1', id: 'Cz6yDaUcM9', name: 'car-white', creator: 'Quaternius' },
  { code: 'V2', id: 'vTTTjDoxhV', name: 'stationwagon', creator: 'Kay Lousberg' },
  { code: 'V3', id: 'Y67erogmR9', name: 'broken-car', creator: 'Quaternius' },
  { code: 'V4', id: 'BbRojf2v3H', name: 'van', creator: 'PuKkBuMXDD' },
  { code: 'B1', id: 'dt1yhb5AYXD', name: 'rowboat', creator: 'Poly by Google' },
];

async function fetchOne(a) {
  const page = `https://poly.pizza/m/${a.id}`;
  const html = await (await fetch(page)).text();
  const glb = html.match(/https:\/\/static\.poly\.pizza\/[0-9a-f-]+\.glb/);
  if (!glb) throw new Error(`no glb url on ${page}`);
  const license = /CC-BY|CC BY|Attribution/.test(html) && !/CC0/.test(html) ? 'CC-BY 3.0' : (/CC0/.test(html) ? 'CC0 1.0' : 'UNKNOWN');
  const title = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || a.name;
  const buf = Buffer.from(await (await fetch(glb[0])).arrayBuffer());
  await fs.writeFile(path.join(OUT, `${a.name}.glb`), buf);
  return { ...a, page, download: glb[0], license, title, bytes: buf.length };
}

await fs.mkdir(OUT, { recursive: true });
const results = [];
const existing = JSON.parse(await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8').catch(() => '[]'));
for (const a of SELECTED) {
  const had = existing.find((e) => e.id === a.id);
  if (had && !process.argv.includes('--all')) { results.push(had); continue; }
  try {
    const r = await fetchOne(a);
    results.push(r);
    console.log(`ok   ${a.code.padEnd(4)} ${a.name.padEnd(18)} ${r.license.padEnd(9)} ${(r.bytes / 1024).toFixed(0)} KB  ${r.title}`);
  } catch (e) {
    console.log(`FAIL ${a.code} ${a.name}: ${e.message}`);
  }
}
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(results, null, 2));
