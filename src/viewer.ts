import { publicPath } from './public-path';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { byId, parts, type PartId } from './catalog';
import { selectMeshRegion, type MeshRegion } from './mesh-region';

interface GeometrySpec { type: string; file?: string; scale?: number[]; size?: number[]; radius?: number; length?: number; region?: MeshRegion; positions?: number[]; uvs?: number[]; texture?: string; }
interface Visual { xyz: number[]; rpy: number[]; geometry: GeometrySpec; rgba: number[]; category: PartId; }
interface Model { profile?: string; snapshotDate: string; links: { name: string; visuals: Visual[] }[]; joints: { name: string; type: string; parent: string; child: string; xyz: number[]; rpy: number[]; axis: number[] }[]; }
interface PickMesh extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> { userData: { partId: PartId; baseColor: THREE.Color; original: THREE.Vector3; wheelSide?: number; }; }
const pose: Record<string, number> = {};
const values = [-1.6, 2.87, 3.13, -.4, 1.55, -.2, 1.87, 2.44, 3.08, -1.42, 1.55, -.26];
['left', 'right'].forEach((side, s) => ['shoulder_yaw', 'shoulder_pitch', 'elbow_pitch', 'wrist_pitch', 'wrist_roll', 'gripper'].forEach((joint, i) => { pose[`${side}_${joint}_joint`] = values[s * 6 + i]; }));
const offsets: Record<PartId, THREE.Vector3> = {
  'left-arm': new THREE.Vector3(0, .26, .04), 'right-arm': new THREE.Vector3(0, -.26, .04),
  'head-camera': new THREE.Vector3(0, 0, .25), 'wrist-camera': new THREE.Vector3(.14, 0, .08),
  'head-pan': new THREE.Vector3(0, .14, .09), 'head-tilt': new THREE.Vector3(0, -.14, .17),
  frame: new THREE.Vector3(), wheels: new THREE.Vector3(0, 0, -.14), motors: new THREE.Vector3(.1, 0, -.05),
  computer: new THREE.Vector3(0, .22, .08), lidar: new THREE.Vector3(.22, 0, .08), drivers: new THREE.Vector3(0, -.22, .08),
  display: new THREE.Vector3(.38, 0, 0), case: new THREE.Vector3(.38, 0, 0),
  battery: new THREE.Vector3(0, .20, 0), imu: new THREE.Vector3(0, 0, .12),
};
const labelOffsets: Partial<Record<PartId, [number, number]>> = {
  'head-camera': [0, -30], 'head-pan': [-44, 12], 'head-tilt': [44, 0],
  wheels: [20, 25], motors: [-22, 5], lidar: [-24, 0], computer: [22, 0], drivers: [0, -22],
  display: [-16, -20], case: [45, 18], battery: [26, 16], imu: [-25, -11],
};

export class RobotViewer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, .01, 60);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private robot = new THREE.Group();
  private meshes: PickMesh[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(20, 20);
  private active: PartId | null = null;
  private hovered: PartId | null = null;
  private explodeTarget = 0;
  private explode = 0;
  private labels: { element: HTMLButtonElement; leader?: HTMLSpanElement; id: PartId; center: THREE.Vector3 }[] = [];
  private labelsVisible = true;
  private caseRemoved = false;
  private dragging = false;
  private down: [number, number] = [0, 0];
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private activeView = true;
  private environmentMap: THREE.WebGLRenderTarget;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  public ready = false;

  constructor(private host: HTMLElement, private onHover: (id: PartId | null, x?: number, y?: number) => void,
    private onSelect: (id: PartId) => void, private onStatus: (text: string, error?: boolean) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '끌리니 3D 모델. 드래그로 회전, 스크롤로 확대. 부품 목록으로도 모든 정보를 확인할 수 있습니다.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.host.prepend(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(2.15, 2.25, 1.7);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, .28);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = .07;
    this.controls.minDistance = 1.15;
    this.controls.maxDistance = 5;
    this.controls.maxPolarAngle = Math.PI * .52;
    this.controls.enablePan = false;
    this.controls.autoRotateSpeed = .7;
    this.controls.addEventListener('change', this.invalidate);
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.clearHover(); });
    this.scene.add(this.robot);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentMap = pmrem.fromScene(room, .04);
    this.scene.environment = this.environmentMap.texture;
    this.scene.environmentIntensity = .75;
    room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe9f8f2, 0xced2cc, 1.2));
    const key = new THREE.DirectionalLight(0xfffbef, 2.0);
    key.position.set(3, 2, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -1.8; key.shadow.camera.right = 1.8;
    key.shadow.camera.top = 1.8; key.shadow.camera.bottom = -1.8;
    key.shadow.normalBias = .015;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8efee, 1.2); fill.position.set(-2, -3, 3); this.scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .12 }));
    ground.position.z = -.38; ground.receiveShadow = true; this.scene.add(ground);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.58, .582, 128), new THREE.MeshBasicMaterial({ color: 0xb4c1b5, transparent: true, opacity: .3, side: THREE.DoubleSide }));
    ring.position.z = -.379; this.scene.add(ring);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host); this.resize();
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', e => { this.down = [e.clientX, e.clientY]; this.dragging = false; });
    canvas.addEventListener('pointermove', e => {
      if (e.buttons && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5) this.dragging = true;
      if (this.dragging) { this.clearHover(); return; }
      const rect = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.meshes.filter(mesh => mesh.visible), false)[0];
      const id = hit ? (hit.object as PickMesh).userData.partId : null;
      if (this.hovered !== id) { this.hovered = id; this.highlight(); }
      canvas.style.cursor = id ? 'pointer' : 'grab';
      this.onHover(id, e.clientX - rect.left, e.clientY - rect.top);
    });
    canvas.addEventListener('pointerleave', () => { this.dragging = false; this.clearHover(); });
    canvas.addEventListener('pointerup', e => {
      if (!this.dragging) {
        const rect = canvas.getBoundingClientRect();
        this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObjects(this.meshes.filter(mesh => mesh.visible), false)[0];
        if (hit) this.onSelect((hit.object as PickMesh).userData.partId);
      }
      this.dragging = false;
    });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.onStatus('3D 연결이 중단되었습니다. 새로고침하거나 부품 목록을 이용해 주세요.', true); });
    document.addEventListener('visibilitychange', this.visibilityChange);
    this.invalidate();
  }
  private visibilityChange = () => {
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.invalidate();
  };
  private invalidate = (): void => {
    if (!this.disposed && this.activeView && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.animate);
  };
  setActive(active: boolean): void {
    this.activeView = active;
    cancelAnimationFrame(this.frame); this.frame = 0;
    if (active) this.invalidate();
    else this.clearHover();
  }
  private resize(): void {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / Math.max(height, 1); this.camera.updateProjectionMatrix();
    this.invalidate();
  }
  async load(): Promise<void> {
    const response = await fetch(publicPath('/models/cleany.json'));
    if (!response.ok) throw new Error('모델 정보를 불러오지 못했습니다.');
    const data: Model = await response.json();
    const date = data.snapshotDate.replaceAll('-', '.');
    const label = document.querySelector('[data-cad-date]');
    if (label) label.textContent = `CAD · ${date}`;
    const sourceDate = document.querySelector('[data-cad-source-date]');
    if (sourceDate) sourceDate.textContent = date;
    const loader = new STLLoader();
    const cache = new Map<string, Promise<THREE.BufferGeometry>>();
    const hierarchy = new THREE.Group();
    const links = new Map(data.links.map(link => [link.name, new THREE.Group()]));
    hierarchy.add(links.get('base_link')!);
    data.joints.forEach(joint => {
      const group = links.get(joint.child)!;
      group.position.fromArray(joint.xyz);
      group.quaternion.setFromEuler(new THREE.Euler(joint.rpy[0], joint.rpy[1], joint.rpy[2], 'ZYX'));
      if (joint.type !== 'fixed') group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().fromArray(joint.axis).normalize(), pose[joint.name] ?? 0));
      links.get(joint.parent)!.add(group);
    });
    let completed = 0;
    const total = data.links.reduce((sum, link) => sum + link.visuals.length, 0);
    await Promise.all(data.links.flatMap(link => link.visuals.map(async visual => {
      const spec = visual.geometry;
      let geometry: THREE.BufferGeometry;
      let texture: THREE.Texture | undefined;
      if (spec.type === 'mesh') {
        if (!cache.has(spec.file!)) cache.set(spec.file!, loader.loadAsync(publicPath(`/models/${spec.file}`)));
        geometry = await cache.get(spec.file!)!;
        if (spec.region) geometry = selectMeshRegion(geometry, spec.region);
      } else if (spec.type === 'screen') {
        texture = await new THREE.TextureLoader().loadAsync(publicPath(`/models/${spec.texture}`));
        texture.colorSpace = THREE.SRGBColorSpace;
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(spec.positions!, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(spec.uvs!, 2));
        geometry.computeVertexNormals();
      } else if (spec.type === 'box') geometry = new THREE.BoxGeometry(...spec.size as [number, number, number]);
      else if (spec.type === 'cylinder') { geometry = new THREE.CylinderGeometry(spec.radius, spec.radius, spec.length, 32); geometry.rotateX(Math.PI / 2); }
      else if (spec.type === 'sphere') geometry = new THREE.SphereGeometry(spec.radius, 24, 16);
      else throw new Error(`지원하지 않는 모델 형상: ${spec.type}`);
      const isDark = Math.max(...visual.rgba.slice(0, 3)) < .25;
      const saturated = Math.max(...visual.rgba.slice(0, 3)) - Math.min(...visual.rgba.slice(0, 3)) > .12;
      const color = isDark ? '#353c39' : saturated ? (visual.category === 'wrist-camera' ? '#739489' : '#a1b4a6') : '#a4afa6';
      const [r, g, b, opacity] = visual.rgba;
      const material = new THREE.MeshStandardMaterial({ color, metalness: isDark ? .15 : saturated ? .25 : .62, roughness: .4 });
      if (data.profile === 'freecad_final') {
        material.color.setRGB(r, g, b, THREE.SRGBColorSpace);
        material.metalness = .1;
        material.opacity = opacity;
        material.transparent = opacity < 1;
      }
      if (texture) {
        material.color.set(0xffffff);
        material.map = texture;
        material.emissive.set(0xffffff);
        material.emissiveMap = texture;
        material.emissiveIntensity = .7;
      }
      const mesh = new THREE.Mesh(geometry, material) as PickMesh;
      mesh.position.fromArray(visual.xyz); mesh.rotation.set(visual.rpy[0], visual.rpy[1], visual.rpy[2], 'ZYX');
      if (spec.scale) mesh.scale.fromArray(spec.scale);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { partId: visual.category, baseColor: mesh.material.color.clone(), original: new THREE.Vector3() };
      links.get(link.name)!.add(mesh); this.meshes.push(mesh);
      this.onStatus(`CAD 모델 불러오는 중 · ${Math.round(++completed / total * 100)}%`);
    })));
    hierarchy.updateMatrixWorld(true);
    for (const mesh of this.meshes) {
      const transform = mesh.matrixWorld.clone();
      if (mesh.userData.partId === 'wheels') {
        mesh.geometry.computeBoundingBox();
        const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(transform);
        mesh.userData.wheelSide = Math.sign(center.y);
      }
      this.robot.add(mesh); transform.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.userData.original.copy(mesh.position);
    }
    this.addConcepts();
    this.robot.updateMatrixWorld(true);
    for (const part of parts) {
      const box = new THREE.Box3();
      this.meshes.filter(mesh => mesh.userData.partId === part.id).forEach(mesh => box.expandByObject(mesh));
      if (box.isEmpty()) continue;
      const button = document.createElement('button');
      button.className = 'hotspot'; button.dataset.part = part.id;
      button.setAttribute('aria-label', `${part.name} 살펴보기`);
      button.innerHTML = `<span>${part.number}</span><b>${part.name}</b>`;
      button.addEventListener('click', () => this.onSelect(part.id));
      button.addEventListener('mouseenter', () => { this.hovered = part.id; this.highlight(); this.onHover(part.id, button.offsetLeft, button.offsetTop); });
      button.addEventListener('mouseleave', () => this.clearHover());
      const leader = labelOffsets[part.id] ? document.createElement('span') : undefined;
      if (leader) { leader.className = 'hotspot-leader'; leader.setAttribute('aria-hidden', 'true'); this.host.append(leader); }
      this.host.append(button);
      this.labels.push({ element: button, leader, id: part.id, center: box.getCenter(new THREE.Vector3()) });
    }
    this.ready = true;
    this.setCaseRemoved(this.caseRemoved);
    this.onStatus('모델 준비 완료');
  }
  private addConcepts(): void {
    const add = (id: PartId, geometry: THREE.BufferGeometry, position: number[], solid = false) => {
      if (this.meshes.some(mesh => mesh.userData.partId === id)) {
        geometry.dispose();
        return;
      }
      const material = new THREE.MeshStandardMaterial({
        color: solid ? '#365d52' : '#536e60', roughness: .6, metalness: .25,
        transparent: !solid, opacity: solid ? 1 : .55, wireframe: !solid,
      });
      const mesh = new THREE.Mesh(geometry, material) as PickMesh;
      mesh.position.fromArray(position);
      mesh.userData = { partId: id, baseColor: mesh.material.color.clone(), original: mesh.position.clone() };
      this.robot.add(mesh); this.meshes.push(mesh);
    };
    add('computer', new THREE.BoxGeometry(.14, .1, .045), [-.03, .08, -.05]);
    add('drivers', new THREE.BoxGeometry(.09, .09, .02), [-.04, -.1, -.17]);
    // Provisional battery envelope from the design notes, on the opposite side of the drivers.
    add('battery', new THREE.BoxGeometry(.195, .165, .175), [-.085, .114, -.19], true);
    const lidar = new THREE.CylinderGeometry(.045, .045, .035, 24); lidar.rotateX(Math.PI / 2);
    add('lidar', lidar, [.18, 0, .03]);
  }
  select(id: PartId | null): void { this.active = id; this.highlight(); }
  private clearHover(): void { this.hovered = null; this.onHover(null); this.highlight(); }
  private highlight(): void {
    const current = this.hovered ?? this.active;
    for (const mesh of this.meshes) {
      const selected = mesh.userData.partId === current;
      mesh.material.color.copy(mesh.userData.baseColor);
      if (selected) mesh.material.color.lerp(new THREE.Color('#1e8f74'), .75);
      if (!mesh.material.emissiveMap) {
        mesh.material.emissive.set(selected ? '#073c2b' : '#000000');
        mesh.material.emissiveIntensity = selected ? .22 : 0;
      }
    }
    this.labels.forEach(label => label.element.classList.toggle('active', label.id === current));
    this.invalidate();
  }
  setExploded(value: boolean): void { this.explodeTarget = value ? 1 : 0; this.invalidate(); }
  setCaseRemoved(value: boolean): void {
    this.caseRemoved = value;
    for (const mesh of this.meshes) mesh.visible = !value || byId(mesh.userData.partId).assembly !== 'cover';
    this.clearHover();
  }
  setLabels(value: boolean): void { this.labelsVisible = value; this.invalidate(); }
  setAutoRotate(value: boolean): void { this.controls.autoRotate = value; this.invalidate(); }
  get autoRotate(): boolean { return this.controls.autoRotate; }
  zoom(direction: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * (direction > 0 ? .82 : 1.22), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance)); this.controls.update();
  }
  setView(view: 'iso' | 'front' | 'side'): void {
    this.controls.autoRotate = false;
    const position = view === 'front' ? [3.25, 0, 1.1] : view === 'side' ? [0, 3.25, 1.1] : [2.15, 2.25, 1.7];
    this.camera.position.fromArray(position); this.controls.target.set(0, 0, .28); this.controls.update();
  }
  private animate = (): void => {
    this.frame = 0;
    if (this.disposed || !this.activeView || document.hidden || !this.host.offsetWidth) return;
    this.explode = this.reducedMotion ? this.explodeTarget : THREE.MathUtils.lerp(this.explode, this.explodeTarget, .07);
    if (Math.abs(this.explode - this.explodeTarget) < .0001) this.explode = this.explodeTarget;
    for (const mesh of this.ready ? this.meshes : []) {
      mesh.position.copy(mesh.userData.original).addScaledVector(offsets[mesh.userData.partId], this.explode);
      mesh.position.y += (mesh.userData.wheelSide ?? 0) * this.explode * .12;
    }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
    const width = this.host.clientWidth, height = this.host.clientHeight;
    this.labels.forEach(label => {
      const point = label.center.clone().addScaledVector(offsets[label.id], this.explode).project(this.camera);
      const assembly = byId(label.id).assembly;
      const shown = assembly === 'cover' ? !this.caseRemoved
        : assembly !== 'interior' || this.caseRemoved || this.explode > .5;
      const visible = shown && this.labelsVisible && point.z < 1 && Math.abs(point.x) < .92 && Math.abs(point.y) < .85;
      const x = (point.x * .5 + .5) * width, y = (-point.y * .5 + .5) * height;
      const [dx, dy] = labelOffsets[label.id] ?? [0, 0];
      label.element.hidden = !visible;
      label.element.style.left = `${x + dx}px`;
      label.element.style.top = `${y + dy}px`;
      if (label.leader) {
        label.leader.hidden = !visible;
        label.leader.style.left = `${x}px`; label.leader.style.top = `${y}px`;
        label.leader.style.width = `${Math.hypot(dx, dy)}px`;
        label.leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      }
    });
    if (this.controls.autoRotate || this.explode !== this.explodeTarget) this.invalidate();
  };
  dispose(): void {
    this.disposed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); this.controls.dispose();
    document.removeEventListener('visibilitychange', this.visibilityChange);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => {
      if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    });
    this.environmentMap.dispose(); this.renderer.dispose();
  }
}
