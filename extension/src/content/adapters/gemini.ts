import type { SiteAdapter } from './index'

export class GeminiAdapter implements SiteAdapter {
  siteName = 'Gemini'

  getInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('rich-textarea .ql-editor') ??
      document.querySelector<HTMLElement>('[contenteditable="true"][aria-label*="prompt" i]')
    )
  }

  getSubmitButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('button[aria-label*="send" i]') ??
      document.querySelector<HTMLElement>('button.send-button')
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
