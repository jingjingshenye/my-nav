import { createAdapter, DATA_FILE, LocalAdapter } from './adapters.js?v=20260924c';
import { setLang, t, applyI18n } from './i18n.js?v=20260924c';
import { uid, TYPES, ENGINE_CATALOG, cloneEngine, seedEngines, seedSettings, seedSites, normalizeSettings, buildData } from './domain/data.js?v=20260924c';
import { removeTopEntry, moveTopEntry, moveIntoFolder, mergeTopEntries, dissolveFolder, sanitizeSites } from './domain/pages.js?v=20260924c';

/* ================= 小工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const SVG_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
const SVG_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5a2 2 0 012-2h4l2 2.5h7a2 2 0 012 2v8.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/></svg>';
const SVG_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';

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
  dragging: false, // Sortable 拖拽进行中
  dragId: null, // 拖拽中的条目 id
  dropFolderId: null, // 拖拽悬停的文件夹 id
  dropMergeId: null, // 拖拽悬停的普通图标 id（松手合成文件夹，手机桌面式）
  edgePageCreated: false, // 本次拖拽是否已通过末页边缘新建过页（一次拖拽最多新建一页）
  pendingNewPage: false, // 拖到「＋ 新建页」上的标记
  dropPlanIdx: null, // 拖拽落点计划（松手后按此索引精确落位，拖动过程中图标不再互相挤动）
  dropPlanHard: false, // 落点在空页上：落位时附带硬分页，保住「移到该页」的意图
  extraPages: 0, // 编辑态手动新增的空页数（退出编辑自动回收）
  layout: { cols: 6, rows: 3, card: 98 },
};

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
  const { version, sites, settings } = state.data;
  // Token 属于本机凭据，绝不入云
  return { version, sites, settings: { ...settings, sync: { ...settings.sync, token: '' } } };
};

const isGistType = t => t === 'gitee-gist' || t === 'github-gist';

const canAutoSync = () => {
  const s = state.data.settings.sync;
  return isGistType(s.type) && s.autoSync && s.token && s.gistId;
};

function persist() {
  persistLocal();
  if (canAutoSync()) queueCloudPush();
}

const queueCloudPush = debounce(() => {
  pushCloud(false).catch(err => toast(t('自动同步失败：') + err.message, 'error'));
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
  persistLocal();
  updateSyncStatus();
  if (notify) toast(t('已推送到云端'));
}

async function pullCloud(notify = true) {
  const cfg = { ...state.data.settings.sync };
  const adapter = createAdapter(cfg);
  const payload = await adapter.load();
  if (!payload || !Array.isArray(payload.sites)) throw new Error('云端数据格式不正确');
  saveBackupNode(); // 拉取覆盖前自动留一份本地快照
  const keepSync = state.data.settings.sync; // 本机的同步凭据不被云端覆盖
  state.data = buildData(payload, keepSync);
  state.page = 0;
  persistLocal();
  renderAll();
  if (notify) toast(t('已从云端拉取数据'));
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

function openWallMenu(e) {
  const m = $('#wallMenu');
  m.innerHTML = '';
  [
    ['立即备份', () => { saveBackupNode(); toast(t('已创建本地备份节点')); }],
    ['编辑壁纸', () => { closePanel(); openPanel('settings'); setTimeout(() => $('#wpGrid').scrollIntoView({ block: 'center', behavior: 'smooth' }), 80); }],
    ['随机壁纸', () => randomWallpaper()],
    ['收藏当前壁纸', () => favoriteWallpaper()],
    ['下载当前壁纸', () => downloadWallpaper()],
    ['搜索图标', () => openIconFind(), 'Ctrl + F'],
    ['关于', () => $('#dlgAbout').showModal()],
  ].forEach(([label, fn, sc]) => {
    const b = document.createElement('button');
    b.innerHTML = escapeHtml(t(label)) + (sc ? `<span class="sc">${sc}</span>` : '');
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
 *  顺序兼顾国内可达性与清晰度：聚合源 → 站点自身(含 apple-touch 高清) → Clearbit/unavatar 等品牌源 → 海外聚合源 */
function sourceChainFor(url, size = 128) {
  let host;
  try { host = new URL(url).host; } catch { return []; }
  const bare = host.replace(/^www\./, '');
  const list = [
    `https://favicon.im/${host}?larger=true`,
    `https://${host}/favicon.ico`,
    `https://${host}/apple-touch-icon.png`,
    `https://logo.clearbit.com/${host}`,
    `https://unavatar.io/${host}?fallback=false`,
    `https://api.faviconkit.com/${bare}/144`,
    `https://www.google.com/s2/favicons?domain=${bare}&sz=${size}`,
    `https://icons.duckduckgo.com/ip3/${bare}.ico`,
    `https://favicon.im/${bare}?larger=true`,
  ];
  return [...new Set(list)];
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
  return `${ph}<img src="${escapeHtml(sources[0])}" data-sources="${escapeHtml(sources.join('|'))}" data-icache="${escapeHtml(host)}" alt="" loading="lazy" draggable="false">`;
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
        // 记住的可用源：直接从它开始；保留回退链，万一这次失效还能继续降级
        if (img.dataset.sources.split('|').includes(rec.u)) { img.src = rec.u; iconCacheDone.add(host); }
      }
    }).catch(() => {});
  });
}

// 成功加载的远程图标异步入库；每站点每会话只记一次
document.addEventListener('load', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.dataset.sources) clearTimeout(imgTimers.get(img)); // 加载成功，解除超时
  if (!img.dataset.icache || !img.dataset.sources) return;
  if (!/^https?:/.test(img.src)) return; // 已是本地 blob 缓存
  const host = img.dataset.icache;
  if (iconCacheDone.has(host)) return;
  iconCacheDone.add(host);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000); // 抓取超时：退化为只记源地址
  fetch(img.src, { mode: 'cors', signal: ctl.signal }).then(r => (r.ok ? r.blob() : Promise.reject(new Error('bad status')))).then(b => {
    clearTimeout(timer);
    if (!b || !b.size || b.size > 300 * 1024) return Promise.reject(new Error('skip size'));
    return idbPut('icache:' + host, b);
  }).catch(() => { clearTimeout(timer); idbPut('icache:' + host, { u: img.src }).catch(() => {}); });
}, true);

function cardEl(entry, idx = 0) {
  const a = document.createElement('a');
  a.className = 'card' + (entry.folder ? ' folder-card' : '');
  // 编辑态不带 href：避免浏览器悬停时的链接预览（左下角长文本），也杜绝编辑中误触导航
  if (!state.editMode && entry.url) {
    a.href = entry.url;
    a.target = state.data.settings.openSitesNewTab ? '_blank' : '_self';
    if (a.target === '_blank') a.rel = 'noopener';
  }
  a.dataset.id = entry.id;
  a.title = entry.url || entry.name;
  a.style.setProperty('--i', idx);
  const fc = state.data.settings.fontColor;
  const labelColor = fc === 'rainbow' ? tint(entry.name) : (fc || '#ffffff');
  const iconMarkup = entry.folder ? folderTileHTML(entry) : iconHTML(entry);
  const siteBadge = !entry.folder && entry.badge ? '<i class="badge"></i>' : '';
  const kidCount = entry.folder ? state.data.sites.filter(x => x.parent === entry.id).length : 0;
  const countBadge = kidCount ? `<i class="folder-count">${kidCount}</i>` : '';
  a.innerHTML = `
    <span class="icon">${iconMarkup}${siteBadge}${countBadge}
      ${state.editMode ? `<button class="edit-go" title="编辑">${SVG_PENCIL}</button><button class="del" title="${entry.folder ? '解散文件夹' : '删除'}">${SVG_X}</button>` : ''}
    </span>
    <span class="label" style="color:${labelColor}">${escapeHtml(entry.name)}</span>`;

  if (state.editMode) {
    a.addEventListener('click', e => {
      e.preventDefault();
      if (entry.folder) openFolder(entry); else openSiteDialog(entry);
    });
  } else if (entry.folder) {
    a.addEventListener('click', e => { e.preventDefault(); openFolder(entry); });
  }

  // 对齐 inftab：右键图标进入编辑状态（×标记）；已在编辑状态时右键 = 直接打开编辑面板
  a.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!state.editMode) setEditMode(true);
    else openSiteDialog(entry);
  });
  const editGo = $('.edit-go', a);
  if (editGo) editGo.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSiteDialog(entry); });
  const del = $('.del', a);
  if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); removeSite(entry); });
  return a;
}

/** 文件夹卡片图标：子站点四宫格缩略（对齐 iOS 文件夹）。角标由 cardEl 统一渲染 */
function folderTileHTML(entry) {
  const kids = state.data.sites.filter(x => x.parent === entry.id);
  if (!kids.length) return `<span class="folder-empty">${SVG_FOLDER}</span>`;
  return `<span class="folder-tile">${kids.slice(0, 4).map(k => `<span class="mini">${iconHTML(k)}</span>`).join('')}</span>`;
}

/** 编辑态"新建文件夹"入口卡 */
function addFolderEl() {
  const a = document.createElement('a');
  a.className = 'card add-card';
  a.innerHTML = `<span class="icon">${SVG_FOLDER}</span><span class="label">${t('新建文件夹')}</span>`;
  a.addEventListener('click', e => { e.preventDefault(); openSiteDialog(null, { folder: true }); });
  return a;
}

/** 把站点移入文件夹 */
function moveSiteToFolder(siteId, folderId) {
  const folder = state.data.sites.find(x => x.id === folderId);
  if (!moveIntoFolder(state.data.sites, siteId, folderId)) return;
  persist();
  renderGrid();
  toast(t('已移入「{n}」', folder ? folder.name : ''));
}

/** 手机桌面式：把一个图标拖到另一个图标上松手，两者合成一个新文件夹（文件夹落在目标位置） */
function createFolderWith(dragId, targetId) {
  const folder = mergeTopEntries(state.data.sites, dragId, targetId, uid(), t('新建文件夹'));
  if (!folder) return;
  persist();
  renderGrid();
  toast(t('已创建文件夹'));
}

function addCardEl() {
  const a = document.createElement('a');
  a.className = 'card add-card';
  a.innerHTML = `<span class="icon">${SVG_PLUS}</span><span class="label">${t('添加网址')}</span>`;
  a.addEventListener('click', e => { e.preventDefault(); openSiteDialog(null); });
  return a;
}

function renderGrid() {
  const pagesBox = $('#gridPages'), dots = $('#dots');
  computeLayout();
  const entries = state.data.sites.filter(x => !x.parent);
  const pp = perPage();
  // 硬分页（h=1）切组，组内再按每页容量切片——页面构成持久化，删除图标后页面保持稀疏（手机语义）
  const groups = [[]];
  entries.forEach(en => {
    if (en.h && groups[groups.length - 1].length) groups.push([]);
    groups[groups.length - 1].push(en);
  });
  const pageSlices = [];
  groups.forEach(g => { for (let i = 0; i < g.length; i += pp) pageSlices.push(g.slice(i, i + pp)); });
  if (!pageSlices.length) pageSlices.push([]);
  const pageCount = pageSlices.length + (state.editMode ? state.extraPages : 0);
  state.pages = pageCount;
  state.page = Math.max(0, Math.min(state.page, pageCount - 1));

  pagesBox.innerHTML = '';
  for (let p = 0; p < pageCount; p++) {
    const pg = document.createElement('div');
    pg.className = 'grid-page' + (p === state.page ? '' : ' off');
    pg.dataset.page = p;
    pg.style.setProperty('--cols', state.layout.cols);
    pg.style.setProperty('--card', state.layout.card + 'px');
    pg.style.setProperty('--gap-factor', (state.data.settings.layout.gap ?? 100) / 100);
    const slice = pageSlices[p] || [];
    if (slice.length) {
      slice.forEach((en, i) => pg.append(cardEl(en, i)));
    } else if (p === 0 && !state.editMode) {
      pg.innerHTML = '<p class="empty-tip">' + t('这里空空如也，点击右上角菜单 → 「添加网址」开始使用') + '</p>';
    }
    if (p === 0 && state.editMode) { pg.append(addCardEl()); pg.append(addFolderEl()); }
    pagesBox.append(pg);
  }

  dots.innerHTML = '';
  for (let p = 0; p < pageCount; p++) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'dot' + (p === state.page ? ' active' : '');
    d.title = t('第 {n} 页', p + 1);
    d.addEventListener('click', () => showPage(p));
    dots.append(d);
  }
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
    np.addEventListener('dragover', e => { e.preventDefault(); np.classList.add('drop-target'); });
    np.addEventListener('dragleave', () => np.classList.remove('drop-target'));
    np.addEventListener('drop', e => {
      e.preventDefault();
      np.classList.remove('drop-target');
      state.pendingNewPage = true;
      toast(t('已新增一页'));
    });
    dots.append(np);
  }

  pagesBox.classList.toggle('editing', state.editMode);
  showPage(state.page);
  bindSortables();
  hydrateIdbIcons(pagesBox);
  hydrateIconCache(pagesBox);
  applyI18n();
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

/** 把 DOM 中的顶层顺序读回数据（文件夹子站点保持原相对顺序追加在后） */
function syncOrderFromDOM() {
  const topLevel = [];
  $$('#gridPages .grid-page').forEach((pg, pi) => {
    let first = true;
    [...pg.children].forEach(el => {
      if (!el.dataset || !el.dataset.id) return;
      const en = state.data.sites.find(x => x.id === el.dataset.id);
      if (!en) return;
      // 页面构成持久化：每页第一个图标打硬分页标记，其余清除
      if (pi > 0 && first) en.h = 1; else en.h = 0;
      first = false;
      topLevel.push(en);
    });
  });
  const children = state.data.sites.filter(x => x.parent);
  children.forEach(c => { c.h = 0; });
  state.data.sites = [...topLevel, ...children];
}

let sortableInstances = [];
let fvSortable = null;

/** 把文件夹浮层内的成员拖拽顺序写回数据（仅调整该文件夹成员的相对顺序） */
function syncFolderOrderFromDOM(folderId) {
  const ids = $$('#fvGrid .fv-item').map(el => el.dataset.id).filter(Boolean);
  const members = new Map(state.data.sites.filter(x => x.parent === folderId).map(x => [x.id, x]));
  const ordered = ids.map(id => members.get(id)).filter(Boolean);
  const top = state.data.sites.filter(x => !x.parent);
  const others = state.data.sites.filter(x => x.parent && x.parent !== folderId);
  state.data.sites = [...top, ...ordered, ...others];
}
function makeSortable(pg) {
  const ins = new Sortable(pg, {
    group: 'sites',
    animation: 150,
    disabled: !state.editMode,
    draggable: '.card',
    onStart: evt => {
      state.dragging = true;
      state.dragId = evt.item.dataset.id || null;
      state.edgePageCreated = false;
    },
    onEnd: evt => {
      state.dragging = false;
      const id = evt.item.dataset.id;
      const dragged = state.data.sites.find(x => x.id === id);
      if (state.dropFolderId && dragged && !dragged.folder && state.dropFolderId !== id) {
        const target = state.dropFolderId;
        state.dropFolderId = null;
        state.dropMergeId = null;
        moveSiteToFolder(id, target);
        return;
      }
      if (state.dropMergeId && dragged && !dragged.folder && state.dropMergeId !== id) {
        const target = state.dropMergeId;
        state.dropMergeId = null;
        state.dropFolderId = null;
        createFolderWith(id, target);
        return;
      }
      // 拖到「＋ 新建页」上：图标移到末尾并强制开新页（硬分页）
      if (state.pendingNewPage && dragged) {
        state.pendingNewPage = false;
        state.dropFolderId = null;
        state.dropMergeId = null;
        moveEntryToIndex(id, Infinity, { hardBreak: true });
        return;
      }
      state.dropFolderId = null;
      state.dropMergeId = null;
      state.pendingNewPage = false;
      const plan = state.dropPlanIdx;
      const planBreak = state.dropPlanHard;
      state.dropPlanIdx = null;
      state.dropPlanHard = false;
      if (plan !== null && plan !== undefined) { moveEntryToIndex(id, plan, { hardBreak: planBreak }); return; } // 拖动期间未实时排序，按插入条计划落位
      syncOrderFromDOM();
      persist();
      renderGrid();
    },
  });
  sortableInstances.push(ins);
  return ins;
}
function bindSortables() {
  sortableInstances.forEach(ins => ins.destroy());
  sortableInstances = [];
  if (typeof Sortable === 'undefined') return;
  $$('#gridPages .grid-page').forEach(makeSortable);
}

/** 拖拽中到达末页屏幕边缘：像手机桌面一样追加一个空页并翻过去。
 *  只新增容器与其实例，不重建现有页，不打断进行中的拖拽；一次拖拽最多新建一页 */
function appendDragPage() {
  const pagesBox = $('#gridPages');
  const pg = document.createElement('div');
  pg.className = 'grid-page';
  pg.dataset.page = state.pages;
  pg.style.setProperty('--cols', state.layout.cols);
  pg.style.setProperty('--card', state.layout.card + 'px');
  pg.style.setProperty('--gap-factor', (state.data.settings.layout.gap ?? 100) / 100);
  pagesBox.append(pg);
  state.pages += 1;
  if (typeof Sortable !== 'undefined') makeSortable(pg);
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

/** 把条目移动到顶层第 targetIdx 个位置（超出总数 = 追加末尾）；opts.hardBreak 强制自成一页。
 *  数组手术在 domain/pages.js，这里只负责会话页码与持久化编排 */
function moveEntryToIndex(dragId, targetIdx, opts = {}) {
  const res = moveTopEntry(state.data.sites, dragId, targetIdx, opts);
  if (!res) return;
  if (opts.hardBreak) state.page = Infinity; // renderGrid 会钳到末页
  else state.page = Math.max(0, Math.min(res.topCount - 1, Math.floor(Math.min(targetIdx, res.topCount - 1) / perPage())));
  persist();
  renderGrid();
}

function removeSite(entry) {
  if (entry.folder) {
    // 解散文件夹：子站点回到桌面，不删除
    if (!dissolveFolder(state.data.sites, entry.id)) return;
    if (state.openFolderId === entry.id) closeFolder();
    persist();
    renderGrid();
    toast(t('已解散文件夹「{n}」，网址回到桌面', entry.name));
    return;
  }
  removeTopEntry(state.data.sites, entry.id);
  persist();
  renderGrid();
  if (state.openFolderId) renderFolderView();
  toast(t('已删除「{n}」', entry.name));
}

/* ================= 文件夹浮层（对齐 iOS 点开文件夹） ================= */
function openFolder(folder) {
  state.openFolderId = folder.id;
  renderFolderView();
  $('#folderMask').hidden = false;
  $('#folderView').hidden = false;
}

function closeFolder() {
  state.openFolderId = null;
  $('#folderMask').hidden = true;
  $('#folderView').hidden = true;
  if (fvSortable) { fvSortable.destroy(); fvSortable = null; }
}

function renderFolderView() {
  const f = state.data.sites.find(x => x.id === state.openFolderId);
  if (!f || !f.folder) { closeFolder(); return; }
  $('#fvTitle').textContent = f.name;
  const kids = state.data.sites.filter(x => x.parent === f.id);
  const box = $('#fvGrid');
  box.innerHTML = '';
  kids.forEach(k => {
    const a = document.createElement('a');
    a.className = 'fv-item';
    a.dataset.id = k.id;
    if (!state.editMode && k.url) {
      a.href = k.url;
      a.target = state.data.settings.openSitesNewTab ? '_blank' : '_self';
      if (a.target === '_blank') a.rel = 'noopener';
    }
    a.innerHTML = `<span class="icon">${iconHTML(k)}${state.editMode ? `<button class="del" title="删除">${SVG_X}</button>` : ''}</span><span class="label">${escapeHtml(k.name)}</span>`;
    a.addEventListener('click', e => { if (state.editMode) { e.preventDefault(); openSiteDialog(k); } });
    const del = $('.del', a);
    if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); removeSite(k); });
    box.append(a);
  });
  const add = document.createElement('a');
  add.className = 'fv-item fv-add';
  add.innerHTML = `<span class="icon">${SVG_PLUS}</span><span class="label">${t('添加')}</span>`;
  add.addEventListener('click', e => { e.preventDefault(); openSiteDialog(null, { parent: f.id }); });
  box.append(add);
  hydrateIdbIcons(box);
  hydrateIconCache(box);
  // 文件夹内自由排序（仅编辑态；独立分组，不与桌面互拖、无合并语义）
  if (fvSortable) { fvSortable.destroy(); fvSortable = null; }
  if (typeof Sortable !== 'undefined') {
    fvSortable = new Sortable(box, {
      group: 'folder-sites',
      animation: 150,
      disabled: !state.editMode,
      draggable: '.fv-item:not(.fv-add)',
      onEnd: () => {
        if (!state.openFolderId) return;
        syncFolderOrderFromDOM(state.openFolderId);
        persist();
        renderGrid(); // 顺带刷新桌面文件夹缩略块的成员顺序
      },
    });
  }
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
    x.title = t('移除该图标，恢复自动获取');
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
    state.data.sites.push({ id: uid(), name, url, icon, avatar, badge: false, parent: state.editingParent || '' });
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
  // 名称变化时同步纯色图标文字与配色
  $('#editName').addEventListener('input', () => { if (editIcon.mode === 'avatar') renderIconPick(); });
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

  document.addEventListener('click', e => {
    // 捕获阶段判断（此时目标尚未被重建的 DOM 摘除）：编辑态点空白处即退出
    if (state.editMode && !e.target.closest('.card, .edit-panel, #dirMask, #sidePanel, dialog, .dots, .round-btn, #btnMenu, .iconfind-mask, #folderView')) setEditMode(false);
  }, true);
  document.addEventListener('click', e => {
    if (!$('#engineMenu').hidden && !$('#engineMenu').contains(e.target) && !$('#engineLogo').contains(e.target) && !(e.target.closest && e.target.closest('.icon-dow'))) toggleEngineMenu(false);
    if (!$('#wallMenu').hidden && !$('#wallMenu').contains(e.target)) $('#wallMenu').hidden = true;
  });
  // 对齐 inftab：右键空白处弹出壁纸菜单（图标上的右键在 cardEl 内处理）
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.card, .edit-panel, #sidePanel, #folderView, dialog, input, textarea, select, .engine-menu, .sug-drop, .dir-card')) return;
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
  if (!on) state.extraPages = 0; // 退出编辑：手动新增的空页自动回收（对齐 iOS）
  const b = $('#actEdit');
  b.classList.toggle('on', on);
  b.textContent = on ? '退出编辑' : '编辑模式';
  if (fvSortable) fvSortable.options.disabled = !on; // 文件夹浮层内同步开/关排序
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
  $('#btnResetSettings').addEventListener('click', () => {
    if (!confirm(t('恢复默认设置？网址与云同步配置会保留。'))) return;
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

function removeEngine(engine) {
  const s = state.data.settings;
  if (s.engines.length <= 1) { toast(t('至少保留一个搜索引擎'), 'error'); return; }
  if (!confirm(t('移除搜索引擎「{n}」？', engine.name))) return;
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

function renderBackups() {
  const list = $('#backupList');
  const arr = getBackups();
  list.innerHTML = '';
  if (!arr.length) { list.innerHTML = '<li><span class="bt">' + t('暂无备份节点') + '</span></li>'; return; }
  arr.forEach((b, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="bt">' + new Date(b.t).toLocaleString() + '</span>' +
      '<button type="button" class="btn">恢复</button><button type="button" class="btn">删除</button>';
    li.querySelectorAll('button')[0].textContent = t('恢复');
    li.querySelectorAll('button')[1].textContent = t('删除');
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
  if (!confirm(t('恢复到 {n} 的备份？当前数据会被覆盖。', new Date(b.t).toLocaleString()))) return;
  saveBackupNode();
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

  // dialog：点击遮罩或 × 关闭
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  });

  // 键盘
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { toggleEngineMenu(false); hideSug(); closePanel(); closeSiteDialog(); closeIconFind(); closeFolder(); $('#wallMenu').hidden = true; }
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

  // 文件夹浮层
  $('#fvClose').addEventListener('click', closeFolder);
  $('#folderMask').addEventListener('click', closeFolder);

  // 滚轮翻页：整页任意位置生效（翻页后网格高度会变化，仅监听网格会导致"滚不回来"）；
  // 兼容 Firefox 的行滚动模式（deltaMode=1 时 deltaY 按行计）
  let wheelAt = 0;
  document.addEventListener('wheel', e => {
    const now = Date.now();
    if (now - wheelAt < 450 || Math.abs(e.deltaY) < 20) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && t.closest('#sidePanel, dialog, .edit-panel, .folder-view, .engine-menu, .sug-drop, .iconfind-mask, input, textarea, select')) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    // 循环翻页：末页继续下滚回首页，首页上滚到末页
    if (dy > 20 || dy < -20) { flipPage(dy > 0 ? 1 : -1); wheelAt = now; }
  }, { passive: true });

  // 拖拽期间：悬停图标给出去向反馈（文件夹=移入，普通图标=合成文件夹，手机桌面式，松手生效）；
  // 悬停屏幕左右边缘自动翻页；末页仍向右拖则新建一页并翻过去。
  // 全部走 capture 阶段：Sortable 内部会阻断 dragover 冒泡，bubble 阶段收不到真实拖拽事件
  document.addEventListener('dragstart', e => {
    const card = e.target.closest && e.target.closest('#gridPages .card');
    if (!card || !state.editMode) return;
    state.dragging = true;
    state.dragId = card.dataset.id;
    state.edgePageCreated = false;
    state.dropFolderId = null;
    state.dropMergeId = null;
    state.dropPlanIdx = null;
    state.dropPlanHard = false;
    // 记录抓取点偏移与卡片尺寸：dragover 时据此还原拖影的真实矩形，用于重叠度计算
    const r = card.getBoundingClientRect();
    grab = r.width > 0 ? { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height } : null;
    armedEl = null;
    // 拖动期间关闭 Sortable 实时排序：其它图标保持静止（手机桌面式），落点用插入条表达，松手一次落位
    sortableInstances.forEach(ins => { ins.options.sort = false; });
  }, true);
  let edgeTimer = null, edgeDir = 0, hoverCard = null, armedEl = null, grab = null;
  const showMergeHint = (el, text) => {
    let hint = $('.merge-hint');
    if (!hint) { hint = document.createElement('div'); hint.className = 'merge-hint'; document.body.append(hint); }
    const r = el.getBoundingClientRect();
    hint.textContent = text;
    hint.style.left = Math.round(r.left + r.width / 2) + 'px';
    hint.style.top = Math.round(r.bottom + 6) + 'px';
    hint.classList.add('show');
  };
  const hideMergeHint = () => { const h = $('.merge-hint'); if (h) h.classList.remove('show'); };
  // 插入位置指示条：拖动期间其它图标不动，落点用它表达
  let insertBar = null;
  const showInsertBar = (refEl, after) => {
    if (!insertBar) { insertBar = document.createElement('div'); insertBar.id = 'dragInsert'; insertBar.className = 'drag-insert'; $('#gridArea').append(insertBar); }
    const r = refEl.getBoundingClientRect(), a = $('#gridArea').getBoundingClientRect();
    insertBar.style.left = Math.round((after ? r.right : r.left) - a.left - 3) + 'px';
    insertBar.style.top = Math.round(r.top - a.top) + 'px';
    insertBar.style.height = Math.round(r.height) + 'px';
    insertBar.classList.add('show');
  };
  // 计算落点：光标在可见页上最近的卡片及其前后，换算成全局顶层索引（移除自身后的坐标）
  const computeInsertPlan = (x, y) => {
    const allPages = $$('#gridPages .grid-page');
    const visIdx = allPages.findIndex(pg => !pg.classList.contains('off'));
    const allTop = [];
    allPages.forEach(pg => pg.querySelectorAll(':scope > .card').forEach(el => { if (el.dataset.id) allTop.push(el); }));
    const dIdx = allTop.findIndex(el => el.dataset.id === state.dragId);
    const visCards = visIdx >= 0 ? [...allPages[visIdx].querySelectorAll(':scope > .card')].filter(el => el.dataset.id) : [];
    let ref = null, refAfter = false, bestDist = Infinity;
    visCards.forEach(el => {
      if (el.dataset.id === state.dragId) return;
      const r = el.getBoundingClientRect();
      const px = Math.max(r.left, Math.min(x, r.right)), py = Math.max(r.top, Math.min(y, r.bottom));
      const dist = (x - px) ** 2 + (y - py) ** 2;
      if (dist < bestDist) { bestDist = dist; ref = el; refAfter = x > r.left + r.width / 2; }
    });
    let g;
    if (!ref) {
      const before = allPages.slice(0, Math.max(0, visIdx)).reduce((n, pg) => n + pg.querySelectorAll(':scope > .card').length, 0);
      g = before;
    } else {
      const k = allTop.indexOf(ref);
      g = refAfter ? k + 1 : k;
    }
    state.dropPlanIdx = g <= dIdx ? g : g - 1;
    // 落在无卡片的非首页空页：附带硬分页，图标成为该页第一项，新建/稀疏页因此保得住
    state.dropPlanHard = !ref && visIdx > 0;
    if (ref) showInsertBar(ref, refAfter);
  };
  const clearHover = () => {
    if (hoverCard) { hoverCard.classList.remove('drop-target', 'merge-target'); hoverCard = null; }
    hideMergeHint();
    state.dropFolderId = null;
    state.dropMergeId = null;
  };
  const stopEdge = () => { if (edgeTimer) { clearInterval(edgeTimer); edgeTimer = null; } };
  // 松手/拖断：只清视觉与翻页状态；dropFolderId/dropMergeId 留给 Sortable 的 onEnd 消费后清理
  const hideInsertBar = () => { const bar = $('#dragInsert'); if (bar) bar.classList.remove('show'); };
  const endDragGesture = () => {
    stopEdge();
    if (hoverCard) { hoverCard.classList.remove('drop-target', 'merge-target'); hoverCard = null; }
    hideMergeHint();
    hideInsertBar();
    armedEl = null;
    grab = null;
    state.dragging = false;
    state.edgePageCreated = false;
    // capture 阶段先于 Sortable 的 onEnd 执行，这里不能清 dropPlanIdx，计划还要被消费
    sortableInstances.forEach(ins => { ins.options.sort = true; });
  };
  document.addEventListener('dragover', e => {
    if (!state.dragging) { stopEdge(); clearHover(); return; }

    // 目标判定：按拖影矩形与各卡矩形的重叠系数（交集/较小面积）。≥70% 视为“压住”，
    // 已锁目标降到 45% 才释放（迟滞），避免 Sortable 重排导致的高亮抖动
    let card = null;
    if (grab) {
      const rect = { left: e.clientX - grab.dx, top: e.clientY - grab.dy, right: e.clientX - grab.dx + grab.w, bottom: e.clientY - grab.dy + grab.h };
      const area = grab.w * grab.h;
      const ratios = new Map();
      let best = null, bestRatio = 0;
      $$('#gridPages .grid-page:not(.off) .card').forEach(el => {
        if (el.dataset.id === state.dragId || el.classList.contains('add-card')) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const ix = Math.min(rect.right, r.right) - Math.max(rect.left, r.left);
        const iy = Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top);
        if (ix <= 0 || iy <= 0) return;
        const ratio = (ix * iy) / Math.min(area, r.width * r.height);
        ratios.set(el, ratio);
        if (ratio > bestRatio) { bestRatio = ratio; best = el; }
      });
      if (armedEl) {
        if ((ratios.get(armedEl) || 0) >= 0.45) card = armedEl;
        else armedEl = null;
      }
      if (!card && best && bestRatio >= 0.7) { armedEl = best; card = best; }
    } else {
      const hit = e.target.closest && e.target.closest('#gridPages .grid-page:not(.off) .card');
      card = hit && hit.dataset.id !== state.dragId && !hit.classList.contains('add-card') ? hit : null;
    }
    if (!card) {
      clearHover();
      computeInsertPlan(e.clientX, e.clientY);
    } else if (card !== hoverCard) {
      clearHover();
      hoverCard = card;
      state.dropPlanIdx = null;
      state.dropPlanHard = false;
      const dragged = state.data.sites.find(x => x.id === state.dragId);
      const target = state.data.sites.find(x => x.id === card.dataset.id);
      if (dragged && !dragged.folder && target) {
        if (target.folder) { state.dropFolderId = target.id; card.classList.add('drop-target'); showMergeHint(card, t('松手移入文件夹')); }
        else { state.dropMergeId = target.id; card.classList.add('merge-target'); showMergeHint(card, t('松手合并为文件夹')); }
      }
    } else {
      state.dropPlanIdx = null;
      hideInsertBar();
    }

    const E = 90;
    const dir = e.clientX < E ? -1 : (e.clientX > innerWidth - E ? 1 : 0);
    if (!dir) { stopEdge(); return; }
    if (edgeTimer && edgeDir === dir) return;
    stopEdge(); edgeDir = dir;
    edgeTimer = setInterval(() => {
      const next = state.page + edgeDir;
      if (next < 0) { stopEdge(); return; }
      if (next > state.pages - 1) {
        // 已是末页仍向右拖：新建一页并翻过去（一次拖拽只建一页）。
        // 页面构成经 syncOrderFromDOM 硬分页持久化，新页在松手后也能保留。
        if (!state.edgePageCreated) {
          state.edgePageCreated = true;
          appendDragPage();
          showPage(state.pages - 1);
          toast(t('已新增一页'));
        }
        stopEdge();
        return;
      }
      showPage(next);
    }, 650);
  }, true);
  document.addEventListener('drop', endDragGesture, true);
  document.addEventListener('dragend', endDragGesture, true);

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
  return `${letter}<img src="${escapeHtml(sources[0])}" data-sources="${escapeHtml(sources.join('|'))}" data-icache="${escapeHtml(host)}" alt="" loading="lazy">`;
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
      state.data.sites.push({ id: uid(), name, url, icon: '', badge: false });
      persist();
      e.target.disabled = true;
      e.target.textContent = t('已添加');
      renderGrid();
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

/** 单源加载超时即切换下一源，避免某个图源挂起长时间卡住整条回退链 */
const imgTimers = new WeakMap();
function armImgTimeout(img, ms = 6000) {
  if (img.complete) return;
  clearTimeout(imgTimers.get(img));
  imgTimers.set(img, setTimeout(() => {
    if (!img.isConnected || img.complete) return;
    advanceIcon(img);
  }, ms));
}

function advanceIcon(img) {
  const list = (img.dataset.sources || '').split('|').filter(Boolean);
  const i = list.indexOf(img.getAttribute('src') || '');
  if (i >= 0 && i + 1 < list.length) { img.src = list[i + 1]; armImgTimeout(img); }
  else img.remove();
}

function bindDirectory() {
  $('#dirSearch').addEventListener('input', e => { dirQ = e.target.value.trim(); renderDirList(); });
}

/** 加载项目内置数据（data/default-data.json），覆盖当前站点与外观 */
async function loadDefaultData() {
  if (!confirm(t('加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。'))) return;
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
  maybeAutoBingDaily().catch(() => {});
}

init().catch(err => { window.__initErr = err.stack || String(err); toast(t('初始化失败：') + err.message, 'error'); });
