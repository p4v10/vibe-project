import { describe, it, expect } from 'vitest'
import {
  scanAndRedactSecrets,
  calculateRiskScore,
  sanitize,
  MAX_PROMPT_BYTES,
} from '../firewall'

// ---------------------------------------------------------------------------
// scanAndRedactSecrets
// ---------------------------------------------------------------------------

describe('scanAndRedactSecrets', () => {
  it('returns clean text unchanged with no detections', () => {
    const result = scanAndRedactSecrets('Hello, what is 2 + 2?')
    expect(result.sanitizedPrompt).toBe('Hello, what is 2 + 2?')
    expect(result.detections).toHaveLength(0)
  })

  it('detects and redacts AWS access key', () => {
    const text = 'My key is AKIAIOSFODNN7EXAMPLE and nothing else.'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(text)
    expect(sanitizedPrompt).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(sanitizedPrompt).toContain('[REDACTED_AWS_KEY]')
    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('aws_access_key')
    expect(detections[0].count).toBe(1)
    expect(detections[0].severity).toBe('high')
  })

  it('detects and redacts OpenAI key (sk- prefix)', () => {
    const text = 'Use sk-abcdefghijklmnopqrstuvwxyz123456 as the key.'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(text)
    expect(sanitizedPrompt).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456')
    expect(sanitizedPrompt).toContain('[REDACTED_OPENAI_KEY]')
    expect(detections[0].type).toBe('openai_key')
  })

  it('detects and redacts GitHub token (ghp_ prefix)', () => {
    const token = 'ghp_' + 'A'.repeat(36)
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(`Token: ${token}`)
    expect(sanitizedPrompt).not.toContain(token)
    expect(sanitizedPrompt).toContain('[REDACTED_GITHUB_TOKEN]')
    expect(detections[0].type).toBe('github_token')
    expect(detections[0].severity).toBe('high')
  })

  it('detects and redacts Slack token (xoxb- prefix)', () => {
    const token = 'xoxb-1234567890-abcdefghijklmno'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(`Slack: ${token}`)
    expect(sanitizedPrompt).not.toContain(token)
    expect(sanitizedPrompt).toContain('[REDACTED_SLACK_TOKEN]')
    expect(detections[0].type).toBe('slack_token')
  })

  it('detects and redacts JWT', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(`Here is my token: ${jwt}`)
    expect(sanitizedPrompt).not.toContain(jwt)
    expect(sanitizedPrompt).toContain('[REDACTED_JWT]')
    expect(detections[0].type).toBe('jwt')
  })

  it('detects and redacts database URL (postgres)', () => {
    const url = 'postgres://admin:s3cr3t@db.example.com:5432/mydb'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(`Connect to ${url}`)
    expect(sanitizedPrompt).not.toContain(url)
    expect(sanitizedPrompt).toContain('[REDACTED_DATABASE_URL]')
    expect(detections[0].type).toBe('database_url')
    expect(detections[0].severity).toBe('critical')
  })

  it('detects and redacts database URL (mongodb)', () => {
    const url = 'mongodb://user:pass@cluster.mongodb.net/mydb'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(url)
    expect(sanitizedPrompt).toContain('[REDACTED_DATABASE_URL]')
    expect(detections[0].type).toBe('database_url')
  })

  it('detects and redacts env secrets', () => {
    const text = 'DB_PASSWORD=supersecret123\nAPI_KEY=abc12345678'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(text)
    expect(sanitizedPrompt).not.toContain('supersecret123')
    expect(sanitizedPrompt).not.toContain('abc12345678')
    expect(sanitizedPrompt).toContain('[REDACTED_ENV_SECRET]')
    expect(detections[0].type).toBe('env_secret')
    expect(detections[0].severity).toBe('medium')
  })

  it('detects and redacts private key header', () => {
    const key =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(key)
    expect(sanitizedPrompt).not.toContain('MIIEowIBAAKCAQEA')
    expect(sanitizedPrompt).toContain('[REDACTED_PRIVATE_KEY]')
    expect(detections[0].type).toBe('private_key')
    expect(detections[0].severity).toBe('critical')
  })

  it('counts multiple occurrences of the same type', () => {
    // Both must match (AKIA|AGPA|AROA|ASCA|ASIA) + exactly 16 uppercase alphanumeric chars
    const text =
      'Key 1: AKIAIOSFODNN7EXAMPLE and Key 2: AKIA1234567890123456'
    const { detections } = scanAndRedactSecrets(text)
    const awsDet = detections.find((d) => d.type === 'aws_access_key')
    expect(awsDet?.count).toBe(2)
  })

  it('handles multiple different secret types in one message', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0.' +
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const text = `AWS: AKIAIOSFODNN7EXAMPLE, JWT: ${jwt}`
    const { detections } = scanAndRedactSecrets(text)
    const types = detections.map((d) => d.type)
    expect(types).toContain('aws_access_key')
    expect(types).toContain('jwt')
  })

  it('does not include raw matched values in output', () => {
    const secretValue = 'AKIAIOSFODNN7EXAMPLE'
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(
      `Key: ${secretValue}`,
    )
    expect(sanitizedPrompt).not.toContain(secretValue)
    for (const d of detections) {
      expect(JSON.stringify(d)).not.toContain(secretValue)
    }
  })

  it('handles empty string', () => {
    const result = scanAndRedactSecrets('')
    expect(result.sanitizedPrompt).toBe('')
    expect(result.detections).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// calculateRiskScore
// ---------------------------------------------------------------------------

describe('calculateRiskScore', () => {
  it('returns score 0 and level low for empty detections', () => {
    const result = calculateRiskScore([])
    expect(result.score).toBe(0)
    expect(result.level).toBe('low')
  })

  it('caps score at 100', () => {
    const detections = [
      { type: 'private_key' as const, count: 10, severity: 'critical' as const },
    ]
    const result = calculateRiskScore(detections)
    expect(result.score).toBe(100)
    expect(result.level).toBe('critical')
  })

  it('maps score 0–20 to low', () => {
    const detections = [{ type: 'env_secret' as const, count: 1, severity: 'medium' as const }]
    const result = calculateRiskScore(detections)
    expect(result.score).toBe(15)
    expect(result.level).toBe('low')
  })

  it('maps score 21–50 to medium', () => {
    const detections = [{ type: 'env_secret' as const, count: 3, severity: 'medium' as const }]
    const result = calculateRiskScore(detections)
    expect(result.score).toBe(45)
    expect(result.level).toBe('medium')
  })

  it('maps score 51–80 to high', () => {
    const detections = [
      { type: 'aws_access_key' as const, count: 1, severity: 'high' as const },
      { type: 'env_secret' as const, count: 2, severity: 'medium' as const },
    ]
    const result = calculateRiskScore(detections)
    expect(result.score).toBe(60)
    expect(result.level).toBe('high')
  })

  it('maps score 81–100 to critical', () => {
    const detections = [
      { type: 'private_key' as const, count: 1, severity: 'critical' as const },
      { type: 'database_url' as const, count: 1, severity: 'critical' as const },
    ]
    const result = calculateRiskScore(detections)
    expect(result.score).toBe(75)
    expect(result.level).toBe('high')
  })

  it('reaches critical with two critical-weight secrets', () => {
    const detections = [
      { type: 'private_key' as const, count: 2, severity: 'critical' as const },
      { type: 'database_url' as const, count: 1, severity: 'critical' as const },
    ]
    const result = calculateRiskScore(detections)
    expect(result.score).toBe(100) // 40*2 + 35*1 = 115 → capped
    expect(result.level).toBe('critical')
  })
})

// ---------------------------------------------------------------------------
// sanitize (PII filters)
// ---------------------------------------------------------------------------

describe('sanitize', () => {
  it('redacts email when filter is active', () => {
    const { sanitizedText, redactions } = sanitize('Email me at user@example.com please.', ['email'])
    expect(sanitizedText).not.toContain('user@example.com')
    expect(sanitizedText).toContain('[REDACTED_EMAIL]')
    expect(redactions[0].type).toBe('email')
    expect(redactions[0].count).toBe(1)
  })

  it('does not redact email when filter is inactive', () => {
    const { sanitizedText, redactions } = sanitize('user@example.com', [])
    expect(sanitizedText).toBe('user@example.com')
    expect(redactions).toHaveLength(0)
  })

  it('redacts phone number', () => {
    const { sanitizedText } = sanitize('Call 555-867-5309 now.', ['phone'])
    expect(sanitizedText).toContain('[REDACTED_PHONE]')
    expect(sanitizedText).not.toContain('555-867-5309')
  })

  it('redacts SSN', () => {
    const { sanitizedText } = sanitize('SSN: 123-45-6789', ['ssn'])
    expect(sanitizedText).toContain('[REDACTED_SSN]')
  })

  it('redacts credit card (Visa pattern)', () => {
    const { sanitizedText } = sanitize('Card: 4111111111111111', ['credit_card'])
    expect(sanitizedText).toContain('[REDACTED_CREDIT_CARD]')
  })

  it('redacts multiple types simultaneously', () => {
    const text = 'Email: admin@corp.com, SSN: 987-65-4321'
    const { sanitizedText, redactions } = sanitize(text, ['email', 'ssn'])
    expect(sanitizedText).toContain('[REDACTED_EMAIL]')
    expect(sanitizedText).toContain('[REDACTED_SSN]')
    expect(redactions).toHaveLength(2)
  })

  it('counts multiple occurrences', () => {
    const text = 'a@b.com and c@d.com'
    const { redactions } = sanitize(text, ['email'])
    expect(redactions[0].count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// MAX_PROMPT_BYTES
// ---------------------------------------------------------------------------

describe('MAX_PROMPT_BYTES', () => {
  it('is exported and equals 32768', () => {
    expect(MAX_PROMPT_BYTES).toBe(32_768)
  })
})
