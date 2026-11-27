"""Editable, lapped outside corner for permanent roof fascia and soffit."""
from collections import defaultdict
from pathlib import Path
import math
import bpy

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgb, metal=0, rough=.68):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m


zinc=material('Weathered galvanized edge',(.195,.218,.22),.64,.49)
steel=material('Oxidized corner flashing',(.147,.162,.157),.52,.57)
seal=material('Dark butyl bedding',(.047,.050,.046))
concrete=material('Board-marked aggregate return',(.212,.215,.190))
bolt=material('Dulled fastener heads',(.243,.248,.229),.73,.55)
corner=bpy.data.objects.new('RoofFasciaCorner',None)
bpy.context.collection.objects.link(corner)


def finish(obj,name,mat,bevel):
    obj.name=name; obj.parent=corner; obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Break weather-exposed edges','BEVEL')
        mod.width=bevel; mod.segments=2; mod.harden_normals=True
    return obj


def angle(name,reach,inside,outside,lo,hi,mat,bevel,clip):
    # Footprint coordinates are in runtime X/Z, with permanent slab to
    # the negative side of both axes; Blender's Y points opposite Z.
    outline=[(-reach,-inside),(-reach,outside),(outside-clip,outside),
             (outside,outside-clip),(outside,-reach),(-inside,-reach),(-inside,-inside)]
    n=len(outline); mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(x,-z,y) for y in (lo,hi) for x,z in outline],[],
        [tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
    finish(obj,name,mat,bevel)


def fixing(t,vertical,side,surface):
    at=(t,-surface,vertical) if side==0 else (surface,-t,vertical)
    turn=(math.pi/2,0,0) if side==0 else (0,math.pi/2,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.016,depth=.010,location=at,rotation=turn)
    finish(bpy.context.object,'Riveted fascia lap',bolt,.002)


angle('Sealed upstand under the drip',.258,.115,.054,-.350,-.217,seal,.008,.039)
angle('Folded projecting drip splice',.264,.100,.090,-.321,-.195,zinc,.008,.046)
angle('Shadow fold below weather lip',.243,.086,.058,-.390,-.309,steel,.005,.039)
angle('Continuous lapped corner flashing',.215,.051,.051,-2.007,-.328,steel,.009,.029)
angle('Turned-in edge under chord',.232,.092,.057,-2.032,-1.986,zinc,.006,.032)
angle('Closed soffit return, scarfed ends',.365,.156,.046,-2.145,-1.991,concrete,.014,.022)
angle('Soffit-to-fascia isolation seal',.287,.103,.047,-2.002,-1.976,seal,.006,.024)
for side in (0,1):
    for y in (-.42,-.91,-1.44,-1.90):
        fixing(-.145,y,side,.052)
    fixing(-.174,-.240,side,.089)

for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,0,-1.15)
        area.spaces.active.region_3d.view_distance=3.96
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/blender/roof-corners-rc34.blend'),compress=True)
by_material=defaultdict(list)
for p in corner.children:
    bpy.ops.object.select_all(action='DESELECT'); p.select_set(True); bpy.context.view_layer.objects.active=p
    for mod in list(p.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    by_material[p.data.materials[0]].append(p)
for mat,parts in by_material.items():
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1: bpy.ops.object.join()
    bpy.context.object.name='Roof fascia corner / '+mat.name
bpy.ops.export_scene.gltf(filepath=str(root/'dist/3d/assets/env/roof-corners-rc34.glb'),export_format='GLB')
