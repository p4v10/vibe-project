export interface SiteAdapter {
  siteName: string
  getInputElement(): HTMLElement | null
  getSubmitButton(): HTMLElement | null
  getText(el: HTMLElement): string
  setText(el: HTMLElement, text: string): void
}

export { ChatGPTAdapter } from './chatgpt'
export { ClaudeAdapter } from './claude'
export { GeminiAdapter } from './gemini'

import { ChatGPTAdapter } from './chatgpt'
import { ClaudeAdapter } from './claude'
import { GeminiAdapter } from './gemini'

export function detectAdapter(): SiteAdapter | null {
  const host = location.hostname
  if (host.includes('chatgpt.com')) return new ChatGPTAdapter()
  if (host.includes('claude.ai')) return new ClaudeAdapter()
  if (host.includes('gemini.google.com')) return new GeminiAdapter()
  return null
}
