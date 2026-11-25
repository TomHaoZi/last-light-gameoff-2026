"""Fit, paint and rig the adult archive spectre in Blender 4.5.

blender -b --python-exit-code 1 -P art/blender/build_mourning_clerk.py -- <MakeHuman data> <CC0 asset pack>
"""

import argparse
import json
import math
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]


def wavefront(path):
    vertices, uv, faces = [], [], []
    group = ""
    for line in path.read_text().splitlines():
        tag, *values = line.split() or [""]
        if tag == "v":
            vertices.append(tuple(map(float, values[:3])))
        elif tag == "vt":
            uv.append(tuple(map(float, values[:2])))
        elif tag == "g":
            group = values[0]
        elif tag == "f":
            faces.append((group, [tuple(int(i) - 1 for i in v.split("/")[:2]) for v in values]))
    return np.array(vertices), np.array(uv), faces


def morph(vertices, weight, path):
    for line in path.read_text().splitlines():
        if line and not line.startswith("#"):
            index, *coords = line.split()
            vertices[int(index)] += np.array(coords, dtype=float) * weight


def attach(human, weights, path):
    rows, mask = [], set()
    scale = np.ones(3)
    section = ""
    for line in path.read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        key, *rest = line.split() or [""]
        if key in ("x_scale", "y_scale", "z_scale"):
            axis = "xyz".index(key[0])
            a, b, magnitude = rest[:3]
            scale[axis] = abs(human[int(a), axis] - human[int(b), axis]) / float(magnitude)
        elif key in ("verts", "delete_verts"):
            section = key
        elif section == "verts" and key.isdigit():
            row = [key, *rest]
            if len(row) == 1:
                rows.append(([int(key)], [1.], [0., 0., 0.]))
            elif len(row) >= 9:
                rows.append((list(map(int, row[:3])), list(map(float, row[3:6])), list(map(float, row[6:9]))))
        elif section == "delete_verts" and key.isdigit():
            values = iter([key, *rest])
            numbers = []
            for word in values:
                if word == "-":
                    numbers.extend(range(numbers[-1], int(next(values)) + 1))
                else:
                    numbers.append(int(word))
            mask.update(numbers)
    points, influences = [], []
    for ids, mix, offset in rows:
        points.append(np.asarray(mix) @ human[ids] + scale * offset)
        group = defaultdict(float)
        for index, amount in zip(ids, mix):
            for bone, value in weights[index].items():
                group[bone] += max(0, amount) * value
        influences.append(group)
    return np.array(points), influences, mask


def smooth(a, b, value):
    t = np.clip((value - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def packed_jpeg(image, limit):
    width, height = image.size
    if max(width, height) > limit:
        ratio = limit / max(width, height)
        image.scale(round(width * ratio), round(height * ratio))
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "pigment.jpg"
        image.file_format = "JPEG"
        image.filepath_raw = str(path)
        image.save()
        name = image.name
        bpy.data.images.remove(image)
        packed = bpy.data.images.load(str(path))
        packed.name = name
        packed.pack()
    return packed


def skin_paint(image, body, uv, faces, head, eyes):
    # Project makeup through the fitted UVs to keep the original photographic pores.
    width, height = image.size
    if max(width, height) > 2048:
        size = min(1., 2048 / max(width, height))
        image.scale(round(width * size), round(height * size))
        width, height = image.size
    image.colorspace_settings.name = "Non-Color"
    rgba = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(rgba)
    rgba = rgba.reshape(height, width, 4)
    world = np.full((height, width, 3), np.nan, dtype=np.float32)
    chart = uv * (width, height)
    for _, corners in faces:
        for i in range(1, len(corners) - 1):
            vert, tex = zip(corners[0], corners[i], corners[i + 1])
            a, b, c = chart[list(tex)]
            ab, ac = b - a, c - a
            denom = ab[0] * ac[1] - ac[0] * ab[1]
            if abs(denom) < .001:
                continue
            lo = np.maximum(0, np.floor(np.minimum.reduce([a, b, c])).astype(int))
            hi = np.minimum((width, height), 1 + np.ceil(np.maximum.reduce([a, b, c])).astype(int))
            yy, xx = np.ogrid[lo[1]:hi[1], lo[0]:hi[0]]
            s = ((xx + .5 - a[0]) * ac[1] - (yy + .5 - a[1]) * ac[0]) / denom
            t = (ab[0] * (yy + .5 - a[1]) - ab[1] * (xx + .5 - a[0])) / denom
            inside = (s >= -.028) & (t >= -.028) & (s + t <= 1.028)
            p, q, r = body[list(vert)]
            world[lo[1]:hi[1], lo[0]:hi[0]][inside] = p + s[inside, None] * (q - p) + t[inside, None] * (r - p)
    valid = np.isfinite(world[:, :, 0])
    x, y, z = world[valid].T
    color = rgba[valid, :3]
    luma = color @ [.32, .52, .16]
    front = smooth(.034, .084, z)

    def glaze(pigment, weight):
        nonlocal color
        weight = np.clip(weight, 0, 1)[:, None]
        pigment = np.asarray(pigment) * (.55 + luma[:, None] * .78)
        color = color * (1 - weight) + pigment * weight

    stone = luma[:, None] * [.93, 1.015, 1.02]
    mottling = .58 + .21 * np.sin(x * 270 + y * 180) * np.cos(y * 120 - z * 184)
    color = stone * .64 + color * .36
    for ex, ey, _ in eyes:
        socket = np.exp(-((x - ex) / .024) ** 2 - ((y - ey + .004) / .016) ** 2)
        glaze([.25, .168, .221], .72 * socket * front)
        t = (ey - y) / (.100 if ex > 0 else .082)
        drift = .004 * t + .0013 * np.sin(t * 9 + 1) + .001 * np.sin(t * 19)
        d = abs(x - ex - .004 - drift)
        gravity = smooth(-.012, .11, t) * (1 - smooth(.61, 1.04, t)) * front
        glaze([.33, .23, .24], np.exp(-(d / .005) ** 2) * gravity * mottling)
        glaze([.24, .065, .081], np.exp(-(d / .0028) ** 2) * gravity * .84)
    for cx, cy, rx, ry in [(.058, head[1] + .05, .021, .037), (-.046, head[1] + .017, .025, .019),
                            (.065, 1.48, .046, .053), (-.054, 1.43, .041, .027)]:
        edge = np.hypot((x - cx + (y - cy) * .30) / rx, (y - cy) / ry)
        grain = .24 * np.sin(x * 350 + y * 620) * np.cos(y * 270 - z * 750)
        plate = 1 - smooth(.27, .96, edge + grain)
        glaze([.32, .25, .26], (1 - smooth(.90, 1.52, edge + grain)) * mottling * front)
        glaze([.48, .475, .42], plate * mottling * front)
        crack = np.exp(-(np.sin(80*x + 34*y + np.sin(y*185 + z*127)) / .12) ** 2)
        glaze([.24, .19, .176], plate * crack * .60 * front)
    for i in range(3):
        track = .06 + .007 * i + .004 * np.sin(y * 123 + i * 2) + .0023 * np.sin(y * 237 + i)
        veins = np.exp(-((abs(x) - track) / .0018) ** 2)
        glaze([.34, .35, .46], veins * .31 * front * np.exp(-((y - 1.535) / .09) ** 2))
    rgba[valid, :3] = np.clip(color, 0, 1)
    painted = bpy.data.images.new("Clerk | photo skin and mineral makeup", width, height, alpha=False)
    painted.colorspace_settings.name = "Non-Color"
    painted.pixels.foreach_set(rgba.ravel())
    # The painted RGB is display-referred. Pack a JPEG and sample it as sRGB.
    return painted


def main(data, assets, preview):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    human, body_uv, original = wavefront(data / "3dobjs/base.obj")
    macro = data / "targets/macrodetails"
    morph(human, .78, macro / "caucasian-female-young.target")
    morph(human, .22, macro / "caucasian-female-old.target")
    morph(human, .79, data / "targets/breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness.target")
    morph(human, .17, data / "targets/head/head-fat-decr.target")
    body_faces = [(tag, poly) for tag, poly in original if tag == "body"]
    skin_ids = [v for _, corners in body_faces for v, _ in corners]
    floor = min(human[v, 1] for v in skin_ids)
    scale = 1.81 / (max(human[v, 1] for v in skin_ids) - floor)

    def game(points):
        return (points - np.array([0., floor - .012, 0.])) * scale

    def bl(points):
        return (points * [1, 1, -1])[..., [0, 2, 1]]

    body = game(human)
    rig = json.loads((data / "rigs/default.mhskel").read_text())
    bones = rig["bones"]
    pivots = {name: game(human[rig["joints"][b["head"]]].mean(axis=0))
              for name, b in bones.items()}
    raw = json.loads((data / "rigs/default_weights.mhw").read_text())["weights"]
    weights = [defaultdict(float) for _ in human]
    for name, points in raw.items():
        for index, weight in points:
            weights[index][name] = weight

    mesh_rig = bpy.data.armatures.new("Archivist skeleton")
    actor = bpy.data.objects.new("Mourning Clerk", mesh_rig)
    bpy.context.collection.objects.link(actor)
    bpy.context.view_layer.objects.active = actor
    actor.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, pivot in pivots.items():
        bone = mesh_rig.edit_bones.new(name)
        bone.head = bl(pivot)
        # Equal bind axes keep the local pitch/yaw/roll controls consistent.
        bone.tail = bone.head + Vector((0, 0, .045))
    for name, data_bone in bones.items():
        if data_bone["parent"]:
            mesh_rig.edit_bones[name].parent = mesh_rig.edit_bones[data_bone["parent"]]
    bpy.ops.object.mode_set(mode="OBJECT")
    actor.show_in_front = True

    def image_mat(name, image, roughness, tint=(1, 1, 1, 1), normal=None, alpha=False):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.diffuse_color = tint
        shader = mat.node_tree.nodes["Principled BSDF"]
        shader.inputs["Base Color"].default_value = tint
        shader.inputs["Roughness"].default_value = roughness
        if image:
            color = mat.node_tree.nodes.new("ShaderNodeTexImage")
            color.image = image if isinstance(image, bpy.types.Image) else bpy.data.images.load(str(image), check_existing=True)
            mat.node_tree.links.new(color.outputs["Color"], shader.inputs["Base Color"])
            if alpha:
                mat.surface_render_method = "DITHERED"
                cutoff = mat.node_tree.nodes.new("ShaderNodeMath")
                cutoff.operation = "GREATER_THAN"
                cutoff.inputs[1].default_value = .32
                mat.node_tree.links.new(color.outputs["Alpha"], cutoff.inputs[0])
                mat.node_tree.links.new(cutoff.outputs[0], shader.inputs["Alpha"])
        if normal:
            source = mat.node_tree.nodes.new("ShaderNodeTexImage")
            source.image = bpy.data.images.load(str(normal), check_existing=True)
            source.image.colorspace_settings.name = "Non-Color"
            bump = mat.node_tree.nodes.new("ShaderNodeNormalMap")
            bump.inputs["Strength"].default_value = .55
            mat.node_tree.links.new(source.outputs["Color"], bump.inputs["Color"])
            mat.node_tree.links.new(bump.outputs[0], shader.inputs["Normal"])
        return mat

    def skinned_mesh(name, points, uv, faces, influences, mat):
        used = sorted({index for _, corners in faces for index, _ in corners})
        compact = {i: j for j, i in enumerate(used)}
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(bl(points[used]).tolist(), [], [[compact[v] for v, _ in corners] for _, corners in faces])
        mesh.update()
        texture = mesh.uv_layers.new(name="Original UVs")
        for polygon, (_, corners) in zip(mesh.polygons, faces):
            polygon.use_smooth = True
            for loop, (_, u) in zip(polygon.loop_indices, corners):
                texture.data[loop].uv = uv[u]
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(mat)
        obj.parent = actor
        deform = obj.modifiers.new("Continuous skin", "ARMATURE")
        deform.object = actor
        deform.use_deform_preserve_volume = True
        by_name = {}
        for i, v in enumerate(used):
            links = sorted(influences[v].items(), key=lambda pair: -pair[1])[:4] or [("root", 1)]
            total = sum(w for _, w in links)
            for bone, amount in links:
                if bone not in by_name:
                    by_name[bone] = obj.vertex_groups.new(name=bone)
                by_name[bone].add([i], amount / total, "REPLACE")
        return obj

    def fitted(folder, key):
        _, uv, faces = wavefront(folder / (key + ".obj"))
        points, local, hidden = attach(human, weights, folder / (key + ".mhclo"))
        return game(points), uv, faces, local, hidden

    def asset(folder, key, label, roughness, alpha=False):
        folder = assets / folder
        maps = dict(line.split(maxsplit=1) for line in next(folder.glob("*.mhmat")).read_text().splitlines()
                    if line.startswith(("diffuseTexture ", "normalmapTexture ")))
        diffuse = folder / maps["diffuseTexture"]
        normal = folder / maps["normalmapTexture"] if "normalmapTexture" in maps else None
        points, uv, faces, weight, hidden = fitted(folder, key)
        texture = bpy.data.images.load(str(diffuse))
        if alpha:
            width, height = texture.size
            if max(width, height) > 1280:
                ratio = 1280 / max(width, height)
                texture.scale(round(width * ratio), round(height * ratio))
                texture.pack()
        else:
            if key == "shoes02":
                color = np.empty(len(texture.pixels), dtype=np.float32)
                texture.pixels.foreach_get(color)
                pixels = color.reshape(-1, 4)
                gray = pixels[:, :3] @ [.32, .54, .14]
                pixels[:, :3] = gray[:, None] * [.46, .40, .39]
                texture.pixels.foreach_set(color)
            texture = packed_jpeg(texture, 768)
        mat = image_mat(label, texture, roughness, normal=normal, alpha=alpha)
        skinned_mesh(label, points, uv, faces, weight, mat)
        return hidden

    skin_dir = assets / "skins/middleage_caucasian_female"
    skin_map = next(line.split(maxsplit=1)[1] for line in next(skin_dir.glob("*.mhmat")).read_text().splitlines()
                    if line.startswith("diffuseTexture "))
    skin = bpy.data.images.load(str(skin_dir / skin_map))
    painted = skin_paint(skin, body, body_uv, body_faces, pivots["head"], [pivots["eye.L"], pivots["eye.R"]])
    painted = packed_jpeg(painted, 2048)

    # Tailor one continuous fitted shell around the actual sculpt. The front
    # darts, waist seam and skirt folds are part of the silhouette.
    shell = BVHTree.FromPolygons(body, [[v for v, _ in corners] for _, corners in body_faces])
    columns, rows = 64, 67
    cloth, cloth_uv, cloth_faces, cloth_skin = [], [], [], []

    def collar(theta):
        front = max(0, math.sin(theta))
        back = max(0, -math.sin(theta))
        return 1.408 + .024 * back ** 2 + .032 * front ** 2 - .024 * front ** 8

    def hem(theta):
        return .68 + .021 * math.sin(theta * 3 + .4) + .012 * math.cos(theta * 6)

    for row in range(rows):
        v = row / (rows - 1)
        for column in range(columns + 1):
            theta = math.tau * column / columns
            c, s = math.cos(theta), math.sin(theta)
            y = hem(theta) * (1-v) + collar(theta) * v
            centre = Vector((0., y, -.014))
            direction = Vector((c, 0., s))
            point, _, _, radius = shell.ray_cast(centre, direction)
            if y < 1.089:
                k = (1.089 - y) / .42
                skirt_x, skirt_z = (.190 + .100*k, .126 + .078*k)
                skirt_radius = ((c / skirt_x)**2 + (s / skirt_z)**2)**-.5
                radius = max(radius if point and radius < .26 else 0, skirt_radius)
            if not radius:
                radius = .104
            radial = radius + .010 + .003 * math.sin(theta * 6 + y * 1.7)
            if y > 1.365 and abs(c) > .75:
                side_limit = (.159 + .034 * (1 - float(smooth(1.365, 1.415, y)))) / abs(c)
                radial = min(radial, side_limit)
            radial += .012 * (1-float(smooth(.67, 1.16, y))) * math.sin(9*theta + y*6)
            radial += .003 * math.cos((y - 1.21) * 91) * math.exp(-((y-1.21)/.037)**2)
            surface = centre + direction * radial
            cloth.append(surface[:])
            cloth_uv.append((column / columns, v))
            top = float(smooth(1.08, 1.42, y))
            skirt_weight = 1 - float(smooth(.72, 1.07, y))
            side = "L" if c > 0 else "R"
            cloth_skin.append({"spine02": top, "root": (1 - top) * (1 - skirt_weight*.44),
                               "upperleg01." + side: (1 - top) * skirt_weight*.44})
            if row and column:
                i = len(cloth) - 1
                corners = [i - columns - 2, i - columns - 1, i, i - 1]
                cloth_faces.append(("", [(j, j) for j in reversed(corners)]))

    # Keep the fabric taut across prominent contours and settle the hips into
    # the skirt. The seam duplicates the first column's position and weights.
    drape = np.asarray(cloth).reshape(rows, columns + 1, 3)
    body_outline = drape[:, :-1, :].copy()
    for _ in range(3):
        horizontal = .45 * body_outline + .275 * (
            np.roll(body_outline, 1, axis=1) + np.roll(body_outline, -1, axis=1))
        body_outline[1:-1] = .5 * horizontal[1:-1] + .25 * (horizontal[:-2] + horizontal[2:])
        body_outline[[0, -1]] = horizontal[[0, -1]]
    drape[:, :-1, [0, 2]] = body_outline[:, :, [0, 2]]
    drape[:, -1] = drape[:, 0]

    # Bake the weave and wear so the browser carries only one fabric map.
    size = 1024
    y, x = np.mgrid[0:size, 0:size] / size
    weave = .89 + .050 * np.cos(x * 1760) * np.cos(y * 1650) + .055 * np.cos(x*130 + y*16)
    seam = np.exp(-(np.sin((x + (1-y)*.018) * math.tau * 4) / .037)**2)
    seam *= .55 + .45 * (np.cos(y * 741) > -.15)
    salt = (.5 + .21*np.cos(x*174 - y*97) * np.sin(y*155 + x*641)) * (1 - smooth(.03,.28,y))
    stain = np.exp(-((x-.205+.035*(1-y))/.037)**2) * smooth(.12,.29,y) * (1-smooth(.49,.81,y))
    value = weave[:,:,None]*[.245,.132,.151] + salt[:,:,None]*[.24,.197,.166] + seam[:,:,None]*[.09,.065,.054]
    value = value*(1-stain[:,:,None]*.6) + stain[:,:,None]*[.105,.021,.026]
    textile = bpy.data.images.new("Clerk | wine linen weave", size,size,alpha=False)
    textile.colorspace_settings.name = "Non-Color"
    textile.pixels.foreach_set(np.dstack((value,np.ones_like(x))).astype(np.float32).ravel())
    dress_mat = image_mat("Worn wine linen", packed_jpeg(textile, 1024), .77)
    dress = skinned_mesh("Tailored archive gown", drape.reshape(-1, 3), np.asarray(cloth_uv),
                         cloth_faces, cloth_skin, dress_mat)
    dress.data.materials[0].use_backface_culling = False
    trim = image_mat("Oxidised piping", None, .7, (.092, .033, .028, 1))
    for edge, ring, direction in (("Collar piping", rows-1, -1), ("Blind-stitch hem", 0, 1)):
        source = drape[ring].copy()
        lower = source * .55 + drape[ring + direction] * .45
        bulge = np.c_[np.cos(np.linspace(0, math.tau, columns+1)), np.zeros(columns+1),
                      np.sin(np.linspace(0, math.tau, columns+1))] * .002
        points = np.concatenate((source + bulge, lower + bulge), axis=0)
        count = len(source)
        binding = cloth_skin[ring*count:(ring+1)*count] * 2
        faces = [("", [(v, v) for v in (i, i+1, i+1+count, i+count)]) for i in range(columns)]
        skinned_mesh(edge, points, np.zeros((2*count, 2)), faces, binding, trim)

    hidden = asset("clothes/shoes02", "shoes02", "Archive shoes", .57)
    asset("hair/long01", "long01", "Loose hair", .70, alpha=True)
    asset("teeth/teeth_base", "teeth_base", "Teeth", .46)
    asset("eyebrows/eyebrow001", "eyebrow001", "Eyebrows", .81, alpha=True)
    asset("eyelashes/eyelashes01", "eyelashes01", "Eyelashes", .77, alpha=True)
    for index, (x, y, z) in enumerate(body):
        theta = math.atan2(z + .014, x)
        # Preserve arms and the skin at the neckline and hem.
        trunk_width = .181 + .085 * (1 - float(smooth(1.06, 1.35, y)))
        collar_margin = .018 if abs(x) > .145 else .005
        if abs(x) < trunk_width and hem(theta) + .030 < y < collar(theta) - collar_margin:
            hidden.add(index)
    face = [(label, poly) for label, poly in body_faces if not all(v in hidden for v, _ in poly)]
    skinned_mesh("Continuous face and body", body, body_uv, face, weights, image_mat("Mineral skin", painted, .62))
    eyes, uv, faces, influence, _ = fitted(data / "eyes/high-poly", "high-poly")
    eye_texture = data / "eyes/materials/brown_eye.png"
    skinned_mesh("Eyes", eyes, uv, faces, influence, image_mat("Clouded eyes", eye_texture, .30, alpha=True))

    anchor = bpy.data.objects.new("WingAnchor", None)
    bpy.context.collection.objects.link(anchor)
    anchor.parent = actor
    anchor.parent_type = "BONE"
    anchor.parent_bone = "spine02"
    bpy.context.view_layer.update()
    anchor.matrix_world = Matrix.Translation(bl(np.array([0., 1.34, -.095])))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    stage = bpy.data.collections.new("Character studio")
    scene.collection.children.link(stage)
    target = Vector((0, 0, 1.08))

    def aim(obj, position, toward):
        obj.location = position
        obj.rotation_euler = (toward - obj.location).to_track_quat("-Z", "Y").to_euler()

    for name, position, color, power, size in (
        ("Soft key", (-2.4, -3.0, 3.8), (1., .80, .66), 440, 2.7),
        ("Cold rim", (1.6, 2.0, 2.8), (.42, .66, 1.), 400, 1.8),
        ("Soft fill", (2.2, -1.6, 1.8), (.68, .80, 1.), 65, 1.6),
    ):
        source = bpy.data.lights.new(name, "AREA")
        source.energy, source.color, source.shape, source.size = power, color, "DISK", size
        light = bpy.data.objects.new(name, source)
        stage.objects.link(light)
        aim(light, position, target)
    optics = bpy.data.cameras.new("Portrait")
    camera = bpy.data.objects.new("Portrait", optics)
    stage.objects.link(camera)
    aim(camera, (.70, -4.2, 1.65), target)
    optics.lens = 65
    scene.camera = camera
    scene.world = bpy.data.worlds.new("Studio ambience")
    scene.world.color = (.057, .057, .057)
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                region = area.spaces.active.region_3d
                region.view_distance = 3.2
                region.view_location = (0., 0., 1.0)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/blender/mourning-clerk-human.blend"), compress=True)
    bpy.context.view_layer.active_layer_collection.children[stage.name].exclude = True
    bpy.ops.export_scene.gltf(filepath=str(ROOT / "dist/3d/assets/creature/mourning-clerk-human.glb"),
                             export_format="GLB", export_yup=True, export_animations=False,
                             export_cameras=False, export_lights=False,
                             use_visible=True)
    if preview:
        bpy.context.view_layer.active_layer_collection.children[stage.name].exclude = False
        scene.render.filepath = str(preview)
        scene.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("makehuman", type=Path)
    parser.add_argument("assets", type=Path)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    main(args.makehuman, args.assets, args.preview)
