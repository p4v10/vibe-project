import { DEFAULT_SETTINGS } from '../lib/storage'

const WEBAPP_URL = 'https://promptguard-p4.vercel.app'
const SYNC_ALARM = 'sync-policies'

// Initialize defaults on install
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS))
    const patch: Record<string, unknown> = {}
    for (const [key, defaultVal] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in existing)) patch[key] = defaultVal
    }
    if (Object.keys(patch).length > 0) {
      await chrome.storage.local.set(patch)
    }
  }

  // Schedule periodic sync (every 30 minutes)
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 30 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) syncPolicies()
})

// Message handler so the popup can trigger a manual sync
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SYNC_NOW') {
    syncPolicies().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }))
    return true // keep channel open for async response
  }
})

export async function syncPolicies(): Promise<void> {
  try {
    const res = await fetch(`${WEBAPP_URL}/api/policies`, {
      credentials: 'include',
    })

    // Authenticated sync succeeded
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.policies)) {
        await chrome.storage.local.set({
          policies: data.policies,
          lastSyncedAt: new Date().toISOString(),
        })
      }
      return
    }

    // Not logged in — fall back to public sample policies
    if (res.status === 401) {
      const sampleRes = await fetch(`${WEBAPP_URL}/api/policies/sample`)
      if (sampleRes.ok) {
        const sampleData = await sampleRes.json()
        if (Array.isArray(sampleData.policies)) {
          await chrome.storage.local.set({
            policies: sampleData.policies,
            lastSyncedAt: new Date().toISOString(),
          })
          console.info('[PromptGuard] Loaded sample policies (not logged in)')
          return
        }
      }
    }

    throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    console.error('[PromptGuard] Policy sync failed:', err)
    throw err
  }
}
