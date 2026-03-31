<script setup>
import { computed, ref } from 'vue'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  nav: Object,
  pageIndex: Number
})

const emit = defineEmits(['change-page'])

const cols = computed(() => props.nav.state.data.settings.columns || 8)
const slots = computed(() => props.nav.paddedItems(props.pageIndex))

// 触摸滑动翻页
const touchStartX = ref(0)

function onTouchStart(e) {
  touchStartX.value = e.touches[0].clientX
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX.value
  if (Math.abs(dx) < 50) return
  const total = props.nav.state.data.pages.length
  const cur = props.nav.state.currentPage
  if (dx < 0 && cur < total - 1) emit('change-page', cur + 1)
  else if (dx > 0 && cur > 0) emit('change-page', cur - 1)
}
</script>

<template>
  <div
    class="nav-grid"
    :style="{ '--cols': cols }"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <NavIcon
      v-for="(slot, idx) in slots"
      :key="slot ? slot.item.id : `empty-${idx}`"
      :item="slot ? slot.item : null"
      :page-index="pageIndex"
      :real-index="slot ? slot.realIndex : null"
      :edit-mode="nav.state.editMode"
      :nav="nav"
    />
  </div>
</template>

<style scoped>
.nav-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), calc(var(--icon-size) + var(--icon-gap) * 2));
  row-gap: 16px;
  padding: 8px 16px;
  justify-content: center;
  align-content: center;
}
</style>
