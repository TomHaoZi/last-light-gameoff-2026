"""Blender 4.5: wall-mount centrifugal-room extractor, guard and independent rotor."""
from pathlib import Path
from math import cos, pi, sin
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/blender'
ENV = ROOT / 'dist/3d/assets/env'
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgb, metal, rough):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb,1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Finish'
    m.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    return m


steel = material('Galvanized guard and mounting hardware',(.25,.285,.267),.75,.43)
paint = material('Petrol enamel over oxidized cast iron',(.080,.155,.155),.37,.62)
dark = material('Blackened frame interior and gasket',(.027,.032,.028),.27,.71)
blade = material('Painted pressed aluminium',(.275,.298,.25),.69,.44)
brass = material('Oxidized manufacturer brass',(.39,.24,.083),.59,.49)

static, moving = [], []
rotor = bpy.data.objects.new('ExtractorRotor', None)
bpy.context.collection.objects.link(rotor)


def finish(obj, name, mat, parts=static, smooth=False, bevel=0):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod = obj.modifiers.new('Machined edge break','BEVEL')
        mod.width, mod.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel:
        normals = obj.modifiers.new('Weighted hard edges','WEIGHTED_NORMAL')
        normals.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normals.name)
    obj.data.materials.append(mat)
    attr = obj.data.color_attributes.new(name='Finish',type='FLOAT_COLOR',domain='POINT')
    for v in obj.data.vertices:
        x,y,z = obj.matrix_world @ v.co
        oxide = sin(x*41+z*67+y*17)*sin(z*57-x*33)*.5 + .48*sin(x*22+z*15+y*54)
        chips = max(0, oxide-.39) * (.55 if mat == paint else .19)
        wear = .98 + .14*sin(x*52+z*15+y*22) + .075*sin(x*97+z*91)
        base = mat.diffuse_color
        attr.data[v.index].color = (*(base[i]*wear*(1-chips)+(.33,.168,.082)[i]*chips for i in range(3)),1)
    if parts is moving:
        obj.parent = rotor
    parts.append(obj)
    return obj


def box(name, p, dims, m, bevel=.009):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    obj=bpy.context.object
    obj.scale=dims
    return finish(obj,name,m,bevel=bevel)


def rod(name, a, b, rad, mat, n=24, parts=static):
    a,b=Vector(a),Vector(b)
    d=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=rad,depth=d.length,location=(a+b)/2)
    item=bpy.context.object
    item.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(item,name,mat,parts,smooth=n>8,bevel=min(.003,rad*.11))


def face_rod(name, x,z,y0,y1,rad,mat,n=24,parts=static):
    return rod(name,(x,y0,z),(x,y1,z),rad,mat,n,parts)


def torus(name, radius, y, wire, mat):
    bpy.ops.mesh.primitive_torus_add(location=(0,y,0),rotation=(pi/2,0,0),major_radius=radius,
        minor_radius=wire,major_segments=96,minor_segments=10)
    finish(bpy.context.object,name,mat,smooth=True)


def annulus(name, profile, mat):
    n=96
    verts=[(r*cos(2*pi*i/n),y,r*sin(2*pi*i/n)) for r,y in profile for i in range(n)]
    faces=[(row*n+i,row*n+(i+1)%n,((row+1)%len(profile))*n+(i+1)%n,((row+1)%len(profile))*n+i)
           for row in range(len(profile)) for i in range(n)]
    body = bpy.data.meshes.new(name)
    body.from_pydata(verts,[],faces)
    body.validate()
    obj=bpy.data.objects.new(name,body)
    bpy.context.collection.objects.link(obj)
    finish(obj,name,mat,bevel=.003, smooth=True)


box('Stamped square backplate',(0,-.038,0),(1.49,.056,1.49),paint,.027)
box('Compression gasket',(0,-.071,0),(1.45,.019,1.45),dark,.014)
face_rod('Recessed shadow well',0,0,-.085,-.095,.656,dark,96)
annulus('Rolled throat, retaining flange and stepped bell',[ (.689,-.074),(.716,-.094),(.716,-.286),
    (.707,-.319),(.676,-.338),(.640,-.331),(.623,-.314),(.632,-.280),(.65,-.116),(.66,-.074)],paint)
annulus('Front retaining lip',[(.656,-.327),(.677,-.323),(.693,-.328),(.695,-.348),(.678,-.355),(.654,-.351)],steel)
for x in [-.657,.657]:
    for z in [-.657,.657]:
        face_rod('Backplate washer',x,z,-.066,-.080,.036,steel)
        face_rod('M10 anchor head',x,z,-.080,-.107,.023,steel,6)
for i in range(8):
    a=2*pi*i/8+pi/8
    x,z=.683*cos(a),.683*sin(a)
    face_rod('Guard retaining screw',x,z,-.350,-.376,.016,steel,6)
    rod('Welded guard rib',(.08*cos(a),-.429,.08*sin(a)),(.66*cos(a),-.357,.66*sin(a)),.010,steel,12)
for i in range(1,10):
    r=i*.069+.02
    torus('Welded concentric guard wire',r,-.432+.11*r*r/.58,.006 if i<9 else .009,steel)
face_rod('Guard badge recess',0,0,-.430,-.452,.085,dark,48)
face_rod('Riveted brass guard badge',0,0,-.451,-.459,.060,brass,48)
for x in [-.038,.038]:
    face_rod('Badge rivet',x,0,-.459,-.466,.007,steel,12)
for x in [-.667,.667]:
    box('Stamped mounting lug',(x,-.170,-.460),(.092,.24,.19),paint,.016)

# The stamped blades are closed shells with curved planforms and a varying pitch.
def impeller(vane):
    verts=[]
    for d in [0,1]:
        for i in range(13):
            t=i/12
            r=.132+.475*t
            for j in range(7):
                u=j/6
                a=vane + .38*t*t + (u-.33)*(.69-.42*t)
                camber=.023*sin(pi*u)*(1-.42*t)
                depth=-.216 + ((u-.5)*(.119-.041*t)) + camber - .018*t + d*.020
                verts.append((r*cos(a),depth,r*sin(a)))
    faces=[]
    stride=13*7
    for layer in [0,1]:
        for i in range(12):
            for j in range(6):
                v=layer*stride+i*7+j
                f=(v,v+1,v+8,v+7)
                faces.append(f if layer==0 else tuple(reversed(f)))
    edge=[*range(7),*range(13,91,7),*range(89,83,-1),*range(77,0,-7)]
    for a,b in zip(edge,edge[1:]+edge[:1]):
        faces.append((b,a,a+stride,b+stride))
    mesh=bpy.data.meshes.new('Cambered rotor blade')
    mesh.from_pydata(verts,[],faces)
    obj=bpy.data.objects.new('Pressed swept rotor blade',mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj,obj.name,blade,moving,smooth=True,bevel=.004)


face_rod('Rotor mounting flange',0,0,-.197,-.182,.191,dark,64,moving)
face_rod('Cast spinner',0,0,-.307,-.206,.167,paint,64,moving)
face_rod('Counterbored hub fastener',0,0,-.327,-.307,.062,steel,12,moving)
for i in range(6):
    a=2*pi*i/6
    impeller(a)
    face_rod('Blade root bolt',.131*cos(a),.131*sin(a),-.317,-.300,.018,steel,6,moving)


def batch(parts, label):
    # Merge by finish within each assembly, not across the rotor pivot.
    groups = {}
    for obj in parts:
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for name, same in sorted(groups.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in same: obj.select_set(True)
        bpy.context.view_layer.objects.active=same[0]
        bpy.ops.object.join()
        bpy.context.object.name=f'{label} | {name}'
        bpy.context.view_layer.update()


# Keep normals pointing out on both rotational and stationary surfaces.
for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
rotor['motion'] = 'Positive rotation around the glTF Z axis; phase-dependent drive in game.'
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'boiler-arrival-extractor.blend'),compress=True)
batch(static,'Wall extractor and fixed safety guard')
batch(moving,'Driven impeller')
bpy.ops.export_scene.gltf(filepath=str(ENV/'boiler-arrival-extractor.glb'),export_format='GLB',export_animations=False)
