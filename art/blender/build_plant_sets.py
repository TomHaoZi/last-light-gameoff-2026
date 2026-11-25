"""Model the B2 pressure plant and roof service structures for LAST LIGHT.

Blender 4.5+: blender -b --python-exit-code 1 -P art/blender/build_plant_sets.py -- /path/to/metal-plate-maps
Use Poly Haven's Metal Plate 02 1K JPEG Diffuse, Normal (GL) and ARM maps.
Local front is Blender -Y. The runtime instance origins are in meters.
"""

from collections import defaultdict
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
ENV = ROOT / "dist/3d/assets/env"
PHOTO = "metal_plate_02"
randomizer = random.Random(817)
finishes = [
    ("iron", (.35, .41, .42), .71, .53, .29),
    ("black", (.16, .19, .19), .85, .24, .28),
    ("lagging", (.38, .41, .37), .91, 0, .42),
    ("verdigris", (.34, .46, .42), .68, .33, .52),
    ("brass", (.53, .44, .24), .52, .52, .31),
    ("bare", (.53, .57, .56), .39, .75, .27),
    ("red", (.49, .23, .15), .65, .12, .35),
    ("paintmark", (.71, .55, .31), .76, .06, .22),
    ("leaf", (.31, .42, .30), .75, 0, .10),
    ("leaflite", (.45, .49, .29), .66, 0, .13),
    ("soil", (.21, .18, .13), .95, 0, .53),
    ("paper", (.72, .69, .54), .73, 0, .12),
    ("glass", (.35, .47, .44), .34, .27, .17),
    ("algae", (.30, .35, .26), .82, 0, .43),
    ("yellow", (.64, .50, .20), .66, .19, .15),
    ("ash", (.48, .48, .43), .91, 0, .35),
]
palette = {mat[0]: n for n, mat in enumerate(finishes)}


def baked_material(photo_path, temporary):
    tile_size = 192

    def photo(channel, noncolor=False):
        image = bpy.data.images.load(str(photo_path / f"{PHOTO}_{channel}_1k.jpg"))
        if noncolor:
            image.colorspace_settings.name = "Non-Color"
        image.scale(tile_size, tile_size)
        value = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(value)
        bpy.data.images.remove(image)
        return value.reshape(tile_size, tile_size, 4)[..., :3]

    diffuse = photo("diff").mean(-1)
    arm, normal = photo("arm", True), photo("nor_gl", True)
    mean = np.mean(diffuse)
    abrasion = np.clip((diffuse - mean) * 1.6 + 1, .39, 1.59)
    size = tile_size * 4
    original = np.ones((size, size, 4), np.float32)
    color, packed, relief = [original.copy() for _ in range(3)]
    y, x = np.mgrid[0:tile_size, 0:tile_size] / (tile_size - 1)
    for index, (_, pigment, roughness, metalness, weathering) in enumerate(finishes):
        a = np.roll(abrasion, index * 17, axis=1)
        r = np.roll(arm, index * 17, axis=1)
        n = np.roll(normal, index * 17, axis=1)
        runs = (.041 * np.sin(41*x+3*y+index) * (1-y) + .03 * np.sin(10*y-4*x) * (1-x))
        tint = (a * weathering + 1 - weathering + runs)[..., None]
        section = np.s_[index // 4 * tile_size:(index // 4 + 1) * tile_size,
                        index % 4 * tile_size:(index % 4 + 1) * tile_size]
        color[section][..., :3] = np.clip(np.array(pigment) * tint, 0, 1)
        relief[section][..., :3] = np.array([.5, .5, 1]) * (1 - weathering) + n * weathering
        packed[section][..., 0] = np.clip(.86 + .21 * (r[..., 0] - .5), 0, 1)
        packed[section][..., 1] = np.clip(roughness + .24 * (r[..., 1] - .5), .17, .97)
        packed[section][..., 2] = np.clip(metalness + metalness * .45 * (r[..., 2] - .5), 0, 1)

    def saved_map(name, pixels, noncolor=False, format="JPEG"):
        image = bpy.data.images.new(name, width=size, height=size, alpha=False)
        if noncolor:
            image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(pixels.reshape(-1))
        image.file_format = format
        image.filepath_raw = str(temporary / (name + (".jpg" if format == "JPEG" else ".png")))
        image.save()
        image.pack()
        return image

    mat = bpy.data.materials.new("Pressure plant corrosion atlas")
    mat.use_nodes = True
    mat.diffuse_color = (.43, .45, .41, 1)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")

    def texture(image):
        node = nodes.new("ShaderNodeTexImage")
        node.image = image
        return node

    albedo = texture(saved_map("Steel and patina color", color))
    cram = texture(saved_map("Plant material channels", np.round(packed * 36) / 36, True, "PNG"))
    height = texture(saved_map("Copper and steel relief", relief, True))
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = .44
    channels = nodes.new("ShaderNodeSeparateColor")
    links.new(albedo.outputs["Color"], shader.inputs["Base Color"])
    links.new(height.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(cram.outputs["Color"], channels.inputs["Color"])
    links.new(channels.outputs["Green"], shader.inputs["Roughness"])
    links.new(channels.outputs["Blue"], shader.inputs["Metallic"])
    settings = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    settings.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    settings_node = nodes.new("ShaderNodeGroup")
    settings_node.node_tree = settings
    links.new(channels.outputs["Red"], settings_node.inputs["Occlusion"])
    return mat


def lens_material(name, rgb, emission):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = .36
    shader.inputs["Emission Color"].default_value = (*rgb, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


class Workshop:
    def __init__(self, atlas):
        self.atlas = atlas
        self.groups = defaultdict(list)
        self.active = None

    def make(self, chapter, name):
        if self.active is None or self.active[0] != chapter:
            collection = bpy.data.collections.new(chapter.title() + " service structures")
            bpy.context.scene.collection.children.link(collection)
        else:
            collection = self.active[1].users_collection[0]
        root = bpy.data.objects.new(name, None)
        collection.objects.link(root)
        root.empty_display_size = .22
        self.groups[chapter].append(root)
        self.active = (chapter, root)
        return root

    def add(self, obj, finish):
        collection = self.active[1].users_collection[0]
        for source in list(obj.users_collection):
            source.objects.unlink(obj)
        collection.objects.link(obj)
        obj.parent = self.active[1]
        obj.data.materials.clear()
        obj.data.materials.append(self.atlas if isinstance(finish, str) else finish)
        if isinstance(finish, str):
            square = palette[finish]
            for previous in list(obj.data.uv_layers):
                obj.data.uv_layers.remove(previous)
            uv = obj.data.uv_layers.new(name="Patina coordinates")
            for face in obj.data.polygons:
                axis = max(range(3), key=lambda i: abs(face.normal[i]))
                i, j = [(1,2), (0,2), (0,1)][axis]
                offset = randomizer.uniform(.05, .14)
                for loop in face.loop_indices:
                    point = obj.data.vertices[obj.data.loops[loop].vertex_index].co
                    # Positive monotonic coordinates keep weld and bevel seams together.
                    u, v = [math.atan(point[k] * 2 + offset) / math.pi + .5 for k in (i,j)]
                    uv.data[loop].uv = ((square % 4 + .016 + u * .968) / 4,
                                        (square // 4 + .016 + v * .968) / 4)
        return obj

    def mesh(self, name, points, faces, finish, smooth=False):
        data = bpy.data.meshes.new(name)
        data.from_pydata(points, [], faces)
        data.update()
        for face in data.polygons:
            face.use_smooth = smooth
        return self.add(bpy.data.objects.new(name, data), finish)

    def box(self, name, center, size, finish, bevel=0, tilt=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=(tilt, 0, 0))
        obj = bpy.context.object
        obj.name = name
        obj.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            chamfer = obj.modifiers.new("Machined edges", "BEVEL")
            chamfer.width = bevel
            chamfer.segments = 2 if bevel >= .01 else 1
            bpy.ops.object.modifier_apply(modifier=chamfer.name)
            normals = obj.modifiers.new("Plane normals", "WEIGHTED_NORMAL")
            bpy.ops.object.modifier_apply(modifier=normals.name)
        return self.add(obj, finish)

    def pipe(self, name, route, radius, finish, sides=12, factors=None):
        section = [Vector(point) for point in route]
        points, faces = [], []
        for i, current in enumerate(section):
            axis = (section[min(i+1,len(section)-1)] - section[max(0,i-1)]).normalized()
            seed = Vector((0,0,1)) if abs(axis.z) < .85 else Vector((0,1,0))
            u = axis.cross(seed).normalized()
            v = axis.cross(u)
            width = radius * (1 if factors is None else factors[i])
            for j in range(sides):
                angle = j*math.tau/sides
                points.append(current + width * (u*math.cos(angle) + v*math.sin(angle)))
                if i:
                    a, b = (i-1)*sides, i*sides
                    k = (j+1)%sides
                    faces.append((a+j, a+k, b+k, b+j))
        faces.extend((tuple(reversed(range(sides))), tuple(range(len(points)-sides,len(points)))))
        return self.mesh(name, points, faces, finish, True)

    def stud(self, x, y, z, radius=.017):
        self.pipe("Hex fastener", [(x,y,z),(x,y-.016,z)], radius, "bare", 6)

    def text(self, words, location, size, finish):
        font = bpy.data.curves.new(words, "FONT")
        font.body, font.size = words, size
        font.align_x = "CENTER"
        obj = bpy.data.objects.new(words, font)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler.x = math.pi / 2
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")
        self.add(bpy.context.object, finish)

    def flange(self, x, y, z, radius):
        self.pipe("Cast collar", [(x-.035,y,z),(x+.035,y,z)], radius, "iron", 20)
        self.pipe("Fiber gasket", [(x-.044,y,z),(x-.033,y,z)], radius*.96, "black", 20)
        for i in range(6):
            angle = i*math.tau/6
            start = (x-.054, y+radius*.79*math.cos(angle), z+radius*.79*math.sin(angle))
            self.pipe("Flange through-bolt", [start, (start[0]+.105,start[1],start[2])],
                      radius*.087, "bare", 6)

    def bulkhead(self, lens):
        self.box("Gasketed cast backplate", (0,-.027,0), (.58,.064,.32), "iron", .034)
        self.box("Recessed lamp body", (0,-.078,0), (.52,.09,.285), "black", .028)
        self.box("Molded wire-glass lens", (0,-.122,0), (.44,.116,.223), lens, .038)
        for x in (-.210,-.142,-.071,0,.071,.142,.210):
            self.pipe("Protective cage bow", [(x,-.101,-.129),(x,-.185,-.097),
                      (x,-.204,-.061),(x,-.205,.075),(x,-.173,.119),(x,-.101,.134)],
                      .0095, "bare", 8)
        for z in (-.075,.075):
            self.pipe("Longitudinal cage rail", [(-.237,-.171,z),(-.211,-.207,z),(.209,-.207,z),(.237,-.171,z)],
                      .008, "bare", 8)
        for x in (-.261,.261):
            self.stud(x,-.063,-.112,.014)
        self.pipe("Painted power elbow", [(0,-.023,.121),(0,-.023,.230),(.050,-.023,.281),(.36,-.023,.281)],
                  .021, "iron")


def boiler(work, cream):
    box, pipe = work.box, work.pipe
    work.make("boiler", "ReliefSkid")
    box("Floor anchor rail", (0,-.154,.078), (1.82,.36,.156), "iron", .021)
    box("Corrugated mounting panel", (0,-.026,.92), (1.86,.058,1.63), "iron", .023)
    for x, side in ((-.54,-1),(.54,1)):
        pipe("Settling pot shell", [(x,-.237,.185),(x,-.237,.23),(x,-.237,.28),(x,-.237,.97),(x,-.237,1.018),(x,-.237,1.052)],
             .22, "verdigris", 24, (.67,.95,1,1,.93,.62))
        for z in (.31,.91):
            pipe("Riveted suspension band", [(x,-.237,z-.018),(x,-.237,z+.018)], .227, "bare", 20)
        box("Gauge instrument riser", (x,-.072,1.267), (.52,.13,.387), "black", .045)
        pipe("Pressure gauge body", [(x,-.143,1.28),(x,-.213,1.28)], .154, "brass", 30)
        pipe("Ivory dial", [(x,-.216,1.28),(x,-.221,1.28)], .125, "paper", 30)
        for i in range(11):
            angle = (i/10-.5)*math.pi*1.45
            cx, cz = x+math.sin(angle)*.108,1.28+math.cos(angle)*.108
            pipe("Printed dial mark", [(cx,-.224,cz),
                 (x+math.sin(angle)*.094,-.224,1.28+math.cos(angle)*.094)], .0027, "black", 6)
        pipe("Painted needle", [(x,-.227,1.28),(x+side*.083,-.228,1.343)], .005, "red", 7)
        pipe("Bent capillary return", [(x,-.168,1.113),(x,-.225,1.047),(x,-.235,1.018)],
             .027, "brass")
        for z in (.35,1.53):
            work.stud(x+side*.280,-.057,z)
    pipe("Common blowdown header", [(-.822,-.284,.15),(.792,-.284,.15),(.865,-.284,.191),(.865,-.284,.36)], .075,
         "verdigris", 16)
    for x in (-.42,.42):
        work.flange(x,-.284,.15,.11)
    box("Etched serial plate", (0,-.061,1.65), (.68,.024,.134), "bare", .008)
    work.text("B2    RELIEF", (0,-.075,1.615), .073, "black")

    work.make("boiler", "SteamSaddle")
    pipe("Lagged return elbow", [(-1.13,-.18,.04),(-.46,-.18,.04),(-.29,-.176,.026),(-.185,-.151,-.028),
         (-.134,-.107,-.126),(-.134,-.059,-.281),(-.134,-.056,-.673)], .134, "lagging", 18)
    pipe("Exposed return branch", [(-.134,-.056,-.667),(-.134,-.056,-.822),(-.125,-.052,-.880),(-.085,-.029,-.922),
         (-.010,.030,-.940)], .087, "verdigris")
    pipe("Through line", [(-1.15,-.064,-.287),(1.127,-.064,-.287)], .066, "verdigris")
    for x in (-.94,-.65,.40,.75):
        work.flange(x,-.064,-.287,.097)
    for x in (-.92,-.63):
        pipe("Lagging belt buckle", [(x-.018,-.18,.04),(x+.018,-.18,.04)], .141, "iron", 20)
        box("Crimped support tang", (x,-.077,-.011), (.125,.19,.12), "iron", .014)
        work.stud(x,-.16,-.055)

    work.make("boiler", "CageLight")
    work.bulkhead(cream)

    work.make("boiler", "Gantry")
    for z in (-.12,.10):
        box("Riveted overhead flange", (0,.02,z), (4.64,.44,.054), "iron", .010)
    box("I-beam central web", (0,.03,-.011), (4.59,.108,.192), "iron", .009)
    for x in (-2.10,-1.85,1.85,2.1):
        box("Welded compression fin", (x,-.039,-.01), (.036,.28,.170), "bare", .006)
        work.stud(x,-.161,-.105,.021)
    for x in (-1.61,1.61):
        box("Recessed enamel stripe", (x,-.219,-.115), (.58,.016,.071), "yellow", .005)
        box("Leakage line", (x,-.243,-.23), (.017,.016,.13), "red")
    box("Pressure gallery plaque", (0,-.247,-.006), (1.87,.037,.165), "black", .008)
    work.text("PRESSURE  GALLERY", (0,-.268,-.048), .096, "paintmark")

    work.make("boiler", "SumpGrate")
    box("Flush pit flange", (0,0,-.007), (.85,.54,.014), "iron", .003)
    box("Wet drainage well", (0,0,.001), (.75,.44,.004), "black", 0)
    for x in range(-8,9):
        box("Cast bearing bar", (x*.042,0,.005), (.028,.447,.013), "bare", .004)
    box("Retaining crossbar", (0,0,.013), (.793,.013,.009), "iron", .002)


def rooftop(work, beacon):
    box, pipe = work.box, work.pipe
    work.make("roof", "WaterTower")
    for x in (-.67,.67):
        for y in (-.59,.59):
            box("Anchored tank foot", (x,y,.034), (.22,.212,.070), "iron", .019)
            box("Tapered column", (x,y,.59), (.102,.123,1.18), "bare", .014)
            pipe("Diagonal wind brace", [(x,y,.14),(-x,y,1.103)], .037, "iron", 8)
    pipe("Stamped reservoir jacket", [(0,0,1.03),(0,0,1.124),(0,0,1.201),(0,0,2.24),(0,0,2.35),(0,0,2.422)],
         .932,"verdigris",36,(.78,.98,1,1,.94,.64))
    for z in (1.21,1.39,2.02,2.20):
        pipe("Tank rolled standing seam", [(0,0,z-.020),(0,0,z+.021)], .942,"iron",36)
    for i in range(26):
        angle=i*math.tau/26
        x,y=.921*math.cos(angle),.921*math.sin(angle)
        pipe("Riveted jacket shoe", [(x,y,1.299),(x,y,1.338)], .020,"bare",8)
    pipe("Inspection hatch", [(0,0,2.421),(0,0,2.463),(0,0,2.494)],.304,"iron",24,(1,1,.92))
    pipe("Bent overflow terminator", [(0,.34,2.404),(0,.34,2.573),(.03,.34,2.633),(.088,.34,2.652),
         (.247,.34,2.652),(.319,.34,2.624),(.343,.34,2.543)],.043,"bare",10)
    for x in (-.161,.161):
        pipe("Fixed ladder stanchion", [(x,-.753,.055),(x,-.821,.48),(x,-.923,.983),
             (x,-.988,1.09),(x,-.988,2.268)],.026,"bare",8)
    for i in range(12):
        z=.11+i*.171
        y=-.754-min(.219,z*.217)
        pipe("Ribbed ladder tread", [(-.175,y,z),(.175,y,z)],.019,"bare",8)
    box("Storm-rated vessel label", (0,-.939,1.831), (.55,.034,.190), "black", .005)
    work.text("RAIN   03", (0,-.959,1.796), .091,"paintmark")
    pipe("Bottom service line", [(.629,0,1.118),(.629,0,.355),(.639,-.096,.253),(.639,-.423,.188),
         (.639,-.637,.184)],.054,"verdigris",14)

    work.make("roof", "Glasshouse")
    # This is only a roof cap. The original solid upkeep block under it still owns collision.
    for side in (-1,1):
        x=side*.578
        tilt=side*.42
        # Local y runs across the slope, local x is the ridge length.
        box("Rebated frosted roof panel", (0,x,.304), (2.34,1.249,.051), "glass", .011, -tilt)
        for i in range(-4,5):
            tx=i*.287
            pipe("Standing zinc glazing rib", [(tx,side*.025,.579),(tx,side*1.154,.073)], .026,"bare",8)
        box("Folded gutter at eaves", (0,side*1.171,.059), (2.38,.093,.102), "verdigris", .013)
        for end in (-1,1):
            pipe("Rake glazing bar", [(end*1.144,0,.593),(end*1.144,side*1.16,.076)],.031,"black",8)
    pipe("Watertight ridge", [(-1.196,0,.583),(1.196,0,.583)], .047,"bare",10)

    work.make("roof", "LouvreHood")
    box("Folded curb", (0,0,.057),(1.675,1.338,.114),"iron",.025)
    box("Decommissioned intake shell", (0,0,.306),(1.574,1.235,.49),"verdigris",.043)
    box("Inlaid intake shadow", (0,-.625,.304),(1.446,.024,.342),"black",.026)
    for n in range(7):
        z=.151+n*.048
        box("Angled rain baffle",(0,-.649,z),(1.43,.062,.025),"bare",.008,-.32)
    for x in (-.719,.719):
        for z in (.141,.467):
            work.stud(x,-.635,z,.014)
    box("Upper plenum fan cover",(0,0,.590),(1.60,1.27,.101),"iron",.021)
    pipe("Deep fan intake throat",[(0,0,.64),(0,0,.658)],.443,"black",32)
    for radius in (.155,.247,.340,.449):
        guard = [(radius * math.cos(i * math.tau / 20), radius * math.sin(i * math.tau / 20), .684)
                 for i in range(21)]
        pipe("Circular wire guard", guard, .0065, "bare", 6)
    for axis in (0, 1):
        line = [(-.448, 0, .684), (.448, 0, .684)]
        pipe("Guard support crossbar", line if axis == 0 else [(y,x,z) for x,y,z in line],
             .0075, "bare", 6)

    work.make("roof", "LouvreRotor")
    pipe("Central fan spindle",[(0,0,-.031),(0,0,.031)],.086,"brass",20)
    for i in range(7):
        angle=math.tau*i/7
        u,v=Vector((math.cos(angle),math.sin(angle),0)),Vector((-math.sin(angle),math.cos(angle),0))
        points = [u*r+v*a+Vector((0,0,z)) for r,a,z in ((.05,-.018,.007),(.18,-.058,.018),
                    (.37,-.037,.018),(.396,.05,-.018),(.25,.084,-.026),(.075,.062,-.013))]
        work.mesh("Curved impeller vane",points,[(0,1,5),(1,4,5),(1,2,4),(2,3,4)],"bare",True)

    work.make("roof", "Scupper")
    box("Rain catch plate", (0,-.016,-.043),(.62,.067,.33),"iron",.016)
    box("Black catch opening",(0,-.063,-.048),(.383,.048,.203),"black",.024)
    for x in (-.173,.0,.173):
        box("Debris comb",(x,-.091,-.049),(.028,.027,.225),"bare",.007)
        work.stud(x,-.092,.081,.014)
    pipe("Swept downspout",[(0,-.10,-.12),(0,-.177,-.236),(0,-.252,-.357),(0,-.276,-.50),
         (0,-.276,-1.08),(0,-.273,-1.391),(.042,-.267,-1.483),(.129,-.265,-1.522)],
         .115,"verdigris",14)
    for z in (-.66,-1.212):
        pipe("Galvanized bracket",( (0,-.276,z-.028),(0,-.276,z+.028)),.123,"iron",14)

    work.make("roof", "Planter")
    box("Damp raised-bed trough",(0,-.201,.239),(1.58,.418,.472),"verdigris",.036)
    box("Deep soil",(0,-.20,.474),(1.48,.356,.029),"soil",.014)
    for y in (-.397,-.013):
        box("Pressed terracotta lip",(0,y,.482),(1.59,.044,.06),"algae",.013)
    for x in (-.746,.746):
        box("Parapet end strap",(x,-.199,.249),(.068,.437,.496),"iron",.015)
    for i in range(12):
        x=randomizer.uniform(-.69,.70)
        y=randomizer.uniform(-.34,-.065)
        rise=randomizer.uniform(.110,.43)
        lean=randomizer.uniform(-.21,.22)
        pipe("Rain-bowed stem",[(x,y,.483),(x+lean*.28,y-.015,.483+rise*.47),(x+lean,y-.049,.483+rise)], .0056,"leaf",6)
        for j in range(5):
            level=(j+1)/6
            ox=x+lean*level*.65
            oy=y-.048*level
            oz=.483+rise*level
            dx=(-1 if j%2 else 1)*randomizer.uniform(.09,.18)
            dy=randomizer.uniform(-.078,.082)
            points = [(ox,oy,oz),(ox+dx*.48,oy+dy-.029,oz+.061),
                      (ox+dx,oy+dy,oz+.089),(ox+dx*.47,oy+dy+.035,oz+.065),
                      (ox+dx*.54,oy+dy+.007,oz+.086)]
            work.mesh("Separated wet leaf lamina",points,[(0,4,1),(1,4,2),(2,4,3),(3,4,0)],
                      "leaflite" if i%4==1 else "leaf",True)

    work.make("roof", "Beacon")
    work.bulkhead(beacon)


def save_and_export(work):
    all_roots = [obj for group in work.groups.values() for obj in group]
    for chapter, group in work.groups.items():
        for i, parent in enumerate(group):
            parent.location = ((i%4)*3.4, (i//4)*2.8+(4.9 if chapter=="roof" else 0), 0)
    bpy.context.preferences.filepaths.save_version = 0
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_distance = 12.8
                area.spaces.active.region_3d.view_location = (4.7,4.6,1)
                area.spaces.active.shading.color_type = "MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"art/blender/pressure-and-roof.blend"),compress=True)
    for parent in all_roots:
        parent.location = (0,0,0)
    for chapter, group in work.groups.items():
        objects = set(group)
        for parent in group:
            batches = defaultdict(list)
            for obj in parent.children:
                batches[obj.data.materials[0]].append(obj)
            for material, items in batches.items():
                bpy.ops.object.select_all(action="DESELECT")
                for obj in items:
                    obj.select_set(True)
                bpy.context.view_layer.objects.active = items[0]
                if len(items)>1:
                    bpy.ops.object.join()
                mesh = bpy.context.object
                mesh.name = f"{parent.name} :: {material.name}"
                objects.add(mesh)
                mesh.data.calc_loop_triangles()
                print(chapter, parent.name, len(mesh.data.loop_triangles))
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(ENV / (chapter+"-plant.glb")),use_selection=True,
                                  export_format="GLB",export_animations=False,export_materials="EXPORT")


if __name__ == "__main__":
    if "--" not in sys.argv:
        raise SystemExit("Pass the directory of Metal Plate 02 JPEG maps after --")
    photo = Path(sys.argv[sys.argv.index("--")+1])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with tempfile.TemporaryDirectory(prefix="plant-atlas-") as temporary:
        atlas = baked_material(photo, Path(temporary))
        work = Workshop(atlas)
        boiler(work, lens_material("ServiceLens", (.73,.53,.25), 2.4))
        rooftop(work, lens_material("RedBeacon", (.59,.105,.044), 2.2))
        save_and_export(work)
