"""Editable roof garden props and runtime GLBs. Build with Blender 4.5+."""
import math
import random
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ENV = ROOT / 'dist/3d/assets/env'
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(22031)


def finish(name, rgb, rough, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1)
    surface = mat.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Base Color'].default_value = (*rgb, 1)
    surface.inputs['Roughness'].default_value = rough
    surface.inputs['Metallic'].default_value = metal
    return mat


zinc = finish('Weathered galvanized skin', (.20,.25,.23), .49, .64)
enamel = finish('Dark green fired enamel', (.055,.116,.098), .48, .31)
iron = finish('Blackened cast supports', (.054,.065,.064), .62, .56)
bronze = finish('Oxidised bronze', (.26,.128,.052), .44, .64)
copper = finish('Aged copper pipe', (.255,.106,.062), .51, .68)
red = finish('Faded valve enamel', (.295,.055,.041), .42, .33)
rubber = finish('Drip line rubber', (.030,.039,.033), .84)
soil = [finish('Potting mix ' + str(i), c, .97) for i,c in enumerate([
    (.049,.032,.023), (.067,.046,.030), (.072,.054,.040), (.093,.061,.041)
])]
greens = [finish(label, color, rough) for label,color,rough in [
    ('Basil shadow', (.028,.095,.039), .57), ('Basil outer leaves', (.056,.170,.044), .53),
    ('Young basil', (.105,.231,.071), .52), ('Green petiole', (.085,.184,.057), .56),
    ('Sage felt', (.124,.197,.146), .79), ('Sage young leaf', (.159,.233,.173), .71),
    ('Dry leaf shoulders', (.157,.136,.050), .78)
]]


def assembly(label):
    group = bpy.data.collections.new(label)
    bpy.context.scene.collection.children.link(group)
    return group


def retain(obj, name, material):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    active.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def surface(name, points, faces, material, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    active.objects.link(obj)
    obj.data.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def edge(obj, width):
    mod = obj.modifiers.new('Radiused hard edges', 'BEVEL')
    mod.width, mod.segments = width, 3
    normals = obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True


def block(name, position, dims, material, rounding=.005):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = retain(bpy.context.object, name, material)
    obj.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rounding:
        edge(obj, rounding)
    return obj


def cylinder(name, center, radius, length, material, sides=24, along=(0,0,1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=length, location=center)
    obj = retain(bpy.context.object, name, material)
    obj.rotation_euler = Vector(along).to_track_quat('Z','Y').to_euler()
    edge(obj, min(.003, length*.22, radius*.19))
    return obj


def pipe(name, coords, radius, material, res=3, caps=True):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 8
    data.bevel_depth, data.bevel_resolution, data.use_fill_caps = radius, res, caps
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(coords)-1)
    for point, co in zip(spline.bezier_points, coords):
        point.co = co
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    active.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def profile_loop(width, depth, radius, height):
    result = []
    for i in range(4):
        angle = math.pi * (.25 + i*.5)
        x = math.copysign(width/2-radius, math.cos(angle))
        y = math.copysign(depth/2-radius, math.sin(angle))
        for j in range(7):
            theta = (i + j/6) * math.pi/2
            result.append((x+radius*math.cos(theta),y+radius*math.sin(theta),height))
    return result


def trough():
    # Cross-section turns over the lip and returns down the inner wall; it is
    # not a box with a painted opening. Soil sits below the rim.
    profiles = [(.264,1.37,.450,.065),(.283,1.43,.48,.071),(.407,1.58,.570,.081),
                (.425,1.64,.619,.090),(.445,1.64,.619,.088),(.450,1.61,.590,.084),
                (.443,1.56,.539,.072),(.418,1.54,.522,.071),(.294,1.38,.424,.058)]
    rings = [profile_loop(w,d,r,z) for z,w,d,r in profiles]
    n = len(rings[0]); faces = [tuple(reversed(range(n)))]
    for row in range(len(rings)-1):
        for i in range(n):
            j = (i+1)%n
            faces.append((n*row+i,n*row+j,n*(row+1)+j,n*(row+1)+i))
    faces.append(tuple(range(n*(len(rings)-1), n*len(rings))))
    obj = surface('Spun galvanized trough and rolled return', sum(rings,[]), faces, enamel, True)
    obj.data.materials.append(zinc)
    for i, face in enumerate(obj.data.polygons):
        if n*4 < i <= n*6:
            face.material_index = 1
    return obj


def dirt(xspan=.746, yspan=.247, base=.417):
    w,d = 40,15
    pts, faces = [], []
    for j in range(d):
        v = 2*j/(d-1)-1
        for i in range(w):
            u = 2*i/(w-1)-1
            pts.append((u*xspan*(1-.022*abs(v)**6),v*yspan,
                        base + math.sin(u*13+v*5)*.003 + rng.uniform(-.003,.004)))
            if i and j:
                n = len(pts)-1
                faces.extend(((n-w-1,n-w,n),(n-w-1,n,n-1)))
    surface('Uneven soil surface', pts, faces, soil[1], True)
    # Gravel, clay fragments and potting granules keep their relief in close-ups.
    for i in range(205 if xspan > .5 else 82):
        x,y = rng.uniform(-xspan*.97,xspan*.97), rng.uniform(-yspan*.94,yspan*.94)
        r = rng.uniform(.003,.011)
        z = base + math.sin((x/xspan)*13+(y/yspan)*5)*.003 + .001
        points = [(x + r*math.cos(j*math.tau/5),y + r*math.sin(j*math.tau/5),z + rng.uniform(-.003,.001)) for j in range(5)]
        points.append((x+r*.15,y-r*.12,z+r*rng.uniform(.4,.8)))
        surface('Potting grit', points, [(j,(j+1)%5,5) for j in range(5)], rng.choice(soil))


def blade(name, origin, angle, length, width, slope, mat, vein):
    # A swept, cupped lamina, with changing camber and tapered irregular edge.
    along, across = Vector((math.cos(angle),math.sin(angle),0)), Vector((-math.sin(angle),math.cos(angle),0))
    points, faces, ridge = [], [], []
    for j in range(13):
        t=j/12
        taper=max(.014, math.sin(math.pi*t)**.78)
        center=Vector(origin)+along*length*t+Vector((0,0,slope*t + length*(.54*t-.92*t*t)))
        ridge.append(center+Vector((0,0,.0014)))
        for k in range(5):
            v=(k-2)/2
            margin = 1 + (.056 if j%2 else -.045)*abs(v)**2
            curve = -.19*width*v*v*taper + .10*width*math.sin(12*t+angle)*v*taper
            p=center+across*width*taper*v*margin+Vector((0,0,curve))
            points.append(p)
            if j and k:
                i=len(points)-1
                faces.append((i-6,i-5,i,i-1))
    # Normals face upward; glTF is double-sided to keep the underside visible.
    surface(name, points, [tuple(reversed(f)) for f in faces], mat, True)
    pipe('Raised leaf midrib', ridge[::3], max(.0008,width*.033), vein, 0)


def basil(i,x,y):
    h=rng.uniform(.20,.355)
    lean=rng.uniform(-.075,.075)
    stem=lambda t: (x+lean*t*t,y+.031*t*t,.419+t*h)
    pipe('Basil rain-bent stem', [stem(t) for t in (0,.34,.71,1)], .0045, greens[3], 1)
    a=rng.uniform(0,math.tau)
    for ring in range(4):
        t=.26+.21*ring
        for side in range(2):
            angle=a+ring*1.64+side*math.pi+rng.uniform(-.19,.19)
            original=Vector(stem(t))
            petiole=original+Vector((math.cos(angle)*.034,math.sin(angle)*.034,.013))
            pipe('Basil petiole',[original,petiole],.0021,greens[3],0)
            L=rng.uniform(.077,.136)*(1.12-.13*ring)
            mat=greens[2 if ring==3 else 1 if (i+side)%3 else 0]
            blade('Opposite basil leaf',petiole,angle,L,L*rng.uniform(.265,.335),rng.uniform(.024,.075),mat,greens[3])


def sage(x,y):
    a=rng.uniform(0,math.tau)
    for i in range(7):
        angle=a+i*2.399
        L=rng.uniform(.071,.143)
        rise=rng.uniform(.097,.206)
        start=(x+math.cos(angle)*.027,y+math.sin(angle)*.027,.418+rise)
        pipe('Sage basal stem',[(x,y,.415), start],.0026,greens[3],1)
        blade('Cupped sage leaf',start,angle,L,L*.22,rise*.19,greens[4+i%2],greens[4])


def garden():
    trough()
    dirt()
    for x in (-.59,.59):
        for y in (-.248,.248):
            block('Flared foot bracket',(x,y,.130),(.082,.073,.226),iron,.010)
            block('Anchor foot',(x,y,.026),(.142,.118,.041),zinc,.007)
            cylinder('Foot anchor hex',(x,y,.055),.017,.020,bronze,6)
        block('Pressed crossmember',(x,0,.231),(.074,.591,.067),iron,.008)
    for x in (-.59,.59):
        cylinder('Cap nut on front flange',(x,-.282,.347),.015,.013,bronze,6,(0,1,0))
    pipe('Bowed drip line',[(x,-.115+.028*math.sin(x*8),.437) for x in (-.72,-.44,-.2,0,.2,.44,.72)],.009,rubber)
    for x in (-.64,-.36,0,.36,.64):
        cylinder('Barbed dripper',(x,-.122+.028*math.sin(x*8),.451),.012,.013,bronze,12)
    pipe('Drip supply and quick union',[(-.681,-.25,.431),(-.764,-.27,.435),(-.84,-.25,.386),(-.815,-.21,.231),(-.81,-.19,.124)],.015,copper)
    cylinder('Drain boss',(.608,.159,.263),.035,.034,bronze,12)
    pipe('Downward overflow',[(.608,.159,.246),(.610,.159,.194),(.66,.168,.132),(.720,.178,.114)], .018,zinc)
    for i,x in enumerate((-.64,-.46,-.27,-.08,.112,.303,.489,.62)):
        basil(i,x,rng.uniform(-.18,-.065))
    for x in (-.58,-.35,-.116,.11,.34,.56):
        sage(x,rng.uniform(.06,.18))
    for i in range(4):
        blade('Fallen dry skin',(rng.uniform(-.65,.58),rng.uniform(-.15,.12),.429),rng.uniform(0,math.tau),.081,.017,-.003,greens[6],greens[6])


def nursery_box():
    # A second silhouette for the scattered small pots, not a scaled-down copy
    # of the trough. Rails wrap around stave joints and the ground brackets.
    for x in (-.405,.405):
        block('Folded end plate',(x,0,.174),(.026,.413,.299),enamel,.011)
    for y in (-.199,.199):
        for ring in range(4):
            block('Pressed outer rib',(0,y,.076+ring*.064),(.802,.025,.06),enamel,.008)
        for x in (-.291,.291):
            block('Vertical steel strap',(x,y*1.048,.171),(.043,.016,.305),zinc,.005)
            cylinder('Strap rivet',(x,y*1.091,.254),.009,.014,bronze,8,(0,1,0))
        block('Safety rolled edge',(0,y,.318),(.83,.038,.031),zinc,.009)
    for x in (-.288,.288):
        block('Bottom skid',(x,0,.027),(.068,.398,.050),iron,.006)
    dirt(.364,.172,.302)
    for i,x in enumerate((-.265,-.089,.075,.268)):
        y = (.05 if i%2 else -.056)
        for j in range(4):
            a=(i+j*2.399)+rng.uniform(-.3,.3)
            r=rng.uniform(.053,.104)
            z= rng.uniform(.108,.245)
            tip = (x+math.cos(a)*r*.43,y+math.sin(a)*r*.43,.305+z)
            pipe('Nursery leaf stalk',[(x,y,.302),tip],.0027,greens[3],1)
            blade('Nursery foliage',tip,a,r,r*.27,.036,greens[(i+j)%3],greens[3])
    # The nursery is removable from two low steel saddles. Rubber pads
    # isolate the saddle from the membrane; no fastener pierces the roof.
    for child in active.objects:
        child.location.z += .106
    for x in (-.288,.288):
        block('Galvanized saddle crossbar',(x,0,.089),(.094,.421,.043),zinc,.008)
        for y in (-.155,.155):
            block('Neoprene isolation foot',(x,y,.012),(.112,.086,.024),rubber,.007)
            block('Pressed saddle support',(x,y,.051),(.084,.063,.061),iron,.007)
            cylinder('Saddle lock bolt',(x,y,.115),.011,.015,bronze,6)
        for y in (-.211,.211):
            block('Folded keeper tab',(x,y,.119),(.094,.017,.051),zinc,.005)
            cylinder('Keeper rivet',(x,y*1.047,.124),.008,.011,zinc,8,(0,1,0))


def header():
    block('Deep drawn irrigation backplate',(0,0,.60),(1.32,.147,1.05),enamel,.034)
    block('Gasketed inset service face',(0,-.077,.602),(1.219,.041,.907),iron,.018)
    for x in (-.535,.535):
        for z in (.215,.98):
            cylinder('Panel fastener',(x,-.102,z),.016,.017,zinc,6,(0,1,0))
    pipe('Rolled perimeter seam',[(-.598,-.078,.133),(-.62,-.086,.163),(-.62,-.086,1.043),
         (-.594,-.078,1.073),(.593,-.078,1.073),(.619,-.086,1.042),(.620,-.086,.163),(.596,-.078,.133)],.008,zinc,1)
    pipe('Cold feed with swept elbows',[(-.55,-.152,.085),(-.55,-.152,.31),(-.51,-.152,.39),
         (-.323,-.152,.56),(-.139,-.152,.588),(.324,-.152,.588),(.425,-.152,.546),(.45,-.152,.33),(.45,-.152,.088)],.034,copper)
    pipe('Lower return riser',[(-.61,-.145,.112),(-.48,-.145,.207),(.376,-.145,.207),(.51,-.145,.149),(.57,-.145,.077)],.035,zinc)
    for x in (-.201,.213):
        cylinder('Union packing nut',(x,-.152,.588),.053,.060,bronze,6,(1,0,0))
    cylinder('Gate valve housing',(0,-.151,.588),.079,.112,bronze,16,(1,0,0))
    cylinder('Gate stem packing',(0,-.225,.588),.042,.097,bronze,8,(0,1,0))
    pipe('Wheel rolled grip',[(.106*math.cos(j*math.tau/16),-.285,.588+.106*math.sin(j*math.tau/16)) for j in range(17)],.015,red)
    for j in range(3):
        a=j*math.tau/3
        pipe('Wheel cast spoke',[(0,-.286,.588),(.093*math.cos(a),-.285,.588+.093*math.sin(a))],.010,red,2)
    cylinder('Wheel spindle cap',(0,-.301,.588),.025,.030,zinc,6,(0,1,0))
    for x in (-.495,.392):
        block('Raised pipe clip',(x,-.082,.235),(.075,.084,.236),zinc,.009)
    block('Machine inventory plate',(-.325,-.108,.876),(.315,.016,.105),bronze,.008)
    for x in (-.45,-.20):
        cylinder('Plate rivet',(x,-.122,.876),.009,.009,zinc,12,(0,1,0))


def export(collection, file):
    # Evaluate tubes and bevels, and keep direct material slots for the two
    # multi-finish meshes. Batch single-finish pieces into one draw per finish.
    groups=defaultdict(list)
    for obj in collection.objects:
        key=tuple(m.name for m in obj.data.materials)
        groups[key].append(obj)
    merged=[]
    for materials, parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.convert(target='MESH')
        if len(parts)>1:
            bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=collection.name+' / '+materials[0]
        merged.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in merged:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ENV / file), export_format='GLB', use_selection=True,
                             export_animations=False, export_cameras=False, export_lights=False)


active=bed=assembly('Rain-fed entrance garden')
garden()
active=panel=assembly('Roof irrigation header')
header()
active=nursery=assembly('Portable nursery box')
nursery_box()
# Save assemblies apart in the editable file; export each at its local origin.
for group, offset in [(panel,2.2),(nursery,-1.7)]:
    for obj in group.objects:
        obj.location.x += offset
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            view=area.spaces.active.region_3d
            view.view_distance=3.9
            view.view_location=(.76,0,.58)
            area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/roof-garden.blend'), compress=True)
for group, offset in [(panel,2.2),(nursery,-1.7)]:
    for obj in group.objects:
        obj.location.x -= offset
export(bed,'roof-garden-bed.glb')
export(panel,'roof-irrigation-header.glb')
export(nursery,'roof-nursery-box.glb')
