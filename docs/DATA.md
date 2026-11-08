# 데이터 기준

Explorer에서 보여주는 모델, 가격과 ROS 연결의 출처와 해석 기준입니다. 아래 값은 기록된 시점의 스냅샷입니다.

| 구분 | 기준 | 확인할 곳 |
| --- | --- | --- |
| 3D 모델 | FreeCAD 조립 자세, 2026-11-04 스냅샷 | [사양과 모델](#사양과-모델) |
| 가격 | 사용자 제공가와 판매처 참고가, VAT 포함 | [가격](#가격) |
| ROS | 2026-11-02 Cleany 작업 트리 검토 | [ROS 연결](#ros-연결) |

## 사양과 모델

3D 모델은 Cleany의 `codex/freecad-model-update` 브랜치에서 2026-11-04의 `2178772352ea293d926b80849d0878c3c0a15ed3` 커밋으로 고정했다. `Cleany-final.FCStd`에서 내보낸 `freecad_final`의 저장 자세와 색상, 전면 표정 텍스처를 사용한다. CAD 원본의 설계 상태는 `layout-draft`다. [원본 모델 설명](https://github.com/asm17-moving-agent/cleany/blob/2178772352ea293d926b80849d0878c3c0a15ed3/ros2_ws/src/cleany_description/docs/freecad-model.md)

### 부품별 선택 범위

좌우 팔의 선택에는 각 어깨 베이스, 모터 하우징, 팔 링크와 PincOpen 집게가 포함된다. 손목 카메라는 별도 그룹이다. Pan은 고정·회전 브라켓과 Pan 서보를, Tilt는 Tilt 브라켓과 Tilt 서보를 포함한다. 헤드 카메라는 독립 선택할 수 있다. 라이다는 원본 전방 마운트의 두 메시 조각을 함께 표시한다. 외장 패널, 체결 부품과 로고는 포맥스 케이스로 묶는다. 전면 디스플레이와 IMU는 각각 원본 CAD 그룹을 사용한다.

### 추가된 부품의 사양

전면 디스플레이의 344.2 × 193.6 mm 표시 영역은 원본 텍스처 면 기준이다. Jetson 키오스크는 HDMI 연결 시 데스크톱 해상도에 맞춰 배치한다. 패널 모델과 해상도는 미확인이다. 포맥스 패널 두께는 CAD 기준 전면 5 mm, 측면·후면·상부 3 mm다. [디스플레이 실행 안내](https://github.com/asm17-moving-agent/cleany/blob/2178772352ea293d926b80849d0878c3c0a15ed3/ros2_ws/src/cleany_display/README.md)

배터리는 기존 설계 추정 외형 195 × 165 × 175 mm를 사용해 드라이버 반대편에 개념 배치했다. 5.20 kg은 기존 설계 추정 질량이다. 구매 링크의 제품명에는 12V 42A로 표기되어 있으며 정격 용량은 미확인이다. MPU6050의 범위와 샘플링 값은 ESP32 펌웨어 설정 기준이다. [배터리 설계 추정값](https://github.com/asm17-moving-agent/cleany/blob/2178772352ea293d926b80849d0878c3c0a15ed3/ros2_ws/src/cleany_description/docs/model.md#추정-질량과-gazebo), [IMU 펌웨어 기준](https://github.com/asm17-moving-agent/cleany/blob/2178772352ea293d926b80849d0878c3c0a15ed3/esp32/README.md#runtime-mpu6050-telemetry)

형상과 ROS 데이터의 기준은 별도로 기록한다. 관절 영점, 구동 제한, 센서 외부 보정과 실장 사양은 추가 확인이 필요하다. 제품 후보와 사양의 확정 수준은 각 부품에 표시한다. [하드웨어 구성](https://github.com/asm17-moving-agent/cleany-docs/blob/d71ba851b00d99e70aff7f60f74f06fd5eb7821a/20_TECHNICAL/12%20-%20Hardware%20Configuration.md)

## 가격

### 등록된 가격

| 항목 | 금액 | 근거와 범위 |
|---|---:|---|
| Intel RealSense D435 | 572,000원/대 | 2026-11-01 사용자 제공 금액. VAT 포함, 배송비 0원 가정. |
| 메카넘 휠 | 179,520원/4개 세트 | 2026-11-01 사용자 제공 금액. VAT 포함. 별도 단위 설명이 없어 현재 구성인 4개 세트의 총액으로 반영했으며 개당 금액으로 확정한 것은 아니다. 배송비 0원 가정. |
| 엣지 컴퓨터 | 2,687,850원/구성 | Jetson 본체 2,640,000원과 BE200 Wi-Fi 7 Kit 무선랜카드 47,850원. |
| 2D 라이다 | 129,800원/대 | 2026-11-01 사용자 제공 금액. VAT 포함, 배송비 0원 가정. |
| PG42-4266-1270NE, 1/61 | 88,800원/개 | [모터뱅크](https://www.motorbank.kr/goods/goods_view.php?goodsNo=1000035837). 기본가 82,200원 + 1/61 옵션 6,600원. 2026-10-26 확인. VAT 포함, 어댑터 별도. 배송비 0원 가정. |
| 휠 모터 브라켓 | 7,260원/개 | 4개 합계 29,040원. 휠 모터 4개와 브라켓 4개의 구성 소계는 384,240원. |
| STS3215 | 39,600원/개 | 사용자 제공 금액. VAT 포함, 배송비 0원 가정. |
| STS3250 C001 | 143,000원/개 | 2026-11-08 확인한 판매처 참고가. 본체 130,000원에 VAT 포함, 배송비 0원 가정, 기타 추가 비용 미확인. [엘레파츠](https://www.eleparts.co.kr/goods/view?no=19159048) |
| 손목 카메라 | 676,830원/구매 묶음 | Wrist 카메라홀더와 카메라모듈 2개 구매 합계. [로보시 스마트스토어](https://smartstore.naver.com/roboseasy/products/12605183674) |
| 전원 배터리 | 431,970원/식 | GSP 리튬인산철 전동휠체어 배터리. [GSP몰](https://gspmall.com/product/%EA%B5%AD%EB%82%B4%EC%83%9D%EC%82%B0-gsp-%EB%A6%AC%ED%8A%AC%EC%9D%B8%EC%82%B0%EC%B2%A0-%EC%A0%84%EB%8F%99%ED%9C%A0%EC%B2%B4%EC%96%B4-%EB%B0%B0%ED%84%B0%EB%A6%AC-12v-42a/348/category/158/display/1/) |
| 포맥스 케이스 | 335,000원/구성 | 포맥스 외장 패널과 아크릴 판 합계. 사용자 제공 금액, VAT 포함. 아크릴 규격 미확인, 배송비 0원 가정. |
| IMU (MPU6050) | 5,000원/개 | 사용자 제공 금액. VAT 포함, 배송비 0원 가정. |
| 알루미늄 프로파일 | 87,000원 | 사용자 제공 금액. VAT 포함, 프로파일 비용으로 합산. 전체 프레임 제작비 미확인, 배송비 0원 가정. |

### 참고 소계의 범위

가격을 등록한 14개 구성의 참고 소계는 6,457,210원이다. 이 금액에는 Pan과 Tilt 모터 각 39,600원, 양팔 모터 각 444,400원을 포함한다. 사용자는 각 팔에 STS3215 4개와 STS3250 2개가 들어간다고 확인했다. Pan과 Tilt의 STS3215 각 1개와 팔의 관절별 배치는 시뮬레이션 기준이다. 기구부 비용은 미확인이다. 하드웨어 KB에는 STS3215 8개와 STS3250 3개가 기록되어 있어 사용자 확인 내용과 차이가 있다. [MuJoCo 모델](https://github.com/asm17-moving-agent/cleany/blob/707538de9d28291c679fcfd954f5587368d5a460/ros2_ws/src/cleany_description/mjcf/cleany.xml), [팔 캘리브레이션 도구](https://github.com/asm17-moving-agent/cleany/blob/707538de9d28291c679fcfd954f5587368d5a460/tools/calibrate_so101.py)

메카넘 휠과 손목 카메라는 각각 세트와 구매 묶음으로 한 번 합산한다. 2개 구성은 가격이 미등록이다. 프레임에는 프로파일 비용을 합산하며 나머지 제작비는 미확인이다. 사용자가 제공한 가격은 VAT 포함으로 확인했으며 배송비는 0원으로 가정한다.

## ROS 연결

### 데이터와 근거

ROS 목록은 2026-11-02 Cleany 작업 트리를 재검토한 정적 스냅샷이다. CAD는 2026-11-04 기준이며 가격 기준일은 각 항목에 기록한다. `src/data/ros-sources.json`은 HEAD, 원본 파일 SHA-256과 발췌문 SHA-256을 보관한다. 작업 트리 변경분을 포함하므로 HEAD만으로는 내용을 재현할 수 없다. 내용이 같은 기존 발췌문은 당시 확인일과 hash를 유지한다.

`src/data/ros-catalog.json`에는 전체 색인 140개 행, ROS 패키지의 직접 Python/C++ 선언 320개와 선언별 파일·줄·이름 해결 결과를 기록한다. 테스트 및 실행 검사 코드는 스캔에서 제외한다. 디스플레이 구독 계약, 실물 카메라 launch remap, Mock launch namespace와 검토한 실물 연결 근거를 보완한다. 같은 종류와 이름은 하나로 합치고 경로별 역할, 조건과 출처를 보존한다.

전체 253개 항목은 기본 이름 189개, ROS 자동 패턴 12개와 동적 이름 52개다. 색인의 과거 `/camera/depth/image_rect_raw`는 현재 노드의 기본값 `/camera/depth/image_raw`로 정정하며 원래 색인 키와 양쪽 근거를 `reconciliations`에 보존한다. `learned_rgbd.launch.py`의 aligned depth 구독은 별도 실행 구성의 기본값으로 기록하고 RealSense launch의 remap과 같은 구성이라고 가정하지 않는다.

### 목록과 환경의 표시 기준

| 범위 | 표시 기준 |
|---|---|
| 기본 이름 | 소스 기본값과 검토한 launch의 구체적 이름. 현재 실행 중이라는 뜻은 아님 |
| ROS 자동 | parameter 서비스, parameter events, action 내부 전송의 패턴. 노드 수를 추정하지 않음 |
| 동적 이름 | 설정, 함수 인자와 반복 변수로 결정되는 이름. 원본 식과 호출 위치를 보존하며 타입 미확정도 그대로 표시 |
| 실물 | 실물 구현 또는 검토한 드라이버 경로. 실물 검증 완료를 의미하지 않음 |
| 시뮬레이션 | Gazebo, MuJoCo, Mock 구현 경로 |
| 공통 | 환경을 고정하지 않은 코드 계약. 양 환경에서 실제 실행됐다는 의미가 아님 |

실물·시뮬레이션 필터는 경로별로 적용하고 반대 환경의 노드는 제외한다. `/scan`, `/joint_states`와 제어기처럼 이름을 공유하는 경로는 상세에서 환경별로 구분한다. 환경이 고정된 endpoint는 클라이언트가 공용 코드에 있더라도 전용 환경에만 표시한다. `모듈` 또는 `플러그인` 표기는 실행 노드명을 정적으로 확정할 수 없다는 뜻이다. 미지정 상대편을 임의로 만들지 않는다.

반대 환경을 제외한 뒤 발행자와 구독자가 모두 없는 기본 경로는 생성하지 않는다. 시뮬레이션 소비자만 있는 `/wheel/odom_raw`는 실물 목록에서 제외한다. 전체 보기의 `공통 · 실물`과 `공통 · 시뮬` 배지는 공용 계약과 확인된 전용 경로가 함께 있다는 뜻이다. 환경 필터를 선택하면 해당 환경으로 좁힌 경로의 배지를 표시한다.

### 환경별 경로와 QoS

설명과 QoS도 실행 경로에 보관한다. 실물 `/scan`에는 실물 드라이버 설명을 표시하고 시뮬레이션의 Reliable QoS를 전용하지 않는다. `/joint_states`는 `jointStateRoles`에 보관한 코드 근거로 발행자와 구독자의 관절 범위를 투영한다. 팔 전용 reader는 Pan에서 제외하고 휠 발행자와 odometry 구독자는 팔 경로에서 제외한다. 전체 공유 버스는 별도 버튼으로 유지한다. 설명과 QoS도 선택 범위로 좁히며 전체 보기에서 서로 다른 QoS를 하나의 확정값으로 합치지 않는다. 새 발행자나 구독자가 역할 표에 없으면 가져오기를 중단해 재검토를 요구한다.

### 호출자와 제공자

조작 CLI는 기본 `/mock`과 사용자가 `--namespace /`로 선택하는 root 경로를 구분한다. 복귀 CLI의 기본 root와 손목 제어 helper의 유한한 좌우 반복값을 확인해 호출자를 연결했다. Jetson의 손목 제어는 `JetsonOperations → CollectionPipeline → PregraspPipeline` 상속 경로의 기본 노드명 `pregrasp_pipeline`을 사용한다. namespace나 이름을 정적으로 확정하지 못한 원본 패턴은 동적 목록에 유지한다.

실물 손목 제공자는 `tools/collection-runtime`의 `left_wrist_rgb_camera`와 `right_wrist_rgb_camera` 실행 이름을 사용하며 클래스 기본명 `wrist_rgb_camera`를 조건에 기록한다. WristService는 독립 노드가 아니므로 `perception_inspector`에 귀속한다. `enabled`는 캡처 장치 소유 여부이며 유효한 영상 수신을 보증하지 않는다. 제어 guard의 `ready`도 관절 피드백 조건이며 물리적 정지 검증과 별개다. 이 웹앱은 해당 상태를 실시간으로 수신하지 않는다.

### 액션 내부 인터페이스

명시적으로 선언·관찰하는 액션 내부 인터페이스 11개는 상위 액션 ID를 기록한다. 여기에는 실물 guard가 기본 controller_names 네 개에 생성하는 취소 client를 포함한다. 설정을 줄이면 해당 부분집합만 생성되며 동적 원본 선언도 유지한다. 제공자는 같은 환경의 ActionServer 선언과 ROS 자동 생성 계약으로 보완하며 경로에 `action-contract` 근거를 표시한다. 액션별 상세와 내부 흐름은 send_goal, get_result, cancel_goal, feedback과 status의 다섯 계약을 표시한다. 구체적 선언이 없는 계약은 점선 카드로 구분하고 189개 기본 이름 목록에 새 실행 인스턴스로 합산하지 않는다. 실물 호출 근거만 있는 제어기 취소는 시뮬레이션의 기본 목록에 전용하지 않고 그 액션의 자동 계약으로 표시한다.

### 실행 흐름

실행 흐름은 `src/ros-relations.ts`에서 검토한 코드 관계를 표시한다. 조작의 조회 서비스는 액션과 같은 실행 기록을 참조하므로 화살표 없는 점선으로 표시하고 순차 호출로 해석하지 않는다. 취소 서비스는 활성 Goal ID로 ROS cancel_goal을 호출한다. 집기 검증은 관측 결과를 PlanGrasp 서비스에 전달하고 후보를 SelectReachableGrasp 액션으로 보내는 plan-only 경로다. 손목 영상·보정값 구독은 enable_wrist_observation 조건을 표시하며 USB 활성화 경로를 시뮬레이션에 복제하지 않는다. 베이스는 구동 허가, 명령, MCU 응답, 휠 관절 상태와 odometry relay를 연결한다. 각 선에는 호출·발행 코드와 조건의 로컬 근거가 있다.

베이스 흐름은 실물 MCU 또는 Mock MCU와 `cleany_base_driver → wheel_odometry → base_odom_relay` 경로를 선택한다. 같은 시뮬레이션 환경에 있는 Gazebo나 MuJoCo의 대체 발행자를 이 경로에 함께 표시하지 않는다. 전체 목록에는 해당 대체 경로를 보존한다.

### 부품별 연결

부품 연결도는 부품 관련 인터페이스를 컴퓨터 경계에 투영한 탐색용 도식이다. 전체 보기에서는 부품마다 중립색 수평선 하나로 관련 인터페이스를 묶어 표시한다. 중앙의 연결 위치를 분리해 선이 겹치지 않게 한다. 종류 선택 시 토픽은 녹색 실선, 서비스는 황색 파선, 액션은 보라색 점선으로 표시하며 해당 종류가 없는 부품의 선은 숨긴다. 데이터·요청 방향은 목록과 상세의 발행→구독, 호출→제공으로 표현한다. MCU, PWM 드라이버, 모터, 휠과 프레임 자체를 각각 ROS 노드로 취급하지 않는다. 부품·기능 매핑은 `src/ros.ts`, 연결 수 계산은 `src/connections.ts`에서 관리한다.

실물 Pan/Tilt는 control profile의 상태 읽기 전용 관절로 유지한다. Pan의 `/head_pan/command`는 Gazebo 경로에만 표시한다. 양팔 공용 계획·조작 인터페이스는 두 팔에 연결하지만 좌우 제어기 액션은 각 팔에만 연결한다.

Gazebo의 `/camera/{left,right}_wrist/*`도 손목 부품에 분류한다. `sorting_cameras/set_parameters`는 헤드와 손목 선택에 모두 관련된다. Mock 조작 namespace는 양팔 연관을 유지하며 물체·장면 출력은 헤드 카메라, 파지 계획과 충돌 형상은 카메라 및 양팔의 후속 처리로 연결한다. 이 연관은 모터나 센서가 해당 ROS 서비스를 직접 제공한다는 뜻이 아니다. `/base/imu_state`를 휠·모터·드라이버의 직접 인터페이스로 분류하지 않으며 `/grasp/plan`은 주행 계획과 구분한다.

### 목록 범위

전체 목록은 이 저장소의 소스 선언 범위다. 외부 ROS 패키지와 드라이버의 모든 API, 사용자 설정으로 생성되는 인스턴스와 remap 결과를 완전히 열거한 런타임 그래프는 아니다. 조회 명령은 복사만 하며 ROS 접근, 서비스 호출과 액션 전송은 하지 않는다.
