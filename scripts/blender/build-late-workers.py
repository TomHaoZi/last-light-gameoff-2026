"""Sculpt and dress LAST LIGHT's three revenants in Blender.

blender -b -P scripts/blender/build-late-workers.py -- <rc13/base.glb> <output.glb> [<studio.blend>]

Input is the previous fitted MakeHuman export. The game relies on its exact bind axes
for additive world-space finger animation. Bake Blender edits back into that same
skin instead of letting an interchange importer pick new bone rolls.
"""
import math
import os
import struct
import sys
import tempfile
import zlib
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from worker_gltf import WorkerFile
from worker_makeup import aged_enamel, paint_clothes, paint_eyes, paint_skin

TAU = 2 * math.pi
DEPARTMENTS = ("boiler", "office", "roof")
HEAD = "head"
bpy.ops.wm.read_factory_settings(use_empty=True)


def gl_to_bl(point):
    x, y, z = point
    return x, -z, y


def bl_to_gl(point):
    x, y, z = point
    return x, z, -y


def linear(hexcode):
    rgb = np.array(tuple(bytes.fromhex(hexcode)), dtype=float) / 255
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)


class Surface:
    def __init__(self, reader, primitive):
        self.attr = primitive["attributes"]
        self.points = reader.read(self.attr["POSITION"])
        self.tri = reader.read(primitive["indices"]).reshape(-1, 3)
        self.joints = reader.read(self.attr["JOINTS_0"])
        self.weights = reader.read(self.attr["WEIGHTS_0"])
        self.rebuild()

    def rebuild(self):
        self.tree = BVHTree.FromPolygons(self.points, self.tri, all_triangles=True)

    def front(self, x, y):
        p, _, idx, _ = self.tree.ray_cast((x, y, .55), (0, 0, -1))
        if p is None:
            raise ValueError(f"Projection outside worker at {x:.4f}, {y:.4f}")
        return p

    def influence(self, position):
        hit, _, index, _ = self.tree.find_nearest(position)
        triangle = self.tri[index]
        a, b, c = (Vector(self.points[i]) for i in triangle)
        mix = barycentric_transform(hit, a, b, c, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        total = {}
        for vertex, factor in zip(triangle, mix):
            for joint, weight in zip(self.joints[vertex], self.weights[vertex]):
                total[int(joint)] = total.get(int(joint), 0) + max(0, factor) * weight
        pairs = sorted(total.items(), key=lambda p: -p[1])[:4]
        amount = sum(w for _, w in pairs)
        return ([i for i, _ in pairs] + [0] * (4 - len(pairs)),
                [w / amount for _, w in pairs] + [0.] * (4 - len(pairs)))


def rounded_normals(points, triangles):
    edges = np.cross(points[triangles[:, 1]] - points[triangles[:, 0]],
                     points[triangles[:, 2]] - points[triangles[:, 0]])
    # Share normals across UV seams in the same continuous shell.
    _, mapping = np.unique(np.rint(points * 100000).astype(np.int32), axis=0, return_inverse=True)
    total = np.zeros((mapping.max() + 1, 3))
    for corner in range(3):
        np.add.at(total, mapping[triangles[:, corner]], edges)
    normals = total[mapping]
    return normals / np.maximum(1e-10, np.linalg.norm(normals, axis=1, keepdims=True))


def deform(reader, skin, outfit, department):
    sign = (-1, 1, -1)[department]
    x, y, z = skin.points.T.copy()
    front = np.clip((z - .045) / .065, 0, 1)
    gaussian = lambda cx, cy, rx, ry: np.exp(-((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2) * front
    temple = gaussian(sign * .068, 1.715, .021, .039)
    high_cheek = gaussian(sign * .048, 1.663, .023, .013)
    hollow = gaussian(sign * .044, 1.640, .026, .017)
    brow = gaussian(-sign * .029, 1.704, .026, .013)
    mouth = gaussian(sign * .023, 1.615, .016, .017)
    browbone = gaussian(sign * .041, 1.704, .027, .011)
    nose = gaussian(.003, 1.658, .015, .023)
    throat = gaussian(0, 1.556, .036, .028)
    # Move continuous skin topology around facial landmarks. Keep eyeballs and
    # the lips' hinge registered with their original independently animated bones.
    facial = skin.points.copy()
    facial[:, 2] += -.006 * temple + .006 * high_cheek - .009 * hollow + .0042 * browbone + .006 * brow
    facial[:, 0] += sign * (.004 * nose + .0034 * mouth - .004 * temple)
    facial[:, 1] += -.004 * brow + .006 * mouth + .0025 * browbone
    facial[:, 2] += (.005 if department == 2 else .0022) * throat
    if department == 1:
        facial[:, 1] += .0045 * gaussian(.021, 1.612, .019, .009)
        facial[:, 0] += .0040 * gaussian(.024, 1.615, .015, .011)
    elif department == 2:
        facial[:, 1] -= .004 * gaussian(-.020, 1.610, .021, .010)
    skin.points = bake_edit("Underlying facial sculpture " + DEPARTMENTS[department], skin, facial)
    skin.rebuild()
    shade = reader.read(skin.attr["COLOR_0"])
    bruise = np.clip(.63 * hollow + .38 * temple + .22 * browbone, 0, .83)
    shade *= 1 - bruise[:, None] * np.array((.49, .73, .57))
    lower = gaussian(-sign * .032, 1.672, .024, .011)
    shade *= 1 - lower[:, None] * np.array((.23, .36, .29))
    # The archive clerk kept his thinning side hair; the roof mechanic has
    # short whiskers around the jaw with a clean dip below the centre lip.
    if department == 1:
        flank = np.clip((np.abs(x)-.035)/.033,0,1)
        behind = np.clip((.112-z)/.073,0,1)
        hairline = 1.774-.085*flank*behind+.004*np.cos(z*106)
        roots = np.clip((y-hairline)/.014,0,1)*np.clip((1.820-y)/.02,0,1)
        shade *= 1-roots[:,None]*np.array((.78,.79,.78))
    if department in (0,2):
        upper = 1.606 + .033*np.clip(np.abs(x)/.060,0,1)
        beard = np.clip((upper-y)/.015,0,1)*np.clip((y-1.557)/.025,0,1)*front
        clean = .85 * gaussian(0,1.603,.017,.010)
        stubble = (.58+.22*np.sin(x*854+y*738)*np.cos(z*619+y*261))
        density = (.24 if department==0 else .82) * beard * stubble*(1-clean)
        shade *= 1-density[:,None]*np.array((.84,.83,.78))
    reader.replace(skin.attr["COLOR_0"], shade)
    # Shoulder seams carry compressed cloth. Broadening folds inside existing fabric
    # gives the three outfits different silhouettes while retaining old skin weights.
    p = outfit.points.copy()
    x, y, z = p.T.copy()
    upper = np.clip((z + .015) / .1, 0, 1) * np.exp(-((y - 1.35) / .15)**2) * np.exp(-(x / .17)**4)
    pleat = .0038 * np.sin(57 * y + np.abs(x) * 13) + .002 * np.sin(99 * y - x * 24)
    p[:, 2] += upper * pleat
    outfit.points = bake_edit("Workwear drape " + DEPARTMENTS[department], outfit, p)
    outfit.rebuild()
    for surface in [skin, outfit]:
        original = reader.read(surface.attr["POSITION"])
        n0 = rounded_normals(original, surface.tri)
        n1 = rounded_normals(surface.points, surface.tri)
        normal = reader.read(surface.attr["NORMAL"]) + n1 - n0
        normal /= np.maximum(1e-8, np.linalg.norm(normal, axis=1, keepdims=True))
        reader.replace(surface.attr["POSITION"], surface.points)
        reader.replace(surface.attr["NORMAL"], normal)


def bake_edit(name, surface, positions):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([gl_to_bl(p) for p in surface.points], [], surface.tri.tolist())
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.shape_key_add(name="Original fitted surface")
    sculpt = obj.shape_key_add(name=name)
    sculpt.data.foreach_set("co", np.ascontiguousarray([gl_to_bl(p) for p in positions], dtype=np.float32).ravel())
    sculpt.value = 1
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(deps)
    changed = np.empty(len(positions) * 3, np.float32)
    evaluated.data.vertices.foreach_get("co", changed)
    out = changed.reshape(-1, 3)[:, [0, 2, 1]].copy()
    out[:, 2] *= -1
    obj.hide_render = True
    obj.hide_viewport = True
    return out


class Wardrobe:
    def __init__(self, reader, name):
        self.reader = reader
        self.collection = bpy.data.collections.new(name.title() + " | fittings")
        bpy.context.scene.collection.children.link(self.collection)
        self.pieces = []

    def add(self, name, obj, swatch, bind):
        obj.name = name
        self.collection.objects.link(obj)
        mat = bpy.data.materials.get(swatch) or bpy.data.materials.new(swatch)
        mat.diffuse_color = (*linear(swatch), 1.0)
        obj.data.materials.append(mat)
        self.pieces.append((obj, linear(swatch), bind))
        return obj

    def mesh(self, name, points, faces, swatch, bind=HEAD, smooth=True):
        data = bpy.data.meshes.new(name)
        data.from_pydata([gl_to_bl(p) for p in points], [], faces)
        data.update()
        if smooth:
            for p in data.polygons:
                p.use_smooth = True
        return self.add(name, bpy.data.objects.new(name, data), swatch, bind)

    def tube(self, name, stations, radius, swatch, bind=HEAD, loop=False, taper=False, depth=1):
        data = bpy.data.curves.new(name, "CURVE")
        data.dimensions = "3D"
        data.bevel_depth = radius
        data.bevel_resolution = depth
        data.resolution_u = 4
        data.use_fill_caps = True
        line = data.splines.new("POLY")
        line.points.add(len(stations) - 1)
        for i, (point, co) in enumerate(zip(line.points, stations)):
            point.co = (*gl_to_bl(co), 1.0)
            if taper:
                point.radius = .35 + .65 * (math.sin(math.pi * i / (len(stations) - 1)) ** .55)
        line.use_cyclic_u = loop
        return self.add(name, bpy.data.objects.new(name, data), swatch, bind)

    def lozenge(self, name, center, axes, swatch, bind=HEAD, steps=18):
        sides, rows = steps, 9
        points = []
        for k in range(1, rows):
            lat = math.pi * k / rows
            for i in range(sides):
                t = TAU * i / sides
                unit = (math.sin(lat) * math.cos(t), math.cos(lat), math.sin(lat) * math.sin(t))
                points.append(tuple(c + a * v for c, a, v in zip(center, axes, unit)))
        top, bottom = len(points), len(points) + 1
        points.extend([(center[0], center[1] + axes[1], center[2]), (center[0], center[1] - axes[1], center[2])])
        faces = [(top, (i + 1) % sides, i) for i in range(sides)]
        for row in range(rows - 2):
            for i in range(sides):
                a = row * sides + i
                b = row * sides + (i + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        faces.extend((bottom, (rows - 2) * sides + i, (rows - 2) * sides + (i + 1) % sides) for i in range(sides))
        return self.mesh(name, points, faces, swatch, bind)

    def box(self, name, center, size, bevel, swatch, bind):
        data = bpy.data.meshes.new(name)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        sx, sy, sz = size
        for v in bm.verts:
            v.co.x *= sx
            v.co.y *= sz
            v.co.z *= sy
            v.co += Vector(gl_to_bl(center))
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect="EDGES")
        bm.to_mesh(data)
        bm.free()
        return self.add(name, bpy.data.objects.new(name, data), swatch, bind)

    def bake(self, name, parent, material):
        p, n, col, joints, weights, indices, uv = [], [], [], [], [], [], []
        deps = bpy.context.evaluated_depsgraph_get()
        for piece, pigment, bind in self.pieces:
            evaluated = piece.evaluated_get(deps)
            mesh = evaluated.to_mesh()
            mesh.calc_loop_triangles()
            mapping = {}
            for tri in mesh.loop_triangles:
                for corner in tri.loops:
                    loop = mesh.loops[corner]
                    vertex = mesh.vertices[loop.vertex_index]
                    normal = mesh.corner_normals[corner].vector
                    plane = int(np.argmax(np.abs(tuple(bl_to_gl(tri.normal)))))
                    key = loop.vertex_index, plane, tuple(round(a, 4) for a in normal)
                    if key not in mapping:
                        mapping[key] = len(p)
                        pt = tuple(bl_to_gl(vertex.co))
                        p.append(pt)
                        n.append(tuple(bl_to_gl(normal)))
                        u,v = [(pt[2],pt[1]),(pt[0],pt[2]),(pt[0],pt[1])][plane]
                        uv.append((u*7.1+.27,-v*7.1+.41))
                        grain = .94 + .035 * math.sin(pt[0] * 99 + pt[1] * 147) + .025 * math.sin(pt[2] * 137 - pt[1] * 81)
                        col.append(pigment * grain)
                        if isinstance(bind, str):
                            ji, we = [self.reader.bone_ids[bind], 0, 0, 0], [1, 0, 0, 0]
                        else:
                            ji, we = bind.influence(pt)
                        joints.append(ji)
                        weights.append(we)
                    indices.append(mapping[key])
            evaluated.to_mesh_clear()
        self.reader.attach(name, parent, material, p, n, col, joints, weights, indices, uv)
        print(f"{name}: {len(self.pieces)} editable fittings, {len(indices)//3} triangles")


def lin(a, b, count):
    return [a + (b - a) * i / (count - 1) for i in range(count)]


def boiler(w):
    # Deep-drawn helmet: the dent only compresses one crown quadrant, the lip
    # extends beyond the brow, and the underside folds back into the shell.
    contour = [(-.002, .98), (.002, 1.), (.006, 1.), (.009, .935), (.014, .917),
               (.025, .906), (.043, .846), (.059, .72), (.071, .55), (.080, .29), (.083, .035)]
    steps = 48
    points, rings = [], []
    for height, radius in contour:
        ring = []
        for i in range(steps):
            a = TAU * i / steps
            brow = max(0, math.sin(a))
            crease = math.exp(-((math.cos(a) - .73) / .20)**2) * max(0, math.sin(a))
            dent = 1 - .09 * crease * math.sin(math.pi * max(0, height) / .085)
            brim = .020 * brow**3 * max(0, 1 - abs(height - .003) / .013)
            point = (.107 * radius * math.cos(a) * dent,
                     1.741 + height - .004 * math.cos(a) - .006 * brow**3,
                     .042 + .112 * radius * math.sin(a) * dent + brim)
            points.append(point)
            ring.append(point)
        rings.append(ring)
    faces = [(r * steps + i, (r + 1) * steps + i, (r + 1) * steps + (i + 1) % steps,
              r * steps + (i + 1) % steps) for r in range(len(contour)-1) for i in range(steps)]
    w.mesh("Foundry | dented spun crown", points, faces, "88724b")
    w.tube("Rolled rim with dark rubber underside", rings[1], .0027, "3b3328", loop=True)
    w.tube("Worn rim catchlight", rings[2], .00105, "c4a178", loop=True)
    w.tube("Stamped crown seam", rings[5], .00155, "665538", loop=True)
    # Reinforcement raised from back to front, paint polished thin at its edges.
    for sign in [-1, 1]:
        rib = [(sign * (.024 + .005 * math.cos(t)), 1.747 + .077 * math.sin(t),
                .044 + .097 * math.cos(t)) for t in lin(.30, 2.87, 25)]
        w.tube("Pressed reinforcement bead", rib, .003, "aa8c58", taper=True)
    for side in [-1, 1]:
        w.lozenge("Hinge rivet", (side*.102, 1.752, .060), (.005, .009, .008), "b99967")
    for dy, radius, color, z in [(0, .023, "443e34", .153), (0, .0205, "ae9873", .159), (0, .0168, "9e9e84", .163)]:
        w.lozenge("Lamp bezel and stained reflector", (.008, 1.758+dy, z), (radius, radius, .006), color, steps=24)
    for dx in [-.009, 0, .009]:
        h = math.sqrt(.016**2 - dx**2)
        w.tube("Wire lens guard", [(.008+dx, 1.758+t, .169 - .002*(t/h)**2) for t in lin(-h,h,9)], .00115, "514a3a")
    w.tube("Lamp cable and retaining clip", [(.031,1.759,.150),(.062,1.760,.135),(.087,1.759,.113),
                                              (.099,1.753,.084),(.101,1.746,.068)], .0026, "413a30")


def office(w, cloth, skin):
    # The thinning part includes lifted, overlapping wisps; their follicles
    # stay projected on the same cranial surface if the character is posed.
    rng = np.random.default_rng(721)
    for i in range(26):
        stations = []
        z0 = -.012 + .0034*i + rng.uniform(-.002,.002)
        for t in lin(0,1,17):
            x = -.066 + (.093 + .006*math.sin(i))*t
            z = z0 + .022*math.sin(t*math.pi) + .010*t
            p,_,_,_ = skin.tree.ray_cast((x,1.94,z),(0,-1,0))
            if p is not None:
                stations.append((x,p.y+.0008+.0016*math.sin(t*math.pi),z))
        if len(stations)>3:
            w.tube("Swept thinning temple hair",stations,.00060 if i%3 else .00075,
                   ["716254","77695b","8d7c6a","5b5048"][i%4],taper=True,depth=0)
    def orbit(side, t, hanging=0):
        c,s = math.cos(t), math.sin(t)
        sx = math.copysign(abs(c)**.73, c)
        sy = math.copysign(abs(s)**.80, s)
        x = side * .033 + .025 * sx
        return (x, 1.685 + .0165 * sy + .0027 * side * sx - hanging,
                .1610 - .009 * (abs(x) / .062)**2)
    for side in [-1, 1]:
        ring = [orbit(side,t) for t in lin(0,TAU,45)[:-1]]
        if side == 1:
            # Twisted lower rim with a real opening.
            ring = [orbit(side,t,.006*max(0,-math.sin(t))) for t in lin(-.73, TAU-.89, 37)]
        w.tube("Broken spectacles | rim", ring, .00175, "716457", loop=side==-1)
        w.tube("Frame top silvering", [orbit(side,t) for t in lin(.20,2.82,16)], .0010, "bba892")
        w.tube("Earpiece on the temple", [(side*.056,1.687,.151),(side*.065,1.687,.124),
                                          (side*.075,1.681,.075),(side*.077,1.673,.045),
                                          (side*.075,1.662,.038)], .0018, "635347")
    w.tube("Crooked bridge", [(-.010,1.688,.160),(-.006,1.691,.162),(.001,1.693,.163),
                               (.005,1.692,.162),(.010,1.688,.160)],.0016,"a58e77")
    def near_cloth(x,y,off=.004):
        p = cloth.front(x,y)
        return p[0],p[1],p[2]+off
    for side in [-1,1]:
        path = [near_cloth(x,y) for x,y in [(side*.066,1.498),(side*.065,1.458),(side*.048,1.401),
                                              (side*.023,1.347),(.004+side*.009,1.310)]]
        w.tube("Archive lanyard woven cord", path, .0045, "494d48", cloth)
    x,y,z = near_cloth(.005,1.277,.013)
    w.box("Bakelite badge holder", (x,y,z), (.057,.075,.006), .0029, "433d34", cloth)
    w.box("Aged paper behind acetate", (x,y,z+.0032), (.050,.065,.002), .0009,"bfad8c", cloth)
    w.box("Portrait enclosure", (x-.010,y+.004,z+.0045), (.019,.023,.0018), .0008,"575b53", cloth)
    w.lozenge("Faded identification portrait", (x-.010,y+.006,z+.0055),(.0058,.007,.0007),"ad9c81",cloth)
    for i,width in enumerate([.017,.015,.011,.030]):
        cx = x+.011 if i<3 else x
        yy = y+.010-.006*i if i<3 else y-.022
        w.box("Letterpress on badge", (cx,yy,z+.005), (width,.0014,.001), .0004,"5d594e",cloth)


def roof(w, cloth):
    for side in [-1,1]:
        w.lozenge("Ear defender | cracked cushion", (side*.077,1.674,.034),(.018,.042,.031),"393430")
        w.lozenge("Pressed shell over the cushion", (side*.090,1.674,.033),(.015,.039,.030),"787454")
        w.lozenge("Cast washer on shell", (side*.104,1.678,.031),(.003,.016,.014),"4a4a3b")
        for offset in [-.009,0,.009]:
            w.tube("Shell vent", [(side*.104,1.662+offset,z) for z in lin(.022,.041,7)],.0017,"343733")
        for front in [-1,1]:
            w.tube("Steel yoke", [(side*.075,1.752,.033+front*.012),(side*.095,1.729,.033+front*.022),
                                  (side*.104,1.699,.033+front*.020),(side*.103,1.682,.033+front*.014)], .0024,"a3a18b")
    # Padded band follows the cranium; its hollow arch is apparent in silhouette.
    for z, pigment, gauge in [(.024,"48463b",.0063),(.041,"524f40",.0063),(.032,"6e6853",.008)]:
        path=[(.083*math.cos(t),1.708 + .099*math.sin(t),z) for t in lin(.19,math.pi-.19,35)]
        w.tube("Defender headband",path,gauge,pigment)
    w.tube("Flexible intercom stalk", [(-.102,1.667,.040),(-.108,1.651,.064),(-.101,1.631,.092),
                                      (-.078,1.617,.119),(-.054,1.610,.136),(-.032,1.610,.143)],.0024,"777461")
    w.lozenge("Dry foam on microphone",(-.027,1.61,.143),(.013,.0068,.0073),"49443b")
    # Straps on the garment stay attached as the torso twists.
    for side in [-1,1]:
        coords = [(side*.10,1.486),(side*.091,1.440),(side*.074,1.395),(side*.049,1.350)]
        path = []
        for x,y in coords:
            p = cloth.front(x,y)
            path.append((p.x,p.y,p.z+.0035))
        w.tube("Rubber harness",path,.0058,"43433a",cloth)
    p = cloth.front(.002,1.331)
    c = (p.x,p.y,p.z+.011)
    w.lozenge("Off-duty respirator | nose cup", c, (.054,.049,.024),"74725f",cloth)
    for side in [-1,1]:
        cc = (c[0]+side*.043,c[1]-.014,c[2]+.012)
        w.lozenge("Cartridge housing",cc,(.024,.027,.016),"928b6f",cloth)
        for yy in [-.014,-.007,0,.007,.014]:
            h = math.sqrt(.019**2-yy**2)
            line = [(cc[0]+xx,cc[1]+yy,cc[2]+.017-.006*(xx/.019)**2) for xx in lin(-h,h,7)]
            w.tube("Intake louvers",line,.0014,"4e5046",cloth)


def scar(w, skin, department):
    # Project each millimetre into the actual face. Skin weights sampled at the
    # closest triangle make splits, borders and old sutures follow jaw movement.
    routes = [[(.063,1.713),(.053,1.703),(.058,1.691),(.050,1.680),(.045,1.665),(.034,1.657)],
              [(-.063,1.668),(-.052,1.664),(-.044,1.655),(-.035,1.647),(-.032,1.636),(-.023,1.627)],
              [(.060,1.679),(.053,1.666),(.055,1.655),(.045,1.643),(.035,1.638),(.028,1.626)]]
    route = routes[department]
    def place(x,y,lift=.00065):
        p = skin.front(x,y)
        return p.x,p.y,p.z+lift
    pts = []
    for i in range(len(route)-1):
        a,b,c,d = [np.array(route[j]) for j in (max(0,i-1),i,i+1,min(len(route)-1,i+2))]
        for t in lin(0,1,7)[:-1]:
            pts.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    pts.append(route[-1])
    w.tube("Old cut | recessed centre", [place(x,y) for x,y in pts], .00115, "653b3a", skin, taper=True)
    for sign, pigment in [(-1,"86605c"),(1,"ab8172")]:
        path = [place(x+sign*(.0012+.0004*math.sin(i*.46)),y,.00085) for i,(x,y) in enumerate(pts)]
        w.tube("Healed ridge of cheek",path,.00061,pigment,skin,taper=True)
    if department==1:
        for x,y in pts[5:-3:7]:
            path = [place(x+t*.004,y-t*.0027,.0013+.0013*math.sin(math.pi*(t+1)/2)) for t in lin(-1,1,8)]
            w.tube("Discoloured surgical staple",path,.00050,"8e8170",skin)


def png(rgb):
    height,width,_ = rgb.shape
    def chunk(kind,data):
        return struct.pack(">I",len(data)) + kind + data + struct.pack(">I",zlib.crc32(kind + data)&0xffffffff)
    rows = b"".join(b"\x00"+row.tobytes() for row in rgb)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,2,0,0,0))
            + chunk(b"IDAT",zlib.compress(rows,9)) + chunk(b"IEND",b""))


def skin_relief(reader):
    # Derive shallow high-frequency relief from the fitted photographic UVs.
    # Remove broad baked-in shading first; otherwise the cheeks look embossed.
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder)/"source.jpg"
        path.write_bytes(reader.image(0))
        image = bpy.data.images.load(str(path))
        image.colorspace_settings.name = "Non-Color"
        image.scale(1024,1024)
        pixels = np.empty(4*1024*1024,dtype="f")
        image.pixels.foreach_get(pixels)
        lum = pixels.reshape(1024,1024,4)[:,:,:3] @ np.array([.33,.48,.19])
        low = sum(np.roll(np.roll(lum,xx,1),yy,0) for xx,yy in [(0,0),(-3,0),(3,0),(0,-3),(0,3)]) / 5
        small = lum-low
        dx = (np.roll(small,-1,1)-np.roll(small,1,1)) * 1.6
        dy = (np.roll(small,-1,0)-np.roll(small,1,0)) * 1.6
        vectors = np.stack((-dx,-dy,np.ones_like(dx)),axis=-1)
        vectors /= np.linalg.norm(vectors,axis=-1,keepdims=True)
        pack = np.rint((vectors[::-1]*.5+.5)*255).astype("u1")
        normal = reader.texture("Pores, age lines and lip grain",png(pack))
        reader.doc["materials"][0]["normalTexture"] = dict(index=normal,scale=.72)
        bpy.data.images.remove(image)


def vary_dentition(worker):
    # Each tooth is a separate connected shell, though UV seams split its
    # vertices. Share normals, UV, weights and the dental texture across rigs.
    # The missing crowns only cost a different index buffer, never a draw.
    data = worker.doc
    source=next(n for n in data["nodes"] if n["name"]=="Teeth")
    source_id=data["nodes"].index(source)
    shared=source["mesh"]
    prim=data["meshes"][shared]["primitives"][0]
    points=worker.read(prim["attributes"]["POSITION"])
    triangles=worker.read(prim["indices"]).reshape(-1,3)
    _,same=np.unique(np.round(points,5),axis=0,return_inverse=True)
    links=list(range(same.max()+1))
    def root(i):
        while links[i] != i:
            links[i]=links[links[i]]
            i=links[i]
        return i
    for a,b,c in same[triangles]:
        links[root(b)] = root(a)
        links[root(c)] = root(a)
    labels=np.array([root(i) for i in same])
    centers={i:points[labels==i].mean(axis=0) for i in np.unique(labels)}
    trim=[(-.0121,1.6142,.1362),(.0044,1.6142,.1379)]
    for node in data["nodes"]:
        if source_id in node.get("children",[]):
            node["children"].remove(source_id)
    for i,dept in enumerate(DEPARTMENTS):
        outfit=next(n for n in data["nodes"] if n["name"]=="uniform_"+dept)
        if i==2:
            outfit["children"].append(source_id)
            continue
        tooth=min(centers,key=lambda j:np.linalg.norm(centers[j]-trim[i]))
        new_indices=triangles[labels[triangles[:,0]]!=tooth]
        assert 32 < len(triangles)-len(new_indices) < 240
        part=dict(prim,indices=worker.accessor(new_indices,"SCALAR",5123,34963))
        name="Teeth "+dept
        mesh=worker.add("meshes",dict(name=name,primitives=[part]))
        outfit["children"].append(worker.add("nodes",dict(name=name,mesh=mesh,skin=0)))


def arrange_studio(output):
    # Store all three fitted actors beside each other, using linked data for
    # the common parts. Keep the editable sculpt keys and tool curves hidden.
    from mathutils import Euler
    scene=bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=str(output.resolve()))
    master=next(o for o in scene.objects if o.type=="ARMATURE")
    sources=bpy.data.collections.new("Sculpt sources | unhide to inspect shape keys")
    scene.collection.children.link(sources)
    for obj in list(scene.objects):
        if obj.name.startswith(("Underlying facial sculpture","Workwear drape")):
            for coll in list(obj.users_collection):
                coll.objects.unlink(obj)
            sources.objects.link(obj)
    sources.hide_viewport=True
    sources.hide_render=True
    common=[bpy.data.objects["Eyes"],bpy.data.objects["Service boots"]]
    for index,dept in enumerate(DEPARTMENTS):
        coll=bpy.data.collections.new("Cast "+str(index+1)+" | "+dept.title())
        scene.collection.children.link(coll)
        rig = master if index==0 else master.copy()
        if index==0:
            for c in list(rig.users_collection):
                c.objects.unlink(rig)
        coll.objects.link(rig)
        rig.name="Late worker — "+dept.title()
        rig.location.x=(index-1)*1.07
        rig.show_in_front=False
        rig.data.display_type="STICK"
        mesh_names=["Skin "+dept,"Clothing "+dept,"Fittings "+dept,"Teeth" if index==2 else "Teeth "+dept]
        leaves=[bpy.data.objects[n] for n in mesh_names]
        leaves += common if index==0 else [item.copy() for item in common]
        for obj in leaves:
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            coll.objects.link(obj)
            obj.parent=rig
            next(m for m in obj.modifiers if m.type=="ARMATURE").object=rig
    for obj in list(scene.objects):
        if obj.name.startswith("uniform_") and obj.type=="EMPTY":
            bpy.data.objects.remove(obj,do_unlink=True)
    # A native studio camera and softboxes provide an immediate render of the cast.
    studio=bpy.data.collections.new("Studio lights and camera")
    scene.collection.children.link(studio)
    target=Vector((0,0,.94))
    def aim(obj,point):
        obj.rotation_euler=(point-obj.location).to_track_quat("-Z","Y").to_euler()
    for name,at,color,power,size in [
        ("Softbox | key",(-2.2,-2.5,3.3),(1,.80,.67),310,2.4),
        ("Softbox | fill",(1.7,-1.8,2.0),(.63,.80,1),170,2.0),
        ("Overhead rim",(.6,1.4,2.9),(.71,.85,1),300,1.7)]:
        light=bpy.data.lights.new(name,"AREA")
        light.energy=power
        light.color=color
        light.shape="DISK"
        light.size=size
        obj=bpy.data.objects.new(name,light)
        studio.objects.link(obj)
        obj.location=at
        aim(obj,target)
    cam=bpy.data.objects.new("Cast portrait",bpy.data.cameras.new("Cast portrait"))
    studio.objects.link(cam)
    cam.location=(.04,-5.22,1.38)
    cam.data.lens=48
    aim(cam,target)
    scene.camera=cam
    scene.render.engine="CYCLES"
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1600
    scene.render.resolution_y=940
    world=bpy.data.worlds.new("Slate cyclorama")
    scene.world=world
    world.use_nodes=True
    world.node_tree.nodes.get("Background").inputs[0].default_value=(.045,.061,.069,1)
    bpy.ops.object.select_all(action="DESELECT")
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_rotation=Euler((math.radians(86),0,0)).to_quaternion()
                area.spaces.active.region_3d.view_location=target
                area.spaces.active.region_3d.view_distance=4.8
                area.spaces.active.overlay.show_overlays=False
                area.spaces.active.shading.color_type="TEXTURE"


def main():
    args = sys.argv[sys.argv.index("--")+1:]
    source, output = map(Path, args[:2])
    if source.resolve()==output.resolve():
        raise ValueError("Keep the fitted source separate from its baked result")
    worker = WorkerFile(source)
    if any(m["name"].startswith("Fittings") for m in worker.doc["meshes"]):
        raise ValueError("Expected the fitted base asset, not an already-sculpted worker")
    material = worker.add("materials", dict(name="Workshop enamel, aged metal and old sutures",
        pbrMetallicRoughness=dict(metallicFactor=.17,roughnessFactor=.59,
            baseColorTexture=dict(index=worker.texture("Weathered enamel",png(aged_enamel()))))))
    native = bool(args[2:])
    skin_surfaces=[]
    for index,department in enumerate(DEPARTMENTS):
        meshes = {m["name"]:m["primitives"][0] for m in worker.doc["meshes"]}
        skin = Surface(worker,meshes["Skin "+department])
        outfit = Surface(worker,meshes["Clothing "+department])
        deform(worker,skin,outfit,index)
        skin_surfaces.append(skin)
        paint_clothes(worker,outfit,index)
        kit = Wardrobe(worker,department)
        if department=="boiler":
            boiler(kit)
        elif department=="office":
            office(kit,outfit,skin)
        else:
            roof(kit,outfit)
        scar(kit,skin,index)
        parent = next(i for i,n in enumerate(worker.doc["nodes"]) if n["name"]=="uniform_"+department)
        kit.bake("Fittings "+department,parent,material)
        kit.collection.hide_render = True
        kit.collection.hide_viewport = True
    vary_dentition(worker)
    paint_skin(worker,skin_surfaces)
    paint_eyes(worker)
    skin_relief(worker)
    worker.save(output)
    if native:
        arrange_studio(output)
        bpy.context.scene.name="Late workers | fittings, fitted rig and facial sculpt keys"
        bpy.ops.file.pack_all()
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args[2]), compress=True)
    print(f"Baked {output.stat().st_size:,} bytes into {output}")


if __name__=="__main__":
    main()
