"""Author the campaign checkpoint lantern at game scale (meters). Blender 4.5."""
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)


def finish(name, rgb, metal, rough, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    color = (*rgb, 1.)
    mat.diffuse_color = color
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    for key, value in [('Base Color', color), ('Metallic', metal), ('Roughness', rough),
                       ('Emission Color', color), ('Emission Strength', glow)]:
        bsdf.inputs[key].default_value = value
    return mat


iron = finish('Black enamel casting', (.034, .043, .042), .57, .46)
zinc = finish('Brushed zinc', (.22, .26, .256), .74, .36)
brass = finish('Tarnished bronze fasteners', (.34, .196, .084), .71, .39)
ceramic = finish('Jade opal glass', (.27, .69, .47), .0, .34, 1.16)
slot = finish('Black rubber seals', (.022, .029, .024), .03, .86)


def part(name, mat, edge=0):
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if edge:
        bevel = obj.modifiers.new('Machined radius', 'BEVEL')
        bevel.width, bevel.segments = edge, 3
        normals = obj.modifiers.new('Planar casting normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
    return obj


def block(name, xyz, size, mat, edge):
    bpy.ops.mesh.primitive_cube_add(size=1., location=xyz)
    bpy.context.object.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return part(name, mat, edge)


def ring(name, profile, mat, segments=48):
    # Each revolution contains its real flange, shoulder and recess profile.
    vertices = [(r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z)
                for z, r in profile for i in range(segments)]
    faces = [tuple(reversed(range(segments)))]
    for row in range(len(profile) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((row*segments + i, row*segments + j, (row+1)*segments + j, (row+1)*segments + i))
    faces.append(tuple(range(len(vertices) - segments, len(vertices))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    for face in list(mesh.polygons)[1:-1]:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def bolt(name, xyz, radius, depth):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radius, depth=depth, location=xyz)
    return part(name, brass, .0015)


block('Beveled ground plate', (0, 0, .048), (.355, .318, .096), iron, .018)
block('Raised anchor saddle', (0, 0, .107), (.309, .271, .038), zinc, .007)
for x in [-.116, .116]:
    for y in [-.096, .096]:
        bolt('Anchor nut', (x, y, .137), .018, .019)
ring('Tapered column casting', [(.115,.088),(.137,.082),(.163,.064),(.21,.063),(.24,.049),
                                 (.265,.047),(1.102,.045),(1.13,.051),(1.15,.059)], iron)
ring('Drawn steel sleeve', [(.267,.048),(.280,.048),(.287,.0475),(1.064,.0459),(1.071,.048),
                           (1.096,.048)], zinc)
for z in [.228, 1.072]:
    ring('Compression collar', [(z,.051),(z+.003,.055),(z+.021,.055),(z+.024,.052)], brass)
ring('Lower bell housing', [(1.102,.054),(1.134,.068),(1.16,.093),(1.182,.130),
                           (1.219,.160),(1.231,.168),(1.251,.166),(1.263,.154)], iron)
ring('Lens gasket', [(1.256,.150),(1.262,.150),(1.270,.140)], slot)
ring('Continuous frosted glass', [(1.264,.127),(1.273,.136),(1.289,.140),(1.385,.138),
                                  (1.401,.128)], ceramic, 64)
for i in range(8):
    theta = i * math.tau / 8
    rib = block('Radiused guard rib', (.145*math.cos(theta), .145*math.sin(theta), 1.335),
                (.020, .024, .172), iron, .004)
    rib.rotation_euler.z = theta
    bolt('Guard fastener', (.146*math.cos(theta), .146*math.sin(theta), 1.432), .009, .011)
for z in [1.28, 1.369]:
    ring('Glass guard hoop', [(z,.144),(z+.004,.154),(z+.012,.155),(z+.016,.144)], zinc)
ring('Spun rain cap', [(1.390,.152),(1.400,.171),(1.415,.177),(1.428,.172),
                      (1.441,.141),(1.453,.099),(1.464,.053),(1.465,.039)], iron, 64)
ring('Knurled service cap', [(1.459,.047),(1.463,.052),(1.480,.052),(1.483,.048)], brass, 12)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art/blender/checkpoint-lamp.blend'), compress=True)
# Export the evaluated part geometry, merged by material, without destroying the editable source.
bpy.ops.object.select_all(action='DESELECT')
for mat in (iron, zinc, brass, ceramic, slot):
    parts = [obj for obj in bpy.context.scene.objects if obj.data.materials[0] == mat]
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    bpy.context.object.name = mat.name
    bpy.context.object.select_set(False)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'dist/3d/assets/env/checkpoint-lamp.glb'), export_format='GLB')
