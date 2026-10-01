# Render a strip of frames from each action of a rigged FBX/GLB, for review.
# blender --background --factory-startup --python blender/preview_actions.py -- <model> <outdir> [frames-per-action]
import bpy, sys, os, mathutils
args = sys.argv[sys.argv.index('--') + 1:]
src, outdir = args[0], args[1]
n = int(args[2]) if len(args) > 2 else 6
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src)
else: bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
scn = bpy.context.scene
try: scn.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError: scn.render.engine = 'BLENDER_EEVEE'
scn.render.resolution_x = 360; scn.render.resolution_y = 480
scn.world = bpy.data.worlds.new('w'); scn.world.color = (0.35, 0.35, 0.38)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scn.collection.objects.link(sun); sun.rotation_euler = (0.9, 0.1, 0.7); sun.data.energy = 3.5
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = 'ORTHO'
for act in bpy.data.actions:
    arm.animation_data_create(); arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    for i in range(n):
        f = int(f0 + (f1 - f0) * i / max(1, n - 1))
        scn.frame_set(f)
        bpy.context.view_layer.update()
        mesh = [o for o in bpy.data.objects if o.type == 'MESH']
        dg = bpy.context.evaluated_depsgraph_get()
        pts = []
        for o in mesh:
            ev = o.evaluated_get(dg); me = ev.to_mesh()
            vs = me.vertices; pts += [o.matrix_world @ vs[k].co for k in range(0, len(vs), 20)]; ev.to_mesh_clear()
        mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        c = (mn + mx) / 2
        cam.data.ortho_scale = max(mx.z - mn.z, mx.x - mn.x, mx.y - mn.y) * 1.25
        cam.location = c + mathutils.Vector((7, -7, 2))
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(outdir, '%s_%02d.png' % (act.name.replace('|', '_').replace('.', '_'), i))
        bpy.ops.render.render(write_still=True)
    print('ACTION', act.name, f0, f1)
