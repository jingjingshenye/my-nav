/**
 * 图标拖拽引擎 · inftab 原版模型完整移植（level.js 逆向结论，非近似复刻）
 *
 * inftab 的真实架构（逐条对应逆向代码）：
 *  1. 落点区是 DOM 元素，不做几何解算：每个图标自带 data-dropid/dropindexs；
 *     页面格子区整体是 data-dropid="end"（空格=排到页尾）；引擎另建左右边缘
 *     aside 落点条。命中 = elementFromPoint → closest('[data-dropid]')。
 *  2. 分区 _calcArea：左右侧向由「指针 X vs 图标中线」决定；center 合并区由
 *     「ghost 中心落在图标矩形 x∈[20%,80%] 且 y 在矩形内」决定（看拖影不看指针）。
 *  3. 配对变更门 _scheduler：只有 (area, dropId) 二元组变化才重新评估——
 *     同一分区内无论怎么抖动，零计算零重渲（防闪烁的根本）。
 *  4. 全部移动发生在拖动中、且是数据操作：
 *     · 缝隙/页尾停 200ms → onSort（业务真实改数据 + 重渲，inftab sortSites）
 *     · 压住图标中心 350ms → onCenter（建夹/移入，inftab createFolder/intoFolder）
 *       → 成功后 +500ms → onPanel（弹开文件夹）
 *     · 松手基本 no-op（数据早已落位）；仅跨页悬空时补「挪到当前页尾」。
 *  5. 拖文件夹永不 center 合并（inftab isIcon(0,dragId) 语义）；拖动中数据
 *     排序立即生效，图标让位由业务的 id-键 FLIP 动画呈现（inftab 用 Flipping 库）。
 *  6. 拖影/判定坐标钳制在视口内（inftab dragXLimit）。
 *
 * 业务契约（registerGrid）：
 *   { id, pageEl(): Element|null, canDrag(el), entryOf(el), sortableOnly?,
 *     edgeFlip?, hitArea?(), fromCtx?(),
 *     onDragStart?(entry),
 *     onFrame?(entry, pos): true = 业务接管本帧（冻结配对与计时）,
 *     onSort?(entry, dropIndexs, area): 200ms 停顿的数据排序；false = 拒绝,
 *     onCenter?(entry, targetEl, targetEntry): 350ms 压住合并；false = 拒绝,
 *     onPanel?(entry): 合并成功 +500ms,
 *     onAside?(entry, dir): ±1 边缘落点（翻页）,
 *     onDrop?(ctx), onCancel?(ctx): ctx={entry, from, cancelled} }
 *   dropIndexs：桌面 { page, idx }（页内槽位序号，含被拖槽，同 inftab [p,i]）；
 *   文件夹 { idx }（成员槽位序号，同 inftab 第三维）。
 */

export function createGridManager(opts = {}) {
  const cfg = {
    dragThreshold: 6,   // 点击 vs 拖拽阈值（px）
    gapDwellMs: 200,    // 缝隙/页尾停顿 → 数据排序（inftab i=200）
    mergeDwellMs: 350,  // 压住图标中心 → 合并（inftab n=350）
    panelDwellMs: 0,    // 合并成功 → 弹开文件夹：与建夹同帧（用户要求同步弹出）
    edgePx: 130,        // 边缘落点条宽度上限（inftab：min(10vw, 130px)）
    ...opts,
  };

  const grids = new Set();
  const s = {
    grid: null, entry: null, el: null, from: null, pointerId: null,
    pressed: false, active: false,
    startX: 0, startY: 0, px: 0, py: 0,
    ghost: null, offX: 0, offY: 0, ghostW: 0, ghostH: 0, ghostW0: 0, ghostH0: 0, ghostScaleF: 1,
    hoverEl: null,
    pairArea: '', pairId: '', pairGuard: '',   // 配对门：(area, dropId)；guard=合并后哨兵
    freezeUntil: 0, // 排序/合并后的让位 FLIP 动画期：冻结配对重算（动画中目标在移动，命中跳变会反复重置停顿计时）
    timer: null,
    panelTimer: null, // 面板弹出定时器（独立于配对调度：pair 变化不得取消它；松手后仍生效）
    workGrid: null,
    asideL: null, asideR: null, asideSide: '',
  };

  /* ---------- 基础 ---------- */
  function gridForHit(hit) {
    for (const g of grids) {
      const root = g.pageEl && g.pageEl();
      if (root && (root === hit || root.contains(hit))) return g;
    }
    return null;
  }

  /* ---------- ghost ---------- */
  function makeGhost(el, centered = false) {
    const icon = el.querySelector('.icon') || el;
    const r = icon.getBoundingClientRect();
    const g = icon.cloneNode(true);
    g.querySelectorAll('button').forEach(b => b.remove());
    if (g.querySelector('img')) g.querySelectorAll('.ph').forEach(p => p.remove());
    g.classList.add('grid-drag-ghost');
    g.style.borderRadius = getComputedStyle(icon).borderRadius;
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    s.offX = centered ? r.width / 2 : s.startX - r.left;
    s.offY = centered ? r.height / 2 : s.startY - r.top;
    s.ghostW = r.width; s.ghostH = r.height;
    // inftab：ghost 直接 display:block 出现（原尺寸、全不透明），无淡入无缩放
    g.style.transform = `translate3d(${Math.round(s.px - s.offX)}px, ${Math.round(s.py - s.offY)}px, 0)`;
    document.body.append(g);
    return g;
  }
  function moveGhost() {
    if (s.ghost) s.ghost.style.transform =
      `translate3d(${Math.round(s.px - s.offX)}px, ${Math.round(s.py - s.offY)}px, 0)`;
  }
  function ghostCenter() {
    return { x: s.px - s.offX + s.ghostW / 2, y: s.py - s.offY + s.ghostH / 2 };
  }

  /* ---------- 配对门与计时（_scheduler 原版移植） ---------- */
  function clearTimer() { if (s.timer) { clearTimeout(s.timer); s.timer = null; } }
  function clearPair() { s.pairArea = ''; s.pairId = ''; s.pairGuard = ''; }
  function clearHover() {
    if (s.hoverEl) { s.hoverEl.classList.remove('hover-armed', 'merge-target'); s.hoverEl = null; }
  }
  function setHover(el) {
    if (s.hoverEl === el) return;
    clearHover();
    s.hoverEl = el;
    el.classList.add('hover-armed');
  }

  /** 冻结让位动画期的判定；到期补发一次判定（完全静止的手没有后续 move，也能完成配对） */
  function setFreeze(ms) {
    s.freezeUntil = performance.now() + ms;
    setTimeout(() => {
      if (s.active && performance.now() >= s.freezeUntil) dispatchDrop();
    }, ms + 5);
  }

  /** inftab drop()：命中落点元素 → 分区 → _scheduler */
  function dispatchDrop() {
    if (s.freezeUntil && performance.now() < s.freezeUntil) return; // 让位动画期：判定冻结
    const under = document.elementFromPoint(Math.round(s.px), Math.round(s.py));
    const hit = under ? under.closest('[data-dropid]') : null;
    if (!hit) { clearTimer(); clearPair(); clearHover(); return; }

    const dropId = hit.dataset.dropid;
    // 边缘落点条（inftab mouseenter/mouseleave 语义）：进入触发一次翻页；
    // 驻留不重复（asideSide 不变即不再触发），离开边缘区（命中其他落点）后复位
    if (dropId === 'aside-left' || dropId === 'aside-right') {
      clearTimer(); clearPair(); clearHover();
      if (s.asideSide !== dropId) {
        s.asideSide = dropId;
        const g = s.grid && s.grid.edgeFlip ? s.grid : null;
        g && g.onAside && g.onAside(s.entry, dropId === 'aside-left' ? -1 : 1);
      }
      return;
    }
    if (s.asideSide) { // 离开边缘区：停止窥视循环（inftab _stopCapture）
      const g = s.grid;
      s.asideSide = '';
      g && g.onAsideLeave && g.onAsideLeave(s.entry);
    }
    const grid = gridForHit(hit);
    const selfId = s.el && s.el.dataset.id;
    if (!grid || dropId === selfId || dropId === 'wrapper') { clearTimer(); clearPair(); clearHover(); return; }

    let dropIndexs;
    try { dropIndexs = JSON.parse(hit.dataset.dropindexs || 'null'); } catch { dropIndexs = null; }
    if (!dropIndexs) { clearTimer(); clearPair(); clearHover(); return; }

    // inftab _calcArea：侧向看指针，center 看 ghost 中心（图标矩形 20%~80% 横带）
    let area;
    if (dropId === 'end') area = 'right';
    else if (dropId === 'holder') area = 'left';
    else {
      const icon = hit.querySelector('.icon') || hit;
      const r = icon.getBoundingClientRect();
      area = s.px > r.left + r.width / 2 ? 'right' : 'left';
      const gc = ghostCenter();
      if (gc.x > r.left + .2 * r.width && gc.x < r.left + .8 * r.width && gc.y > r.top && gc.y < r.bottom) area = 'center';
      // center 迟滞：已处于该目标的合并瞄准时，用更宽的保持带——手抖/缓移不轻易
      // 退出 center（跳变会重置 350ms 计时，表现为合并失灵）
      if (area !== 'center' && s.pairId === dropId && s.pairArea === 'center'
        && gc.x > r.left + .08 * r.width && gc.x < r.left + .92 * r.width && gc.y > r.top - .1 * r.height && gc.y < r.bottom + .1 * r.height) area = 'center';
    }
    scheduler(grid, hit, dropIndexs, area, dropId);
  }

  /** inftab _scheduler 原版：配对变更门 + 三段计时 */
  function scheduler(grid, hitEl, dropIndexs, area, dropId) {
    if (dropId === s.pairId && area === s.pairArea) return;
    if (s.pairGuard === dropId) return; // 合并已发生：同目标不二次合并
    clearTimer();
    s.pairArea = area; s.pairId = dropId; s.pairGuard = '';

    const draggingFolder = !!(s.entry && s.entry.folder);
    // inftab：非 center、夹内排序（sortableOnly）、拖的是文件夹 → 一律走 200ms 缝隙排序
    if (area !== 'center' || grid.sortableOnly || draggingFolder) {
      s.timer = setTimeout(() => {
        s.timer = null;
        clearHover();
        // inftab：排序后配对保持——同区同目标不重触发（数据已就位，重排为幂等）
        grid.onSort && grid.onSort(s.entry, dropIndexs, area);
        setFreeze(230); // 让位 FLIP 动画期冻结判定
      }, cfg.gapDwellMs);
    } else {
      setHover(hitEl); // armed 蓝光（inftab setMergeStatus("hover")）
      s.timer = setTimeout(() => {
        s.timer = null;
        const ok = grid.onCenter && grid.onCenter(s.entry, hitEl, grid.entryOf(hitEl));
        if (ok === false) { clearHover(); clearPair(); return; }
        // 合并成功：目标即将变成新卡片（文件夹），哨兵挡住同位二次合并
        clearHover();
        s.pairGuard = dropId; s.pairId = ''; s.pairArea = '';
        setFreeze(230); // 合并落库的抖动/让位动画期冻结判定
        // 面板定时器独立于 s.timer：后续配对变化（freeze 补发等）不得取消弹出
        if (s.panelTimer) clearTimeout(s.panelTimer);
        s.panelTimer = setTimeout(() => {
          s.panelTimer = null;
          grid.onPanel && grid.onPanel(s.entry);
        }, cfg.panelDwellMs);
      }, cfg.mergeDwellMs);
    }
  }

  /* ---------- 边缘落点条 ---------- */
  /** 边缘条宽度（inftab.com 在线实测：--main-side-width: min(10vw, 130px)）——
   *  视口 10%、上限 130px，同时钳制在网格内容外余量内（绝不压最外列图标）；
   *  余量不足 8px（网格贴边）该侧不挂载；拖拽中内侧渐隐光条给出可见边界 */
  function mountAsides() {
    unmountAsides();
    const w = (s.grid && s.grid.asideWidths && s.grid.asideWidths()) || { left: cfg.edgePx, right: cfg.edgePx };
    const mk = (side, margin) => {
      if (!margin || margin < 8) return null;
      const width = Math.min(Math.round(innerWidth * 0.1), 130, margin);
      const d = document.createElement('div');
      d.className = 'drag-aside ' + side;
      d.dataset.dropid = 'aside-' + side;
      d.style.width = width + 'px';
      document.body.append(d);
      return d;
    };
    s.asideL = mk('left', w.left);
    s.asideR = mk('right', w.right);
  }
  function unmountAsides() {
    s.asideL && s.asideL.remove(); s.asideR && s.asideR.remove();
    s.asideL = s.asideR = null;
  }

  /* ---------- 会话 ---------- */
  function beginDrag() {
    s.active = true;
    if (s.panelTimer) { clearTimeout(s.panelTimer); s.panelTimer = null; } // 上次未弹的面板作废
    s.ghost = makeGhost(s.el);
    moveGhost();
    s.el.classList.add('drag-source'); // inftab merge-holder：被拖图标原位隐形占格（数据真相）
    document.body.classList.add('grid-dragging');
    mountAsides();
    suppressNextClick = true;
    s.grid.onDragStart && s.grid.onDragStart(s.entry);
  }

  function endDrag(cancel) {
    if (!s.active && !s.pressed) return;
    const grid = s.grid, entry = s.entry, wasActive = s.active;
    const ctx = { entry, from: s.from, cancelled: !!cancel };
    clearTimer(); clearPair(); clearHover();
    unmountAsides();
    if (s.ghost) { s.ghost.remove(); s.ghost = null; }
    if (s.el) s.el.classList.remove('drag-source');
    // 全局清扫：拖动中的重渲可能换掉节点（s.el 已失联），占格/瞄准类残留在新节点上
    // 会让图标永久隐形（系统弹窗吞掉 pointerup 时尤其如此）
    document.querySelectorAll('.drag-source, .hover-armed, .merge-target')
      .forEach(el => el.classList.remove('drag-source', 'hover-armed', 'merge-target'));
    document.body.classList.remove('grid-dragging');
    s.pressed = false; s.active = false; s.freezeUntil = 0;
    if (s.asideSide) { const g = s.grid; s.asideSide = ''; g && g.onAsideLeave && g.onAsideLeave(s.entry); }
    s.grid = null; s.workGrid = null; s.el = null; s.entry = null; s.from = null;
    if (!wasActive) return; // 未越过阈值：普通点击放行
    if (cancel && s.panelTimer) { clearTimeout(s.panelTimer); s.panelTimer = null; } // 中断：待弹面板作废；正常松手保留（inftab 松手后面板照弹）
    if (cancel) grid.onCancel && grid.onCancel(ctx);
    else grid.onDrop && grid.onDrop(ctx);
    // 松手同任务的合成 click（同元素 down/up）被拦截后即复位；残留会把用户的
    // 下一次点击（菜单项/按钮）整个吞掉——拖完图标后第一下点击失灵的根源
    setTimeout(() => { suppressNextClick = false; }, 0);
  }

  /* ---------- 指针绑定 ---------- */
  let suppressNextClick = false;
  document.addEventListener('dragstart', e => {
    if (e.target.closest && e.target.closest('.card, .fv-item')) e.preventDefault();
  }, true);
  document.addEventListener('click', e => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  document.addEventListener('pointerdown', e => {
    suppressNextClick = false;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (s.active) { endDrag(true); return; } // 上次会话被系统弹窗吞掉 pointerup：先收尸，吞掉本次按下
    if (s.pressed) return;
    if (e.target.closest && e.target.closest('button, input, textarea, select')) return;
    for (const grid of grids) {
      const pg = grid.pageEl && grid.pageEl();
      if (!pg || !pg.contains(e.target)) continue;
      const el = e.target.closest('[data-id]');
      if (!el || !pg.contains(el) || (grid.canDrag && !grid.canDrag(el))) return;
      s.grid = grid; s.el = el; s.entry = grid.entryOf(el);
      s.from = grid.fromCtx ? grid.fromCtx() : null;
      s.pressed = true; s.pointerId = e.pointerId;
      s.startX = s.px = e.clientX; s.startY = s.py = e.clientY;
      return;
    }
  }, true);

  document.addEventListener('pointermove', e => {
    if (!s.pressed && !s.active) return;
    if (e.pointerId !== s.pointerId) return;
    s.px = e.clientX; s.py = e.clientY;
    s.px = Math.max(0, Math.min(innerWidth, s.px));   // dragXLimit
    s.py = Math.max(0, Math.min(innerHeight, s.py));
    if (!s.active) {
      const dx = s.px - s.startX, dy = s.py - s.startY;
      if (dx * dx + dy * dy < cfg.dragThreshold * cfg.dragThreshold) return;
      beginDrag();
    }
    moveGhost();
    // 业务帧接管（夹外容错 / 持夹锁定）：冻结配对与计时
    if (s.grid.onFrame && s.grid.onFrame(s.entry, { x: s.px, y: s.py })) {
      clearTimer(); clearPair(); clearHover();
      return;
    }
    dispatchDrop();
  }, true);

  document.addEventListener('pointerup', e => {
    if (e.pointerId !== s.pointerId) return;
    if (s.pressed && !s.active) {
      s.pressed = false; s.grid = null; s.el = null; s.entry = null; s.from = null;
      return;
    }
    endDrag(false);
  }, true);
  document.addEventListener('pointercancel', e => { if (e.pointerId === s.pointerId) endDrag(true); }, true);
  window.addEventListener('blur', () => { if (s.active || s.pressed) endDrag(true); });
  // 系统弹窗/切走标签页：会话收尸（图标不得因占格类残留而“消失”）
  document.addEventListener('visibilitychange', () => { if (document.hidden && (s.active || s.pressed)) endDrag(true); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && s.active) endDrag(true);
  }, true);

  /* ---------- 对外 API ---------- */
  return {
    registerGrid(spec) { grids.add(spec); return spec; },
    unregisterGrid(spec) { grids.delete(spec); },
    isActive: () => s.active,
    draggedId: () => (s.el && s.el.dataset.id) || null,
    pointer: () => ({ x: s.px, y: s.py }),
    /** ghost 缩放（inftab：文件夹面板弹出时拖影缩至 0.8 并按比例重算抓握偏移，面板关还原） */
    ghostScale(f) {
      if (!s.active || !s.ghost) return false;
      if (s.ghostScaleF === f) return true;
      if (!s.ghostW0) { s.ghostW0 = s.ghostW; s.ghostH0 = s.ghostH; }
      s.ghostScaleF = f;
      // 中心点保持不动：新 offX = px - (cx - 新宽/2)
      const cx = s.px - s.offX + s.ghostW / 2, cy = s.py - s.offY + s.ghostH / 2;
      s.ghostW = s.ghostW0 * f; s.ghostH = s.ghostH0 * f;
      s.offX = s.px - (cx - s.ghostW / 2);
      s.offY = s.py - (cy - s.ghostH / 2);
      s.ghost.style.width = s.ghostW + 'px';
      s.ghost.style.height = s.ghostH + 'px';
      moveGhost();
      return true;
    },
    cancel: () => endDrag(true),
    /** 拖拽主体变更（业务重建被拖卡后重锚）：keepGhost 保留拖影；placeholder 让新卡接任隐形占格 */
    adopt(el, opts = {}) {
      if (!s.active || !el || !el.isConnected) return false;
      clearTimer(); clearPair(); clearHover();
      if (s.el) s.el.classList.remove('drag-source');
      s.el = el; s.entry = s.grid.entryOf(el);
      if (opts.placeholder) el.classList.add('drag-source');
      if (!opts.keepGhost) {
        if (s.ghost) s.ghost.remove();
        s.ghost = makeGhost(el, true);
        moveGhost();
      }
      return true;
    },
  };
}
