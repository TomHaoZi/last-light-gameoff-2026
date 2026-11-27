"""LAST LIGHT RC30 utilities. Blender -Y maps to game +Z. Editable source precedes batching."""
from collections import defaultdict
from math import cos, pi, sin
from pathlib import Path
from mathutils import Vector
import bpy

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
roots = []

def material(name, rgb, metal=.15, rough=.64, glow=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb,1); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = (*rgb,1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    p.inputs['Emission Color'].default_value = (*rgb,1); p.inputs['Emission Strength'].default_value = glow
    return m

copper=material('Oxidised copper',(.37,.158,.069),.53)
steel=material('Painted bottle-green steel',(.081,.157,.136),.48)
black=material('Painted cast iron',(.041,.054,.049),.48)
zinc=material('Dulled zinc flange',(.26,.283,.267),.66)
bronze=material('Brass compression joint',(.32,.229,.127),.58)
concrete=material('Recessed aggregate',(.250,.264,.253),.05,.86)
brick=material('Muted brick',(.193,.157,.150),.03,.91)
glass=material('Dark inset glazing',(.052,.075,.094),.29,.61)
amber=material('Ocher enamel safety inserts',(.51,.302,.08),.18,.68)
warm=material('Amber prismatic lens',(.92,.65,.32),.08,.51,.68)
mint=material('Green exit lens',(.50,.84,.71),.09,.50,.72)

def root(name):
    global active
    active=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(active); roots.append(active)

def part(o,name,m,b):
    o.name=name; o.parent=active; o.data.materials.append(m)
    if b:
        mod=o.modifiers.new('Manufactured edge break','BEVEL'); mod.width=b; mod.segments=1
        mod.harden_normals=True
    return o

def mesh(name,verts,faces,m,b=0):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces)
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o)
    return part(o,name,m,b)

def prism(name,w,profile,m,at=(0,0,0),b=.003):
    n=len(profile)
    if sum(y*v-u*z for ((y,z),(u,v)) in zip(profile,profile[1:]+profile[:1]))<0: profile=profile[::-1]
    o=mesh(name,[(x,y,z) for x in (-w/2,w/2) for y,z in profile],
       [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],m,b)
    o.location=at; return o

def box(name,xyz,size,m,b=.004):
    w,d,h=size; d/=2; h/=2
    return prism(name,w,[(-d,-h),(d,-h),(d,h),(-d,h)],m,xyz,b)

def rod(name,a,b,r,m,n=12):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return part(o,name,m,.001)

def elbow(name,R,r,z,m):
    verts=[]; n=16; steps=12
    for i in range(steps+1):
        a=pi+i*pi/(2*steps); dx,dy=cos(a),sin(a)
        for j in range(n):
            phi=2*pi*j/n; u=R+r*cos(phi)
            verts.append((R+dx*u,-R-dy*u,z+r*sin(phi)))
    faces=[]
    for i in range(steps):
        for j in range(n):
            a=i*n+j; b=i*n+(j+1)%n; faces.append((a,b,b+n,a+n))
    obj=mesh(name,verts,faces,m)
    for p in obj.data.polygons: p.use_smooth=True
    rod('Wrench-flat union on first tangent',(R-.013,0,z),(R+.056,0,z),r*1.31,bronze,10)
    rod('Wrench-flat union on second tangent',(0,-R+.013,z),(0,-R-.056,z),r*1.31,bronze,10)

root('PipeCorner')
# Canonical game run goes toward +X and +Z.
for z,r,m in [(0,.068,copper),(.21,.035,black)]: elbow('Mandrel-bent pipe',.252,r,z,m)

root('PipeStop')
for z,r in [(0,.068),(.21,.035)]:
    rod('Threaded blind union',(-.065,0,z),(.012,0,z),r*1.23,bronze,8)
    rod('Blind plug head',(.011,0,z),(.033,0,z),r*.86,black,6)

root('CeilingFeed')
stem=-.552  # Clear the existing ceiling beam line at the deeper wall bays.
rod('Rising supply branch',(0,stem,0),(0,stem,.865),.043,copper)
rod('Bridge from trunk',(0,-.018,.013),(0,stem,.013),.038,copper)
rod('Hex supply elbow foot',(0,stem,-.014),(0,stem,.067),.059,bronze,8)
rod('Split neck collar',(0,stem,.785),(0,stem,.856),.068,zinc)
rod('Recessed gasket',(0,stem,.827),(0,stem,.849),.098,black,16)
rod('Firestop plate',(0,stem,.836),(0,stem,.864),.123,zinc,20)
for a in [pi/4,3*pi/4,5*pi/4,7*pi/4]:
    x=.093*cos(a); y=stem+.093*sin(a); rod('Anchor head',(x,y,.823),(x,y,.843),.013,bronze,6)


def fixture(name,lens):
    root(name)
    box('Painted concrete plinth',(0,0,.044),(.34,.31,.09),concrete,.018)
    box('Gasketed post foot',(0,0,.106),(.257,.229,.053),steel,.009)
    for x in (-.091,.091):
        for y in (-.076,.076): rod('Post hold-down nut',(x,y,.128),(x,y,.149),.018,zinc,6)
    rod('Taper socket',(0,0,.13),(0,0,.242),.058,black,10)
    rod('Round tubular post',(0,0,.207),(0,0,2.741),.030,steel,14)
    box('Service hatch',(0,-.032,.37),(.075,.022,.181),black,.009)
    for z in (.307,.432): rod('Access hatch screw',(0,-.051,z),(0,-.042,z),.009,bronze,6)
    rod('Curved arm mounting sleeve',(-.283,0,2.739),(0,0,2.739),.043,steel)
    box('Gasketed luminaire enclosure',(-.29,0,2.813),(.615,.326,.148),steel,.031)
    prism('Angled roof of optical head',.58,[(-.154,0),(-.142,.046),(.071,.063),(.152,.033),(.154,0)],black,(-.29,0,2.884),.008)
    box('Seal around optical tray',(-.29,0,2.744),(.564,.258,.031),black,.009)
    box('Prismatic lens',(-.29,0,2.711),(.493,.207,.056),lens,.011)
    for x in [-.513,-.068]:
        box('Lens retaining clip',(x,0,2.739),(.035,.254,.026),zinc)
    for x in [-.44,-.36,-.28,-.20,-.12]: box('Lens refractor flute',(x,0,2.680),(.013,.171,.008),lens,.001)

fixture('RoofLamp',warm)
fixture('RoofExitLamp',mint)

root('AnnexNosing')
prism('Angle-rolled pit nosing',2.385,[(-.135,.001),(-.135,.02),(-.095,.043),(.019,.043),(.027,.029),
      (.026,-.114),(.002,-.119),(.002,.001)],zinc)
box('Replaceable traction pad',(0,-.060,.046),(2.33,.065,.010),black,.003)
for i in range(10): box('Raised warning enamel cartridge',((i-4.5)*.232,-.058,.053),(.134,.036,.008),amber,.001)
for x in (-1.056,-.64,-.21,.21,.64,1.056): rod('Nosing expansion stud',(x,-.101,.042),(x,-.101,.054),.016,bronze)

root('AnnexCarpetBar')
prism('Carpet-to-concrete transition bar',2.39,[(-.095,.005),(-.073,.022),(-.018,.031),(.041,.026),(.094,.005)],bronze)
box('Elastomer carpet compression seam',(0,-.035,.032),(2.352,.027,.009),black,.001)
for x in (-1.0,-.5,0,.5,1.0): rod('Floor strip countersink',(x,.03,.021),(x,.03,.031),.012,zinc,8)


def tower(name,m,style):
    root(name)
    # Normalized envelope: X/Z about 1 m, top at 1, street at 0. No bevels at this LOD.
    box('Street wall volume',(0,0,.47),(.95,.95,.94),m,0)
    inset=.40 if style==1 else .48
    box('Roof set-back storey',(0,0,.927),(inset*2,inset*2,.146),m,0)
    box('Projecting coping slab',(0,0,.889),(.995,.995,.024),concrete,0)
    box('Lift headhouse',(-.14,.094,1.035),(.282,.322,.09),m,0)
    for a in range(4):
        rot=a*pi/2
        for k in range(3 if style!=1 else 4):
            x=(k-1 if style!=1 else k-1.5)*(.235 if style!=1 else .183)
            for level in ([(.63,.38)] if style==2 else [(.32,.24),(.65,.26)]):
                at=(x*cos(rot)+.479*sin(rot),x*sin(rot)-.479*cos(rot),level[0])
                o=box('Continuous shadowed window bay',at,(.132,.024,level[1]),glass,0); o.rotation_euler.z=rot
        for h in ((.47,.805) if style==2 else (.474,)):
            o=box('Continuous facade ledge',(.481*sin(rot),-.481*cos(rot),h),(.959,.022,.016),m,0); o.rotation_euler.z=rot

for name,m,style in [('FarCityOffice',concrete,0),('FarCityBrick',brick,1),('FarCityService',steel,2)]: tower(name,m,style)

for i,o in enumerate(roots): o.location=((i%5-2)*3.4,-(i//5)*3.4,0)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,-3,.9)
        area.spaces.active.region_3d.view_distance=14
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/utilities-rc30.blend'),compress=True)
for o in roots:
    o.location=(0,0,0); groups=defaultdict(list)
    for p in o.children:
        bpy.ops.object.select_all(action='DESELECT'); p.select_set(True); bpy.context.view_layer.objects.active=p
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for mod in list(p.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        groups[p.data.materials[0]].append(p)
    for m,parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        bpy.context.object.name=o.name+' / '+m.name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/utilities-rc30.glb'),export_format='GLB')
