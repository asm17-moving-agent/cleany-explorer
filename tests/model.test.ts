import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parts } from '../src/catalog.ts';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { selectMeshRegion } from '../src/mesh-region.ts';
const root = new URL('../public/models/', import.meta.url);
const model = JSON.parse(readFileSync(new URL('cleany.json', root), 'utf8'));

test('every visual CAD asset is preserved byte for byte and belongs to a known part', () => {
  const ids = new Set(parts.map(part => part.id));
  for (const asset of Object.values(model.assets) as { file: string; sha256: string; bytes: number }[]) {
    const bytes = readFileSync(new URL(asset.file, root));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  }
  for (const link of model.links) for (const visual of link.visuals) assert.ok(ids.has(visual.category));
});
test('robot hierarchy has one connected root and all joint transformations are finite', () => {
  const reached = new Set(['base_link']);
  for (let pass = 0; pass < model.joints.length; pass++) {
    for (const joint of model.joints) {
      assert.ok([...joint.xyz, ...joint.rpy, ...joint.axis].every(Number.isFinite));
      if (reached.has(joint.parent)) reached.add(joint.child);
    }
  }
  assert.equal(reached.size, model.links.length);
  assert.equal(model.joints.length, model.links.length - 1);
});

test('FreeCAD selection follows the saved arm, head and sensor groups', () => {
  assert.equal(model.profile, 'freecad_final');
  assert.ok(model.joints.every((joint: { type: string }) => joint.type === 'fixed'));
  const groups = new Map(model.links.map((link: { name: string; visuals: { category: string }[] }) => [
    link.name, link.visuals.map(visual => visual.category),
  ]));
  for (const side of ['Left', 'Right']) {
    for (const section of ['Base', 'Yaw', 'Upper', 'Lower', 'Wrist', 'Tool']) {
      const categories = groups.get(`cad_snapshot_${side}${section}`) as string[];
      assert.ok(categories.length && categories.every(category => category === `${side.toLowerCase()}-arm`));
    }
    const cameras = groups.get(`cad_snapshot_${side}CameraComponents`) as string[];
    assert.ok(cameras.length && cameras.every(category => category === 'wrist-camera'));
  }
  assert.deepEqual(new Set(groups.get('cad_snapshot_HeadRig') as string[]), new Set(['head-pan', 'head-tilt', 'head-camera']));
  assert.ok((groups.get('cad_snapshot_LidarRig') as string[]).every(category => category === 'lidar'));
  for (const [group, part] of [
    ['FramePanels', 'case'], ['PanelMounting', 'case'], ['FrontBranding', 'case'],
    ['FrameStructure', 'frame'], ['VirtualDisplay', 'display'], ['IMURig', 'imu'],
  ]) {
    const categories = groups.get(`cad_snapshot_${group}`) as string[];
    assert.ok(categories.length && categories.every(category => category === part), group);
  }
  for (const category of ['wheels', 'motors']) {
    assert.equal((groups.get('cad_snapshot_DriveBase') as string[]).filter(value => value === category).length, 4);
  }
});

test('the display uses its original texture on a forward-facing CAD plane', () => {
  const display = model.links.find((link: { name: string }) => link.name === 'cad_snapshot_VirtualDisplay');
  const screen = display.visuals.find((visual: { geometry: { type: string } }) => visual.geometry.type === 'screen').geometry;
  assert.equal(screen.positions.length, 18);
  assert.equal(screen.uvs.length, 12);
  const [a, b, c] = [0, 3, 6].map(offset => screen.positions.slice(offset, offset + 3));
  assert.ok(a[0] > 0 && screen.positions.every((value: number, i: number) => i % 3 !== 0 || value === a[0]));
  assert.ok((b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]) > 0);
  assert.equal(screen.texture, model.assets['meshes/freecad_final/idle.png'].file);
});

test('mesh partition rejects a boundary that would cut a triangle', () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 2, 0, 1, 2], 3));
  assert.throws(() => selectMeshRegion(geometry, { axis: 2, boundary: 1, side: 'upper' }), /crosses a triangle/);
});
