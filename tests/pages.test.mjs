import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  transferHardBreak,
  removeTopEntry,
  moveTopEntry,
  moveIntoFolder,
  mergeTopEntries,
  dissolveFolder,
  sanitizeSites,
} from '../js/domain/pages.js';

const mk = (id, extra = {}) => ({ id, name: id, url: `https://${id}.example.com`, icon: '', badge: false, folder: false, parent: '', h: 0, ...extra });

test('removeTopEntry：删除页首图标时硬分页转移给其后第一个顶层图标', () => {
  const sites = [mk('a', { h: 1 }), mk('b'), mk('c')];
  assert.equal(removeTopEntry(sites, 'a'), true);
  assert.deepEqual(sites.map(s => s.id), ['b', 'c']);
  assert.equal(sites[0].h, 1); // b 接棒成为新页首
});

test('removeTopEntry：删除中间图标不影响其他页首标记', () => {
  const sites = [mk('a'), mk('b', { h: 1 }), mk('c')];
  removeTopEntry(sites, 'a');
  assert.deepEqual(sites.map(s => [s.id, s.h]), [['b', 1], ['c', 0]]);
});

test('removeTopEntry：删除末页唯一图标（无后继）页消失', () => {
  const sites = [mk('a'), mk('b', { h: 1 })];
  removeTopEntry(sites, 'b');
  assert.deepEqual(sites.map(s => s.id), ['a']);
  assert.equal(sites[0].h, 0);
});

test('moveTopEntry：普通移动按顶层索引落位（成员不计数）', () => {
  const f = mk('f', { folder: true });
  const sites = [mk('a'), mk('m1', { parent: 'f' }), mk('b'), mk('c')];
  sites.splice(1, 0, f); // [a, f, m1, b, c]
  const res = moveTopEntry(sites, 'a', 2); // 移到第 2 个顶层位（b 之后）
  assert.equal(res.topCount, 4); // 顶层：a/f/b/c（文件夹本身也是顶层）
  assert.deepEqual(sites.filter(s => !s.parent).map(s => s.id), ['f', 'b', 'a', 'c']);
});

test('moveTopEntry：移动页首图标时硬分页随行转移', () => {
  const sites = [mk('a', { h: 1 }), mk('b'), mk('c'), mk('d')];
  moveTopEntry(sites, 'a', 2); // 移到 c 之后
  assert.deepEqual(sites.map(s => s.id), ['b', 'c', 'a', 'd']);
  assert.equal(sites[0].h, 1); // b 接棒
  assert.equal(sites[2].h, 0);
});

test('moveTopEntry：hardBreak 追加并自成页首（「新建页」语义）', () => {
  const sites = [mk('a'), mk('b'), mk('c')];
  moveTopEntry(sites, 'a', 99, { hardBreak: true });
  assert.deepEqual(sites.map(s => [s.id, s.h]), [['b', 0], ['c', 0], ['a', 1]]);
});

test('moveTopEntry：条目不存在返回 null', () => {
  assert.equal(moveTopEntry([mk('a')], 'zz', 0), null);
});

test('moveIntoFolder：页首图标入夹时硬分页转移给后续顶层', () => {
  const sites = [mk('a', { h: 1 }), mk('b'), mk('f', { folder: true })];
  assert.equal(moveIntoFolder(sites, 'a', 'f'), true);
  assert.equal(sites.find(s => s.id === 'a').parent, 'f');
  assert.equal(sites.find(s => s.id === 'b').h, 1); // b 接棒页首
});

test('moveIntoFolder：目标不是文件夹时拒绝', () => {
  const sites = [mk('a'), mk('b')];
  assert.equal(moveIntoFolder(sites, 'a', 'b'), false);
  assert.equal(sites.find(s => s.id === 'a').parent, '');
});

test('mergeTopEntries：文件夹落在目标位置并继承目标页首标记', () => {
  const sites = [mk('a'), mk('b', { h: 1 }), mk('c')];
  const folder = mergeTopEntries(sites, 'a', 'b', 'fx', '新文件夹');
  assert.equal(folder.folder, true);
  assert.equal(folder.h, 1); // 继承目标（b 是页首）
  assert.deepEqual(sites.map(s => s.id), ['a', 'fx', 'b', 'c']);
  assert.equal(sites.find(s => s.id === 'a').parent, 'fx');
  assert.equal(sites.find(s => s.id === 'b').parent, 'fx');
});

test('mergeTopEntries：被拖图标是页首时标记转移（可能转给新文件夹本身）', () => {
  const sites = [mk('a', { h: 1 }), mk('b')];
  const folder = mergeTopEntries(sites, 'a', 'b', 'fx', '新文件夹');
  assert.equal(folder.h, 1); // b 无标记，a 的标记经 transfer 落到紧随其后的新文件夹
  assert.deepEqual(sites.filter(s => s.h).map(s => s.id), ['fx']);
});

test('mergeTopEntries：文件夹与文件夹不能合并', () => {
  const sites = [mk('a', { folder: true }), mk('b', { folder: true })];
  assert.equal(mergeTopEntries(sites, 'a', 'b', 'fx', 'x'), null);
});

test('dissolveFolder：成员回到桌面且 h 清零，文件夹移除', () => {
  const sites = [mk('f', { folder: true }), mk('m1', { parent: 'f' }), mk('m2', { parent: 'f' }), mk('a')];
  assert.equal(dissolveFolder(sites, 'f'), true);
  assert.equal(sites.some(s => s.id === 'f'), false);
  assert.deepEqual(sites.map(s => [s.id, s.parent, s.h]), [['m1', '', 0], ['m2', '', 0], ['a', '', 0]]);
});

test('transferHardBreak：无标记时是空操作', () => {
  const sites = [mk('a'), mk('b')];
  transferHardBreak(sites, sites[0]);
  assert.deepEqual(sites.map(s => s.h), [0, 0]);
});

test('sanitizeSites：孤儿回桌面 / 自指修复 / h 仅顶层 / 顶层在前', () => {
  const sites = [
    mk('a', { h: 1 }),
    mk('m1', { parent: 'ghost', h: 1 }),  // 宿主不存在 → 回桌面
    mk('m2', { parent: 'f', h: 1 }),      // 成员带 h → 清零
    mk('f', { folder: true }),
    mk('self', { parent: 'self' }),       // 自指 → 回桌面
  ];
  const out = sanitizeSites(sites);
  assert.deepEqual(out.filter(s => !s.parent).map(s => s.id), ['a', 'm1', 'f', 'self']); // 保持原始相对顺序
  assert.deepEqual(out.filter(s => s.parent).map(s => [s.id, s.h]), [['m2', 0]]);
  assert.deepEqual(out.filter(s => s.h).map(s => s.id), ['a']);
});

test('sanitizeSites：重复 id 只保留首个', () => {
  const out = sanitizeSites([mk('a', { name: 'first' }), mk('a', { name: 'dup' })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'first');
});
