"""Editable wall and deck assembly kit. Blender -Y faces the player-side of each socket."""
from collections import defaultdict
from math import pi, sin
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, tint, metal=.05, roughness=.66):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*tint,1)
    m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']
    pigment=m.node_tree.nodes.new('ShaderNodeVertexColor')
    pigment.layer_name='Patina'
    m.node_tree.links.new(pigment.outputs['Color'],p.inputs['Base Color'])
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=roughness
    return m


zinc=mat('Galvanized zinc',(.28,.32,.34),.63,.49)
cast=mat('Oil-stained cast iron',(.055,.073,.079),.42,.60)
paint=mat('Faded petrol enamel',(.105,.185,.18),.20,.64)
black=mat('Compression seals',(.023,.03,.032),.05,.79)
bronze=mat('Tarnished brass',(.35,.232,.112),.55,.47)
walnut=mat('Aged painted hardwood',(.171,.122,.086),.06,.64)
frame=mat('Dark ochre window paint',(.28,.209,.129),.12,.57)
plaster=mat('Cast mineral sill',(.43,.39,.32),.03,.79)
glass=mat('Old wired glass',(.123,.230,.243),.29,.38)
leaf=mat('Navy grey fire door enamel',(.138,.173,.152),.11,.54)
slab=mat('Concrete pit and roof panels',(.232,.24,.228),.04,.91)
rust=mat('Dulled oxide at steel joints',(.193,.126,.087),.34,.72)
bridge_day=mat('Amber galvanized bridge tread',(.257,.177,.084),.54,.59)
bridge_night=mat('Blue galvanized bridge tread',(.099,.189,.228),.55,.57)

roots=[]

def assembly(name):
    o=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(o)
    roots.append(o)
    return o


def finish(obj,name,material,bevel):
    obj.name=name
    obj.data.materials.append(material)
    obj.parent=active
    pigment=obj.data.color_attributes.new(name='Patina',type='FLOAT_COLOR',domain='POINT')
    for vertex in obj.data.vertices:
        x,y,z=obj.location + obj.rotation_euler.to_matrix() @ vertex.co
        noise=.91+.095*sin(x*22+y*31+z*13)*sin(z*27+x*18)+.06*sin(x*41-z*23)
        weather=max(0.,sin(x*37+y*22-z*19)*sin(z*19+y*27)-.60)*.3
        base=material.diffuse_color
        pigment.data[vertex.index].color=(*(noise*base[i]*(1-weather)+(.228,.114,.057)[i]*weather for i in range(3)),1)
    if bevel:
        o=bpy.context.view_layer.objects
        o.active=obj
        modifier=obj.modifiers.new('Rolled or machined edges','BEVEL')
        modifier.width=bevel
        modifier.segments=1
        modifier.harden_normals=True
    return obj


def box(name, at, size, material, b=.005):
    w,d,h=(v/2 for v in size)
    data=bpy.data.meshes.new(name)
    data.from_pydata([(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)],[],
                     [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    o=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(o)
    o.location=at
    return finish(o,name,material,b)


def rod(name,a,b,r,material,n=12,bevel=.001):
    a,b=Vector(a),Vector(b)
    axis=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=axis.length,location=(a+b)/2)
    obj=bpy.context.object
    obj.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
    return finish(obj,name,material,bevel)


def pin(x,y,z,r=.011, material=zinc):
    rod('Raised hex fastener',(x,y+.003,z),(x,y-.012,z),r,material,6)


def surround(name, center, width, height, y, depth, border, material):
    x,z=center
    for i in (-1,1):
        box(name+' jamb',(x+i*(width-border)/2,y,z),(border,depth,height),material)
        box(name+' rail',(x,y,z+i*(height-border)/2),(width-2*border,depth,border),material)


active=assembly('BoilerLouvre')
box('Pressed face gasket',(0,-.018,0),(1.59,.038,1.09),black,.019)
box('Recess behind louvers',(0,-.045,0),(1.48,.045,.99),cast,.015)
surround('Flanged galvanized frame',(0,0),1.56,1.06,-.122,.185,.078,zinc)
surround('Inset rolled carrier',(0,0),1.43,.923,-.194,.068,.025,paint)
for i in range(7):
    z=-.387+i*.128
    o=box('Pitched drainable louvre',(0,-.173,z),(1.353,.135,.061),paint,.008)
    o.rotation_euler.x=-.45
    box('Folded leading hem',(0,-.235,z+.030),(1.35,.024,.021),zinc,.004)
for x in (-.727,.727):
    for z in (-.445,0,.445): pin(x,-.224,z,.015)
box('Identification plate',(0,-.229,.499),(.262,.013,.041),bronze)

active=assembly('PipeSaddle')
box('Stamped wall plate',(0,-.015,-.127),(.17,.044,.36),cast)
for z in (-.269,.015): pin(0,-.040,z,.014)
for x in (-.064,.064):
    rod('Two-piece pipe clamp collar',(x-.019,0,0),(x+.019,0,0),.079,zinc,22)
    box('Split clamp lug',(x,-.089,-.083),(.045,.055,.059),paint)
    pin(x,-.119,-.083,.009)
box('Saddle web',(0,-.045,-.073),(.105,.081,.092),cast)

active=assembly('SupplyUnion')
rod('Main brazed neck',(-.193,0,0),(.193,0,0),.077,bronze,20)
for x in (-.119,.119): rod('Socket hex union',(x-.024,0,0),(x+.024,0,0),.096,zinc,8)
rod('Tee branch',(0,-.037,-.099),(0,-.037,.038),.050,bronze,18)
rod('Compression ring',(0,-.037,-.134),(0,-.037,-.100),.055,zinc,8)
rod('Downpipe joint',(0,-.037,-.180),(0,-.037,-.126),.041,bronze,14)

active=assembly('ArchiveWindow')
box('Interior blackout backer',(0,-.026,0),(1.57,.048,1.16),black,.008)
surround('Stepped outer casing',(0,0),1.61,1.18,-.061,.113,.096,walnut)
surround('Deep sash rebate',(0,0),1.448,1.02,-.115,.104,.049,frame)
for x in (-.333,.333):
    box('Recessed opaque wired glass',(x,-.121,0),(.598,.025,.892),glass,.006)
    surround('Individual sash',(x,0),.643,.942,-.153,.051,.031,frame)
    box('Transom bead',(x,-.174,.118),(.606,.028,.025),walnut)
    box('Latch keeper',(x+.207,-.184,-.380),(.069,.033,.019),bronze)
    pin(x+.195,-.209,-.380,.006,bronze)
box('Centred meeting stile',(0,-.180,0),(.064,.056,.965),walnut)
box('Projected two-stage sill',(0,-.138,-.585),(1.68,.298,.077),plaster,.024)
box('Undercut drip',(0,-.231,-.623),(1.61,.091,.014),walnut,.004)

active=assembly('ArchiveDoor')
surround('Mitered outer casing',(0,1.178),.986,2.36,-.055,.106,.052,walnut)
surround('Stopped door lining',(0,1.183),.906,2.29,-.092,.086,.035,frame)
box('Recessed infill door leaf',(0,-.078,1.138),(.803,.065,2.18),leaf,.006)
box('Bottom kick plate',(0,-.119,.208),(.763,.021,.29),zinc)
for x in (-.334,.334):
    for z in (.099,.317): pin(x,-.132,z,.008)
box('Recessed vision panel',(0,-.119,1.805),(.522,.017,.69),glass)
surround('Pinned vision surround',(0,1.807),.56,.729,-.143,.046,.035,cast)
for z in (.38,1.167,2.047):
    box('Hinge leaf',(-.374,-.132,z),(.058,.025,.089),bronze)
    rod('Hinge knuckle',(-.422,-.154,z-.055),(-.422,-.154,z+.055),.015,zinc)
box('Lock escutcheon',(.292,-.136,1.077),(.096,.027,.178),bronze,.010)
for z in (1.012,1.145): pin(.294,-.155,z,.007,bronze)
rod('Lever spindle',(.290,-.144,1.102),(.290,-.208,1.102),.022,zinc)
rod('Return lever',(.290,-.208,1.102),(.166,-.208,1.102),.014,zinc)
box('Low stone threshold',(0,-.093,.017),(.921,.24,.034),plaster)

active=assembly('RoofEdge')
box('Segmented spandrel panel',(0,.005,-1.288),(2.368,.132,1.47),slab,.015)
box('Folded galvanized outer drip',(0,-.046,-.229),(2.371,.204,.118),zinc,.012)
box('Recessed waterproof membrane return',(0,-.061,-.362),(2.368,.078,.131),black)
box('Low edge chord',(0,-.030,-1.992),(2.369,.151,.16),cast)
for x in (-.727,.727):
    box('Welded web stiffener',(x,-.109,-1.193),(.061,.102,1.64),rust,.008)
    for z in (-.492,-1.864):
        box('Anchorage cleat',(x,-.139,z),(.155,.058,.128),cast)
        pin(x,-.175,z,.019)
for x in (-1.095,-.548,0,.548,1.095): pin(x,-.154,-.219,.012)

active=assembly('AnnexPitLining')
box('Recessed continuous pit wall',(0,0,1.65),(4.8,.112,3.30),slab,.005)
for i in range(5):
    x=(i-2)*.95
    box('Separate precast retaining panel',(x,-.076,1.582),(.935,.082,3.105),slab,.009)
    for z in (.28,1.512,2.731):
        rod('Recessed tie plate',(x,-.116,z),(x,-.122,z),.059,cast,12)
        pin(x,-.124,z,.019)
box('Top ledger rail',(0,-.101,3.225),(4.75,.122,.115),rust,.008)

def deck(name,tread,frame):
    global active
    active=assembly(name)
    # Walkable surfaces retain the old top height, orientation and envelope.
    # Channel flanges and brackets add shape only below the deck.
    for i in range(9):
        x=(i-4)*.246
        box('Rolled tread crown',(x,0,-.026),(.167,2.23,.052),tread,.006)
        for edge in (-1,1):
            box('Downturned channel return',(x+edge*.066,0,-.068),(.024,2.224,.05),frame,.004)
        for y in (-.62,0,.62):
            box('Raised anti-slip stamp',(x,y,.004),(.125,.065,.008),frame,.003)
    for side in (-1,1):
        x=side*1.144
        box('Longitudinal folded outer rail',(x,0,-.043),(.084,2.371,.083),frame,.008)
        box('Lower side return flange',(x,0,-.113),(.110,2.32,.035),frame,.005)
        y=side*1.144
        box('Bolted end rail',(0,y,-.044),(2.20,.083,.087),frame,.005)
        box('Full-width recessed cross bearer',(0,side*.965,-.142),(2.295,.118,.087),cast,.006)
        for x in (-1.114,-.75,.75,1.114):
            rod('Flush bolt head',(x,y,-.012),(x,y,.005),.015,zinc,6)


deck('PhaseDeckDay',bridge_day,bronze)
deck('PhaseDeckNight',bridge_night,zinc)

for i,root in enumerate(roots): root.location.x=(i-4)*3.25
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,0,1)
        area.spaces.active.region_3d.view_distance=25
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/architecture-rc27.blend'),compress=True)

# Keep editable individual parts above, pack the runtime into a mesh per finish.
for root in roots:
    root.location.x=0
    buckets=defaultdict(list)
    for part in list(root.children):
        bpy.ops.object.select_all(action='DESELECT')
        part.select_set(True)
        bpy.context.view_layer.objects.active=part
        for modifier in list(part.modifiers): bpy.ops.object.modifier_apply(modifier=modifier.name)
        buckets[part.data.materials[0].name].append(part)
    for name,parts in sorted(buckets.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for part in parts: part.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        bpy.context.object.name=root.name+' | '+name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/architecture-rc27.glb'),export_format='GLB')
