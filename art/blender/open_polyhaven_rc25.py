"""Blender 4.5: create an editable, texture-packed library of the RC25/26 licensed imports."""
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'dist/3d/assets/env'
RC26 = '--rc26' in sys.argv
OUTPUT = ROOT / 'art/blender' / ('polyhaven-rc26.blend' if RC26 else 'polyhaven-rc25.blend')
MODELS = [
    ('roof-strike-wrench', 'Will Evarts', 'pipe_wrench'),
    ('boiler-tool-chest', 'John Hutcheson and Yann Kervran', 'metal_tool_chest'),
    ('archive-drawer-cabinet', 'Ulan Cabanilla', 'drawer_cabinet'),
    ('annex-steel-rack', 'Luca B', 'worn_metal_rack'),
    ('boiler-cylinder', 'Slinc', 'propane_tank'),
    ('boiler-maintenance-box', 'Mateusz Sadek', 'metal_toolbox'),
    ('archive-notepads', 'Ulan Cabanilla', 'office_notepads'),
    ('annex-shipping-crate', 'James Ray Cock', 'wooden_crate_01'),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
for index, (name, artist, slug) in enumerate(MODELS if RC26 else MODELS[:4]):
    dst = bpy.data.collections.new(name)
    dst['artist'] = artist
    dst['source'] = 'https://polyhaven.com/a/' + slug
    dst['license'] = 'CC0 1.0'
    bpy.context.scene.collection.children.link(dst)
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / (name + '.glb')))
    imported = set(bpy.data.objects) - previous
    for obj in sorted(imported, key=lambda item: item.name):
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        dst.objects.link(obj)
        if obj.parent not in imported:
            obj.location.x += (index % 4) * 1.65
            obj.location.y += (index // 4) * 1.55
bpy.ops.file.pack_all()
bpy.ops.object.select_all(action='DESELECT')
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        view = area.spaces.active.region_3d
        view.view_location = (2.48,0,.81)
        view.view_distance = 7.8
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), compress=True)
