import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import type { Provider } from '@/lib/types'

const VALID_PROVIDERS: Provider[] = ['openai', 'anthropic', 'google']

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_secrets')
    .select('provider, key_last4, updated_at')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch secrets' }, { status: 500 })
  }

  const secrets = (data ?? []).map((row) => ({
    provider: row.provider,
    keyLast4: row.key_last4,
    updatedAt: row.updated_at,
  }))

  return NextResponse.json({ secrets })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { provider: string; apiKey: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { provider, apiKey } = body

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return NextResponse.json({ error: 'API key is too short' }, { status: 400 })
  }

  const keyCiphertext = encrypt(apiKey.trim())
  const keyLast4 = apiKey.trim().slice(-4)

  const { error } = await supabase.from('user_secrets').upsert(
    {
      user_id: user.id,
      provider,
      key_ciphertext: keyCiphertext,
      key_last4: keyLast4,
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) {
    return NextResponse.json({ error: 'Failed to save secret' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, keyLast4 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_secrets')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete secret' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
