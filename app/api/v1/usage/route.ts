import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logs, error } = await supabase
    .from('api_usage_logs')
    .select('created_at, risk_level, is_blocked, redaction_count, bytes_processed')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 })

  const rows = logs ?? []
  const total = rows.length
  const blocked = rows.filter((r) => r.is_blocked).length
  const totalRedactions = rows.reduce((sum, r) => sum + (r.redaction_count ?? 0), 0)

  const riskBreakdown: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
  for (const r of rows) {
    const lvl = r.risk_level as string
    if (lvl in riskBreakdown) riskBreakdown[lvl]++
  }

  const dailyMap: Record<string, number> = {}
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + 1
  }
  const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  return NextResponse.json({ total, blocked, totalRedactions, riskBreakdown, daily })
}
