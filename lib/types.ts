export type Provider = 'openai' | 'anthropic' | 'google'

export interface ProviderInfo {
  provider: Provider
  label: string
  models: { id: string; label: string }[]
}

export const PROVIDERS: ProviderInfo[] = [
  {
    provider: 'openai',
    label: 'OpenAI',
    models: [
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5.2', label: 'GPT-5.2' },
    ],
  },
  {
    provider: 'anthropic',
    label: 'Anthropic',
    models: [
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
    ],
  },
  {
    provider: 'google',
    label: 'Google',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
  },
]

export type FilterType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'api_key'

export interface FilterOption {
  id: FilterType
  label: string
  description: string
}

export const FILTER_OPTIONS: FilterOption[] = [
  { id: 'email', label: 'Email Addresses', description: 'Redact email addresses' },
  { id: 'phone', label: 'Phone Numbers', description: 'Redact phone numbers' },
  { id: 'ssn', label: 'Social Security Numbers', description: 'Redact SSNs' },
  { id: 'credit_card', label: 'Credit Card Numbers', description: 'Redact credit card numbers' },
  { id: 'api_key', label: 'API Keys & Tokens', description: 'Redact API keys and tokens' },
]

export type SecretType =
  | 'private_key'
  | 'database_url'
  | 'aws_access_key'
  | 'jwt'
  | 'bearer_token'
  | 'slack_token'
  | 'github_token'
  | 'openai_key'
  | 'env_secret'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type Severity = 'medium' | 'high' | 'critical'

export interface Detection {
  type: SecretType
  count: number
  severity: Severity
}

export interface SecretScanResult {
  sanitizedPrompt: string
  detections: Detection[]
}

export interface RiskScore {
  score: number
  level: RiskLevel
  detections: Detection[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  maskedContent?: string
  sanitizationSummary?: { type: FilterType; count: number }[]
  riskScore?: RiskScore
  policyDecision?: PolicyDecision
}

export type PolicyConditionType = 'detection_type' | 'keyword' | 'risk_score'
export type PolicyAction = 'allow' | 'warn' | 'mask' | 'block'

export interface PolicyCondition {
  type: PolicyConditionType
  detectionType?: string
  countGt?: number
  keyword?: string
  riskScoreGt?: number
}

export interface Policy {
  id: string
  userId: string
  name: string
  enabled: boolean
  condition: PolicyCondition
  action: PolicyAction
  createdAt: string
}

export interface PolicyMatch {
  policyId: string
  policyName: string
  action: PolicyAction
}

export interface PolicyDecision {
  action: PolicyAction
  matches: PolicyMatch[]
}

export interface SecretMeta {
  id: string
  provider: Provider
  keyLast4: string
  createdAt: string
  updatedAt: string
}
