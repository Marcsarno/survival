# Renders a contact sheet of GLB models side by side (each scaled to fit a unit cell).
# Usage: blender --background --factory-startup --python blender/render_sheet.py -- out.png [--keep-scale] a.glb b.glb ...
import bpy, sys, math
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
keep_scale = "--keep-scale" in args
files = [a for a in args[1:] if a.endswith(".glb")]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
cell = 3.0
cols = min(len(files), 6)
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    bpy.context.view_layer.update()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in new:
        if o.type == 'MESH':
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    size = hi - lo
    s = 1.0 if keep_scale else (cell * 0.8) / max(size.x, size.y, size.z, 1e-6)
    cx, cy = (i % cols) * cell, -(i // cols) * cell
    for r in roots:
        r.scale = r.scale * s
        r.location = (r.location - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))) * s + Vector((cx, cy, 0))

rows = math.ceil(len(files) / cols)
# ground, lights, camera
bpy.ops.mesh.primitive_plane_add(size=200, location=((cols - 1) * cell / 2, -(rows - 1) * cell / 2, 0))
g = bpy.context.object
gm = bpy.data.materials.new("ground"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.78, 0.85, 1)
g.data.materials.append(gm)
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(35)))
bpy.context.object.data.energy = 3.5
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.7, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
center = Vector(((cols - 1) * cell / 2, -(rows - 1) * cell / 2, 0.8))
bpy.ops.object.camera_add()
cam = bpy.context.object; scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = max(cols, rows * 1.6) * cell * 1.05
d = Vector((0.0, -1.0, 0.85)).normalized() * 60
cam.location = center + d
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1400
scene.render.resolution_y = int(1400 * (rows * 1.6) / max(cols, rows * 1.6) * 0.9) if cols < rows * 1.6 else int(1400 * rows * 1.6 / cols * 0.75)
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("@@RENDERED", out)
