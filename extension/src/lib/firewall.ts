import type { FilterType, SecretType, Severity, Detection, RiskScore, RiskLevel, SecretScanResult, SanitizationResult, RedactionEntry } from './types'

const REDACTION_RULES: Array<{ type: FilterType; pattern: RegExp; replacement: string }> = [
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    type: 'phone',
    pattern: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
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
]

const SECRET_RULES: Array<{ type: SecretType; severity: Severity; pattern: RegExp; replacement: string }> = [
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
    replacement: '[REDACTED_AWS_KEY]',
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

const SECRET_WEIGHTS: Record<SecretType, number> = {
  private_key: 40, database_url: 35, aws_access_key: 30,
  jwt: 25, bearer_token: 25, slack_token: 25, github_token: 25, openai_key: 25, env_secret: 15,
}

function scoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 80) return 'high'
  return 'critical'
}

export function scanAndRedactSecrets(text: string): SecretScanResult {
  let sanitizedPrompt = text
  const detections: Detection[] = []
  for (const rule of SECRET_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    const matches = sanitizedPrompt.match(pattern)
    if (matches && matches.length > 0) {
      detections.push({ type: rule.type, count: matches.length, severity: rule.severity })
      sanitizedPrompt = sanitizedPrompt.replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement)
    }
  }
  return { sanitizedPrompt, detections }
}

export function calculateRiskScore(detections: Detection[]): RiskScore {
  const raw = detections.reduce((sum, d) => sum + SECRET_WEIGHTS[d.type] * d.count, 0)
  const score = Math.min(100, raw)
  return { score, level: scoreToLevel(score), detections }
}

export function sanitize(text: string, filters: FilterType[]): SanitizationResult {
  let sanitizedText = text
  const counts: Partial<Record<FilterType, number>> = {}
  const activeRules = REDACTION_RULES.filter((r) => filters.includes(r.type))
  for (const rule of activeRules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    const matches = sanitizedText.match(pattern)
    if (matches && matches.length > 0) {
      counts[rule.type] = (counts[rule.type] ?? 0) + matches.length
      sanitizedText = sanitizedText.replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement)
    }
  }
  const redactions: RedactionEntry[] = Object.entries(counts).map(([type, count]) => ({
    type: type as FilterType, count: count as number,
  }))
  return { sanitizedText, redactions }
}
