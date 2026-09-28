/* 搜索模块：类型 tab、引擎选择/管理、搜索执行与建议（百度 JSONP）
 * 依赖边界：common + i18n + domain(data) + dialog */
import { $, $$, state, tint, escapeHtml, SVG_PLUS } from '../common.js?v=20260930h';
import { t } from '../i18n.js?v=20260930h';
import { TYPES } from '../domain/data.js?v=20260930h';
import { toast } from './dialog.js?v=20260930h';

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

export { activeType, resolveEngine, buildSearchUrl, renderTypeTabs, updateSearchUI, toggleEngineMenu, renderEngineMenu, engineGlyphHTML, doSearch, hideSug, renderSug, fetchSug, jsonp, LOOKS_LIKE_URL, sugList, sugIndex };
