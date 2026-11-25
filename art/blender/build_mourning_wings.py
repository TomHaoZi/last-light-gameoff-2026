"""Sculpt the original Mourning Clerk's folded limestone wings.

Blender 4.5+: blender -b --python-exit-code 1 -P art/blender/build_mourning_wings.py
The origin is the spine socket. The actor's forward axis is Blender -Y.
"""

import math
import os
from pathlib import Path
import random
import tempfile

import bpy
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art/blender"
ASSETS = ROOT / "dist/3d/assets/creature"
FRONT_AXIS = Vector((0, -1, 0))
rng = random.Random(14091)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
wing_col = bpy.data.collections.new("Limestone wings")
scene.collection.children.link(wing_col)


def material(name, tone, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*tone, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*tone, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


def weathered_limestone():
    mat = material("Wet cut limestone", (0.31, 0.34, 0.30), 0.67)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    grid = 320
    y, x = np.mgrid[0:grid, 0:grid] / grid * math.tau
    seed = np.random.default_rng(619)
    grain = seed.normal(size=(grid, grid))
    pores = seed.random((grid, grid)) < 0.045
    lamina = np.sin(3 * x + 8 * y + 0.5 * np.sin(4 * x - 2 * y))
    flecks = np.cos(57 * x - 27 * y) * np.sin(42 * x + 29 * y)
    stains = np.sin(x - 2 * y + 0.4 * np.cos(4 * x)) + 0.6 * np.cos(8 * y + 3 * x)
    variation = (
        0.022 * grain + 0.017 * lamina + 0.011 * flecks + 0.024 * stains - 0.053 * pores
    )
    color = np.clip(np.array([0.36, 0.383, 0.349]) + variation[..., None], 0.08, 0.68)
    height = 0.025 * grain + 0.028 * flecks + 0.073 * lamina - 0.13 * pores
    dx = np.roll(height, 1, 1) - np.roll(height, -1, 1)
    dy = np.roll(height, 1, 0) - np.roll(height, -1, 0)
    surface_normal = np.stack((dx, dy, np.ones_like(dx)), axis=2)
    surface_normal /= np.linalg.norm(surface_normal, axis=2, keepdims=True)

    def image_of(rgb, title, is_normal=False):
        rgba = np.ones((grid, grid, 4), dtype=np.float32)
        rgba[..., :3] = rgb
        image = bpy.data.images.new(title, width=grid, height=grid)
        if is_normal:
            image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(rgba.flatten())
        path = work / (title + ".png")
        image.filepath_raw = str(path)
        image.file_format = "PNG"
        image.save()
        image.pack()
        return image

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image_of(color, "Weathered limestone")
    links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeTexImage")
    bump.image = image_of(surface_normal * 0.5 + 0.5, "Chiseled grain normal", True)
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.63
    links.new(bump.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    return mat


def mesh(name, vertices, faces, mat, facet=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    uv = data.uv_layers.new(name="Stone plane")
    for polygon in data.polygons:
        polygon.use_smooth = not facet
        for index in polygon.loop_indices:
            point = data.vertices[data.loops[index].vertex_index].co
            uv.data[index].uv = (
                0.61 + point.x * 1.67 + point.y * 0.35,
                0.4 + point.z * 1.53,
            )
    obj = bpy.data.objects.new(name, data)
    wing_col.objects.link(obj)
    data.materials.append(mat)
    return obj


def ring_faces(count, length):
    faces = [tuple(range(count))]
    for i in range(length - 1):
        a = i * count
        b = a + count
        for j in range(count):
            k = (j + 1) % count
            faces.append((a + j, b + j, b + k, a + k))
    faces.append(tuple(reversed(range((length - 1) * count, length * count))))
    return faces


def spine(name, path, radii, mat, cross=10):
    points = [Vector(vertex) for vertex in path]
    rings = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        normal = (
            points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
        ).normalized()
        left = normal.cross(FRONT_AXIS).normalized()
        front = left.cross(normal)
        for n in range(cross):
            angle = math.tau * n / cross
            rings.append(
                point
                + left * (math.cos(angle) * radius)
                + front * (math.sin(angle) * radius * 0.82)
            )
    return mesh(name, rings, ring_faces(cross, len(points)), mat)


def feather(name, socket, tip, width, stone, curve, chip=False):
    origin = Vector(socket)
    tip = Vector(tip)
    axis = (tip - origin).normalized()
    across = axis.cross(FRONT_AXIS).normalized()
    front = across.cross(axis)
    outline = (0.28, 0.79, 1, 0.91, 0.72, 0.47, 0.09)
    if chip:
        outline = (0.28, 0.79, 1, 0.93, 0.57, 0.67, 0.56)
    segment = []
    for row, silhouette in enumerate(outline):
        t = row / (len(outline) - 1)
        crown = math.sin(math.pi * t)
        root = origin.lerp(tip, t) + across * (curve * crown) + front * (0.012 * crown)
        thickness = max(0.0055, width * 0.34 * (1 - t * 0.83))
        for spoke in range(10):
            angle = math.tau * spoke / 10
            edge = math.cos(angle)
            scallop = 1 + 0.09 * math.sin(11 * t + spoke * 0.814)
            if chip and row >= 5 and spoke in (1, 2, 3):
                scallop *= 0.75
            segment.append(
                root
                + across * (edge * silhouette * width * scallop)
                + front * (math.sin(angle) * thickness * max(0.44, 1 - 0.3 * abs(edge)))
            )
    blade = mesh(name, segment, ring_faces(10, len(outline)), stone)
    if chip:
        blade.data.materials.append(fracture)
        blade.data.polygons[-1].material_index = 1
        blade.data.polygons[-1].use_smooth = False
    return blade


with tempfile.TemporaryDirectory(prefix="mourning-wings-") as tmp:
    work = Path(tmp)
    stone = weathered_limestone()
    fracture = material("Pale new fracture", (0.51, 0.508, 0.467), 0.90)
    wet = material("Damp seams", (0.183, 0.216, 0.195), 0.80)
    iron = material("Oxidised masonry clamps", (0.156, 0.081, 0.047), 0.61, 0.45)
    for side, designation in ((-1, "Fractured"), (1, "Intact")):
        tag = designation + " wing"
        intact = side == 1
        widths = [
            0.12,
            0.24,
            0.39,
            0.56,
            0.72 if intact else 0.655,
            0.82 if intact else 0.697,
        ]
        heights = [
            0.10,
            0.38,
            0.59,
            0.615 if intact else 0.582,
            0.49 if intact else 0.442,
            0.29 if intact else 0.33,
        ]
        depths = [0.151, 0.179, 0.222, 0.271, 0.307, 0.358]
        crest = [(side * x, y, z) for x, y, z in zip(widths, depths, heights)]
        arch = spine(
            tag + " / weathered arch",
            crest,
            [0.082, 0.089, 0.077, 0.068, 0.052, 0.032],
            stone,
        )
        if not intact:
            arch.data.materials.append(fracture)
            arch.data.polygons[-1].material_index = 1
            arch.data.polygons[-1].use_smooth = False

        # Large primary feathers behind the stern edge. The upper ends of the
        # outer three on the left retain the visible broken stone surfaces.
        for i in range(9):
            x = 0.24 + i * (0.058 if intact else 0.051)
            rz = 0.37 + 0.21 * math.sin((i + 1) * 0.28)
            tx = x + 0.10 + 0.044 * math.sin(i * 0.4)
            tz = -0.52 + 0.055 * i
            chipped = not intact and i >= 6
            if chipped:
                tx -= 0.032 * (i - 5)
                tz += (0.07, 0.20, 0.25)[i - 6]
            feather(
                f"{tag} / primary {i + 1:02}",
                (side * x, 0.27 + i * 0.01, rz),
                (side * tx, 0.36 + i * 0.008, tz),
                0.070 - i * 0.003,
                stone,
                side * 0.038,
                chipped,
            )

        for i in range(11):
            x = 0.15 + i * (0.057 if intact else 0.048)
            z = max(0.13, 0.18 + 0.33 * math.sin((i + 1) * 0.224))
            feather(
                f"{tag} / secondary {i + 1:02}",
                (side * x, 0.231 + i * 0.008, z),
                (
                    side * (x + 0.027),
                    0.278 + i * 0.01,
                    z - (0.31 + 0.07 * math.sin(i * 0.73)),
                ),
                0.055 - i * 0.0017,
                stone,
                side * 0.025,
                chip=not intact and i in (8, 10),
            )

        for row in range(3):
            for i in range(7 - row):
                x = 0.136 + i * 0.055 + row * 0.044
                z = 0.165 + 0.248 * math.sin((i + 2) * 0.27) + row * 0.053
                feather(
                    f"{tag} / covert {row + 1}-{i + 1}",
                    (side * x, 0.185 + (i + row) * 0.009, z),
                    (
                        side * (x + 0.057),
                        0.209 + (i + row) * 0.01,
                        z - 0.19 - rng.uniform(0, 0.051),
                    ),
                    rng.uniform(0.032, 0.047),
                    stone,
                    side * 0.015,
                )

    # Separate oxidised staples bridge three fissures on the missing outer edge.
    for i in range(3):
        x = -0.573 - i * 0.028
        z = 0.483 - i * 0.049
        spine(
            "Hand-forged fracture clamp " + str(i + 1),
            [
                (x + 0.048, 0.212, z + 0.021),
                (x + 0.044, 0.181, z + 0.019),
                (x - 0.029, 0.195, z - 0.023),
                (x - 0.036, 0.222, z - 0.026),
            ],
            [0.008, 0.009, 0.009, 0.008],
            iron,
            cross=8,
        )
        spine(
            "Iron bleed at staple " + str(i + 1),
            [
                (x - 0.038, 0.229, z - 0.025),
                (x - 0.035, 0.227, z - 0.073),
                (x - 0.025, 0.227, z - 0.107),
            ],
            [0.007, 0.006, 0.0018],
            wet,
            cross=6,
        )

    for piece in wing_col.objects:
        piece.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(wing_col.objects))
    bpy.context.preferences.filepaths.save_version = 0
    # Keep each named feather editable in the source file. Runtime combines
    # them into a single mesh with material groups to reduce draw calls.
    bpy.ops.wm.save_as_mainfile(
        filepath=str(ART / "mourning-wings.blend"), compress=True
    )
    bpy.ops.object.join()
    wing = bpy.context.object
    wing.name = "Mourning folded wings"
    bpy.ops.export_scene.gltf(
        filepath=str(ASSETS / "mourning-wings.glb"),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
    )
    bounds = np.array([vertex.co[:] for vertex in wing.data.vertices])
    print(
        "WING_BOUNDS", bounds.min(axis=0), bounds.max(axis=0), "VERTICES", len(bounds)
    )

    preview = os.environ.get("MOURNING_WINGS_PREVIEW")
    if preview:

        def look_at(obj, target):
            obj.rotation_euler = (
                (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
            )

        bpy.ops.object.camera_add(location=(2.0, -4.3, 1.28))
        cam = bpy.context.object
        look_at(cam, (0, 0.16, 0.045))
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = 2.12
        scene.camera = cam
        for pos, energy, color, size in [
            ((0.5, -2.2, 2.0), 480, (0.85, 1, 0.98), 2.15),
            ((-1.3, 1.0, 0.6), 250, (0.53, 0.67, 1), 1.2),
        ]:
            bpy.ops.object.light_add(type="AREA", location=pos)
            lamp = bpy.context.object
            lamp.data.energy = energy
            lamp.data.color = color
            lamp.data.shape = "DISK"
            lamp.data.size = size
            look_at(lamp, (0, 0.2, 0))
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 16
        scene.render.resolution_x = 800
        scene.render.resolution_y = 640
        scene.render.resolution_percentage = 100
        scene.render.filepath = preview
        bpy.ops.render.render(write_still=True)
