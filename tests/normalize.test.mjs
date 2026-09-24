import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSettings,
  normalizeSite,
  buildData,
  seedSettings,
} from '../js/domain/data.js';

test('normalizeSettings：旧版键名迁移并按内置目录补齐', () => {
  const out = normalizeSettings({
    engines: [{ id: 'bing', name: 'bing', urls: { web: 'https://cn.bing.com/search?q=X' } }],
  });
  const bing = out.engines.find(e => e.id === 'bing');
  assert.ok(bing.urls.html.includes('q='));
  assert.ok(bing.urls.photos); // 缺失类型由目录补齐
});

test('normalizeSettings：过滤已下线的百度引擎', () => {
  const out = normalizeSettings({
    engines: [
      { id: 'baidu', name: '百度', urls: { html: 'https://www.baidu.com/s?wd=%s' } },
      { id: 'bing', name: 'bing', urls: { html: 'https://cn.bing.com/search?q=%s' } },
    ],
  });
  assert.deepEqual(out.engines.map(e => e.id), ['bing']);
});

test('normalizeSettings：数值钳制与默认值', () => {
  const out = normalizeSettings({ iconScale: 999, searchOpacity: 5, layout: { mode: 'fixed', row: 99, col: 1, gap: 999 } });
  assert.equal(out.iconScale, 120);
  assert.equal(out.searchOpacity, 30);
  assert.equal(out.layout.row, 10);
  assert.equal(out.layout.col, 2);
  assert.equal(out.layout.gap, 200);
});

test('normalizeSettings：旧 searchBtn 字段迁移为 searchHideBtn；废弃字段清除', () => {
  const out = normalizeSettings({ searchBtn: false, faviconApi: 'x', pageScale: 120, todo: {} });
  assert.equal(out.searchHideBtn, true);
  assert.equal('faviconApi' in out, false);
  assert.equal('pageScale' in out, false);
  assert.equal('todo' in out, false);
});

test('normalizeSite：字段白名单与 h 归一化', () => {
  const out = normalizeSite({ id: 'x', name: 'N', url: 'https://x.com', icon: 'icons/a.png', h: 'truthy', extra: 'drop' });
  assert.equal(out.h, 1);
  assert.equal('extra' in out, false);
  assert.equal(out.folder, false);
});

test('buildData：sites 规范化 + 结构校验 + sync 凭据保留', () => {
  const keepSync = { type: 'github-gist', token: 'secret', gistId: 'gid', filename: 'nav-data.json', autoSync: true };
  const payload = {
    sites: [{ id: 'a', name: 'A', url: 'https://a.com' }, { id: 'm', name: 'M', url: 'https://m.com', parent: 'ghost' }],
    settings: { lang: 'en' },
  };
  const data = buildData(payload, keepSync);
  assert.equal(data.version, 1);
  assert.deepEqual(data.sites.filter(s => !s.parent).map(s => s.id), ['a', 'm']); // 孤儿回桌面
  assert.equal(data.settings.sync.token, 'secret'); // 本机凭据不被载荷覆盖
  assert.equal(data.settings.lang, 'en');
});

test('buildData：keepSync 缺省时用种子同步配置', () => {
  const data = buildData({ sites: [] });
  assert.equal(data.settings.sync.type, 'local');
  assert.equal(data.settings.sync.token, '');
});

test('buildData：空载荷给出完整种子设置', () => {
  const data = buildData({});
  const seed = seedSettings();
  assert.equal(data.settings.engine, seed.engine);
  assert.ok(Array.isArray(data.settings.engines) && data.settings.engines.length > 0);
});
