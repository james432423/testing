# Ida backend v0: security review

Independent review of this repository before any model API key is connected. Scope: everything under `src/`, `drizzle/`, `scripts/`, `next.config.ts`, the served `prototype/`, and the dependency tree. Standards used: OWASP ASVS 4.0.3 Level 2, OWASP Top 10 (2021), and the OWASP Top 10 for LLM Applications (2025).

**Result:** 1 high, 7 medium, 6 low and 1 informational finding. 13 are fixed, each with a regression test, and 2 low ones (F-15, F-16) are accepted and documented. Two were confirmed by experiment against the original code: the double send (F-01) and session tokens written to logs (F-14). Residual risks are listed below. The pre-launch checklist at the end must be completed before going live.

## 1. Threat model

### Assets

| Asset | Why it matters |
| --- | --- |
| The ability to send email as the agent (executor + approvals) | This is the crown jewel. An unwanted send to a client can't be recalled, and it carries legal and reputational weight. |
| `APPROVAL_SIGNING_SECRET` | Together with write access to the database, it lets someone mint approvals. |
| `AUTH_SECRET`, Google OAuth client secret, session tokens | Taking over a session gives full owner powers, including approving sends and turning on `auto`. |
| `MODEL_API_KEY` / `REVIEWER_API_KEY` | Spend, and access to whatever the provider account can do. |
| `DATABASE_URL` (the owner role) | Can disable the guard triggers and rewrite history. |
| Deal data, contacts, source documents, drafts, sent log | Client PII and confidential deal terms. |
| `audit_log`, `sent_log`, `action_reviews` | The record of who approved what. Its integrity is the accountability story. |

### Actors

1. **Signed-out internet attacker.** Can reach only `/signin`, `/api/auth/*` and `/api/health`. Goals: get in (OAuth abuse, open redirect, CSRF), exhaust resources, or learn something from errors.
2. **Another tenant** (a different allowlisted user). Has a valid session for their own workspace. Goals: read or act on another workspace through ID guessing (IDOR) or IDs smuggled inside bodies, such as a `sourceId` in a citation or a `dealId` on run.
3. **Malicious inbound content.** An email, PDF or listing that becomes a `source` and is shown to the worker. This is indirect prompt injection, LLM01. Goals: make the worker draft a harmful or false email, send to a new recipient, leak deal data, or get the reviewer to approve.
4. **Compromised or misbehaving model output.** The worker or reviewer returns arbitrary text (LLM05 improper output handling, LLM06 excessive agency). Goals: self-approve, smuggle header injection, evade policy, spoof a verdict, or put content in the owner's UI that executes.
5. **Insider or leaked credentials.** Database owner credentials, Vercel access, or a leaked key.

### Trust boundaries

```
Browser ──(cookie, Origin)──▶ proxy.ts ──▶ API routes ──▶ services (workspace from session only)
                                              │
Untrusted text (sources) ──▶ worker model ──(strict JSON)──▶ GATE: schema → policy (code) → reviewer model → trust level
                                                                                      │
Owner (HumanSession only) ──▶ approvals.ts (HMAC, hash-bound, single-use) ──▶ executor.ts ──▶ sent_log
                                              Postgres guards (triggers, CHECK, unique) underneath everything
```

Everything left of the gate is untrusted. Model output is never trusted, and the reviewer's verdict counts only when it parses strictly. Only `executor.ts` crosses into "send". It accepts only an approval it can verify against the stored content.

## 2. Findings

Severity follows the OWASP risk rating, with likelihood × impact judged for this app's deployment (Vercel, single-owner workspaces, private beta).

| ID | Severity | Location | Description | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | **High** | `src/lib/services/decisions.ts` `editAndApprove` | **One decision could send twice.** The function checked `status === 'awaiting_owner'`, recorded the new version and only then marked the old one `superseded`, with no condition on the update. Two concurrent edit-and-approves each created and sent their own version, and an edit racing an approve could send both the original and the edit. Reproduced: the test sent 2 emails for 1 decision on the original code. | The old version is claimed first with `UPDATE … SET status='superseded' WHERE id=? AND status='awaiting_owner' RETURNING`, and a 409 is returned if no row came back. The executor's own conditional update and the new DB state machine (F-02) back this up. | Fixed (`tests/security.test.ts` F-01) |
| F-02 | Medium | `drizzle/0001_guards.sql` | **The DB didn't constrain action status.** The immutability trigger let `status` change freely, so one buggy or injected query could move a `practice_only` draft to `awaiting_owner` or `approved_auto`, or resurrect a `sent` one. TRUNCATE wasn't blocked on `action_reviews`, `proposed_actions` or `approvals`. | New migration `0002_status_guards.sql` allows only forward transitions (`pending → held/practice_only/awaiting_owner/approved_auto`, `held → awaiting_owner/dismissed`, `awaiting_owner → sent/superseded/dismissed`, `approved_auto → sent`) and adds TRUNCATE triggers. | Fixed (F-02 tests) |
| F-03 | Medium (latent) | `src/lib/gate/action.ts` | **Email header injection.** `subject` and recipient `name` accepted CR/LF and other control characters from model output. They become MIME headers as soon as a real Gmail sender replaces the stub (for example `Subject: x\r\nBcc: attacker@…`). | Single-line fields reject `\u0000-\u001f\u007f`. The body rejects control characters except `\n`, `\r` and `\t`. An invalid owner edit now returns 400 instead of 500. | Fixed (F-03 tests) |
| F-04 | Medium | `src/lib/gate/policy.ts` | **Policy evasion by the model.** The factual-claim check is built on `\d`, so fullwidth or Arabic-Indic digits and superscripts (`６２５,０００`) skipped citation enforcement. Zero-width and bidi-override characters could hide or reorder text the owner reads. Spelled-out amounts ("six hundred thousand") weren't treated as claims. | New `hidden_text` block finding for `\p{Cf}`, U+2028 and U+2029, and for any non-ASCII `\p{N}`. Magnitude words (`hundred`, `thousand`, `million`, `billion`, `percent`) now make a sentence factual. | Fixed (F-04 tests). Other spelled-out numbers remain residual (R-6) |
| F-05 | Medium | `src/lib/gate/reviewer.ts`, `src/lib/worker/worker.ts` | **Prompt-fence breakout (LLM01).** Untrusted text was embedded with `JSON.stringify`, which leaves `<` and `>` alone. A source or draft containing `</action><rules>…</rules> SYSTEM: …` closed the data fence, so the injected text sat outside the "this is data" region of the reviewer's prompt. | `fencedJson()` writes `<`, `>` and `&` as `<`, `>` and `&` inside every fence. JSON parsing restores them, so the models still see the exact text. | Fixed (F-05 tests) |
| F-06 | Low | `src/lib/models/client.ts`, `src/lib/env.ts` | **Model client hardening (LLM10 unbounded consumption).** Redirects were followed (the API key could follow a redirect), there was no `max_tokens` and no cap on response size, and `http://` base URLs were accepted in live mode. | `redirect: 'error'`, `max_tokens` (worker 8000, reviewer 2000), a 1 MB response cap, and `https` required for model base URLs when `MODEL_MODE=live`. | Fixed (F-06 tests) |
| F-07 | Medium off Vercel / Low on Vercel | `src/lib/ratelimit.ts` `clientIp` | **Rate-limit bypass by spoofing.** The `/api/auth` per-IP limit used the **left-most** `X-Forwarded-For` entry, which the client controls. Changing it on each request gives a fresh bucket, and each bucket is a new row in `rate_limits`. Vercel overwrites the header, but `next start`, Docker or any other proxy does not. | On Vercel (`VERCEL=1`), the edge-set `x-real-ip` is used. Elsewhere, the **right-most** hop is used, the one added by the nearest proxy. Verified with `next start`: spoofed headers all landed in the same bucket. | Fixed (F-07 tests) |
| F-09 | Medium | `src/lib/gate/policy.ts` `normalize` | **ReDoS.** `/[\s.,;:!?]+$/` is quadratic on long punctuation runs. A 20k-character draft took about 0.7 s per call, and `normalize` runs several times per policy pass, which costs serverless CPU on every `run` and edit. | A linear loop replaces the regex trim. Semantics are unchanged. | Fixed (F-09 test: under 200 ms) |
| F-10 | Low | `POST /api/decisions/:id/approve` | **The approval wasn't bound to what the owner saw.** `contentHash` was optional, so an approval went to whatever version the decision pointed to at that moment. | `contentHash` is required. It is `action.contentHash` from `GET /api/decisions`. | Fixed (routes test) |
| F-11 | Low | `src/lib/api/handler.ts` | **Body size check.** The 64 KB cap compared UTF-16 `length` (multi-byte text up to ~3× over) and only ran after the whole body had been read. | Rejects on `Content-Length` before reading, then compares `Buffer.byteLength`. | Fixed (routes test) |
| F-12 | Low | `src/app/app/[[...path]]/route.ts` | **Prototype assets had no CSP.** Non-HTML files (JS, CSS, and any future SVG) were served without one, and an SVG opened directly is an active document. | Assets get `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'`. | Fixed (routes test) |
| F-13 | Info | `src/app/api/decisions/route.ts` | The `bad_query` response lacked `cache-control: no-store`. | Uses the `json()` helper. | Fixed |
| F-14 | **Medium** | `src/auth.ts`, `src/lib/api/handler.ts`, `src/app/api/auth/[...nextauth]/route.ts` | **Session tokens and data written to logs (A09, ASVS 7.1.1).** Drizzle errors embed the query **parameters** in `message`. When the DB is unreachable, Auth.js's default logger printed `params: <session token>` for every request with a session cookie. Confirmed against `next start`. `apiRoute` logged `e.message` (user IDs, draft text), and an error from the auth rate limiter went unhandled, so the full error with parameters was logged. | `safeErrorSummary()` logs only the error type and machine codes (`AdapterError (ECONNREFUSED)`). A custom Auth.js `logger` is configured. The auth rate limiter fails closed with 503 and logs a sanitized summary. Re-tested: 0 token or `params:` lines. | Fixed (F-14 test) |
| F-15 | Low | `.npmrc`, lockfile | **Supply chain.** Install scripts run for `esbuild` (×2) and `fsevents`, which are well known, and there is no minimum release age. Semgrep flagged `npm-missing-minimum-release-age`. | No code change. See R-11 and the checklist. Lockfile check: all 216 packages resolve from `registry.npmjs.org` with integrity hashes. | Accepted (documented) |
| F-16 | Low | session lifetime | 7-day **sliding** database sessions with no absolute lifetime and no step-up before sensitive actions, such as switching a workflow to `auto` (ASVS 3.3.2). | No change. Product decision for the beta. See R-2. | Accepted (documented) |

(IDs match the test blocks in `tests/security.test.ts`. F-08 isn't used.)

### Checked and found sound

- **AuthN:** Google only. `email_verified === true` and the allowlist are checked in the `signIn` callback before any user row exists. `requireHuman()` checks the allowlist again on every request, so removing an email cuts off live sessions. OAuth tokens are dropped in `linkAccount`. Auth.js handles PKCE, state and CSRF for its POSTs. Cookies are `__Secure-` / `__Host-`, `HttpOnly`, `Secure` and `SameSite=Lax` in production (verified on the `next start` response headers). Database sessions get a new random token at sign-in, so session fixation doesn't apply. Sign-out is a server action (Next.js checks Origin) that deletes the session row.
- **AuthZ / tenancy (IDOR):** every query in `services/*`, `gate/*` and `executor.ts` filters on `workspace_id` taken from the session, including ids inside bodies (`dealId`, citation `sourceId`) and joins. I tried every `:id` route and body id across workspaces, and all return 404 (existing tests plus my review). `HumanSession` is constructed in exactly one place, and approvals re-check membership.
- **Approval gate:** the worker can only call `propose`, and the import-graph test enforces it. Strict schemas reject `approved`, `status` and similar keys. No route lets a non-human approve. `issueAutoApproval` is reachable only from `submitProposal` after policy and reviewer both pass, and the executor re-verifies the HMAC, single use, expiry, re-hash of the stored content, status, workflow `auto` and unpaused, and the stored reviews for that exact hash. A reviewer verdict can't be spoofed through output: prose, fenced JSON or extra keys all mean escalate, and the verdict is stored by the gate, not by the model. Replays and races of one approval are blocked by the conditional `used_at` update and the unique indexes.
- **CSRF:** writes require an exact `Origin` match plus `application/json` (non-simple, so a cross-site request triggers a preflight that fails). `SameSite=Lax` is defense in depth.
- **Injection:** no raw SQL except the parameterized `sql\`\`` in `ratelimit.ts`. Rule matchers are fixed types, never user regex. Dynamic regexes escape their input and are length-capped.
- **XSS:** `/signin` and `/signout` are React with escaped output and a nonce + `strict-dynamic` CSP, so there is no `unsafe-inline` for scripts. The API returns only JSON with `default-src 'none'`.
- **Open redirect:** `safeNext` allows only `/path` without `//` or `/api/`. Auth.js's default `redirect` callback keeps redirects on the same origin. Tested `?next=//evil.com`, which falls back to `/app/`.
- **Path traversal:** `/app/*` looks names up in `manifest.json` by exact string and never joins the request path onto the filesystem. `..`, `%2e%2e`, `manifest.json` and `.env` all return 404.
- **SSRF:** no user-controlled URL is ever fetched. Model base URLs come from the environment only, and are now https-only with no redirects.
- **Secrets in the client:** built with marker values in every secret variable and grepped `.next/static` for both the values and the variable names. Nothing matched. Server chunks don't contain the values either, because they're read at runtime.
- **Headers (verified on `next start`):** HSTS 2y with preload, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, `X-Frame-Options: DENY` (SAMEORIGIN only for `/app/*`), the CSPs described in the README, no `x-powered-by`, and `no-store` on the API.
- **Errors:** unknown errors become a generic `{"error":"internal"}`. Gate and executor messages carry only codes.

## 3. Scanner results

| Scanner | Before fixes | After fixes |
| --- | --- | --- |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm audit` (all) | 0 vulnerabilities | 0 (no dependency changes) |
| OSV (`api.osv.dev/v1/querybatch`, all 216 package versions from `package-lock.json`, including `next@16.3.8` and `next-auth@5.0.0-beta.32`; the endpoint was confirmed live with `lodash@4.17.15`, which returned 6+ advisories) | 0 packages with known vulnerabilities | 0 |
| Semgrep 1.180.0, registry rulesets `p/owasp-top-ten`, `p/typescript`, `p/nextjs`, `p/secrets`, `p/javascript`, `p/react`, `p/nodejsscan` (registry reachable) | 25 results, 0 true positives in `src/` | Same 25. Triage below |

Semgrep triage:

- `raw-html-concat` / `dom_xss` ×17 in `prototype/doc-view.js` and `practice.js`. The interpolated values are static sample data (`Ida.DOCS`, workflow names) run through `esc()`. Query parameters only select a key and are never interpolated. **Not exploitable today**, but these sinks matter once the prototype renders API data. See R-1.
- `regex_dos` ×4 in `policy.ts`. Measured empirically with adversarial 20k inputs: `containsPhrase` and `sentencesOf` are linear (false positives). Separately, manual review found the real quadratic regex in `normalize`, which the rule didn't flag (F-09, fixed).
- `express_open_redirect` in the prototype route: the redirect is to the fixed path `/signin` (false positive). `node_secret` in `approvals.ts`: a default parameter read from the environment, not a hardcoded secret (false positive). `node_insecure_random_generator` in `prototype/ida-store.js`: `Math.random` for sample ids (not security relevant).
- `npm-missing-minimum-release-age` in `.npmrc`: valid. See F-15 and R-11.
- 4 rule timeouts on `src/lib/db/schema.ts` (nodejsscan rules) and 1 parse error on `layout.tsx` (an `&` in a JSX attribute string). Both files were reviewed manually.

## 4. Tests

- `npm test` (PGlite): **126 passed**. There were 106 before, and all of them still pass. 3 were adjusted for the stricter behavior: the approve route now needs `contentHash`, and the forced-`approved_auto` executor test starts from a `pending` version because the DB now refuses `awaiting_owner → approved_auto`.
- `npm run test:pg` against PostgreSQL 16: **126 passed**.
- `tests/security.test.ts` holds one block per finding. The F-01 double-edit test fails on the original code.
- `npm run typecheck` and `npm run build` are clean.
- The least-privilege role in the checklist below was applied to a freshly migrated PostgreSQL 16 database. The full app flow ran as that role: provisioning, propose, approve, edit-and-approve, rules, workflows, tasks and rate limits. As that role, `ALTER TABLE … DISABLE TRIGGER`, `DELETE FROM audit_log`, `TRUNCATE sent_log`, content `UPDATE`s on `proposed_actions` and `approvals`, and `DELETE FROM decisions` were all refused.

## 5. Residual risks

| ID | Risk | Notes and mitigation |
| --- | --- | --- |
| R-1 | **Prototype DOM-XSS sinks** | The prototype builds HTML by string concatenation in many places. Some ids are interpolated without `esc()` (`workflows.js`, `sent.js`), and the edit flow reads `contenteditable` `innerHTML` back as the draft. It's safe today because it only renders its own `localStorage` sample data, and the hash-only `script-src` CSP blocks inline handlers and injected scripts. **Before the prototype renders API data** (model drafts, reviewer reasons, source text), every interpolation must go through `esc()` or `textContent`, and edited bodies must be read as `innerText`, not HTML. |
| R-2 | Session lifetime | 7-day sliding sessions with no absolute cap and no re-auth before turning on `auto` or approving. Consider a 12–24 h absolute lifetime and a fresh-login check (Google `max_age`/`prompt=login`) for `level: 'auto'`. |
| R-3 | Origin check trusts `X-Forwarded-Host` / `X-Forwarded-Proto` | Browsers can't set these on cross-site requests, and Vercel sets them, so CSRF isn't affected. Behind a different proxy, make sure it overwrites them. Setting `AUTH_URL` pins the canonical origin. |
| R-4 | Audit log is append-only but not tamper-evident | Triggers stop the app role. The owner role (or Neon admins) can still rewrite history. For stronger guarantees, hash-chain the rows or ship them to an external log sink (Vercel Log Drains → immutable storage). |
| R-5 | Model text shown to the owner | Reviewer `reasons` and escalation text come from a model that saw untrusted content. They could be persuasive ("verified, safe to approve"). Render them as plain text and label them as model output. Policy findings come from code and should be displayed above them. |
| R-6 | Factual-claim detection is heuristic | Small spelled-out numbers ("fourteen years old") and purely qualitative claims are left to the reviewer model. Keep `auto` limited to low-stakes workflows. |
| R-7 | `rate_limits` grows without bound | There's no cleanup job. With F-07 fixed, growth is bounded by real client IPs plus users. Add a daily `DELETE … WHERE window_start < now() - interval '1 day'` (the app role would need `DELETE` on that table) or move to Upstash or Vercel WAF. |
| R-8 | `next-auth@5.0.0-beta.32` is a beta | Watch advisories and pin upgrades deliberately. |
| R-9 | `MODEL_MODE=mock` is allowed in production | The mock reviewer approves everything. Harmless while sending is a stub. **Once real delivery exists, refuse `mock` in production**, or force escalation when the reviewer is a mock. |
| R-10 | Prompt injection is mitigated, not solved | The layers are deterministic policy first, recipients limited to the deal or allowlist, a strict verdict schema, fences that can't be escaped, and a reviewer from a different provider that never sees the worker's notes. A well-crafted source can still bias both models toward a plausible but wrong email that passes policy. `approve` should stay the default trust level. |
| R-11 | Supply chain | Install scripts are limited to `esbuild` and `fsevents`. Use `npm ci` (never `npm install`) in CI and on Vercel (default with a lockfile), enable Dependabot or Renovate with a minimum release age (for example 7 days), and review lockfile diffs. |
| R-12 | DB owner role can bypass every trigger | Covered by the least-privilege role in the checklist. |
| R-13 | HSTS `preload` + `includeSubDomains` | Don't submit the domain to the preload list unless every subdomain is HTTPS-only. |

## 6. Pre-launch checklist (owner)

**Google OAuth**
- [ ] Use an OAuth client only for production. Use a separate client for local development.
- [ ] Authorized redirect URIs: exactly `https://<prod-domain>/api/auth/callback/google`, with no wildcard or preview URLs. JavaScript origins: exactly the production origin.
- [ ] Consent screen: scopes `openid email profile` only. Keep it in **Testing** with named test users for the beta. This is a second allowlist on Google's side.
- [ ] `ALLOWED_EMAILS` lists only beta users. Remember that removing an address revokes live sessions.

**Database (Neon)**
- [ ] Run migrations (including `0002_status_guards.sql`) with the **owner** role from your machine. Never give the owner URL to Vercel.
- [ ] Create a least-privilege app role and set Vercel's `DATABASE_URL` to its **pooled** URL. This script was tested against PostgreSQL 16 with the full app flow:
  ```sql
  CREATE ROLE ida_app LOGIN PASSWORD '<generated>';
  GRANT USAGE ON SCHEMA public TO ida_app;
  GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO ida_app;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ida_app;
  GRANT UPDATE (status, updated_at) ON proposed_actions TO ida_app;
  GRANT UPDATE (used_at) ON approvals TO ida_app;
  GRANT UPDATE (status, resolved_at, resolved_by, action_id) ON decisions TO ida_app;
  GRANT UPDATE (text, source, enabled, matchers, updated_at) ON rules TO ida_app;
  GRANT UPDATE (trust_level, paused, updated_at) ON workflows TO ida_app;
  GRANT UPDATE (workflow_id) ON tasks TO ida_app;
  GRANT UPDATE (count, window_start) ON rate_limits TO ida_app;
  GRANT UPDATE ON users, sessions TO ida_app;   -- Auth.js adapter
  GRANT DELETE ON rules, sessions, verification_tokens, accounts TO ida_app;
  ```
  Re-run the grants after any migration that adds tables or columns the app writes.
- [ ] `sslmode=require` on every URL. Turn on Neon IP allow / private networking if your plan has it.
- [ ] Turn on point-in-time restore and backups. Decide on data retention (account deletion currently needs an admin procedure).

**Secrets**
- [ ] Generate a fresh `AUTH_SECRET` and `APPROVAL_SIGNING_SECRET` (different values, 32+ bytes) for **each** environment. Never reuse them between preview and production.
- [ ] If any secret was ever pasted into chat, a ticket, a `.env` that was committed, or a shared machine, **rotate it**. That includes the Google client secret and the database passwords.
- [ ] Mark every secret as **Sensitive** in Vercel (write-only). Only `Production` gets the production values.
- [ ] Rotation: `APPROVAL_SIGNING_SECRET` rotation only invalidates approvals that haven't been used (2-minute TTL). `AUTH_SECRET` rotation is safe with database sessions.

**Vercel**
- [ ] Turn on **Deployment Protection** (Vercel Authentication) for Preview deployments, and preferably "Standard Protection" for everything except the production domain.
- [ ] Preview and Development environments get **no** production secrets: a separate Neon branch database, separate OAuth client, separate model keys, and `MODEL_MODE=mock`.
- [ ] Set `AUTH_URL=https://<prod-domain>` in production. Don't set `AUTH_TRUST_HOST` outside Vercel unless your proxy overwrites `Host`.
- [ ] Turn on the Vercel Firewall / WAF with a rate-limit rule on `/api/auth/*` and `/api/workflows/*/run`, plus Attack Challenge Mode if needed.
- [ ] Add a Log Drain to retained storage for audit and incident response. Restrict who on the team can view logs and environment variables.
- [ ] Turn on 2FA for every Vercel, Neon, Google Cloud and GitHub account that can touch the project. Protect the `main` branch.

**Model keys (when going live)**
- [ ] **Separate keys per environment** and **per role**: set `REVIEWER_API_KEY` explicitly, so a worker key leak doesn't also give reviewer access.
- [ ] Set a **hard spend limit** and alerts on each key (OpenRouter credit limit per key, or the provider's budget). Start low.
- [ ] Turn off data retention and training on prompts at the provider or gateway (client PII is in the prompts).
- [ ] Keep `WORKER_MODEL` and `REVIEWER_MODEL` on different providers (enforced at startup). Keep workflows at `approve`, and enable `auto` only after a practice record.
- [ ] Before real Gmail sending: resolve R-1 and R-9, add an outbox with an idempotency key, and keep `send` reachable only from `executor.ts`.

**Ongoing**
- [ ] `npm audit` and an OSV check in CI on every PR. Dependabot or Renovate with a minimum release age.
- [ ] Re-run this review's tests (`npm test`, `npm run test:pg`) before each deploy.
