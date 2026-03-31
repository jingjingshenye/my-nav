<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useNavData } from '@/composables/useNavData.js'
import { useSearch } from '@/composables/useSearch.js'
import SearchBar from '@/components/SearchBar.vue'
import NavGrid from '@/components/NavGrid.vue'
import PageDots from '@/components/PageDots.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import GistSetup from '@/components/GistSetup.vue'
import AddIconModal from '@/components/AddIconModal.vue'

const nav = useNavData()
const settings = computed(() => nav.state.data.settings)

const search = useSearch(settings)
search.onEngineChange = (id) => nav.updateSettings({ searchEngine: id })

onMounted(() => {
  nav.init()
  document.addEventListener('mousedown', onDocMouseDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
})

// 点击非 icon 区域退出编辑模式
function onDocMouseDown(e) {
  if (!nav.state.editMode) return
  if (nav.state.addModalOpen) return
  // 判断点击目标是否在 .icon-slot 内
  if (!e.target.closest('.icon-slot')) {
    nav.state.editMode = false
  }
}

const bgStyle = computed(() => {
  const bg = nav.state.data.settings.background
  if (bg) {
    return {
      backgroundImage: `url(${bg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  // 默认极光背景
  return {
    backgroundImage: 'url(https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80)',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
})

function goHome() {
  nav.state.currentPage = 0
  nav.state.editMode = false
}

function changePage(idx) {
  nav.state.currentPage = idx
}
</script>

<template>
  <div class="app-root" :style="bgStyle">
    <!-- 背景遮罩 -->
    <div class="overlay" />

    <!-- 顶部：搜索栏 + 操作按钮 -->
    <header class="top-bar">
      <SearchBar :search="search" :settings="settings" />

      <div class="top-actions">
        <span v-if="nav.syncing.value" class="sync-dot" title="同步中"></span>

        <button class="icon-btn glass glass-hover" title="首页" @click="goHome">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
        </button>

        <button
          class="icon-btn glass glass-hover"
          :class="{ active: nav.state.isSettingsOpen }"
          title="设置"
          @click="nav.state.isSettingsOpen = !nav.state.isSettingsOpen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 图标网格区域 -->
    <main class="grid-area" v-if="nav.state.loaded">
      <NavGrid
        :nav="nav"
        :page-index="nav.state.currentPage"
        @change-page="changePage"
      />
    </main>

    <!-- 加载占位 -->
    <main class="grid-area loading" v-else>
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    </main>

    <!-- 底部：分页点 -->
    <footer class="footer-bar">
      <PageDots
        :count="nav.state.data.pages.length"
        :current="nav.state.currentPage"
        :edit-mode="nav.state.editMode"
        @go="changePage"
        @add-page="nav.addPage"
      />
    </footer>

    <!-- 右下品牌角标 -->
    <div class="brand-corner">NAV</div>

    <!-- 设置面板 -->
    <Transition name="slide-right">
      <SettingsPanel
        v-if="nav.state.isSettingsOpen"
        :nav="nav"
        @close="nav.state.isSettingsOpen = false"
      />
    </Transition>

    <!-- 首次配置 -->
    <GistSetup v-if="nav.state.isSetupOpen" :nav="nav" />

    <!-- 添加/编辑弹窗 -->
    <AddIconModal v-if="nav.state.addModalOpen" :nav="nav" />
  </div>
</template>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-light);
}

.overlay {
  position: absolute;
  inset: 0;
  background: var(--overlay-color);
  pointer-events: none;
  z-index: 0;
}

.top-bar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 20px 8px;
}

.top-actions {
  position: absolute;
  right: 20px;
  top: 80px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  transition: background var(--transition);
}

.icon-btn.active {
  background: rgba(255, 255, 255, 0.2) !important;
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f39c12;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.grid-area {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

.loading {
  flex-direction: column;
  gap: 12px;
}

.loading-dots {
  display: flex;
  gap: 8px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  animation: bounce 1.2s infinite ease-in-out;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1.2); opacity: 1; }
}

.footer-bar {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  padding: 12px 0 20px;
}

.brand-corner {
  position: absolute;
  bottom: 18px;
  right: 20px;
  z-index: 3;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  pointer-events: none;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.28s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
