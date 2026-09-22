# Nav · 新标签页导航

参照 [inftab](https://inftab.com/) 风格实现的极简起始页：全屏壁纸、圆角搜索框（多引擎切换）、圆形图标网格、滚轮/方向键翻页。纯静态、零构建、零依赖。

核心特性：

- **自由增删改**：右上角菜单「添加网址」；右键任意图标可 编辑 / 删除 / 开关红点提醒；「编辑模式」下支持 iOS 风格抖动、点击修改、拖拽排序（可拖到翻页圆点上跨页移动）。
- **多引擎搜索**：百度 / 必应 / 谷歌 / 搜狗 / 360 / 知乎 / GitHub / 淘宝，输入网址则直接跳转。
- **数据云端同步（Gitee Gist）**：导航数据存为一个私密 Gist 中的 JSON 文件，换电脑登录同一账号配置即可拉取；支持修改后自动同步、手动推送 / 拉取、导入导出 JSON。
- **接口自由**：存储层抽象为适配器接口（`js/adapters.js`），想换成自建 API、GitHub Gist、对象存储，写一个 `load/save` 实现并注册一行即可，界面下拉自动出现新选项。
- **个性化**：内置 5 款壁纸（含手绘雾林 SVG）+ 自定义壁纸 URL、图标服务地址可配、图标加载失败自动退回字母头像。

## 本地运行

任意静态服务器指向本目录即可（直接双击 file:// 打开会因浏览器模块/CORS 限制无法请求云端）：

```bash
python -m http.server 8080
# 或
npx serve .
```

打开 <http://localhost:8080>。

## 部署到 Gitee Pages

仓库根目录即站点根目录，在 Gitee 仓库「服务 → Gitee Pages」中选择 `master` 分支根目录启动即可。

## 配置 Gitee Gist 云同步

1. 打开 <https://gitee.com/profile/personal_access_tokens>，「生成新令牌」，勾选 **gists** 权限（建议同时勾 user_info）。
2. 页面右上角菜单 →「数据同步」→ 同步方式选 **Gitee Gist（云端）**，粘贴 Token。
3. 点「推送到云端」：没有 Gist ID 时会自动创建一个私密 Gist（文件名默认 `nav-data.json`），并把 ID 写回配置。
4. 勾选「修改后自动同步」后，每次增删改会防抖 1.8s 自动推送；换设备时填同一 Token + Gist ID，「从云端拉取」即可。

说明：

- Token 只保存在本机浏览器 localStorage，通过 HTTPS 直连 Gitee，不经过任何第三方；上传云端的数据会自动剔除 Token 字段。
- 同步为"整包覆盖"（最后写入者胜出），暂无合并策略；重要变更可用「导出数据」留底。

## 自定义存储后端（接口自由）

`js/adapters.js` 中约定：任何适配器实现

```js
class MyAdapter {
  async load() {}          // 返回完整数据对象或 null
  async save(data) {}      // 保存完整数据对象
  async create(data) {}    // 可选：首次使用时创建云端存储，返回 id
}

ADAPTERS['my-backend'] = {
  label: '我的后端',
  create: cfg => new MyAdapter(cfg),
};
```

设置面板的「同步方式」下拉会自动出现「我的后端」。

## 快捷键

| 按键 | 功能 |
| --- | --- |
| `/` 或 `Ctrl+K` | 聚焦搜索框 |
| `←` / `→` / 滚轮 | 翻页 |
| 右键图标 | 编辑 / 删除 / 红点 |

## 目录结构

```
nav/
├── index.html          # 页面结构
├── css/style.css       # 样式
├── js/
│   ├── adapters.js     # 存储适配器（本地 / Gitee Gist，可扩展）
│   └── app.js          # 渲染、交互、同步编排
└── assets/
    ├── wallpaper.svg   # 默认雾林壁纸
    └── logo.svg        # 风车 Logo
```
