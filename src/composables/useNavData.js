import { reactive, computed } from 'vue'
import { useGist } from './useGist.js'

const DEFAULT_DATA = {
  pages: [
    {
      id: 'page1',
      items: [
        { id: 'i1',  title: 'GitHub',    url: 'https://github.com',          icon: '', iconType: 'favicon' },
        { id: 'i2',  title: '哔哩哔哩',  url: 'https://www.bilibili.com',    icon: '', iconType: 'favicon' },
        { id: 'i3',  title: '百度',      url: 'https://www.baidu.com',       icon: '', iconType: 'favicon' },
        { id: 'i4',  title: 'YouTube',   url: 'https://www.youtube.com',     icon: '', iconType: 'favicon' },
        { id: 'i5',  title: '知乎',      url: 'https://www.zhihu.com',       icon: '', iconType: 'favicon' },
        { id: 'i6',  title: '微博',      url: 'https://weibo.com',           icon: '', iconType: 'favicon' },
        { id: 'i7',  title: '淘宝',      url: 'https://www.taobao.com',      icon: '', iconType: 'favicon' },
        { id: 'i8',  title: 'Twitter',   url: 'https://twitter.com',         icon: '', iconType: 'favicon' },
        { id: 'i9',  title: '豆瓣',      url: 'https://www.douban.com',      icon: '', iconType: 'favicon' },
        { id: 'i10', title: '京东',      url: 'https://www.jd.com',          icon: '', iconType: 'favicon' },
        { id: 'i11', title: 'V2EX',      url: 'https://www.v2ex.com',        icon: '', iconType: 'favicon' },
        { id: 'i12', title: 'Reddit',    url: 'https://www.reddit.com',      icon: '', iconType: 'favicon' },
        { id: 'i13', title: '掘金',      url: 'https://juejin.cn',           icon: '', iconType: 'favicon' },
        { id: 'i14', title: 'MDN',       url: 'https://developer.mozilla.org', icon: '', iconType: 'favicon' },
        { id: 'i15', title: 'NPM',       url: 'https://www.npmjs.com',       icon: '', iconType: 'favicon' },
        { id: 'i16', title: 'Can I use', url: 'https://caniuse.com',         icon: '', iconType: 'favicon' },
      ]
    }
  ],
  settings: {
    background: '',
    searchEngine: 'bing',
    columns: 8
  }
}

export function useNavData() {
  const { syncing, syncError, readGist, writeGist, createGist, debouncedWrite } = useGist()

  const state = reactive({
    data: structuredClone(DEFAULT_DATA),
    currentPage: 0,
    editMode: false,
    isSetupOpen: false,
    isSettingsOpen: false,
    addModalOpen: false,
    addModalTarget: { pageIndex: 0, existingItem: null },
    token: localStorage.getItem('nav_token') || '',
    gistId: localStorage.getItem('nav_gist_id') || '',
    loaded: false,
    skipSync: localStorage.getItem('nav_skip_sync') === '1',
  })

  // --- Favicon 解析 ---
  function resolveIcon(item) {
    if (item.iconType === 'custom' && item.icon) return item.icon
    try {
      const origin = new URL(item.url).origin
      return `${origin}/favicon.ico`
    } catch {
      return ''
    }
  }

  function googleFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    } catch {
      return ''
    }
  }

  // 字母头像颜色（根据首字母确定性生成）
  function letterColor(title) {
    const code = (title || 'A').toUpperCase().charCodeAt(0)
    const hue = (code * 137) % 360
    return `hsl(${hue}, 55%, 45%)`
  }

  // --- 分页数据 ---
  const currentPageData = computed(() => state.data.pages[state.currentPage] || { items: [] })

  function paddedItems(pageIndex) {
    const items = [...(state.data.pages[pageIndex]?.items || [])]
    const withSlots = items.map((item, idx) => ({ item, realIndex: idx }))
    // 末尾常驻一个加号槽
    withSlots.push(null)
    return withSlots
  }

  // --- CRUD ---
  function addItem(pageIndex, item) {
    const newItem = { id: `i${Date.now()}`, iconType: 'favicon', ...item }
    state.data.pages[pageIndex].items.push(newItem)
    saveChanges()
  }

  function updateItem(pageIndex, itemId, patch) {
    const page = state.data.pages[pageIndex]
    const idx = page.items.findIndex(i => i.id === itemId)
    if (idx !== -1) Object.assign(page.items[idx], patch)
    saveChanges()
  }

  function deleteItem(pageIndex, itemId) {
    const page = state.data.pages[pageIndex]
    page.items = page.items.filter(i => i.id !== itemId)
    saveChanges()
  }

  function addPage() {
    state.data.pages.push({ id: `page${Date.now()}`, items: [] })
    state.currentPage = state.data.pages.length - 1
    saveChanges()
  }

  function deletePage(pageIndex) {
    if (state.data.pages.length <= 1) return
    state.data.pages.splice(pageIndex, 1)
    if (state.currentPage >= state.data.pages.length) {
      state.currentPage = state.data.pages.length - 1
    }
    saveChanges()
  }

  function reorderItems(pageIndex, fromReal, toReal) {
    const items = state.data.pages[pageIndex].items
    if (fromReal < 0 || toReal < 0 || fromReal >= items.length) return
    const toIdx = Math.min(toReal, items.length - 1)
    const [moved] = items.splice(fromReal, 1)
    items.splice(toIdx, 0, moved)
    saveChanges()
  }

  function updateSettings(patch) {
    Object.assign(state.data.settings, patch)
    saveChanges()
  }

  // --- 持久化 ---
  function saveChanges() {
    if (state.skipSync) return
    debouncedWrite(state.token, state.gistId, state.data)
  }

  async function init() {
    if (state.skipSync || !state.token || !state.gistId) {
      if (!state.skipSync) {
        state.isSetupOpen = true
      }
      state.loaded = true
      return
    }
    const remote = await readGist(state.token, state.gistId)
    if (remote) state.data = { ...structuredClone(DEFAULT_DATA), ...remote }
    state.loaded = true
  }

  async function setupComplete(token, gistId) {
    localStorage.setItem('nav_token', token)
    localStorage.setItem('nav_gist_id', gistId)
    localStorage.removeItem('nav_skip_sync')
    state.token = token
    state.gistId = gistId
    state.skipSync = false
    state.isSetupOpen = false

    const remote = await readGist(token, gistId)
    if (remote) {
      state.data = { ...structuredClone(DEFAULT_DATA), ...remote }
    } else {
      // 新 Gist，写入默认数据
      await writeGist(token, gistId, state.data)
    }
    state.loaded = true
  }

  async function createAndSetupGist(token) {
    const newId = await createGist(token, state.data)
    if (newId) {
      await setupComplete(token, newId)
      return newId
    }
    return null
  }

  function skipSetup() {
    localStorage.setItem('nav_skip_sync', '1')
    state.skipSync = true
    state.isSetupOpen = false
    state.loaded = true
  }

  return {
    state,
    currentPageData,
    paddedItems,
    addItem, updateItem, deleteItem,
    addPage, deletePage, reorderItems,
    updateSettings,
    init,
    setupComplete,
    createAndSetupGist,
    skipSetup,
    resolveIcon,
    googleFaviconUrl,
    letterColor,
    syncing,
    syncError
  }
}
