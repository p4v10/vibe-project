import type { FilterType, Policy } from './types'

export interface ExtensionSettings {
  enabled: boolean
  filters: FilterType[]
  policies: Policy[]
  confirmHighRisk: boolean
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  filters: ['email', 'phone', 'ssn', 'credit_card', 'api_key'],
  policies: [],
  confirmHighRisk: false,
}

export function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      resolve(result as ExtensionSettings)
    })
  })
}

export function saveSettings(patch: Partial<ExtensionSettings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(patch, resolve)
  })
}
