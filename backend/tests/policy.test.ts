import { describe, expect, it } from 'vitest';
import { runPolicy, sentencesOf, isFactual, type PolicyInput, type PolicyRule } from '../src/lib/gate/policy.ts';
import type { ActionContent } from '../src/lib/gate/action.ts';

const SRC = '11111111-1111-4111-8111-111111111111';
const OTHER_DEAL_SRC = '22222222-2222-4222-8222-222222222222';
const DEAL = { id: 'deal-1', name: '9 Hollis Way' };

const baseContent = (): ActionContent => ({
  type: 'send_email',
  to: [{ name: 'Ruth Okafor', email: 'ruth.okafor@example.com' }],
  cc: [],
  subject: 'Water heater at 9 Hollis Way',
  body: 'Hi Ruth,\n\nThe water heater is 14 years old and near the end of its service life. I will ask the sellers about it.\n\nDana',
  citations: [{ sourceId: SRC, page: 12, quote: 'Water heater is 14 years old and near the end of its service life.', claim: 'The water heater is 14 years old and near the end of its service life' }],
});

const rule = (over: Partial<PolicyRule>): PolicyRule => ({ id: 'r', text: 'rule', kind: 'ask_first', enabled: true, matchers: [], ...over });

const input = (content: ActionContent, extra: Partial<PolicyInput> = {}): PolicyInput => ({
  content,
  deal: DEAL,
  dealContactEmails: ['ruth.okafor@example.com', 'mark.benton@benton.example.com'],
  allowlistEmails: ['closings@loneoak.example.com'],
  rules: [],
  sources: [
    { id: SRC, dealId: DEAL.id, title: 'Home inspection report', pages: [{ page: 12, text: 'Plumbing. Water heater is 14 years old and near the end of its service life. Recommend replacement.' }] },
    { id: OTHER_DEAL_SRC, dealId: 'deal-2', title: 'Listing sheet', pages: [{ page: 1, text: 'List price $625,000.' }] },
  ],
  ...extra,
});

describe('policy: clean action', () => {
  it('passes a fully cited email to people on the deal', () => {
    const r = runPolicy(input(baseContent()));
    expect(r.findings).toEqual([]);
    expect(r.passed).toBe(true);
  });
});

describe('policy: recipients', () => {
  it('flags a recipient who is not on the deal', () => {
    const c = baseContent();
    c.cc = [{ name: 'Stranger', email: 'stranger@example.com' }];
    const r = runPolicy(input(c, { rules: [rule({ id: 'r-contact', matchers: [{ type: 'recipients_on_deal' }] })] }));
    expect(r.passed).toBe(false);
    expect(r.findings).toContainEqual(expect.objectContaining({ check: 'recipients', severity: 'ask', ruleId: 'r-contact' }));
  });

  it('allows an allowlisted address, case-insensitively', () => {
    const c = baseContent();
    c.cc = [{ name: 'Closings', email: 'Closings@LoneOak.example.com' }];
    expect(runPolicy(input(c)).passed).toBe(true);
  });
});

describe('policy: citations', () => {
  it('blocks a quote that is not in the stored source', () => {
    const c = baseContent();
    c.citations[0]!.quote = 'Water heater is 4 years old.';
    const r = runPolicy(input(c));
    expect(r.passed).toBe(false);
    expect(r.findings.map((f) => f.check)).toContain('citation');
  });

  it('blocks a citation to a source the workspace does not have', () => {
    const c = baseContent();
    c.citations[0]!.sourceId = '33333333-3333-4333-8333-333333333333';
    expect(runPolicy(input(c)).findings[0]).toMatchObject({ check: 'citation', severity: 'block' });
  });

  it('blocks a citation from another deal', () => {
    const c = baseContent();
    c.citations = [{ sourceId: OTHER_DEAL_SRC, page: 1, quote: 'List price $625,000.', claim: 'The water heater is 14 years old and near the end of its service life' }];
    expect(runPolicy(input(c)).findings.some((f) => f.message.includes('different deal'))).toBe(true);
  });

  it('blocks a wrong page number', () => {
    const c = baseContent();
    c.citations[0]!.page = 13;
    expect(runPolicy(input(c)).passed).toBe(false);
  });

  it('blocks a citation whose claim is not in the draft', () => {
    const c = baseContent();
    c.citations[0]!.claim = 'The roof is brand new';
    expect(runPolicy(input(c)).findings.some((f) => f.check === 'citation')).toBe(true);
  });

  it('blocks a factual sentence with no citation', () => {
    const c = baseContent();
    c.body += '\n\nThe sellers agreed to a $1,800 credit on October 2.';
    c.body = c.body.replace('\n\nDana', '') + '\n\nDana';
    const r = runPolicy(input(c));
    expect(r.findings).toContainEqual(expect.objectContaining({ check: 'unsupported_claim', severity: 'block' }));
  });

  it('blocks a number that the cited quote does not contain', () => {
    const c = baseContent();
    c.body = c.body.replace('14 years', '15 years');
    c.citations[0]!.claim = 'The water heater is 15 years old and near the end of its service life';
    const r = runPolicy(input(c));
    expect(r.passed).toBe(false);
    expect(r.findings.some((f) => f.message.includes('15'))).toBe(true);
  });

  it('does not treat the deal address or questions as claims', () => {
    expect(isFactual('Could we meet Wednesday at 2 pm?')).toBe(false);
    const c = baseContent();
    c.body = 'Hi Ruth,\n\nA quick note on 9 Hollis Way. Could we talk Thursday?\n\nDana';
    c.citations = [];
    expect(runPolicy(input(c)).passed).toBe(true);
  });

  it('splits greeting and sign-off away from the sentences', () => {
    expect(sentencesOf('Hi Ruth,\n\nOne. Two.\n\nDana')).toEqual(['One.', 'Two.']);
  });
});

describe('policy: rules and wording', () => {
  it('ask-first price rule fires on a dollar amount', () => {
    const c = baseContent();
    c.body = c.body.replace('I will ask the sellers about it.', 'I will ask the sellers for a credit, maybe $1,000?');
    const r = runPolicy(input(c, { rules: [rule({ id: 'r-price', text: 'Before quoting a price', matchers: [{ type: 'money' }] })] }));
    expect(r.passed).toBe(false);
    expect(r.findings).toContainEqual(expect.objectContaining({ check: 'rule', ruleId: 'r-price', severity: 'ask' }));
  });

  it('never rule blocks', () => {
    const c = baseContent();
    c.body = c.body.replace('I will ask the sellers about it.', 'I promise this gets fixed.');
    const r = runPolicy(input(c, { rules: [rule({ id: 'r-promise', kind: 'never', matchers: [{ type: 'keywords', any: ['promise'] }] })] }));
    expect(r.findings).toContainEqual(expect.objectContaining({ ruleId: 'r-promise', severity: 'block' }));
  });

  it('keyword matching is whole-word', () => {
    const c = baseContent();
    c.body = c.body.replace('I will ask the sellers about it.', 'I will ask the sellers to compromise.');
    const r = runPolicy(input(c, { rules: [rule({ kind: 'never', matchers: [{ type: 'keywords', any: ['promise'] }] })] }));
    expect(r.passed).toBe(true);
  });

  it('style rules only warn', () => {
    const r = runPolicy(input(baseContent(), { rules: [rule({ kind: 'style', matchers: [{ type: 'max_words', max: 5 }] })] }));
    expect(r.passed).toBe(true);
    expect(r.findings[0]).toMatchObject({ severity: 'warn' });
  });

  it('disabled rules are ignored', () => {
    const c = baseContent();
    c.body = c.body.replace('I will ask the sellers about it.', 'I promise this gets fixed.');
    const r = runPolicy(input(c, { rules: [rule({ kind: 'never', enabled: false, matchers: [{ type: 'keywords', any: ['promise'] }] })] }));
    // "promise" is still on the overstatement list, but the disabled rule adds nothing.
    expect(r.findings.some((f) => f.check === 'rule')).toBe(false);
  });

  it('flags overstatement', () => {
    const c = baseContent();
    c.body = c.body.replace('I will ask the sellers about it.', 'The sellers will definitely replace it.');
    const r = runPolicy(input(c));
    expect(r.findings).toContainEqual(expect.objectContaining({ check: 'overstatement', severity: 'ask' }));
    expect(r.passed).toBe(false);
  });
});
