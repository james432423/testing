// Security checks for site2. Run against serve.py (sends the vercel.json headers).
//  A. XSS: pushes script payloads through every user-controllable input (ask field, add-task,
//     add/edit rule, onboarding "task we missed", practice reasons, inline-edited drafts, URL
//     params, location.hash, tampered localStorage). Runs with the CSP bypassed, so it proves the
//     escaping/sanitizing itself works (CSP is a second layer), then again with the CSP on.
//     Pass = no payload ever runs, and no element anywhere carries an on* attribute.
//  B. CSP: loads every page (and the side panel, Original views and app picker) under the CSP
//     and asserts zero CSP violations, page errors or console errors.
//  C. Headers: every route sends the security headers from vercel.json.
// Usage: node security.js            (BASE defaults to http://localhost:8765/)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond || info === undefined ? '' : ' :: ' + String(info).slice(0, 300))); if (!cond) fails++; };

const MARK = 'window.__xss=(window.__xss||0)+1';
const PAYLOADS = [
  `<img src=x onerror="${MARK}">`,
  `"><svg onload="${MARK}">`,
  `'><script>${MARK}</script>`,
  `<a href="javascript:${MARK}" id="jslink">x</a>`,
  `<iframe srcdoc="<script>parent.${MARK}</script>"></iframe>`
];
const ONE = PAYLOADS.join(' ');

// Being handled v2 keeps scopes, duties and per-client controls in a side panel: open each one.
async function openHandledPanels(page, after) {
  const ids = await page.$$eval('main [data-pbpanel], main [data-client]', els => els.map(e => e.hasAttribute('data-client') ? ['client', e.getAttribute('data-client')] : ['pb', e.getAttribute('data-pbpanel')]));
  for (const [k, id] of ids) {
    await page.locator(k === 'pb' ? 'main [data-pbpanel="' + id + '"]' : 'main [data-client="' + id + '"]').first().click().catch(() => {});
    await page.waitForTimeout(80); if (after) await after(k, id);
  }
}
async function probe(page, where) {
  // Any script run by a payload bumps window.__xss. Also check the DOM (all frames) for
  // on* attributes, javascript: URLs and injected <script>/<iframe srcdoc> elements.
  await page.waitForTimeout(150);
  for (const f of page.frames()) {
    const r = await f.evaluate(() => {
      const bad = [];
      document.querySelectorAll('*').forEach(el => {
        for (const a of el.attributes) {
          if (/^on/i.test(a.name)) bad.push(el.tagName + '[' + a.name + ']');
          if (/^(href|src|action|formaction|srcdoc)$/i.test(a.name) && /javascript:|__xss/i.test(a.value)) bad.push(el.tagName + '[' + a.name + '=' + a.value.slice(0, 40) + ']');
        }
        if (el.tagName === 'SCRIPT' && !el.src) bad.push('inline SCRIPT');
      });
      return { xss: window.__xss || 0, bad };
    }).catch(() => ({ xss: 0, bad: [] }));
    ok(where + (f === page.mainFrame() ? '' : ' [frame ' + f.url().replace(/^.*\//, '') + ']') + ': no payload ran, no handler attributes', r.xss === 0 && r.bad.length === 0, JSON.stringify(r));
  }
}

async function xssSuite(browser, label, bypassCSP) {
  const ctx = await browser.newContext({ viewport: { width: 1240, height: 900 }, bypassCSP });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
  p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
  const go = async u => { await p.goto(BASE + u); await p.waitForTimeout(200); };
  const reset = async () => { await go(''); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await go(''); };
  const L = s => label + ' · ' + s;
  const ask = async text => { await p.fill('.ask input', text); await p.press('.ask input', 'Enter'); await p.waitForTimeout(150); };

  // 1. Ask field: unrecognized text, a question, a rule, a task, a draftable task
  await reset();
  await ask(ONE); await probe(p, L('ask: free text'));
  ok(L('ask: payload shown as text'), (await p.locator('#ida-reply').innerText()).includes('<img src=x onerror='));
  await ask('who is on ' + ONE + '?'); await probe(p, L('ask: question'));
  await ask('Never ' + ONE); await probe(p, L('ask: rule understood'));
  await p.locator('[data-addrule]').click(); await probe(p, L('ask: rule added'));
  await go('rules.html'); await probe(p, L('rules page shows ask-added rule'));
  ok(L('rules: payload text rendered literally'), (await p.locator('main').innerText()).includes('onerror='));
  await go(''); await ask('Schedule ' + ONE); await probe(p, L('ask: task understood'));
  await p.locator('[data-addtask]').click(); await probe(p, L('ask: task added'));
  await go('tasks.html'); await probe(p, L('tasks page shows ask-added task'));
  await go(''); await ask('Follow up with Kim about ' + ONE); await p.locator('[data-draft]').click(); await probe(p, L('ask: draft for approval'));
  await go(''); await probe(p, L('today shows drafted decision'));
  // bring the drafted one forward and approve it, then check Sent
  const drafted = p.locator('[data-open]').last(); if (await drafted.count()) { await drafted.click(); await p.waitForTimeout(150); }
  await p.locator('[data-approve]').first().click(); await probe(p, L('approve drafted message'));
  await go('sent.html'); await p.locator('.ent__open').first().click(); await probe(p, L('sent page after approving payload draft'));

  // 2. Add task form (Tasks) and Workflows "Hand Ida a new task"
  await reset(); await go('tasks.html');
  await p.locator('#addtask-btn').click(); await p.fill('#at-name', ONE); await p.locator('#addtask button[type=submit]').click(); await probe(p, L('add-task form'));
  await p.locator('[data-more]').click(); await p.fill('#at-name', ONE); await p.check('input[name="at-who"][value="ida"]'); await p.locator('#addtask button[type=submit]').click(); await probe(p, L('add-task form, handed to Ida'));
  await p.locator('.ida-board__item [data-open]').last().click(); await probe(p, L('task detail panel'));
  await go('workflows.html'); await probe(p, L('workflows page with payload workflow'));
  await p.locator('[data-menu]').last().click(); await probe(p, L('workflow options menu'));
  await go('practice.html?wf=' + encodeURIComponent(await p.evaluate(() => Ida.store.get().workflows.slice(-1)[0].id))); await probe(p, L('practice page for payload workflow'));
  await go(''); await probe(p, L('today Your work with payload task'));

  // 3. Rules: add with confirm, then inline edit
  await reset(); await go('rules.html');
  await p.fill('#newrule', ONE); await p.locator('#addrule button[type=submit], #addrule [type=submit]').first().click(); await probe(p, L('add-rule confirm step'));
  await p.locator('[data-confirm]').click(); await probe(p, L('add-rule saved'));
  await p.locator('[data-edit]').first().click(); await p.fill('[data-editform] input', ONE); await p.locator('[data-editform] button[type=submit]').click(); await probe(p, L('edit-rule saved'));
  await p.locator('.ida-switch').first().click(); await probe(p, L('toggle rule toast'));
  await go('workflows.html'); await probe(p, L('workflows except-line uses edited rule'));

  // 4. Onboarding: add a task we missed
  await reset(); await go('onboarding.html');
  await p.locator('[data-show-missed]').click(); await p.fill('#m-name', ONE); await p.locator('#missed button[type=submit]').click(); await probe(p, L('onboarding: task we missed'));
  await p.locator('[data-go="3"]').click(); await probe(p, L('onboarding: connect apps step'));

  // 5. Practice: "Not like me" free-text reason
  await reset(); await go('practice.html?wf=appraisal');
  await p.locator('[data-v="not"]').click(); await p.fill('#reason textarea', ONE); await p.locator('#reason button[type=submit]').click(); await probe(p, L('practice: reason saved'));

  // 6. Inline-edited draft (simulates pasting rich HTML into the editable letter)
  await reset();
  await p.locator('[data-edit]').first().click(); await p.waitForTimeout(100);
  await p.evaluate(html => { const b = document.querySelector('.ida-letter__body[contenteditable="true"]'); b.innerHTML += html; b.dispatchEvent(new Event('input', { bubbles: true })); }, '<p>' + ONE + '</p>');
  await p.waitForTimeout(1000); await p.evaluate(() => { window.__xss = 0; }); // the live paste itself is the browser's job; what matters is what Ida stores and re-renders
  await p.locator('[data-edit]').first().click(); await probe(p, L('edited draft saved and re-rendered'));
  const stored = await p.evaluate(() => Ida.store.get().decisions[0].body);
  ok(L('stored draft body is sanitized'), !/onerror|onload|<script|<img|<svg|<iframe|javascript:/i.test(stored), stored);
  await go(''); await probe(p, L('edited draft after reload'));
  await p.locator('[data-approve]').first().click(); await go('sent.html'); for (const b of await p.locator('.ent__open').all()) await b.click({ timeout: 2000 }).catch(() => {}); await probe(p, L('sent page shows edited draft while it waits to send'));
  await p.evaluate(() => Ida.act.flush(Date.now() + 60000)); await p.waitForTimeout(200); for (const b of await p.locator('.ent:not(.is-open) .ent__open').all()) await b.click({ timeout: 2000 }).catch(() => {}); await probe(p, L('sent page shows edited draft once sent'));


  // 6b. New inputs: delegate form, change plan (ask bar + edit), client panel, scope form
  await reset(); await go('handled.html');
  await p.locator('main [data-delegate]').click(); await p.fill('#dg-goal', ONE); await p.locator('#dg-goal-form button[type=submit]').click(); await probe(p, L('delegate: proposal from payload goal'));
  await p.fill('#dg-title', ONE); await p.fill('#dg-say', ONE); await p.fill('#dg-stop', ONE); await p.fill('#dg-toyou', ONE); await p.check('input[name="dg-to"][value="only"]'); await p.locator('#dg-pick input').first().check();
  await p.getByRole('button', { name: 'Approve and start' }).click(); await probe(p, L('delegate: started with payload scope'));
  await go('handled.html'); await openHandledPanels(p); await p.locator('#ch-sum').click(); await probe(p, L('handled: payload responsibility and scopes'));
  await p.locator('main [data-pbpanel="pb-lead"]').click(); ok(L('handled: payload title rendered as text in the playbook panel'), (await p.locator('#drawer').innerText()).includes('<img src=x onerror='));
  await p.locator('main [data-client="p-sarah"]').click(); await p.waitForTimeout(100); ok(L('handled: payload title rendered as text in the client panel'), (await p.locator('#drawer').innerText()).includes('<img src=x onerror='));
  await p.locator('main [data-client]').first().click(); await p.locator('#drawer [data-exadd]').first().click(); await p.fill('#drawer [data-exform] input', ONE); await p.locator('[data-exform] button[type=submit]').click(); await probe(p, L('exception with payload'));
  await go('handled.html#p-parks'); await probe(p, L('client panel shows payload exception'));
  await go('tasks.html'); await probe(p, L('tasks with payload duty')); await go('workflows.html'); await probe(p, L('workflows grouped with payload')); await go('handled.html');
  await p.locator('main [data-pbpanel]').first().click(); await p.locator('#drawer [data-scope]').first().click(); await p.fill('#dg-who', ONE); await p.getByRole('button', { name: 'Save scope' }).click(); await probe(p, L('scope form saved with payload'));
  await go(''); await probe(p, L('today with payload responsibility'));
  await ask('Follow up with my open house leads ' + ONE); await probe(p, L('ask: goal with payload'));
  await p.locator('[data-delegate-ask]').click(); await probe(p, L('ask: goal -> delegate drawer'));
  await go(''); await ask("Sarah's pausing until February " + ONE); await probe(p, L('ask: change plan with payload'));
  await p.locator('[data-plan-edit]').click(); await p.fill('[data-stepval="st1"]', ONE); await p.fill('[data-stepval="st4"]', ONE);
  await p.locator('[data-plan-edit]').click(); await probe(p, L('change plan edited with payload'));
  await p.locator('[data-plan-apply]').click(); await probe(p, L('change plan applied with payload'));
  for (const u of ['handled.html#p-sarah', 'handled.html', 'sent.html', 'tasks.html', '']) { await go(u); await probe(p, L('after payload change · ' + (u || 'index'))); }
  await go('handled.html#p-sarah'); await p.waitForTimeout(150); await probe(p, L('client panel with payload message and note'));
  ok(L('payload message shown as text in the client panel'), (await p.locator('#drawer').innerText()).includes('onerror='));
  await p.locator('#hp-told a').first().click(); await p.waitForTimeout(300); await probe(p, L('told link opens the payload message on Sent'));
  await go(''); await ask('I spoke with Maya, she said ' + ONE); await probe(p, L('ask: note plan with payload'));
  if (await p.locator('[data-plan-apply]').count()) { await p.locator('[data-plan-apply]').click(); await go('handled.html#p-maya'); await probe(p, L('note plan applied with payload')); ok(L('payload note shown as text in the Follow Up Boss block'), (await p.locator('#hp-fub').innerText()).includes('onerror=')); }
  await go('handled.html#' + encodeURIComponent(ONE)); await probe(p, L('handled hash payload'));
  await go('sent.html#' + encodeURIComponent(ONE)); await probe(p, L('sent hash payload'));
  await go('people.html#' + encodeURIComponent(ONE)); await probe(p, L('old people link with hash payload (redirected)'));
  await go('sent.html?group=' + encodeURIComponent(ONE)); await probe(p, L('sent group param payload'));

  // 7. URL params and hash
  for (const u of ['doc.html?d=' + encodeURIComponent(ONE), 'doc.html?d=constructor', 'doc.html?d=__proto__', 'doc.html?d=toString&view=original',
    'doc.html?d=' + encodeURIComponent('javascript:' + MARK), 'doc.html?d=kim-email&page=' + encodeURIComponent(ONE) + '#page-' + encodeURIComponent(ONE),
    'practice.html?wf=' + encodeURIComponent(ONE), 'practice.html?wf=constructor', 'sent.html?wf=' + encodeURIComponent(ONE) + '&deal=' + encodeURIComponent(ONE),
    'tasks.html?add=1#' + encodeURIComponent(ONE), 'rules.html#' + encodeURIComponent(ONE), 'apps.html#' + encodeURIComponent('"><img src=x onerror=' + MARK + '>'),
    'report.html?embed=1&view=original&page=' + encodeURIComponent(ONE)]) {
    await go(u); await probe(p, L('url ' + decodeURIComponent(u).slice(0, 60)));
  }
  await go('doc.html?d=' + encodeURIComponent(ONE));
  ok(L('unknown doc id shows the not-found page, no iframe'), /doesn't include that document/.test(await p.locator('body').innerText()) && (await p.locator('iframe').count()) === 0);
  await go('doc.html?d=constructor');
  ok(L('doc id "constructor" is not resolved from the prototype'), /doesn't include that document/.test(await p.locator('body').innerText()));

  // 8. Tampered localStorage
  // 8a. text and HTML fields carry payloads, ids stay valid: everything must render escaped/sanitized
  await reset();
  await p.evaluate(P => {
    const s = Ida.store.get(); const T = x => x + ' ' + P;
    s.apps.forEach(a => { a.name = T(a.name); a.desc = T(a.desc); a.sync = T(a.sync); a.logo = P; a.problemText = T(a.problemText || ''); });
    s.workflows.forEach(w => { w.name = T(w.name); w.when = T(w.when); w.does = T(w.does); w.last = T(w.last || ''); });
    s.tasks.forEach(t => { t.name = T(t.name); t.area = T(t.area); t.note = T(t.note || ''); });
    s.rules.forEach(r => { r.text = T(r.text); r.src = T(r.src || ''); });
    s.decisions.forEach(d => { d.q = T(d.q); d.tab = T(d.tab); d.tabSub = T(d.tabSub); d.meta = T(d.meta); d.label = T(d.label); d.primary = T(d.primary); d.fine = T(d.fine); d.why = T(d.why || ''); d.quote = T(d.quote || ''); d.body = T(d.body); d.link = T(d.link || ''); d.srcLabel = T(d.srcLabel || ''); d.toWho = T(d.toWho || ''); d.head = d.head.map(h => [T(h[0]), T(h[1])]); });
    s.sent.forEach(e => { e.to = T(e.to); e.subj = T(e.subj); e.deal = T(e.deal); e.state = T(e.state); e.t = T(e.t); e.body = T(e.body); e.head = e.head.map(h => [T(h[0]), T(h[1])]); if (e.src) { e.src.q = T(e.src.q); e.src.link = T(e.src.link); e.src.pg = T(e.src.pg); } });
    s.done.forEach(d => { d.text = T(d.text); d.src = T(d.src || ''); d.time = T(d.time); });
    s.upcoming.forEach(u => { u.text = T(u.text); u.short = T(u.short || ''); u.time = T(u.time); });
    s.onboarding.extra = [{ id: 'x1', col: 'Leads', name: P }];
    s.people.forEach(p => { p.name = T(p.name); p.short = T(p.short); p.role = T(p.role); p.resume = T(p.resume || ''); p.stageNote = T(p.stageNote || ''); p.thread.forEach(m => { m.text = T(m.text); m.sum = T(m.sum || ''); m.t = T(m.t); if (m.src) { m.src.label = T(m.src.label || ''); m.src.cite = T(m.src.cite || ''); } }); p.expects.forEach(x => { x.text = T(x.text); x.work = T(x.work || ''); }); p.handling.forEach(h => { h.text = T(h.text); h.when = T(h.when); }); p.notes.push({ t: P, text: P }); });
    s.playbooks.forEach(r => { r.name = T(r.name); r.one = T(r.one); r.many = T(r.many); r.since = T(r.since || ''); r.duties.forEach(d => { d.name = T(d.name); d.progress = T(d.progress || ''); }); Object.keys(r.info).forEach(k => { const i = r.info[k]; i.deal = T(i.deal || ''); i.progress = T(i.progress || ''); i.stuckText = T(i.stuckText || ''); i.waitText = T(i.waitText || ''); if (i.next) { i.next.text = T(i.next.text); i.next.when = T(i.next.when); } }); r.except.push({ id: 'exx', person: 'p-sarah', text: P }); Object.keys(r.scope).forEach(k => { r.scope[k] = T(r.scope[k]); }); });
    s.events.forEach(e => { e.text = T(e.text); e.t = T(e.t); e.recommend = T(e.recommend || ''); e.next = T(e.next || ''); });
    s.decisions.forEach(d => { d.situation = T(d.situation || ''); d.recommend = T(d.recommend || ''); d.next = T(d.next || ''); d.said = T(d.said || ''); d.quoteFrom = T(d.quoteFrom || ''); (d.options || []).forEach(o => { o.label = T(o.label); o.next = T(o.next); }); });
    s.changes = [{ id: 'c1', text: P, title: P, person: 'p-sarah', steps: [P], at: P, snap: '{}' }];
    localStorage.setItem('ida-demo-v8', JSON.stringify(s));
  }, ONE);
  for (const u of ['', 'tasks.html', 'workflows.html', 'rules.html', 'apps.html', 'sent.html', 'practice.html', 'onboarding.html', 'handled.html#p-sarah', 'handled.html']) {
    await go(u); await probe(p, L('tampered text fields · ' + (u || 'index.html')));
  }
  await go('handled.html'); await p.locator('main [data-pbpanel]').first().click(); await p.locator('#drawer [data-scope]').first().click(); await probe(p, L('tampered playbook scope form'));
  for (const id of ['p-sarah', 'p-maya', 'p-parks', 'p-kim']) { await go('handled.html#' + id); await p.waitForTimeout(150); await probe(p, L('tampered client panel · ' + id)); ok(L('tampered client panel renders text · ' + id), (await p.locator('#drawer').innerText()).includes('onerror=')); }
  await go('handled.html'); await p.locator('#ch-sum').click(); await openHandledPanels(p, async () => { await probe(p, L('tampered handled side panel')); }); await probe(p, L('tampered scopes expanded'));
  await go(''); for (const b of await p.locator('[data-open]').all()) { await b.click({ timeout: 2000 }).catch(() => {}); await probe(p, L('tampered choice card')); } await p.evaluate(() => Ida.act.toFront('d-inspect'));
  await go(''); ok(L('tampered text still renders (escaped, not dropped)'), (await p.locator('#items').innerText()).includes('onerror='));
  await go('sent.html'); for (const b of await p.locator('.ent__open').all()) await b.click({ timeout: 2000 }).catch(() => {}); await probe(p, L('tampered sent bodies expanded'));
  await go('apps.html'); await p.locator('[data-manage]').first().click(); await probe(p, L('tampered app manage panel'));
  await go('tasks.html'); await p.locator('[data-open]').first().click(); await probe(p, L('tampered task panel'));
  await go(''); await p.locator('[data-edit]').first().click(); await probe(p, L('tampered draft in edit mode'));
  await p.locator('[data-edit]').first().click(); await probe(p, L('tampered draft saved'));
  await go('onboarding.html'); await probe(p, L('tampered onboarding'));
  // 8a2. Queued sends and the stored Undo carry payloads: toasts, Today and Sent render them as text
  await reset();
  await p.evaluate(P => {
    const s = JSON.parse(JSON.stringify(Ida.store.get())); const due = Date.now() + 900000;
    s.decisions[0].status = 'sending'; s.outbox = [{ id: 'ob1', kind: 'approve', dec: s.decisions[0].id, due, to: P, subj: P }, { id: 'ob2', kind: 'insight', due, to: P, subj: P }]; s.insight.status = 'sending';
    localStorage.setItem('ida-demo-v8', JSON.stringify(s));
    localStorage.setItem('ida-demo-v8-undo', JSON.stringify({ id: 'u1', msg: '<b>Done.</b> ' + P, exp: Date.now() + 900000, rev: s.rev, snap: JSON.stringify(s) }));
  }, ONE);
  for (const u of ['', 'sent.html', 'tasks.html', 'handled.html#p-parks']) { await go(u); if (u === 'sent.html') for (const b of await p.locator('.ent__open').all()) await b.click({ timeout: 2000 }).catch(() => {}); await probe(p, L('tampered outbox + undo · ' + (u || 'index.html'))); }
  await go(''); ok(L('tampered toast text shown as text'), (await p.locator('.ida-toasts').innerText()).includes('onerror=') && await p.locator('.ida-toasts img, .ida-toasts svg:not([aria-hidden]), .ida-toasts iframe').count() === 0);
  await p.evaluate(() => localStorage.setItem('ida-demo-v8-undo', '{"id":"\\"><img src=x onerror=1>","msg":"x","exp":9e15,"rev":0,"snap":"{}"}')); await go(''); await probe(p, L('tampered undo id rejected'));
  ok(L('undo with a bad id is ignored'), await p.locator('[data-undo-id]').count() === 0);

  // 8b. id-like fields carry payloads: the store must reject the state and fall back to the sample data
  const tampers = [
    s => { s.decisions[0].id = '"><img src=x onerror=' + MARK + '>'; },
    s => { s.tasks[0].wf = '" onmouseover="' + MARK; },
    s => { s.sent[0].src && (s.sent[0].src.doc = '"><svg onload=' + MARK + '>'); s.sent[0].how = '"><svg onload=' + MARK + '>'; },
    s => { s.workflows[0].level = '<img src=x onerror=' + MARK + '>'; },
    s => { s.onboarding.picks = { '"><img src=x onerror=x>': true }; },
    s => { s.apps[0].id = 'javascript:alert(1)'; },
    s => { s.people[0].id = '"><img src=x onerror=' + MARK + '>'; },
    s => { s.playbooks[0].excluded = ['" onfocus="' + MARK]; },
    s => { s.playbooks[1].info['"><img src=x onerror=x>'] = {}; },
    s => { s.decisions[3].options[0].opt = '"><svg onload=' + MARK + '>'; },
    s => { s.people[1].ida = '<img src=x onerror=' + MARK + '>'; },
    s => { s.notify.booked = '"><img src=x onerror=' + MARK + '>'; },
    s => { s.events[0].person = 'x" onclick="' + MARK; },
    s => { s.people[0].thread[1].sid = '"><img src=x onerror=' + MARK + '>'; }
  ];
  for (let i = 0; i < tampers.length; i++) {
    await reset();
    await p.evaluate(([src, mark]) => { const s = JSON.parse(localStorage.getItem('ida-demo-v8')) || Ida.store.get(); (new Function('s', 'MARK', 'return (' + src + ')(s)'))(s, mark); localStorage.setItem('ida-demo-v8', JSON.stringify(s)); }, [tampers[i].toString(), MARK]);
    for (const u of ['', 'tasks.html', 'sent.html', 'apps.html', 'onboarding.html', 'handled.html#p-sarah', 'handled.html']) { await go(u); await probe(p, L('tampered id #' + (i + 1) + ' · ' + (u || 'index.html'))); }
    await go(''); ok(L('tampered id #' + (i + 1) + ' rejected, sample data shown'), /6 things need you/.test(await p.locator('#greet').innerText()));
  }
  // 8c. garbage and prototype keys
  for (const raw of ['{"v":5,"__proto__":{"x":1}}', 'not json', '{"v":5}', JSON.stringify({ v: 5, apps: 'x' })]) {
    await p.evaluate(r => localStorage.setItem('ida-demo-v8', r), raw); await go(''); ok(L('bad stored state ' + raw.slice(0, 24) + ' falls back to sample'), /6 things need you/.test(await p.locator('#greet').innerText()));
  }

  // 9. Link hygiene on every page: target=_blank always has rel=noopener, no javascript: links,
  //    every iframe src is same-origin. The only offsite link is "Open in Follow Up Boss" (the
  //    agent's CRM): exactly https://app.followupboss.com/, new tab, rel=noopener.
  await reset();
  for (const u of ['', 'tasks.html', 'workflows.html', 'rules.html', 'apps.html', 'sent.html', 'practice.html', 'onboarding.html', 'handled.html#p-sarah', 'handled.html#p-kim', 'handled.html', 'main.html', 'doc.html?d=kim-email', 'report.html', 'comps.html']) {
    await go(u);
    if (u === '') { await p.getByText('Open the report at page 4').first().click(); await p.waitForTimeout(300); }
    const r = await p.evaluate(base => {
      const bad = [];
      document.querySelectorAll('a[target=_blank]').forEach(a => { if (!/\bnoopener\b/.test(a.rel)) bad.push('no noopener: ' + a.getAttribute('href')); });
      document.querySelectorAll('a[href]').forEach(a => { if (/^\s*javascript:/i.test(a.getAttribute('href'))) bad.push('js link'); if (new URL(a.href).origin !== location.origin && !(a.getAttribute('href') === 'https://app.followupboss.com/' && a.target === '_blank' && /\bnoopener\b/.test(a.rel))) bad.push('offsite link: ' + a.href); });
      document.querySelectorAll('iframe[src]').forEach(f => { if (f.getAttribute('src') !== 'about:blank' && new URL(f.src).origin !== location.origin) bad.push('offsite iframe: ' + f.src); });
      return bad;
    }, BASE);
    ok(L('links/iframes on ' + (u || 'index.html')), r.length === 0, r.join(', '));
    if (/^handled\.html#/.test(u)) ok(L('one Follow Up Boss link on ' + u + ', new tab + noopener'), await p.locator('#drawer a[href="https://app.followupboss.com/"][target="_blank"][rel~="noopener"]').count() === 1);
  }
  ok(L('no page errors or dialogs'), errs.length === 0, errs.join('\n'));
  await ctx.close();
}

async function cspSuite(browser) {
  // Every page, plus the dynamic views, under the real CSP: no violations, errors or failed loads.
  const ctx = await browser.newContext({ viewport: { width: 1240, height: 900 } });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errs.push(p.url() + ' console :: ' + m.text()); });
  p.on('requestfailed', r => { if (!/\.pdf/.test(r.url())) errs.push('requestfailed ' + r.url() + ' ' + (r.failure() && r.failure().errorText)); });
  const viol = async () => { let v = []; for (const f of p.frames()) v = v.concat(await f.evaluate(() => window.__csp || []).catch(() => [])); return v; };
  const pages = ['', 'index.html', 'main.html', 'handled.html#p-maya', 'handled.html#p-kim', 'people.html#p-sarah', 'handled.html', 'sent.html?group=day', 'tasks.html', 'tasks.html?add=1', 'workflows.html', 'rules.html', 'apps.html', 'sent.html', 'practice.html', 'practice.html?wf=appraisal', 'onboarding.html', 'doc.html?d=kim-email', 'doc.html?d=ash-appraisal&view=original', 'report.html', 'comps.html', 'report.html?embed=1#cite'];
  for (const u of pages) { await p.goto(BASE + u); await p.waitForTimeout(400); const v = await viol(); ok('csp: ' + (u || '/') + ' no violations', v.length === 0, v.join(', ')); }
  // fonts actually loaded from Google Fonts under the CSP
  await p.goto(BASE); await p.waitForTimeout(800);
  ok('csp: Google Fonts allowed (Schibsted Grotesk loaded)', await p.evaluate(() => document.fonts.check('16px "Schibsted Grotesk"')));
  // dynamic: side panel with a document, ask field, app picker, manage panel, onboarding logos
  await p.getByText('Open the report at page 4').first().click(); await p.waitForTimeout(700);
  await p.fill('.ask input', 'When is the Linden closing?'); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200);
  await p.goto(BASE + 'apps.html'); await p.waitForTimeout(300); await p.locator('#connect-app').click(); await p.waitForTimeout(300);
  await p.locator('#drawer-close').click(); await p.locator('[data-manage]').first().click(); await p.waitForTimeout(300);
  await p.goto(BASE + 'onboarding.html'); await p.locator('[data-go="3"]').click(); await p.waitForTimeout(300);
  await p.goto(BASE + 'main.html'); await p.getByText('See the comparison').first().click(); await p.waitForTimeout(500);
  await p.goto(BASE); await p.fill('.ask input', "Sarah's pausing until February"); await p.press('.ask input', 'Enter'); await p.waitForTimeout(200); await p.locator('[data-plan-edit]').click(); await p.locator('[data-plan-apply]').click(); await p.waitForTimeout(200);
  await p.locator('[data-delegate]').first().click(); await p.fill('#dg-goal', 'Re-engage leads that went quiet'); await p.locator('#dg-goal-form button[type=submit]').click(); await p.waitForTimeout(200);
  await p.goto(BASE + 'handled.html#p-maya'); await p.waitForTimeout(200); await p.locator('#hp-told a').first().click(); await p.waitForTimeout(400);
  await p.goto(BASE + 'handled.html#p-sarah'); await p.waitForTimeout(200); await p.locator('#drawer [data-takeover="p-sarah"]').click(); await p.waitForTimeout(200); await p.goto(BASE + 'tasks.html'); await p.waitForTimeout(200);
  await p.goto(BASE + 'handled.html'); await p.locator('main [data-pbpanel]').first().click(); await p.locator('#drawer [data-scope]').first().click(); await p.waitForTimeout(200);
  await p.goto(BASE + 'handled.html'); await p.locator('main [data-client]').first().click(); await p.waitForTimeout(150); await p.locator('#hd-how summary').click(); await p.waitForTimeout(100);
  await p.goto(BASE + 'rules.html'); await p.selectOption('[data-notify="booked"]', 'now'); await p.waitForTimeout(200);
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await pctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const pp = await pctx.newPage(); await pp.goto(BASE + 'handled.html#p-sarah'); await pp.waitForTimeout(200); await pp.locator('#drawer-close').click(); await pp.locator('[data-tabmore]').click(); await pp.waitForTimeout(200); const pv = await pp.evaluate(() => window.__csp); ok('csp: phone More sheet no violations', pv.length === 0, pv.join(', ')); await pctx.close();
  const v = await viol(); ok('csp: dynamic views no violations', v.length === 0, v.join(', '));
  // app logos load from 'self'
  await p.goto(BASE + 'apps.html'); await p.waitForTimeout(400);
  const logos = await p.$$eval('.ida-app__logo img', im => im.map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, alt: i.alt })));
  ok('apps: every logo image loads from self with alt text', logos.length >= 6 && logos.every(l => l.ok && /^img\/apps\//.test(l.src) && / logo$/.test(l.alt)), JSON.stringify(logos));
  ok('csp: no errors in console', errs.length === 0, errs.join('\n'));
  await ctx.close();
}

async function headerSuite(browser) {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  for (const u of ['people', 'people.html']) {
    const r = await p.request.get(BASE + u, { maxRedirects: 0 });
    ok('/' + u + ' redirects to Being handled (vercel.json redirect)', [301, 307, 308].includes(r.status()) && r.headers()['location'] === '/handled' && !!r.headers()['content-security-policy'], r.status() + ' ' + r.headers()['location']);
  }
  for (const u of ['', 'apps.html', 'doc.html?d=kim-email', 'ida-store.js', 'ida.css', 'img/apps/gmail.png', 'docs/kim-email.pdf']) {
    const r = await p.request.get(BASE + u); const h = r.headers();
    const need = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security', 'x-frame-options'];
    const miss = need.filter(k => !h[k]);
    ok('headers on /' + u, r.status() === 200 && miss.length === 0 && h['x-content-type-options'] === 'nosniff' && /frame-ancestors 'self'/.test(h['content-security-policy']) && /camera=\(\)/.test(h['permissions-policy']), r.status() + ' missing ' + miss.join(','));
    if (!/^docs\//.test(u)) ok('csp on /' + u + ' has no unsafe-inline/eval in script-src', /script-src 'self'(;|$)/.test(h['content-security-policy']) && !/unsafe-eval/.test(h['content-security-policy']));
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await headerSuite(browser);
  await xssSuite(browser, 'no-CSP', true);
  await xssSuite(browser, 'CSP', false);
  await cspSuite(browser);
  await browser.close();
  console.log(results.filter(r => r.startsWith('FAIL')).join('\n'));
  console.log('security: ' + (results.length - fails) + ' passed, ' + fails + ' failed of ' + results.length);
  process.exit(fails ? 1 : 0);
})();
