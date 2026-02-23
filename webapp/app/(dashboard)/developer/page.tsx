'use client'

import { useEffect, useState } from 'react'
import {
  Key, Plus, Trash2, Copy, Check, AlertTriangle, BarChart2, Shield,
  RefreshCw, Code2, Ban
} from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_four: string
  status: 'active' | 'revoked'
  created_at: string
  last_used_at: string | null
}

interface UsageStats {
  total: number
  blocked: number
  totalRedactions: number
  riskBreakdown: Record<string, number>
  daily: { date: string; count: number }[]
}

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

const RISK_TEXT: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

export default function DeveloperPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dev-keys')
      .then((r) => r.json())
      .then((d) => setKeys(d.keys ?? []))
      .finally(() => setKeysLoading(false))

    fetch('/api/v1/usage')
      .then((r) => r.json())
      .then((d) => d.total !== undefined ? setUsage(d) : null)
      .finally(() => setUsageLoading(false))
  }, [])

  async function handleCreate() {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/dev-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) return
      setKeys((prev) => [data.key, ...prev])
      setRevealedKey(data.rawKey)
      setNewKeyName('')
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    setDeleteConfirm(null)
    setKeys((prev) => prev.filter((k) => k.id !== id))
    await fetch(`/api/dev-keys?id=${id}`, { method: 'DELETE' })
  }

  async function copyKey() {
    if (!revealedKey) return
    await navigator.clipboard.writeText(revealedKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500'

  return (
    <div className="min-h-full p-6 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Code2 className="h-6 w-6 text-indigo-400" />
          Developer Hub
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Integrate PromptGuard into your LLM pipeline with a single API call.
        </p>
      </div>

      {/* Quick-start */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-400" /> Quick Start
        </h2>
        <pre className="text-xs text-gray-300 overflow-x-auto leading-relaxed bg-gray-950 rounded-lg p-4 border border-gray-800">
{`curl -X POST https://your-domain.com/api/v1/scan \\
  -H "Authorization: Bearer pg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "My email is user@example.com",
    "filters": ["email", "phone"],
    "policies": []
  }'`}
        </pre>
        <p className="text-[11px] text-gray-500 mt-2">
          Response includes <code className="text-indigo-300">sanitizedPrompt</code>,{' '}
          <code className="text-indigo-300">riskScore</code>, and{' '}
          <code className="text-indigo-300">isBlocked</code>.
        </p>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-300 mb-1">
                Save your API key — it won't be shown again
              </p>
              <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700">
                <code className="flex-1 text-xs text-green-300 break-all font-mono">{revealedKey}</code>
                <button onClick={copyKey} className="text-gray-400 hover:text-white shrink-0 transition">
                  {copiedKey ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button onClick={() => setRevealedKey(null)} className="text-gray-600 hover:text-gray-400 text-xs shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* API Keys */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-400" /> API Keys
          </h2>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition"
            >
              <Plus className="h-3.5 w-3.5" /> New Key
            </button>
          )}
        </div>

        {showCreate && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] text-gray-400 mb-1">Key name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. Production app"
                className={inputCls}
                autoFocus
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewKeyName('') }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {keysLoading ? (
            <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center">
              <Key className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No API keys yet. Create one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Key</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last used</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3.5 text-white font-medium">{k.name}</td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs text-gray-300 font-mono">
                        {k.key_prefix}…{k.last_four}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {deleteConfirm === k.id ? (
                        <span className="flex items-center gap-2 justify-end">
                          <span className="text-[11px] text-red-400">Revoke?</span>
                          <button onClick={() => handleRevoke(k.id)} className="text-xs text-red-400 hover:text-red-300 font-medium transition">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 hover:text-gray-300 transition">No</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(k.id)}
                          className="text-gray-600 hover:text-red-400 transition"
                          title="Revoke"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <BarChart2 className="h-5 w-5 text-indigo-400" /> Usage (last 30 days)
        </h2>

        {usageLoading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
        ) : usage ? (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total Requests" value={usage.total} icon={<RefreshCw className="h-4 w-4 text-indigo-400" />} />
              <StatCard label="Blocked" value={usage.blocked} icon={<Ban className="h-4 w-4 text-red-400" />} color="text-red-300" />
              <StatCard label="Redactions Made" value={usage.totalRedactions} icon={<Shield className="h-4 w-4 text-green-400" />} color="text-green-300" />
            </div>

            {/* Risk breakdown */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Risk Level Breakdown</h3>
              <div className="space-y-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((level) => {
                  const count = (usage.riskBreakdown?.[level]) ?? 0
                  const pct = usage.total > 0 ? (count / usage.total) * 100 : 0
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-14 ${RISK_TEXT[level]}`}>{level}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${RISK_COLORS[level]} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Daily activity bar chart */}
            {usage.daily.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Daily Activity</h3>
                <div className="flex items-end gap-1 h-20">
                  {(() => {
                    const maxCount = Math.max(...usage.daily.map((d) => d.count), 1)
                    return usage.daily.map((d) => (
                      <div
                        key={d.date}
                        className="flex-1 bg-indigo-600/70 hover:bg-indigo-500 rounded-sm transition-all min-w-0"
                        style={{ height: `${(d.count / maxCount) * 100}%` }}
                        title={`${d.date}: ${d.count} requests`}
                      />
                    ))
                  })()}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                  <span>{usage.daily[0]?.date}</span>
                  <span>{usage.daily[usage.daily.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500 text-sm">No usage data yet.</div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color = 'text-white' }: {
  label: string; value: number; icon: React.ReactNode; color?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  )
}
