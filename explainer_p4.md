# PromptGuard

**Product name & one-line description**
PromptGuard — A client-side prompt firewall and policy engine that scans, redacts, and blocks sensitive data before it ever reaches AI providers.

**Team members**
- Pavlo Tsiselskyi (pavlo.sky@outlook.com)

**Live deployment URL**
https://promptguard-p4.vercel.app

**GitHub repository URL**
https://github.com/p4v10/vibe-project

**Description of the problem you solved**
As AI tools like ChatGPT and Claude become integrated into daily workflows, employees frequently paste sensitive information—like API keys, PII, and proprietary code—into prompts, risking data breaches and compliance violations. PromptGuard solves this by providing an intercepting firewall (via a Chrome Extension and a Developer API) that automatically detects, masks, or blocks restricted data locally before it leaves the user's environment. This empowers teams to safely leverage AI tools without compromising their security posture or data privacy.

---

## Testing

- Manual QA prompt pack: see test_prompts.txt
- Covers: critical block (DB URLs, private keys), high-risk confirm (two tokens), PII sanitize (email/phone/SSN/credit card/address/name/DOB), policy flows, edge cases
