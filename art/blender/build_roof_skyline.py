"""Build three editable midground city blocks; export one batched glTF kit."""
from collections import defaultdict
from pathlib import Path
from random import Random
import bpy

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=.77, emission=0):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    return m


brick=material('Rain-darkened masonry',(.149,.104,.086))
concrete=material('Precast concrete panels',(.20,.228,.233))
metal=material('Blackened aluminium frames',(.067,.087,.091),.58)
light=material('Inhabited interiors',(.92,.66,.36),.56,1.2)
glass=material('Dark window glazing',(.045,.081,.103),.36)
led=material('Roof obstruction lights',(.72,.144,.09),.48,1.4)


def make_block(name, variant):
    root=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(root)
    rng=Random(9+variant*113)
    def box(label, pos, size, finish):
        w,d,h=(s/2 for s in size)
        data=bpy.data.meshes.new(label)
        data.from_pydata([(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),
                         (-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)],[],
                         [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        o=bpy.data.objects.new(label,data)
        bpy.context.collection.objects.link(o)
        o.location=pos
        o.data.materials.append(finish)
        o.parent=root
        return o
    skin=[brick,concrete,metal][variant]
    upper=16.42
    box('Recessed structural core',(0,0,upper/2),(4.88,4.88,upper),skin)
    for x in [-1,1]:
        for y in [-1,1]:
            box('External structural corner pier',(x*2.405,y*2.405,upper/2),(.29,.29,upper),concrete)
    for face in range(4):
        swap=face%2
        direction=1 if face<2 else -1
        def facade(label, u, h, offset, w, height, thick, m):
            coord=(u,direction*offset,h) if not swap else (direction*offset,u,h)
            dims=(w,thick,height) if not swap else (thick,w,height)
            return box(label,coord,dims,m)
        levels=[7,9,10][variant]
        columns=[4,5,3][variant]
        h=15.85/levels
        w=4.5/columns
        for n in range(levels):
            start=.25+n*h
            facade('Projecting slab edge',0,start+.06,2.49,4.69,.15,.18,concrete)
            facade('Continuous window sill',0,start+.42,2.50,4.66,.09,.16,concrete)
            facade('Setback spandrel panel',0,start+.245,2.461,4.58,.28,.082,skin)
            if variant==0:
                facade('Bonded lintel course',0,start+h-.25,2.51,4.63,.24,.20,brick)
            for k in range(columns):
                u=-2.25+(k+.5)*w
                pane=h-.67
                m=light if rng.random()<.25 else glass
                facade('Recessed pane',u,start+.49+pane/2,2.45,w*.82,pane,.035,m)
                facade('Window centre transom',u,start+.49+pane*.67,2.488,w*.82,.04,.067,metal)
                facade('Window jamb',u-w*.445,start+.49+pane/2,2.493,w*.11,pane,.105,metal)
                if variant==2 and (n+k+face)%5==0:
                    facade('External fan housing',u,start+.57,2.63,w*.40,.30,.29,concrete)
                    for slat in [-1,0,1]:
                        facade('Condenser slat',u,start+.57+slat*.066,2.785,w*.30,.022,.03,metal)
        facade('Upstand coping',0,16.68,2.44,5.0,.12,.26,concrete)
        facade('Roof parapet',0,16.44,2.44,4.92,.38,.19,skin)
    box('Service penthouse',(-.93,.30,17.14),(1.61,1.49,1.45),skin)
    box('Penthouse flashing',(-.93,.30,17.90),(1.79,1.67,.10),metal)
    box('Steel service door',(-.99,-.467,17.00),(.52,.06,1.08),metal)
    for i in range(1+variant):
        x=.60 + .48*i
        box('Mechanical curb',(x,-.84,16.54),(.42,.76,.29),concrete)
        box('Cooling unit cabinet',(x,-.84,16.85),(.37,.73,.39),metal)
        for j in range(3):
            box('Cooling unit top grille',(x,-1.06+j*.22,17.06),(.29,.036,.035),concrete)
    if variant!=1:
        box('Aerial mast',(1.63,1.56,17.31),(.064,.064,1.74),metal)
        box('Aerial spreader',(1.63,1.56,17.87),(.78,.037,.035),metal)
        box('Obstruction lamp',(1.63,1.56,18.22),(.10,.10,.12),led)
    return root


roots=[make_block('Skyline_'+str(i),i) for i in range(3)]
for i,root in enumerate(roots): root.location.x=(i-1)*7
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,0,8)
        area.spaces.active.region_3d.view_distance=35
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/roof-skyline.blend'),compress=True)
for root in roots:
    root.location.x=0
    buckets=defaultdict(list)
    for part in root.children:
        buckets[part.data.materials[0].name].append(part)
    for name,parts in sorted(buckets.items()):
        if len(parts)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for part in parts: part.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.join()
        bpy.context.object.name=root.name+' - '+name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/env/roof-skyline.glb'),export_format='GLB')
