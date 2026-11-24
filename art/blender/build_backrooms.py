"""Build Records Annex modular scenery, export glTF and render Classic's atlas in Cycles.

Blender 4.5 LTS: blender -b -t 4 --python-exit-code 1 -P art/blender/build_backrooms.py
Units are metres. A prop's local -Y faces the viewer, its finished floor is Z=0.
"""

import math
import tempfile
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
TMP = tempfile.TemporaryDirectory(prefix="last-light-annex-art-")
WORK = Path(TMP.name)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


def linear(rgb):
    v = np.asarray(rgb, dtype=float) / 255
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def mat(name, color, rough=0.55, metal=0, emission=0):
    c = [*linear(list(bytes.fromhex(color))), 1]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = c
    node = m.node_tree.nodes.get("Principled BSDF")
    for key, value in [
        ("Base Color", c),
        ("Roughness", rough),
        ("Metallic", metal),
        ("Emission Color", c),
        ("Emission Strength", emission),
    ]:
        node.inputs[key].default_value = value
    return m


ivory = mat("Warm chipped enamel", "c0b99a", 0.54, 0.22)
ink = mat("Deep patinated frame", "363d39", 0.55, 0.45)
steel = mat("Brushed galvanized steel", "9aa4a0", 0.32, 0.76)
brass = mat("Worn brass corners", "b49a58", 0.36, 0.68)
black = mat("Soft rubber and bakelite", "343b36", 0.81)
paper = mat("Manila folders", "bd9c63", 0.89)
red = mat("Oxide red equipment enamel", "995744", 0.46, 0.22)
edge = mat("Aged amber reflector", "ebc56d", 0.34, 0.15)
wood = mat("Lacquered drawer front", "857158", 0.54)
chalk = mat("Letterpress ink", "eee4bd", 0.65)
glass = mat("Opal phosphate glass", "f9f1c0", 0.28, 0, 2)
green = mat("Emergency phosphor", "b2e7c1", 0.38, 0, 1.6)
exitgreen = mat("Enamel escape route sign", "276455", 0.39, 0.22)
darkpaper = mat("Buff card end grain", "8e7956", 0.9)
damp = mat("Damp oxidised fibre", "554e3d", 0.31)
tape = mat("Red cloth binding", "8c5343", 0.82)


# Seamless figured wallpaper, woven carpet and pressed acoustic fibre. These
# PBR images are packed into the editable file and into the runtime glTF.
def surface(name, kind):
    N = 384
    y, x = np.mgrid[:N, :N]
    u = x / N
    v = y / N
    tau = 2 * np.pi
    rng = np.random.default_rng(901 + kind)
    if kind == 0:
        petals = np.cos(4 * tau * u + 0.92 * np.cos(4 * tau * v))
        leaves = np.cos(4 * tau * v + 0.76 * np.cos(4 * tau * u))
        pattern = np.exp(-(((petals * leaves - 0.19) / 0.19) ** 2))
        weave = 2 * np.sin(96 * tau * v) + 1.8 * np.cos(128 * tau * u)
        patina = 4 * np.sin(tau * (u + v)) + 3 * np.sin(tau * (3 * u - 2 * v))
        value = weave + patina - pattern * 24 + rng.normal(0, 1.65, (N, N))
        base = [180, 161, 106]
        scale = [1, 0.91, 0.66]
        height = 0.56 + 0.2 * pattern + 0.07 * np.sin(96 * tau * v)
        rough = 0.86 - 0.07 * pattern
    elif kind == 1:
        warp = np.where((np.floor(v * 12) % 2) == 0, 1, -1)
        rib = np.sin(tau * (u * 96 + warp * v * 32))
        cross = np.sin(tau * (u * 48 - v * 80))
        value = (
            rib * 9
            + cross * 4
            + 0.6 * rib * cross
            + 4 * np.sin(tau * (3 * u + v))
            + rng.normal(0, 3.1, (N, N))
        )
        base = [110, 100, 74]
        scale = [1, 0.93, 0.8]
        height = 0.5 + 0.16 * rib + 0.07 * cross
        rough = 0.83 + rib * 0.09
    else:
        pits = rng.random((N, N))
        pores = np.minimum(pits, np.roll(pits, 1, axis=1)) < 0.011
        value = 3 * np.sin(2 * tau * (u + v)) + rng.normal(0, 4, (N, N)) - pores * 58
        base = [184, 178, 152]
        scale = [1, 0.96, 0.86]
        height = 0.58 - pores * 0.28
        rough = 0.92 - np.zeros_like(x)
    rgb = np.clip(np.array(base)[None, None, :] + value[:, :, None] * scale, 0, 255)

    def packed(label, array, noncolor=False):
        rgba = np.ones((N, N, 4), dtype=np.float32)
        rgba[:, :, :3] = array
        im = bpy.data.images.new(name + " " + label, width=N, height=N, alpha=False)
        if noncolor:
            im.colorspace_settings.name = "Non-Color"
        im.pixels.foreach_set(rgba.ravel())
        im.filepath_raw = str(WORK / (name + "-" + label + ".png"))
        im.file_format = "PNG"
        im.save()
        im.pack()
        return im

    m = mat(name, "ffffff", 0.8)
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    shader = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = packed("dye", linear(rgb))
    links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    rough_tex = nodes.new("ShaderNodeTexImage")
    rough_tex.image = packed("roughness", np.repeat(rough[:, :, None], 3, axis=2), True)
    links.new(rough_tex.outputs["Color"], shader.inputs["Roughness"])
    nx = (np.roll(height, 1, 1) - np.roll(height, -1, 1)) * 0.85
    ny = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) * 0.85
    normals = np.stack([nx, ny, np.ones_like(nx)], axis=2)
    normals /= np.linalg.norm(normals, axis=2, keepdims=True)
    bump = nodes.new("ShaderNodeTexImage")
    bump.image = packed("grain", normals * 0.5 + 0.5, True)
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.8
    links.new(bump.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    return m


wallpaper = surface("Gilt sprig wallcovering", 0)
carpet = surface("Flax herringbone runner", 1)
ceiling = surface("Acoustic fibre tile", 2)

models = {}
cur = None


def model(name):
    global cur
    cur = bpy.data.collections.new(name)
    scene.collection.children.link(cur)
    models[name] = cur


def mesh(name, verts, faces, material, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    cur.objects.link(o)
    data.materials.append(material)
    uv = data.uv_layers.new(name="Metre weave")
    size = 1.2 if material == wallpaper else 0.8
    for poly in data.polygons:
        axis = int(np.argmax(np.abs(poly.normal[:])))
        dims = [(1, 2), (0, 2), (0, 1)][axis]
        for i in poly.loop_indices:
            co = data.vertices[data.loops[i].vertex_index].co
            uv.data[i].uv = (co[dims[0]] / size, co[dims[1]] / size)
    if bevel:
        mod = o.modifiers.new("Rolled machine edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.harden_normals = True
        norm = o.modifiers.new("Weighted panel normals", "WEIGHTED_NORMAL")
        norm.keep_sharp = True
    return o


def box(name, c, dim, m, bevel=0.007):
    v = [
        tuple(c[k] + p[k] * dim[k] / 2 for k in range(3))
        for p in [
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
    return mesh(
        name,
        v,
        [
            (3, 2, 1, 0),
            (4, 5, 6, 7),
            (0, 1, 5, 4),
            (1, 2, 6, 5),
            (2, 3, 7, 6),
            (3, 0, 4, 7),
        ],
        m,
        min(bevel, min(dim) * 0.23),
    )


def tube(name, a, b, r, m, n=12):
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    side = axis.cross(
        Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((0, 1, 0))
    ).normalized()
    other = axis.cross(side)
    v = [
        p + (side * math.cos(i * math.tau / n) + other * math.sin(i * math.tau / n)) * r
        for p in (a, b)
        for i in range(n)
    ]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    return mesh(name, v, faces, m)


def label(name, text, c, size, m):
    f = bpy.data.curves.new(name, "FONT")
    f.body = text
    f.size = size
    f.align_x = "CENTER"
    f.align_y = "CENTER"
    f.extrude = 0.0004
    f.resolution_u = 3
    o = bpy.data.objects.new(name, f)
    cur.objects.link(o)
    o.location = c
    o.rotation_euler.x = math.pi / 2
    f.materials.append(m)
    return o


def strut(name, a, b, width, depth, material):
    axis = Vector(b) - Vector(a)
    length = axis.length
    o = box(name, (0, 0, 0), (width, depth, length), material, 0.003)
    o.location = (Vector(a) + Vector(b)) / 2
    o.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    return o


def bolt(name, x, y, z, r=0.015):
    return tube(name, (x, y, z), (x, y - 0.012, z), r, steel, 8)


def plate(name, text, c, w, h, back, writing, size):
    x, y, z = c
    box(name, c, (w, 0.024, h), back)
    label(name + " lettering", text, (x, y - 0.015, z), size, writing)
    for s in (-1, 1):
        bolt("Fastener", x + s * (w / 2 - 0.038), y - 0.011, z, 0.009)


model("wall")
box("Wallpaper on plaster", (0, 0.045, 1.65), (4.8, 0.09, 3.3), wallpaper, 0.002)
for z, depth, h, m in [
    (0.064, 0.061, 0.128, ink),
    (0.158, 0.048, 0.058, wood),
    (0.2, 0.034, 0.028, brass),
    (1.01, 0.033, 0.065, wood),
    (1.054, 0.024, 0.014, brass),
    (3.26, 0.044, 0.08, ivory),
]:
    box("Skirting and chair rail", (0, -depth / 2, z), (4.8, depth, h), m, 0.004)
for x in (-2.395, 0, 2.395):
    box("Wallcovering lap", (x, -0.0022, 1.73), (0.009, 0.005, 3.03), darkpaper, 0.001)
box("Switched outlet", (0.46, -0.021, 0.38), (0.128, 0.037, 0.105), ivory)
for x in (0.434, 0.486):
    for d in (-0.009, 0.009):
        box("Outlet recess", (x + d, -0.041, 0.38), (0.005, 0.005, 0.025), ink, 0)
model("carpet")
box("Cut carpet tile", (0, 0, -0.037), (2.4, 2.4, 0.074), carpet, 0.002)
model("ceiling")
box("Suspended divider grid", (0, 0, 0.025), (2.4, 2.4, 0.05), ivory, 0.002)
for x in (-0.6, 0.6):
    for y in (-0.9, -0.3, 0.3, 0.9):
        box(
            "Recessed acoustic tile",
            (x, y, -0.003),
            (1.19, 0.588, 0.023),
            ceiling,
            0.002,
        )
model("troffer")
box("Pressed back pan", (0, 0, 0.116), (1.26, 0.48, 0.091), ink, 0.018)
box("Ballast housing", (0, 0, 0.084), (1.23, 0.46, 0.065), ivory, 0.018)
for y in (-0.208, 0.208):
    box("Reflector flange", (0, y, 0.045), (1.24, 0.035, 0.087), steel)
for x in (-0.596, 0.596):
    box("End caps", (x, 0, 0.045), (0.038, 0.45, 0.085), ivory)
for y in (-0.107, 0.107):
    tube("Opal fluorescent tube", (-0.55, y, 0.042), (0.55, y, 0.042), 0.024, glass, 16)
    for x in (-0.561, 0.561):
        box("Porcelain lampholder", (x, y, 0.057), (0.041, 0.081, 0.075), ivory)
for x in np.linspace(-0.49, 0.49, 11):
    box("Anti-glare cross baffle", (x, 0, 0.026), (0.012, 0.398, 0.056), steel, 0.002)
model("barrier")
for s in (-1, 1):
    x = s * 0.76
    for d in (-1, 1):
        strut(
            "Folding support",
            (x + d * 0.035, 0, 0.61),
            (x + d * 0.08, d * 0.26, 0.038),
            0.055,
            0.048,
            red,
        )
        box("Rubber shoe", (x + d * 0.08, d * 0.26, 0.025), (0.12, 0.1, 0.05), black)
    bolt("Pivot washer", x, -0.068, 0.53, 0.03)
box("Barricade plank", (0, -0.045, 0.5), (1.91, 0.087, 0.23), edge, 0.016)
for x in np.linspace(-0.72, 0.66, 6):
    mesh(
        "Diagonal reflective tape",
        [
            (x - 0.12, -0.090, 0.397),
            (x + 0.018, -0.090, 0.397),
            (x + 0.176, -0.090, 0.604),
            (x + 0.039, -0.090, 0.604),
        ],
        [(0, 1, 2, 3)],
        ink,
    )
box("Foot rail", (0, 0.048, 0.205), (1.60, 0.057, 0.045), steel)
plate(
    "Service stencil", "SERVICE", (0.08, -0.11, 0.496), 0.34, 0.121, ivory, ink, 0.072
)
model("cart")
for x in (-0.53, 0.53):
    for y in (-0.28, 0.28):
        tube(
            "Grey caster",
            (x - 0.038, y, 0.085),
            (x + 0.038, y, 0.085),
            0.078,
            black,
            14,
        )
        box("Swivel fork", (x, y, 0.166), (0.077, 0.058, 0.12), steel)
        tube("Upright", (x, y, 0.18), (x, y, 1.045), 0.021, steel)
for z in (0.22, 0.64, 0.98):
    box("Lipped cart shelf", (0, 0, z), (1.17, 0.65, 0.047), red, 0.015)
    for y in (-0.316, 0.316):
        box("Folded rim", (0, y, z + 0.034), (1.16, 0.022, 0.064), red)
for i, (x, y, w, h) in enumerate(
    [
        (-0.28, -0.03, 0.39, 0.26),
        (0.22, 0.03, 0.43, 0.31),
        (-0.23, -0.06, 0.50, 0.19),
        (0.29, 0.025, 0.39, 0.22),
    ]
):
    z = 0.242 if i < 2 else 0.662
    box("Boxboard archive crate", (x, y, z + h / 2), (w, 0.406, h), paper, 0.009)
    box("Lift-off lid", (x, y, z + h - 0.016), (w + 0.014, 0.42, 0.043), darkpaper)
    box("Linen tag", (x, y - 0.205, z + h * 0.52), (0.17, 0.006, 0.076), chalk, 0.001)
    box("Tag rule", (x, y - 0.21, z + h * 0.52), (0.112, 0.004, 0.011), ink, 0)
for y in (-0.27, 0.27):
    tube("Handle upstand", (0.54, y, 1.01), (0.64, y, 1.14), 0.018, steel)
tube("Push bar", (0.64, -0.29, 1.14), (0.64, 0.29, 1.14), 0.026, black)
model("cabinet")
box("Welded chassis", (0, 0.02, 0.91), (0.82, 0.52, 1.82), ink, 0.02)
box("Enamel top", (0, 0.02, 1.81), (0.83, 0.54, 0.035), ivory)
for i in range(4):
    z = 0.31 + i * 0.413
    box("Drawer front", (0, -0.253, z), (0.772, 0.041, 0.386), wood, 0.013)
    plate(
        "Index bracket",
        f"{17+i:02d}",
        (0, -0.28, z + 0.06),
        0.205,
        0.085,
        brass,
        ink,
        0.058,
    )
    for x in (-0.08, 0.08):
        tube(
            "Handle return", (x, -0.28, z - 0.066), (x, -0.323, z - 0.066), 0.012, brass
        )
    tube(
        "Drawer pull",
        (-0.085, -0.323, z - 0.066),
        (0.085, -0.323, z - 0.066),
        0.014,
        brass,
    )
model("grille")
box("Return-air shadow", (0, 0, 0), (0.82, 0.035, 0.43), ink)
for z in (-0.227, 0.227):
    box("Mounting flange", (0, -0.027, z), (0.90, 0.022, 0.039), steel)
for x in (-0.435, 0.435):
    box("Mounting flange", (x, -0.027, 0), (0.035, 0.022, 0.481), steel)
for z in np.linspace(-0.18, 0.18, 10):
    strut("Pressed louvre", (-0.395, -0.034, z), (0.395, -0.034, z), 0.033, 0.03, ivory)
for x in (-0.427, 0.427):
    for z in (-0.21, 0.21):
        bolt("Captive screw", x, -0.042, z, 0.009)
model("door")
box("Painted fire door", (0, 0.02, 1.09), (1.18, 0.085, 2.18), wood, 0.014)
for x in (-0.637, 0.637):
    box("Rolled steel jamb", (x, 0, 1.145), (0.095, 0.16, 2.29), ink)
box("Lintel", (0, 0, 2.24), (1.37, 0.16, 0.106), ink)
box("Kick plate", (0, -0.027, 0.195), (1.16, 0.016, 0.38), steel)
box("Wired vision frame", (0.24, -0.039, 1.62), (0.33, 0.044, 0.64), brass)
box("Wired vision glass", (0.24, -0.065, 1.62), (0.267, 0.011, 0.57), black)
for i in range(-2, 3):
    box("Wired mesh", (0.24 + i * 0.05, -0.074, 1.62), (0.003, 0.003, 0.56), steel, 0)
for i in range(-5, 6):
    box("Wired mesh", (0.24, -0.074, 1.62 + i * 0.05), (0.263, 0.003, 0.003), steel, 0)
box("Panic bar", (0, -0.093, 0.95), (0.925, 0.11, 0.071), brass, 0.015)
plate("File range", "B  /  17", (-0.31, -0.042, 1.61), 0.44, 0.176, ivory, ink, 0.088)
model("pipes")
for i in range(3):
    z = i * 0.18 + 0.08
    tube(
        "Pipe section",
        (-1.15, 0, z),
        (1.15, 0, z),
        0.056,
        steel if i == 2 else wood,
        16,
    )
    for x in (-0.8, 0.75):
        tube("Coupler", (x - 0.041, 0, z), (x + 0.041, 0, z), 0.071, ink, 16)
for x in (-0.78, 0.76):
    box("Channel support", (x, 0.05, 0.285), (0.063, 0.072, 0.65), red)
model("exit")
box("Lightbox", (0, 0, 0), (1.16, 0.19, 0.363), ink, 0.025)
box("Silk screened diffuser", (0, -0.101, 0), (1.10, 0.026, 0.306), exitgreen, 0.018)
label("Exit legend", "EXIT   >", (0, -0.12, 0.013), 0.19, green)
model("rack")
for x in (-0.73, 0.73):
    for y in (-0.265, 0.265):
        box("Cold formed upright", (x, y, 0.985), (0.048, 0.048, 1.97), steel)
        for z in np.linspace(0.35, 1.8, 7):
            box("Keyhole", (x, y - 0.026, z), (0.012, 0.003, 0.038), ink, 0)
for z in (0.085, 0.65, 1.24, 1.9):
    box("Shelf pan", (0, 0, z), (1.51, 0.57, 0.045), ivory)
    if z > 1.8:
        continue
    for i in range(3):
        x = (i - 1) * 0.456 + 0.014 * math.sin(z * 8)
        h = 0.31 + 0.11 * ((i + int(z * 20)) % 3) / 2
        box(
            "Storage carton",
            (x, 0, z + 0.025 + h / 2),
            (0.427, 0.499, h),
            paper if i != 1 else darkpaper,
        )
        box(
            "Binding tape",
            (x + 0.059, -0.251, z + 0.025 + h / 2),
            (0.035, 0.004, h),
            tape,
            0,
        )
        box("Lid edge", (x, 0, z + h + 0.018), (0.434, 0.505, 0.045), darkpaper)
        box(
            "Collection label",
            (x - 0.054, -0.252, z + 0.17),
            (0.146, 0.004, 0.071),
            chalk,
            0,
        )
strut("Back sway brace", (-0.71, 0.273, 0.1), (0.71, 0.273, 1.88), 0.032, 0.016, steel)
model("bridge")
box("Inspection decking", (0, 0, -0.057), (2.4, 1.2, 0.114), ink, 0.009)
for x in np.linspace(-1.15, 1.15, 19):
    box("Serrated grip bar", (x, 0, 0.002), (0.067, 1.18, 0.012), steel, 0.002)
for y in (-0.573, 0.573):
    box("Edge marking", (0, y, 0.009), (2.4, 0.043, 0.007), edge, 0.001)

# Mechanical, paper and drainage fittings shared with the three ordinary floors.
model("steamtrap")
for x in (-0.59, 0.57):
    box("Anchored pedestal", (x, 0.02, 0.23), (0.135, 0.28, 0.46), ink)
    box("Bolted foot", (x, 0.02, 0.034), (0.29, 0.38, 0.068), wood)
    tube("Return main", (x - 0.18, 0, 0.48), (x + 0.18, 0, 0.48), 0.087, brass, 24)
for x in (-0.39, 0.37):
    tube("Gasket flange", (x - 0.034, 0, 0.48), (x + 0.034, 0, 0.48), 0.154, steel, 28)
    for i in range(8):
        a = i * math.tau / 8
        y = 0.12 * math.cos(a)
        z = 0.48 + 0.12 * math.sin(a)
        tube("Hex flange nut", (x - 0.045, y, z), (x + 0.045, y, z), 0.018, ink, 6)
tube("Cast float chamber", (0, 0, 0.26), (0, 0, 0.62), 0.24, red, 32)
tube("Bolted chamber cover", (0, 0, 0.59), (0, 0, 0.654), 0.27, ink, 32)
for i in range(8):
    a = i * math.tau / 8
    x = 0.233 * math.cos(a)
    y = 0.233 * math.sin(a)
    tube("Cover stud", (x, y, 0.646), (x, y, 0.672), 0.022, brass, 6)
tube("Sight glass stem", (0.03, 0, 0.65), (0.03, 0, 0.93), 0.037, brass)
tube("Manometer rim", (0.03, 0.02, 1.05), (0.03, -0.045, 1.05), 0.143, ink, 32)
tube("Cream dial", (0.03, -0.046, 1.05), (0.03, -0.052, 1.05), 0.122, chalk, 32)
for i in range(11):
    a = (i * 24 - 120) * math.pi / 180
    strut(
        "Dial graduation",
        (0.03 + 0.095 * math.sin(a), -0.056, 1.05 + 0.095 * math.cos(a)),
        (0.03 + 0.112 * math.sin(a), -0.056, 1.05 + 0.112 * math.cos(a)),
        0.006,
        0.006,
        ink,
    )
strut(
    "Pressure needle", (0.03, -0.064, 1.05), (-0.033, -0.064, 1.122), 0.007, 0.007, red
)
plate("Trap number", "T  /  07", (0, -0.248, 0.44), 0.28, 0.094, brass, ink, 0.049)

model("ticketcase")
box("Cabinet back", (0, 0.10, 0.58), (1.07, 0.06, 1.16), wood, 0.013)
for x in (-0.535, 0.535):
    box("Hemmed side plate", (x, -0.01, 0.58), (0.035, 0.26, 1.16), ink)
for z in (0.025, 1.14):
    box("Case rim", (0, -0.014, z), (1.11, 0.27, 0.048), brass)
for row in range(4):
    shelf = 0.082 + row * 0.247
    box("Sloping pigeonhole lip", (0, -0.119, shelf), (1.04, 0.045, 0.105), wood)
    for col in range(3):
        x = (col - 1) * 0.346
        box(
            "Pocket partition",
            (x - 0.167, -0.01, shelf + 0.057),
            (0.014, 0.24, 0.18),
            brass,
        )
        if (row, col) not in [(3, 2), (1, 0)]:
            for leaf in range(3):
                box(
                    "Dog-eared transfer slip",
                    (
                        x + 0.007 * leaf,
                        -0.018 - 0.016 * leaf,
                        shelf + 0.087 - 0.009 * leaf,
                    ),
                    (0.219, 0.012, 0.218),
                    chalk if leaf % 2 else paper,
                    0.002,
                )
            for line in range(3):
                box(
                    "Carbon copy ruling",
                    (x, -0.059, shelf + 0.126 + line * 0.017),
                    (0.145 - line * 0.016, 0.003, 0.004),
                    darkpaper,
                    0,
                )
        box("Brass label frame", (x, -0.145, shelf), (0.13, 0.01, 0.05), brass)
        label(
            "Pocket number",
            str(1 + 3 * row + col).zfill(2),
            (x, -0.153, shelf),
            0.033,
            ink,
        )
plate("Dispatch name", "OUTGOING", (0, -0.125, 1.055), 0.54, 0.112, ivory, ink, 0.078)

model("rainhead")
# The hopper hangs from a roof-plant curb. A scupper empties the shallow
# coping above its basket so that both the brackets and drain have a source.
box("Plant curb", (0, .48, .98), (1.73, .48, 1.96), wood, .014)
box("Galvanized coping", (0, .46, 1.975), (1.81, .59, .067), steel, .009)
box("Raised plinth", (0, .48, .08), (1.80, .56, .16), ink)
for x in (-.81, -.41, 0, .41, .81):
    box("Standing seam", (x, .233, 1.05), (.031, .035, 1.76), brass, .004)
for x in (-.61, .61):
    for z in (.31, 1.41):
        box("Mounting tab", (x, .215, z), (.24, .083, .069), steel)
box("Scupper sole", (0, .055, 1.77), (.39, .42, .029), steel)
for x in (-.187, .187):
    box("Folded scupper lip", (x, .055, 1.819), (.023, .42, .111), steel)
box("Scupper mouth", (0, .217, 1.838), (.34, .018, .113), ink)
for x in (-0.54, 0.54):
    box("Riveted mounting strap", (x, 0.18, 0.88), (0.072, 0.073, 1.45), ink)
    for z in (0.31, 1.41):
        bolt("Strap rivet", x, 0.12, z, 0.033)
# Open hopper throat, rolled folds and tapered outlet.
upper = [
    (-0.64, -0.3, 1.59),
    (0.64, -0.3, 1.59),
    (0.64, 0.23, 1.59),
    (-0.64, 0.23, 1.59),
]
lower = [
    (-0.12, -0.11, 0.96),
    (0.12, -0.11, 0.96),
    (0.12, 0.06, 0.96),
    (-0.12, 0.06, 0.96),
]
for i in range(4):
    j = (i + 1) % 4
    mesh(
        "Folded zinc hopper",
        [upper[i], upper[j], lower[j], lower[i]],
        [(0, 1, 2, 3)],
        steel,
    )
    strut("Folded edge", upper[i], upper[j], 0.037, 0.028, ivory)
    strut("Soldered seam", upper[i], lower[i], 0.017, 0.018, brass)
for x in np.linspace(-0.5, 0.5, 11):
    strut(
        "Removable leaf grille", (x, -0.267, 1.54), (x, 0.195, 1.54), 0.02, 0.017, ink
    )
tube("Rainwater downpipe", (0, 0, 0.97), (0, 0, 0.27), 0.119, steel, 24)
tube("Cast collar", (0, 0, 0.43), (0, 0, 0.51), 0.134, ink, 24)
tube("Outlet elbow", (0, 0, 0.29), (0, -0.167, 0.17), 0.117, steel, 24)
tube("Outlet shoe", (0, -0.145, 0.179), (0, -0.32, 0.135), 0.116, steel, 24)
tube("Shadow inside outlet", (0, -0.323, 0.134), (0, -0.329, 0.132), 0.103, ink, 22)
for x, z in [(-0.26, 1.46), (0.28, 1.37), (0.18, 1.28)]:
    strut(
        "Oxidised water trail",
        (x, -0.296 + (1.59 - z) * 0.28, z),
        (x * 0.74, -0.296 + (1.69 - z) * 0.28, z - 0.1),
        0.018,
        0.006,
        wood,
    )
plate(
    "Inspection tag", "R  /  03", (-0.28, -0.265, 1.47), 0.24, 0.08, ivory, ink, 0.042
)

# Export welded draw meshes while retaining the separately editable source parts.
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
exports = []
export_parts = {name: list(group.objects) for name, group in models.items()}
door_parts = export_parts["door"]
export_parts["doorframe"] = [
    part for part in door_parts if part.name.startswith(("Rolled steel jamb", "Lintel"))
]
export_parts["doorleaf"] = [
    part for part in door_parts if part not in export_parts["doorframe"]
]
for key, parts in export_parts.items():
    verts = []
    polys = []
    uvs = []
    mats = []
    indices = []
    for o in parts:
        ev = o.evaluated_get(dg)
        g = ev.to_mesh()
        base = len(verts)
        verts += [ev.matrix_world @ v.co for v in g.vertices]
        uv = g.uv_layers.active
        for face in g.polygons:
            polys.append([base + i for i in face.vertices])
            m = g.materials[face.material_index]
            if m not in mats:
                mats.append(m)
            indices.append(mats.index(m))
            uvs.extend(
                [(uv.data[i].uv[:] if uv else (0, 0)) for i in face.loop_indices]
            )
        ev.to_mesh_clear()
    g = bpy.data.meshes.new("Welded " + key)
    g.from_pydata(verts, [], polys)
    g.update()
    for m in mats:
        g.materials.append(m)
    g.polygons.foreach_set("material_index", indices)
    g.uv_layers.new(name="UVMap").data.foreach_set(
        "uv", np.asarray(uvs, dtype="f").ravel()
    )
    out = bpy.data.objects.new("Annex_" + key, g)
    scene.collection.objects.link(out)
    exports.append(out)
bpy.ops.object.select_all(action="DESELECT")
floor_fittings = {"Annex_steamtrap", "Annex_ticketcase", "Annex_rainhead"}
for o in exports:
    if o.name in floor_fittings:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.export_scene.gltf(
            filepath=str(ROOT / "dist/3d/assets/env" / (o.name[6:] + ".glb")),
            use_selection=True,
            export_format="GLB",
            export_materials="EXPORT",
            export_lights=False,
            export_cameras=False,
            export_yup=True,
        )
        o.select_set(False)
for o in exports:
    o.select_set(o.name not in floor_fittings)
bpy.context.view_layer.objects.active = exports[0]
target = ROOT / "dist/3d/assets/env/backrooms-annex.glb"
bpy.ops.export_scene.gltf(
    filepath=str(target),
    use_selection=True,
    export_format="GLB",
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
for o in exports:
    bpy.data.objects.remove(o, do_unlink=True)


# The side-view game uses true orthographic views with physical area lights.
def area(name, p, energy, color, size):
    l = bpy.data.lights.new(name, "AREA")
    l.energy = energy
    l.color = color
    l.shape = "DISK"
    l.size = size
    o = bpy.data.objects.new(name, l)
    scene.collection.objects.link(o)
    o.location = p
    o.rotation_euler = (
        (Vector((0, 0, 0.7)) - o.location).to_track_quat("-Z", "Y").to_euler()
    )
    return o


world = bpy.data.worlds.new("Bounce off buff plaster")
world.use_nodes = True
world.node_tree.nodes.get("Background").inputs[0].default_value = (0.49, 0.53, 0.46, 1)
world.node_tree.nodes.get("Background").inputs[1].default_value = 0.53
scene.world = world
area("Northwest softbox", (-3.4, -4.4, 5.1), 580, (1, 0.88, 0.71), 4.2)
area("Cool corridor return", (3, 1, 2.6), 225, (0.7, 0.88, 1), 2.6)
cam = bpy.data.cameras.new("Archive elevation")
cam.type = "ORTHO"
eye = bpy.data.objects.new("Orthographic camera", cam)
scene.collection.objects.link(eye)
scene.camera = eye
atlas = np.zeros((4 * 128, 4 * 192, 4), dtype=np.float32)
keys = [
    "troffer",
    "cart",
    "barrier",
    "cabinet",
    "door",
    "grille",
    "wall",
    "carpet",
    "pipes",
    "exit",
    "rack",
    "bridge",
    "steamtrap",
    "ticketcase",
    "rainhead",
]
scene.render.resolution_x = 384
scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
for index, key in enumerate(keys):
    for k, col in models.items():
        col.hide_render = k != key
    bounds = [
        o.matrix_world @ Vector(v) for o in models[key].objects for v in o.bound_box
    ]
    points = np.asarray([v[:] for v in bounds])
    origin = Vector((np.min(points, axis=0) + np.max(points, axis=0)) / 2)
    direction = Vector((0.28, -1, 0.23))
    if key == "troffer":
        direction = Vector((0.17, -1, -0.46))
    if key in ("wall", "grille", "exit", "pipes"):
        direction = Vector((0, -1, 0))
    if key == "carpet":
        direction = Vector((0, -0.001, 1))
    eye.location = origin + direction.normalized() * 6
    eye.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    (
        scene.view_layers.update()
        if hasattr(scene.view_layers, "update")
        else bpy.context.view_layer.update()
    )
    inv = eye.matrix_world.inverted()
    coords = [inv @ v for v in bounds]
    cam.ortho_scale = 1.045 * max(
        max(v.x for v in coords) - min(v.x for v in coords),
        (max(v.y for v in coords) - min(v.y for v in coords)) * 1.5,
        0.15,
    )
    scene.render.filepath = str(WORK / (key + ".png"))
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(scene.render.filepath, check_existing=False)
    w, h = im.size
    raw = np.empty(w * h * 4, dtype="f")
    im.pixels.foreach_get(raw)
    pixels = raw.reshape(h, w, 4)
    yy, xx = np.where(pixels[:, :, 3] > 0.04)
    assert len(xx), key
    resize_x = np.linspace(min(xx), max(xx), 192)
    resize_y = np.linspace(min(yy), max(yy), 128)
    x0 = resize_x.astype(int)
    y0 = resize_y.astype(int)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (resize_x - x0)[None, :, None]
    fy = (resize_y - y0)[:, None, None]
    sprite = (1 - fy) * (
        (1 - fx) * pixels[y0[:, None], x0] + fx * pixels[y0[:, None], x1]
    ) + fy * ((1 - fx) * pixels[y1[:, None], x0] + fx * pixels[y1[:, None], x1])
    row = (3 - index // 4) * 128
    col = index % 4 * 192
    atlas[row : row + 128, col : col + 192] = sprite
    bpy.data.images.remove(im)
im = bpy.data.images.new(
    "Classic orthographic props", width=768, height=512, alpha=True
)
im.pixels.foreach_set(atlas.ravel())
im.filepath_raw = str(ROOT / "dist/backrooms-props.png")
im.file_format = "PNG"
im.save()
bpy.data.images.remove(im)
# Space out linked assemblies for editing in Blender's outliner and viewport.
for index, (name, col) in enumerate(models.items()):
    col.hide_render = False
    offset = Vector(((index % 4) * 5.6, (index // 4) * 4.8, 0))
    anchor = bpy.data.objects.new(name + " assembly", None)
    col.objects.link(anchor)
    anchor.empty_display_size = 0.2
    for o in list(col.objects):
        if o != anchor:
            o.parent = anchor
    anchor.location = offset
for a in bpy.data.screens:
    for ar in a.areas:
        if ar.type == "VIEW_3D":
            ar.spaces.active.region_3d.view_distance = 24
            ar.spaces.active.region_3d.view_location = (7, 5, 1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(
    filepath=str(ROOT / "art/blender/backrooms-annex.blend"), compress=True
)
print(
    "READY", target.stat().st_size, (ROOT / "dist/backrooms-props.png").stat().st_size
)
