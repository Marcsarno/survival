// Prints node (bone) names, meshes and animation names of a GLB. Usage: node tools/glb-info.mjs file.glb
import fs from 'node:fs';
const buf = fs.readFileSync(process.argv[2]);
const len = buf.readUInt32LE(12);
const j = JSON.parse(buf.slice(20, 20 + len).toString());
console.log('nodes:', j.nodes.map(n => n.name).join(', '));
console.log('meshes:', (j.meshes || []).map(m => m.name).join(', '));
console.log('anims:', (j.animations || []).map(a => a.name).join(', '));
console.log('materials:', (j.materials || []).map(m => m.name).join(', '));
