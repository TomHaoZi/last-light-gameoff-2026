"""LAST LIGHT: phase-specific machine outlets and six editable evidence props."""
from collections import defaultdict
from math import cos, pi, sin
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name,rgb,metal=0,rough=.71):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    return m


iron=mat('Blackened iron',(.076,.088,.082),.46,.61)
zinc=mat('Oxidized zinc',(.263,.282,.272),.60,.51)
bronze=mat('Old brass',(.331,.207,.085),.54,.51)
rust=mat('Heat-stained enamel',(.208,.102,.052),.28,.69)
ceramic=mat('Cold blue-grey enamel',(.097,.164,.192),.34,.55)
hole=mat('Deep duct shadow',(.015,.021,.019),.18,.88)
wood=mat('Oiled dark oak',(.158,.097,.061),.02,.66)
brown=mat('Scuffed brown card',(.32,.224,.138),0,.93)
paper=mat('Cream rag paper',(.42,.35,.235),0,.91)
linen=mat('Canvas binding',(.247,.301,.252),0,.90)
blue=mat('Drawing blue',(.092,.243,.305),0,.77)
ink=mat('Carbon black ink',(.028,.035,.034),0,.87)
white=mat('Faded plan ink',(.69,.73,.64),0,.86)
red=mat('Old oxide stamp',(.38,.075,.037),0,.83)

roots=[]

def assembly(name):
    global root
    root=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(root)
    roots.append(root)


def finish(o,name,m,bevel=0):
    o.name=name
    o.parent=root
    o.data.materials.append(m)
    if bevel:
        b=o.modifiers.new('Worked edge','BEVEL')
        b.width=bevel
        b.segments=1
        b.harden_normals=True
    return o


def box(name,xyz,size,m,bevel=.004):
    w,d,h=(s/2 for s in size)
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)],[],
                     [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    o=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(o)
    o.location=xyz
    return finish(o,name,m,bevel)


def rod(name,a,b,r,m,n=14):
    a,b=Vector(a),Vector(b)
    axis=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=axis.length,location=(a+b)/2)
    o=bpy.context.object
    o.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,.0008)


def label(body,x,y,z,size,m):
    curve=bpy.data.curves.new(body,'FONT')
    curve.body=body
    curve.size=size
    curve.resolution_u=2
    o=bpy.data.objects.new('Print / '+body,curve)
    bpy.context.collection.objects.link(o)
    o.location=(x,y,z)
    return finish(o,o.name,m)


def outline(name,w,d,z,m):
    for side in [-1,1]:
        box(name+' side rail',(side*(w-.06)/2,0,z),(.06,d,.073),m)
        box(name+' end rail',(0,side*(d-.06)/2,z),(w-.12,.06,.073),m)


def hazard(name,skin,cold):
    assembly(name)
    box('Recessed dark throat',(0,0,.019),(1.44,1.06,.026),hole,.009)
    outline('Bolted service flange',1.51,1.16,.041,skin)
    for x in (-.719,.719):
        for y in (-.52,-.19,.19,.52):
            rod('Recessed washer',(x,y,.077),(x,y,.084),.022,iron)
            rod('Captive hex screw',(x,y,.082),(x,y,.092),.013,zinc,6)
    for j in range(9):
        x=(j-4)*.146
        box('Slotted rolled grate crown',(x,0,.077),(.081,1.033,.031),zinc,.004)
        box('Recessed stiffening flange',(x,0,.051),(.035,1.010,.044),iron)
    for y in (-.303,.303):
        box('Recessed grate bearer',(0,y,.037),(1.351,.087,.045),skin)
    if cold:
        for x in (-.36,.36):
            rod('Round return register',(x,0,.028),(x,0,.055),.181,ceramic,22)
            rod('Return register recess',(x,0,.053),(x,0,.058),.144,hole,22)
            for i in range(5):
                a=i*2*pi/5
                rod('Setback deflector blade',(x,0,.056),(x+.135*cos(a),.135*sin(a),.056),.011,zinc,8)
    else:
        for y in (-.19,.19):
            rod('Bronze heat manifold',(-.641,y,.065),(.641,y,.065),.025,bronze)
            for x in (-.609,-.315,.315,.609):
                rod('Reduced raised outlet nozzle',(x,y,.064),(x,y,.104),.026,iron,8)
                rod('Discoloured nozzle lip',(x,y,.102),(x,y,.111),.024,rust,16)
    for y in (-.575,.575):
        for i in range(5):
            box('Safety edge cast insert',((i-2)*.198,y,.081),(.086,.029,.012),bronze)


hazard('HeatOutlet',rust,False)
hazard('ColdReturn',ceramic,True)


def stand(name,skin,frame,drip=False):
    assembly(name)
    box('Grounded plinth',(0,0,.035),(.465,.36,.069),frame,.018)
    box('Upright body',(0,0,.37),(.377,.304,.63),skin,.021)
    box('Recessed face plate',(0,-.160,.376),(.295,.024,.497),frame,.008)
    for x in (-.132,.132):
        for z in (.189,.543): rod('Raised front fastener',(x,-.173,z),(x,-.188,z),.009,zinc,6)
    box('Top work surface',(0,0,.721),(.499,.404,.067),skin,.011)
    if drip:
        for y in (-.193,.193): box('Raised rain lip',(0,y,.766),(.472,.021,.024),frame)
        for x in (-.235,.235): box('Sink return',(x,0,.766),(.020,.364,.024),frame)


stand('BoilerEvidenceStand',iron,rust)
stand('ArchiveEvidenceStand',wood,iron)
stand('RoofEvidenceStand',ceramic,zinc,True)


def sheet(m,w,d,level,curl):
    verts=[]
    for i in range(9):
        t=i/8
        y=(t-.5)*d
        z=level+max(0,t-.7)**2*curl
        verts.extend([(-w/2,y,z),(w/2,y,z+.001*sin(t*10))])
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(8)]
    mesh=bpy.data.meshes.new('Curled record')
    mesh.from_pydata(verts,[],faces)
    o=bpy.data.objects.new('Curled record',mesh)
    bpy.context.collection.objects.link(o)
    finish(o,'Curled record sheet',m)
    mod=o.modifiers.new('Visible paper thickness','SOLIDIFY')
    mod.thickness=.0015


def record(name,title,code,style):
    assembly(name)
    level=.010
    page=blue if style=='plan' else paper
    medium=white if style=='plan' else ink
    if style=='clipboard':
        box('Clipboard backing',(0,0,.007),(.280,.326,.014),brown)
        level=.014
        box('Spring clamp',(0,.128,.030),(.092,.031,.025),zinc)
        rod('Exposed clamp axle',(-.047,.137,.031),(.047,.137,.031),.005,iron)
    elif style in ('ledger','handover'):
        box('Cloth-over-board cover',(0,0,.006),(.310,.319,.012),linen)
        box('Sectioned paper block',(0,0,.020),(.282,.295,.031),paper)
        rod('Rounded cloth spine',(-.145,-.145,.022),(-.145,.145,.022),.016,wood)
        if style=='handover':
            box('Canvas pocket flap',(.130,-.010,.039),(.041,.274,.009),linen)
            rod('Binding strap',(.112,-.147,.045),(.112,.147,.045),.010,brown)
        else:
            for x in (-.058,.052):
                rod('Register upper wire loop',(x,.107,.037),(x,.145,.043),.006,iron)
        level=.036
    elif style=='card':
        box('Pressed brass card holder',(0,0,.007),(.286,.282,.015),bronze)
        for x in (-.13,.13): box('Bent card keeper',(x,0,.023),(.012,.253,.018),zinc)
        level=.018
    elif style=='plan':
        rod('Rolled plan edge',(-.126,.133,.019),(.126,.133,.019),.016,blue,20)
    elif style=='tag':
        box('Stamped ID tag',(.077,.102,.021),(.108,.049,.021),bronze,.008)
        rod('Tag eyelet',(.126,.104,.022),(.126,.104,.034),.011,iron)
    sheet(page,.246,.267,level,.115)
    # Leave enough clearance to avoid subpixel depth conflicts with the
    # bent sheet and inset board after glTF export and shadow rendering.
    z=level+.0035
    if style=='plan':
        for i in range(4):
            box('Plan wall stroke',(-.087+i*.052,-.026,z),(.006,.115,.001),medium,0)
        for i in range(3):
            box('Plan divider',(0,-.080+i*.051,z),(.182,.004,.001),medium,0)
    else:
        for i in range(4):
            box('Ruled form line',(-.006,-.033-i*.015,z),(.194-i*.014,.002,.001),ink,0)
    label(title,-.107,.047,z,.020,medium)
    label(code,-.107,.017,z,.014,red if style!='plan' else medium)


for args in [
    ('BoilerRecord1','FIRE CONTROL','17:59 / OVERRIDE','clipboard'),
    ('BoilerRecord2','DUTY BOARD','GARY / STILL ON DUTY','card'),
    ('OfficeRecord1','PUBLIC REGISTER','GARY / EVACUATED','ledger'),
    ('OfficeRecord2','HANDOVER','STAIRS / INTERLOCK','handover'),
    ('RoofRecord1','EVACUATION PLAN','INDEPENDENT LIGHT','plan'),
    ('RoofRecord2','SERVICE NOTE','KEEP EXIT LAMP ON','tag'),
]: record(*args)

for i,o in enumerate(roots): o.location=((i%6-2.5)*1.85, -1.65*(i//6),0)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,-1.2,.3)
        area.spaces.active.region_3d.view_distance=11
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/inspection-rc28.blend'),compress=True)
for parent in roots:
    parent.location=(0,0,0)
    sets=defaultdict(list)
    for obj in list(parent.children):
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        if obj.type!='MESH':
            bpy.ops.object.convert(target='MESH')
            obj=bpy.context.object
        for m in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
        sets[obj.data.materials[0]].append(obj)
    for material,parts in sets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts: obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        bpy.context.object.name=parent.name+' / '+material.name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/inspection-rc28.glb'),export_format='GLB')
