'use client'

import { useState, useEffect } from 'react'
import { PROVIDERS, type Provider } from '@/lib/types'
import { Key, CheckCircle, Trash2, AlertCircle } from 'lucide-react'

interface SecretMeta {
  provider: Provider
  keyLast4: string
  updatedAt: string
}

export default function SetupPage() {
  const [secrets, setSecrets] = useState<SecretMeta[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider>('openai')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Provider | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSecrets()
  }, [])

  async function fetchSecrets() {
    const res = await fetch('/api/secrets')
    if (res.ok) {
      const data = await res.json()
      setSecrets(data.secrets ?? [])
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: selectedProvider, apiKey }),
    })
    const data = await res.json()
    if (res.ok) {
      setApiKey('')
      setMessage({ type: 'success', text: `API key for ${selectedProvider} saved securely.` })
      fetchSecrets()
    } else {
      setMessage({ type: 'error', text: data.error ?? 'Failed to save API key.' })
    }
    setSaving(false)
  }

  async function handleDelete(provider: Provider) {
    setDeleting(provider)
    const res = await fetch(`/api/secrets?provider=${provider}`, { method: 'DELETE' })
    if (res.ok) {
      setSecrets((prev) => prev.filter((s) => s.provider !== provider))
    }
    setDeleting(null)
  }

  const existingProviders = new Set(secrets.map((s) => s.provider))

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Model Setup</h1>
        <p className="text-gray-400 mb-8">
          Configure your AI provider API keys. Keys are encrypted at rest and never exposed after
          saving.
        </p>

        {/* Saved Keys */}
        {secrets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Saved API Keys
            </h2>
            <div className="space-y-2">
              {secrets.map((secret) => {
                const provider = PROVIDERS.find((p) => p.provider === secret.provider)
                return (
                  <div
                    key={secret.provider}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{provider?.label}</p>
                        <p className="text-xs text-gray-500">
                          ••••••••{secret.keyLast4} · Updated{' '}
                          {new Date(secret.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(secret.provider)}
                      disabled={deleting === secret.provider}
                      className="text-gray-500 hover:text-red-400 transition disabled:opacity-50"
                      title="Remove key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add / Update Key Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Key className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              {existingProviders.has(selectedProvider) ? 'Update' : 'Add'} API Key
            </h2>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 border ${
                message.type === 'success'
                  ? 'bg-green-900/40 border-green-700 text-green-300'
                  : 'bg-red-900/40 border-red-700 text-red-300'
              }`}
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as Provider)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.provider} value={p.provider}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">API Key</label>
              <input
                type="password"
                required
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono"
                placeholder="sk-..."
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Your key is encrypted with AES-256-GCM before storage and is never sent to the
                client.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
            >
              {saving ? 'Saving…' : existingProviders.has(selectedProvider) ? 'Update Key' : 'Save Key'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
