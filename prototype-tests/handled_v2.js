// Being handled v2. Usage: BASE=http://localhost:8781/ node handled_v2.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
const results = [], errs = [];
const ok = (n, c, i) => results.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + (i || '')));
(async () => {
  const b = await chromium.launch();
  const setup = async (o) => {
    const c = await b.newContext(o); const p = await c.newPage();
    await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
    p.on('console', m => { if (/Content Security Policy/i.test(m.text())) errs.push('CSP ' + m.text()); });
    p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
    return p;
  };
  const p = await setup({ viewport: { width: 1240, height: 900 } });
  const go = async u => { await p.goto(BASE + u); await p.waitForTimeout(200); };
  const reset = async () => { await go('handled.html'); await p.evaluate(() => localStorage.clear()); await go('handled.html'); };
  const txt = async s => (await p.locator(s).first().innerText()).replace(/\s+/g, ' ');
  const dr = '#drawer .ida-drawer__body';
  const csp = async () => { const v = await p.evaluate(() => window.__csp); if (v.length) errs.push('CSP ' + p.url() + ' ' + v.join(', ')); };

  await reset();
  // Top counts
  const cnt = async id => +(await p.locator('[data-filter="' + id + '"] b').innerText());
  ok('counts: 4 need you, 2 waiting, 4 on track, 2 paused or quiet', await cnt('you') === 4 && await cnt('wait') === 2 && await cnt('track') === 4 && await cnt('off') === 2);
  ok('groups in setup order: Buyer deals, Seller listings, Leads', /Buyer deals[\s\S]*Seller listings[\s\S]*Leads/.test(await txt('#resps')));
  ok('buyer group summary', /2 buyer deals · 1 needs you · 1 waiting/.test(await txt('#pb-buyer .hd-group__sum')));
  ok('stuck first: Parks first in buyer deals, Marcus first in leads', (await p.locator('#pb-buyer .hd-row').first().getAttribute('id')) === 'cl-pb-buyer-p-parks' && (await p.locator('#pb-lead .hd-row').first().getAttribute('id')) === 'cl-pb-lead-p-marcus');
  ok('Parks: why + one primary action to Today', /Why it's stuck: HOA payoff letter/.test(await txt('#cl-pb-buyer-p-parks')) && await p.locator('#cl-pb-buyer-p-parks a.ida-btn--primary[href="./#dec-d-hoa"]').count() === 1);
  ok('exactly one primary button on the page', await p.locator('main .ida-btn--primary').count() === 1);
  ok('Marcus stuck on the calendar, action reconnects', /Google Calendar is disconnected/.test(await txt('#cl-pb-lead-p-marcus')) && await p.locator('#cl-pb-lead-p-marcus a[href="apps.html"]').count() === 1);
  ok('Sarah: question + Answer on Today', /lower your commission/.test(await txt('#cl-pb-lead-p-sarah')) && await p.locator('#cl-pb-lead-p-sarah a[href="./#dec-d-sarah"]').count() === 1);
  ok('next step with when', /Tue 9:00 am\s*·?\s*Remind the Parks to wire funds/.test(await txt('#cl-pb-buyer-p-parks .hd-next')));
  ok('Okafors waiting text', /Waiting on Ruth and David until Fri/.test(await txt('#cl-pb-buyer-p-okafors')));
  ok('progress meter for 5 of 6', await p.locator('#cl-pb-buyer-p-parks .hd-meter__dots i.on').count() === 5);
  ok('lead funnel', /12 contacted · 5 replied · 2 booked · 1 asked to reconnect in spring/.test(await txt('#pb-lead .hd-funnel')));
  ok('exception shown on the row', /Except the Garcias: Ask me before any price note/.test(await txt('#cl-pb-seller-p-garcias')));
  ok('no scope or switches on the page itself', await p.locator('main .ida-switch, main .ida-scope, main .ida-trust').count() === 0);
  // Filters
  await p.locator('[data-filter="wait"]').click();
  ok('filter Waiting shows 2 rows', await p.locator('.hd-row:visible').count() === 2 && await p.locator('[data-filter="wait"]').getAttribute('aria-pressed') === 'true');
  ok('empty group says none', /None of your seller listings here/.test(await txt('#pb-seller')));
  await p.locator('.hd-filtered [data-filter=""]').click(); ok('Show everyone', await p.locator('.hd-row:visible').count() === 12);
  await p.locator('[data-filter="you"]').click(); await p.locator('[data-filter="you"]').click(); ok('filter toggles off', await p.locator('.hd-row:visible').count() === 12);

  // Client panel: open via row click
  await p.locator('#cl-pb-buyer-p-okafors .hd-doing').click(); await p.waitForTimeout(150);
  ok('row opens client side panel', /Ruth and David Okafor/.test(await txt('#drawer .ida-drawer__head')) && /What Ida is handling next/.test(await txt(dr)));
  ok('panel: no People link; Follow Up Boss summary, what needs you, next, told, controls', await p.locator(dr + ' a[href^="people.html"]').count() === 0 && /From Follow Up Boss · synced 2 min ago/.test(await txt(dr)) && /What needs you[\s\S]*What Ida is handling next[\s\S]*What Ida told Ruth recently[\s\S]*Controls for the Okafors/.test(await txt(dr)));
  await p.locator(dr + ' [data-exadd]').click(); await p.fill(dr + ' [data-exform] input', 'Ask me before contacting the sellers\' agent'); await p.locator(dr + ' [data-exform] button[type=submit]').click(); await p.waitForTimeout(200);
  ok('exception added (row + panel)', /Except the Okafors: Ask me before contacting the sellers' agent/.test(await txt('#cl-pb-buyer-p-okafors')) && /Ask me before contacting/.test(await txt(dr)));
  await go('handled.html#p-okafors'); ok('handled.html#p-okafors reopens the panel with the exception', /Ruth and David Okafor/.test(await txt('#drawer .ida-drawer__head')) && /Except the Okafors: Ask me before contacting/.test(await txt(dr)));
  await go('handled.html'); await p.locator('[data-client="p-okafors"]').click();
  await p.locator(dr + ' [data-exdel]').click(); await p.waitForTimeout(150); ok('exception removed', !/sellers' agent/.test(await txt('#cl-pb-buyer-p-okafors')));
  await p.locator('[data-toast-undo]').click(); await p.waitForTimeout(150); ok('undo restores exception, panel refreshes', /sellers' agent/.test(await txt('#cl-pb-buyer-p-okafors')) && /sellers' agent/.test(await txt(dr)));
  // exception escaping
  await p.locator(dr + ' [data-exadd]').click(); await p.fill(dr + ' [data-exform] input', '<img src=x onerror="window.__x=1">'); await p.locator(dr + ' [data-exform] button[type=submit]').click(); await p.waitForTimeout(200);
  ok('exception text escaped', await p.evaluate(() => !window.__x) && await p.locator('main img[src="x"], #drawer img[src="x"]').count() === 0 && /<img src=x/.test(await txt('#cl-pb-buyer-p-okafors')));
  await p.locator(dr + ' [data-exadd]').click(); await p.locator(dr + ' [data-excancel]').click(); ok('exception form cancel', await p.locator(dr + ' [data-exform]').count() === 0);
  // Pause / resume Ida for one client
  await p.locator(dr + ' [data-ppause]').click(); await p.waitForTimeout(150);
  ok('pause client', /Ida paused for this client/.test(await txt('#cl-pb-buyer-p-okafors')) && await p.locator(dr + ' [data-presume]').count() === 1);
  await p.locator(dr + ' [data-presume]').click(); await p.waitForTimeout(150); ok('resume client', /Waiting/.test(await txt('#cl-pb-buyer-p-okafors .hd-chip')));
  // Take over / hand back
  await p.locator(dr + ' [data-takeover]').click(); await p.waitForTimeout(150);
  ok('take over', /You're handling/.test(await txt('#cl-pb-buyer-p-okafors')) && await p.locator(dr + ' [data-handback]').count() === 1);
  await p.locator(dr + ' [data-handback]').click(); await p.waitForTimeout(150); ok('hand back', !/You're handling/.test(await txt('#cl-pb-buyer-p-okafors')));
  // Leave out / cover again
  await p.locator('[data-client="p-ellen"]').click(); await p.locator(dr + ' [data-excl]').click(); await p.waitForTimeout(150);
  ok('leave out of playbook', /Not covered/.test(await txt('#cl-pb-lead-p-ellen')) && /Cover again/.test(await txt(dr)));
  await p.locator(dr + ' [data-excl]').click(); await p.waitForTimeout(150); ok('cover again', /Quiet/.test(await txt('#cl-pb-lead-p-ellen .hd-chip')));
  await p.locator('#drawer-close').click();

  // Playbook panel
  await p.locator('[data-pbpanel="pb-lead"]').click(); await p.waitForTimeout(150);
  ok('playbook panel: trust, duties, scope', /Leads playbook/.test(await txt('#drawer .ida-drawer__head')) && /On its own/.test(await p.locator(dr + ' .ida-trust').getAttribute('aria-label')) && /What comes to you/.test(await txt('#sc-pb-lead')) && /STOP ends texting/.test(await txt('#sc-pb-lead')) && /Running for 9 leads/.test(await txt(dr)));
  await p.locator(dr + ' [data-duty="pb-lead"][value="du-reengage"]').check({ force: true }); await p.waitForTimeout(150);
  ok('duty toggle on: Dev now on track', await p.locator(dr + ' [data-duty="pb-lead"][value="du-reengage"]').isChecked() && /On track/.test(await txt('#cl-pb-lead-p-dev .hd-chip')));
  await p.locator('[data-toast-undo]').click(); await p.waitForTimeout(150); ok('duty toggle undo', /Quiet/.test(await txt('#cl-pb-lead-p-dev .hd-chip')));
  await p.locator(dr + ' [data-rpause="pb-lead"]').click(); await p.waitForTimeout(150);
  ok('pause playbook', /Paused by you/.test(await txt('#pb-lead .hd-group__head')) && /Paused with the playbook/.test(await txt('#cl-pb-lead-p-sarah')) && await p.locator(dr + ' [data-rresume]').count() === 1);
  await p.locator('#pb-lead .hd-group__head [data-rresume]').click(); await p.waitForTimeout(150); ok('resume from group head', !/Paused by you/.test(await txt('#pb-lead .hd-group__head')));
  await p.locator(dr + ' [data-scope="pb-lead"]').click(); await p.selectOption('#dg-level', 'approve'); await p.fill('#dg-stop', 'Anyone who books, or 5 reminders'); await p.getByRole('button', { name: 'Save scope' }).click(); await p.waitForTimeout(250);
  await p.locator('[data-pbpanel="pb-lead"]').click(); await p.waitForTimeout(150);
  ok('change scope and trust saved', /You approve/.test(await p.locator(dr + ' .ida-trust').getAttribute('aria-label')) && /or 5 reminders/.test(await txt('#sc-pb-lead')));
  await p.locator('#drawer-close').click();

  // Hand Ida a responsibility
  await p.locator('main [data-delegate]').click(); await p.fill('#dg-goal', 'Re-engage leads that went quiet'); await p.locator('#dg-goal-form button[type=submit]').click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Approve and start' }).click(); await p.waitForTimeout(250);
  ok('delegate adds duty; Dev on track', /Added to your Leads playbook/.test(await txt(dr)) && /On track/.test(await txt('#cl-pb-lead-p-dev .hd-chip')));
  await p.locator('[data-close-dg]').click();
  await p.locator('main [data-delegate]').click(); await p.fill('#dg-goal', 'Chase the missing paperwork'); await p.locator('#dg-goal-form button[type=submit]').click(); await p.waitForTimeout(200);
  await p.locator('.ida-drawer [data-scope]').click(); ok('existing -> scope form opens once', /Change the Buyer deals playbook/.test(await txt('.ida-drawer__head')) && await p.locator('#dg-scope').count() === 1);
  await p.locator('#drawer-close').click();

  // Changes you told Ida: collapsed, opens, undo
  await reset();
  ok('changes collapsed by default, count 0', await p.locator('#changes').evaluate(e => !e.open) && /Changes you told Ida 0/.test(await txt('#ch-sum')));
  await go(''); await p.fill('.ask input', "Sarah's pausing until February"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200); await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(250);
  await go('handled.html');
  ok('summary shows latest change', /Changes you told Ida 1/.test(await txt('#ch-sum')) && /Latest: Sarah is pausing until February/.test(await txt('#ch-sum')));
  ok('Sarah row paused until February', /Paused until February/.test(await txt('#cl-pb-lead-p-sarah')));
  await p.locator('#ch-sum').click(); ok('expand changes', /Sarah is pausing until February/.test(await txt('#chlist')));
  await p.locator('[data-cundo]').click(); await p.waitForTimeout(250);
  ok('undo change, section stays open', /Undone/.test(await txt('#chlist')) && !/Paused until February/.test(await txt('#cl-pb-lead-p-sarah')));
  await go('handled.html#changes'); ok('#changes link opens the section', await p.locator('#changes').evaluate(e => e.open));
  await go('handled.html#pb-seller'); ok('#pb-seller anchor exists', await p.locator('#pb-seller').count() === 1);
  // Links out
  await go('handled.html'); await p.locator('[data-client="p-sarah"]').click(); await p.locator(dr + ' #hp-told a').first().click(); await p.waitForTimeout(300);
  ok('panel told link opens the message on Sent', /sent\.html#s18$/.test(p.url()) && await p.locator('#s18.is-open').count() === 1);
  await go('handled.html'); await p.locator('[data-client="p-sarah"]').click(); await p.locator(dr + ' #hp-needs a[href="./#dec-d-sarah"]').click(); await p.waitForTimeout(300);
  ok('panel Answer on Today navigates to the decision', /#dec-d-sarah$/.test(p.url()) && /lower your commission/.test(await txt('.ida-pile__card')));
  await go('handled.html'); await p.locator('#cl-pb-buyer-p-parks a.ida-btn--primary').click(); await p.waitForTimeout(250); ok('Decide on Today navigates', /#dec-d-hoa$/.test(p.url()));
  await go('handled.html'); ok('desktop no horizontal scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.locator('[data-client="p-parks"]').click(); ok('desktop with panel: no horizontal scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await csp();

  // Phone, light and dark
  for (const scheme of ['light', 'dark']) {
    const q = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme });
    await q.goto(BASE + 'handled.html'); await q.waitForTimeout(300);
    ok('phone ' + scheme + ': no horizontal scroll', await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('phone ' + scheme + ': counts visible', await q.locator('[data-filter="you"]').isVisible());
    await q.locator('[data-client="p-garcias"]').click(); await q.waitForTimeout(200);
    ok('phone ' + scheme + ': client panel opens and fits', /Luis and Ana Garcia/.test(await q.locator('#drawer').innerText()) && /From Follow Up Boss/.test(await q.locator('#drawer').innerText()) && await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const fb = await q.locator('#hp-fub').boundingBox(); ok('phone ' + scheme + ': Follow Up Boss block inside the screen', fb && fb.x >= 0 && fb.x + fb.width <= 390, JSON.stringify(fb));
    const v = await q.evaluate(() => window.__csp); if (v.length) errs.push('CSP phone ' + v.join(', '));
  }
  console.log(results.join('\n'));
  console.log('PASSED ' + results.filter(r => r.startsWith('PASS')).length + ' / ' + results.length);
  console.log('ERRORS', JSON.stringify(errs, null, 1));
  await b.close();
})();
