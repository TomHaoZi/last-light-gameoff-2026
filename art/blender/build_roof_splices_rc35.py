"""Editable compression cover for a straight roof fascia/soffit joint."""
from collections import defaultdict
from pathlib import Path
from math import pi
import bpy

root=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name,color,metal):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.58
    return m

zinc=material('Lap-coated zinc',(.195,.218,.22),.64)
steel=material('Aged fascia steel',(.161,.175,.17),.51)
seal=material('Recessed weather seal',(.042,.048,.042),0)
bolt=material('Oxide fasteners',(.246,.251,.233),.73)
a=bpy.data.objects.new('RoofFasciaSplice',None);bpy.context.collection.objects.link(a)

def finish(name,mat,bevel):
    o=bpy.context.object;o.name=name;o.parent=a;o.data.materials.append(mat)
    m=o.modifiers.new('Rounded exposed edge','BEVEL');m.width=bevel;m.segments=1;m.harden_normals=True

def bar(name,at,size,mat,bevel=.007):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at);bpy.context.object.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(name,mat,bevel)

bar('Folded splice over drip', (0,-.081,-.234),(.212,.147,.133),zinc,.012)
bar('Under-lip tucking flange', (0,-.076,-.319),(.17,.092,.061),steel)
bar('Panel joint compression strip', (0,-.055,-1.202),(.122,.061,1.716),steel,.012)
bar('Standing seal between panels', (0,-.087,-1.19),(.024,.026,1.69),seal,.004)
bar('Lower chord lap', (0,-.055,-2.010),(.195,.114,.101),zinc)
bar('Soffit seam return plate', (0,.104,-2.081),(.235,.461,.060),steel,.01)
for z,y in [(-.228,-.158),(-.413,-.086),(-.927,-.086),(-1.504,-.086),(-1.921,-.086),(-2.022,-.114)]:
    for x in (-.041,.041):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.009,depth=.012,location=(x,y,z),rotation=(pi/2,0,0))
        finish('Compression fixing',bolt,.0016)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,0,-1.15)
        area.spaces.active.region_3d.view_distance=3.65
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/blender/roof-splices-rc35.blend'),compress=True)
by_mat=defaultdict(list)
for part in a.children:
    bpy.ops.object.select_all(action='DESELECT');part.select_set(True);bpy.context.view_layer.objects.active=part
    for modifier in list(part.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
    by_mat[part.data.materials[0]].append(part)
for mat,parts in by_mat.items():
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:part.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    bpy.context.object.name='Fascia splice / '+mat.name
bpy.ops.export_scene.gltf(filepath=str(root/'dist/3d/assets/env/roof-splices-rc35.glb'),export_format='GLB')
