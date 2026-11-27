"""Collect the five checked upstream Poly Haven models in an editable Blender library."""
from pathlib import Path
import bpy
from mathutils import Vector

root=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
assets=['boiler-service-generator','archive-wall-utility-box','roof-irrigation-wall-hose','annex-recess-bin','annex-recess-extinguisher']
for i,key in enumerate(assets):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(root/f'dist/3d/assets/env/{key}.glb'))
    parts=set(bpy.data.objects)-before
    c=bpy.data.collections.new(key); bpy.context.scene.collection.children.link(c)
    anchor=bpy.data.objects.new(key,None);c.objects.link(anchor)
    coords=[o.matrix_world@Vector(p) for o in parts if o.type=='MESH' for p in o.bound_box]
    low=Vector(tuple(min(p[a] for p in coords) for a in range(3)))
    high=Vector(tuple(max(p[a] for p in coords) for a in range(3)))
    print('MODEL',key,'bounds',list(high-low),'objects',sorted(o.name for o in parts))
    for o in parts:
        if not o.parent: o.parent=anchor
        for collection in list(o.users_collection):collection.objects.unlink(o)
        c.objects.link(o)
    anchor.location=Vector((i*2.35,0,0))-(low+high)/2
    anchor.location.z=-low.z
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(4.7,0,.45)
        area.spaces.active.region_3d.view_distance=15
        area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/blender/polyhaven-rc36.blend'),compress=True)
