import type { SiteAdapter } from './index'

export class ClaudeAdapter implements SiteAdapter {
  siteName = 'Claude'

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[data-testid="composer-parent"] .ProseMirror') ??
      document.querySelector<HTMLElement>('div.ProseMirror[contenteditable="true"]')
    )
  }

  getSubmitButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('button[aria-label*="send" i]') ??
      document.querySelector<HTMLElement>('[data-testid="send-button"]')
    )
  }

  getText(el: HTMLElement): string {
    return el.innerText ?? el.textContent ?? ''
  }

  setText(el: HTMLElement, text: string): void {
    el.focus()
    document.execCommand('selectAll', false)
    document.execCommand('insertText', false, text)
  }
}
