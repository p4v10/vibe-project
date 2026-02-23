'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield, MessageSquare, Settings, Sliders, LogOut,
  ChevronDown, ChevronUp, Plus, Trash2, ToggleLeft, ToggleRight, Pencil, ShieldCheck, Code2,
} from 'lucide-react'
import { signOut } from '@/lib/actions'
import { useDashboard } from './DashboardContext'
import { PROVIDERS, FILTER_OPTIONS } from '@/lib/types'
import type { PolicyAction, PolicyConditionType, Policy } from '@/lib/types'
import { useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<PolicyAction, string> = {
  allow: 'Allow', warn: 'Warn', mask: 'Mask', block: 'Block',
}
const ACTION_BADGE: Record<PolicyAction, string> = {
  allow: 'bg-green-900/30 text-green-300 border-green-700/40',
  warn: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/40',
  mask: 'bg-blue-900/30 text-blue-300 border-blue-700/40',
  block: 'bg-red-900/30 text-red-300 border-red-700/40',
}
const CONDITION_TYPE_LABELS: Record<PolicyConditionType, string> = {
  detection_type: 'Secret / Detection type',
  keyword: 'Keyword / Phrase',
  risk_score: 'Risk score threshold',
}
const DETECTION_TYPE_OPTIONS = [
  { value: '', label: 'Any detection' },
  { value: 'private_key', label: 'Private Key' },
  { value: 'database_url', label: 'Database URL' },
  { value: 'aws_access_key', label: 'AWS Access Key' },
  { value: 'openai_key', label: 'OpenAI Key' },
  { value: 'github_token', label: 'GitHub Token' },
  { value: 'slack_token', label: 'Slack Token' },
  { value: 'jwt', label: 'JWT' },
  { value: 'bearer_token', label: 'Bearer Token' },
  { value: 'env_secret', label: 'Env Secret' },
  { value: 'email', label: 'Email (PII)' },
  { value: 'phone', label: 'Phone (PII)' },
  { value: 'ssn', label: 'SSN (PII)' },
  { value: 'credit_card', label: 'Credit Card (PII)' },
]

function conditionSummary(policy: Policy): string {
  const c = policy.condition
  if (c.type === 'detection_type') {
    const typeName = c.detectionType
      ? DETECTION_TYPE_OPTIONS.find((o) => o.value === c.detectionType)?.label ?? c.detectionType
      : 'any detection'
    return `Detects ${typeName}${c.countGt !== undefined ? ` (> ${c.countGt})` : ''}`
  }
  if (c.type === 'keyword') return `Keyword: "${c.keyword}"`
  if (c.type === 'risk_score') return `Risk score > ${c.riskScoreGt}`
  return '—'
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({
  title, icon, badge, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode; badge?: React.ReactNode
  open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
      <button
        type="button" onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 transition text-left"
      >
        {icon}
        <span className="flex-1 text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</span>
        {badge}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-gray-500 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
      </button>
      {open && <div className="p-3 bg-gray-900/30 space-y-2">{children}</div>}
    </div>
  )
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export default function DashboardSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const { provider, setProvider, model, setModel, filters, toggleFilter, policies, setPolicies, policiesLoading } = useDashboard()

  const currentProvider = PROVIDERS.find((p) => p.provider === provider)!

  // Accordion open state
  const [modelOpen, setModelOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [policiesOpen, setPoliciesOpen] = useState(false)

  // Policy form state
  const [showPolicyForm, setShowPolicyForm] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [policyFormError, setPolicyFormError] = useState<string | null>(null)
  const [submittingPolicy, setSubmittingPolicy] = useState(false)
  const [policyName, setPolicyName] = useState('')
  const [conditionType, setConditionType] = useState<PolicyConditionType>('detection_type')
  const [detectionType, setDetectionType] = useState('')
  const [countGt, setCountGt] = useState('')
  const [keyword, setKeyword] = useState('')
  const [riskScoreGt, setRiskScoreGt] = useState('')
  const [policyAction, setPolicyAction] = useState<PolicyAction>('warn')

  const enabledPolicies = policies.filter((p) => p.enabled).length

  function resetPolicyForm() {
    setPolicyName(''); setConditionType('detection_type'); setDetectionType('')
    setCountGt(''); setKeyword(''); setRiskScoreGt(''); setPolicyAction('warn')
    setPolicyFormError(null); setShowPolicyForm(false); setEditingPolicyId(null)
  }

  function startEditPolicy(policy: Policy) {
    setEditingPolicyId(policy.id)
    setPolicyName(policy.name)
    setConditionType(policy.condition.type)
    setDetectionType(policy.condition.detectionType ?? '')
    setCountGt(policy.condition.countGt !== undefined ? String(policy.condition.countGt) : '')
    setKeyword(policy.condition.keyword ?? '')
    setRiskScoreGt(policy.condition.riskScoreGt !== undefined ? String(policy.condition.riskScoreGt) : '')
    setPolicyAction(policy.action)
    setPolicyFormError(null)
    setShowPolicyForm(true)
    setPoliciesOpen(true)
  }

  async function handleSubmitPolicy(e: React.FormEvent) {
    e.preventDefault()
    setPolicyFormError(null)
    if (!policyName.trim()) { setPolicyFormError('Name is required.'); return }
    setSubmittingPolicy(true)
    try {
      const body: Record<string, unknown> = { name: policyName.trim(), conditionType, action: policyAction }
      if (conditionType === 'detection_type') {
        if (detectionType) body.conditionDetectionType = detectionType
        if (countGt !== '') body.conditionCountGt = parseInt(countGt, 10)
      } else if (conditionType === 'keyword') {
        body.conditionKeyword = keyword.trim()
      } else if (conditionType === 'risk_score') {
        body.conditionRiskScoreGt = parseInt(riskScoreGt, 10)
      }
      if (editingPolicyId) {
        body.id = editingPolicyId
        const res = await fetch('/api/policies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const data = await res.json()
        if (!res.ok) { setPolicyFormError(data.error ?? 'Failed to update.'); return }
        setPolicies((prev) => prev.map((p) => p.id === editingPolicyId ? data.policy : p))
      } else {
        const res = await fetch('/api/policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const data = await res.json()
        if (!res.ok) { setPolicyFormError(data.error ?? 'Failed to create.'); return }
        setPolicies((prev) => [...prev, data.policy])
      }
      resetPolicyForm()
    } finally {
      setSubmittingPolicy(false)
    }
  }

  async function handleTogglePolicy(policy: Policy) {
    setPolicies((prev) => prev.map((p) => p.id === policy.id ? { ...p, enabled: !p.enabled } : p))
    await fetch('/api/policies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: policy.id, enabled: !policy.enabled }) })
  }

  async function handleDeletePolicy(id: string) {
    setPolicies((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/policies?id=${id}`, { method: 'DELETE' })
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition'
  const labelCls = 'block text-[10px] text-gray-400 mb-1'

  return (
    <aside className="w-72 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800 shrink-0">
        <Shield className="h-6 w-6 text-indigo-400 shrink-0" />
        <span className="font-bold text-white text-lg">PromptGuard</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {/* Nav links */}
        <NavLink href="/chat" active={pathname === '/chat'} icon={<MessageSquare className="h-4 w-4" />}>Chat</NavLink>
        <NavLink href="/setup" active={pathname === '/setup'} icon={<Sliders className="h-4 w-4" />}>Model Setup</NavLink>
        <NavLink href="/settings" active={pathname === '/settings'} icon={<Settings className="h-4 w-4" />}>Settings</NavLink>
        <NavLink href="/developer" active={pathname === '/developer'} icon={<Code2 className="h-4 w-4" />}>Developer Hub</NavLink>

        <div className="pt-2 pb-1">
          <p className="px-1 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Configuration</p>
        </div>

        {/* Provider & Model accordion */}
        <Accordion
          title="Provider & Model"
          icon={<Sliders className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
          badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">{currentProvider.label}</span>}
          open={modelOpen}
          onToggle={() => setModelOpen((p) => !p)}
        >
          <div>
            <label className={labelCls}>Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              className={inputCls}
            >
              {PROVIDERS.map((p) => <option key={p.provider} value={p.provider}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputCls}
            >
              {currentProvider.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </Accordion>

        {/* Firewall Filters accordion */}
        <Accordion
          title="Firewall Filters"
          icon={<Shield className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
          badge={
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 font-medium">
              {filters.length}/{FILTER_OPTIONS.length}
            </span>
          }
          open={filtersOpen}
          onToggle={() => setFiltersOpen((p) => !p)}
        >
          {FILTER_OPTIONS.map((f) => (
            <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.includes(f.id)}
                onChange={() => toggleFilter(f.id)}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-400 group-hover:text-gray-200 transition">{f.label}</span>
            </label>
          ))}
        </Accordion>

        {/* Guardrail Policies accordion */}
        <Accordion
          title="Guardrail Policies"
          icon={<ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
          badge={
            enabledPolicies > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 font-medium">
                {enabledPolicies} active
              </span>
            ) : undefined
          }
          open={policiesOpen}
          onToggle={() => setPoliciesOpen((p) => !p)}
        >
          {policiesLoading ? (
            <p className="text-xs text-gray-500 py-1">Loading…</p>
          ) : policies.length === 0 && !showPolicyForm ? (
            <p className="text-xs text-gray-500">No policies yet.</p>
          ) : (
            <div className="space-y-1.5">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className={`flex items-start justify-between gap-2 p-2 rounded-lg border text-xs transition ${
                    policy.enabled ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-800/20 border-gray-800 opacity-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-white font-medium truncate">{policy.name}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded border font-semibold uppercase tracking-wide shrink-0 ${ACTION_BADGE[policy.action]}`}>
                        {ACTION_LABELS[policy.action]}
                      </span>
                    </div>
                    <p className="text-gray-500 truncate text-[10px]">{conditionSummary(policy)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button onClick={() => handleTogglePolicy(policy)} className="text-gray-500 hover:text-gray-200 transition" title={policy.enabled ? 'Disable' : 'Enable'}>
                      {policy.enabled ? <ToggleRight className="h-4 w-4 text-indigo-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => startEditPolicy(policy)} className="text-gray-600 hover:text-indigo-400 transition" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeletePolicy(policy.id)} className="text-gray-600 hover:text-red-400 transition" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showPolicyForm ? (
            <form onSubmit={handleSubmitPolicy} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 mt-2 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {editingPolicyId ? 'Edit Policy' : 'New Policy'}
              </p>
              <div>
                <label className={labelCls}>Name</label>
                <input type="text" value={policyName} onChange={(e) => setPolicyName(e.target.value)} placeholder="e.g. Block keywords" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Condition</label>
                <select value={conditionType} onChange={(e) => setConditionType(e.target.value as PolicyConditionType)} className={inputCls}>
                  {(Object.entries(CONDITION_TYPE_LABELS) as [PolicyConditionType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {conditionType === 'detection_type' && (
                <>
                  <div>
                    <label className={labelCls}>Detection type</label>
                    <select value={detectionType} onChange={(e) => setDetectionType(e.target.value)} className={inputCls}>
                      {DETECTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Count greater than (optional)</label>
                    <input type="number" min="0" value={countGt} onChange={(e) => setCountGt(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                </>
              )}
              {conditionType === 'keyword' && (
                <div>
                  <label className={labelCls}>Keyword / Phrase</label>
                  <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder='"prod-db"' className={inputCls} />
                </div>
              )}
              {conditionType === 'risk_score' && (
                <div>
                  <label className={labelCls}>Risk score greater than (0–100)</label>
                  <input type="number" min="0" max="100" value={riskScoreGt} onChange={(e) => setRiskScoreGt(e.target.value)} placeholder="50" className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>Action</label>
                <select value={policyAction} onChange={(e) => setPolicyAction(e.target.value as PolicyAction)} className={inputCls}>
                  {(Object.entries(ACTION_LABELS) as [PolicyAction, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {policyFormError && <p className="text-[10px] text-red-400">{policyFormError}</p>}
              <div className="flex gap-1.5 pt-1">
                <button type="submit" disabled={submittingPolicy} className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition">
                  {submittingPolicy ? 'Saving…' : editingPolicyId ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={resetPolicyForm} className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button" onClick={() => setShowPolicyForm(true)}
              className="w-full flex items-center justify-center gap-1.5 mt-1 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-800/60 hover:border-indigo-600 rounded-lg transition"
            >
              <Plus className="h-3.5 w-3.5" /> New Policy
            </button>
          )}
        </Accordion>
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800 shrink-0">
        <p className="px-3 mb-3 text-xs text-gray-500 truncate">{userEmail}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}

function NavLink({ href, active, icon, children }: {
  href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
        active ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}
