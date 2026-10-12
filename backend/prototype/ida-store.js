/* Ida demo store: the sample world for Dana Reyes as data, plus a tiny
   get / update / subscribe store persisted to localStorage.
   Plain JS, no libraries, no network. Every storage access is guarded,
   so the pages still work when storage throws (private mode, blocked). */
(function () {
  'use strict';
  var KEY = 'ida-demo-v5';

  var TICK = '<svg class="ida-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5c2 1.2 3.6 3 4.8 5.2C11.6 12 15.4 7.2 20.5 4.2"/></svg>';

  /* ---------- Source documents (open in the side panel or doc.html) ---------- */
  var DOCS = {
    'linden-inspection': { icon: 'PDF', title: 'Home inspection report', who: '412 Linden Ct · Bay Area Inspections · Oct 11', pages: 31, page: 4, href: 'report.html#cite', embed: 'report.html?embed=1#cite', head: 'Exterior: decks, balconies and railings',
      cite: 'Rear deck guardrail is loose at two posts and does not meet height requirements. Recommend repair by a qualified contractor prior to closing.' },
    'comps-ash': { icon: 'MLS', title: 'Price comparison for 17 Ash St', who: 'Similar homes within half a mile · last 30 days', pages: 1, page: 1, href: 'comps.html#cite', embed: 'comps.html?embed=1#cite', head: 'Two similar homes cut their price',
      cite: 'Both homes cut about 4% ($30,000 and $26,000) and their showings went back up within a week.' },
    'linden-agreement': { icon: 'PDF', title: 'Purchase agreement', who: '412 Linden Ct · signed Sep 18', pages: 14, page: 2, head: 'Section 4 · Closing',
      before: ['4.1 The parties agree that the sale of the Property described in Section 1 shall be completed through Lone Oak Title, 88 Main St.'],
      cite: 'Closing shall occur on or before October 15, 2026 at the offices of the title company.',
      after: ['4.2 Buyer shall wire all funds due at closing no later than 12:00 noon on the business day before closing.', '4.3 Possession shall be delivered to Buyer at closing and funding.'] },
    'ash-agreement': { icon: 'PDF', title: 'Purchase agreement', who: '17 Ash St · signed Oct 3', pages: 14, page: 3, head: 'Section 5 · Option period',
      before: ['5.1 For nominal consideration, the receipt of which Seller acknowledges, Seller grants Buyer the unrestricted right to terminate this contract during the Option Period.'],
      cite: 'The Option Period ends at 5:00 p.m. on October 14, 2026. Buyer may terminate this contract by notice to Seller before that time.',
      after: ['5.2 Any request for repairs must be delivered to Seller in writing within the Option Period.'] },
    'ash-listing': { icon: 'MLS', title: 'Listing sheet', who: '17 Ash St · MLS · updated Oct 9', pages: 2, page: 1, head: '17 Ash St · Active',
      before: ['List price $625,000. Listed by Dana Reyes, Reyes Realty.'],
      cite: '3 BR · 2 BA · 1,840 sq ft. Open house Saturday, October 17, 1:00 to 3:00 pm. Showings by appointment with 24 hours notice.',
      after: ['Built 1994. Updated kitchen 2021. Two-car garage. Lot 0.18 acres.'] },
    'ash-appraisal': { icon: 'PDF', title: 'Appraisal report', who: '17 Ash St · Valley Appraisal Group · Oct 10', pages: 24, page: 2, head: 'Reconciliation',
      before: ['The subject was compared with three closed sales within 0.6 miles that sold in the last 90 days.'],
      cite: 'Indicated value by sales comparison approach: $612,000. Contract price stated on page 1: $625,000.',
      after: ['The cost approach was considered but given little weight given the age of the improvements.'] },
    'linden-title': { icon: 'PDF', title: 'Title commitment', who: '412 Linden Ct · Lone Oak Title · Schedule C', pages: 6, page: 3, head: 'Schedule C · Requirements',
      before: ['5. Release of the deed of trust recorded March 4, 2019 in favor of First Coast Bank.'],
      cite: '6. Payoff letter from Linden Court Homeowners Association showing all dues and assessments paid through closing. Not yet received.',
      after: ['7. Proof of homeowner\'s insurance for Buyer effective on the closing date.'] },
    'marcus-email': { icon: 'EML', title: 'Email from Marcus Lee', who: 'Reply to "Showing times for 17 Ash St" · Sun 1:14 pm', pages: 1, page: 1, head: 'Re: Showing times for 17 Ash St',
      before: ['Hi Dana, thanks for getting back to me so fast.'],
      cite: 'Wednesday at 2:30 works for me. See you there.',
      after: ['Marcus'] },
    'kim-email': { icon: 'EML', title: 'Email from Kim Alvarez', who: 'Northgate Mortgage · today 8:52 am', pages: 1, page: 1, head: 'Re: When is the appraisal for 412 Linden Ct?',
      before: ['Hi Dana,'],
      cite: 'The appraisal is set for Tuesday at 10 am. The appraiser will call the Parks to confirm access.',
      after: ['Kim Alvarez · Northgate Mortgage'] },
    'ash-disclosure': { icon: 'SIG', title: 'DocuSign envelope', who: 'Seller disclosure, 17 Ash St · checked 6:55 am', pages: 1, page: 1, head: 'Envelope status',
      before: ['Sent Friday, October 9 by Dana Reyes.'],
      cite: '2 of 4 signatures complete. Waiting on: Luis Garcia (page 6), Ana Garcia (page 7).', after: [] },
    'ash-counter': { icon: 'SIG', title: 'DocuSign envelope', who: 'Counteroffer 1, 17 Ash St · completed Oct 11, 4:22 pm', pages: 1, page: 1, head: 'Envelope status',
      before: ['Counteroffer 1 to the offer from the Nguyens, 4 pages.'],
      cite: 'Completed: all 4 signatures, October 11, 2026.', after: [] },
    'hollis-inspection': { icon: 'PDF', title: 'Home inspection report', who: '9 Hollis Way · Bay Area Inspections · Oct 9', pages: 28, page: 12, head: 'Plumbing · Water heater',
      before: ['Gas water heater, 50 gallons, located in the garage. Strapping present.'],
      cite: 'Water heater is 14 years old and near the end of its service life. Recommend replacement.', after: ['No active leaks were observed at the time of inspection.'] },
    'ash-offer': { icon: 'PDF', title: 'Offer from the Nguyens', who: '17 Ash St · received Oct 10', pages: 9, page: 1, head: 'Offer summary',
      before: ['Buyers: Linh and Thao Nguyen. Lender: Northgate Mortgage.'],
      cite: 'Purchase price: $625,000. Down payment: 20%. Closing within 21 days of acceptance.', after: ['Option period: 7 days. Option fee: $500.'] },
    'mercer-listing': { icon: 'MLS', title: 'Listing sheet', who: '230 Mercer Ave · MLS · updated Oct 2', pages: 2, page: 2, head: 'HOA and parking',
      before: ['2 BR · 2 BA condominium, 4th floor, 1,120 sq ft.'],
      cite: 'HOA $412/month, includes one deeded parking space, water and trash.', after: ['Pets allowed with HOA approval.'] }
  };

  var DEALS = {
    linden: { name: '412 Linden Ct', side: 'Buyers', people: [['Jen and Tom Park', 'your buyers'], ['Kim Alvarez', 'lender, Northgate Mortgage'], ['Maya Ruiz', 'Lone Oak Title'], ['Rob Chen', 'sellers\' agent, Harbor Realty']], status: 'Closing Thursday, Oct 15 at 2:00 pm' },
    ash: { name: '17 Ash St', side: 'Your listing', people: [['Luis and Ana Garcia', 'your sellers'], ['Sam Whitfield', 'buyers\' agent'], ['Maya Ruiz', 'Lone Oak Title']], status: 'Option period ends Wednesday, Oct 14 at 5:00 pm' },
    hollis: { name: '9 Hollis Way', side: 'Buyers', people: [['Ruth and David Okafor', 'your buyers'], ['Mark Benton', 'sellers\' agent, Benton Group']], status: 'Repair request sent Sunday' },
    mercer: { name: '230 Mercer Ave', side: 'Your listing', people: [['Dev Patel', 'Zillow lead'], ['Crestline Condo HOA', 'association']], status: 'Active listing' }
  };

  /* ---------- The sample world ---------- */
  function seed() {
    return {
      v: 5, rev: 0,
      apps: [
        { id: 'gcal', name: 'Google Calendar', logo: 'GC', status: 'problem', desc: 'Reads and adds events for showings and closings.', problemText: 'Google ended the connection on Oct 11. The showing scheduler is paused until you reconnect.', sync: 'Reconnect takes about 30 seconds',
          access: { see: ['Your calendar events and free/busy times'], do: ['Add showings and closings to your calendar', 'Send calendar invites you approve'], never: ['Delete events you created', 'See other people\'s calendars'] } },
        { id: 'gmail', name: 'Gmail', logo: 'GM', status: 'connected', desc: 'Reads new leads, inspection reports and replies. Drafts emails; sends only after you approve, or on its own for workflows you set to "On its own".', sync: 'Last synced 2 min ago',
          access: { see: ['Emails about your deals, leads and listings', 'Attachments such as inspection and appraisal reports'], do: ['Draft emails in your voice', 'Send emails you approve, or that a workflow sends on its own'], never: ['Delete or archive your email', 'Read personal mail outside your deal contacts'] } },
        { id: 'fub', name: 'Follow Up Boss', logo: 'FB', status: 'connected', desc: 'Reads and updates your leads and notes. Never deletes contacts.', sync: 'Last synced 5 min ago',
          access: { see: ['Leads, contacts and notes'], do: ['Add notes and update lead stages'], never: ['Delete contacts', 'Export your database'] } },
        { id: 'dotloop', name: 'Dotloop', logo: 'DL', status: 'connected', desc: 'Reads deal documents and dates. Files signed documents into the right loop.', sync: 'Last synced 1 hour ago',
          access: { see: ['Loops, documents and contract dates'], do: ['File signed documents into the right loop', 'Request signatures you approve'], never: ['Change contract terms', 'Remove documents'] } },
        { id: 'zillow', name: 'Zillow Premier Agent', logo: 'ZP', status: 'connected', desc: 'Receives new leads the moment they arrive.', sync: 'Last lead 8:14 am',
          access: { see: ['New leads and their messages'], do: ['Mark leads as contacted'], never: ['Change your profile or listings'] } },
        { id: 'qb', name: 'QuickBooks', logo: 'QB', status: 'off', desc: 'Would let Ida log commissions and expenses for your accountant.', sync: 'Ida could take 1 task',
          access: { see: ['Income and expense categories'], do: ['Add commission income and receipts as expenses'], never: ['Pay bills or move money', 'Change past entries'] } }
      ],
      workflows: [
        { id: 'deadlines', name: 'Contract deadlines', when: 'Every morning at 7 am, for each signed contract', does: 'Reads the dates from the signed purchase agreement, reminds the lender, title company and clients, and flags anything at risk.', except: { text: 'Asks you first if a date needs to change', rule: 'r-date' }, level: 'own', apps: ['dotloop', 'gmail'], record: '28 runs · 1 caught and fixed before sending', last: 'Ran 7:00 am', next: 'Tomorrow 7:00 am · morning run for 4 contracts' },
        { id: 'docchase', name: 'Document chase', when: 'When a file is missing a signature, disclosure or letter', does: 'Works out who owes what and follows up until it is in the deal folder.', except: { text: 'Asks you first before contacting anyone not already on the deal', rule: 'r-contact' }, level: 'own', apps: ['dotloop', 'gmail'], record: '41 reminders · 9 documents in', last: 'Ran 8:40 am', next: 'Tomorrow 7:00 am · checks the 2 files still missing items' },
        { id: 'leads', name: 'Lead replies', when: 'When a new lead arrives from Zillow or your website', does: 'Replies within 5 minutes using your listing details, then follows up on day 2 and day 5.', except: { text: 'Asks you first if a lead mentions a price or an offer', rule: 'r-price' }, level: 'own', apps: ['zillow', 'gmail', 'fub'], record: '63 runs · 0 mistakes reached a client', last: 'Ran 9:05 am', next: 'Wed 9:05 am · day 2 follow-up to Priya Shah' },
        { id: 'inspection', name: 'Inspection to repair request', when: 'When an inspection report lands in your email', does: 'Summarizes it for your buyers with page references and drafts the repair request for the sellers.', level: 'approve', apps: ['gmail'], approved: 11, edited: 2, nudge: 'open', last: 'Drafted 7:52 am' },
        { id: 'offers', name: 'Offer comparison', when: 'When one of your listings gets a second offer', does: 'Puts every offer side by side (price, contingencies, financing, closing date) and flags risky terms.', level: 'approve', apps: ['gmail', 'dotloop'], record: '3 comparisons · you approved 3', last: 'Drafted Sat' },
        { id: 'showings', name: 'Showing scheduler', when: 'When a buyer asks for a showing', does: 'Finds a time that works for you, the buyer and the listing agent, then books it.', except: { text: 'Asks you first before booking anything on a Sunday', rule: 'r-sunday' }, level: 'approve', apps: ['gcal', 'gmail'], record: '14 showings booked · you approved 14', last: 'Last ran Fri' },
        { id: 'appraisal', name: 'Appraisal check', when: 'When an appraisal comes in on one of your deals', does: 'Compares it with the contract price and, if it is low, drafts your options for the clients.', level: 'practice', apps: ['dotloop', 'gmail'], last: 'Practice run Sat',
          practice: { need: 5, runs: [
            { deal: '412 Linden Ct', detail: 'Appraisal matched the price', date: 'Sep 28', verdict: 'right' },
            { deal: '9 Hollis Way', detail: 'Low by $4,000', date: 'Oct 4', verdict: 'right' },
            { deal: '17 Ash St', detail: 'Low by $13,000', date: 'Today', verdict: null, current: true }
          ] } }
      ],
      tasks: [
        { id: 't-leads', name: 'Reply to new Zillow and website leads within 5 minutes', area: 'Leads', wf: 'leads', note: 'Since Sep 2 · 63 replies', hours: 0.8 },
        { id: 't-deadlines', name: 'Track every contract deadline from the signed agreement', area: 'Deals', wf: 'deadlines', note: '4 open deals · dates read from the contracts', hours: 0.6 },
        { id: 't-chase', name: 'Chase missing signatures, disclosures and letters', area: 'Deals', wf: 'docchase', note: '2 files missing items', hours: 0.7 },
        { id: 't-report', name: 'Weekly showing report for each seller', area: 'Listings', level: 'own', note: '3 listings · goes out Mondays at 8 am', hours: 0.4 },
        { id: 't-file', name: 'File signed documents into the deal folder', area: 'Admin', level: 'own', note: 'Since Sep 10', hours: 0.2 },
        { id: 't-inspect', name: 'Summarize inspections for buyers and draft repair requests', area: 'Deals', wf: 'inspection', note: '', hours: 0.5 },
        { id: 't-offers', name: 'Compare offers side by side for sellers', area: 'Deals', wf: 'offers', note: '17 Ash St · 3 offers', hours: 0.3 },
        { id: 't-showings', name: 'Book showings with buyers and listing agents', area: 'Listings', wf: 'showings', note: '', hours: 0.3 },
        { id: 't-price', name: 'Spot price cuts nearby and draft price-review notes', area: 'Listings', level: 'approve', note: '1 waiting', hours: 0.2 },
        { id: 't-prep', name: 'Prep for listing appointments: comps, property history, talking points', area: 'Leads', level: 'yours', could: true, hours: 0.7, wfDraft: { name: 'Listing appointment prep', when: 'When a listing appointment is booked on your calendar', apps: ['gcal', 'fub'] } },
        { id: 't-commish', name: 'Log commissions and expenses for your accountant', area: 'Admin', level: 'yours', could: true, needsApp: 'qb', hours: 0.5, wfDraft: { name: 'Commission log', when: 'When a deal closes or a receipt lands in your email', apps: ['qb', 'gmail'] } },
        { id: 't-appraisal', name: 'Check appraisals against the contract price', area: 'Deals', wf: 'appraisal', note: '', hours: 0.3 },
        { id: 't-negotiate', name: 'Negotiate offers and repairs', area: 'Deals', level: 'yours', keep: true, note: 'Best kept by you' },
        { id: 't-license', name: 'Renew your license and track CE hours', area: 'Admin', level: 'yours', note: 'License renews in March · 6 of 18 CE hours logged' }
      ],
      decisions: [
        { id: 'd-inspect', kind: 'approve', wf: 'inspection', deal: 'linden', status: 'open', secs: 60,
          label: 'Approve · 1 min', meta: '412 Linden Ct · Parks family · closing Thursday', q: 'Send the inspection summary to the Parks?',
          tab: 'Inspection summary for Jen and Tom Park', tabSub: '412 Linden Ct · from the Bay Area Inspections report',
          head: [['To', 'Jen and Tom Park'], ['Subject', 'Inspection results for 412 Linden Ct']],
          body: '<p>Hi Jen and Tom,</p><p>The inspection is back. The roof and furnace look good. The inspector found the <span class="ida-marker" data-cite>back deck railing loose at two posts and recommends repair before closing</span>. I\'ll include it in our repair request to the sellers.</p><p>Dana</p>',
          doc: 'linden-inspection', quote: '"<u>Rear deck guardrail is loose at two posts and does not meet height requirements. Recommend repair by a qualified contractor prior to closing.</u>"', srcLabel: 'page 4 of 31', link: 'Open the report at page 4',
          primary: 'Approve and send', fine: 'Nothing goes out until you approve, and you can undo for 10 seconds after.',
          toWho: 'Jen and Tom Park', doneLine: 'Sent the inspection summary for 412 Linden Ct to Jen and Tom Park.',
          sent: { wf: 'inspection', deal: '412 Linden Ct', to: 'Jen and Tom Park', subj: 'Inspection results for 412 Linden Ct', doc: 'linden-inspection', pg: 'page 4', link: 'Open the report at page 4', q: '"<u>Rear deck guardrail is loose at two posts</u> and does not meet height requirements."' } },
        { id: 'd-hoa', kind: 'ask', wf: 'docchase', deal: 'linden', status: 'open', secs: 10, rule: 'r-contact',
          label: 'Ask · 10 sec', meta: '412 Linden Ct · closing Thursday · Lone Oak Title needs it by Wednesday', q: 'Ask the Linden Court HOA for the payoff letter?',
          tab: 'HOA payoff letter missing for Thursday\'s closing', tabSub: '412 Linden Ct · The HOA isn\'t on this deal yet, so Ida asks first (your rule)',
          why: 'The HOA isn\'t on this deal yet, so Ida asks before writing to them. <a href="rules.html#r-contact">Your rule</a>',
          head: [['To', 'Linden Court Homeowners Association, Crestview Management'], ['Cc', 'Maya Ruiz, Lone Oak Title'], ['Subject', 'Payoff letter for 412 Linden Ct, closing October 15']],
          body: '<p>Hello,</p><p>I represent the buyers of 412 Linden Ct, which closes on Thursday, October 15. The title company still needs a <span class="ida-marker" data-cite>payoff letter from the Linden Court HOA showing all dues paid through closing</span>.</p><p>Could you send it to Maya Ruiz at Lone Oak Title, copied here, by Wednesday at noon?</p><p>Thank you,<br>Dana Reyes · Reyes Realty</p>',
          doc: 'linden-title', quote: '"6. <u>Payoff letter from Linden Court Homeowners Association</u> showing all dues and assessments paid through closing. Not yet received."', srcLabel: 'Schedule C, page 3 of 6', link: 'Open the title commitment at page 3',
          primary: 'Ask the HOA', fine: 'Nothing goes out until you approve, and you can undo for 10 seconds after.',
          toWho: 'the Linden Court HOA', doneLine: 'Asked the Linden Court HOA for the payoff letter, copying Lone Oak Title.',
          upcoming: { day: 'Wed', text: 'HOA payoff letter due to Lone Oak Title. Ida follows up at 9 am if it isn\'t in.', short: 'HOA payoff letter due to Lone Oak Title', time: '12:00 pm', doc: 'linden-title' },
          sent: { wf: 'docchase', deal: '412 Linden Ct', to: 'Linden Court HOA · Maya Ruiz', subj: 'Payoff letter for 412 Linden Ct, closing October 15', doc: 'linden-title', pg: 'page 3', link: 'Open the title commitment at page 3', q: '"6. <u>Payoff letter from Linden Court Homeowners Association</u> showing all dues and assessments paid through closing."' } },
        { id: 'd-showing', kind: 'book', wf: 'showings', deal: 'ash', status: 'blocked', blockedBy: 'gcal', secs: 20,
          label: 'Book · 20 sec', meta: '17 Ash St · Marcus Lee, website lead · your listing', q: 'Book a showing for Marcus Lee, Wed 2:30 pm?',
          tab: 'Book a showing for Marcus Lee, Wed 2:30 pm', tabSub: '17 Ash St · your calendar is free 2 to 4 pm',
          why: 'Your calendar is free from 2 to 4 pm Wednesday. Ida tells the Garcias separately so they can be out by 2:15 pm.',
          head: [['To', 'Marcus Lee'], ['Invite', 'Showing: 17 Ash St · Wednesday, October 14 · 2:30 to 3:00 pm'], ['Subject', 'You\'re booked for 17 Ash St on Wednesday']],
          body: '<p>Hi Marcus,</p><p>You\'re booked to see 17 Ash St on <span class="ida-marker" data-cite>Wednesday at 2:30 pm</span>. I\'ll meet you at the front door. Reply here if anything changes.</p><p>Dana Reyes · Reyes Realty</p>',
          doc: 'marcus-email', quote: '"<u>Wednesday at 2:30 works for me.</u> See you there."', srcLabel: 'Sun 1:14 pm', link: 'Open Marcus\'s email',
          primary: 'Book 2:30 pm', fine: 'Nothing goes out until you approve, and you can undo for 10 seconds after.',
          toWho: 'Marcus Lee', doneLine: 'Booked a showing at 17 Ash St for Marcus Lee, Wednesday 2:30 pm, and told the Garcias.',
          upcoming: { day: 'Wed', text: 'Showing at 17 Ash St with Marcus Lee', short: 'Showing at 17 Ash St with Marcus Lee', time: '2:30 pm', doc: 'marcus-email' },
          sent: { wf: 'showings', deal: '17 Ash St', to: 'Marcus Lee', subj: 'Calendar invite: Showing, 17 Ash St, Wednesday 2:30 pm', invite: true, doc: 'marcus-email', pg: 'status', link: 'Open Marcus\'s email', q: '"<u>Wednesday at 2:30 works for me.</u>"' } }
      ],
      insight: { status: 'open' },
      done: [
        { text: 'Reminded the title company and both agents that the 17 Ash St option period ends Wednesday.', time: '9:05 am', src: 'Contract deadlines' },
        { text: 'Chased the Parks\' lender for the appraisal date. It\'s set for Tuesday.', time: '8:40 am', src: 'Document chase' },
        { text: 'Filed the signed counteroffer for 17 Ash St and sent a copy to the title company.', time: 'Sun', src: 'Document chase' }
      ],
      upcoming: [
        { day: 'Tue', text: 'Appraisal at 412 Linden Ct', short: 'Appraisal at 412 Linden Ct', time: '10:00 am', doc: 'kim-email' },
        { day: 'Wed', text: 'Option period ends on 17 Ash St. Repair request is drafted.', short: 'Option period ends on 17 Ash St', time: '5:00 pm', doc: 'ash-agreement' },
        { day: 'Thu', text: 'Closing at 412 Linden Ct', short: 'Closing at 412 Linden Ct', time: '2:00 pm', flag: 'd-hoa', doc: 'linden-agreement' }
      ],
      rules: [
        { id: 'r-price', group: 'ask', text: 'Before quoting a price, a fee or a commission', src: 'You added this · Sep 2', on: true },
        { id: 'r-offer', group: 'ask', text: 'Before sending anything to a seller about an offer', src: 'You added this · Sep 2', on: true },
        { id: 'r-sunday', group: 'ask', text: 'Before booking anything on a Sunday', src: 'Learned from your edit · Oct 4', on: true },
        { id: 'r-date', group: 'ask', text: 'Before changing any contract date', src: 'You added this · Sep 2', on: true },
        { id: 'r-contact', group: 'ask', text: 'Before contacting anyone not already on the deal', src: 'You added this · Sep 2', on: true },
        { id: 'r-promise', group: 'never', text: 'Promise a closing date or a timeline', src: 'You added this · Sep 2', on: true },
        { id: 'r-share', group: 'never', text: 'Share one client\'s details with another client', src: 'Ida\'s default · always on', on: true, locked: true },
        { id: 'r-sign', group: 'write', text: 'Sign emails "Dana", not "Dana Reyes, Realtor"', src: 'Learned from 3 of your edits', on: true },
        { id: 'r-120', group: 'write', text: 'Keep client updates under 120 words', src: 'Learned from your edit · Sep 18', on: true },
        { id: 'r-parks', group: 'write', text: 'Call the Parks "Jen and Tom"', src: 'Learned from your edit · Oct 1', on: true }
      ],
      learn: 'open',
      sent: SENT(),
      onboarding: { step: 2, picks: null, extra: [], apps: {}, verdict: null },
      seq: 1
    };
  }

  function SENT() {
    return [
      { id: 's1', day: 'q', t: 'Wed 9:05 am', wf: 'leads', deal: '17 Ash St', how: 'own', to: 'Priya Shah', subj: 'Any questions about 17 Ash St before Saturday?', state: 'Scheduled', undo: 'Stops it before it goes out.',
        head: [['To', 'Priya Shah (Zillow lead)'], ['Subject', 'Any questions about 17 Ash St before Saturday?'], ['Sends', 'Wednesday 9:05 am · day 2 follow-up']],
        body: '<p>Hi Priya,</p><p>Just checking in on 17 Ash St. If you\'d like to see it before the <span class="ida-marker">open house on Saturday, 1 to 3 pm</span>, I can set up a private showing.</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'ash-listing', pg: 'page 1', q: '<u>Open house Saturday, October 17, 1:00 to 3:00 pm.</u> Showings by appointment with 24 hours notice.', link: 'Open the listing sheet' } },
      { id: 's2', day: 'mon', t: '9:05 am', wf: 'leads', deal: '17 Ash St', how: 'own', to: 'Priya Shah', subj: '17 Ash St is available, and there\'s an open house Saturday', state: 'Delivered · Priya replied',
        head: [['To', 'Priya Shah (Zillow lead)'], ['Subject', '17 Ash St is available, and there\'s an open house Saturday'], ['Sent', 'Today 9:05 am, 3 minutes after the lead came in']],
        body: '<p>Hi Priya,</p><p>Thanks for asking about 17 Ash St. It\'s still available: <span class="ida-marker">3 bedrooms, 2 baths and 1,840 square feet</span>, listed at $625,000. There\'s an open house Saturday from 1 to 3 pm, or I can show it to you sooner.</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'ash-listing', pg: 'page 1', q: '<u>3 BR · 2 BA · 1,840 sq ft.</u> List price $625,000.', link: 'Open the listing sheet' } },
      { id: 's3', day: 'mon', t: '9:05 am', wf: 'deadlines', deal: '17 Ash St', how: 'own', to: 'Maya Ruiz, Lone Oak Title · Sam Whitfield', subj: 'Reminder: the 17 Ash St option period ends Wednesday at 5 pm', state: 'Delivered', open: true,
        head: [['To', 'Maya Ruiz, Lone Oak Title; Sam Whitfield, buyers\' agent'], ['Cc', 'Dana Reyes'], ['Subject', 'Reminder: the 17 Ash St option period ends Wednesday at 5 pm'], ['Sent', 'Today 9:05 am · Contract deadlines, morning run']],
        body: '<p>Hi Maya and Sam,</p><p>A reminder that the <span class="ida-marker">option period for 17 Ash St ends Wednesday, October 14 at 5:00 pm</span>. If the buyers plan to ask for repairs, the request needs to reach us before then.</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'ash-agreement', pg: 'page 3', q: '"<u>The Option Period ends at 5:00 p.m. on October 14, 2026.</u> Buyer may terminate this contract by notice to Seller before that time."', link: 'Open the agreement at page 3' } },
      { id: 's4', day: 'mon', t: '8:40 am', wf: 'docchase', deal: '412 Linden Ct', how: 'own', to: 'Kim Alvarez, Northgate Mortgage', subj: 'When is the appraisal for 412 Linden Ct?', state: 'Delivered · Kim replied',
        head: [['To', 'Kim Alvarez, Northgate Mortgage'], ['Subject', 'When is the appraisal for 412 Linden Ct?'], ['Sent', 'Today 8:40 am']],
        body: '<p>Hi Kim,</p><p>We close on 412 Linden Ct on Thursday. Could you confirm when the appraisal is scheduled?</p><p>Dana Reyes · Reyes Realty</p><p class="muted">Kim replied at 8:52 am: Tuesday at 10 am. Ida added it to your calendar.</p>' },
      { id: 's5', day: 'mon', t: '7:00 am', wf: 'deadlines', deal: '412 Linden Ct', how: 'own', to: 'Jen and Tom Park · Lone Oak Title · Kim Alvarez', subj: 'Calendar invite: Closing, 412 Linden Ct, Thursday 2:00 pm', state: 'Accepted by 3 of 4', undo: 'Removes the invite from all 4 calendars.', invite: true,
        head: [['To', 'Jen and Tom Park; Maya Ruiz, Lone Oak Title; Kim Alvarez, Northgate Mortgage'], ['Invite', 'Closing: 412 Linden Ct · Thursday, October 15 · 2:00 pm · Lone Oak Title, 88 Main St'], ['Sent', 'Today 7:00 am']],
        body: '<p>Closing for 412 Linden Ct. Please bring a photo ID. Funds should be wired by Wednesday at noon.</p><p>The date comes from the purchase agreement: <span class="ida-marker">closing on or before October 15, 2026</span>.</p>',
        src: { doc: 'linden-agreement', pg: 'page 2', q: '"<u>Closing shall occur on or before October 15, 2026</u> at the offices of the title company."', link: 'Open the agreement at page 2' } },
      { id: 's6', day: 'mon', t: '7:00 am', wf: 'docchase', deal: '17 Ash St', how: 'own', to: 'Luis and Ana Garcia', subj: 'Two signatures still needed on the seller disclosure', state: 'Delivered',
        head: [['To', 'Luis and Ana Garcia'], ['Subject', 'Two signatures still needed on the seller disclosure'], ['Sent', 'Today 7:00 am · second reminder']],
        body: '<p>Hi Luis and Ana,</p><p>The seller disclosure for 17 Ash St still needs <span class="ida-marker">2 of its 4 signatures</span>, on pages 6 and 7. The link from Friday still works.</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'ash-disclosure', pg: 'status', q: '<u>2 of 4 signatures complete.</u> Waiting on: Luis Garcia (page 6), Ana Garcia (page 7).', link: 'Open the envelope status' } },
      { id: 's7', day: 'sun', t: '6:31 pm', wf: 'inspection', deal: '9 Hollis Way', how: 'approve', at: '6:31 pm', to: 'Mark Benton, sellers\' agent', subj: 'Repair request for 9 Hollis Way', state: 'Delivered',
        head: [['To', 'Mark Benton, Benton Group'], ['Subject', 'Repair request for 9 Hollis Way'], ['Sent', 'Sunday 6:31 pm · you approved at 6:31 pm']],
        body: '<p>Hi Mark,</p><p>Attached is the buyers\' repair request for 9 Hollis Way. The main item is the <span class="ida-marker">water heater, which is 14 years old and near the end of its life</span>. We\'re asking for replacement or a $1,800 credit.</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'hollis-inspection', pg: 'page 12', q: '"<u>Water heater is 14 years old and near the end of its service life.</u> Recommend replacement."', link: 'Open the report at page 12' } },
      { id: 's8', day: 'sun', t: '6:20 pm', wf: 'inspection', deal: '9 Hollis Way', how: 'approve', at: '6:20 pm', to: 'Ruth and David Okafor', subj: 'Inspection results for 9 Hollis Way', state: 'Delivered',
        head: [['To', 'Ruth and David Okafor'], ['Subject', 'Inspection results for 9 Hollis Way'], ['Sent', 'Sunday 6:20 pm · you approved after editing one line']],
        body: '<p>Hi Ruth and David,</p><p>The inspection is back and the house is in good shape overall. The one item worth asking about is the <span class="ida-marker">water heater, which is 14 years old</span>. I\'ll ask the sellers to replace it or give a credit.</p><p>Dana</p>',
        src: { doc: 'hollis-inspection', pg: 'page 12', q: '"<u>Water heater is 14 years old</u> and near the end of its service life."', link: 'Open the report at page 12' } },
      { id: 's9', day: 'sun', t: '4:30 pm', wf: 'docchase', deal: '17 Ash St', how: 'own', to: 'Maya Ruiz, Lone Oak Title', subj: 'Signed counteroffer for 17 Ash St', state: 'Delivered',
        head: [['To', 'Maya Ruiz, Lone Oak Title'], ['Subject', 'Signed counteroffer for 17 Ash St'], ['Attached', 'Counteroffer 1, signed by all parties (4 pages)'], ['Sent', 'Sunday 4:30 pm']],
        body: '<p>Hi Maya,</p><p>Attached is the counteroffer for 17 Ash St, <span class="ida-marker">signed by all parties on October 11</span>. It\'s also in the shared deal folder.</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'ash-counter', pg: 'status', q: '<u>Completed: all 4 signatures, October 11, 2026.</u>', link: 'Open the envelope status' } },
      { id: 's10', day: 'sun', t: '11:02 am', wf: 'leads', deal: '17 Ash St', how: 'own', to: 'Marcus Lee', subj: 'Showing times for 17 Ash St', state: 'Delivered · Marcus replied',
        head: [['To', 'Marcus Lee (website lead)'], ['Subject', 'Showing times for 17 Ash St'], ['Sent', 'Sunday 11:02 am']],
        body: '<p>Hi Marcus,</p><p>Happy to show you 17 Ash St. <span class="ida-marker">Showings are by appointment with 24 hours notice</span>, so the earliest is Tuesday. Would Wednesday at 2:30 pm work?</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'ash-listing', pg: 'page 1', q: 'Open house Saturday, October 17, 1:00 to 3:00 pm. <u>Showings by appointment with 24 hours notice.</u>', link: 'Open the listing sheet' } },
      { id: 's11', day: 'sat', t: '4:05 pm', wf: 'offers', deal: '17 Ash St', how: 'approve', at: '4:05 pm', to: 'Luis and Ana Garcia', subj: '3 offers on 17 Ash St, side by side', state: 'Delivered',
        head: [['To', 'Luis and Ana Garcia'], ['Subject', '3 offers on 17 Ash St, side by side'], ['Attached', 'Offer comparison (1 page)'], ['Sent', 'Saturday 4:05 pm · you approved at 4:05 pm']],
        body: '<p>Hi Luis and Ana,</p><p>You have three offers. The strongest on paper is the Nguyens\' at <span class="ida-marker">$625,000 with 20% down and a 21-day close</span>. The comparison is attached; let\'s talk tonight before we respond.</p><p>Dana</p>',
        src: { doc: 'ash-offer', pg: 'page 1', q: '"Purchase price: <u>$625,000. Down payment: 20%. Closing within 21 days</u> of acceptance."', link: 'Open the offer at page 1' } },
      { id: 's12', day: 'sat', t: '10:15 am', wf: 'leads', deal: '230 Mercer Ave', how: 'own', to: 'Dev Patel', subj: '230 Mercer Ave: HOA fee and parking', state: 'Delivered',
        head: [['To', 'Dev Patel (Zillow lead)'], ['Subject', '230 Mercer Ave: HOA fee and parking'], ['Sent', 'Saturday 10:15 am']],
        body: '<p>Hi Dev,</p><p>Good questions. The <span class="ida-marker">HOA fee is $412 a month and includes one deeded parking space</span>. Street parking is open on weekends. Want to see it this week?</p><p>Dana Reyes · Reyes Realty</p>',
        src: { doc: 'mercer-listing', pg: 'page 2', q: '<u>HOA $412/month, includes one deeded parking space</u>, water and trash.', link: 'Open the listing sheet' } },
      { id: 's13', day: 'sat', t: '8:00 am', wf: 'deadlines', deal: '412 Linden Ct', how: 'own', to: 'Jen and Tom Park', subj: 'Your closing week at 412 Linden Ct', state: 'Delivered',
        head: [['To', 'Jen and Tom Park'], ['Subject', 'Your closing week at 412 Linden Ct'], ['Sent', 'Saturday 8:00 am']],
        body: '<p>Hi Jen and Tom,</p><p>Here\'s what\'s coming: the appraisal early in the week, the final walk-through Wednesday, and <span class="ida-marker">closing on Thursday, October 15</span>. I\'ll send times as they\'re confirmed.</p><p>Dana</p>',
        src: { doc: 'linden-agreement', pg: 'page 2', q: '"<u>Closing shall occur on or before October 15, 2026</u> at the offices of the title company."', link: 'Open the agreement at page 2' } }
    ];
  }

  /* ---------- Storage (all guarded) ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.v === 5) return s; }
    } catch (e) { /* storage unavailable: run from memory */ }
    return seed();
  }
  function save(s) {
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  var state = load();
  var subs = [];
  function notify() { for (var i = 0; i < subs.length; i++) { try { subs[i](state); } catch (e) { if (window.console) console.error(e); } } }

  var store = {
    get: function () { return state; },
    update: function (fn) { fn(state); state.rev = (state.rev || 0) + 1; save(state); notify(); return state; },
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },
    snapshot: function () { return JSON.stringify(state); },
    restore: function (snap) { state = JSON.parse(snap); state.rev = (state.rev || 0) + 1; save(state); notify(); },
    reset: function () { try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } state = seed(); save(state); notify(); }
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) { state = load(); notify(); } });

  /* ---------- Derived values ---------- */
  var LEVELS = ['practice', 'approve', 'own'];
  var LEVEL_NAME = { practice: 'Practice', approve: 'You approve', own: 'On its own', yours: 'Still yours' };
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function app(id) { return byId(state.apps, id); }
  function wf(id) { return byId(state.workflows, id); }
  function wfByName(n) { for (var i = 0; i < state.workflows.length; i++) if (state.workflows[i].name === n) return state.workflows[i]; return null; }
  function task(id) { return byId(state.tasks, id); }
  function rule(id) { return byId(state.rules, id); }
  function decision(id) { return byId(state.decisions, id); }
  function appsDown(w) { return (w.apps || []).map(app).filter(function (a) { return a && a.status !== 'connected'; }); }
  function wfPause(w) {
    var down = appsDown(w);
    if (down.length) return { by: 'app', app: down[0], text: down[0].name + (down[0].status === 'problem' ? ' disconnected' : ' not connected') };
    if (w.paused) return { by: 'you', text: 'You paused it' };
    return null;
  }
  function taskLevel(t) { if (t.wf) { var w = wf(t.wf); return w ? w.level : 'yours'; } return t.level || 'yours'; }
  function taskCol(t) { var l = taskLevel(t); return l === 'own' ? 'auto' : l === 'approve' ? 'approve' : 'yours'; }
  function canHand(t) { return taskLevel(t) === 'yours' && t.could && !t.keep; }
  function handReady(t) { if (!t.needsApp) return true; var a = app(t.needsApp); return a && a.status === 'connected'; }
  function wfRecord(w) {
    if (w.level === 'practice' && w.practice) { var n = w.practice.runs.length; return n ? n + ' practice draft' + (n === 1 ? '' : 's') + ' · not sent' : 'No practice drafts yet · nothing sent'; }
    if (w.id === 'inspection') return w.approved + ' drafts · you approved ' + w.approved + ', edited ' + w.edited;
    return w.record || '';
  }
  function taskNote(t) {
    var l = taskLevel(t), w = t.wf ? wf(t.wf) : null;
    if (l === 'practice' && w) { var n = w.practice ? w.practice.runs.filter(function (r) { return r.verdict !== undefined; }).length : 0; var pend = w.practice ? w.practice.runs.filter(function (r) { return r.current && !r.verdict; }).length : 0; return 'Ida is practicing · ' + (n === 0 ? '0 drafts yet' : n + ' draft' + (n === 1 ? '' : 's') + (pend ? ' · 1 to compare' : '')); }
    if (w) { var p = wfPause(w); if (p) return { problem: p.by === 'app', text: 'Paused · ' + p.text.charAt(0).toLowerCase() + p.text.slice(1) }; }
    if (t.id === 't-inspect' && w) return w.level === 'own' ? 'Buyer summaries go out on their own · repair requests come to you' : 'You approved ' + w.approved + ' of ' + w.approved;
    if (t.id === 't-price') return state.insight.status === 'sent' ? 'Price review sent to the Garcias today' : '1 waiting';
    return t.note || '';
  }
  function counts() {
    var areas = {}, order = [], off = 0, hours = 0;
    state.tasks.forEach(function (t) {
      if (!areas[t.area]) { areas[t.area] = { auto: 0, approve: 0, practice: 0, yours: 0, total: 0 }; order.push(t.area); }
      var l = taskLevel(t), a = areas[t.area]; a.total++;
      if (l === 'own') { a.auto++; off++; hours += t.hours || 0; } else if (l === 'approve') { a.approve++; off++; hours += t.hours || 0; } else if (l === 'practice') a.practice++; else a.yours++;
    });
    var could = state.tasks.filter(canHand).length;
    var auto = 0, appr = 0; state.tasks.forEach(function (t) { var l = taskLevel(t); if (l === 'own') auto++; else if (l === 'approve') appr++; });
    return { areas: areas, order: ['Leads', 'Deals', 'Listings', 'Admin'].concat(order.filter(function (x) { return ['Leads', 'Deals', 'Listings', 'Admin'].indexOf(x) < 0; })).filter(function (x) { return areas[x]; }), off: off, total: state.tasks.length, hours: Math.round(hours), could: could, auto: auto, approve: appr };
  }
  function problems() { return state.apps.filter(function (a) { return a.status === 'problem'; }); }
  function openDecisions() {
    return state.decisions.filter(function (d) {
      if (d.status === 'blocked') { var a = app(d.blockedBy); if (a && a.status === 'connected') return true; return false; }
      return d.status === 'open';
    });
  }
  function needsYou() { return problems().length + openDecisions().length; }
  function sentCount() { return state.sent.filter(function (e) { return e.day !== 'q' && !e.undone; }).length; }
  function levelDown(l) { return l === 'own' ? 'approve' : l === 'approve' ? 'practice' : null; }
  function deal(key) { return DEALS[key]; }

  /* ---------- Clock (sample world is Monday, Oct 12; times use the real clock) ---------- */
  function nowTime() { var d = new Date(), h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
  function cap(s) { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function nid(p) { state.seq = (state.seq || 1) + 1; return p + '-' + state.seq + '-' + Math.floor(Math.random() * 1e4); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- Actions ---------- */
  var act = {
    connect: function (appId) { store.update(function (s) { var a = byId(s.apps, appId); if (!a) return; a.status = 'connected'; a.sync = 'Connected just now'; if (a.id === 'gcal') a.desc = 'Reads and adds events for showings and closings. The showing scheduler is running again.'; if (a.id === 'qb') a.desc = 'Logs commissions and expenses for your accountant, once you hand Ida that task.'; }); },
    disconnect: function (appId) { store.update(function (s) { var a = byId(s.apps, appId); if (a) { a.status = 'off'; a.sync = 'Disconnected just now'; } }); },
    addApp: function (def) { store.update(function (s) { if (byId(s.apps, def.id)) { byId(s.apps, def.id).status = 'connected'; return; } s.apps.push({ id: def.id, name: def.name, logo: def.logo, status: 'connected', desc: def.desc, sync: 'Connected just now', access: def.access, added: true }); }); },
    approve: function (id, opts) {
      store.update(function (s) {
        var d = byId(s.decisions, id); if (!d) return; d.status = 'done'; d.doneAt = nowTime();
        if (opts && opts.body) { d.body = opts.body; d.edited = true; }
        var dw = d.wf && byId(s.workflows, d.wf); s.done.unshift({ text: d.doneLine, time: nowTime(), dec: id, src: (dw ? dw.name : 'Your request') + ' · you approved' });
        if (d.upcoming) s.upcoming.push(Object.assign({ from: id }, d.upcoming));
        if (d.sent) {
          var e = d.sent;
          s.sent.unshift({ id: 'sent-' + id, day: 'mon', t: nowTime(), wf: e.wf, deal: e.deal, how: 'approve', at: nowTime(), to: e.to, subj: e.subj, state: e.invite ? 'Invite sent' : 'Delivered', invite: !!e.invite, undo: e.invite ? 'Removes the invite from the calendar.' : null, fresh: true,
            head: d.head.concat([['Sent', 'Today ' + nowTime() + ' · you approved' + (d.edited ? ' after editing' : '')]]), body: d.body,
            src: e.doc ? { doc: e.doc, pg: e.pg, q: e.q, link: e.link } : null });
        }
        var w = d.wf && byId(s.workflows, d.wf); if (w && w.id === 'inspection') { w.approved++; if (d.edited) w.edited++; w.last = 'Approved ' + nowTime(); }
      });
    },
    later: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (d) { d.prev = d.status; d.status = 'later'; } }); },
    bringBack: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (d) d.status = 'open'; var i = s.decisions.indexOf(d); s.decisions.splice(i, 1); s.decisions.unshift(d); }); },
    toFront: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (!d) return; s.decisions.splice(s.decisions.indexOf(d), 1); s.decisions.unshift(d); }); },
    saveDraft: function (id, html) { store.update(function (s) { var d = byId(s.decisions, id); if (d) { d.body = html; d.edited = true; } }); },
    addDecision: function (d) { var id; store.update(function (s) { id = d.id = d.id || nid('d'); d.status = d.status || 'open'; s.decisions.push(d); }); return id; },
    insight: function (st) { store.update(function (s) {
      var was = s.insight.status; s.insight.status = st;
      if (st === 'sent' && was !== 'sent') {
        s.done.unshift({ text: 'Sent the price review for 17 Ash St to Luis and Ana Garcia, with the comparison attached.', time: nowTime(), insight: true, src: 'Price review · you approved' });
        s.sent.unshift({ id: 'sent-price', day: 'mon', t: nowTime(), wf: 'price', deal: '17 Ash St', how: 'approve', at: nowTime(), to: 'Luis and Ana Garcia', subj: '17 Ash St: showings and nearby prices', state: 'Delivered', fresh: true,
          head: [['To', 'Luis and Ana Garcia'], ['Subject', '17 Ash St: showings and nearby prices'], ['Attached', 'Price comparison (3 homes)'], ['Sent', 'Today ' + nowTime() + ' · you approved']],
          body: '<p>Hi Luis and Ana,</p><p>Showings at 17 Ash St went from 9 a week to 3 over the last month. In the same weeks, <span class="ida-marker">two similar homes within half a mile cut their price by about 4%</span>, and both picked up showings again. I\'ve attached the comparison.</p><p>Could we talk this week about whether to adjust the price? I have time Wednesday or Thursday afternoon.</p><p>Dana</p>',
          src: { doc: 'comps-ash', pg: 'status', q: 'Two similar homes within half a mile: <u>price cuts of 3.8% and 4.2%</u> in the last 14 days.', link: 'Open the price comparison' } });
      }
    }); },
    addTask: function (o) {
      var id;
      store.update(function (s) {
        id = nid('t');
        var t = { id: id, name: cap(o.name), area: o.area || 'Admin', level: 'yours', could: true, hours: 0.3, note: 'You added this · just now', added: true };
        s.tasks.push(t);
        if (o.who === 'ida') handIn(s, t);
      });
      return id;
    },
    hand: function (taskId) { store.update(function (s) { var t = byId(s.tasks, taskId); if (t) handIn(s, t); }); },
    takeBack: function (taskId) { store.update(function (s) { var t = byId(s.tasks, taskId); if (!t || !t.wf) return; var w = byId(s.workflows, t.wf); if (w && w.created) s.workflows.splice(s.workflows.indexOf(w), 1); delete t.wf; t.level = 'yours'; }); },
    setLevel: function (wfId, level) { store.update(function (s) { var w = byId(s.workflows, wfId); if (!w) return; w.level = level; if (level !== 'own' && w.nudge === 'accepted') w.nudge = 'open'; if (level === 'practice' && !w.practice) w.practice = { need: 5, runs: [] }; }); },
    pause: function (wfId, on) { store.update(function (s) { var w = byId(s.workflows, wfId); if (w) w.paused = !!on; }); },
    nudge: function (wfId, accept) { store.update(function (s) { var w = byId(s.workflows, wfId); if (!w) return; if (accept) { w.nudge = 'accepted'; w.level = 'own'; } else { w.nudge = 'open'; w.level = 'approve'; } }); },
    addRule: function (r) { var id; store.update(function (s) { id = nid('r'); s.rules.push({ id: id, group: r.group, text: cap(r.text), src: r.src || 'You added this · just now', on: true, fresh: true }); }); return id; },
    editRule: function (id, text) { store.update(function (s) { var r = byId(s.rules, id); if (r && text.trim()) { r.text = cap(text); r.src = 'You edited this · just now'; } }); },
    toggleRule: function (id, on) { store.update(function (s) { var r = byId(s.rules, id); if (r && !r.locked) r.on = !!on; }); },
    learn: function (accept) { store.update(function (s) { s.learn = accept ? 'done' : 'dismissed'; if (accept) s.rules.push({ id: 'r-subject', group: 'write', text: 'Put the property address in the subject line', src: 'Learned from 4 of your edits · just now', on: true, fresh: true }); }); },
    sentUndo: function (id) { store.update(function (s) { var e = byId(s.sent, id); if (e) e.undone = true; if (id === 'sent-d-showing') s.upcoming = s.upcoming.filter(function (u) { return u.from !== 'd-showing'; }); }); },
    sentWrong: function (id, reason) { store.update(function (s) { var e = byId(s.sent, id); if (!e) return; var w = byId(s.workflows, e.wf); if (!w) return; var to = levelDown(w.level); if (!to) return; e.wrong = { from: w.level, to: to, reason: reason || '' }; w.level = to; if (to === 'practice' && !w.practice) w.practice = { need: 5, runs: [] }; if (w.nudge === 'accepted') w.nudge = 'open'; }); },
    sentUnwrong: function (id) { store.update(function (s) { var e = byId(s.sent, id); if (!e || !e.wrong) return; var w = byId(s.workflows, e.wf); if (w) w.level = e.wrong.from; delete e.wrong; }); },
    verdict: function (wfId, v, reasons) { store.update(function (s) { var w = byId(s.workflows, wfId); if (!w || !w.practice) return; var r = w.practice.runs.filter(function (x) { return x.current; })[0]; if (!r) return; r.verdict = v; r.reasons = reasons || null; }); },
    onboarding: function (fn) { store.update(function (s) { fn(s.onboarding); }); }
  };

  function handIn(s, t) {
    var d = t.wfDraft || {};
    var name = d.name || shortName(t.name);
    var w = { id: nid('wf'), name: name, when: d.when || 'When this comes up on one of your deals', does: 'Drafts it privately: ' + t.name.charAt(0).toLowerCase() + t.name.slice(1) + '. Nothing is sent while it practices.', level: 'practice', apps: d.apps || [], last: 'Starts on the next one', created: true, task: t.id, practice: { need: 5, runs: [] } };
    s.workflows.push(w);
    t.wf = w.id; delete t.level;
  }
  function shortName(n) { var x = n.split(/[:,.]/)[0].split(' '); return cap(x.slice(0, 5).join(' ')); }

  /* ---------- Plain-language parsing for the ask field and Add rule ---------- */
  function you(s) { return s.replace(/\bmy\b/gi, 'your').replace(/\bme\b/gi, 'you').replace(/\bI\b/g, 'you'); }
  var WRITE_RX = /\b(sign|subject|word|words|tone|greet|greeting|formal|casual|short|shorter|emoji|call (the|them)|write|wording|address them|first name)\b/i;
  function parseRule(text) {
    var t = String(text || '').trim().replace(/[.!]+$/, ''); var m;
    if (!t) return null;
    if ((m = t.match(/^(?:please\s+)?(?:always\s+)?(?:ask|check with|run it by) me(?: first)?,?\s+(before|when|if)\s+(.+)$/i))) return { group: 'ask', text: cap(m[1].toLowerCase() + ' ' + you(m[2])) };
    if ((m = t.match(/^(before|when|if)\s+(.+?),?\s+(?:always\s+)?(?:ask|check with) me(?: first)?$/i))) return { group: 'ask', text: cap(m[1].toLowerCase() + ' ' + you(m[2])) };
    if ((m = t.match(/^(?:never|don't|dont|do not|stop)\s+(.+)$/i))) return { group: 'never', text: cap(you(m[1])) };
    if ((m = t.match(/^always\s+(.+)$/i))) return { group: WRITE_RX.test(m[1]) ? 'write' : 'always', text: cap(you(m[1])) };
    if ((m = t.match(/^only\s+(.+)$/i))) return { group: 'always', text: cap('only ' + you(m[1])) };
    if ((m = t.match(/^(?:please\s+)?(sign|keep|use|call|write)\s+(.+)$/i)) && WRITE_RX.test(t)) return { group: 'write', text: cap(you(t)) };
    return null;
  }
  var GROUPS = { ask: 'Always ask me first', never: 'Never', write: 'How you write', always: 'Always' };
  function ruleMeaning(r) {
    var low = r.text.charAt(0).toLowerCase() + r.text.slice(1);
    if (r.group === 'ask') return 'Ida stops and asks you ' + low + '.';
    if (r.group === 'never') return 'Ida will never ' + low + ', on any task.';
    if (r.group === 'write') return 'Ida writes every draft this way: ' + low + '.';
    return 'Ida will always ' + low + '.';
  }
  function guessArea(t) { if (/lead|zillow|website/i.test(t)) return 'Leads'; if (/listing|showing|open house|photo|price review|seller/i.test(t)) return 'Listings'; if (/deal|closing|inspection|apprais|hoa|lender|title|escrow|contract|repair|offer/i.test(t)) return 'Deals'; return 'Admin'; }
  var PEOPLE = [
    [/\bkim\b|lender/i, 'Kim Alvarez', 'Northgate Mortgage', 'Kim', 'linden'], [/\bmaya\b|title company|lone oak/i, 'Maya Ruiz', 'Lone Oak Title', 'Maya', 'linden'],
    [/\bparks?\b|\bjen\b|\btom\b/i, 'Jen and Tom Park', '', 'Jen and Tom', 'linden'], [/garcia|\bluis\b|\bana\b/i, 'Luis and Ana Garcia', '', 'Luis and Ana', 'ash'],
    [/\bsam\b|whitfield/i, 'Sam Whitfield', 'buyers\' agent', 'Sam', 'ash'], [/marcus/i, 'Marcus Lee', '', 'Marcus', 'ash'], [/priya/i, 'Priya Shah', '', 'Priya', 'ash'],
    [/\bdev\b|patel/i, 'Dev Patel', '', 'Dev', 'mercer'], [/\bmark\b|benton/i, 'Mark Benton', 'Benton Group', 'Mark', 'hollis'], [/okafor|\bruth\b|\bdavid\b/i, 'Ruth and David Okafor', '', 'Ruth and David', 'hollis'],
    [/\brob\b|harbor realty/i, 'Rob Chen', 'Harbor Realty', 'Rob', 'linden']
  ];
  function findPerson(t) { for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i][0].test(t)) return { name: PEOPLE[i][1], org: PEOPLE[i][2], hi: PEOPLE[i][3], deal: PEOPLE[i][4] }; return null; }
  function findDeal(t) { if (/linden|412/i.test(t)) return 'linden'; if (/\bash\b|17 ash/i.test(t)) return 'ash'; if (/hollis/i.test(t)) return 'hollis'; if (/mercer/i.test(t)) return 'mercer'; var p = findPerson(t); return p ? p.deal : null; }
  function parseTask(text) {
    var t = String(text || '').trim().replace(/[.!]+$/, '');
    if (!/^(please\s+)?(remind|send|follow up|follow-up|email|text|call|schedule|book|draft|chase|ask|order|set up|prepare|prep|update|file|log|check|get|make sure)\b/i.test(t)) return null;
    var p = findPerson(t), draftable = !!p && /^(please\s+)?(send|follow up|follow-up|email|chase|ask|check)/i.test(t) && !/remind me/i.test(t);
    var about = (t.match(/\b(?:about|on|regarding|for)\s+(.+)$/i) || [])[1];
    return { name: cap(you(t.replace(/^please\s+/i, ''))), area: guessArea(t), person: draftable ? p : null, about: about ? you(about) : null };
  }

  window.Ida = window.Ida || {};
  Object.assign(window.Ida, {
    store: store, DOCS: DOCS, DEALS: DEALS, TICK: TICK, LEVELS: LEVELS, LEVEL_NAME: LEVEL_NAME, GROUPS: GROUPS,
    q: { app: app, wf: wf, wfByName: wfByName, task: task, rule: rule, decision: decision, wfPause: wfPause, taskLevel: taskLevel, taskCol: taskCol, canHand: canHand, handReady: handReady, wfRecord: wfRecord, taskNote: taskNote, counts: counts, problems: problems, openDecisions: openDecisions, needsYou: needsYou, sentCount: sentCount, levelDown: levelDown, deal: deal, findDeal: findDeal, findPerson: findPerson },
    act: act,
    parse: { rule: parseRule, ruleMeaning: ruleMeaning, task: parseTask, guessArea: guessArea },
    util: { esc: esc, cap: cap, nowTime: nowTime }
  });
})();
