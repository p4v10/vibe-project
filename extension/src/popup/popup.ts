import { getSettings, saveSettings } from '../lib/storage'
import type { FilterType } from '../lib/types'

const FILTER_LABELS: Record<FilterType, string> = {
  email: 'Email Addresses',
  phone: 'Phone Numbers',
  ssn: 'SSNs',
  credit_card: 'Credit Cards',
  api_key: 'API Keys',
}

function formatSyncTime(iso: string | undefined): string {
  if (!iso) return 'Never synced'
  const date = new Date(iso)
  return `Last synced: ${date.toLocaleString()}`
}

async function init() {
  const settings = await getSettings()

  // Enabled toggle
  const toggle = document.getElementById('enabledToggle') as HTMLInputElement
  toggle.checked = settings.enabled
  toggle.addEventListener('change', () => {
    saveSettings({ enabled: toggle.checked })
  })

  // Filter checkboxes
  const filterList = document.getElementById('filterList')!
  for (const [id, label] of Object.entries(FILTER_LABELS) as [FilterType, string][]) {
    const item = document.createElement('label')
    item.className = 'filter-item'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = settings.filters.includes(id)
    checkbox.addEventListener('change', async () => {
      const current = await getSettings()
      const updated = checkbox.checked
        ? [...new Set([...current.filters, id])]
        : current.filters.filter((f) => f !== id)
      saveSettings({ filters: updated })
    })

    const name = document.createElement('span')
    name.className = 'filter-name'
    name.textContent = label

    item.appendChild(checkbox)
    item.appendChild(name)
    filterList.appendChild(item)
  }

  // Policy count
  const policyCount = document.getElementById('policyCount')!
  const enabled = settings.policies.filter((p) => p.enabled).length
  const total = settings.policies.length
  policyCount.innerHTML =
    total === 0
      ? 'No policies configured.'
      : `<strong>${enabled}</strong> of <strong>${total}</strong> policies active.`

  // Sync status — read lastSyncedAt directly from storage (not in ExtensionSettings type)
  const lastSyncedEl = document.getElementById('lastSynced')!
  const syncBtn = document.getElementById('syncBtn') as HTMLButtonElement
  const syncMsg = document.getElementById('syncMsg')!

  const stored = await chrome.storage.local.get('lastSyncedAt')
  lastSyncedEl.textContent = formatSyncTime(stored.lastSyncedAt as string | undefined)

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true
    syncBtn.textContent = 'Syncing…'
    syncMsg.textContent = ''
    syncMsg.className = 'sync-msg'

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
      if (response?.ok) {
        const updated = await chrome.storage.local.get('lastSyncedAt')
        lastSyncedEl.textContent = formatSyncTime(updated.lastSyncedAt as string | undefined)

        // Refresh policy count
        const fresh = await getSettings()
        const freshEnabled = fresh.policies.filter((p) => p.enabled).length
        const freshTotal = fresh.policies.length
        policyCount.innerHTML =
          freshTotal === 0
            ? 'No policies configured.'
            : `<strong>${freshEnabled}</strong> of <strong>${freshTotal}</strong> policies active.`

        syncMsg.textContent = 'Sync successful!'
        syncMsg.classList.add('sync-msg--success')
      } else {
        syncMsg.textContent = 'Sync failed. Is the webapp running?'
        syncMsg.classList.add('sync-msg--error')
      }
    } catch {
      syncMsg.textContent = 'Sync failed. Background worker unreachable.'
      syncMsg.classList.add('sync-msg--error')
    } finally {
      syncBtn.disabled = false
      syncBtn.textContent = 'Sync Now'
    }
  })
}

init()
