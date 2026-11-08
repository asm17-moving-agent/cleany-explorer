import type { PartId } from './catalog.ts';
import type { RosEndpoint, RosNode } from './ros.ts';
import inventory from './data/ros-catalog.json' with {type:'json'};

type ReviewedEndpoint = Omit<RosEndpoint, 'domains' | 'routes' | 'scope'>;
const node = (name: string, context: RosNode['context'] = '공통'): RosNode => ({ name, context });
const baseParts: PartId[] = ['wheels', 'motors', 'drivers', 'computer'];
const articulatedParts: PartId[] = ['left-arm', 'right-arm', 'head-pan', 'head-tilt', 'computer'];
const sensorQos = 'Best effort · Volatile · Keep last 5 (SensorData)';
const reliableQos = 'Reliable · Volatile · Keep last 10';
const wheelQos = 'Best effort · Volatile · Keep last 1';

export const partRosNotes: Record<PartId, string> = {
  'head-camera': 'RGB-D 영상과 카메라 보정값을 인식 노드에 전달합니다.',
  'head-pan': 'head_pan_joint의 위치는 양팔·헤드 공용 JointState에 포함됩니다. 실물 control profile은 헤드 상태 읽기만 제공하며 별도 Pan 명령 토픽은 없습니다.',
  'head-tilt': 'head_tilt_joint의 위치는 양팔·헤드 공용 JointState에 포함됩니다. 실물 control profile은 헤드 상태 읽기만 제공하며 별도 Tilt 명령 토픽은 없습니다.',
  'left-arm': '왼팔과 그리퍼의 제어기, 관절 피드백을 표시합니다. 서보는 ros2_control 하드웨어 플러그인을 통해 연결됩니다.',
  'right-arm': '오른팔과 그리퍼의 제어기, 관절 피드백을 표시합니다. 서보는 ros2_control 하드웨어 플러그인을 통해 연결됩니다.',
  'wrist-camera': '실물 collection-runtime의 좌우 USB 노드와 시뮬레이션 카메라 경로를 구분합니다. 클래스 기본 노드명은 wrist_rgb_camera이며 실행 시 바꿀 수 있습니다.',
  frame: '프레임 자체에는 ROS 노드가 없습니다. 조립 구조와 관절 위치로 좌표계를 만드는 robot_state_publisher의 연결을 표시합니다.',
  wheels: '휠 자체의 토픽 대신 베이스 명령, 엔코더 피드백과 오도메트리 경로를 표시합니다. joint_states는 휠 관절만 포함하는 발행 경로입니다.',
  motors: '모터 명령과 엔코더 값은 ESP32의 cleany_motor_controller를 경유합니다. 개별 모터마다 ROS 노드가 있는 구성은 아닙니다.',
  computer: 'Jetson에서 실행하도록 구성된 주요 처리 노드의 연결을 모았습니다. 전체 ROS 그래프나 현재 실행 중인 프로세스 목록은 아닙니다.',
  lidar: '실물 평가 도구는 rplidar_ros를 사용하며 노드명은 설정에서 지정합니다. 시뮬레이터의 scan 발행자는 별도 실행 경로입니다.',
  drivers: 'MDD20A 보드에는 직접 ROS 토픽이 없습니다. ESP32가 ROS 명령을 받아 PWM/DIR 신호로 구동하는 경계를 표시합니다.',
  display: 'cleany_display가 미션, 조작, 이동, 배터리와 표정 상태를 구독해 전면 화면을 갱신합니다.',
  case: '포맥스 케이스는 기구 부품이며 연결된 ROS 인터페이스가 없습니다.',
  battery: '디스플레이가 /battery_state를 구독합니다. 배터리 상태의 발행자는 현재 소스 목록에서 미확인입니다.',
  imu: 'ESP32가 /base/imu_state를 발행하고 cleany_imu가 관성 센서 데이터를 변환합니다.',
};

export const reviewedEndpoints: ReviewedEndpoint[] = [
  ...(['color', 'depth'] as const).flatMap(stream => (['image_raw', 'camera_info'] as const).map((suffix): ReviewedEndpoint => ({
    id: `head-${stream}-${suffix}`, parts: ['head-camera', 'computer'], kind: 'topic',
    name: `/camera/${stream}/${suffix}`, type: `sensor_msgs/msg/${suffix === 'image_raw' ? 'Image' : 'CameraInfo'}`,
    description: `${stream === 'color' ? '컬러' : '컬러에 정렬한 깊이'} ${suffix === 'image_raw' ? '영상' : '카메라 내부 파라미터'}`,
    producers: [node('camera', '실물')], consumers: [node('perception_inspector')],
    condition: 'realsense.launch.py 기준. 원본 depth는 /camera/raw_depth/*로 분리합니다. 카메라 드라이버와 인식 노드는 별도 실행합니다.',
    qos: `구독 기본값: ${sensorQos}. rgbd_qos_reliability로 변경 가능; 발행 QoS는 드라이버 설정에 따름.`,
    sources: ['realsense', 'perception'],
  }))),
  ...(['left', 'right'] as const).flatMap(side => {
    const part: PartId = `${side}-arm`;
    const label = side === 'left' ? '왼쪽' : '오른쪽';
    return [
      ...(['arm', 'gripper'] as const).map((group): ReviewedEndpoint => ({
        id: `${side}-${group}-trajectory`, parts: [part, 'computer'], kind: 'action',
        name: `/${side}_${group}_controller/follow_joint_trajectory`, type: 'control_msgs/action/FollowJointTrajectory',
        description: `${label} ${group === 'arm' ? '팔 5관절' : '그리퍼'}의 궤적 실행`,
        producers: [node(`${side}_${group}_controller`)], consumers: [node('move_group')],
        condition: '실물 control_profile.py의 MoveIt 연결 기준. read_only 기본값에서는 제어기가 비활성입니다. 웹에서는 호출하지 않습니다.',
        sources: ['control', 'real-launch'],
      })),
      { id: `${side}-controller-state`, parts: [part, 'computer'], kind: 'topic',
        name: `/${side}_arm_controller/controller_state`, type: 'control_msgs/msg/JointTrajectoryControllerState',
        description: `${label} 팔 제어기의 목표와 현재 관절 상태`,
        producers: [node(`${side}_arm_controller`)], consumers: [node('nearest_pregrasp_coordinator'), node('sorting_coordinator')],
        condition: '소스 색인의 controller 연결입니다. coordinator와 backend는 실행 구성에 따라 선택합니다.', sources: ['index'],
      } satisfies ReviewedEndpoint,
    ];
  }),
  { id: 'arm-raw-joints', parts: articulatedParts, kind: 'topic', name: '/joint_state_broadcaster/joint_states', type: 'sensor_msgs/msg/JointState',
    description: '양팔과 헤드의 원본 관절 위치', producers: [node('joint_state_broadcaster', '실물')], consumers: [node('real_control_state_guard', '실물')],
    condition: '실물 control profile의 use_local_topics=true 기준. guard가 완전성, 유효값과 신선도를 검사합니다.', qos: `guard 구독: ${reliableQos}`, sources: ['guard', 'control'] },
  { id: 'arm-joints', parts: [...articulatedParts, 'frame'], kind: 'topic', name: '/joint_states', type: 'sensor_msgs/msg/JointState',
    description: '검사를 통과한 양팔·헤드 관절 위치', producers: [node('real_control_state_guard', '실물')], consumers: [node('real_robot_state_publisher', '실물')],
    condition: 'real_control.launch.py 경로. 상태 조회 전용 reader는 대체 경로이며 동일 시리얼 장치를 동시에 열지 않습니다.', qos: reliableQos, sources: ['guard', 'real-launch', 'robot'] },
  { id: 'control-status', parts: articulatedParts, kind: 'topic', name: '/real_control/status', type: 'std_msgs/msg/String',
    description: '제어 상태 waiting / ready / fault', producers: [node('real_control_state_guard', '실물')], consumers: [],
    condition: '20 Hz 상태 판정. 이 탐색기에서는 실행 상태를 수신하지 않습니다.', qos: 'Reliable · Transient local · Keep last 1', sources: ['guard', 'robot'] },
  ...(['left', 'right'] as const).flatMap(side => {
    const cameraNode = node(`${side}_wrist_rgb_camera`, '실물');
    const label = side === 'left' ? '왼쪽' : '오른쪽';
    return [
      ...(['image_raw', 'camera_info', 'preview/compressed', 'enabled'] as const).map((suffix, i): ReviewedEndpoint => ({
        id: `${side}-wrist-${suffix.replace('/', '-')}`, parts: ['wrist-camera', 'computer'], kind: 'topic',
        name: `/${side}_wrist_camera/${suffix}`, type: ['sensor_msgs/msg/Image', 'sensor_msgs/msg/CameraInfo', 'sensor_msgs/msg/CompressedImage', 'std_msgs/msg/Bool'][i],
        description: `${label} 손목 ${['영상', '카메라 내부 파라미터', 'JPEG 미리보기', '카메라 활성화 상태'][i]}`,
        producers: [cameraNode], consumers: i < 2 ? [node('perception_inspector')] : [],
        condition: 'collection-runtime의 좌우 실행 노드명 기준. 클래스 기본명은 wrist_rgb_camera입니다. ' + (i < 2 ? '카메라 활성화 시 발행. perception_inspector의 손목 구독은 enable_wrist_observation=true일 때 생성합니다.' : suffix === 'enabled' ? '캡처 장치 소유 여부를 1 Hz로 발행하며 유효 영상 수신을 보장하지 않습니다. start_enabled 기본값은 false입니다.' : '카메라 활성화 시 모니터링용 압축 영상을 발행합니다.'),
        qos: suffix === 'enabled' ? 'Reliable · Transient local · Keep last 1' : sensorQos, sources: ['wrist', 'perception', inventory.relationSources['collection-runtime']],
      })),
      { id: `${side}-wrist-enable`, parts: ['wrist-camera', 'computer'], kind: 'service', name: `/${side}_wrist_camera/set_enabled`, type: 'std_srvs/srv/SetBool',
        description: `${label} 손목 카메라 활성화 요청`, producers: [cameraNode], consumers: [],
        condition: 'collection-runtime에서 좌우 노드명을 지정합니다. 클래스 기본명은 wrist_rgb_camera입니다. 웹페이지는 서비스를 호출하지 않습니다.', sources: ['wrist', inventory.relationSources['collection-runtime']],
      } satisfies ReviewedEndpoint,
    ];
  }),
  { id: 'cmd-vel', parts: baseParts, kind: 'topic', name: '/cmd_vel', type: 'geometry_msgs/msg/Twist',
    description: '베이스의 평면 이동 속도 명령', producers: [node('reactive_guard'), node('voxel_guard')], consumers: [node('cleany_base_driver')],
    condition: '표시한 발행자는 실행 profile에 따른 대안입니다. 베이스의 최종 명령원은 하나로 유지합니다.', qos: `base driver 구독: ${reliableQos}`, sources: ['base', 'index'] },
  { id: 'wheel-command', parts: baseParts, kind: 'topic', name: '/base/wheel_command', type: 'cleany_base_interfaces/msg/WheelCommand',
    description: '네 휠의 속도와 ENABLE / STOP 명령', producers: [node('cleany_base_driver')], consumers: [node('cleany_motor_controller', '실물')],
    condition: 'ROS → ESP32 micro-ROS 경계, 기본 50 Hz. mock_base_mcu는 실물 MCU를 대체하는 시험 경로입니다.', qos: wheelQos, sources: ['base', 'mcu'] },
  { id: 'wheel-state', parts: baseParts, kind: 'topic', name: '/base/wheel_state', type: 'cleany_base_interfaces/msg/WheelState',
    description: '엔코더 피드백과 명령 확인 상태', producers: [node('cleany_motor_controller', '실물')], consumers: [node('cleany_base_driver')],
    condition: 'ESP32 → ROS 피드백, 기본 50 Hz. 네 바퀴의 상태를 한 메시지로 전달합니다.', qos: wheelQos, sources: ['base', 'mcu'] },
  { id: 'wheel-joints', parts: ['wheels', 'motors', 'computer'], kind: 'topic', name: '/joint_states', type: 'sensor_msgs/msg/JointState',
    description: '휠 엔코더를 관절 위치와 속도로 변환', producers: [node('cleany_base_driver')], consumers: [node('wheel_odometry')],
    condition: '새 wheel feedback 수신 시 발행합니다. 양팔 관절 상태와 같은 토픽 이름을 쓰지만 포함되는 관절이 다릅니다.', qos: `발행: ${reliableQos} / 구독: ${sensorQos}`, sources: ['base', 'odom'] },
  { id: 'wheel-odom', parts: ['wheels', 'motors', 'computer'], kind: 'topic', name: '/wheel/odom', type: 'nav_msgs/msg/Odometry',
    description: '메카넘 휠 기반 오도메트리', producers: [node('wheel_odometry')], consumers: [node('base_odom_relay')],
    condition: '유효한 관측 구간이 준비된 뒤 발행합니다. wheel_odometry 자체는 TF를 발행하지 않습니다.', qos: reliableQos, sources: ['odom', 'base'] },
  { id: 'odom', parts: ['wheels', 'computer'], kind: 'topic', name: '/odom', type: 'nav_msgs/msg/Odometry',
    description: '베이스 위치와 이동 속도', producers: [node('base_odom_relay')], consumers: [node('mission_runtime'), node('reactive_guard')],
    condition: '기본 relay 경로입니다. 다른 estimator나 simulator와 canonical odom/TF 발행자를 중복 실행하지 않습니다.', qos: reliableQos, sources: ['base', 'index'] },
  { id: 'base-enable', parts: baseParts, kind: 'service', name: '/base/enable', type: 'std_srvs/srv/SetBool',
    description: '베이스 구동 허가 또는 정지 요청', producers: [node('cleany_base_driver')], consumers: [],
    condition: '서비스는 ROS base driver가 제공합니다. MCU에 같은 서비스가 있는 것은 아닙니다. 웹에서는 호출하지 않습니다.', sources: ['base', 'mcu'] },
  { id: 'scan-real', parts: ['lidar', 'computer'], kind: 'topic', name: '/scan', type: 'sensor_msgs/msg/LaserScan',
    description: '실물 2D 라이다의 수평 거리 스캔', producers: [node('rplidar_node (실행 파일)', '외부 드라이버')], consumers: [node('reactive_guard'), node('obstacle_memory')],
    condition: '실물 평가 도구는 rplidar_ros/rplidar_node를 실행하며 실제 노드명은 lidar.node_name 설정값입니다. 발행 QoS는 외부 드라이버에서 확인합니다.', sources: ['lidar', 'lidar-guide', 'index'] },
  { id: 'scan-sim', parts: ['lidar'], kind: 'topic', name: '/scan', type: 'sensor_msgs/msg/LaserScan',
    description: '시뮬레이션 2D 스캔 대체 경로', producers: [node('mujoco_sim', '시뮬레이션')], consumers: [node('reactive_guard'), node('obstacle_memory')],
    condition: 'MuJoCo custom backend의 scan_enabled=true일 때, scan_rate_hz 기본 5.5 Hz. 실물 센서의 측정값이 아닙니다.', qos: `발행: ${reliableQos}`, sources: ['sim', 'index'] },
  ...(['tf', 'tf_static'] as const).map((name): ReviewedEndpoint => ({
    id: name, parts: ['frame', 'computer'], kind: 'topic', name: `/${name}`, type: 'tf2_msgs/msg/TFMessage',
    description: name === 'tf' ? '움직이는 관절의 좌표 변환' : '고정된 링크 사이의 좌표 변환',
    producers: [node('robot_state_publisher')], consumers: [node('grasp_server'), node('mission_runtime')],
    condition: '프레임 부품 자체가 발행하는 정보가 아닙니다. URDF와 관절 상태를 사용하며 실물 launch의 노드명은 real_robot_state_publisher입니다.', qos: 'TF 기본 QoS', sources: ['index', 'real-launch'],
  })),
  { id: 'perception-objects', parts: ['computer'], kind: 'topic', name: '/perception/objects', type: 'cleany_interfaces/msg/DetectedObject3DArray',
    description: '관측된 물체의 3D 위치와 속성', producers: [node('perception_inspector')], consumers: [],
    condition: '관측 성공 시 snapshot 결과를 발행합니다. 전체 시스템의 동적 구독 목록은 포함하지 않습니다.', sources: ['perception', 'index'] },
];
