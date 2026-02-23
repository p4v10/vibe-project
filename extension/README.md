# PromptGuard Chrome Extension

**Last updated:** 2026-02-22

## TL;DR
The extension intercepts prompts on ChatGPT, Claude, and Gemini, scans for secrets and PII, applies policy guardrails, and blocks, masks, or confirms sensitive messages before they are sent — all locally in the browser.

---

## What this extension does
- **Secret scanning** (always-on) for private keys, credentials, and tokens.
- **PII redaction** based on user-selected filters (email, phone, SSN, credit card, API key).
- **Policy guardrails**: block, mask, or warn using synced policies.
- **High-risk confirmation**: optional "Confirm to send" pause for high-risk prompts.
- **Policy sync** from the webapp every 30 minutes (or on demand via popup).

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
https://promptguard-p4.vercel.app/api/policies
```
To change the webapp URL, edit `extension/src/background/service_worker.ts`.

---

## Firewall pipeline (per submission)
1. **Secret scan** — redact secrets from the prompt
2. **PII filter** — strip user-selected PII categories
3. **Risk score** — calculate a 0–100 severity score
4. **Policy evaluation** — apply synced guardrail policies
5. **Decision**:
   - `critical` risk or policy `block` → hard-blocked, overlay shown
   - Text modified (secrets/PII removed) → sanitized text re-submitted with toast
   - `high` risk + *Confirm high-risk sends* enabled → paused with confirm dialog
   - `warn` / `high` (confirm off) → warning toast, prompt auto-sends
   - Otherwise → prompt passes through unmodified

---

## Popup settings
| Setting | Description |
|---|---|
| Enabled toggle | Turn the extension on/off globally |
| PII Filters | Choose which PII categories to redact |
| Confirm high-risk sends | Pause before sending `high`-risk prompts (opt-in) |
| Policy Sync | Sync policies from the webapp on demand |

---

## Key source files
| File | Purpose |
|---|---|
| `src/content/index.ts` | Intercepts submit events and drives the firewall pipeline |
| `src/content/ui.ts` | Toast, block overlay, and confirm dialog UI (Shadow DOM) |
| `src/lib/firewall.ts` | Secret scanning + PII redaction logic |
| `src/lib/policy-engine.ts` | Policy evaluation engine |
| `src/lib/storage.ts` | Settings schema and Chrome storage helpers |
| `src/background/service_worker.ts` | Policy sync background job |
| `src/popup/` | Extension popup UI |

---

## Manual QA scenarios

- Use the shared prompt pack in test_prompts.txt
- Steps:
  1) Toggle PII chips as needed (Email/Phone/SSN/Credit Card/API Key/Address/Names/DOB)
  2) Turn ON “Confirm high-risk sends” to test confirm dialog
  3) Paste prompts from sections A–E and verify toast/block/confirm behavior
