"""Build the archive spectre and its hinged pose rig in Blender 4.5."""

import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
sculpt = bpy.data.collections.new("The Mourning Clerk")
scene.collection.children.link(sculpt)


def material(name, rgb, roughness, metallic=0.0, erosion=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1)
    tree = mat.node_tree
    shader = tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if erosion:
        grit = tree.nodes.new("ShaderNodeTexNoise")
        grit.inputs["Scale"].default_value = 95
        grit.inputs["Roughness"].default_value = 0.81
        bump = tree.nodes.new("ShaderNodeBump")
        bump.inputs["Distance"].default_value = 0.008
        bump.inputs["Strength"].default_value = erosion
        tree.links.new(grit.outputs["Fac"], bump.inputs["Height"])
        tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


limestone = material("Waxed grey limestone", (0.38, 0.41, 0.36), 0.72, erosion=0.32)
limestoneShade = material("Stone in shadow", (0.218, 0.259, 0.235), 0.86, erosion=0.19)
blackCalcite = material("Dark calcite", (0.072, 0.101, 0.097), 0.71, erosion=0.29)
dress = material("Carbonate cloth", (0.126, 0.175, 0.167), 0.91, erosion=0.38)
torn = material("Exposed pale skirt seam", (0.28, 0.33, 0.291), 0.88)
tears = material("Wet mineral streaks", (0.099, 0.156, 0.158), 0.30)
enamel = material("Numbered brass archive clasp", (0.45, 0.302, 0.131), 0.38, 0.75)
iris = material("Weathered silver sclera", (0.54, 0.60, 0.53), 0.46)
pupil = material("Barely lit eyes", (0.115, 0.133, 0.107), 0.29)
lip = material("Oxide at the mouth", (0.229, 0.146, 0.136), 0.65)


def point(p):
    x, y, z = p
    return (x, -z, y)


def joint(name, at, parent=None):
    obj = bpy.data.objects.new(name, None)
    sculpt.objects.link(obj)
    obj.parent = parent
    obj.location = point(at)
    obj.empty_display_size = 0.04
    return obj


def part(name, verts, faces, mat, parent, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([point(v) for v in verts], [], faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = smooth
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    sculpt.objects.link(obj)
    obj.parent = parent
    return obj


def loft(name, rings, material, parent, sides=48, pleats=0):
    verts = []
    for j, (y, w, d, z) in enumerate(rings):
        for i in range(sides):
            t = i * math.tau / sides
            fabric = 1 + pleats * (
                math.sin(t * 12 + y * 5) * 0.63 + math.cos(t * 23 - y * 8) * 0.26
            )
            edge = 0.025 * pleats * math.sin(t * 5) if j == 0 else 0
            verts.append(
                (math.cos(t) * w * fabric, y + edge, z + math.sin(t) * d * fabric)
            )
    faces = []
    for j in range(len(rings) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            faces.append((a, a + sides, b + sides, b))
    faces.extend(
        (tuple(reversed(range(sides))), tuple(range(len(verts) - sides, len(verts))))
    )
    return part(name, verts, faces, material, parent)


def bead(name, center, size, mat, parent, bands=12, segments=18):
    x, y, z = center
    a, b, c = size
    rings = [
        (y + b * math.sin(t), a * math.cos(t), c * math.cos(t), z)
        for t in (
            -math.pi / 2 + 0.005 + j * (math.pi - 0.01) / bands
            for j in range(bands + 1)
        )
    ]
    obj = loft(name, rings, mat, parent, segments)
    obj.location.x = x
    return obj


def thread(name, points, r, mat, parent):
    d = bpy.data.curves.new(name, "CURVE")
    d.dimensions = "3D"
    d.bevel_depth = r
    d.bevel_resolution = 2
    spline = d.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, v in zip(spline.points, points):
        p.co = (*point(v), 1)
    d.materials.append(mat)
    obj = bpy.data.objects.new(name, d)
    sculpt.objects.link(obj)
    obj.parent = parent
    return obj


def pressed(name, text, at, size, mat, parent):
    d = bpy.data.curves.new(name, "FONT")
    d.body = text
    d.size = size
    d.align_x = "CENTER"
    d.align_y = "CENTER"
    d.materials.append(mat)
    obj = bpy.data.objects.new(name, d)
    sculpt.objects.link(obj)
    obj.parent = parent
    obj.location = point(at)
    obj.rotation_euler.x = math.pi / 2


body = joint("Figure", (0, 0, 0))
rib = joint("Ribcage", (0, 1.08, 0), body)
skirt = joint("Drape", (0, 1.04, 0), body)
for side in (-1, 1):
    bead(
        "Pointed stone shoe",
        (side * 0.093, 0.08, 0.038),
        (0.061, 0.05, 0.127),
        blackCalcite,
        body,
    )
loft(
    "One-piece pleated skirt",
    [
        (-0.91, 0.315, 0.224, -0.032),
        (-0.85, 0.327, 0.222, -0.040),
        (-0.77, 0.304, 0.208, -0.029),
        (-0.64, 0.283, 0.178, -0.019),
        (-0.49, 0.232, 0.155, -0.006),
        (-0.34, 0.198, 0.130, 0),
        (-0.19, 0.159, 0.115, 0),
        (-0.08, 0.135, 0.103, 0),
        (0.035, 0.117, 0.102, 0),
    ],
    dress,
    skirt,
    84,
    0.16,
)
loft(
    "Broken hem binding",
    [
        (-0.886, 0.316, 0.223, -0.034),
        (-0.867, 0.326, 0.226, -0.036),
        (-0.849, 0.324, 0.225, -0.036),
    ],
    torn,
    skirt,
    84,
    0.16,
)
loft(
    "Fitted archive tunic",
    [
        (-0.054, 0.122, 0.107, 0),
        (0.02, 0.122, 0.108, 0),
        (0.13, 0.135, 0.112, 0),
        (0.24, 0.170, 0.129, 0.009),
        (0.33, 0.171, 0.122, 0.006),
        (0.392, 0.145, 0.096, 0),
        (0.43, 0.061, 0.055, 0),
    ],
    dress,
    rib,
    64,
    0.11,
)
loft(
    "High seam and collar",
    [
        (0.398, 0.085, 0.073, 0.004),
        (0.437, 0.065, 0.059, 0.004),
        (0.467, 0.055, 0.056, 0.006),
    ],
    torn,
    rib,
    36,
)
loft(
    "Slender neck",
    [
        (0.43, 0.053, 0.048, 0.005),
        (0.47, 0.046, 0.045, 0.002),
        (0.52, 0.045, 0.043, 0.005),
    ],
    limestone,
    rib,
    32,
)
for y in (0.11, 0.18, 0.25, 0.32):
    bead("Dress fastening", (0.006, y, 0.114), (0.01, 0.01, 0.009), enamel, rib, 6, 12)
for side in (-1, 1):
    thread(
        "Corset seam",
        [
            (side * 0.061, 0.02, 0.091),
            (side * 0.073, 0.177, 0.109),
            (side * 0.095, 0.276, 0.108),
            (side * 0.078, 0.378, 0.081),
        ],
        0.0035,
        torn,
        rib,
    )
bead(
    "Clerk identification",
    (-0.108, 0.292, 0.113),
    (0.047, 0.024, 0.009),
    enamel,
    rib,
    6,
    16,
)
pressed("Engraved ID", "17", (-0.107, 0.293, 0.124), 0.027, blackCalcite, rib)

head = joint("Crown", (0, 0.464, 0.013), rib)
mouth = joint("LowerLip", (0, 0, 0), head)
# Sculpt the face in anatomical height bands. Front depth is shaped with
# smaller fields for the cheekbones, eye sockets, lips and nasal bridge.
shape = [
    (0.015, 0.030, 0.043, 0.015),
    (0.027, 0.046, 0.062, 0.010),
    (0.043, 0.058, 0.070, 0.006),
    (0.060, 0.064, 0.076, 0.002),
    (0.077, 0.070, 0.077, 0),
    (0.096, 0.071, 0.077, -0.005),
    (0.113, 0.076, 0.076, -0.007),
    (0.132, 0.077, 0.076, -0.011),
    (0.153, 0.074, 0.073, -0.016),
    (0.178, 0.067, 0.064, -0.020),
    (0.198, 0.049, 0.046, -0.023),
    (0.212, 0.021, 0.024, -0.025),
    (0.218, 0.002, 0.003, -0.025),
]


def fields(x, y):
    def local_at(cx, cy, wx, wy):
        return math.exp(-(((x - cx) / wx) ** 2) - ((y - cy) / wy) ** 2)

    socket = -0.022 * local_at(abs(x), 0.111, 0.019, 0.017)
    cheek = 0.012 * local_at(abs(x), 0.081, 0.023, 0.020)
    arch = 0.009 * local_at(abs(x), 0.138, 0.022, 0.010)
    ridge = 0.016 * local_at(x, 0.103, 0.018, 0.026) + 0.029 * local_at(
        x, 0.078, 0.021, 0.011
    )
    lips = 0.009 * local_at(x, 0.052, 0.028, 0.010)
    return socket + cheek + arch + ridge + lips


def face_at(y, theta):
    for a, b in zip(shape, shape[1:]):
        if a[0] <= y <= b[0]:
            k = (y - a[0]) / (b[0] - a[0])
            w, d, z = (a[i] + k * (b[i] - a[i]) for i in (1, 2, 3))
            break
    else:
        w, d, z = shape[-1][1:]
    x = w * math.sin(theta)
    front = max(0, math.cos(theta))
    depth = z + d * math.cos(theta) + fields(x, y) * front**1.5
    return (x, y, depth)


rows = 49
sides = 64
head_verts = [
    face_at(0.015 + row * 0.203 / (rows - 1), i * math.tau / sides)
    for row in range(rows)
    for i in range(sides)
]
faces = []
for j in range(rows - 1):
    for i in range(sides):
        a = j * sides + i
        b = j * sides + (i + 1) % sides
        faces.append((a, b, b + sides, a + sides))
faces += [
    tuple(reversed(range(sides))),
    tuple(range(len(head_verts) - sides, len(head_verts))),
]
part("Facial sculpture", head_verts, faces, limestone, head)

for side in (-1, 1):
    bead(
        "Carved ear",
        (side * 0.073, 0.096, -0.007),
        (0.016, 0.029, 0.016),
        limestoneShade,
        head,
    )
    bead(
        "Eye socket",
        (side * 0.028, 0.110, 0.053),
        (0.020, 0.011, 0.009),
        limestoneShade,
        head,
    )
    bead("Stone eye", (side * 0.029, 0.110, 0.057), (0.013, 0.0067, 0.009), iris, head)
    bead(
        "Fixed dark iris",
        (side * 0.027, 0.110, 0.065),
        (0.0069, 0.0061, 0.004),
        pupil,
        head,
    )
    upper = [
        (
            side * (0.011 + j * 0.006),
            0.111 + 0.006 * math.sin(math.pi * j / 6),
            0.067 + 0.002 * math.sin(j * 0.6),
        )
        for j in range(7)
    ]
    thread("Upper lid", upper, 0.0023, limestoneShade, head)
    thread(
        "Brows thickened by soot",
        [
            (
                side * (0.012 + j * 0.006),
                0.136 + 0.005 * math.sin(j * 0.6),
                0.069 - 0.002 * j,
            )
            for j in range(7)
        ],
        0.0018,
        blackCalcite,
        head,
    )
    for j, angle in enumerate((0.36, 0.51)):
        stain = [
            face_at(
                0.104 - k * 0.009,
                side * (angle + 0.019 * k + 0.031 * math.sin(k * 0.8)),
            )
            for k in range(9)
        ]
        thread(
            "Tear channel",
            [(x, y, z + 0.0018) for x, y, z in stain],
            0.0014 + 0.0008 * j,
            tears,
            head,
        )
for x in (-0.012, 0.012):
    bead(
        "Nostril",
        (x, 0.071, 0.099),
        (0.0044, 0.002, 0.0026),
        limestoneShade,
        head,
        6,
        12,
    )
thread(
    "Tight upper lip",
    [
        (-0.024, 0.054, 0.076),
        (-0.013, 0.056, 0.082),
        (0, 0.054, 0.087),
        (0.010, 0.057, 0.083),
        (0.024, 0.053, 0.075),
    ],
    0.0023,
    lip,
    head,
)
thread(
    "Dark hollow between lips",
    [
        (-0.022, 0.052, 0.075),
        (-0.009, 0.050, 0.085),
        (0, 0.050, 0.087),
        (0.010, 0.05, 0.084),
        (0.022, 0.052, 0.074),
    ],
    0.0026,
    pupil,
    head,
)
thread(
    "Lower lip",
    [(-0.019, 0.049, 0.077), (0, 0.045, 0.085), (0.019, 0.049, 0.077)],
    0.0023,
    lip,
    mouth,
)
for path in [
    [(0.205, -0.41), (0.18, -0.47), (0.162, -0.58), (0.141, -0.53), (0.127, -0.64)],
    [(0.158, -0.54), (0.148, -0.38), (0.137, -0.32)],
    [(0.094, 0.92), (0.075, 0.87), (0.064, 0.78), (0.056, 0.86), (0.042, 0.69)],
]:
    thread(
        "Hairline fracture",
        [(x, y, z + 0.002) for x, y, z in (face_at(y, ang) for y, ang in path)],
        0.00145,
        limestoneShade,
        head,
    )

# Scalp sections sweep from the centre part into a three-strand side braid.
strands = 36
verts = []
for j in range(19):
    k = j / 18
    for i in range(strands):
        th = i * math.tau / strands
        forehead = 0.162 + 0.024 * math.cos(th) - 0.055 * max(0, -math.cos(th))
        y = forehead + (0.222 - forehead) * math.sin(k * math.pi / 2)
        x, y, z = face_at(min(0.2178, y), th)
        rise = 0.011 + (math.cos(th * 13 + k * 6) ** 8) * 0.005
        verts.append((x + math.sin(th) * rise, y + 0.004, z + math.cos(th) * rise))
faces = []
for j in range(18):
    for i in range(strands):
        a = j * strands + i
        b = j * strands + (i + 1) % strands
        faces.append((a, b, b + strands, a + strands))
part("Carved swept scalp", verts, faces, blackCalcite, head)
for strand in range(3):
    path = []
    for k in range(64):
        t = k / 63
        a = math.tau * strand / 3 + t * math.pi * 13
        r = 0.015 * (1 - 0.53 * t)
        path.append(
            (
                -0.055 - 0.069 * t + r * math.sin(a),
                0.111 - 0.391 * t,
                -0.043 + 0.12 * t + r * math.cos(a),
            )
        )
    thread("Long carved braid", path, 0.013 - (strand * 0.0009), blackCalcite, head)
for y in (-0.22, -0.239):
    bead("Braid tie", (-0.115, y, 0.067), (0.018, 0.008, 0.017), enamel, head, 6, 12)

for side, name in [(-1, "L"), (1, "R")]:
    shoulder = joint("Shoulder_" + name, (side * 0.157, 0.347, -0.002), rib)
    elbow = joint("Elbow_" + name, (side * 0.016, -0.255, 0.003), shoulder)
    palm = joint("Palm_" + name, (0, -0.247, 0.002), elbow)
    loft(
        "Tapered stone sleeve",
        [
            (-0.268, 0.039, 0.038, 0),
            (-0.225, 0.042, 0.045, 0),
            (-0.152, 0.049, 0.054, 0),
            (-0.074, 0.061, 0.060, 0),
            (0.024, 0.065, 0.055, 0),
            (0.068, 0.026, 0.029, 0),
        ],
        dress,
        shoulder,
        36,
        0.075,
    )
    loft(
        "Lower sleeve",
        [
            (-0.249, 0.031, 0.030, 0),
            (-0.192, 0.035, 0.035, 0),
            (-0.084, 0.044, 0.041, 0),
            (0.026, 0.046, 0.046, 0),
        ],
        dress,
        elbow,
        32,
        0.06,
    )
    loft(
        "Cuff", [(-0.246, 0.034, 0.031, 0), (-0.229, 0.037, 0.034, 0)], torn, elbow, 28
    )
    bead("Hand", (0, -0.032, 0.006), (0.033, 0.048, 0.021), limestone, palm)
    for i in range(4):
        x = (i - 1.5) * 0.017
        length = 0.064 - 0.004 * abs(i - 1)
        thread(
            "Stone finger",
            [
                (x, -0.055, 0.010),
                (x, -0.055 - length * 0.65, 0.017),
                (x * 0.91, -0.055 - length, 0.031),
            ],
            0.0085,
            limestone,
            palm,
        )
    thread(
        "Thumb",
        [
            (side * 0.025, -0.03, 0.006),
            (side * 0.044, -0.060, 0.019),
            (side * 0.04, -0.078, 0.031),
        ],
        0.010,
        limestone,
        palm,
    )

joint("WingAnchor", (0, 0.225, -0.086), rib)
# Orthographic views in the editable source open at the statue's scale.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_distance = 3.65
            area.spaces.active.region_3d.view_location = (0, 0, 0.97)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(ROOT / "art/blender/mourning-clerk.blend"), compress=True
)

# Weld the renderable pieces per material and joint while retaining the
# individually sculpted source curves, mesh rings and pivots in the .blend.
bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
parts = {}
for source in list(sculpt.objects):
    if source.type == "EMPTY":
        continue
    evaluated = source.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    material = source.data.materials[0]
    vertices, faces, smooth = parts.setdefault((source.parent, material), ([], [], []))
    offset = len(vertices)
    vertices.extend(source.matrix_basis @ v.co for v in mesh.vertices)
    faces.extend(tuple(offset + i for i in poly.vertices) for poly in mesh.polygons)
    smooth.extend(poly.use_smooth for poly in mesh.polygons)
    evaluated.to_mesh_clear()
for source in list(sculpt.objects):
    if source.type != "EMPTY":
        bpy.data.objects.remove(source, do_unlink=True)
for (parent, material), (vertices, faces, smooth) in parts.items():
    mesh = bpy.data.meshes.new(parent.name + " " + material.name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for poly, s in zip(mesh.polygons, smooth):
        poly.use_smooth = s
    mesh.materials.append(material)
    obj = bpy.data.objects.new(mesh.name, mesh)
    sculpt.objects.link(obj)
    obj.parent = parent
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "dist/3d/assets/creature/mourning-clerk.glb"),
    export_format="GLB",
    export_yup=True,
    export_cameras=False,
    export_lights=False,
)
