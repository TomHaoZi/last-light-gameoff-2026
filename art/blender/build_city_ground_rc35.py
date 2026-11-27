"""Editable, instanced street and lot kit for the far-below-roof city layer."""
from collections import defaultdict
from pathlib import Path
from math import cos, pi, sin
from mathutils import Vector
import bpy

root=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
roots=[]

def mat(name,rgb,metal=0,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.78
    if emission:
        p.inputs['Emission Color'].default_value=(*rgb,1); p.inputs['Emission Strength'].default_value=emission
    return m

soil=mat('Cool distant subgrade',(.051,.061,.064))
asphalt=mat('Coarse street asphalt',(.071,.079,.081))
stripe=mat('Faded desaturated lane ochre',(.235,.182,.104),emission=.07)
white=mat('Worn crossing paint',(.29,.29,.257),emission=.06)
stone=mat('Weathered stone curbs',(.205,.211,.186))
sidewalk=mat('Sidewalk slabs',(.144,.156,.149))
roof=mat('Tar and gravel roofing',(.071,.084,.087))
wall=mat('Warm masonry',(.179,.144,.116))
metal=mat('Sooted street hardware',(.084,.108,.099),.42)
light=mat('City lamp amber diffuser',(.66,.339,.108),emission=.67)
glass=mat('Dim opaque shop glass',(.059,.105,.115),.34)
green=mat('Urban canopy',(.092,.151,.094))


def assembly(name):
    global a
    a=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(a); roots.append(a)


def box(name,at,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at)
    o=bpy.context.object; o.name=name; o.parent=a; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Small edge break','BEVEL'); mod.width=bevel; mod.segments=1; mod.harden_normals=True
    return o


def tube(name,one,two,r,material,n=6):
    one,two=Vector(one),Vector(two)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(two-one).length,location=(one+two)/2)
    o=bpy.context.object; o.name=name; o.parent=a; o.rotation_euler=(two-one).to_track_quat('Z','Y').to_euler(); o.data.materials.append(material)


def tree(x,y):
    tube('Tree trunk',(x,y,.24),(x,y,1.74),.13,wall)
    for ox,oy,h,s in [(0,0,2.21,1),(.47,.13,2.08,.67),(-.45,-.22,1.99,.7)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=s,location=(x+ox,y+oy,h))
        o=bpy.context.object; o.name='Faceted distant canopy'; o.parent=a; o.scale=(1,.92,.91); o.data.materials.append(green)


assembly('CitySubgrade')
box('Continuous distant grade',(0,0,-.090),(216,216,.12),soil)
# A low layer of differently shaded parcels remains under both tower rings.
for i in range(-5,6):
    for j in range(-5,6):
        if (i*23+j*37)%5<2:
            box('Old grading parcel',(i*18.8,j*18.8,-.044),(18.58,18.58,.038),roof)


def arc(name, inner, outer, depth, top, material, steps, first=0, turn=2*pi):
    vertices=[]; faces=[]
    closed=turn==2*pi
    for i in range(steps if closed else steps+1):
        alpha=first+i*turn/steps
        vertices.extend((r*cos(alpha),r*sin(alpha),z) for r,z in
                        [(inner,top),(outer,top),(inner,top-depth),(outer,top-depth)])
    for i in range(steps):
        k=i*4; b=(i+1)*4%len(vertices)
        faces.extend([(k,k+1,b+1,b),(k,b,b+2,k+2),(k+1,k+3,b+3,b+1),(k+2,b+2,b+3,k+3)])
    if not closed: faces.extend([(0,2,3,1),(b,b+1,b+3,b+2)])
    g=bpy.data.meshes.new(name); g.from_pydata(vertices,[],faces); g.update()
    o=bpy.data.objects.new(name,g); bpy.context.collection.objects.link(o); o.parent=a; g.materials.append(material)

assembly('CityBoulevard')
arc('Closed four-meter boulevard',42.70,46.80,.056,.046,asphalt,144)
arc('Inner paver gutter',42.77,42.92,.046,.067,stone,144)
arc('Outer paver gutter',46.55,46.74,.046,.067,stone,144)
for i in range(88):
    arc('Lane dash',44.70,44.81,.012,.061,stripe,1,i*pi*2/88,.036)

assembly('CityAccessLane')
box('Factory gate access lane',(0,0,.005),(2.36,1,.06),asphalt)
for x in (-1.09,1.09): box('Access-lane drainage lip',(x,0,.036),(.12,1,.035),sidewalk)

assembly('CityRoad')
box('Travel lanes',(0,0,.009),(3.64,8.4,.042),asphalt)
for x in (-1.62,1.62): box('Paver gutter',(x,0,.028),(.12,8.4,.030),stone)
for y in (-2.8,0,2.8): box('Two-lane center dash',(0,y,.035),(.115,1.48,.014),stripe)

assembly('CityCrossing')
box('Narrow four-way junction',(0,0,.010),(3.638,3.638,.039),asphalt)

assembly('CityStopBars')
for x in (-1.27,-.76,-.25,.25,.76,1.27):
    box('Worn zebra stripe',(x,-1.23,.036),(.25,.42,.013),white)

assembly('CityPavedBlock')
box('Raised lot and retaining curb',(0,0,.085),(8.36,8.36,.22),stone,.072)
for x in (-3.2,-1.06,1.06,3.2):
    for y in (-3.2,-1.06,1.06,3.2): box('Shallow sidewalk slab',(x,y,.194),(2.10,2.10,.041),sidewalk,.019)

assembly('CityPublicSquare')
box('Square inset planted court',(0,0,.239),(5.40,5.40,.22),stone,.13)
box('Park soil bed',(0,0,.355),(5.13,5.13,.11),green,.09)
box('Diagonal pedestrian paving',(0,0,.413),(4.76,.84,.034),sidewalk,.141).rotation_euler.z=pi/4
for x,y in [(-1.54,.92),(1.54,-.92),(1.39,1.67)]: tree(x,y)
for x,y in [(-1.13,-.79),(1.13,.79)]:
    box('Low public bench',(x,y,.53),(1.0,.32,.15),wall,.04)

assembly('CityServiceYard')
box('Delivery and parking surface',(0,0,.224),(5.90,5.76,.072),asphalt,.055)
for x in (-2.24,-1.14,-.04,1.06,2.16): box('Faded parking stripe',(x,1.48,.27),(.073,2.46,.013),white)
for x,y,c in [(-1.46,.92,glass),(1.83,1.26,wall)]:
    box('Small parked vehicle',(x,y,.52),(.83,1.59,.41),c,.12)
    box('Pitched vehicle cabin',(x,y-.1,.77),(.69,.83,.22),glass,.062)
    for dx in (-.38,.38):
        for dy in (-.52,.52): tube('Wheel',(x+dx-.057,y+dy,.41),(x+dx+.057,y+dy,.41),.129,metal)
box('Delivery shed walls',(.94,-1.88,1.09),(2.48,1.81,1.79),wall,.073)
box('Sheet-metal shed eave',(.94,-1.88,2.04),(2.80,2.10,.21),roof,.053)
box('Roll-up delivery shutter',(.94,-.96,.97),(1.52,.13,1.38),metal,.033)

assembly('CityLowRise')
box('Inset masonry storefront block',(0,0,1.66),(5.74,4.82,2.96),wall,.06)
box('Concrete stem and stoop',(0,0,.31),(6.22,5.22,.24),stone,.075)
box('Tar roof deck',(0,0,3.198),(5.86,4.98,.22),roof,.048)
for x in (-2.86,2.86): box('Stone parapet wall',(x,0,3.36),(.17,4.91,.37),stone,.035)
for y in (-2.40,2.40): box('Stone parapet return',(0,y,3.36),(5.79,.17,.37),stone,.035)
box('Elevator head house',(.51,-.7,3.59),(1.51,1.34,.61),wall,.047)
box('Roof plenum',(-1.12,.85,3.55),(1.04,.78,.47),metal,.03)
for x in (-1.95,.0,1.95):
    box('Shop glass bay',(x,-2.43,1.04),(1.22,.087,1.30),glass,.026)
    box('Storefront metal canopy',(x,-2.66,1.92),(1.52,.47,.17),metal,.05)
    for y in (-2.439,2.439): box('Upper windowsill and glazing',(x,y,2.49),(.93,.09,.53),glass,.035)

assembly('CityStreetLight')
box('Cast concrete streetlight socket',(0,0,.26),(.32,.31,.33),stone,.045)
tube('Tapered-looking lamp stem',(0,0,.38),(0,0,2.42),.075,metal)
tube('Slanted top bracket',(0,0,2.35),(0,-.56,2.67),.055,metal)
box('Flattened street lamp housing',(0,-.61,2.63),(.44,.35,.16),metal,.05)
box('Street lamp amber diffuser',(0,-.61,2.54),(.34,.27,.067),light,.025)
box('Visible amber rim',(0,-.69,2.62),(.31,.15,.071),light,.02)

assembly('CityTowerFoot')
box('Wide foundation stone',(0,0,.065),(1,1,.22),stone,.014)
box('Second foundation course',(0,0,.21),(.948,.945,.13),sidewalk,.011)
box('Dark base sealing course',(0,0,.284),(.93,.927,.084),roof,.008)

# Editable library: arrange on repeated plinths rather than exporting a baked city scene.
for i,o in enumerate(roots):
    o.location=((i%4)*13,(i//4)*12,0) if i else (0,138,-.2)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        region=area.spaces.active.region_3d; region.view_location=(19,10,0); region.view_distance=51
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/blender/city-ground-rc35.blend'),compress=True)
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
bpy.ops.export_scene.gltf(filepath=str(root/'dist/3d/assets/env/city-ground-rc35.glb'),export_format='GLB')
