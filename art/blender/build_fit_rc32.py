"""Editable finish pieces for LAST LIGHT's internal roof and annex edges."""
from collections import defaultdict
from pathlib import Path
from mathutils import Vector
import bpy

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
roots=[]

def finish(name,rgb,metal=0,rough=.76):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    shader=m.node_tree.nodes['Principled BSDF']; shader.inputs['Base Color'].default_value=(*rgb,1)
    shader.inputs['Metallic'].default_value=metal; shader.inputs['Roughness'].default_value=rough
    return m

zinc=finish('Weathered zinc',(.205,.235,.235),.65,.48)
bronze=finish('Muted gilt bronze',(.234,.174,.084),.56)
butyl=finish('Textured seal',(.036,.040,.037))
carpet=finish('Charcoal serged border',(.073,.062,.042))
thread=finish('Worn ocher thread',(.20,.146,.075))


def assembly(name):
    global active
    active=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(active); roots.append(active)


def part(obj,name,mat,b):
    obj.name=name; obj.parent=active; obj.data.materials.append(mat)
    if b:
        edge=obj.modifiers.new('Manufactured edge break','BEVEL'); edge.width=b; edge.segments=1; edge.harden_normals=True
    return obj


def slab(name,outline,lo,hi,m,b=.003,at=(0,0,0)):
    if sum(x*v-u*y for ((x,y),(u,v)) in zip(outline,outline[1:]+outline[:1]))<0: outline=outline[::-1]
    n=len(outline); data=bpy.data.meshes.new(name)
    data.from_pydata([(x,y,z) for z in (lo,hi) for x,y in outline],[],
       [tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=at
    return part(obj,name,m,b)


def box(name,at,size,m,b=.003):
    x,y,z=(n/2 for n in size)
    return slab(name,[(-x,-y),(x,-y),(x,y),(-x,y)],-z,z,m,b,at)


def pin(name,a,b,r,m,n=6):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return part(o,name,m,.0007)

assembly('RoofDeckInsideCorner')
# Three backed quadrants and a narrow lap into the concavity (+X/-Y).
outline=[(-.168,-.168),(.071,-.168),(.071,-.091),(.091,-.071),(.168,-.071),(.168,.168),(-.168,.168)]
slab('Three-way folded valley corner',outline,.046,.073,zinc,.009)
for x,y,w,d in [(.063,-.123,.021,.088),(.124,-.063,.084,.021)]:
    box('Rebated corner drip',(x,y,.009),(w,d,.088),zinc,.003)
    box('Inboard seal under lap',(x,y,-.017),(w-.008,d-.006,.036),butyl,.003)
for x,y in [(-.104,-.117),(-.104,.103),(.104,.107)]:
    pin('Sealed coping rivet',(x,y,.069),(x,y,.083),.011,bronze,8)

assembly('AnnexCarpetBoundEdge')
box('Flattened bound edge under runner',(0,0,.005),(.086,2.379,.011),carpet,.002)
box('Woven binding welt',(0,0,.009),(.028,2.375,.007),carpet,.003)
for i in range(18):
    p=box('Exposed lockstitch',(.004,(i-8.5)*.131,.012),(.036,.010,.004),thread,.0008)
    p.rotation_euler.z=.37 if i%2 else -.37

assembly('AnnexRecessBar')
box('Thin stepped bearing bar',(0,0,.010),(.111,2.38,.019),bronze,.004)
box('Recessed rubber key',(0,0,.021),(.029,2.35,.008),butyl,.002)
for y in (-.996,-.64,-.27,.27,.64,.996):
    pin('Recess threshold screw',(.034,y,.016),(.034,y,.023),.010,zinc,8)

for i,o in enumerate(roots): o.location=((i-1)*3.2,0,0)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,0,.13)
        area.spaces.active.region_3d.view_distance=10
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/fit-rc32.blend'),compress=True)
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
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/fit-rc32.glb'),export_format='GLB')
