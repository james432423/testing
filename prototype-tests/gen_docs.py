"""Generate the fictional source documents for the Ida prototype.

Writes site2/docs/<id>.pdf (the "original" files) and site2/ida-doctext.js
(the same text, page by page, for the Readable view). One source of truth:
every page in the PDF is built from the same blocks the Readable view shows.
All names, addresses and numbers are fictional sample data.

Usage: python3 gen_docs.py <site2 dir> <docs.json exported from ida-store.js>
"""
import json, os, subprocess, sys
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)

SITE, DOCS_JSON = sys.argv[1], sys.argv[2]
DOCS = json.load(open(DOCS_JSON))
OUT = os.path.join(SITE, 'docs')
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- blocks
# ('h', text) | ('p', text) | ('item', name, rating, text) | ('kv', [(k, v)])
# ('ul', [text]) | ('table', [head], [[row]]) | ('sig', [lines]) | ('small', text)

def cited_page(d, head=None):
    """The cited page built from the store's before / cite / after text."""
    b = [('h', head or d['head'])]
    b += [('p', x) for x in d.get('before', [])]
    b.append(('p', d['cite']))
    b += [('p', x) for x in d.get('after', [])]
    return b

# ---------------------------------------------------------------- inspection reports
def inspection(prop, client, date, extra_pages, n_pages, built, sqft, insp_time):
    P = {}
    P[1] = [('h', 'Inspection summary'),
            ('kv', [('Property', prop + ' · single-family, 2 stories, built ' + built + ', about ' + sqft + ' sq ft'),
                    ('Client', client + ' (buyers)'),
                    ('Inspected', date + ' · ' + insp_time + ' · weather clear, 61°F'),
                    ('Inspector', 'Bay Area Inspections · license on file · sample report')]),
            ('p', 'This report records the condition of the visible, accessible parts of the home on the day of inspection. '
                  'Items are rated Satisfactory, Monitor or Repair. Repair items are listed with a recommendation; the inspector does not estimate costs.')]
    bank = [
        ('Roof and gutters', [('Roof covering', 'Satisfactory', 'Architectural asphalt shingles, about 6 years old. No missing or lifted shingles observed. Flashing at the chimney is sealed.'),
                              ('Gutters and downspouts', 'Satisfactory', 'Gutters are clear. Downspouts discharge at least 4 feet from the foundation.')]),
        ('Exterior: decks, balconies and railings', [('Rear deck structure', 'Satisfactory', 'Pressure-treated framing on concrete footings. Ledger is flashed and bolted to the house. No soft or decayed boards found.'),
                              ('Front porch steps', 'Satisfactory', 'Handrail is secure. Riser heights are even.')]),
        ('Exterior: siding, windows and doors', [('Siding', 'Satisfactory', 'Fiber-cement lap siding in good condition. Caulk at window trim is intact.'),
                              ('Windows', 'Satisfactory', 'Double-pane vinyl windows open and lock. No failed seals observed.'),
                              ('Exterior doors', 'Satisfactory', 'Weatherstripping is intact at the front and rear doors.')]),
        ('Foundation and grading', [('Foundation walls', 'Monitor', 'Minor efflorescence on the north foundation wall, about 3 feet wide. No active moisture at the time of inspection. Keep gutters clear and recheck after heavy rain.'),
                              ('Grading', 'Satisfactory', 'Soil slopes away from the house on all sides.')]),
        ('Garage', [('Garage door and opener', 'Satisfactory', 'Auto-reverse works when the door meets resistance. Photo-eyes are mounted at the correct height.'),
                    ('Fire separation door', 'Satisfactory', 'Solid-core door between the garage and the house closes and latches.')]),
        ('Attic and insulation', [('Attic access', 'Satisfactory', 'Pull-down stair in the hall closet. Hardware is secure.'),
                                  ('Insulation', 'Satisfactory', 'Blown-in fiberglass, about 12 inches deep. Bathroom fans vent to the exterior.')]),
        ('Electrical: service and panel', [('Service panel', 'Satisfactory', '200 amp panel in the garage. Breakers are labeled. No double-tapped breakers.'),
                                           ('Exterior outlets', 'Repair', 'GFCI protection is missing at the exterior outlet by the rear deck. Recommend a licensed electrician install GFCI protection.')]),
        ('Electrical: branch circuits and outlets', [('Interior outlets', 'Satisfactory', 'A sample of outlets in each room tested correctly for polarity and ground.'),
                                                     ('Light fixtures', 'Satisfactory', 'Fixtures and switches operated normally.')]),
        ('Heating: overview', [('Heating system', 'Satisfactory', 'Gas forced-air furnace with ducted supply to every room. Thermostat responded to calls for heat.')]),
        ('Heating: furnace', [('Furnace', 'Satisfactory', 'Gas furnace, 80,000 BTU, about 9 years old. Service sticker shows it was serviced in March 2026. Filter is clean.'),
                              ('Venting', 'Satisfactory', 'Flue connections are sealed and slope up toward the chimney.')]),
        ('Cooling', [('Air conditioner', 'Satisfactory', 'Split system, 3 tons, about 9 years old. Temperature drop across the coil measured 18°F.')]),
        ('Plumbing: water heater', [('Water heater', 'Monitor', 'Gas water heater, 40 gallons, about 11 years old. Strapping present. Typical service life is 10 to 15 years; budget for replacement.')]),
        ('Plumbing: supply and drains', [('Supply piping', 'Satisfactory', 'Copper supply lines. Water pressure measured 62 psi at the hose bib.'),
                                         ('Drains', 'Satisfactory', 'All fixtures drained without backup.')]),
        ('Kitchen', [('Appliances', 'Satisfactory', 'Range, dishwasher and disposal operated normally.'),
                     ('Sink and counters', 'Satisfactory', 'Sink is sealed at the counter. No leaks under the sink.')]),
        ('Laundry', [('Dryer vent', 'Satisfactory', 'Rigid metal duct vents to the exterior. Lint screen is clean.')]),
        ('Bathrooms: primary', [('Shower and tub', 'Satisfactory', 'Grout and caulk are intact. Drain flows freely.'),
                                ('Ventilation', 'Satisfactory', 'Exhaust fan operates and vents to the exterior.')]),
        ('Bathrooms: hall and half bath', [('Fixtures', 'Satisfactory', 'Toilets are secure to the floor. Sinks drain normally.')]),
        ('Interior: floors, walls and ceilings', [('Floors', 'Satisfactory', 'Hardwood on the main floor and carpet upstairs show normal wear.'),
                                                  ('Walls and ceilings', 'Satisfactory', 'No stains or cracks that suggest moisture or movement.')]),
        ('Interior: doors and stairs', [('Stairs', 'Satisfactory', 'Handrail is continuous and secure. Balusters are spaced less than 4 inches apart.')]),
        ('Fireplace and chimney', [('Fireplace', 'Satisfactory', 'Wood-burning fireplace with a working damper. Recommend a chimney sweep before first use.')]),
        ('Smoke and carbon monoxide alarms', [('Alarms', 'Satisfactory', 'Smoke alarms present in each bedroom and hallway. Carbon monoxide alarm present on each floor.')]),
        ('Crawlspace', [('Vapor barrier', 'Satisfactory', 'Plastic vapor barrier covers the soil. No standing water.')]),
        ('Landscaping and drainage', [('Trees and shrubs', 'Satisfactory', 'Vegetation is trimmed back from the siding and roof.')]),
        ('Driveway and walkways', [('Driveway', 'Satisfactory', 'Concrete driveway with minor settlement cracks typical for its age.')]),
        ('Fences and gates', [('Fence', 'Satisfactory', 'Wood fence is upright. Side gate latches.')]),
    ]
    page = 3
    for title, items in bank:
        if page in P: page += 1
        while page in extra_pages: page += 1
        if page > n_pages - 3: break
        P[page] = [('h', title)] + [('item',) + it for it in items]
        page += 1
    for k, v in extra_pages.items(): P[k] = v
    P[n_pages - 2] = [('h', 'Maintenance notes'),
                      ('ul', ['Replace the furnace filter every three months.', 'Clean gutters each fall and spring.',
                              'Test smoke and carbon monoxide alarms monthly.', 'Recaulk tubs and showers when gaps appear.'])]
    P[n_pages - 1] = [('h', 'Standards of practice and limitations'),
                      ('p', 'This inspection follows the standards of practice of the state home inspector association. It is a visual, non-invasive inspection of readily accessible systems and components on the day of inspection.'),
                      ('p', 'The inspector does not move furniture, open walls or predict future conditions. This report is not a warranty or a guarantee.')]
    P[n_pages] = [('h', 'Inspector certification'),
                  ('p', 'I certify that I personally inspected the property and that this report reflects my findings on the date of inspection.'),
                  ('sig', ['Inspector signature on file', 'Bay Area Inspections · sample report · ' + date])]
    for i in range(1, n_pages + 1):
        if i not in P:  # nothing left to fill: short photo index page
            P[i] = [('h', 'Photo index'), ('p', 'Photos for the sections above are kept in the online copy of this report.')]
    return P

def pin(P, page, title):
    for k, v in list(P.items()):
        if v and v[0] == ('h', title) and k != page:
            P[k], P[page] = P[page], v

lin = DOCS['linden-inspection']
lin_p = inspection('412 Linden Ct', 'Jen and Tom Park', 'Saturday, October 11, 2026', {
    2: [('h', 'Summary of findings'), ('ul', ['Repair · Rear deck guardrail (page 4)', 'Repair · GFCI protection missing at one exterior outlet (page 9)',
                                               'Monitor · Minor efflorescence on north foundation wall (page 6)', 'Monitor · Water heater is 11 years old (page 14)',
                                               'Satisfactory · Roof covering, about 6 years old (page 3)', 'Satisfactory · Furnace, serviced March 2026 (page 12)'])],
    4: [('h', 'Exterior: decks, balconies and railings'),
        ('item', 'Rear deck structure', 'Satisfactory', 'Pressure-treated framing on concrete footings. Ledger is flashed and bolted to the house. No soft or decayed boards found.'),
        ('item', 'Rear deck guardrail', 'Repair', lin['cite'] + ' Measured guard height is about 32 inches; current guidance for decks is at least 36 inches.'),
        ('item', 'Front porch steps', 'Satisfactory', 'Handrail is secure. Riser heights are even.')],
}, 31, '1987', '2,140', '9:00 am to 12:30 pm')
pin(lin_p, 3, 'Roof and gutters'); pin(lin_p, 5, 'Exterior: siding, windows and doors'); pin(lin_p, 6, 'Foundation and grading')
pin(lin_p, 9, 'Electrical: service and panel'); pin(lin_p, 12, 'Heating: furnace'); pin(lin_p, 14, 'Plumbing: water heater')
lin_p[2] = [('h', 'Summary of findings'), lin_p[2][1]]
# a swapped-out deck page must not reappear twice
seen = set()
for k in sorted(lin_p):
    t = lin_p[k][0]
    if t in seen and k != 4: lin_p[k] = [('h', 'Photo index'), ('p', 'Photos for the sections above are kept in the online copy of this report.')]
    seen.add(t)

hol = DOCS['hollis-inspection']
hol_p = inspection('9 Hollis Way', 'Ruth and David Okafor', 'Friday, October 9, 2026', {
    2: [('h', 'Summary of findings'), ('ul', ['Repair · Water heater near end of service life (page 12)', 'Satisfactory · Garage door and opener (page 7)',
                                               'Satisfactory · Roof covering (page 3)', 'Satisfactory · Electrical panel (page 9)'])],
    12: cited_page(hol, 'Plumbing · Water heater'),
}, 28, '1979', '1,960', '1:00 pm to 4:15 pm')
pin(hol_p, 3, 'Roof and gutters'); pin(hol_p, 7, 'Garage'); pin(hol_p, 9, 'Electrical: service and panel')
hol_p[9] = [('h', 'Electrical: service and panel'), ('item', 'Service panel', 'Satisfactory', '200 amp panel in the garage. Breakers are labeled. No double-tapped breakers.')]
for k in sorted(hol_p):
    if k != 12 and hol_p[k][0] == ('h', 'Plumbing: water heater'):
        hol_p[k] = [('h', 'Plumbing: fixtures'), ('item', 'Faucets', 'Satisfactory', 'All faucets run hot and cold on the correct sides.')]

# ---------------------------------------------------------------- purchase agreements
def agreement(d, deal, buyers, sellers, price, closing_text, option_text, signed, cited_at):
    S = [
        ('Section 1 · Parties', 'Seller, ' + sellers + ', agrees to sell and convey to Buyer, ' + buyers + ', and Buyer agrees to buy from Seller the Property described below.'),
        ('Section 2 · Property', 'The land, improvements and accessories known as ' + deal + ', together with all fixtures attached to the Property, except as excluded in writing.'),
        ('Section 3 · Sales price', 'The total sales price is ' + price + ', payable as cash portion paid by Buyer at closing and the balance through third-party financing described in the Financing Addendum.'),
        ('Section 4 · Closing', closing_text),
        ('Section 5 · Option period', option_text),
        ('Section 6 · Title policy and survey', 'Seller shall furnish to Buyer an owner policy of title insurance issued by Lone Oak Title in the amount of the sales price. Buyer may object to title defects within 5 days after receiving the commitment.'),
        ('Section 7 · Property condition', 'Buyer accepts the Property in its present condition, subject to any repairs agreed in writing during the Option Period. Seller shall deliver the Seller Disclosure Notice within 3 days.'),
        ('Section 8 · Brokers', 'The brokers named in this contract are paid only under separate written agreements. Brokers do not give legal or tax advice.'),
        ('Section 9 · Closing costs', 'Each party pays its own closing costs as customary in the county, except as stated in a written addendum.'),
        ('Section 10 · Prorations', 'Taxes for the current year, HOA dues and assessments are prorated through the closing date.'),
        ('Section 11 · Casualty loss', 'If any part of the Property is damaged before closing, Seller shall restore it to its previous condition or Buyer may terminate this contract.'),
        ('Section 12 · Default', 'If either party fails to comply with this contract, the other party may seek specific performance or terminate and receive the earnest money as its remedy.'),
        ('Section 13 · Mediation', 'The parties agree to negotiate in good faith to resolve any dispute and, if unresolved, to submit it to mediation before going to court.'),
        ('Section 14 · Escrow', 'The escrow agent holds the earnest money and is not a party to this contract. The escrow agent may require a written release from both parties.'),
        ('Section 15 · Notices', 'All notices must be in writing and are effective when delivered by hand, mail or email to the addresses listed on the signature page.'),
        ('Section 16 · Agreement of parties', 'This contract contains the entire agreement of the parties and cannot be changed except by written agreement.'),
        ('Section 17 · Consult an attorney', 'Brokers cannot give legal advice. Read this contract carefully. If you do not understand its effect, consult an attorney before signing.'),
    ]
    P = {}
    # place sections so the cited one lands on the cited page
    cited_idx = 3 if cited_at == 'closing' else 4
    cp = d['page']
    before = S[:cited_idx]
    per = max(1, -(-len(before) // max(1, cp - 1))) if cp > 1 else 0
    pg = 1
    for i, (t, x) in enumerate(before):
        if cp > 1:
            pg = min(cp - 1, 1 + i // per)
        P.setdefault(pg, []).extend([('h', t), ('p', x)])
    P.setdefault(cp, []).extend(cited_page(d))
    rest = S[cited_idx + 1:]
    pg = cp + 1
    for i in range(0, len(rest), 2):
        for t, x in rest[i:i + 2]:
            P.setdefault(pg, []).extend([('h', t), ('p', x)])
        pg += 1
    add = 1
    while pg < 14:
        P[pg] = [('h', 'Addendum ' + str(add)), ('p', 'Intentionally left blank unless initialed by both parties.')]
        pg += 1; add += 1
    P[14] = [('h', 'Signatures'), ('kv', [('Buyer', buyers), ('Seller', sellers), ('Executed', signed)]),
             ('sig', ['Signed electronically by all parties', 'Escrow agent: Lone Oak Title, 88 Main St'])]
    for i in range(1, 15):
        if i not in P: P[i] = [('h', 'Continued'), ('p', 'This page continues the terms above.')]
    if 1 not in P or P[1][0][0] != 'h': pass
    P[1] = [('small', 'Residential purchase agreement · sample form')] + P[1]
    return P

la, aa = DOCS['linden-agreement'], DOCS['ash-agreement']
la_p = agreement(la, '412 Linden Ct', 'Jen and Tom Park', 'Henry and Carol Wu', '$548,000', la['cite'],
                 'The Option Period ended at 5:00 p.m. on September 25, 2026.', 'September 18, 2026', 'closing')
# section 4 on the cited page is the store's own text; drop the duplicate generic one
aa_p = agreement(aa, '17 Ash St', 'Linh and Thao Nguyen', 'Luis and Ana Garcia', '$625,000',
                 'Closing shall occur on or before November 6, 2026 at the offices of Lone Oak Title.', aa['cite'], 'October 3, 2026', 'option')

# ---------------------------------------------------------------- appraisal
ap = DOCS['ash-appraisal']
ap_p = {
    1: [('h', 'Appraisal report summary'),
        ('kv', [('Subject', '17 Ash St · single-family'), ('Borrowers', 'Linh and Thao Nguyen'), ('Lender', 'Northgate Mortgage'),
                ('Contract price', '$625,000'), ('Effective date', 'October 8, 2026'), ('Opinion of value', '$612,000')]),
        ('p', 'The purpose of this appraisal is to provide the lender with an opinion of the market value of the subject property as of the effective date.')],
    2: cited_page(ap),
    3: [('h', 'Subject'), ('kv', [('Bedrooms', '3'), ('Bathrooms', '2'), ('Living area', '1,840 sq ft'), ('Year built', '1994'), ('Lot', '0.18 acres')])],
    4: [('h', 'Neighborhood'), ('p', 'Established residential area of similar single-family homes built between 1985 and 2000. Values have been stable over the past 12 months.')],
    5: [('h', 'Site'), ('p', 'Rectangular interior lot with public water and sewer. No adverse easements or encroachments were noted.')],
    6: [('h', 'Improvements'), ('p', 'Two-story frame house in average to good condition. Kitchen updated in 2021. Two-car attached garage.')],
    7: [('h', 'Sales comparison grid'), ('table', ['', 'Subject', 'Sale 1', 'Sale 2', 'Sale 3'],
        [['Address', '17 Ash St', '8 Cedar Ct', '31 Maple Row', '120 Fern Dr'], ['Distance', '', '0.3 mi', '0.5 mi', '0.6 mi'],
         ['Sale price', '$625,000', '$605,000', '$618,000', '$600,000'], ['Living area', '1,840', '1,790', '1,880', '1,760'],
         ['Adjusted', '', '$611,500', '$614,000', '$610,500']])],
    8: [('h', 'Comparable sales notes'), ('p', 'Sale 2 is given the most weight as it is the most similar in size, condition and location.')],
    9: [('h', 'Cost approach'), ('p', 'Estimated site value $210,000. Depreciated cost of improvements $395,000. Indicated value by cost approach $605,000.')],
    10: [('h', 'Income approach'), ('p', 'Not developed. Single-family homes in this area are rarely bought as rentals.')],
    11: [('h', 'Additional comments'), ('p', 'No repairs are required as a condition of this appraisal.')],
}
for i, t in enumerate(['Front of subject', 'Rear of subject', 'Street scene', 'Kitchen', 'Living room', 'Primary bathroom'], start=12):
    ap_p[i] = [('h', 'Photographs: ' + t.lower()), ('p', t + '. Photo taken October 8, 2026.')]
ap_p.update({
    18: [('h', 'Location map'), ('p', 'Subject and the three comparable sales are within 0.6 miles of each other.')],
    19: [('h', 'Building sketch'), ('table', ['Area', 'Size'], [['First floor', '980 sq ft'], ['Second floor', '860 sq ft'], ['Total living area', '1,840 sq ft']])],
    20: [('h', 'Flood zone'), ('p', 'Flood zone X. The subject is not in a special flood hazard area.')],
    21: [('h', 'Market conditions'), ('p', 'Median days on market in the area rose from 18 to 26 over the past six months.')],
    22: [('h', 'Scope of work'), ('p', 'The appraiser inspected the interior and exterior of the subject and viewed each comparable from the street.')],
    23: [('h', 'Appraiser certification'), ('p', 'I have no present or prospective interest in the property that is the subject of this report.')],
    24: [('h', 'License'), ('sig', ['Valley Appraisal Group · certified residential appraiser · license on file', 'Sample report'])],
})

# ---------------------------------------------------------------- title commitment
ti = DOCS['linden-title']
ti_p = {
    1: [('small', 'Commitment for title insurance · sample'), ('h', 'Schedule A'),
        ('kv', [('Commitment date', 'September 28, 2026'), ('Policy amount', '$548,000'), ('Proposed insured', 'Jen Park and Tom Park'),
                ('Property', '412 Linden Ct, Lot 14, Block C, Linden Court subdivision')])],
    2: [('h', 'Schedule B · Exceptions'), ('ul', ['Easements and restrictions shown on the recorded plat.', 'Taxes for the current year, not yet due and payable.',
                                                  'Declaration of covenants of the Linden Court Homeowners Association.'])],
    3: [('h', ti['head']), ('p', '1. Payment of the full consideration to, or for the account of, the seller.'),
        ('p', '2. Warranty deed from Henry Wu and Carol Wu to the proposed insured.'), ('p', '3. Deed of trust from the proposed insured to Northgate Mortgage.'),
        ('p', '4. Survey of the property acceptable to the company.')] + cited_page(ti)[1:] + [('p', '8. Payment of all recording fees.')],
    4: [('h', 'Schedule D · Disclosures'), ('p', 'The title company and its underwriter are named in the policy jacket. Premium is set by the state.')],
    5: [('h', 'Commitment conditions'), ('p', 'This commitment ends 6 months after the commitment date unless the policy is issued first.')],
    6: [('h', 'Notices'), ('p', 'For questions contact Maya Ruiz, Lone Oak Title, 88 Main St.'), ('sig', ['Lone Oak Title · authorized signatory', 'Sample document'])],
}

# ---------------------------------------------------------------- offer
of = DOCS['ash-offer']
of_p = {1: cited_page(of)}
for i, (t, x) in enumerate([('Financing', 'Conventional loan for 80% of the purchase price through Northgate Mortgage.'),
                            ('Earnest money', '$6,250 deposited with Lone Oak Title within 3 days of acceptance.'),
                            ('Inspections', 'Buyer will order a general home inspection during the option period.'),
                            ('Appraisal', 'Buyer may terminate if the property appraises below the purchase price.'),
                            ('Closing costs', 'Each party pays its own customary closing costs.'),
                            ('Possession', 'At closing and funding.'),
                            ('Additional terms', 'Seller to leave the refrigerator and the washer and dryer.')], start=2):
    of_p[i] = [('h', t), ('p', x)]
of_p[9] = [('h', 'Signatures'), ('kv', [('Buyers', 'Linh and Thao Nguyen'), ('Received', 'October 10, 2026')])]

# ---------------------------------------------------------------- non-PDF originals (printouts)
def email(d, frm, to, date, subj):
    p = [('kv', [('From', frm), ('To', to), ('Date', date), ('Subject', subj)])]
    p += [('p', x) for x in d['before']] + [('p', d['cite'])] + [('p', x) for x in d['after']]
    return {1: p}

marcus = email(DOCS['marcus-email'], 'Marcus Lee', 'Dana Reyes', 'Sunday, October 11, 2026, 1:14 pm', DOCS['marcus-email']['head'])
marcus[1].append(('small', 'On Sun, Oct 11, 2026 at 12:40 pm Dana Reyes wrote: Hi Marcus, I can show 17 Ash St on Wednesday at 2:30 pm or Thursday at 4:00 pm. Which works better?'))
kim = email(DOCS['kim-email'], 'Kim Alvarez, Northgate Mortgage', 'Dana Reyes', 'Monday, October 12, 2026, 8:52 am', DOCS['kim-email']['head'])

al = DOCS['ash-listing']
al_p = {1: [('small', 'MLS listing printout · sample')] + cited_page(al),
        2: [('h', 'Remarks and details'), ('p', 'Bright corner home on a quiet street, close to the elementary school and the park.'),
            ('kv', [('Heating', 'Gas forced air'), ('Cooling', 'Central air'), ('Taxes', '$7,840 per year'), ('HOA', 'None')])]}
me = DOCS['mercer-listing']
me_p = {1: [('small', 'MLS listing printout · sample'), ('h', '230 Mercer Ave · Active'), ('p', 'List price $389,000. Listed by Dana Reyes, Reyes Realty.'),
            ('p', 'Fourth-floor corner unit with an elevator, in-unit laundry and a balcony facing the courtyard.')],
        2: cited_page(me)}
co = DOCS['comps-ash']
co_p = {1: [('small', 'Pulled from MLS · Oct 12 · 3 homes'), ('h', co['head']),
            ('table', ['Home', 'Listed at', 'Now', 'Cut on', 'Showings last week'],
             [['17 Ash St (your listing) · 4 bd · 2.5 ba · 2,310 sq ft', '$689,000', '$689,000', '—', '3'],
              ['22 Birch Ln · 4 bd · 2.5 ba · 2,280 sq ft', '$699,000', '$669,000', 'Sep 29', '8'],
              ['41 Hawthorne Dr · 4 bd · 3 ba · 2,350 sq ft', '$705,000', '$679,000', 'Oct 2', '7']]),
            ('p', co['cite'] + ' 17 Ash St had 3 showings last week, down from 9 four weeks ago.'),
            ('small', 'Sources: MLS listing history for each address; your showing feedback log for 17 Ash St.')]}

def envelope(d, rows):
    return {1: [('small', 'Envelope status printout · sample')] + cited_page(d) + [('table', ['Signer', 'Role', 'Status'], rows)]}
dis = envelope(DOCS['ash-disclosure'], [['Dana Reyes', 'Listing agent', 'Signed Oct 9'], ['Sam Whitfield', "Buyers' agent", 'Signed Oct 9'],
                                        ['Luis Garcia', 'Seller', 'Waiting · page 6'], ['Ana Garcia', 'Seller', 'Waiting · page 7']])
ctr = envelope(DOCS['ash-counter'], [['Luis Garcia', 'Seller', 'Signed Oct 11'], ['Ana Garcia', 'Seller', 'Signed Oct 11'],
                                     ['Linh Nguyen', 'Buyer', 'Signed Oct 11'], ['Thao Nguyen', 'Buyer', 'Signed Oct 11']])

KIND = {'PDF': 'pdf', 'EML': 'email', 'MLS': 'mls', 'SIG': 'sig'}
ALL = {
    'linden-inspection': (lin_p, 'Bay Area Inspections', 'Home inspection report · 412 Linden Ct'),
    'hollis-inspection': (hol_p, 'Bay Area Inspections', 'Home inspection report · 9 Hollis Way'),
    'linden-agreement': (la_p, 'Residential purchase agreement', '412 Linden Ct'),
    'ash-agreement': (aa_p, 'Residential purchase agreement', '17 Ash St'),
    'ash-appraisal': (ap_p, 'Valley Appraisal Group', 'Appraisal report · 17 Ash St'),
    'linden-title': (ti_p, 'Lone Oak Title', 'Title commitment · 412 Linden Ct'),
    'ash-offer': (of_p, 'Offer to purchase', '17 Ash St · Linh and Thao Nguyen'),
    'marcus-email': (marcus, 'Email · printed from Gmail', 'Re: Showing times for 17 Ash St'),
    'kim-email': (kim, 'Email · printed from Gmail', 'Re: When is the appraisal for 412 Linden Ct?'),
    'ash-listing': (al_p, 'MLS', '17 Ash St · listing sheet'),
    'mercer-listing': (me_p, 'MLS', '230 Mercer Ave · listing sheet'),
    'comps-ash': (co_p, 'MLS comparison', '17 Ash St'),
    'ash-disclosure': (dis, 'Envelope status', 'Seller disclosure · 17 Ash St'),
    'ash-counter': (ctr, 'Envelope status', 'Counteroffer 1 · 17 Ash St'),
}

# ---------------------------------------------------------------- PDF rendering
SERIF = ParagraphStyle('b', fontName='Times-Roman', fontSize=11.5, leading=16, spaceAfter=8)
H = ParagraphStyle('h', fontName='Helvetica-Bold', fontSize=14, leading=18, spaceAfter=10, spaceBefore=4)
SM = ParagraphStyle('s', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#555555'), spaceAfter=8)
TB = ParagraphStyle('t', fontName='Helvetica', fontSize=9.5, leading=12)

def flow(b):
    k = b[0]; e = lambda s: escape(s)
    if k == 'h': return [Paragraph(e(b[1]), H)]
    if k == 'p': return [Paragraph(e(b[1]), SERIF)]
    if k == 'small': return [Paragraph(e(b[1]), SM)]
    if k == 'item': return [Paragraph('<b>' + e(b[1]) + ' · ' + e(b[2]) + '.</b> ' + e(b[3]), SERIF)]
    if k == 'ul': return [Paragraph('• ' + e(x), SERIF) for x in b[1]]
    if k == 'kv':
        t = Table([[Paragraph('<b>' + e(a) + '</b>', TB), Paragraph(e(v), TB)] for a, v in b[1]], colWidths=[1.4 * inch, 5.1 * inch])
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor('#cccccc')),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        return [t, Spacer(1, 10)]
    if k == 'table':
        rows = [[Paragraph('<b>' + e(x) + '</b>', TB) for x in b[1]]] + [[Paragraph(e(x), TB) for x in r] for r in b[2]]
        t = Table(rows, repeatRows=1)
        t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor('#cccccc')), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        return [t, Spacer(1, 10)]
    if k == 'sig':
        return [Spacer(1, 24), Paragraph('______________________________', SERIF)] + [Paragraph(e(x), SM) for x in b[1]]
    raise ValueError(k)

def build(id_, pages, org, title):
    n = len(pages)
    assert sorted(pages) == list(range(1, n + 1)), (id_, sorted(pages))
    path = os.path.join(OUT, id_ + '.pdf')
    def deco(c, doc):
        c.saveState(); c.setFont('Helvetica', 8.5); c.setFillColor(colors.HexColor('#555555'))
        c.drawString(0.9 * inch, 10.45 * inch, org); c.drawRightString(7.6 * inch, 10.45 * inch, title)
        c.setStrokeColor(colors.HexColor('#bbbbbb')); c.line(0.9 * inch, 10.35 * inch, 7.6 * inch, 10.35 * inch)
        c.line(0.9 * inch, 0.75 * inch, 7.6 * inch, 0.75 * inch)
        c.drawString(0.9 * inch, 0.55 * inch, 'Sample document · fictional data')
        c.drawRightString(7.6 * inch, 0.55 * inch, 'Page %d of %d' % (doc.page, n)); c.restoreState()
    doc = BaseDocTemplate(path, pagesize=letter, title=title, author=org, subject='Fictional sample document')
    doc.addPageTemplates([PageTemplate('p', [Frame(0.9 * inch, 0.9 * inch, 6.7 * inch, 9.3 * inch, id='f')], onPage=deco)])
    story = []
    for i in range(1, n + 1):
        for b in pages[i]: story += flow(b)
        if i < n: story.append(PageBreak())
    doc.build(story)
    return n

out = {}
for id_, (pages, org, title) in ALL.items():
    d = DOCS[id_]
    n = build(id_, pages, org, title)
    assert n == d.get('pages', 1), (id_, n, d.get('pages'))
    out[id_] = {'kind': KIND[d['icon']], 'file': 'docs/' + id_ + '.pdf', 'org': org, 'title': title,
                'pages': [{'n': i, 'blocks': [list(b) for b in pages[i]]} for i in range(1, n + 1)]}
    # page pictures of the original, for phones and tablets where PDFs don't show inside a page
    pdir = os.path.join(OUT, 'pages'); os.makedirs(pdir, exist_ok=True)
    for i in range(1, n + 1):
        subprocess.check_call(['pdftoppm', '-f', str(i), '-l', str(i), '-singlefile', '-r', '110', '-gray', '-png',
                               os.path.join(OUT, id_ + '.pdf'), os.path.join(pdir, '%s-%d' % (id_, i))])
    out[id_]['img'] = 'docs/pages/' + id_ + '-{n}.png'
    print(id_, n, 'pages')

missing = [k for k in DOCS if k not in ALL]
assert not missing, missing
with open(os.path.join(SITE, 'ida-doctext.js'), 'w') as f:
    f.write('/* Generated by site2_tests/gen_docs.py from the same blocks as docs/*.pdf. Fictional sample data. */\n')
    f.write('(function () { window.Ida = window.Ida || {}; window.Ida.DOCTEXT = ')
    f.write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    f.write('; })();\n')
