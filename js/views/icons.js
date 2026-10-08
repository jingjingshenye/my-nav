/* 图标质量层：多源高清瀑布 + 尺寸守门 + 会话级死源黑名单 + IndexedDB 缓存水合
 * + 模糊判定（放大倍率）→ USM 锐化 class + 色板徽章 + 字母头像垫底/显隐
 * 依赖边界：common（工具/状态）+ idb，不依赖其他 views */
import { $, $$, state, tileColor, tint, escapeHtml, debounce } from '../common.js?v=20260930h';
import { idbGet, idbPut } from '../idb.js?v=20260930h';

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
  // 仅处理「新建且未填充」的 img（复用节点 src 已就绪，跳过——渲染高频路径减负）
  for (const img of root.querySelectorAll('img[data-idbkey]')) {
    const key = img.dataset.idbkey;
    if (img.src.startsWith('blob:')) continue; // 复用节点：已填充
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

export { sourceChainFor, iconSources, iconHTML, hydrateIdbIcons, hydrateIconCache, armImgTimeout, advanceIcon, imgTimers, deadIconHosts, iconCacheUrls, iconCacheDone, idbIconUrls };
