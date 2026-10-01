# Print root-motion info per action: Hips location ranges (armature space), and foot heights.
# blender --background --factory-startup --python blender/action_info.py -- <fbx>
import bpy, sys
args = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=args[0])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
scn = bpy.context.scene
print('ARM scale', tuple(arm.scale), 'rot', tuple(arm.rotation_euler))
for act in bpy.data.actions:
    arm.animation_data_create(); arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    hips = arm.pose.bones[0]
    rows = []
    for f in range(f0, f1 + 1):
        scn.frame_set(f)
        h = arm.matrix_world @ hips.head
        lf = arm.matrix_world @ arm.pose.bones['mixamorig:LeftFoot'].head
        rf = arm.matrix_world @ arm.pose.bones['mixamorig:RightFoot'].head
        rows.append((f, h.x, h.y, h.z, lf.z, rf.z, lf.y, rf.y))
    xs = [r[1] for r in rows]; ys = [r[2] for r in rows]; zs = [r[3] for r in rows]
    print('ACTION %-28s frames %d-%d  hips x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f  start (%.3f,%.3f,%.3f) end (%.3f,%.3f,%.3f)' % (act.name, f0, f1, min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), rows[0][1], rows[0][2], rows[0][3], rows[-1][1], rows[-1][2], rows[-1][3]))
    if 'climb' in act.name or 'walk' in act.name:
        for r in rows[::6]: print('   f%3d hips(%.3f %.3f %.3f) footZ L %.3f R %.3f footY L %.3f R %.3f' % r)
    print('   fcurve paths:', sorted({fc.data_path.split('"')[1] if '"' in fc.data_path else fc.data_path for fc in (act.fcurves if hasattr(act, 'fcurves') else [])})[:3], 'fps', scn.render.fps)
