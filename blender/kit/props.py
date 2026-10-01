# Props for the opening: playground, seawall dock, the cooler, the bunny, a snapped branch; Poly Haven
# props passed through (their own CC0 textures, decimated where heavy); Poly Pizza vehicles and the
# rowboat retextured (dusty desaturated paint, grime toward the ground, wood grain on the boat).
import bpy, bmesh, math, os, random, colorsys
from mathutils import Vector, Matrix
from . import common as C

PH = os.path.join(C.ROOT, 'assets', 'source', 'polyhaven')
PP = os.path.join(C.ROOT, 'assets', 'source')

def _root(name):
    r = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(r); return r

def _smooth(o, angle=40):
    for p in o.data.polygons: p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        o.select_set(False)
    except Exception: pass

# ------------------------------------------------------------------ playground
def swingset(name, L=3.4, H=2.35):
    root = _root(name); bm = bmesh.new()
    for x in (-L / 2, L / 2):
        for s in (-1, 1):
            C.cylinder(bm, (x, s * 0.85, 0), (x, 0, H), 0.045, segs=8)
    C.cylinder(bm, (-L / 2 - 0.1, 0, H), (L / 2 + 0.1, 0, H), 0.05, segs=8)
    for x in (-L / 2, L / 2): C.cylinder(bm, (x, -0.45, H * 0.45), (x, 0.45, H * 0.45), 0.03, segs=6)
    C.box_uv(bm, 0.8); C.paint(bm, (0.8, 0.85, 0.9), ground_dark=0.35, dark_h=0.5)
    C.new_obj(name + '_frame', bm, ['MetalGreen'], root)
    return root

def swing_seat(name, drop=1.85, broken=False):
    """Hangs from its origin (the top bar), so the game can swing it."""
    root = _root(name); bm = bmesh.new()
    if broken:
        C.cylinder(bm, (-0.2, 0, 0), (-0.05, 0.12, -drop + 0.1), 0.008, segs=4)
        sc = C.cube(bm, (0.08, 0.2, -drop + 0.05), (0.45, 0.16, 0.03))
        bmesh.ops.rotate(bm, cent=(0.08, 0.2, -drop + 0.05), matrix=Matrix.Rotation(-1.1, 3, 'Y'), verts=list({v for f in sc for v in f.verts}))
    else:
        for x in (-0.22, 0.22): C.cylinder(bm, (x, 0, 0), (x, 0, -drop), 0.008, segs=4)
        C.cube(bm, (0, 0, -drop - 0.01), (0.48, 0.17, 0.03))
    C.box_uv(bm, 0.5); C.paint(bm, (0.3, 0.3, 0.3)); C.new_obj(name + '_w', bm, ['Rubber'], root)
    return root

def slide(name):
    root = _root(name); bm = bmesh.new()
    top = 1.35
    for s in (-1, 1):
        C.cylinder(bm, (-0.9, s * 0.3, 0), (-0.75, s * 0.3, top + 0.8), 0.035, segs=6)   # ladder rails up to the handrail
    for i in range(5): C.cylinder(bm, (-0.88 + 0.03 * i, -0.3, 0.3 + 0.25 * i), (-0.88 + 0.03 * i, 0.3, 0.3 + 0.25 * i), 0.02, segs=5)
    for (x, y) in ((-0.25, -0.35), (-0.25, 0.35)): C.cylinder(bm, (x, y, 0), (x, y, top), 0.035, segs=6)
    C.box_uv(bm, 0.8); C.paint(bm, (0.85, 0.85, 0.85), ground_dark=0.3, dark_h=0.4); C.new_obj(name + '_frame', bm, ['MetalGreen'], root)
    bm = bmesh.new()
    C.cube(bm, (-0.55, 0, top), (0.7, 0.8, 0.06))                         # platform
    # chute: a strip descending from the platform with low side walls
    n = 10; pts = []
    for i in range(n + 1):
        t = i / n; x = -0.2 + t * 2.6; z = top - (top - 0.25) * (math.sin(t * math.pi / 2) ** 1.2) - 0.0
        if t > 0.85: z = 0.25 + (1 - t) * 0.4
        pts.append((x, z))
    rows = []
    for (x, z) in pts:
        rows.append([bm.verts.new((x, y, z + (0.12 if abs(y) > 0.3 else 0))) for y in (-0.34, -0.28, 0.28, 0.34)])
    for i in range(n):
        for k in range(3): bm.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]))
    C.box_uv(bm, 0.8); C.paint(bm, (0.66, 0.33, 0.22)); C.new_obj(name + '_chute', bm, ['Plastic'], root)
    return root

def tire_tunnel(name, R=0.48, L=1.5, ribs=9):
    root = _root(name); bm = bmesh.new()
    segs = 14; rings = []
    for i in range(ribs * 2 + 1):
        y = -L / 2 + L * i / (ribs * 2); r = R * (1.05 if i % 2 else 1.0)
        rings.append([bm.verts.new((math.cos(2 * math.pi * k / segs) * r, y, R + math.sin(2 * math.pi * k / segs) * r)) for k in range(segs)])
    for i in range(len(rings) - 1):
        for k in range(segs): bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    C.box_uv(bm, 0.6)
    col = C.ensure_col(bm)
    for f in bm.faces:
        for l in f.loops:
            k = 0.6 + 0.4 * min(1, l.vert.co.z / (R * 1.5)); l[col] = (0.16 * k, 0.28 * k, 0.21 * k, 1)
    o = C.new_obj(name + '_w', bm, ['Plastic'], root); _smooth(o, 60)
    return root

def bucket(name):
    root = _root(name); bm = bmesh.new()
    C.cylinder(bm, (0, 0, 0), (0, 0, 0.2), 0.09, 0.12, segs=12, cap=False)
    C.cylinder(bm, (0, 0, 0.19), (0, 0, 0.21), 0.125, segs=12, cap=False)
    C.box_uv(bm, 0.3); C.paint(bm, (0.62, 0.17, 0.1)); o = C.new_obj(name + '_w', bm, ['Plastic'], root); _smooth(o, 60)
    return root

def bench(name, L=1.7):
    root = _root(name); bm = bmesh.new()
    for i in range(4): C.cube(bm, (0, -0.2 + i * 0.13, 0.45), (L, 0.11, 0.035))
    for i in range(2):
        f = C.cube(bm, (0, 0.33, 0.62 + i * 0.16), (L, 0.11, 0.035))
    C.box_uv(bm, 1.0); C.paint(bm, (0.92, 0.9, 0.85)); C.new_obj(name + '_wood', bm, ['Wood'], root)
    bm = bmesh.new()
    for x in (-L / 2 + 0.15, L / 2 - 0.15):
        C.cube(bm, (x, -0.2, 0.22), (0.05, 0.05, 0.45)); C.cube(bm, (x, 0.3, 0.4), (0.05, 0.05, 0.8)); C.cube(bm, (x, 0.05, 0.43), (0.05, 0.55, 0.05))
    C.box_uv(bm, 0.6); C.paint(bm, (0.5, 0.55, 0.5)); C.new_obj(name + '_metal', bm, ['MetalGreen'], root)
    return root

# ------------------------------------------------------------------ seawall props
def cooler(name):
    root = _root(name); bm = bmesh.new()
    C.cube(bm, (0, 0, 0.19), (0.64, 0.4, 0.38)); C.box_uv(bm, 0.5); C.paint(bm, (0.15, 0.33, 0.56), ground_dark=0.35, dark_h=0.3)
    o = C.new_obj(name + '_body', bm, ['Plastic'], root)
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('bev', 'BEVEL'); m.width = 0.03; m.segments = 2
    bm = bmesh.new(); C.cube(bm, (0, 0, 0.405), (0.66, 0.42, 0.07)); C.box_uv(bm, 0.5); C.paint(bm, (0.86, 0.86, 0.84))
    o = C.new_obj(name + '_lid', bm, ['Plastic'], root); m = o.modifiers.new('bev', 'BEVEL'); m.width = 0.025; m.segments = 2
    bm = bmesh.new()
    for s in (-1, 1): C.cube(bm, (s * 0.34, 0, 0.3), (0.04, 0.16, 0.05))
    C.box_uv(bm, 0.5); C.paint(bm, (0.6, 0.6, 0.6)); C.new_obj(name + '_handles', bm, ['Plastic'], root)
    return root

def dock(name, W=2.4, L=7.0, deck=-0.2):
    """Wooden pier: the deck runs along -Y from the seawall (origin) out over the water."""
    rng = random.Random(4)
    root = _root(name); bm = bmesh.new()
    n = int(L / 0.17)
    for i in range(n):
        y = -0.1 - i * L / n
        if rng.random() < 0.04: continue                       # a missing plank
        C.cube(bm, (rng.uniform(-0.03, 0.03), y, deck + rng.uniform(-0.01, 0.01)), (W + rng.uniform(-0.1, 0.1), L / n - 0.025, 0.05))
    C.box_uv(bm, 1.5)
    col = C.ensure_col(bm)
    for f in bm.faces:
        k = rng.uniform(0.8, 1.0)
        for l in f.loops: l[col] = (k, k, k * 0.97, 1)
    C.new_obj(name + '_deck', bm, ['WoodGrey'], root)
    bm = bmesh.new()
    for s in (-1, 1): C.cube(bm, (s * (W / 2 - 0.2), -L / 2, deck - 0.12), (0.12, L, 0.18))
    for y in (-0.6, -L / 2, -L + 0.3):
        for s in (-1, 1): C.cylinder(bm, (s * (W / 2 + 0.05), y, -2.2), (s * (W / 2 + 0.05), y, deck + 0.75), 0.13, segs=8)
    C.box_uv(bm, 1.0); C.paint(bm, (0.7, 0.68, 0.64)); C.new_obj(name + '_frame', bm, ['WoodOld'], root)
    return root

# ------------------------------------------------------------------ the clue
def bunny(name):
    """Arianna's worn stuffed bunny, sitting (about 0.36 m), soft shapes, terry-cloth fabric."""
    root = _root(name)
    parts = [  # (center, scale, rotation-euler, tint)
        ((0, 0, 0.12), (0.115, 0.1, 0.13), (0.15, 0, 0), (0.86, 0.83, 0.78)),        # body
        ((0, -0.02, 0.29), (0.095, 0.09, 0.085), (0, 0, 0), (0.88, 0.85, 0.8)),       # head
        ((0, -0.085, 0.27), (0.045, 0.035, 0.035), (0, 0, 0), (0.92, 0.89, 0.84)),    # muzzle
        ((-0.045, 0.0, 0.43), (0.032, 0.016, 0.12), (0.1, -0.25, 0), (0.86, 0.83, 0.78)),   # ear up
        ((0.08, 0.02, 0.33), (0.03, 0.015, 0.11), (0.3, 1.9, 0), (0.84, 0.8, 0.76)),        # ear flopped
        ((-0.12, -0.03, 0.15), (0.03, 0.03, 0.075), (0.3, 0.5, 0), (0.84, 0.81, 0.76)),     # arms
        ((0.12, -0.03, 0.15), (0.03, 0.03, 0.075), (0.3, -0.5, 0), (0.84, 0.81, 0.76)),
        ((-0.06, -0.1, 0.035), (0.042, 0.075, 0.035), (0, 0, 0.2), (0.8, 0.77, 0.72)),     # legs forward
        ((0.065, -0.1, 0.035), (0.042, 0.075, 0.035), (0, 0, -0.2), (0.8, 0.77, 0.72)),
    ]
    bm = bmesh.new()
    for (c, s, r, t) in parts:
        res = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=9, radius=1.0)
        vs = res['verts']
        bmesh.ops.scale(bm, vec=Vector(s), verts=vs)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=(Matrix.Rotation(r[1], 3, 'Z') @ Matrix.Rotation(r[0], 3, 'X')), verts=vs)
        bmesh.ops.translate(bm, vec=Vector(c), verts=vs)
        col = C.ensure_col(bm)
        for v in vs:
            for l in v.link_loops:
                k = 0.78 + 0.22 * min(1, v.co.z / 0.25)                # dirtier low down
                l[col] = (t[0] * k, t[1] * k * 0.98, t[2] * k * 0.95, 1)
    C.box_uv(bm, 0.12)
    o = C.new_obj(name + '_body', bm, ['Fabric'], root)
    for p in o.data.polygons: p.use_smooth = True
    bm = bmesh.new()
    for x in (-0.035, 0.035):
        res = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.011); bmesh.ops.translate(bm, vec=Vector((x, -0.088, 0.31)), verts=res['verts'])
    res = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.012); bmesh.ops.translate(bm, vec=Vector((0, -0.12, 0.28)), verts=res['verts'])
    C.box_uv(bm, 0.1); C.paint(bm, (0.12, 0.1, 0.1)); o = C.new_obj(name + '_eyes', bm, ['Rubber'], root)
    for p in o.data.polygons: p.use_smooth = True
    return root

def branch(name):
    from .foliage import _tube
    rng = random.Random(3)
    root = _root(name); bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
    pts = [Vector((0, 0, 0.04)), Vector((0.45, 0.05, 0.05)), Vector((0.9, -0.02, 0.06)), Vector((1.35, 0.06, 0.05))]
    _tube(bm, pts, [0.045, 0.04, 0.032, 0.03], 6, uv, (0.85, 0.8, 0.75), v_scale=0.8, circ_scale=0.8)
    _tube(bm, [Vector((0.55, 0.04, 0.05)), Vector((0.8, 0.28, 0.08)), Vector((0.95, 0.4, 0.07))], [0.02, 0.014, 0.008], 5, uv, (0.85, 0.8, 0.75))
    _tube(bm, [Vector((1.0, 0.0, 0.06)), Vector((1.2, -0.22, 0.12))], [0.015, 0.006], 5, uv, (0.85, 0.8, 0.75))
    C.new_obj(name + '_w', bm, ['Bark'], root)
    bm = bmesh.new()                                    # the pale splintered end
    for i in range(5):
        a = i * 1.25
        C.cylinder(bm, (0, 0, 0.04), (-0.12 - rng.uniform(0, 0.06), math.cos(a) * 0.025, 0.04 + math.sin(a) * 0.025), 0.012, 0.002, segs=4)
    C.box_uv(bm, 0.2); C.paint(bm, (0.75, 0.66, 0.5)); C.new_obj(name + '_end', bm, ['Paint'], root)
    return root

# ------------------------------------------------------------------ imported
def _import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def polyhaven(name, pid, ratio=None, rot=(0, 0, 0), loc=(0, 0, 0)):
    objs = _import_gltf(os.path.join(PH, pid, pid + '.gltf'))
    root = _root(name)
    for o in objs:
        if o.parent is None: o.parent = root
        if o.type == 'MESH' and ratio:
            m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio
    root.rotation_euler = rot; root.location = loc
    root['keep_images'] = True
    return root

def _face_color(o, poly):
    m = o.material_slots[poly.material_index].material if o.material_slots else None
    if not m or not m.node_tree: return (0.6, 0.6, 0.6), ''
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None: return (0.6, 0.6, 0.6), m.name
    inp = b.inputs['Base Color']
    if inp.is_linked and inp.links[0].from_node.type == 'TEX_IMAGE':
        im = inp.links[0].from_node.image; uvl = o.data.uv_layers.active
        if im and uvl:
            u, v = uvl.data[poly.loop_indices[0]].uv
            w, h = im.size; x, y = int((u % 1) * (w - 1)), int((v % 1) * (h - 1)); i = (y * w + x) * 4
            px = im.pixels[i:i + 3]
            return tuple(px), m.name
    c = inp.default_value
    return (c[0], c[1], c[2]), m.name

def vehicle(name, src, **_):
    """A low-poly vehicle kept with its own materials and textures (the game ages them: dust, matte paint)."""
    objs = _import_gltf(os.path.join(PP, src + '.glb'))
    root = _root(name)
    for o in objs:
        if o.parent is None: o.parent = root
        if o.type == 'MESH': _smooth(o, 35)
    root['keep_images'] = True
    root['aged'] = True
    return root

def build_all():
    out = {}
    out['swingset'] = swingset('swingset')
    out['swing_seat'] = swing_seat('swing_seat')
    out['swing_seat_broken'] = swing_seat('swing_seat_broken', broken=True)
    out['slide'] = slide('slide')
    out['tire_tunnel'] = tire_tunnel('tire_tunnel')
    out['bucket'] = bucket('bucket')
    out['bench'] = bench('bench')
    out['cooler'] = cooler('cooler')
    out['dock'] = dock('dock')
    out['bunny'] = bunny('bunny')
    out['branch'] = branch('branch')
    out['chair'] = polyhaven('chair', 'plastic_monobloc_chair_01')
    out['trash_can'] = polyhaven('trash_can', 'metal_trash_can', ratio=0.3)
    out['utility_box'] = polyhaven('utility_box', 'utility_box_01')
    out['picnic_table'] = polyhaven('picnic_table', 'wooden_picnic_table', ratio=0.5)
    out['fern'] = polyhaven('fern', 'fern_02')
    out['crate'] = polyhaven('crate', 'wooden_crate_02')
    out['duck'] = polyhaven('duck', 'rubber_duck_toy')
    out['trashbag'] = polyhaven('trashbag', 'trashbag')
    out['stump'] = polyhaven('stump', 'tree_stump_01', ratio=0.15)
    out['street_lamp_fallen'] = polyhaven('street_lamp_fallen', 'street_lamp_02', ratio=0.25, rot=(math.radians(-88), 0, math.radians(8)), loc=(0, 0, 0.12))
    out['car_white'] = vehicle('car_white', 'car-white', seed=1)
    out['stationwagon'] = vehicle('stationwagon', 'stationwagon', seed=2, rust=0.06)
    out['broken_car'] = vehicle('broken_car', 'broken-car', seed=3)
    out['van'] = vehicle('van', 'van', seed=4)
    out['rowboat'] = vehicle('rowboat', 'rowboat', wood=True, dust=0.9, seed=5)
    return out
