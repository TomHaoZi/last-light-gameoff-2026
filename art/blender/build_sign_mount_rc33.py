"""Editable folded sign tray used by the Records Office wall signs."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)

def enamel(name, color, metal):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = .55
    return material

tray = enamel('Tarnished bronze fold', (.157, .116, .054), .66)
seal = enamel('Dark phenolic isolator', (.043, .043, .030), .23)
bolt = enamel('Oxidized brass fastener', (.29, .22, .10), .75)
mount = bpy.data.objects.new('ArchiveSignTray', None)
bpy.context.collection.objects.link(mount)

def finish(name, material, radius):
    obj = bpy.context.object
    obj.name = name
    obj.parent = mount
    obj.data.materials.append(material)
    bevel = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
    bevel.width = radius
    bevel.segments = 2
    bevel.harden_normals = True
    return obj

def box(name, at, size, material, radius):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    bpy.context.object.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(name, material, radius)

# -Y is the occupied side. The printed face sits 3 mm ahead of the tray.
box('Isolation shadow gasket', (0, -.033, 0), (1.76, .058, .676), seal, .012)
box('Pressed and folded metal tray', (0, -.079, 0), (1.816, .056, .727), tray, .021)
for x in (-.876, .876):
    for z in (-.322, .322):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=.010, depth=.013,
                                          location=(x, -.108, z), rotation=(1.57079632679, 0, 0))
        finish('Brass wall fixing', bolt, .002)

for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_distance = 3.5
        area.spaces.active.shading.color_type = 'MATERIAL'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'art/blender/sign-mount-rc33.blend'), compress=True)
fasteners = [o for o in mount.children if o.data.materials[0] == bolt]
bpy.ops.object.select_all(action='DESELECT')
for obj in fasteners:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=obj.modifiers[0].name)
    obj.select_set(True)
bpy.ops.object.join()
bpy.context.object.name = 'Brass wall fixings'
bpy.ops.export_scene.gltf(filepath=str(root / 'dist/3d/assets/env/sign-mount-rc33.glb'), export_format='GLB')
