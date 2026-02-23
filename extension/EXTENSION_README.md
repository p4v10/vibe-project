# PromptGuard Chrome Extension

**Last updated:** 2026-02-22

## TL;DR
The extension intercepts prompts on ChatGPT, Claude, and Gemini pages, scans for secrets and PII, applies policy guardrails, and blocks or masks sensitive messages before they are sent.

---

## What this extension does
- **Secret scanning** (always-on) for high-risk keys and credentials.
- **PII redaction** based on user-selected filters.
- **Policy guardrails**: block, mask, or warn using synced policies.
- **Policy sync** from the webapp every 30 minutes (or on demand).

---

## Build & install

### 1) Install dependencies
```bash
cd extension
npm install
```

### 2) Build
```bash
npm run build
```

### 3) Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/dist` folder

---

## Development (watch mode)
```bash
npm run dev
```
Then reload the extension from `chrome://extensions` after changes.

---

## Configuration
The extension syncs policies from the webapp:

```
http://localhost:3000/api/policies
```

To change the webapp URL, edit:
```
extension/src/background/service_worker.ts
```

---

## How it works (high level)
- **Content script** intercepts submission events on supported sites.
- **Firewall** runs locally in the browser.
- **Policy engine** decides allow / warn / mask / block.
- **Popup UI** toggles filters, shows policy status, and triggers sync.

---

## Manual QA scenarios

- Use test_prompts.txt and verify:
  - A (Critical) → hard block
  - B (High risk) → confirm dialog when enabled
  - C (PII) → sanitized + toast
  - D (Policies) → mask/warn/block as configured
  - E (Edge) → expected behavior per notes
