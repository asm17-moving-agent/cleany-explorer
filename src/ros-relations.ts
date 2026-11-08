import inventory from './data/ros-catalog.json' with {type:'json'};
import { filterEndpoints, inEnvironment, projectRoutes, type Environment, type RosEndpoint, type EndpointKind, type RosNode } from './ros.ts';

export type FlowId = 'manipulation' | 'validation' | 'wrist' | 'base' | 'action';
export interface FlowProfile { id: string; label: string; environment: 'real' | 'sim'; prefix: string }
export interface FlowNode { id: string; label: string; endpoint: RosEndpoint; column: number; row: number; derived?: boolean }
export interface FlowEdge { from: string; to: string; label: string; condition: string; sources: string[]; conditional?: boolean; reference?: boolean }
export interface ExecutionFlow { id: FlowId; title: string; note: string; nodes: FlowNode[]; edges: FlowEdge[]; profile: FlowProfile }
const sources = inventory.relationSources;
const real: FlowProfile = {id:'real', label:'Jetson · 실물', environment:'real', prefix:''};
const mujoco: FlowProfile = {id:'mujoco', label:'MuJoCo · root', environment:'sim', prefix:''};
const mock: FlowProfile = {id:'mock', label:'Mock · /mock', environment:'sim', prefix:'/mock'};
export const flowLabels: Record<FlowId, string> = {manipulation:'조작 실행', validation:'집기 검증', wrist:'손목 카메라', base:'베이스 이동', action:'액션 내부'};
export function flowProfiles(id: FlowId, environment: Environment): FlowProfile[] {
  const profiles = id === 'manipulation' ? [real,mujoco,mock] : id === 'base' ? [{...real,label:'실물 MCU'}, {...mock,label:'Mock MCU',prefix:''}] : id === 'action' ? [{...real,label:'실물'}, {...mujoco,label:'시뮬레이션'}] : [real];
  return profiles.filter(p => environment === 'all' || p.environment === environment);
}

/** Five middleware contracts belong to an action, even when not explicitly observed. */
export function actionInterfaces(parent: RosEndpoint): {endpoint: RosEndpoint; derived: boolean; label: string}[] {
  const concrete = filterEndpoints();
  return ([['service','send_goal','목표 전송'], ['service','get_result','결과 조회'], ['service','cancel_goal','목표 취소'], ['topic','feedback','진행 피드백'], ['topic','status','목표 상태']] as const).map(([kind,suffix,label]) => {
    const name = `${parent.name}/_action/${suffix}`;
    const found = concrete.find(e => e.kind === kind && e.name === name);
    // Keep only the environment routes already selected on the parent.
    const environments = new Set(parent.routes.map(r => r.environment));
    const observed = found && projectRoutes(found,found.routes.filter(r => r.environment === 'shared' || environments.has(r.environment)));
    const specific = [...environments].filter(e=>e!=='shared');
    const selectedEnvironment = parent.view?.environment ?? (specific.length === 1 ? specific[0] : undefined);
    const projected = observed && (selectedEnvironment ? inEnvironment(observed, selectedEnvironment) : observed);
    if (projected) return {endpoint:projected, derived:false, label};
    const type = suffix === 'cancel_goal' ? 'action_msgs/srv/CancelGoal' : suffix === 'status' ? 'action_msgs/msg/GoalStatusArray' : `${parent.type}_${{send_goal:'SendGoal',get_result:'GetResult',feedback:'FeedbackMessage'}[suffix as 'send_goal'|'get_result'|'feedback']}`;
    const routes = parent.routes.filter(r => r.producers.length).map(r => ({...r, basis:'action-contract' as const, description:undefined, qos:undefined, consumers:[], sources:[...new Set([...r.sources,'index'])], condition:'ActionServer의 ROS 자동 생성 계약. 실행 중인 인스턴스를 확인한 것은 아닙니다.'}));
    return {endpoint:{...parent, id:`${kind}:${name}`, name, kind, type, scope:'automatic', parentAction:parent.id, routes, description:'ROS 자동 생성 계약', qos:undefined, consumers:[], sources:[...new Set(routes.flatMap(r=>r.sources))]}, derived:true, label};
  });
}

export function executionFlow(id: FlowId, profile: FlowProfile, actionId = 'action:/manipulation/execute_skill', side: 'left'|'right' = 'left'): ExecutionFlow {
  const available = filterEndpoints({environment:profile.environment, scope:'application'});
  const nodes: FlowNode[] = [], edges: FlowEdge[] = [];
  const node = (key: string, kind: EndpointKind, name: string, label: string, column: number, row: number) => {
    let endpoint = (id==='base' && name==='/joint_states' ? filterEndpoints({environment:profile.environment,part:'wheels'}) : available).find(e=>e.kind===kind && e.name===name);
    if (!endpoint) throw new Error(`Missing flow endpoint: ${kind}:${name} (${profile.id})`);
    if (id==='manipulation') {
      const backends=['manipulation_jetson_server','manipulation_mujoco_server','manipulation_server'];
      const owner=backends[profile.id==='real'?0:profile.id==='mujoco'?1:2];
      const keep=(peer: RosNode)=>!backends.includes(peer.name)||peer.name===owner;
      const routes=endpoint.routes.map(r=>({...r,producers:r.producers.filter(keep),consumers:r.consumers.filter(keep)})).filter(r=>r.producers.length||r.consumers.length);
      endpoint=projectRoutes({...endpoint,view:{...endpoint.view,profile:profile.label}},routes);
    }
    if (id==='base') {
      const mcu=profile.id==='real'?'cleany_motor_controller':'mock_base_mcu';
      const peers: Record<string,{producers:string[];consumers?:string[]}> = {
        enable:{producers:['cleany_base_driver'],consumers:[]},
        velocity:{producers:['reactive_guard','voxel_guard'],consumers:['cleany_base_driver']},
        command:{producers:['cleany_base_driver'],consumers:[mcu]},
        state:{producers:[mcu],consumers:['cleany_base_driver']},
        joints:{producers:['cleany_base_driver'],consumers:['wheel_odometry']},
        'wheel-odom':{producers:['wheel_odometry'],consumers:['base_odom_relay']},
        odom:{producers:['base_odom_relay']},
      };
      const allowed=peers[key];
      const routes=endpoint.routes.map(r=>({...r,
        producers:r.producers.filter(p=>allowed.producers.includes(p.name)),
        consumers:r.consumers.filter(p=>allowed.consumers?allowed.consumers.includes(p.name):p.context==='공통'),
      })).filter(r=>r.producers.length||r.consumers.length);
      endpoint=projectRoutes({...endpoint,view:{...endpoint.view,profile:profile.label}},routes);
    }
    nodes.push({id:key, label, endpoint, column, row});
  };
  const edge = (from: string, to: string, label: string, condition: string, refs: string[], conditional = false) => edges.push({from,to,label,condition,sources:refs,conditional});
  let note = '화살표는 코드의 호출·발행 관계입니다. 실행 구성과 조건에 따라 경로가 달라집니다.';
  if (id === 'manipulation') {
    const prefix = profile.prefix + '/manipulation/';
    const backend = profile.id === 'real' ? sources.jetson : profile.id === 'mock' ? sources.mock : sources.mujoco;
    node('execute','action',prefix+'execute_skill','작업 실행',1,2);
    node('lookup','service',prefix+'get_execution','실행 기록 조회',2,1);
    node('cancel','service',prefix+'cancel','취소 방식 지정',1,3);
    node('native-cancel','service',prefix+'execute_skill/_action/cancel_goal','ROS 목표 취소',2,3);
    node('events','topic',prefix+'execution_events','실행 상태 발행',3,1);
    if (profile.id !== 'mock') node('bt','topic',prefix+'bt_transitions','BT 전이 발행',3,2);
    edge('execute','lookup','실행 ID로 조회','get_execution은 동일 execution_id의 저장된 실행 기록을 조회합니다. 액션 결과 조회 서비스와 별도입니다.',[sources.mock,backend]);
    edges[edges.length-1].reference=true;
    edge('execute','events','상태 변경 발행','실행 이벤트 큐의 레코드를 execution_events에 발행합니다.',[sources.mock,backend]);
    edge('cancel','native-cancel','취소 전달','사용자 취소 방식을 저장하고 활성 Goal ID를 ROS cancel_goal 서비스에 전달합니다.',[sources.mock,backend]);
    edge('native-cancel','execute','활성 목표 중단','부모 액션의 cancel callback이 실행 중단 요청을 처리합니다.',[sources.mock,backend]);
    if (profile.id !== 'mock') edge('execute','bt','트리 전이 발행','BT 전이를 실행 ID와 함께 bt_transitions 토픽에 발행합니다.',[backend]);
    note = profile.id==='mock' ? '기본 /mock namespace · 조회·취소는 실행과 병행 가능합니다.' : '같은 execution_id로 실행·기록·이벤트를 연결합니다. 조회·취소는 병행 경로입니다.';
  } else if (id === 'validation') {
    node('validate','action','/grasp/validate_pick','집기 가능성 검증',1,1);
    node('inspect','action','/perception/inspect_scene','물체 관측·분할',2,1);
    node('plan','service','/grasp/plan','파지 후보 생성',3,1);
    node('select','action','/grasp/select_reachable','도달 가능한 후보 검증',3,3);
    node('debug','topic','/grasp/validate_pick_debug','필터 결과 시각화',1,3);
    edge('validate','inspect','선택 물체 관측','snapshot_id와 selected_object_id로 InspectScene을 호출합니다.',[sources.validate]);
    edge('inspect','plan','관측 결과로 계획','InspectScene 결과의 target/context cloud와 물체 정보를 PlanGrasp 요청에 넣습니다.',[sources.validate]);
    edge('plan','select','후보 전달','PlanGrasp의 candidates를 SelectReachableGrasp 목표에 전달합니다.',[sources.validate]);
    edge('validate','debug','필터 결과 시각화','선택 물체의 크기·관심 영역 등 필터 결과를 validate_pick_debug에 발행합니다. 최종 구동 결과 토픽이 아닙니다.',[sources.validate]);
    note = '도달 가능성 검증은 plan-only 경로입니다. 이 흐름을 실제 팔 구동으로 표시하지 않습니다.';
  } else if (id === 'wrist') {
    const prefix = `/${side}_wrist_camera/`;
    node('enable','service',prefix+'set_enabled','선택 팔 카메라 활성화',1,1);
    node('image','topic',prefix+'image_raw','손목 영상',2,1);
    node('info','topic',prefix+'camera_info','카메라 보정값',2,3);
    node('state','topic',prefix+'enabled','활성화 상태',1,3);
    node('observe','service','/perception/observe_wrist_target','손목 대상 관측',3,2);
    node('tracking','topic','/perception/wrist_tracking_status','관측 상태 발행',3,3);
    edge('enable','image','캡처 활성화','WristCameraSession이 선택 팔을 열고 반대 팔을 닫습니다. 활성화된 드라이버만 영상을 발행합니다.',[sources['wrist-control'],sources.pipeline,sources['wrist-driver']]);
    edge('enable','state','상태 발행','USB 드라이버가 활성화 상태를 주기적으로 발행합니다.',[sources['wrist-driver']]);
    edge('image','observe','동기 영상 입력','enable_wrist_observation=true일 때 생성되는 WristTargetService가 좌우 영상·보정값을 캐시에 수신합니다.',[sources['wrist-observe']],true);
    edge('info','observe','보정값 입력','영상과 같은 timestamp의 CameraInfo를 사용합니다.',[sources['wrist-observe']],true);
    edge('observe','tracking','관측 상태 발행','손목 대상 관측 서비스가 WristTrackingStatus를 발행합니다.',[sources['wrist-observe']]);
    note = '실물 USB 카메라 경로 · 손목 관측 구독은 enable_wrist_observation=true 조건입니다.';
  } else if (id === 'base') {
    node('enable','service','/base/enable','베이스 구동 허가',1,1);
    node('velocity','topic','/cmd_vel','이동 속도 입력',1,2);
    node('command','topic','/base/wheel_command','휠 명령 전송',2,2);
    node('state','topic','/base/wheel_state','엔코더·명령 응답',2,3);
    node('joints','topic','/joint_states','휠 관절 상태',3,3);
    node('wheel-odom','topic','/wheel/odom','휠 오도메트리',3,2);
    node('odom','topic','/odom','베이스 위치',3,1);
    edge('enable','command','ENABLE / STOP','fresh wheel feedback 확인 후 ENABLE을 요청합니다. 서비스 성공만으로 MCU 확인이 끝난 것은 아닙니다.',[sources.base]);
    edge('velocity','command','휠 속도 변환','구동 허가와 MCU ENABLE 응답 이후에 유효한 속도 명령을 전송합니다.',[sources.base]);
    edge('command','state','MCU 응답','실물 MCU 또는 Mock MCU가 명령 확인 상태와 엔코더 값을 응답합니다.',[sources.base,profile.environment==='real'?'mcu':'base']);
    edge('state','joints','엔코더 변환','fresh wheel feedback을 받아 휠 JointState를 발행합니다. 팔·헤드 발행 경로와 구분합니다.',[sources.base]);
    edge('joints','wheel-odom','이동 추정','누적 휠 각도에서 유효 관측 구간의 평면 오도메트리를 계산합니다. 노드 자체는 TF를 발행하지 않습니다.',['odom']);
    edge('wheel-odom','odom','오도메트리 relay','base_odom_relay가 canonical odom 경로로 전달합니다. 다른 odom 발행 구성과 동시에 가정하지 않습니다.',['base']);
  } else {
    const parent = available.find(e=>e.id===actionId && e.kind==='action') ?? available.find(e=>e.kind==='action')!;
    nodes.push({id:'parent',label:'상위 액션',endpoint:parent,column:2,row:2});
    const positions = [[1,1],[3,1],[1,3],[3,2],[3,3]];
    actionInterfaces(parent).forEach((child,i)=>{
      const key = 'child-'+i, [column,row] = positions[i];
      nodes.push({id:key,label:child.label,endpoint:child.endpoint,column,row,derived:child.derived});
      const input = i===0 || i===2;
      edge(input?key:'parent',input?'parent':key,i===1?'결과 응답':child.label,'액션 서버의 자동 전송 계약. 명시 선언 항목과 자동 계약을 구분하며 실행 중 인스턴스 수로 합산하지 않습니다.',child.endpoint.sources);
    });
    note = '실선 카드: 명시 선언 · 점선 카드: ROS 자동 계약. 자동 계약을 기본 목록 수에 추가하지 않습니다.';
  }
  return {id,title:flowLabels[id],note,nodes,edges,profile};
}
