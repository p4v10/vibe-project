'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { PROVIDERS } from '@/lib/types'
import type { Provider, FilterType, Policy } from '@/lib/types'

interface DashboardCtx {
  provider: Provider
  setProvider: (p: Provider) => void
  model: string
  setModel: (m: string) => void
  filters: FilterType[]
  toggleFilter: (f: FilterType) => void
  policies: Policy[]
  setPolicies: Dispatch<SetStateAction<Policy[]>>
  policiesLoading: boolean
  loadPolicies: () => Promise<void>
  sidebarCollapsed: boolean
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>
}

const DashboardContext = createContext<DashboardCtx | null>(null)

export function useDashboard(): DashboardCtx {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider')
  return ctx
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderRaw] = useState<Provider>('openai')
  const [model, setModel] = useState<string>(
    PROVIDERS.find((p) => p.provider === 'openai')!.models[0].id,
  )
  const [filters, setFilters] = useState<FilterType[]>([
    'email', 'phone', 'ssn', 'credit_card', 'api_key',
  ])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function setProvider(p: Provider) {
    setProviderRaw(p)
    const prov = PROVIDERS.find((x) => x.provider === p)
    if (prov) setModel(prov.models[0].id)
  }

  function toggleFilter(f: FilterType) {
    setFilters((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])
  }

  const loadPolicies = useCallback(async () => {
    setPoliciesLoading(true)
    try {
      const res = await fetch('/api/policies')
      const data = await res.json()
      if (res.ok) setPolicies(data.policies ?? [])
    } finally {
      setPoliciesLoading(false)
    }
  }, [])

  useEffect(() => { loadPolicies() }, [loadPolicies])

  return (
    <DashboardContext.Provider
      value={{ provider, setProvider, model, setModel, filters, toggleFilter, policies, setPolicies, policiesLoading, loadPolicies, sidebarCollapsed, setSidebarCollapsed }}
    >
      {children}
    </DashboardContext.Provider>
  )
}
