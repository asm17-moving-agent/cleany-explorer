"""Copy visual CAD assets and export a URDF scene without modifying the source."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET

# Motor housings sit on the parent link of the joint they actuate.
HEAD_ASSEMBLIES = {
    ('top_base_link', 'topbase2.stl'): 'head-pan',
    ('head_pan_link', 'tophead1.stl'): 'head-pan',
    ('head_pan_link', 'tophead4.stl'): 'head-tilt',
    ('head_tilt_link', 'tophead5.stl'): 'head-tilt',
    ('head_tilt_link', 'tophead6.stl'): 'head-camera',
}


def vector(value: str | None, default: str = '0 0 0') -> list[float]:
    return [float(item) for item in (value or default).split()]


def origin(element: ET.Element | None) -> dict:
    return {'xyz': vector(element.get('xyz') if element is not None else None),
            'rpy': vector(element.get('rpy') if element is not None else None)}


def category(link: str, visual: ET.Element) -> str:
    filename = visual.find('geometry/mesh')
    name = filename.get('filename', '') if filename is not None else ''
    if 'wrist_mount' in name or 'wrist_mount' in visual.get('name', ''):
        return 'wrist-camera'
    if link.startswith('left_'):
        return 'left-arm'
    if link.startswith('right_'):
        return 'right-arm'
    # Fixed shoulder housings and yaw servos live on base_link in the source URDF.
    if link == 'base_link' and Path(name).name in {'Base.stl', 'Base_Motor.stl'}:
        y = origin(visual.find('origin'))['xyz'][1]
        if y == 0:
            raise ValueError('A shoulder base must be on the left or right of base_link.')
        return 'left-arm' if y > 0 else 'right-arm'
    if 'wheel' in link:
        return 'wheels'
    head_part = HEAD_ASSEMBLIES.get((link, Path(name).name))
    if head_part:
        return head_part
    if link == 'head_pan_link':
        return 'head-pan'
    if link == 'head_tilt_link':
        return 'head-tilt'
    if 'head_camera' in link:
        return 'head-camera'
    if 'pg42' in name:
        return 'motors'
    return 'frame'


def partition_visual(link: str, visual: ET.Element, exported: dict) -> list[dict]:
    """Separate the Pan housing at the existing mast seam in STL coordinates."""
    mesh = visual.find('geometry/mesh')
    if (link == 'top_base_link' and mesh is not None
            and mesh.get('filename', '').endswith('/cad_frame/topbase1.stl')):
        return [{**exported, 'category': part, 'geometry': {
            **exported['geometry'], 'region': {'axis': 2, 'boundary': 0.9675, 'side': side},
        }} for part, side in [('frame', 'lower'), ('head-pan', 'upper')]]
    return [exported]


def freecad_category(link: str, name: str) -> str:
    """Map source assembly groups and named hardware to selectable parts."""
    group = link.removeprefix('cad_snapshot_')
    if group in {'FramePanels', 'PanelMounting', 'FrontBranding'}:
        return 'case'
    if group == 'VirtualDisplay':
        return 'display'
    if group == 'IMURig':
        return 'imu'
    if group.endswith('CameraComponents'):
        return 'wrist-camera'
    if group.startswith('Left') or name == 'LeftMountPlate':
        return 'left-arm'
    if group.startswith('Right') or name == 'RightMountPlate':
        return 'right-arm'
    if group == 'HeadRig':
        for prefix, part in [('HeadCamera', 'head-camera'), ('HeadTilt', 'head-tilt'),
                             ('HeadPan', 'head-pan'), ('HeadFixed', 'head-pan')]:
            if name.startswith(prefix):
                return part
        raise ValueError(f'Unclassified head visual: {name}')
    if group == 'LidarRig':
        return 'lidar'
    if group == 'DriveBase':
        if name.endswith('_wheel'):
            return 'wheels'
        if name.endswith('_motor'):
            return 'motors'
    return 'frame'


def screen_geometry(path: Path) -> tuple[dict, str]:
    """Read the two textured triangles in the exported expression screen."""
    ns = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
    root = ET.parse(path).getroot()
    mesh = root.find('.//c:geometry/c:mesh', ns)
    triangles = mesh.find('c:triangles', ns)
    inputs = [(item.get('semantic'), item.get('source'), item.get('offset'))
              for item in triangles.findall('c:input', ns)]
    if (root.findtext('c:asset/c:up_axis', namespaces=ns) != 'Z_UP'
            or root.find('c:asset/c:unit', ns).get('meter') != '1'
            or inputs != [('VERTEX', '#vertices', '0'), ('TEXCOORD', '#uv', '1')]
            or mesh.find('c:vertices/c:input', ns).get('source') != '#position'
            or triangles.get('count') != '2'):
        raise ValueError(f'Unsupported expression screen layout: {path}')
    positions = vector(mesh.findtext("c:source[@id='position']/c:float_array", namespaces=ns))
    uvs = vector(mesh.findtext("c:source[@id='uv']/c:float_array", namespaces=ns))
    indices = [int(value) for value in triangles.findtext('c:p', namespaces=ns).split()]
    if (len(positions) != 12 or len(uvs) != 8 or len(indices) != 12
            or not all(0 <= i < 4 for i in indices)):
        raise ValueError(f'Invalid screen vertices: {path}')
    image = root.findtext('.//c:library_images/c:image/c:init_from', namespaces=ns)
    if not image or Path(image).name != image or Path(image).suffix != '.png':
        raise ValueError(f'Unsupported screen texture: {image}')
    return ({
        'type': 'screen',
        'positions': [value for i in indices[::2] for value in positions[3*i:3*i+3]],
        'uvs': [value for i in indices[1::2] for value in uvs[2*i:2*i+2]],
    }, image)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--model', choices=('legacy', 'freecad'), default='legacy')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/models')
    args = parser.parse_args()
    source = args.source.resolve()
    description = source / 'ros2_ws/src/cleany_description'
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    freecad = args.model == 'freecad'

    if freecad:
        urdf = description / 'urdf/cleany_freecad_final.urdf'
        manifest = description / 'config/geometry/freecad_final.json'
        root = ET.parse(urdf).getroot()
        source_inputs = [urdf, manifest]
        cad_source = json.loads(manifest.read_text())['source']
    else:
        import xacro
        import xacro.substitution_args

        original_find = xacro.substitution_args._find

        def find_package(resolved, token, arguments, context):
            if arguments == ['cleany_description']:
                return resolved.replace('$(%s)' % token, str(description))
            return original_find(resolved, token, arguments, context)

        xacro.substitution_args._find = find_package
        xml = xacro.process_file(str(description / 'urdf/cleany.urdf.xacro')).toxml()
        root = ET.fromstring(xml)
        source_inputs = sorted((description / 'urdf').glob('*.xacro'))
    materials = {m.get('name'): vector(m.find('color').get('rgba'))
                 for m in root.findall('material') if m.find('color') is not None}
    assets: dict[str, dict] = {}
    def copy_asset(relative: str) -> str:
        if relative in assets:
            return assets[relative]['file']
        path = description / relative
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        filename = digest[:16] + path.suffix.lower()
        shutil.copyfile(path, output / filename)
        assets[relative] = {'file': filename, 'sha256': digest, 'bytes': path.stat().st_size}
        return filename

    links = []
    for link in root.findall('link'):
        visuals = []
        for visual in link.findall('visual'):
            geometry = visual.find('geometry')
            shape = next(iter(geometry))
            geometry_data: dict = {'type': shape.tag}
            if shape.tag == 'mesh':
                relative = shape.get('filename').split('package://cleany_description/')[1]
                filename = copy_asset(relative)
                if Path(relative).suffix.lower() == '.dae':
                    geometry_data, image = screen_geometry(description / relative)
                    geometry_data['texture'] = copy_asset(str(Path(relative).with_name(image)))
                geometry_data.update(file=filename, scale=vector(shape.get('scale'), '1 1 1'))
            else:
                geometry_data.update({k: vector(v) if k == 'size' else float(v) for k, v in shape.attrib.items()})
            material = visual.find('material')
            rgba = [0.65, 0.7, 0.69, 1]
            if material is not None:
                color = material.find('color')
                rgba = vector(color.get('rgba')) if color is not None else materials.get(material.get('name'), rgba)
            name = visual.get('name', '').removesuffix('_visual')
            part = freecad_category(link.get('name'), name) if freecad else category(link.get('name'), visual)
            exported = {**origin(visual.find('origin')), 'geometry': geometry_data, 'rgba': rgba, 'category': part}
            visuals.extend([exported] if freecad else partition_visual(link.get('name'), visual, exported))
        links.append({'name': link.get('name'), 'visuals': visuals})
    joints = []
    for joint in root.findall('joint'):
        axis = joint.find('axis')
        joints.append({'name': joint.get('name'), 'type': joint.get('type'),
                       'parent': joint.find('parent').get('link'),
                       'child': joint.find('child').get('link'),
                       **origin(joint.find('origin')),
                       'axis': vector(axis.get('xyz') if axis is not None else '1 0 0')})
    commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    input_hashes = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in source_inputs}
    date = subprocess.check_output(['git', '-C', str(source), 'show', '-s', '--format=%cs', 'HEAD'], text=True).strip()
    data = {'links': links, 'joints': joints, 'sourceCommit': commit,
            'snapshotDate': date if freecad else '2026-10-26',
            'source': 'Cleany freecad_final static assembly' if freecad else 'Cleany working-tree visual CAD snapshot',
            'sourceInputs': input_hashes, 'assets': assets}
    if freecad:
        data['profile'] = 'freecad_final'
        data['cadSource'] = cad_source
    (output / 'cleany.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'links': len(links), 'joints': len(joints), 'assets': len(assets),
                      'assetBytes': sum(a['bytes'] for a in assets.values())}))


if __name__ == '__main__':
    main()
