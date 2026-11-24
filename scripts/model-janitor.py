"""Author the first-person janitor in Blender. Run: blender -b -P scripts/model-janitor.py.

The space is anatomical: +Y runs from wrist to fingertips, +Z is the dorsum.
All dimensions are metres. The final morphs use the same hinges for the skin,
nail beds and creases, so surface details stick when the hand closes.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import struct
import zlib
from math import sin, cos, pi, exp, sqrt, radians
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art" / "characters"
DIST = ROOT / "dist" / "3d" / "assets" / "janitor"
ART.mkdir(parents=True, exist_ok=True)
DIST.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
TAU = 2 * pi


def linear(x):
    value = x / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def rgb(code):
    return tuple(linear(int(code[i:i+2], 16)) for i in (0, 2, 4))


def mix(a, b, t):
    t = min(1, max(0, t))
    return tuple(x + (y-x)*t for x, y in zip(a, b))


def smooth(t):
    t = min(1, max(0, t))
    return t*t*(3-2*t)


def material(label, rough, metal=0, weave=False):
    mat = bpy.data.materials.new(label)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    pbr = nodes.get("Principled BSDF")
    pbr.inputs["Roughness"].default_value = rough
    pbr.inputs["Metallic"].default_value = metal
    col = nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Pigment"
    links.new(col.outputs["Color"], pbr.inputs["Base Color"])
    if weave:
        # Actual woven warp & weft relief, in a seamless tangent-space tile.
        n = 128
        yy, xx = np.mgrid[:n, :n]
        a, b = xx * TAU / 16, yy * TAU / 16
        warp = .72 * np.cos(a) + .22 * np.cos(2*a)
        weft = .72 * np.cos(b) + .22 * np.cos(2*b)
        twill = .5 + .47 * np.sin((a-b)/2)
        height = warp*twill + weft*(1-twill) + .08*np.sin(4*a+2*b)
        dx = (np.roll(height,1,1) - np.roll(height,-1,1)) * .44
        dy = (np.roll(height,1,0) - np.roll(height,-1,0)) * .44
        norm = np.sqrt(1 + dx**2 + dy**2)
        img = bpy.data.images.new("Mill twill | four-pick weave", width=n, height=n, alpha=False)
        img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(np.stack([.5+dx/norm/2, .5+dy/norm/2, .5+.5/norm, np.ones_like(norm)], -1).astype("float32").ravel())
        img.pack()
        tex, normal = nodes.new("ShaderNodeTexImage"), nodes.new("ShaderNodeNormalMap")
        tex.image = img
        normal.inputs["Strength"].default_value = .56
        links.new(tex.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], pbr.inputs["Normal"])
    return mat


skin = material("01 | weathered skin", .64)
nail = material("02 | keratin, scar and crease", .66)
canvas = material("03 | petrol-dyed cotton twill", .89, weave=True)
leather = material("04 | oiled calfskin, stitching and enamel", .72)
steel = material("05 | worn nickel and brass", .34, .76)


def geometry(name, verts, faces, mat=None, pigment=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    for face in data.polygons:
        face.use_smooth = True
    if mat:
        paint(ob, mat, pigment)
    return ob


def paint(ob, mat, pigment):
    data = ob.data
    data.materials.clear()
    data.materials.append(mat)
    attr = data.color_attributes.new(name="Pigment", type="BYTE_COLOR", domain="POINT")
    for v in data.vertices:
        c = pigment(v.co) if callable(pigment) else pigment
        attr.data[v.index].color = (*c,1.)
    data.color_attributes.active_color = attr
    if mat == canvas:
        uv = data.uv_layers.new(name="Twill")
        for poly in data.polygons:
            for i in poly.loop_indices:
                x, y, z = data.vertices[data.loops[i].vertex_index].co
                # Align the lengthwise weave with the player's arm; use a
                # dominant plane on the two sides to avoid stretched threads.
                ax = x if abs(poly.normal.z) > abs(poly.normal.x) else z
                uv.data[i].uv = (ax / .017, y / .017)


def tube(name, path, rings, count=20, mat=None, pigment=None, profile=None):
    points = list(map(Vector, path))
    verts, faces = [], []
    for j, (p,(wide,thick)) in enumerate(zip(points,rings)):
        d = (points[min(j+1,len(points)-1)]-points[max(j-1,0)]).normalized()
        right = d.cross(Vector((0,0,1)))
        if right.length < .0001:
            right = d.cross(Vector((0,1,0)))
        right.normalize()
        up = right.cross(d).normalized()
        for k in range(count):
            a = TAU * k / count
            r = profile(j,a) if profile else 1
            verts.append(tuple(p+(wide*cos(a)*right+thick*sin(a)*up)*r))
        if j:
            for k in range(count):
                q, h = k+count*j, (k+1)%count+count*j
                faces.append((q-count,h-count,h,q))
    faces += [tuple(reversed(range(count))), tuple(range(len(verts)-count,len(verts)))]
    return geometry(name, verts, faces, mat, pigment)


def oval(name, c, r, mat=None, pigment=None, seg=18, levels=11):
    pts, faces = [tuple(Vector(c)+Vector((0,0,r[2])))], []
    for j in range(1,levels):
        b = pi*j/levels
        for i in range(seg):
            a = TAU*i/seg
            pts.append((c[0]+r[0]*sin(b)*cos(a), c[1]+r[1]*sin(b)*sin(a), c[2]+r[2]*cos(b)))
    pts.append((c[0],c[1],c[2]-r[2]))
    for i in range(seg):
        faces.append((0, 1+i, 1+(i+1)%seg))
        end = len(pts)-1-seg
        faces.append((end+i, len(pts)-1, end+(i+1)%seg))
        for j in range(levels-2):
            a=1+i+j*seg
            b=1+(i+1)%seg+j*seg
            faces.append((a,a+seg,b+seg,b))
    return geometry(name, pts, faces, mat, pigment)


def attach(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = objects[0]
    ob.name = name
    return ob


def modifier(ob, kind, **props):
    mod = ob.modifiers.new(kind,kind)
    for k,v in props.items():
        setattr(mod,k,v)
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.modifier_apply(modifier=mod.name)


def dist_line(p,a,b):
    d=b-a
    t=max(0,min(1,(p-a).dot(d)/max(.00000001,d.length_squared)))
    return (p-(a+t*d)).length


# Skin volumes overlap into a single watertight sculpt. The wrist is narrow,
# metacarpals fan, and the little-finger side slopes below the index knuckle.
palm = [
    (-.080,.025,.016,-.001),(-.035,.029,.017,0),(-.004,.030,.016,0),
    (.017,.031,.016,.001),(.035,.040,.019,.002),(.059,.044,.019,.002),
    (.080,.043,.018,.003),(.095,.040,.015,.003),(.104,.034,.009,.002)
]
sculpt = [tube("Carpus, metacarpal fan",[(0,y,z) for y,w,d,z in palm],[(w,d) for y,w,d,z in palm],40)]
for c,r in [((-.024,.041,-.008),(.021,.034,.014)),((.026,.05,-.009),(.017,.035,.012)),
            ((.021,.003,.009),(.008,.011,.012)),((-.025,.013,-.002),(.008,.019,.012))]:
    sculpt.append(oval("Carpal or thenar pad",c,r))
# Each finger has its own convergence, proximal crest, pad and resting curl.
fingers = []
for name,x,y,len_,width,fan,curl in [
    ("Index",-.028,.091,.080,.0101,-.012,.020),
    ("Middle",-.008,.096,.087,.0105,-.001,.026),
    ("Ring",.0125,.093,.080,.0098,.008,.034),
    ("Little",.0305,.084,.067,.00825,.014,.038)]:
    line=[]; rings=[]
    for u,rx,rz in [(0,1.22,.97),(.10,1.03,.96),(.27,.94,.85),(.42,1.03,.9),
                     (.49,.94,.83),(.62,.78,.72),(.71,.84,.73),(.78,.76,.65),
                     (.88,.77,.69),(.96,.66,.59),(1,.24,.27)]:
        z=.005+.004*sin(pi*u)-curl*u*u
        line.append(Vector((x+fan*u,y+len_*u,z)))
        rings.append((width*rx,width*rz))
    fingers.append((name,line,width))
    sculpt.append(tube(name,line,rings))
    sculpt.append(oval(name+" knuckle",(x,y-.001,.009),(.011,.012,.011)))
thumb_path = [(-.021,.028,-.003),(-.033,.033,-.004),(-.044,.040,-.006),(-.053,.052,-.007),
              (-.059,.062,-.009),(-.062,.070,-.013),(-.067,.081,-.016),(-.070,.088,-.017),(-.071,.091,-.017)]
sculpt.append(tube("Opposable thumb",thumb_path,[(.020,.016),(.017,.015),(.014,.012),(.013,.012),
                (.012,.010),(.009,.009),(.010,.0085),(.008,.007),(.004,.004)],24))
# Dorsal tendons emerge from the cuff and fade into the MCP joints.
for i,(_,line,_) in enumerate(fingers):
    end=line[0]
    y0=.004+i*.001
    path=[(end.x*.35,y0,.014),(end.x*.48,.031,.0182),(end.x*.69,.058,.0192),(end.x*.86,.078,.0178),
          (end.x,end.y,.015)]
    sculpt.append(tube("Extensor tendon",path,[(.0022,.0021),(.0031,.00185),(.0033,.0021),(.003,.0019),(.0022,.002)],12))

hand = attach(sculpt,"Continuous hand sculpt")
# Voxel union removes the intersections between the palm, fingers and thumb.
hand.data.remesh_voxel_size = .00135
bpy.ops.object.voxel_remesh()
modifier(hand,"SMOOTH",factor=.57,iterations=4)
modifier(hand,"DECIMATE",ratio=.17)
for p in hand.data.polygons:
    p.use_smooth=True

veins = [([(-.024,.007,.011),(-.020,.025,.018),(-.015,.039,.020),(-.017,.052,.021),
           (-.013,.066,.019),(-.007,.078,.020)],.0032),
         ([(.014,.002,.013),(.012,.023,.017),(.016,.042,.020),(.009,.058,.021),
           (.004,.068,.02),(-.007,.078,.020)],.00225)]
veins=[(list(map(Vector,path)),rad) for path,rad in veins]
# Other primitives in the hand object use vertex colour; keep the textured
# skin white so the game does not multiply its painted albedo twice.
paint(hand,skin,(1.,1.,1.))
# Two hand-painted procedural charts keep tiny veins, dry creases, grease
# and old scars sharp independently of the runtime mesh density.
def hand_maps():
    w,h=512,640
    row,col=np.mgrid[0:h,0:w]
    x=-.082+(col%(w//2)+.50)/(w/2)*.14
    y=-.09+(h-row-.50)/h*.29
    top=(col < w//2).astype(float)
    variation=np.sin(x*116+y*77)*1.7+np.cos(y*183-x*51)*1.1
    base=np.stack([150+variation,100+variation*.73,82+variation*.55],axis=2)
    relief=np.zeros_like(x)
    def tint(color,mask):
        nonlocal base
        alpha=np.clip(mask,0,1)[:,:,None]
        base=base*(1-alpha)+np.array(color)*alpha
    def gaussian(cx,cy,rx,ry):
        return np.exp(-((x-cx)/rx)**2-((y-cy)/ry)**2)
    def line_mask(coords,width):
        result=np.zeros_like(x)
        for a,b in zip(coords,coords[1:]):
            dx,dy=b[0]-a[0],b[1]-a[1]
            t=np.clip(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1)
            d=(x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2
            shape=np.exp(-d/(width*width))
            result=np.maximum(result,shape)
        return result
    tint([181,120,102],.52*(1-top))
    tint([173,106,91],.57*gaussian(-.037,.049,.027,.031))
    for points,rad in veins:
        m=line_mask([(p.x,p.y) for p in points],rad*.68)*top
        tint([105,104,91],m*.32)
        relief+=m*.14
    for i,(_,finger,radius) in enumerate(fingers):
        for j in (0,3,6):
            q=finger[j]
            tint([147,77,64],top*gaussian(q.x,q.y,.011 if j==0 else .009,.011)*.58)
            for k in (-1,0,1):
                curl=[(q.x+radius*f,q.y+k*.0016+.0014*f*f+.00035*sin(i+j+f*3))
                      for f in (-.80,-.5,-.2,.13,.44,.75)]
                mask=line_mask(curl,.00036)*top*np.exp(-((x-q.x)/(radius*.57))**2)
                tint([90,59,56],mask*.65);relief-=mask*.24
        tip=finger[-2]
        tint([91,77,67],.44*gaussian(tip.x,tip.y,.008,.009))
    for path in [[(-.032,.038),(-.022,.039),(-.012,.047),(-.006,.066),(-.010,.080)],
                 [(-.024,.031),(-.002,.037),(.014,.056),(.026,.061)],
                 [(-.025,.064),(-.012,.068),(.011,.068),(.028,.073)]]:
        m=line_mask(path,.00078)*(1-top)
        tint([116,70,63],m*.8);relief-=m*.4
    # The repairs and wear tell the same story as the stained machine room.
    for path in [[(-.007,.045),(-.002,.049),(.004,.054),(.010,.057)],
                 [(-.022,.116),(-.020,.120),(-.020,.123)]]:
        m=line_mask(path,.00072)*top
        tint([173,121,107],m*.94);relief+=m*.37
        tint([115,72,64],line_mask([(a+.0007,b-.0009) for a,b in path],.00039)*top*.70)
    rng=np.random.default_rng(36017)
    for _ in range(135):
        cx,cy=rng.uniform(-.052,.040),rng.uniform(-.010,.151)
        rad=rng.uniform(.00022,.0011)
        tint([90,62,52],gaussian(cx,cy,rad,rad*rng.uniform(.7,1.4))*rng.uniform(.17,.63)*top)
    # Corneocyte network: cellular edges on the back, fine arched friction
    # ridges on the palm. Avoid noisy highlights by band-limiting the relief.
    xx=x/.0021; yy=y/.00155+np.sin(x*87)*.9
    ix=np.floor(xx).astype(int); iy=np.floor(yy).astype(int)
    d1=np.full(x.shape,999.); d2=d1.copy()
    for di in (-1,0,1):
        for dj in (-1,0,1):
            gx=ix+di; gy=iy+dj
            a=np.sin(gx*127.1+gy*311.7)*43758.5453
            b=np.sin(gx*269.5+gy*183.3)*43758.5453
            d=(gx+.15+.70*(a%1)-xx)**2+(gy+.15+.70*(b%1)-yy)**2
            d2=np.minimum(d2,np.maximum(d1,d));d1=np.minimum(d1,d)
    fine=np.exp(-np.maximum(0,np.sqrt(d2)-np.sqrt(d1))*9)
    relief-=fine*.13*top
    relief+=np.sin(y*4700+np.sin(x*94)*6)*.07*(1-top)
    tint([112,81,71],fine*.103*top)
    # Texture is top-to-bottom PNG; UV V follows +Y on the hand.
    du=(np.roll(relief,1,axis=1)-np.roll(relief,-1,axis=1))*.52
    dv=(np.roll(relief,-1,axis=0)-np.roll(relief,1,axis=0))*.52
    norm=np.sqrt(1+du*du+dv*dv)
    normal=np.stack([127.5+127.5*du/norm,127.5+127.5*dv/norm,127.5+127.5/norm],axis=2)
    def chunk(kind,data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data))
    def image(label,values,is_normal=False):
        pixels=np.clip(values,0,255).astype("uint8")
        filtered=b"".join(b"\0"+r.tobytes() for r in pixels)
        png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(filtered,9))+chunk(b"IEND",b"")
        with TemporaryDirectory() as tmp:
            file=Path(tmp)/(label+".png");file.write_bytes(png)
            img=bpy.data.images.load(str(file));img.pack()
            img.colorspace_settings.name="Non-Color" if is_normal else "sRGB"
        return img
    uv=hand.data.uv_layers.new(name="DorsalPalmar")
    for face in hand.data.polygons:
        back=face.normal.z >= 0
        for i in face.loop_indices:
            px,py,_=hand.data.vertices[hand.data.loops[i].vertex_index].co
            uv.data[i].uv=((px+.082)/.14*.5+(0 if back else .5),(py+.09)/.29)
    nodes,links=skin.node_tree.nodes,skin.node_tree.links
    pbr=nodes.get("Principled BSDF")
    tex=nodes.new("ShaderNodeTexImage");tex.image=image("Janitor hand pigment",base)
    links.new(tex.outputs["Color"],pbr.inputs["Base Color"])
    tex=nodes.new("ShaderNodeTexImage");tex.image=image("Janitor skin grain",normal,True)
    n=nodes.new("ShaderNodeNormalMap");n.inputs["Strength"].default_value=.64
    links.new(tex.outputs["Color"],n.inputs["Color"]);links.new(n.outputs["Normal"],pbr.inputs["Normal"])

hand_maps()
details = [hand]
for name,line,w in fingers+[("Thumb",list(map(Vector,thumb_path)),.011)]:
    # Follow the distal phalanx with a domed plate, free edge and a soft lunula.
    a,b=line[-4],line[-1]
    axis=(b-a).normalized()
    right=axis.cross(Vector((0,0,1))).normalized()
    up=right.cross(axis).normalized()
    start=line[-4]+up*w*.62
    length=(b-a).length*.79
    verts=[]; faces=[]
    for row in range(9):
        u=row/8
        for col in range(13):
            v=col/6-1
            half=w*(.62+.06*sin(pi*u))*(1-.16*abs(u*2-1)**4)
            edge=up*w*(.19*(1-v*v)+.055*sin(pi*u))
            rounded=.0013*v*v*(1-2*u)
            p=start+axis*(u*length+rounded)+right*(v*half)+edge
            hit,point,normal,_=hand.ray_cast(p+up*.018,-up,distance=.040)
            if hit:
                p=point+up*(.00019+.00037*(1-v*v)*sin(pi*u))
            verts.append(tuple(p))
            if row and col:
                k=len(verts)-1
                faces.append((k-14,k-13,k,k-1))
    def nail_color(p):
        delta=p-start
        u=delta.dot(axis)/length
        v=delta.dot(right)/w/.68
        base=mix(rgb("8d6355"),rgb("a57461"),.5+.36*cos(v*1.8))
        base=mix(base,rgb("b59479"),(1-smooth((u-.03+.22*v*v)/.18))*.85)
        base=mix(base,rgb("b9a38d"),smooth((u-.87)/.10)*.72)
        return mix(base,rgb("624a3f"),smooth((abs(v)-.65)/.4)*.42)
    details.append(geometry(name+" | cuticle and nail",verts,faces,nail,nail_color))
    if name=="Thumb": continue
    # Small crescents, with tapered ends, sit on each dorsal knuckle.
    for center,offset in [(3,.002),(3,-.0012),(6,.0005)]:
        pivot=line[center]
        d=(line[center+1]-line[center-1]).normalized()
        cross=d.cross(Vector((0,0,1))).normalized()
        up_kn=cross.cross(d).normalized()
        k=.91 if center==3 else .73
        spans=[-.68,-.42,0,.42,.68]
        coords=[pivot+cross*w*s+up_kn*w*k*sqrt(1-s*s)+d*(offset+.0016*s*s) for s in spans]
        for i,p in enumerate(coords):
            hit,point,_,_=hand.ray_cast(p+up_kn*.008,-up_kn,distance=.017)
            if hit: coords[i]=point+up_kn*.00011
        details.append(tube("Flexion crease",coords,[(.00011,.00011),(.00023,.00020),(.0003,.00024),(.00023,.00020),(.00011,.00011)],5,nail,rgb("9e6b5a")))
hand = attach(details,"Janitor | callused hand")
hand.shape_key_add(name="Rest")


def finger_pose(point, line, grip, spread):
    # Transform from distal to proximal so creases orbit each joint correctly.
    p=point.copy()
    for index, bend in [(6,.51),(3,.72),(0,.54)]:
        pivot=line[index]
        d=(line[min(index+1,len(line)-1)]-line[max(index-1,0)]).normalized()
        depth=(point-pivot).dot(d)
        influence=smooth((depth+.008)/.018)
        side=d.cross(Vector((0,0,1))).normalized()
        p=pivot+Quaternion(side,-bend*grip*influence)@(p-pivot)
    root=line[0]
    u=smooth(((point-root).dot((line[-1]-root).normalized())+.010)/.03)
    return root+Quaternion(Vector((0,0,1)),spread*u)@(p-root)


def morph(name,grip,splay):
    key=hand.shape_key_add(name=name)
    thumbline=list(map(Vector,thumb_path))
    for vertex in hand.data.vertices:
        p=vertex.co
        if p.y<.024: continue
        if p.x<-.039 and p.y<.106:
            q=finger_pose(p,thumbline,grip*.74,-splay*.14)
        elif p.y>.071:
            _, idx=min((min(dist_line(p,a,b) for a,b in zip(line,line[1:])),i)
                      for i,(_,line,_) in enumerate(fingers))
            q=finger_pose(p,fingers[idx][1],grip*(.90+idx*.07),splay*(1.5-idx)*.115)
        else: continue
        key.data[vertex.index].co=q

morph("Operate",1,0)
morph("Brace",-.34,1)

# The loose sleeve flares toward the elbow. Ring centres snake through the
# fabric; diagonally crossing, unequal folds catch raking light in the game.
def sleeve_ring(t, theta):
    y=-.045-.34*t
    cx=.005+.075*t*t
    cz=-.002-.070*t-.056*t*t
    radius=.039+.026*t+.006*sin(pi*t)
    fold=.0013*cos(theta*5+y*31)+.0016*cos(theta*7-y*43)
    for at,amp,slope in [(.034,.0058,.040),(.12,.0068,-.054),(.22,.0071,.034),
                         (.34,.006,-.065),(.52,.0038,.080),(.67,.006,-.045),(.85,.004,.056)]:
        dist=t-at-slope*cos(theta+.6)
        fold+=amp*(exp(-(dist/.029)**2)-.70*exp(-((dist-.039)/.037)**2))
    r=radius+fold
    return (cx+r*cos(theta),y,cz+(.78+.10*t)*r*sin(theta))

verts=[]; faces=[]
rows,cols=60,52
for j in range(rows+1):
    for k in range(cols):
        verts.append(sleeve_ring(j/rows,k*TAU/cols))
        if j:
            a=(j-1)*cols+k; b=(j-1)*cols+(k+1)%cols
            faces.append((a,b,b+cols,a+cols))
faces += [tuple(range(cols)),tuple(range(rows*cols,(rows+1)*cols))]
def fabric_color(p):
    x,y,z=p
    light=.28+.17*sin(y*180+x*96)+.11*cos(y*107-z*90)
    age=.19+.30*exp(-((y+.075)/.052)**2)*smooth((z+.009)/.035)
    dyed=mix(rgb("203b40"),rgb("466261"),light+age)
    return mix(dyed,rgb("61675c"),.16*(.5+.5*sin(y*67+z*44))*age)
sleeve=geometry("Janitor | twill coverall, articulated folds",verts,faces,canvas,fabric_color)
gear=[]; metal=[]
# The cuff is fitted, its edge doubled and bound in contrasting canvas.
for name,ys,radius,depth,tint in [
    ("Turned cuff",[-.052,-.050,-.046,-.021,-.018,-.016],[.041,.043,.043,.040,.040,.038],[.031,.033,.034,.032,.031,.030],"415d5b"),
    ("Cuff binding",[-.020,-.019,-.017,-.015],[.039,.0405,.040,.0385],[.031,.032,.032,.031],"777b68"),
    ("Wrist strap",[-.014,-.013,-.009,.001,.004,.005],[.031,.033,.0335,.0335,.033,.031],[.018,.020,.021,.021,.020,.018],"463a30")]:
    gear.append(tube(name,[(0,y,0) for y in ys],list(zip(radius,depth)),60,leather,rgb(tint)))

def stitch(path,r=.00048,tint="b3a287"):
    return tube("Lockstitch",path,[(r*.5,r*.5),(r,r),(r*.5,r*.5)],5,leather,rgb(tint))

# Two broken lines of pale thread continue down the generous flat-felled seam.
for t in np.arange(.008,.94,.022):
    for ang in (.63,.715):
        path=[]
        for dt in (0,.004,.009):
            x,y,z=sleeve_ring(t+dt,ang)
            path.append((x+.00045*cos(ang),y,z+.00045*sin(ang)))
        gear.append(stitch(path,.00049,"a6a18b"))
for y,rx,rz in [(-.024,.0416,.0329),(-.045,.0430,.0342)]:
    for i in range(50):
        angle=TAU*i/50
        pts=[(rx*cos(angle+da),y,rz*sin(angle+da)) for da in (0,.029,.058)]
        gear.append(stitch(pts,.00045,"9d9380"))

# An analog shift watch makes the 17:59–18:00 jump tangible. Its recessed
# enamel dial, overhanging lugs, raised minute pips and crown have real relief.
w_center=Vector((0,-.003,.0235))
def dial_ring(name, center, levels, mat, tint, segments=72):
    coords=[]; idx=[]
    for j,(rx,ry,z) in enumerate(levels):
        for i in range(segments):
            theta=TAU*i/segments
            coords.append(tuple(center+Vector((rx*cos(theta),ry*sin(theta),z))))
            if j:
                k=j*segments+i
                n=j*segments+(i+1)%segments
                idx.append((k-segments,n-segments,n,k))
    idx.extend([tuple(range(segments)),tuple(range(len(coords)-segments,len(coords)))])
    return geometry(name,coords,idx,mat,tint)

for x in (-.011,.011):
    for sy in (-1,1):
        metal.append(oval("Curved watch lug",(x,-.003+sy*.016,.0205),(.0029,.0049,.0034),steel,rgb("92948a"),12,8))
metal.append(dial_ring("Machined case and bezel",w_center,[(.014,.0157,-.005),(.0175,.0175,-.0030),
    (.0178,.0178,.0002),(.0171,.0171,.0019),(.0152,.0152,.0024),(.01465,.01465,.0013)],steel,rgb("a1a89f")))
gear.append(dial_ring("Matte instrument dial",w_center,[(.01442,.01442,.00125),(.01462,.01462,.00165)],leather,rgb("202e2c")))
metal.append(oval("Winding stem",( .0181,-.003,.0225),(.0023,.0022,.00165),steel,rgb("928d73"),16,8))

def enamel_polygon(name,coords,tint):
    return geometry(name,[tuple(w_center+Vector(p)) for p in coords],[tuple(range(len(coords)))],leather,rgb(tint))
# Markers and hands are inside the stepped bezel, oriented toward the wearer.
for i in range(60):
    a=TAU*i/60; major=i%5==0
    r0=.0107 if major else .01315
    r1=.01375
    width=.00070 if major else .00015
    n=Vector((sin(a),cos(a))); s=Vector((cos(a),-sin(a)))
    quad=[(*tuple(n*r+s*e),.00195) for r,e in ((r0,-width),(r1,-width),(r1,width),(r0,width))]
    gear.append(enamel_polygon("Luminous dial index",quad,"d3caa5" if major else "8c997e"))
# Fixed hands read from the cuff side. Animate the minute hand in Three.
def needle(label,angle,length,width,z,tint,animated=False):
    axis=Vector((sin(angle),cos(angle))); side=Vector((cos(angle),-sin(angle)))
    xy=[(-.0022,0),(0,width),(length*.74,width*.56),(length,0),(length*.72,-width*.56),(0,-width)]
    q=[(*tuple(axis*r+side*s),z) for r,s in xy]
    ob=enamel_polygon(label,q,tint)
    if animated:
        # Move the origin to its spindle so rotating in game pivots on the pin.
        for v in ob.data.vertices:
            v.co-=w_center
        ob.location=w_center
    return ob
gear.append(needle("Hours",TAU*(5+59/60)/12,.0084,.00075,.00222,"d7c499"))
minute=needle("Minute",TAU*59/60,.0115,.00053,.00243,"ece5be",True)
gear.append(needle("Seconds",TAU*24/60,.0126,.00022,.00251,"d26c43"))
metal.append(oval("Spindle",tuple(w_center+Vector((0,0,.0026))),(.0010,.0010,.00052),steel,rgb("c3ab72"),12,7))
# Small broken cream block motif on the dial, a restrained maker's mark.
for x,wid in [(-.0020,.00066),(0,.00134),(.0023,.00052)]:
    coords=[(x-wid,.0051,.00201),(x+wid,.0051,.00201),(x+wid,.0055,.00201),(x-wid,.0055,.00201)]
    gear.append(enamel_polygon("Service dial mark",coords,"aaa88e"))
gear=attach(gear,"Janitor | stitched cuff, strap and watch dial")
metal=attach(metal,"Janitor | nickel case")
hand["character"]="Last shift janitor; original first-person hand sculpt"
hand["pose_controls"]="Operate flexes the three finger joints; Brace spreads the hand."
minute.name="JanitorMinute"
# Keep the editable source out of the web build. GLB contains only visible geometry.
bpy.context.scene.unit_settings.system="METRIC"
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        view=area.spaces.active.region_3d
        view.view_distance=.40; view.view_location=(0,.02,0)
        area.spaces.active.shading.color_type="VERTEX"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ART/"janitor.blend"),compress=True)
bpy.ops.export_scene.gltf(filepath=str(DIST/"janitor.glb"),export_format="GLB",
    export_yup=True,export_materials="EXPORT",export_animations=False,export_morph=True,
    export_morph_normal=False,export_cameras=False,export_lights=False)
print("Janitor mesh objects:",[(o.name,len(o.data.vertices)) for o in bpy.context.scene.objects if o.type=="MESH"])
