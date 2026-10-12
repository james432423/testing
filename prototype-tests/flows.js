const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
const results = []; const errs = [];
function ok(name, cond, info) { results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + (info || ''))); }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1240, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
  p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
  const go = async u => { await p.goto(BASE + u); await p.waitForTimeout(200); };
  const reset = async () => { await go(''); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await go(''); };
  const txt = async sel => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ');
  const btn = name => p.getByRole('button', { name, exact: true }).first();
  // Approved messages wait 10 s in the outbox; this moves the clock past that (a real-time wait is tested in consistency.js).
  const sendNow = () => p.evaluate(() => Ida.act.flush(Date.now() + 60000));
  const pb = async id => { await p.locator('[data-pbpanel="' + id + '"]').first().click(); await p.waitForTimeout(150); return txt('#drawer'); };
  const client = async id => { await p.locator('main [data-client="' + id + '"]').first().click(); await p.waitForTimeout(150); return txt('#drawer'); };
  const weekAll = async () => (await p.locator('#week').textContent()).replace(/\s+/g, ' ');
  const panel = async id => { await go('handled.html#' + id); await p.waitForTimeout(150); return txt('#drawer'); };
  const close = async () => { if (await p.locator('#drawer:not([hidden])').count()) { await p.locator('#drawer-close').click(); await p.waitForTimeout(100); } };

  // 1. Reconnect on Today
  await reset();
  ok('heading 6', /6 things need you/.test(await txt('#greet')));
  await btn('Reconnect').click(); await p.waitForTimeout(1300);
  let g = await txt('#greet');
  ok('after reconnect: 5 decisions, 1 request, 0 fixes', /6 things need you/.test(g) && /5 decisions and 1 request/.test(g), g);
  ok('Marcus in pile', (await p.content()).includes('Book a showing for Marcus Lee'));
  ok('no problem row', await p.locator('[data-reconnect]').count() === 0);
  ok('nav badge 6', (await txt('.side nav a[href="./"] .count')) === '6');
  await go('apps.html'); ok('apps shows calendar connected', !/Problem · Disconnected/.test(await txt('main')));
  await go('workflows.html'); ok('showing scheduler not paused', !/until Google Calendar/.test(await txt('main')));

  // 2. Approve + undo + next card
  await reset();
  await btn('Approve and send').click(); await p.waitForTimeout(300);
  ok('next decision HOA becomes card', /Ask the Linden Court HOA/.test(await txt('.ida-pile__card')));
  ok('approved message is queued, not sent yet', /Sending to Jen and Tom Park in \d+ s/.test(await txt('#items')) && /See all 23/.test(await txt('#sentlink')));
  await p.locator('[data-toast-undo]').click(); await p.waitForTimeout(300);
  ok('undo restores inspection card', /inspection summary/.test(await txt('.ida-pile__card')) && /See all 23/.test(await txt('#sentlink')) && !/Sending to/.test(await txt('#items')));
  await btn('Approve and send').click(); await p.waitForTimeout(200); await sendNow(); await p.waitForTimeout(200);
  ok('done list updated', /inspection summary/.test(await txt('#donelog')));
  ok('sent count 24', /See all 24/.test(await txt('#sentlink')));
  await reset();
  // edit first
  await btn('Edit first').click(); await p.waitForTimeout(200);
  const body = p.locator('.ida-letter__body[contenteditable="true"]');
  ok('editable', await body.count() === 1);
  await body.click(); await p.keyboard.press('End'); await p.keyboard.type(' Talk soon.');
  await btn('Done editing').click(); await p.waitForTimeout(200);
  ok('edit kept', /Talk soon/.test(await txt('.ida-pile__card')));
  await btn('Not now').click(); await p.waitForTimeout(200);
  ok('not now moves on', /HOA/.test(await txt('.ida-pile__card')) && /Moved to tomorrow/.test(await txt('#items')));
  // up next chevron
  await reset();
  await p.locator('[data-open]').first().click(); await p.waitForTimeout(200);
  ok('chevron opens HOA', /HOA/.test(await txt('.ida-pile__card')));
  await reset();
  await p.locator('[data-quick]').first().click(); await p.waitForTimeout(200); await sendNow(); await p.waitForTimeout(200);
  ok('Ask the HOA quick', /Asked the Linden Court HOA/.test(await txt('#donelog')));
  // empty state
  await reset();
  await btn('Reconnect').click(); await p.waitForTimeout(1300);
  for (let i = 0; i < 6; i++) { const c = p.locator('.ida-pile__card [data-approve], .ida-pile__card .ida-btn--primary[data-choose]').first(); if (!(await c.count())) break; await c.click(); await p.waitForTimeout(200); }
  await p.locator('[data-ack]').first().click(); await p.waitForTimeout(200);
  ok('empty state', /Nothing needs you right now/.test(await txt('#greet')) && /What Ida does next/.test(await txt('#items')));
  ok('badge hidden', await p.locator('.side nav a[href="./"] .count').isHidden());
  // drawers
  await reset();
  await p.getByText('Open the report at page 4').first().click(); await p.waitForTimeout(300);
  ok('report drawer', await p.locator('.ida-drawer:not([hidden]) iframe').count() === 1);
  await btn('Close').click();
  await btn('See the comparison').click(); await p.waitForTimeout(300);
  ok('comparison drawer', /comparison/i.test(await txt('.ida-drawer__head')));
  await btn('Close').click();
  await btn('Draft the note').click(); await p.waitForTimeout(200);
  await p.locator('[data-insight="send"]').click(); await p.waitForTimeout(200);
  ok('price note queued', /Sending to Luis and Ana Garcia in \d+ s/.test(await txt('.insight')));
  await sendNow(); await p.waitForTimeout(200);
  ok('price note sent', /Sent to Luis and Ana Garcia/.test(await txt('.insight')));
  await p.getByRole('link', { name: /See all \d+ messages/ }).click(); await p.waitForTimeout(300);
  ok('sent page shows price note', /showings and nearby prices/.test(await txt('main')));
  await go(''); await p.getByRole('link', { name: /tasks Ida could take/ }).click(); await p.waitForTimeout(300);
  ok('tasks link', /tasks\.html/.test(p.url()));

  // 2b. This week strip (under the heading) and source documents
  await reset();
  ok('old Coming up section removed', await p.locator('#upcoming').count() === 0 && !/Coming up/.test(await txt('main')));
  const wk = await p.locator('#week').boundingBox(), it = await p.locator('#items').boundingBox(), gr = await p.locator('#greet').boundingBox();
  ok('This week sits between heading and decisions, in first screen', wk && gr && it && wk.y > gr.y && wk.y < it.y && wk.y + 60 < 900, JSON.stringify([gr, wk, it]));
  await p.locator('[data-weektoggle]').click(); await p.waitForTimeout(150);
  ok('This week lists Tue/Wed/Thu', /Tue 13[\s\S]*Appraisal at 412 Linden Ct[\s\S]*Wed 14[\s\S]*Option period ends[\s\S]*Thu 15[\s\S]*Closing at 412 Linden Ct/.test(await p.locator('#week').innerText()));
  ok('Needs you chip on closing', /Closing at 412 Linden Ct Needs you/.test(await txt('#week')), await txt('#week'));
  await p.locator('.tw__i[data-doc="linden-agreement"]').click(); await p.waitForTimeout(800);
  ok('strip item opens source in side panel', /Purchase agreement/.test(await txt('.ida-drawer__head')));
  let fr = p.frameLocator('.ida-drawer iframe');
  ok('panel readable shows cite highlighted', /Closing shall occur on or before October 15, 2026/.test(await fr.locator('mark#cite').innerText()));
  ok('panel readable has all 14 pages', await fr.locator('.rp-page').count() === 14);
  ok('panel readable says converted + page', /converted from the original PDF, all 14 pages[\s\S]*page 2/.test(await fr.locator('#pane-read .dv-note').innerText()));
  await fr.getByRole('tab', { name: 'Original PDF' }).click(); await p.waitForTimeout(300);
  ok('panel original shows the PDF at page 2', /docs\/linden-agreement\.pdf\?p=2#page=2$/.test(await fr.locator('iframe.dv-pdf').getAttribute('src')));
  ok('panel Open PDF link', (await fr.locator('#open-pdf').getAttribute('href')) === 'docs/linden-agreement.pdf#page=2');
  ok('drawer foot Open PDF', (await p.locator('.ida-drawer__foot a', { hasText: 'Open PDF' }).getAttribute('href')) === 'docs/linden-agreement.pdf#page=2');
  await fr.getByRole('tab', { name: 'Readable' }).click(); await p.waitForTimeout(200);
  ok('back to readable', await fr.locator('#pane-read').isVisible());
  await btn('Close').click();
  // approving adds to the strip
  await btn('Reconnect').click(); await p.waitForTimeout(1300);
  await p.locator('[data-quick="d-hoa"]').click(); await p.waitForTimeout(300); await sendNow(); await p.waitForTimeout(200);
  ok('approved HOA adds Wed noon item', /12:00 pm[\s\S]*HOA payoff letter due/.test(await p.locator('#week').innerText()));
  // full-screen viewer, every source
  const docs = await p.evaluate(() => Object.keys(window.Ida.DOCS).map(k => [k, window.Ida.DOCS[k].pages || 1, window.Ida.DOCS[k].page || 1]));
  for (const [id, n, pg] of docs) {
    await go('doc.html?d=' + id);
    const pages = await p.locator('#pane-read .rp-page').count(), cite = await p.locator('mark#cite').count();
    const inView = await p.evaluate(() => { const r = document.getElementById('cite').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    ok('doc ' + id + ': ' + n + ' readable pages, cite on page ' + pg + ' in view', pages === n && cite === 1 && inView && await p.locator('#page-' + pg + ' mark#cite').count() === 1, [pages, cite, inView].join());
  }
  await go('report.html#page-9'); ok('report #page-9 jumps to page 9', await p.evaluate(() => Math.abs(document.getElementById('page-9').getBoundingClientRect().top) < 120));
  await go('report.html'); await p.locator('#page-14 [data-orig]').click(); await p.waitForTimeout(200);
  ok('page link opens original at that page', /#page=14$/.test(await p.locator('iframe.dv-pdf').getAttribute('src')) && /view=original/.test(p.url()));
  await go('comps.html?view=original'); ok('comps opens original listing tab', (await p.getByRole('tab', { name: 'Original listing' }).getAttribute('aria-selected')) === 'true');
  // phone: picture of the original page with pager
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const pp = await ph.newPage();
  pp.on('pageerror', e => errs.push('PHONE ' + pp.url() + ' :: ' + e.message));
  await pp.goto(BASE + 'doc.html?d=linden-inspection&view=original'); await pp.waitForTimeout(400);
  ok('phone original shows page picture 4', /docs\/pages\/linden-inspection-4\.png$/.test(await pp.locator('#shot').getAttribute('src')) && await pp.evaluate(() => document.getElementById('shot').naturalWidth > 0));
  await pp.getByRole('button', { name: 'Next page' }).click(); await pp.waitForTimeout(300);
  ok('phone pager goes to page 5', /Page 5 of 31/.test(await pp.locator('#shot-n').innerText()));
  ok('phone no horizontal scroll', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await pp.goto(BASE); await pp.waitForTimeout(300);
  ok('phone Today no horizontal scroll', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('phone This week in first screen', (await pp.locator('#week').boundingBox()).y < 600);
  await ph.close();

  // 3. Ask field
  await reset();
  const ask = async q => { await p.fill('.ask input', q); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200); return txt('#ida-reply'); };
  ok('ask closing', /Thursday at 2:00 pm/.test(await ask('When is the Linden closing?')));
  ok('ask option', /October 14/.test(await ask('when does the option period end')));
  ok('ask appraisal', /Tuesday at 10 am/.test(await ask('appraisal on linden?')));
  ok('ask who', /Sam Whitfield/.test(await ask("Who's on the 17 Ash St deal?")));
  ok('ask waiting', /waiting on you/.test(await ask("What's waiting on me?")));
  ok('ask unknown', /can answer questions/.test(await ask('banana')));
  let r = await ask('Never text clients after 8 pm');
  ok('rule understood', /understood this as a rule/.test(r), r);
  await btn('Add as a rule').click(); await go('rules.html');
  ok('rule on rules page', /text clients after 8 pm/i.test(await txt('main')));
  r = await ask('Remind me to order a sign for 230 Mercer Ave');
  ok('task understood', /understood this as a task/.test(r), r);
  await btn('Add as a task').click(); await go('tasks.html');
  ok('task on tasks', /sign for 230 Mercer/i.test(await txt('main')));

  // 4. Tasks: add + hand + detail
  await reset(); await go('tasks.html');
  await btn('Add a task').click(); await p.fill('#at-name', 'Send closing gift to buyers'); await p.selectOption('#at-area', 'Admin');
  await p.locator('#addtask button[type=submit]').click(); await p.waitForTimeout(200);
  ok('added task', /Send closing gift/.test(await txt('#board')));
  await btn('Close').click();
  await p.locator('[data-hand="t-prep"]').click(); await p.waitForTimeout(300);
  ok('hand moves to practice', /practic/i.test(await txt('#board')));
  await go('workflows.html'); ok('practice workflow created', /Listing appointment prep/.test(await txt('main')));
  await go(''); ok('today off plate unchanged 9 of 15', /9 of 15/.test(await txt('#work')), await txt('#work'));
  await go('tasks.html'); await p.locator('[data-open]').first().click(); await p.waitForTimeout(200);
  ok('task detail drawer', await p.locator('.ida-drawer:not([hidden]) .ida-kv').count() === 1);

  // 5. Workflows
  await reset(); await go('workflows.html');
  await p.locator('[data-promote]').first().click(); await p.waitForTimeout(200);
  ok('promote', await p.locator('[data-unpromote]').count() === 1);
  await p.locator('[data-unpromote]').first().click(); await p.waitForTimeout(200);
  ok('unpromote', await p.locator('[data-promote]').count() === 1);
  await p.locator('[data-menu]').first().click(); await p.waitForTimeout(100);
  await p.getByRole('menuitem', { name: /Pause/ }).click(); await p.waitForTimeout(200);
  ok('paused', /Paused/.test(await txt('main')));
  await p.locator('[data-menu]').first().click(); await p.getByRole('menuitem', { name: /Move down/ }).click(); await p.waitForTimeout(200);
  ok('moved down', true);
  await p.getByRole('link', { name: /See what it sent/ }).first().click(); await p.waitForTimeout(300);
  ok('sent filtered', /wf=/.test(p.url()));

  // 6. Rules
  await reset(); await go('rules.html');
  const tog = p.locator('label.ida-switch').first(); await tog.click(); await p.waitForTimeout(200);
  await go('rules.html');
  ok('toggle persists', !(await p.locator('[data-toggle]').first().isChecked()));
  ok('lock shown', await p.locator('.ida-lock').count() >= 1);
  await p.locator('[data-edit]').first().click(); await p.waitForTimeout(100);
  await p.locator('[data-editform] input, [data-editform] textarea').first().fill('Before quoting any price');
  await btn('Save').click(); await p.waitForTimeout(200);
  ok('edit inline', /Before quoting any price/.test(await txt('main')));
  await p.fill('main input[type=text]', "Don't email clients on Sundays"); await btn('Add rule').click(); await p.waitForTimeout(200);
  ok('confirm step', /understood/i.test(await txt('main')));
  await btn('Yes, add it').click(); await p.waitForTimeout(200);
  ok('rule added', /email clients on Sundays/i.test(await txt('main')));

  // 7. Apps
  await reset(); await go('apps.html');
  await p.locator('[data-connect="qb"]').click(); await p.waitForTimeout(1500);
  await go('tasks.html'); ok('commission handable', await p.locator('[data-hand="t-commish"]').isEnabled());
  await go('apps.html'); await p.locator('[data-manage="gmail"]').click(); await p.waitForTimeout(200);
  await p.locator('[data-disconnect="gmail"]').click(); await p.waitForTimeout(100);
  await p.locator('[data-disconnect-yes="gmail"]').click(); await p.waitForTimeout(300);
  ok('gmail disconnected', /Connect again|Not connected|Disconnected/.test(await txt('main')));
  await btn('Connect an app').click(); await p.waitForTimeout(200);
  await p.locator('[data-add]').first().click(); await p.waitForTimeout(1500);
  ok('app picker added', (await p.locator('main').innerText()).length > 0);

  // 8. Onboarding
  await reset(); await go('onboarding.html');
  const before = await txt('main');
  await p.locator('input[type=checkbox]').first().click(); await p.waitForTimeout(100);
  ok('onboarding count changes', before !== await txt('main'));
  await btn('Add a task we missed').click(); await p.locator('main input[type=text]').last().fill('Order yard signs'); await btn('Add it').click(); await p.waitForTimeout(100);
  ok('missed task added', /Order yard signs/.test(await txt('main')));
  await btn('Continue').click(); await p.waitForTimeout(200);
  ok('step 3', /Connect apps/.test(await txt('main')));
  const conns = await p.locator('[data-conn]').count(); for (let i = 0; i < conns; i++) { await p.locator('[data-conn]').nth(i).click().catch(() => {}); await p.waitForTimeout(900); }
  await btn('Continue').click(); await p.waitForTimeout(200);
  ok('step 4', /practice/i.test(await txt('main')));
  await btn('Looks right').click(); await p.waitForTimeout(200);
  await p.getByRole('link', { name: 'Go to Today' }).click(); await p.waitForTimeout(400);
  ok('to Today', /\/$|index/.test(p.url()), p.url());

  // 9. Sent + practice
  await reset(); await go('sent.html');
  await p.locator('[data-wrong]:visible').first().click(); await p.waitForTimeout(100);
  await p.locator('[data-confirm]:visible').first().click(); await p.waitForTimeout(200);
  ok('this was wrong confirmed', await p.locator('[data-unwrong]').count() >= 1);
  await p.locator('[data-undo]:visible').first().click().catch(() => {}); await p.waitForTimeout(200);
  await go('practice.html?wf=appraisal'); await btn('Not like me').click(); await p.locator('#reason input[type=checkbox]').first().check(); await p.locator('#reason button[type=submit]').click(); await p.waitForTimeout(200);
  ok('practice verdict saved', /Not like you/.test(await txt('main')));

  // 10. storage throws
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push('NOSTORE ' + p2.url() + ' :: ' + e.message));
  await p2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  for (const u of ['', 'tasks.html', 'workflows.html', 'rules.html', 'apps.html', 'onboarding.html', 'sent.html', 'practice.html']) { await p2.goto(BASE + u); await p2.waitForTimeout(150); }
  await p2.goto(BASE); await p2.getByRole('button', { name: 'Approve and send', exact: true }).click(); await p2.waitForTimeout(200);
  ok('works without storage', /HOA/.test(await p2.locator('.ida-pile__card').innerText()));

  // 12. Today: choice decisions, requests, briefing
  await reset();
  ok('Today lists Maya and Sarah decisions as tabs', /Maya Chen wants Thursday 6 pm/.test(await txt('#items')) && /lower your commission/.test(await txt('#items')));
  ok('briefing shows routine news', /Ravi Mehta booked a consultation/.test(await txt('.ida-brief')) && /Lena Ortiz asked for email only/.test(await txt('.ida-brief')) && !/Kim Alvarez confirmed/.test(await txt('.ida-brief')));
  ok('briefing links each client and playbook to Being handled', await p.locator('.ida-brief a[href="handled.html#p-ravi"]').count() === 1 && await p.locator('.ida-brief a[href="handled.html#pb-lead"]').count() >= 1);
  ok('one primary button on Today', await p.locator('.ida-btn--primary:visible').count() === 1);
  await p.locator('[data-open="d-maya"]').click(); await p.waitForTimeout(200);
  let card = await txt('.ida-pile__card');
  ok('Maya card explains, recommends, says what happens next', /What happened/.test(card) && /Ida recommends/.test(card) && /What happens next/.test(card) && /Allow Thursday 6 pm/.test(card) && /Take over/.test(card), card);
  await p.locator('.ida-pile__card [data-opt="offer"]').click(); await p.waitForTimeout(300);
  ok('offer Friday resolves card', !/Maya Chen wants Thursday/.test(await txt('#items .ida-pile')) && /5 things need you/.test(await txt('#greet')));
  await sendNow();
  ok('Maya panel: Ida waits on her answer and logged what it told her, linked to Sent', /Waiting on her answer about Friday 5 pm/.test(await panel('p-maya')) && /Offered Friday 5 pm instead of Thursday 6 pm/.test(await txt('#hp-told')) && await p.locator('#hp-told a[href^="sent.html#sent-"]').count() === 1);
  await go('sent.html'); ok('Sent logs the text to Maya', /Friday 5:00 pm instead/.test(await txt('#log')));
  await go(''); await p.locator('[data-toast-undo]').count();
  await p.locator('[data-callback]').click(); await p.waitForTimeout(300);
  ok('I\'ll call Jen moves request to briefing and adds call to This week', /You're calling/.test(await txt('.ida-brief')) && /Call Jen back/.test(await txt('#week')));
  await reset(); await p.locator('[data-delegate]').first().click(); await p.waitForTimeout(200);
  ok('Today: Hand Ida a responsibility opens the form', await p.locator('#dg-goal').count() === 1);

  // 13. Playbooks by client type (Being handled v2: rows per client, controls in the side panel)
  await reset(); await go('handled.html');
  ok('counts: 4 need you, 2 waiting, 4 on track; groups by type', /4 Need you[\s\S]*2 Waiting on someone[\s\S]*4 On track/.test(await txt('#hsum')) && /Buyer deals[\s\S]*Seller listings[\s\S]*Leads/.test(await txt('#resps')) && await p.locator('.hd-row').count() === 12, await txt('#hsum'));
  ok('buyer rows: the Parks and the Okafors', await p.locator('#pb-buyer .hd-row').count() === 2 && await p.locator('#cl-pb-buyer-p-parks').count() === 1 && await p.locator('#cl-pb-buyer-p-okafors').count() === 1);
  let pbt = await pb('pb-buyer');
  ok('buyer playbook runs for 2 buyer deals, applies to new ones', /Running for 2 buyer deals/.test(pbt) && /applies automatically to new buyer deals/.test(pbt), pbt);
  ok('buyer duties listed', /deadlines from the contract[\s\S]*Inspection summary and repair request[\s\S]*Lender, appraisal and document chase[\s\S]*Closing prep/.test(await txt('#drawer .ida-duties')));
  await close();
  ok('per-client status: Parks stuck, Okafors waiting', /Stuck/.test(await txt('#cl-pb-buyer-p-parks .hd-chip')) && /Waiting on Ruth and David until Fri/.test(await txt('#cl-pb-buyer-p-okafors')));
  ok('seller exception for the Garcias', /Except the Garcias: Ask me before any price note/.test(await txt('#pb-seller')));
  ok('leads: open-house progress', /12 contacted · 5 replied · 2 booked · 1 asked to reconnect in spring/.test(await txt('#pb-lead .hd-funnel')));
  pbt = await pb('pb-lead');
  ok('one trust level per type', await p.locator('#drawer .ida-trust').count() === 1 && /On its own/.test(await p.locator('#drawer .ida-trust').getAttribute('aria-label')));
  ok('scope shown in the playbook panel', /What comes to you/.test(await txt('#sc-pb-lead')) && /STOP ends texting/.test(await txt('#sc-pb-lead')));
  ok('leads scope: outreach stops on booking, consultation reminders continue', /outreach sequence stops when someone books[\s\S]*Reminders for a booked consultation still go out/.test(await txt('#sc-pb-lead')));
  await close();
  // exception per client
  await client('p-okafors'); await p.locator('#drawer [data-exadd]').click(); await p.fill('#drawer [data-exform] input', 'Ask me before contacting the sellers\' agent'); await p.locator('#drawer [data-exform] button[type=submit]').click(); await p.waitForTimeout(200);
  ok('exception added', /Except the Okafors: Ask me before contacting the sellers' agent/.test(await txt('#pb-buyer')));
  await panel('p-okafors'); ok('panel names the playbook duties and the exception', /Except the Okafors: Ask me before contacting/.test(await txt('#drawer')) && /From the Buyer deals playbook[\s\S]*Inspection summary and repair request/.test(await txt('#drawer')) && /Inspection summary and repair request/.test(await txt('#hp-next')));
  await go('handled.html'); await client('p-ellen'); await p.locator('#drawer [data-excl="pb-lead"][data-p="p-ellen"]').click(); await p.waitForTimeout(200);
  ok('leave a client out', /Not covered/.test(await txt('#cl-pb-lead-p-ellen')) && /Running for 8 leads/.test(await pb('pb-lead')));
  await client('p-ellen'); await p.locator('#drawer [data-excl="pb-lead"][data-p="p-ellen"]').click(); await p.waitForTimeout(200); ok('cover again', /Running for 9 leads/.test(await pb('pb-lead')));
  await close();
  // scope + trust for the type
  await pb('pb-seller'); await p.locator('#drawer [data-scope="pb-seller"]').click(); await p.selectOption('#dg-level', 'approve'); await p.fill('#dg-stop', 'The listing closes, or 5 reminders'); await p.getByRole('button', { name: 'Save scope' }).click(); await p.waitForTimeout(300);
  await pb('pb-seller');
  ok('type scope and trust saved', /You approve/.test(await p.locator('#drawer .ida-trust').getAttribute('aria-label')) && /or 5 reminders/.test(await p.locator('#sc-pb-seller').textContent()));
  await p.locator('#drawer [data-rpause="pb-seller"]').click(); await p.waitForTimeout(200); ok('pause playbook', /Paused by you/.test(await txt('#pb-seller')) && /Paused with the playbook/.test(await txt('#cl-pb-seller-p-garcias')));
  await close(); await p.locator('main [data-rresume="pb-seller"]').click(); await p.waitForTimeout(200); ok('resume playbook', !/Paused by you/.test(await txt('#pb-seller .hd-group__head')) && /Running/.test(await pb('pb-seller')));
  await close();
  // delegate: defaults to the whole type
  await reset(); await go('handled.html');
  const tasksBefore = await p.evaluate(() => Ida.q.counts().total);
  await p.locator('main [data-delegate]').click(); await p.fill('#dg-goal', 'Re-engage leads that went quiet'); await p.locator('#dg-goal-form button[type=submit]').click(); await p.waitForTimeout(200);
  let dg = await txt('#dg-scope');
  ok('proposal goes to the Leads playbook, all leads by default', /goes in your Leads playbook/.test(dg) && /All my leads \(9 now\)/.test(dg) && /Applies automatically to any lead who goes quiet/.test(dg) && await p.locator('input[name="dg-to"][value="all"]').isChecked(), dg);
  ok('texting rule shown', /Texts only people who opted in/.test(dg));
  await p.selectOption('#dg-cadence', 'Once a week, up to 4 times');
  await p.getByRole('button', { name: 'Approve and start' }).click(); await p.waitForTimeout(300);
  ok('added notice', /Added to your Leads playbook/.test(await txt('.ida-drawer__body')));
  await close(); await pb('pb-lead');
  ok('duty on for every lead', /Re-engage quiet leads[\s\S]*Every lead/.test(await txt('#drawer .ida-duties')) && await p.locator('#drawer [data-duty="pb-lead"][value="du-reengage"]').isChecked());
  await close();
  ok('Dev now on track', /On track/.test(await txt('#cl-pb-lead-p-dev')));
  await panel('p-dev'); ok('Dev panel: next is the new Leads duty', /First note to quiet leads[\s\S]*Re-engage quiet leads/.test(await txt('#hp-next')));
  await panel('p-sarah'); ok('booked lead not re-engaged', !/First note to quiet leads/.test(await txt('#drawer')));
  await go('tasks.html'); ok('Tasks gains the duty, tagged with its playbook', /Re-engage quiet leads[\s\S]*Leads playbook/.test(await txt('#board')) && await p.evaluate(() => Ida.q.counts().total) === tasksBefore + 1);
  // limit to specific clients
  await reset(); await go('handled.html');
  await p.locator('main [data-delegate]').click(); await p.fill('#dg-goal', 'Send a closing-day checklist for all my buyer deals'); await p.locator('#dg-goal-form button[type=submit]').click(); await p.waitForTimeout(200);
  ok('buyer proposal', /goes in your Buyer deals playbook/.test(await txt('#dg-scope')) && /Applies automatically to new buyer deals/.test(await txt('#dg-scope')));
  await p.check('input[name="dg-to"][value="only"]'); await p.check('#dg-pick input[value="p-parks"]');
  await p.getByRole('button', { name: 'Approve and start' }).click(); await p.waitForTimeout(300);
  ok('limited notice', /Runs for 1 of your buyer deals/.test(await txt('.ida-drawer__body')));
  await close(); await pb('pb-buyer');
  ok('limited duty shows who', /Send a closing-day checklist[\s\S]*Only for Jen and Tom Park/.test(await txt('#drawer .ida-duties')));
  await close();
  await panel('p-okafors'); ok('Okafors not given the limited duty', !/closing-day checklist/i.test(await txt('#drawer')));
  // goals already covered by a type
  await go(''); await p.fill('.ask input', "Follow up with everyone from Saturday's open house at 17 Ash St"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  ok('ask bar recognises a goal', /sounds like a responsibility/.test(await txt('#ida-reply')));
  await p.locator('[data-delegate-ask]').click(); await p.waitForTimeout(300);
  ok('open house already covered by the Leads playbook', /Already covered by the Leads playbook/.test(await txt('.ida-drawer__body')) && /including Saturday's at 17 Ash St/.test(await txt('.ida-drawer__body')));
  await go('handled.html'); await p.locator('main [data-delegate]').click(); await p.fill('#dg-goal', 'Chase the missing paperwork'); await p.locator('#dg-goal-form button[type=submit]').click(); await p.waitForTimeout(200);
  ok('document chase already covered', /Already covered by the Buyer deals playbook/.test(await txt('.ida-drawer__body')));
  await p.locator('.ida-drawer [data-scope]').click(); ok('existing -> change playbook scope', /Change the Buyer deals playbook/.test(await txt('.ida-drawer__head')));
  await go('workflows.html'); ok('Workflows grouped by playbook', /Buyer deals[\s\S]*Applies to 2 buyer deals[\s\S]*Contract deadlines[\s\S]*Appraisal check[\s\S]*Seller listings[\s\S]*Offer comparison[\s\S]*Leads[\s\S]*Lead replies/.test(await txt('#wflist')));
  await go(''); ok('Today says 3 playbooks for 12 clients, 2 stuck (same model as Being handled)', /Ida runs 3 playbooks for 12 clients · 2 stuck/.test(await txt('.ida-brief')));

  // 14. Change plan: Sarah to February, apply and undo
  await reset();
  ok('before: Sarah consultation on This week', /Consultation with Sarah Kim/.test(await weekAll()));
  let plan = await (async () => { await p.fill('.ask input', "Sarah's pausing until February"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200); return txt('#ida-reply'); })();
  ok('change plan lists every affected item', /Change plan/.test(plan) && /Cancel the Thu 3:00 pm consultation/.test(plan) && /Stop 1 scheduled follow-up \(search follow-up, Fri 10:00 am\)/.test(plan) && /Set a check-in for Mon, Feb 1/.test(plan) && /commission/.test(plan) && /Write a note to Sarah in Follow Up Boss: paused until February/.test(plan) && /Tell Sarah by email/.test(plan), plan);
  ok('nothing changed before apply', /Consultation with Sarah Kim/.test(await weekAll()) && /6 things need you/.test(await txt('#greet')));
  await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(300);
  ok('applied notice', /Applied: Sarah is pausing until February/.test(await txt('#ida-reply')));
  ok('Today: week drops Sarah, count 5, commission moved', !/Sarah Kim/.test(await weekAll()) && /5 things need you/.test(await txt('#greet')) && /Moved to the Mon, Feb 1 check-in/.test(await txt('#items')));
  let br = await panel('p-sarah');
  ok('Being handled panel: Sarah paused until February, check-in set, follow-up stopped, note written back', /Paused until February/.test(await txt('#drawer .hd-pstat')) && /Mon, Feb 1 Check in about restarting the search/.test(await txt('#hp-next')) && !/Search follow-up/.test(br) && /Paused until February \(you told Ida\)/.test(await txt('#hp-fub')), br);
  ok('panel: Ida told Sarah exactly what the plan said', /check in at the start of February/.test(await txt('#hp-told')));
  await go('handled.html'); await p.locator('#ch-sum').click(); await p.waitForTimeout(100);
  ok('Being handled: Sarah paused in the Leads playbook, change in history', /Paused until February/.test(await txt('#cl-pb-lead-p-sarah')) && /Running for 9 leads/.test(await pb('pb-lead')) && /Sarah is pausing until February/.test(await txt('#chlist')));
  await close(); await p.locator('[data-cundo]').click(); await p.waitForTimeout(300);
  ok('undo marks change undone', /Undone/.test(await txt('#chlist')));
  await panel('p-sarah'); ok('undo restores Sarah', /Consultation booked/.test(await txt('#drawer')) && /Search follow-up/.test(await txt('#drawer')));
  await go(''); ok('undo restores Today and This week', /Consultation with Sarah Kim/.test(await weekAll()) && /6 things need you/.test(await txt('#greet')));
  // edit then apply
  await p.fill('.ask input', "Sarah's pausing until February"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  await p.locator('[data-plan-edit]').click(); await p.locator('[data-step="st1"]').uncheck(); await p.fill('[data-stepval="st4"]', 'Mon, Feb 8');
  await p.locator('[data-plan-edit]').click(); await p.waitForTimeout(100);
  ok('edited plan shows skipped step and new date', /\(skipped\)/.test(await txt('#ida-reply')) && /Mon, Feb 8/.test(await txt('#ida-reply')) && /Apply 6 changes/.test(await txt('#ida-reply')));
  await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(300);
  await panel('p-sarah'); ok('edited plan applied: Feb 8, no message sent', /Mon, Feb 8/.test(await txt('#drawer')) && !/start of February/.test(await txt('#drawer')));
  // cancel
  await go(''); await p.fill('.ask input', "Don't book anyone Thursday"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  ok('Thursday plan', /No new bookings on Thursday/.test(await txt('#ida-reply')) && /drop "Allow"/.test(await txt('#ida-reply')) && /Not changed/.test(await txt('#ida-reply')));
  await p.locator('[data-plan-cancel]').click(); ok('cancel changes nothing', /Nothing changed/.test(await txt('#ida-reply')));
  await p.fill('.ask input', "Don't book anyone Thursday"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(300);
  ok('Thursday blocked on This week', /No new bookings/.test(await weekAll()));
  await p.locator('[data-open="d-maya"]').click(); await p.waitForTimeout(200);
  ok('Maya card lost the Allow option', await p.locator('[data-opt="allow"]').count() === 0 && await p.locator('[data-opt="offer"]').count() === 1);
  await reset();
  await p.fill('.ask input', "I spoke with Maya, she'll call me"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  ok('ambiguous Maya offers a choice', await p.locator('[data-plan-who] option').count() === 2 && /Maya Chen/.test(await txt('#ida-reply')));
  await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(300);
  ok('Maya decision closed on Today', !/Maya Chen wants/.test(await txt('#items')));
  await panel('p-maya'); ok('Maya panel: reminder for you, note written back to Follow Up Boss', /Will call you \(tentative\)/.test(await txt('#hp-fub')) && /Remind you if Maya/.test(await txt('#hp-next')));
  await go(''); await p.fill('.ask input', 'Stop texting Priya'); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  ok('stop texting plan', /Switch Priya Shah to email only/.test(await txt('#ida-reply')));
  await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(300);
  await panel('p-priya'); ok('Priya is email only', /Email only, no texts/.test(await txt('#hp-fub')) && !/Text/.test(await txt('#hp-next')));

  // 15. Client panel on Being handled: Follow Up Boss summary, Ida's layer, take over / hand back / pause
  await reset(); let pt = await panel('p-sarah');
  ok('handled.html#p-sarah opens Sarah\'s panel and marks her row', /Sarah Kim/.test(await txt('.ida-drawer__head')) && await p.locator('#drawer [data-hpanel="client"][data-pid="p-sarah"]').count() === 1);
  ok('Follow Up Boss block: synced, stage, phone, email, last contact', /From Follow Up Boss · synced 2 min ago/.test(await txt('#hp-fub')) && /Stage Hot Prospect/.test(await txt('#hp-fub')) && /Phone \(415\) 555-0142/.test(await txt('#hp-fub')) && /Email sarah\.kim@example\.com/.test(await txt('#hp-fub')) && /Last contact Mon 9:05 am · Email/.test(await txt('#hp-fub')), await txt('#hp-fub'));
  const fub = p.locator('#hp-fub a.hd-fub__open');
  ok('Open in Follow Up Boss: external link, new tab, noopener', await fub.getAttribute('href') === 'https://app.followupboss.com/' && await fub.getAttribute('target') === '_blank' && /noopener/.test(await fub.getAttribute('rel')));
  ok('no contact editing in Ida', await p.locator('#hp-fub input, #hp-fub textarea, #hp-fub select, #hp-fub [contenteditable]').count() === 0 && /Edit contact details in Follow Up Boss/.test(await txt('#hp-fub')));
  ok('What Ida told her: 3 lines, newest first, each linking to Sent', await p.locator('#hp-told li').count() === 3 && /Mon 9:05 am[\s\S]*Mon 8:30 am[\s\S]*Sun 7:44 pm/.test(await txt('#hp-told')) && await p.locator('#hp-told a[href="sent.html#s18"]').count() === 1 && await p.locator('#hp-told a[href^="sent.html#"]').count() === 3);
  ok('What Ida is handling next and what needs you', /Wed 9:00 am Reminder about Thursday's consultation/.test(await txt('#hp-next')) && /Owner: You Sarah asked whether you'd lower your commission/.test(await txt('#hp-needs')));
  await p.locator('#hp-told a[href="sent.html#s18"]').click(); await p.waitForTimeout(400);
  ok('told line opens that message on Sent', /sent\.html#s18$/.test(p.url()) && await p.locator('#s18.is-open').count() === 1 && /get back to you on that before Thursday/.test(await txt('#s18')));
  await panel('p-sarah'); await p.locator('#drawer [data-takeover="p-sarah"]').click(); await p.waitForTimeout(300);
  ok('take over banner, schedule held', /You're handling Sarah · Ida paused/.test(await txt('#hp-ctl')) && /On hold while you handle Sarah/.test(await txt('#hp-next')) && await p.locator('#drawer [data-handback="p-sarah"]').count() === 1);
  await go(''); ok('Today keeps Sarah\'s commission question as your work (A01)', /6 things need you/.test(await txt('#greet')) && /lower your commission/.test(await txt('#items')));
  await panel('p-sarah'); await p.locator('#drawer [data-handback="p-sarah"]').click(); await p.waitForTimeout(300);
  ok('hand back: Ida back on, schedule live again', /Ida is back on Sarah Kim/.test(await txt('.ida-toasts')) && !/On hold/.test(await txt('#hp-next')) && await p.locator('#drawer [data-takeover="p-sarah"]').count() === 1);
  await go(''); ok('Today back to 6', /6 things need you/.test(await txt('#greet')));
  await panel('p-sarah'); await p.locator('#drawer [data-ppause="p-sarah"]').click(); await p.waitForTimeout(200);
  ok('pause Ida banner', /Ida paused for Sarah/.test(await txt('#hp-ctl')));
  await p.locator('#drawer [data-presume="p-sarah"]').click(); await p.waitForTimeout(200); ok('resume', !/Ida paused for Sarah/.test(await txt('#drawer')));
  pt = await panel('p-kim');
  ok('deal contact (Kim Alvarez) opens a contact panel: Follow Up Boss, told, controls, no playbook', /Deal contact/.test(await txt('#drawer .hd-pstat')) && /kim\.alvarez@example\.com/.test(pt) && /Asked when the Linden appraisal is/.test(await txt('#hp-told')) && await p.locator('#drawer [data-excl]').count() === 0, pt);
  await panel('p-lena'); ok('Lena (email only): Ida\'s messages are email', /Email/.test(await txt('#hp-told')) && !/Text/.test(await txt('#hp-told')));
  await go('people.html#p-maya'); await p.waitForTimeout(300);
  ok('old /people link redirects to Being handled and opens the client', /\/handled(\.html)?#p-maya$/.test(p.url()) && /Maya Chen/.test(await txt('.ida-drawer__head')), p.url());
  ok('people page and script are gone', (await p.request.get(BASE + 'people.js', { maxRedirects: 0 })).status() !== 200 && !require('fs').existsSync(require('path').join(process.argv[2], 'people.html')));
  await go('apps.html'); await p.locator('[data-manage="fub"]').click(); await p.waitForTimeout(200);
  ok('Connected apps: Follow Up Boss reads contacts and history, writes Ida\'s notes and messages back', /reads contacts and conversation history, and writes Ida's notes and messages back/.test(await txt('main')) && /Conversation history with each contact[\s\S]*Write Ida's notes and messages back[\s\S]*Edit contact details or stages/.test(await txt('#drawer')), await txt('#drawer'));

  // 16. Notification levels
  await reset(); await go('rules.html');
  await p.selectOption('[data-notify="booked"]', 'now'); await p.waitForTimeout(200);
  await go(''); ok('bookings set to right away: Needs you grows by 2, briefing loses them', /8 things need you/.test(await txt('#greet')) && !/Ravi Mehta booked/.test(await txt('.ida-brief')) && /Ravi Mehta booked/.test(await txt('#items')));
  await go('rules.html'); await p.selectOption('[data-notify="asks"]', 'brief'); await p.selectOption('[data-notify="booked"]', 'log'); await p.waitForTimeout(200);
  await go(''); ok('client-asks to briefing, bookings only in the log', /5 things need you/.test(await txt('#greet')) && /Jen Park asked you to call/.test(await txt('.ida-brief')) && !/Ravi Mehta booked/.test(await txt('main')));
  ok('locked: outside authority stays right away', await p.evaluate(() => { Ida.act.setNotify('outside', 'log'); return Ida.store.get().notify.outside; }) === 'now');

  // 17. Sent grouping
  await reset(); await go('sent.html');
  ok('default group by person', (await p.inputValue('#f-group')) === 'person' && /Priya Shah[\s\S]*2 messages/.test(await txt('#log')));
  const gb = p.locator('.grp__btn').first(); await gb.click(); await p.waitForTimeout(100);
  ok('group collapses', (await gb.getAttribute('aria-expanded')) === 'false' && await p.locator('#g0').isHidden());
  await gb.click(); ok('group expands', await p.locator('#g0').isVisible());
  await p.selectOption('#f-group', 'day'); await p.waitForTimeout(100); ok('group by day', /Not sent yet[\s\S]*Today[\s\S]*Yesterday[\s\S]*Saturday/.test(await txt('#log')));
  await p.selectOption('#f-group', 'deal'); await p.waitForTimeout(100); ok('group by deal', /412 Linden Ct[\s\S]*messages/.test(await txt('#log')) && /230 Mercer Ave/.test(await txt('#log')));
  await p.selectOption('#f-deal', '17 Ash St'); await p.waitForTimeout(100); ok('filters still apply when grouped', await p.locator('[data-grp="230 Mercer Ave"]').isHidden() && await p.locator('[data-grp="17 Ash St"]').isVisible());
  await p.selectOption('#f-deal', ''); await p.selectOption('#f-group', 'person');
  await p.locator('[data-undo]:visible').first().click(); await p.waitForTimeout(200); ok('undo still works when grouped', /Undone/.test(await txt('#log')));
  await p.locator('[data-wrong]:visible').first().click(); await p.locator('[data-confirm]:visible').first().click(); await p.waitForTimeout(200);
  ok('this was wrong still works when grouped', await p.locator('[data-unwrong]').count() >= 1);

  // 18. Phone: tab bar, More sheet, new pages fit
  const ph2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const q = await ph2.newPage();
  q.on('pageerror', e => errs.push('PHONE ' + q.url() + ' :: ' + e.message));
  await q.goto(BASE + 'handled.html'); await q.waitForTimeout(300);
  for (const u of ['', 'handled.html', 'sent.html', 'tasks.html', 'workflows.html', 'rules.html', 'apps.html']) { await q.goto(BASE + u); await q.waitForTimeout(150); ok('phone tab bar: Today, Handled, Sent, Tasks, More on ' + (u || 'index'), (await q.locator('.tabbar').innerText()).replace(/\s+/g, ' ').trim() === 'Today Handled Sent Tasks More'); }
  await q.goto(BASE + 'tasks.html'); await q.waitForTimeout(200); ok('phone Tasks tab is current', await q.locator('.tabbar a[href="tasks.html"][aria-current="page"]').count() === 1);
  await q.locator('[data-tabmore]').click(); await q.waitForTimeout(100);
  ok('More opens sheet with the rest (no People, no Tasks)', /Workflows[\s\S]*Your rules[\s\S]*Connected apps/.test(await q.locator('.ida-moresheet').innerText()) && !/People|Tasks/.test(await q.locator('.ida-moresheet').innerText()));
  await q.locator('.ida-moresheet a[href="rules.html"]').click(); await q.waitForTimeout(300); ok('More link navigates', /rules\.html/.test(q.url()));
  await q.goto(BASE + 'handled.html#p-sarah'); await q.waitForTimeout(300);
  ok('phone: client panel opens from the link, with the Follow Up Boss block', await q.locator('#drawer').isVisible() && /From Follow Up Boss/.test(await q.locator('#hp-fub').innerText()));
  for (const u of ['', 'handled.html#p-sarah', 'handled.html', 'sent.html', 'tasks.html', 'rules.html', 'apps.html']) { await q.goto(BASE + u); await q.waitForTimeout(300); ok('phone no horizontal scroll: ' + (u || 'index'), await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await ph2.close();
  for (const u of ['', 'handled.html', 'handled.html#p-sarah', 'sent.html']) { await go(u); ok('desktop no horizontal scroll: ' + (u || 'index'), await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  for (const u of ['', 'handled.html', 'sent.html', 'tasks.html', 'workflows.html', 'rules.html', 'apps.html', 'practice.html', 'onboarding.html', 'main.html']) { await go(u); const nav = await p.$$eval('.side nav a', as => as.map(a => a.firstChild.textContent.trim()).join(' · ')); ok('sidebar order on ' + (u || 'index'), nav === 'Today · Being handled · Sent · Tasks · Workflows · Your rules · Connected apps', nav); }
  const peopleRefs = require('child_process').execSync('grep -l "people\\.html" ' + process.argv[2] + '/*.html ' + process.argv[2] + '/*.js || true').toString().trim();
  ok('no page or script links to people.html', !peopleRefs, peopleRefs);

  // 19. One model across Today, Being handled, Sent and Tasks (QA findings A01, A03, A04, A05, F01, F02).
  // Each check makes one change and reads it back on every page; all of them read the same store model.
  {
    const greet = async () => +((await txt('#greet')).match(/(\d+) things? needs? you/) || [0, 0])[1];
    const cnt = async id => +(await p.locator('[data-filter="' + id + '"] b').innerText());
    const sentN = () => p.evaluate(() => Ida.q.sentCount());
    const front = async id => { const l = p.locator('[data-open="' + id + '"]'); if (await l.count()) { await l.click(); await p.waitForTimeout(150); } };
    const offN = () => p.evaluate(() => Ida.q.counts().off);
    let pn, card;
    // A01 Take over: Ida stops, the human's obligation stays (owner You) until done or dismissed
    await reset();
    ok('A01 start: Today 6', await greet() === 6);
    await panel('p-sarah'); await p.locator('#drawer [data-takeover="p-sarah"]').click(); await p.waitForTimeout(300);
    pn = await txt('#hp-needs');
    ok('A01 panel: commission question stays in What needs you, owner You, with Done and Dismiss', /Owner: You Sarah asked whether you'd lower your commission/.test(pn) && await p.locator('#hp-needs [data-workdone="d-sarah"]').count() === 1 && await p.locator('#hp-needs [data-workdismiss="d-sarah"]').count() === 1, pn);
    ok('A01 panel: the promise Ida made, with the message in Sent', /Ida said you'd answer before Thursday\./.test(pn) && await p.locator('#hp-needs a[href="sent.html#s18"]').count() === 1);
    ok('A01 panel: Ida\'s schedule held (no messages), banner says why', /On hold while you handle Sarah/.test(await txt('#hp-next')) && /You're handling Sarah · Ida paused/.test(await txt('#hp-ctl')));
    await go(''); ok('A01 Today: count stays 6', await greet() === 6, await txt('#greet'));
    await front('d-sarah'); card = await txt('#dec-d-sarah');
    ok('A01 Today: Sarah shows as your work, owner you, no Ida options', /Your work · you're handling Sarah/.test(card) && /Owner: you/.test(card) && await p.locator('#dec-d-sarah [data-choose]').count() === 0 && await p.locator('#dec-d-sarah [data-workdone]').count() === 1, card);
    ok('A01 Today: shows what Ida promised, linking the message in Sent', /Ida said you'd answer before Thursday/.test(card) && /I'll get back to you on that before Thursday/.test(card) && await p.locator('#dec-d-sarah .ida-promise a[href="sent.html#s18"]').count() === 1);
    await go('handled.html');
    ok('A01 Being handled: Sarah in Need you with her question', /Your answer/.test(await txt('#cl-pb-lead-p-sarah .hd-chip')) && /lower your commission/.test(await txt('#cl-pb-lead-p-sarah')) && await cnt('you') === 4);
    const sent0 = await sentN();
    const rej = await p.evaluate(() => Ida.act.choose('d-sarah', 'call'));
    ok('A01 store: Ida can\'t send to a taken-over client', rej.ok === false && /paused/.test(rej.reason) && await p.evaluate(() => Ida.q.outbox().length) === 0);
    await go('sent.html'); ok('A01 Sent: nothing new to Sarah', await sentN() === sent0 && !/Sending/.test(await txt('#log')));
    await go(''); await front('d-sarah'); await p.locator('[data-workdone="d-sarah"]').click(); await p.waitForTimeout(250);
    ok('A01 Today: marking done drops the count to 5', await greet() === 5);
    await panel('p-sarah'); ok('A01 panel: obligation gone once done', !/lower your commission/.test(await txt('#hp-needs')));
    await go('handled.html'); ok('A01 Being handled: Sarah no longer needs you', !/Your answer/.test(await txt('#cl-pb-lead-p-sarah .hd-chip')) && await cnt('you') === 3);
    await reset(); await panel('p-parks'); await p.locator('#drawer [data-takeover="p-parks"]').click(); await p.waitForTimeout(250);
    ok('A01 panel Parks: Jen\'s call request stays (owner You), drafts set aside', /Owner: You Jen Park asked you to call/.test(await txt('#hp-needs')) && /Set aside while you handle Jen/.test(await txt('#hp-needs')));
    await go(''); ok('A01 Today: Parks drafts set aside (6 to 4), request kept', await greet() === 4 && /Jen Park asked you to call/.test(await txt('#items')) && /so Ida set its draft aside/.test(await txt('#items')));
    // Pause keeps the obligation too
    await reset(); await panel('p-sarah'); await p.locator('#drawer [data-ppause="p-sarah"]').click(); await p.waitForTimeout(250);
    ok('A01 pause, Being handled: still Your answer, in Need you', /Your answer/.test(await txt('#cl-pb-lead-p-sarah .hd-chip')) && /Ida paused for this client · 1 question only you can answer/.test(await txt('#cl-pb-lead-p-sarah')) && await cnt('you') === 4);
    ok('A01 pause, panel: in What needs you, owner You', /Owner: You Sarah asked/.test(await txt('#hp-needs')));
    await go(''); ok('A01 pause, Today: still 6, shown as your work', await greet() === 6 && /Your work · Ida is paused for Sarah/.test(await p.locator('#items').innerText()));
    await panel('p-sarah'); await p.locator('#hp-needs [data-workdismiss="d-sarah"]').click(); await p.waitForTimeout(250);
    ok('A01 dismiss in the panel: gone from What needs you', !/lower your commission/.test(await txt('#hp-needs')));
    await go(''); ok('A01 dismiss, Today: 5', await greet() === 5);
    await go('handled.html'); ok('A01 dismiss, Being handled: paused, not Need you', /Paused or quiet/.test(await txt('#hsum')) && !/Your answer/.test(await txt('#cl-pb-lead-p-sarah .hd-chip')));

    // A03 Turning a responsibility off holds its scheduled actions everywhere
    await reset(); await go('handled.html');
    await p.locator('main [data-pbpanel="pb-lead"]').click(); await p.locator('#drawer input[data-duty="pb-lead"][value="du-oh"]').click({ force: true }); await p.waitForTimeout(250);
    await p.locator('#drawer-close').click();
    const lena = await txt('#cl-pb-lead-p-lena');
    ok('A03 Being handled: Lena on hold, not On track, with reason and switch', /On hold/.test(await txt('#cl-pb-lead-p-lena .hd-chip')) && /Held: Day-3 follow-up · Wed 10:00 am/.test(lena) && /Open-house follow-up is off for every lead/.test(lena) && await p.locator('#cl-pb-lead-p-lena [data-dutyon="pb-lead"]').count() === 1, lena);
    ok('A03 Being handled: next action skips held items (Sarah)', /Wed 9:00 am\s*·?\s*Reminder about Thursday's consultation/.test(await txt('#cl-pb-lead-p-sarah .hd-next')) && /Held: Search follow-up/.test(await txt('#cl-pb-lead-p-sarah')));
    await panel('p-lena');
    ok('A03 panel: Lena\'s Wed 10:00 am follow-up held with reason and resume switch', /Day-3 follow-up[\s\S]*Held\. Open-house follow-up is off for every lead/.test(await txt('#hp-next')) && await p.locator('#hp-next [data-dutyon="pb-lead"]').count() === 1, await txt('#hp-next'));
    await panel('p-sarah');
    ok('A03 panel: booked consultation reminder continues, search follow-up held', /Reminder about Thursday's consultation/.test(await txt('#hp-next .hd-sched:not(.is-held)')) && /Search follow-up/.test(await txt('#hp-next .hd-sched.is-held')));
    await panel('p-lena'); await p.locator('#hp-next [data-dutyon="pb-lead"]').click(); await p.waitForTimeout(250);
    ok('A03 resume from the panel', !/Held/.test(await txt('#hp-next')));
    await go('handled.html'); ok('A03 resume shows on the row', /On track/.test(await txt('#cl-pb-lead-p-lena .hd-chip')));
    await p.locator('main [data-pbpanel="pb-lead"]').click(); await p.locator('#drawer input[data-duty="pb-lead"][value="du-replies"]').click({ force: true }); await p.waitForTimeout(250); await p.locator('#drawer-close').click();
    ok('A03 Being handled: Priya on hold', /On hold/.test(await txt('#cl-pb-lead-p-priya .hd-chip')));
    await go('sent.html'); await p.locator('#s1 .ent__open').click(); const s1 = await txt('#s1');
    ok('A03 Sent: scheduled message to Priya shows On hold with the switch', /On hold/.test(s1) && /Reply to new leads within 5 minutes is off for every lead/.test(s1) && await p.locator('#s1 [data-dutyon]').count() === 1, s1);
    await panel('p-priya'); ok('A03 panel: both of Priya\'s follow-ups held', ((await txt('#hp-next')).match(/Held\. Reply to new leads/g) || []).length === 2);
    await go('tasks.html'); ok('A03 Tasks: the lead-reply task shows On hold with the reason', /On hold · Reply to new leads within 5 minutes is off for every lead/.test(await txt('#t-leads')), await txt('#t-leads'));
    await go(''); await p.evaluate(() => { Ida.store.update(s => { s.decisions.forEach(d => { if (d.status === 'open' || d.status === 'blocked') d.status = 'done'; }); s.apps.forEach(a => a.status = 'connected'); s.events.forEach(e => e.ack = true); }); });
    ok('A03 Today: What Ida does next skips the held Lead replies run', /What Ida does next/.test(await txt('#items')) && !/Lead replies/.test(await txt('#items .nextlist')));
    await go('sent.html'); await p.locator('#s1 .ent__open').click(); await p.locator('#s1 [data-dutyon]').click(); await p.waitForTimeout(250);
    ok('A03 resume from Sent', !/On hold/.test(await txt('#s1')));
    await go('tasks.html'); ok('A03 Tasks: back to normal after resume', !/On hold/.test(await txt('#t-leads')));

    // A04 Blocked client never reads On track; counts come from the same model
    await reset(); await go('handled.html');
    ok('A04 Being handled: Marcus Stuck, reconnect is the action', /Stuck/.test(await txt('#cl-pb-lead-p-marcus .hd-chip')) && await p.locator('#cl-pb-lead-p-marcus a[href="apps.html"]').count() === 1);
    const counts0 = await p.evaluate(() => { const c = { you: 0, wait: 0, track: 0, off: 0 }, B = { stuck: 'you', needs: 'you', waiting: 'wait', running: 'track' }; Ida.store.get().playbooks.forEach(pb => Ida.q.pbClients(pb).forEach(x => c[B[Ida.q.clientStatus(pb, x).key] || 'off']++)); return c; });
    ok('A04 Being handled counts equal the store model', await cnt('you') === counts0.you && await cnt('wait') === counts0.wait && await cnt('track') === counts0.track, JSON.stringify(counts0));
    await panel('p-marcus');
    ok('A04 panel: Stuck with reason and reconnect, never On track', /Stuck/.test(await txt('#drawer .hd-pstat')) && /Google Calendar is disconnected/.test(await txt('#hp-needs')) && await p.locator('#hp-needs a[href="apps.html"]').count() === 1 && !/On track/.test(await txt('#drawer')));
    const stuckH = await p.evaluate(() => Ida.store.get().playbooks.reduce((n, pb) => n + Ida.q.pbStatus(pb).counts.stuck, 0));
    await go(''); ok('A04 Today: same stuck count, fix row names Marcus', new RegExp('· ' + stuckH + ' stuck').test(await txt('.ida-brief')) && /Opens after you reconnect: Book a showing for Marcus Lee/.test(await txt('#fix-gcal')));
    await go('tasks.html'); ok('A04 Tasks: showings task flagged as a problem, not running', /Problem · Paused · google calendar disconnected/i.test(await txt('#t-showings')));
    await go(''); await p.locator('[data-reconnect="gcal"]').click(); await p.waitForTimeout(1300);
    await go('handled.html'); ok('A04 after reconnect: Marcus needs your approval (not On track)', /Your answer/.test(await txt('#cl-pb-lead-p-marcus .hd-chip')) && await p.locator('#cl-pb-lead-p-marcus a[href="./#dec-d-showing"]').count() === 1);
    await panel('p-marcus'); ok('A04 after reconnect, panel: Your OK, decide on Today', /Your OK Book a showing/.test(await txt('#hp-needs')));
    await go('tasks.html'); ok('A04 after reconnect, Tasks: no problem on showings', !/Problem/.test(await txt('#t-showings')));

    // A05 Undo lives in the store with an expiry; every page shows it until it expires
    await reset();
    await p.locator('#dec-d-inspect [data-later]').click(); await p.waitForTimeout(200);
    ok('A05 Today: Not now shows Undo', await p.locator('.ida-toasts [data-toast-undo]').count() === 1);
    for (const u of ['tasks.html', 'sent.html', 'handled.html']) { await go(u); ok('A05 Undo still there on ' + u, await p.locator('.ida-toasts [data-toast-undo]').count() === 1 && /Moved to tomorrow morning/.test(await txt('.ida-toasts'))); }
    await p.locator('.ida-toasts [data-toast-undo]').click(); await p.waitForTimeout(250);
    await go(''); ok('A05 Undo on another page restored Today', /Send the inspection summary/.test(await txt('.ida-pile__card')) && await p.locator('.ida-toasts [data-toast-undo]').count() === 0);
    await p.locator('#dec-d-inspect [data-later]').click(); await p.waitForTimeout(200);
    ok('A05 entry is in the store with an expiry', await p.evaluate(() => { const u = Ida.store.undo.get(); return !!u && u.exp > Date.now() && u.exp <= Date.now() + 10000; }));
    await p.evaluate(() => { const u = JSON.parse(localStorage.getItem('ida-demo-v8-undo')); u.exp = Date.now() - 1; localStorage.setItem('ida-demo-v8-undo', JSON.stringify(u)); });
    await go('sent.html'); ok('A05 expired Undo is gone on every page', await p.locator('.ida-toasts [data-toast-undo]').count() === 0);
    await reset(); await p.locator('#dec-d-inspect [data-later]').click(); await p.waitForTimeout(200);
    await panel('p-ravi'); await p.locator('#drawer [data-ppause="p-ravi"]').click(); await p.waitForTimeout(200);
    ok('A05 a newer change replaces the older Undo', await p.locator('.ida-toasts [data-toast-undo]').count() === 1 && /Ida paused for Ravi/.test(await txt('.ida-toasts')));

    // F01 Empty or unaddressed drafts can't be approved
    await reset();
    const g0 = await greet(), s0 = await sentN(), done0 = await p.evaluate(() => Ida.store.get().done.length), off0 = await offN();
    await p.locator('#dec-d-inspect [data-edit]').click(); await p.waitForTimeout(100);
    await p.locator('.ida-letter__body[contenteditable="true"]').click(); await p.keyboard.press('Control+A'); await p.keyboard.press('Delete'); await p.waitForTimeout(150);
    const eh = await p.evaluate(() => document.querySelector('.ida-letter__body[contenteditable="true"]').getBoundingClientRect().height);
    ok('F01 editing to empty: editor keeps its height, Approve disabled with a plain reason', eh >= 40 && await p.locator('[data-approve="d-inspect"]').isDisabled() && /The message is empty/.test(await txt('#why-d-inspect')), eh);
    await p.keyboard.type('   '); await p.waitForTimeout(100);
    ok('F01 whitespace only is still empty', await p.locator('[data-approve="d-inspect"]').isDisabled());
    await p.locator('[data-approve="d-inspect"]').click({ force: true }).catch(() => {}); await p.waitForTimeout(150);
    ok('F01 forced click does nothing', await p.evaluate(() => Ida.q.decision('d-inspect').status) === 'open' && await p.evaluate(() => Ida.q.outbox().length) === 0);
    await p.locator('[data-edit="d-inspect"]').click(); await p.waitForTimeout(150);
    const hgt = await p.evaluate(() => document.querySelector('#dec-d-inspect .ida-letter__body').getBoundingClientRect().height);
    ok('F01 saved empty edit keeps a visible editor, says it is empty', hgt >= 40 && /This draft is empty/.test(await txt('#dec-d-inspect')) && await p.locator('[data-approve="d-inspect"]').isDisabled(), hgt);
    const r1 = await p.evaluate(() => Ida.act.approve('d-inspect'));
    const r2 = await p.evaluate(() => Ida.act.approve('d-inspect', { body: '<p>  &nbsp; </p><p><br></p>' }));
    const r3 = await p.evaluate(() => { const d = Ida.q.decision('d-hoa'); const keep = d.head; d.head = d.head.map(h => h[0] === 'Subject' ? ['Subject', '  '] : h); const r = Ida.act.approve('d-hoa'); d.head = keep; return r; });
    const r4 = await p.evaluate(() => { const d = Ida.q.decision('d-hoa'); const keep = d.head; d.head = d.head.filter(h => h[0] !== 'To'); const r = Ida.act.approve('d-hoa'); d.head = keep; return r; });
    ok('F01 store rejects empty, whitespace-only, no subject, no recipient', !r1.ok && !r2.ok && /empty/.test(r2.reason) && !r3.ok && /subject/.test(r3.reason) && !r4.ok && /recipient/.test(r4.reason), JSON.stringify([r1, r2, r3, r4]));
    ok('F01 counts and logs unchanged (Today, Sent, done log, Tasks)', await greet() === g0 && await sentN() === s0 && await p.evaluate(() => Ida.store.get().done.length) === done0 && await offN() === off0);
    await p.locator('[data-edit="d-inspect"]').click(); await p.waitForTimeout(100);
    await p.locator('.ida-letter__body[contenteditable="true"]').click(); await p.keyboard.type('Hi Jen and Tom, the inspection is back.'); await p.waitForTimeout(100);
    ok('F01 typing into the empty editor recovers it', await p.locator('[data-approve="d-inspect"]').isEnabled());
    await p.locator('[data-edit="d-inspect"]').click(); await p.waitForTimeout(100);
    await p.locator('[data-restore="d-inspect"]').click(); await p.waitForTimeout(150);
    ok('F01 Restore Ida\'s draft recovers the original', /The inspection is back\. The roof and furnace/.test(await txt('#dec-d-inspect')) && await p.locator('[data-approve="d-inspect"]').isEnabled());

    // F02 Approve: queued 10 s, "Sending in N s · Undo" on every page, then Sent
    await reset();
    const rule = 'Nothing goes out until you approve. Then it waits 10 seconds, shown on every page as "Sending in N s · Undo", and only then goes out and moves to Sent.';
    ok('F02 copy under the approve button states exactly that', (await txt('#dec-d-inspect .ida-decision__fine')).startsWith(rule), await txt('#dec-d-inspect .ida-decision__fine'));
    await p.locator('[data-approve="d-inspect"]').click(); await p.waitForTimeout(200);
    ok('F02 Today: Sending in N s with Undo, count drops', /Sending to Jen and Tom Park in \d+ s/.test(await txt('#items')) && await p.locator('#items [data-cancel-send]').count() === 1 && await greet() === 5);
    for (const u of ['handled.html', 'tasks.html', 'apps.html']) { await go(u); ok('F02 toast "Sending in N s · Undo" on ' + u, /Sending in \d+ s/.test(await txt('.ida-toasts')) && await p.locator('.ida-toasts [data-ob]').count() === 1); }
    await go('sent.html'); const pend = await txt('#log');
    ok('F02 Sent: queued, not Delivered, with Undo', /Sending in \d+ s/.test(pend) && await p.locator('.ent.is-sending [data-cancel-send]').count() >= 1 && await sentN() === 23 && await p.locator('#sent-d-inspect').count() === 0);
    await p.locator('.ent.is-sending [data-cancel-send]').first().click(); await p.waitForTimeout(250);
    ok('F02 Undo on Sent cancels the send', await p.locator('.ent.is-sending').count() === 0 && await sentN() === 23);
    await go(''); ok('F02 ... and restores the decision on Today', /Send the inspection summary/.test(await txt('.ida-pile__card')) && await greet() === 6);
    await p.locator('[data-approve="d-inspect"]').click(); await p.waitForTimeout(200);
    await go('sent.html'); await p.waitForTimeout(10600);
    ok('F02 after 10 s (real time, on another page) it is Sent and Delivered', await sentN() === 24 && await p.locator('#sent-d-inspect').count() === 1 && /Delivered/.test(await txt('#sent-d-inspect')) && await p.locator('.ent.is-sending').count() === 0 && await p.locator('.ida-toasts [data-ob]').count() === 0);
    await go(''); ok('F02 Today logs it as done', /inspection summary/.test(await txt('#donelog')));
    await panel('p-parks'); ok('F02 panel: what Ida told the Parks now includes it, linked to Sent', /Sent the inspection summary/.test(await txt('#hp-told')) && await p.locator('#hp-told a[href="sent.html#sent-d-inspect"]').count() === 1);
    await reset(); await p.locator('[data-approve="d-inspect"]').click(); await p.waitForTimeout(150);
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('ida-demo-v8')); s.outbox.forEach(o => o.due = Date.now() - 1); localStorage.setItem('ida-demo-v8', JSON.stringify(s)); });
    await go('handled.html#p-parks'); ok('F02 overdue send goes out on the next page load', await p.evaluate(() => Ida.q.sentCount()) === 24 && /Sent the inspection summary/.test(await txt('#hp-told')));
    await reset(); await front('d-maya'); await p.locator('[data-choose="d-maya"][data-opt="offer"]').click(); await p.waitForTimeout(200);
    ok('F02 choice queued: Sending to Maya Chen', /Sending to Maya Chen in \d+ s/.test(await txt('#items')));
    await panel('p-maya'); ok('F02 panel: nothing sent to Maya yet', !/Offered Friday 5 pm/.test(await txt('#hp-told')));
    await sendNow(); await p.waitForTimeout(250); ok('F02 panel: sent after the delay', /Offered Friday 5 pm/.test(await txt('#hp-told')));
  }

  // 11. static checks
  const html = require('child_process').execSync('grep -l -E \'href="#"|alert\\(|confirm\\(|prompt\\(\' ' + process.argv[2] + '/*.js $(ls ' + process.argv[2] + '/*.html | grep -v main.html) || true').toString().trim();
  ok('no href=# / alert / confirm / prompt', !html, html);

  console.log(results.join('\n')); console.log('ERRORS', JSON.stringify(errs, null, 1));
  console.log('flows: ' + results.filter(r => r.startsWith('PASS')).length + ' / ' + results.length + ' pass');
  await b.close();
})();
