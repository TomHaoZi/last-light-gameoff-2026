"""Bake three LAST LIGHT workstation instruments with Blender 4.5 LTS.

blender -b --python-exit-code 1 -P art/blender/build_workstation_models.py
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

DEST=Path(__file__).resolve().parents[2]/"dist/3d/assets/env"
STEEL="5c6865"
IRON="303a3a"
ZINC="b7b7a6"
BRASS="b29b6e"
PAPER="dbcfaa"
GASKET="38332c"
RED="bf684d"
PAINT="506d69"


def xyz(x,y,z):
    return Vector((x,-z,y))


def linear(hexcode):
    vals=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in vals]+[1]


class Instrument:
    def __init__(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.material=bpy.data.materials.new("Enamel, brass and letterpress")
        self.material.use_nodes=True
        nodes=self.material.node_tree.nodes
        shader=nodes.get("Principled BSDF")
        shader.inputs["Metallic"].default_value=.21
        shader.inputs["Roughness"].default_value=.61
        paint=nodes.new("ShaderNodeVertexColor")
        paint.layer_name="Pigment"
        self.material.node_tree.links.new(paint.outputs["Color"],shader.inputs["Base Color"])
        self.parts=[]
        self.compound=[]

    def finish(self,obj,swatch,bevel=0):
        bpy.context.view_layer.objects.active=obj
        obj.select_set(True)
        if bevel>0:
            mod=obj.modifiers.new("Cast radius","BEVEL")
            mod.width=bevel
            mod.segments=2
            mod.harden_normals=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
            normals=obj.modifiers.new("Stamped normals","WEIGHTED_NORMAL")
            bpy.ops.object.modifier_apply(modifier=normals.name)
        obj.data.materials.append(self.material)
        color=obj.data.color_attributes.new(name="Pigment",type="BYTE_COLOR",domain="POINT")
        color.data.foreach_set("color",linear(swatch)*len(obj.data.vertices))
        obj.data.color_attributes.active_color=color
        self.parts.append(obj)
        return obj

    def box(self,x,y,z,w,h,d,swatch,bevel=.002):
        bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(x,y,z))
        obj=bpy.context.object
        obj.dimensions=(w,d,h)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        return self.finish(obj,swatch,min(d,w,h,.02)*.15 if bevel==.002 else bevel)

    def rod(self,start,end,r,swatch,sides=14):
        a=xyz(*start); b=xyz(*end)
        bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=(b-a).length,location=(a+b)/2)
        obj=bpy.context.object
        obj.rotation_euler=(b-a).to_track_quat("Z","Y").to_euler()
        return self.finish(obj,swatch)

    def disc(self,x,y,z,r,thickness,swatch,sides=40):
        return self.rod((x,y,z-thickness/2),(x,y,z+thickness/2),r,swatch,sides)

    def label(self,word,x,y,z,size,swatch):
        bpy.ops.object.text_add(location=xyz(x,y,z),rotation=(math.pi/2,0,0))
        obj=bpy.context.object
        obj.data.body=word
        obj.data.size=size
        obj.data.align_x="CENTER"
        obj.data.align_y="CENTER"
        obj.data.resolution_u=2
        bpy.ops.object.convert(target="MESH")
        return self.finish(bpy.context.object,swatch)

    def plane(self,name,points,swatch):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([xyz(*p) for p in points],[],[tuple(range(len(points)))])
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        for p in mesh.polygons: p.use_smooth=False
        return self.finish(obj,swatch)

    def group(self,name,pivot=(0,0,0)):
        bpy.ops.object.select_all(action="DESELECT")
        for obj in self.parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=self.parts[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        bpy.context.scene.cursor.location=xyz(*pivot)
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
        obj.name=name
        obj.data.name=name
        self.compound.append(obj)
        self.parts.clear()

    def export(self,name):
        bpy.ops.object.select_all(action="DESELECT")
        for obj in self.compound:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(DEST/(name+".glb")),export_format="GLB",use_selection=True,
                                  export_yup=True,export_cameras=False,export_lights=False,
                                  export_animations=False,export_texcoords=False,export_attributes=False)


def gauge(g,cx,cy,front,r,caption):
    for offset,ratio,pigment in [(0,1.14,IRON),(.009,1.1,BRASS),(.016,1.04,GASKET),(.019,1,PAPER)]:
        g.disc(cx,cy,front+offset,r*ratio,.012 if offset==0 else .004,pigment)
    for i in range(31):
        angle=math.radians(215-250*i/30)
        length=.168 if i%5==0 else .085
        px,py=math.cos(angle),math.sin(angle)
        g.rod((cx+r*(.89-length)*px,cy+r*(.89-length)*py,front+.023),
              (cx+r*.89*px,cy+r*.89*py,front+.023),r*(.017 if i%5==0 else .009),
              RED if i>=24 else IRON,4)
    for i,n in enumerate(("0","2","4","6")):
        a=math.radians(215-250*i/3)
        g.label(n,cx+r*.60*math.cos(a),cy+r*.60*math.sin(a),front+.024,r*.27,IRON)
    g.label(caption,cx,cy-r*.35,front+.024,r*.20,IRON)


def needle(g,cx,cy,z,reach):
    g.disc(cx,cy,z,.007,.008,BRASS,14)
    g.plane("Counterweighted needle",[(cx-.0028,cy-.012,z+.005),(cx+.0028,cy-.012,z+.005),
                                     (cx+.0016,cy+reach*.80,z+.005),(cx,cy+reach,z+.005),
                                     (cx-.0016,cy+reach*.80,z+.005)],RED)


def pressure(g):
    # Socket feet, feed-through pipe, isolation lever and a C-shaped dial cradle.
    for sign in [-1,1]:
        x=sign*.086
        g.box(x,.014,-.005,.049,.028,.165,IRON,.0035)
        for z in [-.058,.045]:
            g.rod((x,.028,z),(x,.036,z),.009,ZINC,6)
    g.rod((-.135,.075,.002),(.135,.075,.002),.031,PAINT,20)
    for x in [-.121,-.093,.07,.105]:
        g.rod((x-.005,.075,.002),(x+.005,.075,.002),.040,BRASS,8)
    g.rod((-.033,.071,.002),(-.033,.182,.002),.021,BRASS)
    g.rod((-.033,.13,.002),(-.033,.155,.002),.031,IRON,6)
    cx,cy=-.033,.208
    gauge(g,cx,cy,.028,.070,"BAR")
    g.rod((.072,.078,.006),(.072,.117,.006),.012,BRASS,8)
    g.rod((.072,.116,.006),(.124,.135,.031),.006,STEEL)
    g.rod((.103,.127,.023),(.139,.140,.038),.010,RED)
    g.group("Housing")
    needle(g,cx,cy,.056,.052)
    g.group("Mechanism",(cx,cy,.056))


def timeclock(g):
    # Shallow cast shoe fits the tabletop. Clock slot opens toward the arriving player.
    g.box(0,.012,0,.268,.024,.202,IRON,.006)
    g.box(0,.045,-.011,.236,.057,.166,PAINT,.009)
    g.box(0,.159,-.045,.220,.210,.098,PAINT,.012)
    g.box(0,.235,.006,.196,.046,.016,IRON,.005)
    g.box(0,.236,.016,.177,.030,.004,PAPER,.0015)
    g.label("23 : 41",0,.236,.020,.026,IRON)
    g.box(0,.175,.007,.190,.044,.012,BRASS,.003)
    g.label("LATE  /  SHIFT",0,.175,.015,.017,IRON)
    g.box(0,.115,.016,.196,.024,.020,GASKET,.003)
    for x in [-.090,.090]:
        g.disc(x,.198,.012,.004,.005,ZINC,8)
        g.disc(x,.147,.012,.004,.005,ZINC,8)
    for x in [-.077,.077]:
        g.rod((x,.06,.058),(x,.108,.006),.007,STEEL,8)
    # Raised side lever, bearing and maroon Bakelite finger pad.
    g.rod((.101,.172,-.035),(.133,.172,-.035),.015,BRASS,12)
    g.rod((.131,.171,-.035),(.131,.131,.055),.007,STEEL,10)
    g.rod((.114,.130,.058),(.152,.130,.058),.011,"6c4438",14)
    g.group("Housing")
    # The printed card comes forward in its bent metal guide when the job is stamped.
    points=[(-.071,.107,.015),(-.071,.074,.088),(.071,.074,.088),(.071,.107,.015)]
    g.plane("Register card",points,PAPER)
    for i in range(6):
        f=(i+1)/8
        y=.107-.033*f+.0009
        z=.015+.073*f
        g.rod((-.057,y,z),(.058,y,z),.00053,"7c806d",4)
    g.rod((-.035,.106,.019),(-.035,.075,.085),.00066,RED,4)
    g.group("Mechanism",(0,.107,.015))


def watermeter(g):
    # Left riser and two union nuts carry water to a green cast-metal flowmeter.
    for x in [-.068,.067]:
        g.box(x,.01,-.015,.05,.02,.15,IRON,.003)
        g.rod((x,.018,-.02),(x,.074,-.02),.017,BRASS)
        for y in [.038,.065]:
            g.rod((x,y-.004,-.02),(x,y+.004,-.02),.024,STEEL,8)
    g.rod((-.09,.078,-.02),(.093,.078,-.02),.021,PAINT,16)
    g.box(0,.091,.004,.121,.056,.095,PAINT,.009)
    g.box(0,.183,-.020,.128,.173,.064,PAINT,.007)
    g.box(-.009,.181,.014,.097,.145,.011,GASKET,.003)
    g.box(-.009,.181,.022,.083,.133,.004,"bfbda5",.002)
    for step in range(13):
        y=.125+.0094*step
        x=-.001 if step%3==0 else .009
        g.rod((x,y,.026),(.023,y,.026),.0009,IRON,4)
    g.label("FLOW",-.009,.238,.026,.0088,IRON)
    g.label("L / M",-.009,.113,.027,.007,IRON)
    for x in [-.035,.017]:
        g.rod((x,.106,.029),(x,.252,.029),.0026,BRASS,8)
    # Cream porcelain wire spool and its pinned copper bracket sit on the return.
    g.rod((.067,.076,-.02),(.067,.186,-.02),.010,ZINC)
    for i in range(6):
        y=.093+i*.013
        g.rod((.067,y,-.02),(.067,y+.008,-.02),.021 if i%2==0 else .018,"cfc7a4",16)
    g.rod((.067,.181,-.02),(.067,.194,-.02),.012,BRASS,8)
    g.group("Housing")
    # The indicator rises up its brass guides as the valve opens.
    g.box(-.012,.142,.031,.039,.007,.005,RED,.001)
    g.disc(-.021,.142,.036,.006,.006,"914937",10)
    g.group("Mechanism",(-.012,.142,.031))


for filename,build in [("station-pressure",pressure),("station-timeclock",timeclock),("station-flow",watermeter)]:
    model=Instrument()
    build(model)
    model.export(filename)
