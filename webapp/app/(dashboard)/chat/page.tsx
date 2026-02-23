'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send, Shield, ShieldAlert, ShieldX, ShieldCheck,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import {
  type Message, type RiskScore, type RiskLevel, type Severity,
  type PolicyDecision, type PolicyAction,
} from '@/lib/types'
import { useDashboard } from '../DashboardContext'
import { nanoid } from 'nanoid'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingConfirmation {
  userMsgId: string
  originalInput: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  riskScore: RiskScore
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'text-green-400', medium: 'text-yellow-400',
  high: 'text-orange-400', critical: 'text-red-400',
}
const RISK_BG: Record<RiskLevel, string> = {
  low: 'bg-green-900/20 border-green-800/40', medium: 'bg-yellow-900/20 border-yellow-800/40',
  high: 'bg-orange-900/20 border-orange-800/40', critical: 'bg-red-900/20 border-red-800/40',
}
const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk', critical: 'Critical Risk',
}
const SEVERITY_CHIP: Record<Severity, string> = {
  medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  high: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  critical: 'bg-red-900/40 text-red-300 border-red-700/50',
}
const POLICY_ACTION_BADGE: Record<PolicyAction, string> = {
  allow: 'text-green-400', warn: 'text-yellow-400', mask: 'text-blue-400', block: 'text-red-400',
}
const POLICY_ACTION_BG: Record<PolicyAction, string> = {
  allow: 'bg-green-900/20 border-green-800/40', warn: 'bg-yellow-900/20 border-yellow-800/40',
  mask: 'bg-blue-900/20 border-blue-800/40', block: 'bg-red-900/20 border-red-800/40',
}
const POLICY_ACTION_LABELS: Record<PolicyAction, string> = {
  allow: 'Policy: Allowed', warn: 'Policy Warning', mask: 'Policy: Masked', block: 'Policy: Blocked',
}

// ─── Small components ─────────────────────────────────────────────────────────

function MaskedPromptReveal({ maskedContent }: { maskedContent: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="self-end mt-0.5">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
      >
        <Shield className="h-3.5 w-3.5 shrink-0" />
        Sent as redacted
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1 px-3 py-2 bg-blue-900/20 border border-blue-800/40 rounded-lg max-w-xs">
          <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-1">Prompt sent to AI</p>
          <p className="text-xs text-blue-200 whitespace-pre-wrap break-words">{maskedContent}</p>
        </div>
      )}
    </div>
  )
}

function RiskBadge({ riskScore }: { riskScore: RiskScore }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = riskScore.level === 'critical' ? ShieldX : riskScore.level === 'high' || riskScore.level === 'medium' ? ShieldAlert : Shield
  return (
    <div className="mt-1">
      <button onClick={() => setExpanded((p) => !p)} className={`flex items-center gap-1.5 text-xs ${RISK_COLORS[riskScore.level]} hover:opacity-80 transition`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {RISK_LABELS[riskScore.level]} · Score {riskScore.score}/100
        {riskScore.detections.length > 0 && (expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
      {expanded && riskScore.detections.length > 0 && (
        <div className={`mt-1 p-2 border rounded-lg ${RISK_BG[riskScore.level]} space-y-1.5`}>
          {riskScore.detections.map((d) => (
            <div key={d.type} className="flex items-center justify-between gap-3">
              <span className={`text-xs ${RISK_COLORS[riskScore.level]}`}>{d.count}× {d.type.replace(/_/g, ' ')}</span>
              {d.severity && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${SEVERITY_CHIP[d.severity]}`}>
                  {d.severity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PolicyDecisionBadge({ decision }: { decision: PolicyDecision }) {
  const [expanded, setExpanded] = useState(false)
  if (decision.matches.length === 0) return null
  return (
    <div className="mt-1">
      <button onClick={() => setExpanded((p) => !p)} className={`flex items-center gap-1.5 text-xs ${POLICY_ACTION_BADGE[decision.action]} hover:opacity-80 transition`}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        {POLICY_ACTION_LABELS[decision.action]}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className={`mt-1 p-2 border rounded-lg ${POLICY_ACTION_BG[decision.action]} space-y-1`}>
          {decision.matches.map((m) => (
            <p key={m.policyId} className={`text-xs ${POLICY_ACTION_BADGE[decision.action]}`}>{m.policyName}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function ConfirmationModal({ pending, onConfirm, onCancel }: {
  pending: PendingConfirmation; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-orange-700/60 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="h-6 w-6 text-orange-400 shrink-0" />
          <h2 className="text-lg font-semibold text-white">High Risk Detected</h2>
        </div>
        <p className="text-sm text-gray-300 mb-3">Your message contains potentially sensitive secrets. Review before sending.</p>
        <div className={`p-3 rounded-lg border mb-4 ${RISK_BG.high}`}>
          <p className="text-xs text-orange-300 font-medium mb-1">Risk Score: {pending.riskScore.score}/100</p>
          {pending.riskScore.detections.map((d) => (
            <p key={d.type} className="text-xs text-orange-300">{d.count}× {d.type.replace(/_/g, ' ')}</p>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-5">
          The firewall will redact detected patterns before sending to the AI provider. You can still proceed if this is intentional.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition">Send Anyway</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { provider, model, filters } = useDashboard()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRedactions, setExpandedRedactions] = useState<Set<string>>(new Set())
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function toggleRedactions(id: string) {
    setExpandedRedactions((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function sendMessage(userMsg: Message, allMessages: Message[], bypassConfirmation = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, messages: allMessages.map(({ role, content }) => ({ role, content })), filters, bypassConfirmation }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.blocked) {
          setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, riskScore: data.riskScore ?? m.riskScore, policyDecision: data.policyDecision ?? m.policyDecision } : m))
          setError(data.error ?? 'Message blocked.')
        } else {
          setError(data.error ?? 'Something went wrong.')
        }
        return
      }
      if (data.requiresConfirmation && data.riskScore) {
        setPendingConfirmation({ userMsgId: userMsg.id, originalInput: userMsg.content, messages: allMessages.map(({ role, content }) => ({ role, content })), riskScore: data.riskScore })
        setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, riskScore: data.riskScore } : m))
        return
      }
      setMessages((prev) => prev.map((m) =>
        m.id === userMsg.id
          ? { ...m, riskScore: data.riskScore ?? m.riskScore, policyDecision: data.policyDecision ?? m.policyDecision, maskedContent: data.maskedUserMessage ?? m.maskedContent }
          : m
      ))
      setMessages((prev) => [...prev, { id: nanoid(), role: 'assistant', content: data.message, sanitizationSummary: data.sanitizationSummary }])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg: Message = { id: nanoid(), role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    await sendMessage(userMsg, newMessages, false)
  }

  async function handleConfirm() {
    if (!pendingConfirmation) return
    const { userMsgId, messages: capturedMessages, riskScore } = pendingConfirmation
    setPendingConfirmation(null)
    const userMsg = messages.find((m) => m.id === userMsgId)
    if (!userMsg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, messages: capturedMessages, filters, bypassConfirmation: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.blocked && data.riskScore) {
          setMessages((prev) => prev.map((m) => m.id === userMsgId ? { ...m, riskScore: data.riskScore } : m))
          setError(data.error ?? 'Message blocked.')
        } else {
          setError(data.error ?? 'Something went wrong.')
        }
        return
      }
      setMessages((prev) =>
        prev.map((m) => m.id === userMsgId ? { ...m, riskScore } : m)
            .concat({ id: nanoid(), role: 'assistant', content: data.message, sanitizationSummary: data.sanitizationSummary })
      )
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleCancelConfirmation() {
    if (!pendingConfirmation) return
    const { userMsgId, originalInput } = pendingConfirmation
    setPendingConfirmation(null)
    setMessages((prev) => prev.filter((m) => m.id !== userMsgId))
    setInput(originalInput)
  }

  return (
    <>
      {pendingConfirmation && (
        <ConfirmationModal pending={pendingConfirmation} onConfirm={handleConfirm} onCancel={handleCancelConfirmation} />
      )}

      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Shield className="h-12 w-12 text-indigo-400 mb-4 opacity-60" />
              <h2 className="text-lg font-semibold text-white mb-2">PromptGuard Chat</h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Your messages are automatically scanned for sensitive data before being sent to the AI provider.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                  {msg.content}
                </div>

                {msg.role === 'user' && msg.maskedContent && (
                  <MaskedPromptReveal maskedContent={msg.maskedContent} />
                )}

                {msg.role === 'user' && msg.riskScore && (
                  <div className="self-end"><RiskBadge riskScore={msg.riskScore} /></div>
                )}
                {msg.role === 'user' && msg.policyDecision && msg.policyDecision.matches.length > 0 && (
                  <div className="self-end"><PolicyDecisionBadge decision={msg.policyDecision} /></div>
                )}

                {msg.role === 'assistant' && msg.sanitizationSummary && msg.sanitizationSummary.length > 0 && (
                  <div className="w-full">
                    <button onClick={() => toggleRedactions(msg.id)} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      Sensitive data redacted
                      {expandedRedactions.has(msg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {expandedRedactions.has(msg.id) && (
                      <div className="mt-1 p-2 bg-amber-900/20 border border-amber-800/40 rounded-lg">
                        {msg.sanitizationSummary.map((r) => (
                          <p key={r.type} className="text-xs text-amber-300">{r.count}× {r.type.replace('_', ' ')} redacted</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}


              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              disabled={loading || !!pendingConfirmation}
              placeholder={pendingConfirmation ? 'Awaiting confirmation…' : 'Type a message…'}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition disabled:opacity-50"
            />
            <button
              type="submit" disabled={loading || !input.trim() || !!pendingConfirmation}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-gray-600">
            Protected by PromptGuard · Sensitive data is redacted before reaching the AI provider
          </p>
        </div>
      </div>
    </>
  )
}
