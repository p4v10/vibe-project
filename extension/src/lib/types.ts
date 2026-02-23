export type SecretType =
  | 'private_key'
  | 'database_url'
  | 'aws_access_key'
  | 'aws_secret_key'
  | 'jwt'
  | 'bearer_token'
  | 'slack_token'
  | 'github_token'
  | 'openai_key'
  | 'env_secret'

export type FilterType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'api_key'
  | 'address'
  | 'person_name'
  | 'dob'

export type Severity = 'medium' | 'high' | 'critical'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type PolicyAction = 'allow' | 'warn' | 'mask' | 'block'
export type PolicyConditionType = 'detection_type' | 'keyword' | 'risk_score'

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

export interface RedactionEntry {
  type: FilterType
  count: number
}

export interface SanitizationResult {
  sanitizedText: string
  redactions: RedactionEntry[]
}

export interface PolicyCondition {
  type: PolicyConditionType
  detectionType?: string
  countGt?: number
  keyword?: string
  riskScoreGt?: number
}

export interface Policy {
  id: string
  name: string
  enabled: boolean
  condition: PolicyCondition
  action: PolicyAction
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
