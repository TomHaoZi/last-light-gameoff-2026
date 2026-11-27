"""Fetch the listed CC0 Poly Haven glTFs and losslessly embed their mesh and PBR media."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = {
    'pipe_wrench': 'roof-strike-wrench',
    'metal_tool_chest': 'boiler-tool-chest',
    'drawer_cabinet': 'archive-drawer-cabinet',
    'worn_metal_rack': 'annex-steel-rack',
    'propane_tank': 'boiler-cylinder',
    'metal_toolbox': 'boiler-maintenance-box',
    'office_notepads': 'archive-notepads',
    'wooden_crate_01': 'annex-shipping-crate',
    'metal_trash_can': 'annex-recess-bin',
    'korean_fire_extinguisher_01': 'annex-recess-extinguisher',
    'portable_generator': 'boiler-service-generator',
    'utility_box_01': 'archive-wall-utility-box',
    'garden_hose_wall_mounted_01': 'roof-irrigation-wall-hose',
}


def fetch(url):
    expected = urlsplit(url)
    if expected.scheme != 'https' or expected.hostname not in {'api.polyhaven.com', 'dl.polyhaven.org'}:
        raise ValueError('Unexpected Poly Haven URL: '+url)
    request = Request(url, headers={'User-Agent':'LAST-LIGHT-Asset-Import/1.0'})
    with urlopen(request, timeout=17) as response:
        data = response.read(12_000_001)
    if len(data)>12_000_000:
        raise ValueError('Source exceeds the 12 MB per-file budget')
    return data


def checked(file):
    data = fetch(file['url'])
    if len(data) != file['size'] or hashlib.md5(data).hexdigest() != file['md5']:
        raise ValueError('Asset checksum not as advertised: '+file['url'])
    return data


def pack(source, target, directory):
    record = json.loads(fetch(f'https://api.polyhaven.com/files/{source}'))['gltf']['1k']['gltf']
    gltf_raw = checked(record)
    gltf = json.loads(gltf_raw)
    directory = directory / source
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'source.gltf').write_bytes(gltf_raw)
    (directory / 'manifest.json').write_text(json.dumps(record,indent=2)+'\n')
    if source=='metal_trash_can':
        # The upstream display scene has new and rusted variants. Mount only
        # the rusted can, with its separate lid and handles, in the Annex.
        for scene in gltf['scenes']:
            scene['nodes']=[i for i in scene['nodes'] if 'rust' in gltf['nodes'][i]['name']]
    binary_entry, = gltf['buffers']
    entry_path = binary_entry.pop('uri')
    images = [image['uri'] for image in gltf.get('images', [])]
    names = list(dict.fromkeys([entry_path,*images]))
    if any(PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or name not in record['include'] for name in names):
        raise ValueError('Unexpected model path')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        values = dict(zip(names,executor.map(checked,[record['include'][name] for name in names])))
    for name,data in values.items():
        path=directory / name
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(data)
    binary = bytearray(values[entry_path])
    if len(binary) != binary_entry['byteLength']:
        raise ValueError('Incorrect buffer length')
    image_views = {}
    for image in gltf.get('images', []):
        image_uri=image.pop('uri')
        data=values[image_uri]
        mime = 'image/jpeg' if image_uri.lower().endswith(('.jpg','.jpeg')) else 'image/png'
        image['mimeType'] = mime
        image_key = (mime, hashlib.sha256(data).digest())
        if image_key in image_views:
            image['bufferView'] = image_views[image_key]
            continue
        binary.extend(b'\x00' * (-len(binary)%4))
        image['bufferView'] = image_views[image_key] = len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)})
        binary.extend(data)
    binary_entry['byteLength']=len(binary)
    binary.extend(b'\x00' * (-len(binary)%4))
    doc=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    doc+=b' ' * (-len(doc)%4)
    glb=b'glTF'+struct.pack('<II',2,28+len(doc)+len(binary))+struct.pack('<I4s',len(doc),b'JSON')+doc+struct.pack('<I4s',len(binary),b'BIN\x00')+binary
    output=ROOT/'dist/3d/assets/env'/f'{target}.glb'
    output.write_bytes(glb)
    return target,len(glb),hashlib.sha256(glb).hexdigest()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('scratch',type=Path)
    parser.add_argument('--only',choices=ASSETS,action='append')
    args=parser.parse_args()
    selected={name:ASSETS[name] for name in args.only} if args.only else ASSETS
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(lambda row: pack(*row,args.scratch),selected.items()):
            print(*result,flush=True)
