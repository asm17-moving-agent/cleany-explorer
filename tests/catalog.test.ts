import test from 'node:test';
import assert from 'node:assert/strict';
import { parts, filterParts, referenceSubtotal, partSubtotal, partVatIncluded, csvCatalog, byId } from '../src/catalog.ts';

test('the subtotal includes supplied VAT-inclusive prices and leaves unknown groups unpriced', () => {
  assert.deepEqual(referenceSubtotal(parts), { amount: 6457210, known: 14, unknown: 2 });
  const unknown = parts.filter(part => !part.price);
  assert.deepEqual(referenceSubtotal(unknown), { amount: 0, known: 0, unknown: 2 });
  assert.equal(partSubtotal(byId('imu')), 5000);
  assert.equal(partVatIncluded(byId('imu')), true);
  assert.equal(partSubtotal(byId('frame')), 87000);
  assert.equal(partVatIncluded(byId('frame')), true);
});
test('supplied prices preserve the quote amounts and count the four-wheel set once', () => {
  for (const [id, amount] of [['head-camera', 572000], ['wheels', 179520], ['lidar', 129800]] as const) {
    const price = byId(id).price!;
    assert.equal(price.amount, amount);
    assert.equal(price.basis, '사용자 제공가');
    assert.equal(price.vatIncluded, true);
    assert.equal(price.date, '2026-11-01');
    assert.equal(price.url, null);
  }
  assert.equal(byId('wheels').quantity, '4개');
  assert.equal(byId('wheels').price?.scope, 'group');
  assert.equal(referenceSubtotal([byId('wheels')]).amount, 179520);
});
test('configuration prices include accessories and count the wrist bundle once', () => {
  const computer = byId('computer');
  const motors = byId('motors');
  assert.equal(computer.price?.amount, 2640000);
  assert.equal(computer.includedPrices?.[0].price.amount, 47850);
  assert.equal(partSubtotal(computer), 2687850);
  assert.equal(motors.price?.amount, 82200 + 6600);
  assert.equal(motors.includedPrices?.[0].price.amount, 7260);
  assert.equal(partSubtotal(motors), (88800 + 7260) * 4);
  assert.equal(partVatIncluded(motors), true);
  assert.equal(partSubtotal(byId('wrist-camera')), 676830);
  assert.equal(partSubtotal(byId('battery')), 431970);
  assert.equal(partSubtotal(byId('case')), 335000);
  assert.equal(partVatIncluded(byId('case')), true);
  for (const id of ['left-arm', 'right-arm'] as const) {
    assert.equal(byId(id).referencePrices?.find(item => item.name === 'STS3215')?.price?.amount, 39600);
    assert.equal(byId(id).referencePrices?.find(item => item.name === 'STS3250')?.price?.amount, 143000);
    assert.equal(partSubtotal(byId(id)), 39600 * 4 + 143000 * 2);
  }
  assert.equal(partSubtotal(byId('head-pan')), 39600);
  assert.equal(partSubtotal(byId('head-tilt')), 39600);
});
test('category and case-insensitive search intersect, including empty results', () => {
  assert.deepEqual(filterParts('매니퓰레이터', '  FEETECH ').map(part => part.id), ['left-arm', 'right-arm']);
  assert.equal(filterParts('인지 센서', 'Jetson').length, 0);
  assert.deepEqual(filterParts('전체', '라이다').map(part => part.id), ['lidar']);
});
test('CSV keeps unknown prices blank and carries provenance', () => {
  const csv = csvCatalog();
  assert.ok(csv.startsWith('\uFEFF'));
  assert.equal(csv.split('\r\n').length, 17);
  assert.ok(csv.includes('"4개","88800","개","384240","포함","판매처 참고가","2026-10-26"'));
  assert.ok(csv.includes('모터 브라켓 ₩7,260/개 × 4'));
  assert.ok(csv.includes('BE200 Wi-Fi 7 Kit 무선랜카드 ₩47,850/개 × 1'));
  assert.ok(csv.includes('"4개","179520","4개 세트","179520","포함","사용자 제공가","2026-11-01"'));
  assert.ok(csv.includes('"1대","","","","","미등록"'));
});
test('all displayed prices have explicit source, type, date and caveats', () => {
  for (const part of parts) {
    const prices = [part.price, ...part.includedPrices?.map(item => item.price) ?? [], ...part.referencePrices?.map(ref => ref.price) ?? []];
    for (const price of prices) {
      if (!price) continue;
      assert.ok(price.amount > 0);
      if (price.basis === '사용자 제공가' || price.basis === '모터 추정가') assert.equal(price.vatIncluded, true);
      if (price.basis === '판매처 참고가' || price.basis === '견적' || price.url) assert.match(price.url!, /^https:\/\//);
      assert.match(price.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(price.note);
    }
  }
});
