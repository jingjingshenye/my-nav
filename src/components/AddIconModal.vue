<script setup>
import { reactive, watch, computed } from 'vue'

const props = defineProps({ nav: Object })

const target = computed(() => props.nav.state.addModalTarget)
const isEdit = computed(() => !!target.value.existingItem)

const form = reactive({ title: '', url: '', icon: '', iconType: 'favicon' })

watch(() => target.value.existingItem, (item) => {
  if (item) {
    form.title = item.title
    form.url = item.url
    form.icon = item.icon || ''
    form.iconType = item.iconType || 'favicon'
  } else {
    form.title = ''
    form.url = ''
    form.icon = ''
    form.iconType = 'favicon'
  }
}, { immediate: true })

// URL 变化时自动填充标题
function onUrlBlur() {
  if (!form.title && form.url) {
    try {
      const hostname = new URL(form.url).hostname.replace(/^www\./, '')
      form.title = hostname.split('.')[0]
    } catch {}
  }
}

function submit() {
  if (!form.url) return
  // 补全 https
  let url = form.url.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  form.url = url

  const { pageIndex, existingItem } = target.value
  if (isEdit.value) {
    props.nav.updateItem(pageIndex, existingItem.id, { ...form })
  } else {
    props.nav.addItem(pageIndex, { ...form })
  }
  close()
}

function close() {
  props.nav.state.addModalOpen = false
}
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-box">
      <h2>{{ isEdit ? '编辑书签' : '添加书签' }}</h2>
      <p>{{ isEdit ? '修改下方信息后保存' : '填写网址信息，将自动同步到 Gist' }}</p>

      <div class="form-group">
        <label>网址 *</label>
        <input
          v-model="form.url"
          class="form-input"
          type="url"
          placeholder="https://example.com"
          @blur="onUrlBlur"
          autofocus
        />
      </div>

      <div class="form-group">
        <label>标题</label>
        <input
          v-model="form.title"
          class="form-input"
          type="text"
          placeholder="网站名称"
        />
      </div>

      <div class="form-group">
        <label>
          自定义图标 URL
          <span style="color: rgba(255,255,255,0.35); font-size: 11px;">留空则自动获取 favicon</span>
        </label>
        <input
          v-model="form.icon"
          class="form-input"
          type="url"
          placeholder="https://example.com/icon.png"
          @input="form.iconType = form.icon ? 'custom' : 'favicon'"
        />
      </div>

      <div class="btn-row">
        <button class="btn-primary" :disabled="!form.url" @click="submit">
          {{ isEdit ? '保存' : '添加' }}
        </button>
        <button class="btn-ghost" @click="close">取消</button>
        <button v-if="isEdit" class="btn-danger" @click="nav.deleteItem(target.pageIndex, target.existingItem.id); close()">
          删除
        </button>
      </div>
    </div>
  </div>
</template>
