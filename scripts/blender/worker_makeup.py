"""Projection paint on the original photographic UVs, including the skin beneath fittings."""
import math
import tempfile
from pathlib import Path

import bpy
import numpy as np


def decode(reader, material):
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "original"
        path.write_bytes(reader.image(material))
        image = bpy.data.images.load(str(path))
        image.colorspace_settings.name = "Non-Color"
        w,h = image.size
        pixels = np.empty(w*h*4,dtype=np.float32)
        image.pixels.foreach_get(pixels)
        bpy.data.images.remove(image)
        return pixels.reshape(h,w,4)[::-1].copy()


def encode(rgba, jpeg):
    h,w,_ = rgba.shape
    image = bpy.data.images.new("Repainted pigment", width=w, height=h, alpha=not jpeg)
    image.alpha_mode = "STRAIGHT"
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(np.ascontiguousarray(rgba[::-1],dtype=np.float32).ravel())
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder)/("paint.jpg" if jpeg else "paint.png")
        image.filepath_raw = str(path)
        image.file_format = "JPEG" if jpeg else "PNG"
        image.save()
        result=path.read_bytes()
    bpy.data.images.remove(image)
    return result


def chart(reader, surface, resolution):
    uv = reader.read(surface.attr["TEXCOORD_0"]) * resolution
    output = np.full((resolution,resolution,3),np.nan,dtype=np.float32)
    for tri in surface.tri:
        a,b,c = uv[tri]
        ab,ac = b-a,c-a
        area = ab[0]*ac[1]-ab[1]*ac[0]
        if abs(area)<.001:
            continue
        lower = np.maximum(0,np.floor(np.min([a,b,c],axis=0)).astype(int)-1)
        upper = np.minimum(resolution,np.ceil(np.max([a,b,c],axis=0)).astype(int)+1)
        if np.any(upper<=lower):
            continue
        y,x = np.ogrid[lower[1]:upper[1],lower[0]:upper[0]]
        u=((x+.5-a[0])*ac[1]-(y+.5-a[1])*ac[0])/area
        v=(ab[0]*(y+.5-a[1])-ab[1]*(x+.5-a[0]))/area
        inside=(u>=-.022)&(v>=-.022)&(u+v<=1.022)
        yy,xx = np.nonzero(inside)
        pa,pb,pc=surface.points[tri]
        output[yy+lower[1],xx+lower[0]]=pa+(pb-pa)*u[inside,None]+(pc-pa)*v[inside,None]
    return output


def smooth(start,end,v):
    t=np.clip((v-start)/(end-start),0,1)
    return t*t*(3-2*t)


def mix(rgb, pigment, weight):
    weight=np.clip(weight,0,1)[:,None]
    return rgb*(1-weight)+np.asarray(pigment)*weight


# Patch charts all fit inside unused skin under the three uniforms. Each job
# retains private high-resolution makeup without additional runtime samplers.
def reserve_patch(filled, width, height):
    stride=8
    h,w=filled.shape
    cells=filled.reshape(h//stride,stride,w//stride,stride).max(axis=(1,3)).astype(int)
    summed=np.pad(cells,((1,0),(1,0))).cumsum(0).cumsum(1)
    nx,ny=(width+stride-1)//stride,(height+stride-1)//stride
    covered=summed[ny:,nx:]-summed[:-ny,nx:]-summed[ny:,:-nx]+summed[:-ny,:-nx]
    free=np.argwhere(covered==0)
    if not len(free):
        raise ValueError("The fitted skin no longer has room for the makeup patch")
    row,col=free[len(free)//2]
    x,y=int(col*stride),int(row*stride)
    filled[y:y+height,x:x+width]=True
    return x,y


def resize_accessor(reader, idx, value):
    acc=reader.doc["accessors"][idx]
    view=reader.doc["bufferViews"][acc["bufferView"]]
    raw=np.ascontiguousarray(value).tobytes()
    view.update(byteOffset=len(reader.data),byteLength=len(raw))
    reader.data.extend(raw)
    acc["count"]=len(value)
    if "min" in acc:
        acc["min"]=value.min(0).tolist()
        acc["max"]=value.max(0).tolist()


def wound_pigments(base,x,y,z,job):
    # Asymmetric islands and satellite spots follow the surface in metres.
    # Keep the orbit, nostril and lip landmarks legible. Different jobs carry
    # their own wound distribution, even though they share the pore atlas.
    islands=[
        [( .054,1.694,.017,.024,.30),(.045,1.678,.012,.018,.28),
         (.032,1.667,.008,.008,.42),(.061,1.720,.009,.013,-.29)],
        [( .025,1.615,.023,.014,-.40),(.031,1.598,.015,.019,-.22),
         (.036,1.636,.011,.013,-.23),(.011,1.589,.007,.009,.22)],
        [(-.064,1.659,.016,.023,-.10),(-.052,1.642,.017,.013,-.50),
         (-.039,1.637,.011,.010,-.32),(-.057,1.624,.008,.009,.26)]
    ][job]
    grain=(.40*np.sin(312*x+231*y+92*z)*np.cos(177*y-238*z)
           +.24*np.cos(704*x-497*y+z*399)+.15*np.sin(1310*y+853*z)*np.cos(1203*x-526*y)
           +.08*np.cos(2379*x+2091*y))
    lobes=[]
    for cx,cy,rx,ry,tilt in islands:
        lobes.append(np.hypot((x-cx-tilt*(y-cy))/rx,(y-cy)/ry))
    d=np.minimum.reduce(lobes)+.25*grain
    frontal=smooth(.066,.106,z) if job<2 else smooth(.031,.069,z)
    detail=np.clip(.61+(base@np.array([.34,.5,.16]))*.53+.2*grain,.45,1.18)[:,None]
    mottling=.5+.27*np.sin(x*400+y*311+z*171)*np.cos(y*379-z*238)+.19*grain
    bruise=(1-smooth(1.04,1.58,d))*(.55+.44*mottling)*frontal
    pigment=mix(base,base*np.array([.74,.60,.70]),bruise)
    inflamed=(1-smooth(.87,1.19,d))*frontal*(.84+.12*mottling)
    pigment=mix(pigment,detail*np.array([.40,.145,.135]),inflamed)
    bed=(1-smooth(.68,.95,d))*frontal
    wet_tissue=np.array([.30,.085,.085])+mottling[:,None]*np.array([.15,.065,.052])
    pigment=mix(pigment,wet_tissue*detail,bed*.93)
    # Pale raised plates interrupt the wound bed, with branching fissures
    # and dark pits, so the affected region never becomes a painted red disc.
    ridges=np.sin(323*x+199*y+2.2*np.sin(y*171+z*112))
    fissure=np.exp(-((ridges+.37*np.cos(274*y-83*x))/.19)**2)
    plate=(1-smooth(.39,.84,d+.23*grain+.23*fissure))*frontal
    slate=np.array([.455,.431,.377])+mottling[:,None]*np.array([.18,.20,.22])
    pigment=mix(pigment,slate*detail,plate*(.69+.29*mottling))
    pigment=mix(pigment,np.array([.253,.166,.156])*detail,plate*fissure*.63)
    outer=np.exp(-((d-.86+.08*grain)/.14)**2)*frontal
    wet=outer*smooth(.27,.75,mottling+.18*np.sin(155*y+307*x))
    pigment=mix(pigment,detail*np.array([.39,.082,.083]),wet*.86)
    glint=wet*smooth(.58,.91,mottling+.16*np.cos(957*x+625*y))
    pigment=mix(pigment,np.array([.65,.36,.29])*detail,glint*.59)
    # Pool at the wound seam then split into unequal downhill trails.
    channels=[[(.045,1.682,.065,.0039,-.014),(.056,1.689,.037,.0025,-.006)],
              [(.029,1.605,.057,.0049,.002),(.015,1.605,.032,.0031,-.003),(.039,1.613,.042,.0021,.004)],
              [(-.056,1.646,.068,.0045,.013),(-.062,1.638,.040,.0028,.007)]][job]
    for cx,cy,length,width,lean in channels:
        t=(cy-y)/length;tc=np.clip(t,0,1)
        path=cx+lean*tc+.0017*np.sin(tc*8+job)+.00062*np.cos(tc*18+job)
        width_=width*(1-.59*tc)
        edge=(x-path)/width_
        fade=smooth(-.08,.06,t)*(1-smooth(.81,1.04,t))*frontal
        oxidized=np.exp(-(edge/1.85)**2)*fade*(.72+.22*mottling)
        pigment=mix(pigment,detail*np.array([.336,.169,.127]),oxidized*.82)
        narrow=np.exp(-(edge*edge))*fade
        pigment=mix(pigment,detail*np.array([.27,.068,.069]),narrow*.92)
        ridge=np.exp(-((edge+.31)/.16)**2)*fade*(.28+.29*mottling)
        pigment=mix(pigment,detail*np.array([.54,.25,.19]),ridge)
    return np.clip(pigment,0,1)


def job_makeup(reader,surfaces,image,world):
    size=image.shape[0]
    filled=np.isfinite(world[:,:,0]).copy()
    source=image.copy()
    # Only the forward head UV island is relocated. Eyelid interiors, scalp
    # and mouth cavity keep the shared base, without any geometry duplication
    # except the seam vertices required by glTF's single indexed stream.
    masks=[(.756,.305,.985,.485),(.826,.423,.997,.601),(.766,.546,.980,.739)]
    for index,(surface,name,rect) in enumerate(zip(surfaces,("boiler","office","roof"),masks)):
        prim=next(m for m in reader.doc["meshes"] if m["name"]=="Skin "+name)["primitives"][0]
        tri=surface.tri.copy()
        uv=reader.read(surface.attr["TEXCOORD_0"])
        centre=uv[tri].mean(axis=1)
        pos=surface.points[tri].mean(axis=1)
        left,top,right,bottom=rect
        select=(centre[:,0]>left)&(centre[:,0]<right)&(centre[:,1]>top)&(centre[:,1]<bottom)&(pos[:,1]>1.537)
        touched=np.unique(tri[select])
        bounds=uv[touched]*size
        margin=12
        lo=np.maximum(0,np.floor(bounds.min(0)).astype(int)-margin)
        hi=np.minimum(size,np.ceil(bounds.max(0)).astype(int)+margin+1)
        sx,sy=lo; width,height=hi-lo
        dx,dy=reserve_patch(filled,width,height)
        tile=source[sy:sy+height,sx:sx+width].copy()
        mapping=world[sy:sy+height,sx:sx+width]
        usable=np.isfinite(mapping[:,:,0])
        tile[usable,:3]=wound_pigments(tile[usable,:3],*mapping[usable].T,index)
        image[dy:dy+height,dx:dx+width]=tile
        boundary=np.intersect1d(touched,np.unique(tri[~select]))
        indices=np.arange(len(uv))
        indices[boundary]=np.arange(len(uv),len(uv)+len(boundary))
        tri[select]=indices[tri[select]]
        for attr,accessor in surface.attr.items():
            values=reader.read(accessor)
            values=np.concatenate((values,values[boundary]),axis=0)
            if attr=="TEXCOORD_0":
                values[indices[touched]]+=np.array([dx-sx,dy-sy])/size
            resize_accessor(reader,accessor,values)
        reader.replace(prim["indices"],tri.reshape(-1,1))
        print(f"{name}: private makeup {width}x{height}, {len(boundary)} shared seam vertices")


def paint_skin(reader,surfaces):
    image=decode(reader,0)
    size=image.shape[0]
    world=chart(reader,surfaces[0],size)
    for other in surfaces[1:]:
        patch=chart(reader,other,size)
        missing=~np.isfinite(world[:,:,0])
        world[missing]=patch[missing]
    valid=np.isfinite(world[:,:,0])
    x,y,z=world[valid].T
    rgb=image[valid,:3]
    texture=rgb@np.array([.30,.56,.14])
    front=smooth(.068,.115,z)
    face=smooth(1.548,1.610,y)
    unit=lambda cx,cy,rx,ry: np.exp(-((x-cx)/rx)**2-((y-cy)/ry)**2)*front
    # Cyan and red-violet undertones sit in different planes of the face.
    corpse=rgb*.48+texture[:,None]*np.array([.52,.54,.57])
    rgb=mix(rgb,corpse,.76*face + .23*(1-face))
    orbit=unit(.031,1.681,.025,.015)+unit(-.031,1.679,.025,.016)
    lower=unit(.033,1.670,.024,.013)+unit(-.030,1.668,.021,.011)
    rgb=mix(rgb,rgb*np.array([.65,.60,.69]),orbit*.76+lower*.32)
    # Uneven, gravitating rivulets have an oxidised edge and a narrow, wet centre.
    pores=(.48+.26*np.sin(x*1600+y*810)*np.sin(y*1030-z*970)
           +.14*np.cos(y*2500+z*1870)*np.sin(x*2390))
    mandibular=unit(.004,1.606,.034,.016)
    rgb=mix(rgb, np.array([.29,.127,.123])*(.67+.72*texture[:,None]),mandibular*.78)
    for rootx,rooty,length,width,drift,phase in [
        (-.022,1.611,.056,.005,.013,.2),(-.015,1.608,.026,.0035,.005,.8),
        (.028,1.619,.039,.004,-.001,.3),(.043,1.669,.041,.0038,.006,2.1),
        (.050,1.669,.021,.0019,.005,4.),(-.039,1.673,.027,.0025,-.002,5.)]:
        t=(rooty-y)/length
        channel=rootx + drift*t + .0013*np.sin(t*7+phase)+.0006*np.sin(t*17+phase)
        spread=width*(.84-.43*np.clip(t,0,1))
        d=np.abs(x-channel+.0006*np.sin(y*425+x*511))
        strength=smooth(-.17,.09,t)*(1-smooth(.72,1.03+.06*pores,t))*front
        rust=np.exp(-(d/(spread*1.9))**2)*strength*(.52+.48*pores)
        blood=np.exp(-(d/spread)**3)*strength
        rgb=mix(rgb,np.array([.31,.15,.145])*(.60+.83*texture[:,None]),rust*.82)
        rgb=mix(rgb,np.array([.19,.059,.059])*(.65+.85*texture[:,None]),blood*(.64+.17*pores))
    # Interrupted superficial veins under thin, mottled skin, strongest at temples.
    temples=unit(.064,1.688,.020,.048)+unit(-.061,1.703,.018,.051)
    for side in [-1,1]:
        for i in range(3):
            v=(y-1.650)/.10
            bend=.0026*np.sin(v*(7+i)+i*1.8)+.0023*np.sin(v*11+i)
            trunk=side*(.061-.005*i+.009*v)+bend
            vein=np.exp(-((x-trunk)/(.0007+.00022*i))**2)*temples
            rgb=mix(rgb,rgb*np.array([.61,.58,.72]),vein*.55)
    arm=smooth(.27,.37,np.abs(x))*(1-smooth(1.30,1.38,y))
    dusty=(.57+.28*np.sin(x*118+y*85)*np.sin(y*154-z*111)+.12*np.cos(x*311-z*217))
    rgb=mix(rgb,rgb*np.array([.58,.52,.48]),arm*dusty*.90)
    for side in [-1,1]:
        # Dried handling prints track across the forearm, with a fragmented edge.
        for cx,cy,scale in [(.429,1.205,.9),(.454,1.175,1),(.479,1.146,.7)]:
            stain=np.exp(-((side*x-cx+(y-cy)*.42)/.014)**2-((y-cy)/.058)**2)
            rgb=mix(rgb,np.array([.33,.17,.13])*(.64+.68*texture[:,None]),stain*scale*(.30+.50*dusty))
    fingers=smooth(.465,.52,np.abs(x))*(1-smooth(1.10,1.17,y))
    rgb=mix(rgb,rgb*np.array([.62,.27,.26]),fingers*(.5+.36*pores))
    image[valid,:3]=np.clip(rgb,0,1)
    job_makeup(reader,surfaces,image,world)
    reader.repaint(0,encode(image,True),"image/jpeg")


def paint_eyes(reader):
    image=decode(reader,5)
    h,w=image.shape[:2]
    y,x=np.mgrid[:h,:w]
    x=(x+.5)/w
    y=(y+.5)/h
    rgb=image[:,:,:3]
    light=rgb@np.array([.30,.55,.15])
    for cx,cy,fog in [(.707,.298,.85),(.292,.712,.38)]:
        dx=x-cx
        dy=y-cy
        r=np.hypot(dx,dy)
        iris=1-smooth(.098,.118,r)
        cloudy=np.exp(-((dx-.007)/.075)**2-((dy+.006)/.065)**2)
        fibres=(.72+.28*(.5+.5*np.sin(63*np.arctan2(dy,dx)+r*97)))
        ash=(.34+light*.50+cloudy*.24)*fibres
        tint=ash[:,:,None]*np.array([.87,.97,.91])
        rgb=mix(rgb.reshape(-1,3),tint.reshape(-1,3),(iris*fog).ravel()).reshape(h,w,3)
    image[:,:,:3]=np.clip(rgb,0,1)
    reader.repaint(5,encode(image,False),"image/png")


def paint_clothes(reader, garment, index):
    mat=index+2
    rgba=decode(reader,mat)
    atlas=chart(reader,garment,rgba.shape[0])
    valid=np.isfinite(atlas[:,:,0])
    x,y,z=atlas[valid].T
    rgb=rgba[valid,:3]
    grain=.5+.26*np.sin(152*x+137*y+z*57)*np.cos(116*y-24*x)+.14*np.cos(249*x+326*y)*np.sin(226*y)
    fine=.5+.4*np.cos(x*1900-y*1360)*np.sin(z*930+y*1170)
    # Dust caught on shoulders and deep hems. The boiler's saturated-white
    # T-shirt needs an absolute pigment as well as a darker diffuse multiplier.
    wear=np.clip(.34+.65*grain+.08*fine,0,1)
    intensity=(rgb@np.array([.30,.55,.15]))[:,None]
    sleeves=smooth(.11,.25,np.abs(x)) * np.exp(-((y-1.395)/.12)**2)
    collar=np.exp(-(x/.108)**2-((y-1.519)/.074)**2) * smooth(-.02,.08,z)
    cuffs=smooth(.255,.39,np.abs(x))*smooth(1.085,1.15,y)*(1-smooth(1.24,1.35,y))
    knee=np.exp(-((y-.49)/.078)**2)*smooth(.035,.095,z)
    boots=1-smooth(.12,.36,y)
    if index==0:
        # A pale, nicotine-stained undershirt under the mechanic's suspenders.
        shirt=smooth(1.30,1.41,y)*smooth(.38,.83,intensity[:,0])
        rgb=mix(rgb,rgb*np.array([.76,.74,.66]),shirt*.86)
    dirt=(.25*sleeves + .52*collar + .59*cuffs + .35*knee + .44*boots)*wear
    rgb=mix(rgb,np.array([.34,.30,.23])*(.54+intensity*.65),dirt)
    if index==0:
        root,fall,span=-.037,.235,.018
    elif index==1:
        root,fall,span=.047,.17,.013
    else:
        root,fall,span=.073,.141,.012
    t=(1.529-y)/fall
    line=root+(root*.39)*t+.005*np.sin(t*6.8+z*10)+.003*np.cos(t*12.1)
    edge=(x-line+(.004*(grain-.5)))/(span*(1-.53*np.clip(t,0,1)))
    stain=np.exp(-edge**2)*smooth(-.13,.08,t)*(1-smooth(.51,1.09,t))*smooth(.04,.10,z)
    capillary=.52+.42*grain+.11*np.cos(y*702+x*540)*np.sin(z*621-y*489)
    rgb=mix(rgb,np.array([.37,.18,.13])*(.52+.62*intensity),stain*capillary*.89)
    for j in range(2):
        tail=(x-line+(.014+j*.011)*np.sin(np.clip(t,0,1)*1.8))/(.003+j*.0017)
        trace=np.exp(-tail*tail)*smooth(.13,.32,t)*(1-smooth(.46+j*.12,.76+j*.10,t))*smooth(.04,.10,z)
        rgb=mix(rgb,rgb*np.array([.56,.36,.33]),trace*wear*.55)
    dry=np.exp(-((edge-.36)/1.9)**2)*smooth(-.06,.18,t)*(1-smooth(.71,1.03,t))*smooth(.04,.10,z)
    rgb=mix(rgb,rgb*np.array([.64,.46,.41]),dry*wear*.45)
    # A different origin, gravity direction and stopping seam in each uniform.
    # Cloth draws plasma sideways along its warp. The centre stays darker
    # where the folded hem or collar has soaked through.
    marks=[[(.092,1.511,.062,.213,-.035),(.107,1.468,.030,.160,-.029)],
           [(.017,1.518,.048,.193,.044),(-.009,1.508,.023,.133,.016)],
           [(-.295,1.337,.083,.177,-.121),(-.385,1.243,.032,.128,-.078),
            (-.065,1.525,.031,.100,.002)]][index]
    for rootx,rooty,width,length,drift in marks:
        progress=(rooty-y)/length
        t=np.clip(progress,0,1)
        line=rootx+drift*t+.006*np.sin(t*6.2+index*.9)
        span=width*(1-.70*t)
        offset=(x-line)/(span+.0001)
        capillary=.18*(grain-.50)+.11*np.sin(y*356+x*171)+.060*np.sin(x*822+y*597)
        dist=np.abs(offset)+capillary
        facing=smooth(-.016,.095,z) if index<2 or abs(rootx)<.1 else .48+.52*smooth(-.062,.051,z)
        mask=smooth(-.11,.07,progress)*(1-smooth(.79,1.06+capillary,progress))*facing
        tide=(1-smooth(.72,1.44,dist))*mask
        rgb=mix(rgb,np.array([.375,.188,.128])*(.57+intensity*.56),tide*(.55+.31*grain))
        fold=.55+.45*np.cos(y*139+x*221)
        soaked=(1-smooth(.29,1.0,dist))*mask*(.56+.35*fold)
        rgb=mix(rgb,np.array([.285,.091,.084])*(.57+.73*intensity),soaked)
        threads=(np.cos(x*1008+y*548)>.21)*(.70+.30*fine)
        wick=np.exp(-((dist-1.04)/.20)**2)*mask*threads
        rgb=mix(rgb,np.array([.40,.217,.15])*(.72+.48*intensity),wick*.48)
    rgba[valid,:3]=np.clip(rgb,0,1)
    reader.repaint(mat,encode(rgba,True),"image/jpeg")


def aged_enamel(size=256):
    # A periodic painted-steel surface projected along each fitting's dominant
    # plane. Larger chips accumulate in islands; scratches have tapered ends.
    y,x=np.mgrid[:size,:size].astype(float)/size
    t=2*math.pi
    texture=(.42*np.cos(t*(3*x+2*y))+.26*np.sin(t*(8*y-5*x))+
             .12*np.cos(t*(17*x+9*y))+.14*np.sin(t*(26*y-16*x))+
             .08*np.cos(t*(41*x-32*y)))
    grain=np.random.default_rng(321).random((size,size))
    chips=smooth(.48,.77,texture+.20*(grain-.5))
    rust=smooth(.35,.69,texture+.12*(grain-.5)) * (.58+.42*grain)
    base=.84+.065*texture+.05*grain
    rgb=base[:,:,None]*np.ones((1,1,3))
    rgb*=1-rust[:,:,None]*np.array([.32,.46,.54])
    rgb+=chips[:,:,None]*np.array([.12,.12,.095])
    rng=np.random.default_rng(8321)
    for _ in range(34):
        cx,cy=rng.random(2)
        width=rng.uniform(.012,.090)
        ang=rng.uniform(-1.1,.4)
        dx=(x-cx+.5)%1-.5
        dy=(y-cy+.5)%1-.5
        u=(dx*np.cos(ang)+dy*np.sin(ang))/width
        v=(-dx*np.sin(ang)+dy*np.cos(ang))/.0023
        line=np.exp(-v*v)*np.maximum(0,1-u*u)*(grain>.12)
        rgb+=line[:,:,None]*.17
    return np.rint(np.clip(rgb,0,1)*255).astype('u1')
