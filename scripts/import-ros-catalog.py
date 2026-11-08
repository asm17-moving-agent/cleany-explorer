"""Inventory source-declared ROS interfaces; never execute the robot checkout."""

import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess

CALLS = {
    'create_publisher': ('topic', 'producers', 1),
    'create_subscription': ('topic', 'consumers', 1),
    'create_service': ('service', 'producers', 1),
    'create_client': ('service', 'consumers', 1),
    'ActionServer': ('action', 'producers', 2),
    'ActionClient': ('action', 'consumers', 2),
}
SIM = re.compile(r'mock|mujoco|gazebo|ros_gz|sorting_cameras|SortingObserver|simulation_|simulated_|pregrasp_sim')
REAL = re.compile(r'real_control|real_robot|arm_state_reader|read_only_robot|wrist_rgb_camera|cleany_motor_controller|rplidar|jetson|physical_|hardware_|motor_telemetry')
SIM_ENDPOINT = re.compile(r'^/(mock/|simulation/|gazebo[/_]|mujoco_sim/|cleany/internal/mujoco/|sorting_cameras/|sorting/(verify_placement|register_placement_target)$|head_pan/command$)')
REAL_ENDPOINT = re.compile(r'^/(real_control/|joint_state_broadcaster/|(?:left|right)_wrist_camera/(enabled|set_enabled|preview/compressed)$|manipulation/(control_state|confirm_recovery|return_arm)(/|$))')


def context(name):
    return '시뮬레이션' if SIM.search(name) else '실물' if REAL.search(name) else '공통'


def clean(text):
    text = re.sub(r'\[([^\]]+)\]\[[^\]]+\]', r'\1', text)
    return text.replace('`', '').strip()


def normalized(name, owner=''):
    if name.startswith('~/'):
        return '/' + owner + name[1:]
    return name if name.startswith(('/', '<')) else '/' + name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    parser.add_argument('--date', required=True)
    args = parser.parse_args()
    root = args.checkout.resolve()
    project = Path(__file__).resolve().parents[1]
    evidence_path = project / 'src/data/ros-sources.json'
    evidence = json.loads(evidence_path.read_text())
    evidence['reviewedAt'] = args.date
    evidence['commit'] = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    records, declarations, index_keys = [], [], []

    def source(path, lines=None):
        relative = str(path.relative_to(root))
        key = 'inventory-' + hashlib.sha256(relative.encode()).hexdigest()[:12]
        data = path.read_bytes()
        text_lines = data.decode().splitlines()
        digest = hashlib.sha256(data).hexdigest()
        selected = sorted(set(i for line in (lines or []) for i in range(max(1, line - 3), min(len(text_lines), line + 5) + 1))) if lines else list(range(1, len(text_lines) + 1))
        excerpt = f'{relative}\nReview: {args.date}\nHEAD: {evidence["commit"]}\nWorking-tree SHA-256: {digest}\n\n'
        excerpt += '\n'.join(f'{i}: {text_lines[i - 1]}' for i in selected) + '\n'
        previous = evidence['sources'].get(key)
        destination = project / f'public/ros/sources/{key}.txt'
        if previous and previous['sha256'] == digest and destination.exists():
            existing = destination.read_text().splitlines()
            if all(f'{i}: {text_lines[i - 1]}' in existing for i in selected):
                return key
        (project / f'public/ros/sources/{key}.txt').write_text(excerpt)
        evidence['sources'][key] = {'path': relative, 'sha256': digest, 'href': f'/ros/sources/{key}.txt', 'excerptSha256': hashlib.sha256(excerpt.encode()).hexdigest()}
        return key

    def add(kind, name, message, producers, consumers, condition, src, environment='shared', scope='application'):
        if SIM_ENDPOINT.search(normalized(name)):
            environment = 'sim'
        elif REAL_ENDPOINT.search(normalized(name)):
            environment = 'real'
        records.append(dict(kind=kind, name=normalized(name), type=message, producers=producers, consumers=consumers,
                            condition=condition, sources=[src], environment=environment, scope=scope))

    index = root / 'docs/ROS_INTERFACES.md'
    index_source = source(index)
    references = dict(re.findall(r'^\[([^\]]+)\]:\s*(.+)$', index.read_text(), re.M))
    def index_nodes(value):
        result = []
        for token in value.split(','):
            node_name = clean(token)
            if node_name == '—':
                continue
            reference = re.search(r'\]\[([^\]]+)\]', token)
            linked = references.get(reference[1], '') if reference else ''
            result.append(dict(name=node_name, context=context(node_name + ' ' + linked)))
        return result
    kind = None
    for line in index.read_text().splitlines():
        if line.startswith('#'):
            kind = {'### Topic 목록': 'topic', '### Service 목록': 'service', '### Action 목록': 'action'}.get(line)
        if not kind or not line.startswith('| `'):
            continue
        cells = line.strip('|').split('|')
        name, message, _, _, condition = [clean(c) for c in cells]
        producers, consumers = index_nodes(cells[2]), index_nodes(cells[3])
        peers = producers + consumers
        sim = any(n['context'] == '시뮬레이션' for n in peers)
        real = any(n['context'] == '실물' for n in peers)
        sim_only = bool(SIM.search(name)) or (bool(peers) and all(n['context'] == '시뮬레이션' for n in peers))
        sim_only |= bool(producers) and all(n['context'] == '시뮬레이션' for n in producers)
        sim_only |= name == '/head_pan/command'
        environments = ['sim'] if sim_only else ['real', 'sim'] if sim else ['real'] if real else ['shared']
        for env in environments:
            keep = lambda ns: [n for n in ns if n['context'] != ('실물' if env == 'sim' else '시뮬레이션')]
            kept_producers, kept_consumers = keep(producers), keep(consumers)
            if not kept_producers and not kept_consumers:
                continue
            add(kind, name, message, kept_producers, kept_consumers, condition if condition != '—' else '실행 구성과 remap에 따라 달라집니다.', index_source, env, 'dynamic' if '<' in name else 'application')
        index_keys.append(f'{kind}:{name}')

    # Resolve literal defaults only. Unknown expressions remain searchable patterns.
    for path in sorted((root / 'ros2_ws/src').rglob('*.py')):
        if any(p in {'test', 'tests', 'runtime_test', '__pycache__', 'build', 'install', 'tools'} for p in path.parts):
            continue
        try:
            tree = ast.parse(path.read_text())
        except (SyntaxError, UnicodeError):
            continue
        calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and ast.unparse(n.func).split('.')[-1] in CALLS]
        if not calls:
            continue
        imports, assignments, defaults, owners = {}, {}, {}, []
        evidence_lines = [n.lineno for n in calls]
        for n in ast.walk(tree):
            if isinstance(n, ast.ImportFrom) and n.module and any(f'.{x}' in n.module for x in ('msg', 'srv', 'action')):
                for alias in n.names:
                    imports[alias.asname or alias.name] = n.module.replace('.', '/') + '/' + alias.name
            if isinstance(n, (ast.Assign, ast.AnnAssign)) and n.value:
                targets = n.targets if isinstance(n, ast.Assign) else [n.target]
                for target in targets:
                    assignments.setdefault(ast.unparse(target), n.value)
            if isinstance(n, ast.Call):
                f = ast.unparse(n.func)
                if f.endswith('declare_parameter') and len(n.args) >= 2 and isinstance(n.args[0], ast.Constant):
                    defaults[n.args[0].value] = n.args[1]
                    evidence_lines.append(n.lineno)
                if f == 'dict':
                    defaults.update({k.arg: k.value for k in n.keywords if k.arg})
                if f == 'super().__init__' and n.args and isinstance(n.args[0], ast.Constant) and isinstance(n.args[0].value, str):
                    owners.append(n.args[0].value)
                    evidence_lines.append(n.lineno)
                if f == 'Node.__init__' and len(n.args) > 1 and isinstance(n.args[1], ast.Constant):
                    owners.append(n.args[1].value)
                    evidence_lines.append(n.lineno)
            if isinstance(n, ast.Dict):
                defaults.update({k.value: v for k, v in zip(n.keys, n.values) if isinstance(k, ast.Constant) and isinstance(k.value, str)})
            if isinstance(n, ast.For) and isinstance(n.iter, (ast.List, ast.Tuple)):
                if any(isinstance(c, ast.Call) and ast.unparse(c.func).endswith('declare_parameter') for c in ast.walk(n)):
                    for pair in n.iter.elts:
                        if isinstance(pair, (ast.List, ast.Tuple)) and len(pair.elts) == 2 and isinstance(pair.elts[0], ast.Constant):
                            defaults[pair.elts[0].value] = pair.elts[1]
                            evidence_lines.append(pair.lineno)
        owner = owners[0] if len(set(owners)) == 1 else path.name + ' (모듈)'
        module_context = context(str(path))
        if 'cleany_robot_interface' in path.parts:
            module_context = '실물'
        if path.parent.name == 'cleany_manipulation_bt' and path.name in {'node.py', 'ros_operations.py'}:
            module_context = '시뮬레이션'
        if path.parent.name == 'cleany_skill_executor' and path.name == 'manipulation_node.py':
            module_context = '시뮬레이션'
        if path.stem in {'validate_pick_node', 'manipulation_evidence_node', 'collection_pipeline', 'pregrasp_pipeline', 'runtime_readiness', 'arm_return_server', 'arm_return_client', 'arm_return_recovery', 'recovery_client', 'operator_ros', 'proposal_ros'}:
            module_context = '실물'
        src = source(path, evidence_lines)

        def resolve(n, seen=frozenset()):
            expr = ast.unparse(n)
            if expr in seen:
                return None
            seen = seen | {expr}
            if isinstance(n, ast.Constant) and isinstance(n.value, str):
                return n.value
            if isinstance(n, ast.Call):
                f = ast.unparse(n.func)
                if f in {'str'} or f.endswith('resolve_topic_name'):
                    return resolve(n.args[0], seen) if n.args else None
                if f.endswith('declare_parameter') and len(n.args) > 1:
                    return resolve(n.args[1], seen)
                if f.endswith('get_parameter') and n.args and isinstance(n.args[0], ast.Constant):
                    default = defaults.get(n.args[0].value)
                    return resolve(default, seen) if default else None
            if isinstance(n, ast.Attribute) and n.attr in {'value', 'string_value'}:
                return resolve(n.value, seen)
            if isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Constant):
                default = defaults.get(n.slice.value)
                return resolve(default, seen) if default else None
            if isinstance(n, ast.BinOp) and isinstance(n.op, ast.Add):
                a, b = resolve(n.left, seen), resolve(n.right, seen)
                return a + b if a is not None and b is not None else None
            if isinstance(n, ast.JoinedStr):
                return ''.join(v.value if isinstance(v, ast.Constant) else '{' + ast.unparse(v.value) + '}' for v in n.values)
            if expr in assignments:
                return resolve(assignments[expr], seen)
            return None

        for call in calls:
            method = ast.unparse(call.func).split('.')[-1]
            kind, role, pos = CALLS[method]
            if len(call.args) <= pos:
                raise ValueError(f'Unsupported keyword declaration {path}:{call.lineno}')
            expression = ast.unparse(call.args[pos])
            resolved = resolve(call.args[pos])
            message_expr = ast.unparse(call.args[pos - 1])
            message = imports.get(message_expr, message_expr)
            name = normalized(resolved, owner) if resolved else f'<{path.stem}:{expression}>'
            pattern = not resolved or any(x in name for x in '{}<>')
            environment = {'실물': 'real', '시뮬레이션': 'sim', '공통': 'shared'}[module_context]
            if name == '/head_pan/command':
                environment = 'sim'
            peer = dict(name=owner, context=module_context)
            condition = f'{path.name}:{call.lineno} 기본 선언. 조건부 생성, namespace와 remap은 실행 설정에 따릅니다.'
            if not resolved:
                condition += f' 이름은 실행 시 결정: {expression}.'
            add(kind, name, message, [peer] if role == 'producers' else [], [peer] if role == 'consumers' else [], condition, src, environment, 'dynamic' if pattern else 'application')
            declarations.append(dict(path=str(path.relative_to(root)), line=call.lineno, method=method, expression=expression, key=f'{kind}:{name}', resolution='pattern' if pattern else 'default'))

    for path in sorted((root / 'ros2_ws/src').rglob('*.cpp')):
        if 'test' in path.parts:
            continue
        content = path.read_text()
        literal_owners = set(re.findall(r'std::make_shared<rclcpp::Node>\(\s*"([\w]+)"', content))
        matches = list(re.finditer(r'create_(publisher|subscription|service|client)<([^>]+)>\(\s*([^,\n]+)', content))
        if not matches:
            continue
        src = source(path, [content.count('\n', 0, m.start()) + 1 for m in matches])
        for match in matches:
            method = 'create_' + match[1]
            kind, role, _ = CALLS[method]
            expr = match[3].strip()
            literal = re.fullmatch(r'"([^\"]+)"', expr)
            name = normalized(literal[1]) if literal else f'<{path.stem}:{expr}>'
            message = match[2].replace('::', '/')
            if message == 'BatchValidity':
                message = 'cleany_interfaces/srv/CheckStateValidityBatch'
            env = 'sim' if 'cleany_mujoco_observer' in path.parts else 'shared'
            peer = dict(name=next(iter(literal_owners)) if len(literal_owners) == 1 else path.name + ' (플러그인)',
                        context='시뮬레이션' if env == 'sim' else '공통')
            line = content.count('\n', 0, match.start()) + 1
            condition = f'{path.name}:{line}; ' + ('소스의 literal 노드명 기준. 실행 시 remap 가능.' if len(literal_owners) == 1 else '플러그인의 실제 노드명과 이름은 호스트 설정에 따릅니다.')
            add(kind, name, message, [peer] if role == 'producers' else [], [peer] if role == 'consumers' else [], condition, src, env, 'application' if literal else 'dynamic')
            declarations.append(dict(path=str(path.relative_to(root)), line=line, method=method, expression=expr, key=f'{kind}:{name}', resolution='default' if literal else 'pattern'))

    mock_launch = root / 'ros2_ws/src/cleany_skill_executor/launch/manipulation_mock.launch.py'
    mock_source = source(mock_launch)
    for record in list(records):
        if record['name'].startswith('/manipulation/') and any(n['name'] == 'manipulation_server' for n in record['producers'] + record['consumers']):
            clone = dict(record, name='/mock' + record['name'], environment='sim', sources=record['sources'] + [mock_source], condition=record['condition'] + ' manipulation_mock.launch.py 기본 namespace=mock.')
            records.append(clone)

    # Both BT backends invoke the base wrapper's shared cancellation helper.
    for filename, owner, env in [('jetson_node.py', 'manipulation_jetson_server', 'real'), ('node.py', 'manipulation_mujoco_server', 'sim')]:
        caller = root / 'ros2_ws/src/cleany_manipulation_bt/cleany_manipulation_bt' / filename
        caller_lines = [i for i, line in enumerate(caller.read_text().splitlines(), 1) if 'self._setup_cancel_service(' in line]
        if not caller_lines:
            raise ValueError(f'Cancellation helper no longer called by {caller}')
        caller_source = source(caller)
        for record in list(records):
            if record['name'] not in {'/manipulation/cancel', '/manipulation/execute_skill/_action/cancel_goal'}:
                continue
            if not any(n['name'] == 'manipulation_server' for n in record['producers'] + record['consumers']):
                continue
            replace = lambda ns: [dict(n, name=owner, context='실물' if env == 'real' else '시뮬레이션') for n in ns]
            records.append(dict(record, environment=env, producers=replace(record['producers']), consumers=replace(record['consumers']), sources=record['sources'] + [caller_source], condition=f'{filename}:{caller_lines[0]}에서 상속한 _setup_cancel_service 호출.'))

    # Resolve only reviewed finite cases. Keep the original dynamic declarations.
    def reviewed_source(relative, *anchors):
        path = root / relative
        content = path.read_text()
        for anchor in anchors:
            if anchor not in content:
                raise ValueError(f'Reviewed relation changed: {relative}: {anchor}')
        return source(path)

    skill = 'ros2_ws/src/cleany_skill_executor/cleany_skill_executor/'
    bt = 'ros2_ws/src/cleany_manipulation_bt/cleany_manipulation_bt/'
    perception = 'ros2_ws/src/cleany_perception/cleany_perception/'
    cli_src = reviewed_source(skill + 'manipulation_client.py', "Node('manipulation_test_client')",
        "parser.add_argument('--namespace', default='/mock')", "prefix = options.namespace.rstrip('/')",
        "prefix + '/manipulation/execute_skill'", "prefix + '/manipulation/get_execution'", "prefix + '/manipulation/cancel'")
    for prefix, env, ctx, condition in [('/mock', 'sim', '시뮬레이션', 'CLI 기본 --namespace /mock'),
                                       ('', 'shared', '공통', 'CLI --namespace / 지정 시; 선택한 root backend에 연결')]:
        for kind, suffix, message in [('action', 'execute_skill', 'action/ExecuteManipulationSkill'),
                                      ('service', 'get_execution', 'srv/GetManipulationExecution'),
                                      ('service', 'cancel', 'srv/CancelManipulation')]:
            add(kind, prefix + '/manipulation/' + suffix, 'cleany_interfaces/' + message, [],
                [dict(name='manipulation_test_client', context=ctx)], condition, cli_src, env)
    return_src = reviewed_source(bt + 'arm_return_client.py', "rclpy.create_node('arm_return_client')",
        "parser.add_argument('--namespace', default='/')", "options.namespace.rstrip('/') + '/manipulation/return_arm'")
    add('action', '/manipulation/return_arm', 'cleany_interfaces/action/ReturnArm', [],
        [dict(name='arm_return_client', context='실물')], 'CLI 기본 --namespace /; 변경된 namespace는 원본 동적 선언 참조.', return_src, 'real')
    wrist_src = reviewed_source(skill + 'wrist_camera_control.py', "for arm in ('left', 'right')",
        "f'/{arm}_wrist_camera/set_enabled'", 'SetBool.Request(data=enabled)')
    pipeline_src = reviewed_source(skill + 'pregrasp_pipeline.py', 'WristCameraSession(self,',
        'if mode == \'hardware\':', "super().__init__('pregrasp_pipeline', **kwargs)", 'self.wrist_cameras.activate(arm)', 'self.wrist_cameras.close()')
    jetson_ops_src = reviewed_source(bt + 'jetson_operations.py', 'self.start_wrist_camera(arm)',
        'self.confirm_wrist_target(', 'class JetsonOperations(')
    for side in ('left', 'right'):
        add('service', f'/{side}_wrist_camera/set_enabled', 'std_srvs/srv/SetBool', [],
            [dict(name='pregrasp_pipeline', context='실물')],
            'hardware 모드의 WristCameraSession; 선택 팔 활성화, 반대 팔 비활성화 및 종료 정리. 좌우 반복값을 정적으로 펼침.', wrist_src, 'real')
        records[-1]['sources'] += [pipeline_src, jetson_ops_src]

    # Source anchors cover the call sites as well as the endpoint declarations.
    relation_sources = {
        'cli': cli_src, 'return-cli': return_src, 'wrist-control': wrist_src,
        'pipeline': pipeline_src, 'jetson-operations': jetson_ops_src,
        'jetson': reviewed_source(bt + 'jetson_node.py', 'self._setup_cancel_service(', 'self._events.publish(', 'self._bt_events.publish(', 'ArmReturnServer(self,'),
        'mock': reviewed_source(skill + 'manipulation_node.py', 'self._cancel_client.call_async(', 'self.core.get(request.execution_id)', 'self._events.publish('),
        'mujoco': reviewed_source(bt + 'node.py', 'self._setup_cancel_service(', 'self._bt_events.publish('),
        'validate': reviewed_source(skill + 'validate_pick_node.py', 'self._inspection,', 'self._run_grasp_service(', 'self._selection,', 'self._validation_debug.publish('),
        'inspection': reviewed_source(perception + 'inspection_node.py', 'self._detections_publisher.publish(', 'self._objects_publisher.publish('),
        'wrist-observe': reviewed_source(perception + 'wrist_service.py', 'ObserveWristTarget', 'create_subscription'),
        'wrist-driver': reviewed_source('ros2_ws/src/cleany_robot_interface/cleany_robot_interface/wrist_rgb_camera.py', 'def set_enabled(', 'self.images.publish(', 'self.enabled_state.publish('),
        'base': reviewed_source('ros2_ws/src/cleany_base_driver/cleany_base_driver/driver_node.py', 'def on_enable(', 'self.pending_enable', 'self.joints.publish('),
    }
    collection_src = reviewed_source(skill + 'collection_pipeline.py', 'class CollectionPipeline(PregraspPipeline)', "super().__init__(mode='hardware', **kwargs)")
    for record in records:
        if record['name'].endswith('_wrist_camera/set_enabled') and any(n['name'] == 'pregrasp_pipeline' for n in record['consumers']):
            record['sources'].append(collection_src)
        if record['name'] == '/manipulation/return_arm' and any(n['name'] == 'arm_return_server.py (모듈)' for n in record['producers']):
            record['producers'] = [dict(name='manipulation_jetson_server', context='실물')]
            record['sources'].append(relation_sources['jetson'])
            record['condition'] += ' Jetson wrapper의 ArmReturnServer(self, ...)에서 호스트 노드 확인.'

    robot = 'ros2_ws/src/cleany_robot_interface/cleany_robot_interface/'
    guard_src = reviewed_source(robot + 'control_state_guard.py',
        "CONTROLLERS = [f'{side}_{part}_controller' for side in ('left', 'right') for part in ('arm', 'gripper')]",
        'set(self.controllers) <= set(CONTROLLERS)',
        "CancelGoal, f'/{name}/follow_joint_trajectory/_action/cancel_goal'",
        'client.call_async(CancelGoal.Request())')
    for side in ('left', 'right'):
        for group in ('arm', 'gripper'):
            add('service', f'/{side}_{group}_controller/follow_joint_trajectory/_action/cancel_goal',
                'action_msgs/srv/CancelGoal', [], [dict(name='real_control_state_guard', context='실물')],
                '기본 controller_names의 취소 client. 설정한 제어기 부분집합에만 생성되며 fault 발생 시 모든 활성 목표의 취소를 요청합니다.', guard_src, 'real')

    # The helper owns no ROS node: its host creates these endpoints conditionally.
    reviewed_source(perception + 'inspection_node.py', "super().__init__('perception_inspector', **kwargs)",
        "if bool(self.get_parameter('enable_wrist_observation').value):", 'self._wrist_service = WristService(',
        'self, SerializedInference(wrist_yoloe, self._inference_lock)')
    for record in records:
        if relation_sources['wrist-observe'] not in record['sources']:
            continue
        for role in ('producers', 'consumers'):
            record[role] = [dict(peer, name='perception_inspector')
                            if peer['name'] == 'wrist_service.py (모듈)' else peer for peer in record[role]]
        record['sources'].append(relation_sources['inspection'])
        record['condition'] += ' perception_inspector의 enable_wrist_observation=true일 때 생성.'
    for side in ('left', 'right'):
        for suffix, message in [('image_raw', 'Image'), ('camera_info', 'CameraInfo')]:
            add('topic', f'/{side}_wrist_camera/{suffix}', 'sensor_msgs/msg/' + message,
                [], [dict(name='perception_inspector', context='공통')],
                'enable_wrist_observation=true인 WristService의 좌우 구독. USB 드라이버 또는 시뮬레이션의 같은 계약을 사용합니다.',
                relation_sources['wrist-observe'])
            records[-1]['sources'].append(relation_sources['inspection'])

    runtime_src = reviewed_source('tools/collection-runtime',
        '-r __node:=left_wrist_rgb_camera', '-r __node:=right_wrist_rgb_camera',
        'ros2 run cleany_robot_interface wrist_rgb_camera')
    relation_sources['collection-runtime'] = runtime_src

    # Preserve the old index observation, but reconcile its stale default to code.
    depth_src = reviewed_source(perception + 'depth_scene_node.py',
        "'depth_image_topic': '/camera/depth/image_raw'", "Image, str(self.get_parameter('depth_image_topic').value)")
    reconciliations = []
    for record in records:
        if record['name'] == '/camera/depth/image_rect_raw' and record['sources'] == [index_source]:
            old = record['name']
            record['name'] = '/camera/depth/image_raw'
            record['sources'].append(depth_src)
            record['condition'] = f'색인의 과거 기본 이름 {old}를 depth_scene_node.py의 현재 depth_image_topic 기본값으로 정정. 이름은 parameter로 변경 가능.'
            reconciliations.append(dict(fromKey='topic:' + old, toKey='topic:' + record['name'], sources=record['sources']))

    learned_path = root / 'ros2_ws/src/cleany_perception/launch/learned_rgbd.launch.py'
    learned_src = reviewed_source(str(learned_path.relative_to(root)), "executable='inspection_node'",
        "'depth_image_topic',", "default_value='/camera/aligned_depth_to_color/image_raw'")
    launch_defaults = {}
    for call in ast.walk(ast.parse(learned_path.read_text())):
        if isinstance(call, ast.Call) and ast.unparse(call.func) == 'DeclareLaunchArgument' and call.args:
            default = next((k.value for k in call.keywords if k.arg == 'default_value'), None)
            launch_defaults[call.args[0].value] = default
    def launch_default(key):
        value = launch_defaults[key]
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            return value.value
        if isinstance(value, ast.Call) and ast.unparse(value.func) == 'LaunchConfiguration':
            return launch_default(value.args[0].value)
        raise ValueError(f'Unsupported reviewed launch default: {key}')
    for key, message in [('color_image_topic', 'Image'), ('color_info_topic', 'CameraInfo'),
                         ('depth_image_topic', 'Image'), ('depth_info_topic', 'CameraInfo')]:
        add('topic', launch_default(key), 'sensor_msgs/msg/' + message, [],
            [dict(name='perception_inspector', context='공통')],
            f'learned_rgbd.launch.py의 {key} 기본값. 실물 RealSense launch의 remap과 별도 구성이며 실행 인자로 변경 가능.', learned_src)

    arms = ['left-arm', 'right-arm']
    articulated = arms + ['head-pan', 'head-tilt']
    wheels = ['wheels', 'motors']
    all_joints = articulated + wheels
    joint_state_roles = {}
    def joint_role(names, parts, relative, *anchors):
        src = reviewed_source(relative, *anchors)
        for name in names:
            joint_state_roles[name] = dict(parts=parts, sources=[src])
    joint_role(['cleany_base_driver'], wheels, 'ros2_ws/src/cleany_base_driver/cleany_base_driver/driver_node.py', "out.name = ['front_left_wheel_joint'")
    joint_role(['wheel_odometry'], wheels, 'ros2_ws/src/cleany_base_odometry/cleany_base_odometry/wheel_odom_node.py', "'front_left_wheel_joint'")
    joint_role(['simulated_encoder'], wheels, 'ros2_ws/src/cleany_gazebo_sim/cleany_gazebo_sim/simulated_encoder_node.py', "'front_left_wheel_joint'")
    joint_role(['real_control_state_guard'], articulated, robot + 'control_state_guard.py', "len(message.name) == len(message.position) == 14")
    joint_role(['arm_state_reader'], arms, robot + 'reader.py', 'self.joints = mappings(config, calibrations)')
    joint_role(['read_only_robot_state'], articulated, robot + 'robot_state_reader.py', "['head_pan_joint', 'head_tilt_joint']")
    joint_role(['mujoco_sim'], all_joints, 'ros2_ws/src/cleany_mujoco_sim/cleany_mujoco_sim/sim_node.py', 'joint_state_msg(self._model, self._data, stamp)')
    joint_role(['gazebo_feedback_sampler', 'ros_gz_bridge'], all_joints, 'ros2_ws/src/cleany_gazebo_sim/cleany_gazebo_sim/feedback_sampler.py', "'/gazebo/raw_joint_states'")
    for name, path in [('pan_motion_gate', 'pan_motion_gate_node.py'), ('reactive_guard', 'reactive_guard_node.py')]:
        joint_role([name], ['head-pan'], 'ros2_ws/src/cleany_navigation/cleany_navigation/' + path, "pan_joint='head_pan_joint'")
    joint_role(['gazebo_pan_tf_publisher'], ['head-pan'], 'ros2_ws/src/cleany_gazebo_sim/cleany_gazebo_sim/pan_tf_publisher.py', "msg.name.index('head_pan_joint')")
    for name, path in [('grasp_selection_server', 'grasp_selection_node.py'), ('nearest_pregrasp_coordinator', 'nearest_pregrasp_coordinator.py'),
                       ('sorting_coordinator', 'sorting_coordinator.py'), ('grasp_execution.py (모듈)', 'grasp_execution.py'), ('pregrasp_pipeline', 'pregrasp_pipeline.py')]:
        joint_role([name], articulated, skill + path)
    handeye = 'ros2_ws/src/cleany_handeye_calibration/cleany_handeye_calibration/'
    joint_role(['single_pose_handeye_orchestrator', 'multi_pose_handeye_orchestrator', 'single_pose_runtime.py (모듈)'], articulated,
        handeye + 'single_pose_runtime.py', 'DEFAULT_DUAL_ARM_JOINT_CONTRACT.required_joint_names')
    joint_role(['pregrasp_sim_inputs_ready'], all_joints, skill + 'pregrasp_sim_ready.py', 'def on_joints(')
    joint_role(['robot_state_publisher', 'real_robot_state_publisher'], all_joints,
        'ros2_ws/src/cleany_robot_interface/launch/real_control.launch.py', "package='robot_state_publisher'")

    probe_config = root / 'ros2_ws/src/cleany_dev_monitor/config/manipulation_io_probe.json'
    probe_source = source(probe_config)
    joint_state_roles['manipulation_io_probe'] = dict(parts=all_joints, sources=[probe_source])
    probe = json.loads(probe_config.read_text())
    streams = probe['streams'] + [dict(topic=probe['execution_topic'], type='cleany_interfaces/msg/ManipulationExecutionRecord'), dict(topic=probe['bt_topic'], type='std_msgs/msg/String')]
    for stream in streams:
        add('topic', stream['topic'], stream['type'], [], [dict(name='manipulation_io_probe', context='공통')], 'manipulation_io_probe.json 기본 수동 관측 설정.', probe_source)

    # The real-camera launch exposes raw depth separately from aligned depth.
    camera_launch = root / 'ros2_ws/src/cleany_perception/launch/realsense.launch.py'
    camera_source = source(camera_launch)
    for call in ast.walk(ast.parse(camera_launch.read_text())):
        if isinstance(call, ast.Tuple) and len(call.elts) == 2 and all(isinstance(v, ast.Constant) and isinstance(v.value, str) for v in call.elts):
            old, new = [v.value for v in call.elts]
            if new.startswith('/camera/'):
                message = 'sensor_msgs/msg/CameraInfo' if 'camera_info' in old else 'sensor_msgs/msg/Image'
                add('topic', new, message, [dict(name='camera', context='실물')], [], f'realsense.launch.py remap: {old} → {new}', camera_source, 'real')

    # Display contracts use a configurable subscription loop, not literal calls.
    display = root / 'ros2_ws/src/cleany_display/docs/interfaces.md'
    display_source = source(display)
    for line in display.read_text().splitlines():
        if line.startswith('| `/'):
            cells = [clean(c) for c in line.strip('|').split('|')]
            add('topic', cells[0], cells[1], [], [dict(name='cleany_display', context='공통')], cells[3], display_source)

    # Generic middleware patterns are not counted as instantiated node endpoints.
    for suffix, message in [('describe_parameters', 'DescribeParameters'), ('get_parameter_types', 'GetParameterTypes'), ('get_parameters', 'GetParameters'), ('list_parameters', 'ListParameters'), ('set_parameters', 'SetParameters'), ('set_parameters_atomically', 'SetParametersAtomically')]:
        add('service', f'<node>/{suffix}', f'rcl_interfaces/srv/{message}', [], [], '노드 옵션에 따라 자동 생성. ESP32 rclc 노드에는 동일하게 적용하지 않습니다.', index_source, scope='automatic')
    add('topic', '/parameter_events', 'rcl_interfaces/msg/ParameterEvent', [], [], '파라미터 이벤트가 활성화된 노드.', index_source, scope='automatic')
    for kind, suffix, message in [('service', 'send_goal', '<Action>_SendGoal'), ('service', 'get_result', '<Action>_GetResult'), ('service', 'cancel_goal', 'action_msgs/srv/CancelGoal'), ('topic', 'feedback', '<Action>_FeedbackMessage'), ('topic', 'status', 'action_msgs/msg/GoalStatusArray')]:
        add(kind, f'<action>/_action/{suffix}', message, [], [], '실행 중인 액션 이름에 따라 자동 생성되는 전송 인터페이스.', index_source, scope='automatic')

    for record in records:
        if record['name'] == '/joint_states':
            for peer in record['producers'] + record['consumers']:
                if peer['name'] not in joint_state_roles:
                    raise ValueError(f'Unreviewed joint-state role: {peer["name"]}')

    output = dict(reviewedAt=args.date, commit=evidence['commit'], basis='working-tree', indexKeys=index_keys,
                  reconciliations=reconciliations, jointStateRoles=joint_state_roles,
                  declarations=declarations, records=records, relationSources=relation_sources)
    (project / 'src/data/ros-catalog.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(index_keys)} index entries; {len(declarations)} Python/C++ declarations; {sum(d["resolution"] == "pattern" for d in declarations)} dynamic declarations; {len(records)} sourced records.')


if __name__ == '__main__':
    main()
