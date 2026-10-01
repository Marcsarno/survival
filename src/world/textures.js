import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';
import { PAL } from '../palette.js';

// Procedural canvas textures in the faceted, restrained style of the concept art.
const cache = new Map();
function make(key, w, h, draw, repeat = true) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

function facetPoly(g, rng, cx, cy, r, n = 7, squash = 1) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const rr = r * (0.6 + rng() * 0.5);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * squash;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

/** Draws clustered faceted snow drifts: each drift is a cluster of overlapping facets
 *  with a soft blue shadow edge and a few loose flakes around it. density 0..1+ */
function snowPatches(g, w, h, rng, density, size = 1, wrap = true) {
  if (!(density > 0)) return;
  const n = Math.max(1, Math.floor(9 * density * (w * h) / (512 * 512)));
  const offs = wrap ? [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h], [w, h], [-w, -h], [w, -h], [-w, h]] : [[0, 0]];
  for (let i = 0; i < n; i++) {
    const cx = rng() * w, cy = rng() * h, R = (40 + rng() * 70) * size;
    const parts = [];
    const k = 5 + Math.floor(rng() * 6);
    for (let j = 0; j < k; j++) {
      const a = rng() * Math.PI * 2, d = rng() * R * 0.8;
      parts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, R * (0.25 + rng() * 0.35), (rng() * 1e9) | 0]);
    }
    const flakes = [];
    for (let j = 0; j < 6; j++) { const a = rng() * Math.PI * 2, d = R * (0.9 + rng() * 0.6); flakes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 3 + rng() * 7, (rng() * 1e9) | 0]); }
    for (const [ox, oy] of offs) {
      g.fillStyle = 'rgba(150,166,198,0.55)';
      for (const [x, y, r, s] of parts) { facetPoly(g, mulberry32(s), x + ox + 3, y + oy + 4, r, 7); g.fill(); }
      g.fillStyle = PAL.snow;
      for (const [x, y, r, s] of parts) { facetPoly(g, mulberry32(s), x + ox, y + oy, r, 7); g.fill(); }
      for (const [x, y, r, s] of flakes) { facetPoly(g, mulberry32(s), x + ox, y + oy, r, 5); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [x, y, r, s] of parts.slice(0, 3)) { facetPoly(g, mulberry32(s + 1), x + ox - r * 0.25, y + oy - r * 0.25, r * 0.5, 5); g.fill(); }
    }
  }
}

function noise(g, w, h, rng, alpha, n = 3000, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = rng() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rng()})`;
    g.fillRect(rng() * w, rng() * h, size, size);
  }
}

/** Clay tile roof; snow 0 gives bare tile. tile/tileDark override the colors (muted, weathered tile for the no-snow look). */
export function roofTexture(seed, snow = 0.6, tile = PAL.tile, tileDark = PAL.tileDark) {
  return make(`roof${seed}_${snow}_${tile}`, 512, 512, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = tileDark; g.fillRect(0, 0, w, h);
    const cols = 16, rows = 12, cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * rh;
        const tone = 0.85 + rng() * 0.3;
        const grd = g.createLinearGradient(x, 0, x + cw, 0);
        grd.addColorStop(0, shade(tileDark, tone * 0.9));
        grd.addColorStop(0.45, shade(tile, tone * 1.12));
        grd.addColorStop(1, shade(tileDark, tone * 0.8));
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(x + 2, y + rh); g.lineTo(x + 2, y + 5); g.quadraticCurveTo(x + cw / 2, y - 3, x + cw - 2, y + 5); g.lineTo(x + cw - 2, y + rh); g.fill();
      }
      g.fillStyle = 'rgba(60,20,10,0.35)'; g.fillRect(0, r * rh + rh - 3, w, 3);
    }
    // snow blanket: solid cover from the ridge (canvas top) down to a jagged, faceted edge,
    // a few tiles poking through, loose clumps below the edge, bare tile at the eaves (concept 05/11)
    if (!(snow > 0)) return;
    const edgeY = h * (0.5 + 0.25 * snow);
    const pts = [[0, 0], [w, 0]];
    for (let x = w; x >= 0; x -= w / 18) pts.push([x, edgeY + (rng() - 0.5) * h * 0.22 + (x === w || x === 0 ? 0 : 0)]);
    pts[pts.length - 1][1] = pts[2][1]; // seamless wrap across the u repeat
    g.fillStyle = 'rgba(140,156,190,0.6)';
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y + 6) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.fillStyle = PAL.snow;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    // subtle facet shading inside the blanket
    for (let i = 0; i < 26; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(190,200,222,0.35)'; facetPoly(g, rng, rng() * w, rng() * edgeY * 0.9, 20 + rng() * 50, 5, 0.6); g.fill(); }
    // tiles showing through
    for (let i = 0; i < 7; i++) {
      const x = rng() * w, y = rng() * edgeY * 0.8, rr = 8 + rng() * 16;
      g.fillStyle = PAL.tile; facetPoly(g, rng, x, y, rr, 5, 0.6); g.fill();
    }
    // loose clumps below the edge
    for (let i = 0; i < 18; i++) {
      const x = rng() * w, y = edgeY + rng() * (h - edgeY) * 0.8, rr = 8 + rng() * 22;
      g.fillStyle = 'rgba(140,156,190,0.55)'; facetPoly(g, mulberry32(seed + i), x + 2, y + 3, rr, 6, 0.7); g.fill();
      g.fillStyle = PAL.snow; facetPoly(g, mulberry32(seed + i), x, y, rr, 6, 0.7); g.fill();
    }
  });
}

export function asphaltTexture(seed = 1, snow = 0.55) {
  return make(`asphalt${seed}_${snow}`, 512, 512, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = PAL.asphalt; g.fillRect(0, 0, w, h);
    noise(g, w, h, rng, 0.08, 6000, 2);
    // faceted tone patches
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.06})`; facetPoly(g, rng, rng() * w, rng() * h, 30 + rng() * 60, 6); g.fill(); }
    // cracks
    g.strokeStyle = 'rgba(25,25,28,0.55)'; g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      let x = rng() * w, y = rng() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 50; y += (rng() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    snowPatches(g, w, h, rng, snow, 1.1);
  });
}

export function concreteTexture(seed = 2, snow = 0.6) {
  return make(`concrete${seed}_${snow}`, 256, 256, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = PAL.concrete; g.fillRect(0, 0, w, h);
    noise(g, w, h, rng, 0.06, 1500, 2);
    g.strokeStyle = 'rgba(90,85,78,0.45)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    snowPatches(g, w, h, rng, snow * 1.6, 0.6);
  });
}

export function paverTexture(seed = 3, snow = 0.5) {
  return make(`paver${seed}_${snow}`, 256, 256, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = '#7d4c38'; g.fillRect(0, 0, w, h);
    const bw = 32, bh = 16;
    for (let y = 0; y < h; y += bh) for (let x = -bw; x < w; x += bw) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      g.fillStyle = shade(rng() < 0.5 ? PAL.paver : PAL.paverLight, 0.85 + rng() * 0.25);
      g.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
    snowPatches(g, w, h, rng, snow * 1.6, 0.55);
  });
}

export function sandTexture(seed = 4, snow = 0.6) {
  return make(`sand${seed}_${snow}`, 512, 512, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = PAL.sand; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,95,60,${0.05 + rng() * 0.07})`; facetPoly(g, rng, rng() * w, rng() * h, 20 + rng() * 60, 6); g.fill(); }
    noise(g, w, h, rng, 0.08, 4000, 2);
    snowPatches(g, w, h, rng, snow, 1.3);
  });
}

/** Wet mud: a dark brown base with a few broad wetter patches and a faint sheen (broad, low-detail). */
export function mudTexture(seed = 8) {
  return make(`mud${seed}`, 256, 256, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = '#4f3f30'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(40,30,20,${0.12 + rng() * 0.14})`; facetPoly(g, rng, rng() * w, rng() * h, 30 + rng() * 50, 7, 0.7); g.fill(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(140,128,112,${0.07 + rng() * 0.06})`; facetPoly(g, rng, rng() * w, rng() * h, 14 + rng() * 22, 6, 0.5); g.fill(); }
    noise(g, w, h, rng, 0.05, 900, 2);
  });
}

export function plankTexture(seed = 5, snow = 0.3, color = PAL.wood) {
  return make(`plank${seed}_${snow}_${color}`, 256, 256, (g, w, h) => {
    const rng = mulberry32(seed);
    const n = 8, ph = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade(color, 0.85 + rng() * 0.3); g.fillRect(0, i * ph, w, ph);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, i * ph + ph - 2, w, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(rng() * w, i * ph, 2, ph);
    }
    if (snow > 0) snowPatches(g, w, h, rng, snow * 1.5, 0.5);
  });
}

export function rubberTexture(seed = 6) {
  return make(`rubber${seed}`, 256, 256, (g, w, h) => {
    const rng = mulberry32(seed);
    const cs = ['#7a3a36', '#3f5a52', '#6b4b3a', '#4a5a6a'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = cs[(x * 3 + y + Math.floor(rng() * 2)) % cs.length]; g.fillRect(x * 64, y * 64, 64, 64); }
    noise(g, w, h, rng, 0.08, 800, 2);
    snowPatches(g, w, h, rng, 1.3, 0.6);
  });
}

export function lotTexture(seed = 7) {
  // parking lot: asphalt with stall lines baked in (lines every 1/4 of the texture)
  return make(`lot${seed}`, 512, 512, (g, w, h) => {
    const base = asphaltTexture(seed, 0.0).image;
    g.drawImage(base, 0, 0);
    g.fillStyle = 'rgba(230,228,215,0.8)';
    for (let i = 0; i < 4; i++) { g.fillRect(i * w / 4 + 2, h * 0.04, 5, h * 0.36); g.fillRect(i * w / 4 + 2, h * 0.6, 5, h * 0.36); }
    const rng = mulberry32(seed + 5);
    snowPatches(g, w, h, rng, 0.8, 1.1);
  });
}

export function footprintTexture() {
  return make('footprint', 64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    // boot sole (toe at top)
    g.beginPath(); g.ellipse(w / 2, h * 0.3, w * 0.34, h * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w / 2, h * 0.75, w * 0.26, h * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(w * 0.3, h * 0.45, w * 0.4, h * 0.2);
  }, false);
}

export function pawprintTexture() {
  return make('pawprint', 64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(w / 2, h * 0.62, w * 0.2, h * 0.18, 0, 0, Math.PI * 2); g.fill();
    for (const [x, y] of [[0.28, 0.35], [0.43, 0.25], [0.57, 0.25], [0.72, 0.35]]) { g.beginPath(); g.arc(w * x, h * y, w * 0.08, 0, Math.PI * 2); g.fill(); }
  }, false);
}

export function signTexture(text, sub = '', bg = '#e8e2d0', fg = '#3a2e24', w = 512, h = 256) {
  return make(`sign_${text}_${sub}_${bg}`, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${Math.floor(h * 0.3)}px system-ui, sans-serif`;
    g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) { g.font = `${Math.floor(h * 0.16)}px system-ui, sans-serif`; g.fillText(sub, w / 2, h * 0.72); }
  }, false);
}

export function graffitiTexture(text, color = '#b8453a') {
  return make(`graf_${text}`, 512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${Math.floor(h * 0.34)}px "Comic Sans MS", "Segoe Print", cursive`;
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.05); g.fillText(text, 0, 0); g.restore();
  }, false);
}

export function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}
