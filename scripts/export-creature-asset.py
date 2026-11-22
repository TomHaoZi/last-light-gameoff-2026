"""Build late-worker.glb from the MakeHuman source checkout and CC0 System Assets.

Usage: python3 scripts/export-creature-asset.py <makehuman/data> <unpacked CC0 asset directory>
Requires NumPy and Pillow only when authoring the binary. Runtime needs neither.
"""
import argparse
import io
import json
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont


TITLE = "LAST LIGHT — Late Worker"
OUTFITS = (
    ("boiler", "male_worksuit01"),
    ("office", "male_elegantsuit01"),
    ("roof", "male_casualsuit02"),
)

# Approximate worn pigments in linear light, keeping each department readable.
UNIFORM_WEAR = {
    "boiler": ((.72, .63, .56), (.25, .14, .075), (.081, .038, .022)),
    "office": ((.86, .80, .72), (.31, .29, .24), (.066, .033, .033)),
    "roof": ((.80, .83, .76), (.27, .33, .30), (.060, .044, .038)),
}
SKIN_WEAR = {
    "boiler": ((.83, .73, .62), (.13, .043, .023), .052, 1.743, .118, -.17, .18),
    "office": ((.81, .75, .74), (.23, .084, .069), -.047, 1.693, .079, .22, .75),
    "roof": ((.73, .82, .79), (.145, .069, .043), .036, 1.709, .064, .44, .48),
}


def read_obj(path):
    positions, uvs, polygons = [], [], []
    group = ""
    for line in path.read_text().splitlines():
        parts = line.split()
        if not parts:
            continue
        tag, *values = parts
        if tag == "v":
            positions.append(list(map(float, values[:3])))
        elif tag == "vt":
            u, v = map(float, values[:2])
            uvs.append([u, 1 - v])
        elif tag == "g":
            group = values[0]
        elif tag == "f":
            corners = [tuple(int(index) - 1 for index in value.split("/")[:2]) for value in values]
            for end in range(2, len(corners)):
                polygons.append((group, [corners[0], corners[end - 1], corners[end]]))
    return np.array(positions), np.array(uvs), polygons


def target(path, vertex_count):
    result = np.zeros((vertex_count, 3))
    for line in path.read_text().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        index, *offset = line.split()
        result[int(index)] = list(map(float, offset))
    return result


def vertex_normals(positions, faces):
    indices = np.array([[index for index, _ in corners] for _, corners in faces])
    a, b, c = [positions[indices[:, i]] for i in range(3)]
    normal = np.cross(b - a, c - a)
    normals = np.zeros_like(positions)
    for corner in range(3):
        np.add.at(normals, indices[:, corner], normal)
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    np.divide(normals, length, out=normals, where=length > 0)
    normals[length[:, 0] == 0] = (0, 1, 0)
    return normals


def load_attachment(human, base_weights, map_file):
    mapping, mask = [], set()
    scale = np.ones(3)
    block = ""
    for line in map_file.read_text().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        words = line.split()
        if words[0] in ("x_scale", "y_scale", "z_scale"):
            axis = "xyz".index(words[0][0])
            first, second = map(int, words[1:3])
            scale[axis] = abs(human[first, axis] - human[second, axis]) / float(words[3])
        elif words[0] == "verts":
            block = "verts"
        elif words[0] == "delete_verts":
            block = "delete"
        elif block == "verts":
            if len(words) == 1:
                index = int(words[0])
                mapping.append(([index], [1.0], [0.0, 0.0, 0.0]))
            elif len(words) >= 9:
                mapping.append((list(map(int, words[:3])), list(map(float, words[3:6])), list(map(float, words[6:9]))))
        elif block == "delete":
            i = 0
            while i < len(words):
                start = int(words[i])
                if i + 2 < len(words) and words[i + 1] == "-":
                    mask.update(range(start, int(words[i + 2]) + 1))
                    i += 3
                else:
                    mask.add(start)
                    i += 1
    positions = []
    weights = []
    for indices, parallels, offset in mapping:
        positions.append(np.asarray(parallels) @ human[indices] + np.asarray(offset) * scale)
        merged = defaultdict(float)
        for index, fraction in zip(indices, parallels):
            for bone_index, amount in base_weights[index].items():
                merged[bone_index] += max(0.0, fraction) * amount
        weights.append(merged)
    return np.array(positions), weights, mask


def smooth(edge0, edge1, value):
    progress = np.clip((value - edge0) / (edge1 - edge0), 0, 1)
    return progress * progress * (3 - 2 * progress)


def stain_along_gravity(x, y, root_x, root_y, width, length, lean):
    age = (root_y - y) / length
    broken_edge = .003 * np.sin(y * 142 + x * 218) + .002 * np.cos(y * 277 - x * 170)
    center = root_x + (root_y - y) * lean
    body = 1 - smooth(.46, 1.08, np.abs(x - center + broken_edge) / width)
    return body * smooth(-.14, .12, age) * (1 - smooth(.49, 1.08, age))


def color_grade(points, department):
    """Keep the imported texture, adding broad soiling to the fitted cloth."""
    x, y, z = points.T
    pigment, dust, oil = (np.array(color) for color in UNIFORM_WEAR[department])
    texture = .89 + .08 * np.sin(x * 29 + y * 20 + z * 28) * np.cos(y * 45 - z * 18)
    front = smooth(.024, .094, z)
    knees = np.exp(-((y - .505) / .112) ** 2) * front
    cuffs = smooth(.295, .48, np.abs(x)) * np.exp(-((y - 1.16) / .22) ** 2)
    boots = 1 - smooth(.08, .34, y)
    dust_weight = np.clip(.12 + knees * .32 + cuffs * .27 + boots * .39, 0, .64)
    dark = stain_along_gravity(x, y, -.095, 1.407, .042, .34, .14)
    dark += stain_along_gravity(x, y, .086, 1.23, .024, .39, -.15) * .58
    dark *= front * (.43 if department == "roof" else .73)
    color = texture[:, None] * pigment * (1 - dust_weight[:, None]) + dust * dust_weight[:, None]
    dark = np.clip(dark, 0, .72)
    return color * (1 - dark[:, None]) + oil * dark[:, None]


def skin_grade(points, department):
    """Bake each worker's injuries along the face instead of tinting the whole model."""
    x, y, z = points.T
    pigment, dry, root_x, root_y, length, lean, stubble = SKIN_WEAR[department]
    front = smooth(.065, .117, z)
    pigment = np.array(pigment)
    texture = .80 + .075 * np.sin(x * 51 + y * 75 + z * 31) * np.cos(x * 77 - y * 92)
    socket = np.exp(-((np.abs(x) - .029) / .028) ** 2 - ((y - 1.669) / .021) ** 2) * front
    neck = np.exp(-((y - 1.532) / .073) ** 2) * (1 - smooth(.065, .125, np.abs(x)))
    skin = pigment * (texture * (1 - .30 * socket - .27 * neck))[:, None]
    behind = 1 - smooth(.007, .12, z)
    temple = np.exp(-((np.abs(x) - .048) / .016) ** 2)
    hairline = 1.757 - .067 * behind + .020 * temple + .0025 * np.sin(x * 186 + z * 141)
    hair = smooth(hairline - .004, hairline + .006, y) * stubble
    hair_color = np.array([.178, .153, .136]) * texture[:, None]
    skin = skin * (1 - hair[:, None]) + hair_color * hair[:, None]
    edge = stain_along_gravity(x, y, root_x, root_y, .020, length, lean) * front
    center = stain_along_gravity(x, y, root_x + .005, root_y, .009, length * .88, lean) * front
    lip = np.exp(-((x + root_x * .46) / .018) ** 2 - ((y - 1.609) / .017) ** 2) * front
    weight = np.clip(.55 * edge + .40 * center + .34 * lip, 0, .87)
    return skin * (1 - weight[:, None]) + np.array(dry) * weight[:, None]


def face_shape(points, department):
    """Alter cheek and chin volumes below the brow, keeping rig and eye sockets intact."""
    x, y, z = points.T
    side, depth, chin = {
        "boiler": (1, .008, -.0035),
        "office": (-1, .012, .0030),
        "roof": (1, .006, .0045),
    }[department]
    forward = smooth(.064, .109, z)
    cheek = np.exp(-((x - side * .047) / .017) ** 2 - ((y - 1.636) / .021) ** 2) * forward
    jaw = np.exp(-(x / .029) ** 2 - ((y - 1.588) / .015) ** 2) * forward
    result = points.copy()
    result[:, 0] += side * chin * jaw
    result[:, 2] += .003 * jaw - depth * cheek
    return result


def texture_positions(size, points, uv, faces):
    """Interpolate the bind-pose surface onto its existing texture chart."""
    width, height = size
    coordinates = uv * (width, height)
    result = np.full((height, width, 3), np.nan, dtype=np.float32)
    for _, corners in faces:
        points_ids, uv_ids = zip(*corners)
        a, b, c = coordinates[list(uv_ids)]
        ab, ac = b - a, c - a
        area = ab[0] * ac[1] - ab[1] * ac[0]
        if abs(area) < 1e-7:
            continue
        lo = np.maximum(0, np.floor(np.minimum(np.minimum(a, b), c)).astype(int))
        hi = np.minimum((width, height), np.ceil(np.maximum(np.maximum(a, b), c)).astype(int))
        if np.any(lo >= hi):
            continue
        row, col = np.ogrid[lo[1]:hi[1], lo[0]:hi[0]]
        u = ((col + .5 - a[0]) * ac[1] - (row + .5 - a[1]) * ac[0]) / area
        v = (ab[0] * (row + .5 - a[1]) - ab[1] * (col + .5 - a[0])) / area
        inside = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6)
        rows, columns = np.nonzero(inside)
        pa, pb, pc = points[list(points_ids)]
        result[lo[1] + rows, lo[0] + columns] = (
            pa + u[inside, None] * (pb - pa) + v[inside, None] * (pc - pa)
        )
    return result


def paint_skin(image, points, uv, faces):
    # Draw pore-scale freckles and eyelid/cheek contours in the bind chart.
    rgb = ImageEnhance.Color(image).enhance(.69)
    data = np.asarray(rgb).astype(np.float32)
    chart = texture_positions(image.size, points, uv, faces)
    valid = np.isfinite(chart[:, :, 0])
    x, y, z = chart[valid].T
    front = smooth(.088, .127, z)
    side = np.abs(x)
    eye = np.exp(-((side - .030) / .020) ** 2)
    socket = eye * (np.exp(-((y - 1.669 - (side - .029) * .14) / .005) ** 2) * .21
                    - np.exp(-((y - 1.662 - (side - .029) * .14) / .004) ** 2) * .07)
    furrows = np.zeros_like(x)
    for crest, center, span, amplitude in [(1.725, -.017, .040, .13), (1.736, .014, .030, .10), (1.752, -.008, .026, .075)]:
        crease_y = crest + np.sin(x * 106 + crest * 49) * .0027 - x * .047
        wrinkle = np.exp(-((y - crease_y) / .00115) ** 2)
        furrows += wrinkle * amplitude * np.exp(-((x - center) / span) ** 4)
    nasolabial = np.exp(-((side - (.025 + (y - 1.632) * .35)) / .0024) ** 2
                        - ((y - 1.631) / .019) ** 2)
    specks = np.maximum(0, np.sin(x * 292 + y * 653 + z * 192) * np.cos(x * 621 - y * 312)) ** 13
    cheek = np.exp(-((side - .046) / .023) ** 2 - ((y - 1.650) / .043) ** 2)
    grade = 1 - front * (furrows + .12 * nasolabial + socket + specks * cheek * .23)
    data[valid] *= grade[:, None]
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)))


def paint_badge(values, x, y, front, department):
    if department != "boiler":
        return values
    text, color = "B2 / STEAM", (155, 130, 90)
    left, top, width, height = -.039, 1.329, .077, .034
    # A small cloth tag worn over the chest, with a dim stitched border.
    badge = Image.new("RGBA", (104, 38))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((1, 1, 102, 36), radius=5, fill=(32, 39, 37, 247), outline=(*color, 255), width=1)
    draw.text((52, 19), text, anchor="mm", fill=(*color, 255), font=ImageFont.load_default(size=15))
    sample_x = np.floor((x - left) / width * 104).astype(int)
    sample_y = np.floor((top - y + (x - left - width / 2) * .079) / height * 38).astype(int)
    mask = (sample_x >= 0) & (sample_x < 104) & (sample_y >= 0) & (sample_y < 38) & (front > .9)
    stamp = np.asarray(badge)[sample_y[mask], sample_x[mask]]
    worn = .08 * np.sin(x[mask] * 861 + y[mask] * 424) ** 9
    opacity = stamp[:, 3:4] / 255 * (.90 + worn[:, None])
    values[mask] = values[mask] * (1 - opacity) + stamp[:, :3] * opacity
    return values


def paint_uniform(image, points, uv, faces, department):
    if department == "roof":
        image = replace_roof_logo(image)
    data = np.asarray(image).astype(np.float32)
    chart = texture_positions(image.size, points, uv, faces)
    valid = np.isfinite(chart[:, :, 0])
    x, y, z = chart[valid].T
    front = smooth(.023, .099, z)
    height = np.clip(y / 1.60, 0, 1)
    grain = np.sin(x * 389 + z * 397) * np.cos(y * 464 + x * 261)
    abrasion = np.maximum(0, np.sin(y * 54 + x * 49 + z * 23) * np.cos(x * 213 - y * 133)) ** 4
    grit = (.045 * grain + .12 * abrasion) * (1 - .52 * height)
    if department == "roof":
        # Rain lifts dirt up at the waist and runs down one side of the jacket.
        wet = stain_along_gravity(x, y, -.118, 1.323, .053, .40, .13) * front * .44
        wet += np.exp(-((y - .937 + x * .12) / .056) ** 2) * front * .16
    else:
        wet = stain_along_gravity(x, y, -.105, 1.362, .030, .45, .125) * front
        wet += stain_along_gravity(x, y, .083, 1.165, .017, .39, -.12) * front * .65
    wet = np.clip(wet, 0, 1)
    wear = grit * (.82 if department == "office" else 1)
    chest = np.exp(-((x + .034) / .126) ** 2 - ((y - 1.26) / .126) ** 2)
    dirt = .55 * wet + (.12 if department == "boiler" else .09) * chest
    values = data[valid] * (1 + wear - dirt)[:, None]
    values += np.array([24, 8, -4]) * wet[:, None]
    data[valid] = paint_badge(values, x, y, front, department)
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)))


def replace_roof_logo(image):
    """Keep the original knit texture and cover its vendor logo with a workplace label."""
    width, height = image.size
    x0, y0, x1, y1 = map(int, (.49 * width, .108 * height, .632 * width, .243 * height))
    size = x1 - x0, y1 - y0
    replacement = image.crop((x0, y0 + int(.16 * height), x1, y1 + int(.16 * height)))
    y, x = np.mgrid[-1:1:complex(size[1]), -1:1:complex(size[0])]
    fade = np.clip((1.05 - np.hypot(x, y)) * 8.2, 0, 1)
    mask = Image.fromarray(np.asarray(fade * 255, dtype=np.uint8))
    image.paste(replacement, (x0, y0), mask)
    labels = ImageDraw.Draw(image)
    anchor = int(.597 * width), int(.154 * height)
    box = [anchor[0] - 25, anchor[1] - 8, anchor[0] + 25, anchor[1] + 9]
    labels.rounded_rectangle(box, radius=2, fill=(52, 62, 54), outline=(71, 81, 67))
    labels.text((anchor[0] - 19, anchor[1] - 5), "ROOF 03", fill=(169, 161, 129), font=ImageFont.load_default())
    return image


class Glb:
    def __init__(self):
        self.data = bytearray()
        self.doc = dict(asset=dict(version="2.0", generator="LAST LIGHT MakeHuman outfit export"),
                        scene=0, scenes=[dict(nodes=[])], nodes=[], meshes=[], skins=[], accessors=[],
                        bufferViews=[], buffers=[], materials=[], images=[], textures=[],
                        samplers=[dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)])

    def add(self, key, obj):
        append = self.doc[key]
        append.append(obj)
        return len(append) - 1

    def view(self, data, target=None):
        while len(self.data) % 4:
            self.data.append(0)
        item = dict(buffer=0, byteOffset=len(self.data), byteLength=len(data))
        if target:
            item["target"] = target
        self.data.extend(data)
        return self.add("bufferViews", item)

    def accessor(self, entries, kind, component=5126, target=None, bounds=False):
        dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4"}[component]
        array = np.array(entries, dtype=dtype)
        obj = dict(bufferView=self.view(array.tobytes(), target), componentType=component,
                   count=len(array), type=kind)
        if bounds:
            obj["min"] = array.min(axis=0).tolist()
            obj["max"] = array.max(axis=0).tolist()
        return self.add("accessors", obj)

    def image(self, origin, size, quality=85, alpha=False, paint=None):
        with Image.open(origin) as source:
            source.thumbnail((size, size), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            if alpha:
                source.convert("RGBA").save(output, "PNG", optimize=True)
            else:
                rgb = source.convert("RGB")
                if paint:
                    rgb = paint(rgb)
                rgb.save(output, "JPEG", quality=quality, optimize=True, subsampling=0)
        picture = self.add("images", dict(bufferView=self.view(output.getvalue()),
                           mimeType="image/png" if alpha else "image/jpeg"))
        return self.add("textures", dict(source=picture, sampler=0))

    def material(self, name, diffuse, normal=None, roughness=.84, tint=None, alpha=False, size=1024, paint=None):
        map_id = self.image(diffuse, size, alpha=alpha, paint=paint)
        pbr = dict(baseColorTexture=dict(index=map_id), metallicFactor=0, roughnessFactor=roughness)
        if tint:
            pbr["baseColorFactor"] = tint
        opts = dict(name=name, pbrMetallicRoughness=pbr)
        if alpha:
            opts["alphaMode"] = "MASK"
            opts["alphaCutoff"] = .5
        if normal and normal.exists():
            texture = self.image(normal, 1024, 90)
            opts["normalTexture"] = dict(index=texture, scale=.67)
        return self.add("materials", opts)

    def mesh(self, name, material, positions, uvs, faces, weights, normals=None, color=None):
        normals = vertex_normals(positions, faces) if normals is None else normals
        joint_ids, joint_weights = [], []
        for options in weights:
            strength = sorted(options.items(), key=lambda item: item[1], reverse=True)[:4]
            strength = [(joint, weight) for joint, weight in strength if weight > 0.0005]
            strength = strength or [(0, 1)]
            total = sum(weight for _, weight in strength)
            joint_ids.append([joint for joint, _ in strength] + [0] * (4 - len(strength)))
            joint_weights.append([weight / total for _, weight in strength] + [0] * (4 - len(strength)))
        known, vertex_ids, uv_ids, order = {}, [], [], []
        for _, triangle in faces:
            for corner in triangle:
                if corner not in known:
                    known[corner] = len(known)
                    vertex_ids.append(corner[0])
                    uv_ids.append(corner[1])
                order.append(known[corner])
        attrs = dict(POSITION=self.accessor(positions[vertex_ids], "VEC3", target=34962, bounds=True),
                     NORMAL=self.accessor(normals[vertex_ids], "VEC3", target=34962),
                     TEXCOORD_0=self.accessor(uvs[uv_ids], "VEC2", target=34962),
                     JOINTS_0=self.accessor(np.asarray(joint_ids)[vertex_ids], "VEC4", 5123, 34962),
                     WEIGHTS_0=self.accessor(np.asarray(joint_weights)[vertex_ids], "VEC4", target=34962))
        if color is not None:
            attrs["COLOR_0"] = self.accessor(color[vertex_ids], "VEC3", target=34962)
        primitive = dict(attributes=attrs, material=material,
                         indices=self.accessor(order, "SCALAR", 5123 if len(known) <= 65535 else 5125, 34963))
        return self.add("meshes", dict(name=name, primitives=[primitive]))

    def save(self, path):
        while len(self.data) % 4:
            self.data.append(0)
        self.doc["buffers"].append(dict(byteLength=len(self.data)))
        doc = json.dumps(self.doc, separators=(",", ":")).encode("utf-8")
        doc += b" " * ((4 - len(doc) % 4) % 4)
        header = struct.pack("<4sII", b"glTF", 2, 28 + len(doc) + len(self.data))
        result = header + struct.pack("<I4s", len(doc), b"JSON") + doc
        result += struct.pack("<I4s", len(self.data), b"BIN\0") + self.data
        path.parent.mkdir(exist_ok=True, parents=True)
        path.write_bytes(result)
        print(f"{path} ({len(result)//1024} KiB)")


def run(makehuman, assets, output):
    glb = Glb()
    base, base_uv, groups = read_obj(makehuman / "3dobjs/base.obj")
    table = makehuman / "targets/macrodetails"
    human = base + .82 * target(table / "caucasian-male-old.target", len(base))
    human += .18 * target(table / "caucasian-male-young.target", len(base))
    human += .27 * target(makehuman / "targets/head/head-fat-decr.target", len(base))
    visible = [(tag, face) for tag, face in groups if tag == "body"]
    base_vertex_ids = {vertex for _, face in visible for vertex, _ in face}
    floor = min(human[v, 1] for v in base_vertex_ids)

    def meters(points):
        return (points - np.array([0, floor - .08, 0])) * .104

    rig = json.loads((makehuman / "rigs/default.mhskel").read_text())
    avatar = glb.add("nodes", dict(name=TITLE, children=[]))
    glb.doc["scenes"][0]["nodes"].append(avatar)
    bone_names = ["root", *(name for name in rig["bones"] if name != "root")]
    bone_ids = {name: i for i, name in enumerate(bone_names)}
    bone_pivots = {}
    for name in bone_names:
        joint = rig["bones"][name]["head"]
        bone_pivots[name] = meters(human[rig["joints"][joint]].mean(axis=0))
    matrices = []
    for name in bone_names:
        pivot = bone_pivots[name]
        data = np.eye(4)
        data[3, :3] = -pivot  # Stored in glTF column-major order.
        matrices.append(data.reshape(-1))
        parent = rig["bones"][name]["parent"]
        local = pivot - bone_pivots[parent] if parent else pivot
        glb.add("nodes", dict(name=name, translation=local.tolist(), children=[]))
    bone_nodes = list(range(1, 1 + len(bone_names)))
    for name in bone_names:
        parent = rig["bones"][name]["parent"]
        parent_node = 1 + bone_ids[parent] if parent else avatar
        glb.doc["nodes"][parent_node]["children"].append(1 + bone_ids[name])
    weighted = [defaultdict(float) for _ in base]
    raw_weights = json.loads((makehuman / "rigs/default_weights.mhw").read_text())["weights"]
    for bone, entries in raw_weights.items():
        for vertex, influence in entries:
            weighted[vertex][bone_ids[bone]] = influence
    glb.add("skins", dict(name="MakeHuman humanoid", inverseBindMatrices=glb.accessor(matrices, "MAT4"),
                           skeleton=1, joints=bone_nodes))

    def attachment(directory, filename):
        _, uvs, triangles = read_obj(directory / f"{filename}.obj")
        positions, weights, mask = load_attachment(human, weighted, directory / f"{filename}.mhclo")
        return meters(positions), uvs, triangles, weights, mask

    def node(name, mesh, parent=avatar):
        target_node = glb.add("nodes", dict(name=name, mesh=mesh, skin=0))
        glb.doc["nodes"][parent].setdefault("children", []).append(target_node)

    skin_path = assets / "skins/old_caucasian_male/old_lightskinned_male_diffuse.png"
    skin_points = meters(human)
    skin_mat = glb.material("Weathered skin", skin_path, roughness=.83, size=2048,
                           paint=lambda rgb: paint_skin(rgb, skin_points, base_uv, visible))

    shoe_dir = assets / "clothes/shoes04"
    feet, shoe_uv, shoe_faces, shoe_weights, shoe_mask = attachment(shoe_dir, "shoes04")
    shoe_mat = glb.material("Service boots", shoe_dir / "shoes04_diffuse.png",
                           shoe_dir / "shoes04_normal.png", .93, [.54, .54, .53,1])
    node("Service boots", glb.mesh("Service boots", shoe_mat, feet, shoe_uv, shoe_faces, shoe_weights))

    for department, suit in OUTFITS:
        suit_dir = assets / "clothes" / suit
        uniform = glb.add("nodes", dict(name=f"uniform_{department}"))
        glb.doc["nodes"][avatar]["children"].append(uniform)
        cloth, uv, faces, weights, hidden = attachment(suit_dir, suit)
        cloth_mat = glb.material(f"Uniform {department}", suit_dir / f"{suit}_diffuse.png",
                                suit_dir / f"{suit}_normal.png", .91,
                                [.58, .65, .64, 1] if department == "roof" else None,
                                paint=lambda rgb: paint_uniform(rgb, cloth, uv, faces, department))
        gauze = color_grade(cloth, department)
        hidden |= shoe_mask
        # This is the author-supplied clothing mask. Preserve remaining skin to
        # the edge of each opening, including face/hands and exposed neck.
        body = [(tag, face) for tag, face in visible if not all(v in hidden for v, _ in face)]
        shaped = face_shape(skin_points, department)
        node(f"Skin {department}", glb.mesh(f"Skin {department}", skin_mat, shaped, base_uv, body,
             weighted, normals=vertex_normals(shaped, visible), color=skin_grade(shaped, department)), uniform)
        node(f"Clothing {department}", glb.mesh(f"Clothing {department}", cloth_mat, cloth, uv, faces,
             weights, color=gauze), uniform)

    eye_dir = makehuman / "eyes/high-poly"
    eyes, uv, faces, weights, _ = attachment(eye_dir, "high-poly")
    eye_mat = glb.material("Eyes", makehuman / "eyes/materials/brown_eye.png", roughness=.42,
                            tint=[.54, .55, .50, 1], alpha=True)
    node("Eyes", glb.mesh("Eyes", eye_mat, eyes, uv, faces, weights))

    teeth_dir = assets / "teeth/teeth_base"
    teeth, uv, faces, weights, _ = attachment(teeth_dir, "teeth_base")
    tooth_mat = glb.material("Teeth", teeth_dir / "teeth.png", roughness=.83, tint=[.46,.42,.36,1])
    node("Teeth", glb.mesh("Teeth", tooth_mat, teeth, uv, faces, weights))
    for entry in glb.doc["nodes"]:
        if entry.get("children") == []:
            del entry["children"]
    glb.save(output)


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("makehuman", type=Path)
    args.add_argument("assets", type=Path)
    args.add_argument("--output", default=Path("dist/3d/assets/creature/late-worker.glb"), type=Path)
    params = args.parse_args()
    run(params.makehuman, params.assets, params.output)
