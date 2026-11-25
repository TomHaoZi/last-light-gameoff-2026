"""Fit the Mourning Clerk's CC BY Crow feather geometry into a two-wing armature.

Blender 4.5+: blender -b --python-exit-code 1 -P art/blender/build_mourning_wings.py -- /path/to/crow.glb
The origin is the shoulder-blade socket. Blender -Y faces the player.
Source: Crow by Vinish (https://vinish.dev/free-3d-models/birds), CC BY 4.0.
"""

import argparse
from collections import defaultdict
import hashlib
import math
import os
from pathlib import Path
import random
import sys
import tempfile

import bpy
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "dist/3d/assets/creature/mourning-wings.glb"
EDITABLE = ROOT / "art/blender/mourning-wings.blend"
SOURCE_URL = "https://vinish-models.pages.dev/birds/crow.glb"
SOURCE_SHA256 = "3c703732b064b2ae98d703963f1fbb2218750c737f7cc59819ba7c7039ae145f"
FRONT = Vector((0, -1, 0))
RANDOM = random.Random(20751)
TEMPLATES = {
    "primary": ("Prim1_L", "Prim3_L", "Prim5_L"),
    "secondary": ("Sec1_L", "Sec3_L", "Sec5_L"),
    "tertial": ("Ter1_L", "Ter2_L"),
    "covert": ("Sec1_L", "Sec3_L", "Ter2_L"),
}


def read_crow(path):
    """Take the donor remiges and coverts out of the unposed bird mesh."""
    bpy.ops.import_scene.gltf(filepath=str(path), merge_vertices=True)
    donor = next(obj for obj in bpy.context.scene.objects if obj.name == "Crow_Body")
    data = donor.data
    parents = list(range(len(data.vertices)))

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for edge in data.edges:
        start, end = map(root, edge.vertices)
        parents[end] = start
    groups = defaultdict(list)
    for poly in data.polygons:
        groups[root(poly.vertices[0])].append(poly)
    islands = defaultdict(list)
    for polys in groups.values():
        vertex = data.vertices[polys[0].vertices[0]]
        if not vertex.groups:
            continue
        weight = max(vertex.groups, key=lambda weight: weight.weight)
        name = donor.vertex_groups[weight.group].name
        if any(name in list_of_names for list_of_names in TEMPLATES.values()):
            islands[name].append(polys)

    def template(polys):
        uvs = data.uv_layers.active.data
        points = {}
        local_uv = {}
        faces = []
        for polygon in polys:
            face = []
            for loop, index in zip(polygon.loop_indices, polygon.vertices):
                points.setdefault(index, data.vertices[index].co.copy())
                local_uv[index] = uvs[loop].uv.copy()
                face.append(index)
            faces.append(face)
        base = sum((p for i, p in points.items() if local_uv[i].y > .98), Vector()) / sum(
            uv.y > .98 for uv in local_uv.values()
        )
        tip = sum((p for i, p in points.items() if local_uv[i].y < .02), Vector()) / sum(
            uv.y < .02 for uv in local_uv.values()
        )
        axis = (tip - base).normalized()
        across = axis.cross(Vector((0, 0, 1))).normalized()
        normal = across.cross(axis)
        size = (tip - base).length
        width = max(abs((p - base).dot(across)) for p in points.values())
        numbered = {index: i for i, index in enumerate(points)}
        return (
            [((p - base).dot(axis) / size, (p - base).dot(across) / width,
              (p - base).dot(normal) / width, *local_uv[index]) for index, p in points.items()],
            [[numbered[index] for index in f] for f in faces],
        )

    feathers = {}
    for kind, names in TEMPLATES.items():
        feathers[kind] = []
        for name in names:
            candidates = [template(polys) for polys in islands[name]]
            if kind == "covert":
                small = [item for item in candidates if 20 <= len(item[0]) <= 35]
                feathers[kind].append(small[len(small) // 2] if small else min(candidates, key=lambda i: len(i[0])))
            else:
                # Flight feathers are the widest UV islands by projected length.
                polys = max(islands[name], key=lambda polys:
                            max((data.vertices[a].co - data.vertices[b].co).length
                                for f in polys for a in f.vertices
                                for b in polys[-1].vertices))
                feathers[kind].append(template(polys))

    images = [node.image for node in bpy.data.materials["Feather"].node_tree.nodes if node.type == "TEX_IMAGE"]
    color = next(image for image in images if not image.name.endswith("normal"))
    source = np.empty(len(color.pixels), dtype=np.float32)
    color.pixels.foreach_get(source)
    size = tuple(color.size)
    return feathers, source.reshape(size[1], size[0], 4)[..., :3]


def make_atlas(source, directory):
    """Keep the donor feather grain and bake ash, soot, oil and sharpened rachis."""
    size = 1024
    cell_width, cell_height = size // 4, size // 2
    albedo = np.ones((size, size, 4), np.float32)
    normal = albedo.copy()
    surface = albedo.copy()
    y, x = np.mgrid[0:cell_height, 0:cell_width]
    u = x / (cell_width - 1)
    t = 1 - y / (cell_height - 1)
    grain_sample = source[np.round((1 - t) * (source.shape[0] - 1)).astype(int),
                          np.round(u * (source.shape[1] - 1)).astype(int)]
    grain_sample = grain_sample.mean(-1)
    grain_sample = (grain_sample - grain_sample.min()) / max(.01, np.ptp(grain_sample)) - .5
    grain = np.random.default_rng(2026).normal(size=x.shape)
    for variant in range(8):
        ridge = .59 - .067 * t
        distance = np.abs(u - ridge)
        shaft = np.exp(-((u - ridge) / (.019 - .011 * t)) ** 2)
        barbs = .5 + .5 * np.cos(2 * math.pi * (49 * t - 11 * distance + .45 * np.sin(5 * u + variant)))
        bars = .5 + .5 * np.sin(2 * math.pi * (3.6 * t + .19 * np.cos(7 * u) + variant / 8))
        smudge = .5 + .5 * np.sin(31 * u + 14 * t + 2.3 * np.sin(9 * u - 12 * t + variant))
        edge = np.clip((distance - .28) * 4, 0, 1) * (.5 + .5 * smudge)
        tip_ash = np.clip((t - .63) * 2.1, 0, 1) * (variant not in (3, 6))
        freckles = (grain > 1.8) * (barbs * .6 + .4)
        value = (.074 + .046 * (variant % 4) / 3 + .056 * tip_ash + .026 * bars
                 + .039 * shaft + .012 * barbs + .021 * edge + .023 * grain_sample
                 + .008 * freckles + .008 * smudge)
        rgb = np.stack((value * 1.08, value * (1.005 + .05 * barbs), value * (.9 + .19 * (1 - t))), axis=-1)
        ridge_height = .15 * shaft + .022 * barbs + .0035 * grain + .013 * grain_sample
        dy, dx = np.gradient(ridge_height)
        vector = np.stack((-dx * 12, -dy * 12, np.ones_like(dx)), axis=-1)
        vector /= np.linalg.norm(vector, axis=-1, keepdims=True)
        row, col = divmod(variant, 4)
        rect = np.s_[row * cell_height:(row + 1) * cell_height, col * cell_width:(col + 1) * cell_width]
        # Byte-backed Blender image buffers take display RGB. Convert the
        # linear material values before packing the glTF sRGB albedo.
        albedo[rect][..., :3] = np.where(rgb <= .0031308, 12.92 * rgb,
                                       1.055 * rgb ** (1 / 2.4) - .055)
        normal[rect][..., :3] = .5 + .5 * vector
        surface[rect][..., 0] = np.clip(.48 + .3 * t + .11 * bars + .08 * smudge, 0, 1)
        surface[rect][..., 1] = np.clip(.52 + .22 * tip_ash - .19 * shaft + .07 * grain_sample, .24, .87)
        surface[rect][..., 2] = 0

    def save_map(pixels, name, non_color=False, kind="PNG"):
        image = bpy.data.images.new(name, size, size, alpha=False)
        if non_color:
            image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(np.ascontiguousarray(pixels).ravel())
        image.file_format = kind
        image.filepath_raw = str(directory / (name + (".jpg" if kind == "JPEG" else ".png")))
        image.save()
        image.pack()
        return image

    material = bpy.data.materials.new("Grave ash and wet crow vanes")
    material.use_nodes = True
    material.diffuse_color = (.12, .115, .104, 1)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = 0
    rgb = nodes.new("ShaderNodeTexImage")
    rgb.image = save_map(albedo, "Clerk feathers albedo", kind="JPEG")
    links.new(rgb.outputs["Color"], shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeTexImage")
    bump.image = save_map(normal, "Clerk barbs and rachis", True, kind="JPEG")
    map_node = nodes.new("ShaderNodeNormalMap")
    map_node.inputs["Strength"].default_value = .56
    links.new(bump.outputs["Color"], map_node.inputs["Color"])
    links.new(map_node.outputs["Normal"], shader.inputs["Normal"])
    rough = nodes.new("ShaderNodeTexImage")
    rough.image = save_map(surface, "Clerk roughness", True, kind="JPEG")
    channel = nodes.new("ShaderNodeSeparateColor")
    links.new(rough.outputs["Color"], channel.inputs["Color"])
    links.new(channel.outputs["Green"], shader.inputs["Roughness"])
    return material


def bone_names(side):
    return tuple("Wing" + side + name for name in ("Root", "Elbow", "Wrist"))


def anatomy(sign):
    return [
        Vector((sign * .126, -.016, -.055)),
        Vector((sign * .399, .12, .407 if sign > 0 else .378)),
        Vector((sign * .694, .238, .537 if sign > 0 else .482)),
        Vector((sign * .944, .323, .533 if sign > 0 else .486)),
    ]


def armature(collection):
    rig_data = bpy.data.armatures.new("Mourning Clerk wing bones")
    rig = bpy.data.objects.new("Mourning wing armature", rig_data)
    collection.objects.link(rig)
    rig.show_in_front = True
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for sign, side in ((1, "L"), (-1, "R")):
        previous = None
        markers = anatomy(sign)
        for name, start, end in zip(bone_names(side), markers, markers[1:]):
            bone = rig.data.edit_bones.new(name)
            bone.head, bone.tail = start, end
            bone.align_roll(Vector((0, 1, 0)))
            if previous:
                bone.parent, bone.use_connect = previous, True
            previous = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    return rig


class Fitter:
    def __init__(self, collection, rig, material, templates):
        self.collection = collection
        self.rig = rig
        self.material = material
        self.templates = templates

    def surface(self, name, vertices, faces, uvs, atlas, weight, flip=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], [face[::-1] if flip else face for face in faces])
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        self.collection.objects.link(obj)
        obj.parent = self.rig
        mesh.materials.append(self.material)
        modifier = obj.modifiers.new("Wing articulation", "ARMATURE")
        modifier.object = self.rig
        indices = list(range(len(vertices)))
        for name, influence in weight:
            obj.vertex_groups.new(name=name).add(indices, influence, "REPLACE")
        row, col = divmod(atlas, 4)
        coordinates = mesh.uv_layers.new(name="Feather atlas").data
        for poly in mesh.polygons:
            poly.use_smooth = True
            for loop_index in poly.loop_indices:
                vertex = mesh.loops[loop_index].vertex_index
                u, v = uvs[vertex]
                coordinates[loop_index].uv = ((col + .012 + .976 * u) / 4, (row + .007 + .986 * v) / 2)
        return obj

    def feather(self, name, kind, index, sign, base, tip, width, weight, atlas, nick=0, curl=0):
        template = self.templates[kind][index % len(self.templates[kind])]
        points, faces = template
        base, tip = Vector(base), Vector(tip)
        base.x *= sign
        tip.x *= sign
        axis = (tip - base).normalized()
        across = axis.cross(FRONT).normalized()
        normal = across.cross(axis)
        coordinates, uvs = [], []
        for t, s, h, u, v in points:
            arch = math.sin(math.pi * max(0, min(1, t)))
            camber = (.016 + curl) * arch
            drift = .005 * math.sin(t * 10 + index) * arch
            notch = (nick * max(0, t - .57) * max(0, abs(s) - .48)
                     * (0.8 + .2 * math.sin(21 * t + index)))
            pos = (base.lerp(tip, t - notch) + across * (sign * (s * width * (1 - .6 * notch) + drift))
                   + normal * (h * width * .58 + camber + curl * t * t))
            coordinates.append(pos)
            uvs.append((u, v))
        return self.surface(name, coordinates, faces, uvs, atlas, weight, flip=sign < 0)

    def shoulder(self, side, markers):
        path = [markers[0].lerp(markers[1], t) for t in (0, .15, .32, .46, .57)]
        path = [point + Vector((0, .048, -.017)) for point in path]
        widths = (.054, .073, .064, .043, .004)
        points, uvs, faces = [], [], []
        ring_size = 12
        for i, (center, width) in enumerate(zip(path, widths)):
            axis = (path[min(i + 1, 4)] - path[max(0, i - 1)]).normalized()
            across = axis.cross(FRONT).normalized()
            normal = across.cross(axis)
            for j in range(ring_size):
                angle = math.tau * j / ring_size
                point = center + across * (width * math.cos(angle)) + normal * (width * .51 * math.sin(angle))
                points.append(point)
                uvs.append((j / (ring_size - 1), 1 - i * .25))
                if i:
                    current = i * ring_size + j
                    other = i * ring_size + (j + 1) % ring_size
                    faces.append((current, other, other - ring_size, current - ring_size))
        start_cap = tuple(reversed(range(ring_size)))
        end_cap = tuple(range(len(points) - ring_size, len(points)))
        shoulder = self.surface("Feather mantle " + side, points, faces + [start_cap, end_cap],
                                uvs, 7, ((bone_names(side)[0], 1),))
        group = shoulder.vertex_groups.new(name=bone_names(side)[1])
        for index, influence in enumerate((0, 0, .04, .10, .17)):
            if influence > 0:
                section = list(range(index * ring_size, (index + 1) * ring_size))
                group.add(section, influence, "REPLACE")
                shoulder.vertex_groups[0].add(section, 1 - influence, "REPLACE")

    def fit(self, sign, side):
        humerus, ulna, wrist = bone_names(side)
        markers = anatomy(sign)
        self.shoulder(side, markers)
        damage = sign < 0
        for row, count in ((0, 11), (1, 10), (2, 9)):
            for i in range(count):
                u = (i + .24 * row) / (count - 1 + .24 * row)
                center = markers[0].lerp(markers[1], u)
                x = abs(center.x) + .020 + row * .026
                y = center.y - .055 - .018 * row
                z = center.z + .07 * math.sin(u * math.pi / 2) - .074 * row
                self.feather(f"{side} scapular {row + 1}.{i + 1:02}", "covert", i + row, sign,
                             (x, y, z), (x + .008, y + .066, z - .117 - .016 * row),
                             .029 + .009 * row + RANDOM.uniform(-.003, .003),
                             ((humerus, 1),), (i * 3 + row + 4) % 8,
                             nick=.14 if damage else 0, curl=.012)
        primary_tips = ((.70, .45, -.79), (.82, .43, -.72), (.95, .41, -.63),
                        (1.075, .397, -.476), (1.17, .393, -.293), (1.22, .388, -.095),
                        (1.235, .377, .076), (1.214, .367, .217), (1.15, .355, .355))
        for i, (x, y, z) in enumerate(primary_tips):
            u = i / (len(primary_tips) - 1)
            start = (.622 + .307 * u, .239 + .075 * u, .507 + .071 * math.sin(2 * u))
            if damage:
                x *= .95
                z -= .066
                if i in (3, 5):
                    z += .17
                    y += .065
            weights = ((wrist, .82), (ulna, .18)) if i < 2 else ((wrist, 1),)
            self.feather(f"{side} primary {i + 1:02}", "primary", i, sign, start, (x, y, z),
                         .063 - .015 * u, weights, 1 + ((i + (2 if damage else 0)) % 6),
                         nick=.48 if damage and i in (2, 3, 5, 7) else .14,
                         curl=.012 * math.sin(i * 1.6))
        for i in range(12):
            u = i / 11
            x = .225 + .426 * u
            start = (x, .089 + .141 * u, .154 + .388 * math.sin(u * 1.53))
            tip = (x + .08 + .095 * u, .267 + .164 * u,
                   -.51 - .238 * math.sin(1.93 * u) + RANDOM.uniform(-.028, .031))
            weights = ((humerus, 1 - u), (ulna, u)) if u < .65 else ((ulna, 1),)
            kind = "tertial" if i < 5 else "secondary"
            self.feather(f"{side} {kind} {i + 1:02}", kind, i, sign, start, tip,
                         .056 + .008 * u, weights, (i + 4) % 7,
                         nick=.42 if damage and i in (6, 10) else .085,
                         curl=RANDOM.uniform(-.018, .021))
        # Up-facing coverts obscure the bone transitions from both sides.
        for row, count in ((0, 17), (1, 15), (2, 13)):
            for i in range(count):
                u = (i + .3 * row) / (count - 1 + .3 * row)
                x = .139 + u * (.813 - row * .042)
                y = .003 + .279 * u - .029 * row
                z = .018 + .578 * math.sin(u * 1.56) - .071 * row
                if damage:
                    z -= .042 + .054 * u
                base = (x, y, z)
                tip = (max(.076, x + .017 + u * .032), y + .035 + .021 * u,
                       z - (.14 + .086 * math.sin(u * 2.1)) * (1 + row * .15))
                weight = (((humerus, 1),) if u < .30 else ((ulna, 1),) if u < .71 else ((wrist, 1),))
                self.feather(f"{side} covert {row + 1}.{i + 1:02}", "covert", i + row, sign,
                             base, tip, .032 + .005 * row + RANDOM.uniform(-.005, .007),
                             weight, (i + row * 3) % 8, nick=.17 if damage else 0,
                             curl=RANDOM.uniform(-.009, .007))


def setup_studio(scene, output):
    # Authoring preview only. No camera or lighting ships in the in-game asset.
    bpy.ops.import_scene.gltf(filepath=str(ASSET.with_name("mourning-clerk-human.glb")))
    human = bpy.data.objects.get("WingAnchor")
    anchor = human.matrix_world.translation
    wing_rig = bpy.data.objects.get("Mourning wing armature")
    wing_rig.location = anchor

    def look_at(obj, point):
        obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add(location=(.58, -3.9, 1.62))
    camera = bpy.context.object
    look_at(camera, (0, .08, 1.12))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.62
    scene.camera = camera
    scene.world = bpy.data.worlds.new("Studio ambience")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.033, .043, .057, 1)
    for location, energy, color, size in [
        ((-.90, -2.5, 2.4), 320, (1, .83, .65), 2.5),
        ((1.25, .75, 2.0), 475, (.62, .77, 1), 1.45),
        ((-.9, .55, .9), 150, (1, .46, .29), 1.4),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.color, lamp.data.size = energy, color, size
        look_at(lamp, (0, .12, 1.24))
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.filepath = output
    bpy.ops.render.render(write_still=True)


def main(path, atlas_directory):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    templates, original_color = read_crow(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    wings = bpy.data.collections.new("The Clerk's wings — fitted crow vanes")
    scene.collection.children.link(wings)
    rig = armature(wings)
    coating = make_atlas(original_color, atlas_directory)
    fitter = Fitter(wings, rig, coating, templates)
    for sign, side in ((1, "L"), (-1, "R")):
        fitter.fit(sign, side)

    credits = bpy.data.texts.new("Wing geometry credits")
    credits.write("Remiges and covert profiles adapted from Crow by Vinish (CC BY 4.0).\n"
                  "https://vinish.dev/free-3d-models/birds\n"
                  "https://creativecommons.org/licenses/by/4.0/\n\n"
                  "LAST LIGHT reshaped and fitted each vane, built the scapular mantle and rig, "
                  "then baked new ash, roughness, and barb maps.\n")
    bpy.context.preferences.filepaths.save_version = 0
    # Editable version retains each re-fitted feather and its weight groups.
    bpy.ops.wm.save_as_mainfile(filepath=str(EDITABLE), compress=True)
    meshes = [obj for obj in wings.objects if obj.type == "MESH"]
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Mourning Clerk feather geometry"
    rig.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(ASSET), export_format="GLB", use_selection=True,
        export_animations=False, export_materials="EXPORT"
    )
    positions = np.array([vertex.co[:] for vertex in obj.data.vertices])
    obj.data.calc_loop_triangles()
    print("MOURNING WINGS", len(obj.data.loop_triangles), "triangles",
          "bounds", positions.min(0), positions.max(0))
    if output := os.environ.get("MOURNING_WINGS_PREVIEW"):
        setup_studio(scene, output)


if __name__ == "__main__":
    arguments = argparse.ArgumentParser(prog="build_mourning_wings")
    arguments.add_argument("crow_glb", type=Path, help=f"Original Crow GLB from {SOURCE_URL}")
    source = arguments.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []).crow_glb
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise SystemExit("The input differs from the licensed Crow version recorded in SOURCES.md.")
    with tempfile.TemporaryDirectory(prefix="mourning-wing-maps-") as temporary:
        main(source, Path(temporary))
