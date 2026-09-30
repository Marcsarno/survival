# Builds every game model into public/assets/models/ from:
#   1. downloaded CC0 / CC-BY models in assets/source/ (normalized, snow-capped, recolored)
#   2. procedural faceted models generated here (trees, palms, plants, rocks, lantern, cars)
# Editable .blend copies are saved to assets/blend/.
#
# Usage: blender --background --factory-startup --python blender/build_assets.py [-- only_name ...]
import bpy, bmesh, sys, os, math, random, json
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "source")
OUT = os.path.join(ROOT, "public", "assets", "models")
BLEND = os.path.join(ROOT, "assets", "blend")
os.makedirs(OUT, exist_ok=True); os.makedirs(BLEND, exist_ok=True)
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LOG = []

# ---------------------------------------------------------------- palette
# sRGB hex values shared with the game (src/palette.js mirrors these)
PAL = dict(
    snow="#eef2fa", snow_shade="#c9d3e6", pine="#35523a", pine_dark="#28402e", bark="#5e4130",
    palm_leaf="#4f6b3a", palm_leaf_dark="#3d5530", palm_trunk="#7a6048", coconut="#5a4630",
    shrub="#3f5c3a", sea_grape="#56703f", agave="#6f8c73", croton="#8d3b2f", rock="#7d7872",
    rock_dark="#5f5b57", metal_dark="#2b2a28", lantern_glow="#ffb04a", glass="#27303a",
    tire="#1c1c1e", car_paint="#8a8f96", chrome="#9a9ea3", light_red="#8a1f1a", light_white="#e8e2c8",
    jacket="#56663a", jacket_dark="#46552f", denim="#3b4963", boot="#4a3424", pack="#6e4a2c",
    zskin="#8b957f", zcloth="#5a534b", zcloth2="#47433e", zpants="#3a3a40", zhair="#2b2622",
)

def lin(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)

_mats = {}
def mat(name, hexcol, rough=0.92, metal=0.0, emit=None, emit_strength=0.0, double=False):
    if name in _mats and _mats[name].name in bpy.data.materials:
        return _mats[name]
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = lin(hexcol)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = lin(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    m.use_backface_culling = not double
    _mats[name] = m
    return m

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()

def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def export(objs, name, anim=False, save_blend=True):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        for c in o.children_recursive: c.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_animations=anim, export_yup=True)
    if save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND, name + ".blend"), copy=True)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.selected_objects if o.type == "MESH")
    LOG.append(dict(name=name, tris=tris, bytes=os.path.getsize(path)))
    print(f"@@ exported {name}.glb tris={tris} {os.path.getsize(path)//1024}KB")

def want(name):
    return not ONLY or name in ONLY

# ---------------------------------------------------------------- bmesh helpers
class Builder:
    """Accumulates faceted geometry with per-face material slots."""
    def __init__(self, name):
        self.name = name; self.bm = bmesh.new(); self.slots = []
        self.tags = {}  # face -> tag string (for snow assignment)

    def slot(self, m):
        if m not in self.slots: self.slots.append(m)
        return self.slots.index(m)

    def _faces(self, verts):
        return list({f for v in verts for f in v.link_faces})

    def ico(self, center, r, m, scale=(1, 1, 1), jitter=0.12, sub=1, rng=random, tag=None):
        mtx = Matrix.Translation(center) @ Matrix.Diagonal((*scale, 1.0))
        ret = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r, matrix=mtx)
        for v in ret["verts"]:
            v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * jitter * r
        return self._set(self._faces(ret["verts"]), m, tag)

    def cone(self, base, top, r1, r2, m, segs=6, jitter=0.0, rng=random, tag=None):
        d = top - base; L = d.length
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        mtx = Matrix.Translation(base + d / 2) @ rot
        ret = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segs,
                                    radius1=r1, radius2=r2, depth=L, matrix=mtx)
        for v in ret["verts"]:
            v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * jitter
        return self._set(self._faces(ret["verts"]), m, tag)

    def box(self, center, size, m, cuts=0, jitter=0.0, rng=random, tag=None, taper_top=None):
        ret = bmesh.ops.create_cube(self.bm, size=1.0, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1.0)))
        verts = ret["verts"]
        if taper_top:  # (sx, sy, dx) scale top verts around center and shift x
            for v in verts:
                if v.co.z > center.z:
                    v.co.x = center.x + (v.co.x - center.x) * taper_top[0] + taper_top[2]
                    v.co.y = center.y + (v.co.y - center.y) * taper_top[1]
        faces = self._faces(verts)
        if cuts:
            edges = list({e for f in faces for e in f.edges})
            r = bmesh.ops.subdivide_edges(self.bm, edges=edges, cuts=cuts, use_grid_fill=True)
            verts = list({v for f in faces for v in f.verts} | set(x for x in r["geom"] if isinstance(x, bmesh.types.BMVert)))
            faces = self._faces(verts)
        for v in {v for f in faces for v in f.verts}:
            v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * jitter
        return self._set(faces, m, tag)

    def poly(self, pts, m, tag=None):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        return self._set([f], m, tag)

    def _set(self, faces, m, tag):
        i = self.slot(m)
        for f in faces:
            f.material_index = i
            if tag: self.tags[f] = tag
        return faces

    def snow(self, tag, snow_mat, thresh=0.45, chance=1.0, rng=random):
        self.bm.normal_update()
        si = self.slot(snow_mat)
        for f, t in self.tags.items():
            if t == tag and f.is_valid and f.normal.z > thresh and rng.random() < chance:
                f.material_index = si

    def finish(self, triangulate=True):
        if triangulate:
            bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me); self.bm.free()
        for p in me.polygons: p.use_smooth = False
        for m in self.slots: me.materials.append(m)
        return link(bpy.data.objects.new(self.name, me))

# ---------------------------------------------------------------- procedural models
def build_pine(name, seed, H):
    rng = random.Random(seed); b = Builder(name)
    bark, leaf, leaf2, snow = mat("Bark", PAL["bark"]), mat("Pine", PAL["pine"]), mat("PineDark", PAL["pine_dark"]), mat("Snow", PAL["snow"], 0.8)
    lean = Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 0))
    top = Vector((0, 0, H)) + lean
    b.cone(Vector((0, 0, -0.1)), top, 0.26, 0.08, bark, segs=6, rng=rng)
    n = rng.randint(7, 9)
    for i in range(n):
        t = 0.5 + 0.5 * (i / max(n - 1, 1))
        a = rng.uniform(0, math.tau)
        rad = (1.0 - t) * 2.6 + rng.uniform(0.2, 0.7)
        c = Vector((0, 0, H * t)) + lean * t + Vector((math.cos(a), math.sin(a), 0)) * rad
        r = rng.uniform(0.95, 1.3) * (1.25 - 0.45 * t) * H / 10
        b.cone(Vector((0, 0, H * t - 0.4)) + lean * t, c, 0.07, 0.04, bark, segs=4, rng=rng)
        b.ico(c, r * 1.25, leaf if i % 2 else leaf2, scale=(1.1, 1.1, 0.72), jitter=0.16, rng=rng, tag="leaf")
    b.ico(top + Vector((0, 0, 0.15)), 0.9 * H / 10, leaf, scale=(1, 1, 0.8), jitter=0.15, rng=rng, tag="leaf")
    b.snow("leaf", snow, thresh=0.42, rng=rng)
    return b.finish()

def build_fir(name, seed, H):
    rng = random.Random(seed); b = Builder(name)
    bark, leaf, snow = mat("Bark", PAL["bark"]), mat("Pine", PAL["pine"]), mat("Snow", PAL["snow"], 0.8)
    b.cone(Vector((0, 0, -0.1)), Vector((0, 0, H * 0.4)), 0.18, 0.12, bark, segs=6, rng=rng)
    tiers = 4
    for i in range(tiers):
        z0 = H * (0.22 + 0.18 * i); r = H * 0.28 * (1 - i / (tiers + 0.6))
        b.cone(Vector((0, 0, z0)), Vector((0, 0, z0 + H * 0.34)), r, r * 0.12, leaf, segs=7, jitter=0.12 * r, rng=rng, tag="leaf")
    b.snow("leaf", snow, thresh=0.5, rng=rng)
    return b.finish()

def build_palm(name, seed, H):
    rng = random.Random(seed); b = Builder(name)
    trunk, ring = mat("PalmTrunk", PAL["palm_trunk"]), mat("Bark", PAL["bark"])
    leafm = mat("PalmLeaf", PAL["palm_leaf"], double=True); leafd = mat("PalmLeafDark", PAL["palm_leaf_dark"], double=True)
    snow = mat("SnowLeaf", PAL["snow"], 0.8, double=True); nut = mat("Coconut", PAL["coconut"])
    lean = Vector((rng.uniform(0.6, 1.6), 0, 0)).to_3d()
    lean.rotate(Matrix.Rotation(rng.uniform(0, math.tau), 3, "Z"))
    segs = 9
    def P(t): return Vector((0, 0, H * t)) + lean * (t * t)
    for i in range(segs):
        t0, t1 = i / segs, (i + 1) / segs
        r0 = 0.24 - 0.08 * t0
        b.cone(P(t0), P(t1) + (P(t1) - P(t0)) * 0.05, r0 * 1.12, r0 * 0.9, trunk if i % 2 == 0 else ring, segs=6, rng=rng)
    crown = P(1.0) + Vector((0, 0, 0.05))
    for k in range(3):
        a = k * math.tau / 3
        b.ico(crown + Vector((math.cos(a) * 0.18, math.sin(a) * 0.18, -0.2)), 0.13, nut, jitter=0.1, rng=rng)
    b.ico(crown, 0.28, leafd, scale=(1, 1, 0.7), rng=rng)
    nf = rng.randint(8, 10)
    for fi in range(nf):
        a = fi * math.tau / nf + rng.uniform(-0.2, 0.2)
        dirv = Vector((math.cos(a), math.sin(a), 0)); side = Vector((-dirv.y, dirv.x, 0))
        L = rng.uniform(2.4, 3.2) * H / 7; lift = rng.uniform(0.35, 0.8); droop = rng.uniform(1.2, 1.9)
        K = 7; rows = []
        for j in range(K + 1):
            t = j / K
            mid = crown + dirv * (L * t) + Vector((0, 0, lift * math.sin(math.pi * t * 0.7) - droop * t * t))
            w = 0.62 * math.sin(math.pi * (0.12 + 0.88 * t)) * (1.0 if j % 2 == 0 else 0.62) + 0.04
            fold = 0.2 * w
            rows.append((mid + side * w - Vector((0, 0, fold)), mid, mid - side * w - Vector((0, 0, fold))))
        m = leafm if fi % 2 == 0 else leafd
        for j in range(K):
            l0, m0, r0 = rows[j]; l1, m1, r1 = rows[j + 1]
            # snow settles on the inner, flatter part of each frond (both halves of a segment together)
            snowy = rng.random() < (0.75 * (1 - j / K) + 0.05)
            tg = "snowseg" if snowy else "leaf"
            b.poly([l0, l1, m1, m0], m, tag=tg)
            b.poly([m0, m1, r1, r0], m, tag=tg)
    # make all frond faces face upward before snow test
    b.bm.normal_update()
    flip = [f for f, t in b.tags.items() if t in ("leaf", "snowseg") and f.normal.z < 0]
    bmesh.ops.reverse_faces(b.bm, faces=flip)
    b.snow("snowseg", snow, thresh=0.25, chance=1.0, rng=rng)
    return b.finish()

def build_shrub(name, seed, kind):
    rng = random.Random(seed); b = Builder(name)
    snow = mat("Snow", PAL["snow"], 0.8)
    col = {"shrub": PAL["shrub"], "seagrape": PAL["sea_grape"]}[kind]
    leaf = mat("Shrub_" + kind, col)
    n = rng.randint(2, 4)
    for i in range(n):
        a = rng.uniform(0, math.tau); d = rng.uniform(0, 0.45)
        r = rng.uniform(0.45, 0.7)
        b.ico(Vector((math.cos(a) * d, math.sin(a) * d, r * 0.55)), r, leaf, scale=(1, 1, 0.8), jitter=0.18, rng=rng, tag="leaf")
    b.snow("leaf", snow, thresh=0.5, rng=rng)
    return b.finish()

def build_spiky(name, seed, kind):
    """Agave / croton / palmetto style spiky plant."""
    rng = random.Random(seed); b = Builder(name)
    col = {"agave": PAL["agave"], "croton": PAL["croton"], "palmetto": PAL["palm_leaf"]}[kind]
    leaf = mat("Spiky_" + kind, col, double=True); snow = mat("SnowLeaf", PAL["snow"], 0.8, double=True)
    n = rng.randint(10, 14)
    for i in range(n):
        a = i * math.tau / n + rng.uniform(-0.15, 0.15)
        elev = rng.uniform(0.45, 1.15); L = rng.uniform(0.55, 0.9)
        d = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev)))
        side = Vector((-math.sin(a), math.cos(a), 0)) * 0.09
        base = Vector((0, 0, 0.05)); tip = base + d * L; mid = base + d * (L * 0.4) + Vector((0, 0, 0.05))
        b.poly([base + side, mid, tip], leaf, tag="leaf")
        b.poly([base - side, tip, mid], leaf, tag="leaf")
    b.bm.normal_update()
    bmesh.ops.reverse_faces(b.bm, faces=[f for f, t in b.tags.items() if f.normal.z < 0])
    b.snow("leaf", snow, thresh=0.75, chance=0.5, rng=rng)
    return b.finish()

def build_hedge(name, seed, length):
    rng = random.Random(seed); b = Builder(name)
    leaf, snow = mat("Hedge", PAL["shrub"]), mat("Snow", PAL["snow"], 0.8)
    b.box(Vector((0, 0, 0.5)), (length, 0.9, 1.0), leaf, cuts=2, jitter=0.07, rng=rng, tag="leaf")
    b.snow("leaf", snow, thresh=0.6, rng=rng)
    return b.finish()

def build_rock(name, seed, r):
    rng = random.Random(seed); b = Builder(name)
    rock, snow = mat("Rock", PAL["rock"]), mat("Snow", PAL["snow"], 0.8)
    b.ico(Vector((0, 0, r * 0.35)), r, rock, scale=(1.25, 1.0, 0.72), jitter=0.22, rng=rng, tag="rock")
    b.snow("rock", snow, thresh=0.55, rng=rng)
    return b.finish()

def build_snow_mound(name, seed, r):
    rng = random.Random(seed); b = Builder(name)
    snow, shade = mat("Snow", PAL["snow"], 0.8), mat("SnowShade", PAL["snow_shade"], 0.85)
    b.ico(Vector((0, 0, -r * 0.35)), r, snow, scale=(1.6, 1.1, 0.55), jitter=0.2, rng=rng, tag="s")
    b.bm.normal_update()
    si = b.slot(shade)
    for f in b.tags:
        if f.normal.z < 0.35: f.material_index = si
    return b.finish()

def build_lantern(name):
    b = Builder(name)
    metal = mat("LanternMetal", PAL["metal_dark"], 0.6, 0.4)
    glow = mat("LanternGlow", PAL["lantern_glow"], 0.4, 0.0, emit=PAL["lantern_glow"], emit_strength=6.0)
    # origin = top of handle; lantern hangs below
    b.cone(Vector((0, 0, -0.34)), Vector((0, 0, -0.30)), 0.085, 0.085, metal, segs=8)
    b.cone(Vector((0, 0, -0.30)), Vector((0, 0, -0.16)), 0.062, 0.058, glow, segs=8)
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        p = Vector((math.cos(a) * 0.07, math.sin(a) * 0.07, 0))
        b.box(p + Vector((0, 0, -0.23)), (0.012, 0.012, 0.16), metal)
    b.cone(Vector((0, 0, -0.16)), Vector((0, 0, -0.10)), 0.08, 0.025, metal, segs=8)
    for k in range(7):  # handle arc
        a0 = math.pi * k / 7; a1 = math.pi * (k + 1) / 7
        p0 = Vector((math.cos(a0) * 0.075, 0, -0.10 + math.sin(a0) * 0.1))
        p1 = Vector((math.cos(a1) * 0.075, 0, -0.10 + math.sin(a1) * 0.1))
        b.cone(p0, p1, 0.006, 0.006, metal, segs=4)
    return b.finish()

def build_car(name, seed, kind):
    rng = random.Random(seed); b = Builder(name)
    paint = mat("CarPaint", PAL["car_paint"], 0.55, 0.1); glass = mat("CarGlass", PAL["glass"], 0.2)
    tire, chrome = mat("Tire", PAL["tire"]), mat("Chrome", PAL["chrome"], 0.4, 0.6)
    lr, lw = mat("TailLight", PAL["light_red"], 0.4), mat("HeadLight", PAL["light_white"], 0.4)
    snow = mat("Snow", PAL["snow"], 0.8)
    L, W = (4.5, 1.8) if kind == "sedan" else (4.7, 1.9)
    body_h = 0.62 if kind == "sedan" else 0.78
    b.box(Vector((0, 0, 0.32 + body_h / 2)), (L, W, body_h), paint, tag="body")
    cab_L = 2.3 if kind == "sedan" else 3.3; cab_h = 0.6 if kind == "sedan" else 0.75
    cab_x = -0.2 if kind == "sedan" else -0.45
    taper = (0.72, 0.86, -0.1) if kind == "sedan" else (0.9, 0.9, -0.08)
    cab = b.box(Vector((cab_x, 0, 0.32 + body_h + cab_h / 2)), (cab_L, W * 0.9, cab_h), glass, tag="cab", taper_top=taper)
    b.bm.normal_update()
    pi = b.slot(paint)
    for f in cab:
        if f.normal.z > 0.9: f.material_index = pi
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = Vector((sx * L * 0.31, sy * W * 0.47, 0.34))
            rot = Matrix.Rotation(math.pi / 2, 4, "X")
            ret = bmesh.ops.create_cone(b.bm, cap_ends=True, segments=10, radius1=0.34, radius2=0.34, depth=0.24, matrix=Matrix.Translation(c) @ rot)
            b._set(b._faces(ret["verts"]), tire, None)
            ret = bmesh.ops.create_cone(b.bm, cap_ends=True, segments=8, radius1=0.17, radius2=0.17, depth=0.25, matrix=Matrix.Translation(c) @ rot)
            b._set(b._faces(ret["verts"]), chrome, None)
    for sy in (-1, 1):
        b.box(Vector((L / 2 + 0.005, sy * W * 0.36, 0.32 + body_h * 0.7)), (0.04, 0.3, 0.12), lw)
        b.box(Vector((-L / 2 - 0.005, sy * W * 0.38, 0.32 + body_h * 0.7)), (0.04, 0.28, 0.1), lr)
    b.box(Vector((L / 2 + 0.02, 0, 0.42)), (0.08, W * 0.95, 0.14), chrome)
    b.box(Vector((-L / 2 - 0.02, 0, 0.42)), (0.08, W * 0.95, 0.14), chrome)
    b.snow("body", snow, thresh=0.9, rng=rng)
    # lumpy snow on roof and hood
    roof_z = 0.32 + body_h + cab_h
    b.ico(Vector((cab_x - 0.1, 0, roof_z + 0.02)), 0.75, snow, scale=(cab_L * 0.5, W * 0.55, 0.14), jitter=0.12, rng=rng)
    b.ico(Vector((L * 0.36, 0, 0.32 + body_h + 0.01)), 0.6, snow, scale=(1.0, W * 0.6, 0.12), jitter=0.12, rng=rng)
    return b.finish()

def build_snag(name, seed, H):
    """A dead, bare slash pine (a 'snag') for chopping: grey trunk, broken branch stubs, snow on top."""
    rng = random.Random(seed); b = Builder(name)
    bark, dark, snow = mat("DeadBark", "#6e6259"), mat("DeadBarkDark", "#4f463f"), mat("Snow", PAL["snow"], 0.8)
    lean = Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), 0))
    b.cone(Vector((0, 0, -0.1)), Vector((0, 0, H)) + lean, 0.3, 0.07, bark, segs=6, rng=rng, tag="wood")
    for i in range(rng.randint(4, 6)):
        t = rng.uniform(0.35, 0.9); a = rng.uniform(0, math.tau)
        base = Vector((0, 0, H * t)) + lean * t
        tip = base + Vector((math.cos(a), math.sin(a), rng.uniform(0.1, 0.6))) * rng.uniform(0.6, 1.6) * (1.1 - t)
        b.cone(base, tip, 0.07, 0.015, dark if i % 2 else bark, segs=4, rng=rng, tag="wood")
    b.snow("wood", snow, thresh=0.55, rng=rng)
    return b.finish()

def build_iguana(name, seed):
    """A cold-stunned green iguana lying belly-up under a palm (a South Florida cold-snap classic)."""
    rng = random.Random(seed); b = Builder(name)
    skin, belly = mat("IguanaSkin", "#5f8a44"), mat("IguanaBelly", "#b8c483")
    frost = mat("Frost", PAL["snow"], 0.8); dew = mat("Dewlap", "#c98a3a")
    b.ico(Vector((0, 0, 0.1)), 0.16, skin, scale=(0.85, 2.1, 0.62), jitter=0.08, rng=rng, tag="body")
    b.cone(Vector((0, 0.3, 0.1)), Vector((0, 0.52, 0.085)), 0.075, 0.028, skin, segs=5, rng=rng, tag="body")
    b.cone(Vector((0, 0.36, 0.05)), Vector((0, 0.44, 0.03)), 0.03, 0.01, dew, segs=4)
    b.cone(Vector((0, -0.3, 0.09)), Vector((0.08, -0.72, 0.05)), 0.07, 0.03, skin, segs=5, rng=rng, tag="body")
    b.cone(Vector((0.08, -0.72, 0.05)), Vector((0.02, -1.15, 0.03)), 0.03, 0.006, skin, segs=4, rng=rng, tag="body")
    for sx in (-1, 1):   # stiff legs sticking up
        for sy in (-1, 1):
            base = Vector((sx * 0.1, sy * 0.17, 0.14))
            b.cone(base, base + Vector((sx * 0.08, sy * 0.04, 0.16)), 0.028, 0.018, skin, segs=4)
    b.bm.normal_update()
    bi = b.slot(belly)
    for f, t in b.tags.items():
        if t == "body" and f.normal.z > 0.35: f.material_index = bi
    b.snow("body", frost, thresh=0.8, chance=0.4, rng=rng)
    return b.finish()

def build_flamingo(name, seed):
    """Pink plastic lawn flamingo on wire legs, with snow on its back."""
    rng = random.Random(seed); b = Builder(name)
    pink, dark, wire = mat("FlamingoPink", "#e46a8e"), mat("FlamingoBeak", "#2a2426"), mat("Wire", "#6c7076", 0.5, 0.6)
    snow = mat("Snow", PAL["snow"], 0.8)
    b.ico(Vector((0, 0, 0.62)), 0.16, pink, scale=(0.9, 1.7, 0.85), jitter=0.06, rng=rng, tag="body")
    b.cone(Vector((0, -0.22, 0.66)), Vector((0, -0.34, 0.74)), 0.07, 0.02, pink, segs=5)  # tail
    pts = [Vector((0, 0.16, 0.68)), Vector((0, 0.24, 0.84)), Vector((0, 0.18, 0.98)), Vector((0, 0.24, 1.08))]
    for p0, p1 in zip(pts, pts[1:]):
        b.cone(p0, p1, 0.035, 0.03, pink, segs=5)
    b.ico(Vector((0, 0.27, 1.1)), 0.05, pink, jitter=0.05, rng=rng)
    b.cone(Vector((0, 0.31, 1.1)), Vector((0, 0.37, 1.04)), 0.022, 0.006, dark, segs=4)
    for sx in (-0.04, 0.04):
        b.cone(Vector((sx, 0, -0.15)), Vector((sx, 0.02, 0.55)), 0.008, 0.008, wire, segs=4)
    b.snow("body", snow, thresh=0.85, chance=0.45, rng=rng)
    return b.finish()

def build_snowman(name, seed):
    rng = random.Random(seed); b = Builder(name)
    snow, shade = mat("Snow", PAL["snow"], 0.8), mat("SnowShade", PAL["snow_shade"], 0.85)
    coal, carrot, stick, scarf, bucket = mat("Coal", "#1d1d20"), mat("Carrot", "#e0782c"), mat("Stick", "#5e4130"), mat("Scarf", "#b8322a"), mat("Bucket", "#4f6e8a", 0.6, 0.3)
    z = 0
    for r in (0.42, 0.3, 0.21):
        b.ico(Vector((0, 0, z + r * 0.9)), r, snow, sub=2, jitter=0.06, rng=rng, tag="s")
        z += r * 1.7
    head_z = z - 0.21 * 0.8
    for sx in (-0.07, 0.07):
        b.box(Vector((sx, 0.19, head_z + 0.05)), (0.035, 0.035, 0.035), coal)
    b.cone(Vector((0, 0.19, head_z)), Vector((0, 0.36, head_z - 0.01)), 0.03, 0.005, carrot, segs=6)
    for k in range(3):
        b.box(Vector((0, 0.29, 0.62 + k * 0.1)), (0.035, 0.035, 0.035), coal)
    for sx in (-1, 1):
        b.cone(Vector((sx * 0.24, 0, 0.95)), Vector((sx * 0.62, 0.05, 1.18)), 0.018, 0.008, stick, segs=4)
    b.ico(Vector((0, 0, head_z - 0.17)), 0.2, scarf, scale=(1.1, 1.1, 0.32), jitter=0.05, rng=rng)
    b.cone(Vector((0.1, 0.15, head_z - 0.2)), Vector((0.16, 0.2, head_z - 0.45)), 0.05, 0.04, scarf, segs=4)
    b.cone(Vector((0, 0, head_z + 0.14)), Vector((0.02, 0, head_z + 0.34)), 0.13, 0.1, bucket, segs=7)
    b.bm.normal_update()
    si = b.slot(shade)
    for f, t in b.tags.items():
        if t == "s" and f.normal.z < -0.2: f.material_index = si
    return b.finish()

# ---------------------------------------------------------------- imported models
def import_glb(fname):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, fname))
    new = [o for o in bpy.data.objects if o not in before]
    for o in list(new):  # stray unparented helper sphere shipped in some Quaternius files
        if o.type == "MESH" and o.name.startswith("Icosphere") and o.parent is None:
            new.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    return new

def static_prop(src, name, target, measure="height", snow_thresh=None, tex=None):
    """Join, scale to real-world meters, origin at bottom-center, optional snow caps and texture downsizing."""
    reset()
    objs = [o for o in import_glb(src) if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vs = [v.co for v in ob.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    size = hi - lo
    ref = size.z if measure == "height" else max(size)
    s = target / ref
    off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in ob.data.vertices: v.co = (v.co - off) * s
    ob.name = name
    if snow_thresh is not None:
        snow = bpy.data.materials.get("Snow") or mat("Snow", PAL["snow"], 0.8)
        ob.data.materials.append(snow); si = len(ob.data.materials) - 1
        me = ob.data
        for p in me.polygons:
            if p.normal.z > snow_thresh: p.material_index = si
    if tex:
        for img in bpy.data.images:
            if img.size[0] > tex:
                img.scale(tex, tex); img.pack()
    export([ob], name)

KEEP_CHAR = {"Death", "Gun_Shoot", "HitRecieve", "Idle", "Idle_Gun_Pointing", "Interact", "Punch_Left", "Punch_Right", "Run", "Sword_Slash", "Walk"}
KEEP_ANIMAL = {"Idle", "Idle_2", "Idle_2_HeadLow", "Walk", "Gallop", "Eating", "Attack", "Death"}

def bake_and_join(objs, name):
    """Bake every material's base color into a vertex color layer, use one shared material,
    and join all skinned meshes: one draw call per character instead of one per material."""
    meshes = [o for o in objs if o.type == "MESH"]
    if not meshes: return
    vc = bpy.data.materials.new(name + "_VC")
    try: vc.use_nodes = True
    except Exception: pass
    nt = vc.node_tree; bsdf = nt.nodes.get("Principled BSDF")
    node = nt.nodes.new("ShaderNodeVertexColor"); node.layer_name = "Col"
    nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    for ob in meshes:
        me = ob.data
        attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        for p in me.polygons:
            m = me.materials[p.material_index] if len(me.materials) else None
            col = (0.8, 0.8, 0.8, 1.0)
            if m is not None and m.node_tree:
                b = m.node_tree.nodes.get("Principled BSDF")
                if b: col = tuple(b.inputs["Base Color"].default_value)
            for li in p.loop_indices: attr.data[li].color = col
        me.materials.clear(); me.materials.append(vc)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in meshes: ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    print(f"@@ baked+joined {len(meshes)} meshes for {name}")

def prune_actions(keep):
    """Drop animations the game never plays (and duplicate unprefixed copies) to shrink downloads."""
    for a in list(bpy.data.actions):
        short = a.name.split("|")[-1]
        if "|" not in a.name or short not in keep:
            bpy.data.actions.remove(a)

def character(src, name, remove=(), recolor=None, per_mesh=None, sleeves=None):
    """Re-export a rigged character with material edits. recolor: {material: hex};
    per_mesh: {mesh_substring: {material: (new_name, hex)}}; sleeves: (mesh_substring, max_abs_x, new_mat)."""
    reset()
    objs = import_glb(src)
    for o in list(objs):
        if any(r in o.name for r in remove):
            objs.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if recolor and m.name in recolor:
            m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = lin(recolor[m.name])
    for o in objs:
        if o.type != "MESH": continue
        for sub, table in (per_mesh or {}).items():
            if sub in o.name:
                for i, slot in enumerate(o.material_slots):
                    if slot.material and slot.material.name in table:
                        nn, hx = table[slot.material.name]
                        o.material_slots[i].material = mat(nn, hx)
        if sleeves and sleeves[0] in o.name:
            skin_idx = [i for i, s in enumerate(o.material_slots) if s.material and s.material.name == "Skin"]
            o.data.materials.append(mat(sleeves[2], PAL["jacket"]))
            ji = len(o.data.materials) - 1
            n = 0
            for p in o.data.polygons:
                if p.material_index in skin_idx and abs((o.matrix_world @ p.center).x) < sleeves[1]:
                    p.material_index = ji; n += 1
            print(f"@@ sleeves: {n} faces recolored on {o.name}")
    prune_actions(KEEP_CHAR)
    bake_and_join(objs, name)
    objs = [o for o in bpy.context.scene.objects]
    roots = [o for o in objs if o.parent is None]
    export(roots, name, anim=True)

def passthrough_rig(src, name):
    reset()
    objs = import_glb(src)
    prune_actions(KEEP_ANIMAL)
    bake_and_join(objs, name)
    export([o for o in bpy.context.scene.objects if o.parent is None], name, anim=True)

# ---------------------------------------------------------------- build list
JOBS = []
def job(name):
    def deco(fn):
        JOBS.append((name, fn)); return fn
    return deco

def gen(name, fn):
    reset(); ob = fn(); ob.name = name; export([ob], name)

for i, H in enumerate((8.5, 10.5, 12.5)):
    JOBS.append((f"pine-{i+1}", (lambda i=i, H=H: gen(f"pine-{i+1}", lambda: build_pine(f"pine-{i+1}", 11 + i, H)))))
for i, H in enumerate((3.5, 5.0)):
    JOBS.append((f"fir-{i+1}", (lambda i=i, H=H: gen(f"fir-{i+1}", lambda: build_fir(f"fir-{i+1}", 21 + i, H)))))
for i, H in enumerate((5.5, 7.0, 8.5)):
    JOBS.append((f"palm-{i+1}", (lambda i=i, H=H: gen(f"palm-{i+1}", lambda: build_palm(f"palm-{i+1}", 31 + i, H)))))
for i, k in enumerate(("shrub", "shrub", "seagrape")):
    JOBS.append((f"shrub-{i+1}", (lambda i=i, k=k: gen(f"shrub-{i+1}", lambda: build_shrub(f"shrub-{i+1}", 41 + i, k)))))
for k in ("agave", "croton", "palmetto"):
    JOBS.append((k, (lambda k=k: gen(k, lambda: build_spiky(k, 51, k)))))
JOBS.append(("hedge", lambda: gen("hedge", lambda: build_hedge("hedge", 61, 2.0))))
for i, r in enumerate((0.5, 0.9, 1.6)):
    JOBS.append((f"rock-{i+1}", (lambda i=i, r=r: gen(f"rock-{i+1}", lambda: build_rock(f"rock-{i+1}", 71 + i, r)))))
for i, r in enumerate((0.8, 1.4)):
    JOBS.append((f"snow-mound-{i+1}", (lambda i=i, r=r: gen(f"snow-mound-{i+1}", lambda: build_snow_mound(f"snow-mound-{i+1}", 81 + i, r)))))
JOBS.append(("lantern", lambda: gen("lantern", lambda: build_lantern("lantern"))))
JOBS.append(("car-sedan", lambda: gen("car-sedan", lambda: build_car("car-sedan", 91, "sedan"))))
JOBS.append(("car-suv", lambda: gen("car-suv", lambda: build_car("car-suv", 92, "suv"))))
JOBS.append(("snag", lambda: gen("snag", lambda: build_snag("snag", 111, 6.0))))
JOBS.append(("iguana", lambda: gen("iguana", lambda: build_iguana("iguana", 101))))
JOBS.append(("flamingo", lambda: gen("flamingo", lambda: build_flamingo("flamingo", 102))))
JOBS.append(("snowman", lambda: gen("snowman", lambda: build_snowman("snowman", 103))))

# downloaded props: (source, name, target meters, measure, snow threshold, texture size)
PROPS = [
    ("stump.glb", "stump", 0.55, "height", 0.6, None),
    ("fallen-log.glb", "fallen-log", 2.4, "max", 0.82, None),
    ("logs.glb", "wood-bundle", 0.8, "max", None, None),
    ("bonfire.glb", "campfire", 1.3, "max", None, None),
    ("axe.glb", "axe", 0.75, "max", None, None),
    ("pistol.glb", "pistol", 0.24, "max", None, None),
    ("medkit.glb", "medkit", 0.42, "max", None, None),
    ("food-can.glb", "food-can", 0.2, "height", None, None),
    ("matchbox.glb", "matchbox", 0.16, "max", None, None),
    ("water-bottle.glb", "water-bottle", 0.32, "height", None, None),
    ("backpack.glb", "backpack", 0.55, "height", None, None),
    ("radio.glb", "radio", 0.32, "max", None, None),
    ("rabbit.glb", "rabbit", 0.32, "height", None, 256),
    ("duck.glb", "duck", 0.38, "height", None, 256),
    ("owl.glb", "owl", 0.75, "height", None, 256),
]
for p in PROPS:
    JOBS.append((p[1], (lambda p=p: static_prop(p[0], p[1], p[2], p[3], p[4], p[5]))))

JOBS.append(("player", lambda: character(
    "adventurer.glb", "player",
    recolor={"Green": PAL["jacket"], "LightGreen": PAL["jacket_dark"], "Gold": PAL["pack"], "Grey": PAL["boot"]},
    per_mesh={"Legs": {"Brown": ("Denim", PAL["denim"]), "Brown2": ("Belt", "#3a2a1e")}},
    sleeves=("Body", 0.60, "Sleeve"))))
JOBS.append(("zombie-a", lambda: character(
    "adventurer.glb", "zombie-a", remove=("Backpack",),
    recolor={"Skin": PAL["zskin"], "Green": PAL["zcloth"], "LightGreen": PAL["zcloth2"], "Hair": PAL["zhair"],
             "Brown": PAL["zpants"], "Brown2": "#2e2b28", "Grey": "#2e2a26", "Eye": "#d9d2a6", "Eyebrows": "#3a3a36"})))
JOBS.append(("zombie-b", lambda: character(
    "hooded-adventurer.glb", "zombie-b", remove=("Sword",),
    recolor={"Skin": PAL["zskin"], "White": "#6b6660", "DarkBrown": "#3d3530", "LightBrown": "#5a4a3e",
             "Metal": "#4a4a48", "Metal_Dark": "#333331", "Gold": "#4d4538", "Brown": "#2e2824", "Black": "#1f1f22"})))
# (a brown-hooded "survivor" recolor lived here; unused for now — see assets/source/survivor-built.glb)
for a in ("deer", "fox", "wolf", "dog"):
    JOBS.append((a, (lambda a=a: passthrough_rig(a + ".glb", a))))

for name, fn in JOBS:
    if want(name):
        try:
            fn()
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f"@@ FAILED {name}: {e}")
with open(os.path.join(ROOT, "assets", "build-log.json"), "w") as f:
    json.dump(LOG, f, indent=1)
print("@@ done", len(LOG))
