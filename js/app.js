import { createAdapter, DATA_FILE, LocalAdapter } from './adapters.js';

/* ================= 小工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const SVG_X = '✕';

function tint(name) {
  const palette = ['#f2708a', '#5aa9e6', '#7fc8a9', '#e6a157', '#9b8ce0', '#59c3c3'];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return palette[h % palette.length];
}

/* ================= 搜索类型与引擎（对齐 inftab） ================= */
// 顶部 tab：搜索类型。每个引擎按类型提供地址模板，搜索词直接拼接在地址末尾（或替换 %s）。
const TYPES = [
  { id: 'html',   name: 'html' },
  { id: 'photos', name: 'photos' },
  { id: 'news',   name: 'news' },
  { id: 'videos', name: 'videos' },
  { id: 'map',    name: 'map' },
];

// 内置引擎库（baidu/bing 地址原样取自 inftab 默认数据，其余按各家官方搜索拼装）
const ENGINE_CATALOG = [
  {
    id: 'baidu', name: 'baidu', glyph: '百', color: '#2932e1', urls: {
      html: 'https://www.baidu.com/s?tn=75144485_7_dg&ie=utf-8&wd=',
      photos: 'https://image.baidu.com/search/index?isource=infinity&iname=baidu&tn=baiduimage&word=',
      news: 'https://news.baidu.com/ns?isource=infinity&iname=baidu&tn=news&ie=utf-8&word=',
      videos: 'https://video.baidu.com/v?isource=infinity&iname=baidu&ie=utf-8&word=',
      map: 'http://map.baidu.com/?isource=infinity&iname=baidu&newmap=1&ie=utf-8&s=s%26wd%3D',
    },
  },
  {
    id: 'bing', name: 'bing', glyph: 'b', color: '#008373', urls: {
      html: 'https://cn.bing.com/search?isource=infinity&iname=bing&itype=web&q=',
      photos: 'https://cn.bing.com/images/search?isource=infinity&iname=bing&q=',
      news: 'https://global.bing.com/news/search?isource=infinity&iname=bing&q=',
      videos: 'https://cn.bing.com/videos/search?isource=infinity&iname=bing&q=',
      map: 'https://www.bing.com/ditu/?isource=infinity&iname=bing&q=',
    },
  },
  {
    id: 'yahoo', name: 'yahoo', glyph: 'Y', color: '#5f01d1', urls: {
      html: 'https://search.yahoo.com/search?p=%s',
      photos: 'https://images.search.yahoo.com/search/images?p=%s',
      news: 'https://news.search.yahoo.com/search?p=%s',
      videos: 'https://video.search.yahoo.com/search/video?p=%s',
      map: 'https://search.yahoo.com/search?p=%s',
    },
  },
  {
    id: 'yandex', name: 'yandex', glyph: 'Я', color: '#fc3f1d', urls: {
      html: 'https://yandex.com/search/?text=%s',
      photos: 'https://yandex.com/images/search?text=%s',
      news: 'https://yandex.com/news/search?text=%s',
      videos: 'https://yandex.com/video/search?text=%s',
      map: 'https://yandex.com/maps/?text=%s',
    },
  },
  {
    id: 'duckduckgo', name: 'duckduckgo', glyph: 'D', color: '#de5833', urls: {
      html: 'https://duckduckgo.com/?q=%s&ia=web',
      photos: 'https://duckduckgo.com/?q=%s&iax=images&ia=images',
      news: 'https://duckduckgo.com/?q=%s&iar=news&ia=news',
      videos: 'https://duckduckgo.com/?q=%s&iax=videos&ia=videos',
      map: 'https://duckduckgo.com/?q=%s&ia=webmap&iaxm=maps',
    },
  },
  {
    id: 'n_360', name: '360搜索', glyph: '360', color: '#3dbd38', urls: {
      html: 'https://www.so.com/s?q=%s',
      photos: 'https://image.so.com/j?q=%s',
      news: 'https://news.so.com/ns?q=%s',
      videos: 'https://video.so.com/v?q=%s',
      map: 'https://map.so.com/?q=%s',
    },
  },
  {
    id: 'sougou', name: 'sogou', glyph: '搜', color: '#ff6f37', urls: {
      html: 'https://www.sogou.com/web?query=%s',
      photos: 'https://pic.sogou.com/pics?query=%s',
      news: 'https://news.sogou.com/news?query=%s',
      videos: 'https://v.sogou.com/v?query=%s',
      map: 'https://map.sogou.com/m/fulltext?query=%s',
    },
  },
  {
    id: 'yarndex_ru', name: 'yandex ru', glyph: 'Я', color: '#a52a2a', urls: {
      html: 'https://yandex.ru/search/?text=%s',
      photos: 'https://yandex.ru/images/search?text=%s',
      news: 'https://yandex.ru/news/search?text=%s',
      videos: 'https://yandex.ru/video/search?text=%s',
      map: 'https://yandex.ru/maps/?text=%s',
    },
  },
];

const cloneEngine = e => ({ id: e.id, name: e.name, glyph: e.glyph || '', color: e.color || '', urls: { ...e.urls } });
const seedEngines = () => ENGINE_CATALOG.filter(e => e.id === 'baidu' || e.id === 'bing').map(cloneEngine);

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
    searchType: 'html',
    engines: seedEngines(),
    layout: { row: 3, col: 6 },
    searchSuggest: true,
    hideIconName: false,
    wallpaper: 'preset:forest',
    customWallpaper: '',
    faviconApi: DEFAULT_FAVICON_API,
    lastSyncAt: null,
    sync: { type: 'local', token: '', gistId: '', filename: DATA_FILE, autoSync: true },
  };
}

// 旧版类型 -> 新类型的映射（web/images/video/news/music -> html/photos/videos/news/–）
const TYPE_ALIAS = { web: 'html', images: 'photos', video: 'videos', news: 'news', html: 'html', photos: 'photos', videos: 'videos', map: 'map' };

function migrateUrls(urls = {}) {
  const out = {};
  for (const [k, v] of Object.entries(urls)) {
    const nk = TYPE_ALIAS[k];
    if (nk && typeof v === 'string' && v) out[nk] = v;
  }
  return out;
}

/** 校验/修补设置：兼容旧版结构与被裁剪的云端数据，并把内置引擎与最新模板对齐 */
function normalizeSettings(s = {}) {
  const def = seedSettings();
  const out = { ...def, ...s };
  out.engines = (Array.isArray(s.engines) ? s.engines : def.engines)
    .filter(e => e && e.id && e.name && e.urls)
    .map(e => ({ id: e.id, name: String(e.name), glyph: e.glyph || '', color: e.color || '', urls: migrateUrls(e.urls) }));
  // 内置引擎始终保留最新目录定义（未启用的不出现在列表中）
  out.engines = out.engines.filter(e => !ENGINE_CATALOG.some(c => c.id === e.id));
  for (const id of ['baidu', 'bing']) {
    const c = ENGINE_CATALOG.find(x => x.id === id);
    if (!out.engines.some(e => e.id === id)) out.engines.unshift(cloneEngine(c));
  }
  if (!out.engines.length) out.engines = def.engines;
  if (!TYPES.some(t => t.id === out.searchType)) out.searchType = def.searchType;
  if (!out.engines.some(e => e.id === out.engine)) out.engine = 'baidu';
  if (!out.engines.some(e => e.id === out.engine)) out.engine = out.engines[0].id;
  delete out.engineByType; // 旧版字段
  if (!out.layout || typeof out.layout !== 'object') out.layout = { ...def.layout };
  out.layout.row = Math.min(5, Math.max(1, parseInt(out.layout.row, 10) || 3));
  out.layout.col = Math.min(8, Math.max(3, parseInt(out.layout.col, 10) || 6));
  out.searchSuggest = out.searchSuggest !== false;
  out.hideIconName = out.hideIconName === true;
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

const colFit = () => Math.max(3, Math.floor((innerWidth - 40) / 108));
const cols = () => Math.min(state.data.settings.layout.col, colFit());
const perPage = () => cols() * state.data.settings.layout.row;

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

/* ================= 渲染 ================= */
function applyWallpaper() {
  const s = state.data.settings;
  const wp = WALLPAPERS.find(w => w.id === s.wallpaper) || WALLPAPERS[0];
  $('#wallpaper').style.backgroundImage = s.customWallpaper ? `url("${s.customWallpaper}")` : wp.css;
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
  grid.classList.toggle('hide-labels', !!state.data.settings.hideIconName);
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

  // 翻页箭头
  $('#gridPrev').hidden = state.page <= 0;
  $('#gridNext').hidden = state.page >= state.pages - 1;
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

function openSettings() {
  renderWpGrid();
  renderEngineList();
  $('#wpUrl').value = state.data.settings.customWallpaper || '';
  $('#faviconApi').value = state.data.settings.faviconApi || DEFAULT_FAVICON_API;
  $('#optSuggest').checked = !!state.data.settings.searchSuggest;
  $('#optHideName').checked = !!state.data.settings.hideIconName;
  $('#layoutRow').value = String(state.data.settings.layout.row);
  $('#layoutCol').value = String(state.data.settings.layout.col);
  $('#dlgSettings').showModal();
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

/* ================= 搜索类型与引擎 ================= */
function activeType() {
  return TYPES.find(t => t.id === state.data.settings.searchType) || TYPES[0];
}

/** 当前生效的引擎（全局选择，与 inftab 一致） */
function resolveEngine() {
  const s = state.data.settings;
  return s.engines.find(e => e.id === s.engine) || s.engines[0];
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
      persistLocal();
      renderTypeTabs();
      hideSug();
    };
    tabs.append(b);
  });
}

function updateSearchUI() {
  const eng = resolveEngine();
  const logo = $('#engineLogo');
  const glyph = eng.glyph || (eng.name || '?')[0];
  logo.textContent = glyph;
  logo.style.background = eng.color || tint(eng.name);
  logo.style.fontSize = glyph.length > 1 ? '10px' : '13px';
}

/* ---------- 引擎选择弹层（Logo 下拉，对齐 inftab：全部引擎 + 添加） ---------- */
function toggleEngineMenu(force) {
  const m = $('#engineMenu');
  if (force !== undefined) { m.hidden = !force; return; }
  if (m.hidden) { renderEngineMenu(); m.hidden = false; }
  else m.hidden = true;
}

function renderEngineMenu() {
  const m = $('#engineMenu');
  const cur = resolveEngine();
  m.innerHTML = '';
  state.data.settings.engines.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'eng-pick' + (e.id === cur.id ? ' on' : '');
    b.innerHTML = `<span class="eng-glyph" style="background:${e.color || tint(e.name)}">${escapeHtml(e.glyph || e.name[0])}</span><span class="eng-name">${escapeHtml(e.name)}</span>`;
    b.onclick = () => {
      state.data.settings.engine = e.id;
      persistLocal();
      toggleEngineMenu(false);
      updateSearchUI();
    };
    m.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'eng-pick add';
  add.innerHTML = `<span class="eng-glyph plus">${SVG_PLUS}</span><span class="eng-name">添加</span>`;
  add.onclick = () => { toggleEngineMenu(false); openEngineDialog(null); };
  m.append(add);
}

function buildSearchUrl(eng, typeId, q) {
  const tpl = (eng.urls && (eng.urls[typeId] || eng.urls.html)) || '';
  const eq = encodeURIComponent(q);
  return tpl.includes('%s') ? tpl.replace('%s', () => eq) : tpl + eq;
}

/* ---------- 搜索建议（百度 sugrec JSONP） ---------- */
let sugTimer = null;
let sugList = [];
let sugIndex = -1;

function hideSug() {
  sugList = [];
  sugIndex = -1;
  const d = $('#sugDrop');
  d.hidden = true;
  d.innerHTML = '';
}

function renderSug() {
  const d = $('#sugDrop');
  if (!sugList.length) { hideSug(); return; }
  d.innerHTML = sugList.map((q, i) =>
    `<li class="${i === sugIndex ? 'active' : ''}" data-q="${escapeHtml(q)}">${escapeHtml(q)}</li>`).join('');
  d.hidden = false;
}

async function fetchSug(q) {
  const data = await jsonp(
    `https://www.baidu.com/sugrec?pre=1&p=3&ie=UTF-8&json=1&prod=pc&from=pc_web&wd=${encodeURIComponent(q)}`,
    '__navSugCb'
  );
  const list = (data && Array.isArray(data.g) ? data.g : []).map(x => String(x.q || '')).filter(Boolean).slice(0, 8);
  sugList = list;
  sugIndex = -1;
  renderSug();
}

function jsonp(url, cbName, timeout = 2500) {
  return new Promise(resolve => {
    const s = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); resolve(null); }, timeout);
    function cleanup() { clearTimeout(timer); delete window[cbName]; s.remove(); }
    window[cbName] = data => { cleanup(); resolve(data); };
    s.src = url + '&cb=' + cbName;
    s.onerror = () => { cleanup(); resolve(null); };
    document.head.append(s);
  });
}

/* ================= 搜索 ================= */
const LOOKS_LIKE_URL = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/;

function doSearch(qRaw) {
  const q = (qRaw !== undefined ? qRaw : $('#searchInput').value).trim();
  if (!q) return;
  let target;
  if (!q.includes(' ') && LOOKS_LIKE_URL.test(q)) {
    target = /^https?:\/\//i.test(q) ? q : 'https://' + q;
  } else {
    target = buildSearchUrl(resolveEngine(), activeType().id, q);
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

/* ================= 菜单事件 ================= */
function bindTopMenu() {
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
    if (!$('#ctxMenu').hidden && !$('#ctxMenu').contains(e.target)) $('#ctxMenu').hidden = true;
  });
  addEventListener('blur', () => { toggleMenu(false); toggleEngineMenu(false); $('#ctxMenu').hidden = true; });
}

/* ================= 设置（外观 / 搜索 / 网格） ================= */
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
    s.customWallpaper = $('#wpUrl').value.trim();
    s.faviconApi = $('#faviconApi').value.trim() || DEFAULT_FAVICON_API;
    s.searchSuggest = $('#optSuggest').checked;
    s.hideIconName = $('#optHideName').checked;
    s.layout.row = parseInt($('#layoutRow').value, 10) || 3;
    s.layout.col = parseInt($('#layoutCol').value, 10) || 6;
    persist();
    applyWallpaper();
    renderGrid();
    $('#dlgSettings').close();
    toast('设置已保存');
  });
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
      <button type="button" class="eng-btn" data-act="del" title="移除" ${engines.length <= 1 ? 'disabled' : ''}>🗑</button>`;
    row.querySelector('[data-act="edit"]').addEventListener('click', () => openEngineDialog(e));
    row.querySelector('[data-act="del"]').addEventListener('click', () => removeEngine(e));
    list.append(row);
  });
}

function removeEngine(engine) {
  const s = state.data.settings;
  if (s.engines.length <= 1) { toast('至少保留一个搜索引擎', 'error'); return; }
  if (!confirm(`移除搜索引擎「${engine.name}」？`)) return;
  s.engines = s.engines.filter(x => x.id !== engine.id);
  if (s.engine === engine.id) s.engine = s.engines[0].id;
  persist();
  renderEngineList();
  updateSearchUI();
  toast(`已移除「${engine.name}」（引擎库中可随时重新启用）`);
}

function openEngineDialog(engine) {
  const adding = !engine;
  $('#engDlgTitle').textContent = adding ? '添加搜索引擎' : '编辑搜索引擎';
  $('#engId').value = engine ? engine.id : '';
  $('#engName').value = engine ? engine.name : '';
  const u = engine ? engine.urls : {};
  $('#engHtml').value = u.html || '';
  $('#engPhotos').value = u.photos || '';
  $('#engVideos').value = u.videos || '';
  $('#engNews').value = u.news || '';
  $('#engMap').value = u.map || '';
  $('#engFormError').hidden = true;
  $('#engCatalogBox').hidden = !adding;
  if (adding) renderEngineCatalog();
  $('#dlgEngine').showModal();
  if (adding && $('#engCatalog').children.length) return; // 先看引擎库
  $('#engName').focus();
}

function renderEngineCatalog() {
  const box = $('#engCatalog');
  box.innerHTML = '';
  const s = state.data.settings;
  ENGINE_CATALOG.filter(c => !s.engines.some(e => e.id === c.id)).forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-item';
    b.innerHTML = `<span class="eng-glyph" style="background:${c.color}">${escapeHtml(c.glyph)}</span><span class="eng-name">${escapeHtml(c.name)}</span>`;
    b.onclick = () => {
      s.engines.push(cloneEngine(c));
      persist();
      renderEngineCatalog();
      renderEngineList();
      updateSearchUI();
      toast(`已启用「${c.name}」`);
    };
    box.append(b);
  });
  if (!box.children.length) box.innerHTML = '<p class="hint">引擎库中的引擎已全部启用</p>';
}

function bindEngineDialog() {
  $('#engForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#engFormError');
    const showErr = msg => { err.textContent = msg; err.hidden = false; };
    const name = $('#engName').value.trim();
    const urls = {};
    for (const t of TYPES) {
      const id = 'eng' + t.id[0].toUpperCase() + t.id.slice(1);
      const v = $('#' + id).value.trim();
      if (v) urls[t.id] = v;
    }
    if (!name) { showErr('请填写引擎名称'); return; }
    if (!urls.html) { showErr('请填写网页搜索地址'); return; }
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
    updateSearchUI();
    toast('搜索引擎已保存');
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

/* ================= 事件绑定 ================= */
function bindEvents() {
  bindTopMenu();

  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    hideSug();
    doSearch();
  });
  $('#engineLogo').addEventListener('click', e => { e.stopPropagation(); toggleEngineMenu(); });

  // 搜索建议
  const input = $('#searchInput');
  input.addEventListener('input', () => {
    clearTimeout(sugTimer);
    const q = input.value.trim();
    if (!state.data.settings.searchSuggest || !q || q.includes(' ') || LOOKS_LIKE_URL.test(q)) { hideSug(); return; }
    sugTimer = setTimeout(() => fetchSug(q), 180);
  });
  input.addEventListener('keydown', e => {
    if ($('#sugDrop').hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sugIndex = e.key === 'ArrowDown'
        ? (sugIndex + 1) % sugList.length
        : (sugIndex - 1 + sugList.length) % sugList.length;
      renderSug();
    } else if (e.key === 'Enter' && sugIndex >= 0) {
      e.preventDefault();
      const q = sugList[sugIndex];
      hideSug();
      doSearch(q);
    } else if (e.key === 'Escape') {
      hideSug();
    }
  });
  $('#sugDrop').addEventListener('mousedown', e => {
    const li = e.target.closest('li[data-q]');
    if (!li) return;
    e.preventDefault();
    hideSug();
    doSearch(li.dataset.q);
  });
  $('#searchInput').addEventListener('blur', () => setTimeout(hideSug, 150));

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
    if (e.key === 'Escape') { toggleMenu(false); toggleEngineMenu(false); hideSug(); $('#ctxMenu').hidden = true; }
    const tag = document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if ((e.key === '/' && !typing) || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      $('#searchInput').focus();
      $('#searchInput').select();
    }
    if (!typing) {
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

  // 翻页箭头
  $('#gridPrev').addEventListener('click', () => flipPage(-1));
  $('#gridNext').addEventListener('click', () => flipPage(1));

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
    persistLocal();
  }
  bindEvents();
  renderAll();
}

init().catch(err => toast('初始化失败：' + err.message, 'error'));
