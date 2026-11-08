export type PartId = 'head-camera' | 'head-pan' | 'head-tilt' | 'left-arm' | 'right-arm' | 'wrist-camera' | 'frame' | 'wheels' | 'motors' | 'computer' | 'lidar' | 'drivers' | 'display' | 'case' | 'battery' | 'imu';
export type Category = '전체' | '헤드 구동부' | '매니퓰레이터' | '인지 센서' | '이동 플랫폼' | '컴퓨팅';
export interface Price {
  amount: number;
  basis: '판매처 참고가' | '견적' | '사용자 제공가' | '모터 추정가';
  unit: string;
  scope: 'unit' | 'group';
  vatIncluded: boolean | null;
  date: string;
  url: string | null;
  note: string;
}
export interface Part {
  id: PartId;
  number: string;
  name: string;
  english: string;
  model: string;
  category: Category;
  description: string;
  icon: string;
  quantity: string;
  specs: [string, string][];
  status: string;
  geometry: 'CAD 모델' | '위치 개념 표시';
  assembly?: 'cover' | 'interior';
  source: string;
  price: Price | null;
  priceNote?: string;
  includedPrices?: { name: string; price: Price; quantity: number }[];
  referencePrices?: { name: string; price: Price | null }[];
}
const kb = 'https://github.com/asm17-moving-agent/cleany-docs/blob/d71ba851b00d99e70aff7f60f74f06fd5eb7821a/20_TECHNICAL/12%20-%20Hardware%20Configuration.md';
const robot = '/models/cleany.json';
const cadBranch = 'https://github.com/asm17-moving-agent/cleany/blob/2178772352ea293d926b80849d0878c3c0a15ed3';
const suppliedPrice = (amount: number, unit = '대', scope: Price['scope'] = 'unit'): Price => ({
  amount, basis: '사용자 제공가', unit, scope, vatIncluded: true, date: '2026-11-01', url: null,
  note: scope === 'group' ? 'VAT 포함 · 4개 세트 총액으로 반영 · 배송비 0원 가정' : 'VAT 포함 · 사용자 제공 금액 · 배송비 0원 가정',
});
const purchasePrice = (amount: number, unit: string, details: Partial<Pick<Price, 'scope' | 'url' | 'note' | 'date'>> = {}): Price => ({
  amount, unit, basis: '사용자 제공가', scope: 'unit', vatIncluded: true,
  date: '2026-11-06', url: null, note: '사용자 제공 금액 · VAT 포함 · 배송비 0원 가정', ...details,
});
const wristPurchase = 'https://smartstore.naver.com/roboseasy/products/12605183674';
const batteryPurchase = 'https://gspmall.com/product/%EA%B5%AD%EB%82%B4%EC%83%9D%EC%82%B0-gsp-%EB%A6%AC%ED%8A%AC%EC%9D%B8%EC%82%B0%EC%B2%A0-%EC%A0%84%EB%8F%99%ED%9C%A0%EC%B2%B4%EC%96%B4-%EB%B0%B0%ED%84%B0%EB%A6%AC-12v-42a/348/category/158/display/1/';
const servo3215 = purchasePrice(39600, '개');
const servo3250: Price = { amount: 143000, basis: '판매처 참고가', unit: '개', scope: 'unit', vatIncluded: true, date: '2026-11-08', url: 'https://www.eleparts.co.kr/goods/view?no=19159048', note: 'FEETECH ST-3250-C001 · VAT 포함 · 해외 주문 · 배송비 0원 가정 · 기타 추가 비용 미확인' };
const simulationModel = 'https://github.com/asm17-moving-agent/cleany/blob/707538de9d28291c679fcfd954f5587368d5a460/ros2_ws/src/cleany_description/mjcf/cleany.xml';
const motorEstimate = (amount: number, note: string): Price => ({
  amount, basis: '모터 추정가', unit: '모터 구성', scope: 'group', vatIncluded: true, date: '2026-11-08', url: null, note: `${note} · VAT 포함`,
});
const servoPrices: NonNullable<Part['referencePrices']> = [
  { name: 'STS3215', price: servo3215 },
  { name: 'STS3250', price: servo3250 },
];
export const parts: Part[] = [
  { id: 'head-camera', number: '01', name: '헤드 카메라', english: 'HEAD VISION', model: 'Intel RealSense D435', category: '인지 센서', icon: 'scan-eye', quantity: '1대', description: '공간을 보고, 물체까지의 깊이를 읽습니다. 작업 영역의 RGB-D 관측을 담당하는 끌리니의 눈입니다.', specs: [['센서 유형', 'RGB + Depth'], ['장착 구조', 'Pan / Tilt 2축'], ['역할', '작업 공간 3D 관측'], ['모델 근거', '헤드 CAD / URDF']], status: '모델명: KB 초안', geometry: 'CAD 모델', source: kb, price: suppliedPrice(572000) },
  { id: 'head-pan', number: '02', name: '헤드 Pan', english: 'HEAD PAN', model: 'Pan · 좌우 회전', category: '헤드 구동부', icon: 'rotate-3d', quantity: '1식', description: '헤드의 좌우 방향을 바꾸는 회전축입니다.', specs: [['동작', '좌우 회전 · 1축'], ['모터 구성', 'STS3215 × 1 (시뮬레이션)'], ['형상 기준', 'FreeCAD 조립 자세'], ['기존 ROS 관절', 'head_pan_joint'], ['선택 범위', '모터 + 하우징 + 회전 브라켓']], status: '형상: FreeCAD 배치 초안', geometry: 'CAD 모델', source: simulationModel, price: motorEstimate(servo3215.amount, 'STS3215 × 1 · 시뮬레이션 기준 · 기구부 제외 · 실장 미확인'), referencePrices: [servoPrices[0]] },
  { id: 'head-tilt', number: '03', name: '헤드 Tilt', english: 'HEAD TILT', model: 'Tilt · 상하 회전', category: '헤드 구동부', icon: 'rotate-3d', quantity: '1식', description: '카메라의 상하 방향을 바꾸는 회전축입니다.', specs: [['동작', '상하 회전 · 1축'], ['모터 구성', 'STS3215 × 1 (시뮬레이션)'], ['형상 기준', 'FreeCAD 조립 자세'], ['기존 ROS 관절', 'head_tilt_joint'], ['선택 범위', 'Tilt 모터 + 카메라 브라켓']], status: '형상: FreeCAD 배치 초안', geometry: 'CAD 모델', source: simulationModel, price: motorEstimate(servo3215.amount, 'STS3215 × 1 · 시뮬레이션 기준 · 기구부 제외 · 실장 미확인'), referencePrices: [servoPrices[0]] },
  ...(['left', 'right'] as const).map((side, i): Part => ({ id: `${side}-arm`, number: `0${i + 4}`, name: `${side === 'left' ? '왼쪽' : '오른쪽'} 매니퓰레이터`, english: `${side.toUpperCase()} MANIPULATOR`, model: 'FreeCAD 매니퓰레이터 · PincOpen · Feetech', category: '매니퓰레이터', icon: 'workflow', quantity: '1식', description: '어깨에서 그리퍼까지 이어지는 정교한 움직임. 물체에 접근하고, 집고, 옮기는 작업을 담당합니다.', specs: [['관절 구성', '5축 + 그리퍼'], ['STS3215', '4개 · 어깨 회전, 손목 2축, 그리퍼'], ['STS3250', '2개 · 어깨 들기, 팔꿈치'], ['그리퍼', 'PincOpen'], ['형상 기준', 'FreeCAD 조립 자세']], status: '형상: FreeCAD 배치 초안 / 모터 수량: 사용자 확인 / 관절별 배치: 시뮬레이션 기준', geometry: 'CAD 모델', source: simulationModel, price: motorEstimate(servo3215.amount * 4 + servo3250.amount * 2, 'STS3215 × 4 + STS3250 × 2 · 수량 사용자 확인 · 팔 기구부 제외'), referencePrices: servoPrices })),
  { id: 'wrist-camera', number: '06', name: '손목 카메라', english: 'WRIST VISION', model: 'SO-ARM USB Camera', category: '인지 센서', icon: 'camera', quantity: '2대', description: '집기 직전의 작은 차이를 가까이에서 봅니다. 그리퍼 주변의 영상과 파지 상태를 관측합니다.', specs: [['해상도', '2 MP (KB 초안)'], ['프레임 레이트', '30 FPS (KB 초안)'], ['인터페이스', 'USB'], ['마운트', 'FreeCAD 조립 형상'], ['구매 구성', 'Wrist 카메라홀더 + 카메라모듈 2개']], status: '형상: FreeCAD 배치 초안 / 제품 사양: 초안', geometry: 'CAD 모델', source: kb, price: purchasePrice(676830, '구매 묶음', { scope: 'group', url: wristPurchase, note: 'Wrist 카메라홀더 + 카메라모듈 2개 구매 합계 · VAT 포함 · 배송비 0원 가정' }) },
  { id: 'frame', number: '07', name: '알루미늄 프레임', english: 'STRUCTURAL FRAME', model: 'Custom aluminum profile', category: '이동 플랫폼', icon: 'box', quantity: '1식', description: '센서와 양팔, 구동부를 하나로 연결하는 구조. 현재 구현 저장소의 조립 형상을 그대로 살펴보세요.', specs: [['구조', '알루미늄 프로파일'], ['기둥 길이', '560 mm (FreeCAD)'], ['모델', 'FreeCAD 내부 골조'], ['치수 기준', '모델 좌표 · 실측 별도']], status: '현재 CAD 스냅샷', geometry: 'CAD 모델', source: robot, price: purchasePrice(87000, '프로파일', { scope: 'group', date: '2026-11-08', note: '프로파일 비용 · VAT 포함 · 전체 프레임 제작비 미확인 · 배송비 0원 가정' }) },
  { id: 'wheels', number: '08', name: '메카넘 휠', english: 'OMNIDIRECTIONAL BASE', model: '127 mm Mecanum Wheel', category: '이동 플랫폼', icon: 'circle-dot', quantity: '4개', description: '앞뒤 이동부터 옆으로 비켜가기까지. 네 바퀴를 각각 제어하는 전방향 이동 베이스입니다.', specs: [['구성', '4륜 메카넘'], ['휠 지름', '127 mm (KB 초안)'], ['운동', '전후 / 좌우 / 제자리 회전'], ['구동', '휠별 독립 모터']], status: '4륜 구성 채택 / 규격: KB 초안', geometry: 'CAD 모델', source: kb, price: suppliedPrice(179520, '4개 세트', 'group') },
  { id: 'motors', number: '09', name: '휠 구동 모터', english: 'DRIVE MOTORS', model: 'PG42-4266-1270NE', category: '이동 플랫폼', icon: 'cog', quantity: '4개', description: '각 휠에 동력을 전달하고 회전을 측정합니다. 엔코더의 피드백은 이동 거리와 속도를 계산하는 데 사용됩니다.', specs: [['정격 전압', '12 V'], ['감속비', '1 / 61'], ['엔코더', '2채널 · 13 PPR'], ['수량', '4개 (KB 초안)']], status: '모델 CAD / 제품 구성: KB 초안', geometry: 'CAD 모델', source: kb, price: { amount: 88800, basis: '판매처 참고가', unit: '개', scope: 'unit', vatIncluded: true, date: '2026-10-26', url: 'https://www.motorbank.kr/goods/goods_view.php?goodsNo=1000035837', note: '1/61 옵션 포함 · VAT 포함 · 어댑터 별도 · 배송비 0원 가정' }, includedPrices: [{ name: '모터 브라켓', price: purchasePrice(7260, '개'), quantity: 4 }] },
  { id: 'computer', number: '10', name: '엣지 컴퓨터', english: 'EDGE COMPUTING', model: 'Jetson Orin NX 16GB', category: '컴퓨팅', icon: 'cpu', quantity: '1대', description: '보고, 판단하고, 움직임을 계획하는 로봇의 두뇌. 센서 처리와 ROS 2 기반 제어를 로봇 내부에서 실행합니다.', specs: [['메모리', '16 GB'], ['플랫폼 후보', 'Seeed reComputer J4012'], ['저장장치', '128 GB NVMe (KB 초안)'], ['역할', '센서 처리 / 인식 / 제어'], ['무선랜카드', 'BE200 Wi-Fi 7 Kit']], status: 'Orin NX 채택 / 개발 키트: 초안', geometry: '위치 개념 표시', assembly: 'interior', source: kb, price: purchasePrice(2640000, '대'), includedPrices: [{ name: 'BE200 Wi-Fi 7 Kit 무선랜카드', price: purchasePrice(47850, '개'), quantity: 1 }] },
  { id: 'lidar', number: '11', name: '2D 라이다', english: 'SPATIAL SENSING', model: 'RPLIDAR A1M8-R6', category: '인지 센서', icon: 'radar', quantity: '1대', description: '주변 공간을 수평으로 스캔합니다. 지도를 만들고 현재 위치를 추정하는 데 필요한 거리 정보를 제공합니다.', specs: [['스캔 범위', '360° (KB 초안)'], ['최대 거리', '12 m (KB 초안)'], ['역할', '2D SLAM / 위치 추정'], ['배치', '전방 마운트 (FreeCAD)']], status: '형상: FreeCAD 배치 초안 / 제품 사양: KB 초안', geometry: 'CAD 모델', source: kb, price: suppliedPrice(129800) },
  { id: 'drivers', number: '12', name: '모터 드라이버', english: 'MOTOR CONTROL', model: 'Cytron MDD20A', category: '이동 플랫폼', icon: 'circuit-board', quantity: '2개', description: '모터의 회전 방향과 속도를 조절합니다. 두 개의 듀얼 채널 드라이버로 네 모터를 제어하는 구성입니다.', specs: [['입력 전압', '6–30 V (KB 초안)'], ['채널', '2채널 × 2개'], ['채널당 전류', '최대 20 A (KB 초안)'], ['제어', 'PWM / 방향']], status: 'KB 초안', geometry: '위치 개념 표시', assembly: 'interior', source: kb, price: null },
  { id: 'display', number: '13', name: '전면 디스플레이', english: 'EXPRESSION DISPLAY', model: 'Cleany 표정 화면', category: '컴퓨팅', icon: 'monitor',
    quantity: '1대', description: '로봇의 표정과 작업 상태를 보여주는 전면 화면입니다.',
    specs: [['표시 영역', '344.2 × 193.6 mm (CAD)'], ['화면 비율', '16:9'], ['연결', 'HDMI · Jetson 키오스크'], ['패널 모델·해상도', '미확인']],
    status: '화면 크기는 CAD 기준', geometry: 'CAD 모델', assembly: 'cover', source: robot, price: null },
  { id: 'case', number: '14', name: '포맥스 케이스', english: 'FOMEX ENCLOSURE', model: '포맥스 외장 패널 + 아크릴 판', category: '이동 플랫폼', icon: 'layers',
    quantity: '1식', description: '내부 부품을 둘러싼 외장입니다. 케이스 벗기기로 내부 배치를 볼 수 있습니다.',
    specs: [['구성', '포맥스 외장 패널 + 아크릴 판'], ['포맥스 전면 두께', '5 mm (CAD)'], ['포맥스 측면·후면·상부 두께', '3 mm (CAD)'], ['아크릴 규격', '미확인'], ['선택 범위', '패널 · 체결 부품 · 로고']],
    status: '포맥스 치수는 CAD 초안 기준 / 아크릴 형상 미확인', geometry: 'CAD 모델', assembly: 'cover', source: robot, price: purchasePrice(335000, '구성', { scope: 'group', date: '2026-11-08', note: '포맥스 외장 패널 + 아크릴 판 합계 · VAT 포함 · 배송비 0원 가정' }) },
  { id: 'battery', number: '15', name: '전원 배터리', english: 'POWER BATTERY', model: 'GSP 리튬인산철 전동휠체어 배터리', category: '이동 플랫폼', icon: 'battery-charging',
    quantity: '1식', description: '케이스 안에서 모터 드라이버 반대편의 배터리 배치를 보여줍니다.',
    specs: [['참고 외형', '195 × 165 × 175 mm'], ['참고 질량', '5.20 kg'], ['판매 링크 표기', '12V 42A'], ['정격 용량', '미확인'], ['배치', '드라이버 반대편 · 개념 표시']],
    status: '제품은 제공 링크 기준 · 형상·질량은 기존 설계 추정값', geometry: '위치 개념 표시', assembly: 'interior',
    source: cadBranch + '/ros2_ws/src/cleany_description/docs/model.md#추정-질량과-gazebo', price: purchasePrice(431970, '식', { scope: 'group', url: batteryPurchase }) },
  { id: 'imu', number: '16', name: 'IMU', english: 'INERTIAL MEASUREMENT UNIT', model: 'MPU6050', category: '인지 센서', icon: 'activity',
    quantity: '1개', description: '베이스의 가속도와 각속도를 측정합니다. 보드와 마운트는 FreeCAD 배치를 사용합니다.',
    specs: [['센서', '3축 가속도계 + 3축 자이로'], ['측정 범위', '±2 g / ±250 °/s'], ['펌웨어 샘플링', '100 Hz'], ['연결', 'ESP32 · I²C 100 kHz']],
    status: '형상은 CAD, 측정 설정은 ESP32 펌웨어 기준', geometry: 'CAD 모델', assembly: 'interior',
    source: cadBranch + '/esp32/README.md#runtime-mpu6050-telemetry', price: purchasePrice(5000, '개', { date: '2026-11-08' }) },
];
export const categories: Category[] = ['전체', '헤드 구동부', '매니퓰레이터', '인지 센서', '이동 플랫폼', '컴퓨팅'];
export const byId = (id: PartId): Part => parts.find(part => part.id === id)!;
const currency = new Intl.NumberFormat('ko-KR');
export const money = (amount: number): string => `₩${currency.format(amount)}`;
export const latestPriceDate = parts.flatMap(part => part.price ? [part.price.date] : []).sort().at(-1)!;
export function partVatIncluded(part: Part): boolean | null {
  const vat = part.price?.vatIncluded ?? null;
  return part.includedPrices?.some(item => item.price.vatIncluded !== vat) ? null : vat;
}
export function partSubtotal(part: Part): number | null {
  if (!part.price) return null;
  const main = part.price.amount * (part.price.scope === 'group' ? 1 : Number.parseInt(part.quantity));
  return main + (part.includedPrices?.reduce((sum, item) => sum + item.price.amount * item.quantity, 0) ?? 0);
}
export function filterParts(category: Category, query: string): Part[] {
  const text = query.trim().toLocaleLowerCase();
  return parts.filter(part => (category === '전체' || part.category === category) &&
    `${part.name} ${part.model} ${part.english}`.toLocaleLowerCase().includes(text));
}
export function referenceSubtotal(items: Part[]): { amount: number; known: number; unknown: number } {
  const priced = items.filter(part => part.price !== null);
  return { amount: priced.reduce((sum, part) => sum + partSubtotal(part)!, 0), known: priced.length, unknown: items.length - priced.length };
}
export function csvCatalog(): string {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [['부품', '모델', '수량', '가격(KRW)', '가격 단위', '소계(KRW)', 'VAT', '가격 구분', '확인일', '사양 상태', '사양 근거', '가격 근거', '가격 비고', '포함 부속품', '관련 부품 참고가'],
    ...parts.map(p => [p.name, p.model, p.quantity, p.price?.amount ?? '', p.price?.unit ?? '', partSubtotal(p) ?? '', p.price ? partVatIncluded(p) === true ? '포함' : partVatIncluded(p) === false ? '별도' : '미확인' : '', p.price?.basis ?? '미등록', p.price?.date ?? '', p.status, p.source, p.price?.url ?? '', p.price?.note ?? '',
      p.includedPrices?.map(item => `${item.name} ${money(item.price.amount)}/${item.price.unit} × ${item.quantity}`).join(' / ') ?? '',
      p.referencePrices?.map(item => `${item.name} ${item.price ? money(item.price.amount) + '/' + item.price.unit : '미등록'}`).join(' / ') ?? ''])];
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}
