# PromptGuard Webapp

**Last updated:** 2026-02-22

## TL;DR
The webapp is the core PromptGuard experience: a Next.js dashboard with chat, firewall filters, policy guardrails, and a Developer Hub for API keys + usage analytics. It also hosts the public `/api/v1/scan` endpoint.

---

## What this app does
- **Chat UI** with provider/model selection and firewall protection.
- **Prompt Firewall**: secret scanning + PII filters (email, phone, SSN, credit card, API keys).
- **Policy Guardrails**: create, edit, enable/disable policies (keyword, detection, risk score).
- **Developer Hub**: manage API keys and view API usage.
- **Public API**: `/api/v1/scan` for programmatic prompt scanning.

---

## Architecture overview
Key modules:
- `app/(dashboard)/chat` — chat UI and real-time sanitization feedback.
- `lib/firewall.ts` — secret detection + PII redaction logic.
- `lib/policy-engine.ts` — policy evaluation and decision rules.
- `app/api/*` — server routes (chat, policies, API keys, scan endpoint).
- `supabase/migrations` — schema migrations for policies + developer API tables.

---

## Getting started

### 1) Install dependencies
```bash
cd webapp
npm install
```

### 2) Environment variables
Create `.env.local` in `webapp/`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_KEY=... # 64-char hex string
```

### 3) Supabase migrations
Run the SQL files in `webapp/supabase/migrations/` inside your Supabase project (SQL editor or CLI).

### 4) Start dev server
```bash
npm run dev
```

Open: http://localhost:3000

---

## API routes

### `POST /api/chat`
Runs prompt firewall + policy evaluation before calling the selected LLM provider.  
Returns masked prompt metadata and risk scoring.

### `GET/POST/PUT/PATCH/DELETE /api/policies`
Policy management for the authenticated user (used by the UI and the extension).

### `POST /api/v1/scan`
Public developer API endpoint. Requires `Authorization: Bearer pg_live_...`.

### `GET/POST/DELETE /api/dev-keys`
Developer API key management (used by Developer Hub).

### `GET /api/v1/usage`
Usage metrics for Developer Hub (last 30 days).

---

## Developer Hub flow
1. Create API key in **Developer Hub**.
2. Call `/api/v1/scan` with `Authorization: Bearer <key>`.
3. View usage metrics in the same hub.

---

## Tests
```bash
npm run test
```

---

## Extension integration
The Chrome extension syncs policies from:
```
GET https://promptguard-p4.vercel.app/api/policies
```
Ensure the webapp is running for policy sync to succeed.
