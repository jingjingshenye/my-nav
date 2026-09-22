import { createAdapter, ADAPTERS, DATA_FILE, LocalAdapter } from './adapters.js';

/* ================= 小工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const SVG_X = '✕';

/* ================= 搜索类型与引擎 ================= */
// 顶部 tab：搜索类型，各引擎按类型提供地址模板（引擎存在 settings.engines，可自由增删改）
const TYPES = [
  { id: 'web',    name: '网页' },
  { id: 'images', name: '图片' },
  { id: 'video',  name: '视频' },
  { id: 'news',   name: '新闻' },
  { id: 'music',  name: '音乐' },
];

// 地址模板中的 %s 代表搜索词
function seedEngines() {
  return [
    { id: 'baidu', name: '百度', glyph: '百', color: '#2932e1', urls: {
      web: 'https://www.baidu.com/s?wd=%s',
      images: 'https://image.baidu.com/search/index?tn=baiduimage&word=%s',
      video: 'https://video.baidu.com/search?word=%s',
      news: 'https://www.baidu.com/s?tn=news&word=%s',
      music: 'https://music.baidu.com/search?key=%s' } },
    { id: 'bing', name: '必应', glyph: 'b', color: '#008373', urls: {
      web: 'https://www.bing.com/search?q=%s',
      images: 'https://www.bing.com/images/search?q=%s',
      video: 'https://www.bing.com/videos/search?q=%s',
      news: 'https://www.bing.com/news/search?q=%s' } },
    { id: 'google', name: '谷歌', glyph: 'G', color: '#4285f4', urls: {
      web: 'https://www.google.com/search?q=%s',
      images: 'https://www.google.com/search?q=%s&tbm=isch',
      video: 'https://www.google.com/search?q=%s&tbm=vid',
      news: 'https://www.google.com/search?q=%s&tbm=nws' } },
    { id: 'sogou', name: '搜狗', glyph: '搜', color: '#ff6f37', urls: {
      web: 'https://www.sogou.com/web?query=%s',
      images: 'https://pic.sogou.com/pics?query=%s',
      video: 'https://v.sogou.com/v?query=%s',
      news: 'https://news.sogou.com/news?query=%s' } },
    { id: 'so360', name: '360搜索', glyph: '360', color: '#3dbd38', urls: {
      web: 'https://www.so.com/s?q=%s',
      images: 'https://image.so.com/j?q=%s',
      video: 'https://video.so.com/v?q=%s',
      news: 'https://news.so.com/ns?q=%s' } },
    { id: 'zhihu', name: '知乎', glyph: '知', color: '#056de8', urls: { web: 'https://www.zhihu.com/search?type=content&q=%s' } },
    { id: 'github', name: 'GitHub', glyph: 'GH', color: '#24292f', urls: { web: 'https://github.com/search?q=%s' } },
    { id: 'taobao', name: '淘宝', glyph: '淘', color: '#ff5000', urls: { web: 'https://s.taobao.com/search?q=%s' } },
    { id: 'weibo', name: '微博', glyph: '微', color: '#e6162d', urls: { web: 'https://s.weibo.com/weibo?q=%s' } },
  ];
}

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
    searchType: 'web',
    engineByType: {},
    engines: seedEngines(),
    wallpaper: 'preset:forest',
    customWallpaper: '',
    faviconApi: DEFAULT_FAVICON_API,
    lastSyncAt: null,
    sync: { type: 'local', token: '', gistId: '', filename: DATA_FILE, autoSync: true },
  };
}

/** 校验/修补设置：兼容旧版数据与被裁剪的云端数据 */
function normalizeSettings(s = {}) {
  const def = seedSettings();
  const out = { ...def, ...s };
  out.engines = (Array.isArray(s.engines) ? s.engines : def.engines)
    .filter(e => e && e.id && e.name && e.urls && typeof e.urls.web === 'string')
    .map(e => ({ id: e.id, name: String(e.name), glyph: e.glyph || '', color: e.color || '', urls: { ...e.urls } }));
  if (!out.engines.length) out.engines = def.engines;
  if (!TYPES.some(t => t.id === out.searchType)) out.searchType = def.searchType;
  if (!out.engines.some(e => e.id === out.engine)) out.engine = out.engines[0].id;
  if (!out.engineByType || typeof out.engineByType !== 'object') out.engineByType = {};
  return out;
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
    settings: { ...normalizeSettings(payload.settings || {}), sync: keepSync },
  };
  state.page = 0;
  persistLocal();
  renderAll();
  if (notify) toast('已从云端拉取数据');
}

/* ================= 搜索类型与引擎 ================= */
function activeType() {
  return TYPES.find(t => t.id === state.data.settings.searchType) || TYPES[0];
}

/** 当前类型下实际生效的引擎：优先用户为该类型选过的引擎；不支持该类型时自动换到支持的引擎 */
function resolveEngine(typeId = activeType().id) {
  const s = state.data.settings;
  const byId = id => s.engines.find(e => e.id === id);
  const supports = e => e && e.urls && !!e.urls[typeId];
  const pref = byId(s.engineByType[typeId]) || byId(s.engine);
  return supports(pref) ? pref : (s.engines.find(supports) || s.engines[0]);
}

function renderTypeTabs() {
  const tabs = $('#engineTabs');
  tabs.innerHTML = '';
  TYPES.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.name;
    b.className = t.id === state.data.settings.searchType ? 'active' : '';
    b.onclick = () => {
      state.data.settings.searchType = t.id;
      state.data.settings.engine = resolveEngine(t.id).id;
      persistLocal();
      renderTypeTabs();
      updateSearchUI();
    };
    tabs.append(b);
  });
}

function updateSearchUI() {
  const eng = resolveEngine();
  const t = activeType();
  const logo = $('#engineLogo');
  const glyph = eng.glyph || (eng.name || '?')[0];
  logo.textContent = glyph;
  logo.style.background = eng.color || tint(eng.name);
  logo.style.fontSize = glyph.length > 1 ? '10px' : '13px';
  $('#searchInput').placeholder = `在${eng.name}中搜索${t.id === 'web' ? '' : t.name}，或直接输入网址`;
}

/* ---------- 引擎选择弹层 ---------- */
function toggleEngineMenu(force) {
  const m = $('#engineMenu');
  if (force !== undefined) { m.hidden = !force; return; }
  if (m.hidden) { renderEngineMenu(); m.hidden = false; }
  else m.hidden = true;
}

function renderEngineMenu() {
  const m = $('#engineMenu');
  const t = activeType();
  const cur = resolveEngine();
  m.innerHTML = '';
  state.data.settings.engines.filter(e => e.urls[t.id]).forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = e.id === cur.id ? 'on' : '';
    b.innerHTML = `<span class="eng-glyph" style="background:${e.color || tint(e.name)}">${escapeHtml(e.glyph || e.name[0])}</span>${escapeHtml(e.name)}`;
    b.onclick = () => {
      const s = state.data.settings;
      s.engineByType[t.id] = e.id; // 记住该类型下选择的引擎
      s.engine = e.id;
      persistLocal();
      toggleEngineMenu(false);
      updateSearchUI();
    };
    m.append(b);
  });
  m.append(document.createElement('hr'));
  const mg = document.createElement('button');
  mg.textContent = '管理搜索引擎…';
  mg.onclick = () => { toggleEngineMenu(false); openSettings(); };
  m.append(mg);
}

/* ================= 渲染 ================= */
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
  renderTypeTabs();
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
    case 'settings': openSettings(); break;
    case 'sync': fillSyncDialog(); $('#dlgSync').showModal(); break;
    case 'import': $('#importFile').click(); break;
    case 'export': exportData(); break;
    case 'about': $('#dlgAbout').showModal(); break;
  }
}

/* ================= 设置（外观） ================= */
function openSettings() {
  renderWpGrid();
  renderEngineList();
  $('#wpUrl').value = state.data.settings.customWallpaper || '';
  $('#faviconApi').value = state.data.settings.faviconApi || DEFAULT_FAVICON_API;
  $('#dlgSettings').showModal();
}

/* ---------- 搜索引擎管理 ---------- */
function renderEngineList() {
  const list = $('#engineList');
  list.innerHTML = '';
  const engines = state.data.settings.engines;
  engines.forEach(e => {
    const row = document.createElement('div');
    row.className = 'eng-row';
    const support = TYPES.filter(t => e.urls[t.id]).map(t => t.name).join(' / ');
    row.innerHTML = `
      <span class="eng-glyph" style="background:${e.color || tint(e.name)}">${escapeHtml(e.glyph || (e.name || '?')[0])}</span>
      <span class="eng-info"><b>${escapeHtml(e.name)}</b><i>${support}</i></span>
      <button type="button" class="eng-btn" data-act="edit" title="编辑">✎</button>
      <button type="button" class="eng-btn" data-act="del" title="删除" ${engines.length <= 1 ? 'disabled' : ''}>🗑</button>`;
    row.querySelector('[data-act="edit"]').addEventListener('click', () => openEngineDialog(e));
    row.querySelector('[data-act="del"]').addEventListener('click', () => removeEngine(e));
    list.append(row);
  });
}

function removeEngine(engine) {
  const s = state.data.settings;
  if (s.engines.length <= 1) { toast('至少保留一个搜索引擎', 'error'); return; }
  if (!confirm(`删除搜索引擎「${engine.name}」？`)) return;
  s.engines = s.engines.filter(x => x.id !== engine.id);
  if (s.engine === engine.id) s.engine = s.engines[0].id;
  for (const k of Object.keys(s.engineByType)) {
    if (s.engineByType[k] === engine.id) delete s.engineByType[k];
  }
  persist();
  renderEngineList();
  renderTypeTabs();
  updateSearchUI();
  toast(`已删除「${engine.name}」`);
}

function openEngineDialog(engine) {
  $('#engDlgTitle').textContent = engine ? '编辑搜索引擎' : '添加搜索引擎';
  $('#engId').value = engine ? engine.id : '';
  $('#engName').value = engine ? engine.name : '';
  const u = engine ? engine.urls : {};
  $('#engWeb').value = u.web || '';
  $('#engImages').value = u.images || '';
  $('#engVideo').value = u.video || '';
  $('#engNews').value = u.news || '';
  $('#engMusic').value = u.music || '';
  $('#engFormError').hidden = true;
  $('#dlgEngine').showModal();
  $('#engName').focus();
}

function bindEngineDialog() {
  $('#engForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#engFormError');
    const showErr = msg => { err.textContent = msg; err.hidden = false; };
    const name = $('#engName').value.trim();
    const urls = {};
    for (const t of TYPES) {
      const v = $('#eng' + t.id[0].toUpperCase() + t.id.slice(1)).value.trim();
      if (!v) continue;
      if (!v.includes('%s')) { showErr(`「${t.name}」地址必须包含 %s 占位符`); return; }
      urls[t.id] = v;
    }
    if (!name) { showErr('请填写引擎名称'); return; }
    if (!urls.web) { showErr('请填写网页搜索地址（含 %s）'); return; }
    const s = state.data.settings;
    const id = $('#engId').value;
    if (id) {
      const eng = s.engines.find(x => x.id === id);
      if (eng) Object.assign(eng, { name, urls });
    } else {
      s.engines.push({ id: uid(), name, glyph: '', color: '', urls });
    }
    persist();
    $('#dlgEngine').close();
    renderEngineList();
    renderTypeTabs();
    updateSearchUI();
    toast('搜索引擎已保存');
  });
}

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
  $('#btnAddEngine').addEventListener('click', () => openEngineDialog(null));
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
        state.data = { version: 1, sites: payload.sites, settings: { ...normalizeSettings(payload.settings || {}), sync: keepSync } };
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
    const t = activeType();
    const eng = resolveEngine(t.id);
    const tpl = eng.urls[t.id] || eng.urls.web;
    target = tpl.includes('%s') ? tpl.replace('%s', () => encodeURIComponent(q)) : tpl + encodeURIComponent(q);
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
    if (!$('#engineMenu').hidden && !$('#engineMenu').contains(e.target) && !$('#engineLogo').contains(e.target)) toggleEngineMenu(false);
    if (!$('#ctxMenu').hidden) $('#ctxMenu').hidden = true;
  });
  addEventListener('blur', () => { toggleMenu(false); $('#ctxMenu').hidden = true; });

  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); doSearch(); });
  $('#engineLogo').addEventListener('click', e => { e.stopPropagation(); toggleEngineMenu(); });

  bindSiteDialog();
  bindSettingsDialog();
  bindEngineDialog();
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
    if (e.key === 'Escape') { toggleMenu(false); toggleEngineMenu(false); $('#ctxMenu').hidden = true; }
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
  if (fresh) {
    state.data = { version: 1, sites: seedSites(), settings: seedSettings() };
    persistLocal();
  } else {
    state.data.settings = normalizeSettings(state.data.settings);
    if (!Array.isArray(state.data.sites)) state.data.sites = [];
  }
  bindEvents();
  renderAll();
}

init().catch(err => toast('初始化失败：' + err.message, 'error'));
