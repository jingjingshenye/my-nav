<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { ENGINES } from '@/composables/useSearch.js'

const props = defineProps({
  search: Object,
  settings: Object
})

const focused = ref(false)
const dropdownOpen = ref(false)
const engineWrapRef = ref(null)

const currentEngine = computed(() =>
  ENGINES.find(e => e.id === props.settings?.searchEngine) || ENGINES[0]
)

function selectEngine(id) {
  props.search.onEngineChange?.(id)
  dropdownOpen.value = false
}

function clearQuery() {
  props.search.query.value = ''
}

function onDocClick(e) {
  if (engineWrapRef.value && !engineWrapRef.value.contains(e.target)) {
    dropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div class="search-wrap">
    <div class="search-bar glass" :class="{ focused }">

      <!-- 引擎下拉 -->
      <div class="engine-wrap" ref="engineWrapRef">
        <button class="engine-btn" @click="dropdownOpen = !dropdownOpen" :title="currentEngine.name">
          <img
            class="engine-icon"
            :src="`https://www.google.com/s2/favicons?domain=${currentEngine.domain}&sz=16`"
            :alt="currentEngine.name"
            @error="$event.target.style.display='none'"
          />
          <span class="engine-name">{{ currentEngine.name }}</span>
          <svg class="chevron" :class="{ open: dropdownOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <Transition name="dropdown">
          <div v-if="dropdownOpen" class="dropdown">
            <button
              v-for="engine in ENGINES"
              :key="engine.id"
              class="dropdown-item"
              :class="{ active: engine.id === currentEngine.id }"
              @click="selectEngine(engine.id)"
            >
              <img
                class="engine-icon"
                :src="`https://www.google.com/s2/favicons?domain=${engine.domain}&sz=16`"
                :alt="engine.name"
                @error="$event.target.style.display='none'"
              />
              {{ engine.name }}
            </button>
          </div>
        </Transition>
      </div>

      <div class="bar-divider" />

      <!-- 输入框 -->
      <input
        v-model="search.query.value"
        class="search-input"
        type="text"
        placeholder="搜索..."
        autofocus
        @focus="focused = true"
        @blur="focused = false"
        @keydown.enter="search.search()"
        @keydown.esc="clearQuery"
      />

      <!-- 清除按钮 -->
      <button v-if="search.query.value" class="clear-btn" title="清除" @click="clearQuery">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- 搜索按钮 -->
      <button class="search-submit" @click="search.search()" title="搜索">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="17" y1="17" x2="22" y2="22"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-wrap {
  width: min(520px, 88vw);
  position: relative;
}

.search-bar {
  display: flex;
  align-items: center;
  height: 44px;
  border-radius: 22px;
  padding: 0 6px 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-bar.focused {
  border-color: rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06), 0 4px 20px rgba(0, 0, 0, 0.2);
}

/* Engine */
.engine-wrap {
  position: relative;
  flex-shrink: 0;
}

.engine-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-light);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 14px;
  white-space: nowrap;
  transition: background 0.18s ease;
}
.engine-btn:hover { background: rgba(255, 255, 255, 0.1); }

.engine-icon {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
  object-fit: contain;
}

.engine-name { font-size: 12px; }

.chevron {
  opacity: 0.5;
  transition: transform 0.18s ease;
}
.chevron.open { transform: rotate(180deg); }

/* Dropdown */
.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: rgba(30, 30, 40, 0.92);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 4px;
  min-width: 130px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  transition: background 0.15s ease, color 0.15s ease;
}
.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}
.dropdown-item.active {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Divider */
.bar-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
  margin: 0 6px;
}

/* Input */
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-light);
  font-size: 14px;
  height: 100%;
  min-width: 0;
  padding: 0 4px;
}
.search-input::placeholder { color: rgba(255, 255, 255, 0.35); }

/* Clear */
.clear-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.08);
  margin-right: 4px;
  transition: background 0.15s ease, color 0.15s ease;
}
.clear-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.85);
}

/* Submit */
.search-submit {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.65);
  transition: background 0.18s ease, color 0.18s ease;
}
.search-submit:hover {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}
</style>
