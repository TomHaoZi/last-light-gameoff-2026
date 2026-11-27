"""LAST LIGHT: electrical plates, ceiling suspension, roof shell and annex joints."""
from collections import defaultdict
from pathlib import Path
from mathutils import Vector
import bpy

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
roots=[]

def finish(name,rgb,metal=.12,rough=.66,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    p.inputs['Emission Color'].default_value=(*rgb,1); p.inputs['Emission Strength'].default_value=emission
    return m

iron=finish('Blackened steel',(.056,.069,.061),.52)
steel=finish('Dull green enamel',(.16,.235,.197),.33)
zinc=finish('Weathered zinc',(.245,.279,.27),.63)
bronze=finish('Tarnished brass',(.318,.215,.097),.49)
seal=finish('Compressed gasket',(.022,.028,.026),.02,.9)
porcelain=finish('Yellowed ceramic',(.51,.43,.298),.02)
wood=finish('Smoked oak veneer',(.226,.155,.085),.05)
concrete=finish('Grey cast cement',(.224,.242,.234),.02,.89)
red=finish('Oxide primer',(.256,.114,.065),.16)
warm=finish('Lamp diffusion glass',(.66,.48,.26),.12,.42,.74)
green=finish('Exit diffusion glass',(.40,.70,.58),.12,.42,.70)


def assembly(name):
    global active
    active=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(active); roots.append(active)


def part(obj,name,m,b):
    obj.name=name; obj.parent=active; obj.data.materials.append(m)
    if b:
        mod=obj.modifiers.new('Cut edge bevel','BEVEL'); mod.width=b; mod.segments=1; mod.harden_normals=True
    return obj


def extrude(name,w,profile,xyz,m,b=.004):
    if sum(y*v-u*z for ((y,z),(u,v)) in zip(profile,profile[1:]+profile[:1]))<0: profile=profile[::-1]
    n=len(profile); data=bpy.data.meshes.new(name)
    data.from_pydata([(x,y,z) for x in (-w/2,w/2) for y,z in profile],[],
        [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=xyz
    return part(o,name,m,b)


def box(name,xyz,dimensions,m,b=.004):
    w,d,h=dimensions; d/=2; h/=2
    return extrude(name,w,[(-d,-h),(d,-h),(d,h),(-d,h)],xyz,m,b)


def stud(name,a,b,r,m,n=8):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return part(o,name,m,.0008)


def plate(name,face,body,control):
    assembly(name)
    box('Rebated wall gasket',(0,-.020,0),(.342,.047,.190),seal,.009)
    box('Bevel-edged cover plate',(0,-.045,0),(.332,.045,.183),body,.009)
    box('Pressed ceramic face',(0,-.066,0),(.268,.022,.129),face,.009)
    for x in (-.146,.146):
        stud('Slotted flush screw',(x,-.063,0),(x,-.078,0),.012,zinc)
        o=box('Recess across screw head',(x,-.078,0),(.016,.0018,.0029),seal,0); o.rotation_euler.y=x*3
    if control:
        box('Recessed rectangular switch well',(-.052,-.080,0),(.077,.014,.092),seal)
        extrude('Tapered tipped rocker',.057,[(-.013,-.035),(.011,-.035),(.012,.036),(-.028,.023)],(-.052,-.085,0),iron,.005)
        stud('Lamp bezel',(.062,-.078,.017),(.062,-.090,.017),.021,bronze,12)
        stud('Amber pilot glass',(.062,-.090,.017),(.062,-.094,.017),.014,warm,14)
        box('Stamped lower legend',(.063,-.079,-.032),(.072,.004,.018),bronze)
    else:
        for x in (-.055,.055):
            box('Dark recess of twin contact', (x,-.078,.013),(.040,.008,.012),seal,.003)
            box('Stamped terminal lower slot',(x,-.079,-.018),(.022,.006,.012),seal,.003)
        box('Internal brass bridge',(0,-.076,-.045),(.117,.003,.008),bronze,.001)

plate('BoilerControlPlate',bronze,steel,True)
plate('ArchiveSocketPlate',porcelain,wood,False)


def beam(name,m,w,d,h):
    assembly(name)
    extrude('Rolled beam cross section',w,[(-d/2,0),(d/2,0),(d/2,.031),(.035,.031),(.035,h-.034),(d/2,h-.034),
      (d/2,h),(-d/2,h),(-d/2,h-.034),(-.035,h-.034),(-.035,.031),(-d/2,.031)],(0,0,0),m)
    for x in (-.435*w,.435*w):
        box('Bolted end splice',(x,0,h*.50),(.129,d+.017,h+.014),zinc,.005)
        box('Ceiling mounting shoe',(x,0,h+.019),(.208,d+.101,.040),iron,.005)
        for y in (-d*.63,d*.63): stud('Vertical anchor nut',(x,y,h-.010),(x,y,h+.007),.012,bronze,6)

beam('BoilerCeilingJoist',iron,2.394,.162,.205)
beam('ArchiveCeilingJoist',steel,2.391,.256,.159)


def lantern(name,lens):
    assembly(name)
    box('Recessed cast housing',(0,0,.076),(.722,.355,.146),iron,.024)
    box('Perimeter gasket',(0,0,.011),(.653,.301,.037),seal,.008)
    box('Cast swing-out lens tray',(0,0,-.013),(.639,.298,.042),steel,.011)
    box('Ribbed glass well',(0,0,-.033),(.519,.187,.024),lens,.007)
    for x in (-.262,.262):
        box('Captive guard strap',(x,0,-.047),(.030,.255,.019),zinc,.003)
        stud('Hinge barrel',(x-.041,.155,-.001),(x+.041,.155,-.001),.014,bronze)
    for y in (-.076,-.039,0,.039,.076): box('Frosted glass prism',(0,y,-.047),(.463,.010,.009),lens,.001)
    for x in (-.22,.22):
        stud('Standoff tube',(x,0,.13),(x,0,.278),.032,zinc,10)
        box('Two-slot fixing flange',(x,0,.268),(.123,.125,.026),iron,.006)
        for y in (-.035,.035): stud('Fixture screw',(x,y,.245),(x,y,.265),.010,bronze,6)

lantern('BoilerWorkLight',warm)
lantern('BoilerExitLight',green)

assembly('ArchiveLightFeed')
# Coordinates are relative to the original troffer's light origin.
for x in (-.449,.449):
    stud('Rigid hang tube',(x,0,.125),(x,0,.280),.024,zinc,10)
    box('Batten saddle',(x,0,.152),(.109,.130,.035),steel,.005)
    box('Ceiling face plate',(x,0,.274),(.128,.113,.027),zinc,.006)
    for y in (-.042,.042): stud('Face plate screw',(x,y,.255),(x,y,.272),.009,iron,6)

assembly('RoofInspectionCover')
box('Folded weather backing',(0,-.039,0),(.745,.095,.325),zinc,.009)
box('Inset hood throat',(0,-.092,0),(.637,.041,.249),seal,.010)
for i in range(4):
    z=(i-1.5)*.050
    extrude('Rain-shedding pressed blade',.609,[(-.065,-.013),(-.066,-.031),(-.081,-.031),(-.082,-.009),
          (-.030,.023),(.005,.022),(.004,.009)],(0,-.052,z),steel,.003)
for x in (-.346,.346):
    for z in (-.124,.124): stud('Weather cover captive screw',(x,-.088,z),(x,-.105,z),.012,bronze,6)

assembly('RoofSoffitField')
box('Reinforced infill core',(0,0,-.636),(2.385,2.385,.885),concrete,.007)
box('Precast soffit panel',(0,0,-1.103),(2.363,2.363,.092),concrete,.007)
for y in (-.68,.68):
    extrude('Tapered downstand rib',2.344,[(-.106,.048),(.106,.048),(.077,-.117),(.044,-.164),(-.044,-.164),(-.077,-.117)],(0,y,-1.119),concrete,.007)
for x in (-.876,.876):
    box('Rectangular steel structural plate',(x,0,-1.157),(.242,.268,.031),iron,.006)
    for y in (-.079,.079): stud('Downfacing structural anchor',(x,y,-1.177),(x,y,-1.158),.015,zinc,6)

assembly('AnnexPanelJoint')
# Unit height; scaled to known wall jambs at placement time.
box('Vertical compression rebate',(0,-.025,.50),(.097,.058,1),seal,.007)
box('Folded connecting mullion',(0,-.059,.50),(.076,.053,.992),steel,.007)
box('Recessed metal flashing',(0,-.087,.51),(.044,.014,.942),zinc,.006)
for z in (.07,.26,.55,.75,.93): stud('Joint rivet',(0,-.094,z),(0,-.106,z),.012,bronze,6)
box('Replaceable joint heel',(0,-.067,.044),(.131,.076,.085),iron,.008)

assembly('AnnexBridgeCorner')
# Keep entirely inside the walking footprint and mount in the bridge phase.
box('Flanged end pad',(-.135,.12,-.007),(.297,.261,.035),zinc,.004)
box('Raised safety heel grip',(-.15,.096,.018),(.248,.164,.019),iron,.004)
for x in (-.23,-.07):
    for y in (.044,.172): stud('Bridge corner nut',(x,y,.024),(x,y,.038),.014,bronze,6)
box('End stop plate',(-.135,.009,.013),(.289,.023,.046),red,.005)

for i,o in enumerate(roots): o.location=((i%4-1.5)*3.2,-(i//4)*3.05,0)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,-3.1,.48)
        area.spaces.active.region_3d.view_distance=12
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/detail-rc31.blend'),compress=True)
for o in roots:
    o.location=(0,0,0); groups=defaultdict(list)
    for p in o.children:
        bpy.ops.object.select_all(action='DESELECT'); p.select_set(True); bpy.context.view_layer.objects.active=p
        for mod in list(p.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        groups[p.data.materials[0]].append(p)
    for m,parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        bpy.context.object.name=o.name+' / '+m.name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/detail-rc31.glb'),export_format='GLB')
