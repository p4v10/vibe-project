# PromptGuard

> A client-side prompt firewall and policy engine that scans, redacts, and blocks sensitive data before it ever reaches AI providers.

**Live:** https://promptguard-p4.vercel.app · **Repo:** https://github.com/p4v10/vibe-project

---

## What is PromptGuard?

PromptGuard prevents sensitive data leaks when employees use AI tools like ChatGPT, Claude, and Gemini. It runs a layered firewall pipeline on every prompt — locally, before anything is sent.

- 🔍 **Secret scanning** — auto-detects private keys, DB credentials, tokens, and more
- 🧹 **PII redaction** — strips emails, phone numbers, SSNs, credit cards, and API keys
- 📊 **Risk scoring** — 0–100 severity score with Low / Medium / High / Critical levels
- 🛡 **Policy guardrails** — custom rules to block, mask, warn, or confirm per risk type
- ⚠️ **High-risk confirmation** — optional pause-and-confirm step before sending risky prompts
- 🔑 **Developer API** — integrate into any LLM pipeline with a single authenticated endpoint

---

## Monorepo structure

```
vibe-coding/
├── webapp/          # Next.js 15 web app (dashboard, chat, API)
├── extension/       # Chrome extension (content script firewall)
└── landing_page/    # Static marketing page
```

### webapp
Next.js 15 + Supabase + TypeScript. Hosts the chat UI, policy management dashboard, Developer Hub, and the public `/api/v1/scan` endpoint.

→ [webapp/README.md](webapp/README.md)

### extension
Chrome extension built with TypeScript + Webpack. Intercepts prompts on ChatGPT, Claude, and Gemini, runs the full firewall pipeline locally, and syncs policies from the webapp.

→ [extension/README.md](extension/README.md)

### landing_page
Static HTML/CSS marketing site. Lives in `landing_page/landing_index.html`.

---

## Quick start

### Webapp
```bash
cd webapp
npm install
# create .env.local with Supabase + ENCRYPTION_KEY vars
npm run dev
# open http://localhost:3000
```

### Extension
```bash
cd extension
npm install
npm run build
# Load extension/dist as unpacked extension in chrome://extensions
```

---

## Developer API

```bash
curl -X POST https://promptguard-p4.vercel.app/api/v1/scan \
  -H "Authorization: Bearer pg_live_..." \
  -H "Content-Type: application/json" \
  -d '{"prompt": "My key is sk-abc123..."}'
```

Rate-limited to **60 requests/min per key**. Full docs: [webapp/API_README.md](webapp/API_README.md)

---

## Tech stack

| Layer | Technology |
|---|---|
| Web framework | Next.js 15 (App Router) |
| Auth + DB | Supabase (PostgreSQL) |
| Styling | Tailwind CSS |
| Extension | TypeScript + Webpack |
| Testing | Vitest |
| Deploy | Vercel |

---

## Team
- Pavlo Tsiselskyi — pavlo.sky@outlook.com

---

## Manual QA scenarios

- Complete prompt set: see test_prompts.txt (critical block, high-risk confirm, sanitize/PII, policies, edge cases)
- Extension:
  - Turn ON “Confirm high-risk sends” to test confirm dialog
  - Toggle PII chips (Email, Phone, SSN, Credit Card, API Key, Address, Names, DOB)
- API (example):
```bash
curl -s https://promptguard-p4.vercel.app/api/v1/scan \
  -H "Authorization: Bearer pg_live_..." -H "Content-Type: application/json" \
  -d '{"prompt":"postgres://user:pw@host/db AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}'
```
