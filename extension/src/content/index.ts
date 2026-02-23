import { scanAndRedactSecrets, calculateRiskScore, sanitize } from '../lib/firewall'
import { evaluatePolicies } from '../lib/policy-engine'
import { getSettings } from '../lib/storage'
import type { ExtensionSettings } from '../lib/storage'
import { detectAdapter } from './adapters'
import type { SiteAdapter } from './adapters'
import { showToast, showBlockOverlay, showConfirmDialog } from './ui'

let settings: ExtensionSettings | null = null
let adapter: SiteAdapter | null = null
let isMaskedResubmit = false

async function loadSettings() {
  settings = await getSettings()
}

function handleSubmission(e: Event, inputEl: HTMLElement): void {
  if (!settings?.enabled) return

  const originalText = adapter!.getText(inputEl).trim()
  if (!originalText) return

  // 1. Always-on secret scanning + redaction
  const { sanitizedPrompt, detections } = scanAndRedactSecrets(originalText)

  // 2. User PII filters
  const { sanitizedText: finalText } = sanitize(sanitizedPrompt, settings.filters)

  // 3. Risk scoring
  const riskScore = detections.length > 0 ? calculateRiskScore(detections) : null

  // 4. Policy evaluation (on original text for keyword matching)
  const decision = evaluatePolicies(settings.policies, {
    detections,
    riskScore,
    messageText: originalText,
  })

  // 5. Hard block: critical risk OR policy block
  const isCritical = riskScore?.level === 'critical'
  const isPolicyBlocked = decision.action === 'block'

  if (isCritical || isPolicyBlocked) {
    e.stopImmediatePropagation()
    e.preventDefault()
    const lines: string[] = []
    if (isCritical) {
      lines.push(`Risk Score: ${riskScore!.score}/100 (Critical)`)
      for (const d of detections) lines.push(`${d.count}× ${d.type.replace(/_/g, ' ')}`)
    }
    if (isPolicyBlocked) {
      for (const m of decision.matches.filter(m => m.action === 'block')) {
        lines.push(`Policy: "${m.policyName}"`)
      }
    }
    showBlockOverlay('PromptGuard: Message Blocked', lines)
    return
  }

  // 6. High-Risk Confirmation (Priority intercept)
  const isHighRisk = riskScore?.level === 'high'
  if (isHighRisk && settings?.confirmHighRisk) {
    e.stopImmediatePropagation()
    e.preventDefault()

    // Apply sanitization BEFORE showing dialog so user sends clean text
    const textWasModified = finalText !== originalText
    if (textWasModified || decision.action === 'mask') {
      let textToSend = textWasModified ? finalText : originalText
      if (decision.action === 'mask') {
        for (const match of decision.matches.filter((m) => m.action === 'mask')) {
          const policy = settings!.policies.find((p) => p.id === match.policyId)
          if (policy?.condition.type === 'keyword' && policy.condition.keyword) {
            const escaped = policy.condition.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            textToSend = textToSend.replace(new RegExp(escaped, 'gi'), '[REDACTED_BY_POLICY]')
          }
        }
      }
      adapter!.setText(inputEl, textToSend)
    }

    const lines: string[] = []
    for (const m of decision.matches) lines.push(`Policy: "${m.policyName}"`)
    if (!lines.length && riskScore) lines.push(`Risk Score: ${riskScore.score}/100`)

    showConfirmDialog(
      'PromptGuard: High-Risk Prompt Detected',
      lines.length ? lines : [`Risk Score: ${riskScore!.score}/100`],
      () => {
        isMaskedResubmit = true
        adapter!.getSubmitButton()?.click()
        setTimeout(() => { isMaskedResubmit = false }, 200)
      },
      () => {},
    )
    return
  }

  // 7. Mask: text was modified (secrets/PII redacted) OR policy says mask
  const textWasModified = finalText !== originalText
  if (textWasModified || decision.action === 'mask') {
    e.stopImmediatePropagation()
    e.preventDefault()

    let textToSend = textWasModified ? finalText : originalText

    // Apply keyword replacements from mask policies
    if (decision.action === 'mask') {
      for (const match of decision.matches.filter((m) => m.action === 'mask')) {
        const policy = settings!.policies.find((p) => p.id === match.policyId)
        if (policy?.condition.type === 'keyword' && policy.condition.keyword) {
          const escaped = policy.condition.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          textToSend = textToSend.replace(new RegExp(escaped, 'gi'), '[REDACTED_BY_POLICY]')
        }
      }
    }

    adapter!.setText(inputEl, textToSend)

    const toastLines: string[] = []
    for (const d of detections) toastLines.push(`${d.count}× ${d.type.replace(/_/g, ' ')} removed`)
    if (decision.action === 'mask' && decision.matches.length > 0) {
      toastLines.push(`Policy: "${decision.matches[0].policyName}"`)
    }
    showToast('mask', '🔵 PromptGuard: Prompt sanitized', toastLines)

    // Re-submit after a short delay for the framework to register the text change
    isMaskedResubmit = true
    setTimeout(() => {
      adapter!.getSubmitButton()?.click()
      setTimeout(() => { isMaskedResubmit = false }, 200)
    }, 60)
    return
  }

  // 8. Warn: policy warn (non-high risk)
  if (decision.action === 'warn') {
    const lines: string[] = []
    for (const m of decision.matches) lines.push(`Policy: "${m.policyName}"`)
    showToast('warn', '⚠️ PromptGuard: Sensitive data detected', lines, 8000)
  }
}

function attachListeners(): void {
  const onKeydown = (e: Event) => {
    const ke = e as KeyboardEvent
    if (ke.key !== 'Enter' || ke.shiftKey || isMaskedResubmit) return
    const currentInput = adapter!.getInputElement()
    if (!currentInput) return
    handleSubmission(e, currentInput)
  }

  const onSubmitClick = (e: Event) => {
    if (isMaskedResubmit) return
    const target = e.target as Element
    if (target?.closest?.('#promptguard-ui')) return
    const submitBtn = adapter!.getSubmitButton()
    if (!submitBtn || !submitBtn.contains(target)) return
    const currentInput = adapter!.getInputElement()
    if (!currentInput) return
    handleSubmission(e, currentInput)
  }

  document.addEventListener('keydown', onKeydown, { capture: true })
  document.addEventListener('click', onSubmitClick, { capture: true })
}

async function init() {
  adapter = detectAdapter()
  if (!adapter) return

  await loadSettings()

  // Attach once — handlers resolve the input element dynamically on each event
  attachListeners()
}

// Sync settings when updated from popup
chrome.storage.onChanged.addListener((changes) => {
  if (settings) {
    if (changes.enabled) settings.enabled = changes.enabled.newValue
    if (changes.filters) settings.filters = changes.filters.newValue
    if (changes.policies) settings.policies = changes.policies.newValue
    if (changes.confirmHighRisk) settings.confirmHighRisk = changes.confirmHighRisk.newValue
  }
})

init()
