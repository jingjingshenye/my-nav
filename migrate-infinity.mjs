// Infinity 备份 → nav-page 数据迁移脚本
// 用法: node migrate-infinity.mjs <backup.infinity>
import fs from 'node:fs';
import crypto from 'node:crypto';

const BACKUP = process.argv[2] || 'D:/Download/infinityBackup-2026-9-22.infinity';
const ICON_DIR = 'assets/icons';
const WALL_DIR = 'assets/wallpapers';
const DATA_OUT = 'data/default-data.json';

const raw = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
const data = raw.data;

/* ---------- 收集下载任务 ---------- */
const jobs = []; // {url, file}
const seen = new Map(); // url -> file
function fileFor(url, dir, fallbackId) {
  if (seen.has(url)) return seen.get(url);
  const u = new URL(url);
  const extMatch = u.pathname.match(/(\.\w+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '.png';
  const id = crypto.createHash('md5').update(url).digest('hex').slice(0, 16);
  const file = `${dir}/${fallbackId ? fallbackId + '-' : ''}${id}${ext}`;
  seen.set(url, file);
  jobs.push({ url, file });
  return file;
}

/* ---------- 站点迁移 ---------- */
const sites = data.site.sites.flat()
  .filter(s => /^https?:/.test(s.url || s.target || ''))
  .map(s => {
    const name = String(s.name).trim().replace(/\s+/g, ' ');
    const url = /^https?:/.test(s.url || '') ? s.url : s.target;
    let icon = '';
    if (s.bgType === 'image' && s.bgImage) icon = fileFor(s.bgImage, ICON_DIR, (s.uuid || '').slice(0, 10));
    return { name, url, icon, __badge: !!s.badge };
  });
// 重名去重（后出现的加后缀）
const nameCount = {};
for (const s of sites) {
  nameCount[s.name] = (nameCount[s.name] || 0) + 1;
  if (nameCount[s.name] > 1) s.name = `${s.name} ${nameCount[s.name]}`;
}

/* ---------- 壁纸迁移 ---------- */
let wallFile = '';
if (data.wallpaper && data.wallpaper.rawUrl && /^https?:/.test(data.wallpaper.rawUrl)) {
  wallFile = fileFor(data.wallpaper.rawUrl, WALL_DIR, 'infinity');
}

/* ---------- 下载 ---------- */
async function download(job, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(job.url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) throw new Error('too small: ' + buf.length);
      fs.mkdirSync(job.file.substring(0, job.file.lastIndexOf('/')), { recursive: true });
      fs.writeFileSync(job.file, buf);
      return true;
    } catch (e) {
      if (i === tries - 1) { console.error('  ✗ 下载失败', job.url.slice(0, 90), '→', e.message); return false; }
    }
  }
}

let ok = 0, fail = [];
const failedFiles = new Set();
for (const job of jobs) {
  const done = await download(job);
  if (done) ok++;
  else { fail.push(job.url); failedFiles.add(job.file); }
}
console.log(`下载完成: ${ok}/${jobs.length}`);

/* ---------- 生成数据 ---------- */
const st = data.setting?.setting || {};
const iconSt = st.icon || {};
const searchSt = st.search || {};
const layoutSt = st.layout || {};
const fontSt = st.font || {};

const outSites = sites.map(s => ({
  id: 'i_' + crypto.createHash('md5').update(s.url + s.name).digest('hex').slice(0, 10),
  name: s.name,
  url: s.url,
  icon: s.icon && !failedFiles.has(s.icon) ? s.icon : '',
  badge: !!s.__badge,
}));

const settings = {
  engine: 'bing',
  searchType: 'html',
  engines: [
    { id: 'baidu', name: 'baidu', glyph: '百', color: '#2932e1', urls: {
      html: 'https://www.baidu.com/s?tn=75144485_7_dg&ie=utf-8&wd=',
      photos: 'https://image.baidu.com/search/index?tn=baiduimage&word=',
      news: 'https://news.baidu.com/ns?tn=news&word=',
      videos: 'https://video.baidu.com/v?word=',
      map: 'https://map.baidu.com/?newmap=1&ie=utf-8&s=s%26wd%3D' } },
    { id: 'bing', name: '必应', glyph: 'bing', color: '#008373', urls: {
      html: 'https://cn.bing.com/search?form=bing&q=',
      photos: 'https://cn.bing.com/images/search?q=',
      news: 'https://cn.bing.com/news/search?q=',
      videos: 'https://cn.bing.com/videos/search?q=',
      map: 'https://cn.bing.com/maps?q=' } },
  ],
  layout: {
    mode: layoutSt.custom ? 'fixed' : 'auto',
    row: Math.min(6, Math.max(1, layoutSt.row || 5)),
    col: Math.min(12, Math.max(3, layoutSt.col || 8)),
  },
  openSitesNewTab: true,
  openSearchNewTab: true,
  pageScale: Math.round((st.view?.scaleMain || 1) * 100),
  showRandomWallBtn: true,
  showPageBtns: !!st.view?.pagin,
  hideIconName: !!iconSt.isHideIconName,
  iconShadow: !!iconSt.shadow,
  iconIntro: !!iconSt.startAnimation,
  iconRadius: Math.round((iconSt.radius ?? 0.5) * 100),
  iconOpacity: Math.round((iconSt.opacity ?? 1) * 100),
  iconScale: Math.round((iconSt.scale ?? 0.71) * 100),
  searchHide: !!searchSt.hide,
  searchSuggest: searchSt.searchSuggest !== false,
  keepSearchText: !!searchSt.keepSearchInput,
  searchHideType: !!searchSt.hideCategory,
  searchScale: Math.round((searchSt.scale ?? 0.9) * 100),
  searchRadius: Math.round((searchSt.radius ?? 0.2) * 100),
  searchOpacity: Math.round((searchSt.opacity ?? 1) * 100),
  fontShadow: fontSt.shadow !== false,
  fontSize: fontSt.size || 13,
  fontColor: (fontSt.color || '').includes('221') ? '#dddddd' : '#ffffff',
  wallpaper: '',
  customWallpaper: wallFile && !failedFiles.has(wallFile) ? wallFile : '',
  bingDaily: false,
  bingDate: '',
  lastSyncAt: null,
  sync: { type: 'local', token: '', gistId: '', filename: 'nav-data.json', autoSync: true },
};

const out = { version: 1, sites: outSites, settings };
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(DATA_OUT, JSON.stringify(out, null, 2));
console.log(`迁移完成: ${outSites.length} 个网站 → ${DATA_OUT}`);
console.log('壁纸:', out.settings.customWallpaper || '(无)');
