/* Ida demo store: the sample world for Dana Reyes as data, plus a tiny
   get / update / subscribe store persisted to localStorage.
   Plain JS, no libraries, no network. Every storage access is guarded,
   so the pages still work when storage throws (private mode, blocked). */
(function () {
  'use strict';
  var KEY = 'ida-demo-v8';
  /* The copy under every approve / choose button says exactly what happens after you press it. */
  var SEND_RULE = 'Nothing goes out until you approve. Then it waits 10 seconds, shown on every page as "Sending in N s · Undo", and only then goes out and moves to Sent.';
  var CHOOSE_RULE = 'Nothing goes out until you choose. Then it waits 10 seconds, shown on every page as "Sending in N s · Undo", and only then goes out and moves to Sent.';

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
      v: 8, rev: 0,
      apps: [
        { id: 'gcal', name: 'Google Calendar', logo: 'GC', status: 'problem', desc: 'Reads and adds events for showings and closings.', problemText: 'Google ended the connection on Oct 11. The showing scheduler is paused until you reconnect.', sync: 'Reconnect takes about 30 seconds',
          access: { see: ['Your calendar events and free/busy times'], do: ['Add showings and closings to your calendar', 'Send calendar invites you approve'], never: ['Delete events you created', 'See other people\'s calendars'] } },
        { id: 'gmail', name: 'Gmail', logo: 'GM', status: 'connected', desc: 'Reads new leads, inspection reports and replies. Drafts emails; sends only after you approve, or on its own for workflows you set to "On its own".', sync: 'Last synced 2 min ago',
          access: { see: ['Emails about your deals, leads and listings', 'Attachments such as inspection and appraisal reports'], do: ['Draft emails in your voice', 'Send emails you approve, or that a workflow sends on its own'], never: ['Delete or archive your email', 'Read personal mail outside your deal contacts'] } },
        { id: 'fub', name: 'Follow Up Boss', logo: 'FB', status: 'connected', desc: 'Your CRM. Ida reads contacts and conversation history, and writes Ida\'s notes and messages back to each contact. Contact details are edited in Follow Up Boss, not in Ida.', sync: 'Last synced 2 min ago',
          access: { see: ['Contacts, stages, phone numbers and emails', 'Conversation history with each contact'], do: ['Write Ida\'s notes and messages back to the contact', 'Log calls and texts Ida sends for you'], never: ['Edit contact details or stages', 'Delete or merge contacts', 'Export your database'] } },
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
        { id: 't-leads', pb: 'pb-lead', name: 'Reply to new Zillow and website leads within 5 minutes', area: 'Leads', wf: 'leads', note: 'Since Sep 2 · 63 replies', hours: 0.8 },
        { id: 't-deadlines', pb: 'pb-buyer', name: 'Track every contract deadline from the signed agreement', area: 'Deals', wf: 'deadlines', note: '4 open deals · dates read from the contracts', hours: 0.6 },
        { id: 't-chase', pb: 'pb-buyer', name: 'Chase missing signatures, disclosures and letters', area: 'Deals', wf: 'docchase', note: '2 files missing items', hours: 0.7 },
        { id: 't-report', pb: 'pb-seller', name: 'Weekly showing report for each seller', area: 'Listings', level: 'own', note: '3 listings · goes out Mondays at 8 am', hours: 0.4 },
        { id: 't-file', name: 'File signed documents into the deal folder', area: 'Admin', level: 'own', note: 'Since Sep 10', hours: 0.2 },
        { id: 't-inspect', pb: 'pb-buyer', name: 'Summarize inspections for buyers and draft repair requests', area: 'Deals', wf: 'inspection', note: '', hours: 0.5 },
        { id: 't-offers', pb: 'pb-seller', name: 'Compare offers side by side for sellers', area: 'Deals', wf: 'offers', note: '17 Ash St · 3 offers', hours: 0.3 },
        { id: 't-showings', pb: 'pb-lead', name: 'Book showings with buyers and listing agents', area: 'Listings', wf: 'showings', note: '', hours: 0.3 },
        { id: 't-price', pb: 'pb-seller', name: 'Spot price cuts nearby and draft price-review notes', area: 'Listings', level: 'approve', note: '1 waiting', hours: 0.2 },
        { id: 't-prep', name: 'Prep for listing appointments: comps, property history, talking points', area: 'Leads', level: 'yours', could: true, hours: 0.7, wfDraft: { name: 'Listing appointment prep', when: 'When a listing appointment is booked on your calendar', apps: ['gcal', 'fub'] } },
        { id: 't-commish', name: 'Log commissions and expenses for your accountant', area: 'Admin', level: 'yours', could: true, needsApp: 'qb', hours: 0.5, wfDraft: { name: 'Commission log', when: 'When a deal closes or a receipt lands in your email', apps: ['qb', 'gmail'] } },
        { id: 't-appraisal', pb: 'pb-buyer', name: 'Check appraisals against the contract price', area: 'Deals', wf: 'appraisal', note: '', hours: 0.3 },
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
          primary: 'Approve and send', fine: SEND_RULE,
          toWho: 'Jen and Tom Park', doneLine: 'Sent the inspection summary for 412 Linden Ct to Jen and Tom Park.', person: 'p-parks',
          situation: 'The inspection report for 412 Linden Ct came in this morning. One item matters before Thursday\'s closing: the back deck railing.',
          recommend: 'Send the summary as drafted. It quotes the report and promises nothing about the sellers\' answer.',
          next: 'Ida emails the Parks 10 seconds after you approve and logs it in Sent. If they reply with questions, Ida answers from the report or brings it to you.',
          sent: { wf: 'inspection', deal: '412 Linden Ct', to: 'Jen and Tom Park', subj: 'Inspection results for 412 Linden Ct', doc: 'linden-inspection', pg: 'page 4', link: 'Open the report at page 4', q: '"<u>Rear deck guardrail is loose at two posts</u> and does not meet height requirements."' } },
        { id: 'd-hoa', kind: 'ask', wf: 'docchase', deal: 'linden', status: 'open', secs: 10, rule: 'r-contact',
          label: 'Ask · 10 sec', meta: '412 Linden Ct · closing Thursday · Lone Oak Title needs it by Wednesday', q: 'Ask the Linden Court HOA for the payoff letter?',
          tab: 'HOA payoff letter missing for Thursday\'s closing', tabSub: '412 Linden Ct · The HOA isn\'t on this deal yet, so Ida asks first (your rule)',
          why: 'The HOA isn\'t on this deal yet, so Ida asks before writing to them. <a href="rules.html#r-contact">Your rule</a>',
          head: [['To', 'Linden Court Homeowners Association, Crestview Management'], ['Cc', 'Maya Ruiz, Lone Oak Title'], ['Subject', 'Payoff letter for 412 Linden Ct, closing October 15']],
          body: '<p>Hello,</p><p>I represent the buyers of 412 Linden Ct, which closes on Thursday, October 15. The title company still needs a <span class="ida-marker" data-cite>payoff letter from the Linden Court HOA showing all dues paid through closing</span>.</p><p>Could you send it to Maya Ruiz at Lone Oak Title, copied here, by Wednesday at noon?</p><p>Thank you,<br>Dana Reyes · Reyes Realty</p>',
          doc: 'linden-title', quote: '"6. <u>Payoff letter from Linden Court Homeowners Association</u> showing all dues and assessments paid through closing. Not yet received."', srcLabel: 'Schedule C, page 3 of 6', link: 'Open the title commitment at page 3',
          primary: 'Ask the HOA', fine: SEND_RULE,
          toWho: 'the Linden Court HOA', person: 'p-parks', pb: 'pb-buyer',
          situation: 'Lone Oak Title still lists the HOA payoff letter as missing, and closing is Thursday. The HOA isn\'t on this deal yet.',
          recommend: 'Ask the HOA now. Title needs the letter by Wednesday.',
          next: 'Ida emails the HOA, copying Maya Ruiz at Lone Oak Title. If the letter isn\'t in by Wednesday 9 am, Ida follows up and tells you.',
          doneLine: 'Asked the Linden Court HOA for the payoff letter, copying Lone Oak Title.',
          upcoming: { day: 'Wed', text: 'HOA payoff letter due to Lone Oak Title. Ida follows up at 9 am if it isn\'t in.', short: 'HOA payoff letter due to Lone Oak Title', time: '12:00 pm', doc: 'linden-title' },
          sent: { wf: 'docchase', deal: '412 Linden Ct', to: 'Linden Court HOA · Maya Ruiz', subj: 'Payoff letter for 412 Linden Ct, closing October 15', doc: 'linden-title', pg: 'page 3', link: 'Open the title commitment at page 3', q: '"6. <u>Payoff letter from Linden Court Homeowners Association</u> showing all dues and assessments paid through closing."' } },
        { id: 'd-maya', kind: 'choice', person: 'p-maya', pb: 'pb-lead', ev: 'outside', deal: 'mercer', status: 'open', secs: 20, head: [],
          label: 'Decide · 20 sec', meta: 'Open-house lead · 230 Mercer Ave · met Sunday', q: 'Maya Chen wants Thursday 6 pm, outside your usual hours',
          tab: 'Maya Chen wants Thursday 6 pm, outside your usual hours', tabSub: 'Open-house lead · Ida offers consultations 9 am to 5 pm',
          situation: 'Maya works until 5:30 pm and asked for a consultation on Thursday at 6:00 pm. Your consultation hours end at 5 pm, so Ida didn\'t book it. Ida told her you\'d answer by this morning.',
          quoteFrom: 'Maya\'s text, Sun 8:14 pm', said: 'Any chance Thursday at 6? I work until 5:30.',
          recommend: 'Offer Friday at 5:00 pm. It is the latest time inside your hours, and Thursday already has the Linden closing at 2 pm and Sarah Kim at 3 pm.',
          options: [
            { opt: 'offer', label: 'Offer Friday 5 pm', rec: true, next: 'Ida texts Maya the Friday 5:00 pm time now. If she takes it, Ida books it and adds it to This week. If she can\'t, it comes back to you.' },
            { opt: 'allow', label: 'Allow Thursday 6 pm', next: 'Ida books Thursday at 6:00 pm, adds it to your calendar and confirms with Maya by text.' },
            { opt: 'takeover', label: 'Take over', next: 'Ida pauses every message to Maya and you reply yourself.' }
          ] },
        { id: 'd-sarah', kind: 'choice', person: 'p-sarah', pb: 'pb-lead', ev: 'outside', deal: 'mercer', status: 'open', secs: 30, head: [],
          label: 'Needs you · outside Ida\'s authority', meta: 'Buyer lead · consultation Thursday 3 pm', q: 'Sarah asked whether you\'d lower your commission',
          tab: 'Sarah asked whether you\'d lower your commission', tabSub: 'Buyer lead · needs you, Ida never discusses fees',
          situation: 'Sarah Kim, who meets you Thursday at 3 pm, emailed this morning. Ida never discusses fees, so it told her you would get back to her before Thursday.',
          why: 'Your rule: <a href="rules.html#r-price">ask before quoting a price, a fee or a commission</a>.',
          quoteFrom: 'Sarah\'s email, Mon 9:02 am', said: 'Would Dana lower her commission if we find something fast?',
          recommend: 'Answer it yourself, by phone, before Thursday. Ida can tell her to expect your call today.',
          options: [
            { opt: 'call', label: 'Tell her I\'ll call today', rec: true, next: 'Ida emails Sarah that you\'ll call her today and adds the call to This week. Ida says nothing about the commission itself.' },
            { opt: 'meeting', label: 'Cover it Thursday', next: 'Ida tells Sarah you\'ll cover it at Thursday\'s consultation and adds it to your notes for that meeting.' },
            { opt: 'takeover', label: 'Take over', next: 'Ida pauses every message to Sarah. You handle the reply and the consultation.' }
          ] },
        { id: 'd-showing', kind: 'book', wf: 'showings', deal: 'ash', status: 'blocked', blockedBy: 'gcal', secs: 20,
          label: 'Book · 20 sec', meta: '17 Ash St · Marcus Lee, website lead · your listing', q: 'Book a showing for Marcus Lee, Wed 2:30 pm?',
          tab: 'Book a showing for Marcus Lee, Wed 2:30 pm', tabSub: '17 Ash St · your calendar is free 2 to 4 pm',
          why: 'Your calendar is free from 2 to 4 pm Wednesday. Ida tells the Garcias separately so they can be out by 2:15 pm.',
          head: [['To', 'Marcus Lee'], ['Invite', 'Showing: 17 Ash St · Wednesday, October 14 · 2:30 to 3:00 pm'], ['Subject', 'You\'re booked for 17 Ash St on Wednesday']],
          body: '<p>Hi Marcus,</p><p>You\'re booked to see 17 Ash St on <span class="ida-marker" data-cite>Wednesday at 2:30 pm</span>. I\'ll meet you at the front door. Reply here if anything changes.</p><p>Dana Reyes · Reyes Realty</p>',
          doc: 'marcus-email', quote: '"<u>Wednesday at 2:30 works for me.</u> See you there."', srcLabel: 'Sun 1:14 pm', link: 'Open Marcus\'s email',
          primary: 'Book 2:30 pm', fine: SEND_RULE,
          toWho: 'Marcus Lee', person: 'p-marcus',
          next: 'Ida sends Marcus the invite and tells the Garcias to be out by 2:15 pm.',
          doneLine: 'Booked a showing at 17 Ash St for Marcus Lee, Wednesday 2:30 pm, and told the Garcias.',
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
        { day: 'Thu', text: 'Closing at 412 Linden Ct', short: 'Closing at 412 Linden Ct', time: '2:00 pm', flag: 'd-hoa', doc: 'linden-agreement' },
        { id: 'up-ravi', day: 'Wed', text: 'Buyer consultation with Ravi Mehta at the office', short: 'Consultation with Ravi Mehta', time: '11:00 am', person: 'p-ravi' },
        { id: 'up-sarah', day: 'Thu', text: 'Buyer consultation with Sarah Kim at the office', short: 'Consultation with Sarah Kim', time: '3:00 pm', person: 'p-sarah' }
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
      people: PEOPLE0(), playbooks: PLAYBOOKS0(), events: EVENTS0(), changes: [], blocked: [], outbox: [],
      notify: { booked: 'brief', pref: 'brief', later: 'brief', reply: 'log', asks: 'now', complaint: 'now', outside: 'now', urgent: 'now' },
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
      { id: 's14', day: 'mon', t: '8:30 am', wf: null, pb: 'pb-lead', ch: 'email', deal: '230 Mercer Ave', how: 'own', to: 'Sarah Kim', subj: 'Your consultation with Dana, Thursday 3:00 pm', state: 'Delivered · Sarah replied',
        head: [['To', 'Sarah Kim (open-house lead)'], ['Subject', 'Your consultation with Dana, Thursday 3:00 pm'], ['Sent', 'Today 8:30 am · open-house follow-up']],
        body: '<p>Hi Sarah,</p><p>You\'re booked for Thursday, October 15 at 3:00 pm at the Reyes Realty office, 140 Grand St. Bring your pre-approval letter if it\'s handy.</p><p>Dana</p>' },
      { id: 's15', day: 'sun', t: '6:12 pm', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Sarah Kim', subj: 'Text: thanks for coming to 230 Mercer Ave', state: 'Delivered · Sarah replied',
        head: [['To', 'Sarah Kim (text, opted in Sunday)'], ['Sent', 'Sunday 6:12 pm · open-house follow-up, day 1']],
        body: '<p>Hi Sarah, it\'s Dana from Reyes Realty. Thanks for stopping by 230 Mercer Ave today. Would a short buyer consultation this week help?</p>' },
      { id: 's16', day: 'sun', t: '6:10 pm', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Maya Chen', subj: 'Text: thanks for coming to 230 Mercer Ave', state: 'Delivered · Maya replied',
        head: [['To', 'Maya Chen (text, opted in Sunday)'], ['Sent', 'Sunday 6:10 pm · open-house follow-up, day 1']],
        body: '<p>Hi Maya, it\'s Dana from Reyes Realty. Thanks for coming to 230 Mercer Ave today. The <span class="ida-marker">HOA fee is $412 a month and includes one deeded parking space</span>. Would a short buyer consultation this week help?</p>',
        src: { doc: 'mercer-listing', pg: 'page 2', q: '<u>HOA $412/month, includes one deeded parking space</u>, water and trash.', link: 'Open the listing sheet' } },
      { id: 's17', day: 'sun', t: '7:44 pm', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Sarah Kim', subj: 'Text: consultation times', state: 'Delivered · Sarah replied',
        head: [['To', 'Sarah Kim (text, opted in Sunday)'], ['Sent', 'Sunday 7:44 pm · open-house follow-up']],
        body: '<p>Great. I have Thursday at 3:00 pm or Friday at 10:00 am. Which works for you?</p>' },
      { id: 's18', day: 'mon', t: '9:05 am', wf: null, pb: 'pb-lead', ch: 'email', deal: '230 Mercer Ave', how: 'own', to: 'Sarah Kim', subj: 'Re: Your consultation with Dana, Thursday 3:00 pm', state: 'Delivered',
        head: [['To', 'Sarah Kim (open-house lead)'], ['Subject', 'Re: Your consultation with Dana, Thursday 3:00 pm'], ['Sent', 'Today 9:05 am · Ida never discusses fees, so it told her you would answer']],
        body: '<p>Good question. I\'ll get back to you on that before Thursday.</p><p>Dana</p>' },
      { id: 's19', day: 'sun', t: '8:16 pm', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Maya Chen', subj: 'Text: Thursday evening', state: 'Delivered',
        head: [['To', 'Maya Chen (text, opted in Sunday)'], ['Sent', 'Sunday 8:16 pm · open-house follow-up']],
        body: '<p>Let me check Thursday evening and come back to you tomorrow morning.</p>' },
      { id: 's20', day: 'sun', t: '6:14 pm', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Ravi Mehta', subj: 'Text: thanks for coming to 230 Mercer Ave', state: 'Delivered · Ravi replied',
        head: [['To', 'Ravi Mehta (text, opted in Sunday)'], ['Sent', 'Sunday 6:14 pm · open-house follow-up, day 1']],
        body: '<p>Hi Ravi, it\'s Dana from Reyes Realty. Thanks for coming to 230 Mercer Ave today. Would a short buyer consultation this week help?</p>' },
      { id: 's21', day: 'mon', t: '8:05 am', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Ravi Mehta', subj: 'Text: you\'re booked Wednesday 11:00 am', state: 'Delivered',
        head: [['To', 'Ravi Mehta (text)'], ['Sent', 'Today 8:05 am · booked on your calendar']],
        body: '<p>Wednesday at 11:00 am at the office works. You\'re booked.</p>' },
      { id: 's22', day: 'sun', t: '6:16 pm', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Owen Brooks', subj: 'Text: thanks for coming to 230 Mercer Ave', state: 'Delivered · Owen replied',
        head: [['To', 'Owen Brooks (text, opted in Sunday)'], ['Sent', 'Sunday 6:16 pm · open-house follow-up, day 1']],
        body: '<p>Hi Owen, it\'s Dana from Reyes Realty. Thanks for coming to 230 Mercer Ave today. Would a short buyer consultation this week help?</p>' },
      { id: 's23', day: 'mon', t: '7:22 am', wf: null, pb: 'pb-lead', ch: 'text', deal: '230 Mercer Ave', how: 'own', to: 'Owen Brooks', subj: 'Text: check in at the start of March', state: 'Delivered',
        head: [['To', 'Owen Brooks (text)'], ['Sent', 'Today 7:22 am · he asked to reconnect in spring']],
        body: '<p>Of course. I\'ll check in at the start of March.</p>' },
      { id: 's24', day: 'sun', t: '6:20 pm', wf: null, pb: 'pb-lead', ch: 'email', deal: '230 Mercer Ave', how: 'own', to: 'Lena Ortiz', subj: 'Thanks for coming to 230 Mercer Ave', state: 'Delivered · Lena replied',
        head: [['To', 'Lena Ortiz (email: she didn\'t opt in to texts)'], ['Subject', 'Thanks for coming to 230 Mercer Ave'], ['Sent', 'Sunday 6:20 pm · open-house follow-up, day 1']],
        body: '<p>Hi Lena, thanks for coming to 230 Mercer Ave today. Would a short buyer consultation this week help?</p><p>Dana</p>' },
      { id: 's13', day: 'sat', t: '8:00 am', wf: 'deadlines', deal: '412 Linden Ct', how: 'own', to: 'Jen and Tom Park', subj: 'Your closing week at 412 Linden Ct', state: 'Delivered',
        head: [['To', 'Jen and Tom Park'], ['Subject', 'Your closing week at 412 Linden Ct'], ['Sent', 'Saturday 8:00 am']],
        body: '<p>Hi Jen and Tom,</p><p>Here\'s what\'s coming: the appraisal early in the week, the final walk-through Wednesday, and <span class="ida-marker">closing on Thursday, October 15</span>. I\'ll send times as they\'re confirmed.</p><p>Dana</p>',
        src: { doc: 'linden-agreement', pg: 'page 2', q: '"<u>Closing shall occur on or before October 15, 2026</u> at the offices of the title company."', link: 'Open the agreement at page 2' } }
    ];
  }

  /* ---------- Clients, responsibilities and routine developments ----------
     Contact records and conversation history live in the agent's CRM (Follow Up Boss); Ida reads
     them and writes its own notes and messages back. This sample mirrors what Ida read. Ida's own
     layer per client is derived from these records: the thread (who said what, and who sent it),
     what they expect next, what Ida is handling, and the decisions that name them. */
  function msg(from, ch, t, text, sum, src) { var m = { from: from, ch: ch, t: t, text: text }; if (sum) m.sum = sum; if (src) m.src = src; return m; }
  function PEOPLE0() {
    var ps = [
      { id: 'p-sarah', type: 'lead', name: 'Sarah Kim', short: 'Sarah', kind: 'client', role: 'Buyer lead · met at Sunday\'s open house', dk: 'mercer', stage: 'consult', texting: 'opted', ida: 'on',
        resume: 'Email Sarah on Wednesday at 9 am to confirm Thursday\'s consultation. Her commission question stays with you.',
        thread: [
          msg('dana', 'text', 'Sun 2:30 pm', 'Nice meeting you today, Sarah. Here\'s my number if anything comes up.', 'Gave Sarah her number at the open house'),
          msg('ida', 'text', 'Sun 6:12 pm', 'Hi Sarah, it\'s Dana from Reyes Realty. Thanks for stopping by 230 Mercer Ave today. Would a short buyer consultation this week help?', 'Thanked her for coming and offered a consultation'),
          msg('them', 'text', 'Sun 7:40 pm', 'Yes please. Looking for a 2 bed condo under 550k, close to the train. Already pre-approved.', 'Wants a 2-bedroom condo under $550,000 near the train; pre-approved'),
          msg('ida', 'text', 'Sun 7:44 pm', 'Great. I have Thursday at 3:00 pm or Friday at 10:00 am. Which works for you?', 'Offered Thursday 3 pm or Friday 10 am', { label: 'Times from your calendar' }),
          msg('them', 'text', 'Sun 8:05 pm', 'Thursday 3 is good.', 'Picked Thursday at 3 pm'),
          msg('ida', 'email', 'Mon 8:30 am', 'You\'re booked for Thursday, October 15 at 3:00 pm at the Reyes Realty office, 140 Grand St. Bring your pre-approval letter if it\'s handy.', 'Confirmed the consultation for Thursday 3 pm at the office', { label: 'Booked on your calendar' }),
          msg('them', 'email', 'Mon 9:02 am', 'Thanks. Quick question before we meet: would Dana lower her commission if we find something fast?', 'Asked whether you would lower your commission'),
          msg('ida', 'email', 'Mon 9:05 am', 'Good question. I\'ll get back to you on that before Thursday.', 'Said you would answer the commission question before Thursday', { label: 'Your rule: ask before quoting a fee' })
        ],
        expects: [
          { id: 'x1', text: 'Consultation with you, Thursday 3:00 pm at the office', status: 'confirmed', work: 'You meet her Thursday at 3 pm', at: 'Mon 8:30 am' },
          { id: 'x2', text: 'Your answer on commission before Thursday', status: 'confirmed', work: 'Only you can answer this', dec: 'd-sarah', at: 'Mon 9:05 am', promise: 'Ida said you\'d answer before Thursday' },
          { id: 'x3', text: 'A few 2-bedroom condos near the train to look at', status: 'tentative', work: '' }
        ],
        handling: [
          { id: 'h1', text: 'Reminder about Thursday\'s consultation', when: 'Wed 9:00 am', pb: 'pb-lead', duty: 'du-consult', kind: 'remind', ch: 'email' },
          { id: 'h2', text: 'Search follow-up: new 2-bedroom condos near the train', when: 'Fri 10:00 am', pb: 'pb-lead', duty: 'du-oh', kind: 'search', ch: 'email' }
        ], notes: [] },
      { id: 'p-maya', type: 'lead', name: 'Maya Chen', short: 'Maya', kind: 'client', role: 'Open-house lead · Sunday, 230 Mercer Ave', dk: 'mercer', stage: 'lead', texting: 'opted', ida: 'on',
        resume: 'Text Maya the consultation times you choose, then book the one she picks.',
        thread: [
          msg('ida', 'text', 'Sun 6:10 pm', 'Hi Maya, it\'s Dana from Reyes Realty. Thanks for coming to 230 Mercer Ave today. The HOA fee is $412 a month and includes one deeded parking space. Would a short buyer consultation this week help?', 'Answered the HOA question and offered a consultation', { doc: 'mercer-listing', cite: 'HOA fee is $412 a month and includes one deeded parking space', label: 'From the listing sheet, page 2' }),
          msg('them', 'text', 'Sun 8:14 pm', 'Yes. Any chance Thursday at 6? I work until 5:30.', 'Asked for Thursday at 6 pm; works until 5:30'),
          msg('ida', 'text', 'Sun 8:16 pm', 'Let me check Thursday evening and come back to you tomorrow morning.', 'Said you would answer about Thursday evening this morning')
        ],
        expects: [ { id: 'x1', text: 'An answer about Thursday 6 pm this morning', status: 'confirmed', work: 'Your decision on Today', dec: 'd-maya', at: 'Sun 8:16 pm', promise: 'Ida said you\'d answer this morning' } ],
        handling: [ { id: 'h1', text: 'Holding her Thursday 6 pm request until you decide', when: 'Now', pb: 'pb-lead', duty: 'du-oh', kind: 'follow', ch: 'text' } ], notes: [] },
      { id: 'p-parks', type: 'buyer', name: 'Jen and Tom Park', short: 'Jen and Tom', kind: 'client', role: 'Your buyers · 412 Linden Ct', dk: 'linden', stage: 'closing', texting: 'opted', ida: 'on',
        resume: 'Remind the Parks on Tuesday at 9 am to wire funds by Wednesday at noon, from the purchase agreement.',
        thread: [
          msg('ida', 'email', 'Sat 8:00 am', 'Here\'s what\'s coming: the appraisal early in the week, the final walk-through Wednesday, and closing on Thursday, October 15. I\'ll send times as they\'re confirmed.', 'Sent the closing-week plan: appraisal, walk-through Wednesday, closing Thursday', { doc: 'linden-agreement', cite: 'closing on Thursday, October 15', label: 'From the purchase agreement, page 2' }),
          msg('ida', 'email', 'Mon 7:00 am', 'Calendar invite: Closing, 412 Linden Ct, Thursday 2:00 pm at Lone Oak Title, 88 Main St. Please bring a photo ID.', 'Sent the closing invite for Thursday 2 pm', { doc: 'linden-agreement', label: 'From the purchase agreement, page 2' }),
          msg('them', 'text', 'Mon 7:42 am', 'Can we do the walk-through Wednesday after 4? Also could Dana call me about the walk-through, I have a couple of questions. Jen', 'Jen asked for the walk-through Wednesday after 4 pm, and for a call from you'),
          msg('dana', 'text', 'Fri 5:10 pm', 'Congrats again on clearing the loan conditions. Almost there.', 'Congratulated them on clearing the loan conditions')
        ],
        expects: [
          { id: 'x1', text: 'Closing Thursday 2:00 pm at Lone Oak Title', status: 'confirmed', work: 'You attend the closing', at: 'Mon 7:00 am' },
          { id: 'x2', text: 'Final walk-through Wednesday after 4 pm', status: 'tentative', work: 'You walk through with them', at: 'Mon 7:42 am' },
          { id: 'x3', text: 'A call from you about the walk-through', status: 'tentative', work: 'Call Jen today', at: 'Mon 7:42 am' },
          { id: 'x4', text: 'The inspection summary', status: 'tentative', work: '', dec: 'd-inspect' }
        ],
        handling: [
          { id: 'h1', text: 'Remind them to wire funds by Wednesday noon', when: 'Tue 9:00 am', pb: 'pb-buyer', duty: 'du-closeprep', kind: 'remind', ch: 'email' },
          { id: 'h2', text: 'Confirm the walk-through time with Rob Chen, sellers\' agent', when: 'Tue 10:00 am', pb: 'pb-buyer', duty: 'du-closeprep', kind: 'follow', ch: 'email' }
        ], notes: [] },
      { id: 'p-garcias', type: 'seller', name: 'Luis and Ana Garcia', short: 'Luis and Ana', kind: 'client', role: 'Your sellers · 17 Ash St', dk: 'ash', stage: 'contract', texting: 'email', ida: 'on',
        resume: 'Send the second reminder about the two disclosure signatures on Tuesday at 7 am.',
        thread: [
          msg('ida', 'email', 'Sat 4:05 pm', 'You have three offers. The strongest on paper is the Nguyens\' at $625,000 with 20% down and a 21-day close.', 'Sent the offer comparison (you approved)', { doc: 'ash-offer', cite: '$625,000 with 20% down and a 21-day close', label: 'From the offer, page 1' }),
          msg('ida', 'email', 'Mon 7:00 am', 'The seller disclosure for 17 Ash St still needs 2 of its 4 signatures, on pages 6 and 7. The link from Friday still works.', 'Reminded them about two disclosure signatures', { doc: 'ash-disclosure', cite: '2 of its 4 signatures', label: 'From the DocuSign envelope' }),
          msg('them', 'email', 'Mon 7:31 am', 'Sorry, we will sign it tonight. Ana', 'Said they will sign the disclosure tonight')
        ],
        expects: [ { id: 'x1', text: 'Weekly showing report, Mondays 8 am', status: 'confirmed', work: '' } ],
        handling: [
          { id: 'h1', text: 'Second reminder about the disclosure signatures', when: 'Tue 7:00 am', pb: 'pb-seller', duty: 'du-disclosure', kind: 'follow', ch: 'email' },
          { id: 'h2', text: 'Weekly showing report', when: 'Mon 8:00 am', pb: 'pb-seller', duty: 'du-report', kind: 'other', ch: 'email' }
        ], notes: [] },
      { id: 'p-marcus', type: 'lead', name: 'Marcus Lee', short: 'Marcus', kind: 'client', role: 'Website lead · 17 Ash St', dk: 'ash', stage: 'lead', texting: 'opted', ida: 'on',
        resume: 'Book Wednesday 2:30 pm once Google Calendar is reconnected and you approve.',
        thread: [
          msg('ida', 'email', 'Sun 11:02 am', 'Happy to show you 17 Ash St. Showings are by appointment with 24 hours notice, so the earliest is Tuesday. Would Wednesday at 2:30 pm work?', 'Offered a showing Wednesday 2:30 pm', { doc: 'ash-listing', cite: 'Showings are by appointment with 24 hours notice', label: 'From the listing sheet' }),
          msg('them', 'email', 'Sun 1:14 pm', 'Wednesday at 2:30 works for me. See you there.', 'Accepted Wednesday 2:30 pm', { doc: 'marcus-email', label: 'His email' })
        ],
        expects: [ { id: 'x1', text: 'Showing at 17 Ash St, Wednesday 2:30 pm', status: 'tentative', work: 'You show the house', dec: 'd-showing', at: 'Sun 1:14 pm' } ],
        handling: [], notes: [] },
      { id: 'p-priya', type: 'lead', name: 'Priya Shah', short: 'Priya', kind: 'client', role: 'Zillow lead · 17 Ash St', dk: 'ash', stage: 'lead', texting: 'opted', ida: 'on',
        resume: 'Send the day-2 follow-up on Wednesday at 9:05 am.',
        thread: [
          msg('ida', 'email', 'Mon 9:05 am', 'Thanks for asking about 17 Ash St. It\'s still available: 3 bedrooms, 2 baths and 1,840 square feet, listed at $625,000.', 'Answered her Zillow question about 17 Ash St', { doc: 'ash-listing', cite: '3 bedrooms, 2 baths and 1,840 square feet', label: 'From the listing sheet' }),
          msg('them', 'email', 'Mon 9:40 am', 'Thanks, I might come Saturday.', 'Might come to Saturday\'s open house')
        ],
        expects: [ { id: 'x1', text: 'Open house Saturday 1 to 3 pm', status: 'tentative', work: '' } ],
        handling: [
          { id: 'h1', text: 'Day-2 follow-up: any questions before Saturday?', when: 'Wed 9:05 am', pb: 'pb-lead', duty: 'du-replies', kind: 'follow', ch: 'email' },
          { id: 'h2', text: 'Reminder about Saturday\'s open house', when: 'Fri 10:00 am', pb: 'pb-lead', duty: 'du-replies', kind: 'remind', ch: 'text' }
        ], notes: [] },
      { id: 'p-ravi', type: 'lead', name: 'Ravi Mehta', short: 'Ravi', kind: 'client', role: 'Open-house lead · Sunday, 230 Mercer Ave', dk: 'mercer', stage: 'consult', texting: 'opted', ida: 'on',
        resume: 'Remind Ravi about Wednesday\'s consultation on Tuesday at 9 am.',
        thread: [
          msg('ida', 'text', 'Sun 6:14 pm', 'Hi Ravi, it\'s Dana from Reyes Realty. Thanks for coming to 230 Mercer Ave today. Would a short buyer consultation this week help?', 'Thanked him and offered a consultation'),
          msg('them', 'text', 'Mon 8:02 am', 'Sure, Wednesday morning?', 'Asked for Wednesday morning'),
          msg('ida', 'text', 'Mon 8:05 am', 'Wednesday at 11:00 am at the office works. You\'re booked.', 'Booked Wednesday 11 am', { label: 'Booked on your calendar' })
        ],
        expects: [ { id: 'x1', text: 'Consultation with you, Wednesday 11:00 am', status: 'confirmed', work: 'You meet him Wednesday', at: 'Mon 8:05 am' } ],
        handling: [ { id: 'h1', text: 'Reminder about Wednesday\'s consultation', when: 'Tue 9:00 am', pb: 'pb-lead', duty: 'du-consult', kind: 'remind', ch: 'text' } ], notes: [] },
      { id: 'p-owen', type: 'lead', name: 'Owen Brooks', short: 'Owen', kind: 'client', role: 'Open-house lead · Sunday, 230 Mercer Ave', dk: 'mercer', stage: 'paused', stageNote: 'Reconnect in spring', texting: 'opted', ida: 'on',
        resume: 'Check in with Owen on March 1.',
        thread: [
          msg('ida', 'text', 'Sun 6:16 pm', 'Hi Owen, it\'s Dana from Reyes Realty. Thanks for coming to 230 Mercer Ave today. Would a short buyer consultation this week help?', 'Thanked him and offered a consultation'),
          msg('them', 'text', 'Mon 7:20 am', 'Thanks, we\'re not moving until spring. Can you check back then?', 'Asked to reconnect in the spring'),
          msg('ida', 'text', 'Mon 7:22 am', 'Of course. I\'ll check in at the start of March.', 'Said you would check in in early March')
        ],
        expects: [ { id: 'x1', text: 'A check-in in early March', status: 'confirmed', work: '' } ],
        handling: [ { id: 'h1', text: 'Check in about the spring search', when: 'Mon, Mar 1', pb: 'pb-lead', duty: 'du-oh', kind: 'checkin', ch: 'text' } ], notes: [] },
      { id: 'p-lena', type: 'lead', name: 'Lena Ortiz', short: 'Lena', kind: 'client', role: 'Open-house lead · Sunday, 230 Mercer Ave', dk: 'mercer', stage: 'lead', texting: 'email', ida: 'on',
        resume: 'Send the day-3 follow-up by email on Wednesday at 10 am.',
        thread: [
          msg('ida', 'email', 'Sun 6:20 pm', 'Hi Lena, thanks for coming to 230 Mercer Ave today. Would a short buyer consultation this week help?', 'Thanked her and offered a consultation (email: she didn\'t opt in to texts)'),
          msg('them', 'email', 'Mon 8:50 am', 'Email is best for me, please no texts.', 'Asked for email only')
        ],
        expects: [], handling: [ { id: 'h1', text: 'Day-3 follow-up', when: 'Wed 10:00 am', pb: 'pb-lead', duty: 'du-oh', kind: 'follow', ch: 'email' } ], notes: [] },
      { id: 'p-dev', type: 'lead', name: 'Dev Patel', short: 'Dev', kind: 'client', role: 'Zillow lead · 230 Mercer Ave', dk: 'mercer', stage: 'lead', texting: 'opted', ida: 'on', quiet: true,
        resume: 'Nothing scheduled. Hand Ida a responsibility to re-engage him.',
        thread: [ msg('ida', 'email', 'Sat 10:15 am', 'Good questions. The HOA fee is $412 a month and includes one deeded parking space. Want to see it this week?', 'Answered his HOA and parking question', { doc: 'mercer-listing', cite: 'HOA fee is $412 a month and includes one deeded parking space', label: 'From the listing sheet, page 2' }) ],
        expects: [], handling: [], notes: [] },
      { id: 'p-ellen', type: 'lead', name: 'Ellen Wu', short: 'Ellen', kind: 'client', role: 'Website lead · August', dk: 'none', stage: 'lead', texting: 'email', ida: 'on', quiet: true,
        resume: 'Nothing scheduled. Hand Ida a responsibility to re-engage her.',
        thread: [ msg('dana', 'email', 'Aug 21', 'Hi Ellen, thanks for reaching out about townhomes near the park. Happy to help when you\'re ready.', 'You answered her townhome question in August') ],
        expects: [], handling: [], notes: [] },
      { id: 'p-okafors', type: 'buyer', name: 'Ruth and David Okafor', short: 'Ruth and David', kind: 'client', role: 'Your buyers · 9 Hollis Way', dk: 'hollis', stage: 'contract', texting: 'email', ida: 'on',
        resume: 'Ask Ruth and David on Friday at 9 am whether they accept the $1,800 credit.',
        thread: [
          msg('ida', 'email', 'Sun 6:20 pm', 'The inspection is back and the house is in good shape overall. The one item worth asking about is the water heater, which is 14 years old.', 'Sent the inspection summary (you approved after one edit)', { doc: 'hollis-inspection', cite: 'water heater, which is 14 years old', label: 'From the inspection report, page 12' }),
          msg('them', 'email', 'Mon 8:12 am', 'Thanks Dana. We\'ll talk it over and let you know by Friday whether the credit is OK.', 'Will decide by Friday whether the credit is OK')
        ],
        expects: [ { id: 'x1', text: 'Their decision on the repair credit by Friday', status: 'tentative', work: '' } ],
        handling: [ { id: 'h1', text: 'Ask about the repair credit if they haven\'t answered', when: 'Fri 9:00 am', pb: 'pb-buyer', duty: 'du-inspect', kind: 'follow', ch: 'email' } ], notes: [] },
      { id: 'p-kim', type: 'contact', name: 'Kim Alvarez', short: 'Kim', kind: 'contact', role: 'Lender · Northgate Mortgage', dk: 'linden', stage: 'contact', texting: 'email', ida: 'on',
        resume: 'Ask Kim for the clear-to-close letter on Wednesday at 9 am.',
        thread: [
          msg('ida', 'email', 'Mon 8:40 am', 'We close on 412 Linden Ct on Thursday. Could you confirm when the appraisal is scheduled?', 'Asked when the Linden appraisal is'),
          msg('them', 'email', 'Mon 8:52 am', 'The appraisal is set for Tuesday at 10 am. The appraiser will call the Parks to confirm access.', 'Confirmed the appraisal for Tuesday 10 am', { doc: 'kim-email', cite: 'Tuesday at 10 am', label: 'Her email' })
        ],
        expects: [], handling: [ { id: 'h1', text: 'Ask for the clear-to-close letter', when: 'Wed 9:00 am', pb: 'pb-buyer', duty: 'du-lender', kind: 'follow', ch: 'email' } ], notes: [] },
      { id: 'p-mruiz', type: 'contact', name: 'Maya Ruiz', short: 'Maya', kind: 'contact', role: 'Title officer · Lone Oak Title', dk: 'linden', stage: 'contact', texting: 'email', ida: 'on',
        resume: 'Send Maya the HOA payoff letter as soon as it arrives.',
        thread: [
          msg('ida', 'email', 'Sun 4:30 pm', 'Attached is the counteroffer for 17 Ash St, signed by all parties on October 11.', 'Sent the signed 17 Ash St counteroffer', { doc: 'ash-counter', cite: 'signed by all parties on October 11', label: 'From the DocuSign envelope' }),
          msg('ida', 'email', 'Mon 9:05 am', 'A reminder that the option period for 17 Ash St ends Wednesday, October 14 at 5:00 pm.', 'Reminded her the 17 Ash St option period ends Wednesday', { doc: 'ash-agreement', cite: 'option period for 17 Ash St ends Wednesday, October 14 at 5:00 pm', label: 'From the purchase agreement, page 3' })
        ],
        expects: [], handling: [ { id: 'h1', text: 'Forward the HOA payoff letter when it arrives', when: 'When it arrives', pb: 'pb-buyer', duty: 'du-lender', kind: 'follow', ch: 'email' } ], notes: [] }
    ];
    /* Every message Ida sent is in Sent; sid ties the conversation line to its Sent entry. */
    ps.forEach(function (p) { var m = SIDS[p.id] || {}; p.thread.forEach(function (x) { if (x.from === 'ida' && m[x.t]) x.sid = m[x.t]; }); });
    return ps;
  }
  var SIDS = { 'p-sarah': { 'Sun 6:12 pm': 's15', 'Sun 7:44 pm': 's17', 'Mon 8:30 am': 's14', 'Mon 9:05 am': 's18' }, 'p-maya': { 'Sun 6:10 pm': 's16', 'Sun 8:16 pm': 's19' },
    'p-parks': { 'Sat 8:00 am': 's13', 'Mon 7:00 am': 's5' }, 'p-garcias': { 'Sat 4:05 pm': 's11', 'Mon 7:00 am': 's6' }, 'p-marcus': { 'Sun 11:02 am': 's10' }, 'p-priya': { 'Mon 9:05 am': 's2' },
    'p-ravi': { 'Sun 6:14 pm': 's20', 'Mon 8:05 am': 's21' }, 'p-owen': { 'Sun 6:16 pm': 's22', 'Mon 7:22 am': 's23' }, 'p-lena': { 'Sun 6:20 pm': 's24' }, 'p-dev': { 'Sat 10:15 am': 's12' },
    'p-okafors': { 'Sun 6:20 pm': 's8' }, 'p-kim': { 'Mon 8:40 am': 's4' }, 'p-mruiz': { 'Sun 4:30 pm': 's9', 'Mon 9:05 am': 's3' } };
  /* Contact details as they are in Follow Up Boss (the agent's CRM). Ida only reads these; they are
     edited in Follow Up Boss. Sample values. */
  var CRM = { 'p-sarah': ['(415) 555-0142', 'sarah.kim@example.com'], 'p-maya': ['(415) 555-0178', 'maya.chen@example.com'], 'p-parks': ['(415) 555-0119', 'jen.park@example.com'],
    'p-garcias': ['(415) 555-0163', 'ana.garcia@example.com'], 'p-marcus': ['(415) 555-0127', 'marcus.lee@example.com'], 'p-priya': ['(415) 555-0185', 'priya.shah@example.com'],
    'p-ravi': ['(415) 555-0131', 'ravi.mehta@example.com'], 'p-owen': ['(415) 555-0156', 'owen.brooks@example.com'], 'p-lena': ['(415) 555-0194', 'lena.ortiz@example.com'],
    'p-dev': ['(415) 555-0108', 'dev.patel@example.com'], 'p-ellen': ['(415) 555-0170', 'ellen.wu@example.com'], 'p-okafors': ['(415) 555-0149', 'ruth.okafor@example.com'],
    'p-kim': ['(415) 555-0112', 'kim.alvarez@example.com'], 'p-mruiz': ['(415) 555-0136', 'maya.ruiz@example.com'] };
  var FUB_STAGE = { lead: 'Lead', consult: 'Hot Prospect', contract: 'Pending', closing: 'Pending', paused: 'Nurture', contact: 'Vendor' };
  var FUB_URL = 'https://app.followupboss.com/';
  /* Playbooks: what Ida handles for each TYPE of client (buyer deals, seller listings, leads).
     One scope and trust level per type; every client of that type is covered automatically,
     with optional per-client exceptions. info[personId] holds that client's current state. */
  function PLAYBOOKS0() {
    return [
      { id: 'pb-buyer', type: 'buyer', name: 'Buyer deals', one: 'buyer deal', many: 'buyer deals', level: 'own', status: 'running', since: 'Since Sep 2',
        duties: [
          { id: 'du-deadlines', name: 'Keep closing on track: deadlines from the contract', wf: 'deadlines', on: true },
          { id: 'du-inspect', name: 'Inspection summary and repair request', wf: 'inspection', on: true },
          { id: 'du-lender', name: 'Lender, appraisal and document chase', wf: 'docchase', on: true },
          { id: 'du-closeprep', name: 'Closing prep: invites, wire reminder, walk-through', on: true }
        ],
        info: {
          'p-parks': { deal: '412 Linden Ct', progress: 'Appraisal booked · 5 of 6 title items clear · closing Thu 2:00 pm', next: { text: 'Remind the Parks to wire funds by Wednesday noon', when: 'Tue 9:00 am' }, block: 'd-hoa', stuckText: 'HOA payoff letter: the HOA isn\'t on the deal, so Ida needs your OK to write to them.' },
          'p-okafors': { deal: '9 Hollis Way', progress: 'Repair request sent · deciding on the $1,800 credit', next: { text: 'Ask about the repair credit if they haven\'t answered', when: 'Fri 9:00 am' }, waitText: 'Waiting on Ruth and David until Fri' }
        },
        excluded: [], except: [],
        scope: { who: 'Your buyers, their lender, the title company and the sellers\' agent on each buyer deal', say: 'Dates and requirements from the purchase agreement, inspection report and title commitment only. Never promises a date that isn\'t in the contract.', cadence: 'Daily check at 7 am until closing', stop: 'Closing is recorded, or you take over a client', toYou: 'Any date at risk, anything that changes money, repair negotiations, and anyone new who needs to join the deal' } },
      { id: 'pb-seller', type: 'seller', name: 'Seller listings', one: 'seller listing', many: 'seller listings', level: 'own', status: 'running', since: 'Since Sep 7',
        duties: [
          { id: 'du-report', name: 'Weekly showing report', on: true },
          { id: 'du-offers', name: 'Offer comparison', wf: 'offers', on: true },
          { id: 'du-price', name: 'Price-review watch', on: true },
          { id: 'du-disclosure', name: 'Disclosure and signature chase', wf: 'docchase', on: true }
        ],
        info: {
          'p-garcias': { deal: '17 Ash St', progress: 'Under contract · 2 of 4 disclosure signatures · report Mondays 8 am', next: { text: 'Second reminder about the disclosure signatures', when: 'Tue 7:00 am' } }
        },
        excluded: [], except: [{ id: 'ex-1', person: 'p-garcias', text: 'Ask me before any price note' }],
        scope: { who: 'Your sellers, and buyers\' agents who show or make offers on your listings', say: 'Showings, feedback, offers side by side, and what\'s missing on the file. No price advice.', cadence: 'Weekly report Mondays at 8 am; chases every 2 days', stop: 'The listing closes or is withdrawn, or you take over a client', toYou: 'Any question about price, every offer decision, and any seller who wants to talk' } },
      { id: 'pb-lead', type: 'lead', name: 'Leads', one: 'lead', many: 'leads', level: 'own', status: 'running', since: 'Since Sep 2',
        duties: [
          { id: 'du-replies', name: 'Reply to new leads within 5 minutes', wf: 'leads', on: true },
          { id: 'du-oh', name: 'Open-house follow-up', on: true, progress: 'Sunday at 230 Mercer Ave: 12 contacted · 5 replied · 2 booked · 1 asked to reconnect in spring' },
          { id: 'du-consult', name: 'Book consultations in your hours (Tue to Fri, 9 am to 5 pm)', wf: 'showings', on: true },
          { id: 'du-reengage', name: 'Re-engage quiet leads', on: false }
        ],
        info: {
          'p-sarah': { deal: 'Open house, 230 Mercer Ave', progress: 'Consultation booked Thu 3:00 pm', next: { text: 'Reminder about Thursday\'s consultation', when: 'Wed 9:00 am' } },
          'p-maya': { deal: 'Open house, 230 Mercer Ave', progress: 'Asked for Thursday 6 pm', next: { text: 'Holding her request until you decide', when: 'Now' } },
          'p-ravi': { deal: 'Open house, 230 Mercer Ave', progress: 'Consultation booked Wed 11:00 am', next: { text: 'Reminder about Wednesday\'s consultation', when: 'Tue 9:00 am' } },
          'p-owen': { deal: 'Open house, 230 Mercer Ave', progress: 'Asked to reconnect in spring', next: { text: 'Check in about the spring search', when: 'Mon, Mar 1' }, waitText: 'Waiting until spring' },
          'p-lena': { deal: 'Open house, 230 Mercer Ave', progress: 'Email only · no reply yet', next: { text: 'Day-3 follow-up by email', when: 'Wed 10:00 am' } },
          'p-marcus': { deal: '17 Ash St', progress: 'Accepted a showing Wed 2:30 pm', next: { text: 'Book once Google Calendar is back and you approve', when: 'Waiting on you' } },
          'p-priya': { deal: '17 Ash St', progress: 'Might come to Saturday\'s open house', next: { text: 'Day-2 follow-up', when: 'Wed 9:05 am' } },
          'p-dev': { deal: '230 Mercer Ave', progress: 'No reply since Sat', next: { text: 'Nothing scheduled: re-engaging quiet leads is off', when: '' }, quiet: true },
          'p-ellen': { deal: 'Website, August', progress: 'No reply since August', next: { text: 'Nothing scheduled: re-engaging quiet leads is off', when: '' }, quiet: true }
        },
        excluded: [], except: [],
        scope: { who: 'Every lead from Zillow, your website and open-house sign-in sheets', say: 'Thanks them, answers questions from the listing sheet, and offers a buyer consultation in your hours (Tue to Fri, 9 am to 5 pm).', cadence: 'Day 1, day 3 and day 7, then stops', stop: 'The outreach sequence stops when someone books, says no, asks to wait, or opts out. Reminders for a booked consultation still go out', toYou: 'Requests outside your hours, any question about price or commission, and anyone who asks for you' } }
    ];
  }
  var TYPE_NAMES = { buyer: ['buyer deal', 'buyer deals'], seller: ['seller listing', 'seller listings'], lead: ['lead', 'leads'] };
  /* Routine developments since yesterday. Where each shows up follows Notification levels (s.notify). */
  function EVENTS0() {
    return [
      { id: 'e-jen', ev: 'asks', person: 'p-parks', pb: 'pb-buyer', t: 'Mon 7:42 am', text: 'Jen Park asked you to call about the final walk-through.',
        recommend: 'Call her today. Ida holds the walk-through confirmation until you do.', next: 'If you haven\'t called by 4 pm, Ida reminds you once. Ida doesn\'t answer her questions for you.' },
      { id: 'e-ravi', ev: 'booked', person: 'p-ravi', pb: 'pb-lead', t: 'Mon 8:05 am', text: 'Ravi Mehta booked a consultation for Wednesday at 11:00 am.' },
      { id: 'e-sarah', ev: 'booked', person: 'p-sarah', pb: 'pb-lead', t: 'Sun 8:05 pm', text: 'Sarah Kim booked a consultation for Thursday at 3:00 pm.' },
      { id: 'e-lena', ev: 'pref', person: 'p-lena', pb: 'pb-lead', t: 'Mon 8:50 am', text: 'Lena Ortiz asked for email only. Ida won\'t text her.' },
      { id: 'e-owen', ev: 'later', person: 'p-owen', pb: 'pb-lead', t: 'Mon 7:20 am', text: 'Owen Brooks asked to reconnect in the spring. Ida set a check-in for March 1.' },
      { id: 'e-kim', ev: 'reply', person: 'p-kim', pb: 'pb-buyer', t: 'Mon 8:52 am', text: 'Kim Alvarez confirmed the Linden appraisal for Tuesday at 10 am.' },
      { id: 'e-garcia', ev: 'reply', person: 'p-garcias', pb: 'pb-seller', t: 'Mon 7:31 am', text: 'Ana Garcia said they\'ll sign the disclosure tonight.' }
    ];
  }
  var EVENT_TYPES = [
    { id: 'reply', label: 'Routine replies and confirmations', eg: 'Kim confirmed the appraisal time' },
    { id: 'booked', label: 'Someone books, moves or cancels an appointment', eg: 'Ravi booked Wednesday 11 am' },
    { id: 'pref', label: 'Someone changes a preference', eg: 'Lena asked for email only' },
    { id: 'later', label: 'Someone asks to reconnect later', eg: 'Owen asked to talk in the spring' },
    { id: 'asks', label: 'A client asks for you', eg: 'Jen asked you to call' },
    { id: 'complaint', label: 'A complaint or an upset client', eg: 'A seller unhappy with showing feedback' },
    { id: 'urgent', label: 'Something time-sensitive', eg: 'A deadline today, a closing at risk' },
    { id: 'outside', label: 'A request outside what Ida may do', eg: 'Price, commission, hours outside yours', locked: true }
  ];
  var LEVELS_N = { log: 'Always available', brief: 'Daily briefing', now: 'Right away' };
  var STAGES = { lead: 'Lead', consult: 'Consultation booked', contract: 'Under contract', closing: 'Closing this week', paused: 'Paused', contact: 'Deal contact' };
  var DEAL_NAMES = { linden: '412 Linden Ct', ash: '17 Ash St', hollis: '9 Hollis Way', mercer: '230 Mercer Ave', none: 'No deal yet' };

  /* ---------- Storage (all guarded) ---------- */
  /* Stored state is user-controllable (anyone can edit their own localStorage), so it is
     checked before use: every object key and every id-like field must be a plain token.
     Anything else falls back to the sample data. Text is escaped and stored HTML is
     sanitized where it is rendered (see esc and safeHtml below). */
  var TOKEN = /^[A-Za-z0-9_-]*$/;
  var ID_KEYS = { id: 1, wf: 1, rule: 1, doc: 1, blockedBy: 1, flag: 1, from: 1, dec: 1, task: 1, needsApp: 1, group: 1, level: 1, status: 1, prev: 1, day: 1, how: 1, kind: 1, verdict: 1, learn: 1, by: 1, person: 1, pb: 1, duty: 1, type: 1, ev: 1, ch: 1, stage: 1, ida: 1, texting: 1, dk: 1, tpl: 1, block: 1, opt: 1, chosen: 1, sid: 1, to: 0 };
  function validState(s) {
    if (!s || typeof s !== 'object' || s.v !== 8) return false;
    var lists = ['apps', 'workflows', 'tasks', 'rules', 'decisions', 'sent', 'done', 'upcoming', 'people', 'playbooks', 'events', 'changes', 'blocked'];
    if (!s.notify || typeof s.notify !== 'object') return false;
    for (var i = 0; i < lists.length; i++) if (!Array.isArray(s[lists[i]])) return false;
    if (!s.insight || !s.onboarding) return false;
    if (s.outbox != null && (!Array.isArray(s.outbox) || s.outbox.some(function (o) { return !o || typeof o !== 'object' || typeof o.due !== 'number' || !/^(approve|choose|insight)$/.test(o.kind); }))) return false;
    var ok = true;
    (function walk(o, depth) {
      if (!ok || depth > 12) { ok = false; return; }
      if (Array.isArray(o)) { o.forEach(function (x) { walk(x, depth + 1); }); return; }
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        if (!TOKEN.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') { ok = false; return; }
        var v = o[k];
        if (ID_KEYS[k] && typeof v === 'string' && !TOKEN.test(v)) { ok = false; return; }
        if (k === 'level' && typeof v === 'string' && !/^(practice|approve|own|yours)$/.test(v)) { ok = false; return; }
        if (k === 'group' && typeof v === 'string' && !/^(ask|never|write|always)$/.test(v)) { ok = false; return; }
        if (k === 'ida' && typeof v === 'string' && !/^(on|you|paused)$/.test(v)) { ok = false; return; }
        if (k === 'texting' && typeof v === 'string' && !/^(opted|email)$/.test(v)) { ok = false; return; }
        if (depth === 0 && k === 'notify' && Object.keys(v || {}).some(function (e) { return !/^(log|brief|now)$/.test(v[e]); })) { ok = false; return; }
        if ((k === 'apps' || k === 'people' || k === 'only' || k === 'excluded' || k === 'blocked' || k === 'decs') && Array.isArray(v) && v.some(function (x) { return typeof x === 'string' && !TOKEN.test(x); })) { ok = false; return; }
        walk(v, depth + 1);
      });
    })(s, 0);
    return ok;
  }
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (validState(s)) return s; }
    } catch (e) { /* storage unavailable: run from memory */ }
    return seed();
  }
  function save(s) {
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  var state = load();
  var subs = [];
  function notify() { for (var i = 0; i < subs.length; i++) { try { subs[i](state); } catch (e) { if (window.console) console.error(e); } } }

  /* Pending undo: one entry at a time, kept beside the state (not inside it, so snapshots don't
     nest) with an expiry time and the state revision it belongs to. Any later change to the
     state ends it, except a queued send going out, which is applied to the snapshot too. Every
     page's shell shows it until it expires, so navigating away doesn't lose Undo. */
  var UKEY = KEY + '-undo', memUndo = null;
  function readUndo() {
    var u = memUndo;
    try { var raw = window.localStorage.getItem(UKEY); u = raw ? JSON.parse(raw) : null; } catch (e) { u = memUndo; }
    if (!u || typeof u !== 'object' || typeof u.id !== 'string' || !TOKEN.test(u.id) || typeof u.msg !== 'string' || typeof u.exp !== 'number' || typeof u.rev !== 'number' || typeof u.snap !== 'string') return null;
    return u;
  }
  function writeUndo(u) { memUndo = u; try { if (u) window.localStorage.setItem(UKEY, JSON.stringify(u)); else window.localStorage.removeItem(UKEY); } catch (e) { /* memory only */ } }
  function liveUndo() { var u = readUndo(); return u && u.exp > Date.now() && u.rev === state.rev ? u : null; }

  var store = {
    get: function () { return state; },
    /* pre(state) runs after the change and before subscribers hear about it. */
    update: function (fn, pre) { fn(state); state.rev = (state.rev || 0) + 1; if (pre) pre(state); save(state); notify(); return state; },
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },
    snapshot: function () { return JSON.stringify(state); },
    restore: function (snap) { var r = JSON.parse(snap); if (!validState(r)) return; state = r; state.rev = (state.rev || 0) + 1; save(state); notify(); },
    reset: function () { try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } writeUndo(null); state = seed(); save(state); notify(); },
    undo: {
      get: liveUndo,
      set: function (o) { writeUndo({ id: o.id, msg: String(o.msg || ''), exp: o.exp, rev: state.rev, snap: o.snap }); notify(); },
      clear: function () { writeUndo(null); notify(); },
      /* Restores the state from before the action. Returns false if the undo has expired or was overtaken. */
      run: function (id) { var u = liveUndo(); if (!u || (id && u.id !== id)) return false; writeUndo(null); store.restore(u.snap); return true; }
    }
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) { state = load(); notify(); } else if (e.key === UKEY) notify(); });

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
    var th = taskHold(t); if (th) return { held: true, text: th };
    if (t.id === 't-inspect' && w) return w.level === 'own' ? 'Buyer summaries go out on their own · repair requests come to you' : 'You approved ' + w.approved + ' of ' + w.approved;
    if (t.id === 't-price') return state.insight.status === 'sent' ? 'Price review sent to the Garcias today' : '1 waiting';
    return t.note || '';
  }
  /* A playbook task is on hold when its playbook is paused or the responsibility behind it is off
     (the same switches holdOf reads for each client's scheduled actions). */
  function taskHold(t) {
    var pb = t.pb && playbook(t.pb); if (!pb) return null;
    if (pb.status === 'paused') return 'On hold · the ' + pb.name + ' playbook is paused';
    var du = pb.duties.filter(function (d) { return d.task === t.id || (t.wf && d.wf === t.wf); })[0];
    return du && !du.on ? 'On hold · ' + du.name + ' is off for every ' + pb.one : null;
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
  /* ---------- One model for who owns what ----------
     A decision is either human work (a question only you can answer: kind "choice", e.g. Sarah's
     commission question) or an Ida action waiting for your approval (a draft, an ask, a booking).
     When you take over a client or pause Ida for them, Ida's actions for that client are set
     aside, but human work stays in What needs you, owned by you, until you mark it done or
     dismiss it. A decision blocked by a disconnected app is "stuck", with the fix that unblocks it.
     Today, Being handled, Sent and Tasks all read these functions, so they always agree. */
  function decLive(d) {
    var st = d.status === 'you' ? 'open' : d.status; /* "you" is the old take-over status */
    if (st === 'blocked') { var a = app(d.blockedBy); return !!(a && a.status === 'connected'); }
    return st === 'open';
  }
  function idaOff(p) { return !!p && (p.ida === 'you' || p.ida === 'paused'); }
  function isWork(d) { return !!d && d.kind === 'choice'; }
  function setAside(d) { return decLive(d) && !isWork(d) && idaOff(d.person && person(d.person)); }
  function openDecisions() { return state.decisions.filter(function (d) { return decLive(d) && !setAside(d); }); }
  function asideDecisions() { return state.decisions.filter(setAside); }
  function blockedFor(pid) { return state.decisions.filter(function (d) { if (d.status !== 'blocked' || d.person !== pid) return false; var a = app(d.blockedBy); return !(a && a.status === 'connected'); }); }
  function lc1(x) { x = String(x || ''); return x.charAt(0).toLowerCase() + x.slice(1); }
  function stuckFix(d) { var a = app(d.blockedBy); return { why: (a ? a.name : 'An app') + ' is disconnected, so Ida can\'t ' + lc1(String(d.q || '').replace(/\?$/, '')) + '. Once it\'s back, it comes to you to approve.', fix: { href: 'apps.html', label: 'Reconnect ' + (a ? a.name : 'the app') } }; }
  /* The expectation a decision answers, if any (for the quote and who promised it). */
  function expectFor(d) { var p = d && d.person && person(d.person); if (!p) return null; for (var i = 0; i < p.expects.length; i++) if (p.expects[i].dec === d.id) return p.expects[i]; return null; }
  /* The message an expectation came from: thread entry with the same time stamp. */
  function msgAt(p, t) { if (!p || !t) return null; for (var i = p.thread.length - 1; i >= 0; i--) if (p.thread[i].t === t) return { m: p.thread[i], i: i }; return null; }
  /* Everything that needs you about one person, typed by owner. */
  function personNeeds(pid) {
    var out = [];
    openDecisions().forEach(function (d) { if (d.person === pid) out.push({ type: isWork(d) ? 'work' : 'approve', d: d }); });
    blockedFor(pid).forEach(function (d) { var f = stuckFix(d); out.push({ type: 'stuck', d: d, why: f.why, fix: f.fix }); });
    nowEvents().forEach(function (e) { if (e.person === pid) out.push({ type: 'event', e: e }); });
    return out;
  }
  /* Why a scheduled action for a person is held, or null if it will run. Reasons, in order: you
     handle the client, Ida is paused for them, they're left out of the playbook, the playbook is
     paused, or the responsibility (duty) behind it is switched off. */
  function holdOf(p, h) {
    if (!p || !h) return null;
    var nm = first(p);
    if (p.ida === 'you') return { by: 'person', text: 'On hold while you handle ' + nm, short: 'you\'re handling ' + nm };
    if (p.ida === 'paused') return { by: 'person', text: 'On hold while Ida is paused for ' + nm, short: 'Ida is paused for ' + nm };
    var pb = h.pb && playbook(h.pb); if (!pb) return null;
    if ((pb.excluded || []).indexOf(p.id) >= 0) return { by: 'excluded', pb: pb.id, text: 'On hold: ' + nm + ' is left out of the ' + pb.name + ' playbook', short: 'left out of ' + pb.name };
    if (pb.status === 'paused') return { by: 'pb', pb: pb.id, text: 'On hold: the ' + pb.name + ' playbook is paused', short: pb.name + ' is paused' };
    var du = h.duty && duty(pb, h.duty);
    if (du && !dutyFor(pb, du, p)) return { by: 'duty', pb: pb.id, duty: du.id, name: du.name, text: 'On hold: ' + du.name + ' is off for every ' + pb.one, short: du.name + ' is off' };
    return null;
  }
  /* Next action for a client, skipping held items; the held ones come back separately. */
  function nextFor(p, inf) {
    inf = inf || {};
    var hs = p.handling || [], live = [], held = [];
    hs.forEach(function (h) { var x = holdOf(p, h); if (x) held.push({ h: h, hold: x }); else live.push(h); });
    var n = null;
    if (live.length) { var h = live[0]; n = inf.next && inf.next.when === h.when ? { text: inf.next.text, when: inf.next.when } : { text: h.text, when: h.when }; }
    else if (!hs.length && inf.next) n = { text: inf.next.text, when: inf.next.when };
    return { next: n, held: held };
  }
  /* A queued Sent entry (not sent yet) is held for the same reasons as the person's schedule. */
  function sentHold(e) {
    if (!e || e.day !== 'q' || e.undone) return null;
    var p = null; state.people.forEach(function (x) { if (!p && x.name === e.to) p = x; }); if (!p) return null;
    var pb = personPb(p), du = null; if (pb && e.wf) pb.duties.forEach(function (d) { if (!du && d.wf === e.wf) du = d; });
    var x = holdOf(p, { pb: pb ? pb.id : '', duty: du ? du.id : '' }); if (x) x.person = p.id; return x;
  }
  /* Problems that would stop an approved message from going out. Checked at the action, so no
     page can send an empty or unaddressed message. */
  function plain(html) {
    var t; try { t = new DOMParser().parseFromString('<!doctype html><body>' + safeHtml(html), 'text/html').body.textContent; } catch (e) { t = String(html || '').replace(/<[^>]*>/g, ''); }
    return String(t || '').replace(/ /g, ' ').trim();
  }
  function headVal(d, k) { var h = (d.head || []).filter(function (x) { return x[0] === k; })[0]; return h ? String(h[1] == null ? '' : h[1]).trim() : null; }
  function draftProblem(d, body) {
    if (!d || d.kind === 'choice') return null;
    if (!plain(body != null ? body : d.body)) return 'The message is empty. Write it, or restore Ida\'s draft, before you approve.';
    if (!headVal(d, 'To')) return 'There is no recipient. Ida can\'t send it.';
    if (!headVal(d, 'Subject')) return 'The subject line is empty. Ida can\'t send it.';
    return null;
  }
  function needsYou() { return problems().length + openDecisions().length + nowEvents().length; }
  function sentCount() { return state.sent.filter(function (e) { return e.day !== 'q' && !e.undone; }).length; }
  function levelDown(l) { return l === 'own' ? 'approve' : l === 'approve' ? 'practice' : null; }
  function deal(key) { return own(DEALS, key); }

  /* ---------- Clock (sample world is Monday, Oct 12; times use the real clock) ---------- */
  function nowTime() { var d = new Date(), h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
  function cap(s) { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function nid(p) { state.seq = (state.seq || 1) + 1; return p + '-' + state.seq + '-' + Math.floor(Math.random() * 1e4); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* Allowlist sanitizer for the few stored fields that are HTML (draft bodies, "why" lines,
     quoted source passages). Parses inertly with DOMParser (no scripts run, no images load),
     keeps only simple formatting tags, keeps only class / data-cite, and keeps an <a href>
     only when it points at a page on this site. Everything else is dropped or unwrapped. */
  var KEEP = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, SPAN: 1, A: 1, UL: 1, OL: 1, LI: 1, SMALL: 1, DIV: 1 };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, FRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1, SVG: 1, MATH: 1, LINK: 1, META: 1, BASE: 1, TITLE: 1, TEXTAREA: 1, SELECT: 1, FORM: 1, INPUT: 1, BUTTON: 1, IMG: 1, VIDEO: 1, AUDIO: 1, SOURCE: 1, PICTURE: 1 };
  var SAFE_HREF = /^(?:\.\/|[A-Za-z0-9_-]+\.html)?(?:#[A-Za-z0-9_-]*)?$/;
  function safeHtml(html) {
    html = String(html == null ? '' : html);
    if (html.indexOf('<') < 0 && html.indexOf('&') < 0) return esc(html);
    var doc; try { doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html'); } catch (e) { return esc(html); }
    var out = [];
    (function clean(node) {
      for (var n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { out.push(esc(n.nodeValue)); continue; }
        if (n.nodeType !== 1) continue;
        var tag = n.tagName.toUpperCase();
        if (DROP[tag]) continue;
        if (!KEEP[tag]) { clean(n); continue; }
        var t = tag.toLowerCase(), attrs = '', cls = n.getAttribute('class'), h = n.getAttribute('href');
        if (cls && /^[A-Za-z0-9_\s-]+$/.test(cls)) attrs += ' class="' + esc(cls.trim()) + '"';
        if (n.hasAttribute('data-cite')) attrs += ' data-cite';
        if (t === 'a' && h && SAFE_HREF.test(h)) attrs += ' href="' + esc(h) + '"';
        if (t === 'br') { out.push('<br>'); continue; }
        out.push('<' + t + attrs + '>'); clean(n); out.push('</' + t + '>');
      }
    })(doc.body);
    return out.join('');
  }
  /* Each service's own published icon, downloaded once from the vendor (see img/apps/README.md)
     and served from this site so the CSP can stay img-src 'self'. Apps without one keep the
     neutral letter tile. */
  var APP_ICONS = { gmail: 'img/apps/gmail.png', gcal: 'img/apps/gcal.png', fub: 'img/apps/fub.png', dotloop: 'img/apps/dotloop.png', zillow: 'img/apps/zillow.png', qb: 'img/apps/qb.png',
    docusign: 'img/apps/docusign.png', skyslope: 'img/apps/skyslope.png', showingtime: 'img/apps/showingtime.png', outlook: 'img/apps/outlook.ico', dropbox: 'img/apps/dropbox.ico', realtor: 'img/apps/realtor.png', mls: 'img/apps/mls.ico' };
  function appLogo(id, name, letters) {
    var src = own(APP_ICONS, id);
    if (src) return '<span class="ida-app__logo ida-app__logo--img"><img src="' + esc(src) + '" alt="' + esc(name) + ' logo" width="28" height="28" decoding="async"></span>';
    return '<span class="ida-app__logo" aria-hidden="true">' + esc(letters) + '</span>';
  }
  /* Own-property lookup, so ids like "constructor" or "__proto__" never resolve to built-ins. */
  function own(map, key) { return key != null && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined; }

  /* ---------- Send queue (outbox) ---------- */
  var SEND_DELAY = 10000;
  function queue(s, o) { var ob = Object.assign({ id: nid('ob'), due: Date.now() + SEND_DELAY }, o); (s.outbox = s.outbox || []).push(ob); return ob; }
  /* Apply a pending-undo snapshot change, so a send going out doesn't cancel an unrelated Undo. */
  function patchUndo(fn) {
    var u = readUndo(); if (!u || u.exp <= Date.now() || u.rev !== state.rev - 1) return;
    try { var sn = JSON.parse(u.snap); if (Array.isArray(sn.outbox)) { fn(sn); u.snap = JSON.stringify(sn); } u.rev = state.rev; writeUndo(u); } catch (e) { /* leave it to expire */ }
  }
  function cancelIn(s, obId) {
    var ob = byId(s.outbox || [], obId); if (!ob) return;
    s.outbox.splice(s.outbox.indexOf(ob), 1);
    if (ob.kind === 'insight') { s.insight.status = /^(open|draft)$/.test(s.insight.prev || '') ? s.insight.prev : 'draft'; return; }
    var d = byId(s.decisions, ob.dec); if (d && d.status === 'sending') { d.status = d.sendPrev || 'open'; delete d.sendAt; }
  }
  function finalizeIn(s, obId) {
    var ob = byId(s.outbox || [], obId); if (!ob) return;
    s.outbox.splice(s.outbox.indexOf(ob), 1);
    if (ob.kind === 'approve') approveIn(s, ob.dec);
    else if (ob.kind === 'choose') chooseIn(s, ob.dec, ob.opt);
    else if (ob.kind === 'insight') insightIn(s);
  }
  function approveIn(s, id) {
    var d = byId(s.decisions, id); if (!d || d.status !== 'sending') return; d.status = 'done'; d.doneAt = nowTime(); delete d.sendAt;
    var dw = d.wf && byId(s.workflows, d.wf); s.done.unshift({ text: d.doneLine, time: nowTime(), dec: id, src: (dw ? dw.name : 'Your request') + ' · you approved' });
    if (d.upcoming) s.upcoming.push(Object.assign({ from: id }, d.upcoming));
    if (d.sent) {
      var e = d.sent, pp = d.person && byId(s.people, d.person);
      if (pp && e.to === pp.name) pp.thread.push({ from: 'ida', ch: 'email', t: stamp(), text: plain(d.body).slice(0, 400), sum: d.doneLine || e.subj, sid: 'sent-' + id });
      s.sent.unshift({ id: 'sent-' + id, day: 'mon', t: nowTime(), wf: e.wf, deal: e.deal, how: 'approve', at: nowTime(), to: e.to, subj: e.subj, state: e.invite ? 'Invite sent' : 'Delivered', invite: !!e.invite, undo: e.invite ? 'Removes the invite from the calendar.' : null, fresh: true,
        head: d.head.concat([['Sent', 'Today ' + nowTime() + ' · you approved' + (d.edited ? ' after editing' : '')]]), body: d.body,
        src: e.doc ? { doc: e.doc, pg: e.pg, q: e.q, link: e.link } : null });
    }
    var w = d.wf && byId(s.workflows, d.wf); if (w && w.id === 'inspection') { w.approved++; if (d.edited) w.edited++; w.last = 'Approved ' + nowTime(); }
  }
  function insightIn(s) {
    s.insight.status = 'sent';
    s.done.unshift({ text: 'Sent the price review for 17 Ash St to Luis and Ana Garcia, with the comparison attached.', time: nowTime(), insight: true, src: 'Price review · you approved' });
    s.sent.unshift({ id: 'sent-price', day: 'mon', t: nowTime(), wf: 'price', deal: '17 Ash St', how: 'approve', at: nowTime(), to: 'Luis and Ana Garcia', subj: '17 Ash St: showings and nearby prices', state: 'Delivered', fresh: true,
      head: [['To', 'Luis and Ana Garcia'], ['Subject', '17 Ash St: showings and nearby prices'], ['Attached', 'Price comparison (3 homes)'], ['Sent', 'Today ' + nowTime() + ' · you approved']],
      body: INSIGHT_BODY,
      src: { doc: 'comps-ash', pg: 'status', q: 'Two similar homes within half a mile: <u>price cuts of 3.8% and 4.2%</u> in the last 14 days.', link: 'Open the price comparison' } });
  }
  var INSIGHT_BODY = '<p>Hi Luis and Ana,</p><p>Showings at 17 Ash St went from 9 a week to 3 over the last month. In the same weeks, <span class="ida-marker">two similar homes within half a mile cut their price by about 4%</span>, and both picked up showings again. I\'ve attached the comparison.</p><p>Could we talk this week about whether to adjust the price? I have time Wednesday or Thursday afternoon.</p><p>Dana</p>';

  /* ---------- Actions ---------- */
  var act = {
    connect: function (appId) { store.update(function (s) { var a = byId(s.apps, appId); if (!a) return; a.status = 'connected'; a.sync = 'Connected just now'; if (a.id === 'gcal') a.desc = 'Reads and adds events for showings and closings. The showing scheduler is running again.'; if (a.id === 'qb') a.desc = 'Logs commissions and expenses for your accountant, once you hand Ida that task.'; }); },
    disconnect: function (appId) { store.update(function (s) { var a = byId(s.apps, appId); if (a) { a.status = 'off'; a.sync = 'Disconnected just now'; } }); },
    addApp: function (def) { store.update(function (s) { if (byId(s.apps, def.id)) { byId(s.apps, def.id).status = 'connected'; return; } s.apps.push({ id: def.id, name: def.name, logo: def.logo, status: 'connected', desc: def.desc, sync: 'Connected just now', access: def.access, added: true }); }); },
    /* Approve an Ida action. Rejected (nothing changes) if it isn't waiting on you or the draft
       has no text, recipient or subject. Otherwise it is queued: it goes out SEND_DELAY ms later
       (see flush), and until then cancelSend puts the decision back. Returns { ok, id | reason }. */
    approve: function (id, opts) {
      var d = decision(id);
      if (!d || !decLive(d)) return { ok: false, reason: 'This is no longer waiting for you.' };
      if (setAside(d)) return { ok: false, reason: 'Ida is paused for this client, so it can\'t send this.' };
      var body = opts && opts.body != null ? safeHtml(opts.body) : d.body, why = draftProblem(d, body);
      if (why) return { ok: false, reason: why };
      var ob;
      store.update(function (s) {
        var x = byId(s.decisions, id);
        if (opts && opts.body != null) { if (x.orig == null) x.orig = x.body; x.body = body; x.edited = true; }
        ob = queue(s, { kind: 'approve', dec: id, to: x.toWho || headVal(x, 'To') || '', subj: headVal(x, 'Subject') || x.tab || '' });
        x.sendPrev = x.status; x.status = 'sending'; x.sendAt = ob.due;
      });
      return { ok: true, id: ob.id };
    },
    /* Bring a queued send back before it goes out. */
    cancelSend: function (obId) {
      var ob = byId(state.outbox || [], obId); if (!ob) return false;
      store.update(function (s) { cancelIn(s, obId); }, function () { patchUndo(function (sn) { cancelIn(sn, obId); }); });
      return true;
    },
    /* Send everything whose 10 seconds are up. Runs on every page load and every second while
       something is queued, so a send completes even if you navigate away. */
    flush: function (now) {
      now = now || Date.now();
      var due = (state.outbox || []).filter(function (o) { return o.due <= now; }); if (!due.length) return 0;
      store.update(function (s) { due.forEach(function (o) { finalizeIn(s, o.id); }); }, function () { patchUndo(function (sn) { due.forEach(function (o) { finalizeIn(sn, o.id); }); }); });
      return due.length;
    },
    restoreDraft: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (d && d.orig != null) { d.body = d.orig; delete d.orig; d.edited = false; } }); },
    /* Human work: you did it yourself, or you decided it doesn't need doing. */
    workDone: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (!d || !isWork(d)) return; var p = d.person && byId(s.people, d.person); d.status = 'done'; d.chosen = 'you'; d.doneAt = nowTime(); d.doneLine = 'You handled it yourself: ' + lc1(d.q) + '.';
      s.done.unshift({ text: d.doneLine, time: nowTime(), dec: id, src: 'Your work · you marked it done' }); if (p) p.expects.forEach(function (x) { if (x.dec === id) { x.status = 'done'; x.doneAt = stamp(); } }); }); },
    workDismiss: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (!d || !isWork(d)) return; var p = d.person && byId(s.people, d.person); d.status = 'dismissed'; d.doneAt = nowTime();
      if (p) p.expects.forEach(function (x) { if (x.dec === id) { x.status = 'dismissed'; x.doneAt = stamp(); } }); }); },
    later: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (d) { d.prev = d.status; d.status = 'later'; } }); },
    bringBack: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (d) d.status = 'open'; var i = s.decisions.indexOf(d); s.decisions.splice(i, 1); s.decisions.unshift(d); }); },
    toFront: function (id) { store.update(function (s) { var d = byId(s.decisions, id); if (!d) return; s.decisions.splice(s.decisions.indexOf(d), 1); s.decisions.unshift(d); }); },
    saveDraft: function (id, html) { store.update(function (s) { var d = byId(s.decisions, id); if (d) { if (d.orig == null) d.orig = d.body; d.body = safeHtml(html); d.edited = true; } }); },
    addDecision: function (d) { var id; store.update(function (s) { id = d.id = d.id || nid('d'); d.status = d.status || 'open'; s.decisions.push(d); }); return id; },
    /* The price-review note: "sent" is queued like any approved message. */
    insight: function (st) {
      if (st === 'sent') { if (state.insight.status === 'sent' || state.insight.status === 'sending') return; store.update(function (s) { s.insight.prev = s.insight.status; s.insight.status = 'sending'; queue(s, { kind: 'insight', to: 'Luis and Ana Garcia', subj: '17 Ash St: showings and nearby prices' }); }); return; }
      store.update(function (s) { if (s.insight.status !== 'sending') s.insight.status = st; });
    },
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

  /* ---------- People, responsibilities, briefing: queries ---------- */
  function person(id) { return byId(state.people, id); }
  function playbook(id) { return byId(state.playbooks, id); }
  function pbByType(t) { for (var i = 0; i < state.playbooks.length; i++) if (state.playbooks[i].type === t) return state.playbooks[i]; return null; }
  function personPb(p) { return p && pbByType(p.type); }
  function duty(pb, id) { return pb && byId(pb.duties, id); }
  function pbClients(pb) { return state.people.filter(function (p) { return p.type === pb.type; }); }
  function pbCovered(pb) { return pbClients(pb).filter(function (p) { return (pb.excluded || []).indexOf(p.id) < 0; }); }
  function dutyFor(pb, du, p) { return du.on && (!du.only || !du.only.length || du.only.indexOf(p.id) >= 0); }
  function level(ev) { var l = state.notify && own(state.notify, ev); return l || 'now'; }
  function nowEvents() { return state.events.filter(function (e) { return level(e.ev) === 'now' && !e.ack; }); }
  function briefEvents() { return state.events.filter(function (e) { var l = level(e.ev); return l === 'brief' || (l === 'now' && e.ack); }); }
  function personDecisions(pid) { return openDecisions().filter(function (d) { return d.person === pid; }); }
  function personEvents(pid) { return nowEvents().filter(function (e) { return e.person === pid; }); }
  /* Per-client state inside a playbook. */
  function clientStatus(pb, p) {
    var inf = own(pb.info || {}, p.id) || {}, decs = personDecisions(p.id), work = decs.filter(isWork), blk = inf.block && decision(inf.block), bd = blockedFor(p.id)[0];
    if ((pb.excluded || []).indexOf(p.id) >= 0) return { key: 'off', text: 'Not covered: you excluded this client', decs: [] };
    if (pb.status === 'paused') return { key: 'paused', text: 'Paused with the playbook', decs: decs };
    if (idaOff(p)) {
      var lab = p.ida === 'you' ? 'You\'re handling · Ida paused' : 'Ida paused for this client';
      if (work.length) return { key: 'needs', text: lab + ' · ' + (work.length === 1 ? '1 question only you can answer' : work.length + ' questions only you can answer'), decs: work, idaOff: true };
      return { key: 'paused', text: lab, decs: [] };
    }
    if (blk && (blk.status === 'open' || blk.status === 'blocked')) return { key: 'stuck', text: 'Stuck · needs you', why: inf.stuckText || '', decs: decs, fix: { href: './#dec-' + blk.id, label: 'Decide on Today' } };
    if (bd) { var f = stuckFix(bd); return { key: 'stuck', text: 'Stuck · needs you', why: f.why, fix: f.fix, decs: decs }; }
    if (decs.length) return { key: 'needs', text: 'Needs you · ' + decs.length + (decs.length === 1 ? ' question' : ' questions'), decs: decs };
    var nx = nextFor(p, inf);
    if ((p.handling || []).length && !(nx.next) && nx.held.length) return { key: 'held', text: 'On hold · ' + nx.held[0].hold.short, held: nx.held, decs: [] };
    if (inf.pausedUntil) return { key: 'waiting', text: inf.pausedUntil, decs: [] };
    if (inf.waitText) return { key: 'waiting', text: inf.waitText, decs: [] };
    var re = duty(pb, 'du-reengage');
    if (inf.quiet && !(re && dutyFor(pb, re, p))) return { key: 'idle', text: 'Nothing scheduled', decs: [] };
    return { key: 'running', text: 'On track', decs: [] };
  }
  function pbStatus(pb) {
    var c = { running: 0, needs: 0, stuck: 0, waiting: 0, paused: 0, idle: 0, held: 0, off: 0 };
    pbClients(pb).forEach(function (p) { c[clientStatus(pb, p).key]++; });
    if (pb.status === 'paused') return { key: 'paused', text: 'Paused by you', counts: c };
    if (c.stuck) return { key: 'stuck', text: c.stuck + ' stuck · needs you', counts: c };
    if (c.needs) return { key: 'needs', text: 'Running · ' + c.needs + ' need' + (c.needs === 1 ? 's' : '') + ' you', counts: c };
    return { key: 'running', text: 'Running', counts: c };
  }
  /* What Follow Up Boss holds for a person (read only in Ida), and the last contact in its history. */
  function crm(pid) {
    var p = person(pid); if (!p) return null; var c = own(CRM, pid) || ['', ''], last = p.thread[p.thread.length - 1];
    return { stage: own(FUB_STAGE, p.stage) || 'Lead', phone: c[0], email: c[1], synced: 'synced 2 min ago', url: FUB_URL,
      last: last ? { t: last.t, ch: last.ch === 'text' ? 'Text' : 'Email', who: last.from === 'ida' ? 'Ida, for you' : last.from === 'dana' ? 'You' : p.name } : null };
  }
  /* What Ida told a person most recently, newest first, each tied to its Sent entry. */
  function told(pid, n) {
    var p = person(pid); if (!p) return [];
    return p.thread.filter(function (m) { return m.from === 'ida'; }).slice(-(n || 3)).reverse().map(function (m) { var e = m.sid && byId(state.sent, m.sid); return { m: m, sent: e && !e.undone ? e : null }; });
  }
  function clientCount() { var n = 0; state.playbooks.forEach(function (pb) { n += pbCovered(pb).length; }); return n; }
  /* Find people named in free text. Clients rank above deal contacts, so "Maya" means Maya Chen
     before Maya Ruiz, and the change plan offers the other one as a choice. */
  function findPeople(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ') + ' ', hits = [];
    state.people.forEach(function (p) {
      var words = p.name.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2 && w !== 'and'; });
      if (words.some(function (w) { return t.indexOf(' ' + w + ' ') >= 0 || t.indexOf(' ' + w + "'s ") >= 0 || t.indexOf(' ' + w + 's ') >= 0 && w.length > 3; })) hits.push(p);
    });
    return hits.sort(function (a, b) { return (a.kind === 'client' ? 0 : 1) - (b.kind === 'client' ? 0 : 1); });
  }

  /* ---------- Shared helpers for actions ---------- */
  function stamp() { return 'Mon ' + nowTime(); }
  function tellPerson(s, p, ch, subj, text, sum, why, how) {
    var sid = nid('sent');
    p.thread.push({ from: 'ida', ch: ch, t: stamp(), text: text, sum: sum || text, sid: sid });
    s.sent.unshift({ id: sid, day: 'mon', t: nowTime(), wf: null, pb: (personPb(p) || {}).id || '', ch: ch, deal: own(DEAL_NAMES, p.dk) || '', how: how || 'approve', at: nowTime(), to: p.name, subj: ch === 'text' ? 'Text: ' + subj : subj, state: 'Delivered', fresh: true,
      head: [['To', p.name + (ch === 'text' ? ' (text)' : '')]].concat(ch === 'text' ? [] : [['Subject', subj]]).concat([['Sent', 'Today ' + nowTime() + ' · ' + (why || 'you decided')]]), body: '<p>' + esc(text) + '</p>' });
  }
  function setExpect(p, id, o) { var x = byId(p.expects, id); if (x) Object.assign(x, o); else p.expects.push(Object.assign({ id: id || nid('x') }, o)); }
  function dropHandling(p, fn) { p.handling = p.handling.filter(function (h) { return !fn(h); }); }

  /* What each option on a choice card does. */
  var CHOICES = {
    'd-maya': {
      offer: function (s, d, p) { tellPerson(s, p, 'text', 'Friday 5:00 pm instead?', 'Thursday evening is outside my hours, but I can do Friday at 5:00 pm at the office. Would that work?', 'Offered Friday 5 pm instead of Thursday 6 pm', 'you chose Offer Friday 5 pm');
        setExpect(p, 'x1', { text: 'Consultation Friday 5:00 pm, if she accepts', status: 'tentative', work: 'You meet her Friday at 5 pm', dec: '' });
        dropHandling(p, function (h) { return h.id === 'h1'; }); p.handling.unshift({ id: 'h1', text: 'Waiting on her answer about Friday 5 pm; books it if she says yes', when: 'When she replies', pb: 'pb-lead', duty: 'du-oh', kind: 'follow', ch: 'text' });
        return 'Offered Maya Chen Friday at 5:00 pm by text.'; },
      allow: function (s, d, p) { tellPerson(s, p, 'text', 'Thursday 6:00 pm works', 'Thursday at 6:00 pm works. You\'re booked at the Reyes Realty office, 140 Grand St.', 'Booked Thursday 6 pm (you allowed it)', 'you chose Allow Thursday 6 pm');
        s.upcoming.push({ id: nid('up'), day: 'Thu', time: '6:00 pm', text: 'Buyer consultation with Maya Chen at the office', short: 'Consultation with Maya Chen', person: 'p-maya' });
        p.stage = 'consult'; setExpect(p, 'x1', { text: 'Consultation with you, Thursday 6:00 pm', status: 'confirmed', work: 'You meet her Thursday at 6 pm', dec: '' });
        dropHandling(p, function (h) { return h.id === 'h1'; }); p.handling.unshift({ id: 'h1', text: 'Reminder about Thursday\'s consultation', when: 'Wed 9:00 am', pb: 'pb-lead', duty: 'du-consult', kind: 'remind', ch: 'text' });
        return 'Booked Maya Chen for Thursday at 6:00 pm and confirmed by text.'; }
    },
    'd-sarah': {
      call: function (s, d, p) { tellPerson(s, p, 'email', 'Your question', 'I\'ll call you today about your question.', 'Said you will call her today', 'you chose Tell her I\'ll call today');
        s.upcoming.push({ id: nid('up'), day: 'Mon', time: '5:00 pm', text: 'Call Sarah Kim about her commission question', short: 'Call Sarah Kim', person: 'p-sarah' });
        setExpect(p, 'x2', { text: 'A call from you today about commission', status: 'confirmed', work: 'Call Sarah today', dec: '' });
        return 'Told Sarah Kim you\'ll call her today. The call is on This week.'; },
      meeting: function (s, d, p) { tellPerson(s, p, 'email', 'Your question', 'Let\'s cover that at Thursday\'s consultation.', 'Said you will cover commission on Thursday', 'you chose Cover it Thursday');
        setExpect(p, 'x2', { text: 'An answer on commission at Thursday\'s consultation', status: 'confirmed', work: 'Answer it Thursday', dec: '' });
        p.notes.push({ t: stamp(), text: 'Cover her commission question at Thursday\'s consultation.' });
        return 'Told Sarah Kim you\'ll cover her question on Thursday.'; }
    }
  };
  /* Taking over stops Ida writing to the client and sets aside Ida's own actions for them (derived
     in setAside, so nothing is lost). Work only you can do, and requests for you, stay put. */
  function takeOverIn(s, p) { p.ida = 'you'; p.since = stamp(); }
  function chooseIn(s, id, opt) {
    var d = byId(s.decisions, id); if (!d || d.status !== 'sending') return; var p = byId(s.people, d.person);
    var fn = own(CHOICES, id) && own(CHOICES[id], opt); if (!fn || !p) { d.status = d.sendPrev || 'open'; return; }
    var line = fn(s, d, p); d.status = 'done'; d.chosen = opt; d.doneAt = nowTime(); d.doneLine = line; delete d.sendAt;
    s.done.unshift({ text: line, time: nowTime(), dec: id, src: 'Open-house follow-up · you decided' });
  }

  Object.assign(act, {
    /* Answer a choice card. "Take over" happens at once (Ida stops; the question stays yours).
       Any option that makes Ida write is queued like an approved message. Returns { ok, id | reason }. */
    choose: function (id, opt) {
      var d = decision(id); if (!d || !decLive(d)) return { ok: false, reason: 'This is no longer waiting for you.' };
      var p = d.person && person(d.person);
      if (opt === 'takeover') {
        store.update(function (s) { var x = byId(s.decisions, id), pp = x.person && byId(s.people, x.person); if (pp) takeOverIn(s, pp);
          s.done.unshift({ text: 'You took over ' + (pp ? pp.name : '') + '. Ida stopped writing to ' + (pp ? first(pp) : 'them') + '; the question stays with you.', time: nowTime(), dec: id, src: 'Open-house follow-up · you decided' }); });
        return { ok: true };
      }
      if (idaOff(p)) return { ok: false, reason: 'Ida is paused for ' + first(p) + ', so it can\'t send this. Answer ' + first(p) + ' yourself, then mark it done.' };
      if (!(own(CHOICES, id) && own(CHOICES[id], opt))) return { ok: false, reason: 'That option isn\'t available.' };
      var o = (d.options || []).filter(function (x) { return x.opt === opt; })[0], ob;
      store.update(function (s) { var x = byId(s.decisions, id); ob = queue(s, { kind: 'choose', dec: id, opt: opt, to: p ? p.name : '', subj: o ? o.label : '' }); x.sendPrev = x.status; x.status = 'sending'; x.sendAt = ob.due; x.chosen = opt; });
      return { ok: true, id: ob.id };
    },
    ack: function (id) { store.update(function (s) { var e = byId(s.events, id); if (e) { e.ack = true; e.ackAt = nowTime(); } }); },
    callBack: function (id) { store.update(function (s) { var e = byId(s.events, id); if (!e) return; e.ack = true; e.ackAt = nowTime(); e.handled = 'You\'re calling'; var p = byId(s.people, e.person); if (p) { setExpect(p, 'x3', { text: 'A call from you today', status: 'confirmed', work: 'Call ' + p.short.split(' ')[0] + ' today' }); s.upcoming.push({ id: nid('up'), day: 'Mon', time: '4:00 pm', text: 'Call ' + p.name + ' back', short: 'Call ' + p.name.split(' ')[0] + ' back', person: p.id }); } }); },
    takeOver: function (pid) { store.update(function (s) { var p = byId(s.people, pid); if (p) takeOverIn(s, p); }); },
    handBack: function (pid) { store.update(function (s) { var p = byId(s.people, pid); if (!p) return; p.ida = 'on'; delete p.since;
      s.decisions.forEach(function (d) { if (d.person === pid && d.status === 'you') { d.status = d.prevStatus === 'blocked' ? 'blocked' : 'open'; } }); }); },
    pausePerson: function (pid, on) { store.update(function (s) { var p = byId(s.people, pid); if (!p) return; p.ida = on ? 'paused' : 'on'; if (on) p.since = stamp(); else delete p.since; }); },
    pbPause: function (id, on) { store.update(function (s) { var pb = byId(s.playbooks, id); if (pb) pb.status = on ? 'paused' : 'running'; }); },
    pbLevel: function (id, lv) { store.update(function (s) { var pb = byId(s.playbooks, id); if (pb && /^(practice|approve|own)$/.test(lv)) pb.level = lv; }); },
    pbScope: function (id, sc) { store.update(function (s) { var pb = byId(s.playbooks, id); if (!pb) return; ['who', 'say', 'cadence', 'stop', 'toYou'].forEach(function (k) { if (typeof sc[k] === 'string' && sc[k].trim()) pb.scope[k] = sc[k].trim().slice(0, 600); }); pb.edited = 'Scope changed ' + nowTime(); }); },
    pbExclude: function (id, pid, on) { store.update(function (s) { var pb = byId(s.playbooks, id); if (!pb) return; pb.excluded = (pb.excluded || []).filter(function (x) { return x !== pid; }); if (on) pb.excluded.push(pid); }); },
    pbExcept: function (id, pid, text) { var xid; store.update(function (s) { var pb = byId(s.playbooks, id); if (!pb || !String(text || '').trim()) return; xid = nid('ex'); pb.except.push({ id: xid, person: pid, text: cap(String(text).trim().slice(0, 300)) }); }); return xid; },
    pbExceptRemove: function (id, xid) { store.update(function (s) { var pb = byId(s.playbooks, id); if (pb) pb.except = pb.except.filter(function (x) { return x.id !== xid; }); }); },
    dutyToggle: function (id, did, on) { store.update(function (s) { var pb = byId(s.playbooks, id), du = pb && byId(pb.duties, did); if (du) du.on = !!on; }); },
    /* Hand Ida a responsibility: it becomes a duty in the playbook for that client type. With
       "only" it covers just those clients; otherwise every client of the type, including new ones. */
    addDuty: function (pr) {
      var did; store.update(function (s) {
        var pb = byId(s.playbooks, pr.pb); if (!pb) return;
        var du = pr.duty && byId(pb.duties, pr.duty);
        if (!du) { du = { id: nid('du'), name: cap(pr.title).slice(0, 160), on: true, fresh: true }; pb.duties.push(du); }
        du.on = true; du.name = cap(pr.title).slice(0, 160) || du.name; du.only = pr.only && pr.only.length ? pr.only.slice() : [];
        du.scope = { who: pr.who, say: pr.say, cadence: pr.cadence, stop: pr.stop, toYou: pr.toYou }; du.next = { text: pr.next.text, when: pr.next.when }; du.since = 'Since today ' + nowTime();
        did = du.id;
        s.people.forEach(function (p) { if (p.type !== pb.type || (pb.excluded || []).indexOf(p.id) >= 0 || !dutyFor(pb, du, p)) return; if (pr.quietOnly && !((own(pb.info, p.id) || {}).quiet)) return;
          p.handling.push({ id: nid('h'), text: pr.next.text, when: pr.next.when, pb: pb.id, duty: du.id, kind: 'follow', ch: p.texting === 'opted' ? 'text' : 'email' });
          var inf = own(pb.info, p.id); if (inf && inf.quiet) inf.next = { text: pr.next.text, when: pr.next.when }; });
        var t = { id: nid('t'), name: cap(pr.title).slice(0, 160), area: pb.type === 'buyer' ? 'Deals' : pb.type === 'seller' ? 'Listings' : 'Leads', level: pb.level === 'approve' ? 'approve' : 'own', pb: pb.id, hours: 0.4, note: (du.only.length ? du.only.length + ' ' + (du.only.length === 1 ? pb.one : pb.many) : 'All ' + pb.many + ', including new ones'), added: true };
        s.tasks.push(t); du.task = t.id;
        s.done.unshift({ text: 'You added "' + du.name + '" to the ' + pb.name + ' playbook.', time: nowTime(), src: 'You approved the scope' });
      }); return did;
    },
    setNotify: function (ev, lv) { store.update(function (s) { var t = EVENT_TYPES.filter(function (x) { return x.id === ev; })[0]; if (!t || t.locked || !own(LEVELS_N, lv)) return; s.notify[ev] = lv; }); },
    /* Apply a change plan. Only the listed, checked steps run, each through applyStep; the plan is
       the contract. Today it comes from keyword matching (parseChange); later a model can propose
       the same plan shape, and the owner still sees and approves the plan before anything changes. */
    applyChange: function (plan) {
      var snap = JSON.parse(JSON.stringify(state)); snap.changes = []; var id;
      store.update(function (s) {
        var done = [];
        plan.steps.forEach(function (st) { if (st.off || st.info) return; if (applyStep(s, st, plan)) done.push(st.edit ? stepText(st) : st.text); });
        id = nid('c');
        s.changes.unshift({ id: id, text: String(plan.instruction || '').slice(0, 300), title: plan.title, person: plan.person || '', steps: done, at: stamp(), snap: JSON.stringify(snap) });
        var p = plan.person && byId(s.people, plan.person); if (p) p.notes.push({ t: stamp(), text: 'You told Ida: ' + String(plan.instruction || '').slice(0, 300) });
      });
      return id;
    },
    undoChange: function (id) {
      var c = byId(state.changes, id); if (!c || c.undone) return false;
      var keep = JSON.parse(JSON.stringify(state.changes)), idx = -1;
      keep.forEach(function (x, i) { if (x.id === id) idx = i; });
      keep.forEach(function (x, i) { if (i <= idx && !x.undone) { x.undone = true; x.undoneAt = stamp(); } });
      var r; try { r = JSON.parse(c.snap); } catch (e) { return false; }
      r.changes = keep; r.rev = state.rev; store.restore(JSON.stringify(r)); return true;
    }
  });

  /* ---------- Change plans ("Tell Ida a change") ----------
     parseChange turns an instruction into a plan: a list of steps, each naming the item it touches.
     Nothing changes until the owner applies it. */
  var MONTHS = { january: 'Mon, Jan 4', february: 'Mon, Feb 1', march: 'Mon, Mar 1', april: 'Thu, Apr 1', may: 'Mon, May 3', june: 'Tue, Jun 1', july: 'Thu, Jul 1', august: 'Mon, Aug 2', september: 'Wed, Sep 1', october: 'Fri, Oct 1', november: 'Mon, Nov 2', december: 'Tue, Dec 1', spring: 'Mon, Mar 1', summer: 'Tue, Jun 1', 'next year': 'Mon, Jan 4' };
  var DAYNAMES = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
  var FULLDAY = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  function low1(x) { return x.charAt(0).toLowerCase() + x.slice(1); }
  function stepText(st) { return st.edit ? st.text.replace('{v}', st.edit.value) : st.text; }
  function first(p) { return p.short.split(' ')[0]; }
  function hisHer(p) { return /\band\b/.test(p.name) ? 'their' : ({ 'p-ravi': 1, 'p-owen': 1, 'p-dev': 1, 'p-marcus': 1, 'p-kim': 0 })[p.id] ? 'his' : 'her'; }
  var PLANS = {
    pause: function (p, o) {
      var when = MONTHS[o.month] || 'Mon, Feb 1', mon = cap(o.month), steps = [], ups = state.upcoming.filter(function (u) { return u.person === p.id; });
      steps.push({ op: 'say', text: 'Tell ' + first(p) + ' by ' + (p.texting === 'opted' && !ups.length ? 'text' : 'email') + ': "{v}"', args: { person: p.id, ch: p.texting === 'opted' && !ups.length ? 'text' : 'email', subj: 'Pausing until ' + mon },
        edit: { label: 'Message to ' + first(p), value: 'No problem, ' + first(p) + '. ' + (ups.length ? 'I\'ll take ' + FULLDAY[ups[0].day] + ' off the calendar and ' : 'I\'ll ') + 'check in at the start of ' + mon + '.' } });
      ups.forEach(function (u) { steps.push({ op: 'cancelUp', text: 'Cancel the ' + u.day + ' ' + u.time + ' ' + u.short.replace(/ with .*/, '').toLowerCase() + ' and its reminder', args: { ids: [u.id], person: p.id } }); });
      var follow = p.handling.filter(function (h) { return h.kind !== 'checkin' && !(ups.length && h.kind === 'remind'); });
      if (follow.length) steps.push({ op: 'dropHandling', text: 'Stop ' + follow.length + ' scheduled follow-up' + (follow.length > 1 ? 's' : '') + ' (' + follow.map(function (h) { return low1(h.text.split(':')[0]) + ', ' + h.when; }).join('; ') + ')', args: { person: p.id, ids: follow.map(function (h) { return h.id; }) } });
      steps.push({ op: 'addHandling', text: 'Set a check-in for {v}', args: { person: p.id, text: 'Check in about restarting the search', kind: 'checkin', pb: (personPb(p) || {}).id || '' }, edit: { label: 'Check-in date', value: when } });
      var decs = state.decisions.filter(function (d) { return d.person === p.id && (d.status === 'open' || d.status === 'blocked'); });
      decs.forEach(function (d) { steps.push({ op: 'defer', text: 'Move "' + d.tab + '" off Today, into the ' + when.replace(/^\w+, /, '') + ' check-in', args: { ids: [d.id], to: when } }); });
      var ppb = personPb(p); if (ppb) steps.push({ op: 'clientPause', text: 'Show ' + first(p) + ' as paused until ' + mon + ' in the ' + ppb.name + ' playbook (it still covers every other ' + ppb.one + ')', args: { pb: ppb.id, person: p.id, text: 'Paused until ' + mon } });
      steps.push({ op: 'stage', text: 'Write a note to ' + first(p) + ' in Follow Up Boss: paused until ' + mon, args: { person: p.id, note: 'Paused until ' + mon + ' (you told Ida)' } });
      return { title: first(p) + ' is pausing until ' + mon, steps: steps };
    },
    nobook: function (p, o) {
      var d = o.day, D = FULLDAY[d], steps = [{ op: 'blockDay', text: 'Stop offering ' + D + ' times to anyone, on every responsibility', args: { day: d } }];
      state.decisions.forEach(function (x) { if (x.kind === 'choice' && x.status === 'open' && (x.options || []).some(function (op) { return op.opt === 'allow' && new RegExp(D, 'i').test(op.label + ' ' + x.q); })) steps.push({ op: 'dropOption', text: 'On Today, "' + x.tab + '": drop "Allow", keep "Offer Friday 5 pm"', args: { dec: x.id, opt: 'allow', day: d } }); });
      state.playbooks.forEach(function (r) { if (r.status !== 'stopped' && /consultation|book/i.test(r.scope.say)) steps.push({ op: 'pbScope', text: 'Change the ' + r.name + ' playbook to offer no ' + D + ' times, for every ' + r.one, args: { pb: r.id, field: 'say', add: ' Never offers ' + D + 's.' } }); });
      var kept = state.upcoming.filter(function (u) { return u.day === d; });
      if (kept.length) steps.push({ op: 'info', info: true, text: 'Not changed: what\'s already on ' + D + ' stays booked (' + kept.map(function (u) { return u.short + ' ' + u.time; }).join(', ') + '). Tell Ida if any of it should move.' });
      return { title: 'No new bookings on ' + D, steps: steps };
    },
    spoke: function (p, o) {
      var steps = [], decs = state.decisions.filter(function (d) { return d.person === p.id && (d.status === 'open' || d.status === 'blocked'); });
      var follow = p.handling.filter(function (h) { return h.kind !== 'checkin'; });
      if (follow.length) steps.push({ op: 'dropHandling', text: 'Stop Ida\'s follow-ups to ' + first(p) + ' (' + follow.map(function (h) { return low1(h.text); }).join('; ') + ')', args: { person: p.id, ids: follow.map(function (h) { return h.id; }) } });
      decs.forEach(function (d) { steps.push({ op: 'resolve', text: 'Close "' + d.tab + '" on Today: you spoke with ' + first(p) + ' yourself', args: { ids: [d.id], line: 'You spoke with ' + p.name + ' directly.' } }); });
      steps.push({ op: 'expect', text: 'Write a note to ' + first(p) + ' in Follow Up Boss: ' + (hisHer(p) === 'his' ? 'he' : 'she') + ' will ' + o.how + ' you (tentative)', args: { person: p.id, text: 'Will ' + o.how + ' you', status: 'tentative', work: 'Take ' + hisHer(p) + ' ' + (o.how === 'call' ? 'call' : 'message') } });
      steps.push({ op: 'addHandling', text: 'Remind you on {v} if ' + first(p) + ' hasn\'t been in touch. Ida doesn\'t contact ' + first(p), args: { person: p.id, text: 'Remind you if ' + first(p) + ' hasn\'t been in touch (Ida doesn\'t contact ' + first(p) + ')', kind: 'checkin', pb: (personPb(p) || {}).id || '' }, edit: { label: 'Remind you on', value: 'Wed 5:00 pm' } });
      steps.push({ op: 'info', info: true, text: 'Not changed: Ida sends ' + first(p) + ' nothing about this.' });
      return { title: 'You spoke with ' + p.name + '; ' + (hisHer(p) === 'his' ? 'he' : 'she') + '\'ll ' + o.how + ' you', steps: steps };
    },
    stoptext: function (p) {
      var steps = [{ op: 'texting', text: 'Switch ' + p.name + ' to email only', args: { person: p.id, value: 'email' } }];
      var tx = p.handling.filter(function (h) { return h.ch === 'text'; });
      tx.forEach(function (h) { steps.push({ op: 'handlingCh', text: 'Send "' + h.text + '" (' + h.when + ') by email instead of text', args: { person: p.id, ids: [h.id] } }); });
      steps.push({ op: 'stage', text: 'Write a note to ' + first(p) + ' in Follow Up Boss: email only, no texts', args: { person: p.id, note: 'Email only, no texts (you told Ida)' } });
      steps.push({ op: 'info', info: true, text: 'Not changed: Ida doesn\'t tell ' + first(p) + ' about this; emails continue as planned.' });
      return { title: 'Stop texting ' + p.name, steps: steps };
    },
    note: function (p, o) {
      return { title: 'Add a note for ' + p.name, steps: [{ op: 'note', text: 'Write a note to ' + first(p) + ' in Follow Up Boss: "{v}"', args: { person: p.id }, edit: { label: 'Note', value: o.text } },
        { op: 'info', info: true, text: 'Not changed: Ida\'s schedule for ' + first(p) + ' stays as it is. Tell Ida what should change if something should.' }] };
    }
  };
  function buildPlan(kind, pid, o, text) {
    var p = pid && person(pid); if (kind !== 'nobook' && !p) return null;
    var plan = PLANS[kind](p, o); plan.kind = kind; plan.o = o; plan.person = p ? p.id : ''; plan.instruction = text;
    plan.steps.forEach(function (st, i) { st.id = 'st' + (i + 1); });
    return plan;
  }
  function parseChange(text) {
    var t = String(text || '').trim(), low = t.toLowerCase(), m, who = findPeople(t), alts = who.map(function (p) { return { id: p.id, name: p.name, role: p.role }; });
    var kind = null, o = {};
    if ((m = low.match(/\b(?:don'?t|do not|no|stop)\s+(?:book|schedul)\w*\b.*?\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/))) { kind = 'nobook'; o.day = DAYNAMES[m[1] + 'day']; }
    else if (who.length && /\b(stop|don'?t|do not|no more|quit)\s+(texting|texts?|sending texts)\b/.test(low)) kind = 'stoptext';
    else if (who.length && (m = low.match(/\b(?:paus\w*|on hold|hold\w* off|taking a break|wait\w*|not looking)\b.*?\buntil\s+(january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|next year)\b/))) { kind = 'pause'; o.month = m[1]; }
    else if (who.length && /\b(spoke|talked|chatted|met|caught up)\s+(with|to)\b/.test(low) && (m = low.match(/\b(call|email|text)s?\s+me\b|\bget\s+back\s+to\s+me\b/))) { kind = 'spoke'; o.how = m[1] || 'get back to'; }
    if (!kind) return null;
    var plan = buildPlan(kind, who.length ? who[0].id : '', o, t); if (!plan) return null;
    if (kind !== 'nobook' && alts.length > 1) plan.alts = alts;
    return plan;
  }
  function notePlan(text) {
    var who = findPeople(text); if (!who.length) return null;
    if (!/^(i|we)\b|\b(she|he|they)('s|'ll| is| are| will| wants?| said)\b|\b(said|says|told me|mentioned)\b/i.test(text)) return null;
    var plan = buildPlan('note', who[0].id, { text: cap(you(String(text).trim())) }, text); if (who.length > 1) plan.alts = who.map(function (p) { return { id: p.id, name: p.name, role: p.role }; }); return plan;
  }
  function applyStep(s, st, plan) {
    var a = st.args || {}, p = a.person && byId(s.people, a.person), v = st.edit ? String(st.edit.value || '').trim().slice(0, 500) : '';
    switch (st.op) {
      case 'say': if (!p || !v) return false; tellPerson(s, p, a.ch, a.subj, v, v, 'from your change plan'); return true;
      case 'cancelUp': s.upcoming = s.upcoming.filter(function (u) { return a.ids.indexOf(u.id) < 0; }); if (p) { p.expects.forEach(function (x) { if (/consultation|showing/i.test(x.text) && x.status !== 'cancelled') { x.status = 'cancelled'; x.work = ''; } }); dropHandling(p, function (h) { return h.kind === 'remind'; }); } return true;
      case 'dropHandling': if (!p) return false; dropHandling(p, function (h) { return a.ids.indexOf(h.id) >= 0; }); return true;
      case 'addHandling': if (!p) return false; p.handling.push({ id: nid('h'), text: a.text, when: v || 'Soon', pb: a.pb || '', duty: '', kind: a.kind || 'other', ch: p.texting === 'opted' ? 'text' : 'email' }); return true;
      case 'defer': a.ids.forEach(function (id) { var d = byId(s.decisions, id); if (d) { d.prevStatus = d.status; d.status = 'moved'; d.movedTo = a.to; } }); if (p) p.expects.forEach(function (x) { if (a.ids.indexOf(x.dec) >= 0) { x.text += ' (moved to ' + a.to + ')'; x.status = 'tentative'; } }); return true;
      case 'clientPause': var r = byId(s.playbooks, a.pb); if (!r) return false; r.info[a.person] = Object.assign(own(r.info, a.person) || {}, { pausedUntil: a.text }); return true;
      case 'stage': if (!p) return false; p.notes.push({ t: stamp(), text: a.note || st.text }); return true;
      case 'blockDay': if (s.blocked.indexOf(a.day) < 0) s.blocked.push(a.day); return true;
      case 'dropOption': var d = byId(s.decisions, a.dec); if (!d) return false; d.options = d.options.filter(function (x) { return x.opt !== a.opt; }); d.situation += ' You also told Ida not to book anyone on ' + FULLDAY[a.day] + '.'; return true;
      case 'pbScope': var r2 = byId(s.playbooks, a.pb); if (!r2) return false; r2.scope[a.field] = r2.scope[a.field] + a.add; return true;
      case 'resolve': a.ids.forEach(function (id) { var d2 = byId(s.decisions, id); if (d2) { d2.status = 'done'; d2.chosen = 'you'; d2.doneAt = nowTime(); d2.doneLine = a.line; } }); return true;
      case 'expect': if (!p) return false; p.expects.push({ id: nid('x'), text: a.text, status: a.status, work: a.work }); p.notes.push({ t: stamp(), text: a.text + ' (' + a.status + ')' }); return true;
      case 'texting': if (!p) return false; p.texting = a.value; return true;
      case 'handlingCh': if (!p) return false; p.handling.forEach(function (h) { if (a.ids.indexOf(h.id) >= 0) h.ch = 'email'; }); return true;
      case 'note': if (!p || !v) return false; p.notes.push({ t: stamp(), text: v }); return true;
    }
    return false;
  }

  /* ---------- Handing Ida a responsibility ----------
     Keyword templates propose a scope in plain words; the owner edits it and approves once. */
  function channelLine(ids, more) {
    var ps = ids.map(person).filter(Boolean), opted = ps.filter(function (p) { return p.texting === 'opted'; }).length;
    return 'Texts only people who opted in' + (ps.length ? ' (' + opted + ' of ' + ps.length + ' named' + (more ? ', plus any of the ' + more + ' others who opted in' : '') + ')' : '') + '; everyone else gets email. A reply of STOP ends texting at once.';
  }
  var GOALS = [
    { tpl: 'openhouse', rx: /open[- ]?house/i },
    { tpl: 'reengage', rx: /re-?engage|went quiet|gone quiet|cold leads|old leads|past leads|quiet leads|haven'?t (heard|replied)|stopped replying|wake up|revive/i },
    { tpl: 'docs', rx: /(missing|chase|outstanding|collect).*(doc|signature|disclosure|paperwork|letter)|paperwork/i },
    { tpl: 'closing', rx: /\bclosing\b|close on time|on track to close|coordinat\w* (the )?clos/i }
  ];
  function goalTpl(text) { for (var i = 0; i < GOALS.length; i++) if (GOALS[i].rx.test(text)) return GOALS[i].tpl; return null; }
  /* A goal becomes a duty in the playbook for one client type. "for all my buyer deals" or
     "for new seller listings" picks the type; otherwise the template's type is used. */
  function typeFrom(t, dflt) {
    var m = /\b(buyer|seller|lead)s?\b/i.exec(t); if (m) return m[1].toLowerCase();
    if (/listing|showing report|offer/i.test(t)) return 'seller';
    if (/closing|inspection|apprais|lender|purchase/i.test(t)) return 'buyer';
    if (/\blead|open[- ]?house|consultation|prospect/i.test(t)) return 'lead';
    return dflt;
  }
  function proposal(text, forceGeneric) {
    var t = String(text || '').trim(), tpl = goalTpl(t) || (forceGeneric ? 'generic' : null);
    if (!tpl) return null;
    var pb, du = null, pr;
    var covered = function (type, did, why) { var b = pbByType(type), d = duty(b, did); return b && d && d.on && (!d.only || !d.only.length) ? { tpl: tpl, existing: b.id, duty: d.id, why: why } : null; };
    if (tpl === 'openhouse') { var c1 = covered('lead', 'du-oh', 'Open-house follow-up already runs for every lead, and applies automatically to each new open house, including Saturday\'s at 17 Ash St.'); if (c1) return c1; }
    if (tpl === 'docs') { var c2 = covered(typeFrom(t, 'buyer'), typeFrom(t, 'buyer') === 'seller' ? 'du-disclosure' : 'du-lender', 'Document chase already runs for every ' + TYPE_NAMES[typeFrom(t, 'buyer')][0] + ', including new ones.'); if (c2) return c2; }
    if (tpl === 'closing' && (typeFrom(t, 'buyer') !== 'buyer' || !/on track|on time|deadline|coordinat/i.test(t))) tpl = 'generic';
    if (tpl === 'closing') { var c3 = covered('buyer', 'du-deadlines', 'Keeping closing on track already runs for every buyer deal, including new ones.'); if (c3) return c3; }
    if (tpl === 'reengage') {
      pb = pbByType('lead'); du = duty(pb, 'du-reengage');
      pr = { title: 'Re-engage quiet leads', say: 'One short note in your voice: are they still looking, and would a quick call help? Uses only what they asked about before. No prices.',
        cadence: 'One message, one follow-up a week later, then stops', stop: 'They reply, say no, or opt out', toYou: 'Anyone who wants to talk, and anyone who asks about price',
        next: { text: 'First note to quiet leads', when: 'Tue 10:00 am' }, quietOnly: true, suggestOnly: pbClients(pb).filter(function (p) { var i = own(pb.info, p.id); return i && i.quiet; }).map(function (p) { return p.id; }) };
    } else {
      var type = typeFrom(t, 'lead'); pb = pbByType(type);
      pr = { title: cap(you(t.replace(/\s*for (all )?(my )?(new )?(buyer deals?|seller listings?|leads?)\b/i, ''))).slice(0, 140),
        say: 'Ida drafts in your voice using only what\'s in your deals and sources, and asks you before anything outside this scope.',
        cadence: 'Every 3 days, up to 3 times', stop: 'The outcome is reached, they reply, or they opt out', toYou: 'Anything outside your rules, any price or fee, and anyone who asks for you',
        next: { text: 'First run for each ' + pb.one, when: 'Tue 9:00 am' }, suggestOnly: findPeople(t).filter(function (p) { return p.type === pb.type; }).map(function (p) { return p.id; }) };
    }
    var all = pbCovered(pb);
    pr.tpl = tpl; pr.pb = pb.id; pr.duty = du ? du.id : ''; pr.type = pb.type; pr.pbName = pb.name; pr.one = pb.one; pr.many = pb.many;
    pr.clients = all.map(function (p) { return { id: p.id, name: p.name }; });
    pr.who = (all.length === 1 ? 'Your 1 ' + pb.one : 'All ' + all.length + ' ' + pb.many) + ' (' + all.map(function (p) { return p.name; }).join(', ') + '), and every new ' + pb.one;
    pr.auto = 'Applies automatically to new ' + pb.many;
    if (pr.quietOnly) pr.auto = 'Applies automatically to any lead who goes quiet. Starts with the ' + pr.suggestOnly.length + ' quiet now: ' + pr.suggestOnly.map(function (id) { return person(id).name; }).join(' and ');
    pr.channel = channelLine(all.map(function (p) { return p.id; }), 0);
    return pr;
  }
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
    EVENT_TYPES: EVENT_TYPES, SEND_DELAY: SEND_DELAY, SEND_RULE: SEND_RULE, CHOOSE_RULE: CHOOSE_RULE, LEVELS_N: LEVELS_N, STAGES: STAGES, DEAL_NAMES: DEAL_NAMES,
    TYPE_NAMES: TYPE_NAMES,
    q: { crm: crm, told: told, decLive: decLive, idaOff: idaOff, isWork: isWork, setAside: setAside, asideDecisions: asideDecisions, blockedFor: blockedFor, stuckFix: stuckFix, expectFor: expectFor, msgAt: msgAt, personNeeds: personNeeds, holdOf: holdOf, nextFor: nextFor, sentHold: sentHold, draftProblem: draftProblem, plain: plain, headVal: headVal, outbox: function () { return state.outbox || []; }, person: person, playbook: playbook, pbByType: pbByType, personPb: personPb, duty: duty, pbClients: pbClients, pbCovered: pbCovered, dutyFor: dutyFor, clientStatus: clientStatus, pbStatus: pbStatus, clientCount: clientCount, level: level, nowEvents: nowEvents, briefEvents: briefEvents, personDecisions: personDecisions, personEvents: personEvents, findPeople: findPeople, app: app, wf: wf, wfByName: wfByName, task: task, rule: rule, decision: decision, wfPause: wfPause, taskLevel: taskLevel, taskCol: taskCol, canHand: canHand, handReady: handReady, wfRecord: wfRecord, taskNote: taskNote, taskHold: taskHold, counts: counts, problems: problems, openDecisions: openDecisions, needsYou: needsYou, sentCount: sentCount, levelDown: levelDown, deal: deal, findDeal: findDeal, findPerson: findPerson },
    act: act,
    parse: { change: parseChange, notePlan: notePlan, rebuildPlan: function (pl, pid) { var n = buildPlan(pl.kind, pid, pl.o, pl.instruction); if (n) n.alts = pl.alts; return n; }, stepText: stepText, goal: goalTpl, proposal: proposal, rule: parseRule, ruleMeaning: ruleMeaning, task: parseTask, guessArea: guessArea },
    util: { esc: esc, safeHtml: safeHtml, own: own, cap: cap, nowTime: nowTime, appLogo: appLogo, appIcon: function (id) { return own(APP_ICONS, id); } },
    doc: function (id) { return own(DOCS, id); }
  });
  /* Anything queued before this page loaded and now past its 10 seconds goes out first. */
  try { act.flush(); } catch (e) { if (window.console) console.error(e); }
})();
