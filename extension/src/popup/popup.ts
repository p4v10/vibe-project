import { getSettings, saveSettings } from '../lib/storage'
import type { FilterType, Policy } from '../lib/types'

const FILTER_LABELS: Record<FilterType, string> = {
  email: 'Email Addresses',
  phone: 'Phone Numbers',
  ssn: 'SSNs',
  credit_card: 'Credit Cards',
  api_key: 'API Keys',
  address: 'Street Addresses',
  person_name: 'Person Names',
  dob: 'Dates of Birth',
}

const ACTION_COLORS: Record<Policy['action'], string> = {
  block: '#f87171',
  warn: '#fbbf24',
  mask: '#60a5fa',
  allow: '#4ade80',
}

function conditionHint(policy: Policy): string {
  const c = policy.condition
  if (c.type === 'keyword' && c.keyword) return `keyword: "${c.keyword}"`
  if (c.type === 'detection_type' && c.detectionType) return `detects: ${c.detectionType.replace(/_/g, ' ')}`
  if (c.type === 'risk_score' && c.riskScoreGt !== undefined) return `risk > ${c.riskScoreGt}`
  return c.type
}

function formatSyncTime(iso: string | undefined): string {
  if (!iso) return 'Never synced'
  const date = new Date(iso)
  return `Synced: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

function makeToggle(checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
  const label = document.createElement('label')
  label.className = 'toggle toggle--sm'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const slider = document.createElement('span')
  slider.className = 'slider slider--sm'
  label.appendChild(input)
  label.appendChild(slider)
  return label
}

const FILTER_SHORT: Record<FilterType, string> = {
  email: 'Email',
  phone: 'Phone',
  ssn: 'SSN',
  credit_card: 'Credit Card',
  api_key: 'API Key',
  address: 'Address',
  person_name: 'Names',
  dob: 'Date of Birth',
}

function renderFilterChips(settings: Awaited<ReturnType<typeof getSettings>>): void {
  const grid = document.getElementById('filterChips')!
  grid.innerHTML = ''

  for (const [id] of Object.entries(FILTER_LABELS) as [FilterType, string][]) {
    const chip = document.createElement('button')
    chip.className = 'chip' + (settings.filters.includes(id) ? ' chip--on' : '')
    chip.textContent = FILTER_SHORT[id]
    chip.addEventListener('click', async () => {
      const current = await getSettings()
      const isOn = chip.classList.contains('chip--on')
      const updated = isOn
        ? current.filters.filter((f) => f !== id)
        : [...new Set([...current.filters, id])]
      await saveSettings({ filters: updated })
      chip.classList.toggle('chip--on', !isOn)
    })
    grid.appendChild(chip)
  }
}

function renderPolicyList(policies: Policy[]): void {
  const policyList = document.getElementById('policyList')!
  policyList.innerHTML = ''

  if (policies.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'policy-empty'
    empty.textContent = 'No policies. Sync from the webapp to load.'
    policyList.appendChild(empty)
    return
  }

  for (const policy of policies) {
    const row = document.createElement('div')
    row.className = 'policy-row'

    const info = document.createElement('div')
    info.className = 'policy-info'

    const name = document.createElement('span')
    name.className = 'policy-name'
    name.textContent = policy.name
    if (!policy.enabled) name.classList.add('policy-name--disabled')

    const meta = document.createElement('div')
    meta.className = 'policy-meta'

    const badge = document.createElement('span')
    badge.className = 'policy-badge'
    badge.textContent = policy.action
    badge.style.color = ACTION_COLORS[policy.action]

    const hint = document.createElement('span')
    hint.className = 'policy-hint'
    hint.textContent = conditionHint(policy)

    meta.appendChild(badge)
    meta.appendChild(hint)

    info.appendChild(name)
    info.appendChild(meta)

    const toggle = makeToggle(policy.enabled, async (checked) => {
      const current = await getSettings()
      const updated = current.policies.map((p) =>
        p.id === policy.id ? { ...p, enabled: checked } : p,
      )
      await saveSettings({ policies: updated })
      name.classList.toggle('policy-name--disabled', !checked)
    })

    row.appendChild(info)
    row.appendChild(toggle)
    policyList.appendChild(row)
  }
}

async function init() {
  const settings = await getSettings()

  const toggle = document.getElementById('enabledToggle') as HTMLInputElement
  toggle.checked = settings.enabled
  toggle.addEventListener('change', () => saveSettings({ enabled: toggle.checked }))

  const confirmHighRiskToggle = document.getElementById('confirmHighRiskToggle') as HTMLInputElement
  confirmHighRiskToggle.checked = settings.confirmHighRisk
  confirmHighRiskToggle.addEventListener('change', () =>
    saveSettings({ confirmHighRisk: confirmHighRiskToggle.checked }),
  )

  renderFilterChips(settings)
  renderPolicyList(settings.policies)

  const lastSyncedEl = document.getElementById('lastSynced')!
  const syncBtn = document.getElementById('syncBtn') as HTMLButtonElement
  const syncMsg = document.getElementById('syncMsg')!

  const stored = await chrome.storage.local.get('lastSyncedAt')
  lastSyncedEl.textContent = formatSyncTime(stored.lastSyncedAt as string | undefined)

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true
    syncBtn.textContent = '…'
    syncMsg.textContent = ''
    syncMsg.className = 'sync-msg'

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
      if (response?.ok) {
        const updated = await chrome.storage.local.get('lastSyncedAt')
        lastSyncedEl.textContent = formatSyncTime(updated.lastSyncedAt as string | undefined)
        const fresh = await getSettings()
        renderPolicyList(fresh.policies)
        syncMsg.textContent = '✓ Synced successfully'
        syncMsg.classList.add('sync-msg--success')
      } else {
        syncMsg.textContent = 'Sync failed. Is the webapp running?'
        syncMsg.classList.add('sync-msg--error')
      }
    } catch {
      syncMsg.textContent = 'Background worker unreachable.'
      syncMsg.classList.add('sync-msg--error')
    } finally {
      syncBtn.disabled = false
      syncBtn.textContent = 'Sync'
    }
  })
}

init()
