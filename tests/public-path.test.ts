import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPath } from '../src/public-path.ts';

test('public files resolve under the configured site path', () => {
  assert.equal(publicPath('/models/cleany.json', '/'), '/models/cleany.json');
  assert.equal(publicPath('/models/cleany.json', '/cleany-explorer/'), '/cleany-explorer/models/cleany.json');
  assert.equal(publicPath('/ros/sources/base.txt', '/cleany-explorer/'), '/cleany-explorer/ros/sources/base.txt');
  assert.equal(publicPath('https://example.com/source', '/cleany-explorer/'), 'https://example.com/source');
});
