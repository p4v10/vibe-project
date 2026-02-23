import { describe, it, expect } from 'vitest'
import { scanAndRedactSecrets, calculateRiskScore, sanitize } from '../firewall'

describe('scanAndRedactSecrets', () => {
  it('detects and redacts a database URL (critical)', () => {
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(
      'My DB is postgres://admin:p@ssword@db.example.com:5432/main',
    )
    expect(sanitizedPrompt).toContain('[REDACTED_DATABASE_URL]')
    expect(detections).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'database_url', severity: 'critical' }),
    ]))
  })

  it('detects and redacts an AWS access key', () => {
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(
      'Key: AKIAIOSFODNN7EXAMPLE',
    )
    expect(sanitizedPrompt).toContain('[REDACTED_AWS_ACCESS_KEY]')
    expect(detections).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'aws_access_key' }),
    ]))
  })

  it('detects and redacts an AWS secret key (40 chars)', () => {
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(
      'Secret: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    )
    expect(sanitizedPrompt).toContain('[REDACTED_AWS_SECRET_KEY]')
    expect(detections).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'aws_secret_key', severity: 'critical' }),
    ]))
  })

  it('detects a private key (critical)', () => {
    const { detections } = scanAndRedactSecrets(
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----',
    )
    expect(detections).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'private_key', severity: 'critical' }),
    ]))
  })

  it('detects a GitHub token', () => {
    const { sanitizedPrompt, detections } = scanAndRedactSecrets(
      'token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890',
    )
    expect(sanitizedPrompt).toContain('[REDACTED_GITHUB_TOKEN]')
    expect(detections[0].type).toBe('github_token')
  })

  it('detects a Slack token', () => {
    const { sanitizedPrompt } = scanAndRedactSecrets(
      'xoxb-123456789-987654321-AbCdEfGhIjKlMnOpQrSt',
    )
    expect(sanitizedPrompt).toContain('[REDACTED_SLACK_TOKEN]')
  })

  it('returns empty detections for clean text', () => {
    const { detections } = scanAndRedactSecrets('What are best practices for Node.js security?')
    expect(detections).toHaveLength(0)
  })
})

describe('calculateRiskScore', () => {
  it('private_key alone scores critical (≥81)', () => {
    const { sanitizedPrompt: _, detections } = scanAndRedactSecrets(
      '-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----',
    )
    const risk = calculateRiskScore(detections)
    expect(risk.level).toBe('critical')
    expect(risk.score).toBeGreaterThanOrEqual(81)
  })

  it('database_url alone scores critical', () => {
    const { detections } = scanAndRedactSecrets('postgres://user:pass@host/db')
    const risk = calculateRiskScore(detections)
    expect(risk.level).toBe('critical')
  })

  it('two token detections score high (51–80)', () => {
    const { detections } = scanAndRedactSecrets(
      'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890 xoxb-123456789-987654321-AbCdEfGhIjKlMnOpQrSt',
    )
    const risk = calculateRiskScore(detections)
    expect(risk.score).toBe(60)
    expect(risk.level).toBe('high')
  })

  it('env_secret alone scores low–medium', () => {
    const { detections } = scanAndRedactSecrets('PASSWORD=mysecret123')
    const risk = calculateRiskScore(detections)
    expect(['low', 'medium']).toContain(risk.level)
  })

  it('caps score at 100', () => {
    const { detections } = scanAndRedactSecrets(
      'postgres://user:pass@host/db AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    )
    const risk = calculateRiskScore(detections)
    expect(risk.score).toBe(100)
  })
})

describe('sanitize (PII filters)', () => {
  it('redacts email when filter is active', () => {
    const { sanitizedText, redactions } = sanitize('Contact bob@example.com now', ['email'])
    expect(sanitizedText).toContain('[REDACTED_EMAIL]')
    expect(redactions[0].count).toBe(1)
  })

  it('redacts phone number with separator', () => {
    const { sanitizedText } = sanitize('Call 415-555-0192 today', ['phone'])
    expect(sanitizedText).toContain('[REDACTED_PHONE]')
  })

  it('does NOT redact phone-like digits inside an alphanumeric string', () => {
    const { sanitizedText } = sanitize('Key: AKIA1234567890EXAMPLE', ['phone'])
    expect(sanitizedText).not.toContain('[REDACTED_PHONE]')
    expect(sanitizedText).toBe('Key: AKIA1234567890EXAMPLE')
  })

  it('redacts SSN', () => {
    const { sanitizedText } = sanitize('SSN: 123-45-6789', ['ssn'])
    expect(sanitizedText).toContain('[REDACTED_SSN]')
  })

  it('does not redact when filter is not active', () => {
    const { sanitizedText } = sanitize('Email: bob@example.com', [])
    expect(sanitizedText).toBe('Email: bob@example.com')
  })
})
