# Shared helpers for the opening's asset kit (blender/build_kit.py).
#
# Conventions
# - Meters, Z up in Blender (the glTF exporter converts to Y up). The front of a building is -Y in
#   Blender, which becomes +Z in three.js ("south", toward the camera).
# - Materials are named from the game's material library (src/world/materials.js). GLBs are exported
#   WITHOUT images: the game assigns the shared textures by material name, so a texture is
#   downloaded once however many assets use it. The Blender materials do carry the textures, so
#   preview renders look like the game.
# - UVs: box projection in world-size units (1 UV = 1 m) unless an asset makes its own; the game
#   scales each material's texture by its real-world size.
# - Vertex colors (COLOR_0) carry tint and baked-in darkening (grime near the ground, inner leaves).
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEX = os.path.join(ROOT, 'public', 'assets', 'textures')
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'kit')

# material name -> (texture id or None, base color RGBA, roughness, extra)
LIB = {
    'Stucco': ('worn_mossy_plasterwall', (1, 1, 1, 1), 0.9, {}),
    'StuccoWhite': ('white_plaster_rough_01', (1, 1, 1, 1), 0.9, {}),
    'StuccoPink': ('red_plaster_weathered', (1, 1, 1, 1), 0.9, {}),
    'RoofTile': ('clay_roof_tiles', (1, 1, 1, 1), 0.8, {}),
    'RoofFlat': ('concrete_moss', (1, 1, 1, 1), 0.95, {}),
    'Trim': (None, (0.86, 0.83, 0.77, 1), 0.7, {}),
    'Wood': ('weathered_planks', (1, 1, 1, 1), 0.85, {}),
    'WoodGrey': ('wood_planks_grey', (1, 1, 1, 1), 0.85, {}),
    'WoodOld': ('old_planks_02', (1, 1, 1, 1), 0.85, {}),
    'Bark': ('bark_brown_02', (1, 1, 1, 1), 0.95, {}),
    'PalmBark': ('palm_bark', (1, 1, 1, 1), 0.95, {}),
    'MetalGreen': ('green_metal_rust', (1, 1, 1, 1), 0.6, {'metal': 0.6}),
    'MetalRust': ('rusty_metal', (1, 1, 1, 1), 0.7, {'metal': 0.5}),
    'Concrete': ('concrete_pavement', (1, 1, 1, 1), 0.9, {}),
    'ConcreteWorn': ('worn_concrete_floor', (1, 1, 1, 1), 0.9, {}),
    'Fabric': ('terry_cloth', (0.86, 0.82, 0.75, 1), 1.0, {}),
    'Leaves': ('foliage/leaves', (1, 1, 1, 1), 0.85, {'alpha': True}),
    'PalmFrond': ('foliage/frond', (1, 1, 1, 1), 0.8, {'alpha': True}),
    'FanLeaf': ('foliage/fan', (1, 1, 1, 1), 0.8, {'alpha': True}),
    'Grass': ('foliage/grass', (1, 1, 1, 1), 0.9, {'alpha': True}),
    'Glass': (None, (0.05, 0.06, 0.07, 1), 0.15, {}),
    'Paint': (None, (1, 1, 1, 1), 0.75, {}),          # flat painted surfaces; color from vertex colors
    'Plastic': (None, (1, 1, 1, 1), 0.45, {}),        # color from vertex colors
    'Rubber': (None, (0.07, 0.07, 0.07, 1), 0.9, {}),
    'Metal': (None, (0.45, 0.45, 0.46, 1), 0.45, {'metal': 0.8}),
}

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

SRC_TEX = os.path.join(ROOT, 'assets', 'source', 'polyhaven', 'textures')   # 1k originals (gitignored)
FOLIAGE = os.path.join(ROOT, 'assets', 'source', 'foliage')                 # generated leaf atlases (PNG)
def tex_path(tid, kind='diff'):
    if tid.startswith('foliage/'): return os.path.join(FOLIAGE, tid.split('/')[1] + '.png')
    return os.path.join(SRC_TEX, tid, kind + '.jpg')

_mats = {}
def mat(name):
    if name in _mats: return _mats[name]
    tid, col, rough, extra = LIB[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = col; b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = extra.get('metal', 0)
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    nt.links.new(vc.outputs['Color'], mix.inputs[7])
    if tid and os.path.exists(tex_path(tid)):
        im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(tex_path(tid), check_existing=True)
        nt.links.new(im.outputs['Color'], mix.inputs[6])
        if extra.get('alpha'):
            nt.links.new(im.outputs['Alpha'], b.inputs['Alpha'])
            try: m.surface_render_method = 'DITHERED'
            except Exception: pass
        nrm = tex_path(tid, 'nor')
        if os.path.exists(nrm):
            ni = nt.nodes.new('ShaderNodeTexImage'); ni.image = bpy.data.images.load(nrm, check_existing=True); ni.image.colorspace_settings.name = 'Non-Color'
            nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(ni.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    else:
        mix.inputs[6].default_value = col
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    m.use_backface_culling = False
    _mats[name] = m
    return m

def new_obj(name, bm, materials, parent=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for mn in materials: me.materials.append(mat(mn))
    if parent: o.parent = parent
    return o

def ensure_col(bm):
    return bm.loops.layers.color.get('Col') or bm.loops.layers.color.new('Col')

def box_uv(bm, size=1.0, offset=(0, 0, 0)):
    """World-size box projection: each face uses the two axes it does not face."""
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = l.vert.co + Vector(offset)
            if ax == 0: u, v = p.y * (1 if n.x > 0 else -1), p.z
            elif ax == 1: u, v = p.x * (-1 if n.y > 0 else 1), p.z
            else: u, v = p.x, p.y
            l[uv].uv = (u / size, v / size)
    return uv

def paint(bm, color, faces=None, ground_dark=0.0, dark_h=0.6):
    """Set loop colors; ground_dark darkens toward z=0 (grime / contact)."""
    col = ensure_col(bm)
    for f in (faces if faces is not None else bm.faces):
        for l in f.loops:
            k = 1.0
            if ground_dark: k = 1 - ground_dark * max(0.0, 1 - l.vert.co.z / dark_h)
            l[col] = (color[0] * k, color[1] * k, color[2] * k, 1)

def cube(bm, center, size, rot_z=0.0):
    """Add an axis-aligned (then Z-rotated) box to bm; returns its faces."""
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r['verts']
    bmesh.ops.scale(bm, vec=Vector(size), verts=vs)
    if rot_z: bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(rot_z, 3, 'Z'), verts=vs)
    bmesh.ops.translate(bm, vec=Vector(center), verts=vs)
    return list({f for v in vs for f in v.link_faces})

def cylinder(bm, p0, p1, r0, r1=None, segs=8, cap=True):
    """Tube from p0 to p1; returns faces."""
    r1 = r0 if r1 is None else r1
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    q = d.normalized().to_track_quat('Z', 'Y')
    rings = []
    for (p, r) in ((p0, r0), (p1, r1)):
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new(p + q @ Vector((math.cos(a) * r, math.sin(a) * r, 0))))
        rings.append(ring)
    faces = []
    for i in range(segs):
        j = (i + 1) % segs
        faces.append(bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i])))
    if cap:
        faces.append(bm.faces.new(list(reversed(rings[0])))); faces.append(bm.faces.new(rings[1]))
    return faces

def export(objs, name):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        for c in o.children_recursive: c.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, name + '.glb')
    keep = any(o.get('keep_images') for o in objs)   # Poly Haven props keep their own textures
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='JPEG' if keep else 'NONE', export_jpeg_quality=82,
                              export_yup=True, export_apply=True, export_animations=False, export_vertex_color='ACTIVE' if bpy.app.version >= (4, 2, 0) else 'MATERIAL')
    print('EXPORTED', name, os.path.getsize(path))
    return path

def set_custom_normals(obj, normals_per_loop):
    me = obj.data
    if hasattr(me, 'use_auto_smooth'): me.use_auto_smooth = True
    me.normals_split_custom_set(normals_per_loop)
