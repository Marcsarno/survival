# Builds the opening's asset kit into public/assets/models/kit/*.glb and renders review sheets.
#
#   blender --background --factory-startup --python blender/build_kit.py -- [groups] [--textures] [--sheet out.png]
#   groups: foliage, buildings, props (default: all); neighborhood = only the 2026-10-01 additions
#
# Textures come from Poly Haven (tools/fetch-polyhaven.mjs) plus generated foliage (kit/foliage.py).
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from mathutils import Vector
from kit import common as C
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
groups = [a for a in args if not a.startswith('--') and not a.endswith('.png')] or ['foliage', 'buildings', 'props']
sheet = next((args[i + 1] for i, a in enumerate(args) if a == '--sheet'), None)

C.clear()
built = {}
if 'neighborhood' in groups:
    from kit import foliage, buildings, props
    foliage.autumn_textures()
    built.update(foliage.build_autumn())
    built.update(buildings.build_neighborhood())
    built['suitcase_open'] = props.suitcase_open('suitcase_open')
    built['box_cardboard'] = props.box_cardboard('box_cardboard')
if 'foliage' in groups:
    from kit import foliage
    if '--textures' in args or not os.path.exists(os.path.join(foliage.FOL, 'leaves.png')): foliage.textures()
    built.update(foliage.build_all())
if 'buildings' in groups:
    from kit import buildings
    built.update(buildings.build_all())
if 'props' in groups:
    from kit import props
    built.update(props.build_all())

for name, root in built.items():
    C.export([root], name)

if sheet:
    # lay the assets out in a grid and render them from the game's camera angle, lit by the HDRI
    scn = bpy.context.scene
    names = list(built)
    cols = min(6, len(names))
    gap = 9.0
    for i, n in enumerate(names):
        built[n].location = Vector(((i % cols) * gap, -(i // cols) * gap, 0))
    w = scn.world = bpy.data.worlds.new('w'); w.use_nodes = True
    env = w.node_tree.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(os.path.join(C.ROOT, 'public', 'assets', 'env', 'dikhololo_sunset.hdr'))
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.8
    w.node_tree.links.new(env.outputs['Color'], bg.inputs['Color'])
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scn.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), 0, math.radians(-120)); sun.data.energy = 3.2; sun.data.color = (1, 0.88, 0.72)
    rows = (len(names) + cols - 1) // cols
    bm = __import__('bmesh').new(); __import__('bmesh').ops.create_grid(bm, x_segments=1, y_segments=1, size=1)
    gx0, gx1, gy0, gy1 = -gap / 2, cols * gap - gap / 2, -rows * gap + gap / 2, gap / 2
    for v in bm.verts: v.co.x = gx0 if v.co.x < 0 else gx1; v.co.y = gy0 if v.co.y < 0 else gy1
    C.box_uv(bm, 4.0); C.paint(bm, (1, 1, 1))
    C.LIB['Ground'] = ('forest_leaves_02', (1, 1, 1, 1), 0.95, {})
    C.new_obj('ground', bm, ['Ground'])
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
    cx, cy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(gx1 - gx0, (gy1 - gy0) * 1.6) * 0.98
    pitch = math.radians(50)
    cam.location = (cx, cy - 60 * math.cos(pitch), 60 * math.sin(pitch) + 3)
    cam.rotation_euler = (math.radians(40), 0, 0)
    try: scn.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError: scn.render.engine = 'BLENDER_EEVEE'
    scn.render.resolution_x = 1600; scn.render.resolution_y = int(1600 * (gy1 - gy0) / (gx1 - gx0) * 1.0) + 200
    try: scn.view_settings.view_transform = 'AgX'
    except Exception: pass
    scn.render.filepath = sheet
    bpy.ops.render.render(write_still=True)
    print('SHEET', sheet)
