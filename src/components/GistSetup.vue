<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({ nav: Object })

const form = reactive({
  token: props.nav.state.token || '',
  gistId: props.nav.state.gistId || ''
})

const testing = ref(false)
const testResult = ref(null) // null | 'ok' | 'fail'
const testMsg = ref('')
const creating = ref(false)

async function testConnection() {
  if (!form.token) return
  testing.value = true
  testResult.value = null
  testMsg.value = ''
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${form.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (res.ok) {
      const data = await res.json()
      testResult.value = 'ok'
      testMsg.value = `连接成功：${data.login}`
    } else {
      testResult.value = 'fail'
      testMsg.value = 'Token 无效或无权限'
    }
  } catch {
    testResult.value = 'fail'
    testMsg.value = '网络错误，请检查连接'
  } finally {
    testing.value = false
  }
}

async function submit() {
  if (!form.token) return
  let gistId = form.gistId.trim()

  if (!gistId) {
    // 自动创建 Gist
    creating.value = true
    gistId = await props.nav.createAndSetupGist(form.token)
    creating.value = false
    if (!gistId) return // 创建失败，error 已在 nav 中设置
  } else {
    await props.nav.setupComplete(form.token, gistId)
  }
}

function skip() {
  props.nav.skipSetup()
}
</script>

<template>
  <div class="modal-backdrop">
    <div class="modal-box">
      <h2>🔗 配置 GitHub Gist 同步</h2>
      <p>
        将您的导航数据存储在 GitHub Gist 中，实现多设备同步。<br>
        Token 仅需 <strong>gist</strong> 权限，数据完全属于您。
      </p>

      <div class="form-group">
        <label>
          GitHub Personal Access Token
          <a
            href="https://github.com/settings/tokens/new?scopes=gist&description=Nav+Page"
            target="_blank"
            rel="noopener"
          >生成 Token ↗</a>
        </label>
        <input
          v-model="form.token"
          class="form-input"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        />
      </div>

      <div class="form-group">
        <label>
          Gist ID
          <span style="color: rgba(255,255,255,0.35); font-size: 11px;">留空则自动创建</span>
        </label>
        <input
          v-model="form.gistId"
          class="form-input"
          type="text"
          placeholder="留空将自动创建新 Gist"
        />
      </div>

      <button
        class="btn-ghost"
        style="margin-top: 4px; font-size: 13px;"
        :disabled="!form.token || testing"
        @click="testConnection"
      >
        {{ testing ? '验证中...' : '测试 Token 连接' }}
      </button>

      <div v-if="testResult === 'ok'" class="success-msg">✓ {{ testMsg }}</div>
      <div v-else-if="testResult === 'fail'" class="error-msg">✕ {{ testMsg }}</div>
      <div v-if="nav.syncError.value" class="error-msg">{{ nav.syncError.value }}</div>

      <div class="btn-row">
        <button
          class="btn-primary"
          :disabled="!form.token || nav.syncing.value || creating"
          @click="submit"
        >
          {{ creating ? '创建中...' : nav.syncing.value ? '同步中...' : '确认连接' }}
        </button>
        <button class="btn-ghost" @click="skip">跳过（仅本地）</button>
      </div>
    </div>
  </div>
</template>
