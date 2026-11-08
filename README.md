# Cleany Explorer

끌리니의 3D 모델, 부품 사양과 가격, ROS 연결을 살펴보는 웹앱입니다.

## 시작하기

**필요 환경**은 Node.js 22.13 이상과 npm입니다. 저장소를 내려받은 뒤 아래 명령을 실행합니다.

```sh
git clone https://github.com/asm17-moving-agent/cleany-explorer.git
cd cleany-explorer
npm ci
npm run dev
```

터미널에 표시되는 `Local` 주소를 브라우저에서 엽니다. 서버를 종료할 때는 터미널에서 `Ctrl+C`를 누릅니다. 개발 서버는 `127.0.0.1`에 바인딩됩니다.

이미 저장소를 내려받았다면 `cleany-explorer` 폴더에서 `npm ci`와 `npm run dev`만 실행하면 됩니다. Google Fonts에 연결할 수 없는 환경에서는 시스템 글꼴을 사용합니다.

## 화면 둘러보기

| 화면 | 확인할 수 있는 내용 |
| --- | --- |
| **3D 탐색** | 부품을 선택해 사양과 가격을 확인합니다. 케이스를 벗겨 내부 배치를 살펴보고 분해 보기와 시점을 조작할 수 있습니다. |
| **ROS 연결도** | 실행 흐름과 부품별 연결을 봅니다. 실물과 시뮬레이션을 구분하고, 항목이나 연결선을 선택해 조건과 코드 근거를 확인합니다. |
| **사양** | 부품의 모델, 수량과 사양 상태를 한 표에서 비교합니다. |
| **비용** | 가격과 구성별 소계를 확인하고 부품표를 CSV로 내려받습니다. |

ROS 항목은 기본 이름, ROS 자동 생성 패턴과 동적 이름으로 구분합니다. 부품 상세의 **ROS** 탭에서도 해당 부품의 인터페이스와 발행·구독 또는 호출·제공 관계를 확인할 수 있습니다. `/` 키를 누르면 현재 화면의 검색으로 이동합니다.

표시된 ROS 연결과 3D 모델은 소스 스냅샷입니다. 현재 로봇의 실시간 상태나 사용자 설정에 따른 전체 런타임 그래프를 나타내지는 않습니다. 가격은 사용자 제공 금액과 판매처 참고가를 사용하며 자동으로 갱신되지 않습니다. 각 항목의 확인 상태는 상세와 출처에서 확인할 수 있습니다. [데이터 기준](docs/DATA.md)

## 데이터 갱신

| 대상 | 관리 위치 | 갱신 시 확인할 내용 |
| --- | --- | --- |
| 부품과 가격 | [`src/catalog.ts`](src/catalog.ts) | 금액, 단위, 수량, VAT, 가격 유형과 출처 |
| CAD 모델 | [`public/models/cleany.json`](public/models/cleany.json) | 원본 파일, 해시, 조립 변환과 원본 커밋 |
| ROS 목록과 근거 | [`src/data/`](src/data/) | 원본 파일과 발췌문 해시, 환경별 경로 |
| ROS 관계 | [`src/ros-reviewed.ts`](src/ros-reviewed.ts), [`src/ros.ts`](src/ros.ts), [`src/ros-relations.ts`](src/ros-relations.ts) | 설명과 QoS, 부품 매핑, 실행 흐름 |

가격의 `scope: 'unit'`은 부품 수량을 곱하고 `scope: 'group'`은 구성 금액을 한 번만 합산합니다. `null`은 미등록을 뜻합니다. 관련 부품 참고 금액은 구성 소계와 구분합니다.

### CAD 모델

`cleany_freecad_final.urdf`가 있는 원본 checkout을 사용합니다.

```sh
python3 -B scripts/import-model.py /absolute/path/to/cleany-freecad-model-update --model freecad
npm test
npm run build
```

가져오기 도구는 원본 메시와 화면 텍스처를 복사하고, 파일의 SHA-256과 원본 정보를 기록합니다. 기존 Xacro를 가져오는 `--model legacy`에는 Python의 xacro 2.1.1이 필요합니다.

### ROS 목록

```sh
python3 -B scripts/import-ros-catalog.py /absolute/path/to/cleany --date YYYY-MM-DD
```

이 도구는 ROS 색인, Python과 C++의 직접 선언, 검토한 launch와 설정 계약을 읽습니다. 이름을 정적으로 결정할 수 없는 선언은 동적 패턴으로 보존합니다. 원본 코드는 실행하거나 수정하지 않습니다.

수동 근거 발췌문을 갱신할 때는 `scripts/import-ros-sources.py`의 줄 범위를 먼저 검토한 뒤 실행하고, ROS 목록을 다시 가져옵니다. 원본 계약이 바뀌어 가져오기가 실패하면 관계를 재검토합니다. 데이터와 출처는 같은 변경에 포함합니다. 세부 기준은 [데이터 기준](docs/DATA.md)에 정리되어 있습니다.

## 검사와 빌드

```sh
npm test
npm run build
```

자동 검사는 가격과 소계, 검색과 CSV, CAD 자산 무결성, ROS 연결과 환경 구분을 확인합니다. 빌드 결과는 `dist/`에 생성되며 `npm run preview`로 로컬에서 확인할 수 있습니다. 3D 코드와 모델은 3D 화면을 열 때 불러옵니다.

| 문서 | 내용 |
| --- | --- |
| [데이터 기준](docs/DATA.md) | 모델, 가격, ROS 스냅샷의 출처와 해석 |
| [검증 기록](docs/VALIDATION.md) | 수행한 테스트와 화면 검증 이력 |
| [자산 출처와 라이선스](NOTICE.md) | 모델과 라이브러리의 출처 및 라이선스 |
