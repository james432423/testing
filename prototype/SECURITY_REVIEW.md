# Security review: Ida design mock (site2)

Date: 2026-10-11. Scope: every HTML/JS/CSS file in site2, vercel.json, docs/. Static site, no
backend, no npm dependencies, no third-party scripts. The only external resource is Google Fonts
(CSS from fonts.googleapis.com, font files from fonts.gstatic.com). State lives in localStorage
(`ida-demo-v7`; was v5), which any visitor can edit for themselves, so it was treated as untrusted input.

## Findings

| # | Severity | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | Medium | Stored HTML fields (`decision.body`, `why`, `quote`, `sent.body`, `sent.src.q`) were written to `innerHTML` unsanitized on Today and Sent. A tampered localStorage value, or markup pasted into the "Edit first" draft, ran script (confirmed: `<img src=x onerror>` executed). | Added `Ida.util.safeHtml`: inert DOMParser parse, allowlist of formatting tags (p, br, b, strong, i, em, u, span, a, ul, ol, li, small, div), only `class`/`data-cite` kept, `<a href>` only to same-site pages. Applied at every render and on save (`saveDraft`, `approve`). | Fixed |
| 2 | Medium | Draft read-back (`readEdit`) used `cloneNode` on the live editable letter, which re-fires handlers in pasted markup. | Read-back now copies sanitized HTML into an inert document before cleanup. | Fixed |
| 3 | Low | Ids from storage (`id`, `wf`, `doc`, `rule`, `how`, `needsApp`, onboarding pick keys, ...) went unescaped into attributes and hrefs (`data-x="' + id + '"`). Self-XSS through tampered storage. | All such ids now go through `esc()` (~70 sites). The store also validates state on load: every object key and id-like field must be a plain token, `level`/`group` must be known values, and the top-level shape must be right. Anything else is discarded for the sample data. `restore()` validates too. | Fixed |
| 4 | Low | `doc.html?d=constructor` / `__proto__` / `toString` resolved to Object built-ins through `Ida.DOCS[id]`, which threw page errors. The same lookup was used for the side panel, Today and Sent. | `Ida.doc(id)` and `Ida.util.own()` do own-property lookups, and `DEALS` uses them too. Unknown ids show "This sample doesn't include that document". | Fixed |
| 5 | Low | Malformed stored state (`{"v":5}`, wrong types) crashed every page. | Shape validation (see 3) falls back to the sample data. | Fixed |
| 6 | Info | main.html had 4 inline `<script>` blocks, which would block a strict `script-src`. | Moved them into `main.js`. No inline scripts or `on*` attributes remain in the site. | Fixed |
| 7 | Info | No security headers in vercel.json. | Added CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS, X-Frame-Options and COOP (below). | Fixed |
| 8 | Info | Ask field, add-task, add/edit rule, onboarding "task we missed", practice reasons, URL params (`?wf=`, `?deal=`, `?page=`, `#hash`): already escaped with `esc()` or `textContent`, or checked against known ids. | None needed. Covered by tests. | OK |
| 9 | Info | `doc.html?d=`: the id only selects an entry in the built-in `DOCS`/`DOCTEXT` maps. The iframe/`Open PDF` URL comes from that map (`docs/<id>.pdf`), never from the URL, so no arbitrary URL can be loaded and there are no open redirects (no code assigns a URL from a param to `location`). | None needed. | OK |
| 10 | Info | All `target="_blank"` links have `rel="noopener"`, all links and iframes are same-origin, and there are no `javascript:` URLs. | None needed. Asserted by tests. | OK |
| 11 | Info | Semgrep (p/javascript, p/xss, p/secrets, p/html; registry reachable) reported 12 `raw-html-concat` warnings in doc-view.js and practice.js. All 12 interpolate only `esc()`'d values or numbers. | None needed: false positives. | Reviewed |
| 12 | Info | Dependencies: no package.json, no CDN scripts. The only external origins are Google Fonts for CSS and font files. | None needed. | OK |

## Headers (vercel.json)

Pages, scripts, styles and images (`/((?!docs/).*)`):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
X-Frame-Options: SAMEORIGIN
```

Source PDFs (`/docs/(.*)`): `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`. Chrome's built-in PDF viewer runs as a plugin, so `object-src 'none'` on the PDF response itself could block it.

All routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains`, `Cross-Origin-Opener-Policy: same-origin`.

Deliberate deviations:
- `frame-ancestors 'self'` instead of `'none'`. The side panel embeds the site's own pages (doc.html, report.html, comps.html with `?embed=1`) and PDFs in an iframe, so `'none'` would break it. Other sites still cannot frame it.
- `style-src 'unsafe-inline'`. The pages use many `style="..."` attributes and an inline `<style>` in index.html. That carries much less risk than inline script, and script stays `'self'` only. A later cleanup could move the inline styles into CSS files and drop it.
- No `preload` on HSTS, because the deployment is on a vercel.app subdomain.

## Tests

- `site2_tests/serve.py`: a local server that sends exactly the vercel.json headers, so all tests run under the production CSP.
- `site2_tests/security.js`: 270 checks. The XSS suite runs twice, once with the CSP bypassed (to prove the escaping and sanitizing hold without the second layer) and once under the CSP. It pushes `<img onerror>`, `<svg onload>`, `<script>`, `javascript:` links and `<iframe srcdoc>` through the ask field (free text, question, rule, task, draft), add-task (yours and Ida's), add/edit/toggle rule, onboarding, practice reasons, the inline-edited draft (simulated rich paste, then reload, approve, Sent), URL params and hashes, and tampered localStorage (text fields, id fields, garbage). It asserts no payload runs and no `on*` attribute appears in any frame. It also checks `noopener`, same-origin links and iframes, zero CSP violations across all pages and dynamic views, that the fonts load, and the headers on every route. Against the original code it fails 48 checks; against the fixed code all pass.

## Addendum: People, playbooks by client type, change plans (store v7)

- New inputs: the delegate form (title, client picker, say, stop, what comes to you), the playbook scope form, per-client exceptions, the ask field's change plans (including the editable message and date fields in Edit), People search, `people.html#<id>` and `sent.html?group=`. All rendered values go through `esc()`; messages Ida sends from a plan are stored as `<p>` + escaped text and pass `safeHtml` on render. Thread citations are matched on escaped text and wrapped in a marker whose `data-doc` must resolve through `Ida.doc()`.
- Validation extended: `person`, `pb`, `duty`, `type`, `ev`, `ch`, `stage`, `ida`, `texting`, `dk`, `tpl`, `block`, `opt`, `chosen` are id-like; `ida` must be on/you/paused, `texting` opted/email, every `notify` value log/brief/now; id lists (`people`, `only`, `excluded`, `blocked`) and `info` keys must be tokens.
- Change undo stores a JSON snapshot (without the change history, so it doesn't nest) and restores it through `store.restore`, which re-validates.
- `security.js` now pushes the payloads through every new input and tampers the new text and id fields: 487 checks pass, with zero CSP violations on the new pages and dynamic views (change plan, delegate drawer, conversation panel, notification settings, phone More sheet).

## Addendum: People page removed, Follow Up Boss is the CRM (store v8)

- `people.html` / `people.js` are deleted. `vercel.json` redirects `/people`, `/people.html` and `/people.js` to `/handled` (the fragment, e.g. `#p-maya`, is kept by the browser and opens that client's panel). The CSP and other headers are unchanged and also sent on the redirect.
- New inputs: `handled.html#<id>` and `sent.html#<id>`. Both accept only a plain token that resolves to a known person / Sent entry; anything else is ignored. Covered by the hash payload checks in `security.js`.
- The client panel's Follow Up Boss summary is read-only (no inputs). Its only link, "Open in Follow Up Boss", is the one offsite link in the site: exactly `https://app.followupboss.com/`, `target="_blank"`, `rel="noopener"`. The link-hygiene checks allow that one URL and nothing else.
- `sid` (thread message to Sent entry) is an id-like field and is validated as a token on load.
