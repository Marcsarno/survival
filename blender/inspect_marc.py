# Inspect the Tripo FBX for Marc: objects, armature, bones, actions, mesh size, rest pose; render a preview.
# blender --background --factory-startup --python blender/inspect_marc.py -- <fbx> <out.png>
import bpy, sys, mathutils
args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
for o in bpy.data.objects:
    print('OBJ', o.name, o.type, 'dims', tuple(round(v, 3) for v in o.dimensions), 'loc', tuple(round(v, 3) for v in o.location), 'rot', tuple(round(v, 3) for v in o.rotation_euler), 'scale', tuple(round(v, 3) for v in o.scale), 'parent', o.parent.name if o.parent else None)
    if o.type == 'MESH':
        me = o.data
        print('  verts', len(me.vertices), 'faces', len(me.polygons), 'mats', [m.name for m in me.materials], 'uv', [u.name for u in me.uv_layers], 'groups', len(o.vertex_groups))
        ws = [o.matrix_world @ v.co for v in me.vertices]
        mn = mathutils.Vector((min(v.x for v in ws), min(v.y for v in ws), min(v.z for v in ws)))
        mx = mathutils.Vector((max(v.x for v in ws), max(v.y for v in ws), max(v.z for v in ws)))
        print('  world bounds', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
        # rough pose check: width at shoulder height vs hip height (T-pose has very wide arms)
        h = mx.z - mn.z
        for f in (0.85, 0.75, 0.6, 0.45, 0.25, 0.05):
            z = mn.z + h * f
            band = [v for v in ws if abs(v.z - z) < h * 0.02]
            if band:
                print('  band %.2f: x %.3f..%.3f  y %.3f..%.3f  n=%d' % (f, min(v.x for v in band), max(v.x for v in band), min(v.y for v in band), max(v.y for v in band), len(band)))
    if o.type == 'ARMATURE':
        for b in o.data.bones:
            print('  BONE', b.name, 'parent', b.parent.name if b.parent else None, 'head', tuple(round(v, 3) for v in b.head_local))
for a in bpy.data.actions:
    print('ACTION', a.name, a.frame_range[:])
for m in bpy.data.materials:
    print('MAT', m.name, [n.type for n in m.node_tree.nodes] if m.node_tree else None)
for im in bpy.data.images:
    print('IMG', im.name, im.size[:], im.filepath)
# preview render: front and side
scn = bpy.context.scene
mesh = [o for o in bpy.data.objects if o.type == 'MESH']
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
cam.data.type = 'ORTHO'
allws = [o.matrix_world @ v.co for o in mesh for v in o.data.vertices]
mn = mathutils.Vector((min(v.x for v in allws), min(v.y for v in allws), min(v.z for v in allws)))
mx = mathutils.Vector((max(v.x for v in allws), max(v.y for v in allws), max(v.z for v in allws)))
c = (mn + mx) / 2; size = max(mx - mn) * 1.15
cam.data.ortho_scale = size
light = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scn.collection.objects.link(light); light.rotation_euler = (0.8, 0.2, 0.6); light.data.energy = 3
scn.world = bpy.data.worlds.new('w'); scn.world.color = (0.5, 0.5, 0.5)
try: scn.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    try: scn.render.engine = 'BLENDER_EEVEE'
    except TypeError: pass
scn.render.resolution_x = 1200; scn.render.resolution_y = 900
import math
for i, (name, pos) in enumerate([('front', (0, -10, 0)), ('side', (10, 0, 0)), ('back', (0, 10, 0))]):
    cam.location = c + mathutils.Vector(pos)
    d = c - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scn.camera = cam
    scn.render.filepath = out.replace('.png', '-' + name + '.png')
    bpy.ops.render.render(write_still=True)
print('DONE')
