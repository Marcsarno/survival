# Foliage for the opening: generated leaf textures (numpy) and trees, palms, shrubs, palmettos and grass
# built from leaf cards. Cards get custom normals pointing out of their clump, so canopies shade as soft
# masses (the painted look of the concept art) instead of a scatter of flat quads.
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix, noise
from . import common as C

FOL = C.FOLIAGE   # PNG originals; tools/optimize-assets.mjs makes the game's WebP copies

# ------------------------------------------------------------------ textures
def _save_png(arr, path):
    """arr: H x W x 4 float 0..1, row 0 = top."""
    h, w = arr.shape[:2]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    im.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)

def _down(a, k):
    h, w, c = a.shape
    return a.reshape(h // k, k, w // k, k, c).mean(axis=(1, 3))

def _leaf(canvas, cx, cy, L, W, ang, col, rng, rib=0.75):
    """Draw one pointed leaf (base at cx,cy, pointing along ang) into canvas (premultiplied over)."""
    H, Wd = canvas.shape[:2]
    ca, sa = math.cos(ang), math.sin(ang)
    x0, x1 = int(max(0, cx - L - 2)), int(min(Wd, cx + L + 2)); y0, y1 = int(max(0, cy - L - 2)), int(min(H, cy + L + 2))
    if x1 <= x0 or y1 <= y0: return
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    dx, dy = xs - cx, ys - cy
    u = (dx * ca + dy * sa) / L                 # 0 base .. 1 tip
    v = (-dx * sa + dy * ca) / (W * 0.5)        # -1 .. 1 across
    prof = np.clip(np.sin(np.clip(u, 0, 1) * math.pi) ** 0.7, 0, 1)
    inside = (u > 0) & (u < 1) & (np.abs(v) < prof)
    if not inside.any(): return
    a = inside.astype(np.float32)
    # shading: lighter on the lit half (toward top-left), darker edge, a darker midrib
    side = np.clip(0.5 + 0.5 * v * (1 if sa > 0 else -1), 0, 1)
    shade = 0.82 + 0.25 * side - 0.18 * (np.abs(v) / np.maximum(prof, 1e-3)) ** 3
    shade = shade * (1 - 0.25 * np.exp(-(v * 6) ** 2) * (u < 0.9) * rib)
    c = np.stack([col[0] * shade, col[1] * shade, col[2] * shade], -1)
    sub = canvas[y0:y1, x0:x1]
    sub[..., :3] = sub[..., :3] * (1 - a[..., None]) + c * a[..., None]
    sub[..., 3] = np.maximum(sub[..., 3], a)

def leaves_atlas(path, size=1024, ss=2, seed=3):
    """2x2 atlas of leaf clusters: olive, deep green, sunlit yellow-green, dry olive."""
    rng = random.Random(seed); S = size * ss
    canvas = np.zeros((S, S, 4), np.float32)
    palettes = [
        [(0.22, 0.30, 0.12), (0.30, 0.38, 0.15), (0.26, 0.34, 0.14), (0.35, 0.40, 0.18)],
        [(0.14, 0.24, 0.10), (0.19, 0.30, 0.12), (0.16, 0.27, 0.12), (0.22, 0.32, 0.14)],
        [(0.34, 0.42, 0.16), (0.42, 0.48, 0.20), (0.38, 0.45, 0.18), (0.30, 0.38, 0.14)],
        [(0.32, 0.33, 0.16), (0.40, 0.38, 0.20), (0.28, 0.30, 0.14), (0.45, 0.40, 0.22)],
    ]
    half = S // 2
    for q in range(4):
        ox, oy = (q % 2) * half, (q // 2) * half
        cx, cy, R = ox + half / 2, oy + half / 2, half * 0.47
        pal = palettes[q]
        for i in range(520):
            r = R * math.sqrt(rng.random()) * 0.92
            t = rng.random() * 2 * math.pi
            x, y = cx + r * math.cos(t), cy + r * math.sin(t)
            L = half * rng.uniform(0.075, 0.12); W = L * rng.uniform(0.36, 0.48)
            ang = t + rng.uniform(-0.9, 0.9)
            depth = i / 520                           # later leaves are on top: lighter
            k = 0.62 + 0.45 * depth + (0.12 if (y < cy and x < cx) else 0)
            base = pal[rng.randrange(len(pal))]
            col = tuple(min(1, c * k * rng.uniform(0.9, 1.1)) for c in base)
            _leaf(canvas, x, y, L, W, ang, col, rng)
    out = _down(canvas, ss)
    out[..., :3] = np.where(out[..., 3:4] > 0, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)  # un-premultiply edges
    _bleed(out)
    _save_png(out, path)

def frond_atlas(path, w=512, h=1024, ss=2, seed=5):
    """Two palm fronds side by side: green (left) and dead brown (right). Rachis along the height."""
    rng = random.Random(seed)
    canvas = np.zeros((h * ss, w * 2 * ss, 4), np.float32)
    for k, (green, tipc) in enumerate([((0.25, 0.36, 0.13), (0.42, 0.40, 0.18)), ((0.42, 0.33, 0.20), (0.33, 0.25, 0.16))]):
        ox = k * w * ss; cx = ox + w * ss / 2; H = h * ss
        n = 46
        for i in range(n):
            t = i / n
            y = H * (0.97 - 0.92 * t)                # base at the bottom
            Lmax = w * ss * 0.48 * (math.sin(min(1, t * 1.15 + 0.08) * math.pi) ** 0.6)
            for s in (-1, 1):
                L = Lmax * rng.uniform(0.85, 1.05)
                ang = -math.pi / 2 + s * (math.pi / 2 - rng.uniform(0.55, 0.85))   # angled toward the tip
                col = tuple(g * rng.uniform(0.85, 1.12) for g in green)
                _leaf(canvas, cx, y, L, L * 0.16, ang, col, rng, rib=0.4)
                if rng.random() < (0.15 if k == 0 else 0.5):  # browned tips
                    tx, ty = cx + math.cos(ang) * L * 0.75, y + math.sin(ang) * L * 0.75
                    _leaf(canvas, tx, ty, L * 0.27, L * 0.12, ang, tipc, rng, rib=0)
        # rachis
        ys = np.arange(int(H * 0.05), int(H * 0.99))
        for dx in range(-3 * ss, 3 * ss + 1):
            canvas[ys, int(cx + dx), :3] = (0.36, 0.33, 0.18) if k == 0 else (0.40, 0.31, 0.19)
            canvas[ys, int(cx + dx), 3] = 1
    out = _down(canvas, ss)
    out[..., :3] = np.where(out[..., 3:4] > 0, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    _bleed(out); _save_png(out, path)

def fan_texture(path, size=512, ss=2, seed=7):
    """A palmetto fan: stiff blades radiating from the bottom center."""
    rng = random.Random(seed); S = size * ss
    canvas = np.zeros((S, S, 4), np.float32)
    cx, cy = S / 2, S * 0.96
    for i in range(34):
        ang = -math.pi + 0.15 + (math.pi - 0.3) * i / 33 + rng.uniform(-0.03, 0.03)
        L = S * rng.uniform(0.78, 0.9)
        col = (0.24 * rng.uniform(0.85, 1.15), 0.35 * rng.uniform(0.9, 1.1), 0.17 * rng.uniform(0.85, 1.15))
        _leaf(canvas, cx + math.cos(ang) * S * 0.06, cy + math.sin(ang) * S * 0.06, L, L * 0.07, ang, col, rng, rib=0.5)
    out = _down(canvas, ss); out[..., :3] = np.where(out[..., 3:4] > 0, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    _bleed(out); _save_png(out, path)

def grass_texture(path, w=512, h=256, ss=2, seed=9):
    rng = random.Random(seed)
    canvas = np.zeros((h * ss, w * ss, 4), np.float32)
    for i in range(170):
        x = rng.uniform(0.05, 0.95) * w * ss; L = rng.uniform(0.45, 0.95) * h * ss
        ang = -math.pi / 2 + rng.uniform(-0.45, 0.45)
        g = rng.random()
        col = (0.30 + 0.16 * g, 0.36 + 0.10 * g, 0.15 + 0.06 * g) if rng.random() < 0.75 else (0.52, 0.47, 0.30)
        _leaf(canvas, x, h * ss * 0.99, L, w * ss * 0.012, ang, col, rng, rib=0)
    out = _down(canvas, ss); out[..., :3] = np.where(out[..., 3:4] > 0, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    _bleed(out); _save_png(out, path)

def _bleed(img, it=6):
    """Spread colors into transparent pixels so mipmaps don't fringe white."""
    a = img[..., 3] > 0.01
    rgb = img[..., :3].copy(); filled = a.copy()
    for _ in range(it):
        acc = np.zeros_like(rgb); cnt = np.zeros(filled.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(filled, dy, 0), dx, 1); acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * sh[..., None]; cnt += sh
        new = (~filled) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; filled |= new
    img[..., :3] = rgb

def textures():
    os.makedirs(FOL, exist_ok=True)
    leaves_atlas(os.path.join(FOL, 'leaves.png'))
    frond_atlas(os.path.join(FOL, 'frond.png'))
    fan_texture(os.path.join(FOL, 'fan.png'))
    grass_texture(os.path.join(FOL, 'grass.png'))

# ------------------------------------------------------------------ geometry helpers
def _tube(bm, pts, radii, segs, uvl, col, v_scale=1.0, circ_scale=1.0):
    """Tube along pts with radii; UV u around (0..circ/1m), v along length (meters * v_scale)."""
    rings, frames = [], []
    up = Vector((0, 0, 1))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        q = t.to_track_quat('Z', 'Y')
        ring = [bm.verts.new(p + q @ Vector((math.cos(2 * math.pi * k / segs) * radii[i], math.sin(2 * math.pi * k / segs) * radii[i], 0))) for k in range(segs)]
        rings.append(ring)
    vlen = [0.0]
    for i in range(1, len(pts)): vlen.append(vlen[-1] + (pts[i] - pts[i - 1]).length)
    colL = C.ensure_col(bm)
    for i in range(len(pts) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            circ = 2 * math.pi * max(radii[i], 0.05) * circ_scale
            uvs = [(k / segs * circ, vlen[i] * v_scale), ((k + 1) / segs * circ, vlen[i] * v_scale), ((k + 1) / segs * circ, vlen[i + 1] * v_scale), (k / segs * circ, vlen[i + 1] * v_scale)]
            for l, uv in zip(f.loops, uvs):
                l[uvl].uv = uv
                g = col(l.vert.co) if callable(col) else col
                l[colL] = (*g, 1)
    return rings

def _card(bm, uvl, colL, center, normal, size, quad, tint, spin=0.0, bend=0.0):
    """A square card facing `normal`, UVs into atlas quadrant quad (0..3), or full texture if quad is None."""
    n = Vector(normal).normalized()
    q = n.to_track_quat('Z', 'Y') @ Matrix.Rotation(spin, 3, 'Z').to_quaternion()
    h = size / 2
    corners = [Vector((-h, -h, 0)), Vector((h, -h, 0)), Vector((h, h, 0)), Vector((-h, h, 0))]
    vs = [bm.verts.new(Vector(center) + q @ (c + Vector((0, 0, -bend * (c.x * c.x + c.y * c.y) / (h * h))))) for c in corners]
    f = bm.faces.new(vs)
    if quad is None: u0, v0, du = 0, 0, 1
    else: u0, v0, du = (quad % 2) * 0.5, (1 - quad // 2) * 0.5, 0.5
    for l, (a, b) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uvl].uv = (u0 + a * du, v0 + b * du); l[colL] = (*tint, 1)
    return f

def _soft_normals(obj, centers_per_face, up_bias=0.45):
    """Custom normals: each card's vertices point away from its clump center (plus some up)."""
    me = obj.data; me.update()
    normals = []
    for poly in me.polygons:
        c = centers_per_face[poly.index]
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            d = (v - c); d.z += up_bias * d.length
            normals.append(d.normalized() if d.length > 1e-5 else Vector((0, 0, 1)))
    C.set_custom_normals(obj, normals)

def _canopy(bm, uvl, colL, centers, clumps, rng, quads, card=(1.4, 2.1), density=34, dark=0.55):
    """Clumps: list of (center, radius). Appends card faces; records each face's clump center."""
    for (c, R) in clumps:
        c = Vector(c)
        n = int(density * (R / 1.5) ** 2) + 8
        for i in range(n):
            # points biased toward the clump surface and its top
            d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)) * 0.9 + 0.1 * rng.gauss(0, 1))).normalized()
            r = R * (0.35 + 0.65 * rng.random() ** 0.5)
            p = c + Vector((d.x * r, d.y * r, d.z * r * 0.78))
            nrm = (d + Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), 0.7))).normalized()
            s = rng.uniform(*card) * (R / 1.6) ** 0.35
            h = (p.z - (c.z - R)) / (2 * R)          # 0 bottom .. 1 top of clump
            k = dark + (1 - dark) * min(1, 0.25 + 0.95 * h) * (0.7 + 0.3 * (r / R))
            tint = (k * rng.uniform(0.93, 1.05), k * rng.uniform(0.95, 1.05), k * rng.uniform(0.9, 1.0))
            _card(bm, uvl, colL, p, nrm, s, rng.choice(quads), tint, spin=rng.uniform(0, 6.28), bend=0.12)
            centers.append(c.copy())

def _finish(name, bm_wood, wood_mat, bm_leaf, leaf_mat, centers, up_bias=0.45):
    objs = []
    if bm_wood is not None:
        o = C.new_obj(name + '_wood', bm_wood, [wood_mat]); objs.append(o)
    if bm_leaf is not None:
        o = C.new_obj(name + '_leaves', bm_leaf, [leaf_mat]); _soft_normals(o, centers, up_bias); objs.append(o)
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    for o in objs: o.parent = root
    return root

# ------------------------------------------------------------------ assets
def oak(name, seed, H=8.0, spread=3.6, lean=(0.0, 0.0)):
    """A broad live-oak-like shade tree: thick trunk, a few heavy limbs, clumped canopy."""
    rng = random.Random(seed)
    bw = bmesh.new(); uvw = bw.loops.layers.uv.new('UVMap')
    base = Vector((0, 0, -0.1)); crown = Vector((lean[0], lean[1], H * 0.42))
    pts, radii = [], []
    for i in range(9):
        t = i / 8
        p = base.lerp(crown, t) + Vector((math.sin(t * 3 + seed) * 0.15, math.cos(t * 2.3 + seed) * 0.12, 0))
        pts.append(p); radii.append(0.36 * (1 - 0.45 * t) * (1.35 if i == 0 else 1.12 if i == 1 else 1))
    trunk_col = lambda v: (0.85 + 0.15 * min(1, v.z / 2), 0.85 + 0.15 * min(1, v.z / 2), 0.85 + 0.15 * min(1, v.z / 2))
    _tube(bw, pts, radii, 10, uvw, trunk_col, v_scale=0.6, circ_scale=0.6)
    clumps = [(crown + Vector((0, 0, H * 0.33)), spread * 0.55)]
    nl = rng.randint(4, 6)
    for i in range(nl):
        a = 2 * math.pi * i / nl + rng.uniform(-0.3, 0.3)
        reach = spread * rng.uniform(0.55, 0.85)
        end = crown + Vector((math.cos(a) * reach, math.sin(a) * reach, H * rng.uniform(0.22, 0.4)))
        mid = crown.lerp(end, 0.5) + Vector((0, 0, rng.uniform(-0.2, 0.4)))
        lp = [crown + Vector((0, 0, -0.3)), mid, end]
        _tube(bw, lp, [0.2, 0.13, 0.06], 7, uvw, (0.95, 0.95, 0.95), v_scale=0.6, circ_scale=0.6)
        clumps.append((end + Vector((0, 0, 0.3)), spread * rng.uniform(0.36, 0.48)))
    bl = bmesh.new(); uvl = bl.loops.layers.uv.new('UVMap'); colL = C.ensure_col(bl); centers = []
    _canopy(bl, uvl, colL, centers, clumps, rng, quads=[0, 0, 1, 2, 3], card=(1.5, 2.3), density=40)
    return _finish(name, bw, 'Bark', bl, 'Leaves', centers)

def palm(name, seed, H=7.5, curve=1.2, fronds=18, dead=5):
    """A cabbage/sabal-style palm: slim ringed trunk with a curve, arching fronds, a few dead hanging ones."""
    rng = random.Random(seed)
    dirx, diry = math.cos(seed), math.sin(seed)
    bw = bmesh.new(); uvw = bw.loops.layers.uv.new('UVMap')
    pts, radii = [], []
    for i in range(12):
        t = i / 11
        off = curve * (t ** 1.8)
        pts.append(Vector((dirx * off, diry * off, -0.1 + H * t)))
        radii.append(0.24 * (1.25 - 0.35 * t) + (0.1 if i == 11 else 0))
    _tube(bw, pts, radii, 9, uvw, lambda v: (0.9, 0.88, 0.85), v_scale=0.5, circ_scale=0.5)
    top = pts[-1]
    bl = bmesh.new(); uvl = bl.loops.layers.uv.new('UVMap'); colL = C.ensure_col(bl); centers = []
    def frond(az, elev, L, dead_):
        segs = 10; w0 = L * 0.3
        d = Vector((math.cos(az) * math.cos(elev), math.sin(az) * math.cos(elev), math.sin(elev)))
        side = Vector((-math.sin(az), math.cos(az), 0))
        p = top.copy(); v = d * (L / segs); prev = None
        for i in range(segs + 1):
            t = i / segs
            w = w0 * (math.sin(min(1, t * 1.1 + 0.05) * math.pi) ** 0.6) * (0.25 if i == 0 else 1)
            fold = Vector((0, 0, w * 0.18))
            row = [bm_v(p - side * w - fold * 0.2), bm_v(p + fold), bm_v(p + side * w - fold * 0.2)]
            if prev:
                for k in range(2):
                    f = bl.faces.new((prev[k], prev[k + 1], row[k + 1], row[k]))
                    u0 = 0.5 if dead_ else 0.0
                    for l, (a, b) in zip(f.loops, ((k, i - 1), (k + 1, i - 1), (k + 1, i), (k, i))):
                        l[uvl].uv = (u0 + 0.5 * a / 2, b / segs)
                        sh = 0.75 + 0.25 * (b / segs)
                        l[colL] = (sh, sh, sh, 1)
                    centers.append(top.copy())
            prev = row
            p = p + v; v = v + Vector((0, 0, -(L / segs) * (0.3 if not dead_ else 0.5)))
    def bm_v(co): return bl.verts.new(co)
    for i in range(fronds):
        az = 2 * math.pi * i / fronds + rng.uniform(-0.2, 0.2)
        elev = rng.uniform(0.0, 0.7) if i % 3 else rng.uniform(0.7, 1.15)
        frond(az, elev, rng.uniform(3.1, 4.1), False)
    for i in range(dead):
        az = rng.uniform(0, 2 * math.pi)
        frond(az, rng.uniform(-1.35, -1.0), rng.uniform(1.6, 2.2), True)
    return _finish(name, bw, 'PalmBark', bl, 'PalmFrond', centers, up_bias=0.9)

def shrub(name, seed, R=1.0, quads=(1, 0, 3)):
    rng = random.Random(seed)
    bl = bmesh.new(); uvl = bl.loops.layers.uv.new('UVMap'); colL = C.ensure_col(bl); centers = []
    clumps = [(Vector((0, 0, R * 0.55)), R)]
    for i in range(rng.randint(1, 3)):
        a = rng.uniform(0, 6.28)
        clumps.append((Vector((math.cos(a) * R * 0.6, math.sin(a) * R * 0.6, R * 0.45)), R * rng.uniform(0.6, 0.8)))
    _canopy(bl, uvl, colL, centers, clumps, rng, quads=list(quads), card=(0.9, 1.3), density=46, dark=0.45)
    return _finish(name, None, None, bl, 'Leaves', centers, up_bias=0.5)

def palmetto(name, seed, n=16, R=0.9):
    rng = random.Random(seed)
    bw = bmesh.new(); uvw = bw.loops.layers.uv.new('UVMap')
    bl = bmesh.new(); uvl = bl.loops.layers.uv.new('UVMap'); colL = C.ensure_col(bl); centers = []
    for i in range(n):
        a = rng.uniform(0, 6.28); tilt = rng.uniform(0.25, 1.0)
        L = R * rng.uniform(0.5, 0.9)
        tip = Vector((math.cos(a) * L * math.sin(tilt), math.sin(a) * L * math.sin(tilt), L * math.cos(tilt) * 0.9 + 0.1))
        _tube(bw, [Vector((0, 0, 0)), tip * 0.98], [0.015, 0.01], 4, uvw, (0.5, 0.6, 0.35))
        nrm = Vector((math.cos(a) * math.sin(tilt) * 0.6, math.sin(a) * math.sin(tilt) * 0.6, 1)).normalized()
        s = R * rng.uniform(0.7, 1.0)
        k = rng.uniform(0.75, 1.0)
        # fan card: the texture's base sits at the stem tip
        q = nrm.to_track_quat('Z', 'Y')
        fwd = q @ Vector((0, 1, 0))
        f = _card(bl, uvl, colL, tip + fwd * s * 0.42, nrm, s, None, (k, k, k), spin=0, bend=0.15)
        centers.append(Vector((0, 0, 0.1)))
    return _finish(name, bw, 'Wood', bl, 'FanLeaf', centers, up_bias=1.0)

def grass_tuft(name, seed):
    rng = random.Random(seed)
    bl = bmesh.new(); uvl = bl.loops.layers.uv.new('UVMap'); colL = C.ensure_col(bl); centers = []
    for i in range(3):
        a = i * math.pi / 3 + rng.uniform(-0.2, 0.2); w, h = 0.7, 0.35
        dx, dy = math.cos(a) * w / 2, math.sin(a) * w / 2
        vs = [bl.verts.new(c) for c in ((-dx, -dy, 0), (dx, dy, 0), (dx * 1.1, dy * 1.1, h), (-dx * 1.1, -dy * 1.1, h))]
        f = bl.faces.new(vs)
        for l, uv, k in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1)), (0.6, 0.6, 1, 1)): l[uvl].uv = uv; l[colL] = (k, k, k, 1)
        centers.append(Vector((0, 0, -0.5)))
    return _finish(name, None, None, bl, 'Grass', centers, up_bias=2.0)

def build_all():
    out = {}
    out['oak_a'] = oak('oak_a', 11, H=8.5, spread=3.8)
    out['oak_b'] = oak('oak_b', 23, H=7.2, spread=3.2, lean=(0.5, 0.2))
    out['oak_c'] = oak('oak_c', 37, H=9.5, spread=4.4, lean=(-0.4, 0.3))
    out['palm_a'] = palm('palm_a', 2, H=7.8, curve=1.0)
    out['palm_b'] = palm('palm_b', 5, H=9.2, curve=1.8, fronds=20)
    out['palm_c'] = palm('palm_c', 8, H=6.2, curve=0.5, fronds=16, dead=7)
    out['shrub_a'] = shrub('shrub_a', 4, R=0.9)
    out['shrub_b'] = shrub('shrub_b', 9, R=1.3, quads=(1, 1, 0))
    out['shrub_c'] = shrub('shrub_c', 13, R=0.7, quads=(3, 0))
    out['palmetto_a'] = palmetto('palmetto_a', 3)
    out['palmetto_b'] = palmetto('palmetto_b', 6, n=22, R=1.1)
    out['grass_a'] = grass_tuft('grass_a', 1)
    return out
