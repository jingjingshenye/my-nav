/* 公共层：DOM 工具、SVG 常量、配色（色板/文字）、内置壁纸、全局状态、网格布局计算
 * 拆分边界：不依赖任何 views 模块（被所有模块引用的底座） */
import { createGridManager } from './grid-manager.js?v=20260930h';

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
const setGrids = (d, f) => { desktopGrid = d; folderGrid = f; };

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

export { $, $$, debounce, escapeHtml, SVG_PLUS, SVG_X, SVG_FOLDER, SVG_PENCIL,
  TILE_PALETTE, tileColor, tint, WALLPAPERS, state, gridMgr, computeLayout, perPage, setGrids };
