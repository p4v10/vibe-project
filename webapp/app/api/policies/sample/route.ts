import { NextResponse } from 'next/server'

const ALLOWED_EXTENSION_ORIGIN_PREFIX = 'chrome-extension://'

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin &&
    (origin.startsWith(ALLOWED_EXTENSION_ORIGIN_PREFIX) ||
      origin === 'https://promptguard-p4.vercel.app' ||
      origin === 'http://localhost:3000')
  return allowed
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    : {}
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)

  const samplePolicies = [
    {
      id: 'sample-1',
      userId: 'sample',
      name: 'Block private keys',
      enabled: true,
      condition: { type: 'detection_type', detectionType: 'private_key', countGt: 0 },
      action: 'block',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-2',
      userId: 'sample',
      name: 'Warn on high risk',
      enabled: true,
      condition: { type: 'risk_score', riskScoreGt: 50 },
      action: 'warn',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-3',
      userId: 'sample',
      name: 'Mask "confidential"',
      enabled: true,
      condition: { type: 'keyword', keyword: 'confidential' },
      action: 'mask',
      createdAt: new Date().toISOString(),
    },
  ]

  return NextResponse.json(
    { policies: samplePolicies, source: 'sample' },
    { headers },
  )
}
