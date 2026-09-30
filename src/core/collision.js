// 2D collision on the XZ plane: circles and rotated boxes stored in a spatial hash.
const CELL = 8;

export class Collision {
  constructor() { this.grid = new Map(); this.all = []; }

  _key(cx, cz) { return cx * 100003 + cz; }
  _insert(c) {
    this.all.push(c);
    const x0 = Math.floor((c.x - c.bound) / CELL), x1 = Math.floor((c.x + c.bound) / CELL);
    const z0 = Math.floor((c.z - c.bound) / CELL), z1 = Math.floor((c.z + c.bound) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = this._key(i, j);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(c);
    }
    return c;
  }
  circle(x, z, r, tag) { return this._insert({ type: 'c', x, z, r, bound: r, tag, on: true }); }
  /** box centered at x,z with half extents hw (local x) and hd (local z), rotated by rot (radians around Y). */
  box(x, z, hw, hd, rot = 0, tag) {
    return this._insert({ type: 'b', x, z, hw, hd, rot, cos: Math.cos(rot), sin: Math.sin(rot), bound: Math.hypot(hw, hd), tag, on: true });
  }

  nearby(x, z, r) {
    const out = new Set();
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const l = this.grid.get(this._key(i, j));
      if (l) for (const c of l) if (c.on) out.add(c);
    }
    return out;
  }

  /** Push a circle (x,z,r) out of all colliders. Returns corrected {x,z,hit}. */
  resolve(x, z, r, iterations = 3) {
    let hit = false;
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      for (const c of this.nearby(x, z, r + 1)) {
        if (c.type === 'c') {
          const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
          if (d < m && d > 1e-6) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; moved = hit = true; }
        } else {
          // to box local space (rotation around Y: local x = cos*dx - sin*dz ... consistent with three's rotation.y)
          const dx = x - c.x, dz = z - c.z;
          const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
          const px = Math.max(-c.hw, Math.min(c.hw, lx)), pz = Math.max(-c.hd, Math.min(c.hd, lz));
          let ox = lx - px, oz = lz - pz; const d = Math.hypot(ox, oz);
          if (d < r) {
            let nx, nz;
            if (d > 1e-6) { nx = px + (ox / d) * r; nz = pz + (oz / d) * r; }
            else { // center inside box: push out along smallest penetration
              const ex = c.hw - Math.abs(lx), ez = c.hd - Math.abs(lz);
              if (ex < ez) { nx = Math.sign(lx || 1) * (c.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (c.hd + r); }
            }
            // back to world
            x = c.x + c.cos * nx + c.sin * nz; z = c.z - c.sin * nx + c.cos * nz;
            moved = hit = true;
          }
        }
      }
      if (!moved) break;
    }
    return { x, z, hit };
  }

  /** True if segment a->b is blocked (sampled). Used for line of sight / shots. */
  blocked(ax, az, bx, bz, step = 0.5, ignoreTag) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / step);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const c of this.nearby(x, z, 0.5)) {
        if (c.tag === ignoreTag || c.low) continue;
        if (c.type === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r) return true; }
        else {
          const dx = x - c.x, dz = z - c.z;
          const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
          if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true;
        }
      }
    }
    return false;
  }
}
