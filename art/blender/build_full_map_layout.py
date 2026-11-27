"""Editable four-area spatial layout, derived from the actual game maps (Node + Blender 4.5)."""
import json
from pathlib import Path
from subprocess import check_output
import bpy
from mathutils import Euler

ROOT = Path(__file__).resolve().parents[2]
source = json.loads(check_output(['node',str(ROOT/'scripts/export-map-source.mjs')]))
T = source['tile']
bpy.ops.wm.read_factory_settings(use_empty=True)


def color(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb,1)
    return m


finishes = {
    'wall':color('Wall / permanent',(.24,.27,.30)),
    'floor':color('Floor / both phases',(.45,.48,.49)),
    'day':color('Floor / 17:59 only',(.87,.48,.11)),
    'night':color('Floor / 18:00 only',(.13,.50,.79)),
    'obstacle':color('Transfer obstacle envelope',(.49,.23,.19)),
}


def collection(scene, name):
    dst = bpy.data.collections.new(name)
    scene.collection.children.link(dst)
    return dst


def box(dst, label, game_x, game_z, base, w, d, h, finish):
    x,y,z=w/2,d/2,h/2
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new(label)
    mesh.from_pydata(verts,[],faces)
    mesh.materials.append(finishes[finish])
    obj=bpy.data.objects.new(label,mesh)
    obj.location=(game_x,-game_z,base+z)
    dst.objects.link(obj)
    return obj


def marker(dst,label,x,z):
    o=bpy.data.objects.new(label,None)
    o.location=(x,-z,.18)
    o.empty_display_type='ARROWS'
    o.empty_display_size=.48
    o.show_name=True
    dst.objects.link(o)
    return o


def setup(scene):
    scene.unit_settings.system='METRIC'
    scene['purpose']='Editable layout reference from dist/3d/levels.js and backrooms-track.js; not a replacement runtime or final art.'
    return {k:collection(scene,n) for k,n in [('wall','Permanent structure'),('floor','Permanent floor'),
        ('day','17:59 Only'),('night','18:00 Only'),('logic','Gameplay anchors')]}


first=bpy.context.scene
for i,level in enumerate(source['levels']):
    scene=first if i==0 else bpy.data.scenes.new(level['name'])
    scene.name=('1 · The Boiler Room', "2 · Gary's Office", '4 · The Rooftop')[i]
    groups=setup(scene)
    for tile in level['floor']:
        phase=tile.get('phase') if tile['kind'] in ('d','n') else None
        phase=phase or 'floor'
        obj=box(groups[phase],f'{tile["kind"]} floor {tile["col"]}:{tile["row"]}',tile['x'],tile['z'],-.28,T,T,.28,phase)
        obj['tile']=[tile['col'],tile['row']]
    for tile in level['walls']:
        height=1.38 if level['id']=='roof' else 3.28
        obj=box(groups['wall'],f'Wall {tile["col"]}:{tile["row"]}',tile['x'],tile['z'],-.26,T,T,height+.26,'wall')
        obj['tile']=[tile['col'],tile['row']]
    for label,tile in level['markers']:
        obj=marker(groups['logic'],label,tile['x'],tile['z'])
        obj['source_kind']=tile['kind']
        obj['source_tile']=[tile['col'],tile['row']]

annex=bpy.data.scenes.new('3 · Records Annex')
groups=setup(annex)
track=source['track']
cx,w,start,end=(track[k] for k in ('centerX','width','startZ','endZ'))
length=start-end
obs=collection(annex,'Obstacle collision envelopes')
for side in (-1,1):
    box(groups['wall'],f'Longitudinal wall {side}',cx+side*(w/2+.08),(start+end)/2,0,.16,length+8,3.3,'wall')


def carpet(a,b,phase):
    if b>a: box(groups[phase],f'{phase.capitalize()} {a:.2f}–{b:.2f} m',cx,start-(a+b)/2,-.074,w,b-a,.074,phase)


last=-4
for part in track['obstacles']:
    a=part['at']; b=a+part['length']
    if part['kind'] in ('gap','bridge'):
        carpet(last,a,'floor')
        if part['kind']=='bridge': carpet(a,b,part['phase'])
        last=b
    if part['height']:
        left,right=part['left'],part['right']
        o=box(obs,f'{part["id"]} {part["kind"]}',cx+(left+right)/2,start-(a+b)/2,0,right-left,b-a,part['height'],'obstacle')
        if 'opening' in part: o['opening']=part['opening']
    o=marker(groups['logic'],part['id'],cx,start-a)
    o['obstacle']=part['kind']
    o['distance_m']=a
carpet(last,length+3,'floor')
marker(groups['logic'],'Transfer start',cx,start)
marker(groups['logic'],'Fire door',cx,end)

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.shading.color_type='MATERIAL'
            space.region_3d.view_rotation=Euler((.65,0,0)).to_quaternion()
            space.region_3d.view_distance=72
            space.region_3d.view_location=(29,-23,0)
            space.overlay.show_relationship_lines=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/full-map-layout.blend'),compress=True)
for scene in bpy.data.scenes:
    print(scene.name,len(scene.objects),sum(o.type=='MESH' for o in scene.objects))
