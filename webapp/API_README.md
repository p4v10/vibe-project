# PromptGuard API Service (Planned)

**Last updated:** 2026-02-22

## TL;DR
This folder is a placeholder for a future standalone API service.  
The **current** Developer API implementation lives inside the webapp at `/api/v1/scan`.

---

## Current API (implemented in webapp)

### Endpoint
```
POST /api/v1/scan
Authorization: Bearer pg_live_...
```

### Request body
```json
{
  "prompt": "User input here...",
  "model": "gpt-5",
  "filters": ["email", "api_key"],
  "policies": [{ "type": "keyword", "keyword": "secret", "action": "block" }]
}
```

### Response
```json
{
  "model": "gpt-5",
  "sanitizedPrompt": "User input here...",
  "riskScore": { "score": 10, "level": "low", "detections": [] },
  "isBlocked": false,
  "redactions": []
}
```

---

## Key behavior
- **Bearer token auth** using `pg_live_...` keys.
- **No raw prompts stored** in usage logs.
- **Usage tracking** recorded in `api_usage_logs`.

---

## How to use today
1. Run the webapp.
2. Create an API key in **Developer Hub**.
3. Call `/api/v1/scan` using the generated key.

---

## Migrations
Developer API tables live in:
```
webapp/supabase/migrations/003_developer_api.sql
```

---

## Future plan
A standalone service will be moved into this directory (edge or server runtime), while reusing:
- `webapp/lib/firewall.ts`
- `webapp/lib/policy-engine.ts`
