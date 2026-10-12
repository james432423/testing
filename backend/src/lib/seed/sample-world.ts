/**
 * The Dana Reyes sample world, mirrored from the prototype's ida-store.js.
 * Every email address uses the reserved example.com domain.
 */
import type { RuleMatcher, SourcePage } from '../db/schema.ts';

export const OWNER = { name: 'Dana Reyes', business: 'Reyes Realty' };

export type SampleDeal = {
  key: string;
  name: string;
  side: string;
  status: string;
  people: { name: string; role: string; email: string }[];
};

export const DEALS: SampleDeal[] = [
  {
    key: 'linden',
    name: '412 Linden Ct',
    side: 'Buyers',
    status: 'Closing Thursday, Oct 15 at 2:00 pm',
    people: [
      { name: 'Jen Park', role: 'your buyer', email: 'jen.park@example.com' },
      { name: 'Tom Park', role: 'your buyer', email: 'tom.park@example.com' },
      { name: 'Kim Alvarez', role: 'lender, Northgate Mortgage', email: 'kim.alvarez@northgate.example.com' },
      { name: 'Maya Ruiz', role: 'Lone Oak Title', email: 'maya.ruiz@loneoak.example.com' },
      { name: 'Rob Chen', role: "sellers' agent, Harbor Realty", email: 'rob.chen@harbor.example.com' },
    ],
  },
  {
    key: 'ash',
    name: '17 Ash St',
    side: 'Your listing',
    status: 'Option period ends Wednesday, Oct 14 at 5:00 pm',
    people: [
      { name: 'Luis Garcia', role: 'your seller', email: 'luis.garcia@example.com' },
      { name: 'Ana Garcia', role: 'your seller', email: 'ana.garcia@example.com' },
      { name: 'Sam Whitfield', role: "buyers' agent", email: 'sam.whitfield@example.com' },
      { name: 'Maya Ruiz', role: 'Lone Oak Title', email: 'maya.ruiz@loneoak.example.com' },
      { name: 'Marcus Lee', role: 'website lead', email: 'marcus.lee@example.com' },
      { name: 'Priya Shah', role: 'Zillow lead', email: 'priya.shah@example.com' },
    ],
  },
  {
    key: 'hollis',
    name: '9 Hollis Way',
    side: 'Buyers',
    status: 'Repair request sent Sunday',
    people: [
      { name: 'Ruth Okafor', role: 'your buyer', email: 'ruth.okafor@example.com' },
      { name: 'David Okafor', role: 'your buyer', email: 'david.okafor@example.com' },
      { name: 'Mark Benton', role: "sellers' agent, Benton Group", email: 'mark.benton@benton.example.com' },
    ],
  },
  {
    key: 'mercer',
    name: '230 Mercer Ave',
    side: 'Your listing',
    status: 'Active listing',
    people: [
      { name: 'Dev Patel', role: 'Zillow lead', email: 'dev.patel@example.com' },
      { name: 'Crestline Condo HOA', role: 'association', email: 'board@crestline.example.com' },
    ],
  },
];

export const ALLOWLIST = [{ email: 'closings@loneoak.example.com', note: 'Lone Oak Title closing desk' }];

export type SampleSource = { key: string; deal: string; kind: string; title: string; meta: string; pageCount: number; pages: SourcePage[] };

const p = (page: number, ...parts: string[]): SourcePage => ({ page, text: parts.join(' ') });

export const SOURCES: SampleSource[] = [
  {
    key: 'linden-inspection', deal: 'linden', kind: 'PDF', title: 'Home inspection report', meta: '412 Linden Ct · Bay Area Inspections · Oct 11', pageCount: 31,
    pages: [
      p(3, 'Roof covering is in serviceable condition with no active leaks observed.', 'Furnace operating normally at the time of inspection.'),
      p(4, 'Deck and porch.', 'Rear deck guardrail is loose at two posts and does not meet height requirements. Recommend repair by a qualified contractor prior to closing.'),
    ],
  },
  {
    key: 'comps-ash', deal: 'ash', kind: 'MLS', title: 'Price comparison for 17 Ash St', meta: 'Similar homes within half a mile · last 30 days', pageCount: 1,
    pages: [p(1, 'Two similar homes within half a mile: price cuts of 3.8% and 4.2% in the last 14 days.', 'Showings at 17 Ash St fell from 9 a week to 3 a week over the last month.')],
  },
  {
    key: 'linden-agreement', deal: 'linden', kind: 'PDF', title: 'Purchase agreement', meta: '412 Linden Ct · signed Sep 18', pageCount: 14,
    pages: [p(2, 'Section 4 · Closing.', '4.1 The parties agree that the sale of the Property described in Section 1 shall be completed through Lone Oak Title, 88 Main St.', 'Closing shall occur on or before October 15, 2026 at the offices of the title company.', '4.2 Buyer shall wire all funds due at closing no later than 12:00 noon on the business day before closing.', '4.3 Possession shall be delivered to Buyer at closing and funding.')],
  },
  {
    key: 'ash-agreement', deal: 'ash', kind: 'PDF', title: 'Purchase agreement', meta: '17 Ash St · signed Oct 3', pageCount: 14,
    pages: [p(3, 'Section 5 · Option period.', '5.1 For nominal consideration, the receipt of which Seller acknowledges, Seller grants Buyer the unrestricted right to terminate this contract during the Option Period.', 'The Option Period ends at 5:00 p.m. on October 14, 2026. Buyer may terminate this contract by notice to Seller before that time.', '5.2 Any request for repairs must be delivered to Seller in writing within the Option Period.')],
  },
  {
    key: 'ash-listing', deal: 'ash', kind: 'MLS', title: 'Listing sheet', meta: '17 Ash St · MLS · updated Oct 9', pageCount: 2,
    pages: [p(1, '17 Ash St · Active.', 'List price $625,000. Listed by Dana Reyes, Reyes Realty.', '3 BR · 2 BA · 1,840 sq ft. Open house Saturday, October 17, 1:00 to 3:00 pm. Showings by appointment with 24 hours notice.', 'Built 1994. Updated kitchen 2021. Two-car garage. Lot 0.18 acres.')],
  },
  {
    key: 'ash-appraisal', deal: 'ash', kind: 'PDF', title: 'Appraisal report', meta: '17 Ash St · Valley Appraisal Group · Oct 10', pageCount: 24,
    pages: [p(2, 'Reconciliation.', 'The subject was compared with three closed sales within 0.6 miles that sold in the last 90 days.', 'Indicated value by sales comparison approach: $612,000. Contract price stated on page 1: $625,000.', 'The cost approach was considered but given little weight given the age of the improvements.')],
  },
  {
    key: 'linden-title', deal: 'linden', kind: 'PDF', title: 'Title commitment', meta: '412 Linden Ct · Lone Oak Title · Schedule C', pageCount: 6,
    pages: [p(3, 'Schedule C · Requirements.', '5. Release of the deed of trust recorded March 4, 2019 in favor of First Coast Bank.', '6. Payoff letter from Linden Court Homeowners Association showing all dues and assessments paid through closing. Not yet received.', "7. Proof of homeowner's insurance for Buyer effective on the closing date.")],
  },
  {
    key: 'marcus-email', deal: 'ash', kind: 'EML', title: 'Email from Marcus Lee', meta: 'Reply to "Showing times for 17 Ash St" · Sun 1:14 pm', pageCount: 1,
    pages: [p(1, 'Hi Dana, thanks for getting back to me so fast.', 'Wednesday at 2:30 works for me. See you there.', 'Marcus')],
  },
  {
    key: 'kim-email', deal: 'linden', kind: 'EML', title: 'Email from Kim Alvarez', meta: 'Northgate Mortgage · today 8:52 am', pageCount: 1,
    pages: [p(1, 'Hi Dana,', 'The appraisal is set for Tuesday at 10 am. The appraiser will call the Parks to confirm access.', 'Kim Alvarez · Northgate Mortgage')],
  },
  {
    key: 'ash-disclosure', deal: 'ash', kind: 'SIG', title: 'DocuSign envelope', meta: 'Seller disclosure, 17 Ash St · checked 6:55 am', pageCount: 1,
    pages: [p(1, 'Sent Friday, October 9 by Dana Reyes.', '2 of 4 signatures complete. Waiting on: Luis Garcia (page 6), Ana Garcia (page 7).')],
  },
  {
    key: 'hollis-inspection', deal: 'hollis', kind: 'PDF', title: 'Home inspection report', meta: '9 Hollis Way · Bay Area Inspections · Oct 9', pageCount: 28,
    pages: [p(12, 'Plumbing · Water heater.', 'Gas water heater, 50 gallons, located in the garage. Strapping present.', 'Water heater is 14 years old and near the end of its service life. Recommend replacement.', 'No active leaks were observed at the time of inspection.')],
  },
  {
    key: 'ash-offer', deal: 'ash', kind: 'PDF', title: 'Offer from the Nguyens', meta: '17 Ash St · received Oct 10', pageCount: 9,
    pages: [p(1, 'Buyers: Linh and Thao Nguyen. Lender: Northgate Mortgage.', 'Purchase price: $625,000. Down payment: 20%. Closing within 21 days of acceptance.', 'Option period: 7 days. Option fee: $500.')],
  },
  {
    key: 'mercer-listing', deal: 'mercer', kind: 'MLS', title: 'Listing sheet', meta: '230 Mercer Ave · MLS · updated Oct 2', pageCount: 2,
    pages: [p(2, '2 BR · 2 BA condominium, 4th floor, 1,120 sq ft.', 'HOA $412/month, includes one deeded parking space, water and trash.', 'Pets allowed with HOA approval.')],
  },
];

export const APPS = [
  { key: 'gcal', name: 'Google Calendar', status: 'problem' as const, description: 'Reads and adds events for showings and closings.' },
  { key: 'gmail', name: 'Gmail', status: 'connected' as const, description: 'Reads new leads, inspection reports and replies. Drafts emails; sends only after you approve.' },
  { key: 'fub', name: 'Follow Up Boss', status: 'connected' as const, description: 'Reads and updates your leads and notes. Never deletes contacts.' },
  { key: 'dotloop', name: 'Dotloop', status: 'connected' as const, description: 'Reads deal documents and dates. Files signed documents into the right loop.' },
  { key: 'zillow', name: 'Zillow Premier Agent', status: 'connected' as const, description: 'Receives new leads the moment they arrive.' },
  { key: 'qb', name: 'QuickBooks', status: 'off' as const, description: 'Would let Ida log commissions and expenses for your accountant.' },
];

export type SampleWorkflow = { key: string; name: string; when: string; does: string; level: 'practice' | 'approve' | 'auto'; apps: string[] };

/** The prototype's "own" level is "auto" here. */
export const WORKFLOWS: SampleWorkflow[] = [
  { key: 'deadlines', name: 'Contract deadlines', when: 'Every morning at 7 am, for each signed contract', does: 'Reads the dates from the signed purchase agreement, reminds the lender, title company and clients, and flags anything at risk.', level: 'auto', apps: ['dotloop', 'gmail'] },
  { key: 'docchase', name: 'Document chase', when: 'When a file is missing a signature, disclosure or letter', does: 'Works out who owes what and follows up until it is in the deal folder.', level: 'auto', apps: ['dotloop', 'gmail'] },
  { key: 'leads', name: 'Lead replies', when: 'When a new lead arrives from Zillow or your website', does: 'Replies within 5 minutes using your listing details, then follows up on day 2 and day 5.', level: 'auto', apps: ['zillow', 'gmail', 'fub'] },
  { key: 'inspection', name: 'Inspection to repair request', when: 'When an inspection report lands in your email', does: 'Summarizes it for your buyers with page references and drafts the repair request for the sellers.', level: 'approve', apps: ['gmail'] },
  { key: 'offers', name: 'Offer comparison', when: 'When one of your listings gets a second offer', does: 'Puts every offer side by side (price, contingencies, financing, closing date) and flags risky terms.', level: 'approve', apps: ['gmail', 'dotloop'] },
  { key: 'showings', name: 'Showing scheduler', when: 'When a buyer asks for a showing', does: 'Finds a time that works for you, the buyer and the listing agent, then books it.', level: 'approve', apps: ['gcal', 'gmail'] },
  { key: 'appraisal', name: 'Appraisal check', when: 'When an appraisal comes in on one of your deals', does: 'Compares it with the contract price and, if it is low, drafts your options for the clients.', level: 'practice', apps: ['dotloop', 'gmail'] },
];

export type SampleTask = { name: string; area: string; wf?: string; ownLevel?: 'yours' | 'approve' | 'auto'; canHand?: boolean; keep?: boolean; note?: string; hours?: number };

export const TASKS: SampleTask[] = [
  { name: 'Reply to new Zillow and website leads within 5 minutes', area: 'Leads', wf: 'leads', note: 'Since Sep 2 · 63 replies', hours: 0.8 },
  { name: 'Track every contract deadline from the signed agreement', area: 'Deals', wf: 'deadlines', note: '4 open deals · dates read from the contracts', hours: 0.6 },
  { name: 'Chase missing signatures, disclosures and letters', area: 'Deals', wf: 'docchase', note: '2 files missing items', hours: 0.7 },
  { name: 'Weekly showing report for each seller', area: 'Listings', ownLevel: 'auto', note: '3 listings · goes out Mondays at 8 am', hours: 0.4 },
  { name: 'File signed documents into the deal folder', area: 'Admin', ownLevel: 'auto', note: 'Since Sep 10', hours: 0.2 },
  { name: 'Summarize inspections for buyers and draft repair requests', area: 'Deals', wf: 'inspection', hours: 0.5 },
  { name: 'Compare offers side by side for sellers', area: 'Deals', wf: 'offers', note: '17 Ash St · 3 offers', hours: 0.3 },
  { name: 'Book showings with buyers and listing agents', area: 'Listings', wf: 'showings', hours: 0.3 },
  { name: 'Spot price cuts nearby and draft price-review notes', area: 'Listings', ownLevel: 'approve', note: '1 waiting', hours: 0.2 },
  { name: 'Prep for listing appointments: comps, property history, talking points', area: 'Leads', ownLevel: 'yours', canHand: true, hours: 0.7 },
  { name: 'Log commissions and expenses for your accountant', area: 'Admin', ownLevel: 'yours', canHand: true, hours: 0.5 },
  { name: 'Check appraisals against the contract price', area: 'Deals', wf: 'appraisal', hours: 0.3 },
  { name: 'Negotiate offers and repairs', area: 'Deals', ownLevel: 'yours', keep: true, note: 'Best kept by you' },
  { name: 'Renew your license and track CE hours', area: 'Admin', ownLevel: 'yours', note: 'License renews in March · 6 of 18 CE hours logged' },
];

export type SampleRule = { key: string; kind: 'ask_first' | 'never' | 'style'; text: string; source: string; locked?: boolean; matchers: RuleMatcher[] };

export const RULES: SampleRule[] = [
  { key: 'r-price', kind: 'ask_first', text: 'Before quoting a price, a fee or a commission', source: 'You added this · Sep 2', matchers: [{ type: 'money' }, { type: 'keywords', any: ['price', 'fee', 'commission'] }] },
  { key: 'r-offer', kind: 'ask_first', text: 'Before sending anything to a seller about an offer', source: 'You added this · Sep 2', matchers: [{ type: 'keywords', any: ['offer', 'offers', 'counteroffer'] }] },
  { key: 'r-sunday', kind: 'ask_first', text: 'Before booking anything on a Sunday', source: 'Learned from your edit · Oct 4', matchers: [{ type: 'keywords', any: ['sunday'] }] },
  { key: 'r-date', kind: 'ask_first', text: 'Before changing any contract date', source: 'You added this · Sep 2', matchers: [{ type: 'keywords', any: ['extend', 'extension', 'new closing date', 'move the closing', 'reschedule closing'] }] },
  { key: 'r-contact', kind: 'ask_first', text: 'Before contacting anyone not already on the deal', source: 'You added this · Sep 2', matchers: [{ type: 'recipients_on_deal' }] },
  { key: 'r-promise', kind: 'never', text: 'Promise a closing date or a timeline', source: 'You added this · Sep 2', matchers: [{ type: 'keywords', any: ['guarantee', 'promise', 'will definitely close', 'will close by'] }] },
  { key: 'r-share', kind: 'never', text: "Share one client's details with another client", source: "Ida's default · always on", locked: true, matchers: [] },
  { key: 'r-sign', kind: 'style', text: 'Sign emails "Dana", not "Dana Reyes, Realtor"', source: 'Learned from 3 of your edits', matchers: [{ type: 'keywords', any: ['realtor'] }] },
  { key: 'r-120', kind: 'style', text: 'Keep client updates under 120 words', source: 'Learned from your edit · Sep 18', matchers: [{ type: 'max_words', max: 120 }] },
  { key: 'r-parks', kind: 'style', text: 'Call the Parks "Jen and Tom"', source: 'Learned from your edit · Oct 1', matchers: [] },
];

export type SampleDecision = {
  wf: string;
  deal: string;
  copy: { kind: 'approve' | 'ask' | 'book'; question: string; primaryLabel: string };
  type: 'send_email' | 'send_invite';
  to: string[];
  cc?: string[];
  extraTo?: { name: string; email: string }[];
  subject: string;
  body: string;
  citations: { source: string; page: number; quote: string; claim: string }[];
};

export const DECISIONS: SampleDecision[] = [
  {
    wf: 'inspection', deal: 'linden', type: 'send_email',
    copy: { kind: 'approve', question: 'Send the inspection summary to the Parks?', primaryLabel: 'Approve and send' },
    to: ['jen.park@example.com', 'tom.park@example.com'],
    subject: 'Inspection results for 412 Linden Ct',
    body: 'Hi Jen and Tom,\n\nThe inspection is back. The roof and furnace look good. The inspector found the back deck railing loose at two posts and recommends repair before closing. I\'ll include it in our repair request to the sellers.\n\nDana',
    citations: [
      { source: 'linden-inspection', page: 3, quote: 'Roof covering is in serviceable condition', claim: 'The roof and furnace look good' },
      { source: 'linden-inspection', page: 4, quote: 'Rear deck guardrail is loose at two posts and does not meet height requirements. Recommend repair by a qualified contractor prior to closing.', claim: 'back deck railing loose at two posts and recommends repair before closing' },
    ],
  },
  {
    wf: 'docchase', deal: 'linden', type: 'send_email',
    copy: { kind: 'ask', question: 'Ask the Linden Court HOA for the payoff letter?', primaryLabel: 'Ask the HOA' },
    to: [],
    extraTo: [{ name: 'Linden Court Homeowners Association', email: 'payoffs@crestview-mgmt.example.com' }],
    cc: ['maya.ruiz@loneoak.example.com'],
    subject: 'Payoff letter for 412 Linden Ct, closing October 15',
    body: 'Hello,\n\nI represent the buyers of 412 Linden Ct, which closes on Thursday, October 15. The title company still needs a payoff letter from the Linden Court HOA showing all dues paid through closing.\n\nCould you send it to Maya Ruiz at Lone Oak Title, copied here, by Wednesday at noon?\n\nThank you,\nDana Reyes · Reyes Realty',
    citations: [
      { source: 'linden-agreement', page: 2, quote: 'Closing shall occur on or before October 15, 2026', claim: 'closing October 15' },
      { source: 'linden-agreement', page: 2, quote: 'Closing shall occur on or before October 15, 2026', claim: 'closes on Thursday, October 15' },
      { source: 'linden-title', page: 3, quote: 'Payoff letter from Linden Court Homeowners Association showing all dues and assessments paid through closing', claim: 'payoff letter from the Linden Court HOA showing all dues paid through closing' },
    ],
  },
  {
    wf: 'showings', deal: 'ash', type: 'send_invite',
    copy: { kind: 'book', question: 'Book a showing for Marcus Lee, Wed 2:30 pm?', primaryLabel: 'Book 2:30 pm' },
    to: ['marcus.lee@example.com'],
    subject: "You're booked for 17 Ash St on Wednesday",
    body: "Hi Marcus,\n\nYou're booked to see 17 Ash St on Wednesday at 2:30 pm. I'll meet you at the front door. Reply here if anything changes.\n\nDana Reyes · Reyes Realty",
    citations: [
      { source: 'marcus-email', page: 1, quote: 'Wednesday at 2:30 works for me.', claim: 'Wednesday at 2:30 pm' },
      { source: 'marcus-email', page: 1, quote: 'Wednesday at 2:30 works for me.', claim: 'on Wednesday' },
    ],
  },
];

/** Past sends shown on the Sent screen. Stored with origin = 'sample_history'. */
export const SENT_HISTORY: { wf: string; deal: string; how: 'approve' | 'auto'; to: string; subject: string; body: string; daysAgo: number; time: string }[] = [
  { wf: 'leads', deal: 'ash', how: 'auto', to: 'Priya Shah', subject: "17 Ash St is available, and there's an open house Saturday", body: "Hi Priya,\n\nThanks for asking about 17 Ash St. It's still available: 3 bedrooms, 2 baths and 1,840 square feet, listed at $625,000. There's an open house Saturday from 1 to 3 pm, or I can show it to you sooner.\n\nDana Reyes · Reyes Realty", daysAgo: 0, time: '09:05' },
  { wf: 'deadlines', deal: 'ash', how: 'auto', to: 'Maya Ruiz, Lone Oak Title · Sam Whitfield', subject: 'Reminder: the 17 Ash St option period ends Wednesday at 5 pm', body: 'Hi Maya and Sam,\n\nA reminder that the option period for 17 Ash St ends Wednesday, October 14 at 5:00 pm. If the buyers plan to ask for repairs, the request needs to reach us before then.\n\nDana Reyes · Reyes Realty', daysAgo: 0, time: '09:05' },
  { wf: 'docchase', deal: 'linden', how: 'auto', to: 'Kim Alvarez, Northgate Mortgage', subject: 'When is the appraisal for 412 Linden Ct?', body: 'Hi Kim,\n\nWe close on 412 Linden Ct on Thursday. Could you confirm when the appraisal is scheduled?\n\nDana Reyes · Reyes Realty', daysAgo: 0, time: '08:40' },
  { wf: 'deadlines', deal: 'linden', how: 'auto', to: 'Jen and Tom Park · Lone Oak Title · Kim Alvarez', subject: 'Calendar invite: Closing, 412 Linden Ct, Thursday 2:00 pm', body: 'Closing for 412 Linden Ct. Please bring a photo ID. Funds should be wired by Wednesday at noon.\n\nThe date comes from the purchase agreement: closing on or before October 15, 2026.', daysAgo: 0, time: '07:00' },
  { wf: 'docchase', deal: 'ash', how: 'auto', to: 'Luis and Ana Garcia', subject: 'Two signatures still needed on the seller disclosure', body: 'Hi Luis and Ana,\n\nThe seller disclosure for 17 Ash St still needs 2 of its 4 signatures, on pages 6 and 7. The link from Friday still works.\n\nDana Reyes · Reyes Realty', daysAgo: 0, time: '07:00' },
  { wf: 'inspection', deal: 'hollis', how: 'approve', to: "Mark Benton, sellers' agent", subject: 'Repair request for 9 Hollis Way', body: "Hi Mark,\n\nAttached is the buyers' repair request for 9 Hollis Way. The main item is the water heater, which is 14 years old and near the end of its life. We're asking for replacement or a $1,800 credit.\n\nDana Reyes · Reyes Realty", daysAgo: 1, time: '18:31' },
  { wf: 'inspection', deal: 'hollis', how: 'approve', to: 'Ruth and David Okafor', subject: 'Inspection results for 9 Hollis Way', body: "Hi Ruth and David,\n\nThe inspection is back and the house is in good shape overall. The one item worth asking about is the water heater, which is 14 years old. I'll ask the sellers to replace it or give a credit.\n\nDana", daysAgo: 1, time: '18:20' },
  { wf: 'docchase', deal: 'ash', how: 'auto', to: 'Maya Ruiz, Lone Oak Title', subject: 'Signed counteroffer for 17 Ash St', body: "Hi Maya,\n\nAttached is the counteroffer for 17 Ash St, signed by all parties on October 11. It's also in the shared deal folder.\n\nDana Reyes · Reyes Realty", daysAgo: 1, time: '16:30' },
  { wf: 'leads', deal: 'ash', how: 'auto', to: 'Marcus Lee', subject: 'Showing times for 17 Ash St', body: 'Hi Marcus,\n\nHappy to show you 17 Ash St. Showings are by appointment with 24 hours notice, so the earliest is Tuesday. Would Wednesday at 2:30 pm work?\n\nDana Reyes · Reyes Realty', daysAgo: 1, time: '11:02' },
  { wf: 'offers', deal: 'ash', how: 'approve', to: 'Luis and Ana Garcia', subject: '3 offers on 17 Ash St, side by side', body: "Hi Luis and Ana,\n\nYou have three offers. The strongest on paper is the Nguyens' at $625,000 with 20% down and a 21-day close. The comparison is attached; let's talk tonight before we respond.\n\nDana", daysAgo: 2, time: '16:05' },
  { wf: 'leads', deal: 'mercer', how: 'auto', to: 'Dev Patel', subject: '230 Mercer Ave: HOA fee and parking', body: 'Hi Dev,\n\nGood questions. The HOA fee is $412 a month and includes one deeded parking space. Street parking is open on weekends. Want to see it this week?\n\nDana Reyes · Reyes Realty', daysAgo: 2, time: '10:15' },
  { wf: 'deadlines', deal: 'linden', how: 'auto', to: 'Jen and Tom Park', subject: 'Your closing week at 412 Linden Ct', body: "Hi Jen and Tom,\n\nHere's what's coming: the appraisal early in the week, the final walk-through Wednesday, and closing on Thursday, October 15. I'll send times as they're confirmed.\n\nDana", daysAgo: 2, time: '08:00' },
];
