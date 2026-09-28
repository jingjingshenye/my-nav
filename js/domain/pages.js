/**
 * 页面构成领域操作：硬分页（h 标记）不变量的唯一维护点。
 * 全部为纯数组手术（不触碰 DOM / 持久化 / 状态），可被 node --test 直接测试。
 * 不变量：h=1 只允许出现在顶层条目上；页首图标离开桌面时标记转移给其后第一个顶层条目。
 */

/** 顶层图标即将离开桌面（删除/移入文件夹/合并）时转移其硬分页标记 */
export function transferHardBreak(sites, entry) {
  if (!entry || !entry.h) return;
  const nextTop = sites.slice(sites.indexOf(entry) + 1).find(x => !x.parent);
  if (nextTop) nextTop.h = 1;
  entry.h = 0;
}

/** 删除一个顶层条目（页首被删时标记转移，页面保持稀疏）。返回是否删除 */
export function removeTopEntry(sites, id) {
  const i = sites.findIndex(x => x.id === id);
  if (i < 0) return false;
  transferHardBreak(sites, sites[i]);
  sites.splice(i, 1);
  return true;
}

/** 把顶层条目移动到第 targetIdx 个顶层位置（超出总数 = 追加末尾）。
 *  opts.hardBreak：落位后强制自成一页（「新建页」/空页落点语义）。
 *  返回 { topCount } 供调用方换算会话页码；条目不存在返回 null */
export function moveTopEntry(sites, id, targetIdx, opts = {}) {
  const from = sites.findIndex(x => x.id === id);
  if (from < 0) return null;
  const moved = sites[from];
  transferHardBreak(sites, moved);
  sites.splice(from, 1);
  if (!isFinite(targetIdx)) targetIdx = sites.length;
  let seen = 0, insertAt = sites.length;
  for (let i = 0; i < sites.length; i++) {
    if (sites[i].parent) continue;
    if (seen >= targetIdx) { insertAt = i; break; }
    seen++;
    insertAt = i + 1;
  }
  sites.splice(insertAt, 0, moved);
  if (opts.hardBreak) moved.h = 1;
  return { topCount: sites.filter(x => !x.parent).length };
}

/** 把站点移入文件夹（页首标记先转移）。返回是否成功 */
export function moveIntoFolder(sites, siteId, folderId) {
  const site = sites.find(x => x.id === siteId);
  const folder = sites.find(x => x.id === folderId);
  if (!site || !folder || !folder.folder) return false;
  transferHardBreak(sites, site);
  site.parent = folderId;
  return true;
}

/** 手机桌面式合并：拖图标 onto 目标图标，合成新文件夹（落在目标位置，继承目标页首标记；
 *  被拖图标的页首标记同样转移——可能恰好转给新文件夹）。返回新文件夹，非法时 null */
export function mergeTopEntries(sites, dragId, targetId, folderId, folderName) {
  const drag = sites.find(x => x.id === dragId);
  const target = sites.find(x => x.id === targetId);
  if (!drag || !target || drag === target || drag.folder || target.folder) return null;
  const folder = { id: folderId, name: folderName || '', folder: true, h: target.h || 0 };
  sites.splice(sites.indexOf(target), 0, folder);
  target.parent = folderId;
  drag.parent = folderId;
  target.h = 0;
  transferHardBreak(sites, drag);
  return folder;
}

/** 解散文件夹：成员按原顺序补入文件夹原位置（而非甩到桌面末尾），
 *  文件夹的页首标记转移给第一个成员，页面构成不乱。返回是否成功 */
export function dissolveFolder(sites, folderId) {
  const i = sites.findIndex(x => x.id === folderId);
  if (i < 0) return false;
  const folder = sites[i];
  if (!folder.folder) return false;
  const members = sites.filter(x => x.parent === folderId);
  const memberSet = new Set(members);
  // 先摘除文件夹与成员（按对象身份，不受字段改写影响），再把成员插回文件夹原 index
  // （约定：顶层在前，故 i 即顶层位次）
  const rest = sites.filter(x => x.id !== folderId && !memberSet.has(x));
  members.forEach(m => { m.parent = ''; m.h = 0; });
  if (folder.h && members.length) members[0].h = 1;
  if (folder.h && !members.length && rest.length) {
    // 空夹且是页首：硬分页标记转移给其后的第一个顶层条目，页面构成不乱
    for (let j = i; j < rest.length; j++) {
      if (!rest[j].parent) { rest[j].h = 1; break; }
    }
  }
  rest.splice(i, 0, ...members);
  sites.length = 0;
  sites.push(...rest);
  return true;
}

/** 文件夹合并：src 的全部成员并入 target，src 移除（target 保留名称/位置/页首标记）。返回是否成功 */
export function mergeFolders(sites, srcId, targetId) {
  const src = sites.find(x => x.id === srcId);
  const target = sites.find(x => x.id === targetId);
  if (!src || !target || src === target || !src.folder || !target.folder) return false;
  if (src.h && !target.h) { target.h = 1; src.h = 0; } // 页首夹被并走：标记转给目标，页面构成不乱
  sites.forEach(x => { if (x.parent === srcId) x.parent = targetId; });
  sites.splice(sites.indexOf(src), 1);
  return true;
}

/** 文件夹内成员重排：member 移动为该夹第 targetIdx 个成员（0 起，越界钳制）。
 *  通过在 sites 数组中移动成员元素实现，不影响顶层顺序与其他夹。返回是否生效 */
export function reorderFolderMember(sites, folderId, memberId, targetIdx) {
  const members = sites.filter(x => x.parent === folderId);
  const from = members.findIndex(m => m.id === memberId);
  if (from < 0) return false;
  const to = Math.max(0, Math.min(members.length - 1, targetIdx));
  if (from === to) return false;
  const member = members[from];
  sites.splice(sites.indexOf(member), 1);
  const remaining = sites.filter(x => x.parent === folderId);
  const anchor = remaining[Math.min(to, remaining.length - 1)];
  if (!anchor) sites.push(member);
  else {
    // 后移插锚点之后、前移插锚点之前：两者都恰好落在删除后序列的第 to 位
    const at = sites.indexOf(anchor);
    sites.splice(from < to ? at + 1 : at, 0, member);
  }
  return true;
}

/** inftab reSort 的扁平等价：布局（行列）变更时——所有页摊平、按新容量纯密度重切，
 *  页构成重置（与日常变更的 finishingSites「页保持」语义不同，原版两套并行） */
export function repageAll(sites, perPage) {
  sites.forEach(x => { x.h = 0; });
  return rebalancePages(sites, perPage);
}

/** inftab finishingSites 的扁平等价：以现有 h 分组为「页构成」，按每页容量重平衡——
 *  · 溢出级联：超过容量的页把尾部挤到下一页头（下一页可能因此再溢出，递归处理），
 *    下一页不足时直接吸收（跨页填充，但对齐 inftab：仅溢出才跨页，删除不回填）；
 *  · 空页删除；
 *  · 完成后给每页首项（首页除外）打 h 标记持久化页构成，其余清零。
 *  级联只在连续扁平序列内移动边界，顶层相对顺序不变。返回 h 是否发生变化 */
export function rebalancePages(sites, perPage) {
  perPage = Math.max(1, perPage | 0);
  const tops = sites.filter(x => !x.parent);
  if (!tops.length) {
    let changed = false;
    sites.forEach(x => { if (x.h) { x.h = 0; changed = true; } });
    return changed;
  }
  // 页构成：h 分组，每组一页（组内瞬时超容由级联处理）
  const pages = [];
  let cur = [];
  tops.forEach(en => {
    if (en.h && cur.length) { pages.push(cur); cur = []; }
    cur.push(en);
  });
  if (cur.length) pages.push(cur);
  // 溢出级联（inftab finishingSites 逐页递归）
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].length > perPage) {
      const excess = pages[i].splice(perPage);
      if (i + 1 < pages.length) pages[i + 1] = excess.concat(pages[i + 1]);
      else pages.splice(i + 1, 0, excess);
    }
  }
  for (let i = pages.length - 1; i >= 0; i--) if (!pages[i].length) pages.splice(i, 1);
  // h 重打：每页首项（首页除外）
  let changed = false;
  pages.forEach((p, pi) => p.forEach((en, ii) => {
    const h = ii === 0 && pi > 0 ? 1 : 0;
    if (en.h !== h) { en.h = h; changed = true; }
  }));
  return changed;
}

/** 结构不变量校验/修复：装载、拉取、导入后统一过一遍。
 *  剔除重复 id；孤儿 parent 回桌面；自指 parent 修复；h 只保留在顶层；顶层在前成员在后。 */
export function sanitizeSites(sites) {
  const seen = new Set();
  const valid = sites.filter(s => s && s.id && !seen.has(s.id) && (seen.add(s.id), true));
  const isFolder = id => valid.some(x => x.id === id && x.folder);
  valid.forEach(s => {
    if (s.parent && (s.parent === s.id || !isFolder(s.parent))) { s.parent = ''; s.h = 0; } // 孤儿回桌面，勿误升页首
    if (s.parent) s.h = 0;
  });
  return [...valid.filter(s => !s.parent), ...valid.filter(s => s.parent)];
}
