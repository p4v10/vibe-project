import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { sanitize, scanAndRedactSecrets, calculateRiskScore, MAX_PROMPT_BYTES } from '@/lib/firewall'
import { evaluatePolicies } from '@/lib/policy-engine'
import type { Provider, FilterType, RiskScore, Policy, PolicyDecision } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  provider: Provider
  model: string
  messages: ChatMessage[]
  filters: FilterType[]
  bypassConfirmation?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { provider, model, messages, filters, bypassConfirmation } = body

  if (!provider || !model || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Load encrypted API key
  const { data: secretRow, error: secretError } = await supabase
    .from('user_secrets')
    .select('key_ciphertext')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single()

  if (secretError || !secretRow) {
    return NextResponse.json(
      { error: `No API key found for ${provider}. Please add one in Model Setup.` },
      { status: 400 }
    )
  }

  let apiKey: string
  try {
    apiKey = decrypt(secretRow.key_ciphertext)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API key. Please re-add your key.' }, { status: 500 })
  }

  // Enforce prompt size limit (guard against oversized payloads)
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUserMessage) {
    const byteLen = new TextEncoder().encode(lastUserMessage.content).length
    if (byteLen > MAX_PROMPT_BYTES) {
      return NextResponse.json(
        { error: `Prompt exceeds maximum allowed size (${MAX_PROMPT_BYTES / 1024} KB).` },
        { status: 413 }
      )
    }
  }

  // Secret scanning: always-on, runs on all user messages, redacts before risk gate
  let riskScore: RiskScore | null = null
  const secretScanMessages = messages.map((msg) => {
    if (msg.role !== 'user') return msg
    const { sanitizedPrompt } = scanAndRedactSecrets(msg.content)
    return { ...msg, content: sanitizedPrompt }
  })

  // Risk scoring is based on the last user message (pre-redaction for accurate detection)
  if (lastUserMessage) {
    const { detections } = scanAndRedactSecrets(lastUserMessage.content)
    if (detections.length > 0) {
      riskScore = calculateRiskScore(detections)
    }
  }

  // Enforce risk level gates
  if (riskScore) {
    if (riskScore.level === 'critical') {
      return NextResponse.json(
        {
          error: 'Message blocked: critical risk secrets detected. Remove sensitive data and try again.',
          riskScore,
          blocked: true,
        },
        { status: 422 }
      )
    }
    if (riskScore.level === 'high' && !bypassConfirmation) {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          riskScore,
        },
        { status: 200 }
      )
    }
  }

  // Policy engine: load user policies and evaluate against detection context
  let policyDecision: PolicyDecision | null = null

  const { data: policyRows } = await supabase
    .from('user_policies')
    .select('*')
    .eq('user_id', user.id)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (policyRows && policyRows.length > 0 && lastUserMessage) {
    const policies: Policy[] = policyRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      enabled: row.enabled,
      condition: {
        type: row.condition_type,
        detectionType: row.condition_detection_type ?? undefined,
        countGt: row.condition_count_gt ?? undefined,
        keyword: row.condition_keyword ?? undefined,
        riskScoreGt: row.condition_risk_score_gt ?? undefined,
      },
      action: row.action,
      createdAt: row.created_at,
    }))

    const { detections: lastDetections } = scanAndRedactSecrets(lastUserMessage.content)
    const evalCtx = {
      detections: lastDetections,
      riskScore,
      messageText: lastUserMessage.content,
    }

    const decision = evaluatePolicies(policies, evalCtx)
    if (decision.matches.length > 0) {
      policyDecision = decision

      if (decision.action === 'block') {
        const matchedNames = decision.matches.map((m) => m.policyName).join(', ')
        return NextResponse.json(
          {
            error: `Message blocked by policy: ${matchedNames}`,
            policyDecision,
            blocked: true,
            riskScore,
          },
          { status: 422 }
        )
      }

      // Apply keyword masking from mask policies
      if (decision.action === 'mask') {
        const keywordMasks = decision.matches
          .filter((m) => m.action === 'mask')
          .map((m) => policies.find((p) => p.id === m.policyId))
          .filter((p): p is Policy => !!p && p.condition.type === 'keyword' && !!p.condition.keyword)

        if (keywordMasks.length > 0) {
          secretScanMessages.forEach((msg, i) => {
            if (msg.role !== 'user') return
            let content = msg.content
            for (const policy of keywordMasks) {
              const escaped = policy.condition.keyword!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              content = content.replace(new RegExp(escaped, 'gi'), '[REDACTED_BY_POLICY]')
            }
            secretScanMessages[i] = { ...msg, content }
          })
        }
      }
    }
  }

  // PII sanitize (user-controlled filters) runs on already-secret-redacted messages
  const activeFilters = Array.isArray(filters) ? filters : []
  let sanitizationSummary: { type: FilterType; count: number }[] = []

  const lastUserIndex = secretScanMessages.reduce((idx, msg, i) => msg.role === 'user' ? i : idx, -1)

  const sanitizedMessages = secretScanMessages.map((msg, i) => {
    if (msg.role !== 'user') return msg
    const { sanitizedText, redactions } = sanitize(msg.content, activeFilters)
    // Only track redactions from the current (last) user message for the UI summary
    if (i === lastUserIndex) {
      sanitizationSummary = redactions.map((r) => ({ type: r.type, count: r.count }))
    }
    return { ...msg, content: sanitizedText }
  })

  // Send to provider
  let assistantMessage: string

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages: sanitizedMessages }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return NextResponse.json(
          { error: err?.error?.message ?? `OpenAI error: ${response.status}` },
          { status: response.status }
        )
      }
      const data = await response.json()
      assistantMessage = data.choices?.[0]?.message?.content ?? ''
    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: sanitizedMessages.filter((m) => m.role !== 'system'),
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return NextResponse.json(
          { error: err?.error?.message ?? `Anthropic error: ${response.status}` },
          { status: response.status }
        )
      }
      const data = await response.json()
      assistantMessage = data.content?.[0]?.text ?? ''
    } else if (provider === 'google') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: sanitizedMessages
              .filter((m) => m.role !== 'system')
              .map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
          }),
        }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return NextResponse.json(
          { error: err?.error?.message ?? `Google error: ${response.status}` },
          { status: response.status }
        )
      }
      const data = await response.json()
      assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Failed to contact AI provider' }, { status: 502 })
  }

  // Capture the final sanitized text of the last user message to show in UI
  const finalLastUserMessage = sanitizedMessages.findLast((m) => m.role === 'user')
  const maskedUserMessage =
    finalLastUserMessage && lastUserMessage &&
    finalLastUserMessage.content !== lastUserMessage.content
      ? finalLastUserMessage.content
      : undefined

  return NextResponse.json({
    message: assistantMessage,
    sanitizationSummary,
    riskScore,
    policyDecision,
    maskedUserMessage,
  })
}
