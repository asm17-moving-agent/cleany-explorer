import type { PartId } from './catalog.ts';
import { reviewedEndpoints, partRosNotes as reviewedNotes } from './ros-reviewed.ts';
import evidence from './data/ros-sources.json' with { type: 'json' };
import inventory from './data/ros-catalog.json' with { type: 'json' };

export type EndpointKind = 'topic' | 'service' | 'action';
export type EndpointFilter = 'all' | EndpointKind;
export type Environment = 'all' | 'real' | 'sim';
export type EndpointScope = 'application' | 'automatic' | 'dynamic';
export type Domain = 'perception' | 'manipulation' | 'navigation' | 'mission' | 'system';
export interface RosNode { name: string; context: string }
export interface RosRoute {
  environment: 'shared' | 'real' | 'sim';
  producers: RosNode[]; consumers: RosNode[];
  condition: string; sources: string[];
  description?: string; qos?: string; parts?: PartId[];
  basis?: 'action-contract';
}
export interface RosEndpoint {
  id: string; kind: EndpointKind; name: string; type: string;
  parts: PartId[]; domains: Domain[]; description: string;
  producers: RosNode[]; consumers: RosNode[]; condition: string;
  sources: string[]; routes: RosRoute[]; scope: EndpointScope; qos?: string;
  parentAction?: string;
  view?: { environment?: 'real' | 'sim'; part?: PartId; profile?: string };
}
interface Source { path: string; href: string; sha256: string; excerptSha256: string }
export const rosEvidence = evidence as Omit<typeof evidence, 'sources'> & { sources: Record<string, Source> };
export const rosInventory = inventory;
export const kindLabels: Record<EndpointFilter, string> = { all: '전체', topic: '토픽', service: '서비스', action: '액션' };
export const environmentLabels: Record<Environment, string> = { all: '전체 환경', real: '실물', sim: '시뮬레이션' };
export const scopeLabels: Record<EndpointScope, string> = { application: '기본 이름', automatic: 'ROS 자동', dynamic: '동적 이름' };
export const domainLabels: Record<Domain, string> = { perception: '인식', manipulation: '조작', navigation: '주행', mission: '미션', system: '시스템' };
export const partRosNotes: Record<PartId, string> = {
  ...reviewedNotes,
  computer: '소스에 선언된 인터페이스입니다. 실행 중인 ROS 그래프가 아니며 구성별 대안이 함께 수록되어 있습니다.',
  'head-pan': '실물 Pan은 상태 읽기 전용입니다. /head_pan/command는 Gazebo 경로로 구분합니다.',
  'head-tilt': '실물 Tilt는 상태 읽기 전용입니다. 양팔·헤드 공용 JointState에 포함됩니다.',
};
const base: PartId[] = ['wheels', 'motors', 'drivers'];
const joints: PartId[] = ['left-arm', 'right-arm', 'head-pan', 'head-tilt'];
const unique = <T>(items: T[]): T[] => [...new Set(items)];
const uniqueNodes = (items: RosNode[]): RosNode[] => [...new Map(items.map(n => [`${n.name}:${n.context}`, n])).values()];

function associations(name: string): { parts: PartId[]; domains: Domain[] } {
  name = name.replace(/^\/mock(?=\/manipulation\/)/, '');
  const parts: PartId[] = ['computer'];
  const domains: Domain[] = [];
  if (/wrist_camera|wrist_tracking|observe_wrist|\/camera\/(left|right)_wrist\//.test(name)) parts.push('wrist-camera');
  else if (/camera|rgbd|depth_scene/.test(name)) parts.push('head-camera');
  if (name === '/sorting_cameras/set_parameters') parts.push('wrist-camera');
  if (/left_(arm|gripper)_controller/.test(name)) parts.push('left-arm');
  if (/right_(arm|gripper)_controller/.test(name)) parts.push('right-arm');
  if (/head_pan/.test(name)) parts.push('head-pan');
  if (/^\/(joint_states|joint_state_broadcaster\/.*|real_control\/.*|mujoco_sim\/joint_cmd|gazebo\/raw_joint_states)$/.test(name)) parts.push(...joints);
  if (/^\/(manipulation\/|grasp\/(plan$|collision_geometry$|select_reachable|validate_pick|warmup_status)|compute_|plan_kinematic_path|check_state_validity|apply_planning_scene|get_planning_scene|monitored_planning_scene|move_action|execute_trajectory|controller_manager\/|handeye\/)/.test(name)) parts.push('left-arm', 'right-arm');
  if (/^\/perception\/(inspect_scene|check_rgbd|get_scene_snapshot|revalidate_target|observe_object_reference|objects$|detections_2d$|debug_image|scene_cloud)/.test(name)
      || /^\/grasp\/(plan|collision_geometry|debug_image|prepare_window|vlm_warmup)$/.test(name)) parts.push('head-camera');
  if (/^\/perception\/manipulation_outcome/.test(name)) parts.push('wrist-camera', 'left-arm', 'right-arm');
  if (/^\/(tf|tf_static|robot_description)$/.test(name)) parts.push('frame', ...joints);
  if (/^\/scan$|scan_matched/.test(name)) parts.push('lidar');
  if (name === '/base/imu_state' || name.startsWith('/imu/')) parts.push('imu');
  if (name === '/battery_state') parts.push('battery');
  if (['/mission/status', '/mission/result', '/manipulation/execution_events',
       '/wheel/odom', '/battery_state', '/cleany/display/state'].includes(name)) parts.push('display');
  if (/cmd_vel|^\/base\/(wheel_command|wheel_state|enable)$|^\/mock\/(reboot|transport|drop_next_enable|force_disarm)/.test(name)) parts.push(...base);
  if (/odom|wheel_encoder/.test(name)) parts.push('wheels', 'motors');
  if (/camera|perception|grasp\/plan|grasp\/prepare|grasp\/vlm/.test(name)) domains.push('perception');
  if (/grasp|manipulation|controller|planning_scene|compute_|kinematic|move_action|execute_trajectory|state_validity|sorting|joint_states|real_control|handeye/.test(name)) domains.push('manipulation');
  if (/odom|cmd_vel|scan|nav|map|costmap|obstacle|guard|head_pan|footprint|constraint|trajectory_node|base\/|wheel|imu|ground_truth/.test(name)
      || /^\/(plan|local_plan)$/.test(name)) domains.push('navigation');
  if (/mission|robot\/safety/.test(name)) domains.push('mission');
  if (!domains.length || /diagnostic|status|tf|clock|rosout|parameter|display|battery/.test(name)) domains.push('system');
  return { parts: unique(parts), domains: unique(domains) };
}

const catalog = new Map<string, RosEndpoint>();
function add(record: {kind: string; name: string; type: string; producers: RosNode[]; consumers: RosNode[]; condition: string; sources: string[]; environment: string; scope: string}, curated?: typeof reviewedEndpoints[number]): void {
  const key = `${record.kind}:${record.name}`;
  const relation = associations(record.name);
  let item = catalog.get(key);
  if (!item) {
    item = { id: key, kind: record.kind as EndpointKind, name: record.name, type: record.type,
      ...relation, description: '', producers: [], consumers: [], condition: '', sources: [], routes: [], scope: record.scope as EndpointScope };
    catalog.set(key, item);
  }
  if (/^\w+\/(msg|srv|action)\/\w+$/.test(record.type)) item.type = record.type;
  if (curated) {
    item.parts = unique([...item.parts, ...curated.parts]);
  }
  item.routes.push({ environment: record.environment as RosRoute['environment'], producers: record.producers, consumers: record.consumers, condition: record.condition, sources: record.sources,
    ...(curated ? {description:curated.description, qos:curated.qos, parts:curated.parts} : {}) });
  item.producers = uniqueNodes([...item.producers, ...record.producers]);
  item.consumers = uniqueNodes([...item.consumers, ...record.consumers]);
  item.sources = unique([...item.sources, ...record.sources]);
  item.condition = unique(item.routes.map(r => r.condition)).join('\n');
}
function metadata(routes: RosRoute[], part?: PartId): { description: string; qos?: string } {
  const described = routes.filter(r => r.description && (!part || part === 'computer' || r.parts?.includes(part)));
  const descriptions = unique(described.map(r => r.description!));
  const qos = unique(described.flatMap(r => r.qos ? [r.qos] : []));
  return { description: descriptions.join(' / '), qos: qos.length === 1 && described.every(r => r.qos) ? qos[0] : undefined };
}
for (const record of inventory.records) add(record);
for (const item of reviewedEndpoints) {
  const contexts = [...item.producers, ...item.consumers].map(n => n.context);
  const environment = contexts.includes('시뮬레이션') ? 'sim' : contexts.some(c => c === '실물' || c === '외부 드라이버') || ['control', 'mcu', 'real-launch', 'realsense', 'wrist'].some(s => item.sources.includes(s)) ? 'real' : 'shared';
  add({ ...item, environment, scope: 'application' }, item);
}
// Action transports share the provider of their parent ActionServer. These are
// source-derived contracts, not discovery of running middleware instances.
for (const item of catalog.values()) {
  const match = item.name.match(/^(.*)\/_action\/(send_goal|get_result|cancel_goal|feedback|status)$/);
  if (!match || item.scope !== 'application') continue;
  const parent = catalog.get(`action:${match[1]}`);
  if (!parent) continue;
  item.parentAction = parent.id;
  for (const route of parent.routes.filter(r => r.producers.length)) {
    item.routes.push({...route, consumers:[], description:undefined, qos:undefined,
      basis:'action-contract', sources:unique([...route.sources, 'index']),
      condition:`${parent.name}의 ActionServer에서 ROS가 자동 제공하는 ${match[2]} 계약. 실행 여부와 remap은 런타임에서 확인합니다.`});
  }
  item.producers = uniqueNodes(item.routes.flatMap(r => r.producers));
  item.sources = unique(item.routes.flatMap(r => r.sources));
  item.condition = unique(item.routes.map(r => r.condition)).join('\n');
  if (match[2] === 'get_result' || match[2] === 'send_goal') item.type = `${parent.type}_${match[2] === 'get_result' ? 'GetResult' : 'SendGoal'}`;
}
for (const item of catalog.values()) Object.assign(item, metadata(item.routes));
const order: Record<EndpointKind, number> = { topic: 0, service: 1, action: 2 };
export const rosEndpoints: RosEndpoint[] = [...catalog.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));

/** Recompute every derived field after narrowing a route's role or configuration. */
export function projectRoutes(endpoint: RosEndpoint, routes: RosRoute[]): RosEndpoint {
  return { ...endpoint, ...metadata(routes, endpoint.view?.part), routes,
    producers: uniqueNodes(routes.flatMap(r => r.producers)), consumers: uniqueNodes(routes.flatMap(r => r.consumers)),
    sources: unique(routes.flatMap(r => r.sources)), condition: unique(routes.map(r => r.condition)).join('\n') };
}

export function inEnvironment(endpoint: RosEndpoint, environment: Environment): RosEndpoint | null {
  if (environment === 'all') return endpoint;
  const excluded = environment === 'real' ? '시뮬레이션' : '실물';
  const keep = (nodes: RosNode[]) => nodes.filter(n => n.context !== excluded && !(environment === 'sim' && n.context === '외부 드라이버'));
  const routes = endpoint.routes.filter(r => r.environment === 'shared' || r.environment === environment)
    .map(r => ({...r, producers:keep(r.producers), consumers:keep(r.consumers)}))
    .filter(r => endpoint.scope !== 'application' || r.producers.length || r.consumers.length);
  if (!routes.length) return null;
  if (endpoint.parentAction && routes.every(r => r.basis === 'action-contract')) return null;
  return projectRoutes({...endpoint, view:{...endpoint.view, environment}}, routes);
}

function forPart(endpoint: RosEndpoint, part: PartId): RosEndpoint {
  if (part === 'computer') return endpoint;
  const view = {...endpoint.view, part};
  if (endpoint.name !== '/joint_states' || part === 'frame') return {...endpoint, ...metadata(endpoint.routes,part), view};
  const roles = inventory.jointStateRoles as Record<string, {parts: string[]; sources: string[]}>;
  const keep = (peer: RosNode) => roles[peer.name]?.parts.includes(part);
  const routes = endpoint.routes.map(route => {
    const producers = route.producers.filter(keep), consumers = route.consumers.filter(keep);
    const roleSources = [...producers,...consumers].flatMap(peer=>roles[peer.name].sources);
    const matches = !route.parts || route.parts.includes(part);
    return {...route, producers, consumers, description:matches?route.description:undefined,
      qos:matches?route.qos:undefined, sources:unique([...route.sources,...roleSources])};
  }).filter(route=>route.producers.length || route.consumers.length);
  return projectRoutes({...endpoint, view},routes);
}
// The source snapshot is immutable during a page session; project each environment once.
const environmentCatalogs = new Map<Environment, RosEndpoint[]>([['all', rosEndpoints]]);
const searchTerms = new WeakMap<RosEndpoint, string>();
function searchableText(endpoint: RosEndpoint, cache: boolean): string {
  let text = cache ? searchTerms.get(endpoint) : undefined;
  if (text === undefined) {
    text = `${endpoint.name} ${endpoint.type} ${endpoint.description} ${[...endpoint.producers, ...endpoint.consumers].map(n => n.name).join(' ')}`.toLocaleLowerCase();
    if (cache) searchTerms.set(endpoint, text);
  }
  return text;
}
export interface EndpointQuery { environment?: Environment; kind?: EndpointFilter; query?: string; part?: PartId; domain?: Domain; scope?: EndpointScope }
export function filterEndpoints(options: EndpointQuery = {}, items = rosEndpoints): RosEndpoint[] {
  const environment = options.environment ?? 'all';
  let projected = items === rosEndpoints ? environmentCatalogs.get(environment) : undefined;
  if (!projected) {
    projected = items.map(e => inEnvironment(e, environment)).filter((e): e is RosEndpoint => !!e);
    if (items === rosEndpoints) environmentCatalogs.set(environment, projected);
  }
  const term = options.query?.trim().toLocaleLowerCase() ?? '';
  const candidates = options.part ? projected.filter(e=>e.parts.includes(options.part!)).map(e=>forPart(e,options.part!)) : projected;
  return candidates.filter(e => (!options.kind || options.kind === 'all' || e.kind === options.kind)
      && (!options.domain || e.domains.includes(options.domain))
      && (!options.scope || e.scope === options.scope)
      && (!term || searchableText(e, items === rosEndpoints).includes(term)));
}
export function endpointsForPart(part: PartId, kind: EndpointFilter = 'all', query = '', environment: Environment = 'all'): RosEndpoint[] {
  return filterEndpoints({part, kind, query, environment, scope: 'application'});
}
export function endpointCommand(endpoint: RosEndpoint): string {
  if (!/^\/[\w/]+$/.test(endpoint.name)) return `ros2 ${endpoint.kind} list -t`;
  return `ros2 ${endpoint.kind} ${endpoint.kind === 'service' ? 'type' : 'info'} ${endpoint.name}${endpoint.kind === 'topic' ? ' --verbose' : ''}`;
}
export function environmentText(endpoint: RosEndpoint): string {
  if (endpoint.view?.environment) return endpoint.view.environment === 'real' ? '실물' : '시뮬';
  const environments = unique(endpoint.routes.map(r => r.environment));
  if (environments.includes('real') && environments.includes('sim')) return '실물 · 시뮬';
  if (environments.includes('shared') && environments.length > 1) return environments.includes('real') ? '공통 · 실물' : '공통 · 시뮬';
  if (environments.includes('real')) return '실물';
  if (environments.includes('sim')) return '시뮬';
  return '공통';
}
