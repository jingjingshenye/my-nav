import { ref } from 'vue'

const FILENAME = 'nav-data.json'
let debounceTimer = null

export function useGist() {
  const syncing = ref(false)
  const syncError = ref(null)

  function getHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  async function readGist(token, gistId) {
    syncing.value = true
    syncError.value = null
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: getHeaders(token)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `GitHub API ${res.status}`)
      }
      const data = await res.json()
      const raw = data.files?.[FILENAME]?.content
      if (!raw) throw new Error(`Gist 中找不到文件 "${FILENAME}"`)
      return JSON.parse(raw)
    } catch (e) {
      syncError.value = e.message
      return null
    } finally {
      syncing.value = false
    }
  }

  async function writeGist(token, gistId, navData) {
    syncing.value = true
    syncError.value = null
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify({
          files: {
            [FILENAME]: { content: JSON.stringify(navData, null, 2) }
          }
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `GitHub API ${res.status}`)
      }
    } catch (e) {
      syncError.value = e.message
    } finally {
      syncing.value = false
    }
  }

  async function createGist(token, navData) {
    syncing.value = true
    syncError.value = null
    try {
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({
          description: 'Nav page data',
          public: false,
          files: {
            [FILENAME]: { content: JSON.stringify(navData, null, 2) }
          }
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `GitHub API ${res.status}`)
      }
      const data = await res.json()
      return data.id
    } catch (e) {
      syncError.value = e.message
      return null
    } finally {
      syncing.value = false
    }
  }

  function debouncedWrite(token, gistId, navData, delay = 1200) {
    if (!token || !gistId) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => writeGist(token, gistId, navData), delay)
  }

  return { syncing, syncError, readGist, writeGist, createGist, debouncedWrite }
}
