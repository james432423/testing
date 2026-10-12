// Workflows v2 (type sections, compact rows): every action on the page, no page errors, no CSP violations.
// Usage: BASE=http://localhost:8772/ NODE_PATH=$(npm root -g) node workflows_v2.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
const results = []; const errs = [];
function ok(name, cond, info) { results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + (info || ''))); }
(async () => {
  const b = await chromium.launch();
  async function mk(opts) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console ' + p.url() + ' :: ' + m.text()); });
    p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
    return p;
  }
  const p = await mk({ viewport: { width: 1240, height: 900 } });
  const csp = []; const grabCsp = async () => { const v = await p.evaluate(() => window.__csp || []).catch(() => []); csp.push(...v); };
  const go = async u => { await grabCsp(); await p.goto(BASE + u); await p.waitForTimeout(250); };
  const reset = async () => { await go(''); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await go('workflows.html'); };
  const txt = async sel => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ');
  const level = async id => p.locator('#' + id + ' .wf-trust button[aria-pressed="true"]').innerText();
  const undo = async () => { await p.locator('[data-toast-undo]').click(); await p.waitForTimeout(250); };

  // Structure
  await reset();
  const list = await txt('#wflist');
  ok('summary line', /7 workflows · 3 on their own · 3 you approve · 1 practicing · 1 paused/.test(await txt('#wfsum')), await txt('#wfsum'));
  ok('summary links to Being handled', await p.locator('#wfsum a[href="handled.html"]').count() === 1);
  ok('sections by type in order', /Buyer deals[\s\S]*Seller listings[\s\S]*Leads/.test(list));
  ok('no Other section', !/Other workflows/.test(list));
  ok('buyer applies line', /Applies to 2 buyer deals: the Parks and the Okafors\. New buyer deals get these automatically\./.test(list));
  ok('leads applies line', /Applies to 9 leads: Sarah Kim, Maya Chen, Marcus Lee and 6 more/.test(list));
  ok('seller exception compact', /Except the Garcias: ask me before any price note/.test(await txt('#wg-seller + p + p, .wf-type:nth-of-type(3) .wf-type__exc')), '');
  ok('appraisal under Buyer deals (from task pb)', await p.locator('section[aria-labelledby="wg-buyer"] #appraisal').count() === 1);
  ok('doc chase once, shared note in Sellers', await p.locator('#docchase').count() === 1 && /Also uses Document chase, set once under Buyer deals/.test(list));
  ok('7 rows', await p.locator('.wf-row').count() === 7);
  ok('details collapsed by default', await p.locator('.wf-row__more:visible').count() === 0);
  ok('one suggestion at top', await p.locator('.wf-sug [data-promote]').count() === 1 && await p.locator('.wf-row [data-promote]').count() === 0);
  ok('no Running chips (only exceptions)', !/Running/.test(list));
  ok('problem shown on showings', /Problem · Paused/.test(await txt('#showings')) && await p.locator('#showings [data-reconnect]').count() === 1);
  ok('no primary button', await p.locator('main .ida-btn--primary').count() === 0);
  ok('page shorter than 2000px', (await p.evaluate(() => document.querySelector('main').scrollHeight)) < 2000, String(await p.evaluate(() => document.querySelector('main').scrollHeight)));

  // Expand / collapse
  await p.locator('[data-wf-toggle="deadlines"]').click(); await p.waitForTimeout(100);
  ok('expand shows When/Ida/Except', /When Every morning at 7 am[\s\S]*Ida Reads the dates[\s\S]*Except Asks you first if a date needs to change · your rule/.test(await txt('#wfd-deadlines')));
  ok('aria-expanded true', await p.locator('[data-wf-toggle="deadlines"]').getAttribute('aria-expanded') === 'true');
  await p.locator('#wfd-deadlines a', { hasText: 'your rule' }).click(); await p.waitForTimeout(250);
  ok('your rule → rules page', /rules\.html#r-date$/.test(p.url()), p.url());
  await go('workflows.html');
  await p.locator('[data-wf-toggle="leads"]').click(); await p.locator('[data-wf-toggle="leads"]').click();
  ok('collapse again', await p.locator('#wfd-leads').isHidden());
  await go('workflows.html#offers'); await p.waitForTimeout(200);
  ok('hash opens row', await p.locator('#wfd-offers').isVisible());
  // expanded state survives a re-render
  await p.locator('[data-wf-toggle="inspection"]').click(); await p.locator('[data-promote]').click(); await p.waitForTimeout(200);
  ok('expanded survives re-render', await p.locator('#wfd-inspection').isVisible());

  // Promote + undo (suggestion box)
  await reset();
  await p.locator('[data-promote]').click(); await p.waitForTimeout(200);
  ok('promote: level On its own', (await level('inspection')) === 'On its own');
  ok('promote: undo link in suggestion box', await p.locator('.wf-sug [data-unpromote]').count() === 1);
  await p.locator('[data-unpromote]').click(); await p.waitForTimeout(200);
  ok('unpromote: back to You approve + suggestion back', (await level('inspection')) === 'You approve' && await p.locator('[data-promote]').count() === 1);
  await p.locator('[data-promote]').click(); await p.waitForTimeout(200); await undo();
  ok('promote toast undo', (await level('inspection')) === 'You approve');

  // Trust control: down, up, undo
  await p.locator('#offers .wf-trust button[data-level="practice"]').click(); await p.waitForTimeout(200);
  ok('trust control down', (await level('offers')) === 'Practice' && /Offer comparison moved to Practice/.test(await txt('.ida-toast')));
  await undo(); ok('trust down undo', (await level('offers')) === 'You approve');
  await p.locator('#appraisal .wf-trust button[data-level="approve"]').click(); await p.waitForTimeout(200);
  ok('trust control up', (await level('appraisal')) === 'You approve' && /moved up to You approve/.test(await txt('.ida-toast')));
  ok('summary updates', /2 you approve|4 you approve/.test(await txt('#wfsum')) && !/practicing/.test(await txt('#wfsum')), await txt('#wfsum'));
  await undo(); ok('trust up undo', (await level('appraisal')) === 'Practice');
  await p.locator('#inspection .wf-trust button[data-level="own"]').click(); await p.waitForTimeout(200);
  ok('inspection up uses promote', await p.locator('[data-unpromote]').count() === 1);
  await p.locator('[data-unpromote]').click(); await p.waitForTimeout(200);
  ok('trust buttons expose aria-pressed', await p.locator('#deadlines .wf-trust button[aria-pressed="true"]').count() === 1);

  // Options menu: pause / resume / move down / see what it sent / practice drafts / reconnect
  await reset();
  await p.locator('[data-menu="deadlines"]').click(); await p.getByRole('menuitem', { name: 'Pause' }).click(); await p.waitForTimeout(200);
  ok('pause: chip + summary', /Paused/.test(await txt('#deadlines')) && /2 paused/.test(await txt('#wfsum')));
  await p.locator('[data-wf-toggle="deadlines"]').click();
  ok('pause note in details', /By you\. Nothing runs until you resume it\./.test(await txt('#wfd-deadlines')));
  await undo(); ok('pause undo', !/Paused/.test(await txt('#deadlines .wf-row__top')));
  await p.locator('[data-menu="deadlines"]').click(); await p.getByRole('menuitem', { name: 'Pause' }).click(); await p.waitForTimeout(200);
  await p.locator('[data-menu="deadlines"]').click(); await p.getByRole('menuitem', { name: 'Resume' }).click(); await p.waitForTimeout(200);
  ok('resume', !/Paused/.test(await txt('#deadlines .wf-row__top')) && /running again/.test(await txt('.ida-toast')));
  await p.locator('[data-menu="leads"]').click(); await p.getByRole('menuitem', { name: /Move down to You approve/ }).click(); await p.waitForTimeout(200);
  ok('menu move down', (await level('leads')) === 'You approve');
  await undo(); ok('move down undo', (await level('leads')) === 'On its own');
  await p.locator('[data-menu="offers"]').click(); await p.getByRole('menuitem', { name: 'See what it sent' }).click(); await p.waitForTimeout(300);
  ok('menu: see what it sent → sent filtered', /sent\.html\?wf=offers$/.test(p.url()), p.url());
  await go('workflows.html');
  await p.locator('[data-menu="appraisal"]').click(); await p.getByRole('menuitem', { name: 'See the practice drafts' }).click(); await p.waitForTimeout(300);
  ok('menu: practice drafts', /practice\.html\?wf=appraisal$/.test(p.url()), p.url());
  await go('workflows.html');
  await p.locator('[data-menu="showings"]').click();
  ok('menu: reconnect item for app problem', await p.getByRole('menuitem', { name: 'Reconnect Google Calendar' }).count() === 1);
  await p.keyboard.press('Escape');

  // Links in rows
  await p.locator('#deadlines a', { hasText: 'See what it sent' }).click(); await p.waitForTimeout(300);
  ok('row link: see what it sent', /sent\.html\?wf=deadlines$/.test(p.url()), p.url());
  await go('workflows.html');
  await p.locator('#appraisal a', { hasText: 'Compare the drafts' }).click(); await p.waitForTimeout(300);
  ok('row link: compare drafts', /practice\.html\?wf=appraisal$/.test(p.url()), p.url());
  await go('workflows.html');
  await p.locator('a[data-jump="docchase"]').click(); await p.waitForTimeout(200);
  ok('shared link opens Document chase', await p.locator('#wfd-docchase').isVisible());

  // Reconnect inline
  await p.locator('#showings [data-reconnect]').click(); await p.waitForTimeout(1100);
  ok('reconnect clears problem', !/Problem/.test(await txt('#showings')) && !/paused/.test(await txt('#wfsum')));
  ok('reconnect toast', /Google Calendar reconnected/.test(await txt('.ida-toast')));
  await reset();
  await p.locator('[data-menu="showings"]').click(); await p.getByRole('menuitem', { name: 'Reconnect Google Calendar' }).click(); await p.waitForTimeout(200);
  ok('reconnect via menu', !/Problem/.test(await txt('#showings')));

  // Hand Ida a new task (Admin + Leads)
  await reset();
  await p.locator('#newtask').click(); await p.fill('#at-name', 'Order closing gifts'); await p.selectOption('#at-area', 'Admin');
  await p.locator('#addtask button[type=submit]').click(); await p.waitForTimeout(250);
  ok('new task: drawer confirms practice', /Ida is practicing it as a new workflow/.test(await txt('.ida-drawer')));
  ok('new task: Admin section with row at Practice', /Admin[\s\S]*Order closing gifts/.test(await txt('#wflist')) && /8 workflows · 3 on their own · 3 you approve · 2 practicing/.test(await txt('#wfsum')));
  await p.locator('.ida-drawer a', { hasText: 'See the workflow' }).click(); await p.waitForTimeout(300);
  ok('see the workflow opens its row', await p.locator('.wf-row__more:visible').count() === 1);
  await go('tasks.html'); await p.locator('[data-hand="t-prep"]').click(); await p.waitForTimeout(250); await go('workflows.html');
  ok('handed Leads task lands in Leads', await p.locator('section[aria-labelledby="wg-lead"] .wf-row', { hasText: 'Listing appointment prep' }).count() === 1);
  await p.locator('#newtask').click(); await p.locator('#addtask button[type=submit]').click();
  ok('new task: empty name error', await p.locator('#at-err').isVisible());

  // Escaping: tampered names render as text
  await p.evaluate(() => { const k = Object.keys(localStorage).find(x => /^ida-demo-v\d+$/.test(x)); const s = JSON.parse(localStorage.getItem(k)); s.workflows[0].name = '<img src=x onerror="window.__x=1">'; s.workflows[0].record = '<b>r</b>'; s.playbooks[1].except[0].text = '<svg onload="window.__x=1">'; localStorage.setItem(k, JSON.stringify(s)); });
  await go('workflows.html'); await p.waitForTimeout(200);
  ok('escaped: no injected elements', await p.evaluate(() => !window.__x && !document.querySelector('#wflist img, #wflist svg[onload], #wflist b:not(:empty) ~ b') && /<img src=x/.test(document.getElementById('wflist').textContent)));

  // Phone + dark
  const m = await mk({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await m.goto(BASE); await m.evaluate(() => localStorage.clear()); await m.goto(BASE + 'workflows.html'); await m.waitForTimeout(300);
  ok('phone: no horizontal scroll', await m.evaluate(() => document.documentElement.scrollWidth <= 390), String(await m.evaluate(() => document.documentElement.scrollWidth)));
  ok('phone: trust buttons ≥ 44px', (await m.locator('#deadlines .wf-trust button').first().boundingBox()).height >= 44);
  await m.locator('#offers .wf-trust button[data-level="own"]').tap(); await m.waitForTimeout(200);
  ok('phone: tap changes level', (await m.locator('#offers .wf-trust button[aria-pressed="true"]').innerText()) === 'On its own');
  ok('dark: body background dark', await m.evaluate(() => { const c = getComputedStyle(document.querySelector('.ida-sheet')).backgroundColor; return c === 'rgb(32, 31, 28)'; }));
  csp.push(...await m.evaluate(() => window.__csp || []));

  await grabCsp();
  ok('no CSP violations', csp.length === 0, csp.join(', '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(results.join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' / ' + results.length + ' pass');
})();
