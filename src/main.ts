import { publicPath } from './public-path';
import './style.css';
import { createIcons, Activity, ArrowUpRight, BatteryCharging, Box, Camera, ChevronRight, CircleDot, CircuitBoard, Cog, Cpu, Download, Expand, Info, Layers, ListFilter, Minus, Monitor, Plus, Radar, Rotate3d, RotateCcw, ScanEye, Search, SearchX, Tags, Wallet, Workflow, X } from 'lucide';
const icons = { Activity, ArrowUpRight, BatteryCharging, Box, Camera, ChevronRight, CircleDot, CircuitBoard, Cog, Cpu, Download, Expand, Info, Layers, ListFilter, Minus, Monitor, Plus, Radar, Rotate3d, RotateCcw, ScanEye, Search, SearchX, Tags, Wallet, Workflow, X };
import { parts, byId, categories, filterParts, money, csvCatalog, referenceSubtotal, partSubtotal, partVatIncluded, latestPriceDate, type Part, type PartId, type Category, type Price } from './catalog';
import type { RobotViewer } from './viewer';
import { endpointsForPart, filterEndpoints, rosEvidence } from './ros';
import { mountRosPanel } from './ros-panel';
import { mountConnectionMap } from './connection-map';
import { showDetails } from './dialog';

const priceEvidence = (price: Price) => price.url
  ? `<a class="source-link" href="${price.url}" target="_blank" rel="noreferrer">${price.date} · ${price.basis === '사용자 제공가' ? '구매처' : '가격 근거'} ↗</a>`
  : `<p class="dialog-meta">${price.date} · ${price.basis}</p>`;
const vatLabel = (vat: boolean | null) => vat === true ? 'VAT 포함' : vat === false ? 'VAT 별도' : 'VAT 미확인';
const unitPrice = (price: Price) => `${money(price.amount)} / ${price.unit}`;
const icon = (name: string, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.65 } });
let selected: PartId = 'left-arm';
let detailTab: 'specs' | 'ros' = 'specs';
let category: Category = '전체';
let query = '';
let view: 'explore' | 'connections' | 'specs' | 'cost' = 'explore';
let exploded = false;
let caseRemoved = false;
let labels = true;
let viewer: RobotViewer | undefined;
let viewerLoading: Promise<void> | undefined;
let cameraView: 'iso' | 'front' | 'side' = 'iso';
let disposed = false;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<a class="skip-link" href="#workspace">주요 콘텐츠로 이동</a>
<header class="site-header">
  <a class="brand" href="${publicPath('/')}" aria-label="Cleany 홈"><img src="${publicPath('/favicon.svg')}" alt=""/><span>cleany<span class="brand-dot">.</span></span><small>EXPLORER</small></a>
  <nav class="main-nav" aria-label="주 탐색">
    <button class="nav-button active" data-view="explore" aria-pressed="true">${icon('box')}<span>3D 탐색</span></button>
    <button class="nav-button" data-view="connections" aria-pressed="false">${icon('workflow')}<span>ROS 연결도</span></button>
    <button class="nav-button" data-view="specs" aria-pressed="false">${icon('list-filter')}<span>사양</span></button>
    <button class="nav-button" data-view="cost" aria-pressed="false">${icon('wallet')}<span>비용</span></button>
  </nav>
  <button id="sources-button" class="snapshot-button" title="데이터 기준 보기">${icon('info')}<span>소스 스냅샷</span></button>
</header>
<main id="workspace" tabindex="-1">
  <section class="explorer" aria-label="3D 하드웨어 탐색">
    <aside class="parts-panel">
      <div class="panel-heading"><h1>부품 <span>${parts.length}</span></h1></div>
      <label class="search">${icon('search')}<input id="search" type="search" placeholder="부품 검색" aria-label="부품 또는 모델 검색"/><kbd>/</kbd></label>
      <select id="category" aria-label="부품 종류">${categories.map(c => `<option>${c}</option>`).join('')}</select>
      <div id="parts-list" class="parts-list" tabindex="-1"></div>
      <div class="mobile-part-controls"><select id="mobile-part" aria-label="부품 선택">${parts.map(p => `<option value="${p.id}">${p.number} ${p.name}</option>`).join('')}</select><div class="segmented"><button data-mobile-mode="model" aria-pressed="false">3D</button><button data-mobile-mode="detail" class="active" aria-pressed="true">상세</button></div></div>
    </aside>
    <div class="stage-wrap">
      <div class="stage-top"><strong>CLEANY</strong><div class="stage-actions"><span data-cad-date>CAD · 2026.11.04</span><button id="case-toggle" type="button" aria-pressed="false">${icon('layers')}<span>케이스 벗기기</span></button></div></div>
      <div id="viewer" class="viewer"><div id="loading" class="loading"><div class="loader-orbit"></div><span>CAD 모델 불러오는 중</span></div><div id="tooltip" class="model-tooltip" role="status" hidden></div></div>
      <div class="view-toolbar" aria-label="3D 보기 설정">
        <div class="segmented"><button data-camera="iso" class="active" aria-label="입체 보기">3D</button><button data-camera="front" aria-label="정면 보기">정면</button><button data-camera="side" aria-label="측면 보기">측면</button></div>
        <div class="tool-divider"></div><button id="explode" class="icon-button" aria-label="분해 보기" aria-pressed="false" title="분해 보기">${icon('expand')}</button><button id="labels" class="icon-button active" aria-label="부품 번호 표시" aria-pressed="true" title="부품 번호 표시">${icon('tags')}</button><button id="rotate" class="icon-button" aria-label="자동 회전" aria-pressed="false" title="자동 회전">${icon('rotate-3d')}</button>
      </div>
      <div class="zoom-controls"><button id="zoom-in" class="icon-button" aria-label="확대">${icon('plus')}</button><button id="zoom-out" class="icon-button" aria-label="축소">${icon('minus')}</button><button id="reset" class="icon-button" aria-label="뷰 초기화" title="뷰 초기화">${icon('rotate-ccw')}</button></div>
      <button id="model-info" class="model-info icon-button" aria-label="모델 안내" title="모델 안내">${icon('info')}</button>
    </div>
    <aside id="detail" class="detail-panel" aria-label="선택 부품 상세"></aside>
  </section>
  <section id="table-view" class="table-view" hidden></section>
  <section id="connection-map" class="connection-map" aria-label="부품과 ROS 연결도" hidden></section>
</main>
<dialog id="info-dialog" aria-labelledby="info-title"><div class="dialog-head"><h2 id="info-title">모델과 데이터 기준</h2><button id="close-dialog" class="icon-button" aria-label="안내 닫기">${icon('x')}</button></div><div class="dialog-body"><p>CAD는 <span data-cad-source-date>2026.11.04</span>, ROS는 ${rosEvidence.reviewedAt.replaceAll('-', '.')} 소스 스냅샷입니다. 실시간 로봇 상태를 수신하거나 로봇을 제어하지 않습니다.</p><h3>모델</h3><p>FreeCAD 조립 자세에 양팔, PincOpen 집게, 센서, 바퀴, 외장과 전면 화면을 표시합니다. 케이스 벗기기로 내부 골조와 IMU를 볼 수 있습니다. 배터리, 컴퓨터와 드라이버는 위치 개념으로 표시합니다.</p><h3>사양과 가격</h3><p>확정 수준은 각 부품의 근거 상태에 표시합니다. 판매처 참고가와 견적은 실제 결제 금액과 다릅니다. 미등록 금액은 0원으로 계산하지 않으며 참고 소계는 완성 로봇 가격이 아닙니다.</p><a class="source-link" href="${publicPath('/models/cleany.json')}" target="_blank" rel="noreferrer">모델 데이터 ↗</a></div></dialog>
<div id="toast" class="toast" role="status" hidden></div>
`;
const list = document.querySelector<HTMLDivElement>('#parts-list')!;
const detail = document.querySelector<HTMLElement>('#detail')!;
const tooltip = document.querySelector<HTMLElement>('#tooltip')!;
const dialog = document.querySelector<HTMLDialogElement>('#info-dialog')!;
const connectionMap = mountConnectionMap(document.querySelector('#connection-map')!, id => { detailTab = 'ros'; selectPart(id); }, refreshIcons, toast);
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string): void {
  const element = document.querySelector<HTMLElement>('#toast')!;
  element.textContent = message; element.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 3000);
}
function renderList(): void {
  const filtered = filterParts(category, query);
  list.innerHTML = filtered.length ? filtered.map(part => `<button class="part-row ${part.id === selected ? 'selected' : ''}" data-part="${part.id}" aria-pressed="${part.id === selected}"><span class="part-number">${part.number}</span><span class="part-row-text"><strong>${part.name}</strong></span>${icon('chevron-right')}</button>`).join('') : `<div class="empty-state">${icon('search-x')}<strong>검색 결과가 없어요</strong><p>다른 부품명이나 모델명을 입력해 보세요.</p><button id="clear-search">검색 초기화</button></div>`;
  list.querySelectorAll<HTMLButtonElement>('[data-part]').forEach(button => button.addEventListener('click', () => selectPart(button.dataset.part as PartId)));
  document.querySelector('#clear-search')?.addEventListener('click', () => { query = ''; category = '전체'; (document.querySelector('#search') as HTMLInputElement).value = ''; renderCategories(); renderList(); });
  refreshIcons();
}
function renderCategories(): void {
  document.querySelector<HTMLSelectElement>('#category')!.value = category;
}
function setMobileMode(mode: 'model' | 'detail'): void {
  document.querySelector('.explorer')!.classList.toggle('mobile-model', mode === 'model');
  document.querySelectorAll<HTMLElement>('[data-mobile-mode]').forEach(button => { const active = button.dataset.mobileMode === mode; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}
function renderPartPrice(part: Part): string {
  const { price, includedPrices, referencePrices } = part;
  const combined = price && includedPrices?.length;
  const primaryName = part.id === 'computer' ? 'Jetson 본체' : part.name;
  const lines = combined ? [
    { name: primaryName, price, quantity: price.scope === 'unit' ? Number.parseInt(part.quantity) : 1 },
    ...includedPrices,
  ] : [];
  const breakdown = lines.map(item => `<div><dt>${item.name}</dt><dd>${unitPrice(item.price)} × ${item.quantity}</dd></div>`).join('');
  const references = referencePrices?.map(ref => `<div><dt>${ref.name}</dt><dd>${ref.price ? `${unitPrice(ref.price)} · ${vatLabel(ref.price.vatIncluded)}` : '미등록'}</dd></div>`).join('');
  return `<div class="price-card">
    <span>${combined ? '구성 합계' : price?.basis ?? '부품 가격'}</span>
    <strong>${price ? money(combined ? partSubtotal(part)! : price.amount) : '미등록'}${price && !combined ? `<small>/ ${price.unit}</small>` : ''}</strong>
    ${breakdown ? `<dl class="price-breakdown">${breakdown}</dl>` : ''}
    ${references ? `<span>관련 부품 참고가</span><dl class="price-breakdown">${references}</dl>` : ''}
    ${combined ? `<small>${vatLabel(partVatIncluded(part))} · 배송비 0원 가정</small>` : `<small>${price?.note ?? part.priceNote ?? ''}</small>`}
    ${price?.url && price.basis === '사용자 제공가' ? `<a class="source-link" href="${price.url}" target="_blank" rel="noreferrer">구매처 ↗</a>` : ''}
  </div>`;
}
function renderPriceEvidence(part: Part): string {
  const lines = [
    { name: part.id === 'computer' ? 'Jetson 본체' : part.name, price: part.price },
    ...part.includedPrices ?? [],
    ...part.referencePrices ?? [],
  ];
  return lines.map(({ name, price }, i) => price
    ? `<p><strong>${name} · ${unitPrice(price)}</strong><br>${price.basis} · ${price.note}</p>${priceEvidence(price)}`
    : `<p><strong>${name}</strong><br>${(i === 0 ? part.priceNote : undefined) ?? '가격 미등록'}</p>`).join('');
}
function renderDetail(id: PartId): void {
  const part = byId(id);
  detail.classList.toggle('showing-ros', detailTab === 'ros');
  const specs = `<div class="spec-heading"><h3>핵심 사양</h3><span>${part.quantity}</span></div><dl class="spec-list">${part.specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${renderPartPrice(part)}<div class="provenance"><span>${part.geometry}</span><p>${part.status}</p><button type="button" data-part-evidence>출처 · 가격 기준 ↗</button></div>`;
  detail.innerHTML = `<div class="detail-identity"><div class="inspector-kicker"><span>부품 ${part.number}</span><button class="part-map-link text-button" type="button">연결도 ↗</button></div><h2>${part.name}</h2><p class="model-name">${part.model}</p></div>
    <div class="detail-tabs" role="tablist" aria-label="부품 상세 보기">
      <button id="detail-tab-specs" role="tab" data-detail-tab="specs" aria-selected="${detailTab === 'specs'}" aria-controls="detail-content" tabindex="${detailTab === 'specs' ? 0 : -1}">사양 · 가격</button>
      <button id="detail-tab-ros" role="tab" data-detail-tab="ros" aria-selected="${detailTab === 'ros'}" aria-controls="detail-content" tabindex="${detailTab === 'ros' ? 0 : -1}">ROS <span>${endpointsForPart(id).length}</span></button>
    </div>
    <section id="detail-content" role="tabpanel" aria-labelledby="detail-tab-${detailTab}" class="${detailTab === 'ros' ? 'ros-content' : 'spec-content'}">${detailTab === 'specs' ? specs : ''}</section>`;
  detail.querySelector('.part-map-link')!.addEventListener('click', () => { setView('connections'); connectionMap.selectPart(id); });
  detail.querySelector('[data-part-evidence]')?.addEventListener('click', () => showDetails(`${part.name} · 근거`, `<p>${part.geometry} · ${part.status}</p><a class="source-link" href="${publicPath(part.source)}" target="_blank" rel="noreferrer">사양 출처 ↗</a><h3>가격 기준</h3>${renderPriceEvidence(part)}`));
  const switchDetailTab = (next: typeof detailTab) => { detailTab = next; renderDetail(selected); detail.querySelector<HTMLElement>(`#detail-tab-${next}`)?.focus(); };
  detail.querySelectorAll<HTMLButtonElement>('[data-detail-tab]').forEach(button => {
    button.addEventListener('click', () => switchDetailTab(button.dataset.detailTab as typeof detailTab));
    button.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        switchDetailTab(event.key === 'Home' ? 'specs' : event.key === 'End' ? 'ros' : detailTab === 'ros' ? 'specs' : 'ros');
      }
    });
  });
  if (detailTab === 'ros') mountRosPanel(detail.querySelector('#detail-content')!, id, toast);
  refreshIcons();
}
function selectPart(id: PartId): void {
  const assembly = byId(id).assembly;
  if (assembly === 'interior' && !caseRemoved) setCaseRemoved(true);
  if (assembly === 'cover' && caseRemoved) setCaseRemoved(false);
  selected = id; viewer?.select(id); renderList(); renderDetail(id);
  if (view !== 'explore') setView('explore');
  document.querySelector<HTMLSelectElement>('#mobile-part')!.value = id;
  setMobileMode('detail');
}
function setView(next: typeof view): void {
  view = next;
  history.replaceState(null, '', next === 'explore' ? location.pathname : `#${next}`);
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  (document.querySelector('.explorer') as HTMLElement).hidden = view !== 'explore';
  const table = document.querySelector<HTMLElement>('#table-view')!; table.hidden = view !== 'specs' && view !== 'cost';
  document.querySelector<HTMLElement>('#connection-map')!.hidden = view !== 'connections';
  viewer?.setActive(view === 'explore');
  if (view === 'explore') viewerLoading ??= loadViewer();
  if (view === 'specs' || view === 'cost') renderTable();
  if (view === 'connections') connectionMap.refresh();
}
function renderTable(): void {
  const subtotal = referenceSubtotal(parts);
  const table = document.querySelector<HTMLElement>('#table-view')!;
  table.innerHTML = `<div class="table-heading"><div><h1>${view === 'cost' ? '부품 비용' : '전체 사양'}</h1></div><button class="download-button">${icon('download')} 부품표 CSV</button></div>${view === 'cost' ? `<div class="cost-summary"><div><span>부품 참고 소계</span><strong>${subtotal.known ? money(subtotal.amount) : '산출 전'}</strong><small>모터 추정가 포함 · 배송비 0원 가정</small></div><div><span>가격 등록</span><strong>${subtotal.known}<em> / ${parts.length} 구성 그룹</em></strong><small>${subtotal.unknown}개 그룹 가격 미등록 · 모터 추정 포함</small></div><div><span>가격 기준</span><strong class="cost-date">${latestPriceDate.replaceAll('-', '.')}</strong><small>사용자 제공가 · 판매처 참고가 · 모터 추정가</small></div></div>` : ''}<div class="table-scroll"><table><thead><tr><th>구성 부품</th><th>모델 / 구성</th><th>수량</th><th>${view === 'cost' ? '단가 / 세트가' : '핵심 사양'}</th><th>${view === 'cost' ? '소계 / 가격 기준' : '근거 상태'}</th><th><span class="sr-only">상세</span></th></tr></thead><tbody>${parts.map(part => `<tr><td><button class="table-part" data-select="${part.id}"><span>${part.number}</span>${part.name}</button></td><td>${part.model}</td><td>${part.quantity}</td><td>${view === 'cost' ? part.price ? `${unitPrice(part.price)}${part.includedPrices?.map(item => `<small>${item.name} ${unitPrice(item.price)} × ${item.quantity}</small>`).join('') ?? ''}` : '<span class="unregistered">미등록</span>' : part.specs[0][1]}</td><td>${view === 'cost' ? part.price ? `${money(partSubtotal(part)!)}<small>${part.includedPrices?.length ? '부속품 포함' : part.price.basis} · ${vatLabel(partVatIncluded(part))}</small>` : '<span class="unregistered">견적 확인 필요</span>' : `<span class="status-pill">${part.status}</span>`}</td><td><button class="icon-button" data-select="${part.id}" aria-label="${part.name} 3D 보기">${icon('arrow-up-right')}</button></td></tr>`).join('')}</tbody></table></div><p class="table-note">${icon('info')} ${view === 'cost' ? 'Pan·Tilt는 시뮬레이션 기준, 양팔은 사용자 확인 수량의 모터 비용. 프레임은 프로파일 비용만 포함.' : '초안 사양은 최종 실장 확인이 필요합니다.'}</p>`;
  table.querySelectorAll<HTMLElement>('[data-select]').forEach(button => button.addEventListener('click', () => selectPart(button.dataset.select as PartId)));
  table.querySelector('.download-button')?.addEventListener('click', download);
  refreshIcons();
}
function download(): void {
  const url = URL.createObjectURL(new Blob([csvCatalog()], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cleany-components-${latestPriceDate}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('부품표 CSV를 내려받았습니다.');
}
function modelStatus(message: string, error = false): void {
  const element = document.querySelector<HTMLElement>('#loading')!;
  if (message === '모델 준비 완료') { element.hidden = true; return; }
  element.hidden = false;
  if (error) { element.classList.add('load-error'); element.innerHTML = `${icon('box')}<strong>3D 모델을 표시할 수 없어요</strong><p>${message}</p><button id="retry-model">페이지 새로고침</button>`; document.querySelector('#retry-model')?.addEventListener('click', () => window.location.reload()); refreshIcons(); }
  else element.querySelector('span')!.textContent = message;
}
renderList(); renderDetail(selected);
document.querySelector<HTMLInputElement>('#search')!.addEventListener('input', event => { query = (event.target as HTMLInputElement).value; renderList(); });
document.querySelector<HTMLSelectElement>('#category')!.addEventListener('change', event => { category = (event.target as HTMLSelectElement).value as Category; renderList(); });
document.querySelector<HTMLSelectElement>('#mobile-part')!.value = selected;
document.querySelector<HTMLSelectElement>('#mobile-part')!.addEventListener('change', event => selectPart((event.target as HTMLSelectElement).value as PartId));
document.querySelectorAll<HTMLElement>('[data-mobile-mode]').forEach(button => button.addEventListener('click', () => setMobileMode(button.dataset.mobileMode as 'model' | 'detail')));
document.querySelectorAll<HTMLElement>('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view as typeof view)));
document.querySelectorAll<HTMLElement>('[data-select]').forEach(button => button.addEventListener('click', () => selectPart(button.dataset.select as PartId)));
document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => button.addEventListener('click', () => { cameraView = button.dataset.camera as typeof cameraView; viewer?.setView(cameraView); document.querySelectorAll('[data-camera]').forEach(item => item.classList.toggle('active', item === button)); updateRotationButton(); }));
const toggleButton = (id: string, value: boolean) => { const button = document.querySelector(`#${id}`)!; button.classList.toggle('active', value); button.setAttribute('aria-pressed', String(value)); };
const updateRotationButton = () => toggleButton('rotate', viewer?.autoRotate ?? false);
function setCaseRemoved(value: boolean): void {
  caseRemoved = value;
  viewer?.setCaseRemoved(value);
  toggleButton('case-toggle', value);
  document.querySelector('#case-toggle span')!.textContent = value ? '케이스 씌우기' : '케이스 벗기기';
}
document.querySelector('#case-toggle')!.addEventListener('click', () => setCaseRemoved(!caseRemoved));
document.querySelector('#explode')!.addEventListener('click', () => { exploded = !exploded; viewer?.setExploded(exploded); toggleButton('explode', exploded); toast(exploded ? '분해 보기 · 구성 그룹 사이를 벌려 표시합니다.' : '조립 보기로 돌아왔습니다.'); });
document.querySelector('#labels')!.addEventListener('click', () => { labels = !labels; viewer?.setLabels(labels); toggleButton('labels', labels); });
document.querySelector('#rotate')!.addEventListener('click', () => { viewer?.setAutoRotate(!viewer.autoRotate); updateRotationButton(); });
document.querySelector('#zoom-in')!.addEventListener('click', () => viewer?.zoom(1));
document.querySelector('#zoom-out')!.addEventListener('click', () => viewer?.zoom(-1));
document.querySelector('#reset')!.addEventListener('click', () => { cameraView = 'iso'; viewer?.setView(cameraView); exploded = false; viewer?.setExploded(false); toggleButton('explode', false); updateRotationButton(); document.querySelectorAll<HTMLElement>('[data-camera]').forEach(button => button.classList.toggle('active', button.dataset.camera === 'iso')); });
['model-info', 'sources-button'].forEach(id => document.querySelector(`#${id}`)!.addEventListener('click', () => dialog.showModal()));
document.querySelector('#close-dialog')!.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
document.addEventListener('keydown', event => {
  if (event.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  if (view === 'connections') connectionMap.focusSearch();
  else { setView('explore'); document.querySelector<HTMLElement>(window.innerWidth <= 900 ? '#mobile-part' : '#search')!.focus(); }
});
async function loadViewer(): Promise<void> {
  try {
    const { RobotViewer } = await import('./viewer');
    if (disposed) return;
    viewer = new RobotViewer(document.querySelector('#viewer')!, (id, x, y) => {
      updateRotationButton();
      if (!id) { tooltip.hidden = true; return; }
      const part = byId(id); tooltip.hidden = false;
      tooltip.innerHTML = `<span>${part.number} / ${part.english}</span><strong>${part.name}</strong><p>${part.specs[0][1]}<b>${part.price ? money(part.includedPrices?.length ? partSubtotal(part)! : part.price.amount) : '가격 미등록'}</b></p><small>${part.includedPrices?.length ? '구성 합계' : part.price?.basis ?? '클릭하여 상세 보기'}${part.geometry === '위치 개념 표시' ? ' · 위치 개념' : ''}</small>`;
      const host = document.querySelector<HTMLElement>('#viewer')!;
      tooltip.style.left = `${Math.min(Math.max(12, (x ?? 0) + 20), host.clientWidth - 250)}px`;
      tooltip.style.top = `${Math.min(Math.max(20, (y ?? 0) - 40), host.clientHeight - 155)}px`;
    }, selectPart, modelStatus);
    viewer.select(selected);
    viewer.setActive(view === 'explore');
    viewer.setView(cameraView); viewer.setExploded(exploded); viewer.setLabels(labels); viewer.setCaseRemoved(caseRemoved);
    await viewer.load().catch(error => { console.error(error); modelStatus('모델 파일을 불러오지 못했습니다. 부품 목록에서 사양과 가격을 계속 확인할 수 있습니다.', true); });
  } catch (error) {
    console.error(error); modelStatus('WebGL을 지원하는 브라우저에서 다시 열어주세요. 부품 목록은 계속 사용할 수 있습니다.', true);
  }
}
const initialView = location.hash.slice(1);
setView(initialView === 'connections' || initialView === 'specs' || initialView === 'cost' ? initialView : 'explore');
window.addEventListener('ros-flow-action', event => {const endpoint=filterEndpoints().find(e=>e.id===(event as CustomEvent<string>).detail);if(endpoint){setView('connections');connectionMap.showAction(endpoint);}});
window.addEventListener('pagehide', () => { disposed = true; viewer?.dispose(); connectionMap.dispose(); });
refreshIcons();
