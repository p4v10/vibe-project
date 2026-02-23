import type { FilterType, SecretType, Severity, Detection, RiskScore, RiskLevel, SecretScanResult } from '@/lib/types'

export const MAX_PROMPT_BYTES = 32_768 // 32 KB hard limit

export interface RedactionEntry {
  type: FilterType
  count: number
}

export interface SanitizationResult {
  sanitizedText: string
  redactions: RedactionEntry[]
}

// ---------------------------------------------------------------------------
// PII redaction rules (user-controlled filters)
// ---------------------------------------------------------------------------

interface RedactionRule {
  type: FilterType
  pattern: RegExp
  replacement: string
}

const REDACTION_RULES: RedactionRule[] = [
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    type: 'phone',
    pattern: /(?<![A-Za-z0-9])(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?![A-Za-z0-9])/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[REDACTED_SSN]',
  },
  {
    type: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    replacement: '[REDACTED_CREDIT_CARD]',
  },
  {
    type: 'api_key',
    pattern: /\b(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{35}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}|xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+)\b/g,
    replacement: '[REDACTED_API_KEY]',
  },
  {
    type: 'address',
    pattern: /\b\d{1,5}\s+[A-Z][a-zA-Z0-9\s]{2,40}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir)\.?(?:\s+(?:Apt|Suite|Ste|Unit|#)\s*[A-Za-z0-9]+)?\b/g,
    replacement: '[REDACTED_ADDRESS]',
  },
  {
    type: 'person_name',
    pattern: /\b(?:(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+)?[A-Z][a-z]{1,20}\s+(?:[A-Z][a-z]{0,10}\s+)?[A-Z][a-z]{1,20}\b/g,
    replacement: '[REDACTED_NAME]',
  },
  {
    type: 'dob',
    pattern: /\b(?:(?:0?[1-9]|1[0-2])[-\/.](?:0?[1-9]|[12]\d|3[01])[-\/.](?:19|20)\d{2}|(?:19|20)\d{2}[-\/.](?:0?[1-9]|1[0-2])[-\/.](?:0?[1-9]|[12]\d|3[01])|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2}|(?:0?[1-9]|[12]\d|3[01])\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2})\b/gi,
    replacement: '[REDACTED_DOB]',
  },
]

// ---------------------------------------------------------------------------
// Secret scanning rules (always-on, server-side)
// ---------------------------------------------------------------------------

interface SecretRule {
  type: SecretType
  severity: Severity
  pattern: RegExp
  replacement: string
}

const SECRET_RULES: SecretRule[] = [
  {
    type: 'private_key',
    severity: 'critical',
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]{0,8192}?-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    type: 'database_url',
    severity: 'critical',
    pattern: /\b(postgres|postgresql|mysql|mongodb|redis|mongodb\+srv):\/\/[^\s"']{1,512}/gi,
    replacement: '[REDACTED_DATABASE_URL]',
  },
  {
    type: 'aws_access_key',
    severity: 'high',
    pattern: /\b(AKIA|AGPA|AROA|ASCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[REDACTED_AWS_ACCESS_KEY]',
  },
  {
    type: 'aws_secret_key',
    severity: 'critical',
    pattern: /(?<![A-Za-z0-9/+])(?=[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+]))[A-Za-z0-9/+]{40}/g,
    replacement: '[REDACTED_AWS_SECRET_KEY]',
  },
  {
    type: 'openai_key',
    severity: 'high',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}\b/g,
    replacement: '[REDACTED_OPENAI_KEY]',
  },
  {
    type: 'github_token',
    severity: 'high',
    pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    type: 'slack_token',
    severity: 'high',
    pattern: /\bxox[baprs]-[0-9A-Za-z\-]{10,64}\b/g,
    replacement: '[REDACTED_SLACK_TOKEN]',
  },
  {
    type: 'jwt',
    severity: 'high',
    pattern: /\beyJ[A-Za-z0-9\-_]{1,512}\.[A-Za-z0-9\-_]{1,512}\.[A-Za-z0-9\-_]{1,512}\b/g,
    replacement: '[REDACTED_JWT]',
  },
  {
    type: 'bearer_token',
    severity: 'high',
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,256}\b/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    type: 'env_secret',
    severity: 'medium',
    pattern: /\b(DB_PASSWORD|API_KEY|SECRET_KEY|SECRET|PASSWORD|PASSWD|AUTH_TOKEN|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*["']?[A-Za-z0-9\-._~+/=]{8,256}["']?/gi,
    replacement: '[REDACTED_ENV_SECRET]',
  },
]

// ---------------------------------------------------------------------------
// Risk scoring
// ---------------------------------------------------------------------------

const SECRET_WEIGHTS: Record<SecretType, number> = {
  private_key: 90,
  database_url: 85,
  aws_secret_key: 85,
  aws_access_key: 40,
  jwt: 30,
  bearer_token: 30,
  slack_token: 30,
  github_token: 30,
  openai_key: 30,
  env_secret: 15,
}

function scoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 80) return 'high'
  return 'critical'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Always-on server-side secret scanning + redaction.
 * Returns sanitized prompt and structured detections (type + count + severity).
 * Raw matched values are never included in the output.
 */
export function scanAndRedactSecrets(text: string): SecretScanResult {
  let sanitizedPrompt = text
  const detections: Detection[] = []

  for (const rule of SECRET_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    const matches = sanitizedPrompt.match(pattern)
    if (matches && matches.length > 0) {
      detections.push({ type: rule.type, count: matches.length, severity: rule.severity })
      const replacePattern = new RegExp(rule.pattern.source, rule.pattern.flags)
      sanitizedPrompt = sanitizedPrompt.replace(replacePattern, rule.replacement)
    }
  }

  return { sanitizedPrompt, detections }
}

/**
 * Derive a risk score from secret scan detections.
 * Kept separate so risk scoring can evolve independently.
 */
export function calculateRiskScore(detections: Detection[]): RiskScore {
  const raw = detections.reduce((sum, d) => sum + SECRET_WEIGHTS[d.type] * d.count, 0)
  const score = Math.min(100, raw)
  return { score, level: scoreToLevel(score), detections }
}

/**
 * User-controlled PII redaction (runs after secret scanning).
 */
export function sanitize(text: string, filters: FilterType[]): SanitizationResult {
  let sanitizedText = text
  const counts: Partial<Record<FilterType, number>> = {}

  const activeRules = REDACTION_RULES.filter((rule) => filters.includes(rule.type))

  for (const rule of activeRules) {
    const freshPattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    const matches = sanitizedText.match(freshPattern)
    if (matches && matches.length > 0) {
      counts[rule.type] = (counts[rule.type] ?? 0) + matches.length
      const replacePattern = new RegExp(rule.pattern.source, rule.pattern.flags)
      sanitizedText = sanitizedText.replace(replacePattern, rule.replacement)
    }
  }

  const redactions: RedactionEntry[] = Object.entries(counts).map(([type, count]) => ({
    type: type as FilterType,
    count: count as number,
  }))

  return { sanitizedText, redactions }
}
