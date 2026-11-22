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


def color_grade(points, body=False):
    x, y, z = points.T
    noise = .5 + .5 * np.cos(x * 41 + y * 66 + z * 43) * np.sin(x * 115 - y * 153 + z * 88)
    soot = np.clip(.48 + .28 * noise + .10 * np.sin(x * 17 + y * 27 + z * 23), 0, 1)
    if body:
        front = np.clip((z - .011) * 12, 0, 1)
        wx = .043 + .009 * np.sin(y * 126)
        temple = np.exp(-((x - wx) / (.012 + .006 * noise)) ** 2 - ((y - 1.715) / .051) ** 2) * front
        mouth = np.exp(-((x + .025 - .004*np.sin(y * 130)) / .011) ** 2 - ((y - 1.595) / .023) ** 2) * front
        stain = np.clip(temple * 1.05 + mouth * .58, 0, 1)
        neutral = np.column_stack([soot * .87 + .085, soot * .86 + .097, soot * .81 + .115])
        blood = np.array([.43, .124, .080])
        return neutral * (1 - stain[:, None]) + blood * stain[:, None]
    hips = np.exp(-((y - .86) / .240) ** 2 - (x / .18) ** 2)
    dirt = soot * (.95 - .14 * hips)
    return np.column_stack([dirt * .96, dirt * .91, dirt * .84])


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

    def image(self, origin, size, quality=85, alpha=False, treatment=None):
        with Image.open(origin) as source:
            source.thumbnail((size, size), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            if alpha:
                source.convert("RGBA").save(output, "PNG", optimize=True)
            else:
                rgb = source.convert("RGB")
                if treatment == "skin":
                    rgb = ImageEnhance.Color(rgb).enhance(.71)
                elif treatment == "roof":
                    rgb = replace_roof_logo(rgb)
                rgb.save(output, "JPEG", quality=quality, optimize=True, subsampling=0)
        picture = self.add("images", dict(bufferView=self.view(output.getvalue()),
                           mimeType="image/png" if alpha else "image/jpeg"))
        return self.add("textures", dict(source=picture, sampler=0))

    def material(self, name, diffuse, normal=None, roughness=.84, tint=None, alpha=False, treatment=None):
        map_id = self.image(diffuse, 2048 if treatment == "skin" else 1024,
                            alpha=alpha, treatment=treatment)
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
    skin_mat = glb.material("Weathered skin", skin_path, roughness=.89, treatment="skin")
    base_normals = vertex_normals(human, visible)
    base_color = color_grade(meters(human), body=True)

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
                                treatment="roof" if department == "roof" else None)
        gauze = color_grade(cloth)
        hidden |= shoe_mask
        # This is the author-supplied clothing mask. Preserve remaining skin to
        # the edge of each opening, including face/hands and exposed neck.
        body = [(tag, face) for tag, face in visible if not all(v in hidden for v, _ in face)]
        node(f"Skin {department}", glb.mesh(f"Skin {department}", skin_mat, meters(human), base_uv, body,
             weighted, normals=base_normals, color=base_color), uniform)
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
