import { createAdapter, DATA_FILE, LocalAdapter } from './adapters.js?v=20260930f';
import { setLang, t, applyI18n } from './i18n.js?v=20260930f';
import { uid, TYPES, ENGINE_CATALOG, cloneEngine, seedEngines, seedSettings, seedSites, normalizeSettings, buildData } from './domain/data.js?v=20260930f';
import { removeTopEntry, moveTopEntry, transferHardBreak, moveIntoFolder, mergeTopEntries, dissolveFolder, reorderFolderMember, sanitizeSites, rebalancePages, repageAll } from './domain/pages.js?v=20260930f';
import { createGridManager } from './grid-manager.js?v=20260930f';

/* ================= 小工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const SVG_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
const SVG_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5a2 2 0 012-2h4l2 2.5h7a2 2 0 012 2v8.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/></svg>';
const SVG_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';

/** 小图标配色：精选中饱和哑色系（深浅壁纸皆宜、不与白图标/白字冲突），
 *  按站点 host 确定性取色——同站永远同色（避免每次渲染变色） */
const TILE_PALETTE = ['#5b8def', '#4fb286', '#e8a87c', '#9b8ce0', '#5fb0c9', '#c98bb9', '#8d9db6', '#d98d8d', '#7fb069', '#e0b589'];
function tileColor(key) {
  let h = 0;
  for (const ch of String(key || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return TILE_PALETTE[h % TILE_PALETTE.length];
}

function tint(name) {
  const palette = ['#f2708a', '#5aa9e6', '#7fc8a9', '#e6a157', '#9b8ce0', '#59c3c3'];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return palette[h % palette.length];
}

/* ================= 内置壁纸 ================= */
const WALLPAPERS = [
  { id: 'preset:forest', name: '雾林', css: "url('assets/wallpaper.svg')" },
  { id: 'preset:aurora', name: '极光', css: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'preset:dusk',   name: '暮色', css: 'linear-gradient(135deg,#355c7d,#6c5b7b,#c06c84)' },
  { id: 'preset:mint',   name: '薄荷', css: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { id: 'preset:night',  name: '暗夜', css: 'linear-gradient(135deg,#232526,#414345)' },
];

/* ================= 状态 ================= */
const state = {
  data: null,      // { version, sites, settings }
  page: 0,
  pages: 1,
  editMode: false,
  editingId: null, // 当前正在编辑的条目 id（null = 添加）
  editingFolder: false, // 编辑面板当前操作的是文件夹
  editingParent: '', // 新建网址的目标文件夹 id（空 = 桌面）
  openFolderId: null, // 当前打开的文件夹 id
  dragId: null, // 拖拽中的条目 id
  edgePageCreated: false, // 本次拖拽是否已通过末页边缘新建过页（一次拖拽最多新建一页）
  extraPages: 0, // 编辑态手动新增的空页数（退出编辑自动回收）
  layout: { cols: 6, rows: 3, card: 98 },
};

/** 图标网格拖拽引擎（通用模块，桌面/文件夹两网格共用；规格见 docs/icon-grid-prd.md） */
const gridMgr = createGridManager();
let desktopGrid = null, folderGrid = null;

/** 依据屏幕尺寸计算网格布局：自动模式铺满可用宽高，自定义模式按设置的行列数并尽量放大图标 */
function computeLayout() {
  const s = state.data.settings.layout;
  const vw = innerWidth, vh = innerHeight;
  // 图标缩放系数（50%–120%，基准 71%）驱动卡片尺寸：图标始终占卡片 66%，不再溢出格子
  const f = Math.max(0.5, Math.min(1.7, (state.data.settings.iconScale || 71) / 71));

  let colsBase, rowsCap;
  if (s.mode === 'fixed') {
    colsBase = Math.max(1, s.col);
    rowsCap = Math.max(1, s.row);
  } else {
    colsBase = Math.max(4, Math.min(12, Math.floor(Math.min(vw * 0.94, 1760) / 148)));
    rowsCap = 6;
  }

  // 基准卡宽沿用原逻辑，再乘缩放系数——容器宽度随之可调
  let card = Math.max(88, Math.min(128, Math.floor(Math.min(vw * 0.94, 1720) / Math.max(3, colsBase)) - 8));
  card = Math.max(64, Math.round(card * f));

  // 硬上限：卡宽不超过可用宽度的 1/3；卡片连文字不超过可用高度的 1/2——网格最高不超整屏
  const areaTop = $('#gridArea').getBoundingClientRect().top;
  const availH = Math.max(220, vh - areaTop - 96); // 预留翻页圆点与页脚
  card = Math.min(card, Math.floor(vw * 0.94 / 3), Math.floor(availH / 2));

  // 列数/行数：优先尊重设置值，但以实际能放进屏幕为准；间距设置计入纵横步距
  const g = Math.max(0, Math.min(2, (s.gap ?? 100) / 100));
  const colPitch = card * (1 + 0.10 * g);
  const colsFit = Math.max(2, Math.floor((vw * 0.94) / colPitch));
  const cols = Math.max(2, Math.min(colsBase, colsFit));
  const rowPitch = card * (1.42 + 0.30 * (g - 1));
  const rowsFit = Math.max(1, Math.floor((availH - 16) / rowPitch));
  const rows = Math.max(1, Math.min(rowsCap, rowsFit));
  state.layout = { cols, rows, card };
}

const perPage = () => state.layout.cols * state.layout.rows;

/* ================= 持久化与同步 ================= */
const local = new LocalAdapter();

function persistLocal() { local.save(state.data); }

// 滑杆拖动每个 input 事件都同步 stringify+写 localStorage 会造成无谓开销，300ms 尾沿防抖兜底
const persistSoon = debounce(persistLocal, 300);

const cloudPayload = () => {
  const { version, sites, settings, updatedAt } = state.data;
  // Token 属于本机凭据，绝不入云
  return { version, updatedAt: updatedAt || 0, sites, settings: { ...settings, sync: { ...settings.sync, token: '' } } };
};

const isGistType = t => t === 'gitee-gist' || t === 'github-gist';

const canAutoSync = () => {
  const s = state.data.settings.sync;
  return isGistType(s.type) && s.autoSync && s.token && s.gistId;
};

function persist() {
  state.data.updatedAt = Date.now(); // 脏标记：拉取覆盖保护用（本地有未推送修改的判定）
  persistLocal();
  if (canAutoSync()) queueCloudPush();
}

// 自动同步失败提示去重：同一错误 10 分钟内只提示一次，避免连续改动时错误刷屏
let lastAutoSyncErr = { msg: '', at: 0 };
const queueCloudPush = debounce(() => {
  pushCloud(false).catch(err => {
    const now = Date.now();
    if (err.message === lastAutoSyncErr.msg && now - lastAutoSyncErr.at < 10 * 60 * 1000) return;
    lastAutoSyncErr = { msg: err.message, at: now };
    toast(t('自动同步失败：') + err.message, 'error');
  });
}, 1800);

async function pushCloud(notify = true) {
  const cfg = state.data.settings.sync;
  if (!isGistType(cfg.type)) throw new Error('当前未启用云端同步');
  let adapter = createAdapter(cfg);
  if (!cfg.gistId) {
    cfg.gistId = await adapter.create(cloudPayload());
    persistLocal();
    toast(t('已创建云端 Gist（{n}），ID 已写入配置', cfg.gistId));
    if (!$('#sidePanel').hidden) fillSyncDialog();
    adapter = createAdapter(cfg); // 重建适配器带上新 Gist ID，否则本次 save 仍认为未创建
  }
  await adapter.save(cloudPayload());
  state.data.settings.lastSyncAt = Date.now();
  syncedUpdateAt = state.data.updatedAt || Date.now(); // 推送成功：本地不再脏
  persistLocal();
  updateSyncStatus();
  if (notify) toast(t('已推送到云端'));
}

/** 同步水位：上次「推/拉/加载」对齐过的数据时间。低于当前 updatedAt 即本地有未推送修改 */
let syncedUpdateAt = 0;

async function pullCloud(notify = true) {
  const cfg = { ...state.data.settings.sync };
  const adapter = createAdapter(cfg);
  const payload = await adapter.load();
  if (!payload || !Array.isArray(payload.sites)) throw new Error('云端数据格式不正确');
  // 覆盖保护：本地有未推送修改且比云端新 → 自绘确认（最后写入者胜出不再静默丢数据）
  const cloudAt = payload.updatedAt || 0;
  const localDirty = syncedUpdateAt < (state.data.updatedAt || 0);
  if (localDirty && cloudAt < (state.data.updatedAt || 0)) {
    const ok = await uiConfirm(t('拉取覆盖提醒'), t('本地有未推送的修改（本机数据较新）。继续拉取将丢弃这些修改，确定？'));
    if (!ok) { toast(t('已取消拉取。可先「推送到云端」保留本地修改')); return; }
  }
  saveBackupNode(); // 拉取覆盖前自动留一份本地快照
  const keepSync = state.data.settings.sync; // 本机的同步凭据不被云端覆盖
  state.data = buildData(payload, keepSync);
  state.page = 0;
  syncedUpdateAt = state.data.updatedAt || Date.now();
  persistLocal();
  renderAll();
  if (notify) toast(t('已从云端拉取数据'));
}

/* ================= 渲染 ================= */
/** 自定义壁纸 URL 清洗：摘掉引号/反斜杠/换行，防 CSS 截断注入 */
const safeCssUrl = u => String(u || '').replace(/["\\\n\r]/g, '');

function applyWallpaper() {
  const s = state.data.settings;
  const wp = WALLPAPERS.find(w => w.id === s.wallpaper) || WALLPAPERS[0];
  $('#wallpaper').style.backgroundImage = s.customWallpaper ? `url("${safeCssUrl(s.customWallpaper)}")` : wp.css;
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
  toast(t('已应用「{n}」，配置将自动同步', title || t('自定义壁纸')));
}

/* ================= 壁纸右键菜单（对齐 inftab） ================= */
function currentWallpaperUrl() {
  return state.data.settings.customWallpaper || '';
}

async function randomWallpaper() {
  toast(t('正在更换壁纸…'));
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
  } catch { toast(t('获取壁纸失败，请稍后再试'), 'error'); }
}

function favoriteWallpaper() {
  const url = currentWallpaperUrl();
  if (!url) { toast(t('当前是内置壁纸，应用网络壁纸后可收藏'), 'error'); return; }
  const s = state.data.settings;
  s.wallFavorites = s.wallFavorites || [];
  if (s.wallFavorites.some(x => x.url === url)) { toast(t('该壁纸已在收藏中')); return; }
  s.wallFavorites.unshift({ url, thumb: url, title: '收藏于 ' + new Date().toLocaleDateString() });
  s.wallFavorites = s.wallFavorites.slice(0, 12);
  persist();
  toast(t('已收藏当前壁纸'));
}

async function downloadWallpaper() {
  const url = currentWallpaperUrl();
  if (!url) { toast(t('当前是内置壁纸，无需下载'), 'error'); return; }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wallpaper-' + Date.now() + '.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t('已开始下载当前壁纸'));
  } catch { window.open(url, '_blank', 'noopener'); }
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
  $$('#gridPages .card').forEach(c => c.classList.toggle('find-hide', !!q && !c.textContent.toLowerCase().includes(q)));
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
  box.innerHTML = '<p class="hint">' + t('加载中…') + '</p>';
  const list = await fetchBingFeed();
  box.innerHTML = '';
  if (!list) { box.innerHTML = '<p class="hint">' + t('壁纸源加载失败，请检查网络后点击「刷新」重试') + '</p>'; return; }
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
    box.innerHTML = '<p class="hint">' + t('图片源加载失败，请检查网络后点「换一批」重试') + '</p>';
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
  toast(t('已自动更换今日必应壁纸'));
}

/** 统一多源图标回退链：依次尝试直到拿到可用图标；全部失败则显示字母头像。
 *  清晰度优先（inftab 自建高清 CDN 的等价替代）：apple-touch(通常180px) → 高清聚合 → 品牌源；favicon.ico 沉底（常仅16/32px，放大必糊） */
function sourceChainFor(url, size = 128) {
  let host;
  try { host = new URL(url).host; } catch { return []; }
  const bare = host.replace(/^www\./, '');
  const list = [
    // 站点自有高清路径（404 快速失败，不拖链）：PWA 512 / 矢量 SVG（无限清晰）
    `https://${host}/apple-touch-icon.png`,
    `https://${host}/apple-touch-icon-precomposed.png`,
    `https://${host}/android-chrome-512x512.png`,
    `https://${host}/icon-512.png`,
    `https://${host}/favicon.svg`,
    // 聚合服务（favicon.im 服务端已做 link→manifest→touch→ico 瀑布）：
    // throw-error-on-404 必挂——否则 404 时它返回 200 占位图，回退链会误判成功而卡死
    `https://favicon.im/${host}?larger=true&throw-error-on-404=true`,
    `https://unavatar.io/${host}?fallback=false`,
    `https://icons.duckduckgo.com/ip3/${bare}.ico`,
    `https://api.faviconkit.com/${bare}/144`,
    `https://logo.clearbit.com/${host}`,
    `https://www.google.com/s2/favicons?domain=${bare}&sz=128`,
    `https://${host}/favicon.ico`,
    `https://favicon.im/${bare}?larger=true&throw-error-on-404=true`,
  ];
  return [...new Set(list)].filter(u => {
    try { return !deadIconHosts.has(new URL(u).host); } catch { return true; }
  });
}

function iconSources(site) {
  return sourceChainFor(site.url);
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
  let host = '';
  try { host = new URL(site.url).host; } catch { return ph; }
  return `${ph}<img src="${escapeHtml(sources[0])}" referrerpolicy="no-referrer" data-sources="${escapeHtml(sources.join('|'))}" data-icache="${escapeHtml(host)}" alt="" loading="lazy" draggable="false">`;
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

/** 图标缓存：图标首次加载成功后记入 IndexedDB，此后优先直出。
 *  图片本体可跨域读取时存 Blob（本地直出、离线可用）；否则退化为「记住可用源地址」，
 *  下次直接从上次成功的图源开始，跳过前面超时/失效的源 */
const iconCacheUrls = new Map();
const iconCacheDone = new Set();

function hydrateIconCache(root) {
  root.querySelectorAll('img[data-icache]').forEach(img => {
    const host = img.dataset.icache;
    const hit = iconCacheUrls.get(host);
    if (hit) { img.removeAttribute('data-sources'); img.src = hit; return; }
    if (img.dataset.sources) armImgTimeout(img);
    idbGet('icache:' + host).then(rec => {
      if (!rec || !img.isConnected) return;
      if (rec instanceof Blob) {
        const url = URL.createObjectURL(rec);
        iconCacheUrls.set(host, url);
        img.removeAttribute('data-sources');
        img.src = url;
      } else if (rec.u) {
        // 记住的可用源：增强版（data:）直接使用；普通 URL 从它开始并保留回退链
        if (rec.u.startsWith('data:')) { img.removeAttribute('data-sources'); img.src = rec.u; iconCacheDone.add(host); }
        else if (img.dataset.sources.split('|').includes(rec.u)) { img.src = rec.u; iconCacheDone.add(host); }
      }
    }).catch(() => {});
  });
}

// 成功加载的远程图标异步入库；每站点每会话只记一次
document.addEventListener('load', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.dataset.sources) clearTimeout(imgTimers.get(img)); // 加载成功，解除超时
  // 模糊图标处理（与缓存状态无关，凡网格图标加载即判定）。判据 = 放大倍率而非绝对尺寸：
  // naturalWidth < 显示宽 × 0.8（即放大 >1.25 倍）才视为模糊——同尺寸图标在更大显示
  // （图标大小设置调大）下更早进入徽章，反之不误伤（favicon.im 返回尺寸有波动，
  // 绝对阈值会把「够清晰」的图错挂色板）。
  // ① SVG 卷积锐化（合成层、无 CORS 限制）；② 色板衬底（iOS 徽章式）：icon 缩到 62% 居中，
  //   按 host 确定性取哑色系背景——放大模糊被显示尺寸缩小直接消解，观感从「糊图」变「徽章」
  {
    const iconEl = img.closest && img.closest('.icon');
    const disp = iconEl ? iconEl.getBoundingClientRect().width : 0;
    if (img.naturalWidth > 0 && disp > 0 && img.naturalWidth < disp * 0.8 && iconEl) {
      img.classList.add('icon-sharp');
      iconEl.classList.add('icon-tile');
      let key = img.dataset.icache;
      if (!key) { try { key = new URL(img.src).host; } catch { key = ''; } }
      iconEl.style.background = tileColor(key);
    }
  }
  // 垫底头像隐藏：多数 favicon 是透明底 PNG，字母头像的底色会从透明区透出（显示为彩色底）——
  // 图标真正加载成功后隐藏之；全部源失败（advanceIcon 移除 img）时还原
  if (img.naturalWidth > 0 && img.parentElement) {
    const ph = img.parentElement.querySelector('.ph');
    if (ph) ph.style.display = 'none';
  }
  // 尺寸守门：加载成功但分辨率过低(<40px，放大必糊)且还有下源 → 继续降级
  if (img.dataset.sources && img.naturalWidth > 0 && img.naturalWidth < 40) {
    const chain = img.dataset.sources.split('|');
    if (chain.indexOf(img.getAttribute('src') || '') < chain.length - 1) { advanceIcon(img); return; }
  }
  if (!img.dataset.icache || !img.dataset.sources) return;
  if (!/^https?:/.test(img.src)) return; // 已是本地 blob 缓存
  const host = img.dataset.icache;
  if (iconCacheDone.has(host)) return;
  // 模糊源不固化缓存：图源返回尺寸有波动（favicon.im 同 URL 时小时大），
  // 小图成功也留待下次重走全链拿大图；只有清晰源才值得记住
  {
    const iconEl0 = img.closest && img.closest('.icon');
    const disp0 = iconEl0 ? iconEl0.getBoundingClientRect().width : 0;
    if (disp0 > 0 && img.naturalWidth > 0 && img.naturalWidth < disp0 * 0.8) return;
  }
  iconCacheDone.add(host);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000); // 抓取超时：退化为只记源地址
  fetch(img.src, { mode: 'cors', signal: ctl.signal }).then(r => (r.ok ? r.blob() : Promise.reject(new Error('bad status')))).then(b => {
    clearTimeout(timer);
    if (!b || !b.size || b.size > 300 * 1024) return Promise.reject(new Error('skip size'));
    return idbPut('icache:' + host, b);
  }).catch(() => { clearTimeout(timer); idbPut('icache:' + host, { u: img.src }).catch(() => {}); });
}, true);

function cardEl(entry, idx = 0, kidCountOf = () => 0) {
  const a = document.createElement('a');
  a.className = 'card' + (entry.folder ? ' folder-card' : '');
  // 编辑态不带 href：避免浏览器悬停时的链接预览（左下角长文本），也杜绝编辑中误触导航
  if (entry.url) {
    a.href = entry.url; // 普通态导航用；编辑态由 renderGrid 尾部统一摘除（复用节点不重建）
    a.target = state.data.settings.openSitesNewTab ? '_blank' : '_self';
    if (a.target === '_blank') a.rel = 'noopener';
  }
  a.dataset.id = entry.id;
  a.draggable = false; // 指针拖拽引擎接管，禁用链接原生拖动（编辑态与普通态一致）
  a.title = entry.url || entry.name;
  a.style.setProperty('--i', idx);
  const fc = state.data.settings.fontColor;
  const labelColor = fc === 'rainbow' ? tint(entry.name) : (fc || '#ffffff');
  const iconMarkup = entry.folder ? folderTileHTML(entry) : iconHTML(entry);
  const siteBadge = !entry.folder && entry.badge ? '<i class="badge"></i>' : '';
  a.innerHTML = `
    <span class="icon">${iconMarkup}${siteBadge}
      <button class="edit-go" title="编辑">${SVG_PENCIL}</button><button class="del" title="${entry.folder ? '解散文件夹' : '删除'}">${SVG_X}</button>
    </span>
    <span class="label" style="color:${labelColor}">${escapeHtml(entry.name)}</span>`;

  // 点击分流在事件时判定（卡片跨模式复用，构建态不可靠）
  a.addEventListener('click', e => {
    if (state.editMode) {
      e.preventDefault();
      if (entry.folder) openFolder(entry, a); // 编辑态点文件夹=打开夹；普通图标仅铅笔编辑
      return;
    }
    if (entry.folder) { e.preventDefault(); openFolder(entry, a); }
    // 普通图标：交给原生 href 导航
  });

  // 右键图标 = 自动进入图标编辑模式（全部图标出现 × / 铅笔，只涉及图标属性的删除与修改）。
  // 右键文件夹 = 就地菜单（打开全部 / 重命名 / 解散，对齐 inftab 的文件夹右键）。
  // 编辑抽屉不随右键直接弹出：由铅笔按钮或编辑态点击图标打开
  a.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    if (entry.folder) { openFolderMenu(entry, a, e.clientX, e.clientY); return; }
    if (!state.editMode) setEditMode(true);
  });
  const editGo = $('.edit-go', a);
  if (editGo) editGo.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSiteDialog(entry); });
  const del = $('.del', a);
  if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); removeSite(entry); });
  return a;
}

/** 文件夹卡片图标：子站点九宫格缩略（inftab：前 9 个成员，灰底 padding） */
function folderTileHTML(entry) {
  const kids = state.data.sites.filter(x => x.parent === entry.id);
  if (!kids.length) return `<span class="folder-empty">${SVG_FOLDER}</span>`;
  return `<span class="folder-tile">${kids.slice(0, 9).map(k => `<span class="mini">${iconHTML(k)}</span>`).join('')}</span>`;
}

/** 卡片节点复用池：拖拽实时落库会高频触发重渲，全量 innerHTML 重建会打断图片解码与动画（闪烁/掉帧）。
 *  以「条目对象 + 特征串」为键复用未变化的卡片节点——state.data 换代（拉取/导入/还原）后
 *  全是新对象，自然全部重建，不会复用出挂着旧闭包的节点 */
const cardPool = new WeakMap();

/** 页切片（渲染与拖拽排序共用）：硬分页（h=1）分组 + 每页容量切片（编辑态与普通态一致，
 *  inftab 编辑模式网格内无任何附加卡） */
function computePages() {
  const pp = perPage();
  const entries = state.data.sites.filter(x => !x.parent);
  const groups = [[]];
  entries.forEach(en => {
    if (en.h && groups[groups.length - 1].length) groups.push([]);
    groups[groups.length - 1].push(en);
  });
  const pageSlices = [];
  groups.forEach(g => { for (let i = 0; i < g.length; i += pp) pageSlices.push(g.slice(i, i + pp)); });
  if (!pageSlices.length) pageSlices.push([]);
  return pageSlices;
}

/** 拖拽中的让位动画（inftab 用 Flipping 库按 id 键跟踪）：重渲前记旧位，重渲后对位移的卡做 FLIP */
function flipCardsBefore() {
  const m = new Map();
  $$('#gridPages .card[data-id]').forEach(c => m.set(c.dataset.id, c.getBoundingClientRect()));
  return m;
}
function flipCardsApply(before) {
  if (!before) return;
  $$('#gridPages .card[data-id]').forEach(el => {
    if (el.classList.contains('drag-source')) return; // 隐形占格不动画
    const o = before.get(el.dataset.id);
    if (!o) return;
    const n = el.getBoundingClientRect();
    const dx = o.left - n.left, dy = o.top - n.top;
    if (!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = 'transform 200ms ease';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 240);
    });
  });
}

function renderGrid() {
  const pagesBox = $('#gridPages'), dots = $('#dots');
  computeLayout();
  // 页构成重平衡（inftab finishingSites）：渲染前按容量修正 h 边界（溢出级联/空页删除），
  // 保证 computePages 切片与页构成恒一致
  rebalancePages(state.data.sites, perPage());
  const pageSlices = computePages();
  // 文件夹成员角标计数：一次遍历建表，避免每张卡各 filter 一遍全量数组
  const kidCounts = new Map();
  state.data.sites.forEach(x => { if (x.parent) kidCounts.set(x.parent, (kidCounts.get(x.parent) || 0) + 1); });
  const entryById = new Map(state.data.sites.map(x => [x.id, x]));
  const pageCount = pageSlices.length + (state.editMode ? state.extraPages : 0);
  state.pages = pageCount;
  state.page = Math.max(0, Math.min(state.page, pageCount - 1));

  const s = state.data.settings;
  const dragging = gridMgr.isActive();
  const dragId = gridMgr.draggedId();
  const flipBefore = dragging ? flipCardsBefore() : null;
  const takeCard = (en, i) => {
    // 注意：编辑态不入特征串——卡片跨编辑/普通模式复用（×/铅笔按钮常驻 DOM 由 CSS 显隐，
    // href 轻量同步），切换编辑模式不再全员重建（重建会让图片重载，露出垫底字母头像=闪烁）
    const sig = [en.name, en.url, en.icon, en.avatar ? 1 : 0, en.badge ? 1 : 0, en.folder ? 1 : 0,
      kidCounts.get(en.id) || 0, s.fontColor, s.openSitesNewTab ? 1 : 0].join('|');
    const hit = cardPool.get(en);
    if (hit && hit.sig === sig) return hit.el; // 命中不摘除：保持池中有货，下一轮渲染继续复用（摘除会让复用隔轮失效、切编辑必重建）
    const el = cardEl(en, i, id => kidCounts.get(id) || 0);
    cardPool.set(en, { el, sig });
    return el;
  };
  pagesBox.innerHTML = '';
  for (let p = 0; p < pageCount; p++) {
    const pg = document.createElement('div');
    pg.className = 'grid-page' + (p === state.page ? '' : ' off');
    pg.dataset.page = p;
    // inftab 落点区：页面格子区整体是 end 区（空格 = 排到页尾），图标是独立落点区
    pg.dataset.dropid = 'end';
    pg.dataset.dropindexs = JSON.stringify([p, (pageSlices[p] || []).length]);
    pg.style.setProperty('--cols', state.layout.cols);
    pg.style.setProperty('--card', state.layout.card + 'px');
    pg.style.setProperty('--gap-factor', (state.data.settings.layout.gap ?? 100) / 100);
    const slice = pageSlices[p] || [];
    if (slice.length) {
      slice.forEach((en, i) => {
        const el = takeCard(en, i);
        el.style.setProperty('--i', i); // 入场动画序号随位置更新（复用节点不会重建）
        el.dataset.dropid = en.id;
        el.dataset.dropindexs = JSON.stringify([p, i]);
        if (dragging && en.id === dragId) el.classList.add('drag-source');
        pg.append(el);
      });
    } else if (p === 0 && !state.editMode) {
      pg.innerHTML = '<p class="empty-tip">' + t('这里空空如也，点击右上角菜单 → 「添加网址」开始使用') + '</p>';
    }
    pagesBox.append(pg);
  }
  if (flipBefore) flipCardsApply(flipBefore);

  // 圆点按需重建：页数/编辑态不变时只切换 active（避免每次渲染白重建）
  const dotsKey = pageCount + ':' + (state.editMode ? 1 : 0);
  if (dots.dataset.key !== dotsKey) {
    dots.dataset.key = dotsKey;
    dots.innerHTML = '';
    for (let p = 0; p < pageCount; p++) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot';
      d.title = t('第 {n} 页', p + 1);
      d.addEventListener('click', () => showPage(p));
      dots.append(d);
    }
  }
  $$('#dots .dot').forEach((d, i) => d.classList.toggle('active', i === state.page));
  if (state.editMode) {
    const np = document.createElement('button');
    np.type = 'button';
    np.className = 'dot dot-new';
    np.title = t('新建页');
    np.textContent = '＋';
    np.addEventListener('click', () => {
      state.extraPages = Math.min(3, state.extraPages + 1);
      renderGrid();
    });
    dots.append(np);
  }

  pagesBox.classList.toggle('editing', state.editMode);
  // href 按模式同步（卡片复用后按钮常驻、href 需在编辑态摘除防悬停预览/误触导航）
  $$('#gridPages .card[data-id]').forEach(el => {
    const en = entryById.get(el.dataset.id);
    if (state.editMode || !en || !en.url) el.removeAttribute('href');
    else { el.href = en.url; el.target = state.data.settings.openSitesNewTab ? '_blank' : '_self'; if (el.target === '_blank') el.rel = 'noopener'; }
  });
  showPage(state.page);
  // 拖拽中的高频重渲跳过重量级步骤：i18n 全树遍历与图标水合（复用节点保持已加载状态），
  // 排序响应是 200ms 停顿节奏里最敏感的一环，重渲开销直接吃进手感
  if (!dragging) {
    hydrateIdbIcons(pagesBox);
    hydrateIconCache(pagesBox);
    // applyI18n 不在此调用：静态文案由创建时的 t() 翻译，语言切换走 renderAll/显式调用——
    // 全树 TreeWalker 每次渲染都跑是纯开销
  }
}

/** 显示某一页：仅切换可见性与停靠位，不重建 DOM——拖拽进行中也不会中断。
 *  dir=±1 时按翻页方向排布滑动方向（循环翻到对端也保持正确的滑入侧） */
function showPage(p, dir) {
  const pages = $$('#gridPages .grid-page');
  const n = pages.length;
  const box = $('#gridPages');
  const target = pages[p];
  if (!target) return;
  if (dir && n > 1) {
    // 先把目标页摆到入口侧并强制回流，再激活——否则它会从上次的停靠位滑入，方向不对
    target.classList.toggle('pos-l', dir === -1);
    target.classList.toggle('pos-r', dir === 1);
    void box.offsetWidth;
  }
  pages.forEach((pg, i) => {
    const active = i === p;
    pg.classList.toggle('off', !active);
    if (active) {
      pg.classList.remove('pos-l', 'pos-r');
    } else {
      const left = dir === -1 ? !(i > p || (p === n - 1 && i === 0))
        : dir === 1 ? (i < p || (p === 0 && i === n - 1))
        : i < p;
      pg.classList.toggle('pos-l', left);
      pg.classList.toggle('pos-r', !left);
    }
  });
  state.page = p;
  // 容器高度取所有页的最大值：横向切换时高度恒定，箭头/圆点不会随高度过渡上下浮动
  box.style.height = (pages.length ? Math.max(...pages.map(pg => pg.offsetHeight)) : 0) + 'px';
  $$('#dots .dot').forEach((d, i) => d.classList.toggle('active', i === p));
}
/** 翻页（循环：末页向后翻回首页，首页向前翻到末页） */
function flipPage(delta) {
  const n = $$('#gridPages .grid-page').length;
  if (n < 2) return;
  showPage((state.page + delta + n) % n, delta);
}

/** 拖拽中到达末页屏幕边缘：像手机桌面一样追加一个空页并翻过去。
 *  不重建现有页，不打断进行中的拖拽；一次拖拽最多新建一页 */
function appendDragPage() {
  const pagesBox = $('#gridPages');
  const pg = document.createElement('div');
  pg.className = 'grid-page';
  pg.dataset.page = state.pages;
  pg.dataset.dropid = 'end';
  pg.dataset.dropindexs = JSON.stringify([state.pages, 0]); // 空页：落点=页首（hardBreak）
  pg.style.setProperty('--cols', state.layout.cols);
  pg.style.setProperty('--card', state.layout.card + 'px');
  pg.style.setProperty('--gap-factor', (state.data.settings.layout.gap ?? 100) / 100);
  pagesBox.append(pg);
  state.pages += 1;
  const dots = $('#dots');
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'dot';
  d.title = t('第 {n} 页', state.pages);
  d.addEventListener('click', () => showPage(state.pages - 1));
  dots.insertBefore(d, dots.querySelector('.dot-new'));
}

function renderAll() {
  setLang(state.data.settings.lang);
  applyI18n();
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

/** 新图标入页（inftab submitSite → addSite(site, 当前页) 语义）：
 *  从当前页向后递归找第一个有空位的页；之后全满则追加新页；
 *  落位后跳到落位页（inftab toPage）。入夹成员不受分页影响 */
function addTopLevelSite(site) {
  if (site.parent) { state.data.sites.push(site); return; }
  const pp = perPage();
  const pages = computePages();
  let acc = 0, at = null, landPage = null;
  for (let i = state.page; i < pages.length; i++) {
    if (pages[i].length < pp) { at = acc + pages[i].length; landPage = i; break; }
    acc += pages[i].length;
  }
  if (at === null) { at = acc; landPage = pages.length; } // 之后全满：追加新页
  const tops = state.data.sites.filter(x => !x.parent);
  if (at > tops.length) at = tops.length;
  // 在第 at 个顶层条目之前插入（约定：sites 顶层在前、成员在后）
  let i = state.data.sites.length, seen = 0, lastTop = -1;
  for (let k = 0; k < state.data.sites.length; k++) {
    const e = state.data.sites[k];
    if (e.parent) continue;
    if (seen === at) { i = k; break; }
    seen++; lastTop = k;
  }
  if (at === tops.length) i = lastTop + 1;
  state.data.sites.splice(i, 0, site);
  rebalancePages(state.data.sites, pp);
  state.page = landPage; // 落位页（renderGrid 钳制）
}

/** 把条目移动到顶层第 targetIdx 个位置（超出总数 = 追加末尾）；opts.hardBreak 强制自成一页；
 *  opts.page 显式指定落位后的会话页码（拖拽排序时落点页即所见页；缺省按全局序号推算） */
function moveEntryToIndex(dragId, targetIdx, opts = {}) {
  const res = moveTopEntry(state.data.sites, dragId, targetIdx, opts);
  if (!res) return;
  rebalancePages(state.data.sites, perPage());
  if (Number.isInteger(opts.page)) state.page = Math.max(0, Math.min(opts.page, res.topCount > 0 ? Math.max(state.pages - 1, 0) : 0));
  else if (opts.hardBreak) state.page = Infinity; // renderGrid 会钳到末页
  else state.page = Math.max(0, Math.min(res.topCount - 1, Math.floor(Math.min(targetIdx, res.topCount - 1) / perPage())));
  persist();
  renderGrid();
}

/** 文件夹折叠（对齐 iOS）：成员拖空 → 删除夹；只剩 1 个成员 → 自动解散、把最后的图标露在桌面。
 *  浮层若开着则一并收起。返回夹是否被折叠 */
function collapseFolderIfSingle(folderId) {
  const folder = state.data.sites.find(x => x.id === folderId);
  if (!folder || !folder.folder) return false;
  const count = state.data.sites.filter(x => x.parent === folderId).length;
  if (count > 1) return false;
  dissolveFolder(state.data.sites, folderId); // 0 直接删、1 露出成员（h 标记随首个成员转移）
  if (state.openFolderId === folderId) closeFolder();
  return true;
}

/** inftab delAmimation：删除前图标缩放淡出（300ms ease-in-out），动画结束才删数据 */
function delAnimation(el) {
  return new Promise(resolve => {
    if (!el || !el.isConnected) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.1)', opacity: 0 }],
        { duration: 300, easing: 'ease-in-out' }).onfinish = finish;
    } catch { finish(); }
    setTimeout(finish, 320);
  });
}

async function removeSite(entry) {
  // 对齐 iOS「删除 App？」确认：破坏性操作不再一键直达
  if (entry.folder) {
    if (!(await uiConfirm(t('解压文件夹'), t('解散文件夹「{n}」？成员网址会回到桌面', entry.name)))) return;
    // 解散文件夹：子站点回到桌面，不删除
    if (!dissolveFolder(state.data.sites, entry.id)) return;
    if (state.openFolderId === entry.id) closeFolder();
    rebalancePages(state.data.sites, perPage());
    persist();
    renderGrid();
    toast(t('已解散文件夹「{n}」，网址回到桌面', entry.name));
    return;
  }
  // inftab _delItem 原版：编辑态删除无确认框，缩放淡出动画即过渡
  await delAnimation(entry.parent
    ? document.querySelector(`#fvGrid .fv-item[data-id="${entry.id}"]`)
    : document.querySelector(`#gridPages .grid-page:not(.off) .card[data-id="${entry.id}"]`));
  const pid = entry.parent;
  removeTopEntry(state.data.sites, entry.id);
  // iOS 惯例：删到只剩一个成员时夹自动解散、最后的图标露出
  const collapsed = pid ? collapseFolderIfSingle(pid) : false;
  rebalancePages(state.data.sites, perPage());
  persist();
  renderGrid();
  if (collapsed && state.openFolderId === pid) closeFolder();
  else if (state.openFolderId) renderFolderView();
  toast(t('已删除「{n}」', entry.name));
}

/* ================= 文件夹右键菜单（对齐 inftab：打开全部 / 重命名 / 解散） ================= */
function closeCtxMenu() { const m = $('#ctxMenu'); if (m && !m.hidden) m.hidden = true; }

function openFolderMenu(entry, anchorEl, x, y) {
  const m = $('#ctxMenu');
  const kids = state.data.sites.filter(s => s.parent === entry.id && s.url);
  m.innerHTML = '';
  const item = (label, fn, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', () => { closeCtxMenu(); fn(); });
    m.append(b);
  };
  item(t('打开全部') + (kids.length ? `(${kids.length})` : ''), () => {
    let blocked = 0;
    kids.forEach(k => { if (!window.open(k.url, '_blank', 'noopener')) blocked++; });
    if (blocked) toast(t('有 {n} 个标签页被浏览器拦截，请允许本站弹出窗口', blocked), 'error');
  }, !kids.length);
  item(t('重命名'), () => openFolder(entry, anchorEl, true)); // 从卡片位置 zoom 展开 + 自动进入命名
  // inftab 文件夹菜单四项对齐：打开全部 / 重命名 / 删除夹（连成员整删）/ 解压（成员回桌面）
  item(t('解压文件夹'), () => removeSite(entry)); // 成员按原顺序回到桌面（removeSite 内含确认）
  item(t('删除文件夹'), async () => {
    if (!(await uiConfirm(t('删除文件夹'), t('删除文件夹「{n}」及其全部成员？', entry.name)))) return;
    state.data.sites = state.data.sites.filter(x => x.id !== entry.id && x.parent !== entry.id);
    if (state.openFolderId === entry.id) closeFolder();
    rebalancePages(state.data.sites, perPage());
    persist();
    renderGrid();
    toast(t('已删除文件夹「{n}」', entry.name));
  });
  m.hidden = false;
  m.style.left = '0px'; m.style.top = '0px';
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
}

/* ================= 文件夹浮层（对齐 iOS 点开文件夹） ================= */
let fvCloseTimer = null;

/** 打开文件夹。srcEl=触发卡片时从其位置 zoom 展开（对齐 iOS）；
 *  focusRename=合成新文件夹后自动进入命名（iOS 惯例：建夹即命名） */
function openFolder(folder, srcEl, focusRename = false) {
  if (fvCloseTimer) { clearTimeout(fvCloseTimer); fvCloseTimer = null; }
  const mask = $('#folderMask'), view = $('#folderView');
  view.classList.remove('closing');
  mask.classList.remove('closing');
  state.openFolderId = folder.id;
  renderFolderView();
  if (srcEl) {
    const r = srcEl.getBoundingClientRect();
    view.hidden = false; // 先显示才有尺寸：zoom 原点按「卡片中心相对浮层」计算
    const vr = view.getBoundingClientRect();
    if (vr.width) {
      view.style.transformOrigin =
        Math.round(r.left + r.width / 2 - vr.left) + 'px ' + Math.round(r.top + r.height / 2 - vr.top) + 'px';
    }
  } else {
    view.style.transformOrigin = '';
    view.hidden = false;
  }
  mask.hidden = false;
  if (focusRename) setTimeout(() => { if (state.openFolderId === folder.id) startFolderRename(); }, 220);
}

function closeFolder() {
  if (fvCloseTimer) { clearTimeout(fvCloseTimer); fvCloseTimer = null; }
  if (gridMgr.isActive()) gridMgr.ghostScale(1); // 面板收起：拖影还原（inftab 同）
  state.openFolderId = null;
  const view = $('#folderView'), mask = $('#folderMask');
  if (view.hidden) { mask.hidden = true; return; }
  // 轻量缩回动画后再隐藏（对齐 iOS 关闭文件夹）；期间再打开由 openFolder 取消本定时器
  view.classList.add('closing');
  mask.classList.add('closing');
  fvCloseTimer = setTimeout(() => {
    fvCloseTimer = null;
    view.classList.remove('closing');
    mask.classList.remove('closing');
    view.hidden = true;
    mask.hidden = true;
  }, 150);
}

/** 文件夹改名聚焦（常驻输入框：Enter 确认、Esc 还原，见 renderFolderView） */
function startFolderRename() {
  const inp = $('#fvTitle input');
  if (!inp) return;
  inp.focus();
  inp.select();
}

function renderFolderView() {
  const f = state.data.sites.find(x => x.id === state.openFolderId);
  if (!f || !f.folder) { closeFolder(); return; }
  // inftab：文件夹名是常驻输入框（样式即标题文本，80 字上限）。
  // 事件一律委托到静态的 fvTitle（见 bindEvents）——元素无论如何被重渲/替换，行为不丢
  if (!$('#fvTitle input')) {
    $('#fvTitle').textContent = '';
    const inp = document.createElement('input');
    inp.className = 'fv-name';
    inp.maxLength = 80;
    $('#fvTitle').append(inp);
  }
  const fvInput = $('#fvTitle input');
  if (fvInput && document.activeElement !== fvInput && fvInput.value !== f.name) fvInput.value = f.name;
  $('#fvHint').textContent = t('拖出夹外稍停即移出 · 右键成员可整理');
  const kids = state.data.sites.filter(x => x.parent === f.id);
  const box = $('#fvGrid');
  box.innerHTML = '';
  // inftab：面板成员网格的空隙/末尾 = end 区（停顿追加到夹尾）
  box.dataset.dropid = 'end';
  box.dataset.dropindexs = JSON.stringify([kids.length]);
  kids.forEach((k, i) => {
    const a = document.createElement('a');
    a.className = 'fv-item';
    a.dataset.id = k.id;
    a.dataset.dropid = k.id;              // inftab 落点区：夹内成员槽位
    a.dataset.dropindexs = JSON.stringify([i]);
    a.draggable = false;
    if (!state.editMode && k.url) {
      a.href = k.url;
      a.target = state.data.settings.openSitesNewTab ? '_blank' : '_self';
      if (a.target === '_blank') a.rel = 'noopener';
    }
    if (gridMgr.isActive() && k.id === gridMgr.draggedId()) a.classList.add('drag-source'); // 拖动中重渲：接任隐形占格
    a.innerHTML = `<span class="icon">${iconHTML(k)}${state.editMode ? `<button class="edit-go" title="编辑">${SVG_PENCIL}</button><button class="del" title="删除">${SVG_X}</button>` : ''}</span><span class="label">${escapeHtml(k.name)}</span>`;
    a.addEventListener('click', e => { if (state.editMode) e.preventDefault(); }); // 编辑态点卡身无操作，仅铅笔编辑
    const mEdit = a.querySelector('.edit-go');
    if (mEdit) mEdit.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSiteDialog(k); });
    a.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!state.editMode) setEditMode(true); // 浮层刷新出 × 与编辑态渲染，抽屉由铅笔/点击打开
    });
    const del = $('.del', a);
    if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); removeSite(k); });
    box.append(a);
  });
  hydrateIdbIcons(box);
  hydrateIconCache(box);
  // 夹内重排/拖出由 gridMgr 的 folder 网格实例接管（见 bindEvents）
}

/* ================= 编辑图标侧边面板（对齐 inftab） ================= */
function openSiteDialog(site, opts = {}) {
  const folder = site ? !!site.folder : !!opts.folder;
  state.editingId = site ? site.id : null;
  state.editingFolder = folder;
  state.editingParent = !site && !folder && opts.parent ? opts.parent : '';
  $('#editDlgTitle').textContent = folder ? (site ? t('编辑文件夹') : t('新建文件夹')) : (site ? t('编辑图标') : t('添加图标'));
  $('#editUrl').value = site && site.url ? site.url : '';
  $('#editName').value = site ? site.name : '';
  editNameTouched = false;
  $('#editFormError').hidden = true;
  $('#editUrlField').hidden = folder;
  $('#editPickField').hidden = folder;
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
  state.editingFolder = false;
  state.editingParent = '';
}

// 面板打开期间的图标选择状态：auto=自动获取 / avatar=纯色图标 / url=候选图标 / idb=本地上传
const editIcon = { mode: 'auto', url: '', idbKey: '', pickedFor: '' };
let editNameTouched = false; // 用户手动改过名称后，网址变化不再自动覆盖

/** 网站名称自动检测：命中内置目录取站名；否则取 host 核心词（去 www/后缀、首字母大写） */
function guessSiteName(raw) {
  let host = '';
  try { host = new URL(normalizeUrl(raw)).host.replace(/^www\./, ''); } catch { return ''; }
  if (!host) return '';
  for (const cat of SITE_DIRECTORY) {
    for (const [n, u] of cat.sites) {
      try { if (new URL(u).host.replace(/^www\./, '') === host) return n; } catch { /* 跳过 */ }
    }
  }
  const core = host.split('.')[0] || host;
  return core.charAt(0).toUpperCase() + core.slice(1);
}

function pickSite() {
  return state.editingId ? state.data.sites.find(s => s.id === state.editingId) : null;
}

/** 选中态轻量同步：只切换 on 标记与 × 按钮，不重建瓷片——
 *  重建会让候选图重新请求（闪烁）、失败候选先显示再隐藏（数量 4→2 跳变） */
function syncPickMarks() {
  $$('#iconPick .pick').forEach(b => {
    const on = (b.dataset.kind === 'avatar' && editIcon.mode === 'avatar')
      || (b.dataset.kind === 'url' && editIcon.mode === 'url' && editIcon.url === b.dataset.src)
      || (b.dataset.kind === 'idb' && editIcon.mode === 'idb');
    b.classList.toggle('on', on);
    const removable = b.dataset.kind === 'url' || b.dataset.kind === 'idb';
    let x = b.querySelector('.pick-x');
    if (on && removable) {
      if (!x) {
        x = document.createElement('i');
        x.className = 'pick-x';
        x.title = t('移除该图标，恢复自动获取');
        x.textContent = '×';
        x.addEventListener('click', e => {
          e.stopPropagation();
          Object.assign(editIcon, { mode: 'auto', url: '', idbKey: '' });
          syncPickMarks();
        });
        b.append(x);
      }
    } else if (x) x.remove();
  });
}

function renderIconPick() {
  const site = pickSite();
  const box = $('#iconPick');
  box.innerHTML = '';
  const tile = (kind, label, inner, dataSrc = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.kind = kind;
    if (dataSrc) b.dataset.src = dataSrc;
    b.innerHTML = `<span class="pick-img">${inner}</span><span class="pick-cap">${label}</span>`;
    box.append(b);
    return b;
  };
  // 纯色图标：名称前两字色块（对齐 inftab）
  const name = $('#editName').value.trim() || (site ? site.name : '');
  const av = tile('avatar', '纯色图标', `<span class="ph-tile" style="background:${tint(name)}">${escapeHtml(name.slice(0, 2) || '•')}</span>`);
  av.addEventListener('click', () => { Object.assign(editIcon, { mode: 'avatar', url: '', idbKey: '' }); syncPickMarks(); });
  // 自动抓取的候选图标：编辑=站点 URL、添加=表单已输入的网址（输入变化实时刷新候选）。
  // 高清链前三；点击只同步标记（syncPickMarks），记录选中时的网址上下文（pickedFor）防误清
  const url = site ? site.url : normalizeUrl($('#editUrl').value || '');
  const sources = url ? sourceChainFor(url) : [];
  const cands = [...new Set(sources)].filter(Boolean).slice(0, 3);
  cands.forEach((src, i) => {
    const b = tile('url', `图标0${i + 1}`, `<img src="${escapeHtml(src)}" alt="" draggable="false">`, src);
    b.querySelector('img').addEventListener('error', () => { b.style.display = 'none'; }); // 源不存在：隐藏该候选项
    b.addEventListener('click', () => {
      Object.assign(editIcon, { mode: 'url', url: src, idbKey: '', pickedFor: $('#editUrl').value });
      syncPickMarks();
    });
  });
  // 本地图标：展示当前上传图标；点击可上传/更换
  const local = tile('idb', '本地图标', '<span class="pick-plus">＋</span>');
  local.addEventListener('click', () => $('#iconFile').click());
  if (editIcon.mode === 'idb') {
    idbGet(editIcon.idbKey).then(blob => {
      if (!blob) return;
      if (!idbIconUrls.has(editIcon.idbKey)) idbIconUrls.set(editIcon.idbKey, URL.createObjectURL(blob));
      const img = local.querySelector('.pick-img');
      if (img) img.innerHTML = `<img src="${idbIconUrls.get(editIcon.idbKey)}" alt="" draggable="false">`;
    }).catch(() => {});
  }
  syncPickMarks(); // 构建完成：套用当前选中态
}

function saveSiteDialog() {
  const name = $('#editName').value.trim();
  const err = $('#editFormError');
  if (state.editingFolder) {
    if (!name) { err.textContent = t('请填写文件夹名称'); err.hidden = false; return; }
    if (state.editingId) {
      const f = pickSite();
      if (f) f.name = name;
    } else {
      state.data.sites.push({ id: uid(), name, folder: true });
    }
    persist();
    closeSiteDialog();
    renderGrid();
    toast(t('已保存'));
    return;
  }
  const url = normalizeUrl($('#editUrl').value);
  if (!name || !url) {
    err.textContent = !name ? t('请填写名称') : t('请填写有效的网址');
    err.hidden = false;
    return;
  }
  const icon = editIcon.mode === 'url' ? editIcon.url : (editIcon.mode === 'idb' ? 'idb:' + editIcon.idbKey : '');
  const avatar = editIcon.mode === 'avatar';
  if (state.editingId) {
    const site = pickSite();
    if (site) Object.assign(site, { name, url, icon, avatar });
  } else {
    addTopLevelSite({ id: uid(), name, url, icon, avatar, badge: false, parent: state.editingParent || '' });
  }
  persist();
  closeSiteDialog();
  renderGrid();
  if (state.openFolderId) renderFolderView();
  toast('已保存');
}

function bindSitePanel() {
  $('#editOk').addEventListener('click', saveSiteDialog);
  $('#editCancel').addEventListener('click', closeSiteDialog);
  $('#editPanelClose').addEventListener('click', closeSiteDialog);
  $('#editMask').addEventListener('click', closeSiteDialog);
  // 名称变化时同步纯色图标文字与配色；网址变化时刷新自动检测候选（旧候选失效回自动）
  $('#editName').addEventListener('input', () => { if (editIcon.mode === 'avatar') renderIconPick(); });
  $('#editUrl').addEventListener('input', debounce(() => {
    // 仅当选中候选时的网址与当前不同（真的改了网址）才清选；防止输入后 400ms 防抖
    // 误清用户刚点的候选（点击闪烁/选中丢失的根源之一）
    if (editIcon.mode === 'url' && editIcon.pickedFor !== $('#editUrl').value) Object.assign(editIcon, { mode: 'auto', url: '', idbKey: '' });
    if (!editNameTouched) {
      const guess = guessSiteName($('#editUrl').value);
      if (guess && $('#editName').value !== guess) {
        $('#editName').value = guess;
        if (editIcon.mode === 'avatar') renderIconPick(); // 纯色图标文字随名刷新
      }
    }
    renderIconPick();
  }, 400));
  $('#editName').addEventListener('input', () => { editNameTouched = true; });
  $('#iconFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast(t('图标图片请小于 2MB'), 'error'); return; }
    const key = 'icon-' + Date.now();
    try {
      await idbPut(key, f);
      Object.assign(editIcon, { mode: 'idb', url: '', idbKey: key });
      renderIconPick();
    } catch { toast(t('图标保存失败'), 'error'); }
  });
}

function applyAppearance() {
  const s = state.data.settings;
  const root = document.documentElement.style;
  root.setProperty('--search-w', `min(${Math.round(640 * s.searchScale / 100)}px, 92vw)`);
  root.setProperty('--search-h', Math.min(58, Math.round(44 * s.searchScale / 100)) + 'px');
  root.setProperty('--search-radius', Math.round(44 * s.searchRadius / 100) + 'px');
  root.setProperty('--search-alpha', (s.searchOpacity / 100).toFixed(2));
  root.setProperty('--label-size', s.fontSize + 'px');
  root.setProperty('--label-shadow', s.fontShadow ? '0 1px 5px rgba(0,0,0,.45)' : 'none');
  // 图标缩放已由 computeLayout 通过卡片尺寸承担，不再单独缩放图标（避免双重缩放溢出格子）
  root.setProperty('--icon-radius-pct', s.iconRadius);
  root.setProperty('--icon-opacity', (s.iconOpacity / 100).toFixed(2));
  // 遮罩强度：滑杆 0 时也保留 35% 基础遮罩，保证亮色壁纸上文字可读
  // 遮罩 = 纯黑图层，滑杆 0-100 映射 0-92% 黑度，拉满不纯黑、归零无遮罩
  $('.wallpaper-mask').style.opacity = (s.wallOpacity * 0.92 / 100).toFixed(3);
  const wp = $('#wallpaper');
  wp.style.filter = s.wallBlur > 0 ? 'blur(' + s.wallBlur + 'px)' : '';
  wp.style.transform = s.wallBlur > 0 ? 'scale(' + (1 + s.wallBlur / 150).toFixed(3) + ')' : '';

  const grid = $('#gridPages');
  grid.dataset.easing = s.animEasing;
  $('#searchBtn').hidden = s.searchHideBtn;
  grid.classList.toggle('hide-labels', !!s.hideIconName);
  grid.classList.toggle('no-icon-shadow', !s.iconShadow);
  grid.classList.toggle('icon-intro', !!s.iconIntro);
  $('#gridArea').classList.toggle('show-page-btns', !!s.showPageBtns);
  $('#searchArea').style.display = s.searchHide ? 'none' : '';
  $('#engineTabs').style.display = s.searchHideType ? 'none' : '';
}

function fillSettingsPane() {
  const s = state.data.settings;
  for (const c of SETTING_CONTROLS) {
    const el = $('#' + c.id);
    if (c.type === 'check') { el.checked = !!s[c.key]; continue; }
    el.value = s[c.key];
    $('#' + c.id + 'Val').textContent = el.value + (c.suffix ?? '%');
  }
  const lay = s.layout;
  $('#rgLayoutRows').value = lay.row;
  $('#rgLayoutRowsVal').textContent = lay.row;
  $('#rgLayoutCols').value = lay.col;
  $('#rgLayoutColsVal').textContent = lay.col;
  $('#rgLayoutGap').value = lay.gap ?? 100;
  $('#rgLayoutGapVal').textContent = (lay.gap ?? 100) + '%';
  renderLayoutPresets();
  renderEaseCards();
  $('#selLang').value = s.lang || 'zh';
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
      repageAll(state.data.sites, perPage()); // inftab reSort：布局变更 → 摊平按新容量重切
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
  TYPES.forEach(ty => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t(ty.name);
    b.className = ty.id === state.data.settings.searchType ? 'active' : '';
    b.onclick = () => {
      state.data.settings.searchType = ty.id;
      persist();
      renderTypeTabs();
      hideSug();
    };
    tabs.append(b);
  });
}

function updateSearchUI() {
  const eng = resolveEngine();
  // 胶囊容器随图标比例自适应（横向字标不压扁）；字母为加载失败时的兜底
  const glyph = eng.glyph || (eng.name || '?')[0];
  let host = '';
  try { host = new URL(eng.urls.html).host; } catch { host = ''; }
  const sources = host ? [
    `https://${host}/favicon.ico`,
    `https://favicon.im/${host}?larger=true`,
  ].map(u => escapeHtml(u)).join('|') : '';
  const img = sources ? `<img class="eng-logo-img" src="${sources.split('|')[0]}" data-sources="${sources}" alt="">` : '';
  // 白底 + favicon 裁满圆形（与添加列表图标一致）；字母兜底仅在图片加载失败后显示，成功即隐藏
  $('#engineLogo').innerHTML = `<span class="eng-logo-fb" style="color:${eng.color || tint(eng.name)}">${escapeHtml(glyph)}</span>${img}`;
  const logoIm = $('#engineLogo .eng-logo-img');
  if (logoIm) {
    const fbEl = $('#engineLogo .eng-logo-fb');
    const hideFb = () => { fbEl.style.display = 'none'; };
    if (logoIm.complete && logoIm.naturalWidth > 0) hideFb();
    else logoIm.addEventListener('load', hideFb);
  }
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
  add.innerHTML = `<span class="eng-glyph plus">${SVG_PLUS}</span><span class="eng-name">${t('添加')}</span>`;
  add.onclick = () => { toggleEngineMenu(false); openEngineDialog(null); };
  m.append(add);
}

function engineGlyphHTML(eng) {
  // favicon 覆盖在字母色块上（img 必须位于 .eng-glyph 内部，依赖 .eng-glyph img 绝对定位规则）
  let inner = escapeHtml(eng.glyph || (eng.name || '?')[0]);
  let host = '';
  try { host = new URL(eng.urls.html).host; } catch { host = ''; }
  if (host) {
    const sources = [
      `https://${host}/favicon.ico`,
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
      `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    ].map(u => escapeHtml(u)).join('|');
    inner += `<img src="${sources.split('|')[0]}" data-sources="${sources}" alt="" loading="lazy">`;
  }
  return `<span class="eng-glyph" style="background:${eng.color || tint(eng.name)}">${inner}</span>`;
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
    const eng = resolveEngine(), typeId = activeType().id;
    if (!((eng.urls || {})[typeId] || (eng.urls || {}).html)) { toast(t('该引擎未配置搜索地址'), 'error'); return; }
    target = buildSearchUrl(eng, typeId, q);
  }
  if (state.data.settings.openSearchNewTab) window.open(target, '_blank');
  else location.href = target;
  if (!state.data.settings.keepSearchText) $('#searchInput').value = '';
}

/* ================= 自绘确认弹窗（inftab IConfirm 对齐） ================= */
let cfResolve = null;
function uiConfirm(title, text) {
  return new Promise(resolve => {
    const dlg = $('#dlgConfirm');
    $('#cfTitle').textContent = title || t('确定');
    $('#cfText').textContent = text || '';
    cfResolve = resolve;
    dlg.showModal();
  });
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

/* ================= 顶部按钮事件（汉堡直接弹出设置抽屉，对齐 inftab） ================= */
function bindTopMenu() {
  $('#btnMenu').addEventListener('click', e => { e.stopPropagation(); openPanel('add'); });
  // iOS 抖动模式的「完成」：退出编辑
  $('#editDoneBar').addEventListener('click', () => setEditMode(false));

  document.addEventListener('click', e => {
    // 捕获阶段判断（此时目标尚未被重建的 DOM 摘除）：编辑态点空白处即退出
    if (state.editMode && !e.target.closest('.card, .edit-panel, #dirMask, #sidePanel, dialog, .dots, .round-btn, #btnMenu, .iconfind-mask, #folderView, .edit-done-bar')) setEditMode(false);
  }, true);
  document.addEventListener('click', e => {
    if (!$('#engineMenu').hidden && !$('#engineMenu').contains(e.target) && !$('#engineLogo').contains(e.target) && !(e.target.closest && e.target.closest('.icon-dow'))) toggleEngineMenu(false);
  });
  // 右键菜单：点击菜单外任意处即关闭（捕获阶段，先于菜单项的 click 冒泡不冲突——菜单项自身点击含在 closest 内放行）
  document.addEventListener('click', e => {
    if (!$('#ctxMenu').hidden && !(e.target.closest && e.target.closest('#ctxMenu'))) closeCtxMenu();
  }, true);
  // 页面右键无自定义菜单（交互规格 v2.1：菜单管理移除，右键图标即进入编辑）
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.card, .fv-item, .edit-panel, #sidePanel, #folderView, .folder-mask, dialog, input, textarea, select, .engine-menu, .sug-drop, .dir-card')) return;
    e.preventDefault();
  });
  addEventListener('blur', () => { toggleEngineMenu(false); closeCtxMenu(); });
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
  if (!on) {
    state.extraPages = 0; // 退出编辑：手动新增的空页自动回收（对齐 iOS）
    // iOS 惯例：空文件夹不保留（新建后没放入成员的夹子此时一并清理）
    const before = state.data.sites.length;
    state.data.sites = state.data.sites.filter(x => !x.folder || state.data.sites.some(m => m.parent === x.id));
    if (state.data.sites.length !== before && state.openFolderId && !state.data.sites.some(x => x.id === state.openFolderId)) closeFolder();
  }
  $('#editDoneBar').hidden = !on; // iOS 抖动模式右上角的「完成」
  if (state.openFolderId) renderFolderView(); // 浮层成员的 × / 链接 / 提示随整理态刷新
  renderGrid();
}

function toggleEditMode() {
  setEditMode(!state.editMode);
}

/* ---------- 设置控件表：id ↔ settings 键 ↔ 应用回调；填充与绑定共用一张表，防止双轨漂移 ---------- */
function applyScaleChange() { applyAppearance(); debounce(renderGrid, 120)(); } // 图标大小改变卡片尺寸/列数/行数，需重排
const SETTING_CONTROLS = [
  { id: 'tgSitesNewTab', key: 'openSitesNewTab', type: 'check', apply: renderGrid },
  { id: 'tgSearchNewTab', key: 'openSearchNewTab', type: 'check' },
  { id: 'tgPageBtns', key: 'showPageBtns', type: 'check', apply: applyAppearance },
  { id: 'tgHideName', key: 'hideIconName', type: 'check', apply: applyAppearance },
  { id: 'tgIconShadow', key: 'iconShadow', type: 'check', apply: applyAppearance },
  { id: 'tgIconIntro', key: 'iconIntro', type: 'check', apply: applyAppearance },
  { id: 'rgIconRadius', key: 'iconRadius', type: 'range', apply: applyAppearance },
  { id: 'rgIconOpacity', key: 'iconOpacity', type: 'range', apply: applyAppearance },
  { id: 'rgIconScale', key: 'iconScale', type: 'range', apply: applyScaleChange },
  { id: 'tgSearchHide', key: 'searchHide', type: 'check', apply: applyAppearance },
  { id: 'tgSuggest', key: 'searchSuggest', type: 'check' },
  { id: 'tgKeepText', key: 'keepSearchText', type: 'check' },
  { id: 'tgHideType', key: 'searchHideType', type: 'check', apply: applyAppearance },
  { id: 'rgSearchSize', key: 'searchScale', type: 'range', apply: applyAppearance },
  { id: 'rgSearchRadius', key: 'searchRadius', type: 'range', apply: applyAppearance },
  { id: 'rgSearchOpacity', key: 'searchOpacity', type: 'range', apply: applyAppearance },
  { id: 'tgFontShadow', key: 'fontShadow', type: 'check', apply: applyAppearance },
  { id: 'rgFontSize', key: 'fontSize', type: 'range', suffix: '', apply: applyAppearance },
  { id: 'tgHideSearchBtn', key: 'searchHideBtn', type: 'check', apply: applyAppearance },
  { id: 'rgWallOpacity', key: 'wallOpacity', type: 'range', apply: applyAppearance },
  { id: 'rgWallBlur', key: 'wallBlur', type: 'range', suffix: '', apply: applyAppearance },
];

function bindSettingControls() {
  for (const c of SETTING_CONTROLS) {
    const el = $('#' + c.id);
    if (c.type === 'check') {
      el.addEventListener('change', e => {
        state.data.settings[c.key] = e.target.checked;
        if (c.apply) c.apply();
        persist();
      });
    } else {
      el.addEventListener('input', () => {
        state.data.settings[c.key] = parseInt(el.value, 10);
        $('#' + c.id + 'Val').textContent = el.value + (c.suffix ?? '%');
        updateRangeFill(el);
        if (c.apply) c.apply();
        persistSoon();
      });
    }
  }
}

function bindSettingsDialog() {
  // 三个 tab 切换
  $$('.sp-tab').forEach(t => t.addEventListener('click', () => openPanel(t.dataset.tab)));
  // 抽屉快捷操作区
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
  $('#btnAbout').addEventListener('click', () => $('#dlgAbout').showModal());
  $('#dirMask').addEventListener('click', closePanel);
  $('#btnAddEngine').addEventListener('click', () => openEngineDialog(null));
  $('#btnGallery').addEventListener('click', openGallery);
  $('#bingRefresh').addEventListener('click', loadBingGallery);
  $('#picsumRefresh').addEventListener('click', loadPicsumGallery);
  $('#optDailyApply').addEventListener('change', e => {
    state.data.settings.bingDaily = e.target.checked;
    $('#optBingDaily').checked = e.target.checked;
    persist();
    toast(e.target.checked ? t('已开启每日自动更换必应壁纸') : t('已关闭每日自动更换'));
  });
  $('#optBingDaily').addEventListener('change', e => {
    state.data.settings.bingDaily = e.target.checked;
    $('#optDailyApply').checked = e.target.checked;
    persist();
  });

  // 开关/滑杆由表驱动的 bindSettingControls() 统一绑定；布局三滑杆语义特殊，单独绑定
  bindSettingControls();
  $('#selLang').addEventListener('change', e => {
    state.data.settings.lang = e.target.value;
    setLang(e.target.value);
    persist();
    renderTypeTabs();
    renderGrid();
    applyI18n();
  });
  // 布局自定义：行列/间距，改动即进入固定模式并重排
  const bindLayoutRange = (id, valId, key, suffix = '') => {
    const el = $('#' + id);
    el.addEventListener('input', () => {
      const v = parseInt(el.value, 10);
      $('#' + valId).textContent = v + suffix;
      state.data.settings.layout[key] = v;
      state.data.settings.layout.mode = 'fixed';
      if (key === 'row' || key === 'col') repageAll(state.data.sites, perPage()); // inftab reSort：容量变更 → 摊平重切
      persistSoon();
      debounce(renderGrid, 120)();
      renderLayoutPresets();
    });
  };
  bindLayoutRange('rgLayoutRows', 'rgLayoutRowsVal', 'row');
  bindLayoutRange('rgLayoutCols', 'rgLayoutColsVal', 'col');
  bindLayoutRange('rgLayoutGap', 'rgLayoutGapVal', 'gap', '%');
  $('#wallFile').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast(t('图片过大（超过 4MB），请压缩后再试'), 'error'); return; }
    idbPut('wallpaper', f).then(() => {
      const s = state.data.settings;
      s.wallpaper = 'upload';
      s.customWallpaper = '';
      persist();
      applyWallpaper();
      applyWallpaperUpload();
      toast(t('已应用本地图片壁纸'));
    }).catch(() => toast(t('保存失败，请重试'), 'error'));
  });

  // 壁纸与高级（失焦/回车保存）
  $('#wpUrl').addEventListener('change', e => {
    state.data.settings.customWallpaper = e.target.value.trim();
    persist();
    applyWallpaper();
    renderWpGrid();
  });

  // 还原设置
  $('#btnResetSettings').addEventListener('click', async () => {
    if (!(await uiConfirm(t('还原设置'), t('恢复默认设置？网址与云同步配置会保留。')))) return;
    saveBackupNode();
    const cur = state.data.settings;
    const keepSync = cur.sync;
    state.data.settings = { ...seedSettings(), sync: keepSync };
    state.page = 0;
    persist();
    renderAll();
    openPanel('settings');
    toast(t('已还原默认设置'));
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

async function removeEngine(engine) {
  const s = state.data.settings;
  if (s.engines.length <= 1) { toast(t('至少保留一个搜索引擎'), 'error'); return; }
  if (!(await uiConfirm(t('移除搜索引擎'), t('移除搜索引擎「{n}」？', engine.name)))) return;
  s.engines = s.engines.filter(x => x.id !== engine.id);
  if (s.engine === engine.id) s.engine = s.engines[0].id;
  persist();
  renderEngineList();
  updateSearchUI();
  toast(t('已移除「{n}」（引擎库中可随时重新启用）', engine.name));
}

function openEngineDialog(engine) {
  const adding = !engine;
  $('#engDlgTitle').textContent = adding ? t('添加搜索引擎') : t('编辑搜索引擎');
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
      toast(t('已添加「{n}」', c.name));
    };
    box.append(b);
  });
  if (!box.children.length) box.innerHTML = '<p class="hint">' + t('引擎库中的引擎已全部启用') + '</p>';
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
    if (!name) { showErr(t('请填写引擎名称')); return; }
    if (!urls.html) { showErr(t('请填写网页搜索地址')); return; }
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
    toast(t('已保存'));
  });
}

/* ================= Gist 实例管理（查看 / 复用 / 清理） ================= */
async function renderGistList() {
  const box = $('#gistList');
  saveSyncCfg();
  const cfg = state.data.settings.sync;
  if (!isGistType(cfg.type)) { box.hidden = true; return; }
  box.hidden = false;
  if (!cfg.token) { box.innerHTML = '<li class="hint">' + t('请先填写访问令牌（Token）') + '</li>'; return; }
  box.innerHTML = '<li class="hint">' + t('加载中…') + '</li>';
  try {
    const rows = await createAdapter(cfg).list();
    if (!rows.length) { box.innerHTML = '<li class="hint">' + t('账号里没有 Gist') + '</li>'; return; }
    box.innerHTML = '';
    rows.forEach(g => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'bt';
      name.textContent = `${g.id.slice(0, 8)}… ${g.hasData ? '★ ' : ''}${g.description} · ${g.updatedAt ? new Date(g.updatedAt).toLocaleString() : ''}`.trim();
      const bUse = document.createElement('button');
      bUse.type = 'button';
      bUse.className = 'btn';
      bUse.textContent = t('使用');
      bUse.addEventListener('click', () => {
        $('#syncGistId').value = g.id;
        saveSyncCfg();
        updateSyncStatus();
        toast(t('已保存'));
      });
      const bDel = document.createElement('button');
      bDel.type = 'button';
      bDel.className = 'btn';
      bDel.textContent = t('删除');
      bDel.addEventListener('click', async () => {
        if (!(await uiConfirm(t('删除'), t('删除该 Gist？不可恢复')))) return;
        try {
          await createAdapter(cfg).destroy(g.id);
          if (cfg.gistId === g.id) { cfg.gistId = ''; $('#syncGistId').value = ''; saveSyncCfg(); updateSyncStatus(); }
          renderGistList();
        } catch (e) { toast(t('删除失败：') + e.message, 'error'); }
      });
      li.append(name, bUse, bDel);
      box.append(li);
    });
  } catch (e) {
    box.innerHTML = '<li class="hint">' + t('加载失败：') + e.message + '</li>';
  }
}

/* ================= 数据同步对话框 ================= */
/** 云端配置区随所选平台（Gitee / GitHub）切换标题、令牌提示与占位符 */
function updateSyncBrandUI(type) {
  const github = type === 'github-gist';
  $('#giteeFields').hidden = !isGistType(type);
  $('#syncCfgTitle').textContent = github ? 'GitHub Gist 配置' : 'Gitee 云端配置';
  $('#syncTokenHint').innerHTML = github
    ? '创建：<a href="https://github.com/settings/tokens" target="_blank" rel="noopener">GitHub → Settings → Developer settings → Tokens</a>（选 <b>Classic</b>，勾选 <b>gist</b> 权限），仅保存在本机浏览器'
    : '还没有？<a href="https://gitee.com/profile/personal_access_tokens" target="_blank" rel="noopener">去 Gitee 创建私令牌 →</a>（勾选 gists 权限，仅保存在本机浏览器）';
  $('#syncToken').placeholder = github ? 'ghp_xxxxxxxx 或 github_pat_xxxxxxxx' : 'gtp_xxxxxxxx';
}

function fillSyncDialog() {
  const s = state.data.settings.sync;
  $('#syncType').value = s.type;
  $('#syncToken').value = s.token || '';
  $('#syncGistId').value = s.gistId || '';
  $('#syncFile').value = s.filename || DATA_FILE;
  $('#syncAuto').checked = !!s.autoSync;
  updateSyncBrandUI(s.type);
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
  if (!isGistType(s.sync.type)) {
    el.textContent = t('当前数据仅保存在本机浏览器。');
    return;
  }
  const platform = s.sync.type === 'github-gist' ? 'GitHub' : 'Gitee';
  el.textContent = `${platform} Gist：${s.sync.gistId || t('尚未创建')}　${t('上次同步')}：${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : t('从未')}`;
}

async function renderBackups() {
  const list = $('#backupList');
  const arr = await getBackups();
  list.innerHTML = '';
  if (!arr.length) { list.innerHTML = '<li><span class="bt">' + t('暂无备份节点') + '</span></li>'; return; }
  arr.forEach((b, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="bt">' + new Date(b.t).toLocaleString() + '</span>' +
      '<button type="button" class="btn">' + t('恢复') + '</button><button type="button" class="btn">' + t('删除') + '</button>';
    const [btnRestore, btnDel] = li.querySelectorAll('button');
    btnRestore.addEventListener('click', () => restoreBackup(i));
    btnDel.addEventListener('click', async () => {
      const arr2 = await getBackups(); arr2.splice(i, 1);
      await idbPut(IDB_BACKUPS, arr2);
      renderBackups();
    });
    list.append(li);
  });
}

async function restoreBackup(i) {
  const arr = await getBackups();
  const b = arr[i];
  if (!b) return;
  if (!(await uiConfirm(t('恢复'), t('恢复到 {n} 的备份？当前数据会被覆盖。', new Date(b.t).toLocaleString())))) return;
  saveBackupNode();
  await getBackups(); // 等当前态快照落库，再行覆盖
  const keepSync = state.data.settings.sync;
  state.data = buildData(b.payload, keepSync);
  state.page = 0;
  persist();
  renderAll();
  renderBackups();
  toast(t('已恢复到 {n}', new Date(b.t).toLocaleString()));
}

function bindSyncDialog() {
  $('#btnBackupNow').addEventListener('click', () => {
    saveBackupNode();
    renderBackups();
    toast(t('已创建备份节点'));
  });
  $('#syncType').addEventListener('change', () => updateSyncBrandUI($('#syncType').value));
  $('#syncPickGist').addEventListener('click', renderGistList);
  $('#syncPull').addEventListener('click', async () => {
    try {
      saveSyncCfg();
      if (!isGistType(state.data.settings.sync.type)) { toast(t('请先选择 Gist 云端同步方式'), 'error'); return; }
      if (!state.data.settings.sync.gistId) { toast(t('请先填写 Gist ID 或推送到云端创建'), 'error'); return; }
      await pullCloud();
      fillSyncDialog();
    } catch (e) { toast(t('拉取失败：') + e.message, 'error'); }
  });
  $('#syncPush').addEventListener('click', async () => {
    try {
      saveSyncCfg();
      const cfg = state.data.settings.sync;
      if (isGistType(cfg.type) && !cfg.gistId && !(await uiConfirm(t('推送到云端'), t('未填写 Gist ID，将新建一个云端 Gist，继续？')))) return;
      await pushCloud();
      fillSyncDialog();
    } catch (e) { toast(t('推送失败：') + e.message, 'error'); }
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
        state.data = buildData(payload, keepSync);
        state.page = 0;
        persist();
        renderAll();
        toast(t('已导入 {n} 个网址', state.data.sites.length));
      } catch (err) { toast(t('导入失败：') + err.message, 'error'); }
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
  const toggleEngMenu = e => { e.stopPropagation(); toggleEngineMenu(); };
  $('#engineLogo').addEventListener('click', toggleEngMenu);
  $('.icon-dow').addEventListener('click', toggleEngMenu);

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
  bindDirectory();

  // 壁纸为本地图片时从 IndexedDB 恢复显示
  applyWallpaperUpload();

  // 图标源失败时自动切换下一个源（document 级 capture 一处接管所有容器的 img error）
  document.addEventListener('error', e => {
    if (e.target.tagName === 'IMG') advanceIcon(e.target);
  }, true);

  // 自绘确认弹窗：确定 → true；取消/遮罩/Esc（close 事件）→ false
  $('#cfOk').addEventListener('click', () => {
    const r = cfResolve; cfResolve = null;
    $('#dlgConfirm').close();
    r && r(true);
  });
  $('#dlgConfirm').addEventListener('close', () => {
    if (cfResolve) { const r = cfResolve; cfResolve = null; r(false); }
  });

  // dialog：点击遮罩或 × 关闭
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  });

  // 键盘
  document.addEventListener('keydown', e => {
    if (gridMgr.isActive()) return; // 拖拽进行中屏蔽一切快捷键，避免打断拖拽状态机
    if (e.key === 'Escape') {
      // 分层关闭：一次只关最上层浮层，避免误伤填了一半的表单或正在整理的桌面
      if (document.querySelector('#dlgConfirm').open) { document.querySelector('#dlgConfirm').close(); return; }
      if (!$('#ctxMenu').hidden) { closeCtxMenu(); return; }
      if (!$('#sugDrop').hidden) { hideSug(); return; }
      if (!$('#editPanel').hidden) { closeSiteDialog(); return; }
      if (!$('#iconFind').hidden) { closeIconFind(); return; }
      if (!$('#engineMenu').hidden) { toggleEngineMenu(false); return; }
      if (!$('#folderView').hidden) { closeFolder(); return; }
      if (!$('#sidePanel').hidden) { closePanel(); return; }
      if (state.editMode) setEditMode(false); // 最底层：退出整理
      return;
    }
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
    // E：进入/退出整理（编辑）模式
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      toggleEditMode();
    }
    // 浮层（文件夹 / 编辑面板 / 抽屉 / 搜索浮层）打开时不响应翻页，避免误翻底层网格
    if (!typing && $('#iconFind').hidden && $('#folderView').hidden && $('#editPanel').hidden && $('#sidePanel').hidden) {
      if (e.key === 'ArrowRight') flipPage(1);
      if (e.key === 'ArrowLeft') flipPage(-1);
    }
  });

  // 搜索图标浮层
  $('#iconFindInput').addEventListener('input', e => filterCards(e.target.value));
  $('#iconFindInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#gridPages .card:not(.find-hide)');
    if (first) { closeIconFind(); first.click(); }
  });
  $('#iconFind').addEventListener('click', e => { if (e.target === e.currentTarget) closeIconFind(); });

  // 文件夹浮层：点标题重命名（与合成新文件夹后的自动命名共用逻辑）
  $('#fvTitle').addEventListener('click', () => startFolderRename());
  // 文件夹名常驻输入框的委托（元素可被重渲，委托永在）
  const fvNameTarget = e => e.target && e.target.matches && e.target.matches('input.fv-name') ? e.target : null;
  $('#fvTitle').addEventListener('input', e => {
    const inp = fvNameTarget(e);
    if (!inp) return;
    if (inp.value.length > 80) inp.value = inp.value.slice(0, 80); // inftab：超长即时截断回写
    const f = state.data.sites.find(x => x.id === state.openFolderId);
    if (f) { f.name = inp.value; persistSoon(); }
  });
  $('#fvTitle').addEventListener('focusout', e => {
    if (!fvNameTarget(e)) return;
    const f = state.data.sites.find(x => x.id === state.openFolderId);
    if (f) { f.name = e.target.value; persist(); } // 防抖收口：失焦立即落盘
  });
  $('#fvTitle').addEventListener('keydown', e => {
    if (!fvNameTarget(e)) return;
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      const f = state.data.sites.find(x => x.id === state.openFolderId);
      if (f) e.target.value = f.name;
      e.target.blur();
    }
    e.stopPropagation(); // 面板内不触发全局快捷键
  });
  $('#fvClose').addEventListener('click', closeFolder);
  $('#folderMask').addEventListener('click', closeFolder);

  // 滚轮翻页：整页任意位置生效（翻页后网格高度会变化，仅监听网格会导致"滚不回来"）；
  // 兼容 Firefox 的行滚动模式（deltaMode=1 时 deltaY 按行计）。拖拽中不翻页——避免打断悬停判定
  let wheelAt = 0;
  document.addEventListener('wheel', e => {
    if (gridMgr.isActive()) return;
    const now = Date.now();
    if (now - wheelAt < 450 || Math.abs(e.deltaY) < 20) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && t.closest('#sidePanel, dialog, .edit-panel, .folder-view, .engine-menu, .sug-drop, .iconfind-mask, input, textarea, select')) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    // 循环翻页：末页继续下滚回首页，首页上滚到末页
    if (dy > 20 || dy < -20) { flipPage(dy > 0 ? 1 : -1); wheelAt = now; }
  }, { passive: true });

  /* ---------- 图标拖拽（grid-manager · inftab 原版模型：落点区命中 + 配对门 + 停顿计时数据排序） ----------
     全部移动发生在拖动中且是真实数据操作：缝隙/页尾停 200ms → onSort 落库重渲（id-FLIP 让位）；
     压住图标中心 350ms → onCenter 建夹/移入 → +500ms onPanel 弹夹。松手基本 no-op（inftab 同） */
  let mergedFolderId = null; // 本次拖拽刚合并的夹：+500ms onPanel 弹开它
  let asideLoop = null; // inftab _captureToChange 窥视循环：白罩淡入(300ms)→翻页→淡出(600ms)→驻留继续
  const stopAsideLoop = () => {
    if (!asideLoop) return;
    clearTimeout(asideLoop.timer);
    asideLoop.el.style.transition = 'opacity 200ms ease';
    asideLoop.el.style.opacity = '0';
    asideLoop = null;
  };
  let fvExitTimer = null, fvExitOrigin = null; // inftab dragFolderOragin：面板会话内首次出界点（持久）

  /** 拖出文件夹面板（inftab dragOutFolder 逐句移植）：
   *  · 判定域 = 成员网格区（icon-box-wrap），无余量；
   *  · origin 只在面板会话内首次出界时设置（重进面板不清除、面板收起才清除）；
   *  · 定时器闭包捕获「布防时刻」坐标，触发时比较 布防点 vs origin——
   *    首个 250ms 窗口必然零位移（无害空放），挪开瞬间面板绝不关闭；
   *    只有持续在界外（约第二个窗口起）且距 origin >20px 才收起面板。
   *    → 把图标运进弹窗的过渡时间天然受保护 */
  const folderExitOnFrame = (entry, p) => {
    const fv = $('#folderView');
    if (fv.hidden) {
      if (fvExitTimer) { clearTimeout(fvExitTimer); fvExitTimer = null; }
      fvExitOrigin = null; // inftab：面板收起时重置 dragFolderOragin
      return false;
    }
    const g = $('#fvGrid').getBoundingClientRect();
    const inside = p.x >= g.left && p.x <= g.right && p.y >= g.top && p.y <= g.bottom;
    if (inside) {
      if (fvExitTimer) { clearTimeout(fvExitTimer); fvExitTimer = null; }
      return false; // 域内：清定时器（origin 保留，inftab 同）
    }
    if (fvExitOrigin === null) fvExitOrigin = { x: p.x, y: p.y };
    if (fvExitTimer === null) {
      const cx = p.x, cy = p.y; // inftab：闭包捕获布防时刻坐标
      fvExitTimer = setTimeout(() => {
        fvExitTimer = null;
        if (!gridMgr.isActive() || $('#folderView').hidden) return;
        if (Math.abs(cx - fvExitOrigin.x) > 20 || Math.abs(cy - fvExitOrigin.y) > 20) closeFolder();
      }, 250);
    }
    return false; // 面板外照常做桌面落点判定（inftab：调度不因面板冻结）
  };

  /** 把成员从来源夹中摘出（parent 清空、硬分页转移、随后触发夹折叠检查） */
  const detachMember = (memberId, fromId) => {
    const m = state.data.sites.find(x => x.id === memberId);
    if (!m || m.parent !== fromId) return null;
    transferHardBreak(state.data.sites, m);
    m.parent = '';
    m.h = 0;
    collapseFolderIfSingle(fromId);
    return m;
  };

  /** inftab sortSites 的扁平化等价：dropIndexs=[页,槽]（槽位含被拖槽）+ area →
   *  moveTopEntry 的「排除被拖项」全局序号。空页 → hardBreak（新页首格） */
  const desktopSortTarget = (entry, page, slot, area) => {
    const pages = computePages();
    const list = pages[page];
    if (!list) return null;
    const baseOthers = pages.slice(0, page).reduce((n, pl) => n + pl.filter(x => x !== entry).length, 0);
    const othersLen = list.filter(x => x !== entry).length;
    if (!list.length || slot >= list.length) {
      return { idx: baseOthers + othersLen, hard: !list.length && page > 0, page };
    }
    const target = list[Math.max(0, Math.min(slot, list.length - 1))];
    let k = 0;
    for (const e of list) { if (e === target) break; if (e !== entry) k++; }
    return { idx: baseOthers + k + (area === 'right' ? 1 : 0), hard: false, page };
  };

  /** 压住图标中心 350ms（inftab createFolder/intoFolder 原版）：数据真实落库——
   *  新夹默认名「文件夹」、落在目标位置，两枚图标成为成员；新夹卡抖动（shake-item）；
   *  ghost 仍是原图标。+500ms 弹夹由 onPanel 承担 */
  const onCenter = (entry, hitEl, target) => {
    if (!entry || !target || entry.id === target.id || entry.folder) return false;
    if (mergedFolderId) return false; // 已并入夹：本次拖拽不再二连并（inftab dropId 哨兵语义）
    let folderId = null;
    if (target.folder) {
      if (entry.parent === target.id) return false; // 拖回自己的夹：无意义
      if (!moveIntoFolder(state.data.sites, entry.id, target.id)) return false;
      folderId = target.id;
    } else {
      if (entry.parent) detachMember(entry.id, entry.parent); // 面板拖出的成员压桌面图标：先脱离原夹
      const folder = mergeTopEntries(state.data.sites, entry.id, target.id, uid(), t('文件夹'));
      if (!folder) return false;
      folderId = folder.id;
    }
    mergedFolderId = folderId;
    rebalancePages(state.data.sites, perPage());
    persist();
    renderGrid(); // 网格里出现真实文件夹卡；拖影保持原图标，不换持
    const born = $(`#gridPages .grid-page .card[data-id="${folderId}"]`);
    if (born) {
      born.classList.add('merge-born'); // 合并落库抖动（inftab shake-item）
      setTimeout(() => born.classList.remove('merge-born'), 700);
    }
    return true;
  };

  /** 合并成功 +500ms（inftab _handleFolderStatus 时机）：面板从文件夹卡的位置 zoom 展开。
   *  松手后仍生效（合并与弹面板之间松手：成员留在夹内，面板照常弹出，不撤销合并） */
  const onPanel = () => {
    if (!mergedFolderId) return;
    const fid = mergedFolderId;
    mergedFolderId = null; // 消费即清（新拖拽开始时也会清，双保险）
    const f = state.data.sites.find(x => x.id === fid);
    if (!f) return;
    const card = $(`#gridPages .grid-page:not(.off) .card[data-id="${f.id}"]`);
    openFolder(f, card || undefined);
    gridMgr.ghostScale(0.8); // inftab：面板弹出时拖影缩至 0.8
  };

  /** 松手/Esc（inftab 20632 原版）：数据早已在拖动中落位，这里只做两类兜底——
   *  ① 成员被拖出面板（面板已收起）→ 移出到当前页尾（dragToEnd）；
   *  ② 顶层项的数据页 ≠ 当前可见页 → 挪到当前页尾 */
  const finishDrag = ctx => {
    const e = ctx.entry;
    if (e && !e.folder) {
      if (e.parent) {
        if (mergedFolderId) {
          // 本次拖拽刚合并（面板 +500ms 待弹）：松手不撤销（inftab dragStage='merge' 保护语义）
        } else if (state.openFolderId !== e.parent) { // 面板已收起 = 已拖出：移出到当前页尾
          detachMember(e.id, e.parent);
          const pages = computePages();
          const base = pages.slice(0, state.page).reduce((n, pl) => n + pl.filter(x => x !== e).length, 0);
          const len = (pages[state.page] || []).filter(x => x !== e).length;
          moveEntryToIndex(e.id, base + len, { hardBreak: !len && state.page > 0, page: state.page });
          toast(t('已移出到桌面'));
        }
        // 面板还开着：成员留在夹内原位（inftab：松手无操作）
      } else {
        const pages = computePages();
        const p = pages.findIndex(pl => pl.includes(e));
        if (p !== -1 && p !== state.page) {
          const baseOthers = pages.slice(0, state.page).reduce((n, pl) => n + pl.filter(x => x !== e).length, 0);
          const len = (pages[state.page] || []).filter(x => x !== e).length;
          moveEntryToIndex(e.id, baseOthers + len, { hardBreak: !len && state.page > 0, page: state.page });
        }
      }
    }
    // mergedFolderId 不在此清：合并与弹面板之间松手时，+500ms 的 onPanel 仍要弹（inftab 同）
    state.edgePageCreated = false;
  };

  desktopGrid = gridMgr.registerGrid({
    id: 'desktop',
    pageEl: () => $('#gridPages .grid-page:not(.off)'),
    hitArea: () => document.body, // 拖出文件夹后，屏幕任意处都是桌面落点
    canDrag: el => el.dataset.id !== undefined,
    entryOf: el => state.data.sites.find(x => x.id === el.dataset.id) || null,
    edgeFlip: true,
    onDragStart: () => { mergedFolderId = null; }, // 新拖拽：上次合并的待弹面板状态作废
    asideWidths: () => {
      // inftab：仅一页时不显示边缘区（r.length < 2 hidden）
      if (state.pages < 2) return { left: 0, right: 0 };
      // 边缘条只占网格内容（卡片实际边界）之外的空白，绝不压住最外列图标。
      // 注意 .grid-page 容器是全宽的（卡片内部居中），必须按卡片矩形算
      const cs = $$('#gridPages .grid-page:not(.off) .card[data-id]');
      if (!cs.length) return { left: 40, right: 40 };
      let l = Infinity, r = -Infinity;
      cs.forEach(c => { const b = c.getBoundingClientRect(); l = Math.min(l, b.left); r = Math.max(r, b.right); });
      return { left: Math.round(l - 6), right: Math.round(innerWidth - r - 6) };
    },
    // inftab _captureToChange 原版节奏：进入边缘区 → 白罩淡入 .05→.3（300ms）→ 翻页 →
    // 淡出回 .05（600ms）→ 指针仍驻留则循环继续（约 900ms/页）；离开即停（onAsideLeave）
    onAside: (entry, dir) => {
      stopAsideLoop();
      const el = document.querySelector(dir < 0 ? '.drag-aside.left' : '.drag-aside.right');
      if (!el) return;
      asideLoop = { dir, timer: 0, el };
      const flip = () => {
        const next = state.page + dir;
        if (next < 0) return;
        if (next > state.pages - 1) {
          if (!state.edgePageCreated) { // 末页外缘：新建一页（一次拖拽最多一页）
            state.edgePageCreated = true;
            appendDragPage();
            showPage(state.pages - 1);
            toast(t('已新增一页'));
          }
          return;
        }
        showPage(next);
      };
      const step = () => {
        if (!asideLoop) return;
        el.style.transition = 'opacity 300ms ease';
        el.style.opacity = '.3';
        asideLoop.timer = setTimeout(() => {
          if (!asideLoop) return;
          flip();
          el.style.transition = 'opacity 600ms ease';
          el.style.opacity = '.05';
          asideLoop.timer = setTimeout(step, 620);
        }, 310);
      };
      el.style.transition = 'none';
      el.style.opacity = '.05';
      step();
    },
    onAsideLeave: () => stopAsideLoop(),
    onFrame: folderExitOnFrame,
    onSort: (entry, dropIndexs, area) => {
      if (!entry) return false;
      if (entry.parent) {
        // 面板拖出的成员在桌面落点停顿（inftab sortSites 3→2 维）：先按落点记下目标身份，
        // 再脱离原夹（折叠/解散会移动顶层位置，序号必须脱离后重算），最后落到目标旁
        const fromId = entry.parent;
        const list0 = (computePages()[dropIndexs[0]] || []);
        const targetEntry = list0[Math.min(dropIndexs[1] ?? 0, Math.max(0, list0.length - 1))];
        detachMember(entry.id, fromId);
        let target = null;
        if (targetEntry && targetEntry !== entry) {
          let k = 0;
          for (const pl of computePages()) {
            let hit = false;
            for (const e2 of pl) {
              if (e2 === entry) continue;
              if (e2 === targetEntry) { hit = true; break; }
              k++;
            }
            if (hit) break;
            // 目标不在本页：累计本页其余项后继续（k 已在循环内累计）
          }
          target = k + (area === 'right' ? 1 : 0);
        }
        moveEntryToIndex(entry.id, target !== null ? target : Infinity, target !== null ? { page: dropIndexs[0] } : {});
        if (state.openFolderId === fromId) {
          if (state.data.sites.some(x => x.id === fromId)) renderFolderView();
          else closeFolder();
        }
        return true;
      }
      const m = desktopSortTarget(entry, dropIndexs[0], dropIndexs[1], area);
      if (!m) return false;
      moveEntryToIndex(entry.id, m.idx, { hardBreak: !!m.hard, page: m.page });
      return true;
    },
    onCenter,
    onPanel,
    onDrop: finishDrag,
    onCancel: ctx => { finishDrag(ctx); closeFolder(); }, // 实时模型：中断保留已发生的排布
  });

  folderGrid = gridMgr.registerGrid({
    id: 'folder',
    sortableOnly: true, // 夹内只有排序语义（inftab：夹内长停不升级合并）
    pageEl: () => (state.openFolderId && !$('#folderView').hidden ? $('#fvGrid') : null),
    canDrag: el => el.dataset.id !== undefined,
    entryOf: el => state.data.sites.find(x => x.id === el.dataset.id) || null,
    fromCtx: () => state.openFolderId,
    // 拖出面板 = 仅收面板（inftab dragOutFolder）：成员仍在夹内，后续桌面落点/松手才移出
    onFrame: folderExitOnFrame,
    onSort: (entry, dropIndexs, area) => {
      // 夹内排序（inftab 3 维 indexs 的等价）：槽位含被拖槽 → 排除后的成员序号
      if (!entry || !entry.parent) return false;
      const from = entry.parent;
      const members = state.data.sites.filter(x => x.parent === from);
      const slot = Math.max(0, Math.min(dropIndexs[0] ?? 0, members.length - 1));
      const target = members[slot];
      let k = 0;
      for (const m of members) { if (m === target) break; if (m !== entry) k++; }
      if (reorderFolderMember(state.data.sites, from, entry.id, k + (area === 'right' ? 1 : 0))) {
        persist();
        renderGrid(); // 顺带刷新桌面文件夹缩略块
        renderFolderView();
        return true;
      }
      return false;
    },
    onDrop: finishDrag,
    onCancel: ctx => { finishDrag(ctx); closeFolder(); },
  });

  // 翻页箭头
  $('#gridPrev').addEventListener('click', () => flipPage(-1));
  $('#gridNext').addEventListener('click', () => flipPage(1));

  addEventListener('resize', debounce(renderGrid, 200));
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
  const sources = sourceChainFor(entry[1], 64);
  if (!sources.length) return letter;
  return `${letter}<img src="${escapeHtml(sources[0])}" referrerpolicy="no-referrer" data-sources="${escapeHtml(sources.join('|'))}" data-icache="${escapeHtml(host)}" alt="" loading="lazy">`;
}

function renderDirCats() {
  const box = $('#dirCats');
  box.innerHTML = '';
  ['全部', ...SITE_DIRECTORY.map(c => c.cat)].forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dir-cat' + (cat === dirCat && !dirQ ? ' active' : '');
    b.textContent = t(cat);
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
  if (!entries.length) { box.innerHTML = '<p class="dir-empty">' + t('没有匹配的网站') + '</p>'; return; }
  entries.forEach(([name, url]) => {
    const added = existing.has(url);
    const card = document.createElement('div');
    card.className = 'dir-card';
    card.innerHTML = `<span class="dir-icon">${dirIconHTML([name, url])}</span>
      <span class="dir-info"><b>${escapeHtml(name)}</b><i>${escapeHtml(url.replace(/^https?:\/\//, ''))}</i></span>
      <button type="button" class="dir-add" ${added ? 'disabled' : ''}>${added ? t('已添加') : t('添加')}</button>`;
    card.querySelector('.dir-add').addEventListener('click', e => {
      addTopLevelSite({ id: uid(), name, url, icon: '', badge: false });
      persist();
      e.target.disabled = true;
      e.target.textContent = t('已添加');
      renderGrid();
      closePanel(); // inftab submitSite 后 this.close()：关抽屉露出跳转后的落位页，图标就在眼前
      toast(t('已添加「{n}」', name));
    });
    box.append(card);
  });
}

/* ================= 本地壁纸上传（IndexedDB） ================= */
/** IndexedDB 连接复用：整个会话只 open 一次（此前每次读写都重新 open，首载约 45 图标即 45 次连接） */
let idbPromise = null;
function idb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const rq = indexedDB.open('nav-page', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  return idbPromise;
}

function idbPut(key, value) {
  return idb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function idbGet(key) {
  return idb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
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

/* ================= 历史备份节点（本机快照，存 IndexedDB：不与主数据挤 localStorage 5MB 配额） ================= */
const BACKUP_KEY = 'nav-backups'; // 旧 localStorage 键（一次性迁移用）
const IDB_BACKUPS = 'backups';

async function getBackups() {
  // 旧 localStorage 快照一次性迁入 IDB 后清除
  let arr = (await idbGet(IDB_BACKUPS)) || [];
  try {
    const legacy = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      const seen = new Set(arr.map(b => b.t));
      arr = [...legacy.filter(b => b && !seen.has(b.t)), ...arr];
      await idbPut(IDB_BACKUPS, arr.slice(0, 10));
    }
    localStorage.removeItem(BACKUP_KEY);
  } catch { /* 忽略迁移失败 */ }
  return Array.isArray(arr) ? arr : [];
}

function saveBackupNode() {
  // 快照同步捕获（此时 state.data 尚未被覆盖），写入异步进行
  const snapshot = { t: Date.now(), payload: cloudPayload() };
  getBackups().then(arr => {
    arr.unshift(snapshot);
    return idbPut(IDB_BACKUPS, arr.slice(0, 10));
  }).catch(() => {});
}

/** 单源加载超时即切换下一源，避免某个图源挂起长时间卡住整条回退链 */
const imgTimers = new WeakMap();
// 会话级死源黑名单：超时过的图源主机直接跳过（本网络不可达的源不该让每个图标都付超时代价）
const deadIconHosts = new Set();
function armImgTimeout(img, ms = 3000) {
  if (img.complete) return;
  clearTimeout(imgTimers.get(img));
  imgTimers.set(img, setTimeout(() => {
    if (!img.isConnected || img.complete) return;
    try { deadIconHosts.add(new URL(img.src).host); } catch { /* 忽略 */ }
    advanceIcon(img);
  }, ms));
}

function advanceIcon(img) {
  const list = (img.dataset.sources || '').split('|').filter(Boolean);
  const i = list.indexOf(img.getAttribute('src') || '');
  if (i >= 0 && i + 1 < list.length) { img.src = list[i + 1]; armImgTimeout(img); }
  else {
    img.remove();
    const ph = img.parentElement && img.parentElement.querySelector('.ph');
    if (ph) ph.style.display = ''; // 全源失败：字母头像回归兜底
    const iconEl = ph && ph.closest('.icon');
    if (iconEl) { iconEl.classList.remove('icon-tile'); iconEl.style.background = ''; } // 撤掉色板（字母头像自带底色）
  }
}

function bindDirectory() {
  $('#dirSearch').addEventListener('input', e => { dirQ = e.target.value.trim(); renderDirList(); });
}

/** 加载项目内置数据（data/default-data.json），覆盖当前站点与外观 */
async function loadDefaultData() {
  if (!(await uiConfirm(t('内置数据'), t('加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。')))) return;
  try {
    const r = await fetch('data/default-data.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const payload = await r.json();
    if (!Array.isArray(payload.sites)) throw new Error('数据格式不正确');
    saveBackupNode();
    const keepSync = state.data.settings.sync;
    state.data = buildData(payload, keepSync);
    state.page = 0;
    persist();
    renderAll();
    toast(t('已加载内置数据（{n} 个网站）', state.data.sites.length));
  } catch (e) { toast(t('加载失败：') + e.message, 'error'); }
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
      state.data = buildData(imported);
      if (!state.data.settings.engines.length) state.data.settings.engines = seedEngines();
    } else {
      state.data = { version: 1, sites: seedSites(), settings: seedSettings() };
    }
    persistLocal();
  } else {
    state.data.settings = normalizeSettings(state.data.settings);
    if (!Array.isArray(state.data.sites)) state.data.sites = [];
    state.data.sites = sanitizeSites(state.data.sites); // 结构不变量：孤儿回桌面、h 仅顶层
    persistLocal();
  }
  bindEvents();
  renderAll();
  syncedUpdateAt = state.data.updatedAt || 0; // 初始加载即基线：无未推送修改
  maybeAutoBingDaily().catch(() => {});
}

init().catch(err => { window.__initErr = err.stack || String(err); toast(t('初始化失败：') + err.message, 'error'); });
