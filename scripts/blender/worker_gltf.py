"""Keep the game's bind-pose axes and skin weights when baking Blender edits."""
import json
import struct
from pathlib import Path

import numpy as np

TYPES = {5121: "u1", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class WorkerFile:
    def __init__(self, path):
        raw = Path(path).read_bytes()
        size = struct.unpack_from("<I", raw, 12)[0]
        self.doc = json.loads(raw[20:20 + size])
        self.data = bytearray(raw[28 + size:])
        skin = self.doc["skins"][0]
        self.bone_ids = {self.doc["nodes"][n]["name"]: i for i, n in enumerate(skin["joints"])}

    def read(self, idx):
        a = self.doc["accessors"][idx]
        view = self.doc["bufferViews"][a["bufferView"]]
        size = WIDTHS[a["type"]]
        return np.frombuffer(
            self.data, dtype=TYPES[a["componentType"]], count=a["count"] * size,
            offset=view.get("byteOffset", 0) + a.get("byteOffset", 0)
        ).reshape(-1, size).copy()

    def replace(self, idx, values):
        acc = self.doc["accessors"][idx]
        view = self.doc["bufferViews"][acc["bufferView"]]
        raw = np.asarray(values, dtype=TYPES[acc["componentType"]]).tobytes()
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        self.data[start:start + len(raw)] = raw
        if "min" in acc:
            acc["min"] = values.min(axis=0).tolist()
            acc["max"] = values.max(axis=0).tolist()

    def add(self, section, item):
        self.doc[section].append(item)
        return len(self.doc[section]) - 1

    def blob(self, data, target=None):
        self.data.extend(b"\x00" * (-len(self.data) % 4))
        view = dict(buffer=0, byteOffset=len(self.data), byteLength=len(data))
        if target:
            view["target"] = target
        self.data.extend(data)
        return self.add("bufferViews", view)

    def accessor(self, array, kind, component=5126, target=34962, bounds=False, normalized=False):
        values = np.array(array, dtype=TYPES[component]).reshape(-1, WIDTHS[kind])
        acc = dict(bufferView=self.blob(values.tobytes(), target), componentType=component,
                   count=len(values), type=kind)
        if bounds:
            acc.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
        if normalized:
            acc["normalized"] = True
        return self.add("accessors", acc)

    def texture(self, name, data):
        image = self.add("images", dict(name=name, mimeType="image/png", bufferView=self.blob(data)))
        return self.add("textures", dict(source=image, sampler=0))

    def image(self, material):
        mat = self.doc["materials"][material]
        t = mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]
        img = self.doc["images"][self.doc["textures"][t]["source"]]
        view = self.doc["bufferViews"][img["bufferView"]]
        at = view.get("byteOffset", 0)
        return bytes(self.data[at:at + view["byteLength"]])

    def repaint(self, material, data, mime):
        mat = self.doc["materials"][material]
        tex = mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]
        img = self.doc["images"][self.doc["textures"][tex]["source"]]
        view = self.doc["bufferViews"][img["bufferView"]]
        view.update(byteOffset=len(self.data), byteLength=len(data))
        img["mimeType"] = mime
        self.data.extend(data)

    def attach(self, name, parent, material, points, normals, colors, bone_ids, bone_weights, indices, uv):
        attrs = dict(POSITION=self.accessor(points, "VEC3", bounds=True),
                     NORMAL=self.accessor(normals, "VEC3"),
                     TEXCOORD_0=self.accessor(uv, "VEC2"),
                     JOINTS_0=self.accessor(bone_ids, "VEC4", 5123),
                     WEIGHTS_0=self.accessor(bone_weights, "VEC4"))
        # Three-component unsigned-byte colors need a four-byte stride for glTF vertex attributes.
        rgb = np.rint(np.clip(colors, 0, 1) * 255).astype("u1")
        rgba = np.column_stack((rgb, np.full(len(rgb), 255, dtype="u1")))
        attrs["COLOR_0"] = self.accessor(rgba, "VEC4", 5121, normalized=True)
        prim = dict(attributes=attrs, indices=self.accessor(indices, "SCALAR", 5123, 34963), material=material)
        mesh = self.add("meshes", dict(name=name, primitives=[prim]))
        idx = self.add("nodes", dict(name=name, mesh=mesh, skin=0))
        self.doc["nodes"][parent].setdefault("children", []).append(idx)

    def save(self, path):
        packed = bytearray()
        for view in self.doc["bufferViews"]:
            packed.extend(b"\x00" * (-len(packed) % 4))
            previous = view.get("byteOffset", 0)
            view["byteOffset"] = len(packed)
            packed.extend(self.data[previous:previous + view["byteLength"]])
        self.data = packed
        self.data.extend(b"\x00" * (-len(self.data) % 4))
        doc = self.doc
        doc["asset"]["generator"] = "Blender — LAST LIGHT wardrobe and facial sculpt"
        doc["buffers"][0]["byteLength"] = len(self.data)
        raw = json.dumps(doc, separators=(",", ":")).encode()
        raw += b" " * (-len(raw) % 4)
        Path(path).write_bytes(struct.pack("<4sII", b"glTF", 2, 28 + len(raw) + len(self.data)) +
                               struct.pack("<I4s", len(raw), b"JSON") + raw +
                               struct.pack("<I4s", len(self.data), b"BIN\x00") + self.data)
