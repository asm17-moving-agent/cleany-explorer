# 검증 기록

각 기록은 표시된 날짜와 코드 상태에서 수행한 검사입니다. 과거 기록의 가격과 항목 수는 당시 기준이며 현재 데이터는 [데이터 기준](DATA.md)에서 확인합니다. 기록에 언급된 `artifacts/`와 다운로드 파일은 로컬 산출물로, 이 저장소에 포함되지 않습니다. 이전 Explorer 저장소의 커밋 번호는 당시 작업 이력을 식별합니다.

## 최근 확인

2026-11-09에 공개 저장소의 `b493ce9` 소스와 문서 정리 작업을 macOS arm64, Node.js 26.5.0 환경에서 확인했습니다.

| 검사 | 결과 |
| --- | --- |
| `npm test` | 35개 통과 |
| `npm run build` | TypeScript 검사와 Vite 빌드 통과 |
| 빌드 메시지 | 지연 로딩되는 3D JavaScript 청크의 500kB 크기 권고가 표시됨 |

이번 확인은 자동 검사와 빌드 기준입니다. ROS 실물 연결과 모바일 화면은 실행하지 않았습니다.

## 기록 찾아보기

| 주제 | 기록 |
| --- | --- |
| ROS 경로와 흐름 | [환경별 경로 정정](#부품-연관-및-환경별-경로-정정), [연관 관계와 실행 흐름](#ros-연관-관계와-실행-흐름), [전체 목록](#ros-전체-목록과-환경별-연결도), [부품별 ROS 연결](#부품별-ros-연결), [연결선 겹침 제거](#부품별-연결선-겹침-제거) |
| CAD와 부품 | [초기 CAD 탐색](#초기-cad-탐색), [양팔 어깨](#양팔-고정-어깨-포함), [Pan/Tilt 분리](#헤드-pantilt-분리), [모터 분류 정정](#pantilt-모터-분류-정정), [Pan 하우징](#pan-모터-주변-하우징-포함) |
| 화면과 성능 | [최적화](#최적화와-구형-구현-정리), [연결도와 가독성](#연결도와-가독성-개선), [한 화면 UI](#한-화면-중심-ui-개편), [토픽 목록](#토픽-목록과-비교표) |
| 가격 | [사용자 제공 가격 반영](#사용자-제공-가격-반영) |

## 부품 연관 및 환경별 경로 정정

<details>
<summary>검증 내용 펼치기</summary>

2026-11-02, macOS / Node.js 26.5.0 / Chrome 1800×987 및 1280×720에서 Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 검증했다. 입력은 원본 Cleany 작업 트리이며 commit과 파일별 hash는 `src/data/ros-sources.json`에 기록한다. 원본 로봇 구현, KB와 CAD를 수정하거나 원격에 업로드하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 자동 검사 | `npm test` 36개 통과. 손목 위치와 후속 처리의 부품 분류, Mock namespace, 관절 역할별 발행·구독 투영, MCU별 흐름 격리, 제어기 취소 client 4개, 공통 환경 배지, 호스트 노드명과 깊이 토픽 정정 회귀 검사 포함. |
| 부품별 환경 | 12개 부품 × 전체·실물·시뮬레이션 36개 조합에서 화면의 항목 수, 표시 행 ID와 환경 배지가 데이터 투영과 일치. 페이지 가로·세로 넘침 없음. Gazebo 손목 영상이 손목 목록에 1개, 같은 검색의 헤드 목록에 0개임을 화면에서 재현. |
| 실행 구성 | 9개 실행 구성의 인터페이스 54개를 선택해 실제 표시된 발행자·호출자와 기준 데이터를 대조. Mock MCU의 `/joint_states`는 base driver 발행, wheel_odometry 구독만 표시하며 Gazebo·MuJoCo는 제외. 전체 목록의 시뮬레이터 경로는 유지. |
| 상세 | 네 제어기 cancel_goal에 real_control_state_guard 호출자 표시. 실물 팔의 관절 상세에서 휠 발행자 제외, 공유 토픽 전체로 이동하면 양쪽 발행자 복원. |
| 자료 무결성 | 색인 140행과 직접 선언 320개 유지. 과거 깊이 이름 1개를 정정하고 취소 4개를 추가해 전체 253개, 기본 189개, 자동 패턴 12개, 동적 52개. 로컬 근거 109개 hash 및 원본과 발췌문 대조 통과. CAD 46개는 원본과 byte hash 동일. 가져오기 재실행 결과도 동일. |
| 빌드와 화면 | TypeScript와 Vite build 성공. 초기 JS 339.82kB, gzip 61.84kB. 기존 지연 로딩 3D chunk 526.37kB의 용량 권고 경고 유지. 1280×720에서 문서 크기와 스크롤 크기 일치. Mock 관절 inspector의 scrollWidth와 clientWidth 모두 305px. |

첫 회귀 실행에서는 컴퓨터 전체 보기 객체에 불필요한 투영 필드가 붙은 문제를 수정했다. 과거 깊이 키의 도달성 검사는 정정 근거를 따라가도록 갱신하고 액션 내부 항목 수는 새로 확인한 네 호출에 맞췄다. 브라우저의 첫 클릭에서 자동화 연결 timeout이 한 번 발생했으며 새 화면 상태를 확인한 뒤 정상 검증을 완료했다. 실물 ROS와 DDS, 시뮬레이터 및 모바일은 실행하지 않았다.

수정 전 점검은 `artifacts/ros-content-audit-2026-11-02.json`, 수정 후 행렬과 화면 결과는 `artifacts/ros-fixes-checks.json`에 보존한다. 화면 근거는 `artifacts/ros-fixed-wrist-mapping.png`와 `artifacts/ros-fixed-base-mock.png`다. 이 파일들은 로컬 검증 산출물이며 저장소에 포함하지 않는다.

</details>

## ROS 연관 관계와 실행 흐름

<details>
<summary>검증 내용 펼치기</summary>

2026-11-01, macOS / Node.js 26.5.0 / Codex in-app browser 1280×720에서 Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 검증했다. 원본 Cleany HEAD는 `707538de9d28291c679fcfd954f5587368d5a460`이며 작업 트리의 실제 입력과 hash는 `src/data/ros-sources.json`에 기록한다. 원본 구현·KB와 CAD 파일은 수정하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 자동 검사 | `npm test` 29개 통과. 기존 가격·CAD·ROS 검사와 함께 환경별 설명·QoS, 팔과 휠의 설명 분리, 유한한 호출자 이름 보완, 액션 상위·하위 제공자 연결, 실행 흐름의 근거·방향·배치·조건 검증. |
| 데이터 갱신 | 색인 140행과 직접 선언 320개 유지. 전체 250개, 기본 186개, 자동 패턴 12개, 동적 52개 유지. 명시 액션 내부 항목 7개 모두 parentAction과 제공자 연결. 106개 로컬 근거 hash 검사 통과. 가져오기 재실행의 JSON·근거 파일 hash가 동일함을 확인. |
| 표시 오류 재현 | 실물 `/scan`에서 시뮬레이션 설명·Reliable QoS 제거. 실물 왼팔의 `/joint_states` 상단에 팔·헤드 설명 표시. 좌우 `set_enabled` 서비스의 `pregrasp_pipeline` 호출자 확인. |
| 실행 흐름 | Jetson, MuJoCo root와 Mock namespace별 조작 경로 확인. Mock에 BT 전이 토픽을 추가하지 않음. 집기 검증 순서와 코드 근거 dialog, 좌우 손목 영상의 조건부 입력, 베이스 허가·응답·오도메트리 경로 확인. 조회 참조는 화살표 없는 점선으로 구분. |
| 액션 상세 | ReturnArm 호출자, 실제 Jetson 제공자, 다섯 내부 계약과 상위 액션 링크 확인. 상세에서 흐름 화면으로 이동, 다른 액션 버튼 선택, SVG 선의 Enter 선택 확인. 기본 명시 항목과 자동 계약 카드 구분. |
| 화면 | 문서 크기와 스크롤 크기 모두 1280×720. 기본 조작 diagram 368px와 inspector 484px에 내부 넘침 없음. 액션 선택 버튼도 기본 inspector 높이에 들어옴. 최종 console error 없음. |
| 빌드 | TypeScript와 Vite build 성공. 초기 JS 328.07kB, gzip 59.24kB, CSS 46.00kB. 지연 로딩 3D JS 526.37kB의 기존 용량 권고 경고 유지. |

초기 검사에서 부품별 설명 투영과 캐시된 부품 집계의 불일치를 수정했다. 브라우저에서는 흐름을 바꿀 때 작업 공간 폭이 내용에 맞춰 줄어드는 현상과 액션 선택 후 상세 패널의 이전 스크롤 위치를 수정했다. 최종 검사는 모두 통과했으며 실물 ROS, DDS 연결과 모바일은 실행하지 않았다. 원본 화면과 검증 요약은 로컬 `artifacts/ros-flow-overview.png`, `artifacts/ros-flow-validation.png`, `artifacts/ros-flow-wrist.png`, `artifacts/ros-flow-action.png`, `artifacts/ros-flow-checks.json`에 보존한다.

</details>

## 사용자 제공 가격 반영

<details>
<summary>검증 내용 펼치기</summary>

2026-11-01, macOS / Node.js 26.5.0 / Codex in-app browser 1280×720에서 Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 검증했다. 입력은 사용자 제공 VAT 포함 금액 D435 572,000원, 휠 179,520원, 엣지 컴퓨터 2,689,720원, 라이다 129,800원이다. 휠은 4개 세트 총액으로 적용했으며 단위 가정을 데이터 기준과 가격 비고에 명시했다.

카탈로그 검사 6개, TypeScript 검사와 Vite build가 통과했다. 세트 금액을 한 번만 합산하고 기존 모터 금액을 더한 참고 소계 3,926,240원, 가격 등록 5개 및 미등록 7개 그룹을 확인했다. 비용표의 가격 단위와 VAT, 휠 상세의 사용자 제공일 및 판매처 URL 없는 근거 표시를 브라우저에서 확인했다. 실제 다운로드한 `~/Downloads/cleany-components-2026-11-01.csv`의 네 가격, 가격 단위, 소계와 VAT도 대조했다. 실패한 기능 검사는 없으며 기존 3D chunk 용량 권고 경고는 유지된다. 화면 근거는 로컬 `artifacts/prices-2026-11-01.png`에 보존한다. 모바일은 검사하지 않았다.

</details>

## 최적화와 구형 구현 정리

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, macOS arm64 / Node.js 26.5.0 / Codex in-app browser 1280×720에서 검증했다. Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경이며 커밋하지 않았다. 원본 CAD와 ROS 데이터 파일은 갱신하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 자동 검사 | `npm test` 21개 통과. 반복 환경 전환 및 사용자 지정 목록의 검색 격리 검사 추가. CAD 46개 STL과 ROS 근거 106개 파일 hash 검사 통과. TypeScript의 미사용 변수·매개변수 검사와 Vite build 성공. |
| 빌드 크기 | 단일 JS 825.71kB에서 초기 JS 301.71kB와 지연 로딩 3D JS 526.37kB로 분리. 초기 JS gzip 184.14kB → 51.24kB. CSS 46.89kB → 37.57kB. 3D chunk의 500kB 권고 경고는 남으며, 전체 JS 용량 감소를 뜻하지 않는다. |
| 지연 로딩 | 로컬 빌드 서버에서 `/#connections` 직접 진입 시 HTML, 초기 JS, CSS, favicon만 요청. 3D 탐색 선택 후 3D JS 1회, CAD manifest 1회, STL 46개 요청. HTTP 오류 없음. |
| ROS 결과 보존 | 정리 전후 전체 250개 인터페이스의 값, 세 환경별 경로와 부품별 집계를 JSON으로 비교해 일치 확인. 실물 왼팔 액션 검색 2건, 상세 출처, 시뮬레이션 자동·동적 범위, 페이지 이동과 목록 확장 확인. |
| 화면과 3D | 기본 3D 화면 219개 요소와 연결도 478개 요소의 배치, 글꼴 및 간격이 정리 전과 동일. 연결도 11개 선, 문서 크기 1280×720과 스크롤 크기 일치. Pan 선택, 분해, 정면, 번호 숨김·복원, 자동 회전, 초기화와 ROS 패널 전환 확인. 최종 브라우저 경고·오류 없음. |
| 계산 비용 | Node에서 세 환경의 연결 집계와 검색을 100회씩 반복한 5회 측정의 중앙값: 약 458ms → 1.6ms. 정적 스냅샷 캐시의 계산 시간이며 브라우저 전체 응답 시간 측정은 아니다. |

구형 연결도 CSS 129개 규칙, 중복 선언 20개, 중복 ROS 타입 및 미사용 export, Python 캐시와 참조 없는 과거 테스트 캡처를 정리했다. 검증 과정의 JSON 비교는 `undefined` 필드가 직렬화에서 생략되어 첫 비교가 실패했으며, 양쪽을 같은 JSON 형식으로 비교한 결과 일치했다. 기능 회귀는 발견하지 않았다. 모바일과 실물 ROS는 이번 검증 대상이 아니다. 화면 근거는 로컬 `artifacts/cleanup-connections.png`, 측정값과 HTTP 요청 원본은 `artifacts/cleanup-checks.json`이다. 기존 검증 기록에서 참조하는 캡처는 유지한다.

</details>

## 초기 CAD 탐색

<details>
<summary>검증 내용 펼치기</summary>

2026-10-26, macOS arm64 / Node.js 26.5.0 / Codex in-app browser에서 검증했다. 검증한 기능 소스는 `077b2bd4eab85928177e7dd2fd5304f5dd210afd`이며 이후 변경은 이 기록의 추가다. 하드웨어 구동이나 현물의 사양 검증은 수행하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| `npm test` | 7개 통과. 누락 가격과 부분 견적을 전체 소계에 포함하지 않음, 모터 1/61 옵션 단가와 4개 소계, 분류와 검색 교집합, CSV 누락값, 가격 출처, 46개 STL hash, 29개 링크 연결 구조 검증. |
| `npm run build` | TypeScript 검사와 Vite production build 성공. JS 단일 chunk 557.25kB, gzip 145.69kB로 Vite의 500kB 권고 경고가 남음. CAD 원본 메시 약 18.6MB를 별도 로딩. |
| 데스크톱 1280px | CAD 형상 표시, 직접 팔 메시 클릭과 상세 선택, 모터 번호 위 정보 카드의 12V 및 88,800원 표시, 분해 보기, 카메라 프리셋, 확대와 축소, 번호 숨김과 복원 확인. |
| 카탈로그 | 인지 센서 필터 3개, D435 검색 1개, 존재하지 않는 이름 검색 0개, 검색 초기화, 데이터 안내 dialog 확인. |
| 비용과 내보내기 | 모터 단가 88,800원, 4개 소계 355,200원, 가격 미등록 9개 그룹 확인. CSV 다운로드 실제 완료. |
| 모바일 390×844 | 모델 번호로 헤드 상세 선택, 비용표 내부 가로 스크롤 확인. 문서 너비와 scrollWidth 모두 390px. |
| 브라우저 console | 최종 탐색 흐름에서 error 0건. WebGL 미지원 장치와 느린 네트워크는 별도 실기기 검증하지 않음. |

초기 모바일 비용표에서 화면 밖의 숨김 표 제목 때문에 문서가 545px까지 확장되는 문제가 있었다. 스크롤 영역에 positioning context를 부여한 후 390px로 일치함을 확인했다. CAD 클릭 시 OrbitControls가 hover를 먼저 초기화하던 문제는 pointer-up에서 다시 raycast하도록 수정해 직접 메시 선택을 확인했다.

원본 화면 기록은 로컬 `artifacts/desktop-explorer.png`와 `artifacts/mobile-cost.png`에 보존한다. 다운로드 결과는 `~/Downloads/cleany-components-2026-10-26.csv`에 있다. 화면 기록과 다운로드는 저장소에 포함하지 않는다.

</details>

## 부품별 ROS 연결

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, macOS / Node.js 26.5.0 / Codex in-app browser에서 로컬 변경을 검증했다. Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 커밋하지 않은 변경이며 원본 Cleany checkout은 읽기 전용으로 사용했다. 참조한 ROS 소스는 `src/data/ros-sources.json`에 HEAD와 파일별 hash로 기록했다. 실물 ROS 및 시뮬레이터는 실행하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| `npm test` | 12개 통과. 기존 7개 및 근거 파일 무결성, 부품 매핑, 모터 명령·피드백 방향, 좌우 팔과 검색 분리, 라이다 실행 구분, 읽기 전용 조회 명령 검사. |
| `npm run build` | TypeScript 검사와 Vite build 성공. JS 578.16kB, gzip 153.25kB. 기존 단일 chunk의 500kB 권고 경고는 유지됨. |
| 부품 선택 | 10개 부품 모두 ROS 탭을 유지하며 해당 연결을 표시. 부품 변경 시 필터 초기화. 좌우 방향키로 사양과 ROS 탭 전환. |
| 검색과 종류 | 왼팔 토픽 + `JOINT_STATE` 검색 시 2개. 없는 이름은 빈 상태, 초기화 시 전체 목록 복구. 손목 서비스 필터는 좌우 SetBool 서비스 2개. |
| 근거와 조회 | 모터 `/base/wheel_command`의 base driver 발행 / ESP32 구독, QoS와 출처 표시. 조회 명령 복사 후 clipboard의 실제 문자열 확인. 근거 텍스트의 로컬 HTTP 응답 확인. |
| 반응형 | 데스크톱 1280px, 태블릿 860px, 모바일 390×844 확인. 태블릿과 모바일에서 문서 가로 넘침 없음. 태블릿 사양 탭에서 기존 모터 가격 88,800원 유지. |
| 브라우저 console | 탐색 흐름에서 error 0건. |

화면 근거는 로컬 `artifacts/ros-desktop.png`와 `artifacts/ros-mobile.png`에 있다. 로컬 개발 서버는 사용자 확인을 위해 `127.0.0.1:5178`에서 유지한다. 원격 등록, 업로드, 배포와 ROS 명령 전송은 수행하지 않았다.

</details>

## 연결도와 가독성 개선

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31에 같은 로컬 환경에서 연결도와 전체 UI 스타일 변경을 검증했다. 커밋과 배포는 수행하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| `npm test` | 16개 통과. 연결 그룹의 원본 endpoint 참조, MCU 경계 공유, 액션 요청과 상태의 반대 방향, 부품 선택 범위 검사 4개 추가. |
| `npm run build` | TypeScript 검사와 Vite build 성공. 단일 JS chunk의 기존 500kB 권고 경고는 유지됨. |
| 연결 탐색 | 센서 3개, 양팔 2개, 베이스 1개 경로의 토픽 라벨 선택과 상세 카드 수 4/4/1/3/3/2 확인. 토픽·액션 총 17개 참조. 왼팔 라벨을 Enter로 선택 가능. |
| 방향과 부품 | 양팔은 액션 요청과 관절 상태, 베이스는 명령과 피드백을 반대 방향의 2개 선으로 표시. 총 9개 방향선 확인. 프레임은 통신선을 만들지 않고 TF 상세만 표시. |
| 화면 왕복 | 연결 상세에서 모터 3D/ROS 탭으로 이동, 해당 부품 연결도로 다시 이동해 베이스 1개 경로 강조 확인. 전체 연결로 초기화. |
| 일반 창 1052px | 모든 도식 요소가 945px 캔버스에 들어가며 내부 가로 스크롤 불필요. 카드와 토픽 라벨의 bounding box 겹침 없음. |
| 글자와 대비 | 1280px에서 부품명·본문 14px, 상세 패널 380px. 보조 설명·ROS 타입·도식 라벨의 실제 색상 대비 표본 5.33–5.97:1 확인. 전체 페이지의 모든 상태를 자동 접근성 검사한 결과는 아님. |
| 모바일 390×844 | `/#connections` 직접 진입 시 세로 목록 기본 선택. 베이스 경로 선택과 상세 표시 확인. 도식으로 전환하면 910px 도식만 내부 스크롤하며 문서 가로 넘침 없음. |
| 기존 기능 | 분해 보기와 초기화, 모터 단가 88,800원, 참고 소계 355,200원, 손목 카메라 서비스 필터 2개 유지. |
| 브라우저 console | 전체 확인 흐름에서 error 0건. |

화면 기록은 `artifacts/connections-desktop.png`, `artifacts/connections-mobile.png`, `artifacts/readability-desktop.png`에 보존한다. 글꼴 크기, 대비, 패널 너비와 줄바꿈을 CSS에서 조정했으며 CAD 자산과 ROS 소스는 변경하지 않았다. 연결도는 코드 스냅샷의 논리 경로를 보여주며 실행 중인 로봇에 연결하지 않는다.

</details>

## 한 화면 중심 UI 개편

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, macOS / Node.js 26.5.0 / Codex in-app browser에서 Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 검증했다. CAD와 ROS 근거 데이터는 기존 스냅샷을 유지했다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 자동 검사 | `npm test` 16개 통과. TypeScript 검사와 Vite build 성공. 기존 단일 JS chunk의 500kB 권고 경고는 유지됨. |
| 데스크톱 1280×720 | 페이지 scrollWidth/scrollHeight가 1280×720. 연결도와 상세가 나란히 표시되며 도식 내부 스크롤 없음. 컴퓨터의 인터페이스 34개를 연결도와 3D 상세에서 선택기로 각각 전환해 가로·세로 넘침 없음 확인. |
| 작은 데스크톱 1052×768 | 연결도 686×570px, 상세 패널 339×562px에서 내부 넘침 없이 긴 팔 액션 이름 전체 표시. |
| 태블릿 860×768 | 센서 → 컴퓨터 → 구동부의 세로 배치, 504×456px 도식과 329×562px 상세 표시. 문서 가로·세로 넘침 없음. |
| 모바일 390×844 | 경로 버튼 6개로 연결 선택. 대표 인터페이스 17개 전환 검사에서 팔 상태 2개의 9px 넘침을 발견해 패널 여백 조정 후 해당 경로의 515px clientHeight와 scrollHeight 일치 확인. 3D/상세 전환, 모델 번호 선택과 분해/초기화 동작 확인. |
| 검색과 전환 | 컴퓨터의 34개 선택 항목, 중복 `/joint_states`의 용도 구분, 빈 검색 결과와 초기화 확인. 손목 서비스 필터 2개 중 `right` 검색 시 오른쪽 서비스 1개 표시. 이전/다음의 끝점 비활성 확인. |
| 출처와 명령 | 조건·QoS·출처 dialog 열기와 Escape 닫기 확인. 복사 후 clipboard가 `ros2 service type /right_wrist_camera/set_enabled`와 일치. 서비스와 액션의 호출 방향을 제공 노드 쪽으로 표시. |
| 비용 | 모터 단가 88,800원, 참고 소계 355,200원, 가격 미등록 9개 그룹 유지. 1280×720에서 비용표의 10개 행이 396px 영역 안에 들어가며 내부 세로 스크롤 없음. |
| 접근과 오류 | 연결 경로를 Enter로 선택, 사양/ROS 탭과 dialog 키보드 조작 확인. 최종 탐색 흐름의 브라우저 console error 0건. |

처음에는 3D ROS 상세에서 긴 이름과 복수 구독자가 최대 53px, 비용표가 164px 넘쳤다. 중복 헤더 정보와 표의 여백을 줄인 뒤 같은 입력으로 다시 확인했다. 작은 높이의 창, 확대된 글꼴과 긴 출처 문서는 필요한 패널 안에서 스크롤할 수 있다. 화면 근거는 로컬 `artifacts/workspace-desktop.png`, `artifacts/workspace-connections.png`, `artifacts/workspace-mobile.png`에 남긴다. 로컬 개발 서버는 `127.0.0.1:5178`에서 유지한다.

</details>

## 토픽 목록과 비교표

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, 같은 로컬 checkout과 브라우저에서 우측 ROS 선택기를 목록으로 교체한 변경을 검증했다. 토픽은 발행 → 구독, 서비스와 액션은 호출 → 제공 순서로 표시한다. 기존 CAD, 사양, 가격과 ROS 근거 데이터는 변경하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 자동 검사 | `npm test` 16개 통과, TypeScript 검사와 Vite build 성공. 기존 단일 JS chunk의 500kB 권고 경고 유지. |
| 데스크톱 1280×720 | 대표 경로 6개를 차례로 선택해 목록 4/4/1/3/3/2개 표시. 모든 경로에서 목록의 clientHeight와 scrollHeight가 451px로 일치하고 가로 넘침 없음. 드롭다운과 이전/다음 버튼 제거. |
| 비교표 | 왼팔의 액션 2개와 상태 토픽 1개를 동시에 표시. 컴퓨터 전체 34개는 비교표 본문 안에서 스크롤하며 dialog 가로 넘침 없음. |
| 검색과 구분 | `joint_states` 검색 결과 3개, 같은 이름의 양팔·헤드와 휠 관절 상태를 용도로 구분. 빈 검색 결과에서 초기화해 34개 복구. 손목 카메라 서비스 필터와 `right` 검색의 교집합 1개 확인. |
| 상세와 명령 | 이름 버튼의 Enter 입력으로 상세 열기, Escape로 닫기 확인. 타입, 노드, 실행 조건, QoS와 코드 출처 보존. `복사됨` 표시 후 clipboard가 `ros2 topic info /base/wheel_state --verbose`와 일치. |
| 최종 화면 | 브라우저를 기본 데스크톱 크기 1052×1025로 복원하고 왼팔의 3개 연결을 함께 표시. 브라우저 console error 0건. |

최초 목록 배치에서 팔 경로의 종류 필터와 검색으로 25–38px의 내부 넘침이 있었다. 4개 이하 목록에서 불필요한 필터와 검색을 숨긴 뒤 6개 대표 경로 전체가 한 화면에 들어오는 것을 재확인했다. 많은 연결은 목록 내부와 펼쳐보기 표 안에서 스크롤한다. 화면 근거는 `artifacts/topics-desktop.png`와 `artifacts/topics-comparison.png`에 남겼다.

</details>

## 양팔 고정 어깨 포함

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31에 `base_link`의 `Base.stl`과 `Base_Motor.stl` 네 형상을 좌우 팔로 재분류했다. 모델 가져오기 도구에도 같은 규칙을 적용했으며 STL, 관절, 위치, 자세와 소스 스냅샷 메타데이터는 유지했다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 모델 회귀 검사 | 기존 분류에서 왼팔의 고정 어깨 형상이 0개로 검출되어 실패하는 것을 확인. 수정 후 `node --experimental-strip-types --test tests/model.test.ts` 3개 통과. 각 팔의 하우징·서보 2개, 해당 어깨 관절과의 위치 관계, 공용 프레임 분리, 46개 STL hash와 관절 연결 구조 확인. |
| 변경 범위 | 모델 JSON 비교에서 네 visual의 category 외 필드가 모두 동일함을 확인. 원본 자산 재생성 없이 분류만 갱신. |
| 빌드 | TypeScript 검사와 Vite build 성공. 기존 단일 JS chunk의 500kB 권고 경고 유지. |
| 데스크톱 1280×720 | 정면에서 오른쪽과 왼쪽 고정 어깨를 각각 직접 클릭해 해당 팔 선택 확인. 분해 보기에서 어깨 하우징과 서보가 팔과 함께 이동하며 공용 지지판은 프레임에 남음. |

화면 근거는 `artifacts/shoulder-right.png`, `artifacts/shoulder-left.png`, `artifacts/shoulders-exploded.png`에 남겼다.

</details>

## 헤드 Pan/Tilt 분리

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, macOS / Node.js 26.5.0 / Codex in-app browser에서 Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 검증했다. 입력은 기존 CAD 스냅샷과 동일 SHA-256의 실물 control profile이다. 원본 Cleany checkout과 STL은 수정하지 않았다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 모델 분류 | 회귀 검사가 기존 `head-camera` 분류에서 실패함을 확인. 수정 후 Pan 2개, Tilt 1개, 카메라 1개 메시의 중복 없는 분류와 축, 기존 어깨 분류와 46개 STL hash 확인. JSON 비교에서 세 visual의 category 외 모든 필드 동일. |
| 자동 검사 | 모델·ROS·카탈로그 15개와 연결도 4개, 총 19개 통과. TypeScript 검사와 Vite build 성공. 기존 500kB chunk 권고 경고 유지. |
| 데스크톱 1280×720 | 부품 목록의 clientHeight와 scrollHeight가 478px로 일치. 문서 크기 1280×720 유지. 카메라·Pan·Tilt 번호를 분산하고 연결선을 표시해 세 항목을 구분. |
| 직접 선택과 분해 | 정면 분해 보기에서 Pan, Tilt 브라켓, 카메라 외형을 각각 클릭해 해당 상세로 전환. 독립 강조와 서로 다른 분해 위치, 조립 보기 복원 확인. |
| ROS | 카메라 영상 4개와 Pan/Tilt의 공용 상태 토픽 3개 분리. 연결도 하단 Pan/Tilt 선택과 3D 복귀 확인. control profile 발췌에 두 관절의 상태 전용 interface와 head_commands=false 추가. |

부품 추가 직후 개발 서버의 중간 변경 상태에서 분해 offset 누락 오류가 발생했다. 두 offset을 추가한 최종 코드로 새로고침한 뒤 선택·분해·연결도 왕복을 확인했으며 19:54 UTC 이후 브라우저 오류는 없었다. 모바일은 사용자 요청에 따라 검사하지 않았다. 화면 근거는 `artifacts/head-pan-tilt.png`, `artifacts/head-pan-tilt-exploded.png`, `artifacts/head-tilt-connections.png`에 남겼다.

</details>

## Pan/Tilt 모터 분류 정정

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, 같은 Explorer checkout과 macOS / Node.js 26.5.0 / 데스크톱 브라우저 1280×720에서 사용자 피드백을 재검증했다. 앞선 분리 검사는 URDF 링크 이름을 그대로 선택 그룹으로 취급해 모터의 기구적 역할을 놓쳤다. 모델의 각 메시를 원본 변환으로 배치해 확인한 결과, `top_base_link`의 `topbase2.stl`은 아래쪽 Pan 모터이고 `head_pan_link`의 `tophead4.stl`은 가로축 Tilt 모터다. 두 category를 각각 Pan과 Tilt로 정정했다. 최신 분류는 `docs/DATA.md`의 표를 따른다.

- 회귀 검사: 정정 전 Pan 모터가 `frame`으로 검출되어 실패. 수정 후 모델 및 카탈로그 검사 9개 통과. 각 축의 모터와 브라켓 2개, 카메라 별도 분류, 마스트의 프레임 유지와 원본 자산 hash 확인.
- 변경 범위: 모델 JSON에서 두 visual의 category 외 모든 필드 동일. 가져오기 도구에도 부모 링크에 고정된 모터의 소속 규칙 반영. 상세의 선택 범위를 모터와 브라켓으로 명시.
- 데스크톱: 조립 상태에서 아래 모터 직접 클릭 시 Pan, 위 모터 직접 클릭 시 Tilt 선택. 분해 시 모터와 해당 브라켓이 함께 이동하고 마스트와 카메라가 별도로 남는 것을 확인. 조립 보기 복원 후 문서 크기 1280×720 유지.
- 빌드: TypeScript 검사와 Vite build 성공. 기존 500kB chunk 권고 경고 유지. 모바일은 검사하지 않음.

화면 근거는 `artifacts/head-pan-corrected.png`, `artifacts/head-assemblies-corrected.png`, `artifacts/head-tilt-corrected.png`에 남겼다.

</details>

## Pan 모터 주변 하우징 포함

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 macOS / Node.js 26.5.0 / 데스크톱 브라우저 1280×720에서 확인했다. 사용자 요청에 따라 `cad_frame/topbase1.stl`의 상단 하우징을 Pan 선택 범위에 추가했다. 원본 메시의 Z=0.9675 m 이음선은 가로지르는 삼각형이 없어, 정점이나 STL을 재생성하지 않고 위·아래 면을 선택 영역으로 분리했다.

| 검사 | 입력과 확인 결과 |
|---|---|
| 회귀 검사 | 변경 전 Pan 구성 수와 하우징 영역 검사 2개 실패. 반영 후 모델 검사 6개 통과. 위쪽 3,954개, 아래쪽 162개 면의 합이 원본 4,116개 면과 위치·법선까지 동일하고 누락·중복 없음 확인. 경계가 삼각형을 가르면 오류로 거부하는 검사 포함. |
| 원본 보존 | 기존 46개 STL hash 유지. 모델 JSON은 해당 마스트 visual의 영역 메타데이터와 Pan 영역 visual 추가 외 동일. 관절과 변환 유지. |
| 데스크톱 | 분해 상태에서 기둥 클릭 시 프레임, 분리된 하우징 밑면 클릭 시 Pan 선택. 하우징이 모터·회전 브라켓과 함께 이동하며 기둥은 프레임에 남음. 조립 보기 복원 후 전체 페이지 1280×720 유지. |
| 빌드 | TypeScript 검사와 Vite build 성공. 기존 500kB chunk 권고 경고 유지. 모바일은 사용자 요청에 따라 검사하지 않음. |

화면 근거는 `artifacts/pan-housing-exploded.png`와 `artifacts/pan-housing.png`에 남겼다.

</details>

## ROS 전체 목록과 환경별 연결도

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, Explorer HEAD `8b3ddd4e05040bb1d4449f0847eb415f76afddbd` 이후 로컬 변경을 macOS / Node.js 26.5.0 / Vite 7.3.7 / in-app browser 1280×720에서 검증했다. 입력은 Cleany HEAD `707538de9d28291c679fcfd954f5587368d5a460`의 작업 트리이며 원본 파일과 발췌문 hash를 `src/data/ros-sources.json`에 남겼다. 원본 구현 checkout은 읽기만 했다.

| 검사 | 결과 |
|---|---|
| 목록 범위 | 전체 색인 140개 행과 Python/C++ 직접 선언 320개를 추적. 기본 이름 186개(토픽 119, 서비스 54, 액션 13), 자동 생성 12개, 동적 이름 52개를 조회 가능. 기본값을 해결하지 못한 선언은 패턴으로 보존. |
| 자동 검사 | `npm test` 20개 통과. 색인·선언 누락, 모든 로컬 근거 hash, 환경별 노드 및 전용 endpoint 배제, Mock namespace와 Jetson 상속 취소 helper, 12개 부품 투영, 좌우 팔과 Pan/Tilt 분리 확인. 기존 CAD·가격 검사 포함. |
| 빌드 | `npm run build` 성공. TypeScript 오류 없음. 기존 단일 JavaScript chunk의 500kB 권고 경고 유지. |
| 환경 구분 | Pan에서 `/head_pan/command` 검색: 실물 0개, 시뮬레이션 1개. 상세에서 pan_motion_gate → head_pan_bridge와 조회 명령 확인. 실물 팔 액션 8개를 한 페이지에 표시. |
| 탐색 | 서비스 목록 다음 페이지, 검색 교집합과 빈 결과, 자동 생성·동적 패턴 상세, 전체 비교표, 목록 넓게 보기, 연결도↔3D 왕복과 3D 환경 선택 확인. |
| 화면 | 문서 1280×720, 연결도 목록 client/scroll 크기 733×379로 일치. 넓게 보기 1254×379로 일치. 3D 카드 영역 client/scroll 높이 285px로 일치. |
| 브라우저 오류 | 최종 새로고침 이후 console error 없음. 모바일은 사용자 요청에 따라 검사하지 않음. |

초기 UI 확인에서 기존 전역 table min-width가 마지막 환경 열을 잘라 내는 문제와 3D 환경 버튼의 가로 flex 상속 문제를 발견했다. 각각 표 최소 너비와 상세 flex 방향을 수정했다. 긴 노드 목록 때문에 카드가 잘리는 문제는 노드 요약과 페이지 이동으로 수정한 뒤 다시 확인했다.

화면 근거: `artifacts/ros-complete-overview.png`, `artifacts/ros-real-arm-actions.png`. 실시간 ROS/DDS 및 실제 로봇은 연결하지 않았으며, 외부 패키지 전체 API와 사용자 remap 결과는 이 정적 목록의 검증 범위가 아니다.

</details>

## 부품별 연결선 겹침 제거

<details>
<summary>검증 내용 펼치기</summary>

2026-10-31, 같은 로컬 작업 트리와 데스크톱 1280×720에서 검증했다. 기존 종류별 평행 곡선을 부품별 수평선 하나로 바꾸고 중앙 노드의 연결 위치를 분리했다. 데이터와 부품 매핑은 유지했다.

- 전체 보기: 11개 부품에 각각 SVG path 1개와 양 끝 연결점 표시. 문서 크기 1280×720 유지.
- 종류 선택: 서비스는 9개 부품의 파선과 서비스 목록, 액션은 3개 부품의 점선과 액션 목록 표시. 하단 버튼과 우측 필터 선택 동기화 확인.
- 기존 연결도 검사 3개와 TypeScript/Vite build 통과. 기존 500kB chunk 권고 경고 유지. 모바일은 검사하지 않음.
- 화면 근거: `artifacts/ros-clear-connections.png`.

</details>
