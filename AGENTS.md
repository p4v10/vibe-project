# AGENTS.md — PromptGuard Contributor Guide

> Guidelines for AI agents and human contributors working on this codebase.

---

## Project overview

PromptGuard is a monorepo with three packages:

| Package | Path | Stack |
|---|---|---|
| Web app | `webapp/` | Next.js 15, Supabase, TypeScript, Tailwind |
| Chrome extension | `extension/` | TypeScript, Webpack, Chrome Extensions API |
| Landing page | `landing_page/` | Static HTML/CSS |

---

## Repository conventions

### Code style
- **TypeScript everywhere** — no plain JS in `webapp/` or `extension/src/`
- **No comments** unless logic is genuinely non-obvious
- **No unused imports or dead variables**
- Match the existing naming and formatting conventions in each file

### File organisation
- All Next.js routes live under `webapp/app/`
- Shared logic lives under `webapp/lib/` (firewall, policy engine, rate limiter, etc.)
- Extension source lives under `extension/src/`; output is in `extension/dist/` (do not edit dist directly)
- Do not commit `.env.local`, secrets, or API keys

---

## Key modules

### `webapp/lib/firewall.ts`
Secret scanning + PII redaction. Exports:
- `scanAndRedactSecrets(prompt)` → `{ sanitizedPrompt, detections }`
- `sanitize(text, filters)` → `{ sanitizedText, redactions }`
- `calculateRiskScore(detections)` → `{ score, level }`

### `webapp/lib/policy-engine.ts`
Policy evaluation. Exports:
- `evaluatePolicies(policies, context)` → `{ action, matches }`

### `webapp/lib/rate-limit.ts`
In-memory sliding-window rate limiter (60 req/60 s per key).  
For multi-instance deployments, replace with Upstash Redis.

### `extension/src/content/index.ts`
Main content script. Intercepts `keydown` (Enter) and `click` (submit button) events, runs the full firewall pipeline, and decides to block / mask / confirm / warn / pass through.

### `extension/src/content/ui.ts`
All extension UI rendered into a Shadow DOM host (`#promptguard-ui`).  
Exports: `showToast`, `showBlockOverlay`, `showConfirmDialog`

### `extension/src/lib/storage.ts`
Chrome storage helpers and `ExtensionSettings` type.  
Settings: `enabled`, `filters`, `policies`, `confirmHighRisk`

---

## Firewall pipeline (both webapp and extension)

```
prompt
  └─ 1. scanAndRedactSecrets()     → secrets removed, detections list
  └─ 2. sanitize()                 → PII stripped per user filters
  └─ 3. calculateRiskScore()       → { score, level: low|medium|high|critical }
  └─ 4. evaluatePolicies()         → { action: allow|warn|mask|block, matches }
  └─ 5. Decision:
         critical | block  → hard block
         text modified     → resubmit sanitized
         high + confirm    → pause, show confirm dialog
         warn | high       → toast warning, auto-send
         else              → pass through
```

---

## Adding a new API route

1. Create `webapp/app/api/<route>/route.ts`
2. Export named handlers: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
3. Update `routes.txt` at the repo root
4. Update `webapp/README.md` under **API routes**

---

## Adding a new extension UI element

1. Add your render function to `extension/src/content/ui.ts`
2. Keep all UI inside the Shadow DOM (use `getShadowHost()`)
3. Export the function and import it in `extension/src/content/index.ts`
4. Style with inline `style.cssText` — no external stylesheets in content scripts

---

## Adding a new popup setting

1. Add the field to `ExtensionSettings` interface and `DEFAULT_SETTINGS` in `extension/src/lib/storage.ts`
2. Add the UI element to `extension/src/popup/index.html`
3. Wire it in `extension/src/popup/popup.ts`
4. Update the `chrome.storage.onChanged` listener in `extension/src/content/index.ts`

---

## Testing

```bash
# Webapp tests
cd webapp && npm run test

# Extension — no automated tests yet; manual load and verify
cd extension && npm run build
```

---

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Extension not updating after code change | Rebuild (`npm run build`) then click **Reload** in `chrome://extensions` |
| Policy sync returning 401 | Webapp must be running; check `WEBAPP_URL` in `service_worker.ts` |
| `isMaskedResubmit` not reset | Always reset in a `setTimeout` after resubmit, not synchronously |
| Rate limiter state lost on restart | Expected — it's in-memory per process. Use Redis for persistence |
| Shadow DOM styles bleeding out | Never use `document.head` for styles; always inject into `shadow` |

---

## Manual QA scenarios

- Use the shared prompt pack in test_prompts.txt (critical, high-risk confirm, sanitize/PII, policies, edge)
- Extension: enable “Confirm high-risk sends”, toggle PII chips as needed
- Webapp/API: call `/api/v1/scan` and verify `riskScore`, `isBlocked`, redactions
