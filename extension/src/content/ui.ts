type ToastType = 'block' | 'warn' | 'mask' | 'info'

const COLORS: Record<ToastType, { bg: string; border: string; title: string }> = {
  block: { bg: '#1a0a0a', border: '#7f1d1d', title: '#f87171' },
  warn:  { bg: '#1a1500', border: '#78350f', title: '#fbbf24' },
  mask:  { bg: '#0a0f1a', border: '#1e3a5f', title: '#60a5fa' },
  info:  { bg: '#0f1a0f', border: '#14532d', title: '#4ade80' },
}

let _shadow: ShadowRoot | null = null

function getShadowHost(): { host: HTMLElement; shadow: ShadowRoot } {
  if (_shadow) return { host: _shadow.host as HTMLElement, shadow: _shadow }

  const host = document.createElement('div')
  host.id = 'promptguard-ui'
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;pointer-events:none;'
  document.body.appendChild(host)
  _shadow = host.attachShadow({ mode: 'closed' })
  return { host, shadow: _shadow }
}

export function showToast(type: ToastType, title: string, lines: string[] = [], durationMs = 5000): void {
  const { shadow } = getShadowHost()
  const c = COLORS[type]

  const toast = document.createElement('div')
  toast.style.cssText = `
    pointer-events: auto;
    margin-bottom: 8px;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid ${c.border};
    background: ${c.bg};
    min-width: 280px;
    max-width: 360px;
    font-family: system-ui, sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: pgSlideIn 0.25s ease;
  `

  const style = document.createElement('style')
  style.textContent = `
    @keyframes pgSlideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
  `
  shadow.appendChild(style)

  const titleEl = document.createElement('div')
  titleEl.style.cssText = `color:${c.title};font-size:13px;font-weight:600;margin-bottom:${lines.length ? '6px' : '0'};`
  titleEl.textContent = title
  toast.appendChild(titleEl)

  for (const line of lines) {
    const p = document.createElement('div')
    p.style.cssText = 'color:#9ca3af;font-size:11px;margin-top:2px;'
    p.textContent = line
    toast.appendChild(p)
  }

  shadow.appendChild(toast)

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s'
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, durationMs)
}

export function showBlockOverlay(title: string, lines: string[]): void {
  const { shadow } = getShadowHost()
  const c = COLORS.block

  const card = document.createElement('div')
  card.style.cssText = `
    pointer-events: auto;
    margin-bottom: 8px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid ${c.border};
    background: ${c.bg};
    min-width: 280px;
    max-width: 380px;
    font-family: system-ui, sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  `

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;'

  const titleEl = document.createElement('div')
  titleEl.style.cssText = `color:${c.title};font-size:13px;font-weight:700;`
  titleEl.textContent = `🛡 ${title}`

  const dismissBtn = document.createElement('button')
  dismissBtn.style.cssText = `
    background:none;border:1px solid ${c.border};border-radius:6px;
    color:#9ca3af;font-size:11px;padding:2px 8px;cursor:pointer;
  `
  dismissBtn.textContent = 'Dismiss'
  dismissBtn.onclick = () => card.remove()

  header.appendChild(titleEl)
  header.appendChild(dismissBtn)
  card.appendChild(header)

  for (const line of lines) {
    const p = document.createElement('div')
    p.style.cssText = 'color:#f87171;font-size:11px;margin-top:4px;'
    p.textContent = `• ${line}`
    card.appendChild(p)
  }

  shadow.appendChild(card)
}
