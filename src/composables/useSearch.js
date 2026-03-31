import { ref } from 'vue'

export const ENGINES = [
  { id: 'bing',       name: 'Bing',       domain: 'bing.com',       url: 'https://www.bing.com/search?q=' },
  { id: 'baidu',      name: '百度',        domain: 'baidu.com',      url: 'https://www.baidu.com/s?wd=' },
  { id: 'google',     name: 'Google',     domain: 'google.com',     url: 'https://www.google.com/search?q=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', domain: 'duckduckgo.com', url: 'https://duckduckgo.com/?q=' },
]

export const SEARCH_TABS = [
  { id: 'web',   label: '网页',  suffix: '' },
  { id: 'image', label: '图片',  suffix: ' 图片' },
  { id: 'video', label: '视频',  suffix: ' 视频' },
  { id: 'news',  label: '资讯',  suffix: ' 新闻' },
  { id: 'map',   label: '地图',  suffix: ' 地图' },
]

export function useSearch(settings) {
  const query = ref('')
  const activeTab = ref('web')

  function search() {
    const q = query.value.trim()
    if (!q) return
    const engineId = settings.value?.searchEngine || 'bing'
    const engine = ENGINES.find(e => e.id === engineId) || ENGINES[0]
    const tab = SEARCH_TABS.find(t => t.id === activeTab.value)
    const fullQuery = encodeURIComponent(q + (tab?.suffix || ''))
    window.open(engine.url + fullQuery, '_blank')
    query.value = ''
  }

  return { query, activeTab, search, ENGINES, SEARCH_TABS }
}
