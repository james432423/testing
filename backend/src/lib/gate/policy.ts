/**
 * Deterministic policy checks. Pure functions: no database, no model, no
 * clock. They run before the reviewer model and their result is recorded
 * as an action_review with reviewer = 'policy'.
 *
 * Severity:
 *   block - the draft has a defect (unsupported fact, broken citation, a
 *           "never" rule). Never auto-sent; the owner sees it flagged.
 *   ask   - allowed, but only with the owner's say-so (ask-first rules,
 *           recipients not on the deal, overstatement).
 *   warn  - style issues; recorded, does not stop anything.
 * `passed` is true only when there are no block/ask findings.
 */
import type { RuleMatcher, SourcePage } from '../db/schema.ts';
import { allRecipients, type ActionContent } from './action.ts';

export type Severity = 'block' | 'ask' | 'warn';
export type Finding = { check: string; severity: Severity; message: string; ruleId?: string };
export type PolicyResult = { passed: boolean; findings: Finding[] };

export type PolicyRule = {
  id: string;
  text: string;
  kind: 'ask_first' | 'never' | 'style';
  enabled: boolean;
  matchers: RuleMatcher[];
};

export type PolicySource = { id: string; dealId: string | null; title: string; pages: SourcePage[] };

export type PolicyInput = {
  content: ActionContent;
  deal: { id: string; name: string };
  dealContactEmails: string[];
  allowlistEmails: string[];
  rules: PolicyRule[];
  /** Only the sources that belong to this workspace. */
  sources: PolicySource[];
};

/** Words that overstate certainty. Matched as whole words or phrases. */
export const OVERSTATEMENT_WORDS = [
  'guarantee',
  'guaranteed',
  'guarantees',
  'definitely',
  'certainly',
  'for sure',
  'no problem',
  'no problems',
  'no issues',
  'nothing to worry',
  'risk-free',
  'risk free',
  'perfect condition',
  'flawless',
  '100%',
  'absolutely',
  'best deal',
  'can\'t go wrong',
  'promise',
  'promised',
];

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|yesterday';
// Magnitude words catch spelled-out amounts ("six hundred thousand").
const MAGNITUDES = 'hundred|thousand|million|billion|percent';
const FACTUAL_RX = new RegExp(`\\d|\\$|\\b(${MONTHS}|${DAYS}|${MAGNITUDES})\\b`, 'i');

/**
 * Characters that let a draft say something the checks below cannot see:
 * non-ASCII digits (fullwidth "６２５", Arabic-Indic, superscripts) slip past
 * \d, and format characters (zero-width, bidi overrides, soft hyphen) can
 * hide or reorder text. Model output is untrusted, so these block.
 */
const NON_ASCII_NUMBER_RX = /(?![0-9])\p{N}/u;
const HIDDEN_CHAR_RX = /[\p{Cf}\u2028\u2029]/u;

const TRAILING = new Set([' ', '.', ',', ';', ':', '!', '?']);

export function normalize(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/["]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip trailing punctuation with a loop, not /[...]+$/: that regex is
  // quadratic on long punctuation runs (ReDoS on a 20k-character draft).
  let end = out.length;
  while (end > 0 && TRAILING.has(out[end - 1]!)) end--;
  return out.slice(0, end);
}

/** Numbers with separators removed: "$625,000" -> "625000", "2:30" -> "2", "30". */
export function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, '').replace(/\.0+$/, ''));
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  const startsWord = /^\w/.test(p);
  const endsWord = /\w$/.test(p);
  const rx = new RegExp(`${startsWord ? '\\b' : ''}${escapeRx(p)}${endsWord ? '\\b' : ''}`, 'i');
  return rx.test(haystack);
}

/** Splits a plain-text email into sentences, dropping the greeting and sign-off lines. */
export function sentencesOf(body: string): string[] {
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const content = lines.filter((l, i) => {
    if (i === 0 && /^(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^.?!]*,?$/i.test(l)) return false;
    // Sign-off: a short last line with no sentence punctuation (a name or signature).
    if (i === lines.length - 1 && l.length <= 60 && !/[.?!]$/.test(l)) return false;
    if (/^(thanks|thank you|best|regards|cheers)[,.]?$/i.test(l)) return false;
    return true;
  });
  return content.flatMap((l) => l.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)).map((s) => s.trim()).filter(Boolean);
}

export function isFactual(sentence: string): boolean {
  if (/\?\s*$/.test(sentence)) return false; // a question or request, not a claim
  return FACTUAL_RX.test(sentence);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function severityFor(kind: PolicyRule['kind']): Severity {
  return kind === 'never' ? 'block' : kind === 'ask_first' ? 'ask' : 'warn';
}

export function runPolicy(input: PolicyInput): PolicyResult {
  const { content, deal } = input;
  const findings: Finding[] = [];
  const text = `${content.subject}\n${content.body}`;
  const activeRules = input.rules.filter((r) => r.enabled);

  /* 0. Text the deterministic checks could not read. */
  for (const [field, value] of [['subject', content.subject], ['body', content.body], ...allRecipients(content).map((r) => ['recipient name', r.name] as const)] as const) {
    if (HIDDEN_CHAR_RX.test(value)) {
      findings.push({ check: 'hidden_text', severity: 'block', message: `The ${field} contains invisible or direction-changing characters.` });
    }
    if (NON_ASCII_NUMBER_RX.test(value)) {
      findings.push({ check: 'hidden_text', severity: 'block', message: `The ${field} contains numbers written with non-standard digits.` });
    }
  }

  /* 1. Recipients must be on the deal or allowlisted. */
  const known = new Set([...input.dealContactEmails, ...input.allowlistEmails].map((e) => e.trim().toLowerCase()));
  const recipientRule = activeRules.find((r) => r.matchers.some((m) => m.type === 'recipients_on_deal'));
  for (const r of allRecipients(content)) {
    if (!known.has(r.email.toLowerCase())) {
      findings.push({
        check: 'recipients',
        severity: 'ask',
        message: `${r.name} <${r.email}> is not on ${deal.name} and not on your allowlist.`,
        ruleId: recipientRule?.id,
      });
    }
  }

  /* 2. Every citation must resolve to an exact quote in a stored source. */
  const sourceById = new Map(input.sources.map((s) => [s.id, s]));
  const normBodyAndSubject = normalize(text);
  const validCitations: ActionContent['citations'] = [];
  for (const c of content.citations) {
    const src = sourceById.get(c.sourceId);
    if (!src) {
      findings.push({ check: 'citation', severity: 'block', message: `Citation points to a source Ida doesn't have (${c.sourceId}).` });
      continue;
    }
    if (src.dealId && src.dealId !== deal.id) {
      findings.push({ check: 'citation', severity: 'block', message: `"${src.title}" belongs to a different deal.` });
      continue;
    }
    const page = src.pages.find((p) => p.page === c.page);
    if (!page) {
      findings.push({ check: 'citation', severity: 'block', message: `"${src.title}" has no page ${c.page}.` });
      continue;
    }
    if (!normalize(page.text).includes(normalize(c.quote))) {
      findings.push({ check: 'citation', severity: 'block', message: `The quoted words are not on page ${c.page} of "${src.title}".` });
      continue;
    }
    if (!normBodyAndSubject.includes(normalize(c.claim))) {
      findings.push({ check: 'citation', severity: 'block', message: `A citation supports words that are not in the draft: "${c.claim.slice(0, 80)}".` });
      continue;
    }
    const quoteNums = new Set(numbersIn(c.quote));
    const missing = numbersIn(c.claim).filter((n) => !quoteNums.has(n));
    if (missing.length) {
      findings.push({ check: 'citation', severity: 'block', message: `The draft says ${missing.join(', ')} but the cited quote does not.` });
      continue;
    }
    validCitations.push(c);
  }

  /* 3. Every factual sentence needs a valid citation, and its numbers must come from a cited quote. */
  const dealNums = new Set(numbersIn(deal.name));
  const dealNameRx = new RegExp(escapeRx(deal.name), 'gi');
  for (const sentence of [content.subject, ...sentencesOf(content.body)]) {
    // The deal's own address is not a claim ("An update on 412 Linden Ct").
    if (!isFactual(sentence.replace(dealNameRx, ''))) continue;
    const ns = normalize(sentence);
    const covering = validCitations.filter((c) => {
      const nc = normalize(c.claim);
      return ns.includes(nc) || nc.includes(ns);
    });
    const nums = numbersIn(sentence).filter((n) => !dealNums.has(n));
    if (covering.length === 0) {
      findings.push({ check: 'unsupported_claim', severity: 'block', message: `No source for: "${sentence.slice(0, 120)}"` });
      continue;
    }
    const quoted = new Set(covering.flatMap((c) => numbersIn(c.quote)));
    const unquoted = nums.filter((n) => !quoted.has(n));
    if (unquoted.length) {
      findings.push({ check: 'unsupported_claim', severity: 'block', message: `${unquoted.join(', ')} in "${sentence.slice(0, 80)}" is not in the cited source.` });
    }
  }

  /* 4. Owner's rules with deterministic matchers. */
  for (const rule of activeRules) {
    for (const m of rule.matchers) {
      let hit = false;
      if (m.type === 'keywords') hit = m.any.some((k) => containsPhrase(text, k));
      else if (m.type === 'money') hit = /\$\s?\d/.test(text);
      else if (m.type === 'max_words') hit = wordCount(content.body) > m.max;
      if (hit) {
        findings.push({ check: 'rule', severity: severityFor(rule.kind), message: rule.text, ruleId: rule.id });
        break;
      }
    }
  }

  /* 5. Overstatement. */
  const over = OVERSTATEMENT_WORDS.filter((w) => containsPhrase(text, w));
  if (over.length) {
    findings.push({ check: 'overstatement', severity: 'ask', message: `Overstates certainty: ${over.join(', ')}.` });
  }

  return { passed: !findings.some((f) => f.severity !== 'warn'), findings };
}
