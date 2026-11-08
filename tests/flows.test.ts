import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executionFlow,flowProfiles,flowLabels,actionInterfaces,type FlowId} from '../src/ros-relations.ts';
import {filterEndpoints,rosEndpoints,rosEvidence,rosInventory} from '../src/ros.ts';

test('every reviewed flow has valid endpoints, unambiguous placement, directed edges and local source evidence',()=>{
  for(const id of Object.keys(flowLabels) as FlowId[]) for(const profile of flowProfiles(id,'all')) {
    const flow=executionFlow(id,profile);
    assert.equal(new Set(flow.nodes.map(n=>`${n.column}:${n.row}`)).size,flow.nodes.length,id);
    for(const node of flow.nodes) {
      assert.ok(node.derived || rosEndpoints.some(e=>e.id===node.endpoint.id),node.endpoint.id);
      assert.ok([...node.endpoint.producers,...node.endpoint.consumers].every(n=>n.context!==(profile.environment==='real'?'시뮬레이션':'실물')),node.endpoint.id);
    }
    for(const edge of flow.edges) {
      assert.ok(flow.nodes.some(n=>n.id===edge.from));assert.ok(flow.nodes.some(n=>n.id===edge.to));
      assert.ok(edge.condition && edge.sources.length);
      for(const id of edge.sources) assert.ok(rosEvidence.sources[id],id);
    }
  }
});
test('the validation path connects inspection results, grasp candidates and plan-only selection in order',()=>{
  const flow=executionFlow('validation',flowProfiles('validation','real')[0]);
  for(const [from,to] of [['validate','inspect'],['inspect','plan'],['plan','select'],['validate','debug']]) assert.ok(flow.edges.some(e=>e.from===from&&e.to===to));
  assert.match(flow.note,/plan-only/);
  assert.equal(flowProfiles('validation','sim').length,0);
  const source=rosEvidence.sources[rosInventory.relationSources.validate];
  const text=readFileSync(new URL('../public'+source.href,import.meta.url),'utf8');
  for(const call of ['self._inspection,','self._run_grasp_service(','self._selection,','self._validation_debug.publish(']) assert.ok(text.includes(call));
});
test('wrist and manipulation paths preserve side, namespace, cancellation and backend conditions',()=>{
  const wrist=executionFlow('wrist',flowProfiles('wrist','real')[0],undefined,'right');
  assert.ok(wrist.nodes.find(n=>n.id==='enable')!.endpoint.name.startsWith('/right_'));
  assert.ok(wrist.nodes.every(n=>!n.endpoint.name.startsWith('/left_')));
  assert.equal(wrist.edges.filter(e=>e.conditional).length,2);
  assert.equal(flowProfiles('wrist','sim').length,0);
  const mock=executionFlow('manipulation',flowProfiles('manipulation','sim').find(p=>p.id==='mock')!);
  assert.ok(mock.nodes.every(n=>n.endpoint.name.startsWith('/mock/')));
  assert.ok(mock.nodes.every(n=>n.id!=='bt'));
  assert.ok(mock.edges.some(e=>e.from==='cancel'&&e.to==='native-cancel'));
  assert.ok(mock.edges.find(e=>e.to==='lookup')!.reference);
  const mujoco=executionFlow('manipulation',flowProfiles('manipulation','sim').find(p=>p.id==='mujoco')!);
  assert.ok(mujoco.nodes.some(n=>n.id==='bt'));
  for(const node of mujoco.nodes) assert.ok(node.endpoint.producers.every(n=>n.name!=='manipulation_server'));
  assert.ok(mujoco.nodes.find(n=>n.id==='execute')!.endpoint.producers.some(n=>n.name==='manipulation_mujoco_server'));
});
test('all action families expose five contracts without adding assumed instances to the inventory',()=>{
  const count=rosEndpoints.length;
  for(const environment of ['real','sim'] as const) for(const parent of filterEndpoints({environment,kind:'action',scope:'application'})) {
    const children=actionInterfaces(parent);
    assert.equal(children.length,5);
    assert.equal(new Set(children.map(c=>c.endpoint.id)).size,5);
    for(const child of children) {
      assert.equal(child.endpoint.parentAction,parent.id);
      assert.ok(child.endpoint.name.startsWith(parent.name+'/_action/'));
      assert.ok(child.endpoint.producers.length);
      assert.ok(child.endpoint.producers.every(n=>n.context!==(environment==='real'?'시뮬레이션':'실물')));
      if(child.derived) {assert.equal(child.endpoint.scope,'automatic');assert.ok(!rosEndpoints.includes(child.endpoint));}
    }
  }
  assert.equal(rosEndpoints.length,count);
});

test('real MCU and Mock MCU base flows isolate transport, wheel feedback and odometry owners',()=>{
  for(const profile of flowProfiles('base','all')) {
    const nodes=executionFlow('base',profile).nodes;
    const endpoint=(id:string)=>nodes.find(n=>n.id===id)!.endpoint;
    const mcu=profile.id==='real'?'cleany_motor_controller':'mock_base_mcu';
    assert.deepEqual(endpoint('command').consumers.map(n=>n.name),[mcu]);
    assert.deepEqual(endpoint('state').producers.map(n=>n.name),[mcu]);
    assert.deepEqual(endpoint('joints').producers.map(n=>n.name),['cleany_base_driver']);
    assert.deepEqual(endpoint('joints').consumers.map(n=>n.name),['wheel_odometry']);
    assert.deepEqual(endpoint('wheel-odom').producers.map(n=>n.name),['wheel_odometry']);
    assert.deepEqual(endpoint('odom').producers.map(n=>n.name),['base_odom_relay']);
    for(const node of nodes) for(const peer of [...node.endpoint.producers,...node.endpoint.consumers]) {
      assert.ok(!/mujoco|gazebo|ros_gz|simulated_odometry|ground_truth_route/.test(peer.name),peer.name);
    }
  }
  assert.ok(filterEndpoints({environment:'sim'}).find(e=>e.name==='/joint_states')!.producers.some(n=>n.name==='mujoco_sim'));
});
