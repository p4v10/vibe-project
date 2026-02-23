import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PolicyConditionType, PolicyAction } from '@/lib/types'

const ALLOWED_EXTENSION_ORIGIN_PREFIX = 'chrome-extension://'

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin &&
    (origin.startsWith(ALLOWED_EXTENSION_ORIGIN_PREFIX) || origin === 'http://localhost:3000')
  return allowed
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      }
    : {}
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

interface CreatePolicyBody {
  name: string
  conditionType: PolicyConditionType
  conditionDetectionType?: string
  conditionCountGt?: number
  conditionKeyword?: string
  conditionRiskScoreGt?: number
  action: PolicyAction
}

interface PatchPolicyBody {
  id: string
  enabled: boolean
}

function rowToPolicy(row: Record<string, unknown>) {
  return {
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
  }
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  }

  const { data, error } = await supabase
    .from('user_policies')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load policies' }, { status: 500, headers })
  }
  return NextResponse.json({ policies: (data ?? []).map(rowToPolicy) }, { headers })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreatePolicyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, conditionType, conditionDetectionType, conditionCountGt,
          conditionKeyword, conditionRiskScoreGt, action } = body

  if (!name?.trim() || !conditionType || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (conditionType === 'keyword' && !conditionKeyword?.trim()) {
    return NextResponse.json({ error: 'Keyword condition requires a keyword' }, { status: 400 })
  }
  if (conditionType === 'risk_score' && conditionRiskScoreGt === undefined) {
    return NextResponse.json({ error: 'Risk score condition requires a threshold' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_policies')
    .insert({
      user_id: user.id,
      name: name.trim(),
      enabled: true,
      condition_type: conditionType,
      condition_detection_type: conditionType === 'detection_type' ? (conditionDetectionType ?? null) : null,
      condition_count_gt: conditionCountGt ?? null,
      condition_keyword: conditionType === 'keyword' ? conditionKeyword!.trim() : null,
      condition_risk_score_gt: conditionType === 'risk_score' ? conditionRiskScoreGt : null,
      action,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 })
  return NextResponse.json({ policy: rowToPolicy(data) }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchPolicyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id, enabled } = body
  if (!id) return NextResponse.json({ error: 'Missing policy id' }, { status: 400 })

  const { error } = await supabase
    .from('user_policies')
    .update({ enabled })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id: string } & Partial<CreatePolicyBody>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id, name, conditionType, conditionDetectionType, conditionCountGt,
          conditionKeyword, conditionRiskScoreGt, action } = body

  if (!id) return NextResponse.json({ error: 'Missing policy id' }, { status: 400 })
  if (!name?.trim() || !conditionType || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_policies')
    .update({
      name: name.trim(),
      condition_type: conditionType,
      condition_detection_type: conditionType === 'detection_type' ? (conditionDetectionType ?? null) : null,
      condition_count_gt: conditionCountGt ?? null,
      condition_keyword: conditionType === 'keyword' ? (conditionKeyword?.trim() ?? null) : null,
      condition_risk_score_gt: conditionType === 'risk_score' ? conditionRiskScoreGt : null,
      action,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 })
  return NextResponse.json({ policy: rowToPolicy(data) })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing policy id' }, { status: 400 })

  const { error } = await supabase
    .from('user_policies')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
