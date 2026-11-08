import test from 'node:test';
import assert from 'node:assert/strict';
import { parts } from '../src/catalog.ts';
import { partConnections, countsFor, endpointFlow } from '../src/connections.ts';
import { filterEndpoints, rosEndpoints } from '../src/ros.ts';

test('all catalog components have graph projections with environment-specific counts', () => {
  for (const environment of ['all', 'real', 'sim'] as const) {
    const connections = partConnections(environment);
    assert.equal(connections.length, parts.length);
    for (const connection of connections) {
      assert.deepEqual(connection.endpoints, filterEndpoints({part: connection.part, environment, scope:'application'}));
      assert.equal(Object.values(connection.counts).reduce((a,b) => a+b,0), connection.endpoints.length);
    }
  }
});

test('the computer and functional groups expose all concrete interfaces, not only curated routes', () => {
  const all = filterEndpoints({scope:'application'});
  assert.deepEqual(partConnections().find(c => c.part === 'computer')!.endpoints, all);
  assert.ok(all.every(e => e.domains.length));
  assert.ok(countsFor(all).topic > 100 && countsFor(all).service > 40 && countsFor(all).action > 10);
});

test('topic flow and service/action request flow preserve publisher, subscriber and client/server roles', () => {
  for (const endpoint of rosEndpoints) {
    const flow = endpointFlow(endpoint);
    assert.deepEqual(flow.from, endpoint.kind === 'topic' ? endpoint.producers : endpoint.consumers);
    assert.deepEqual(flow.to, endpoint.kind === 'topic' ? endpoint.consumers : endpoint.producers);
  }
  const real = filterEndpoints({environment:'real'});
  assert.ok(endpointFlow(real.find(e => e.name === '/base/wheel_command')!).to.some(n => n.name === 'cleany_motor_controller'));
  assert.ok(endpointFlow(real.find(e => e.name === '/base/wheel_state')!).from.some(n => n.name === 'cleany_motor_controller'));
});
