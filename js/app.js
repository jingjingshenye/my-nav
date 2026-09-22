import { createAdapter, ADAPTERS, DATA_FILE, LocalAdapter } from './adapters.js';

/* ================= 小工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const SVG_X = '✕';

/* ================= 搜索引擎 ================= */
const ENGINES = [
  { id: 'baidu',  name: '百度',   glyph: '百',  color: '#2932e1', build: q => `https://www.baidu.com/s?wd=${q}` },
  { id: 'bing',   name: '必应',   glyph: 'b',   color: '#008373', build: q => `https://www.bing.com/search?q=${q}` },
  { id: 'google', name: '谷歌',   glyph: 'G',   color: '#4285f4', build: q => `https://www.google.com/search?q=${q}` },
  { id: 'sogou',  name: '搜狗',   glyph: '搜',  color: '#ff6f37', build: q => `https://www.sogou.com/web?query=${q}` },
  { id: 'so360',  name: '360',    glyph: '360', color: '#3dbd38', build: q => `https://www.so.com/s?q=${q}` },
  { id: 'zhihu',  name: '知乎',   glyph: '知',  color: '#056de8', build: q => `https://www.zhihu.com/search?type=content&q=${q}` },
  { id: 'github', name: 'GitHub', glyph: 'GH',  color: '#24292f', build: q => `https://github.com/search?q=${q}` },
  { id: 'taobao', name: '淘宝',   glyph: '淘',  color: '#ff5000', build: q => `https://s.taobao.com/search?q=${q}` },
];

/* ================= 内置壁纸 ================= */
const WALLPAPERS = [
  { id: 'preset:forest', name: '雾林', css: "url('assets/wallpaper.svg')" },
  { id: 'preset:aurora', name: '极光', css: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'preset:dusk',   name: '暮色', css: 'linear-gradient(135deg,#355c7d,#6c5b7b,#c06c84)' },
  { id: 'preset:mint',   name: '薄荷', css: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { id: 'preset:night',  name: '暗夜', css: 'linear-gradient(135deg,#232526,#414345)' },
];

/* ================= 默认数据 ================= */
const DEFAULT_FAVICON_API = 'https://api.iowen.cn/favicon/{host}.png';

function seedSettings() {
  return {
    engine: 'baidu',
    wallpaper: 'preset:forest',
    customWallpaper: '',
    faviconApi: DEFAULT_FAVICON_API,
    lastSyncAt: null,
    sync: { type: 'local', token: '', gistId: '', filename: DATA_FILE, autoSync: true },
  };
}

function seedSites() {
  const list = [
    ['百度', 'https://www.baidu.com'],
    ['淘宝', 'https://www.taobao.com'],
    ['京东', 'https://www.jd.com'],
    ['天猫', 'https://www.tmall.com'],
    ['哔哩哔哩', 'https://www.bilibili.com'],
    ['微博', 'https://weibo.com'],
    ['知乎', 'https://www.zhihu.com'],
    ['网易云音乐', 'https://music.163.com'],
    ['爱奇艺', 'https://www.iqiyi.com'],
    ['豆瓣', 'https://www.douban.com'],
    ['携程旅行', 'https://www.ctrip.com'],
    ['Gitee', 'https://gitee.com'],
    ['GitHub', 'https://github.com'],
    ['掘金', 'https://juejin.cn'],
    ['CSDN', 'https://www.csdn.net'],
    ['Stack Overflow', 'https://stackoverflow.com'],
    ['MDN', 'https://developer.mozilla.org'],
    ['少数派', 'https://sspai.com'],
  ];
  return list.map(([name, url], i) => ({ id: 's_seed' + i, name, url, icon: '', badge: false }));
}

/* ================= 状态 ================= */
const state = {
  data: null,      // { version, sites, settings }
  page: 0,
  pages: 1,
  editMode: false,
  dragId: null,
  editingId: null, // 当前正在编辑的站点 id（null = 添加）
};

const GRID_COLS = [[1200, 6], [960, 5], [720, 4]];
const ROWS = 3;
const cols = () => (GRID_COLS.find(([w]) => innerWidth >= w) || [0, 3])[1];
const perPage = () => cols() * ROWS;

/* ================= 持久化与同步 ================= */
const local = new LocalAdapter();

function persistLocal() { local.save(state.data); }

const cloudPayload = () => {
  const { version, sites, settings } = state.data;
  // Token 属于本机凭据，绝不入云
  return { version, sites, settings: { ...settings, sync: { ...settings.sync, token: '' } } };
};

const canAutoSync = () => {
  const s = state.data.settings.sync;
  return s.type === 'gitee-gist' && s.autoSync && s.token && s.gistId;
};

function persist() {
  persistLocal();
  if (canAutoSync()) queueCloudPush();
}

const queueCloudPush = debounce(() => {
  pushCloud(false).catch(err => toast('自动同步失败：' + err.message, 'error'));
}, 1800);

async function pushCloud(notify = true) {
  const cfg = state.data.settings.sync;
  if (cfg.type !== 'gitee-gist') throw new Error('当前未启用云端同步');
  const adapter = createAdapter(cfg);
  if (!cfg.gistId) {
    cfg.gistId = await adapter.create(cloudPayload());
    persistLocal();
    toast(`已创建云端 Gist（${cfg.gistId}），ID 已写入配置`);
    if ($('#dlgSync').open) fillSyncDialog();
  }
  await adapter.save(cloudPayload());
  state.data.settings.lastSyncAt = Date.now();
  persistLocal();
  updateSyncStatus();
  if (notify) toast('已推送到云端');
}

async function pullCloud(notify = true) {
  const cfg = { ...state.data.settings.sync };
  const adapter = createAdapter(cfg);
  const payload = await adapter.load();
  if (!payload || !Array.isArray(payload.sites)) throw new Error('云端数据格式不正确');
  const keepSync = state.data.settings.sync; // 本机的同步凭据不被云端覆盖
  state.data = {
    version: 1,
    sites: payload.sites.map(s => ({
      id: s.id || uid(), name: String(s.name || ''), url: String(s.url || ''),
      icon: s.icon || '', badge: !!s.badge,
    })),
    settings: { ...seedSettings(), ...(payload.settings || {}), sync: keepSync },
  };
  state.page = 0;
  persistLocal();
  renderAll();
  if (notify) toast('已从云端拉取数据');
}

/* ================= 渲染 ================= */
function currentEngine() {
  return ENGINES.find(e => e.id === state.data.settings.engine) || ENGINES[0];
}

function renderEngines() {
  const tabs = $('#engineTabs');
  tabs.innerHTML = '';
  ENGINES.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e.name;
    b.className = e.id === state.data.settings.engine ? 'active' : '';
    b.onclick = () => { state.data.settings.engine = e.id; persistLocal(); renderEngines(); updateSearchUI(); };
    tabs.append(b);
  });
}

function updateSearchUI() {
  const e = currentEngine();
  const logo = $('#engineLogo');
  logo.textContent = e.glyph;
  logo.style.background = e.color;
  logo.style.fontSize = e.glyph.length > 1 ? '10px' : '13px';
  $('#searchInput').placeholder = `在${e.name}中搜索，或直接输入网址`;
}

function applyWallpaper() {
  const s = state.data.settings;
  const wp = WALLPAPERS.find(w => w.id === s.wallpaper) || WALLPAPERS[0];
  $('#wallpaper').style.backgroundImage = s.customWallpaper ? `url("${s.customWallpaper}")` : wp.css;
}

function tint(name) {
  const palette = ['#f2708a', '#5aa9e6', '#7fc8a9', '#e6a157', '#9b8ce0', '#59c3c3'];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return palette[h % palette.length];
}

function iconHTML(site) {
  const ph = `<span class="ph" style="background:${tint(site.name)}">${escapeHtml((site.name || '•')[0])}</span>`;
  let src = site.icon;
  if (!src) {
    try { src = state.data.settings.faviconApi.replace('{host}', new URL(site.url).host); }
    catch { return ph; }
  }
  return `<img src="${escapeHtml(src)}" alt="" loading="lazy" draggable="false">${ph}`;
}

function cardEl(site) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = site.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.id = site.id;
  a.title = site.url;
  a.innerHTML = `
    <span class="icon">${iconHTML(site)}${site.badge ? '<i class="badge"></i>' : ''}
      ${state.editMode ? `<button class="del" title="删除">${SVG_X}</button>` : ''}
    </span>
    <span class="label">${escapeHtml(site.name)}</span>`;

  if (state.editMode) {
    a.classList.add('draggable');
    a.draggable = true;
    a.addEventListener('click', e => { e.preventDefault(); openSiteDialog(site); });
    a.addEventListener('dragstart', e => {
      state.dragId = site.id;
      a.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', site.id); } catch { /* ignore */ }
    });
    a.addEventListener('dragend', () => {
      state.dragId = null;
      a.classList.remove('dragging');
      $$('.drop-target').forEach(x => x.classList.remove('drop-target'));
    });
    a.addEventListener('dragover', e => {
      if (!state.dragId || state.dragId === site.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      a.classList.add('drop-target');
    });
    a.addEventListener('dragleave', () => a.classList.remove('drop-target'));
    a.addEventListener('drop', e => {
      e.preventDefault();
      a.classList.remove('drop-target');
      reorder(state.dragId, site.id);
    });
  }

  a.addEventListener('contextmenu', e => { e.preventDefault(); openCtxMenu(e, site); });
  const del = $('.del', a);
  if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); removeSite(site); });
  return a;
}

function addCardEl() {
  const a = document.createElement('a');
  a.className = 'card add-card';
  a.innerHTML = `<span class="icon">${SVG_PLUS}</span><span class="label">添加网址</span>`;
  a.addEventListener('click', e => { e.preventDefault(); openSiteDialog(null); });
  return a;
}

function renderGrid() {
  const grid = $('#grid'), dots = $('#dots');
  const pp = perPage();
  const total = state.data.sites.length + (state.editMode ? 1 : 0);
  state.pages = Math.max(1, Math.ceil(total / pp));
  state.page = Math.min(state.page, state.pages - 1);

  const slice = state.data.sites.slice(state.page * pp, state.page * pp + pp);
  grid.style.setProperty('--cols', cols());
  grid.classList.toggle('editing', state.editMode);
  grid.innerHTML = '';
  if (!slice.length && !state.editMode) {
    grid.innerHTML = '<p class="empty-tip">这里空空如也，点击右上角菜单 → 「添加网址」开始使用</p>';
  } else {
    slice.forEach(s => grid.append(cardEl(s)));
    if (state.editMode) grid.append(addCardEl());
  }

  dots.innerHTML = '';
  for (let i = 0; i < state.pages; i++) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'dot' + (i === state.page ? ' active' : '');
    d.title = `第 ${i + 1} 页`;
    d.addEventListener('click', () => { state.page = i; renderGrid(); });
    if (state.editMode) {
      d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('active'); });
      d.addEventListener('dragleave', () => d.classList.toggle('active', i === state.page));
      d.addEventListener('drop', e => { e.preventDefault(); moveToPage(state.dragId, i); });
    }
    dots.append(d);
  }
}

function renderAll() {
  renderEngines();
  updateSearchUI();
  applyWallpaper();
  renderGrid();
  updateSyncStatus();
}

/* ================= 数据操作 ================= */
function normalizeUrl(u) {
  u = u.trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

function reorder(dragId, targetId) {
  const sites = state.data.sites;
  const from = sites.findIndex(s => s.id === dragId);
  const to = sites.findIndex(s => s.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = sites.splice(from, 1);
  sites.splice(sites.findIndex(s => s.id === targetId), 0, moved);
  persist();
  renderGrid();
}

function moveToPage(id, pageIndex) {
  const sites = state.data.sites;
  const i = sites.findIndex(s => s.id === id);
  if (i < 0) return;
  const [moved] = sites.splice(i, 1);
  const idx = Math.max(0, Math.min(pageIndex * perPage() + perPage() - 1, sites.length));
  sites.splice(idx, 0, moved);
  state.page = pageIndex;
  persist();
  renderGrid();
}

function removeSite(site) {
  if (!confirm(`确定删除「${site.name}」吗？`)) return;
  state.data.sites = state.data.sites.filter(s => s.id !== site.id);
  persist();
  renderGrid();
  toast(`已删除「${site.name}」`);
}

/* ================= 站点编辑对话框 ================= */
function openSiteDialog(site) {
  state.editingId = site ? site.id : null;
  $('#siteDlgTitle').textContent = site ? '编辑网址' : '添加网址';
  const f = $('#siteForm');
  f.name.value = site ? site.name : '';
  f.url.value = site ? site.url : '';
  f.icon.value = site ? site.icon : '';
  f.badge.checked = site ? !!site.badge : false;
  $('#siteFormError').hidden = true;
  $('#dlgSite').showModal();
  f.name.focus();
}

function bindSiteDialog() {
  const f = $('#siteForm');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const name = f.name.value.trim();
    const url = normalizeUrl(f.url.value);
    if (!name || !url) {
      const err = $('#siteFormError');
      err.textContent = !name ? '请填写名称' : '请填写有效的网址';
      err.hidden = false;
      return;
    }
    const icon = f.icon.value.trim();
    const badge = f.badge.checked;
    if (state.editingId) {
      const site = state.data.sites.find(s => s.id === state.editingId);
      if (site) Object.assign(site, { name, url, icon, badge });
    } else {
      state.data.sites.push({ id: uid(), name, url, icon, badge });
    }
    persist();
    $('#dlgSite').close();
    renderGrid();
  });
}

/* ================= 右键菜单 ================= */
function openCtxMenu(e, site) {
  const m = $('#ctxMenu');
  m.innerHTML = '';
  const items = [
    ['编辑', () => openSiteDialog(site)],
    [site.badge ? '关闭红点提醒' : '开启红点提醒', () => { site.badge = !site.badge; persist(); renderGrid(); }],
    null,
    ['删除', () => removeSite(site), 'danger'],
  ];
  items.forEach(it => {
    if (!it) { m.append(document.createElement('hr')); return; }
    const [label, fn, cls] = it;
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', () => { m.hidden = true; fn(); });
    m.append(b);
  });
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
}

/* ================= 菜单 ================= */
function toggleMenu(force) {
  $('#menu').hidden = force !== undefined ? !force : !$('#menu').hidden;
}

function onMenuAction(act) {
  toggleMenu(false);
  switch (act) {
    case 'add': openSiteDialog(null); break;
    case 'edit':
      state.editMode = !state.editMode;
      $('#menuEdit').classList.toggle('on', state.editMode);
      renderGrid();
      break;
    case 'settings':
      renderWpGrid();
      $('#wpUrl').value = state.data.settings.customWallpaper || '';
      $('#faviconApi').value = state.data.settings.faviconApi || DEFAULT_FAVICON_API;
      $('#dlgSettings').showModal();
      break;
    case 'sync': fillSyncDialog(); $('#dlgSync').showModal(); break;
    case 'import': $('#importFile').click(); break;
    case 'export': exportData(); break;
    case 'about': $('#dlgAbout').showModal(); break;
  }
}

/* ================= 设置（外观） ================= */
function renderWpGrid() {
  const grid = $('#wpGrid');
  grid.innerHTML = '';
  const s = state.data.settings;
  WALLPAPERS.forEach(w => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wp-thumb' + (!s.customWallpaper && s.wallpaper === w.id ? ' active' : '');
    b.title = w.name;
    b.style.background = w.css;
    b.style.backgroundSize = 'cover';
    b.addEventListener('click', () => {
      s.wallpaper = w.id;
      s.customWallpaper = '';
      $('#wpUrl').value = '';
      $$('.wp-thumb').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      applyWallpaper();
    });
    grid.append(b);
  });
}

function bindSettingsDialog() {
  $('#settingsSave').addEventListener('click', () => {
    const s = state.data.settings;
    const url = $('#wpUrl').value.trim();
    s.customWallpaper = url;
    s.faviconApi = $('#faviconApi').value.trim() || DEFAULT_FAVICON_API;
    persist();
    applyWallpaper();
    renderGrid();
    $('#dlgSettings').close();
    toast('设置已保存');
  });
}

/* ================= 数据同步对话框 ================= */
function fillSyncDialog() {
  const s = state.data.settings.sync;
  $('#syncType').value = s.type;
  $('#syncToken').value = s.token || '';
  $('#syncGistId').value = s.gistId || '';
  $('#syncFile').value = s.filename || DATA_FILE;
  $('#syncAuto').checked = !!s.autoSync;
  $('#giteeFields').hidden = s.type !== 'gitee-gist';
  updateSyncStatus();
}

function saveSyncCfg() {
  state.data.settings.sync = {
    type: $('#syncType').value,
    token: $('#syncToken').value.trim(),
    gistId: $('#syncGistId').value.trim(),
    filename: $('#syncFile').value.trim() || DATA_FILE,
    autoSync: $('#syncAuto').checked,
  };
  persistLocal();
  updateSyncStatus();
}

function updateSyncStatus() {
  const el = $('#syncStatus');
  if (!el) return;
  const s = state.data.settings;
  if (s.sync.type !== 'gitee-gist') {
    el.textContent = '当前数据仅保存在本机浏览器。';
    return;
  }
  el.textContent = `云端 Gist：${s.sync.gistId || '尚未创建'}　上次同步：${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : '从未'}`;
}

function bindSyncDialog() {
  $('#syncType').addEventListener('change', () => {
    $('#giteeFields').hidden = $('#syncType').value !== 'gitee-gist';
  });
  $('#syncPull').addEventListener('click', async () => {
    try {
      saveSyncCfg();
      if (state.data.settings.sync.type !== 'gitee-gist') { toast('请先选择「Gitee Gist」同步方式', 'error'); return; }
      if (!state.data.settings.sync.gistId) { toast('请先填写 Gist ID 或推送到云端创建', 'error'); return; }
      await pullCloud();
      fillSyncDialog();
    } catch (e) { toast('拉取失败：' + e.message, 'error'); }
  });
  $('#syncPush').addEventListener('click', async () => {
    try {
      saveSyncCfg();
      await pushCloud();
      fillSyncDialog();
    } catch (e) { toast('推送失败：' + e.message, 'error'); }
  });
}

/* ================= 导入 / 导出 ================= */
function exportData() {
  const blob = new Blob([JSON.stringify(cloudPayload(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = DATA_FILE;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出 ' + DATA_FILE);
}

function bindImport() {
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!Array.isArray(payload.sites)) throw new Error('缺少 sites 字段');
        const keepSync = state.data.settings.sync;
        state.data = { version: 1, sites: payload.sites, settings: { ...seedSettings(), ...(payload.settings || {}), sync: keepSync } };
        state.page = 0;
        persist();
        renderAll();
        toast(`已导入 ${state.data.sites.length} 个网址`);
      } catch (err) { toast('导入失败：' + err.message, 'error'); }
    };
    reader.readAsText(file, 'utf-8');
  });
}

/* ================= 搜索 ================= */
const LOOKS_LIKE_URL = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/;

function doSearch() {
  const q = $('#searchInput').value.trim();
  if (!q) return;
  let target;
  if (!q.includes(' ') && LOOKS_LIKE_URL.test(q)) {
    target = /^https?:\/\//i.test(q) ? q : 'https://' + q;
  } else {
    target = currentEngine().build(encodeURIComponent(q));
  }
  window.open(target, '_blank');
}

/* ================= Toast ================= */
function toast(msg, type = 'info', ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, ms);
}

/* ================= 翻页 ================= */
function flipPage(delta) {
  const next = state.page + delta;
  if (next < 0 || next >= state.pages) return;
  state.page = next;
  renderGrid();
}

/* ================= 事件绑定 ================= */
function bindEvents() {
  $('#btnMenu').addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  $('#menu').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (b) onMenuAction(b.dataset.act);
  });
  $('#btnHome').addEventListener('click', () => {
    toggleMenu(false);
    state.page = 0;
    renderGrid();
    $('#searchInput').focus();
  });
  $('#logo').addEventListener('click', () => $('#dlgAbout').showModal());

  document.addEventListener('click', e => {
    if (!$('#menu').hidden && !$('#menu').contains(e.target) && !$('#btnMenu').contains(e.target)) toggleMenu(false);
    if (!$('#ctxMenu').hidden) $('#ctxMenu').hidden = true;
  });
  addEventListener('blur', () => { toggleMenu(false); $('#ctxMenu').hidden = true; });

  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); doSearch(); });
  $('#engineLogo').addEventListener('click', () => {
    // 循环切换搜索引擎
    const i = ENGINES.findIndex(x => x.id === state.data.settings.engine);
    state.data.settings.engine = ENGINES[(i + 1) % ENGINES.length].id;
    persistLocal();
    renderEngines();
    updateSearchUI();
  });

  bindSiteDialog();
  bindSettingsDialog();
  bindSyncDialog();
  bindImport();

  // 图标加载失败时退回字母头像（事件捕获，处理 img error）
  $('#grid').addEventListener('error', e => {
    if (e.target.tagName === 'IMG') e.target.remove();
  }, true);

  // dialog：点击遮罩或 × 关闭
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  });

  // 键盘
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { toggleMenu(false); $('#ctxMenu').hidden = true; }
    const tag = document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if ((e.key === '/' && !typing) || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      $('#searchInput').focus();
      $('#searchInput').select();
    }
    if (!typing && !/^dialog/i.test(document.activeElement.tagName)) {
      if (e.key === 'ArrowRight') flipPage(1);
      if (e.key === 'ArrowLeft') flipPage(-1);
    }
  });

  // 滚轮翻页
  let wheelAt = 0;
  $('#gridArea').addEventListener('wheel', e => {
    const now = Date.now();
    if (now - wheelAt < 450 || Math.abs(e.deltaY) < 20) return;
    if (e.deltaY > 0) { if (state.page < state.pages - 1) { flipPage(1); wheelAt = now; } }
    else if (state.page > 0) { flipPage(-1); wheelAt = now; }
  }, { passive: true });

  addEventListener('resize', debounce(renderGrid, 200));
}

/* ================= 启动 ================= */
async function init() {
  state.data = await local.load();
  const fresh = !state.data;
  if (fresh) state.data = { version: 1, sites: seedSites(), settings: seedSettings() };
  if (fresh || !Array.isArray(state.data.sites)) {
    if (!Array.isArray(state.data.sites)) state.data.sites = [];
    persistLocal();
  }
  bindEvents();
  renderAll();
}

init().catch(err => toast('初始化失败：' + err.message, 'error'));
