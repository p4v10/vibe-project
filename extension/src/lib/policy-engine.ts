import type { Policy, PolicyAction, PolicyDecision, PolicyMatch, Detection, RiskScore } from './types'

export interface PolicyEvalContext {
  detections: Detection[]
  riskScore: RiskScore | null
  messageText: string
}

const ACTION_PRIORITY: Record<PolicyAction, number> = {
  block: 3, mask: 2, warn: 1, allow: 0,
}

function policyMatches(policy: Policy, ctx: PolicyEvalContext): boolean {
  const { condition } = policy
  if (condition.type === 'detection_type') {
    const relevant = ctx.detections.filter(
      (d) => !condition.detectionType || d.type === condition.detectionType,
    )
    const totalCount = relevant.reduce((sum, d) => sum + d.count, 0)
    return condition.countGt !== undefined ? totalCount > condition.countGt : totalCount > 0
  }
  if (condition.type === 'keyword') {
    if (!condition.keyword) return false
    return ctx.messageText.toLowerCase().includes(condition.keyword.toLowerCase())
  }
  if (condition.type === 'risk_score') {
    if (condition.riskScoreGt === undefined || ctx.riskScore === null) return false
    return ctx.riskScore.score > condition.riskScoreGt
  }
  return false
}

export function evaluatePolicies(policies: Policy[], ctx: PolicyEvalContext): PolicyDecision {
  const matches: PolicyMatch[] = []
  for (const policy of policies) {
    if (!policy.enabled) continue
    if (policyMatches(policy, ctx)) {
      matches.push({ policyId: policy.id, policyName: policy.name, action: policy.action })
    }
  }
  if (matches.length === 0) return { action: 'allow', matches: [] }
  const winningAction = matches.reduce<PolicyAction>(
    (best, m) => ACTION_PRIORITY[m.action] > ACTION_PRIORITY[best] ? m.action : best,
    'allow',
  )
  return { action: winningAction, matches }
}
