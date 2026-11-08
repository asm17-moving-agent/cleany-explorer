import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parts } from '../src/catalog.ts';
import { endpointsForPart, filterEndpoints, rosEndpoints, rosEvidence, rosInventory, endpointCommand, environmentText } from '../src/ros.ts';
import { actionInterfaces } from '../src/ros-relations.ts';

const endpoint = (name: string, environment: 'all' | 'real' | 'sim' = 'all') => filterEndpoints({environment}).find(e => e.name === name);

test('the complete index and every scanned declaration remain reachable, including dynamic names', () => {
  const keys = new Set(rosEndpoints.map(e => e.id));
  assert.equal(keys.size, rosEndpoints.length);
  assert.equal(rosInventory.indexKeys.length, 140);
  for (const key of rosInventory.indexKeys) {
    const reconciliation=rosInventory.reconciliations.find(r=>r.fromKey===key);
    assert.ok(keys.has(reconciliation?.toKey??key), key);
    if(reconciliation) for(const source of reconciliation.sources) assert.ok(rosEvidence.sources[source]);
  }
  assert.ok(rosInventory.declarations.length >= 320);
  for (const declaration of rosInventory.declarations) {
    assert.ok(keys.has(declaration.key), `${declaration.path}:${declaration.line}`);
    const item = rosEndpoints.find(e => e.id === declaration.key)!;
    assert.ok(item.sources.some(id => rosEvidence.sources[id].path === declaration.path));
    if (declaration.resolution === 'pattern') assert.equal(item.scope, 'dynamic');
  }
  for (const name of ['/manipulation/execute_skill', '/manipulation/return_arm', '/grasp/validate_pick', '/perception/revalidate_target', '/manipulation/check_evidence', '/check_state_validity_batch', '/battery_state', '/camera/raw_depth/image_raw']) assert.ok(endpoint(name), name);
  assert.equal(endpoint('/grasp/validate_pick')!.kind, 'action');
});

test('every endpoint has preserved, hash-verified local provenance and valid component mappings', () => {
  for (const part of parts) {
    if (part.id === 'case') assert.deepEqual(endpointsForPart(part.id), []);
    else assert.ok(endpointsForPart(part.id).length, part.id);
  }
  for (const item of rosEndpoints) {
    assert.ok(item.sources.length && item.routes.length);
    assert.ok(item.parts.every(id => parts.some(part => part.id === id)));
    assert.ok(item.domains.length);
    for (const id of item.sources) assert.ok(rosEvidence.sources[id], id);
  }
  for (const source of Object.values(rosEvidence.sources)) {
    const data = readFileSync(new URL(`../public${source.href}`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), source.excerptSha256, source.path);
    assert.ok(data.toString().includes(source.path));
    assert.ok(data.toString().includes(source.sha256));
  }
});

test('real and simulation filters remove opposite-environment peers and exclusive endpoints', () => {
  for (const [environment, excluded] of [['real', '시뮬레이션'], ['sim', '실물']] as const) {
    for (const item of filterEndpoints({environment})) {
      assert.ok([...item.producers, ...item.consumers].every(n => n.context !== excluded), item.name);
      assert.ok(item.routes.every(r => r.environment === environment || r.environment === 'shared'));
    }
  }
  for (const name of ['/head_pan/command', '/simulation/contact_diagnostics', '/mock/reboot', '/sorting/verify_placement', '/sorting_cameras/set_parameters']) {
    assert.equal(endpoint(name, 'real'), undefined, name);
    assert.ok(endpoint(name, 'sim'), name);
  }
  for (const name of ['/real_control/status', '/real_control/stop', '/left_wrist_camera/set_enabled', '/manipulation/return_arm']) {
    assert.equal(endpoint(name, 'sim'), undefined, name);
    assert.ok(endpoint(name, 'real'), name);
  }
  assert.ok(endpoint('/scan', 'real')!.producers.some(n => n.name.includes('rplidar')));
  assert.ok(endpoint('/scan', 'sim')!.producers.some(n => n.name === 'mujoco_sim'));
  assert.ok(endpoint('/cmd_vel', 'real')!.producers.every(n => n.name !== 'ground_truth_route_follower'));
  assert.ok(endpoint('/manipulation/cancel', 'real')!.producers.some(n => n.name === 'manipulation_jetson_server'));
  assert.ok(endpoint('/mock/manipulation/cancel', 'sim')!.producers.some(n => n.name === 'manipulation_server'));
});

test('component filters keep side-specific actuators separate and distinguish Pan from Tilt', () => {
  for (const side of ['left', 'right'] as const) {
    const actions = endpointsForPart(`${side}-arm`, 'action');
    assert.ok(actions.some(e => e.name === `/${side}_arm_controller/follow_joint_trajectory`));
    assert.ok(actions.some(e => e.name === '/grasp/validate_pick'));
    const opposite = side === 'left' ? 'right' : 'left';
    assert.ok(actions.every(e => !e.name.startsWith(`/${opposite}_`)));
  }
  assert.ok(endpointsForPart('head-pan', 'all', '', 'sim').some(e => e.name === '/head_pan/command'));
  assert.ok(endpointsForPart('head-pan', 'all', '', 'real').every(e => e.name !== '/head_pan/command'));
  assert.ok(endpointsForPart('head-tilt').every(e => e.name !== '/head_pan/command' && e.name !== '/wheel_encoder/joint_states'));
  assert.ok(endpointsForPart('head-camera', 'action').some(e => e.name === '/perception/inspect_scene'));
});

test('kind, environment, scope, component and search filters intersect without losing full inventory access', () => {
  const found = filterEndpoints({part:'left-arm', kind:'action', environment:'real', scope:'application', query:'  FollowJointTrajectory  '});
  assert.equal(found.length, 2);
  assert.equal(filterEndpoints({kind:'service', query:'nothing-matches-123'}).length, 0);
  const scopes = ['application', 'automatic', 'dynamic'] as const;
  assert.equal(scopes.flatMap(scope => filterEndpoints({scope})).length, rosEndpoints.length);
  assert.equal(filterEndpoints({scope:'automatic'}).length, 12);
});

test('commands only inspect; unknown providers and dynamic names are not invented', () => {
  assert.deepEqual(endpoint('/battery_state')!.producers, []);
  assert.ok(endpoint('/base/wheel_command', 'real')!.consumers.some(n => n.name === 'cleany_motor_controller'));
  for (const item of rosEndpoints) {
    assert.ok(![...item.producers, ...item.consumers].some(n => /MDD20A/.test(n.name)));
    assert.match(endpointCommand(item), /^ros2 (topic|service|action) (list -t|info \/[\w/]+(?: --verbose)?|type \/[\w/]+)$/);
  }
});

test('repeated environment searches keep peer names isolated and custom inventories independent', () => {
  for (const environment of ['all', 'real', 'sim', 'real', 'all', 'sim'] as const) {
    const matches = filterEndpoints({environment, query:'mock_base_mcu'});
    assert.equal(matches.some(e => e.name === '/base/wheel_state'), environment !== 'real');
    assert.ok(matches.every(e => [...e.producers, ...e.consumers].some(n => n.name.includes('mock_base_mcu'))));
  }
  const custom = [{...rosEndpoints[0], description:'local-only-search'}];
  assert.deepEqual(filterEndpoints({query:'local-only-search'}, custom), custom);
  custom[0].description = 'changed-custom-search';
  assert.deepEqual(filterEndpoints({query:'local-only-search'}, custom), []);
  assert.deepEqual(filterEndpoints({query:'changed-custom-search'}, custom), custom);
  assert.deepEqual(filterEndpoints({query:'changed-custom-search'}), []);
});

test('description and QoS stay attached to the selected environment and physical role', () => {
  const realScan = endpoint('/scan','real')!, simScan = endpoint('/scan','sim')!;
  assert.match(realScan.description,/실물/);
  assert.doesNotMatch(realScan.description,/시뮬레이션/);
  assert.equal(realScan.qos,undefined);
  assert.match(simScan.description,/시뮬레이션/);
  assert.match(simScan.qos!,/Reliable/);
  const arm = filterEndpoints({environment:'real',part:'left-arm'}).find(e=>e.name==='/joint_states')!;
  const wheels = filterEndpoints({environment:'real',part:'wheels'}).find(e=>e.name==='/joint_states')!;
  assert.match(arm.description,/양팔·헤드/);
  assert.doesNotMatch(arm.description,/휠/);
  assert.match(wheels.description,/휠 엔코더/);
  assert.ok(filterEndpoints({environment:'real',part:'left-arm',query:'휠 엔코더'}).every(e=>e.name!=='/joint_states'));
  for(const item of filterEndpoints({environment:'real'})) for(const route of item.routes) {
    assert.ok([...route.producers,...route.consumers].every(n=>n.context!=='시뮬레이션'),item.name);
  }
});

test('reviewed namespace defaults and finite wrist loops connect real clients without losing patterns', () => {
  assert.ok(endpoint('/manipulation/execute_skill','real')!.consumers.some(n=>n.name==='manipulation_test_client'));
  assert.ok(endpoint('/mock/manipulation/execute_skill','sim')!.consumers.some(n=>n.name==='manipulation_test_client'));
  assert.equal(endpoint('/mock/manipulation/execute_skill','real'),undefined);
  assert.ok(endpoint('/manipulation/return_arm','real')!.consumers.some(n=>n.name==='arm_return_client'));
  for(const side of ['left','right']) assert.ok(endpoint(`/${side}_wrist_camera/set_enabled`,'real')!.consumers.some(n=>n.name==='pregrasp_pipeline'));
  assert.ok(filterEndpoints({scope:'dynamic'}).some(e=>e.name.includes("prefix + '/manipulation/execute_skill'")));
  for(const key of Object.values(rosInventory.relationSources)) assert.ok(rosEvidence.sources[key]);
});

test('all explicitly declared action transports link to their parent provider and preserve environment', () => {
  const children=filterEndpoints({scope:'application'}).filter(e=>e.name.includes('/_action/'));
  assert.equal(children.length,11);
  for(const child of children) {
    assert.equal(child.parentAction,`action:${child.name.split('/_action/')[0]}`);
    assert.ok(child.producers.length,child.id);
    assert.ok(child.routes.some(r=>r.basis==='action-contract'),child.id);
  }
  assert.ok(endpoint('/manipulation/execute_skill/_action/cancel_goal','real')!.producers.every(n=>n.name==='manipulation_jetson_server'));
  assert.ok(endpoint('/manipulation/return_arm/_action/get_result','real')!.producers.some(n=>n.name==='manipulation_jetson_server'));
  assert.equal(endpoint('/manipulation/return_arm/_action/get_result','sim'),undefined);
});

test('camera position, shared camera selection and downstream perception map to their actual components',()=>{
  for(const side of ['left','right']) {
    const name=`/camera/${side}_wrist/color/image_raw`;
    assert.ok(endpointsForPart('wrist-camera','topic','','sim').some(e=>e.name===name));
    assert.ok(endpointsForPart('head-camera').every(e=>e.name!==name));
    assert.equal(endpoint(name,'real'),undefined);
  }
  for(const part of ['head-camera','wrist-camera'] as const) assert.ok(endpointsForPart(part,'service','','sim').some(e=>e.name==='/sorting_cameras/set_parameters'));
  for(const name of ['/perception/objects','/perception/scene_cloud','/grasp/plan','/grasp/collision_geometry']) {
    assert.ok(endpointsForPart('head-camera').some(e=>e.name===name),name);
  }
  for(const part of ['left-arm','right-arm'] as const) {
    for(const name of ['/grasp/plan','/grasp/collision_geometry']) assert.ok(endpointsForPart(part).some(e=>e.name===name),name);
    for(const item of filterEndpoints({scope:'application'}).filter(e=>e.name.startsWith('/mock/manipulation/'))) {
      assert.ok(endpointsForPart(part,'all','','sim').some(e=>e.id===item.id),item.id);
      assert.equal(endpoint(item.name,'real'),undefined);
    }
  }
  for(const part of ['wheels','motors','drivers'] as const) assert.ok(endpointsForPart(part).every(e=>e.name!=='/base/imu_state'));
  assert.ok(!endpoint('/grasp/plan')!.domains.includes('navigation'));
  assert.ok(endpoint('/plan')!.domains.includes('navigation'));
});

test('part-specific joint state routes separate wheel, arm and Pan roles while preserving the shared bus',()=>{
  const projected=(part: 'wheels'|'left-arm'|'head-pan')=>endpointsForPart(part,'topic','','real').find(e=>e.name==='/joint_states')!;
  const wheels=projected('wheels'),arm=projected('left-arm'),pan=projected('head-pan');
  assert.deepEqual(wheels.producers.map(p=>p.name),['cleany_base_driver']);
  assert.ok(wheels.consumers.some(p=>p.name==='wheel_odometry'));
  assert.ok(wheels.consumers.every(p=>!['pregrasp_pipeline','pan_motion_gate','reactive_guard'].includes(p.name)));
  assert.ok(arm.producers.some(p=>p.name==='real_control_state_guard'));
  assert.ok(arm.producers.every(p=>p.name!=='cleany_base_driver'));
  assert.ok(arm.consumers.every(p=>p.name!=='wheel_odometry'));
  assert.ok(pan.producers.every(p=>p.name!=='arm_state_reader'&&p.name!=='cleany_base_driver'));
  assert.ok(pan.consumers.some(p=>p.name==='pan_motion_gate'));
  assert.ok(wheels.routes.every(r=>!r.description?.includes('양팔')));
  assert.ok(filterEndpoints({part:'wheels',environment:'real',query:'real_control_state_guard'}).every(e=>e.name!=='/joint_states'));
  const full=endpoint('/joint_states','real')!;
  assert.ok(full.producers.some(p=>p.name==='cleany_base_driver'));
  assert.ok(full.producers.some(p=>p.name==='real_control_state_guard'));
  for(const peer of [...endpoint('/joint_states')!.producers,...endpoint('/joint_states')!.consumers]) {
    const role=(rosInventory.jointStateRoles as Record<string,{parts:string[];sources:string[]}>)[peer.name];
    assert.ok(role?.parts.length,peer.name);
    for(const source of role.sources) assert.ok(rosEvidence.sources[source]);
  }
});

test('environment badges retain shared applicability and no empty real path is synthesized',()=>{
  assert.equal(endpoint('/wheel/odom_raw','real'),undefined);
  assert.ok(endpoint('/wheel/odom_raw','sim')!.consumers.some(n=>n.name==='simulated_odometry_error'));
  for(const environment of ['real','sim'] as const) for(const item of filterEndpoints({environment,scope:'application'})) {
    assert.ok(item.producers.length||item.consumers.length,item.id);
    assert.equal(environmentText(item),environment==='real'?'실물':'시뮬');
  }
  assert.equal(environmentText(endpoint('/base/enable')!),'공통 · 실물');
  assert.ok(endpoint('/base/enable','sim'));
});

test('all four controller cancellation clients resolve to their real guard and parent action',()=>{
  for(const side of ['left','right']) for(const group of ['arm','gripper']) {
    const parentName=`/${side}_${group}_controller/follow_joint_trajectory`;
    const child=endpoint(parentName+'/_action/cancel_goal','real')!;
    assert.equal(child.parentAction,'action:'+parentName);
    assert.ok(child.consumers.some(p=>p.name==='real_control_state_guard'));
    assert.ok(child.sources.some(s=>rosEvidence.sources[s].path.endsWith('/control_state_guard.py')));
    assert.equal(endpoint(child.name,'sim'),undefined);
    const simulated=actionInterfaces(endpoint(parentName,'sim')!).find(c=>c.endpoint.name===child.name)!;
    assert.equal(simulated.derived,true);
    assert.deepEqual(simulated.endpoint.consumers,[]);
  }
});

test('wrist helper endpoints use their verified host and runtime camera names preserve launch provenance',()=>{
  assert.deepEqual(endpoint('/perception/wrist_tracking_status')!.producers.map(n=>n.name),['perception_inspector']);
  assert.deepEqual(endpoint('/perception/observe_wrist_target')!.producers.map(n=>n.name),['perception_inspector']);
  for(const side of ['left','right']) for(const suffix of ['image_raw','camera_info','enabled','preview/compressed','set_enabled']) {
    const item=endpoint(`/${side}_wrist_camera/${suffix}`,'real')!;
    assert.deepEqual(item.producers.map(n=>n.name),[`${side}_wrist_rgb_camera`]);
    assert.ok(item.sources.some(s=>rosEvidence.sources[s].path==='tools/collection-runtime'));
    assert.ok(item.condition.includes('wrist_rgb_camera'));
  }
  assert.match(endpoint('/left_wrist_camera/enabled')!.condition,/유효 영상 수신을 보장하지 않습니다/);
  assert.deepEqual(endpoint('/camera/aligned_depth_to_color/image_raw','sim')!.producers.map(n=>n.name),['sorting_cameras']);
});

test('obsolete index depth defaults reconcile to code and launch-specific RGB-D input routes remain explicit',()=>{
  assert.equal(endpoint('/camera/depth/image_rect_raw'),undefined);
  const reconciled=rosInventory.reconciliations.find(r=>r.fromKey==='topic:/camera/depth/image_rect_raw')!;
  assert.equal(reconciled.toKey,'topic:/camera/depth/image_raw');
  const current=endpoint('/camera/depth/image_raw')!;
  assert.ok(current.consumers.some(n=>n.name==='depth_scene_node'));
  assert.ok(current.sources.some(s=>rosEvidence.sources[s].path.endsWith('/depth_scene_node.py')));
  for(const environment of ['real','sim'] as const) {
    const aligned=endpoint('/camera/aligned_depth_to_color/image_raw',environment)!;
    assert.ok(aligned.consumers.some(n=>n.name==='perception_inspector'));
    assert.ok(aligned.routes.some(r=>r.condition.includes('learned_rgbd.launch.py')));
    if(environment==='real') assert.deepEqual(aligned.producers,[]);
  }
});
