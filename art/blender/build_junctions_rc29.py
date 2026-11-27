"""LAST LIGHT architecture: authored junction profiles and landing hardware.
Blender -Y maps to game +Z. Keep each authored insert editable before batching.
"""
from collections import defaultdict
from pathlib import Path
from math import sin
from mathutils import Vector
import bpy

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
roots = []


def material(name, rgb, metal=0, rough=.72):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Wear'
    m.node_tree.links.new(attr.outputs['Color'], shader.inputs['Base Color'])
    return m


iron = material('Old cast iron', (.069,.074,.064), .45)
zinc = material('Dulled galvanized zinc', (.24,.265,.26), .63, .49)
oxide = material('Oxide finish', (.176,.102,.071), .32)
wood = material('Dark varnished oak', (.135,.083,.052), 0, .63)
plaster = material('Painted plaster', (.31,.277,.209), 0)
seal = material('Rubber compressible joint', (.027,.032,.028), .02, .88)
concrete = material('Weathered precast', (.276,.298,.283), 0, .91)
bronze = material('Tarnished landing bronze', (.32,.222,.117), .61, .55)
fire = material('Old fire-door enamel', (.203,.171,.103), .25)


def assembly(name):
    global root
    root = bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(root)
    roots.append(root)


def finish(o, name, m, bevel=0):
    o.name = name
    o.parent = root
    o.data.materials.append(m)
    color = o.data.color_attributes.new(name='Wear',type='FLOAT_COLOR',domain='POINT')
    transform = o.rotation_euler.to_matrix()
    for v in o.data.vertices:
        x,y,z = o.location + transform @ v.co
        shade = .92 + .086 * sin(23*x + 19*y + 14*z) * sin(17*x - 11*y + 29*z)
        color.data[v.index].color = (*(shade*c for c in m.diffuse_color[:3]),1)
    if bevel:
        mod = o.modifiers.new('Machined edge break','BEVEL')
        mod.width, mod.segments = bevel, 1
        mod.harden_normals = True
    return o


def geometry(name, verts, faces, m, at=(0,0,0), bevel=0):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    o = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(o)
    o.location = at
    return finish(o,name,m,bevel)


def extrusion(name,width,profile,m,at=(0,0,0),bevel=.002):
    # Counter-clockwise as viewed from positive X.
    area = sum(y*b-a*z for ((y,z),(a,b)) in zip(profile,profile[1:]+profile[:1]))
    if area < 0: profile = profile[::-1]
    n = len(profile)
    return geometry(name,[(x,y,z) for x in (-width/2,width/2) for y,z in profile],
                    [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+
                    [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],m,at,bevel)


def box(name, at, size, m, bevel=.004):
    w,d,h = (v/2 for v in size)
    return extrusion(name,w*2,[(-d,-h),(d,-h),(d,h),(-d,h)],m,at,bevel)


def pin(name,a,b,r,m,n=6):
    a,b = Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(b-a).length,location=(a+b)/2)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,.0006)


def junction(name, finish_mat, length, height, ann=False):
    assembly(name)
    L = length-.015
    # Mount against an unmodified wall, with a toe kick projecting into the room.
    extrusion('Coved skirting profile',L,[(.012,.014),(-.081,.014),(-.081,.038),(-.051,.065),(-.041,.09),
               (-.041,.157),(-.032,.177),(-.013,.184),(.016,.184)],finish_mat)
    box('Compression joint behind toe',(0,-.02,.019),(L,.042,.021),seal)
    for x in (-.43*L,.43*L):
        box('Lapped skirting seam',(x,-.043,.104),(.033,.022,.132),finish_mat)
        pin('Countersunk fixing',(x,-.05,.129),(x,-.061,.129),.011,zinc)
    if not ann:
        cornice(height,L,finish_mat)


def cornice(height,L,m):
    extrusion('Stepped crown profile',L,[(.022,-.180),(-.025,-.180),(-.040,-.161),(-.041,-.128),
              (-.075,-.116),(-.084,-.096),(-.084,-.067),(-.133,-.055),(-.139,-.024),(-.139,.014),(.022,.014)],m,(0,0,height))
    box('Recessed upper shadow joint',(0,-.028,height-.006),(L,.060,.023),seal)
    for x in (-L*.45,L*.45):
        box('Overlapping crown splice',(x,-.076,height-.081),(.034,.025,.065),m)


junction('BoilerJunction',iron,2.4,3.264)
junction('ArchiveJunction',wood,2.4,3.264)
junction('AnnexBase',iron,4.8,0,True)
assembly('AnnexCrown')
cornice(0,4.785,plaster)

assembly('RoofCopingBed')
box('Precast bedding slab',(0,0,.010),(2.378,2.378,.035),concrete,.009)
for x in (-1.127,1.127):
    for y in (-1.127,1.127):
        pin('Flush cast corner insert',(x,y,.025),(x,y,.033),.023,iron)

assembly('RoofCoping')
extrusion('Standing-seam fall and hem',2.392,[(.06,.002),(-.085,.008),(-.12,-.012),(-.13,-.065),
          (-.153,-.066),(-.153,-.012),(-.126,.031),(-.076,.045),(.06,.037)],zinc)
box('Bedded lead flashing',(0,-.010,-.008),(2.36,.119,.023),seal)
for x in [-1.142,1.142]:
    box('Folded splice cover',(x,-.036,.042),(.061,.217,.016),zinc)
    for y in (-.108,.035): pin('Coping rivet',(x,y,.049),(x,y,.055),.009,iron)

assembly('RoofCopingCorner')
# Socket centered at a convex wall corner. Both drips wrap the return.
box('Folded square return',(-.008,-.008,.030),(.31,.31,.035),zinc,.017)
for x,y,w,d in [(0,-.158,.30,.034),(.144,0,.036,.30)]:
    box('Mitered drip leg',(x,y,-.017),(w,d,.083),zinc,.006)
for x,y in [(-.097,-.1),(.072,-.1),(.072,.086)]:
    pin('Corner fixing',(x,y,.043),(x,y,.054),.012,iron)

assembly('RoofSoffitEdge')
# Negative vertical and turned back from the slab lip. No new standing area.
extrusion('Lower continuous return',2.38,[(.53,-.052),(-.036,-.052),(-.082,-.036),(-.082,.063),
          (-.042,.093),(.53,.093)],concrete,(0,0,-2.078))
for x in (-.73,.73):
    extrusion('Tapered bearing corbel',.187,[(.52,.115),(-.014,.115),(-.014,.026),(.20,-.155),(.52,-.155)],concrete,(x,0,-2.125),.011)
    box('Cast-in steel angle',(x,.044,-2.148),(.228,.153,.082),oxide,.009)
    for offset in (-.067,.067):
        pin('Corbel bolt',(x+offset,-.026,-2.156),(x+offset,-.044,-2.156),.019,zinc)


def sill(name,width,depth,facing):
    assembly(name)
    extrusion('Pressed threshold with sloped nose',width,[(-depth,.004),(-depth+.043,.034),(-.035,.049),
               (.024,.045),(.036,.027),(.036,.004)],facing)
    for y in (-depth+.065,-depth+.103,-.067):
        box('Traction strip',(0,y,.04),(width-.12,.014,.009),seal,.002)
    for x in (-width*.43,width*.43):
        box('Reinforced jamb shoe',(x,-.061,.037),(.13,.213,.058),iron,.006)
        for y in (-.092,-.170): pin('Sill countersunk screw',(x,y,.059),(x,y,.070),.011,zinc)


sill('LiftApron',1.74,.335,bronze)
sill('AnnexDoorSill',1.23,.29,zinc)

assembly('AnnexFireCasing')
for x in (-.654,.654):
    box('Folded casing jamb',(x,0,1.145),(.131,.193,2.29),fire,.013)
    box('Rebated fire seal',(x*.925,-.077,1.122),(.022,.033,2.227),seal,.005)
    box('Spot-welded cover',(x,-.101,1.15),(.076,.031,2.13),zinc,.008)
    box('Heel reinforcement shoe',(x,-.089,.137),(.145,.099,.274),iron,.009)
    for z in (.09,.19,.61,1.18,1.78,2.12):
        pin('Riveted jamb plate',(x,-.118,z),(x,-.139,z),.014,bronze)
    for z in (.24,1.18,2.015):
        box('Hinge-side weld plate' if x<0 else 'Strike-side keeper plate',(x*.94,-.012,z),(.075,.105,.104),zinc)
box('Folded lintel',(0,-.006,2.242),(1.435,.214,.153),fire,.011)
box('Overlapping lintel cover',(0,-.115,2.247),(1.306,.021,.084),zinc,.008)
box('Fire seal above leaf',(0,-.074,2.189),(1.165,.035,.022),seal)


for i,o in enumerate(roots): o.location=((i%4-1.5)*5.2, -(i//4)*2.9, 0)
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_location = (0,-2.8,.95)
        area.spaces.active.region_3d.view_distance = 20
        area.spaces.active.shading.color_type = 'MATERIAL'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/junctions-rc29.blend'), compress=True)
for root in roots:
    root.location=(0,0,0)
    sets=defaultdict(list)
    for obj in root.children:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        sets[obj.data.materials[0]].append(obj)
    for material,parts in sets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts: obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        bpy.context.object.name=root.name+' / '+material.name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/junctions-rc29.glb'),export_format='GLB')
