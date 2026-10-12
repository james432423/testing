# Ida — handoff for Claude Code

Ida is a back-office assistant for independent real estate agents. It takes on routine deal work (contract deadlines, document chase, inspection summaries, lead follow-up) and asks the agent only for real decisions. First user: James's mom, a working agent. Positioning: "You own the relationships. Ida operates the software and handles the follow-through."

Everything in the prototype is fictional sample data (agent "Dana Reyes", Reyes Realty).

---

## 1. What exists

| Piece | Where (in the handoff package) | State |
|---|---|---|
| Clickable prototype (static HTML/JS) | `prototype/` | Live at https://ida-prototype-theta.vercel.app (Vercel project `ida-prototype`, team `jamespatnikjp-4203s-projects`). Every button works against a localStorage sample store. |
| Prototype tests (Playwright) | `prototype-tests/` | See section 5 — state of the last run is **unverified**. |
| Backend (Next.js) | `backend/` (git repo, 10 commits, not pushed, not deployed) | Auth + DB + approval gate built; 126 tests passed at last run; `npm audit` and OSV clean. |
| Design system | `design-system/` (tokens.json, components/bundle.css, component previews + READMEs, brand book README.md) | Also published as a Claude artifact: https://claude.ai/artifact/NgvypunBzu2oKwC741H6Y5 |
| Research | `docs/research/approval-gate.md`, `docs/research/connectors-gmail-jev.md` | Sourced write-ups. |
| Accuracy test harness | `accuracy-test/` (PLAN.md, harness/, sample/) | Runs offline in `--mock` mode; not run against real models. |
| Decisions log | `docs/decisions.md` | Running record of product/brand decisions. |
| Logo options | `docs/logo-options/` | Not decided (see 6). |

---

## 2. Prototype (`prototype/`)

Static site, no build step, no npm dependencies. Served by Vercel with `cleanUrls`.

**Architecture**
- `ida-store.js` — the whole sample world as data plus a tiny store (`get / update / subscribe / snapshot / restore / reset`), persisted to localStorage (every access in try/catch). Also holds the outbox (10-second send delay) and pending Undo entries.
- `ida-shell.js` — shared shell: sidebar, phone tab bar, side panel (`.ida-drawer`), "Tell Ida a change" ask bar, Undo/"Sending in N s" toast, Reset demo.
- `ida-nav.js` — phone "More" sheet.
- One script per page: `today.js` (index.html), `handled.js`, `sent.js`, `tasks.js`, `workflows.js`, `rules.js`, `apps.js`, `practice.js`, `onboarding.js`.
- Documents: `doc.html` / `report.html` / `comps.html` + `doc-view.js/.css` + `ida-doctext.js`; real sample PDFs in `docs/` (page images in `docs/pages/` for mobile). Readable view highlights the cited passage; "Original PDF" tab shows the real file at the cited page.
- Styles: `ida.css` (tokens + components, theme-aware), `shell.css`, `ida-ui.css`, page CSS files.
- `vercel.json` — strict CSP (`script-src 'self'`, no inline scripts or handlers), HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, X-Frame-Options SAMEORIGIN; looser CSP for `/docs/*` PDFs.
- `SECURITY_REVIEW.md` — XSS fixes and rules: escape everything rendered; only the allowlist sanitizer may render HTML; doc ids are whitelisted; state from localStorage is validated on load.

**Pages (current nav):** Today ("Needs you") · Being handled · Sent · Tasks · Workflows · Your rules · Connected apps. Onboarding, Practice and the doc viewer are reachable from links.

**Deploy:** from inside the prototype folder, `npx vercel@62.5.0 deploy --prod --yes --scope jamespatnikjp-4203s-projects` (James must log in or supply a token; do not commit tokens). Exclude `main.html`/`main.js` (Claude-artifact copy) and any `_shots/`.

---

## 3. Backend (`backend/`)

Read `backend/README.md` and `backend/SECURITY_REVIEW.md` first.

- **Stack:** Next.js 16 (App Router, TypeScript), Auth.js v5 Google sign-in with database sessions (httpOnly, Secure, SameSite=Lax), Postgres via Drizzle (plain SQL migrations with DB triggers), zod on every route, rate limits, Origin checks, vitest (PGlite and real Postgres 16).
- **Access:** `ALLOWED_EMAILS` allowlist checked before user creation and on every request. Every table has `workspace_id`; every query is scoped to it.
- **Prototype:** copied into `backend/prototype/`, served only to signed-in users through a route with a file allowlist. Sync with `npm run prototype:sync -- <path-to-prototype>`. It still runs on its own localStorage, **not** the API.
- **Approval gate (core design)** — the model doing the work can never approve or send:
  1. Worker produces a structured `proposed_action` (type, recipients, subject, body, citations with page + verbatim quote). Worker code cannot import the executor, approvals, DB or auth (enforced by a test).
  2. Actions are immutable and content-hashed (DB trigger); status can only move forward (`drizzle/0002_status_guards.sql`).
  3. Deterministic policy first: recipients must be on the deal or allowlisted, every quote must exist in the stored source, facts need citations, owner rules, overstatement list, Unicode/zero-width tricks blocked, header-injection characters rejected.
  4. Independent reviewer: a different model **and** provider from the worker (server refuses to start otherwise); sees only the action, cited excerpts and rules; strict JSON verdict; any parse failure escalates.
  5. Workflow trust level decides: Practice = never sent; You approve = owner decision; On its own = only if policy passed and reviewer approved.
  6. Executor is the only sender: requires an HMAC-signed, single-use, 2-minute approval bound to the content hash; re-hashes and re-checks before sending. Sending is currently a stub writing to `sent_log`.
  7. `sent_log` and `audit_log` are append-only.
- **Model access:** one OpenRouter-compatible client (`WORKER_MODEL`, `REVIEWER_MODEL`); mock mode runs without keys. **James's rule: no real model keys until the site is confirmed secure.**
- **To deploy, James must create:** Google OAuth client (redirect `https://<domain>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`), Neon Postgres (Vercel Marketplace; run `npm run db:migrate` against the unpooled URL), and env vars `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `ALLOWED_EMAILS`, `APPROVAL_SIGNING_SECRET`. Use a least-privilege DB role for the app (SQL in SECURITY_REVIEW.md).
- **Known open risks (from SECURITY_REVIEW.md):** mock mode is allowed in production and its reviewer approves everything — must be refused before real sending; prompt injection is reduced, not solved (keep workflows at "approve"); audit log isn't tamper-evident against the DB owner; Auth.js v5 is beta; Google sign-in won't work on Vercel preview URLs; styles allow `'unsafe-inline'`.

---

## 4. Product decisions to respect

- **Delegate responsibilities, not messages.** The agent approves a scope once (who, what Ida may say, cadence, stop rules, what comes back to the agent); routine messages then run automatically through the gate. Only exceptions and real decisions reach the agent.
- **The agent must never be surprised by what Ida told someone.** Every message is logged and attributed; Sent can be grouped by person, deal or day.
- **Automations are organised by client type**, not per client: Buyer deals, Seller listings, Leads (playbooks apply to every client of that type, new clients join automatically, per-client exceptions allowed).
- **Ida is not a CRM.** People/contact data and history come from the agent's CRM (Follow Up Boss first); Ida reads it and writes its own notes/messages back. The People page was removed for this reason.
- **"Tell Ida a change"**: one plain instruction ("Sarah's pausing until February") produces a change plan listing every affected item; the plan, not the model, is what gets applied; undoable. Today it's keyword-matched; later a model fills the same plan.
- **Trust levels:** Practice → You approve → On its own. Promotion is per task and suggested by Ida with its record ("You approved 11 of 11 · let it send on its own"); can be partial. Rules carve exceptions inside automatic work ("ask me if it mentions a price").
- **Alert levels:** always logged / daily briefing / right away.
- **Texting:** only with prior written consent; stop on opt-out.
- **Show the source:** facts pulled from a document are highlighted and open the source (readable view with the original one tap away). A highlight must never say more than the source ("recommends repair", not "needs repair").
- **Brand:** forest green on white paper over an oat desk; Schibsted Grotesk; Kalam hand-written accent only for circled numbers, one source note per item and the calm empty state; yellow highlighter only on sourced facts; wine red only with the word "Problem"; one primary button per screen; no "AI" wording in product copy. Full rules in `design-system/README.md`.

---

## 5. State of the last work — verify first

The last prototype session was interrupted mid-run. Files in `prototype/` were changed by that run (People removed, outbox/Undo moved into the store), but **no test run was completed afterwards**. Before anything else:

```bash
cd prototype-tests
python3 serve.py ../prototype 8765 &        # serves with the production headers from vercel.json
BASE=http://localhost:8765/ node flows.js ../prototype
BASE=http://localhost:8765/ node security.js ../prototype
BASE=http://localhost:8765/ node linkcheck.js ../prototype
BASE=http://localhost:8765/ node handled_v2.js ../prototype
BASE=http://localhost:8765/ node workflows_v2.js ../prototype
node crawl.js ../prototype                   # known: rule-toggle clicks time out (label covers the input)
```
Some assertions in `flows.js`/`security.js` may still describe the old Workflows and Being handled layouts; update them to the new UI, keeping each test's intent. (Playwright: install it normally on your machine; the scripts expect `require('playwright')`.)

---

## 6. Open work, in priority order

1. **Security finding — disconnect doesn't block sending (external review, Oct 12).** Disconnecting Gmail on Connected apps still lets "Approve and send" queue and later mark the message Delivered. In `ida-store.js`: `disconnect` only flips connector status; `decLive` checks connectors only for decisions already `blocked`; `approve` doesn't check required connectors or workflow pause; `flush`/`finalizeIn`/`approveIn` complete without re-checking. Fix:
   - One shared `eligibility(action)` check (required connectors, permission, workflow/client pause, approval) used by every UI control, approve path and dispatch path.
   - Check before queueing **and** immediately before dispatch.
   - On disconnect, hold dependent queued actions with a visible reason; keep drafts recoverable; define a reconnect/re-approve policy (no duplicates).
   - Page-load flush and cross-tab changes (listen to the `storage` event) must not bypass eligibility.
   - Never show "Delivered" for a blocked/failed attempt; label simulated sends as simulated. Mirror the same rule server-side in the backend executor.
   - Regression tests: disconnect before approval, during countdown, reload/navigate after, cross-tab, reconnect, pause/permission change, status accuracy.
2. **Consistency findings (QA addendum)** — use one shared model for ownership, blocked status and pending actions so Today, Being handled, Sent and Tasks agree:
   - A01: Take over / Pause stops Ida's messages and approval prompts but must keep the human's own obligations visible (owner "You"), e.g. Sarah's commission question.
   - A03: turning a responsibility off marks its scheduled actions as held everywhere; next-action summaries skip held items.
   - A04: a blocked client (Marcus: needs Google Calendar + approval) never shows "On track" (the redesign likely fixed this — verify).
   - A05: Undo survives navigation (store-driven toast) — appears implemented; verify.
   - F01: empty/whitespace draft or missing recipient/subject can't be approved (store-level), button disabled with a reason; editor never collapses.
   - F02: approved messages wait 10 s ("Sending in N s · Undo" on every page) then go to Sent; Undo cancels — appears implemented; verify the copy matches.
3. **Decision cards are too tall.** Each Today card must fit on one screen: show the options as a compact row of buttons with a single "What happens next" line for the focused option, instead of a full paragraph under each button.
4. **Too much detail in progress lines.** e.g. "Open-house follow-up · Sunday at 230 Mercer Ave — 12 contacted · 5 replied · 2 booked · 1 asked to reconnect in spring" → something like "2 booked · 3 still talking". Source string is in `ida-store.js` (`du-oh` progress).
5. **CRM-sourced client context** (replaces People): Being handled row side panel shows a compact "From Follow Up Boss · synced" block (stage, contact, last contact, "Open in Follow Up Boss"), plus Ida's own layer (what Ida told them, what's next, what needs you, Take over / Hand back / Pause). Re-point any remaining `people.html` links to `handled.html#<id>`; add a `/people → /handled` redirect.
6. **Rename "Practice"** to something education-related. Options offered: Learning (recommended), Training, Shadowing, Teach Ida. **Awaiting James's pick.**
7. **Wire the prototype to the backend API** (escape everything once real data arrives), then the security pre-launch checklist, then real integrations.
8. **Logo:** app icon undecided. Shortlist in `docs/logo-options/` (subagent pick: B2 green tile with notebook margin + tick). Wordmark tick may still read as an accent mark.
9. **Accuracy test** (`accuracy-test/PLAN.md`): run 10 real inspection reports from the beta agent through 3–4 models before trusting any automatic sending.

---

## 7. Integrations — what the research found (`docs/research/connectors-gmail-jev.md`)

- **Gmail:** read/compose/modify scopes are *restricted* → Google review (~6 weeks) + paid security assessment (CASA, ~$675/yr via TAC Security). `gmail.send` alone is *sensitive* (lighter review) but then Ida can't read the inbox. Private beta works now in "Testing" mode (≤100 test users, re-consent every 7 days) or via forwarding/BCC to an Ida inbox. Encrypt OAuth tokens at rest.
- **Outlook (Graph):** Mail.Read/Mail.Send need no admin consent; free Publisher Verification.
- **Follow Up Boss:** open API, free system registration, OAuth or per-user key — first CRM to integrate. Lofty: OAuth. BoldTrail/kvCORE: user API token. QuickBooks: free Builder tier. Dotloop: request access. SkySlope: paid. Zillow: partner-only (read lead emails instead). MLS: per-MLS license.
- **OpenConnector:** don't use yet (no published source, unknown company would hold tokens). Do OAuth ourselves or use Nango / Pipedream Connect (SOC 2 Type II).
- **Jev (TypeSafe AI decision model):** usable as one layer of the independent reviewer via Vercel AI Gateway (`typesafe-ai/jev`, pin `jev-1.13.0`). Not hardened against injected instructions; fail closed (error, timeout, low confidence or gateway fallback → human approval); send only the draft and verified facts, never raw inbound email; keep amounts/dates/recipient checks in code. The `jevals` library allows on error by default — set block.

---

## 8. Working agreements with James

- He's visual: show mockups/screenshots rather than long descriptions; offer options.
- Ask before assuming; say plainly what's known vs not.
- When researching, read the full primary source, not snippets.
- Use independent reviewers with fresh context for design and security reviews.
- He wants to keep chatting while work runs — prefer background jobs over blocking.
- Security before model keys or real client data. Never commit or print secrets. A Vercel token was shared earlier in chat — remind him to revoke it if not done.
