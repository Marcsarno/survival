# Builds public/assets/models/marc.glb from Marc's Tripo FBX (assets/source/marc/).
#
#   - keeps the Mixamo-style rig and the clips the opening uses, renamed:
#       walk -> Walk, climb -> Climb, frustrated_01 -> Frustrated (its first frame is the idle pose)
#   - drops the others (box, chop, kick, run: no sprint in this opening)
#   - resizes the 4K texture to 2048 for phones
#   - the rig is 1 unit tall; the game scales it to 1.8 m. Root motion stays in the clips; the game
#     strips the forward part of the Hips track and moves Marc itself.
#
# blender --background --factory-startup --python blender/build_marc.py -- <fbx> <out.glb>
import bpy, sys, os
args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
arm.name = 'Marc'; mesh.name = 'MarcBody'

KEEP = {'walk': 'Walk', 'climb': 'Climb', 'frustrated_01': 'Frustrated'}
for act in list(bpy.data.actions):
    key = act.name.split('|')[-1].split('.')[0]
    if key in KEEP:
        act.name = KEEP[key]; act.use_fake_user = True
    else:
        bpy.data.actions.remove(act)
print('actions', [a.name for a in bpy.data.actions])

# one material, base color only (the Tripo normal-map node has no image behind it)
for m in mesh.data.materials:
    m.name = 'MarcSkin'
    nt = m.node_tree
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            im = n.image
            if im.size[0] > 2048: im.scale(2048, 2048)
            im.filepath_raw = os.path.join(os.path.dirname(out), '_marc_tex.jpg'); im.file_format = 'JPEG'
            bpy.context.scene.render.image_settings.quality = 86
            im.save(filepath=im.filepath_raw, quality=86) if 'quality' in im.save.__doc__ else im.save()
            im.pack()
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.8
    for l in list(nt.links):
        if l.to_node == bsdf and l.to_socket.name == 'Normal': nt.links.remove(l)

# rest action on the armature: the walk (so the exported default pose is sensible)
arm.animation_data_create(); arm.animation_data.action = bpy.data.actions['Walk']
if hasattr(arm.animation_data, 'action_slot') and bpy.data.actions['Walk'].slots: arm.animation_data.action_slot = bpy.data.actions['Walk'].slots[0]

bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
                          export_image_format='JPEG', export_jpeg_quality=86, export_yup=True, export_apply=False, export_skins=True, export_morph=False)
tmp = os.path.join(os.path.dirname(out), '_marc_tex.jpg')
if os.path.exists(tmp): os.remove(tmp)
print('EXPORTED', out, os.path.getsize(out))
