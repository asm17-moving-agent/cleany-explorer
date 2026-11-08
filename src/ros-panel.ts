import { publicPath } from './public-path';
import { byId, type PartId } from './catalog.ts';
import { endpointCommand, endpointsForPart, filterEndpoints, inEnvironment, kindLabels, partRosNotes, rosEvidence, environmentText, type Environment, type EndpointFilter, type RosEndpoint, type RosNode } from './ros.ts';
import { showDetails } from './dialog';
import { actionInterfaces } from './ros-relations.ts';

export const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const nodes = (items: RosNode[]) => items.length
  ? items.map(item => `<div class="ros-node"><code>${escapeHtml(item.name).replaceAll('_', '_<wbr>')}</code><small>${item.context}</small></div>`).join('')
  : '<span class="ros-unknown">스냅샷에 지정되지 않음</span>';
const peers = (items: RosNode[]) => {
  const names = [...new Set(items.map(n => n.name))];
  return names.length ? `<span class="endpoint-peer" title="${escapeHtml(names.join(', '))}"><code>${escapeHtml(names[0])}</code>${names.length > 1 ? `<small>+${names.length - 1}</small>` : ''}</span>` : '<span class="ros-unknown">미지정</span>';
};

// Requests travel from clients to providers, while topics travel from publishers to subscribers.
const flow = (endpoint: RosEndpoint) => endpoint.kind === 'topic'
  ? { from: endpoint.producers, to: endpoint.consumers, fromLabel: '발행', toLabel: '구독' }
  : { from: endpoint.consumers, to: endpoint.producers, fromLabel: '호출', toLabel: '제공' };

export function openEndpoint(endpoint: RosEndpoint, note: string, notify: (message: string) => void): void {
  const part = endpoint.view?.part;
  const scopedJoint = endpoint.name==='/joint_states' && part && part!=='computer' && part!=='frame';
  const scopeHtml = scopedJoint ? `<div class="ros-route-metadata"><strong>${byId(part).name} 관절 경로</strong><button type="button" class="text-button" data-shared-topic>공유 토픽 전체 경로 ↗</button></div>` : '';
  const groups = (['real', 'sim', 'shared'] as const).map(environment => {
    const routes = endpoint.routes.filter(r => r.environment === environment);
    if (!routes.length) return '';
    const distinct = (items: RosNode[]) => [...new Map(items.map(n => [n.name, n])).values()];
    const route = flow({ ...endpoint, producers: distinct(routes.flatMap(r => r.producers)), consumers: distinct(routes.flatMap(r => r.consumers)) });
    const annotations = routes.filter(r=>r.description).map(r=>`<div class="ros-route-metadata"><strong>${escapeHtml(r.description!)}</strong>${r.qos?`<p>QoS: ${escapeHtml(r.qos)}</p>`:''}</div>`).join('');
    return `<section class="ros-variant-group"><h4>${{real:'실물 경로',sim:'시뮬레이션 경로',shared:'공통 계약 · 구성별 적용'}[environment]}</h4><div class="ros-flow"><section><h4>${route.fromLabel} <span>↓</span></h4>${nodes(route.from)}</section><section><h4>${route.toLabel}</h4>${nodes(route.to)}</section></div>${annotations}<details><summary>실행 조건 · ${routes.length}개 근거</summary><p>${escapeHtml([...new Set(routes.map(r => r.condition))].join('\n\n'))}</p></details></section>`;
  }).join('');
  const specific = [...new Set(endpoint.routes.map(r=>r.environment).filter(e=>e!=='shared'))];
  const parent = endpoint.kind==='action' ? endpoint : filterEndpoints().find(e=>e.id===endpoint.parentAction);
  const projectedParent = parent && (specific.length===1 ? inEnvironment(parent,specific[0]) : parent);
  const family = projectedParent ? actionInterfaces(projectedParent) : [];
  const familyHtml = projectedParent ? `<section class="ros-action-family"><h4>${endpoint.parentAction?'상위 액션':'액션 내부 인터페이스'} · ${escapeHtml(projectedParent.name)}</h4><div>${family.map((c,i)=>`<button type="button" data-action-child="${i}"><span class="ros-kind ${c.endpoint.kind}">${kindLabels[c.endpoint.kind]}</span><span>${c.label}<br><code>${escapeHtml(c.endpoint.name)}</code><br>${c.derived?'ROS 자동 계약':'명시 선언'}</span></button>`).join('')}</div><button type="button" class="text-button" data-action-flow>액션 흐름 보기 ↗</button></section>` : '';
  const modal = showDetails(`${kindLabels[endpoint.kind]} 상세`, `<div class="endpoint-modal-summary"><h3><code>${escapeHtml(endpoint.name).replaceAll('/', '/<wbr>')}</code></h3><p class="ros-type">${escapeHtml(endpoint.type)}</p>${scopeHtml}${endpoint.view?.profile?`<p class="dialog-meta">${escapeHtml(endpoint.view.profile)} 경로</p>`:''}${endpoint.description ? `<p>${escapeHtml(endpoint.description)}</p>` : ''}${groups}</div>${familyHtml}<p class="dialog-meta">소스 ${rosEvidence.reviewedAt} · 실시간 연결 아님</p>${note ? `<p>${escapeHtml(note)}</p>` : ''}${endpoint.qos ? `<h4>QoS</h4><p>${escapeHtml(endpoint.qos)}</p>` : ''}<details><summary>코드 출처 ${endpoint.sources.length}개</summary><div class="ros-source-links">${endpoint.sources.map(id => { const source = rosEvidence.sources[id]; return `<a href="${publicPath(source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.path)} ↗</a>`; }).join('')}</div></details><div class="endpoint-command-heading"><h4>조회 명령</h4><button class="text-button" type="button" data-copy-command>복사</button></div><pre>${escapeHtml(endpointCommand(endpoint))}</pre><p class="dialog-meta">기본 이름은 namespace와 remap에 따라 바뀔 수 있습니다. 각 경로는 동시 연결이 아닌 실행 구성별 대안일 수 있습니다. 모듈·플러그인 표시는 런타임 노드명 미확정입니다.</p>`);
  modal.querySelector('[data-shared-topic]')?.addEventListener('click',()=>{
    const full = filterEndpoints({environment:endpoint.view?.environment??'all'}).find(e=>e.id===endpoint.id)!;
    modal.close();openEndpoint(full,'같은 이름을 공유하는 전체 관절 토픽입니다. 발행 경로별로 포함하는 관절과 실행 구성이 다릅니다.',notify);
  });
  modal.querySelectorAll<HTMLButtonElement>('[data-action-child]').forEach(button=>button.addEventListener('click',()=>{const child=family[Number(button.dataset.actionChild)];modal.close();openEndpoint(child.endpoint,child.derived?'ROS 자동 생성 계약 · 실행 인스턴스 미확인':'',notify);}));
  modal.querySelector('[data-action-flow]')?.addEventListener('click',()=>{modal.close();window.dispatchEvent(new CustomEvent('ros-flow-action',{detail:projectedParent!.id}));});
  modal.querySelector<HTMLButtonElement>('[data-copy-command]')!.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    try { await navigator.clipboard.writeText(endpointCommand(endpoint)); button.textContent = '복사됨'; }
    catch { button.textContent = '직접 선택해 복사'; notify('표시된 명령을 직접 선택해 주세요.'); }
  });
}

export function mountEndpointInspector(host: HTMLElement, all: RosEndpoint[], notify: (message: string) => void, note = ''): void {
  let filter: EndpointFilter = 'all';
  let query = '';
  let filtered = all;
  let page = 0;
  const pageSize = all.length <= 4 ? 4 : 3;
  const kinds = (Object.keys(kindLabels) as EndpointFilter[]).filter(kind => kind === 'all' || all.some(e => e.kind === kind));
  const duplicateName = (endpoint: RosEndpoint) => all.filter(item => item.name === endpoint.name).length > 1;
  host.innerHTML = `<div class="endpoint-browser">
    <div class="ros-filters" aria-label="ROS 인터페이스 종류" ${kinds.length <= 2 || all.length <= 4 ? 'hidden' : ''}>${kinds.map(kind => `<button type="button" data-ros-kind="${kind}" aria-pressed="${kind === 'all'}">${kindLabels[kind]} <span>${kind === 'all' ? all.length : all.filter(e => e.kind === kind).length}</span></button>`).join('')}</div>
    <input class="ros-search" ${all.length <= 4 ? 'hidden' : ''} type="search" placeholder="토픽 · 타입 · 노드 검색" aria-label="ROS 토픽, 타입 또는 노드 검색"/>
    <div class="endpoint-list-toolbar"><span class="ros-count" role="status" aria-live="polite"></span><button class="text-button" type="button" data-expand-endpoints>펼쳐보기 ↗</button></div>
    <div class="endpoint-list" aria-label="ROS 인터페이스 목록"></div><div class="endpoint-pager"><button type="button" data-ros-prev aria-label="부품 인터페이스 이전 페이지">←</button><span></span><button type="button" data-ros-next aria-label="부품 인터페이스 다음 페이지">→</button></div>
  </div>`;
  const search = host.querySelector<HTMLInputElement>('input')!;
  const list = host.querySelector<HTMLElement>('.endpoint-list')!;
  const render = () => {
    const text = query.trim().toLocaleLowerCase();
    filtered = all.filter(e => (filter === 'all' || e.kind === filter) && `${e.name} ${e.type} ${e.description} ${[...e.producers, ...e.consumers].map(n => n.name).join(' ')}`.toLocaleLowerCase().includes(text));
    host.querySelector('.ros-count')!.textContent = `연결 ${filtered.length}개${filtered.length !== all.length ? ` / ${all.length}개` : ''}`;
    host.querySelector<HTMLButtonElement>('[data-expand-endpoints]')!.disabled = !filtered.length;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    host.querySelector('.endpoint-pager span')!.textContent = `${page + 1} / ${pages}`;
    host.querySelector<HTMLButtonElement>('[data-ros-prev]')!.disabled = page === 0;
    host.querySelector<HTMLButtonElement>('[data-ros-next]')!.disabled = page === pages - 1;
    list.innerHTML = filtered.length ? filtered.slice(page * pageSize, (page + 1) * pageSize).map(endpoint => {
      const route = flow(endpoint);
      return `<article class="endpoint-row"><button type="button" class="endpoint-open" data-endpoint-id="${escapeHtml(endpoint.id)}" title="${escapeHtml(endpoint.name)}" aria-label="${escapeHtml(endpoint.name)}${duplicateName(endpoint) ? ` · ${escapeHtml(endpoint.description)}` : ''} 상세 보기"><span class="ros-kind ${endpoint.kind}">${kindLabels[endpoint.kind]}</span><code>${escapeHtml(endpoint.name).replaceAll('/', '/<wbr>')}</code><span class="endpoint-open-arrow" aria-hidden="true">↗</span></button><p class="endpoint-variant">${environmentText(endpoint)}</p><div class="endpoint-flow"><div><span class="endpoint-role">${route.fromLabel}</span>${peers(route.from)}</div><span class="endpoint-flow-arrow" aria-hidden="true">→</span><div><span class="endpoint-role">${route.toLabel}</span>${peers(route.to)}</div></div></article>`;
    }).join('') : '<div class="empty-state"><strong>일치하는 연결 없음</strong><button type="button" data-reset-ros>필터 초기화</button></div>';
    list.scrollTop = 0;
    host.querySelectorAll<HTMLButtonElement>('[data-ros-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rosKind === filter)));
  };
  search.addEventListener('input', () => { query = search.value; page = 0; render(); });
  host.onclick = event => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!target) return;
    if (target.dataset.rosKind) { filter = target.dataset.rosKind as EndpointFilter; page = 0; render(); }
    else if (target.hasAttribute('data-reset-ros')) { filter = 'all'; query = ''; page = 0; search.value = ''; render(); search.focus(); }
    else if (target.hasAttribute('data-ros-prev')) { page--; render(); }
    else if (target.hasAttribute('data-ros-next')) { page++; render(); }
    else if (target.dataset.endpointId) {
      const endpoint = filtered.find(e => e.id === target.dataset.endpointId);
      if (endpoint) openEndpoint(endpoint, note, notify);
    } else if (target.hasAttribute('data-expand-endpoints')) {
      showDetails(`ROS 연결 ${filtered.length}개`, `<table class="endpoint-matrix"><thead><tr><th>인터페이스</th><th>발행 / 호출 노드</th><th>구독 / 제공 노드</th><th>메시지 타입</th></tr></thead><tbody>${filtered.map(endpoint => {
        const route = flow(endpoint);
        return `<tr><td><span class="ros-kind ${endpoint.kind}">${kindLabels[endpoint.kind]}</span><code>${escapeHtml(endpoint.name).replaceAll('/', '/<wbr>')}</code>${duplicateName(endpoint) ? `<small>${escapeHtml(endpoint.description)}</small>` : ''}</td><td data-label="${route.fromLabel}">${nodes(route.from)}</td><td data-label="${route.toLabel}">${nodes(route.to)}</td><td data-label="메시지 타입"><code>${escapeHtml(endpoint.type).replaceAll('/', '/<wbr>')}</code></td></tr>`;
      }).join('')}</tbody></table>`, { wide: true });
    }
  };
  render();
}

export function mountRosPanel(host: HTMLElement, part: PartId, notify: (message: string) => void): void {
  if (part === 'case') {
    host.innerHTML = `<p class="ros-count">${partRosNotes.case}</p>`;
    return;
  }
  let environment: Environment = 'all';
  host.classList.add('ros-with-environments');
  host.innerHTML = `<div class="ros-environment-picker" aria-label="부품 ROS 실행 환경">${(['all', 'real', 'sim'] as const).map(env => `<button type="button" data-part-env="${env}" aria-pressed="${env === environment}">${{all:'전체',real:'실물',sim:'시뮬레이션'}[env]}</button>`).join('')}</div><div class="ros-part-inventory" style="min-height:0;flex:1;display:flex;flex-direction:column"></div>`;
  const body = host.querySelector<HTMLElement>('.ros-part-inventory')!;
  const render = () => mountEndpointInspector(body, endpointsForPart(part, 'all', '', environment), notify, partRosNotes[part]);
  host.querySelectorAll<HTMLButtonElement>('[data-part-env]').forEach(button => button.addEventListener('click', () => {
    environment = button.dataset.partEnv as Environment;
    host.querySelectorAll('[data-part-env]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    render();
  }));
  render();
}
