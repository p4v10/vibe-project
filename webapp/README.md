# PromptGuard Webapp

**Last updated:** 2026-02-22

## TL;DR
The webapp is the core PromptGuard experience: a Next.js dashboard with chat, firewall filters, policy guardrails, a Developer Hub for API keys + usage analytics, and the public `/api/v1/scan` endpoint.

---

## What this app does
- **Chat UI** with provider/model selection and firewall protection.
- **Prompt Firewall**: secret scanning + PII filters (email, phone, SSN, credit card, API keys).
- **Policy Guardrails**: create, edit, enable/disable policies (keyword, detection, risk score).
- **Developer Hub**: manage API keys and view API usage metrics.
- **Public API**: `/api/v1/scan` for programmatic prompt scanning with rate limiting.
- **Sample policies**: `/api/policies/sample` returns example policies (no auth, CORS-enabled for extension).

---

## Architecture overview
Key modules:
- `app/(dashboard)/chat` — chat UI and real-time sanitization feedback.
- `app/api/v1/scan` — developer scan endpoint with bearer auth and rate limiting.
- `app/api/policies/sample` — public sample policy endpoint.
- `lib/firewall.ts` — secret detection + PII redaction logic.
- `lib/policy-engine.ts` — policy evaluation and decision rules.
- `lib/rate-limit.ts` — in-memory sliding-window rate limiter (60 req/min per API key).
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

### `GET/POST/PUT/PATCH/DELETE /api/policies`
Policy management for the authenticated user (used by the UI and the extension).

### `GET /api/policies/sample`
Returns sample policies for unauthenticated callers (used by the extension when no account is linked). CORS-enabled for `chrome-extension://` origins.

### `GET /api/secrets`
Returns current detected secrets from the session.

### `POST /api/v1/scan`
Public developer API endpoint. Requires `Authorization: Bearer pg_live_...`.  
Rate-limited: **60 requests per 60 seconds per API key** (returns 429 + `Retry-After` header on excess).

### `GET /api/v1/usage`
Usage metrics for Developer Hub (last 30 days).

### `GET/POST/DELETE /api/dev-keys`
Developer API key management.

---

## Rate limiting
`/api/v1/scan` uses a sliding-window in-memory rate limiter (`lib/rate-limit.ts`):
- **60 requests / 60 s** per API key ID
- Returns `429` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- State is per-process (upgrade to Upstash Redis for multi-instance global limits)

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

---

## Manual QA scenarios

- Use the shared prompt pack in test_prompts.txt
- Quick API check:
```bash
curl -s http://localhost:3000/api/v1/scan \
  -H "Authorization: Bearer pg_live_..." -H "Content-Type: application/json" \
  -d '{"prompt":"postgres://user:pw@host/db AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}'
```
