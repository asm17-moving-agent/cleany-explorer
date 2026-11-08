import { parts, type PartId } from './catalog.ts';
import { filterEndpoints, type Environment, type RosEndpoint, type EndpointKind, type Domain } from './ros.ts';

export interface PartConnection { part: PartId; endpoints: RosEndpoint[]; counts: Record<EndpointKind, number>; domains: Domain[] }
const connectionsByEnvironment = new Map<Environment, PartConnection[]>();
export function countsFor(endpoints: RosEndpoint[]): Record<EndpointKind, number> {
  return { topic: endpoints.filter(e => e.kind === 'topic').length, service: endpoints.filter(e => e.kind === 'service').length, action: endpoints.filter(e => e.kind === 'action').length };
}
/** Project related interfaces onto physical groups; this is not a wiring graph. */
export function partConnections(environment: Environment = 'all'): PartConnection[] {
  const cached = connectionsByEnvironment.get(environment);
  if (cached) return cached;
  const connections = parts.map(part => {
    const endpoints = filterEndpoints({ environment, scope:'application', part:part.id });
    return { part: part.id, endpoints, counts: countsFor(endpoints), domains: [...new Set(endpoints.flatMap(e => e.domains))] };
  });
  connectionsByEnvironment.set(environment, connections);
  return connections;
}
/** Request direction differs from topic data direction. Unknown peers remain empty. */
export function endpointFlow(endpoint: RosEndpoint) {
  return endpoint.kind === 'topic'
    ? { from: endpoint.producers, to: endpoint.consumers, fromLabel: '발행', toLabel: '구독' }
    : { from: endpoint.consumers, to: endpoint.producers, fromLabel: '호출', toLabel: '제공' };
}
