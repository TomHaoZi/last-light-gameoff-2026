"""Author the archive floor modules and practical fixtures in Blender 4.5.

Run from any directory with blender -b -P art/blender/build_archive_interior.py.
Dimensions are in meters. Components remain editable in the saved scene.
"""

import math
import random
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene
KIT = bpy.data.collections.new("Records office and fire corridor")
SCENE.collection.children.link(KIT)
parent = None
pieces = {}


def rgb(code):
    cs = (int(code[i:i+2], 16) / 255 for i in (0, 2, 4))
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in cs)


def paint(name, color, roughness, metallic=0, emission=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*rgb(color), 1)
    surface = material.node_tree.nodes["Principled BSDF"]
    surface.inputs["Base Color"].default_value = material.diffuse_color
    surface.inputs["Roughness"].default_value = roughness
    surface.inputs["Metallic"].default_value = metallic
    surface.inputs["Emission Color"].default_value = material.diffuse_color
    surface.inputs["Emission Strength"].default_value = emission
    return material


iron = paint("ArchiveIron", "273033", .51, .64)
enamel = paint("GreyStoveEnamel", "586565", .47, .25)
lid = paint("ChalkEnamel", "89897b", .64, .15)
shale = paint("DarkVitreousBakings", "171d1c", .56, .13)
rust = paint("OxidizedIron", "765044", .75, .37)
brass = paint("DullBrass", "8b755a", .39, .68)
glass = paint("GlassPhosphor", "d0ebdb", .24, 0, 2.1)
glassDark = paint("UnpoweredTube", "73807b", .29, .12)
amber = paint("BulkheadGlass", "a34e3a", .31, .12, 2.2)
oak = paint("SmokedVeneer", "45352c", .63)
paper = paint("AshAndLedgerPaper", "aa9c87", .89)
paperGrey = paint("TypedCarbonCopy", "82796c", .93)
tile = paint("SlabUV", "85837d", .62)


def assembly(name):
    global parent
    parent = bpy.data.objects.new(name, None)
    KIT.objects.link(parent)
    parent.empty_display_type = "PLAIN_AXES"
    parent.empty_display_size = .2
    pieces[parent] = []


def mesh(name, points, faces, material, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(points, [], faces)
    data.update()
    for face in data.polygons:
        face.use_smooth = smooth
    obj = bpy.data.objects.new(name, data)
    KIT.objects.link(obj)
    obj.parent = parent
    data.materials.append(material)
    pieces[parent].append(obj)
    return obj


CORNERS = [(-1,-1,-1), (1,-1,-1), (1,1,-1), (-1,1,-1), (-1,-1,1), (1,-1,1), (1,1,1), (-1,1,1)]
SIDES = [(3,2,1,0), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)]


def box(name, center, dimensions, material, edge=.007, angle=0):
    points = []
    for dx,dy,dz in CORNERS:
        x,y,z = dx*dimensions[0]/2, dy*dimensions[1]/2, dz*dimensions[2]/2
        points.append((center[0]+x*math.cos(angle)-y*math.sin(angle),
                       center[1]+x*math.sin(angle)+y*math.cos(angle),center[2]+z))
    obj = mesh(name, points, SIDES, material)
    if edge:
        bevel = obj.modifiers.new("Rolled edge", "BEVEL")
        bevel.width, bevel.segments = min(edge, min(dimensions) * .28), 2
        obj.modifiers.new("Panel normals", "WEIGHTED_NORMAL")
    return obj


def tube(name, curve, radius, material, sides=10):
    from mathutils import Vector

    points, faces = [], []
    curve = [Vector(p) for p in curve]
    for i, p in enumerate(curve):
        direction = (curve[min(i + 1, len(curve) - 1)] - curve[max(0, i - 1)]).normalized()
        up = Vector((0, 1, 0)) if abs(direction.y) < .92 else Vector((1, 0, 0))
        u = direction.cross(up).normalized()
        v = direction.cross(u).normalized()
        for j in range(sides):
            a = j*math.tau/sides
            points.append(p+radius*(math.cos(a)*u+math.sin(a)*v))
            if i:
                previous = (i-1)*sides
                faces.append((previous+j, previous+(j+1)%sides, previous+sides+(j+1)%sides, previous+sides+j))
    faces.extend((tuple(reversed(range(sides))), tuple(range(len(points)-sides, len(points)))))
    return mesh(name, points, faces, material, True)


def bolt(x, y, z, mat=brass):
    tube("Slotted rivet", [(x,y,z-.012),(x,y,z+.004)], .009, mat, 8)
    box("Drive slot", (x,y,z+.005), (.012,.003,.0025), shale, 0, .37)


assembly("FloorSlab")
slab = box("Pressed tile slab with chamfer", (0,0,-.14), (2.39,2.39,.28), tile, .009)
uv = slab.data.uv_layers.new(name="Two meter ceramic scan")
for poly in slab.data.polygons:
    for loop in poly.loop_indices:
        v = slab.data.vertices[slab.data.loops[loop].vertex_index].co
        along = v.y if abs(poly.normal.z) > .5 else v.z
        # Never tessellate the texture in the shader. Each tile carries its own UVs.
        uv.data[loop].uv = ((v.x + 1.195)/2.39, (along + 1.195)/2.39)


def fluorescent(name, dead=False):
    assembly(name)
    box("Stamped channel", (0,0,.083), (1.56,.41,.125), iron, .027)
    box("Detachable reflector", (0,0,.040), (1.50,.35,.035), lid, .016)
    for side in (-1,1):
        y = side*.157
        box("Folded reflector lip", (0,y,.013), (1.48,.046,.046), enamel, .012)
        tube("Ribbed phosphor glass", [(-.661,y*.48,-.008),(.661,y*.48,-.008)], .024,
             glassDark if dead and side > 0 else glass, 14)
        for x in (-.665,.665):
            tube("Ceramic tombstone", [(x-.036,y*.48,-.008),(x+.036,y*.48,-.008)], .032, lid, 12)
            bolt(x, y*.84, .079)
    for x in (-.75,.75):
        tube("Ceiling conduit", [(x,0,.095),(x,0,.244),(x+.022,0,.304),(x+.075,0,.330)], .017, iron)
    for x in (-.71,-.47,-.24,0,.24,.47,.71):
        tube("Wire guard hoop", [(x,-.189,.026),(x,-.165,-.047),(x,-.118,-.067),
                                 (x,.118,-.067),(x,.165,-.047),(x,.189,.026)], .007, rust if dead else iron, 6)
    for y in (-.135,.135):
        tube("Guard longitudinal wire", [(-.743,y,-.058),(.742,y,-.058)], .007, iron, 6)


fluorescent("FluorescentFitting")
fluorescent("DamagedFitting", dead=True)

assembly("FireBulkhead")
box("Vitreous rear box", (0,-.043,0), (.40,.12,.31), iron, .033)
box("Opaque red lens", (0,-.105,.004), (.324,.089,.222), amber, .027)
for h in (-.105,-.068,-.031,.006,.043,.080,.117):
    tube("Heat guard", [(-.184,-.142,h),(-.14,-.17,h),(.14,-.17,h),(.184,-.142,h)], .010, iron, 8)
for x in (-.15,.15):
    tube("Mount stud", [(x,-.008,-.122),(x,-.043,-.122)], .014, brass)
tube("Painted service conduit", [(0,-.017,.100),(0,-.017,.388),(.025,-.017,.443),(.48,-.017,.443)], .019, iron)

assembly("RegisterCabinet")
box("Painted steel cabinet back", (0,-.11,1.02), (.89,.22,2.02), iron, .028)
box("Plinth", (0,-.129,.08), (.922,.267,.159), shale, .015)
box("Crimped cornice", (0,-.126,2.026), (.933,.262,.055), enamel, .013)
for y in (.415,.856,1.295,1.734):
    shift = .028 if y == .856 else 0
    box("Embossed drawer", (0,-.239-shift,y), (.826,.049,.414), enamel, .014)
    box("Worn drawer surround", (0,-.266-shift,y), (.777,.013,.372), lid, .011)
    box("Inset index card carrier", (0,-.279-shift,y+.090), (.185,.014,.070), brass, .005)
    box("Dog-eared index card", (0,-.288-shift,y+.09), (.156,.003,.048), paper, 0)
    box("Type on index card", (-.023,-.292-shift,y+.095), (.060,.002,.004), shale, 0)
    tube("Bent pull", [(-.092,-.28-shift,y-.039),(-.088,-.327-shift,y-.034),(.088,-.327-shift,y-.034),(.092,-.28-shift,y-.039)], .011, iron, 10)
    tube("Cylinder lock", [(.310,-.272-shift,y+.086),(.310,-.289-shift,y+.086)], .014, brass, 12)
    box("Key cut", (.31,-.289-shift,y+.086), (.012,.004,.004), shale, 0)

assembly("ReturnGrille")
box("Return air duct throat", (0,-.045,0), (1.01,.085,.41), shale, .03)
for x in (-.472,.472):
    box("End flange", (x,-.106,0), (.053,.057,.409), enamel, .011)
for z in (-.176,-.118,-.060,0,.060,.118,.176):
    box("Weathered louver face", (0,-.103,z), (.958,.088,.024), lid, .006)
    box("Shadowed louver backing", (0,-.082,z-.016), (.954,.055,.026), iron, .006)

assembly("FloorDrain")
box("Pressed floor flange", (0,0,.002), (.332,.376,.007), iron, .003)
box("Dark drain sleeve", (0,0,.006), (.273,.309,.004), shale, .003)
for i in range(-4,5):
    box("Satin cast iron grate", (i*.030,0,.010), (.013,.292,.008), enamel, .002)
for dx in (-.135,.135):
    for dy in (-.156,.156):
        bolt(dx,dy,.009,iron)

assembly("LedgerSpill")
noise = random.Random(2519)
for page in range(13):
    angle = noise.uniform(-2, 2)
    wide = noise.uniform(.166,.24)
    tall = wide*1.35
    x,y = noise.uniform(-.48,.46),noise.uniform(-.28,.27)
    curl = noise.uniform(.008,.036)
    def p(u,v):
        return (x+math.cos(angle)*u-math.sin(angle)*v, y+math.sin(angle)*u+math.cos(angle)*v,
                .003+page*.0013+curl*(max(0,v)/tall)**2)
    points = [p(u,v) for v in (-tall/2,-tall/6,tall/6,tall/2) for u in (-wide/2,wide/2)]
    mesh("Water-curled ledger", points, [(i,i+1,i+3,i+2) for i in (0,2,4)], paper if page%3 else paperGrey)
    for line in range(1,7):
        v = tall*(line/9-.35)
        a,b = -wide*.32,noise.uniform(.10,.33)*wide
        stroke = [p(a,v),p(b,v),p(b,v+.0018),p(a,v+.0018)]
        mesh("Carbon writing tracks", [(x,y,z+.0007) for x,y,z in stroke], [(0,1,2,3)], oak)

bpy.context.preferences.filepaths.save_version = 0
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_distance = 7.0

# Show authored modules side by side in the editable .blend's viewport.
positions = [(-2.8, .9, 0), (0, .6, 2.8), (2, .6, 2.8), (3.4,.5,1.8), (0, .6, 0),
             (2.0,.6,2.1), (1.85,-.6,0), (3.05,-.6,0)]
for obj, location in zip(pieces, positions):
    obj.location = location
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/blender/archive-interior.blend"), compress=True)
for obj in pieces:
    obj.location = (0, 0, 0)

# One primitive per finish and assembly; geometry stays reusable across bays.
for assembly, objects in pieces.items():
    finishes = {}
    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        finishes.setdefault(obj.data.materials[0], []).append(obj)
    for material, objects in finishes.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        objects[0].name = assembly.name + "_" + material.name

bpy.ops.export_scene.gltf(filepath=str(ROOT / "dist/3d/assets/env/archive-interior.glb"),
                         export_format="GLB", export_animations=False)
