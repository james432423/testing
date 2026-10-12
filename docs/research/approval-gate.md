# Ida approval gate: instruction adherence and action approval

Research date: 2026-10-11. Every claim below is drawn from a primary document that was fetched in full (paper PDF, official docs or repo README). Sources are numbered and listed at the end. Secondary blog posts turned up by search were not relied on.

---

## A. What "jev" is

**Found. "Jev" is real and it fits the use case exactly.** It is not a typo.

- **Jev is a "decision model" from TypeSafe AI.** TypeSafe calls it "the first System One model" [1]. It does not generate text. You send it a *state*, such as a proposed email plus its context, and a set of typed questions. It returns typed answers:
  - **Choice**: probabilities over the options you list, plus a confidence value.
  - **Score**: a rating on an ordered rubric, plus a confidence value.
  - **Boolean ("Noul")**: the probability that a statement is true.

  Each question is evaluated in parallel and in isolation [1][2].
- **It has been available on Vercel AI Gateway since 2026-09-16** through AI SDK 7's `experimental_evaluate`. Vercel lists these use cases [3]:
  - "scoring urgency or risk before an action"
  - "verifying model outputs and enforcing guardrails"
  - deciding whether to "continue, retry, ask the user, or stop"

  TypeSafe claims Jev is up to 193.6x faster and 444.6x cheaper than LLMs on its own workflow evaluations. These are vendor numbers. TypeSafe also recommends calibrating against your own labeled examples [3].
- **TypeSafe's docs describe "confidence-gated routing"** [4][5]:
  - high confidence: act automatically
  - medium confidence: confirm or flag for review
  - low confidence: route to a human
  - set thresholds by stakes, for example above 0.9 before a high-stakes transfer
- **jevals is a related library from Openlayer** [6][7]. It is open source (MIT) and in alpha. It provides 37 prebuilt evals, including tool choice, groundedness, scope adherence and indirect injection, plus *gates*. A gate is a policy in YAML or Python that maps eval answers to **allow, escalate or block**. Example: `allow_if: action.approve >= 0.85 ... block_if: action.block >= 0.6 ... else: escalate`.
- **agentgateway documents a Jev guardrail webhook** [2]. It splits guardrail traffic between `jev-latest` and an OpenAI model and returns 403 above a threshold.
- **Arcade.dev ran a webinar on 2026-10-08** titled "Jev for Evaluating Agent Actions: Dynamic Rules w/ Deterministic Enforcement" [8]. Its key line: Jev returns a probability and "does not make the final call". In the presenter's words, "The mistake is letting that judgment also be the enforcement."

**Caveats for Ida:**
- Jev is about a month old (the jevals README says "about a week old" at release).
- Published accuracy is thin: JevBench shows 83–87% on two tasks, and calibration "varies by task" [7].
- **jevals gates fail open by default.** If the backend errors, the action is allowed unless you set `on_error="block"` [7]. Ida must set `on_error="block"`.
- Neither TypeSafe nor jevals documents how Jev itself resists prompt injection inside the state it evaluates [1][7]. Treat Jev as an injectable model like any other.
- The jevals README itself says the classifier "shouldn't be the authorizer" and to keep a human on irreversible actions [7].

**Bottom line:** Jev is a reasonable candidate for the "dedicated decision model" layer: it is cheap, fast, typed and gives a probability. It does not replace deterministic policy, and it must be measured on Ida's own seeded test set.

---

## B. Survey of proven patterns

### B1. Getting the worker model to follow instructions and rules

| Pattern | What the evidence says | Use in Ida |
|---|---|---|
| **Structured outputs and constrained decoding** | OpenAI Structured Outputs with `strict: true` "ensures the model will always generate responses that adhere to your supplied JSON Schema." JSON mode guarantees only valid JSON. The schema guarantees *structure, not truth* [9]. Grammar and FSM-constrained decoding (Outlines) guarantees regex or grammar conformance with "little overhead" [10]. | The worker emits a typed `ProposedAction` with fields such as `to`, `cc`, `subject`, `body`, `template_id`, `cited_facts[]`, `rule_ids_applied[]` and `attachments[]`, never free text. Enums cover action types. |
| **Explicit, checkable rules** | IFEval shows that instructions which can be verified by code are scored objectively and reproducibly. Even GPT-4 followed only about 77% of prompts strictly [11]. LLM judges add their own bias [11]. | Write each owner rule as a deterministic check wherever possible, such as "never send outside 8am–8pm" or "never email a lead who opted out". Keep the prompt rule list short and number every rule. |
| **Narrow questions** | TypeSafe advises keeping each question narrow and combining multi-factor judgments in code [1]. | Retrieve only the rules relevant to this action type and contact (for example by contact tag and action type) and inject those. Do not paste the whole rulebook. |
| **Citations with verbatim quotes** | Anthropic: extract word-for-word quotes first. "If it can't find a quote, it must retract the claim." Allow "I don't know" [12]. | Every factual claim in a draft (price, address, showing time) must carry a `cited_facts[]` entry with a source ID and a verbatim quote. Code checks that the quote string actually appears in the source. A claim without a quote means the action is blocked. |
| **Self-check vs external check** | Intrinsic self-correction without external feedback does not help and often hurts (GPT-4 GSM8K 95.5 → 89.0; CommonSenseQA for GPT-3.5 75.8 → 41.8) [13]. LLM evaluators recognize and favor their own generations [14]. | Do not rely on the worker critiquing itself. Use external, deterministic feedback (schema, quote match, policy) plus an independent reviewer. |
| **Evals and regression suites** | Anthropic recommends extensive sandboxed testing and well-designed tools ("poka-yoke") [15]. Claude Code auto mode is evaluated on real traffic, curated failures and synthetic attacks [16]. | Keep a versioned golden set of real and synthetic emails. Run it on every prompt or model change. Gate deploys on the results. |

### B2. Gating actions in tool-using agents

**Separating planning from execution, and the dual-LLM pattern**
- **Willison's Dual LLM** [17]:
  - A *privileged* LLM has tools but never sees untrusted text.
  - A *quarantined* LLM reads untrusted text but has no tools.
  - Untrusted text moves only as opaque variables, and quarantined output is never forwarded unless validated, for example as a fixed classification.
- **CaMeL** [18] hardens this design:
  - The privileged LLM writes a plan as code from the trusted user query only.
  - The quarantined LLM parses untrusted data into Pydantic schemas.
  - Every value carries *capabilities*: its provenance and its allowed readers.
  - Python policy functions run at each tool call. The `send_email` example checks that recipients are trusted or are readers of the data being sent.
  - When a policy denies a call, the user is asked to approve.
  - Results: 77% of AgentDojo tasks solved with provable security, versus 84% undefended, and 0 successful attacks with Claude 3.5 Sonnet.
  - Limitations: confirmation fatigue, side channels, and phishing-style text manipulation is out of scope.
- **Design Patterns for Securing LLM Agents** [19] lists six patterns: Action-Selector, Plan-Then-Execute, LLM Map-Reduce, Dual LLM, Code-Then-Execute and Context-Minimization.
  - Guiding principle: once an agent has ingested untrusted input, that input must not be able to trigger consequential actions.
  - Its email-assistant case study: plan-then-execute protects *which* actions run, but **recipients and bodies can still be steered by untrusted content**. Detectors are heuristic, and an LLM classifier "can itself be injected."

**LLM-as-judge reliability and failure modes**
- MT-Bench [20]: GPT-4 agrees with humans more than 80% of the time, but every judge showed biases:
  - position bias (GPT-4 consistent only 65% of the time)
  - verbosity bias (91% attack success on GPT-3.5 and Claude-v1)
  - self-enhancement (+10% for GPT-4)
  - weak grading on math

  Mitigations: swap positions, use reference-guided judging, use few-shot examples.
- Self-preference grows with self-recognition, and the link appears causal [14]. **This is the strongest argument that the reviewer should come from a different model family than the worker.**
- A panel of diverse smaller models from different families beat a single large judge, showed less intra-model bias and cost 7x less [21].
- JudgeDeceiver [22]: optimized strings injected into a candidate response steer an LLM judge. Known-answer and perplexity defenses were insufficient. **The reviewer is an attack surface.**
- Claude Code auto mode [16][23] is the closest production analogue to Ida's reviewer:
  - A separate classifier model reviews actions.
  - It is "reasoning-blind by design": it sees user messages and tool calls, but the agent's prose and **tool results are stripped**. The stated reasons: so the agent cannot rationalize, and so injected content cannot reach the reviewer.
  - Two stages: a fast filter biased toward blocking, then chain-of-thought review of flagged actions.
  - Measured results: 0.4% FPR on 10k real calls, but **17% FNR on 52 real "overeager" actions** and 5.7% FNR on synthetic exfiltration.
  - It falls back to human prompting after 3 consecutive or 20 total blocks. An unparseable verdict means deny.
  - The authors say it is not a substitute for human review on high-stakes actions.

**Guardrail frameworks**
- **NVIDIA NeMo Guardrails** [24]: input, retrieval, dialog, execution and output rails. *Execution rails* check tool inputs and outputs. It advises keeping authentication away from the LLM.
- **Guardrails AI** [25]: input and output guards composed from Hub validators, plus structured output generation.
- **Llama Guard** [26]: a Llama-2-7B safety classifier with a custom taxonomy supplied in the prompt. Its authors note it "may be susceptible to prompt injection attacks." It targets content safety, not business-action correctness, so it is not a fit as Ida's reviewer.

**Vendor guidance on human-in-the-loop and permissions**
- **OpenAI** [27]: guardrails are "a layered defense." Rate every tool low, medium or high risk and use the ratings to trigger actions. Add deterministic rules (blocklists, regex). Escalate to a human on failure thresholds and on "sensitive, irreversible, or high stakes" actions.
- **Anthropic** [15]: one model processes while another screens, which "tends to outperform" a single call doing both. Use human checkpoints.
- **Claude Code permissions** [28]: tiered approvals. Rules are evaluated "deny, then ask, then allow," and an allow rule cannot override a deny.
- **OWASP** [29][30]:
  - The root causes of Excessive Agency are excessive functionality, permissions and autonomy.
  - "Implement authorization in downstream systems rather than relying on an LLM to decide if an action is allowed."
  - Use human-in-the-loop for high-impact actions.
  - It is "unclear if there are fool-proof methods of prevention for prompt injection."

**Deterministic authorization**
- **OPA** [31] "decouples policy decision-making from policy enforcement." You send JSON input, a Rego policy evaluates it, and OPA returns a decision with reasons.
- **Cedar** [32][33] models principal, action, resource and context. Its semantics: default deny, and "an explicit Deny for any one policy always overrides any Allow."
- **Capability tokens.** Macaroons [34] are bearer credentials with chained-HMAC *caveats* that attenuate scope. Example: "send only to contact X, only template Y, expires in 10 min." CaMeL applies the same idea to data values [18].

### B3. Prompt injection: the defining risk for Ida

Inbound emails, PDFs (MLS sheets, contracts) and web listings are attacker-controlled.
- Greshake et al. demonstrated an **email worm**: a malicious email told a GPT-4 email assistant to forward itself to all contacts. They also demonstrated exfiltration through crafted URLs and links [35]. Text can be hidden (HTML comments, white text, Base64).
- Mitigations that reduce the risk but do not eliminate it:
  - Instruction-hierarchy training: up to 63% robustness gains, but still vulnerable [36].
  - Spotlighting. Datamarking cuts attack success from about 50% to 1–8%. Base64 encoding achieves 0–1.8% on strong models. Simple delimiters are weak [37].
- **Both the worker and the reviewer can be injected.** The reviewer is the bigger prize, because fooling it equals approval.

---

## C. Recommended design for Ida (1 page)

**Principle:** the worker *proposes* and never *disposes*. Approval is a pipeline of independent layers. Deterministic code holds the final say, and any layer can only make the outcome stricter. An error or timeout in any layer means **block**, never allow.

### Layer 0: Worker (drafting model)
- Its only output is a schema-constrained `ProposedAction` [9]: action type (enum), recipients (contact IDs, not raw addresses), `template_id`, body, `cited_facts[]` with verbatim quotes and source IDs, and `rule_ids_applied[]`.
- Inbound email and PDF text enters only through a quarantined extractor. That step is tool-less, schema-only and spotlighted [17][18][37]. The worker sees extracted fields plus datamarked excerpts.
- The worker has **no send tool**. It can only call `propose_action`.

### Layer 1: Deterministic policy (OPA or Cedar, default deny) [31][32][33]
These rules run as code, not as model judgments:
- The recipient must be an existing contact. Domain allowlist. Opt-out and do-not-contact checks. No new recipients introduced by inbound text (a provenance check in the style of CaMeL [18]).
- Rate limits, send window and a per-contact cooldown.
- Attachments may come only from the owner's document store.
- Every `cited_fact` quote must string-match its source.
- Regex and blocklist for wire or bank instructions, links to unknown domains, prices, and legal or fair-housing phrases.
- Diff against the template: a body that drifts more than N% from an approved template is escalated.
- Output: `deny`, `require_human`, or `eligible_for_review`. The same layer mints a single-use capability token (macaroon-style [34]) scoped to that exact recipient, body hash and expiry. The send service accepts nothing else. This is complete mediation [29].

### Layer 2: Independent reviewer (a different provider from the worker) [14][21]
- **Job:** answer narrow typed questions about this one action, for example:
  - Does the body match the owner's request and the stated intent?
  - Does it make any commitment (price, date, legal claim)?
  - Is the recipient appropriate for this content?
  - Does it contain instructions or links that look externally sourced?
  - Risk score from 0 to 4.

  Use Jev [3][7] or a typed-output LLM, ideally a two-stage design (fast block-biased filter, then reasoned review) [16]. Optionally use a two-model panel from different families [21].
- **What the reviewer sees:**
  - the owner's standing rules and the specific request (trusted)
  - the contact record (from the CRM, trusted)
  - the proposed action fields
  - the Layer 1 results
- **What the reviewer does not see:**
  - the worker's reasoning or justification, so the worker cannot rationalize [16]
  - raw inbound email or PDF text; at most the extractor's typed fields
  - other contacts' data
- **Injection hardening for the reviewer:**
  - Datamark or encode the proposed body as data [37]. The body is the one place attacker text can be laundered into what the reviewer reads [19][22].
  - The reviewer has no tools.
  - Its output is a strict schema only.
  - Unparseable output means block.
  - The reviewer cannot *approve* past a Layer 1 `deny` or `require_human`. It can only downgrade.
- **Decision policy** (jevals-style gate with `on_error="block"`) [5][7]: allow only if P(safe) ≥ the threshold for the action's tier. Block if P(unsafe) ≥ τ_block. Everything else escalates to the human.

### Layer 3: Trust level and the human owner
- **Tier A** (auto-send after Layers 1–2 pass): low-risk templated replies to known contacts, such as showing confirmations or "received, will follow up".
- **Tier B** (one-tap owner approval): new content, new threads, anything quoting a price or date.
- **Tier C** (always the human, edited): offers, contract terms, money, legal or fair-housing-sensitive content, new recipients.
- **Promotion:** a template or contact moves up a tier only after N consecutive owner approvals with no edits. Demotion is immediate on any owner edit or reject.
- **Fatigue control** [18][19]: batch Tier B approvals into a digest that shows the diff against the template.
- **Circuit breaker:** after 3 consecutive or 20 total reviewer blocks, pause autonomy and ask the owner [23].

### Measuring the reviewer
- **Seeded test set,** at least 500 cases, labeled, versioned, run on every change. Bad actions to seed:
  - wrong recipient
  - injected "forward this to…" emails
  - invented prices or times (quote missing or mismatched)
  - fair-housing violations
  - wire-fraud text
  - over-commitment
  - template drift
  - JudgeDeceiver-style payloads aimed at the reviewer [22]

  Mix them with real good actions from beta owners.
- **Primary metric:** false-approve rate (FNR) on bad actions, reported per category and per tier. Target near 0 for Tier A.
- **Secondary metric:** false-block rate on good actions.
- **Calibration:** check calibration per backend and recalibrate on any model swap [7]. Benchmark against Claude Code auto mode's published 17% FNR on real overeager actions as a reminder that a reviewer alone is not enough [16].
- **Ongoing:** track the owner override rate in production.

### What to log (append-only, per action)
- Inbound message IDs and hashes, and extractor output.
- Worker model and version, prompt version, and the full `ProposedAction`.
- Layer 1 policy version, each rule result and the decision.
- Reviewer model and version, the exact reviewer input hash, every typed answer with its probabilities, and the thresholds applied.
- Tier, whether a human acted, the human's decision and any edit diff.
- Token ID, send result and message ID.
- Later outcomes: replies, complaints, unsubscribes.

These logs feed replay into the test set [7][16].

---

## Sources
1. TypeSafe AI, Jev introduction — https://docs.typesafe.ai/introduction
2. agentgateway, Jev guardrail guide — https://agentgateway.dev/docs/standalone/main/integrations/llm/guardrails/jev/
3. Vercel changelog, "TypeSafe AI Jev now available on AI Gateway" (2026-09-16) — https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway
4. TypeSafe, Patterns — https://docs.typesafe.ai/patterns
5. TypeSafe, Confidence — https://docs.typesafe.ai/confidence
6. Openlayer, "Introducing jevals" — https://www.openlayer.com/blog/introducing-jevals-agent-evals-guardrails
7. openlayer-ai/jevals README — https://github.com/openlayer-ai/jevals
8. Arcade.dev webinar, "Jev for Evaluating Agent Actions" (2026-10-08) — https://www.arcade.dev/webinars/2026-10-08-jev-evaluating-agent-actions-dynamic-rules/
9. OpenAI, Structured Outputs guide — https://developers.openai.com/api/docs/guides/structured-outputs
10. Willard & Louf, "Efficient Guided Generation for LLMs" (Outlines) — https://arxiv.org/abs/2307.09702
11. Zhou et al., IFEval — https://arxiv.org/abs/2311.07911
12. Anthropic, "Reduce hallucinations" — https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
13. Huang et al., "LLMs Cannot Self-Correct Reasoning Yet" — https://arxiv.org/abs/2310.01798
14. Panickssery, Bowman, Feng, "LLM Evaluators Recognize and Favor Their Own Generations" — https://arxiv.org/abs/2404.13076
15. Anthropic, "Building effective agents" — https://www.anthropic.com/engineering/building-effective-agents
16. Anthropic Engineering, Claude Code auto mode deep dive — https://www.anthropic.com/engineering/claude-code-auto-mode
17. Willison, "The Dual LLM pattern" — https://simonwillison.net/2023/Apr/25/dual-llm-pattern/
18. Debenedetti et al., "Defeating Prompt Injections by Design" (CaMeL) — https://arxiv.org/abs/2503.18813
19. Beurer-Kellner et al., "Design Patterns for Securing LLM Agents against Prompt Injections" — https://arxiv.org/abs/2506.08837
20. Zheng et al., "Judging LLM-as-a-Judge with MT-Bench" — https://arxiv.org/abs/2306.05685
21. Verga et al., "Replacing Judges with Juries" (PoLL) — https://arxiv.org/abs/2404.18796
22. Shi et al., "Optimization-based Prompt Injection Attack to LLM-as-a-Judge" — https://arxiv.org/abs/2403.17710
23. Claude Code docs, Permission modes (auto mode) — https://code.claude.com/docs/en/permission-modes
24. NVIDIA NeMo Guardrails docs — https://docs.nvidia.com/nemo/guardrails/latest/index.html
25. Guardrails AI docs — https://www.guardrailsai.com/docs
26. Inan et al., Llama Guard — https://arxiv.org/abs/2312.06674
27. OpenAI, "A practical guide to building agents" — https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
28. Claude Code docs, Configure permissions — https://code.claude.com/docs/en/permissions
29. OWASP GenAI, LLM06:2025 Excessive Agency — https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
30. OWASP GenAI, LLM01 Prompt Injection — https://genai.owasp.org/llmrisk/llm01-prompt-injection/
31. Open Policy Agent docs — https://www.openpolicyagent.org/docs
32. Cedar docs — https://docs.cedarpolicy.com/
33. Cedar policy syntax (permit/forbid) — https://docs.cedarpolicy.com/policies/syntax-policy.html
34. Birgisson et al., "Macaroons" (NDSS 2014) — https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/
35. Greshake et al., "Not what you've signed up for" (indirect prompt injection) — https://arxiv.org/abs/2302.12173
36. Wallace et al., "The Instruction Hierarchy" — https://arxiv.org/abs/2404.13208
37. Hines et al., "Defending Against Indirect Prompt Injection Attacks With Spotlighting" — https://arxiv.org/abs/2403.14720
