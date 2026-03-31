<script setup>
import { reactive, ref, computed } from 'vue'
import { ENGINES } from '@/composables/useSearch.js'

// 预设壁纸库（使用 Unsplash source，免费可用）
const WALLPAPERS = [
  {
    id: 'forest',
    label: '森林小道',
    thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80'
  },
  {
    id: 'mountain',
    label: '雪山',
    thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80'
  },
  {
    id: 'ocean',
    label: '海浪',
    thumb: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80'
  },
  {
    id: 'city',
    label: '城市夜景',
    thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80'
  },
  {
    id: 'aurora',
    label: '极光',
    thumb: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80'
  },
  {
    id: 'desert',
    label: '沙漠',
    thumb: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1920&q=80'
  },
  {
    id: 'flower',
    label: '花海',
    thumb: 'https://images.unsplash.com/photo-1490750967868-88df5691cc18?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1490750967868-88df5691cc18?w=1920&q=80'
  },
  {
    id: 'galaxy',
    label: '星空银河',
    thumb: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=1920&q=80'
  },
  {
    id: 'lake',
    label: '湖泊倒影',
    thumb: 'https://images.unsplash.com/photo-1439853949212-36589f9a0638?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1439853949212-36589f9a0638?w=1920&q=80'
  },
  {
    id: 'autumn',
    label: '秋林',
    thumb: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=60',
    full: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80'
  },
]

const props = defineProps({ nav: Object })
const emit = defineEmits(['close'])

const settings = computed(() => props.nav.state.data.settings)

const tokenForm = reactive({
  token: props.nav.state.token || '',
  gistId: props.nav.state.gistId || ''
})

const testing = ref(false)
const testResult = ref(null)
const testMsg = ref('')

async function testAndSave() {
  if (!tokenForm.token) return
  testing.value = true
  testResult.value = null
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenForm.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (res.ok) {
      const data = await res.json()
      testResult.value = 'ok'
      testMsg.value = `已连接：${data.login}`
      await props.nav.setupComplete(tokenForm.token, tokenForm.gistId)
    } else {
      testResult.value = 'fail'
      testMsg.value = 'Token 无效'
    }
  } catch {
    testResult.value = 'fail'
    testMsg.value = '网络错误'
  } finally {
    testing.value = false
  }
}

function setEngine(id) {
  props.nav.updateSettings({ searchEngine: id })
}

function setColumns(val) {
  props.nav.updateSettings({ columns: Number(val) })
}

function setBgUrl(e) {
  props.nav.updateSettings({ background: e.target.value })
}

function selectWallpaper(full) {
  props.nav.updateSettings({ background: full })
  urlInput.value = full
}

const urlInput = ref(props.nav.state.data.settings.background || '')

function onBgFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const sizeKB = file.size / 1024
  if (sizeKB > 800) {
    alert('图片较大（超过 800KB），建议使用外部图片 URL 以避免 Gist 存储过大。')
  }
  const reader = new FileReader()
  reader.onload = () => props.nav.updateSettings({ background: reader.result })
  reader.readAsDataURL(file)
}

function clearBg() {
  props.nav.updateSettings({ background: '' })
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(props.nav.state.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'nav-data.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importJSON(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      if (data.pages && data.settings) {
        props.nav.state.data = data
        props.nav.updateSettings({}) // trigger save
      } else {
        alert('无效的导航数据格式')
      }
    } catch {
      alert('JSON 解析失败')
    }
  }
  reader.readAsText(file)
}

const bgFileInput = ref(null)
const importInput = ref(null)
</script>

<template>
  <div class="panel-backdrop" @click.self="emit('close')">
    <div class="settings-panel glass no-scrollbar">
      <div class="panel-header">
        <span>设置</span>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="panel-body no-scrollbar">

        <!-- 搜索引擎 -->
        <section class="section">
          <div class="section-title">搜索引擎</div>
          <div class="engine-list">
            <button
              v-for="e in ENGINES"
              :key="e.id"
              class="engine-item"
              :class="{ active: settings.searchEngine === e.id }"
              @click="setEngine(e.id)"
            >
              <span class="dot" :style="{ background: e.color }"></span>
              {{ e.name }}
            </button>
          </div>
        </section>

        <!-- 列数 -->
        <section class="section">
          <div class="section-title">每行图标数：{{ settings.columns }}</div>
          <input
            type="range"
            min="4"
            max="12"
            :value="settings.columns"
            class="slider"
            @input="setColumns($event.target.value)"
          />
          <div class="range-labels"><span>4</span><span>12</span></div>
        </section>

        <!-- 背景壁纸 -->
        <section class="section">
          <div class="section-title">壁纸</div>

          <!-- 预设壁纸网格 -->
          <div class="wallpaper-grid">
            <!-- 默认渐变 -->
            <button
              class="wp-item"
              :class="{ active: !settings.background }"
              title="默认渐变"
              @click="selectWallpaper('')"
            >
              <div class="wp-thumb wp-default">默认</div>
            </button>
            <!-- 预设图片 -->
            <button
              v-for="wp in WALLPAPERS"
              :key="wp.id"
              class="wp-item"
              :class="{ active: settings.background === wp.full }"
              :title="wp.label"
              @click="selectWallpaper(wp.full)"
            >
              <img :src="wp.thumb" :alt="wp.label" class="wp-thumb" loading="lazy" />
              <span class="wp-label">{{ wp.label }}</span>
            </button>
          </div>

          <!-- 自定义 URL -->
          <div class="section-subtitle">自定义图片 URL</div>
          <input
            v-model="urlInput"
            class="form-input"
            type="url"
            placeholder="https://... 图片地址"
            @change="setBgUrl"
          />

          <!-- 本地上传 -->
          <div class="bg-actions">
            <button class="btn-ghost small" @click="bgFileInput.click()">上传本地图片</button>
            <button v-if="settings.background" class="btn-danger small" @click="selectWallpaper('')">清除壁纸</button>
          </div>
          <input ref="bgFileInput" type="file" accept="image/*" style="display:none" @change="onBgFile" />
        </section>

        <!-- GitHub 同步 -->
        <section class="section">
          <div class="section-title">GitHub Gist 同步</div>
          <div class="form-group">
            <label>Token</label>
            <input v-model="tokenForm.token" class="form-input" type="password" placeholder="ghp_..." />
          </div>
          <div class="form-group">
            <label>Gist ID</label>
            <input v-model="tokenForm.gistId" class="form-input" type="text" placeholder="Gist ID" />
          </div>
          <button
            class="btn-primary"
            :disabled="!tokenForm.token || testing"
            @click="testAndSave"
          >{{ testing ? '验证中...' : '保存并测试' }}</button>
          <div v-if="testResult === 'ok'" class="success-msg">✓ {{ testMsg }}</div>
          <div v-else-if="testResult === 'fail'" class="error-msg">✕ {{ testMsg }}</div>
          <div v-if="nav.syncError.value" class="error-msg">{{ nav.syncError.value }}</div>
        </section>

        <!-- 导入/导出 -->
        <section class="section">
          <div class="section-title">数据备份</div>
          <div class="bg-actions">
            <button class="btn-ghost small" @click="exportJSON">导出 JSON</button>
            <button class="btn-ghost small" @click="importInput.click()">导入 JSON</button>
          </div>
          <input ref="importInput" type="file" accept=".json" style="display:none" @change="importJSON" />
        </section>

        <!-- 同步状态 -->
        <div v-if="nav.syncing.value" class="sync-status">⟳ 同步中...</div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.settings-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: min(340px, 90vw);
  border-radius: 0;
  border-right: none;
  border-top: none;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(20, 25, 35, 0.92);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-light);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.close-btn {
  color: var(--text-dim);
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background var(--transition);
}
.close-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-light); }

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {}

.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.engine-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.engine-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-dim);
  font-size: 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid transparent;
  transition: all var(--transition);
}
.engine-item:hover { background: rgba(255,255,255,0.1); color: var(--text-light); }
.engine-item.active {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.2);
  color: var(--text-light);
}
.dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.slider {
  width: 100%;
  accent-color: #5b9cf6;
  cursor: pointer;
}
.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
}

.bg-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.small {
  padding: 6px 12px;
  font-size: 13px;
}

.sync-status {
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
  padding: 8px;
}

.form-group {
  margin-bottom: 10px;
}
.form-group label {
  font-size: 12px;
  color: var(--text-dim);
  display: block;
  margin-bottom: 5px;
}

/* 壁纸选择器 */
.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.wp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color var(--transition), transform var(--transition);
  background: none;
  padding: 0;
  cursor: pointer;
}

.wp-item:hover {
  transform: scale(1.03);
  border-color: rgba(255, 255, 255, 0.4);
}

.wp-item.active {
  border-color: #5b9cf6;
}

.wp-thumb {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}

.wp-default {
  background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
}

.wp-label {
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  padding: 0 2px 3px;
}

.section-subtitle {
  font-size: 11px;
  color: var(--text-dim);
  margin-bottom: 6px;
}
</style>
