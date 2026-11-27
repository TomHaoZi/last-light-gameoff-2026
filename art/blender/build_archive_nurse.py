"""Build the archive nurse on LAST LIGHT's existing licensed human rig.

Run: blender -b --python-exit-code 1 -P art/blender/build_archive_nurse.py
No files from Silent Hill or third-party fan models are used.
"""
from collections import defaultdict
import math
from pathlib import Path
import tempfile

import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
import bmesh

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/mourning-clerk-human.blend'))
rig = bpy.data.objects['Mourning Clerk']
body = bpy.data.objects['Continuous face and body']
dress = bpy.data.objects['Tailored archive gown']
head = {'head': 1.0}


def packed_rgb(name, rgb):
    h,w,_ = rgb.shape
    image = bpy.data.images.new(name, w, h, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(np.dstack((np.clip(rgb,0,1),np.ones((h,w)))).astype('float32').ravel())
    with tempfile.TemporaryDirectory() as d:
        image.filepath_raw = str(Path(d)/'color.jpg')
        image.file_format = 'JPEG'
        image.save()
        packed = bpy.data.images.load(image.filepath_raw)
        packed.name = name+' | baked'
        packed.pack()
    bpy.data.images.remove(image)
    return packed


def finish(name, color, roughness, image=None, metal=0, normal=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color,1)
    mat.use_nodes = True
    node = mat.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = (*color,1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metal
    if image:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        mat.node_tree.links.new(tex.outputs['Color'],node.inputs['Base Color'])
    if normal:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = normal
        normal.colorspace_settings.name = 'Non-Color'
        bump = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        bump.inputs['Strength'].default_value = .74
        mat.node_tree.links.new(tex.outputs['Color'],bump.inputs['Color'])
        mat.node_tree.links.new(bump.outputs['Normal'],node.inputs['Normal'])
    return mat


def linen_map():
    y,x = np.mgrid[0:1024,0:1024] / 1024
    weave = .018*np.cos(x*1804)*np.cos(y*1460)+.025*np.sin(382*x+17*y)*np.cos(y*130)
    lee = .53+.20*np.sin(x*37+y*42)*np.sin(y*27-x*39)+.16*np.sin(x*97+y*124)*np.cos(y*91)
    staining = np.clip(lee+.30*(1-y)**2-.55,0,.5)
    water = np.exp(-((x-.334-.061*np.sin(y*4.2))/.061)**2)*np.clip((.53-y)*2.2,0,.65)
    crease = .016*np.cos(y*155 + np.cos(x*37))
    return np.array([.66,.646,.574])+weave[:,:,None]+crease[:,:,None]-staining[:,:,None]*[.23,.28,.30]-water[:,:,None]*[.11,.19,.183]


def wrap_map():
    y,x = np.mgrid[0:512,0:1024]
    x,y = x/1024, y/512
    flow = .56+.21*np.cos(x*28+y*33)*np.sin(y*27-x*43)+.13*np.cos(x*134+y*81)*np.sin(y*18-x*93)
    grit = .017*np.sin(y*684+x*37)+.012*np.sin(x*1400)*np.cos(y*755)
    patch = np.exp(-((x-.225-.031*np.sin(y*5))/.14)**2 - ((y-.45)/.37)**2)
    base = np.array([.63,.611,.562])+grit[:,:,None]-(.30*flow+.43*patch)[:,:,None]*[.33,.39,.43]
    raw = np.exp(-((x-.218+.11*(y-.5))/.055)**2 - ((y-.41)/.21)**2) * (.55+.45*np.sin(y*115+x*73)**2)
    return base*(1-raw[:,:,None]*.42) + raw[:,:,None]*[.103,.031,.026]


def textile_normal(name, coarse=False):
    y,x = np.mgrid[0:512,0:1024]
    x,y = x/1024, y/512
    thread = (.013 if coarse else .009)*np.cos(x*1256+y*48)*np.sin(y*585+np.cos(x*49))
    wrinkles = (.026 if coarse else .015)*np.sin(y*92+x*21+1.4*np.cos(x*29))
    breakage = .006*np.cos(x*338-y*294)*np.sin(y*72+x*91)
    dy,dx=np.gradient(thread+wrinkles+breakage)
    normals=np.dstack((-dx*21,-dy*19,np.ones_like(dx)))
    normals/=np.linalg.norm(normals,axis=-1)[:,:,None]
    return packed_rgb(name,.5+.5*normals)


fabric = finish('Laundered ivory twill', (.63,.60,.50), .79, packed_rgb('Ivory twill',linen_map()),
                normal=textile_normal('Twill grain normal'))
edge = finish('Frayed ivory binding', (.49,.455,.362), .88)
wrap = finish('Aged layered face wraps', (.57,.48,.39), .82, packed_rgb('Bandage linen',wrap_map()),
              normal=textile_normal('Warp threads and wrinkles',True))
fold = finish('Shadowed wrap seams', (.185,.145,.119), .91)
underwrap = finish('Continuous inner linen wrap', (.295,.251,.211), .91)
oxid = finish('Tarnished pewter hardware', (.24,.225,.191), .46, metal=.58)
placket = finish('Double-stitched folded placket', (.48,.44,.355), .81)
maroon = finish('Faded ward embroidery', (.205,.063,.055), .86)
nail_finish = finish('Worn nail plates', (.31,.269,.239), .51)
shoe_mat = bpy.data.objects['Archive shoes'].data.materials[0]
shoe_mat.name = 'Worn ward shoes'


def weighted_mesh(name, points, faces, appearance, weights, uv=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(points,[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.parent = rig
    obj.data.materials.append(appearance)
    mod = obj.modifiers.new('Shared archive encounter skeleton','ARMATURE')
    mod.object = rig
    named = {}
    for i, influences in enumerate(weights):
        weights4 = sorted(influences.items(),key=lambda pair: -pair[1])[:4]
        total = sum(w for _,w in weights4)
        for bone,weight in weights4:
            if not weight:
                continue
            if bone not in named:
                named[bone] = obj.vertex_groups.new(name=bone)
            named[bone].add([i],weight/total,'REPLACE')
    for p in data.polygons:
        p.use_smooth = smooth
    if uv is not None:
        layer = data.uv_layers.new(name='Fabric chart')
        for p in data.polygons:
            for loop,index in zip(p.loop_indices,p.vertices):
                layer.data[loop].uv = uv[index]
    return obj


def closest_fit(obj):
    search = KDTree(len(obj.data.vertices))
    for v in obj.data.vertices:
        search.insert(v.co,v.index)
    search.balance()
    def fit(point):
        _, index, _ = search.find(point)
        return {obj.vertex_groups[g.group].name:g.weight for g in obj.data.vertices[index].groups if g.weight>0}
    return fit


def tube(name, centers, radius, appearance, fit, sides=8):
    centers = [Vector(c) for c in centers]
    points=[]
    for i,c in enumerate(centers):
        axis = (centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
        across=axis.cross(Vector((0,1,0))).normalized()
        if not across.length:
            across=axis.cross(Vector((1,0,0))).normalized()
        other=axis.cross(across)
        for k in range(sides):
            a=k*math.tau/sides
            points.append(c+radius*(math.cos(a)*across+math.sin(a)*other))
    faces=[tuple(reversed(range(sides)))]
    for r in range(len(centers)-1):
        for s in range(sides):
            t=(s+1)%sides
            faces.append((r*sides+s,r*sides+t,(r+1)*sides+t,(r+1)*sides+s))
    faces.append(tuple(range(len(points)-sides,len(points))))
    weighted_mesh(name,points,faces,appearance,[fit(p) for p in points])


def relief(x, y, width, height):
    return math.exp(-((x / width)**2 + (y / height)**2))


def sculpt_hands():
    """Sculpt the original weighted skin, then fit nails to each dorsal fingertip."""
    mesh = body.data
    wrists = [rig.data.bones['wrist.'+side].head_local for side in ['R','L']]
    joints = [
        [[rig.data.bones[f'finger{finger}-{link}.{side}'].head_local
          for link in [1,2,3]] for finger in [1,2,3,4,5]]
        for side in ['R','L']
    ]
    dorsal = [
        (fingers[2][0]-wrist).cross(fingers[4][0]-fingers[1][0]).normalized() * side
        for fingers,wrist,side in zip(joints,wrists,[-1,1])
    ]
    palm_axes = []
    for wrist,fingers,top in zip(wrists,joints,dorsal):
        forward = (fingers[2][0]-wrist).normalized()
        across = forward.cross(top).normalized()
        if (fingers[0][0]-wrist).dot(across)<0:
            across.negate()
        palm_axes.append((forward,across))
    group_names = {group.index:group.name for group in body.vertex_groups}
    pigment = mesh.color_attributes.new(name='Subdermal hand pigment',type='BYTE_COLOR',domain='POINT')
    skin = mesh.materials[0].node_tree.nodes['Principled BSDF']
    skin.inputs['Roughness'].default_value = .68
    for vertex in mesh.vertices:
        pigment.data[vertex.index].color = (1,1,1,1)
        weights = [(group_names[group.group],group.weight) for group in vertex.groups]
        hand = sum(weight for name,weight in weights if name.startswith(('wrist','metacarpal','finger')))
        if hand < .08:
            continue
        slot = 0 if vertex.co.x < 0 else 1
        rest = vertex.co.copy()
        top = dorsal[slot]
        upper = max(0, vertex.normal.dot(top))
        palm = max(0, -vertex.normal.dot(top))
        knuckle = max(relief((rest-center).dot(((base-center).cross(top)).normalized()),
                            (rest-center).dot((base-center).normalized()), .010, width)
                      for chain in joints[slot] for base,center,width in
                      [(chain[1],chain[0],.010),(chain[2],chain[1],.006)])
        palm_t = min(1,max(0,(rest-wrists[slot]).length/.079))
        ridge = 0
        for chain in joints[slot][1:]:
            start = wrists[slot].lerp(chain[0],.26)
            end = chain[0]
            path = end-start
            t = (rest-start).dot(path)/path.length_squared
            if .03 < t < .98:
                side = path.cross(top).normalized()
                offset = abs((rest-start).dot(side))
                ridge = max(ridge, math.sin(math.pi*t)**1.5 * math.exp(-(offset/.0045)**2))
        axis,across = palm_axes[slot]
        from_wrist = rest-wrists[slot]
        u,v = from_wrist.dot(across),from_wrist.dot(axis)
        pad = relief(u-.013,v-.033,.016,.024)+.55*relief(u+.013,v-.047,.016,.033)
        crease = max(relief(u-.002,v-.072-u*.39,.027,.006),
                     relief(u-.008,v-.040+u*.68,.015,.005))
        vertex.co += top*hand*(upper*(.0026*knuckle+.0017*ridge)-palm*(.0019*pad-.0013*crease))
        bruising = hand*((.07+.13*knuckle)*(.38+.62*upper)+palm*(.11*crease+.06*pad))
        vessel = hand*.10*ridge*upper*(1-palm_t*.40)
        pigment.data[vertex.index].color = (
            1-.83*bruising-.94*vessel, 1-1.24*bruising-.56*vessel, 1-.93*bruising-.34*vessel, 1
        )

    mesh.update()
    skin_tree = BVHTree.FromPolygons([vertex.co for vertex in mesh.vertices],
                                    [tuple(face.vertices) for face in mesh.polygons])
    fit = closest_fit(body)
    rim_coords = [(-.75,-.75),(-1,-.27),(-.96,.52),(-.76,.83),(-.39,.94),
                  (0,1),(.41,.94),(.78,.79),(1,.46),(.99,-.25),(.77,-.72),(0,-.96)]
    samples = [(0,0)] + [(x*ring,z*ring) for ring in [.34,.67,1] for x,z in rim_coords]
    count = len(rim_coords)
    edges = [(i,(i+1)%count) for i in range(count)]
    fan = [(0,1+i,1+j) for i,j in edges]
    quads = [(start+i,end+i,end+j,start+j)
             for start,end in [(1,1+count),(1+count,1+count*2)] for i,j in edges]
    for slot,side in enumerate(['R','L']):
        for number,chain in enumerate(joints[slot],1):
            joint = chain[2]
            forward = (joint-chain[1]).normalized()
            width = [.0061,.0054,.0057,.0053,.0044][number-1]
            length = [.0076,.0074,.0082,.0077,.0067][number-1]
            row_offset = .006 if number == 1 else .010
            # A narrow curved cuticle and broader free edge follow the skin;
            # the thumbnail's plane is rotated relative to the other nails.
            angles = [.58,-.58,1.02,-1.02,0] if number==1 else [0,.18,-.18]
            fits = [(roll,scale) for scale in [1,.88,.78] for roll in angles]
            for roll,scale in fits:
                up = Quaternion(forward,roll) @ dorsal[slot]
                across = forward.cross(up).normalized()
                top = across.cross(forward).normalized()
                nail = []
                for x,z in samples:
                    probe = joint + forward*(row_offset+z*length*scale) + across*x*width*scale
                    point,normal,_,_ = skin_tree.ray_cast(probe+top*.028,-top,.043)
                    if point is None or normal.dot(top)<.25:
                        break
                    nail.append(point+normal*(.00086-.00034*max(abs(x),abs(z))))
                if len(nail) != len(samples):
                    continue
                faces = fan + quads
                if (nail[1]-nail[0]).cross(nail[2]-nail[0]).dot(top)<0:
                    faces = [tuple(reversed(face)) for face in faces]
                weighted_mesh(f'Fitted nail plate | {number}.{side}',nail,faces,nail_finish,[fit(point) for point in nail])
                break


def preview_hand_pigment():
    """Show the same base-texture times vertex-color finish in editable Blender."""
    nodes = body.data.materials[0].node_tree
    base = nodes.nodes['Principled BSDF'].inputs['Base Color']
    source = base.links[0].from_socket
    pigment = nodes.nodes.new('ShaderNodeVertexColor')
    pigment.layer_name = 'Subdermal hand pigment'
    multiply = nodes.nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    nodes.links.new(source,multiply.inputs[1])
    nodes.links.new(pigment.outputs['Color'],multiply.inputs[2])
    nodes.links.new(multiply.outputs['Color'],base)
    return nodes.links,source,base


# Retain the weighted human garment shell; fit new fabric and shoulder/sleeve
# surface to the exact skinned body so the sleeves work in the reach animation.
for name in ['Eyebrows','Eyelashes','Eyes','Loose hair','Collar piping','WingAnchor']:
    bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
for v in dress.data.vertices:
    x,y,z = v.co
    hem = max(0, (1.076-z)/.44)
    v.co.z -= .069*hem
    v.co.x = x*(1-.108*hem) + .007*hem*math.sin(y*21+z*7)
    v.co.y = y*(1-.045*hem) + .005*hem*math.cos(x*28+z*10)
dress.name='Ward uniform | shaped skirt and bodice'
dress.data.materials[0]=fabric
bpy.data.objects.remove(bpy.data.objects['Blind-stitch hem'],do_unlink=True)
body.data.materials.append(fabric)
body.data.materials.append(edge)
# Keep rigged chin, exposed forearms and hands. The old eye/forehead geometry
# must not intersect a wrap edge when the head tilts or the jaw opens.
working = bmesh.new()
working.from_mesh(body.data)
bmesh.ops.delete(working, geom=[face for face in working.faces if min(v.co.z for v in face.verts)>1.612], context='FACES')
# Add rounding at close-up finger silhouettes without subdividing the body.
# BMesh interpolates the original UV loops and deform weights on the edges.
deform_weights = working.verts.layers.deform.active
grip_groups = {group.index for group in body.vertex_groups
               if group.name.startswith('finger') and group.name.rsplit('.',1)[0].endswith('-3')}
grip_verts = {vert for vert in working.verts
              if sum(weight for group,weight in vert[deform_weights].items() if group in grip_groups)>.60}
hand_edges = [edge for edge in working.edges if all(vert in grip_verts for vert in edge.verts)]
bmesh.ops.subdivide_edges(working,edges=hand_edges,cuts=1,use_grid_fill=True,smooth=.27)
working.normal_update()
working.to_mesh(body.data)
working.free()
sculpt_hands()
for p in body.data.polygons:
    x,y,z = p.center
    x=abs(x)
    cuff = .281 + (z-1.34)*.19
    if 1.320<z<1.498 and x<cuff and (x>.102 or z<1.392+x*.97 or y>.008):
        p.material_index = 1

# Gown fronts follow the cloth surface near the center line. Use real piping
# and hardware, blended from the closest points on the existing skinned cloth.
fit_dress=closest_fit(dress)

def front(x,z):
    near=[v.co.y for v in dress.data.vertices if abs(v.co.x-x)<.023 and abs(v.co.z-z)<.021 and v.co.y<0]
    return min(near,default=-.10)

p=[]
for i in range(28):
    z=1.405-i*.0205
    for x in [-.022,.018]:
        p.append((x,front(x,z)-.0035,z))
weighted_mesh('Front fabric overlap',p,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(27)],placket,[fit_dress(c) for c in p])
for x in [-.020,.018]:
    tube('Raised placket stitch',[(x,front(x,1.405-i*.018)-.005,1.405-i*.018) for i in range(30)],.0018,edge,fit_dress,6)
for i in range(6):
    z=1.372-i*.084
    y=front(.001,z)-.004
    tube('Pewter dress snap',[(.001,y,z),(.001,y-.005,z),(.001,y-.008,z)],.0083,oxid,fit_dress,12)

# Wrap the head in a deformable sculpt, not a single flat mask. The cranium,
# compressed nose, temple bulge and bandage edges are modeled independently.
def silhouette(z):
    keys=[(1.592,.054,.093,.006),(1.614,.065,.125,.025),(1.645,.089,.134,.042),
          (1.683,.106,.145,.059),(1.723,.113,.146,.070),(1.757,.109,.129,.064),
          (1.784,.092,.104,.051),(1.811,.068,.077,.027),(1.838,.025,.038,-.007),(1.842,.007,.014,-.021)]
    i=min(len(keys)-2,max(0,next((i for i in range(len(keys)-1) if z<keys[i+1][0]),len(keys)-2)))
    a,b=keys[i],keys[i+1]
    t=min(1,max(0,(z-a[0])/(b[0]-a[0])))
    return [a[j]+t*(b[j]-a[j]) for j in (1,2,3)]


def headpoint(a,z, lift=0):
    width,fore,aft=silhouette(z)
    s,c=math.sin(a),math.cos(a)
    swell=1+.046*math.sin(a*3+z*42)+.018*math.cos(a*9-z*92)
    front = max(0,s)
    x = c*(width+lift)*swell
    # The gauze is pulled over bony landmarks but settles into the sockets.
    # Keep the face readable in silhouette under the player's off-axis lamp.
    nose = .029*relief(x+.004,z-1.686,.017,.039) + .017*relief(x+.004,z-1.666,.021,.013)
    chin = .009*relief(x-.007,z-1.612,.036,.014)
    cheek = (.026 if x<0 else .018)*relief(abs(x)-.051,z-1.680,.036,.022)
    brow = .020*relief(abs(x)-.044,z-1.748+.09*abs(x),.039,.014)
    socket = (.026 if x<0 else .022)*relief(abs(x)-.039,z-1.724,.027,.016)
    fold = .011*relief(x+.043+(z-1.671)*.66,z-1.671,.012,.034)
    pressure = nose+chin+cheek+brow-socket-fold
    y = -.060-(fore+lift)*front+(aft+.061+lift)*max(0,-s)-pressure*front**3
    return (x+.006*math.sin(z*21),y,z)


def wrap_strip(name, center, half, slope, index):
    n=72; rows=6; points=[]; uv=[]; faces=[]
    for row in range(rows):
        v=row/(rows-1)
        for k in range(n+1):
            u=k/n
            a=u*math.tau
            sag = .007*math.exp(-((a-1.87)/.32)**2)*math.sin(index*1.47+.2)
            zig=.0035*math.sin(a*3+index*.6)+.0014*math.cos(a*11+row*.3)+sag
            z=center+half*(2*v-1)+math.cos(a+index*.27)*slope+zig
            lift=.003+index*.0008+.0018*math.sin(v*math.pi) + .0006*math.sin(a*34)*abs(2*v-1)**6
            points.append(headpoint(a,z,lift))
            uv.append((u+.10*index,(index+v)/7))
            if row and k:
                i=len(points)-1
                faces.append((i-n-2,i-1,i,i-n-1))
    weighted_mesh(name,points,faces,wrap,[head]*len(points),uv)
    seam=points[:n+1]
    tube('Bandage turned selvage',seam,.0013,edge if index%2 else fold,lambda _:head,6)


# A continuous inner wrapping gives the folds real occlusion and prevents
# visible see-through slivers when a winding lifts toward the camera.
points=[]; faces=[]
n=80; rows=39
for row in range(rows):
    z=1.594+.248*row/(rows-1)
    for k in range(n):
        points.append(headpoint(k*math.tau/n,z,.0007))
        if row:
            now=row*n+k
            nxt=row*n+(k+1)%n
            faces.append((now-n,now,nxt,nxt-n))
faces.append(tuple(range((rows-1)*n, rows*n)))
weighted_mesh('Continuous under-wrap head sculpt',points,faces,underwrap,[head]*len(points))
for i in range(7):
    wrap_strip('Overlap %02d | coiled head cloth'%i,1.612+i*.033,.023,.007 if i%2 else -.008,i)

# Sculpted folded ward cap. Raised fabric seam and insignia stay with the skull.
pts=[]; uv=[]; faces=[]
for row in range(6):
    v=row/5
    for k in range(29):
        u=k/28
        t=2*u-1
        x=.098*t*(1-.11*v)+.011
        z=1.784+.071*v+.018*(1-t*t)+.006*t
        y=-.074-.055*(1-t*t)-.016*v+.043*t*t
        pts.append((x,y,z)); uv.append((u,v))
        if row and k:
            i=len(pts)-1
            faces.append((i-30,i-29,i,i-1))
weighted_mesh('Crown | folded ward cap',pts,faces,fabric,[head]*len(pts),uv)
tube('Cap turned top edge',pts[-29:],.0032,edge,lambda _:head,8)
tube('Cap bent bottom seam',pts[:29],.0029,edge,lambda _:head,7)
for s in [-1,1]:
    tube('Faded ward chevron',[(.011,-.145,1.820),(.011+s*.015,-.144,1.839)],.0028,maroon,lambda _:head,8)

# Add a small return collar and welded nameplate without changing the encounter hit points.
fit_body=closest_fit(body)
for s in [-1,1]:
    pts=[(.019*s,-.118,1.402),(.038*s,-.111,1.462),(.085*s,-.093,1.494),(.124*s,-.105,1.458),(.079*s,-.133,1.412)]
    weighted_mesh('Folded uniform collar',pts,[(0,1,4),(1,2,4),(2,3,4)],edge,[fit_body(p) for p in pts])
    tube('Collar stitch',pts+[pts[0]],.0015,placket,fit_body,6)

for obj in bpy.context.scene.objects:
    if obj.type=='MESH':
        obj.data.update()
rig.show_in_front=False
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version=0
skin_links, color_map, skin_base = preview_hand_pigment()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/archive-nurse.blend'),compress=True)
# The standard glTF Base Color multiplies the image and the exported COLOR_0.
skin_links.new(color_map,skin_base)
# Join repeated same-finish details only in the runtime export. Each detail
# remains separate in the editable Blender file above.
groups = defaultdict(list)
for obj in rig.children:
    if obj.type == 'MESH' and len(obj.data.materials)==1:
        groups[obj.data.materials[0]].append(obj)
for mat, objects in groups.items():
    if len(objects)<2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.data.uv_layers.active:
            obj.data.uv_layers.active.name = 'UVMap'
        obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    bpy.context.object.name = 'Nurse | '+mat.name
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for obj in rig.children:
    if obj.type=='MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/3d/assets/creature/archive-nurse.glb'),export_format='GLB',
                         use_selection=True,export_yup=True,export_animations=False,
                         export_vertex_color='ACTIVE',export_cameras=False,export_lights=False)
