/**
 * 领域数据层：站点/设置的结构定义、种子数据、规范化与统一装载入口。
 * 纯模块：不触碰 DOM，可被 node --test 直接测试。
 */
import { DATA_FILE } from '../adapters.js?v=20260924c';
import { sanitizeSites } from './pages.js?v=20260924c';

export const uid = () => 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ================= 搜索类型与引擎（对齐 inftab） ================= */
// 顶部 tab：搜索类型。每个引擎按类型提供地址模板，搜索词直接拼接在地址末尾（或替换 %s）。
export const TYPES = [
  { id: 'html',   name: '网页' },
  { id: 'photos', name: '图片' },
  { id: 'news',   name: '新闻' },
  { id: 'videos', name: '视频' },
  { id: 'map',    name: '地图' },
];

// 内置引擎库（bing 地址原样取自 inftab 默认数据，其余按各家官方搜索拼装）
export const ENGINE_CATALOG = [
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

export const cloneEngine = e => ({ id: e.id, name: e.name, glyph: e.glyph || '', color: e.color || '', urls: { ...e.urls } });
export const seedEngines = () => ENGINE_CATALOG.filter(e => e.id === 'bing').map(cloneEngine);

/* ================= 默认数据 ================= */

export function seedSettings() {
  return {
    engine: 'bing',
    searchType: 'html',
    lang: 'zh',
    engines: seedEngines(),
    // 目标打开方式
    openSitesNewTab: true,
    openSearchNewTab: true,
    // 视图
    showPageBtns: false,
    // 布局
    layout: { mode: 'auto', row: 3, col: 6, gap: 100 },
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
    // 壁纸遮罩 / 模糊
    wallOpacity: 40,
    wallBlur: 0,
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
export function normalizeSettings(s = {}) {
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
        id: e.id, name: String(e.name), glyph: e.id === 'bing' ? 'b' : (e.glyph || ''), color: e.color || '',
        urls: isLegacy && cat ? { ...cat.urls, ...urls } : urls,
      };
    });
  if (!out.engines.length) out.engines = def.engines;
  if (!TYPES.some(t => t.id === out.searchType)) out.searchType = def.searchType;
  if (!['zh', 'zh-tw', 'en'].includes(out.lang)) out.lang = 'zh';
  if (!out.engines.some(e => e.id === out.engine)) out.engine = out.engines[0].id;
  delete out.engineByType; // 旧版字段
  if (!out.layout || typeof out.layout !== 'object') out.layout = { ...def.layout };
  if (out.layout.mode !== 'fixed') out.layout.mode = 'auto';
  out.layout.row = Math.min(10, Math.max(1, parseInt(out.layout.row, 10) || 3));
  out.layout.col = Math.min(16, Math.max(2, parseInt(out.layout.col, 10) || 6));
  const gap = parseInt(out.layout.gap, 10);
  out.layout.gap = isNaN(gap) ? 100 : Math.min(200, Math.max(0, gap));
  const pct = (v, d, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || d));
  delete out.pageScale; // 旧字段：屏幕缩放已移除，卡片尺寸由图标大小与行列决定
  out.iconRadius = pct(out.iconRadius, 50, 0, 100);
  out.iconOpacity = pct(out.iconOpacity, 100, 30, 100);
  out.iconScale = pct(out.iconScale, 71, 50, 120);
  out.searchScale = pct(out.searchScale, 90, 70, 160);
  out.searchRadius = pct(out.searchRadius, 20, 0, 60);
  out.searchOpacity = pct(out.searchOpacity, 100, 30, 100);
  out.fontSize = pct(out.fontSize, 13, 10, 20);
  out.openSitesNewTab = out.openSitesNewTab !== false;
  out.openSearchNewTab = out.openSearchNewTab !== false;
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
  // 待办 / 笔记 / 天气小组件已移除，存量字段一并清理
  delete out.todo; delete out.note; delete out.weatherCity; delete out.weatherCache; delete out.showTodoBadge;
  out.wallOpacity = pct(out.wallOpacity, 40, 0, 100);
  out.wallBlur = pct(out.wallBlur, 0, 0, 20);
  out.wallFavorites = Array.isArray(out.wallFavorites)
    ? out.wallFavorites.filter(f => f && typeof f.url === 'string').slice(0, 12)
    : [];
  out.animEasing = ['default', 'spring', 'fade'].includes(out.animEasing) ? out.animEasing : 'default';
  // 旧字段 searchBtn(显示) 迁移为 searchHideBtn(隐藏)
  if (s.searchHideBtn === undefined && s.searchBtn !== undefined) out.searchHideBtn = s.searchBtn === false;
  out.searchHideBtn = out.searchHideBtn !== false; // 默认隐藏（对齐 inftab）
  // 右下角随机壁纸按钮与风车已移除，存量字段一并清理
  delete out.showRandomWallBtn; delete out.hideWindmill;
  delete out.searchBtn;
  return out;
}

export function normalizeSite(s = {}) {
  return {
    id: s.id || uid(), name: String(s.name || ''), url: String(s.url || ''),
    icon: s.icon || '', avatar: !!s.avatar, badge: !!s.badge,
    folder: !!s.folder, parent: s.parent || '',
    h: s.h ? 1 : 0, // 硬分页标记：此图标必须作为新一页的第一个（手机式页面构成持久化）
  };
}

export function seedSites() {
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

/** 统一装载入口：外部载荷（云端/导入/备份/内置）→ 字段规范化 + 结构不变量校验。
 *  keepSync：本机同步凭据（Token/Gist ID 不被载荷覆盖）；缺省时用种子同步配置 */
export function buildData(payload = {}, keepSync) {
  return {
    version: 1,
    sites: sanitizeSites((payload.sites || []).map(normalizeSite)),
    settings: { ...normalizeSettings(payload.settings || {}), sync: keepSync || normalizeSettings().sync },
  };
}
