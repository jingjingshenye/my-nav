# -*- coding: utf-8 -*-
# 接线：语言选择功能 + 动态文案 t() 化 + 词典补充键
import io
p = r'D:\workspace\self\self-project\nav\js\app.js'
s = io.open(p, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    if a not in s:
        print('MISS:', a[:70])
        return
    s = s.replace(a, b, n)

# 词典补充键（繁体 + 英文各补 5 条）
rep("    '已应用「{n}」，配置将自动同步': '已套用「{n}」，配置將自動同步',",
    "    '已应用「{n}」，配置将自动同步': '已套用「{n}」，配置將自動同步',\n"
    "    '已还原默认设置': '已還原預設設定', '已恢复到 {n}': '已還原到 {n}',\n"
    "    '已创建云端 Gist（{n}），ID 已写入配置': '已建立雲端 Gist（{n}），ID 已寫入配置',\n"
    "    '初始化失败：': '初始化失敗：', '自定义壁纸': '自訂桌布',", 1)
rep("    '已应用「{n}」，配置将自动同步': 'Applied \"{n}\", config will sync automatically',",
    "    '已应用「{n}」，配置将自动同步': 'Applied \"{n}\", config will sync automatically',\n"
    "    '已还原默认设置': 'Default settings restored', '已恢复到 {n}': 'Restored backup from {n}',\n"
    "    '已创建云端 Gist（{n}），ID 已写入配置': 'Cloud Gist {n} created, ID saved to config',\n"
    "    '初始化失败：': 'Initialization failed: ', '自定义壁纸': 'Custom wallpaper',", 1)

# 默认语言 + 校验
rep("    engine: 'bing',\n    searchType: 'html',", "    engine: 'bing',\n    searchType: 'html',\n    lang: 'zh',")
rep("  if (!TYPES.some(t => t.id === out.searchType)) out.searchType = def.searchType;",
    "  if (!TYPES.some(t => t.id === out.searchType)) out.searchType = def.searchType;\n  if (!['zh', 'zh-tw', 'en'].includes(out.lang)) out.lang = 'zh';")

# 语言选择启用 + 绑定
rep("  renderEaseCards();\n  $('#rgWallOpacity').value = s.wallOpacity;",
    "  renderEaseCards();\n  $('#selLang').value = s.lang || 'zh';\n  $('#rgWallOpacity').value = s.wallOpacity;")
rep("  bind('tgSitesNewTab', 'openSitesNewTab', renderGrid);",
    "  $('#selLang').addEventListener('change', e => {\n"
    "    state.data.settings.lang = e.target.value;\n"
    "    persist();\n"
    "    renderTypeTabs();\n"
    "    renderGrid();\n"
    "    applyI18n();\n"
    "  });\n"
    "  bind('tgSitesNewTab', 'openSitesNewTab', renderGrid);")

# renderAll 刷新静态文案
rep("function renderAll() {\n  renderTypeTabs();", "function renderAll() {\n  applyI18n();\n  renderTypeTabs();")

# 类型 tab 文案（循环变量改名避免遮蔽 t()）
rep("  TYPES.forEach(t => {\n    const b = document.createElement('button');\n    b.type = 'button';\n    b.textContent = t.name;",
    "  TYPES.forEach(ty => {\n    const b = document.createElement('button');\n    b.type = 'button';\n    b.textContent = t(ty.name);")
rep("    b.className = t.id === state.data.settings.searchType ? 'active' : '';\n    b.onclick = () => {\n      state.data.settings.searchType = t.id;",
    "    b.className = ty.id === state.data.settings.searchType ? 'active' : '';\n    b.onclick = () => {\n      state.data.settings.searchType = ty.id;")

# 引擎菜单「添加」
rep('<span class="eng-name">添加</span>', '<span class="eng-name">${t(\'添加\')}</span>')

# 添加卡 / 新建文件夹卡 / 空提示 / 翻页标题
rep('  a.innerHTML = `<span class="icon">${SVG_PLUS}</span><span class="label">添加网址</span>`;',
    '  a.innerHTML = `<span class="icon">${SVG_PLUS}</span><span class="label">${t(\'添加网址\')}</span>`;')
rep('  a.innerHTML = `<span class="icon">${SVG_FOLDER}</span><span class="label">新建文件夹</span>`;',
    '  a.innerHTML = `<span class="icon">${SVG_FOLDER}</span><span class="label">${t(\'新建文件夹\')}</span>`;')
rep('grid.innerHTML = \'<p class="empty-tip">这里空空如也，点击右上角菜单 → 「添加网址」开始使用</p>\';',
    'grid.innerHTML = \'<p class="empty-tip">\' + t(\'这里空空如也，点击右上角菜单 → 「添加网址」开始使用\') + \'</p>\';')
rep("    d.title = `第 ${i + 1} 页`;", "    d.title = t('第 {n} 页', i + 1);")

# 右键壁纸菜单
rep("""  [
    ['立即备份', () => { saveBackupNode(); toast('已创建本地备份节点'); }],
    ['编辑壁纸', () => { closePanel(); openPanel('settings'); setTimeout(() => $('#wpGrid').scrollIntoView({ block: 'center', behavior: 'smooth' }), 80); }],
    ['随机壁纸', () => randomWallpaper()],
    ['收藏当前壁纸', () => favoriteWallpaper()],
    ['下载当前壁纸', () => downloadWallpaper()],
    ['搜索图标', () => openIconFind(), 'Ctrl + F'],
    ['关于', () => $('#dlgAbout').showModal()],
  ].forEach(([label, fn, sc]) => {
    const b = document.createElement('button');
    b.innerHTML = escapeHtml(label) + (sc ? `<span class="sc">${sc}</span>` : '');""",
"""  [
    ['立即备份', () => { saveBackupNode(); toast(t('已创建本地备份节点')); }],
    ['编辑壁纸', () => { closePanel(); openPanel('settings'); setTimeout(() => $('#wpGrid').scrollIntoView({ block: 'center', behavior: 'smooth' }), 80); }],
    ['随机壁纸', () => randomWallpaper()],
    ['收藏当前壁纸', () => favoriteWallpaper()],
    ['下载当前壁纸', () => downloadWallpaper()],
    ['搜索图标', () => openIconFind(), 'Ctrl + F'],
    ['关于', () => $('#dlgAbout').showModal()],
  ].forEach(([label, fn, sc]) => {
    const b = document.createElement('button');
    b.innerHTML = escapeHtml(t(label)) + (sc ? `<span class="sc">${sc}</span>` : '');""")

# 壁纸 toast
rep("  toast('正在更换壁纸…');", "  toast(t('正在更换壁纸…'));")
rep("  } catch { toast('获取壁纸失败，请稍后再试', 'error'); }", "  } catch { toast(t('获取壁纸失败，请稍后再试'), 'error'); }")
rep("  if (!url) { toast('当前是内置壁纸，应用网络壁纸后可收藏', 'error'); return; }", "  if (!url) { toast(t('当前是内置壁纸，应用网络壁纸后可收藏'), 'error'); return; }")
rep("  toast('已收藏当前壁纸');", "  toast(t('已收藏当前壁纸'));")
rep("  toast(`已应用「${title || '自定义壁纸'}」，配置将自动同步`);", "  toast(t('已应用「{n}」，配置将自动同步', title || t('自定义壁纸')));")

# 编辑面板
rep("  $('#editDlgTitle').textContent = folder ? (site ? '编辑文件夹' : '新建文件夹') : (site ? '编辑图标' : '添加图标');",
    "  $('#editDlgTitle').textContent = folder ? (site ? t('编辑文件夹') : t('新建文件夹')) : (site ? t('编辑图标') : t('添加图标'));")
rep("    if (!name) { err.textContent = '请填写文件夹名称'; err.hidden = false; return; }",
    "    if (!name) { err.textContent = t('请填写文件夹名称'); err.hidden = false; return; }")
rep("    err.textContent = !name ? '请填写名称' : '请填写有效的网址';",
    "    err.textContent = !name ? t('请填写名称') : t('请填写有效的网址');")
rep("  toast('已保存');", "  toast(t('已保存'));")

# 删除 / 移入 / 解散
rep("  toast(`已移入「${folder.name}」`);", "  toast(t('已移入「{n}」', folder.name));")
rep("    toast(`已解散文件夹「${entry.name}」，网址回到桌面`);", "    toast(t('已解散文件夹「{n}」，网址回到桌面', entry.name));")
rep("  toast(`已删除「${entry.name}」`);", "  toast(t('已删除「{n}」', entry.name));")

# 目录面板
rep("      toast(`已添加「${name}」`);", "      toast(t('已添加「{n}」', name));")
rep("      e.target.textContent = '已添加';", "      e.target.textContent = t('已添加');")
rep("    b.textContent = cat;", "    b.textContent = t(cat);")
rep("${added ? '已添加' : '添加'}", "${added ? t('已添加') : t('添加')}")
rep('  if (!entries.length) { box.innerHTML = \'<p class="dir-empty">没有匹配的网站</p>\'; return; }',
    '  if (!entries.length) { box.innerHTML = \'<p class="dir-empty">\' + t(\'没有匹配的网站\') + \'</p>\'; return; }')

# 浮层添加 tile
rep('<span class="label">添加</span>`;', '<span class="label">${t(\'添加\')}</span>`;')

# 备份 / 还原 / 同步
rep('  if (!arr.length) { list.innerHTML = \'<li><span class="bt">暂无备份节点</span></li>\'; return; }',
    '  if (!arr.length) { list.innerHTML = \'<li><span class="bt">\' + t(\'暂无备份节点\') + \'</span></li>\'; return; }')
rep("    const [btnRestore, btnDel] = li.querySelectorAll('button');",
    "    li.querySelectorAll('button')[0].textContent = t('恢复');\n    li.querySelectorAll('button')[1].textContent = t('删除');\n    const [btnRestore, btnDel] = li.querySelectorAll('button');")
rep("  if (!confirm('恢复到 ' + new Date(b.t).toLocaleString() + ' 的备份？当前数据会被覆盖。')) return;",
    "  if (!confirm(t('恢复到 {n} 的备份？当前数据会被覆盖。', new Date(b.t).toLocaleString()))) return;")
rep("  toast('已恢复到 ' + new Date(b.t).toLocaleString());", "  toast(t('已恢复到 {n}', new Date(b.t).toLocaleString()));")
rep("    toast(`已导入 ${state.data.sites.length} 个网址`);", "    toast(t('已导入 {n} 个网址', state.data.sites.length));")
rep("    toast(`已加载内置数据（${state.data.sites.length} 个网站）`);", "    toast(t('已加载内置数据（{n} 个网站）', state.data.sites.length));")
rep("  if (!confirm('加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。')) return;",
    "  if (!confirm(t('加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。'))) return;")
rep("  if (!confirm('恢复默认设置？网址与云同步配置会保留。')) return;", "  if (!confirm(t('恢复默认设置？网址与云同步配置会保留。'))) return;")
rep("    toast('已还原默认设置');", "    toast(t('已还原默认设置'));")
rep("    toast('已创建备份节点');", "    toast(t('已创建备份节点'));")
rep("    toast('已推送到云端');", "    toast(t('已推送到云端'));")
rep("      if (notify) toast('已从云端拉取数据');", "      if (notify) toast(t('已从云端拉取数据'));")
rep("  toast(`已创建云端 Gist（${cfg.gistId}），ID 已写入配置`);", "  toast(t('已创建云端 Gist（{n}），ID 已写入配置', cfg.gistId));")
rep("  toast(`已应用「${title || '自定义壁纸'}」，配置将自动同步`);", "  toast(t('已应用「{n}」，配置将自动同步', title || t('自定义壁纸')));")

# 引擎
rep("  if (s.engines.length <= 1) { toast('至少保留一个搜索引擎', 'error'); return; }",
    "  if (s.engines.length <= 1) { toast(t('至少保留一个搜索引擎'), 'error'); return; }")
rep("  if (!confirm(`移除搜索引擎「${engine.name}」？`)) return;", "  if (!confirm(t('移除搜索引擎「{n}」？', engine.name))) return;")
rep("  toast(`已移除「${engine.name}」（引擎库中可随时重新启用）`);", "  toast(t('已移除「{n}」（引擎库中可随时重新启用）', engine.name));")
rep('  if (!box.children.length) box.innerHTML = \'<p class="hint">引擎库中的引擎已全部启用</p>\';',
    '  if (!box.children.length) box.innerHTML = \'<p class="hint">\' + t(\'引擎库中的引擎已全部启用\') + \'</p>\';')
rep("      toast(`已启用「${c.name}」`);", "      toast(t('已添加「{n}」', c.name));")
rep("      toast('搜索引擎已保存');", "      toast(t('已保存'));")

# 壁纸库提示
rep('  box.innerHTML = \'<p class="hint">加载中…</p>\';', '  box.innerHTML = \'<p class="hint">\' + t(\'加载中…\') + \'</p>\';')
rep("  if (!list) { box.innerHTML = '<p class=\"hint\">壁纸源加载失败，请检查网络后点击「刷新」重试</p>'; return; }",
    "  if (!list) { box.innerHTML = '<p class=\"hint\">' + t('壁纸源加载失败，请检查网络后点击「刷新」重试') + '</p>'; return; }")
rep("    box.innerHTML = '<p class=\"hint\">图片源加载失败，请检查网络后点「换一批」重试</p>'; }",
    "    box.innerHTML = '<p class=\"hint\">' + t('图片源加载失败，请检查网络后点「换一批」重试') + '</p>'; }")
rep("    toast(e.target.checked ? '已开启每日自动更换必应壁纸' : '已关闭每日自动更换');",
    "    toast(e.target.checked ? t('已开启每日自动更换必应壁纸') : t('已关闭每日自动更换'));")

# 同步状态
rep("    el.textContent = '当前数据仅保存在本机浏览器。';", "    el.textContent = t('当前数据仅保存在本机浏览器。');")
rep("  el.textContent = `${platform} Gist：${s.sync.gistId || '尚未创建'}　上次同步：${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : '从未'}`;",
    "  el.textContent = `${platform} Gist：${s.sync.gistId || t('尚未创建')}　${t('上次同步')}：${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : t('从未')}`;")

# 初始化失败
rep("init().catch(err => toast('初始化失败：' + err.message, 'error'));",
    "init().catch(err => toast(t('初始化失败：') + err.message, 'error'));")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('t() wiring done')
