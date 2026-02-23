'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, ShieldCheck } from 'lucide-react'
import type { Policy, PolicyConditionType, PolicyAction } from '@/lib/types'

const CONDITION_TYPE_LABELS: Record<PolicyConditionType, string> = {
  detection_type: 'Secret/Detection type',
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

const ACTION_LABELS: Record<PolicyAction, { label: string; color: string }> = {
  allow: { label: 'Allow', color: 'text-green-400' },
  warn: { label: 'Warn', color: 'text-yellow-400' },
  mask: { label: 'Mask', color: 'text-blue-400' },
  block: { label: 'Block', color: 'text-red-400' },
}

const ACTION_BADGE: Record<PolicyAction, string> = {
  allow: 'bg-green-900/30 text-green-300 border-green-700/40',
  warn: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/40',
  mask: 'bg-blue-900/30 text-blue-300 border-blue-700/40',
  block: 'bg-red-900/30 text-red-300 border-red-700/40',
}

function conditionSummary(policy: Policy): string {
  const c = policy.condition
  if (c.type === 'detection_type') {
    const typeName = c.detectionType
      ? DETECTION_TYPE_OPTIONS.find((o) => o.value === c.detectionType)?.label ?? c.detectionType
      : 'any detection'
    const countPart = c.countGt !== undefined ? ` (count > ${c.countGt})` : ''
    return `Detects ${typeName}${countPart}`
  }
  if (c.type === 'keyword') return `Keyword: "${c.keyword}"`
  if (c.type === 'risk_score') return `Risk score > ${c.riskScoreGt}`
  return '—'
}

export default function PolicyManager() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [conditionType, setConditionType] = useState<PolicyConditionType>('detection_type')
  const [detectionType, setDetectionType] = useState('')
  const [countGt, setCountGt] = useState('')
  const [keyword, setKeyword] = useState('')
  const [riskScoreGt, setRiskScoreGt] = useState('')
  const [action, setAction] = useState<PolicyAction>('warn')

  const loadPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/policies')
      const data = await res.json()
      if (res.ok) setPolicies(data.policies ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPolicies() }, [loadPolicies])

  function resetForm() {
    setName('')
    setConditionType('detection_type')
    setDetectionType('')
    setCountGt('')
    setKeyword('')
    setRiskScoreGt('')
    setAction('warn')
    setFormError(null)
    setShowForm(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) { setFormError('Policy name is required.'); return }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        conditionType,
        action,
      }
      if (conditionType === 'detection_type') {
        if (detectionType) body.conditionDetectionType = detectionType
        if (countGt !== '') body.conditionCountGt = parseInt(countGt, 10)
      } else if (conditionType === 'keyword') {
        body.conditionKeyword = keyword.trim()
      } else if (conditionType === 'risk_score') {
        body.conditionRiskScoreGt = parseInt(riskScoreGt, 10)
      }

      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'Failed to create policy.'); return }
      setPolicies((prev) => [...prev, data.policy])
      resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(policy: Policy) {
    const optimistic = policies.map((p) =>
      p.id === policy.id ? { ...p, enabled: !p.enabled } : p,
    )
    setPolicies(optimistic)
    await fetch('/api/policies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: policy.id, enabled: !policy.enabled }),
    })
  }

  async function handleDelete(id: string) {
    setPolicies((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/policies?id=${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Guardrail Policies</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            New Policy
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Policy Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Block project keywords"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Condition Type</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as PolicyConditionType)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              {(Object.entries(CONDITION_TYPE_LABELS) as [PolicyConditionType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {conditionType === 'detection_type' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Detection type</label>
                <select
                  value={detectionType}
                  onChange={(e) => setDetectionType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                >
                  {DETECTION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Count greater than (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={countGt}
                  onChange={(e) => setCountGt(e.target.value)}
                  placeholder="e.g. 0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </div>
          )}

          {conditionType === 'keyword' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Keyword / Phrase</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder='e.g. "Project X" or "prod-db"'
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          )}

          {conditionType === 'risk_score' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Risk score greater than (0–100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={riskScoreGt}
                onChange={(e) => setRiskScoreGt(e.target.value)}
                placeholder="e.g. 50"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as PolicyAction)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              {(Object.entries(ACTION_LABELS) as [PolicyAction, { label: string }][]).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>

          {formError && (
            <p className="text-xs text-red-400">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              {submitting ? 'Creating…' : 'Create Policy'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Policy list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading policies…</p>
      ) : policies.length === 0 ? (
        <p className="text-sm text-gray-500">No policies yet. Create one to start enforcing guardrails.</p>
      ) : (
        <div className="space-y-2">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                policy.enabled ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-800/20 border-gray-800 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-white font-medium truncate">{policy.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide shrink-0 ${ACTION_BADGE[policy.action]}`}>
                    {ACTION_LABELS[policy.action].label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{conditionSummary(policy)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(policy)}
                  className="text-gray-400 hover:text-gray-200 transition"
                  title={policy.enabled ? 'Disable' : 'Enable'}
                >
                  {policy.enabled
                    ? <ToggleRight className="h-5 w-5 text-indigo-400" />
                    : <ToggleLeft className="h-5 w-5" />
                  }
                </button>
                <button
                  onClick={() => handleDelete(policy.id)}
                  className="text-gray-600 hover:text-red-400 transition"
                  title="Delete policy"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
