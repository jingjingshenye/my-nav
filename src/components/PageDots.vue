<script setup>
defineProps({
  count: Number,
  current: Number,
  editMode: Boolean
})
const emit = defineEmits(['go', 'add-page'])
</script>

<template>
  <div class="page-dots">
    <button
      v-for="i in count"
      :key="i"
      class="dot"
      :class="{ active: current === i - 1 }"
      :aria-label="`第 ${i} 页`"
      @click="emit('go', i - 1)"
    />
    <button
      v-if="editMode"
      class="dot dot-add"
      title="添加页面"
      @click="emit('add-page')"
    >+</button>
  </div>
</template>

<style scoped>
.page-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  padding: 0;
  transition: transform var(--transition), background var(--transition);
}

.dot:hover {
  background: rgba(255, 255, 255, 0.65);
}

.dot.active {
  background: white;
  transform: scale(1.35);
}

.dot-add {
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px dashed rgba(255, 255, 255, 0.45);
  color: white;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.dot-add:hover {
  background: rgba(255, 255, 255, 0.28);
}
</style>
