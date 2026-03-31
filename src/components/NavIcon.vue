<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  item: Object,
  pageIndex: Number,
  realIndex: Number,
  editMode: Boolean,
  nav: Object
})

const imgSrc = ref('')
const imgLevel = ref(0)

function initIcon() {
  if (!props.item) return
  imgLevel.value = 1
  imgSrc.value = props.item.iconType === 'custom' && props.item.icon
    ? props.item.icon
    : props.nav.resolveIcon(props.item)
}

function onImgError() {
  if (imgLevel.value === 1) {
    imgLevel.value = 2
    imgSrc.value = props.nav.googleFaviconUrl(props.item.url)
  } else {
    imgLevel.value = 3
    imgSrc.value = ''
  }
}

watch(() => props.item?.url, () => initIcon(), { immediate: true })

const letterBg = computed(() => props.item ? props.nav.letterColor(props.item.title) : '#666')

// 长按进入编辑模式（移动端）
let longPressTimer = null
function onTouchStart() {
  longPressTimer = setTimeout(() => { props.nav.state.editMode = true }, 600)
}
function onTouchEnd() { clearTimeout(longPressTimer) }

// 右键：进入编辑模式
function onContextMenu(e) {
  e.preventDefault()
  props.nav.state.editMode = true
}

function openEdit(e) {
  e.stopPropagation()
  props.nav.state.addModalTarget = { pageIndex: props.pageIndex, existingItem: props.item }
  props.nav.state.addModalOpen = true
}

function openAdd(e) {
  e.stopPropagation()
  props.nav.state.addModalTarget = { pageIndex: props.pageIndex, existingItem: null }
  props.nav.state.addModalOpen = true
}

// 正常模式点击：跳转
function handleClick(e) {
  if (!props.editMode && props.item) {
    window.open(props.item.url, '_blank')
  }
}

// 拖拽
const isDragOver = ref(false)

function onDragStart(e) {
  if (!props.editMode || props.realIndex == null) return
  e.dataTransfer.setData('text/plain', JSON.stringify({
    fromPage: props.pageIndex,
    fromReal: props.realIndex
  }))
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e) {
  if (!props.editMode) return
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() { isDragOver.value = false }

function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  if (!props.editMode) return
  try {
    const { fromPage, fromReal } = JSON.parse(e.dataTransfer.getData('text/plain'))
    if (fromPage !== props.pageIndex) return
    const toReal = props.realIndex ?? props.nav.state.data.pages[props.pageIndex].items.length
    props.nav.reorderItems(props.pageIndex, fromReal, toReal)
  } catch {}
}
</script>

<template>
  <div
    class="icon-slot"
    :class="{ 'edit-mode': editMode, 'drag-over': isDragOver, 'is-add': !item }"
    :draggable="editMode && !!item"
    @click="handleClick"
    @contextmenu="onContextMenu"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 加号槽 -->
    <div v-if="!item" class="icon-circle add-circle" :class="{ 'edit-active': editMode }" @click.stop="openAdd($event)">
      <span class="plus-sign">+</span>
    </div>

    <!-- 真实图标 -->
    <div v-else class="icon-circle">
      <img
        v-if="imgLevel < 3 && imgSrc"
        :src="imgSrc"
        :alt="item.title"
        class="icon-img"
        @error="onImgError"
      />
      <span v-else class="icon-letter" :style="{ background: letterBg }">
        {{ (item.title || '?')[0].toUpperCase() }}
      </span>

      <!-- 编辑模式覆盖层：hover 显示铅笔 + ✕ -->
      <div v-if="editMode" class="edit-overlay" @click.stop>
        <button class="edit-pen" @click="openEdit($event)" title="编辑">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="del-badge" @click.stop="nav.deleteItem(pageIndex, item.id)" title="删除">✕</button>
      </div>
    </div>

    <span class="icon-label">{{ item?.title ?? '添加' }}</span>
  </div>
</template>

<style scoped>
.icon-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;
  padding: 4px;
  border-radius: 12px;
}

/* 正常模式 hover 缩放 */
.icon-slot:not(.edit-mode):hover .icon-circle {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

/* 摇晃动效 */
.icon-slot.edit-mode:not(.is-add) .icon-circle {
  animation: wiggle 0.28s ease infinite alternate;
}
.icon-slot.edit-mode:not(.is-add):nth-child(2n) .icon-circle { animation-delay: 0.07s; }
.icon-slot.edit-mode:not(.is-add):nth-child(3n) .icon-circle { animation-delay: 0.14s; }

@keyframes wiggle {
  0%   { transform: rotate(-2.5deg); }
  100% { transform: rotate(2.5deg); }
}

.icon-circle {
  width: var(--icon-size);
  height: var(--icon-size);
  border-radius: 50%;
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1.5px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  position: relative;
  transition: transform var(--transition), box-shadow var(--transition);
  flex-shrink: 0;
}

.add-circle {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
  transition: background var(--transition), border-color var(--transition);
}
.add-circle.edit-active {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.08);
}
.add-circle:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.6);
}

.plus-sign {
  font-size: 30px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1;
  margin-top: -2px;
  pointer-events: none;
  transition: color var(--transition);
}
.add-circle.edit-active .plus-sign,
.add-circle:hover .plus-sign {
  color: rgba(255, 255, 255, 0.75);
}

.icon-img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: 50%;
  pointer-events: none;
}

.icon-letter {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: white;
  border-radius: 50%;
  pointer-events: none;
}

.icon-label {
  font-size: 12px;
  color: var(--text-light);
  text-align: center;
  max-width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

/* 编辑覆盖层：平时透明，hover 显现 */
.edit-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition);
  overflow: visible;
}

.icon-circle:hover .edit-overlay {
  background: rgba(0, 0, 0, 0.45);
}

/* 铅笔按钮：hover 时才显示 */
.edit-pen {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.7);
  transition: opacity var(--transition), transform var(--transition);
}

.icon-circle:hover .edit-pen {
  opacity: 1;
  transform: scale(1);
}

.edit-pen:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ✕ 徽章：右上角，编辑模式常驻 */
.del-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e74c3c;
  border: 2px solid rgba(255, 255, 255, 0.9);
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  line-height: 1;
  transition: transform var(--transition), background var(--transition);
}
.del-badge:hover {
  transform: scale(1.2);
  background: #c0392b;
}

.drag-over .icon-circle {
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}
</style>
