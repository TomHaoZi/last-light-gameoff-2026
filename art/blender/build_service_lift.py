"""Rebuild the folding steel gate with Blender 4.5: blender -b -P this_file."""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
material = bpy.data.materials.new("Brushed steel and baked enamel")
material.use_nodes = True
nodes = material.node_tree.nodes
shader = nodes.get("Principled BSDF")
shader.inputs["Metallic"].default_value = .36
shader.inputs["Roughness"].default_value = .51
paint = nodes.new("ShaderNodeVertexColor")
paint.layer_name = "Enamel"
material.node_tree.links.new(paint.outputs["Color"], shader.inputs["Base Color"])
iron, enamel, zinc, gasket = "424846", "5B726B", "A6A9A0", "252B2A"
brass, rust, warning, shadow = "AC8752", "854C32", "D59A4B", "303936"
parts = []
groups = []

def color(hex_value):
    rgb = [int(hex_value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return [((c + .055)/1.055)**2.4 if c > .04045 else c/12.92 for c in rgb] + [1]

def finish(obj, ink, bevel=0):
    if bevel:
        mod = obj.modifiers.new("Rolled edge", 'BEVEL')
        mod.width, mod.segments = bevel, 2
        mod.harden_normals = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal = obj.modifiers.new("Stamped normals", 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=normal.name)
    mesh = obj.data
    mesh.materials.append(material)
    field = mesh.color_attributes.new(name="Enamel", type='BYTE_COLOR', domain='POINT')
    rgba = color(ink)
    field.data.foreach_set("color", rgba * len(mesh.vertices))
    mesh.color_attributes.active_color = field
    parts.append(obj)
    return obj

def box(x, front, z, w, d, h, ink, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, front, z))
    obj = bpy.context.object
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, ink, min(bevel, w*.18, d*.18, h*.18))

def rod(a, b, radius, ink, sides=10):
    vector = Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=vector.length,
                                        location=(Vector(a)+Vector(b))*.5)
    obj = bpy.context.object
    obj.rotation_euler = vector.to_track_quat('Z', 'Y').to_euler()
    return finish(obj, ink, .001 if radius > .01 else 0)

def label(words, x, front, z, size, ink):
    # The shaft faces Blender +Y, so the player sees local X from the right.
    bpy.ops.object.text_add(location=(x,front,z), rotation=(math.pi/2, 0, math.pi))
    obj = bpy.context.object
    obj.data.body, obj.data.size, obj.data.align_x = words, size, 'CENTER'
    obj.data.extrude = .0003
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, ink)

def chip(x, front, z, width, height, ink):
    # A raised paint chip exposes primer along the lip and then narrows downhill.
    pts = [(0,0),(.72,.03),(1,.24),(.61,.38),(.42,.78),(.13,1),(.17,.39)]
    verts = [(x+a*width,front,z-b*height) for a,b in pts]
    mesh = bpy.data.meshes.new("Enamel chip")
    mesh.from_pydata(verts, [], [tuple(range(len(verts)))])
    obj = bpy.data.objects.new("Edge wear", mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj,ink)

def join(name, pivot=(0,0,0)):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    parts.clear()
    groups.append(obj)

# Viewed from the hall, the pale return on each side surrounds an oiled guide
# channel. The landing stays visible through the wired inspection lites.
box(0,-.48,1.2,1.62,.07,2.39,"343D3A")
for x in [-.59,-.30,0,.30,.59]:
    box(x,-.433,1.18,.014,.022,2.12,"565F57")
box(0,-.419,.92,1.47,.031,.108,iron,.007)
rod((-.65,-.356,.92),(.65,-.356,.92),.024,brass,16)
for x in (-.61,.61):
    rod((x,-.415,.92),(x,-.36,.92),.024,iron)
box(0,-.425,1.69,.51,.036,.269,gasket,.009)
box(0,-.399,1.69,.47,.013,.232,"8C8669",.004)
label("CAPACITY",0,-.390,1.705,.052,shadow)
label("2 PERSONS",0,-.390,1.638,.046,shadow)
box(0,-.16,.052,1.5,.61,.02,iron)
for row in range(6):
    for col in range(12):
        tread = box(-.69 + col*.119,-.4+row*.074,.069,.064,.013,.007,zinc,0)
        tread.rotation_euler.z = (.37 if (col+row)%2 else -.37)
for side in (-1,1):
    x=.856*side
    box(x,0,1.21,.17,.28,2.42,enamel,.014)
    box(.79*side,.073,1.215,.037,.14,2.39,gasket)
    box(.91*side,.153,1.19,.029,.032,2.26,zinc)
    for z in (.21,.74,1.58,2.23):
        rod((x,.139,z),(x,.165,z),.027,brass,6)
        chip(x-.009,.143,z-.017,.013,.062,rust)
    for i in range(5):
        chip(x-.065+(.013*i)% .029,.142,.31+i*.033,.013+.004*(i%3),.011+.01*(i%2),"A0A597")
box(0,.012,2.36,1.88,.29,.19,enamel,.012)
box(0,.167,2.285,1.72,.022,.019,zinc)
box(0,.026,.038,1.76,.40,.045,zinc,.005)
for y in (-.079,-.022,.036,.103,.148):
    box(0,y,.063,1.60,.011,.008,iron,.001)
box(0,.164,2.36,.54,.013,.10,shadow,.003)
label("INSPECTION   /   L-04",0,.174,2.34,.045,"DBD3AC")
join("LiftFrame")
leaf = .379
for side, word in [(-1,"Left"),(1,"Right")]:
    origin = side*.764
    for index, suffix in enumerate(["Outer","Inner"]):
        pivot = origin - side * leaf * index
        center = pivot - side*leaf*.5
        box(center,.002,1.177,leaf-.008,.066,2.212,enamel,.009)
        # Recessed louvers and pressed kick panel. A small raised bright rim
        # catches grazing light before the inset goes dark.
        box(center,.038,.553,.294,.017,.778,zinc,.009)
        box(center,.049,.553,.278,.010,.758,"4F635C",.008)
        for z in (.353,.404,.455):
            box(center,.057,z,.193,.013,.016,shadow,.003)
            box(center,.064,z+.010,.196,.018,.010,"82938A",.003)
        box(center,.04,1.568,.286,.019,.665,iron,.012)
        box(center,.053,1.568,.257,.009,.633,"263C3A",.01)
        # Wired glazing: each wire terminates at the rubber gasket.
        for slope in [-1,1]:
            for j in range(-6,7):
                intercept=j*.089
                lo=max(-.119,(-.301-intercept)/slope) if slope>0 else max(-.119,(.301-intercept)/slope)
                hi=min(.119,(.301-intercept)/slope) if slope>0 else min(.119,(-.301-intercept)/slope)
                if hi>lo:
                    rod((center+lo,.061,1.568+intercept+slope*lo),
                        (center+hi,.061,1.568+intercept+slope*hi),.0023,"75857D",5)
        for z in (1.23,1.906):
            box(center,.056,z,.277,.016,.012,zinc)
        box(center,.043,2.031,.259,.006,.098,"37413B")
        label(("C" if index==0 else "S")+("2" if side==1 else "1"),center,.051,2.017,.047,"DDBE7D")
        for z in (.225,1.08,2.14):
            hinge = pivot - side*.011
            rod((hinge,.041,z-.051),(hinge,.041,z+.051),.018,iron)
            rod((hinge,.041,z-.028),(hinge,.041,z+.023),.021,zinc)
        for dz in range(4):
            box(center,.043, .132+dz*.033,.25,.005,.006,"68726A",0)
        for i in range(7):
            u = ((i*17+3*index+(side+1)*4) % 29) / 29
            chip(center-.104+.20*u,.060,.885-.69*u,.014+.008*(i%3),.006+.002*(i%2),"899184")
        for xOff in [-.114,.109]:
            for z in [.258, .845]:
                rod((center+xOff,.055,z),(center+xOff,.060,z),.009,"777A6E",7)
                chip(center+xOff-.004,.056,z-.004,.007,.026 if side==1 else .039,"765944")
        if index==1:
            edge=center - side*(leaf*.5-.019)
            box(edge,.040,1.18,.026,.020,2.19,gasket)
            for z in (.68,.81,.94):
                box(edge,.054,z,.025,.006,.062,warning,.001)
        join("Gate"+word+suffix,(pivot,0,0))
for side,word in [(-1,"Left"),(1,"Right")]:
    box(.082*side,.083,1.077,.16,.030,.029,zinc)
    box(.148*side,.101,1.077,.052,.020,.056,brass)
    join("Deadbolt"+word,(0,0,0))
# The folder structure of the authoring script also works from a fresh clone.
bpy.context.preferences.filepaths.save_version = 0
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            view = area.spaces.active.region_3d
            view.view_location = (0, 0, 1.2)
            view.view_distance = 4.6
            view.view_rotation = Vector((-.18,-1,-.07)).to_track_quat('-Z','Y')
            area.spaces.active.shading.color_type = 'VERTEX'
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name("service-lift.blend")), compress=True)
output = ROOT/"dist/3d/assets/env/service-lift.glb"
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_texcoords=False,
    export_yup=True, export_animations=False, export_cameras=False, export_lights=False,
    export_vertex_color='ACTIVE', export_all_vertex_colors=False)
