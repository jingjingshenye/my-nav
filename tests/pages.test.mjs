import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  transferHardBreak,
  removeTopEntry,
  moveTopEntry,
  moveIntoFolder,
  mergeTopEntries,
  dissolveFolder,
  mergeFolders,
  reorderFolderMember,
  sanitizeSites,
  rebalancePages,
  repageAll,
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

test('dissolveFolder：成员按原顺序补入文件夹原位置，h 清零，文件夹移除', () => {
  const sites = [mk('a'), mk('f', { folder: true }), mk('m1', { parent: 'f' }), mk('m2', { parent: 'f' }), mk('b')];
  assert.equal(dissolveFolder(sites, 'f'), true);
  assert.equal(sites.some(s => s.id === 'f'), false);
  assert.deepEqual(sites.map(s => [s.id, s.parent, s.h]), [['a', '', 0], ['m1', '', 0], ['m2', '', 0], ['b', '', 0]]); // 成员回 f 原位
});

test('dissolveFolder：页首文件夹解散时标记转移给第一个成员', () => {
  const sites = [mk('a'), mk('f', { folder: true, h: 1 }), mk('m1', { parent: 'f' }), mk('m2', { parent: 'f' })];
  dissolveFolder(sites, 'f');
  assert.deepEqual(sites.map(s => [s.id, s.h]), [['a', 0], ['m1', 1], ['m2', 0]]); // m1 接棒页首
});

test('mergeFolders：src 全部成员并入 target，src 移除，target 位置与标记保留', () => {
  const sites = [mk('fa', { folder: true }), mk('m1', { parent: 'fa' }), mk('m2', { parent: 'fa' }), mk('fb', { folder: true, h: 1 }), mk('m3', { parent: 'fb' })];
  assert.equal(mergeFolders(sites, 'fa', 'fb'), true);
  assert.equal(sites.some(s => s.id === 'fa'), false);
  assert.deepEqual(sites.filter(s => s.parent === 'fb').map(s => s.id), ['m1', 'm2', 'm3']);
  const fb = sites.find(s => s.id === 'fb');
  assert.equal(fb.h, 1); // target 的页首标记保留
  assert.deepEqual(sites.filter(s => !s.parent).map(s => s.id), ['fb']);
});

test('mergeFolders：页首夹被并走时标记转移给目标夹', () => {
  const sites = [mk('fa', { folder: true, h: 1 }), mk('a', { parent: 'fa' }), mk('fb', { folder: true })];
  assert.equal(mergeFolders(sites, 'fa', 'fb'), true);
  assert.equal(sites.find(x => x.id === 'fb').h, 1); // 标记转到目标
  assert.equal(sites.find(x => x.id === 'fa'), undefined);
});

test('dissolveFolder：空夹且为页首时标记转移给后续顶层条目', () => {
  const sites = [mk('fx', { folder: true, h: 1 }), mk('a'), mk('b')];
  assert.equal(dissolveFolder(sites, 'fx'), true);
  assert.deepEqual(sites.map(x => [x.id, x.h]), [['a', 1], ['b', 0]]); // a 接棒页首
});

test('dissolveFolder：空夹非页首直接删除', () => {
  const sites = [mk('a'), mk('fx', { folder: true })];
  assert.equal(dissolveFolder(sites, 'fx'), true);
  assert.deepEqual(sites.map(x => x.id), ['a']);
});

test('mergeFolders：文件夹 x 普通图标 拒绝', () => {
  const sites = [mk('fa', { folder: true }), mk('a')];
  assert.equal(mergeFolders(sites, 'fa', 'a'), false);
});

test('reorderFolderMember：成员在夹内前移/后移，顶层与其他夹不受影响', () => {
  const sites = [
    mk('a'), mk('f1', { folder: true }), mk('m1', { parent: 'f1' }), mk('m2', { parent: 'f1' }),
    mk('m3', { parent: 'f1' }), mk('f2', { folder: true }), mk('n1', { parent: 'f2' }), mk('b'),
  ];
  assert.equal(reorderFolderMember(sites, 'f1', 'm1', 2), true); // m1 移到第 2 位（m2 之后）
  assert.deepEqual(sites.filter(s => s.parent === 'f1').map(s => s.id), ['m2', 'm3', 'm1']);
  assert.deepEqual(sites.filter(s => !s.parent).map(s => s.id), ['a', 'f1', 'f2', 'b']); // 顶层顺序不动
  assert.deepEqual(sites.filter(s => s.parent === 'f2').map(s => s.id), ['n1']); // 其他夹不动
});

test('reorderFolderMember：同位移动不生效 / 越界钳制 / 未知成员拒绝', () => {
  const sites = [mk('f', { folder: true }), mk('m1', { parent: 'f' }), mk('m2', { parent: 'f' })];
  assert.equal(reorderFolderMember(sites, 'f', 'm1', 0), false); // 同位
  assert.equal(reorderFolderMember(sites, 'f', 'm1', 99), true); // 越界钳到末位
  assert.deepEqual(sites.filter(s => s.parent === 'f').map(s => s.id), ['m2', 'm1']);
  assert.equal(reorderFolderMember(sites, 'f', 'ghost', 0), false);
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

// ── rebalancePages：inftab finishingSites 对标 ──
test('rebalancePages：删除不跨页回填（页内空洞保留）', () => {
  const mk = (n, h) => ({ id: n, parent: '', h });
  // 3 页（perPage=2）：[a,b] [c,d] [e]
  const sites = [mk('a'), mk('b'), mk('c', 1), mk('d'), mk('e', 1)];
  sites.splice(1, 1); // 删 b → 页内空洞
  rebalancePages(sites, 2);
  const tops = sites.filter(x => !x.parent);
  // 页构成：[a] [c,d] [e] —— c 仍是页首（不回填）
  assert.equal(tops[0].h, 0);
  assert.equal(tops[1].id, 'c'); assert.equal(tops[1].h, 1);
  assert.equal(tops[2].id, 'd'); assert.equal(tops[2].h, 0);
  assert.equal(tops[3].id, 'e'); assert.equal(tops[3].h, 1);
});

test('rebalancePages：满页溢出级联到下一页头', () => {
  const mk = (n, h) => ({ id: n, parent: '', h });
  // 页0 满 [a,b]；页1 [c,d]；插入 x 到页0 → 溢出 b 挤到页1 头
  const sites = [mk('a'), mk('b'), mk('c', 1), mk('d')];
  sites.splice(1, 0, { id: 'tx', parent: '', h: 0 }); // a,x,b,c,d
  rebalancePages(sites, 2);
  const tops = sites.filter(x => !x.parent);
  // 页构成：[a,x] [b,c] [d] —— b 被挤到下一页头并接管页首标记
  assert.equal(tops[2].id, 'b'); assert.equal(tops[2].h, 1);
  assert.equal(tops[3].id, 'c'); assert.equal(tops[3].h, 0);
  assert.equal(tops[4].id, 'd'); assert.equal(tops[4].h, 1);
});

test('rebalancePages：空页删除', () => {
  const mk = (n, h) => ({ id: n, parent: '', h });
  // 页1 只有一项 c，被删走 → 空页消失，页2 顶上
  const sites = [mk('a'), mk('b'), mk('c', 1), mk('d', 1), mk('e')];
  sites.splice(2, 1); // 删 c
  rebalancePages(sites, 2);
  const tops = sites.filter(x => !x.parent);
  assert.equal(tops.length, 4);
  assert.equal(tops[2].id, 'd'); assert.equal(tops[2].h, 1); // 页首标记随之上移
});

// ── repageAll：inftab reSort 对标（布局变更 → 摊平按新容量纯密度重切）──
test('repageAll：布局变更摊平重切，页构成重置', () => {
  const mk = (n, h) => ({ id: n, parent: '', h });
  // 原构成：[a,b] [c,d] [e]（perPage=2，d 所在页有空洞）
  const sites = [mk('a'), mk('b'), mk('c', 1), mk('d'), mk('e', 1)];
  repageAll(sites, 3); // 新容量 3：[a,b,c] [d,e]
  const tops = sites.filter(x => !x.parent);
  assert.equal(tops[2].id, 'c'); assert.equal(tops[2].h, 0);   // c 不再是页首
  assert.equal(tops[3].id, 'd'); assert.equal(tops[3].h, 1);   // d 成为新页首
  assert.equal(tops[4].id, 'e'); assert.equal(tops[4].h, 0);
  assert.equal(tops.filter(x => x.h).length, 1);               // 仅一处分页
});
