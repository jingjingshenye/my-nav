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
  { id: 'html',   name: '网页' },
  { id: 'photos', name: '图片' },
  { id: 'news',   name: '新闻' },
  { id: 'videos', name: '视频' },
  { id: 'map',    name: '地图' },
];

// 内置引擎库（bing 地址原样取自 inftab 默认数据，其余按各家官方搜索拼装）
const ENGINE_CATALOG = [
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
const seedEngines = () => ENGINE_CATALOG.filter(e => e.id === 'bing').map(cloneEngine);

/* ================= 内置壁纸 ================= */
const WALLPAPERS = [
  { id: 'preset:forest', name: '雾林', css: "url('assets/wallpaper.svg')" },
  { id: 'preset:aurora', name: '极光', css: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'preset:dusk',   name: '暮色', css: 'linear-gradient(135deg,#355c7d,#6c5b7b,#c06c84)' },
  { id: 'preset:mint',   name: '薄荷', css: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { id: 'preset:night',  name: '暗夜', css: 'linear-gradient(135deg,#232526,#414345)' },
];

/* ================= 默认数据 ================= */

function seedSettings() {
  return {
    engine: 'bing',
    searchType: 'html',
    engines: seedEngines(),
    // 目标打开方式
    openSitesNewTab: true,
    openSearchNewTab: true,
    // 视图
    pageScale: 100,
    showRandomWallBtn: true,
    showPageBtns: false,
    // 布局
    layout: { mode: 'auto', row: 3, col: 6 },
    // 图标
    hideIconName: false,
    iconShadow: false,
    iconIntro: false,
    iconRadius: 50,
    iconOpacity: 100,
    iconScale: 71,
    // 搜索框
    searchHide: false,
    searchSuggest: true,
    keepSearchText: false,
    searchHideType: false,
    searchScale: 90,
    searchRadius: 20,
    searchOpacity: 100,
    // 字体
    fontShadow: true,
    fontSize: 13,
    fontColor: '#ffffff',
    // 入场动画效果
    animEasing: 'default',
    // 搜索按钮
    searchHideBtn: true,
    showTodoBadge: true,
    hideWindmill: false,
    // 壁纸遮罩 / 模糊
    wallOpacity: 40,
    wallBlur: 0,
    // 小组件
    todo: { items: [] },
    note: '',
    weatherCity: '北京',
    // 壁纸
    wallpaper: 'preset:forest',
    customWallpaper: '',
    wallFavorites: [],
    bingDaily: false,
    bingDate: '',
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
    .filter(e => e.id !== 'baidu') // 百度搜索已移除，存量数据一并清掉
    .map(e => {
      const urls = migrateUrls(e.urls);
      // 存量数据（含旧版键名）迁移时，用内置目录补齐缺失的新类型模板；新版数据完全尊重用户修改
      const isLegacy = ['web', 'images', 'video', 'music'].some(k => k in (e.urls || {}));
      const cat = ENGINE_CATALOG.find(c => c.id === e.id);
      return {
        id: e.id, name: String(e.name), glyph: e.glyph || '', color: e.color || '',
        urls: isLegacy && cat ? { ...cat.urls, ...urls } : urls,
      };
    });
  if (!out.engines.length) out.engines = def.engines;
  if (!TYPES.some(t => t.id === out.searchType)) out.searchType = def.searchType;
  if (!out.engines.some(e => e.id === out.engine)) out.engine = out.engines[0].id;
  delete out.engineByType; // 旧版字段
  if (!out.layout || typeof out.layout !== 'object') out.layout = { ...def.layout };
  if (out.layout.mode !== 'fixed') out.layout.mode = 'auto';
  out.layout.row = Math.min(6, Math.max(1, parseInt(out.layout.row, 10) || 3));
  out.layout.col = Math.min(12, Math.max(3, parseInt(out.layout.col, 10) || 6));
  const pct = (v, d, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || d));
  out.pageScale = pct(out.pageScale, 100, 60, 140);
  out.iconRadius = pct(out.iconRadius, 50, 0, 100);
  out.iconOpacity = pct(out.iconOpacity, 100, 30, 100);
  out.iconScale = pct(out.iconScale, 71, 50, 120);
  out.searchScale = pct(out.searchScale, 90, 70, 130);
  out.searchRadius = pct(out.searchRadius, 20, 0, 60);
  out.searchOpacity = pct(out.searchOpacity, 100, 30, 100);
  out.fontSize = pct(out.fontSize, 13, 10, 20);
  out.openSitesNewTab = out.openSitesNewTab !== false;
  out.openSearchNewTab = out.openSearchNewTab !== false;
  out.showRandomWallBtn = out.showRandomWallBtn !== false;
  out.showPageBtns = out.showPageBtns === true;
  out.searchHide = out.searchHide === true;
  out.searchSuggest = out.searchSuggest !== false;
  out.keepSearchText = out.keepSearchText === true;
  out.searchHideType = out.searchHideType === true;
  out.iconShadow = out.iconShadow === true;
  out.iconIntro = out.iconIntro === true;
  out.fontShadow = out.fontShadow !== false;
  out.fontColor = typeof out.fontColor === 'string' && out.fontColor ? out.fontColor : def.fontColor;
  out.hideIconName = out.hideIconName === true;
  out.bingDaily = out.bingDaily === true;
  if (typeof out.bingDate !== 'string') out.bingDate = '';
  delete out.faviconApi; // 已废弃：图标改为多源自动回退
  out.todo = (out.todo && Array.isArray(out.todo.items))
    ? { items: out.todo.items.filter(t => t && typeof t.text === 'string' && t.text.trim())
        .map(t => ({ id: t.id || uid(), text: String(t.text).slice(0, 120), done: !!t.done })) }
    : { items: [] };
  out.note = typeof out.note === 'string' ? out.note.slice(0, 20000) : '';
  out.weatherCity = typeof out.weatherCity === 'string' && out.weatherCity.trim() ? out.weatherCity.trim() : '北京';
  out.wallOpacity = pct(out.wallOpacity, 40, 0, 100);
  out.wallBlur = pct(out.wallBlur, 0, 0, 20);
  out.wallFavorites = Array.isArray(out.wallFavorites)
    ? out.wallFavorites.filter(f => f && typeof f.url === 'string').slice(0, 12)
    : [];
  out.animEasing = ['default', 'spring', 'fade'].includes(out.animEasing) ? out.animEasing : 'default';
  // 旧字段 searchBtn(显示) 迁移为 searchHideBtn(隐藏)
  if (s.searchHideBtn === undefined && s.searchBtn !== undefined) out.searchHideBtn = s.searchBtn === false;
  out.searchHideBtn = out.searchHideBtn !== false; // 默认隐藏（对齐 inftab）
  out.showTodoBadge = out.showTodoBadge !== false;
  out.hideWindmill = out.hideWindmill === true;
  delete out.searchBtn;
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
  layout: { cols: 6, rows: 3, card: 98 },
};

/** 依据屏幕尺寸计算网格布局：自动模式铺满可用宽高，自定义模式按设置的行列数并尽量放大图标 */
function computeLayout() {
  const s = state.data.settings.layout;
  const vw = innerWidth, vh = innerHeight;
  let colsN, rowsN, card;
  if (s.mode === 'fixed') {
    colsN = Math.min(s.col, Math.max(3, Math.floor((vw - 40) / 106)));
    rowsN = s.row;
    card = Math.max(88, Math.min(128, Math.floor(Math.min(vw * 0.94, 1720) / colsN) - 8));
  } else {
    const usableW = Math.min(vw * 0.94, 1760);
    colsN = Math.max(4, Math.min(12, Math.floor(usableW / 148)));
    card = Math.max(96, Math.min(150, Math.floor(usableW / colsN) - 8));
    const areaTop = $('#gridArea').getBoundingClientRect().top;
    const availH = Math.max(220, vh - areaTop - 96); // 预留翻页圆点与页脚
    rowsN = Math.max(2, Math.min(6, Math.floor((availH - 16) / (card * 1.42))));
  }
  state.layout = { cols: colsN, rows: rowsN, card };
}

const perPage = () => state.layout.cols * state.layout.rows;

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
    if (!$('#sidePanel').hidden) fillSyncDialog();
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
  saveBackupNode(); // 拉取覆盖前自动留一份本地快照
  const keepSync = state.data.settings.sync; // 本机的同步凭据不被云端覆盖
  state.data = {
    version: 1,
    sites: payload.sites.map(s => ({
      id: s.id || uid(), name: String(s.name || ''), url: String(s.url || ''),
      icon: s.icon || '', avatar: !!s.avatar, badge: !!s.badge,
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

/* ---------- 壁纸库：必应每日 + Picsum 随机美图 ---------- */
async function fetchJSON(url, timeout = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// 多源回退：依次尝试，直到拿到壁纸列表（url/thumb/title 统一格式）
async function fetchBingFeed() {
  const sources = [
    async () => {
      const d = await fetchJSON('https://peapix.com/api/feed?country=cn');
      return (Array.isArray(d) ? d : []).map(x => ({
        url: x.url || x.image, thumb: x.thumbnail || x.url || x.image,
        title: x.copyright || x.title || '',
      }));
    },
    async () => {
      const d = await fetchJSON('https://peapix.com/api/feed?country=us');
      return (Array.isArray(d) ? d : []).map(x => ({
        url: x.url || x.image, thumb: x.thumbnail || x.url || x.image,
        title: x.copyright || x.title || '',
      }));
    },
    async () => {
      const d = await fetchJSON('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8');
      return (d.images || []).map(x => ({
        url: 'https://www.bing.com' + x.url,
        thumb: 'https://www.bing.com' + x.url,
        title: x.copyright || x.title || '',
      }));
    },
    async () => [{ url: 'https://api.dujin.org/bing/1920.php', thumb: 'https://api.dujin.org/bing/1920.php', title: '必应每日壁纸（直连）' }],
  ];
  for (const f of sources) {
    try {
      const list = (await f()).filter(x => x.url);
      if (list.length) return list;
    } catch { /* 尝试下一个源 */ }
  }
  return null;
}

async function fetchPicsum() {
  const page = 1 + Math.floor(Math.random() * 40);
  const d = await fetchJSON(`https://picsum.photos/v2/list?page=${page}&limit=8`);
  return (Array.isArray(d) ? d : []).map(x => ({
    url: `https://picsum.photos/id/${x.id}/1920/1080`,
    thumb: `https://picsum.photos/id/${x.id}/400/240`,
    title: x.author || ('Pic #' + x.id),
  }));
}

function galItemEl(item) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gal-item';
  b.innerHTML = `<span class="gal-thumb" style="background-image:url('${escapeHtml(item.thumb)}')"></span><span class="gal-cap" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>`;
  b.addEventListener('click', () => applyWallpaperUrl(item.url, item.title));
  return b;
}

function applyWallpaperUrl(url, title, closeDlg = true) {
  const s = state.data.settings;
  s.customWallpaper = url;
  s.wallpaper = ''; // 自定义 URL 优先于内置预设
  persist();
  applyWallpaper();
  if (closeDlg) $('#dlgGallery').close();
  if (!$('#sidePanel').hidden) $('#wpUrl').value = url;
  toast(`已应用「${title || '自定义壁纸'}」，配置将自动同步`);
}

/* ================= 壁纸右键菜单（对齐 inftab） ================= */
function currentWallpaperUrl() {
  return state.data.settings.customWallpaper || '';
}

async function randomWallpaper() {
  toast('正在更换壁纸…');
  try {
    const list = await fetchBingFeed();
    let url = '', title = '';
    if (list) {
      const p = list[Math.floor(Math.random() * list.length)];
      url = p.url; title = p.title;
    } else {
      const d = await fetchJSON('https://picsum.photos/v2/list?page=' + (1 + Math.floor(Math.random() * 40)) + '&limit=1').catch(() => null);
      if (d && d[0]) { url = `https://picsum.photos/id/${d[0].id}/1920/1080`; title = d[0].author; }
    }
    if (!url) { toast('获取壁纸失败，请稍后再试', 'error'); return; }
    applyWallpaperUrl(url, title || '随机壁纸', false);
  } catch { toast('获取壁纸失败，请稍后再试', 'error'); }
}

function favoriteWallpaper() {
  const url = currentWallpaperUrl();
  if (!url) { toast('当前是内置壁纸，应用网络壁纸后可收藏', 'error'); return; }
  const s = state.data.settings;
  s.wallFavorites = s.wallFavorites || [];
  if (s.wallFavorites.some(x => x.url === url)) { toast('该壁纸已在收藏中'); return; }
  s.wallFavorites.unshift({ url, thumb: url, title: '收藏于 ' + new Date().toLocaleDateString() });
  s.wallFavorites = s.wallFavorites.slice(0, 12);
  persist();
  toast('已收藏当前壁纸');
}

async function downloadWallpaper() {
  const url = currentWallpaperUrl();
  if (!url) { toast('当前是内置壁纸，无需下载', 'error'); return; }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wallpaper-' + Date.now() + '.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('已开始下载当前壁纸');
  } catch { window.open(url, '_blank', 'noopener'); }
}

function openWallMenu(e) {
  const m = $('#wallMenu');
  m.innerHTML = '';
  [
    ['立即备份', () => { saveBackupNode(); toast('已创建本地备份节点'); }],
    ['编辑壁纸', () => { closePanel(); openPanel('settings'); setTimeout(() => $('#wpGrid').scrollIntoView({ block: 'center', behavior: 'smooth' }), 80); }],
    ['随机壁纸', () => randomWallpaper()],
    ['收藏当前壁纸', () => favoriteWallpaper()],
    ['下载当前壁纸', () => downloadWallpaper()],
    ['搜索图标', () => openIconFind(), 'Ctrl + F'],
  ].forEach(([label, fn, sc]) => {
    const b = document.createElement('button');
    b.innerHTML = escapeHtml(label) + (sc ? `<span class="sc">${sc}</span>` : '');
    b.addEventListener('click', () => { $('#wallMenu').hidden = true; fn(); });
    m.append(b);
  });
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
}

/* ================= 搜索图标浮层（Ctrl + F，对齐 inftab） ================= */
function openIconFind() {
  $('#iconFind').hidden = false;
  const inp = $('#iconFindInput');
  inp.value = '';
  filterCards('');
  setTimeout(() => inp.focus(), 30);
}

function closeIconFind() {
  $('#iconFind').hidden = true;
  $('#iconFindInput').value = '';
  filterCards('');
}

function filterCards(q) {
  q = q.trim().toLowerCase();
  $$('#grid .card').forEach(c => c.classList.toggle('find-hide', !!q && !c.textContent.toLowerCase().includes(q)));
}

function openGallery() {
  $('#optDailyApply').checked = !!state.data.settings.bingDaily;
  renderFavWallpapers();
  $('#dlgGallery').showModal();
  loadBingGallery();
  loadPicsumGallery();
}

function renderFavWallpapers() {
  const favs = state.data.settings.wallFavorites || [];
  $('#favSection').hidden = !favs.length;
  const box = $('#favGrid');
  box.innerHTML = '';
  favs.forEach(item => box.append(galItemEl(item)));
}

async function loadBingGallery() {
  const box = $('#bingGrid');
  box.innerHTML = '<p class="hint">加载中…</p>';
  const list = await fetchBingFeed();
  box.innerHTML = '';
  if (!list) { box.innerHTML = '<p class="hint">壁纸源加载失败，请检查网络后点击「刷新」重试</p>'; return; }
  list.slice(0, 8).forEach(item => box.append(galItemEl(item)));
}

async function loadPicsumGallery() {
  const box = $('#picsumGrid');
  box.innerHTML = '<p class="hint">加载中…</p>';
  try {
    const list = await fetchPicsum();
    box.innerHTML = '';
    if (!list.length) throw new Error('empty');
    list.forEach(item => box.append(galItemEl(item)));
  } catch {
    box.innerHTML = '<p class="hint">图片源加载失败，请检查网络后点「换一批」重试</p>';
  }
}

/** 每日自动更换：当天首次打开页面时拉取最新必应壁纸并应用 */
async function maybeAutoBingDaily() {
  const s = state.data.settings;
  if (!s.bingDaily) return;
  const today = new Date().toISOString().slice(0, 10);
  if (s.bingDate === today) return;
  s.bingDate = today;
  persistLocal();
  const list = await fetchBingFeed();
  if (!list) { s.bingDate = ''; persistLocal(); return; } // 失败明天再试
  s.customWallpaper = list[0].url;
  s.wallpaper = '';
  persist();
  applyWallpaper();
  toast('已自动更换今日必应壁纸');
}

/** 图标多源回退：依次尝试，直到拿到可用图标；全部失败则显示字母头像 */
function iconSources(site) {
  let host;
  try { host = new URL(site.url).host; } catch { return []; }
  return [
    `https://${host}/favicon.ico`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    `https://favicon.im/${host}?larger=true`,
    `https://api.iowen.cn/favicon/${host}.png`,
  ];
}

function iconHTML(site) {
  // 字母头像垫底，真实图标加载成功后盖在上面；全部源失败时移除 img 只留头像
  const ph = `<span class="ph" style="background:${tint(site.name)}">${escapeHtml((site.name || '•')[0])}</span>`;
  if (site.avatar) return ph; // 用户明确选择「纯色图标」
  if (site.icon && site.icon.startsWith('idb:')) {
    // 本地上传图标：src 由 hydrateIdbIcons 从 IndexedDB 异步填充
    return `${ph}<img data-idbkey="${escapeHtml(site.icon.slice(4))}" alt="" draggable="false">`;
  }
  if (site.icon) return `${ph}<img src="${escapeHtml(site.icon)}" alt="" loading="lazy" draggable="false">`;
  const sources = iconSources(site);
  if (!sources.length) return ph;
  return `${ph}<img src="${escapeHtml(sources[0])}" data-sources="${escapeHtml(sources.join('|'))}" alt="" loading="lazy" draggable="false">`;
}

// 本地图标 blob -> objectURL 缓存
const idbIconUrls = new Map();
async function hydrateIdbIcons(root) {
  for (const img of root.querySelectorAll('img[data-idbkey]')) {
    const key = img.dataset.idbkey;
    try {
      if (!idbIconUrls.has(key)) {
        const blob = await idbGet(key);
        if (!blob) { img.remove(); continue; }
        idbIconUrls.set(key, URL.createObjectURL(blob));
      }
      img.src = idbIconUrls.get(key);
    } catch { img.remove(); }
  }
}

function cardEl(site, idx = 0) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = site.url;
  a.target = state.data.settings.openSitesNewTab ? '_blank' : '_self';
  if (a.target === '_blank') a.rel = 'noopener';
  a.dataset.id = site.id;
  a.title = site.url;
  a.style.setProperty('--i', idx);
  const fc = state.data.settings.fontColor;
  const labelColor = fc === 'rainbow' ? tint(site.name) : (fc || '#ffffff');
  a.innerHTML = `
    <span class="icon">${iconHTML(site)}${site.badge ? '<i class="badge"></i>' : ''}
      ${state.editMode ? `<button class="del" title="删除">${SVG_X}</button>` : ''}
    </span>
    <span class="label" style="color:${labelColor}">${escapeHtml(site.name)}</span>`;

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

  // 对齐 inftab：右键图标进入编辑状态（×标记）；已在编辑状态时右键 = 直接打开编辑面板
  a.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!state.editMode) setEditMode(true);
    else openSiteDialog(site);
  });
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
  computeLayout();
  const pp = perPage();
  const total = state.data.sites.length + WIDGETS.length + (state.editMode ? 1 : 0);
  state.pages = Math.max(1, Math.ceil(total / pp));
  state.page = Math.min(state.page, state.pages - 1);

  // 第 0 页前 3 格固定为小组件（待办/笔记/天气），其余页放站点
  const start = state.page * pp - (state.page > 0 ? WIDGETS.length : 0);
  const count = pp - (state.page === 0 ? WIDGETS.length : 0);
  const slice = state.data.sites.slice(start, start + count);
  grid.style.setProperty('--cols', state.layout.cols);
  grid.style.setProperty('--card', state.layout.card + 'px');
  grid.classList.toggle('editing', state.editMode);
  grid.classList.toggle('hide-labels', !!state.data.settings.hideIconName);
  grid.innerHTML = '';
  if (!slice.length && state.page === 0 && !state.editMode) {
    grid.innerHTML = '<p class="empty-tip">这里空空如也，点击右上角菜单 → 「添加网址」开始使用</p>';
  } else {
    if (state.page === 0) WIDGETS.forEach(w => grid.append(widgetEl(w)));
    slice.forEach((s, i) => grid.append(cardEl(s, i + WIDGETS.length)));
    if (state.editMode && state.page === 0) grid.append(addCardEl());
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

  hydrateIdbIcons(grid);
}

function renderAll() {
  renderTypeTabs();
  updateSearchUI();
  applyWallpaper();
  applyAppearance();
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
  state.data.sites = state.data.sites.filter(s => s.id !== site.id);
  persist();
  renderGrid();
  toast(`已删除「${site.name}」`);
}

/* ================= 编辑图标侧边面板（对齐 inftab） ================= */
function openSiteDialog(site) {
  state.editingId = site ? site.id : null;
  $('#editDlgTitle').textContent = site ? '编辑图标' : '添加图标';
  $('#editUrl').value = site ? site.url : '';
  $('#editName').value = site ? site.name : '';
  $('#editFormError').hidden = true;
  if (site && site.icon && site.icon.startsWith('idb:')) Object.assign(editIcon, { mode: 'idb', url: '', idbKey: site.icon.slice(4) });
  else if (site && site.icon) Object.assign(editIcon, { mode: 'url', url: site.icon, idbKey: '' });
  else Object.assign(editIcon, { mode: 'auto', url: '', idbKey: '' });
  renderIconPick();
  $('#editMask').hidden = false;
  $('#editPanel').hidden = false;
  $('#editUrl').focus();
}

function closeSiteDialog() {
  $('#editMask').hidden = true;
  $('#editPanel').hidden = true;
}

// 面板打开期间的图标选择状态：auto=自动获取 / avatar=纯色图标 / url=候选图标 / idb=本地上传
const editIcon = { mode: 'auto', url: '', idbKey: '' };

function pickSite() {
  return state.editingId ? state.data.sites.find(s => s.id === state.editingId) : null;
}

function renderIconPick() {
  const site = pickSite();
  const box = $('#iconPick');
  box.innerHTML = '';
  const tile = (label, inner) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.innerHTML = `<span class="pick-img">${inner}</span><span class="pick-cap">${label}</span>`;
    box.append(b);
    return b;
  };
  const markOn = (el, removable) => {
    el.classList.add('on');
    if (!removable) return;
    const x = document.createElement('i');
    x.className = 'pick-x';
    x.title = '移除该图标，恢复自动获取';
    x.textContent = '×';
    x.addEventListener('click', e => {
      e.stopPropagation();
      Object.assign(editIcon, { mode: 'auto', url: '', idbKey: '' });
      renderIconPick();
    });
    el.append(x);
  };
  // 纯色图标：名称前两字色块（对齐 inftab）
  const name = $('#editName').value.trim() || (site ? site.name : '');
  const av = tile('纯色图标', `<span class="ph-tile" style="background:${tint(name)}">${escapeHtml(name.slice(0, 2) || '•')}</span>`);
  av.addEventListener('click', () => { Object.assign(editIcon, { mode: 'avatar', url: '', idbKey: '' }); renderIconPick(); });
  if (editIcon.mode === 'avatar') markOn(av, false);
  // 自动抓取的候选图标：图标01 / 图标02（选境内可达的源，避免候选空白）
  const sources = site ? iconSources(site) : [];
  [sources[0], sources[3]].filter(Boolean).forEach((src, i) => {
    const b = tile(`图标0${i + 1}`, `<img src="${escapeHtml(src)}" alt="" draggable="false">`);
    b.addEventListener('click', () => { Object.assign(editIcon, { mode: 'url', url: src, idbKey: '' }); renderIconPick(); });
    if (editIcon.mode === 'url' && editIcon.url === src) markOn(b, true);
  });
  // 本地图标：展示当前上传图标；点击可上传/更换
  const local = tile('本地图标', '<span class="pick-plus">＋</span>');
  local.addEventListener('click', () => $('#iconFile').click());
  if (editIcon.mode === 'idb') {
    markOn(local, true);
    idbGet(editIcon.idbKey).then(blob => {
      if (!blob) return;
      if (!idbIconUrls.has(editIcon.idbKey)) idbIconUrls.set(editIcon.idbKey, URL.createObjectURL(blob));
      const img = local.querySelector('.pick-img');
      if (img) img.innerHTML = `<img src="${idbIconUrls.get(editIcon.idbKey)}" alt="" draggable="false">`;
    }).catch(() => {});
  }
}

function saveSiteDialog() {
  const name = $('#editName').value.trim();
  const url = normalizeUrl($('#editUrl').value);
  const err = $('#editFormError');
  if (!name || !url) {
    err.textContent = !name ? '请填写名称' : '请填写有效的网址';
    err.hidden = false;
    return;
  }
  const icon = editIcon.mode === 'url' ? editIcon.url : (editIcon.mode === 'idb' ? 'idb:' + editIcon.idbKey : '');
  const avatar = editIcon.mode === 'avatar';
  if (state.editingId) {
    const site = pickSite();
    if (site) Object.assign(site, { name, url, icon, avatar });
  } else {
    state.data.sites.push({ id: uid(), name, url, icon, avatar, badge: false });
  }
  persist();
  closeSiteDialog();
  renderGrid();
  toast('已保存');
}

function bindSitePanel() {
  $('#editOk').addEventListener('click', saveSiteDialog);
  $('#editCancel').addEventListener('click', closeSiteDialog);
  $('#editPanelClose').addEventListener('click', closeSiteDialog);
  $('#editMask').addEventListener('click', closeSiteDialog);
  // 名称变化时同步纯色图标文字与配色
  $('#editName').addEventListener('input', () => { if (editIcon.mode === 'avatar') renderIconPick(); });
  $('#iconFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('图标图片请小于 2MB', 'error'); return; }
    const key = 'icon-' + Date.now();
    try {
      await idbPut(key, f);
      Object.assign(editIcon, { mode: 'idb', url: '', idbKey: key });
      renderIconPick();
    } catch { toast('图标保存失败', 'error'); }
  });
}

function applyAppearance() {
  const s = state.data.settings;
  const root = document.documentElement.style;
  root.setProperty('--search-w', `min(${Math.round(560 * s.searchScale / 100)}px, 90vw)`);
  root.setProperty('--search-radius', Math.round(44 * s.searchRadius / 100) + 'px');
  root.setProperty('--search-alpha', (s.searchOpacity / 100).toFixed(2));
  root.setProperty('--label-size', s.fontSize + 'px');
  root.setProperty('--label-shadow', s.fontShadow ? '0 1px 5px rgba(0,0,0,.45)' : 'none');
  root.setProperty('--icon-scale-factor', (s.iconScale / 71).toFixed(3));
  root.setProperty('--icon-radius-pct', s.iconRadius);
  root.setProperty('--icon-opacity', (s.iconOpacity / 100).toFixed(2));
  $('.stage').style.zoom = s.pageScale / 100;
  // 遮罩强度：滑杆 0 时也保留 35% 基础遮罩，保证亮色壁纸上文字可读
  $('.wallpaper-mask').style.opacity = (0.35 + 0.65 * s.wallOpacity / 100).toFixed(2);
  const wp = $('#wallpaper');
  wp.style.filter = s.wallBlur > 0 ? 'blur(' + s.wallBlur + 'px)' : '';
  wp.style.transform = s.wallBlur > 0 ? 'scale(' + (1 + s.wallBlur / 150).toFixed(3) + ')' : '';

  const grid = $('#grid');
  grid.dataset.easing = s.animEasing;
  $('#searchBtn').hidden = s.searchHideBtn;
  $('#logo').style.display = s.hideWindmill ? 'none' : '';
  grid.classList.toggle('hide-labels', !!s.hideIconName);
  grid.classList.toggle('no-icon-shadow', !s.iconShadow);
  grid.classList.toggle('icon-intro', !!s.iconIntro);
  $('#gridArea').classList.toggle('show-page-btns', !!s.showPageBtns);
  $('#searchArea').style.display = s.searchHide ? 'none' : '';
  $('#engineTabs').style.display = s.searchHideType ? 'none' : '';
  $('#btnRandomWall').hidden = !s.showRandomWallBtn;
}

function fillSettingsPane() {
  const s = state.data.settings;
  $('#tgSitesNewTab').checked = s.openSitesNewTab;
  $('#tgSearchNewTab').checked = s.openSearchNewTab;
  $('#rgScale').value = s.pageScale;
  $('#rgScaleVal').textContent = s.pageScale + '%';
  $('#tgRandomWall').checked = s.showRandomWallBtn;
  $('#tgPageBtns').checked = s.showPageBtns;
  renderLayoutPresets();
  $('#tgHideName').checked = s.hideIconName;
  $('#tgIconShadow').checked = s.iconShadow;
  $('#tgIconIntro').checked = s.iconIntro;
  $('#rgIconRadius').value = s.iconRadius;
  $('#rgIconRadiusVal').textContent = s.iconRadius + '%';
  $('#rgIconOpacity').value = s.iconOpacity;
  $('#rgIconOpacityVal').textContent = s.iconOpacity + '%';
  $('#rgIconScale').value = s.iconScale;
  $('#rgIconScaleVal').textContent = s.iconScale + '%';
  $('#tgSearchHide').checked = s.searchHide;
  $('#tgSuggest').checked = s.searchSuggest;
  $('#tgKeepText').checked = s.keepSearchText;
  $('#tgHideType').checked = s.searchHideType;
  $('#rgSearchSize').value = s.searchScale;
  $('#rgSearchSizeVal').textContent = s.searchScale + '%';
  $('#rgSearchRadius').value = s.searchRadius;
  $('#rgSearchRadiusVal').textContent = s.searchRadius + '%';
  $('#rgSearchOpacity').value = s.searchOpacity;
  $('#rgSearchOpacityVal').textContent = s.searchOpacity + '%';
  $('#tgFontShadow').checked = s.fontShadow;
  $('#rgFontSize').value = s.fontSize;
  $('#rgFontSizeVal').textContent = String(s.fontSize);
  $('#tgHideSearchBtn').checked = s.searchHideBtn;
  $('#tgTodoBadge').checked = s.showTodoBadge;
  $('#tgHideWindmill').checked = s.hideWindmill;
  renderEaseCards();
  $('#rgWallOpacity').value = s.wallOpacity;
  $('#rgWallOpacityVal').textContent = s.wallOpacity + '%';
  $('#rgWallBlur').value = s.wallBlur;
  $('#rgWallBlurVal').textContent = String(s.wallBlur);
  renderSwatches();
  renderWpGrid();
  renderEngineList();
  $('#wpUrl').value = s.customWallpaper || '';
  $('#optBingDaily').checked = !!s.bingDaily;
  $$('.range-row input').forEach(updateRangeFill);
}

/** 打开侧边面板（三 tab：添加 / 我的 / 设置），对齐 inftab 汉堡交互 */
function openPanel(tab) {
  $('#dirMask').hidden = false;
  $('#sidePanel').hidden = false;
  $$('.sp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.sp-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
  if (tab === 'settings') fillSettingsPane();
  if (tab === 'mine') { fillSyncDialog(); renderBackups(); }
  if (tab === 'add') { renderDirCats(); renderDirList(); }
}

/* ---------- 布局预设 ---------- */
const LAYOUT_PRESETS = [['auto', '自动', 0, 0], ['2x4', null, 2, 4], ['2x5', null, 2, 5], ['2x6', null, 2, 6], ['2x7', null, 2, 7], ['3x3', null, 3, 3], ['custom', '自定义', 0, 0]];

function renderLayoutPresets() {
  const lay = state.data.settings.layout;
  const box = $('#layoutPresets');
  box.innerHTML = '';
  LAYOUT_PRESETS.forEach(([label, name, row, col]) => {
    const isCustom = label === 'custom';
    const isAuto = label === 'auto';
    const active = isAuto ? lay.mode === 'auto'
      : isCustom ? lay.mode === 'fixed'
        : lay.mode === 'fixed' && lay.row === row && lay.col === col;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lp-btn' + (active ? ' active' : '');
    const mini = document.createElement('span');
    mini.className = 'lp-mini';
    if (isAuto) {
      mini.style.display = 'grid';
      mini.style.placeItems = 'center';
      mini.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="20" fill="none" stroke="#9aa0a6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>';
    } else if (isCustom) {
      mini.style.display = 'grid';
      mini.style.placeItems = 'center';
      mini.innerHTML = '<b style="font-size:12px;color:#555">' + lay.row + 'x' + lay.col + '</b>';
    } else {
      mini.style.gridTemplateColumns = 'repeat(' + col + ', 1fr)';
      mini.style.gridTemplateRows = 'repeat(' + row + ', 1fr)';
      const cells = row * col;
      for (let i = 0; i < cells; i++) mini.append(document.createElement('i'));
    }
    b.append(mini);
    const cap = document.createElement('span');
    cap.className = 'lp-name';
    cap.textContent = isAuto ? '自动' : isCustom ? '自定义(' + lay.row + 'x' + lay.col + ')' : label;
    b.append(cap);
    b.onclick = () => {
      if (isAuto) lay.mode = 'auto';
      else { lay.mode = 'fixed'; if (!isCustom) { lay.row = row; lay.col = col; } }
      state.page = 0;
      persist();
      applyAppearance();
      renderGrid();
      renderLayoutPresets();
    };
    box.append(b);
  });
}

/* ---------- 字体颜色色板 ---------- */
const FONT_COLORS = ['#ffffff', '#dddddd', '#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', 'rainbow'];

function renderSwatches() {
  const box = $('#fontSwatches');
  box.innerHTML = '';
  const cur = state.data.settings.fontColor;
  FONT_COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (c === 'rainbow' ? ' rainbow' : '') + (cur === c ? ' active' : '');
    if (c !== 'rainbow') b.style.background = c;
    b.title = c === 'rainbow' ? '彩色（每个图标随机配色）' : c;
    b.onclick = () => {
      state.data.settings.fontColor = c;
      persist();
      renderSwatches();
      renderGrid();
    };
    box.append(b);
  });
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
      persist();
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
    b.innerHTML = engineGlyphHTML(e) + `<span class="eng-name">${escapeHtml(e.name)}</span>`;
    b.onclick = () => {
      state.data.settings.engine = e.id;
      persist();
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

function engineGlyphHTML(eng) {
  const glyph = `<span class="eng-glyph" style="background:${eng.color || tint(eng.name)}">${escapeHtml(eng.glyph || (eng.name || '?')[0])}</span>`;
  let host = '';
  try { host = new URL(eng.urls.html).host; } catch { return glyph; }
  const sources = [
    `https://${host}/favicon.ico`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  ].map(u => escapeHtml(u)).join('|');
  return `${glyph}<img src="${(sources.split('|'))[0]}" data-sources="${sources}" alt="" loading="lazy">`;
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

let sugSeq = 0;

async function fetchSug(q) {
  const seq = ++sugSeq;
  const data = await jsonp(
    `https://www.baidu.com/sugrec?pre=1&p=3&ie=UTF-8&json=1&prod=pc&from=pc_web&wd=${encodeURIComponent(q)}`,
    '__navSugCb'
  );
  if (seq !== sugSeq) return; // 已有更新的请求，丢弃过期结果
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
  if (state.data.settings.openSearchNewTab) window.open(target, '_blank');
  else location.href = target;
  if (!state.data.settings.keepSearchText) $('#searchInput').value = '';
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

/* ================= 顶部按钮事件（汉堡直接弹出设置抽屉，对齐 inftab） ================= */
function bindTopMenu() {
  $('#btnMenu').addEventListener('click', e => { e.stopPropagation(); openPanel('add'); });
  $('#logo').addEventListener('click', () => $('#dlgAbout').showModal());
  $('#btnRandomWall').addEventListener('click', () => randomWallpaper());

  document.addEventListener('click', e => {
    if (!$('#engineMenu').hidden && !$('#engineMenu').contains(e.target) && !$('#engineLogo').contains(e.target)) toggleEngineMenu(false);
    if (!$('#wallMenu').hidden && !$('#wallMenu').contains(e.target)) $('#wallMenu').hidden = true;
    // 对齐 inftab：编辑状态下点击其他地方（非图标/面板/控件）即退出编辑
    if (state.editMode && !e.target.closest('.card, .edit-panel, #dirMask, #sidePanel, dialog, .dots, .round-btn, #btnMenu, #logo, .iconfind-mask')) setEditMode(false);
  });
  // 对齐 inftab：右键空白处弹出壁纸菜单（图标上的右键在 cardEl 内处理）
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.card, .edit-panel, #sidePanel, dialog, input, textarea, select, .engine-menu, .sug-drop, .dir-card')) return;
    e.preventDefault();
    if (state.editMode) return;
    openWallMenu(e);
  });
  addEventListener('blur', () => { toggleEngineMenu(false); $('#wallMenu').hidden = true; });
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
      persist();
      applyWallpaper();
    });
    grid.append(b);
  });
}

function updateRangeFill(el) {
  const p = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.setProperty('--p', p.toFixed(1) + '%');
}

function closePanel() {
  $('#dirMask').hidden = true;
  $('#sidePanel').hidden = true;
}

function setEditMode(on) {
  if (state.editMode === on) return;
  state.editMode = on;
  const b = $('#actEdit');
  b.classList.toggle('on', on);
  b.textContent = on ? '退出编辑' : '编辑模式';
  renderGrid();
}

function toggleEditMode() {
  setEditMode(!state.editMode);
}

function bindSettingsDialog() {
  // 三个 tab 切换
  $$('.sp-tab').forEach(t => t.addEventListener('click', () => openPanel(t.dataset.tab)));
  // 抽屉快捷操作区
  $('#actEdit').addEventListener('click', toggleEditMode);
  $('#actImport').addEventListener('click', () => $('#importFile').click());
  $('#actAddCustom').addEventListener('click', () => openSiteDialog(null));
  $('#actExport').addEventListener('click', exportData);
  $('#actLoad').addEventListener('click', loadDefaultData);
  // 关于入口保留在右下角风车
  // 设置抽屉：分区折叠/展开
  $('#sidePanel').addEventListener('click', e => {
    const head = e.target.closest('.set-head');
    if (!head) return;
    const card = head.closest('.set-card');
    card.classList.toggle('collapsed');
    head.querySelector('.cl').textContent = card.classList.contains('collapsed') ? '+' : '—';
  });
  $('#spClose').addEventListener('click', closePanel);
  $('#dirMask').addEventListener('click', closePanel);
  $('#btnAddEngine').addEventListener('click', () => openEngineDialog(null));
  $('#btnGallery').addEventListener('click', openGallery);
  $('#bingRefresh').addEventListener('click', loadBingGallery);
  $('#picsumRefresh').addEventListener('click', loadPicsumGallery);
  $('#optDailyApply').addEventListener('change', e => {
    state.data.settings.bingDaily = e.target.checked;
    $('#optBingDaily').checked = e.target.checked;
    persist();
    toast(e.target.checked ? '已开启每日自动更换必应壁纸' : '已关闭每日自动更换');
  });
  $('#optBingDaily').addEventListener('change', e => {
    state.data.settings.bingDaily = e.target.checked;
    $('#optDailyApply').checked = e.target.checked;
    persist();
  });

  // 通用绑定：开关即时生效
  const bind = (id, key, apply) => {
    $('#' + id).addEventListener('change', e => {
      state.data.settings[key] = e.target.checked;
      if (apply) apply();
      persist();
    });
  };
  // 滑杆即时生效（拖动过程写 localStorage，云同步由防抖兜底）
  const bindRange = (id, valId, key, apply, suffix = '%') => {
    const el = $('#' + id);
    el.addEventListener('input', () => {
      state.data.settings[key] = parseInt(el.value, 10);
      $('#' + valId).textContent = el.value + suffix;
      updateRangeFill(el);
      if (apply) apply();
      persistLocal();
    });
  };
  bind('tgSitesNewTab', 'openSitesNewTab', renderGrid);
  bind('tgSearchNewTab', 'openSearchNewTab');
  bindRange('rgScale', 'rgScaleVal', 'pageScale', applyAppearance);
  bind('tgRandomWall', 'showRandomWallBtn', applyAppearance);
  bind('tgPageBtns', 'showPageBtns', applyAppearance);
  bind('tgHideName', 'hideIconName', renderGrid);
  bind('tgIconShadow', 'iconShadow', applyAppearance);
  bind('tgIconIntro', 'iconIntro', renderGrid);
  bindRange('rgIconRadius', 'rgIconRadiusVal', 'iconRadius', applyAppearance);
  bindRange('rgIconOpacity', 'rgIconOpacityVal', 'iconOpacity', applyAppearance);
  bindRange('rgIconScale', 'rgIconScaleVal', 'iconScale', applyAppearance);
  bind('tgSearchHide', 'searchHide', applyAppearance);
  bind('tgSuggest', 'searchSuggest');
  bind('tgKeepText', 'keepSearchText');
  bind('tgHideType', 'searchHideType', applyAppearance);
  bindRange('rgSearchSize', 'rgSearchSizeVal', 'searchScale', applyAppearance);
  bindRange('rgSearchRadius', 'rgSearchRadiusVal', 'searchRadius', applyAppearance);
  bindRange('rgSearchOpacity', 'rgSearchOpacityVal', 'searchOpacity', applyAppearance);
  bind('tgFontShadow', 'fontShadow', renderGrid);
  bindRange('rgFontSize', 'rgFontSizeVal', 'fontSize', renderGrid, '');
  bind('tgHideSearchBtn', 'searchHideBtn', applyAppearance);
  bind('tgTodoBadge', 'showTodoBadge', renderGrid);
  bind('tgHideWindmill', 'hideWindmill', applyAppearance);
  bindRange('rgWallOpacity', 'rgWallOpacityVal', 'wallOpacity', applyAppearance);
  bindRange('rgWallBlur', 'rgWallBlurVal', 'wallBlur', applyAppearance);
  $('#wallFile').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast('图片过大（超过 4MB），请压缩后再试', 'error'); return; }
    idbPut('wallpaper', f).then(() => {
      const s = state.data.settings;
      s.wallpaper = 'upload';
      s.customWallpaper = '';
      persist();
      applyWallpaper();
      applyWallpaperUpload();
      toast('已应用本地图片壁纸');
    }).catch(() => toast('保存失败，请重试', 'error'));
  });

  // 壁纸与高级（失焦/回车保存）
  $('#wpUrl').addEventListener('change', e => {
    state.data.settings.customWallpaper = e.target.value.trim();
    persist();
    applyWallpaper();
    renderWpGrid();
  });

  // 还原设置
  $('#btnResetSettings').addEventListener('click', () => {
    if (!confirm('恢复默认设置？网址与云同步配置会保留。')) return;
    saveBackupNode();
    const cur = state.data.settings;
    const keepSync = cur.sync;
    state.data.settings = { ...seedSettings(), sync: keepSync, todo: cur.todo, note: cur.note, weatherCity: cur.weatherCity };
    state.page = 0;
    persist();
    renderAll();
    openPanel('settings');
    toast('已还原默认设置');
  });
}

/* ---------- 动画效果缩略卡（默认 / 回弹 / 淡入） ---------- */
const EASE_PRESETS = [
  { id: 'default', name: '默认' },
  { id: 'spring', name: '回弹' },
  { id: 'fade', name: '淡入' },
];

function renderEaseCards() {
  const box = $('#easeCards');
  const cur = state.data.settings.animEasing;
  box.innerHTML = '';
  EASE_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ease-card' + (cur === p.id ? ' active' : '');
    const demo = document.createElement('span');
    demo.className = 'ease-demo ' + p.id;
    demo.innerHTML = '<i></i>';
    b.append(demo);
    const cap = document.createElement('span');
    cap.className = 'ease-name';
    cap.textContent = p.name;
    b.append(cap);
    b.onclick = () => {
      state.data.settings.animEasing = p.id;
      persist();
      renderGrid();
      renderEaseCards();
    };
    box.append(b);
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
  $('#syncTimeText').textContent = s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : '从未';
  renderBackups();
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

function renderBackups() {
  const list = $('#backupList');
  const arr = getBackups();
  list.innerHTML = '';
  if (!arr.length) { list.innerHTML = '<li><span class="bt">暂无备份节点</span></li>'; return; }
  arr.forEach((b, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="bt">' + new Date(b.t).toLocaleString() + '</span>' +
      '<button type="button" class="btn">恢复</button><button type="button" class="btn">删除</button>';
    const [btnRestore, btnDel] = li.querySelectorAll('button');
    btnRestore.addEventListener('click', () => restoreBackup(i));
    btnDel.addEventListener('click', () => {
      const arr2 = getBackups(); arr2.splice(i, 1);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr2));
      renderBackups();
    });
    list.append(li);
  });
}

function restoreBackup(i) {
  const arr = getBackups();
  const b = arr[i];
  if (!b) return;
  if (!confirm('恢复到 ' + new Date(b.t).toLocaleString() + ' 的备份？当前数据会被覆盖。')) return;
  saveBackupNode();
  const keepSync = state.data.settings.sync;
  state.data = {
    version: 1,
    sites: (b.payload.sites || []).map(s => ({
      id: s.id || uid(), name: String(s.name || ''), url: String(s.url || ''),
      icon: s.icon || '', avatar: !!s.avatar, badge: !!s.badge,
    })),
    settings: { ...normalizeSettings(b.payload.settings || {}), sync: keepSync },
  };
  state.page = 0;
  persist();
  renderAll();
  renderBackups();
  toast('已恢复到 ' + new Date(b.t).toLocaleString());
}

function bindSyncDialog() {
  $('#btnBackupNow').addEventListener('click', () => {
    saveBackupNode();
    renderBackups();
    toast('已创建备份节点');
  });
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
        state.data = {
          version: 1,
          sites: payload.sites.map(s => ({
            id: s.id || uid(), name: String(s.name || ''), url: String(s.url || ''),
            icon: s.icon || '', avatar: !!s.avatar, badge: !!s.badge,
          })),
          settings: { ...normalizeSettings(payload.settings || {}), sync: keepSync },
        };
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

  bindSitePanel();
  bindSettingsDialog();
  bindEngineDialog();
  bindSyncDialog();
  bindImport();
  bindTodo();
  bindNote();
  bindWeather();
  bindDirectory();

  // 壁纸为本地图片时从 IndexedDB 恢复显示
  applyWallpaperUpload();

  // 图标源失败时自动切换到下一个源，全部失败才显示字母头像（事件捕获处理 img error）
  $('#grid').addEventListener('error', e => {
    if (e.target.tagName === 'IMG') advanceIcon(e.target);
  }, true);
  $('#dirList').addEventListener('error', e => {
    if (e.target.tagName === 'IMG') advanceIcon(e.target);
  }, true);
  $('#engineMenu').addEventListener('error', e => {
    if (e.target.tagName === 'IMG') advanceIcon(e.target);
  }, true);

  // dialog：点击遮罩或 × 关闭
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  });

  // 键盘
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { toggleEngineMenu(false); hideSug(); closePanel(); closeSiteDialog(); closeIconFind(); $('#wallMenu').hidden = true; }
    const tag = document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if ((e.key === '/' && !typing) || (e.ctrlKey && e.key.toLowerCase() === 'k' && !typing)) {
      e.preventDefault();
      $('#searchInput').focus();
      $('#searchInput').select();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f' && !typing) {
      e.preventDefault();
      openIconFind();
    }
    if (!typing && $('#iconFind').hidden) {
      if (e.key === 'ArrowRight') flipPage(1);
      if (e.key === 'ArrowLeft') flipPage(-1);
    }
  });

  // 搜索图标浮层
  $('#iconFindInput').addEventListener('input', e => filterCards(e.target.value));
  $('#iconFindInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#grid .card:not(.find-hide)');
    if (first) { closeIconFind(); first.click(); }
  });
  $('#iconFind').addEventListener('click', e => { if (e.target === e.currentTarget) closeIconFind(); });

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

/* ================= 小组件：待办 / 笔记 / 天气 ================= */
const WIDGETS = [
  { id: 'todo', name: '待办事项' },
  { id: 'note', name: '笔记' },
  { id: 'weather', name: '天气' },
];

const SVG_TODO = '<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
const SVG_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6a157" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
const SVG_CLOUD = '<svg viewBox="0 0 24 24" fill="#5aa2ff" stroke="none"><path d="M18.4 10.6a6 6 0 00-11.3-2A5 5 0 006 18.5h12a4 4 0 00.4-7.9z"/></svg>';

const todoUndone = () => state.data.settings.todo.items.filter(t => !t.done).length;

function widgetEl(w) {
  const a = document.createElement('a');
  a.className = 'card widget';
  a.dataset.widget = w.id;
  // 与站点图标一致：右键小组件进入编辑状态
  a.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!state.editMode) setEditMode(true);
  });
  let inner = '';
  if (w.id === 'todo') {
    const n = state.data.settings.showTodoBadge ? todoUndone() : 0;
    inner = `<span class="icon">${SVG_TODO}${n ? '<i class="count-badge">' + (n > 99 ? '99+' : n) + '</i>' : ''}</span><span class="label">待办事项</span>`;
    a.addEventListener('click', e => { e.preventDefault(); openTodo(); });
  } else if (w.id === 'note') {
    inner = `<span class="icon">${SVG_NOTE}</span><span class="label">笔记</span>`;
    a.addEventListener('click', e => { e.preventDefault(); openNote(); });
  } else {
    const t = state.data.settings.weatherCache;
    inner = `<span class="icon">${SVG_CLOUD}</span><span class="label">${t && t.t !== '' ? t.t + '°C' : '天气'}</span>`;
    a.addEventListener('click', e => { e.preventDefault(); openWeather(); });
  }
  a.innerHTML = inner;
  return a;
}

/* ---------- 待办事项 ---------- */
function openTodo() { renderTodoList(); $('#dlgTodo').showModal(); }

function renderTodoList() {
  const items = state.data.settings.todo.items;
  const list = $('#todoList');
  list.innerHTML = '';
  $('#todoEmpty').hidden = items.length > 0;
  items.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = t.done ? 'done' : '';
    li.innerHTML = `<input type="checkbox" ${t.done ? 'checked' : ''}><span class="t">${escapeHtml(t.text)}</span><button type="button" class="del" title="删除">${SVG_X}</button>`;
    li.querySelector('input').addEventListener('change', e => {
      t.done = e.target.checked;
      persist();
      renderTodoList();
      renderGrid();
    });
    li.querySelector('.del').addEventListener('click', () => {
      items.splice(i, 1);
      persist();
      renderTodoList();
      renderGrid();
    });
    list.append(li);
  });
}

function bindTodo() {
  $('#todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#todoInput').value.trim();
    if (!text) return;
    state.data.settings.todo.items.push({ id: uid(), text, done: false });
    $('#todoInput').value = '';
    persist();
    renderTodoList();
    renderGrid();
  });
  $('#todoClear').addEventListener('click', () => {
    const s = state.data.settings.todo;
    s.items = s.items.filter(t => !t.done);
    persist();
    renderTodoList();
    renderGrid();
  });
}

/* ---------- 笔记 ---------- */
function openNote() {
  $('#noteText').value = state.data.settings.note || '';
  $('#noteSaved').textContent = '';
  $('#dlgNote').showModal();
}

function bindNote() {
  const ta = $('#noteText');
  const save = debounce(() => {
    state.data.settings.note = ta.value;
    persistLocal();
    $('#noteSaved').textContent = '已自动保存 ' + new Date().toLocaleTimeString();
  }, 500);
  ta.addEventListener('input', save);
}

/* ---------- 天气（Open-Meteo 免密钥） ---------- */
const WMO = { 0: '晴', 1: '基本晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪', 95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '雷阵雨伴冰雹' };
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

async function loadWeather(city) {
  const enc = encodeURIComponent(city);
  const geo = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${enc}&count=1&language=zh&format=json`);
  const g = geo && geo.results && geo.results[0];
  if (!g) throw new Error('未找到城市「' + city + '」');
  const w = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`);
  const cur = w.current || {};
  const info = {
    city, t: Math.round(cur.temperature_2m), desc: WMO[cur.weather_code] || '—',
    days: (w.daily && w.daily.time ? w.daily.time : []).map((d, i) => ({
      d: DAY_NAMES[new Date(d).getDay()],
      w: WMO[w.daily.weather_code[i]] || '—',
      t: Math.round(w.daily.temperature_2m_min[i]) + '~' + Math.round(w.daily.temperature_2m_max[i]) + '°',
    })),
    at: Date.now(),
  };
  state.data.settings.weatherCache = info;
  persistLocal();
  updateWeatherLabel();
  renderWeatherDlg(info);
}

function updateWeatherLabel() {
  const c = state.data.settings.weatherCache;
  const label = $('#grid [data-widget=weather] .label');
  if (label && c && c.t !== undefined) label.textContent = c.t + '°C';
}

function openWeather() {
  const s = state.data.settings;
  $('#wtCity').value = s.weatherCity;
  const cache = s.weatherCache;
  if (cache && cache.days) renderWeatherDlg(cache);
  else { $('#wtTemp').textContent = '--'; $('#wtDesc').textContent = '加载中…'; }
  loadWeather(s.weatherCity)
    .catch(e => { $('#wtDesc').textContent = '天气获取失败：' + e.message; });
}

function renderWeatherDlg(info) {
  $('#wtTemp').textContent = info.t + '°C';
  $('#wtDesc').textContent = info.city + ' · ' + info.desc;
  $('#wtDays').innerHTML = (info.days || []).map(d =>
    `<div class="wt-day"><div class="d">${escapeHtml(d.d)}</div><div class="t">${escapeHtml(d.t)}</div><div class="w">${escapeHtml(d.w)}</div></div>`).join('');
}

function bindWeather() {
  $('#wtChange').addEventListener('click', () => {
    const city = $('#wtCity').value.trim();
    if (!city) return;
    state.data.settings.weatherCity = city;
    persist();
    $('#wtDesc').textContent = '加载中…';
    loadWeather(city).catch(e => toast('天气获取失败：' + e.message, 'error'));
  });
}

/* ================= 网站目录（本地内置，对齐 inftab 图标库） ================= */
const SITE_DIRECTORY = [
  { cat: '常用推荐', sites: [['百度', 'https://www.baidu.com'], ['淘宝', 'https://www.taobao.com'], ['京东', 'https://www.jd.com'], ['哔哩哔哩', 'https://www.bilibili.com'], ['微博', 'https://weibo.com'], ['知乎', 'https://www.zhihu.com'], ['抖音', 'https://www.douyin.com'], ['小红书', 'https://www.xiaohongshu.com'], ['网易云音乐', 'https://music.163.com'], ['腾讯视频', 'https://v.qq.com'], ['爱奇艺', 'https://www.iqiyi.com'], ['拼多多', 'https://www.pinduoduo.com']] },
  { cat: '新闻资讯', sites: [['澎湃新闻', 'https://www.thepaper.cn'], ['IT之家', 'https://www.ithome.com'], ['少数派', 'https://sspai.com'], ['蓝点网', 'https://www.landiannews.com'], ['新浪新闻', 'https://news.sina.com.cn'], ['腾讯新闻', 'https://news.qq.com'], ['网易新闻', 'https://news.163.com'], ['人民网', 'http://www.people.com.cn'], ['新华网', 'http://www.news.cn'], ['界面新闻', 'https://www.jiemian.com']] },
  { cat: '购物', sites: [['天猫', 'https://www.tmall.com'], ['唯品会', 'https://www.vip.com'], ['苏宁易购', 'https://www.suning.com'], ['闲鱼', 'https://www.goofish.com'], ['网易严选', 'https://you.163.com'], ['小米商城', 'https://www.mi.com'], ['华为商城', 'https://www.vmall.com']] },
  { cat: '社交博客', sites: [['豆瓣', 'https://www.douban.com'], ['V2EX', 'https://www.v2ex.com'], ['百度贴吧', 'https://tieba.baidu.com'], ['QQ空间', 'https://qzone.qq.com'], ['X (Twitter)', 'https://x.com'], ['Instagram', 'https://www.instagram.com'], ['Reddit', 'https://www.reddit.com'], ['即刻', 'https://web.okjike.com']] },
  { cat: '影视视频', sites: [['优酷', 'https://www.youku.com'], ['芒果TV', 'https://www.mgtv.com'], ['搜狐视频', 'https://tv.sohu.com'], ['YouTube', 'https://www.youtube.com'], ['Netflix', 'https://www.netflix.com'], ['Twitch', 'https://www.twitch.tv'], ['西瓜视频', 'https://www.ixigua.com'], ['斗鱼', 'https://www.douyu.com']] },
  { cat: '音乐', sites: [['QQ音乐', 'https://y.qq.com'], ['酷狗音乐', 'https://www.kugou.com'], ['咪咕音乐', 'https://music.migu.cn'], ['Spotify', 'https://open.spotify.com'], ['Apple Music', 'https://music.apple.com'], ['汽水音乐', 'https://qishui.douyin.com']] },
  { cat: '学习教育', sites: [['中国大学MOOC', 'https://www.icourse163.org'], ['学堂在线', 'https://www.xuetangx.com'], ['网易公开课', 'https://open.163.com'], ['Coursera', 'https://www.coursera.org'], ['可汗学院', 'https://zh.khanacademy.org'], ['LeetCode', 'https://leetcode.cn'], ['牛客网', 'https://www.nowcoder.com'], ['多邻国', 'https://www.duolingo.cn']] },
  { cat: '开发工具', sites: [['GitHub', 'https://github.com'], ['Gitee', 'https://gitee.com'], ['Stack Overflow', 'https://stackoverflow.com'], ['MDN', 'https://developer.mozilla.org'], ['掘金', 'https://juejin.cn'], ['CSDN', 'https://www.csdn.net'], ['博客园', 'https://www.cnblogs.com'], ['开源中国', 'https://www.oschina.net'], ['npm', 'https://www.npmjs.com'], ['Can I use', 'https://caniuse.com'], ['菜鸟教程', 'https://www.runoob.com'], ['JSON解析', 'https://www.json.cn']] },
  { cat: '设计创意', sites: [['稿定设计', 'https://www.gaoding.com'], ['Canva', 'https://www.canva.cn'], ['Figma', 'https://www.figma.com'], ['Dribbble', 'https://dribbble.com'], ['Behance', 'https://www.behance.net'], ['removebg', 'https://www.remove.bg'], ['TinyPNG', 'https://tinypng.com'], ['Iconfont', 'https://www.iconfont.cn'], ['Unsplash', 'https://unsplash.com']] },
  { cat: '生活服务', sites: [['携程旅行', 'https://www.ctrip.com'], ['飞猪', 'https://www.fligo.com'], ['12306', 'https://www.12306.cn'], ['去哪儿', 'https://www.qunar.com'], ['美团', 'https://www.meituan.com'], ['饿了么', 'https://www.ele.me'], ['下厨房', 'https://www.xiachufang.com'], ['丁香医生', 'https://dxy.com'], ['快递100', 'https://www.kuaidi100.com']] },
  { cat: '游戏娱乐', sites: [['Steam', 'https://store.steampowered.com'], ['Epic', 'https://store.epicgames.com'], ['4399', 'http://www.4399.com'], ['游民星空', 'https://www.gamersky.com'], ['小黑盒', 'https://www.xiaoheihe.cn'], ['NGA', 'https://bbs.nga.cn']] },
];

let dirCat = '全部', dirQ = '';

function dirIconHTML(entry) {
  const letter = `<span class="ph" style="background:${tint(entry[0])}">${escapeHtml(entry[0][0])}</span>`;
  let host = '';
  try { host = new URL(entry[1]).host; } catch { return letter; }
  const sources = [
    `https://${host}/favicon.ico`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  ];
  return `${letter}<img src="${escapeHtml(sources[0])}" data-sources="${escapeHtml(sources.join('|'))}" alt="" loading="lazy">`;
}

function renderDirCats() {
  const box = $('#dirCats');
  box.innerHTML = '';
  ['全部', ...SITE_DIRECTORY.map(c => c.cat)].forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dir-cat' + (cat === dirCat && !dirQ ? ' active' : '');
    b.textContent = cat;
    b.onclick = () => { dirCat = cat; dirQ = ''; $('#dirSearch').value = ''; renderDirCats(); renderDirList(); };
    box.append(b);
  });
}

function renderDirList() {
  const box = $('#dirList');
  const existing = new Set(state.data.sites.map(s => s.url));
  let entries = [];
  SITE_DIRECTORY.forEach(c => {
    if (dirCat !== '全部' && c.cat !== dirCat) return;
    c.sites.forEach(([name, url]) => {
      if (dirQ && !name.toLowerCase().includes(dirQ.toLowerCase()) && !url.toLowerCase().includes(dirQ.toLowerCase())) return;
      entries.push([name, url]);
    });
  });
  box.innerHTML = '';
  if (!entries.length) { box.innerHTML = '<p class="dir-empty">没有匹配的网站</p>'; return; }
  entries.forEach(([name, url]) => {
    const added = existing.has(url);
    const card = document.createElement('div');
    card.className = 'dir-card';
    card.innerHTML = `<span class="dir-icon">${dirIconHTML([name, url])}</span>
      <span class="dir-info"><b>${escapeHtml(name)}</b><i>${escapeHtml(url.replace(/^https?:\/\//, ''))}</i></span>
      <button type="button" class="dir-add" ${added ? 'disabled' : ''}>${added ? '已添加' : '添加'}</button>`;
    card.querySelector('.dir-add').addEventListener('click', e => {
      state.data.sites.push({ id: uid(), name, url, icon: '', badge: false });
      persist();
      e.target.disabled = true;
      e.target.textContent = '已添加';
      renderGrid();
      toast(`已添加「${name}」`);
    });
    box.append(card);
  });
}

/* ================= 本地壁纸上传（IndexedDB） ================= */
function idbPut(key, value) {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('nav-page', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onsuccess = () => {
      const tx = rq.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    rq.onerror = () => reject(rq.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('nav-page', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onsuccess = () => {
      const tx = rq.result.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    };
    rq.onerror = () => reject(rq.error);
  });
}

let wallObjectUrl = '';
async function applyWallpaperUpload() {
  if (state.data.settings.wallpaper !== 'upload') return;
  try {
    const blob = await idbGet('wallpaper');
    if (blob) {
      if (wallObjectUrl) URL.revokeObjectURL(wallObjectUrl);
      wallObjectUrl = URL.createObjectURL(blob);
      $('#wallpaper').style.backgroundImage = `url("${wallObjectUrl}")`;
    }
  } catch { /* 忽略 */ }
}

/* ================= 历史备份节点（本机快照） ================= */
const BACKUP_KEY = 'nav-backups';

function getBackups() {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); }
  catch { return []; }
}

function saveBackupNode() {
  const arr = getBackups();
  arr.unshift({ t: Date.now(), payload: cloudPayload() });
  localStorage.setItem(BACKUP_KEY, JSON.stringify(arr.slice(0, 10)));
}

function advanceIcon(img) {
  const list = (img.dataset.sources || '').split('|').filter(Boolean);
  const i = list.indexOf(img.getAttribute('src') || '');
  if (i >= 0 && i + 1 < list.length) img.src = list[i + 1];
  else img.remove();
}

function bindDirectory() {
  $('#dirMask').addEventListener('click', closePanel);
  $('#dirSearch').addEventListener('input', e => { dirQ = e.target.value.trim(); renderDirList(); });
}

/** 加载项目内置数据（data/default-data.json），覆盖当前站点与外观 */
async function loadDefaultData() {
  if (!confirm('加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。')) return;
  try {
    const r = await fetch('data/default-data.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const payload = await r.json();
    if (!Array.isArray(payload.sites)) throw new Error('数据格式不正确');
    saveBackupNode();
    const keepSync = state.data.settings.sync;
    state.data = {
      version: 1,
      sites: payload.sites,
      settings: { ...normalizeSettings(payload.settings || {}), sync: keepSync },
    };
    state.page = 0;
    persist();
    renderAll();
    toast(`已加载内置数据（${state.data.sites.length} 个网站）`);
  } catch (e) { toast('加载失败：' + e.message, 'error'); }
}

/* ================= 启动 ================= */
async function init() {
  state.data = await local.load();
  const fresh = !state.data;
  if (fresh) {
    // 全新环境：优先加载项目自带的数据文件（Infinity 迁移数据），否则用种子数据
    let imported = null;
    try {
      const r = await fetch('data/default-data.json');
      if (r.ok) imported = await r.json();
    } catch { /* 忽略，用种子 */ }
    if (imported && Array.isArray(imported.sites)) {
      state.data = { version: 1, sites: imported.sites, settings: normalizeSettings(imported.settings || {}) };
      if (!state.data.settings.engines.length) state.data.settings.engines = seedEngines();
    } else {
      state.data = { version: 1, sites: seedSites(), settings: seedSettings() };
    }
    persistLocal();
  } else {
    state.data.settings = normalizeSettings(state.data.settings);
    if (!Array.isArray(state.data.sites)) state.data.sites = [];
    persistLocal();
  }
  bindEvents();
  renderAll();
  maybeAutoBingDaily().catch(() => {});
}

init().catch(err => toast('初始化失败：' + err.message, 'error'));
