"""Export the original archive phonograph from Blender 4.5."""

import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
collection = None


def assembly(name):
    global collection
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


def material(name, color, roughness=0.5, metal=0, emission=0):
    rgb = [int(color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    color = [
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb
    ] + [1]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = color
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = color
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metal
    node.inputs["Emission Color"].default_value = color
    node.inputs["Emission Strength"].default_value = emission
    return mat


def part(name, verts, faces, mat, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width, segments=2):
    modifier = obj.modifiers.new("Shaped edge", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier = obj.modifiers.new("Weighted corners", "WEIGHTED_NORMAL")
    modifier.keep_sharp = True


def box(name, center, dims, mat, radius=0.009):
    vertices = [
        tuple(c + sign * d / 2 for c, sign, d in zip(center, signs, dims))
        for signs in [
            (-1, -1, -1),
            (1, -1, -1),
            (1, 1, -1),
            (-1, 1, -1),
            (-1, -1, 1),
            (1, -1, 1),
            (1, 1, 1),
            (-1, 1, 1),
        ]
    ]
    obj = part(
        name,
        vertices,
        [
            (3, 2, 1, 0),
            (4, 5, 6, 7),
            (0, 1, 5, 4),
            (1, 2, 6, 5),
            (2, 3, 7, 6),
            (3, 0, 4, 7),
        ],
        mat,
    )
    if radius:
        bevel(obj, min(radius, min(dims) * 0.23))
    return obj


def tube(name, rings, normal, mat, sides=24, flutes=0):
    axis = Vector(normal).normalized()
    u = axis.cross(
        Vector((0, 1, 0)) if abs(axis.y) < 0.95 else Vector((1, 0, 0))
    ).normalized()
    v = axis.cross(u)
    vertices = []
    for center, radius in rings:
        for index in range(sides):
            angle = math.tau * index / sides
            texture = 1 + flutes * math.cos(angle * 12)
            vertices.append(
                Vector(center)
                + (u * math.cos(angle) + v * math.sin(angle)) * radius * texture
            )
    faces = []
    for j in range(len(rings) - 1):
        for k in range(sides):
            a = j * sides + k
            b = j * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    return part(name, vertices, faces, mat, smooth=True)


def cylinder(name, a, b, r, mat, sides=24):
    axis = Vector(b) - Vector(a)
    obj = tube(name, [(a, r), (b, r)], axis, mat, sides)
    import bmesh

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.holes_fill(
        mesh, edges=[e for e in mesh.edges if e.is_boundary], sides=sides
    )
    mesh.to_mesh(obj.data)
    mesh.free()
    return obj


def seam(name, points, radius, mat):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 2
    line = data.splines.new("POLY")
    line.points.add(len(points) - 1)
    for point, pos in zip(line.points, points):
        point.co = (*pos, 1)
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    return obj


def label(name, content, center, size, mat):
    font = bpy.data.curves.new(name, "FONT")
    font.body = content
    font.size = size
    font.align_x = "CENTER"
    font.align_y = "CENTER"
    font.resolution_u = 3
    obj = bpy.data.objects.new(name, font)
    collection.objects.link(obj)
    obj.location = center
    obj.rotation_euler.x = math.pi / 2
    font.materials.append(mat)
    return obj


paper = material("Faded inspection card", "c6ba96", 0.88)
ghost_ink = material("Recesses and old mineral seepage", "3b4140", 0.87)
gold = material("Aged brass", "947751", 0.49, 0.65)
polish = material("Machined brass edge", "b6a17f", 0.34, 0.78)
rust = material("Heat-marked copper throat", "6f5140", 0.58, 0.60)
walnut = material("Dark walnut veneer", "574137", 0.57)
dark = material("Blackened green iron", "303a37", 0.41, 0.58)
warm = material("Amber record lamp", "e6be77", 0.34, 0.05, 1.35)

record = assembly("Records Office · phonograph and foreman note")
# Oak writing stand gives the player a readable place to interact.
for x in (-0.357, 0.357):
    for y in (-0.24, 0.24):
        box("Turned desk leg", (x, y, 0.42), (0.081, 0.081, 0.84), walnut, 0.017)
        box("Steel shoe", (x, y, 0.053), (0.098, 0.098, 0.106), dark, 0.005)
box("Desk top", (0, 0, 0.841), (0.88, 0.62, 0.072), walnut, 0.021)
box("Brass perimeter", (0, 0, 0.862), (0.89, 0.625, 0.012), gold, 0.006)
for x in (-0.36, 0.36):
    box("Case foot", (x, -0.013, 0.921), (0.101, 0.414, 0.091), dark, 0.012)
box("Phonograph chassis", (-0.018, 0.026, 1.0), (0.67, 0.474, 0.221), walnut, 0.029)
box("Lower machined bead", (-0.018, 0.026, 0.924), (0.694, 0.495, 0.02), gold, 0.01)
box("Upper machined bead", (-0.018, 0.026, 1.108), (0.694, 0.495, 0.018), gold, 0.009)
label("Recorded message sign", "RECORD  /  17", (-0.072, -0.22, 1.023), 0.045, polish)
center = (-0.112, 0.020)
for level, radius in [(1.129, 0.193), (1.138, 0.187), (1.146, 0.183)]:
    cylinder(
        "Record platter",
        (*center, level - 0.008),
        (*center, level),
        radius,
        dark if level != 1.138 else polish,
        48,
    )
for i in range(20):
    radius = 0.051 + i * 0.0065
    pts = [
        (
            center[0] + radius * math.cos(k * math.tau / 84),
            center[1] + radius * math.sin(k * math.tau / 84),
            1.148,
        )
        for k in range(85)
    ]
    seam("Shellac groove", pts, 0.0007, gold if i == 19 else ghost_ink)
cylinder("Paper spindle label", (*center, 1.147), (*center, 1.149), 0.052, paper, 32)
cylinder("Spindle", (*center, 1.15), (*center, 1.178), 0.009, polish, 16)
seam(
    "Bent tonearm",
    [
        (0.204, 0.172, 1.115),
        (0.198, 0.171, 1.219),
        (0.144, 0.131, 1.259),
        (0.019, 0.012, 1.207),
    ],
    0.022,
    gold,
)
cylinder("Stylus weight", (0.018, 0.01, 1.193), (0.017, 0.01, 1.221), 0.04, polish, 18)
seam(
    "Crank handle",
    [
        (0.316, -0.01, 1.025),
        (0.415, -0.01, 1.025),
        (0.414, -0.008, 0.948),
        (0.489, -0.008, 0.945),
    ],
    0.014,
    polish,
)
cylinder(
    "Bakelite crank end", (0.439, -0.008, 0.945), (0.488, -0.008, 0.945), 0.03, dark, 16
)
axis = Vector((0.04, -0.92, 0.38)).normalized()
origin = Vector((0.185, 0.194, 1.18))
profile = [
    (0, 0.048),
    (0.102, 0.052),
    (0.19, 0.065),
    (0.273, 0.089),
    (0.36, 0.126),
    (0.46, 0.173),
    (0.56, 0.239),
    (0.64, 0.296),
]
base = [(origin + axis * t, r) for t, r in profile]
tube(
    "Fluted spun brass bell",
    base
    + [(base[-1][0] + axis * 0.011, 0.300), (base[-1][0] + axis * 0.021, 0.290)]
    + [(x - axis * 0.004, r - 0.009) for x, r in reversed(base)],
    axis,
    gold,
    72,
    0.033,
)
# Fine spinning lines sit on the bell's outer slope and fade into the rolled lip.
for t0, t1, count in ((.36, .46, 3), (.46, .56, 4), (.56, .64, 4)):
    a, b = next(p for p in profile if p[0] == t0), next(p for p in profile if p[0] == t1)
    for i in range(count):
        blend = (i + .53) / count
        t = a[0] + (b[0] - a[0]) * blend
        r = a[1] + (b[1] - a[1]) * blend + .00095
        tube("Spinning line", [(origin + axis * t, r), (origin + axis * (t + .0012), r + .0005)],
             axis, rust if i % 3 == 0 else gold, 72, .033)

tube(
    "Patinated bell throat",
    [(origin + axis * 0.005, 0.039), (origin + axis * 0.122, 0.047)],
    axis,
    rust,
    36,
)
tube(
    "Polished trumpet lip",
    [
        (origin + axis * 0.635, 0.298),
        (origin + axis * 0.653, 0.303),
        (origin + axis * 0.663, 0.294),
    ],
    axis,
    polish,
    72,
    0.033,
)
box("Clip frame", (0, -0.323, 0.81), (0.56, 0.032, 0.146), dark, 0.012)
box("Cream direction card", (0, -0.344, 0.81), (0.522, 0.012, 0.117), paper, 0.003)
label("Guidance on the card", "KEEP YOUR EYES LOW", (0, -0.352, 0.81), 0.039, ghost_ink)
box("Status lamp jewel", (0.272, -0.209, 1.035), (0.041, 0.036, 0.025), warm, 0.007)


def export(group, path):
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    buffers = {}
    for source in group.objects:
        evaluated = source.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mat = source.data.materials[0]
        vertices, faces, smoothing = buffers.setdefault(mat, ([], [], []))
        offset = len(vertices)
        vertices.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        faces.extend(
            tuple(offset + index for index in polygon.vertices)
            for polygon in mesh.polygons
        )
        smoothing.extend(polygon.use_smooth for polygon in mesh.polygons)
        evaluated.to_mesh_clear()

    bpy.ops.object.select_all(action="DESELECT")
    combined = []
    for mat, (vertices, faces, smoothing) in buffers.items():
        mesh = bpy.data.meshes.new(mat.name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        for poly, smooth in zip(mesh.polygons, smoothing):
            poly.use_smooth = smooth
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(mat.name, mesh)
        scene.collection.objects.link(obj)
        obj.select_set(True)
        combined.append(obj)
    bpy.context.view_layer.objects.active = combined[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        use_selection=True,
        export_format="GLB",
        export_yup=True,
        export_lights=False,
        export_cameras=False,
    )
    for obj in combined:
        bpy.data.objects.remove(obj, do_unlink=True)


export(record, ROOT / "dist/3d/assets/env/office-phonograph.glb")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(ROOT / "art/blender/office-phonograph.blend"), compress=True
)
