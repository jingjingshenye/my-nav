/**
 * 数据层：统一存储适配器接口，后端可自由替换。
 *
 * 任何适配器只需实现两个异步方法：
 *   load()        -> Promise<数据对象|null>   读取完整导航数据
 *   save(data)    -> Promise<void>            保存完整导航数据
 * 可选方法：
 *   create(data)  -> Promise<id>              首次使用时创建云端存储，返回存储标识
 *
 * 新增一种后端（自建 API、GitHub Gist、对象存储……）：
 * 1. 写一个类实现 load/save；
 * 2. 在下方 ADAPTERS 注册 { label, create }；
 * 设置面板的「同步方式」下拉会自动出现新选项。
 */

export const DATA_FILE = 'nav-data.json';
export const LOCAL_KEY = 'nav-page-data';

/** 本地存储适配器：数据仅保存在当前浏览器 */
export class LocalAdapter {
  constructor(key = LOCAL_KEY) { this.key = key; }
  async load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  async save(data) { localStorage.setItem(this.key, JSON.stringify(data)); }
}

/**
 * Gist 后端描述：Gitee 与 GitHub 的 Gist API 结构基本一致，
 * 差异仅在 鉴权方式 与 错误文案，这里集中声明。
 */
const GIST_BACKENDS = {
  gitee: {
    apiBase: 'https://gitee.com/api/v5',
    // Gitee v5 用 access_token 查询参数鉴权，避免预检请求带来的额外限制
    applyAuth: (url, headers, token) => { if (token) url.searchParams.set('access_token', token); },
    describeError: status => {
      if (status === 401 || status === 403) return '鉴权失败：Token 无效、过期或缺少 gists 权限';
      if (status === 404) return 'Gist 不存在：请检查 Gist ID（私密 Gist 读取也需要 Token）';
      return null;
    },
  },
  github: {
    apiBase: 'https://api.github.com',
    applyAuth: (url, headers, token) => {
      if (token) headers['Authorization'] = 'Bearer ' + token;
      headers['Accept'] = 'application/vnd.github+json';
    },
    describeError: status => {
      if (status === 401) return '鉴权失败：Token 无效或过期';
      if (status === 403) return '权限不足或触发接口限流（Classic Token 需勾选 gist 权限）';
      if (status === 404) return 'Gist 不存在或 Token 无权访问该 Gist';
      return null;
    },
  },
};

/** Gist 云端适配器（backend: 'gitee' | 'github'），数据存为一个私密 Gist 里的 JSON 文件 */
export class GistAdapter {
  constructor({ backend = 'gitee', token = '', gistId = '', filename = DATA_FILE } = {}) {
    this.backend = GIST_BACKENDS[backend] ? backend : 'gitee';
    this.cfg = GIST_BACKENDS[this.backend];
    this.token = String(token).trim();
    this.gistId = String(gistId).trim();
    this.filename = String(filename).trim() || DATA_FILE;
  }

  #url(path) { return new URL(this.cfg.apiBase + path); }

  async #request(method, path, body) {
    const url = this.#url(path);
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    this.cfg.applyAuth(url, headers, this.token);
    let res;
    try {
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('网络请求失败，请检查网络或代理设置');
    }
    if (!res.ok) {
      const msg = this.cfg.describeError(res.status);
      if (msg) throw new Error(msg);
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      throw new Error(`接口返回 ${res.status} ${detail}`);
    }
    return res.json();
  }

  async load() {
    if (!this.gistId) throw new Error('尚未配置 Gist ID');
    const gist = await this.#request('GET', `/gists/${encodeURIComponent(this.gistId)}`);
    const file = gist.files && gist.files[this.filename];
    if (!file) throw new Error(`Gist 中没有找到文件 ${this.filename}`);
    if (file.truncated) throw new Error('Gist 文件过大被截断，不适合作为数据源');
    try {
      return JSON.parse(file.content);
    } catch {
      throw new Error('Gist 文件内容不是合法的 JSON');
    }
  }

  /** 首次使用：创建一个私密 Gist，返回其 id */
  async create(data) {
    if (!this.token) throw new Error('请先填写访问令牌（Token）');
    const gist = await this.#request('POST', '/gists', {
      description: '启明 Qiming · 导航数据',
      public: false,
      files: { [this.filename]: { content: JSON.stringify(data, null, 2) } },
    });
    return gist.id;
  }

  async save(data) {
    if (!this.gistId) throw new Error('尚未创建云端 Gist');
    await this.#request('PATCH', `/gists/${encodeURIComponent(this.gistId)}`, {
      files: { [this.filename]: { content: JSON.stringify(data, null, 2) } },
    });
  }
}

/**
 * 适配器注册表。label 显示在设置面板，create 用配置构造实例。
 * 自定义后端在这里加一行即可。
 */
export const ADAPTERS = {
  'local': { label: '仅本地（浏览器存储）', create: cfg => new LocalAdapter() },
  'gitee-gist': { label: 'Gitee Gist（云端）', create: cfg => new GistAdapter({ ...cfg, backend: 'gitee' }) },
  'github-gist': { label: 'GitHub Gist（云端）', create: cfg => new GistAdapter({ ...cfg, backend: 'github' }) },
};

export function createAdapter(cfg = {}) {
  const def = ADAPTERS[cfg.type] || ADAPTERS.local;
  return def.create(cfg);
}
