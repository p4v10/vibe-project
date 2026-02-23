import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/api-key'
import { scanAndRedactSecrets, calculateRiskScore, sanitize, MAX_PROMPT_BYTES } from '@/lib/firewall'
import { evaluatePolicies } from '@/lib/policy-engine'
import type { FilterType, Policy } from '@/lib/types'

const VALID_MODELS = new Set([
  'gpt-5', 'gpt-5.2',
  'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5',
  'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro',
])

interface ScanBody {
  prompt: string
  model?: string
  filters?: FilterType[]
  policies?: Omit<Policy, 'id' | 'userId' | 'createdAt'>[]
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 })
  }

  const admin = getAdminClient()
  const tokenHash = hashApiKey(token)

  const { data: keyRow, error: keyError } = await admin
    .from('developer_api_keys')
    .select('id, user_id, status')
    .eq('key_hash', tokenHash)
    .single() as { data: { id: string; user_id: string; status: string } | null; error: unknown }

  if (keyError || !keyRow) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }
  if (keyRow.status !== 'active') {
    return NextResponse.json({ error: 'API key is revoked' }, { status: 403 })
  }

  let body: ScanBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, model, filters = [], policies: rawPolicies = [] } = body

  if (model !== undefined && !VALID_MODELS.has(model)) {
    return NextResponse.json({ error: `Unknown model "${model}". Valid models: ${[...VALID_MODELS].join(', ')}` }, { status: 400 })
  }

  // Normalize policies: accept both flat { type, keyword, action } and nested { condition: {...}, action }
  const policies = (rawPolicies as Record<string, unknown>[]).map((p): Policy => {
    if (p.condition && typeof p.condition === 'object') {
      return p as unknown as Policy
    }
    const { type, keyword, detectionType, countGt, riskScoreGt, action, name, enabled, id, userId, createdAt } = p
    return {
      id: (id as string) ?? crypto.randomUUID(),
      userId: (userId as string) ?? '',
      name: (name as string) ?? 'inline',
      enabled: enabled !== false,
      createdAt: (createdAt as string) ?? new Date().toISOString(),
      action: action as Policy['action'],
      condition: {
        type: type as Policy['condition']['type'],
        keyword: keyword as string | undefined,
        detectionType: detectionType as string | undefined,
        countGt: countGt as number | undefined,
        riskScoreGt: riskScoreGt as number | undefined,
      },
    }
  })

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required and must be a non-empty string' }, { status: 400 })
  }

  const promptBytes = Buffer.byteLength(prompt, 'utf8')
  if (promptBytes > MAX_PROMPT_BYTES) {
    return NextResponse.json({ error: `Prompt exceeds ${MAX_PROMPT_BYTES} byte limit` }, { status: 413 })
  }

  // Always-on secret scanning
  const { sanitizedPrompt: afterSecrets, detections } = scanAndRedactSecrets(prompt)
  const riskScore = calculateRiskScore(detections)

  // User-selected PII filters
  const { sanitizedText: afterFilters, redactions } = sanitize(afterSecrets, filters)

  // Keyword masking from inline policies
  let sanitizedPrompt = afterFilters
  const keywordPolicies = (policies as Policy[]).filter(
    (p) => p.enabled !== false && p.condition?.type === 'keyword' && p.condition?.keyword && p.action === 'mask',
  )
  for (const pol of keywordPolicies) {
    const kw = pol.condition.keyword!
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    sanitizedPrompt = sanitizedPrompt.replace(new RegExp(escaped, 'gi'), '[REDACTED_KEYWORD]')
  }

  // Policy evaluation
  const enabledPolicies = (policies as Policy[]).filter((p) => p.enabled !== false)
  const policyDecision = evaluatePolicies(enabledPolicies, {
    detections,
    riskScore,
    messageText: prompt,
  })

  const isBlocked = policyDecision.action === 'block'

  // Fire-and-forget usage log + update last_used_at
  const totalRedactions = redactions.reduce((s, r) => s + r.count, 0) + detections.length
  Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('api_usage_logs') as any).insert({
      api_key_id: keyRow.id,
      user_id: keyRow.user_id,
      endpoint: '/v1/scan',
      bytes_processed: promptBytes,
      risk_score: riskScore.score,
      risk_level: riskScore.level,
      is_blocked: isBlocked,
      redaction_count: totalRedactions,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('developer_api_keys') as any)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id),
  ]).catch(() => {})

  return NextResponse.json({
    model: model ?? null,
    sanitizedPrompt,
    riskScore,
    isBlocked,
    policyDecision,
    redactions,
    secretDetections: detections.map(({ type, count, severity }) => ({ type, count, severity })),
  })
}
