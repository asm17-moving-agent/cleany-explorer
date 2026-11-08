import { executionFlow, flowLabels, flowProfiles, type FlowId, type ExecutionFlow } from './ros-relations.ts';
import { filterEndpoints, kindLabels, rosEvidence, environmentText, type Environment, type RosEndpoint } from './ros.ts';
import { escapeHtml, openEndpoint } from './ros-panel.ts';
import { showDetails } from './dialog.ts';
import './flow-map.css';

const kindLetter = {topic:'T',service:'S',action:'A'};
const color = {topic:'#27744e',service:'#9b6b19',action:'#7953a5'};
export function mountFlowMap(host: HTMLElement, notify: (text: string)=>void) {
  let environment: Environment = 'all', id: FlowId = 'manipulation', profileId = 'real';
  let actionId = 'action:/manipulation/execute_skill', side: 'left'|'right' = 'left';
  let selected = 'execute', selectedEdge = -1, frame = 0;
  let flow: ExecutionFlow;
  host.innerHTML = `<nav class="flow-tabs" aria-label="실행 흐름 선택">${Object.entries(flowLabels).map(([key,label])=>`<button type="button" data-flow="${key}">${label}</button>`).join('')}</nav><div class="flow-workspace"><section class="flow-pane" aria-label="토픽 서비스 액션 실행 흐름"><header class="flow-heading"><div><span>CODE FLOW</span><h2></h2></div><div class="flow-profiles" aria-label="실행 구성"></div></header><div class="flow-board"></div><footer class="flow-footer"><div><b class="topic">T 토픽</b><b class="service">S 서비스</b><b class="action">A 액션</b><span>점선: 조건부·자동 계약</span></div><p></p></footer></section><aside class="flow-inspector" aria-label="선택 인터페이스와 연결 근거"></aside></div>`;
  const board = host.querySelector<HTMLElement>('.flow-board')!;
  const inspector = host.querySelector<HTMLElement>('.flow-inspector')!;
  const current = () => flow.nodes.find(n=>n.id===selected) ?? flow.nodes[0];
  function inspect() {
    const node = current(), e = node.endpoint;
    const peers = (items: typeof e.producers) => [...new Set(items.map(p=>p.name))].map(p=>`<code title="${escapeHtml(p)}">${escapeHtml(p)}</code>`).join('') || '<span>미지정</span>';
    const related = flow.edges.map((edge,i)=>({edge,i})).filter(({edge})=>edge.from===node.id||edge.to===node.id);
    const edge = flow.edges[selectedEdge];
    const actions = id === 'action' ? filterEndpoints({environment:flow.profile.environment,kind:'action',scope:'application'}) : [];
    const relatedHtml = id==='action' ? '' : `<div class="flow-related"><h4>연결된 흐름 <span>${related.length}</span></h4>${related.map(({edge,i})=>`
      <button type="button" data-flow-edge="${i}" aria-pressed="${selectedEdge===i}"><span>${edge.from===node.id?'→':'←'}</span><strong>${edge.label}</strong><small>${flow.nodes.find(n=>n.id===(edge.from===node.id?edge.to:edge.from))!.label}</small></button>`).join('')}</div>`;
    const actionPicker = actions.length ? `<div class="flow-action-picker"><h4>다른 액션 <span>${actions.length}</span></h4><div>${actions.map(a=>`
      <button type="button" data-flow-action="${escapeHtml(a.id)}" aria-pressed="${a.id===e.id || a.id===e.parentAction}" title="${escapeHtml(a.name)}">${escapeHtml(a.name.replace(/^\//,'').replaceAll('_controller/follow_joint_trajectory','').replaceAll('manipulation/','조작/').replaceAll('perception/','인식/'))}</button>`).join('')}</div></div>` : '';
    inspector.innerHTML = `
      <div class="flow-inspector-top"><span class="net-kind-dot ${e.kind}">${kindLetter[e.kind]}</span><strong>${kindLabels[e.kind]}</strong><span class="net-env">${environmentText(e)}</span></div>
      <h3>${node.label}</h3><code class="flow-selected-name">${escapeHtml(e.name).replaceAll('/', '/<wbr>')}</code>
      <p class="flow-type">${escapeHtml(e.type).replaceAll('/', '/<wbr>')}</p>
      ${node.derived?'<p class="flow-contract-note">ROS 자동 계약 · 실행 인스턴스 미확인</p>':''}
      <div class="flow-peer-grid"><div><small>${e.kind==='topic'?'발행':'제공'}</small>${peers(e.producers)}</div><div><small>${e.kind==='topic'?'구독':'호출'}</small>${peers(e.consumers)}</div></div>
      <button type="button" class="flow-detail-button" data-flow-detail>전체 상세 · 출처 ↗</button>
      ${relatedHtml}
      ${edge?`<div class="flow-condition"><strong>${edge.label}</strong><p>${escapeHtml(edge.condition)}</p><button type="button" class="text-button" data-flow-proof>코드 근거 ${edge.sources.length}개 ↗</button></div>`:''}
      ${actionPicker}`;
    inspector.scrollTop=0;
  }
  function draw() {
    if (!flow || !board.clientWidth || !host.getBoundingClientRect().height) return;
    const box = board.getBoundingClientRect();
    const ports = new Map<string,string[]>();
    const positioned = flow.edges.map((edge,i)=>{
      const a = flow.nodes.find(n=>n.id===edge.from)!, b = flow.nodes.find(n=>n.id===edge.to)!;
      const vertical = a.column===b.column, forward = vertical ? a.row<b.row : a.column<b.column;
      const fromSide = vertical ? forward?'bottom':'top' : forward?'right':'left';
      const toSide = vertical ? forward?'top':'bottom' : forward?'left':'right';
      for (const [node,side,end] of [[a,fromSide,'a'],[b,toSide,'b']] as const) {
        const key=node.id+':'+side, list=ports.get(key)??[]; list.push(`${i}:${end}`);ports.set(key,list);
      }
      return {edge,i,a,b,vertical,fromSide,toSide};
    });
    const port = (node: typeof flow.nodes[number], side: string, key: string):[number,number] => {
      const r=board.querySelector<HTMLElement>(`[data-flow-node="${node.id}"]`)!.getBoundingClientRect();
      const list=ports.get(node.id+':'+side)!, offset=(list.indexOf(key)-(list.length-1)/2)*12;
      return side==='left'||side==='right' ? [(side==='left'?r.left:r.right)-box.left,r.top+r.height/2-box.top+offset] : [r.left+r.width/2-box.left+offset,(side==='top'?r.top:r.bottom)-box.top];
    };
    board.querySelector('svg')!.innerHTML = `<defs>${Object.entries(color).map(([kind,value])=>`<marker id="flow-arrow-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9 z" fill="${value}"/></marker>`).join('')}</defs>`+positioned.map(({edge,i,a,b,vertical,fromSide,toSide})=>{
      const [x1,y1]=port(a,fromSide,`${i}:a`), [x2,y2]=port(b,toSide,`${i}:b`);
      const c1 = vertical ? [x1,(y1+y2)/2] : [(x1+x2)/2,y1];
      const c2 = vertical ? [x2,(y1+y2)/2] : [(x1+x2)/2,y2];
      const path=`M ${x1} ${y1} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${x2} ${y2}`;
      const x=(x1+3*c1[0]+3*c2[0]+x2)/8, y=(y1+3*c1[1]+3*c2[1]+y2)/8;
      const active = selectedEdge===i || selectedEdge<0 && (edge.from===selected||edge.to===selected);
      const kind=b.endpoint.kind;
      return `<g class="flow-edge ${active?'active':''} ${edge.conditional||edge.reference?'conditional':''}" data-flow-edge="${i}" tabindex="0" role="button" aria-label="${edge.label}: ${a.label} ${edge.reference?'↔':'→'} ${b.label}" style="--edge-color:${color[kind]}"><path class="flow-edge-hit" d="${path}"/><path class="flow-edge-line" d="${path}" ${edge.reference?'':`marker-end="url(#flow-arrow-${kind})"`}/><rect x="${x-edge.label.length*4.7-7}" y="${y-10}" width="${edge.label.length*9.4+14}" height="20" rx="4"/><text x="${x}" y="${y+3.5}" text-anchor="middle">${edge.label}</text></g>`;
    }).join('');
    board.querySelector('svg')!.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  }
  function schedule() { cancelAnimationFrame(frame);frame=requestAnimationFrame(draw); }
  function render() {
    if (!flowProfiles(id,environment).length) id='manipulation';
    const profiles=flowProfiles(id,environment), profile=profiles.find(p=>p.id===profileId)??profiles[0];
    profileId=profile.id; flow=executionFlow(id,profile,actionId,side);
    if (!flow.nodes.some(n=>n.id===selected)) selected=flow.nodes[0].id;
    host.querySelectorAll<HTMLButtonElement>('[data-flow]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.flow===id));b.disabled=!flowProfiles(b.dataset.flow as FlowId,environment).length;});
    host.querySelector('.flow-heading h2')!.textContent=flow.title;
    host.querySelector('.flow-profiles')!.innerHTML=profiles.map(p=>`<button type="button" data-flow-profile="${p.id}" aria-pressed="${p.id===profileId}">${p.label}</button>`).join('')+(id==='wrist'?`<div class="flow-side">${(['left','right'] as const).map(s=>`<button type="button" data-flow-side="${s}" aria-pressed="${s===side}">${s==='left'?'왼쪽':'오른쪽'}</button>`).join('')}</div>`:'');
    board.innerHTML=`<svg class="flow-lines" aria-label="인터페이스 사이 호출·발행 관계"></svg>`+flow.nodes.map(n=>`<button type="button" data-flow-node="${n.id}" class="flow-node ${n.endpoint.kind} ${n.derived?'derived':''}" aria-pressed="${n.id===selected}" style="grid-column:${n.column};grid-row:${n.row}"><span><b>${kindLetter[n.endpoint.kind]}</b>${kindLabels[n.endpoint.kind]}${n.derived?'<em>자동 계약</em>':''}</span><strong>${n.label}</strong><code>${escapeHtml(n.endpoint.name).replaceAll('/', '/<wbr>')}</code></button>`).join('');
    host.querySelector('.flow-footer p')!.textContent=flow.note;
    host.querySelector('.flow-footer>div>span')!.textContent=id==='manipulation'?'점선: 같은 실행 기록 참조':id==='action'?'점선 카드: ROS 자동 계약':'점선: 조건부 경로';
    inspect();schedule();
  }
  function selectEdge(i: number, follow = false) {
    const edge = flow.edges[i];
    selectedEdge = i;
    selected = follow && selected === edge.from ? edge.to : edge.from;
    board.querySelectorAll('[data-flow-node]').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-flow-node')===selected)));
    inspect();schedule();
  }
  host.addEventListener('click',event=>{
    const el=(event.target as Element).closest<HTMLElement>('[data-flow],[data-flow-node],[data-flow-edge],[data-flow-profile],[data-flow-side],[data-flow-detail],[data-flow-proof],[data-flow-action]');
    if (!el) return;
    event.stopPropagation();
    if (el.dataset.flowNode) {selected=el.dataset.flowNode;selectedEdge=-1;board.querySelectorAll('[data-flow-node]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));inspect();schedule();return;}
    if (el.dataset.flowEdge!==undefined) {
      const follow = inspector.contains(el);
      const restoreFocus = follow && document.activeElement === el;
      selectEdge(Number(el.dataset.flowEdge), follow);
      if (restoreFocus) inspector.querySelector<HTMLElement>(`[data-flow-edge="${el.dataset.flowEdge}"]`)?.focus({preventScroll:true});
      return;
    }
    if (el.hasAttribute('data-flow-detail')) {openEndpoint(current().endpoint,current().derived?'ROS 자동 생성 계약 · 실시간 확인 아님':'',notify);return;}
    if (el.hasAttribute('data-flow-proof')) {
      const edge=flow.edges[selectedEdge];
      showDetails('연결 근거 · '+edge.label,`<p>${escapeHtml(edge.condition)}</p><div class="ros-source-links">${edge.sources.map(key=>{const s=rosEvidence.sources[key];return `<a href="${s.href}" target="_blank" rel="noreferrer">${escapeHtml(s.path)} ↗</a>`;}).join('')}</div>`);return;
    }
    if (el.dataset.flow) {id=el.dataset.flow as FlowId;selected='';}
    if (el.dataset.flowProfile) profileId=el.dataset.flowProfile;
    if (el.dataset.flowSide) side=el.dataset.flowSide as typeof side;
    if (el.dataset.flowAction) {actionId=el.dataset.flowAction;selected='parent';}
    selectedEdge=-1;render();
  });
  host.addEventListener('keydown',event=>{const el=(event.target as Element).closest<HTMLElement>('g[data-flow-edge]');if(el&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectEdge(Number(el.dataset.flowEdge));}});
  const observer=new ResizeObserver(schedule);observer.observe(board);
  return {
    render(next: Environment) {environment=next;selectedEdge=-1;render();},
    showAction(endpoint: RosEndpoint) {
      id='action';actionId=endpoint.parentAction??endpoint.id;selected='parent';selectedEdge=-1;
      const profile=flowProfiles(id,environment).find(p=>filterEndpoints({environment:p.environment}).some(e=>e.id===actionId));
      if(profile)profileId=profile.id;
      render();
    },
    dispose() {observer.disconnect();cancelAnimationFrame(frame);},
  };
}
