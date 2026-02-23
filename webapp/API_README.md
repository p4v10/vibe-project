# PromptGuard Developer API

**Last updated:** 2026-02-22

## TL;DR
The Developer API lets you integrate PromptGuard's prompt firewall into any LLM pipeline via a single authenticated endpoint.

---

## Endpoint

```
POST /api/v1/scan
Authorization: Bearer pg_live_...
```

---

## Rate limiting
- **60 requests per 60 seconds** per API key (sliding window)
- Exceeding the limit returns `429 Too Many Requests`
- Response headers on 429:
  - `Retry-After`: seconds until the window resets
  - `X-RateLimit-Limit`: 60
  - `X-RateLimit-Remaining`: 0
  - `X-RateLimit-Reset`: Unix timestamp of reset

---

## Request body

```json
{
  "prompt": "User input here...",
  "model": "gpt-5",
  "filters": ["email", "api_key"],
  "policies": [
    { "type": "keyword", "keyword": "confidential", "action": "block" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | ✅ | The user prompt to scan |
| `model` | string | — | One of the supported model IDs (validated) |
| `filters` | string[] | — | PII filter categories: `email`, `phone`, `ssn`, `credit_card`, `api_key` |
| `policies` | object[] | — | Inline guardrail policies (no setup required) |

---

## Response

```json
{
  "model": "gpt-5",
  "sanitizedPrompt": "User input here...",
  "riskScore": { "score": 10, "level": "low" },
  "isBlocked": false,
  "policyDecision": { "action": "allow", "matches": [] },
  "redactions": [],
  "secretDetections": [{ "type": "openai_key", "count": 1, "severity": "high" }]
}
```

---

## Key behavior
- **Bearer token auth** using `pg_live_...` keys (created in Developer Hub).
- **No raw prompts stored** — only metadata in usage logs.
- **Usage tracking** recorded in `api_usage_logs` (viewable in Developer Hub).
- **Inline policies** accepted without any pre-registration.

---

## Error codes

| Status | Meaning |
|---|---|
| 401 | Missing or invalid Bearer token |
| 403 | API key is revoked |
| 400 | Invalid JSON, missing `prompt`, or unknown `model` |
| 413 | Prompt exceeds byte limit |
| 429 | Rate limit exceeded — check `Retry-After` header |

---

## How to use
1. Run the webapp (or use the deployed instance).
2. Create an API key in **Developer Hub**.
3. Call `/api/v1/scan` with the generated key.
4. View usage metrics in Developer Hub.

---

## Migrations
Developer API tables live in:
```
webapp/supabase/migrations/003_developer_api.sql
```

---

## Manual QA scenarios

- Prompt pack: test_prompts.txt (sections A–E)
- Example:
```bash
curl -s http://localhost:3000/api/v1/scan \
  -H "Authorization: Bearer pg_live_..." -H "Content-Type: application/json" \
  -d '{"prompt":"ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890 xoxb-123456789-987654321-AbCdEfGhIjKlMnOpQrSt"}'
```
