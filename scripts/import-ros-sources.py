"""Copy reviewed ROS source excerpts without modifying the source checkout."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess


SOURCES = {
    'index': ('docs/ROS_INTERFACES.md', [(1, 186), (302, 315)]),
    'base': ('ros2_ws/src/cleany_base_driver/docs/interfaces.md', None),
    'odom': ('ros2_ws/src/cleany_base_odometry/docs/interfaces.md', None),
    'mcu': ('esp32/README.md', [(17, 48)]),
    'robot': ('ros2_ws/src/cleany_robot_interface/docs/interfaces.md', None),
    'guard': ('ros2_ws/src/cleany_robot_interface/cleany_robot_interface/control_state_guard.py', [(31, 85)]),
    'control': ('ros2_ws/src/cleany_robot_interface/cleany_robot_interface/control_profile.py', [(147, 186), (217, 218)]),
    'real-launch': ('ros2_ws/src/cleany_robot_interface/launch/real_control.launch.py', None),
    'wrist': ('ros2_ws/src/cleany_robot_interface/cleany_robot_interface/wrist_rgb_camera.py', [(38, 92)]),
    'perception': ('ros2_ws/src/cleany_perception/cleany_perception/inspection_node.py', [(138, 172), (636, 640), (775, 795)]),
    'realsense': ('ros2_ws/src/cleany_perception/launch/realsense.launch.py', None),
    'sim': ('ros2_ws/src/cleany_mujoco_sim/docs/interfaces.md', None),
    'lidar': ('tools/odometry_evaluation/evaluation_stack.py', [(71, 91)]),
    'lidar-guide': ('tools/odometry_evaluation/README.md', [(95, 112)]),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    parser.add_argument('--date', required=True, help='Review date, YYYY-MM-DD')
    args = parser.parse_args()
    root = args.checkout.resolve()
    project = Path(__file__).resolve().parents[1]
    commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    destination = project / 'public' / 'ros' / 'sources'
    destination.mkdir(parents=True, exist_ok=True)
    snapshot = {'reviewedAt': args.date, 'commit': commit, 'basis': 'working-tree', 'sources': {}}
    for key, (relative, ranges) in SOURCES.items():
        data = (root / relative).read_bytes()
        lines = data.decode().splitlines()
        selected = ranges or [(1, len(lines))]
        for start, end in selected:
            if not 1 <= start <= end <= len(lines):
                raise ValueError(f'Invalid excerpt range: {relative}:{start}-{end}')
        excerpt = '\n\n'.join('\n'.join(f'{i}: {lines[i - 1]}' for i in range(start, end + 1))
                              for start, end in selected)
        digest = hashlib.sha256(data).hexdigest()
        text = f'{relative}\nReview: {args.date}\nHEAD: {commit}\nWorking-tree SHA-256: {digest}\n\n{excerpt}\n'
        (destination / f'{key}.txt').write_text(text)
        snapshot['sources'][key] = {
            'path': relative, 'sha256': digest, 'ranges': selected,
            'href': f'/ros/sources/{key}.txt',
            'excerptSha256': hashlib.sha256(text.encode()).hexdigest(),
        }
    manifest = project / 'src' / 'data' / 'ros-sources.json'
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print(f'Copied {len(SOURCES)} reviewed source excerpts; original checkout unchanged.')


if __name__ == '__main__':
    main()
