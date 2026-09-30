# Headless inspection of GLB files: dimensions, triangles, materials, textures, rigs, animations.
# Usage: blender --background --factory-startup --python blender/inspect_glb.py -- assets/source/*.glb
import bpy, sys, json, os
from mathutils import Vector

files = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
report = {}
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    tris = 0
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    mats = set(); imgs = set(); meshes = []
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH':
            dg = bpy.context.evaluated_depsgraph_get()
            me = ob.evaluated_get(dg).to_mesh()
            t = sum(len(p.vertices) - 2 for p in me.polygons)
            tris += t
            meshes.append((ob.name, t))
            for v in me.vertices:
                w = ob.matrix_world @ v.co
                lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
            for m in ob.data.materials:
                if m:
                    mats.add(m.name)
                    if m.use_nodes:
                        for n in m.node_tree.nodes:
                            if n.type == 'TEX_IMAGE' and n.image:
                                imgs.add(f"{n.image.name} {n.image.size[0]}x{n.image.size[1]}")
            ob.evaluated_get(dg).to_mesh_clear()
    arm = [o.name for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    acts = [a.name for a in bpy.data.actions]
    size = hi - lo
    report[os.path.basename(f)] = dict(
        tris=tris, size_xyz=[round(size.x, 2), round(size.y, 2), round(size.z, 2)],
        meshes=len(meshes), top_meshes=sorted(meshes, key=lambda m: -m[1])[:6],
        materials=sorted(mats), images=sorted(imgs), armatures=arm, actions=acts)
print("@@REPORT@@" + json.dumps(report))
