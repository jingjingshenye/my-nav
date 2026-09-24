/* ================= 多语言（简体 / 繁體 / English） ================= */
/* 词典以简体原文为键。纯模块：语言经 setLang() 显式注入，不反向依赖应用状态，可独立测试 */
const I18N = {
  'zh-tw': {
    '网页': '網頁', '图片': '圖片', '新闻': '新聞', '视频': '視頻', '地图': '地圖',
    '添加': '新增', '设置': '設定', '搜索': '搜尋', '删除': '刪除', '恢复': '還原',
    '输入并搜索': '輸入並搜尋', '搜索网站': '搜尋網站', '＋ 自定义': '＋ 自訂', '全部': '全部',
    '目标打开方式': '目標打開方式', '在新标签页中打开网站': '在新分頁中開啟網站', '在新标签页中打开第三方搜索结果': '在新分頁中開啟第三方搜尋結果',
    '语言': '語言', '语言选择': '語言選擇', '视图': '檢視', '翻页按钮': '翻頁按鈕', '行数': '行數', '列数': '列數', '间距': '間距', '松手合并为文件夹': '鬆手合併為資料夾', '松手移入文件夹': '鬆手移入資料夾', '松手合并文件夹': '鬆手合併資料夾', '已移出到桌面': '已移出到桌面', '已合并文件夹': '已合併資料夾', '查看我的 Gist': '查看我的 Gist', '账号里没有 Gist': '賬號裡沒有 Gist', '删除该 Gist？不可恢复': '刪除該 Gist？不可恢復', '删除失败：': '刪除失敗：', '未填写 Gist ID，将新建一个云端 Gist，继续？': '未填寫 Gist ID，將新建一個雲端 Gist，繼續？', '拖到浮层外移出 · 点标题重命名': '拖到浮層外移出 · 點標題重新命名',
    '布局': '版面', '图标': '圖示', '隐藏图标名称': '隱藏圖示名稱', '图标阴影': '圖示陰影', '启动动画': '啟動動畫',
    '图标圆角': '圖示圓角', '图标不透明度': '圖示不透明度', '图标大小': '圖示大小',
    '搜索框': '搜尋框', '隐藏搜索框': '隱藏搜尋框', '显示搜索建议': '顯示搜尋建議', '保留搜索框内容': '保留搜尋框內容',
    '隐藏搜索类别': '隱藏搜尋類別', '隐藏搜索按钮': '隱藏搜尋按鈕', '搜索框大小': '搜尋框大小', '搜索框圆角': '搜尋框圓角', '搜索框不透明度': '搜尋框不透明度',
    '字体': '字型', '字体阴影': '字型陰影', '字体大小': '字型大小', '字体颜色': '字型顏色',
    '壁纸': '桌布', '自定义壁纸 URL': '自訂桌布 URL', '壁纸库（必应每日 / 随机美图）…': '桌布庫（必應每日 / 隨機美圖）…',
    '上传本地图片': '上傳本機圖片', '每天自动更换必应壁纸': '每天自動更換必應桌布', '壁纸遮罩': '桌布遮罩', '壁纸模糊': '桌布模糊',
    '搜索引擎': '搜尋引擎', '点搜索框左侧 Logo 可快速切换；「添加」里可从引擎库启用内置引擎。': '點搜尋框左側 Logo 可快速切換；「添加」裡可從引擎庫啟用內建引擎。', '＋ 添加搜索引擎': '＋ 添加搜尋引擎',
    '动画': '動畫', '作用于图标入场动画': '作用於圖示入場動畫',
    '重置设置': '重設設定', '恢复默认外观与搜索设置；网址与云同步配置会保留。': '還原預設外觀與搜尋設定；網址與雲端同步配置會保留。', '还原设置': '還原設定',
    '云同步': '雲端同步', '与其他设备保持同步': '與其他裝置保持同步', '上次同步时间': '上次同步時間', '同步方式': '同步方式',
    '仅本地': '僅本機', 'Gitee Gist 云端': 'Gitee Gist 雲端', 'GitHub Gist 云端': 'GitHub Gist 雲端',
    'Gitee 云端配置': 'Gitee 雲端配置', 'GitHub Gist 配置': 'GitHub Gist 配置', '访问令牌 Token': '存取權杖 Token', '数据文件名': '資料檔案名稱',
    '推送到云端': '推送到雲端', '从云端拉取': '從雲端拉取', '备份与恢复': '備份與還原', '立即备份': '立即備份',
    '导入': '匯入', '导出': '匯出', '内置数据': '內建資料', '编辑模式': '編輯模式', '暂无备份节点': '暫無備份節點',
    '没有匹配的网站': '沒有符合的網站', '已添加': '已新增', '添加网址': '添加網址', '新建文件夹': '新建資料夾',
    '这里空空如也，点击右上角菜单 → 「添加网址」开始使用': '這裡空空如也，點擊右上角選單 → 「添加網址」開始使用',
    '确定': '確定', '取消': '取消', '网站地址': '網站位址', '网站名称': '網站名稱', '选择图标': '選擇圖示',
    '纯色图标': '純色圖示', '本地图标': '本機圖示', '编辑图标': '編輯圖示', '添加图标': '添加圖示',
    '编辑文件夹': '編輯資料夾', '文件夹': '資料夾',
    '编辑壁纸': '編輯桌布', '随机壁纸': '隨機桌布', '收藏当前壁纸': '收藏目前桌布', '下载当前壁纸': '下載目前桌布',
    '搜索图标': '搜尋圖示', '关于': '關於', '关于观澜': '關於觀瀾',
    '· 取自《孟子》「观水有术，必观其澜」——万川归海，由此观澜的极简起始页。': '· 取自《孟子》「觀水有術，必觀其瀾」——萬川歸海，由此觀瀾的極簡起始頁。',
    '快捷键：/ 或 Ctrl+K 聚焦搜索 · Ctrl+F 搜索图标 · ←/→ 翻页 · 滚轮翻页 · 右键图标进入编辑': '快捷鍵：/ 或 Ctrl+K 聚焦搜尋 · Ctrl+F 搜尋圖示 · ←/→ 翻頁 · 滾輪翻頁 · 右鍵圖示進入編輯',
    '在线：': '線上：', '开源：': '開源：',
    '数据可保存在本机，也可通过 Gitee Gist 云端同步，走到哪用到哪。': '資料可儲存在本機，也可透過 Gitee / GitHub Gist 雲端同步，走到哪用到哪。',
    '壁纸库': '桌布庫', '我的收藏': '我的收藏', '必应每日壁纸': '必應每日桌布', '刷新': '重新整理', '换一批': '換一批',
    '每天自动更换为最新必应壁纸': '每天自動更換為最新必應桌布', '加载中…': '載入中…',
    '添加搜索引擎': '添加搜尋引擎', '从引擎库启用': '從引擎庫啟用', '或添加自定义引擎': '或添加自訂引擎',
    '名称': '名稱', '网页搜索地址': '網頁搜尋位址', '其他搜索类型地址（可选）': '其他搜尋類型位址（可選）', '保存': '儲存',
    '已保存': '已儲存', '已删除「{n}」': '已刪除「{n}」', '已移入「{n}」': '已移入「{n}」', '已创建文件夹': '已建立資料夾',
    '已解散文件夹「{n}」，网址回到桌面': '已解散資料夾「{n}」，網址回到桌面',
    '请填写名称': '請填寫名稱', '请填写有效的网址': '請填寫有效的網址', '请填写文件夹名称': '請填寫資料夾名稱',
    '正在更换壁纸…': '正在更換桌布…', '获取壁纸失败，请稍后再试': '取得桌布失敗，請稍後再試',
    '已收藏当前壁纸': '已收藏目前桌布', '当前是内置壁纸，应用网络壁纸后可收藏': '目前是內建桌布，套用網路桌布後可收藏',
    '已创建本地备份节点': '已建立本機備份節點', '已创建备份节点': '已建立備份節點',
    '第 {n} 页': '第 {n} 頁', '已添加「{n}」': '已新增「{n}」',
    '新建页': '新增頁面', '已新增一页': '已新增一頁',
    '已移除「{n}」（引擎库中可随时重新启用）': '已移除「{n}」（引擎庫中可隨時重新啟用）',
    '移除搜索引擎「{n}」？': '移除搜尋引擎「{n}」？', '引擎库中的引擎已全部启用': '引擎庫中的引擎已全部啟用',
    '至少保留一个搜索引擎': '至少保留一個搜尋引擎', '已导入 {n} 个网址': '已匯入 {n} 個網址',
    '已加载内置数据（{n} 个网站）': '已載入內建資料（{n} 個網站）',
    '已推送到云端': '已推送到雲端', '已从云端拉取数据': '已從雲端拉取資料',
    '尚未创建': '尚未建立', '从未': '從未', '当前数据仅保存在本机浏览器。': '目前資料僅儲存在本機瀏覽器。',
    '恢复默认设置？网址与云同步配置会保留。': '還原預設設定？網址與雲端同步配置會保留。',
    '加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。': '載入內建資料？目前網址與外觀設定會被覆蓋（雲端同步配置保留）。',
    '恢复到 {n} 的备份？当前数据会被覆盖。': '還原到 {n} 的備份？目前資料會被覆蓋。',
    '壁纸源加载失败，请检查网络后点击「刷新」重试': '桌布來源載入失敗，請檢查網路後點「重新整理」重試',
    '图片源加载失败，请检查网络后点「换一批」重试': '圖片來源載入失敗，請檢查網路後點「換一批」重試',
    '已开启每日自动更换必应壁纸': '已開啟每日自動更換必應桌布', '已关闭每日自动更换': '已關閉每日自動更換',
    '已应用「{n}」，配置将自动同步': '已套用「{n}」，配置將自動同步',
    '已还原默认设置': '已還原預設設定', '已恢复到 {n}': '已還原到 {n}',
    '已创建云端 Gist（{n}），ID 已写入配置': '已建立雲端 Gist（{n}），ID 已寫入配置',
    '初始化失败：': '初始化失敗：', '自定义壁纸': '自訂桌布',
    '已自动更换今日必应壁纸': '已自動更換今日必應桌布', '该壁纸已在收藏中': '該桌布已在收藏中',
    '已开始下载当前壁纸': '已開始下載目前桌布', '当前是内置壁纸，无需下载': '目前是內建桌布，無需下載',
    '图标图片请小于 2MB': '圖示圖片請小於 2MB', '图标保存失败': '圖示儲存失敗', '移除该图标，恢复自动获取': '移除該圖示，恢復自動擷取',
    '图片过大（超过 4MB），请压缩后再试': '圖片過大（超過 4MB），請壓縮後再試', '已应用本地图片壁纸': '已套用本機圖片桌布', '保存失败，请重试': '儲存失敗，請重試',
    '请先选择 Gist 云端同步方式': '請先選擇 Gist 雲端同步方式', '请先填写 Gist ID 或推送到云端创建': '請先填寫 Gist ID 或推送到雲端建立',
    '拉取失败：': '拉取失敗：', '推送失败：': '推送失敗：', '自动同步失败：': '自動同步失敗：',
    '导入失败：': '匯入失敗：', '加载失败：': '載入失敗：',
    '请填写引擎名称': '請填寫引擎名稱', '请填写网页搜索地址': '請填寫網頁搜尋位址', '编辑搜索引擎': '編輯搜尋引擎',
    '该引擎未配置搜索地址': '該引擎未設定搜尋位址',
  },
  en: {
    '网页': 'Web', '图片': 'Images', '新闻': 'News', '视频': 'Videos', '地图': 'Maps',
    '添加': 'Add', '设置': 'Settings', '搜索': 'Search', '删除': 'Delete', '恢复': 'Restore',
    '输入并搜索': 'Search or type URL', '搜索网站': 'Search sites', '＋ 自定义': '＋ Custom', '全部': 'All',
    '目标打开方式': 'Link opening', '在新标签页中打开网站': 'Open sites in new tab', '在新标签页中打开第三方搜索结果': 'Open third-party results in new tab',
    '语言': 'Language', '语言选择': 'Language', '视图': 'View', '翻页按钮': 'Page buttons', '行数': 'Rows', '列数': 'Columns', '间距': 'Spacing', '松手合并为文件夹': 'Release to create folder', '松手移入文件夹': 'Release to move into folder', '松手合并文件夹': 'Release to merge folders', '已移出到桌面': 'Moved out to desktop', '已合并文件夹': 'Folders merged', '查看我的 Gist': 'View my Gists', '账号里没有 Gist': 'No Gists in this account', '删除该 Gist？不可恢复': 'Delete this Gist? This cannot be undone', '删除失败：': 'Delete failed: ', '未填写 Gist ID，将新建一个云端 Gist，继续？': 'No Gist ID set — a new cloud Gist will be created. Continue?', '拖到浮层外移出 · 点标题重命名': 'Drag out of the panel to move · click the title to rename',
    '布局': 'Layout', '图标': 'Icons', '隐藏图标名称': 'Hide icon labels', '图标阴影': 'Icon shadow', '启动动画': 'Launch animation',
    '图标圆角': 'Icon corner radius', '图标不透明度': 'Icon opacity', '图标大小': 'Icon size',
    '搜索框': 'Search box', '隐藏搜索框': 'Hide search box', '显示搜索建议': 'Search suggestions', '保留搜索框内容': 'Keep search text',
    '隐藏搜索类别': 'Hide search types', '隐藏搜索按钮': 'Hide search button', '搜索框大小': 'Search box size', '搜索框圆角': 'Search box radius', '搜索框不透明度': 'Search box opacity',
    '字体': 'Font', '字体阴影': 'Font shadow', '字体大小': 'Font size', '字体颜色': 'Font color',
    '壁纸': 'Wallpaper', '自定义壁纸 URL': 'Custom wallpaper URL', '壁纸库（必应每日 / 随机美图）…': 'Wallpaper gallery (Bing daily / random)…',
    '上传本地图片': 'Upload image', '每天自动更换必应壁纸': 'Bing wallpaper daily', '壁纸遮罩': 'Wallpaper dim', '壁纸模糊': 'Wallpaper blur',
    '搜索引擎': 'Search engines', '点搜索框左侧 Logo 可快速切换；「添加」里可从引擎库启用内置引擎。': 'Click the logo left of the search box to switch; enable built-in engines from "Add".', '＋ 添加搜索引擎': '＋ Add search engine',
    '动画': 'Animation', '作用于图标入场动画': 'Applies to the icon entrance animation',
    '重置设置': 'Reset', '恢复默认外观与搜索设置；网址与云同步配置会保留。': 'Restore default appearance and search settings. Sites and cloud sync config are kept.', '还原设置': 'Restore',
    '云同步': 'Cloud sync', '与其他设备保持同步': 'Sync with other devices', '上次同步时间': 'Last sync', '同步方式': 'Sync via',
    '仅本地': 'Local only', 'Gitee Gist 云端': 'Gitee Gist cloud', 'GitHub Gist 云端': 'GitHub Gist cloud',
    'Gitee 云端配置': 'Gitee cloud config', 'GitHub Gist 配置': 'GitHub Gist config', '访问令牌 Token': 'Access token', '数据文件名': 'Data filename',
    '推送到云端': 'Push to cloud', '从云端拉取': 'Pull from cloud', '备份与恢复': 'Backup & restore', '立即备份': 'Back up now',
    '导入': 'Import', '导出': 'Export', '内置数据': 'Built-in data', '编辑模式': 'Edit mode', '暂无备份节点': 'No snapshots yet',
    '没有匹配的网站': 'No matching sites', '已添加': 'Added', '添加网址': 'Add site', '新建文件夹': 'New folder',
    '这里空空如也，点击右上角菜单 → 「添加网址」开始使用': 'Nothing here yet. Open the menu at the top right, choose "Add site" to get started.',
    '确定': 'OK', '取消': 'Cancel', '网站地址': 'Site URL', '网站名称': 'Site name', '选择图标': 'Choose icon',
    '纯色图标': 'Letter tile', '本地图标': 'Local image', '编辑图标': 'Edit icon', '添加图标': 'Add icon',
    '编辑文件夹': 'Edit folder', '文件夹': 'Folder',
    '编辑壁纸': 'Edit wallpaper', '随机壁纸': 'Random wallpaper', '收藏当前壁纸': 'Save wallpaper', '下载当前壁纸': 'Download wallpaper',
    '搜索图标': 'Find icons', '关于': 'About', '关于观澜': 'About Guanlan',
    '· 取自《孟子》「观水有术，必观其澜」——万川归海，由此观澜的极简起始页。': '· Named from Mencius — "observe the water, observe its waves" — a minimal start page.',
    '快捷键：/ 或 Ctrl+K 聚焦搜索 · Ctrl+F 搜索图标 · ←/→ 翻页 · 滚轮翻页 · 右键图标进入编辑': 'Shortcuts: / or Ctrl+K focus search · Ctrl+F find icons · ←/→ flip page · scroll to flip · right-click an icon to edit',
    '在线：': 'Live: ', '开源：': 'Open source: ',
    '数据可保存在本机，也可通过 Gitee Gist 云端同步，走到哪用到哪。': 'Keep data locally, or sync it via Gitee / GitHub Gist and take it anywhere.',
    '壁纸库': 'Gallery', '我的收藏': 'Favorites', '必应每日壁纸': 'Bing daily', '刷新': 'Refresh', '换一批': 'Shuffle',
    '每天自动更换为最新必应壁纸': 'Auto-apply the latest Bing wallpaper daily', '加载中…': 'Loading…',
    '添加搜索引擎': 'Add search engine', '从引擎库启用': 'Enable from catalog', '或添加自定义引擎': 'or add a custom engine',
    '名称': 'Name', '网页搜索地址': 'Web search URL', '其他搜索类型地址（可选）': 'Other search type URLs (optional)', '保存': 'Save',
    '已保存': 'Saved', '已删除「{n}」': 'Deleted "{n}"', '已移入「{n}」': 'Moved into "{n}"', '已创建文件夹': 'Folder created',
    '已解散文件夹「{n}」，网址回到桌面': 'Folder "{n}" dissolved, sites are back on the desktop',
    '请填写名称': 'Please enter a name', '请填写有效的网址': 'Please enter a valid URL', '请填写文件夹名称': 'Please enter a folder name',
    '正在更换壁纸…': 'Changing wallpaper…', '获取壁纸失败，请稍后再试': 'Failed to fetch wallpaper, try again later',
    '已收藏当前壁纸': 'Wallpaper saved to favorites', '当前是内置壁纸，应用网络壁纸后可收藏': 'Built-in wallpaper. Apply a web wallpaper first',
    '已创建本地备份节点': 'Local backup snapshot created', '已创建备份节点': 'Backup snapshot created',
    '第 {n} 页': 'Page {n}', '已添加「{n}」': 'Added "{n}"',
    '新建页': 'New page', '已新增一页': 'New page added',
    '已移除「{n}」（引擎库中可随时重新启用）': 'Removed "{n}" (can be re-enabled from the catalog)',
    '移除搜索引擎「{n}」？': 'Remove search engine "{n}"?', '引擎库中的引擎已全部启用': 'All catalog engines are enabled',
    '至少保留一个搜索引擎': 'Keep at least one search engine', '已导入 {n} 个网址': 'Imported {n} sites',
    '已加载内置数据（{n} 个网站）': 'Loaded built-in data ({n} sites)',
    '已推送到云端': 'Pushed to cloud', '已从云端拉取数据': 'Pulled from cloud',
    '尚未创建': 'Not created yet', '从未': 'Never', '当前数据仅保存在本机浏览器。': 'Data is stored in this browser only.',
    '恢复默认设置？网址与云同步配置会保留。': 'Restore default settings? Sites and cloud sync config are kept.',
    '加载项目内置数据？当前网址与外观设置会被覆盖（云同步配置保留）。': 'Load built-in data? Current sites and appearance will be overwritten (cloud sync config is kept).',
    '恢复到 {n} 的备份？当前数据会被覆盖。': 'Restore backup from {n}? Current data will be overwritten.',
    '壁纸源加载失败，请检查网络后点击「刷新」重试': 'Failed to load wallpaper source. Check the network and hit Refresh',
    '图片源加载失败，请检查网络后点「换一批」重试': 'Failed to load images. Check the network and hit Shuffle',
    '已开启每日自动更换必应壁纸': 'Daily Bing wallpaper enabled', '已关闭每日自动更换': 'Daily Bing wallpaper disabled',
    '已应用「{n}」，配置将自动同步': 'Applied "{n}", config will sync automatically',
    '已还原默认设置': 'Default settings restored', '已恢复到 {n}': 'Restored backup from {n}',
    '已创建云端 Gist（{n}），ID 已写入配置': 'Cloud Gist {n} created, ID saved to config',
    '初始化失败：': 'Initialization failed: ', '自定义壁纸': 'Custom wallpaper',
    '已自动更换今日必应壁纸': "Today's Bing wallpaper applied", '该壁纸已在收藏中': 'Already in favorites',
    '已开始下载当前壁纸': 'Downloading current wallpaper', '当前是内置壁纸，无需下载': 'Built-in wallpaper, nothing to download',
    '图标图片请小于 2MB': 'Icon image must be under 2MB', '图标保存失败': 'Failed to save icon', '移除该图标，恢复自动获取': 'Remove this icon, back to auto-fetch',
    '图片过大（超过 4MB），请压缩后再试': 'Image too large (over 4MB), compress it first', '已应用本地图片壁纸': 'Local image wallpaper applied', '保存失败，请重试': 'Save failed, try again',
    '请先选择 Gist 云端同步方式': 'Choose a Gist cloud sync method first', '请先填写 Gist ID 或推送到云端创建': 'Enter a Gist ID or push to create one first',
    '拉取失败：': 'Pull failed: ', '推送失败：': 'Push failed: ', '自动同步失败：': 'Auto-sync failed: ',
    '导入失败：': 'Import failed: ', '加载失败：': 'Load failed: ',
    '请填写引擎名称': 'Please enter the engine name', '请填写网页搜索地址': 'Please enter the web search URL', '编辑搜索引擎': 'Edit search engine',
    '该引擎未配置搜索地址': 'This engine has no search URL for this type',
  },
};

const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let lang = 'zh';
/** 显式设置当前语言（init 与语言设置变更时调用；非法值忽略） */
export function setLang(l) { if (['zh', 'zh-tw', 'en'].includes(l)) lang = l; }
export const getLang = () => lang;

/** 动态文案翻译（键为简体原文；支持 {n} 占位符） */
export function t(s) {
  const args = Array.prototype.slice.call(arguments, 1);
  const d = I18N[lang];
  let out = (d && Object.prototype.hasOwnProperty.call(d, s)) ? d[s] : s;
  args.forEach((v, i) => { out = out.split('{' + i + '}').join(String(v)); });
  if (args.length) out = out.split('{n}').join(String(args[0]));
  return out;
}

/** 静态 DOM 文案整体替换（可逆：WeakMap 记录每个节点的简体原文键；跳过站点名等用户数据区） */
const i18nNodeKeys = new WeakMap();
export function applyI18n() {
  const d = I18N[lang] || null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el || el.closest('#gridPages .label, #fvGrid .label, .dir-info, script, style, textarea')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (!i18nNodeKeys.has(node)) {
      const key = node.textContent.trim();
      i18nNodeKeys.set(node, key);
    }
    const key = i18nNodeKeys.get(node);
    if (!key) return;
    node.textContent = (d && Object.prototype.hasOwnProperty.call(d, key)) ? d[key] : key;
  });
  $$('#searchInput[placeholder], #dirSearch[placeholder]').forEach(el => {
    if (!d) return;
    const k = el.getAttribute('placeholder');
    if (k && Object.prototype.hasOwnProperty.call(d, k)) el.placeholder = d[k];
  });
}
