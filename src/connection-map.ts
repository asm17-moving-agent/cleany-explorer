import { byId, type PartId } from './catalog.ts';
import { partConnections, countsFor, endpointFlow } from './connections.ts';
import { filterEndpoints, rosEndpoints, rosEvidence, kindLabels, scopeLabels, domainLabels, environmentText, type Environment, type EndpointFilter, type EndpointScope, type Domain, type RosEndpoint } from './ros.ts';
import { openEndpoint, escapeHtml } from './ros-panel.ts';
import { showDetails } from './dialog';
import './ros-workspace.css';
import { mountFlowMap } from './flow-map.ts';

const shortNames: Partial<Record<PartId, string>> = { 'left-arm': '왼팔 · 그리퍼', 'right-arm': '오른팔 · 그리퍼', frame: '프레임 / TF', motors: '휠 모터', drivers: '모터 드라이버', computer: '엣지 컴퓨터' };
const name = (id: PartId) => shortNames[id] ?? byId(id).name;
const kinds = ['topic', 'service', 'action'] as const;
const columns: PartId[][] = [
  ['head-camera', 'wrist-camera', 'lidar', 'imu', 'head-pan', 'head-tilt', 'display', 'frame'],
  ['left-arm', 'right-arm', 'drivers', 'motors', 'wheels', 'battery', 'case'],
];
const badges = (counts: ReturnType<typeof countsFor>) => kinds.map(kind => `<span class="net-count ${kind}" title="${kindLabels[kind]} ${counts[kind]}개">${kindLabels[kind][0]} <b>${counts[kind]}</b></span>`).join('');

export function mountConnectionMap(host: HTMLElement, onPart: (id: PartId) => void, refreshIcons: () => void, notify: (text: string) => void) {
  let environment: Environment = 'all';
  let selected: PartId | null = null;
  let domain: Domain | null = null;
  let kind: EndpointFilter = 'all';
  let scope: EndpointScope = 'application';
  let query = '';
  let page = 0;
  let pageSize = 8;
  let wide = false;
  let filtered: RosEndpoint[] = [];
  let frame = 0;
  let mode: 'flow'|'parts' = 'flow';
  host.classList.add('ros-workspace');
  host.innerHTML = `<header class="net-heading"><div><span class="net-eyebrow">ROS 2 INTERFACES</span><h1>연결 한눈에 보기</h1></div><div class="net-environments" aria-label="ROS 실행 환경">${(['all', 'real', 'sim'] as const).map(env => `<button type="button" data-environment="${env}" aria-pressed="${env === environment}">${{all:'전체',real:'실물',sim:'시뮬레이션'}[env]}</button>`).join('')}</div><div class="net-tools"><button type="button" data-net-info aria-label="ROS 목록 범위와 출처"><i data-lucide="info"></i><span>소스 기준</span></button><button type="button" data-net-wide aria-pressed="false"><i data-lucide="expand"></i><span>목록 넓게</span></button></div></header>
    <div class="net-layout"><section class="net-diagram" aria-label="부품별 ROS 연결도"><div class="net-diagram-heading"><strong>부품 ↔ 처리 노드</strong><button type="button" class="text-button" data-net-reset>전체 보기</button></div><div class="net-board"><svg class="net-lines" aria-hidden="true"></svg><div class="net-hardware net-left">${columns[0].map(partButton).join('')}</div><button type="button" class="net-hub" data-net-part="computer" aria-pressed="false"><i data-lucide="cpu"></i><strong>엣지 컴퓨터</strong><span>ROS 2</span><b data-hub-count></b></button><div class="net-hardware net-right">${columns[1].map(partButton).join('')}</div></div><div class="net-domains" aria-label="기능별 인터페이스">${Object.entries(domainLabels).map(([id, label]) => `<button type="button" data-domain="${id}" aria-pressed="false"><span>${label}</span><b>0</b></button>`).join('')}</div><div class="net-legend" aria-label="연결선 종류 선택">${kinds.map(k => `<button type="button" class="${k}" data-graph-kind="${k}" aria-pressed="false">${kindLabels[k]}</button>`).join('')}<small>선 1개 = 부품별 연결 묶음</small></div></section>
    <section class="net-inventory" aria-label="ROS 인터페이스 전체 목록"><div class="net-selection"><div><span class="net-selection-context">전체 부품</span><h2>모든 인터페이스 <b></b></h2></div><button type="button" class="text-button" data-net-3d hidden>3D 보기 ↗</button></div><div class="net-scope" aria-label="인터페이스 이름 범위">${Object.entries(scopeLabels).map(([key, label]) => `<button type="button" data-scope="${key}" aria-pressed="${key === scope}">${label} <b></b></button>`).join('')}</div><div class="net-filterbar"><div class="net-kinds" aria-label="인터페이스 종류">${(['all', ...kinds] as const).map(k => `<button type="button" data-net-kind="${k}" aria-pressed="${k === kind}">${kindLabels[k]} <b></b></button>`).join('')}</div><label class="net-search"><i data-lucide="search"></i><input type="search" aria-label="인터페이스 이름, 타입, 노드 검색" placeholder="이름 · 타입 · 노드 검색"/></label></div><p class="net-scope-note" hidden></p><div class="net-table-wrap"><table class="net-table"><thead><tr><th>인터페이스 / 타입</th><th>발행 → 구독 · 호출 → 제공</th><th>환경</th></tr></thead><tbody></tbody></table><div class="net-empty" hidden><strong>일치하는 인터페이스가 없습니다</strong><button type="button" class="text-button" data-net-clear>검색·필터 초기화</button></div></div><footer class="net-pagination"><span role="status" aria-live="polite"></span><div><button type="button" data-net-prev aria-label="인터페이스 이전 페이지">←</button><b data-page-label></b><button type="button" data-net-next aria-label="인터페이스 다음 페이지">→</button></div></footer></section></div>`;

  function partButton(part: PartId): string {
    return `<button type="button" class="net-part" data-net-part="${part}" aria-pressed="false"><span class="net-part-name"><i data-lucide="${byId(part).icon}"></i><strong>${name(part)}</strong></span><span class="net-part-counts"></span></button>`;
  }
  const modes = document.createElement('nav'); modes.className='net-modes'; modes.setAttribute('aria-label','연결도 보기 방식');
  modes.innerHTML='<button type="button" data-net-mode="flow" aria-pressed="true">실행 흐름</button><button type="button" data-net-mode="parts" aria-pressed="false">부품 연결</button><span>소스 기반 · 실시간 연결 아님</span>';
  host.querySelector('.net-heading')!.after(modes);
  const flowHost=document.createElement('section'); flowHost.className='flow-root';host.append(flowHost);
  const flowMap=mountFlowMap(flowHost,notify);
  function setMode(next: typeof mode) {
    mode=next;flowHost.hidden=mode!=='flow';host.querySelector<HTMLElement>('.net-layout')!.hidden=mode!=='parts';
    host.querySelector<HTMLButtonElement>('[data-net-wide]')!.hidden=mode==='flow';
    modes.querySelectorAll('[data-net-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-net-mode')===mode)));
    if(mode==='flow')flowMap.render(environment);else schedule();
  }
  const board = host.querySelector<HTMLElement>('.net-board')!;
  const wrap = host.querySelector<HTMLElement>('.net-table-wrap')!;
  const tbody = host.querySelector<HTMLTableSectionElement>('tbody')!;
  const input = host.querySelector<HTMLInputElement>('input')!;
  function draw() {
    const rect = board.getBoundingClientRect();
    if (!rect.width || wide) return;
    const hub = board.querySelector<HTMLElement>('.net-hub')!.getBoundingClientRect();
    const svg = board.querySelector('svg')!;
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svg.innerHTML = partConnections(environment).filter(g => g.part !== 'computer').flatMap(group => {
      const node = board.querySelector<HTMLElement>(`[data-net-part="${group.part}"]`)!.getBoundingClientRect();
      const left = columns[0].includes(group.part);
      const x1 = (left ? node.right : node.left) - rect.left;
      const x2 = (left ? hub.left : hub.right) - rect.left;
      const y1 = node.top + node.height / 2 - rect.top;
      const active = (!selected || selected === 'computer' || selected === group.part) && (!domain || group.domains.includes(domain));
      if (!group.endpoints.length || kind !== 'all' && !group.counts[kind]) return [];
      // One aggregate link per component. Separate hub ports prevent overlapping routes.
      return [`<g class="net-link ${kind} ${active ? 'active' : 'dim'}" data-link-part="${group.part}"><path d="M ${x1} ${y1} H ${x2}"/><circle cx="${x1}" cy="${y1}" r="3"/><circle cx="${x2}" cy="${y1}" r="3"/></g>`];
    }).join('');
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
  function renderRows() {
    filtered = filterEndpoints({ environment, part: selected ?? undefined, domain: domain ?? undefined, kind, query, scope });
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    const rows = filtered.slice(page * pageSize, (page + 1) * pageSize);
    tbody.innerHTML = rows.map(e => {
      const flow = endpointFlow(e);
      const peer = (peers: typeof flow.from) => { const nodes = [...new Map(peers.map(n => [n.name, n])).values()]; return nodes.length ? `<span title="${escapeHtml(nodes.map(n => n.name).join(', '))}">${escapeHtml(nodes[0].name)}${nodes.length > 1 ? `<b> +${nodes.length - 1}</b>` : ''}</span>` : '<span class="net-unspecified">미지정</span>'; };
      return `<tr><td><button type="button" class="net-endpoint" data-net-endpoint="${escapeHtml(e.id)}" title="${escapeHtml(e.name)}"><span class="net-kind-dot ${e.kind}" aria-label="${kindLabels[e.kind]}">${{topic:'T',service:'S',action:'A'}[e.kind]}</span><span><code>${escapeHtml(e.name)}</code><small title="${escapeHtml(e.type)}">${escapeHtml(e.type)}</small></span><b aria-hidden="true">↗</b></button></td><td><div class="net-peer-pair"><div><small>${flow.fromLabel}</small>${peer(flow.from)}</div><div><small>${flow.toLabel}</small>${peer(flow.to)}</div></div></td><td><span class="net-env ${environmentText(e) === '시뮬' ? 'sim' : environmentText(e) === '실물' ? 'real' : ''}">${environmentText(e)}</span></td></tr>`;
    }).join('');
    host.querySelector<HTMLElement>('.net-empty')!.hidden = !!rows.length;
    host.querySelector('.net-pagination > span')!.textContent = filtered.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} / ${filtered.length}개` : '0개';
    host.querySelector('[data-page-label]')!.textContent = `${page + 1} / ${pages}`;
    host.querySelector<HTMLButtonElement>('[data-net-prev]')!.disabled = page === 0;
    host.querySelector<HTMLButtonElement>('[data-net-next]')!.disabled = page >= pages - 1;
  }
  function render() {
    const selectedName = selected ? name(selected) : domain ? domainLabels[domain] : '모든 인터페이스';
    const scoped = filterEndpoints({environment, part: selected ?? undefined, domain: domain ?? undefined, query});
    host.querySelector('.net-selection-context')!.textContent = selected ? '부품별 관련 인터페이스' : domain ? '기능별 인터페이스' : '전체 부품 · 전체 기능';
    host.querySelector('h2')!.innerHTML = `${selectedName} <b>${scoped.filter(e => e.scope === scope).length}</b>`;
    host.querySelector<HTMLButtonElement>('[data-net-3d]')!.hidden = !selected;
    host.querySelectorAll<HTMLButtonElement>('[data-environment]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.environment === environment)));
    host.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.scope === scope)); b.querySelector('b')!.textContent = String(scoped.filter(e => e.scope === b.dataset.scope).length); });
    host.querySelectorAll<HTMLButtonElement>('[data-net-kind]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.netKind === kind)); b.querySelector('b')!.textContent = String(scoped.filter(e => e.scope === scope && (b.dataset.netKind === 'all' || e.kind === b.dataset.netKind)).length); });
    host.querySelectorAll<HTMLButtonElement>('[data-graph-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.graphKind === kind)));
    const connections = partConnections(environment);
    host.querySelectorAll<HTMLButtonElement>('[data-net-part]').forEach(b => {
      const group = connections.find(g => g.part === b.dataset.netPart)!;
      b.setAttribute('aria-pressed', String(selected === group.part));
      b.classList.toggle('muted', !!selected && selected !== 'computer' && selected !== group.part || !!domain && !group.domains.includes(domain));
      const count = b.querySelector('.net-part-counts');
      if (count) count.innerHTML = badges(group.counts);
    });
    host.querySelector('[data-hub-count]')!.textContent = `${filterEndpoints({environment, scope:'application'}).length}개`;
    host.querySelectorAll<HTMLButtonElement>('[data-domain]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.domain === domain)); b.querySelector('b')!.textContent = String(filterEndpoints({environment, domain: b.dataset.domain as Domain, scope:'application'}).length); });
    const note = host.querySelector<HTMLElement>('.net-scope-note')!;
    note.hidden = scope === 'application';
    note.textContent = scope === 'automatic' ? '노드·액션별 자동 생성 패턴. 실행 인스턴스 수가 아닙니다.' : '설정·인자로 이름이 정해지는 선언. 상세에서 원본 식과 출처를 확인할 수 있습니다.';
    renderRows(); refreshIcons(); schedule();
    if(mode==='flow')flowMap.render(environment);
  }
  input.addEventListener('input', () => { query = input.value; page = 0; render(); });
  host.addEventListener('click', event => {
    if(flowHost.contains(event.target as Node))return;
    const b = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.netMode) {setMode(b.dataset.netMode as typeof mode);return;}
    if (b.dataset.netEndpoint) { const endpoint = filtered.find(e => e.id === b.dataset.netEndpoint); if (endpoint) openEndpoint(endpoint, selected ? byId(selected).name : '', notify); return; }
    if (b.hasAttribute('data-net-prev')) { page--; renderRows(); return; }
    if (b.hasAttribute('data-net-next')) { page++; renderRows(); return; }
    if (b.hasAttribute('data-net-3d')) { if (selected) onPart(selected); return; }
    if (b.hasAttribute('data-net-info')) {
      showDetails('목록 범위와 출처', `<p>소스 스냅샷 ${rosEvidence.reviewedAt}. 전체 ROS 색인, 패키지 계약, Python과 C++의 인터페이스 선언을 통합했습니다.</p><p>고정 기본 이름 ${rosEndpoints.filter(e => e.scope === 'application').length}개, 자동 생성 패턴 ${rosEndpoints.filter(e => e.scope === 'automatic').length}개, 동적 이름 선언 ${rosEndpoints.filter(e => e.scope === 'dynamic').length}개입니다. 같은 종류·이름은 합치고 실행 경로와 출처는 보존합니다.</p><p>공통은 환경을 고정하지 않은 코드 계약입니다. 실물·시뮬레이션은 해당 구현 경로를 뜻하며, 동시 실행이나 실물 검증 완료를 뜻하지 않습니다. 미지정 상대편은 새로 만들지 않았습니다.</p><p>연결선 하나는 해당 부품의 관련 인터페이스 묶음입니다. 종류를 선택하면 토픽은 실선, 서비스는 파선, 액션은 점선으로 표시합니다. 드라이버·모터·프레임 자체가 ROS 노드라는 뜻은 아닙니다. 표와 상세에서 발행→구독, 호출→제공 방향을 확인하세요.</p><p>실시간 DDS 연결은 없습니다. 외부 드라이버의 전체 API, remap된 이름과 실행 중 생성된 인스턴스는 실행 환경에서 조회해야 합니다.</p><pre>ros2 topic list -t\nros2 service list -t\nros2 action list -t</pre>`); return;
    }
    if (b.hasAttribute('data-net-wide')) { wide = !wide; host.classList.toggle('net-wide', wide); b.setAttribute('aria-pressed', String(wide)); b.querySelector('span')!.textContent = wide ? '연결도 함께' : '목록 넓게'; schedule(); return; }
    if (b.dataset.environment) environment = b.dataset.environment as Environment;
    if (b.dataset.netPart) { selected = b.dataset.netPart as PartId; domain = null; scope = 'application'; }
    if (b.dataset.domain) { domain = b.dataset.domain as Domain; selected = null; scope = 'application'; }
    if (b.dataset.netKind) kind = b.dataset.netKind as EndpointFilter;
    if (b.dataset.graphKind) kind = b.dataset.graphKind === kind ? 'all' : b.dataset.graphKind as EndpointFilter;
    if (b.dataset.scope) scope = b.dataset.scope as EndpointScope;
    if (b.hasAttribute('data-net-reset')) { selected = null; domain = null; kind = 'all'; scope = 'application'; query = ''; input.value = ''; }
    if (b.hasAttribute('data-net-clear')) { kind = 'all'; query = ''; input.value = ''; }
    page = 0; render();
  });
  const observer = new ResizeObserver(() => {
    const size = Math.max(1, Math.floor((wrap.clientHeight - 30) / 43));
    if (size !== pageSize) { pageSize = size; page = 0; renderRows(); }
    schedule();
  });
  observer.observe(wrap); observer.observe(board);
  render();
  setMode(mode);
  return {
    selectPart(part: PartId) { setMode('parts');selected = part; domain = null; kind = 'all'; scope = 'application'; query = ''; input.value = ''; page = 0; render(); },
    showAction(endpoint: RosEndpoint) {
      const specific=[...new Set(endpoint.routes.map(r=>r.environment).filter(e=>e!=='shared'))];
      if(specific.length===1)environment=specific[0];
      render();setMode('flow');flowMap.showAction(endpoint);
    },
    focusSearch() {setMode('parts');input.focus();},
    refresh() { render(); },
    dispose() { flowMap.dispose();observer.disconnect(); cancelAnimationFrame(frame); },
  };
}
