# Buildings, walls, fences and the gate for the opening. Florida block-and-stucco: low hip roofs in clay
# tile or flat roofs behind a parapet, framed windows (some boarded), a front door, grime toward the
# ground. Local frame: center at the origin, front facing -Y (south in the game).
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
from . import common as C

C.LIB['WindowGlow'] = (None, (1.0, 0.72, 0.38, 1), 1.0, {})
C.LIB['LampGlow'] = (None, (1.0, 0.8, 0.5, 1), 1.0, {})

def _split_h(bm, zs):
    for z in zs:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))

def _roof_uv(bm, faces, size=2.0):
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    for f in faces:
        n = f.normal
        e = Vector((-n.y, n.x, 0))
        if e.length < 1e-4: e = Vector((1, 0, 0))
        e.normalize(); s = n.cross(e)
        for l in f.loops:
            p = l.vert.co
            l[uv].uv = (p.dot(e) / size, p.dot(s) / size)

def hip_roof(bm, w, d, z, rise, over=0.55):
    """Hip roof over a w x d footprint, eaves at height z. Returns roof faces and the eave ring."""
    W, D = w / 2 + over, d / 2 + over
    swap = D > W
    if swap: W, D = D, W
    rl = max(0.0, W - D)
    E = [Vector((-W, -D, z)), Vector((W, -D, z)), Vector((W, D, z)), Vector((-W, D, z))]
    R = [Vector((-rl, 0, z + rise)), Vector((rl, 0, z + rise))]
    if swap:
        rot = Matrix.Rotation(math.pi / 2, 3, 'Z'); E = [rot @ v for v in E]; R = [rot @ v for v in R]
    ev = [bm.verts.new(v) for v in E]; rv = [bm.verts.new(v) for v in R]
    if not swap:
        faces = [bm.faces.new((ev[0], ev[1], rv[1], rv[0])), bm.faces.new((ev[2], ev[3], rv[0], rv[1])),
                 bm.faces.new((ev[1], ev[2], rv[1])), bm.faces.new((ev[3], ev[0], rv[0]))]
    else:
        faces = [bm.faces.new((ev[1], ev[2], rv[1], rv[0])), bm.faces.new((ev[3], ev[0], rv[0], rv[1])),
                 bm.faces.new((ev[2], ev[3], rv[1])), bm.faces.new((ev[0], ev[1], rv[0]))]
    for f in faces: f.normal_update()
    for f in faces:
        if f.normal.z < 0: f.normal_flip()
    # roof tiles are thick: an underside (soffit) slightly below
    under = [bm.faces.new([bm.verts.new(v.co - Vector((0, 0, 0.12))) for v in reversed(f.verts)]) for f in faces]
    return faces, under, E

def window(bm_frame, bm_glass, bm_boards, side, at, width, height, sill, wall, kind='glass'):
    """A framed window on wall `side` ('front','back','left','right') of a w x d box."""
    w, d = wall
    if side == 'front': o, t, nrm = Vector((at, -d / 2, 0)), Vector((1, 0, 0)), Vector((0, -1, 0))
    elif side == 'back': o, t, nrm = Vector((-at, d / 2, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0))
    elif side == 'left': o, t, nrm = Vector((-w / 2, -at, 0)), Vector((0, -1, 0)), Vector((-1, 0, 0))
    else: o, t, nrm = Vector((w / 2, at, 0)), Vector((0, 1, 0)), Vector((1, 0, 0))
    rot = math.atan2(t.y, t.x)
    def at3(u, z, out): return o + t * u + nrm * out + Vector((0, 0, z))
    fr = 0.09
    zc = sill + height / 2
    C.cube(bm_frame, at3(0, sill + height + fr / 2, 0.04), (width + 2 * fr, 0.1, fr), rot)          # head
    C.cube(bm_frame, at3(0, sill - 0.05, 0.07), (width + 2 * fr + 0.12, 0.18, 0.08), rot)          # sill
    for s in (-1, 1): C.cube(bm_frame, at3(s * (width / 2 + fr / 2), zc, 0.04), (fr, 0.1, height), rot)
    if kind in ('glass', 'lit'):
        C.cube(bm_frame, at3(0, zc, 0.05), (0.05, 0.06, height), rot)                                 # mullion
        C.cube(bm_frame, at3(0, zc + height * 0.08, 0.05), (width, 0.06, 0.05), rot)
    gl = C.cube(bm_glass, at3(0, zc, 0.012), (width, 0.02, height), rot)
    if kind == 'boarded':
        rng = random.Random(int(at * 100 + sill * 10))
        for i in range(3):
            fs = C.cube(bm_boards, at3(rng.uniform(-0.05, 0.05), sill + height * (0.2 + 0.3 * i), 0.1), (width + 0.3, 0.04, 0.2), rot)
            vs = list({v for f in fs for v in f.verts})
            bmesh.ops.rotate(bm_boards, cent=at3(0, sill + height * (0.2 + 0.3 * i), 0.1), matrix=Matrix.Rotation(rng.uniform(-0.25, 0.25), 3, nrm), verts=vs)
    return at3(0, zc, 0.1), nrm

def house(name, w, d, h=3.0, roof='hip', wall='Stucco', tint=(1, 1, 1), rise=2.0, windows=(), door=None, portico=False,
          carport=None, ac=True, lamp=False, seed=1, lit_windows=()):
    rng = random.Random(seed)
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    # walls
    bm = bmesh.new()
    C.cube(bm, (0, 0, h / 2), (w, d, h))
    _split_h(bm, [0.32, 0.9, h - 0.4])
    C.box_uv(bm, 1.0)
    col = C.ensure_col(bm)
    for f in bm.faces:
        for l in f.loops:
            z = l.vert.co.z
            k = 0.72 + 0.28 * min(1, z / 0.9)                        # grime toward the ground
            if z > h - 0.41: k *= 0.9                                 # under the eaves
            l[col] = (tint[0] * k, tint[1] * k, tint[2] * k, 1)
    C.new_obj(name + '_walls', bm, [wall], root)
    # base band (slab edge)
    bm = bmesh.new(); C.cube(bm, (0, 0, 0.12), (w + 0.08, d + 0.08, 0.26)); C.box_uv(bm, 1.0); C.paint(bm, (0.7, 0.68, 0.64))
    C.new_obj(name + '_base', bm, ['ConcreteWorn'], root)
    # roof
    bm = bmesh.new()
    if roof == 'hip':
        faces, under, E = hip_roof(bm, w, d, h, rise)
        _roof_uv(bm, faces + under, 2.0)
        col = C.ensure_col(bm)
        for f in faces:
            for l in f.loops:
                k = rng.uniform(0.88, 1.0) * (0.9 if l.vert.co.z < h + 0.1 else 1)
                l[col] = (k, k * 0.97, k * 0.95, 1)
        for f in under:
            for l in f.loops: l[col] = (0.55, 0.52, 0.5, 1)
        C.new_obj(name + '_roof', bm, ['RoofTile'], root)
        # fascia board along the eaves
        bm = bmesh.new()
        for i in range(4):
            a, b = Vector(E[i]), Vector(E[(i + 1) % 4]); mid = (a + b) / 2; L = (b - a).length
            rot = math.atan2((b - a).y, (b - a).x)
            C.cube(bm, (mid.x, mid.y, h - 0.06), (L + 0.05, 0.05, 0.2), rot)
        C.box_uv(bm, 1.0); C.paint(bm, (0.82, 0.8, 0.75))
        C.new_obj(name + '_fascia', bm, ['Trim'], root)
    else:  # flat roof behind a parapet
        ph = 0.6
        C.cube(bm, (0, 0, h + 0.02), (w - 0.1, d - 0.1, 0.06))
        C.box_uv(bm, 2.0); C.paint(bm, (0.8, 0.8, 0.78))
        C.new_obj(name + '_roof', bm, ['RoofFlat'], root)
        bm = bmesh.new()
        for (cx, cy, sx, sy) in ((0, -d / 2 + 0.1, w, 0.2), (0, d / 2 - 0.1, w, 0.2), (-w / 2 + 0.1, 0, 0.2, d), (w / 2 - 0.1, 0, 0.2, d)):
            C.cube(bm, (cx, cy, h + ph / 2), (sx, sy, ph))
        C.box_uv(bm, 1.0); C.paint(bm, tint)
        C.new_obj(name + '_parapet', bm, [wall], root)
        bm = bmesh.new()
        for (cx, cy, sx, sy) in ((0, -d / 2 + 0.1, w + 0.12, 0.34), (0, d / 2 - 0.1, w + 0.12, 0.34), (-w / 2 + 0.1, 0, 0.34, d + 0.12), (w / 2 - 0.1, 0, 0.34, d + 0.12)):
            C.cube(bm, (cx, cy, h + ph + 0.04), (sx, sy, 0.08))
        C.box_uv(bm, 1.0); C.paint(bm, (0.78, 0.76, 0.72))
        C.new_obj(name + '_coping', bm, ['Trim'], root)
    # windows
    bf, bg, bb = bmesh.new(), bmesh.new(), bmesh.new()
    glow_specs = []
    for i, (side, at, ww, wh, sill, kind) in enumerate(windows):
        c, n = window(bf, bg, bb, side, at, ww, wh, sill, (w, d), kind)
        if kind == 'lit': glow_specs.append((side, at, ww, wh, sill, i))
    for b_, m_, col_ in ((bf, 'Trim', (0.85, 0.83, 0.78)), (bg, 'Glass', (1, 1, 1)), (bb, 'WoodOld', (0.9, 0.85, 0.8))):
        if len(b_.verts):
            C.box_uv(b_, 1.0); C.paint(b_, col_); C.new_obj(name + '_' + m_.lower(), b_, [m_], root)
        else: b_.free()
    # lit windows: a glow plane just in front of the glass (the game lights these), one object each
    for (side, at, ww, wh, sill, i) in glow_specs:
        bm = bmesh.new()
        sign = -1 if side == 'front' else 1
        y = sign * (d / 2 + 0.026) if side in ('front', 'back') else 0
        x = at if side == 'front' else -at
        vs = [bm.verts.new((x - ww / 2 + 0.02, y, sill + 0.02)), bm.verts.new((x + ww / 2 - 0.02, y, sill + 0.02)),
              bm.verts.new((x + ww / 2 - 0.02, y, sill + wh - 0.02)), bm.verts.new((x - ww / 2 + 0.02, y, sill + wh - 0.02))]
        f = bm.faces.new(vs if sign < 0 else list(reversed(vs)))
        uv = bm.loops.layers.uv.new('UVMap')
        for l, u in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1)) if sign < 0 else ((1, 0), (0, 0), (0, 1), (1, 1))): l[uv].uv = u
        C.paint(bm, (1, 1, 1))
        C.new_obj('%s_glow%d' % (name, i), bm, ['WindowGlow'], root)
    # door
    if door is not None:
        at, dw, dcol = door
        bm = bmesh.new()
        C.cube(bm, (at, -d / 2 - 0.02, 1.08), (dw, 0.06, 2.16)); C.box_uv(bm, 1.0); C.paint(bm, dcol)
        C.new_obj(name + '_door', bm, ['Paint'], root)
        bm = bmesh.new()
        for s in (-1, 1): C.cube(bm, (at + s * (dw / 2 + 0.05), -d / 2 - 0.04, 1.12), (0.1, 0.08, 2.24))
        C.cube(bm, (at, -d / 2 - 0.04, 2.27), (dw + 0.2, 0.08, 0.1))
        C.box_uv(bm, 1.0); C.paint(bm, (0.85, 0.83, 0.78)); C.new_obj(name + '_doorframe', bm, ['Trim'], root)
        bm = bmesh.new(); C.cube(bm, (at, -d / 2 - 0.55, 0.08), (dw + 0.9, 1.0, 0.16)); C.box_uv(bm, 1.0); C.paint(bm, (0.85, 0.83, 0.8), ground_dark=0.2, dark_h=0.2)
        C.new_obj(name + '_step', bm, ['ConcreteWorn'], root)
        if lamp:
            bm = bmesh.new(); C.cube(bm, (at + dw / 2 + 0.35, -d / 2 - 0.08, 1.95), (0.18, 0.14, 0.3)); C.box_uv(bm, 1.0); C.paint(bm, (0.2, 0.2, 0.2))
            C.new_obj(name + '_lamp', bm, ['Metal'], root)
            bm = bmesh.new(); C.cube(bm, (at + dw / 2 + 0.35, -d / 2 - 0.16, 1.93), (0.12, 0.02, 0.2)); C.paint(bm, (1, 1, 1)); bm.loops.layers.uv.new('UVMap')
            C.new_obj(name + '_lampglow', bm, ['LampGlow'], root)
    if portico and door is not None:
        at = door[0]
        bm = bmesh.new()
        for s in (-1, 1): C.cube(bm, (at + s * 1.35, -d / 2 - 1.5, 1.35), (0.24, 0.24, 2.7))
        C.cube(bm, (at, -d / 2 - 0.8, 2.78), (3.2, 1.8, 0.18))
        C.box_uv(bm, 1.0); C.paint(bm, (0.84, 0.82, 0.77), ground_dark=0.35, dark_h=0.8); C.new_obj(name + '_portico', bm, ['Trim'], root)
        bm = bmesh.new(); C.cube(bm, (at, -d / 2 - 0.9, 0.06), (3.4, 1.9, 0.12)); C.box_uv(bm, 1.0); C.paint(bm, (0.8, 0.78, 0.74))
        C.new_obj(name + '_porch', bm, ['ConcreteWorn'], root)
    if carport:
        side, length = carport
        x0 = w / 2 if side > 0 else -w / 2
        bm = bmesh.new()
        for y in (-d / 2 - 0.4, 0, d / 2 - 0.4):
            C.cube(bm, (x0 + side * 3.3, y, 1.25), (0.16, 0.16, 2.5))
        C.cube(bm, (x0 + side * 1.75, -0.2, 2.56), (3.6, d + 0.4, 0.14))
        C.box_uv(bm, 1.0); C.paint(bm, (0.82, 0.8, 0.75)); C.new_obj(name + '_carport', bm, ['Trim'], root)
        bm = bmesh.new(); C.cube(bm, (x0 + side * 1.75, -0.6, 0.03), (3.5, d + 2.5, 0.06)); C.box_uv(bm, 2.0); C.paint(bm, (0.85, 0.85, 0.82))
        C.new_obj(name + '_slab', bm, ['ConcreteWorn'], root)
    if ac:
        bm = bmesh.new(); side = rng.choice((-1, 1))
        C.cube(bm, (side * (w / 2 + 0.45), d * 0.15, 0.42), (0.75, 0.75, 0.8))
        for i in range(5): C.cube(bm, (side * (w / 2 + 0.83), d * 0.15 - 0.3 + 0.15 * i, 0.45), (0.02, 0.05, 0.6))
        C.box_uv(bm, 1.0); C.paint(bm, (0.72, 0.71, 0.68), ground_dark=0.4, dark_h=0.5); C.new_obj(name + '_ac', bm, ['Metal'], root)
    # downspout at a front corner
    bm = bmesh.new(); C.cube(bm, (w / 2 - 0.12, -d / 2 - 0.08, h / 2), (0.09, 0.07, h)); C.box_uv(bm, 1.0); C.paint(bm, (0.8, 0.78, 0.74))
    C.new_obj(name + '_spout', bm, ['Trim'], root)
    return root

def stucco_wall(name, L=3.0, h=1.0, tint=(0.92, 0.88, 0.8), pillar=True):
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    bm = bmesh.new(); C.cube(bm, (0, 0, h / 2), (L, 0.24, h)); _split_h(bm, [0.3])
    if pillar: C.cube(bm, (L / 2, 0, (h + 0.3) / 2), (0.42, 0.42, h + 0.3))
    C.box_uv(bm, 1.0)
    col = C.ensure_col(bm)
    for f in bm.faces:
        for l in f.loops:
            k = 0.65 + 0.35 * min(1, l.vert.co.z / 0.7); l[col] = (tint[0] * k, tint[1] * k, tint[2] * k, 1)
    C.new_obj(name + '_w', bm, ['Stucco'], root)
    bm = bmesh.new(); C.cube(bm, (0, 0, h + 0.04), (L + 0.02, 0.32, 0.08))
    if pillar: C.cube(bm, (L / 2, 0, h + 0.36), (0.52, 0.52, 0.1))
    C.box_uv(bm, 1.0); C.paint(bm, (0.8, 0.78, 0.74)); C.new_obj(name + '_cap', bm, ['ConcreteWorn'], root)
    return root

def privacy_fence(name, L=2.4, h=1.8, broken=False, seed=1):
    """Vertical-board privacy fence panel: posts at both ends, two rails behind the boards."""
    rng = random.Random(seed)
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    bm = bmesh.new()
    for x in (-L / 2, L / 2): C.cube(bm, (x, 0.04, (h + 0.1) / 2), (0.1, 0.1, h + 0.1))
    for z in (0.3, h - 0.3): C.cube(bm, (0, 0.06, z), (L, 0.05, 0.1))
    n = int(L / 0.15)
    for i in range(n):
        x = -L / 2 + (i + 0.5) * L / n
        if broken and rng.random() < 0.28: continue
        bh = h - rng.uniform(0, 0.06) - (rng.uniform(0.2, 0.7) if broken and rng.random() < 0.3 else 0)
        f = C.cube(bm, (x, 0, bh / 2), (L / n - 0.012, 0.022, bh))
        if broken and rng.random() < 0.2:
            bmesh.ops.rotate(bm, cent=(x, 0, 0), matrix=Matrix.Rotation(rng.uniform(-0.25, 0.25), 3, 'Y'), verts=list({v for fa in f for v in fa.verts}))
    C.box_uv(bm, 1.2)
    col = C.ensure_col(bm)
    for f in bm.faces:
        for l in f.loops:
            k = 0.7 + 0.3 * min(1, l.vert.co.z / 0.6); l[col] = (k, k * 0.98, k * 0.95, 1)
    C.new_obj(name + '_w', bm, ['Wood'], root)
    return root

def rail_fence(name, L=3.0):
    """Split-rail fence section (concept 07): two posts, two rough rails."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    bm = bmesh.new()
    for x in (-L / 2, L / 2): C.cube(bm, (x, 0, 0.6), (0.16, 0.16, 1.2))
    for z in (0.45, 0.9): C.cube(bm, (0, 0, z), (L + 0.2, 0.09, 0.14))
    C.box_uv(bm, 1.2); C.paint(bm, (0.9, 0.88, 0.85), ground_dark=0.3, dark_h=0.4)
    C.new_obj(name + '_w', bm, ['WoodGrey'], root)
    return root

def gate(name, L=1.15, h=1.75):
    """A wooden privacy gate, hinged at x=0 (its origin), closing toward +x. Z-brace, latch and padlock."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    bm = bmesh.new()
    n = 8
    for i in range(n):
        x = (i + 0.5) * L / n
        C.cube(bm, (x, 0, h / 2 + 0.05), (L / n - 0.012, 0.025, h - 0.02 * (i % 2)))
    for z in (0.35, h - 0.3): C.cube(bm, (L / 2, 0.04, z), (L - 0.06, 0.05, 0.12))
    d = Vector((L - 0.12, 0, h - 0.65 - 0.35)); mid = Vector((L / 2, 0.045, (0.35 + h - 0.3) / 2))
    f = C.cube(bm, mid, (d.length, 0.045, 0.12))
    bmesh.ops.rotate(bm, cent=mid, matrix=Matrix.Rotation(math.atan2(d.z, d.x), 3, 'Y'), verts=list({v for fa in f for v in fa.verts}))
    C.box_uv(bm, 1.2); C.paint(bm, (0.85, 0.83, 0.8), ground_dark=0.25, dark_h=0.5)
    C.new_obj(name + '_boards', bm, ['Wood'], root)
    bm = bmesh.new()
    C.cube(bm, (L - 0.08, -0.04, 1.05), (0.16, 0.04, 0.05))           # latch bar
    C.cube(bm, (L - 0.02, -0.06, 0.98), (0.06, 0.03, 0.08))           # padlock body
    for z in (0.35, h - 0.3): C.cube(bm, (0.12, -0.03, z), (0.24, 0.02, 0.06))  # hinges
    C.box_uv(bm, 0.5); C.paint(bm, (0.5, 0.45, 0.4)); C.new_obj(name + '_hw', bm, ['MetalRust'], root)
    return root

def gate_post(name, h=1.95):
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    bm = bmesh.new(); C.cube(bm, (0, 0, h / 2), (0.14, 0.14, h)); C.box_uv(bm, 1.2); C.paint(bm, (0.85, 0.83, 0.8), ground_dark=0.3, dark_h=0.5)
    C.new_obj(name + '_w', bm, ['Wood'], root)
    return root

def pumphouse(name):
    return house(name, 3.4, 2.8, h=2.7, roof='flat', wall='StuccoWhite', tint=(0.9, 0.87, 0.8),
                 windows=[('left', 0, 0.6, 0.4, 1.8, 'glass')], door=(0.4, 0.95, (0.42, 0.44, 0.42)), ac=False, seed=4)

def build_all():
    out = {}
    out['house_hostage'] = house('house_hostage', 12, 9, rise=2.1, wall='StuccoWhite', tint=(0.96, 0.9, 0.78), seed=21,
        windows=[('front', -3.6, 1.4, 1.25, 0.9, 'lit'), ('front', 3.3, 1.4, 1.25, 0.9, 'lit'), ('left', -1.5, 1.2, 1.1, 1.0, 'boarded'),
                 ('left', 2.2, 1.0, 1.0, 1.0, 'glass'), ('right', 0, 1.2, 1.1, 1.0, 'glass'), ('back', -2.5, 1.2, 1.1, 1.0, 'glass'), ('back', 2.5, 1.6, 1.3, 0.9, 'boarded')],
        door=(-0.3, 0.95, (0.28, 0.2, 0.15)), portico=True, carport=(1, 6), lamp=True)
    out['house_pink'] = house('house_pink', 11, 8, h=3.1, roof='flat', wall='StuccoPink', tint=(1.0, 0.86, 0.8), seed=5,
        windows=[('front', -3.2, 1.3, 1.2, 0.9, 'boarded'), ('front', 3.0, 1.6, 1.2, 0.9, 'glass'), ('left', 0, 1.2, 1.1, 1.0, 'glass'),
                 ('right', -1.5, 1.2, 1.1, 1.0, 'boarded'), ('back', 0, 1.4, 1.1, 1.0, 'glass')], door=(0.2, 0.95, (0.25, 0.3, 0.27)))
    out['house_white'] = house('house_white', 10, 8, rise=1.8, wall='StuccoWhite', tint=(0.95, 0.93, 0.88), seed=8,
        windows=[('front', -2.8, 1.3, 1.2, 0.9, 'glass'), ('front', 2.8, 1.3, 1.2, 0.9, 'boarded'), ('left', 1, 1.2, 1.0, 1.0, 'glass'),
                 ('right', 0, 1.2, 1.0, 1.0, 'boarded'), ('back', -2, 1.2, 1.1, 1.0, 'glass'), ('back', 2.2, 1.2, 1.1, 1.0, 'glass')], door=(0, 0.95, (0.4, 0.35, 0.3)))
    out['house_tan'] = house('house_tan', 13, 9, rise=2.2, wall='Stucco', tint=(0.92, 0.84, 0.7), seed=13,
        windows=[('front', -4, 1.3, 1.2, 0.9, 'boarded'), ('front', 0.8, 1.3, 1.2, 0.9, 'glass'), ('front', 4.2, 1.3, 1.2, 0.9, 'glass'),
                 ('left', 0, 1.2, 1.0, 1.0, 'glass'), ('right', 1.5, 1.2, 1.0, 1.0, 'glass'), ('back', -3, 1.6, 1.2, 0.9, 'glass'), ('back', 3, 1.2, 1.1, 1.0, 'boarded')],
        door=(-1.8, 0.95, (0.32, 0.36, 0.33)), carport=(-1, 6))
    out['pumphouse'] = pumphouse('pumphouse')
    out['stucco_wall'] = stucco_wall('stucco_wall')
    out['fence_privacy'] = privacy_fence('fence_privacy', seed=2)
    out['fence_privacy_broken'] = privacy_fence('fence_privacy_broken', broken=True, seed=7)
    out['fence_rail'] = rail_fence('fence_rail')
    out['gate'] = gate('gate')
    out['gate_post'] = gate_post('gate_post')
    return out
