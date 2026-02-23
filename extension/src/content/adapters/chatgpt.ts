import type { SiteAdapter } from './index'

export class ChatGPTAdapter implements SiteAdapter {
  siteName = 'ChatGPT'

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('#prompt-textarea') ??
      document.querySelector<HTMLElement>('[data-testid="send-message-textarea"]')
    )
  }

  getSubmitButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="send" i]')
    )
  }

  getText(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement) return el.value
    return el.innerText ?? el.textContent ?? ''
  }

  setText(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    // ProseMirror / contenteditable
    el.focus()
    document.execCommand('selectAll', false)
    document.execCommand('insertText', false, text)
  }
}
