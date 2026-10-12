/* Shared shell behavior: nav count, Reset demo, the ask field, side panel,
   toast with undo, add-task form, small menus. Depends on ida-store.js. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, esc = Ida.util.esc;
  var ui = Ida.ui = {};

  /* ---------- Nav count ---------- */
  function navCount() {
    var n = Q.needsYou();
    document.querySelectorAll('.side nav a').forEach(function (a) {
      if (!/^\s*Today/.test(a.textContent)) return;
      var c = a.querySelector('.count');
      if (!c) { c = document.createElement('span'); c.className = 'count'; a.appendChild(c); }
      c.textContent = n; c.hidden = n === 0;
      a.setAttribute('aria-label', n ? 'Today, ' + n + ' need you' : 'Today');
    });
  }

  /* ---------- Reset demo ---------- */
  function resetControl() {
    var ex = document.querySelector('.example'); if (!ex || ex.querySelector('.ida-resetdemo')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ida-resetdemo'; b.textContent = 'Reset demo';
    b.title = 'Put the sample data back the way it started';
    ex.appendChild(document.createTextNode(' · ')); ex.appendChild(b);
    b.addEventListener('click', function () { S.reset(); location.reload(); });
  }

  /* ---------- Side panel ---------- */
  var drawer;
  function ensureDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement('aside');
    drawer.className = 'ida-drawer'; drawer.id = 'drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', 'Side panel');
    drawer.innerHTML = '<div class="ida-drawer__head"><span class="ida-source__icon" aria-hidden="true"></span><span><b></b><small></small></span><button class="ida-btn ida-btn--quiet" type="button" id="drawer-close">Close</button></div><div class="ida-drawer__main" style="min-height:0;display:grid"></div><div class="ida-drawer__foot"></div>';
    document.body.appendChild(drawer);
    drawer.querySelector('#drawer-close').addEventListener('click', ui.closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) ui.closeDrawer(); });
    return drawer;
  }
  ui.openDrawer = function (o) {
    var d = ensureDrawer();
    var ic = d.querySelector('.ida-source__icon'); ic.textContent = o.icon || ''; ic.hidden = !o.icon; ic.classList.toggle('ida-source__icon--img', !!o.iconImg);
    if (o.iconImg) { var im = document.createElement('img'); im.src = o.iconImg; im.alt = ''; im.width = 22; im.height = 22; ic.textContent = ''; ic.appendChild(im); }
    d.querySelector('.ida-drawer__head b').textContent = o.title || '';
    d.querySelector('.ida-drawer__head small').textContent = o.sub || '';
    d.setAttribute('aria-label', o.title || 'Side panel');
    var main = d.querySelector('.ida-drawer__main');
    if (o.src) main.innerHTML = '<iframe title="' + esc(o.title) + '" src="' + esc(o.src) + '"></iframe>';
    else main.innerHTML = '<div class="ida-drawer__body">' + (o.html || '') + '</div>';
    var foot = d.querySelector('.ida-drawer__foot'); foot.innerHTML = o.foot || ''; foot.hidden = !o.foot;
    d.hidden = false; document.body.classList.add('has-drawer');
    var f = main.querySelector('[autofocus]') || d.querySelector('#drawer-close'); try { f.focus(); } catch (e) {}
    if (o.onOpen) o.onOpen(main);
    return main;
  };
  ui.closeDrawer = function () { if (!drawer) return; drawer.hidden = true; document.body.classList.remove('has-drawer'); drawer.querySelector('.ida-drawer__main').innerHTML = ''; };
  ui.drawerOpen = function () { return drawer && !drawer.hidden; };
  ui.openDoc = function (id, extra) {
    var d = Ida.doc(id); if (!d) return;
    var page = d.page ? 'page ' + d.page + (d.pages ? ' of ' + d.pages : '') : '';
    var full = d.href || ('doc.html?d=' + encodeURIComponent(id));
    var pdf = 'docs/' + encodeURIComponent(id) + '.pdf#page=' + (d.page || 1);
    ui.openDrawer({ icon: d.icon, title: d.title, sub: [d.who, page].filter(Boolean).join(' · '),
      src: d.embed || ('doc.html?d=' + encodeURIComponent(id) + '&embed=1#cite'),
      foot: '<span>' + esc(extra || 'Check the highlight against what Ida wrote.') + '</span><span class="ida-drawer__links"><a href="' + esc(pdf) + '" target="_blank" rel="noopener">Open PDF</a><a href="' + esc(full) + '" target="_blank" rel="noopener">Open full screen</a></span>' });
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-doc]'); if (!t) return;
    e.preventDefault(); ui.openDoc(t.getAttribute('data-doc'), t.getAttribute('data-doc-note'));
  });

  /* ---------- Toasts: notes, Undo, and queued sends ----------
     Undo and "Sending in N s" come from the store (pending undo entry and the outbox), so they
     show on whichever page you're on until they expire. Plain notes are local to the page. */
  var stackEl, noteEl, noteTimer, afters = {}, embedded = window.top !== window;
  function stack() {
    if (stackEl && stackEl.isConnected) return stackEl;
    stackEl = document.createElement('div'); stackEl.className = 'ida-toasts'; stackEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(stackEl);
    stackEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-toast-close')) return ui.closeToast();
      var ob = b.getAttribute('data-ob'), u = b.getAttribute('data-undo-id');
      if (ob) { if (A.cancelSend(ob)) ui.toast('<b>Cancelled.</b> Nothing was sent.'); return; }
      if (u) { var after = afters[u]; delete afters[u]; if (S.undo.run(u) && after) after(); }
    });
    return stackEl;
  }
  function secsLeft(t) { return Math.max(0, Math.ceil((t - Date.now()) / 1000)); }
  function bar(el, total, left) {
    var br = el.querySelector('.ida-toast__bar'); if (!br) return;
    br.style.transform = 'scaleX(' + Math.max(0, Math.min(1, left / total)) + ')';
    requestAnimationFrame(function () { requestAnimationFrame(function () { br.style.transition = 'transform ' + (left / 1000) + 's linear'; br.style.transform = 'scaleX(0)'; }); });
  }
  function syncToasts() {
    if (embedded || !document.body) return;
    var want = {}, order = [];
    (S.get().outbox || []).forEach(function (o) { want['ob-' + o.id] = { ob: o }; order.push('ob-' + o.id); });
    var u = S.undo.get(); if (u) { want['u-' + u.id] = { u: u }; order.push('u-' + u.id); }
    var st = stack();
    [].slice.call(st.querySelectorAll('[data-tkey]')).forEach(function (el) { if (!want[el.getAttribute('data-tkey')]) el.remove(); });
    order.forEach(function (k) {
      var w = want[k], el = st.querySelector('[data-tkey="' + k + '"]');
      if (!el) {
        el = document.createElement('div'); el.className = 'ida-toast'; el.setAttribute('data-tkey', k); el.setAttribute('role', 'status');
        if (w.ob) el.innerHTML = '<div class="ida-toast__row"><span><b>Sending in <span data-left>' + secsLeft(w.ob.due) + '</span> s</b> · ' + esc(w.ob.subj) + (w.ob.to ? ' to ' + esc(w.ob.to) : '') + '</span><button type="button" data-toast-undo data-ob="' + esc(w.ob.id) + '">Undo</button></div><div class="ida-toast__bar"></div>';
        else el.innerHTML = '<div class="ida-toast__row"><span>' + Ida.util.safeHtml(w.u.msg) + '</span><button type="button" data-toast-undo data-undo-id="' + esc(w.u.id) + '">Undo · <span data-left>' + secsLeft(w.u.exp) + '</span></button></div><div class="ida-toast__bar"></div>';
        st.appendChild(el); bar(el, w.ob ? Ida.SEND_DELAY : 10000, (w.ob ? w.ob.due : w.u.exp) - Date.now());
      } else { var l = el.querySelector('[data-left]'); if (l) l.textContent = secsLeft(w.ob ? w.ob.due : w.u.exp); }
    });
    if (noteEl && noteEl.isConnected) st.appendChild(noteEl);
  }
  ui.closeToast = function () { if (noteEl) { noteEl.remove(); noteEl = null; } clearTimeout(noteTimer); };
  /* A plain note. With onUndo, it becomes a stored Undo (see withUndo). */
  ui.toast = function (html, onUndo) {
    if (onUndo) return ui.withUndo(html, function () {}, onUndo);
    ui.closeToast(); if (embedded) return;
    noteEl = document.createElement('div'); noteEl.className = 'ida-toast'; noteEl.setAttribute('role', 'status');
    noteEl.innerHTML = '<div class="ida-toast__row"><span>' + html + '</span><button type="button" data-toast-close>Close</button></div>';
    stack().appendChild(noteEl);
    noteTimer = setTimeout(ui.closeToast, 6000);
  };
  /* Run an action with a 10-second Undo that restores the store exactly. The Undo is kept in the
     store, so it follows you to other pages until it expires or something else changes. */
  ui.withUndo = function (html, fn, after) {
    var snap = S.snapshot(), id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    fn();
    if (after) afters[id] = after;
    ui.closeToast();
    S.undo.set({ id: id, msg: html, exp: Date.now() + 10000, snap: snap });
  };
  /* Every second while anything is queued or undoable: count down, and send what's due. */
  function tick() {
    var s = S.get();
    if ((s.outbox || []).length) A.flush();
    document.querySelectorAll('[data-due]').forEach(function (el) { el.textContent = secsLeft(+el.getAttribute('data-due')); });
    syncToasts();
  }
  setInterval(tick, 1000);
  S.subscribe(function () { syncToasts(); });

  /* ---------- Simulated connection ---------- */
  ui.busy = function (btn, label, ms, done) {
    if (!btn || btn.getAttribute('aria-busy') === 'true') return;
    var old = btn.innerHTML; btn.setAttribute('aria-busy', 'true'); btn.disabled = true; btn.textContent = label;
    setTimeout(function () { if (btn.isConnected) { btn.removeAttribute('aria-busy'); btn.disabled = false; btn.innerHTML = old; } done(); }, ms || 700);
  };

  /* ---------- Small menu ---------- */
  var openMenu;
  ui.menu = function (btn, items) {
    if (openMenu) { var same = openMenu.btn === btn; ui.closeMenu(); if (same) return; }
    var wrap = btn.parentNode; wrap.classList.add('ida-menuwrap');
    var m = document.createElement('div'); m.className = 'ida-menu'; m.setAttribute('role', 'menu');
    items.forEach(function (it) {
      if (it.note) { var s = document.createElement('small'); s.textContent = it.note; m.appendChild(s); return; }
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = it.label;
      b.addEventListener('click', function (e) { e.stopPropagation(); ui.closeMenu(); it.run(); });
      m.appendChild(b);
    });
    wrap.appendChild(m); btn.setAttribute('aria-expanded', 'true');
    openMenu = { el: m, btn: btn };
    var first = m.querySelector('button'); if (first) first.focus();
  };
  ui.closeMenu = function () { if (!openMenu) return; openMenu.el.remove(); openMenu.btn.setAttribute('aria-expanded', 'false'); openMenu = null; };
  document.addEventListener('click', function (e) { if (openMenu && !openMenu.el.contains(e.target) && e.target !== openMenu.btn) ui.closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openMenu) { var b = openMenu.btn; ui.closeMenu(); b.focus(); } });

  /* ---------- Highlight a target from the URL hash ---------- */
  ui.highlight = function (el) {
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('is-hl');
    setTimeout(function () { el.classList.remove('is-hl'); }, 2600);
  };
  ui.highlightHash = function () {
    if (!location.hash || location.hash.length < 2) return;
    var el; try { el = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
    if (el) setTimeout(function () { ui.highlight(el); }, 60);
  };

  /* ---------- Add a task (Tasks and Workflows share it) ---------- */
  ui.addTaskForm = function (o) {
    o = o || {};
    var areas = ['Leads', 'Deals', 'Listings', 'Admin'];
    var html = '<form class="ida-form" id="addtask" novalidate>' +
      '<p class="ida-form__hint">Name the work the way you would say it to an assistant. Ida starts anything you hand over in practice: it drafts privately and sends nothing.</p>' +
      '<label class="ida-field">What is it?<input type="text" id="at-name" autofocus placeholder="For example: send the Parks a closing-day checklist" value="' + esc(o.name || '') + '"></label>' +
      '<label class="ida-field">Area<select id="at-area">' + areas.map(function (a) { return '<option' + (a === (o.area || 'Deals') ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></label>' +
      '<fieldset class="ida-choice"><legend>Who does it?</legend>' +
      '<label><input type="radio" name="at-who" value="you"' + (o.who === 'ida' ? '' : ' checked') + '>You, for now</label>' +
      '<label><input type="radio" name="at-who" value="ida"' + (o.who === 'ida' ? ' checked' : '') + '>Ida, starting in practice</label></fieldset>' +
      '<p class="ida-form__err" id="at-err" hidden>Give the task a name first.</p>' +
      '<div class="ida-row-acts"><button class="ida-btn ida-btn--primary" type="submit">Add task</button><button class="ida-btn ida-btn--quiet" type="button" data-cancel>Cancel</button></div></form>';
    var main = ui.openDrawer({ title: o.title || 'Add a task', sub: 'It shows up on Tasks and in Your work on Today', html: html });
    var f = main.querySelector('#addtask');
    f.querySelector('#at-name').focus();
    f.querySelector('[data-cancel]').addEventListener('click', ui.closeDrawer);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.querySelector('#at-name').value.trim();
      if (!name) { f.querySelector('#at-err').hidden = false; f.querySelector('#at-name').focus(); return; }
      var who = f.querySelector('input[name="at-who"]:checked').value;
      var id = A.addTask({ name: name, area: f.querySelector('#at-area').value, who: who });
      var t = Q.task(id);
      main.querySelector('.ida-drawer__body').innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Added to Tasks.</b> ' + (who === 'ida' ? 'Ida is practicing it as a new workflow, ' + esc(Q.wf(t.wf).name) + '. Nothing is sent while it practices.' : 'It\'s in Still yours. You can hand it to Ida from there.') + '</span></div>' +
        '<div class="ida-row-acts">' + (who === 'ida' ? '<a class="ida-btn" href="workflows.html#' + esc(t.wf) + '">See the workflow</a>' : '') + '<a class="ida-btn ida-btn--quiet" href="tasks.html#' + esc(id) + '">See it on Tasks</a><button class="ida-btn ida-btn--quiet" type="button" data-more>Add another</button></div>';
      main.querySelector('[data-more]').addEventListener('click', function () { ui.addTaskForm(o); });
      if (o.onAdd) o.onAdd(id);
    });
  };

  /* ---------- Ask field ---------- */
  function cite(docId, text) { return '<span class="ida-marker">' + text + '</span>'; }
  function srcBtn(docId, label) { return '<button class="ida-srcbtn" type="button" data-doc="' + docId + '">' + label + '</button>'; }
  function answer(text) {
    var t = text.toLowerCase(), s = S.get(), dealKey = Q.findDeal(text);
    var isQ = /\?$/.test(text.trim()) || /^(what|when|who|where|is|are|does|do|did|has|have|how|which|any|can you tell|tell me)\b/i.test(text.trim());
    if (/option period|option ends/.test(t)) return '<p>The option period on 17 Ash St ends ' + cite('ash-agreement', 'Wednesday, October 14 at 5:00 pm') + '. The repair request is drafted, and Ida reminded Maya and Sam this morning.</p>' + srcBtn('ash-agreement', 'From the 17 Ash St purchase agreement, page 3');
    if (/clos(e|ing|es)\b/.test(t) && isQ) {
      if (dealKey && dealKey !== 'linden') return '<p>Ida doesn\'t have a closing date for ' + esc(Q.deal(dealKey).name) + ' yet. The only closing on your calendar this week is 412 Linden Ct, Thursday at 2:00 pm.</p>';
      return '<p>412 Linden Ct closes Thursday at 2:00 pm at Lone Oak Title, 88 Main St. The contract says ' + cite('linden-agreement', 'closing on or before October 15, 2026') + '.</p>' + srcBtn('linden-agreement', 'From the 412 Linden Ct purchase agreement, page 2');
    }
    if (/apprais/.test(t)) {
      var lin = '<p>412 Linden Ct: the appraisal is ' + cite('kim-email', 'Tuesday at 10 am') + ', confirmed by Kim Alvarez at Northgate Mortgage.</p>' + srcBtn('kim-email', 'From Kim\'s email this morning');
      var ash = '<p>17 Ash St: it came in at ' + cite('ash-appraisal', '$612,000, $13,000 under the contract price') + '. Ida drafted options for the Garcias in practice. <a href="practice.html?wf=appraisal">Compare the drafts</a></p>' + srcBtn('ash-appraisal', 'From the appraisal report, page 2');
      if (dealKey === 'linden') return lin; if (dealKey === 'ash') return ash; return lin + ash;
    }
    if (/hoa|payoff/.test(t)) {
      var d = Q.decision('d-hoa');
      if (d.status === 'done') return '<p>Ida asked the Linden Court HOA for the payoff letter at ' + esc(d.doneAt) + ', copying Lone Oak Title. If it isn\'t in by Wednesday at 9 am, Ida follows up.</p>';
      return '<p>The payoff letter for 412 Linden Ct is still missing. Lone Oak Title lists it as ' + cite('linden-title', 'not yet received') + '. Ida has a request to the HOA ready for you on Today.</p>' + srcBtn('linden-title', 'From the title commitment, Schedule C') + '<p><a href="./">Open it on Today</a></p>';
    }
    if (/\bwho\b|people|contacts?\b|on the deal|lender|title company|agent on/.test(t)) {
      var keys = dealKey ? [dealKey] : ['linden', 'ash', 'hollis', 'mercer'];
      return keys.map(function (k) { var dd = Q.deal(k); return '<p><b>' + esc(dd.name) + '</b> · ' + esc(dd.side) + '</p><ul>' + dd.people.map(function (p) { return '<li>' + esc(p[0]) + ', ' + esc(p[1]) + '</li>'; }).join('') + '</ul>'; }).join('');
    }
    if (/waiting|need(s)? (me|you)|on me|my plate|to ?do|what'?s left|anything for me|what do i/.test(t)) {
      var probs = Q.problems(), open = Q.openDecisions(), later = s.decisions.filter(function (x) { return x.status === 'later'; });
      if (!probs.length && !open.length) return '<p>Nothing needs you right now.' + (later.length ? ' ' + later.length + ' decision' + (later.length > 1 ? 's are' : ' is') + ' moved to tomorrow morning.' : '') + '</p>';
      return '<p>' + (probs.length + open.length) + ' waiting on you:</p><ul>' + probs.map(function (a) { return '<li>Problem: ' + esc(a.name) + ' is disconnected</li>'; }).join('') + open.map(function (x) { return '<li>' + esc(x.q) + '</li>'; }).join('') + '</ul><p><a href="./">Open Today</a></p>';
    }
    if (/inspection/.test(t)) { var di = Q.decision('d-inspect'); return di.status === 'done' ? '<p>The inspection summary for 412 Linden Ct went to Jen and Tom Park at ' + esc(di.doneAt) + '.</p>' : '<p>The inspection summary for the Parks is drafted and waiting for your approval on Today. The one repair item is the ' + cite('linden-inspection', 'rear deck guardrail, loose at two posts') + '.</p>' + srcBtn('linden-inspection', 'From the inspection report, page 4'); }
    if (/\bsent\b|messages|emails? (did|has)/.test(t)) return '<p>Ida sent ' + Q.sentCount() + ' messages since Saturday. <a href="sent.html">See what Ida sent</a></p>';
    if (dealKey && isQ) { var dk = Q.deal(dealKey); return '<p><b>' + esc(dk.name) + '</b> · ' + esc(dk.side) + '. ' + esc(dk.status) + '.</p>'; }
    return null;
  }
  var HELP = '<p>Ida can answer questions about your deals, take a rule or a task, and take a change in plain words, showing every item it would update before anything changes. Try one of these:</p><div class="ida-chips">' +
    ['When is the Linden closing?', 'What\'s waiting on me?', 'Sarah\'s pausing until February', 'Don\'t book anyone Thursday', 'Never text clients after 8 pm', 'Follow up with Kim about the appraisal'].map(function (x) { return '<button class="ida-chipbtn" type="button" data-try="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>';

  /* ---------- Change plan ("Tell Ida a change") ----------
     The plan lists every item the instruction touches before anything changes. Today the plan
     comes from keyword matching in Ida.parse.change; a model will later interpret the instruction
     through this same step. What gets applied is always the plan the owner saw (and edited), never
     the model's free text. */
  var LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
  function planHtml(plan, editing) {
    var live = plan.steps.filter(function (st) { return !st.info && !st.off; }).length;
    var steps = plan.steps.map(function (st) {
      var txt = esc(Ida.parse.stepText(st));
      if (st.info) return '<li class="ida-plan__info"><span>' + txt + '</span></li>';
      if (!editing) return '<li' + (st.off ? ' class="is-off"' : '') + '><span>' + txt + (st.off ? ' <small>(skipped)</small>' : '') + '</span></li>';
      return '<li class="ida-plan__edit"><label class="ida-plan__chk"><input type="checkbox" data-step="' + esc(st.id) + '"' + (st.off ? '' : ' checked') + '><span>' + txt + '</span></label>' +
        (st.edit ? '<label class="ida-field">' + esc(st.edit.label) + (st.op === 'say' || st.op === 'note' ? '<textarea data-stepval="' + esc(st.id) + '" rows="2">' + esc(st.edit.value) + '</textarea>' : '<input type="text" data-stepval="' + esc(st.id) + '" value="' + esc(st.edit.value) + '">') + '</label>' : '') + '</li>';
    }).join('');
    var who = plan.alts && plan.alts.length > 1 ? '<label class="ida-field ida-plan__who">Who do you mean?<select data-plan-who>' + plan.alts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === plan.person ? ' selected' : '') + '>' + esc(a.name + ' · ' + a.role) + '</option>'; }).join('') + '</select></label>' : '';
    return '<div class="ida-plan" data-plan><div class="ida-plan__head"><small>Change plan · nothing changes until you apply it</small><b>' + esc(plan.title) + '</b></div>' + who +
      '<ol class="ida-plan__steps">' + steps + '</ol>' +
      '<div class="ida-row-acts"><button class="ida-btn" type="button" data-plan-apply' + (live ? '' : ' disabled') + '>Apply ' + live + (live === 1 ? ' change' : ' changes') + '</button><button class="ida-btn ida-btn--quiet" type="button" data-plan-edit>' + (editing ? 'Done editing' : 'Edit') + '</button><button class="ida-btn ida-btn--quiet" type="button" data-plan-cancel>Cancel</button></div></div>';
  }
  function readPlan(p, plan) {
    p.querySelectorAll('[data-step]').forEach(function (c) { var st = plan.steps.filter(function (x) { return x.id === c.getAttribute('data-step'); })[0]; if (st) st.off = !c.checked; });
    p.querySelectorAll('[data-stepval]').forEach(function (c) { var st = plan.steps.filter(function (x) { return x.id === c.getAttribute('data-stepval'); })[0]; if (st && st.edit) st.edit.value = c.value.slice(0, 500); });
  }
  function showPlan(p, text, plan, editing) {
    p.innerHTML = '<div class="ida-reply__q"><span>You: ' + esc(text) + '</span><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>' + planHtml(plan, editing);
    p.hidden = false;
    p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; });
    p.querySelector('[data-plan-cancel]').addEventListener('click', function () { p.innerHTML = '<div class="ida-notice" role="status"><span>Cancelled. Nothing changed.</span><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>'; p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; }); });
    p.querySelector('[data-plan-edit]').addEventListener('click', function () { if (editing) readPlan(p, plan); showPlan(p, text, plan, !editing); var f = p.querySelector('[data-step]'); if (f) f.focus(); });
    var sel = p.querySelector('[data-plan-who]');
    if (sel) sel.addEventListener('change', function () { var n = Ida.parse.rebuildPlan(plan, sel.value); if (n) showPlan(p, text, n, editing); });
    p.querySelectorAll('[data-step]').forEach(function (c) { c.addEventListener('change', function () { readPlan(p, plan); var live = plan.steps.filter(function (x) { return !x.info && !x.off; }).length; var b = p.querySelector('[data-plan-apply]'); b.textContent = 'Apply ' + live + (live === 1 ? ' change' : ' changes'); b.disabled = !live; }); });
    p.querySelector('[data-plan-apply]').addEventListener('click', function () {
      if (editing) readPlan(p, plan);
      var n = plan.steps.filter(function (x) { return !x.info && !x.off; }).length, id = A.applyChange(plan), per = plan.person && Q.person(plan.person);
      p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Applied: ' + esc(plan.title) + '.</b> ' + n + (n === 1 ? ' item' : ' items') + ' updated across Today, Being handled and Sent.</span>' +
        (per ? '<a href="handled.html#' + esc(per.id) + '">' + esc(per.name) + ' on Being handled</a>' : '') + '<a href="handled.html#changes">See it in Changes</a><button class="ida-btn" type="button" data-change-undo="' + esc(id) + '">Undo</button><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>';
      p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; });
      p.querySelector('[data-change-undo]').addEventListener('click', function () { A.undoChange(id); p.innerHTML = '<div class="ida-notice" role="status"><span><b>Undone.</b> Everything is back the way it was before "' + esc(plan.title) + '".</span><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>'; p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; }); });
    });
  }
  ui.undoChange = function (id) { var c = S.get().changes.filter(function (x) { return x.id === id; })[0]; if (!c) return; A.undoChange(id); ui.toast('<b>Undone.</b> ' + esc(c.title) + '.'); };

  /* ---------- Hand Ida a responsibility ---------- */
  var TRY = ['Re-engage leads that went quiet', 'Send a closing-day checklist for all my buyer deals', 'Send a thank-you note after each showing for new seller listings'];
  ui.delegate = function (text) {
    var html = '<form class="ida-form" id="dg-goal-form" novalidate><p class="ida-form__hint">Describe the outcome, not the messages. Ida adds it to the playbook for a type of client (buyer deals, seller listings or leads), so it covers every client of that type, including new ones. You can limit it to specific clients. Nothing starts until you approve.</p>' +
      '<label class="ida-field">What should Ida take care of?<textarea id="dg-goal" rows="3" autofocus placeholder="For example: send a closing-day checklist for all my buyer deals">' + esc(text || '') + '</textarea></label>' +
      '<div class="ida-chips">' + TRY.map(function (x) { return '<button class="ida-chipbtn" type="button" data-dg-try="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<p class="ida-form__err" id="dg-err" hidden>Say what Ida should take care of first.</p>' +
      '<div class="ida-row-acts"><button class="ida-btn ida-btn--primary" type="submit">Propose a plan</button><button class="ida-btn ida-btn--quiet" type="button" data-cancel>Cancel</button></div></form>';
    var main = ui.openDrawer({ title: 'Hand Ida a responsibility', sub: 'By client type; you approve the scope once', html: html });
    var f = main.querySelector('#dg-goal-form'), ta = f.querySelector('#dg-goal'); ta.focus();
    f.querySelector('[data-cancel]').addEventListener('click', ui.closeDrawer);
    f.querySelectorAll('[data-dg-try]').forEach(function (b) { b.addEventListener('click', function () { ta.value = b.getAttribute('data-dg-try'); ta.focus(); }); });
    f.addEventListener('submit', function (e) { e.preventDefault(); var v = ta.value.trim(); if (!v) { f.querySelector('#dg-err').hidden = false; ta.focus(); return; } propose(main, v); });
    if (text && text.trim()) propose(main, text.trim());
  };
  function scopeFields(pr, cadences) {
    return '<label class="ida-field">Responsibility<input type="text" id="dg-title" value="' + esc(pr.title) + '"></label>' +
      '<label class="ida-field">Who Ida contacts' + (pr.count ? ' <span class="ida-dg__n">' + esc(pr.count) + '</span>' : '') + '<textarea id="dg-who" rows="2">' + esc(pr.who) + '</textarea></label>' +
      '<label class="ida-field">What Ida says and asks<textarea id="dg-say" rows="3">' + esc(pr.say) + '</textarea></label>' +
      '<label class="ida-field">How often Ida follows up<select id="dg-cadence">' + cadences.map(function (c) { return '<option' + (c === pr.cadence ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ida-field">Ida stops for<input type="text" id="dg-stop" value="' + esc(pr.stop) + '"></label>' +
      '<label class="ida-field">What Ida brings to you<textarea id="dg-toyou" rows="2">' + esc(pr.toYou) + '</textarea></label>' +
      '<div class="ida-field">Texting<span class="ida-dg__lock">' + LOCK + '<span>' + esc(pr.channel || 'Texts only people who opted in; everyone else gets email. A reply of STOP ends texting at once.') + '</span></span></div>';
  }
  function cadenceList(c) { var L = ['Day 1, day 3 and day 7, then stops', 'Every 2 days, up to 3 times', 'One message, one follow-up a week later, then stops', 'Once a week, up to 4 times', 'Daily check at 7 am until closing']; if (c && L.indexOf(c) < 0) L.unshift(c); return L; }
  function readScope(root) { var g = function (id) { var el = root.querySelector('#' + id); return el ? el.value.trim().slice(0, 600) : ''; }; return { title: g('dg-title'), who: g('dg-who'), say: g('dg-say'), cadence: g('dg-cadence'), stop: g('dg-stop'), toYou: g('dg-toyou') }; }
  function propose(main, text) {
    var body = main.querySelector('.ida-drawer__body'), pr = Ida.parse.proposal(text, true);
    if (pr.existing) {
      var pb = Q.playbook(pr.existing), du = Q.duty(pb, pr.duty);
      body.innerHTML = '<div class="ida-notice" role="status"><span><b>Already covered by the ' + esc(pb.name) + ' playbook.</b> ' + esc(pr.why) + (du ? ' Duty: ' + esc(du.name) + '.' : '') + '</span><a href="handled.html#' + esc(pb.id) + '">See it on Being handled</a></div>' +
        '<div class="ida-row-acts"><button class="ida-btn" type="button" data-scope="' + esc(pb.id) + '">Change the playbook scope</button><button class="ida-btn ida-btn--quiet" type="button" data-again>Describe something else</button></div>';
      body.querySelector('[data-scope]').addEventListener('click', function () { ui.scopeForm(pb.id); });
      body.querySelector('[data-again]').addEventListener('click', function () { ui.delegate(''); });
      return;
    }
    var only = pr.suggestOnly || [];
    body.innerHTML = '<form class="ida-form" id="dg-scope" novalidate><div class="ida-understood"><small>Ida\'s proposal · goes in your ' + esc(pr.pbName) + ' playbook · edit anything, then approve once</small><b>' + esc(pr.title) + '</b><small>Starts ' + esc(pr.next.when) + ': ' + esc(pr.next.text) + '</small></div>' +
      '<label class="ida-field">Responsibility<input type="text" id="dg-title" value="' + esc(pr.title) + '"></label>' +
      '<fieldset class="ida-dg__to"><legend>Who it applies to</legend>' +
        '<label class="ida-dg__opt"><input type="radio" name="dg-to" value="all" checked><span><b>All my ' + esc(pr.many) + '</b> (' + pr.clients.length + ' now)<small>' + esc(pr.auto) + '</small></span></label>' +
        '<label class="ida-dg__opt"><input type="radio" name="dg-to" value="only"><span><b>Only some ' + esc(pr.many) + '</b><small>New ' + esc(pr.many) + ' won\'t get it unless you add them</small></span></label>' +
        '<div class="ida-dg__pick" id="dg-pick" hidden>' + pr.clients.map(function (c) { return '<label><input type="checkbox" value="' + esc(c.id) + '"' + (only.indexOf(c.id) >= 0 ? ' checked' : '') + '>' + esc(c.name) + '</label>'; }).join('') + '</div></fieldset>' +
      '<label class="ida-field">What Ida says and asks<textarea id="dg-say" rows="3">' + esc(pr.say) + '</textarea></label>' +
      '<label class="ida-field">How often Ida follows up<select id="dg-cadence">' + cadenceList(pr.cadence).map(function (c) { return '<option' + (c === pr.cadence ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ida-field">Ida stops for<input type="text" id="dg-stop" value="' + esc(pr.stop) + '"></label>' +
      '<label class="ida-field">What Ida brings to you<textarea id="dg-toyou" rows="2">' + esc(pr.toYou) + '</textarea></label>' +
      '<div class="ida-field">Texting<span class="ida-dg__lock">' + LOCK + '<span>' + esc(pr.channel) + '</span></span></div>' +
      '<p class="ida-form__hint">After you approve, Ida handles the routine follow-through for each client it covers, logs every message in Sent, and writes its messages and notes back to Follow Up Boss.</p>' +
      '<div class="ida-row-acts"><button class="ida-btn ida-btn--primary" type="submit">Approve and start</button><button class="ida-btn ida-btn--quiet" type="button" data-back>Back</button></div></form>';
    var f = body.querySelector('#dg-scope'), pick = f.querySelector('#dg-pick'); f.querySelector('#dg-title').focus();
    f.querySelectorAll('input[name="dg-to"]').forEach(function (x) { x.addEventListener('change', function () { pick.hidden = f.querySelector('input[name="dg-to"]:checked').value !== 'only'; }); });
    f.querySelector('[data-back]').addEventListener('click', function () { ui.delegate(text); body.querySelector('#dg-goal').value = text; });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var v = readScope(f), lim = f.querySelector('input[name="dg-to"]:checked').value === 'only';
      var ids = lim ? [].map.call(pick.querySelectorAll('input:checked'), function (x) { return x.value; }).filter(function (x) { return pr.clients.some(function (c) { return c.id === x; }); }) : [];
      if (lim && !ids.length) { pick.hidden = false; return; }
      A.addDuty(Object.assign({}, pr, { title: v.title || pr.title, say: v.say || pr.say, cadence: v.cadence || pr.cadence, stop: v.stop || pr.stop, toYou: v.toYou || pr.toYou, only: ids }));
      body.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Added to your ' + esc(pr.pbName) + ' playbook.</b> ' + esc(v.title || pr.title) + '. ' + (lim ? 'Runs for ' + ids.length + ' of your ' + esc(pr.many) + '.' : esc(pr.auto) + '.') + ' First: ' + esc(pr.next.text) + ', ' + esc(pr.next.when) + '.</span></div>' +
        '<div class="ida-row-acts"><a class="ida-btn" href="handled.html#' + esc(pr.pb) + '">See it on Being handled</a><button class="ida-btn ida-btn--quiet" type="button" data-close-dg>Close</button></div>';
      body.querySelector('[data-close-dg]').addEventListener('click', ui.closeDrawer);
    });
  }
  ui.scopeForm = function (pbId) {
    var pb = Q.playbook(pbId); if (!pb) return;
    var lv = ['practice', 'approve', 'own'];
    var html = '<form class="ida-form" id="dg-scope" novalidate><p class="ida-form__hint">One scope and trust level for every ' + esc(pb.one) + ', including new ones. Add an exception for a single client on Being handled.</p>' +
      '<label class="ida-field">Trust level for ' + esc(pb.many) + '<select id="dg-level">' + lv.map(function (l) { return '<option value="' + l + '"' + (l === pb.level ? ' selected' : '') + '>' + esc(Ida.LEVEL_NAME[l]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ida-field">Who Ida contacts<textarea id="dg-who" rows="2">' + esc(pb.scope.who) + '</textarea></label>' +
      '<label class="ida-field">What Ida says and asks<textarea id="dg-say" rows="3">' + esc(pb.scope.say) + '</textarea></label>' +
      '<label class="ida-field">How often Ida follows up<select id="dg-cadence">' + cadenceList(pb.scope.cadence).map(function (c) { return '<option' + (c === pb.scope.cadence ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ida-field">Ida stops for<input type="text" id="dg-stop" value="' + esc(pb.scope.stop) + '"></label>' +
      '<label class="ida-field">What Ida brings to you<textarea id="dg-toyou" rows="2">' + esc(pb.scope.toYou) + '</textarea></label>' +
      '<p class="ida-form__hint">The new scope applies from Ida\'s next message. Nothing already sent changes.</p><div class="ida-row-acts"><button class="ida-btn ida-btn--primary" type="submit">Save scope</button><button class="ida-btn ida-btn--quiet" type="button" data-cancel>Cancel</button></div></form>';
    var main = ui.openDrawer({ title: 'Change the ' + pb.name + ' playbook', sub: 'Applies to every ' + pb.one + ' it covers', html: html });
    var f = main.querySelector('#dg-scope'); f.querySelector('#dg-level').focus();
    f.querySelector('[data-cancel]').addEventListener('click', ui.closeDrawer);
    f.addEventListener('submit', function (e) { e.preventDefault(); var v = readScope(f), l = f.querySelector('#dg-level').value; ui.closeDrawer(); ui.withUndo('<b>' + esc(pb.name) + ' playbook saved.</b> Applies to every ' + esc(pb.one) + '.', function () { A.pbScope(pbId, v); A.pbLevel(pbId, l); }); });
  };

  function replyPanel() {
    var p = document.getElementById('ida-reply');
    if (!p) {
      p = document.createElement('section'); p.id = 'ida-reply'; p.className = 'ida-reply'; p.setAttribute('aria-live', 'polite'); p.setAttribute('aria-label', 'Ida\'s answer');
      var tb = document.querySelector('.topbar'); tb.parentNode.insertBefore(p, tb.nextSibling);
    }
    return p;
  }
  function respond(text) {
    var p = replyPanel(), body = '';
    var plan = Ida.parse.change(text);
    if (plan) return showPlan(p, text, plan, false);
    var asksQ = /\?\s*$/.test(text) || /^(what|when|who|where|is|are|does|do|did|has|have|how|which|any|can you tell|tell me)\b/i.test(text.trim());
    var goal = !asksQ && Ida.parse.goal(text);
    var r = !goal && Ida.parse.rule(text), tk = !r && Ida.parse.task(text), ans = !r && !goal && answer(text), note = !r && !tk && !ans && !goal && Ida.parse.notePlan(text);
    if (note) return showPlan(p, text, note, false);
    if (goal) {
      body = '<div class="ida-understood"><small>This sounds like a responsibility for Ida</small><b>' + esc(Ida.util.cap(text)) + '</b><small>Ida proposes it for a type of client (buyer deals, seller listings or leads), with the scope it would follow, and starts only after you approve.</small></div>' +
        '<div class="ida-row-acts"><button class="ida-btn" type="button" data-delegate-ask>Hand it to Ida</button>' + (tk ? '<button class="ida-btn ida-btn--quiet" type="button" data-addtask>Add as a task instead</button>' : '') + '<button class="ida-btn ida-btn--quiet" type="button" data-close>Not now</button></div>';
    } else if (r) {
      body = '<div class="ida-understood"><small>Ida understood this as a rule · ' + esc(Ida.GROUPS[r.group]) + '</small><b>' + esc(r.text) + '</b><small>' + esc(Ida.parse.ruleMeaning(r)) + '</small></div>' +
        '<div class="ida-row-acts"><button class="ida-btn" type="button" data-addrule>Add as a rule</button><button class="ida-btn ida-btn--quiet" type="button" data-close>Not now</button></div>';
    } else if (ans) {
      body = ans;
    } else if (tk) {
      body = '<div class="ida-understood"><small>Ida understood this as a task · ' + esc(tk.area) + '</small><b>' + esc(tk.name) + '</b>' + (tk.person ? '<small>Ida can draft the message to ' + esc(tk.person.name) + ' for you to approve, or keep it on your list.</small>' : '<small>It goes on your list in Still yours. You can hand it to Ida later.</small>') + '</div>' +
        '<div class="ida-row-acts">' + (tk.person ? '<button class="ida-btn" type="button" data-draft>Draft it for my approval</button>' : '') + '<button class="ida-btn" type="button" data-addtask>Add as a task</button><button class="ida-btn ida-btn--quiet" type="button" data-close>Not now</button></div>';
    } else {
      body = (/\?$/.test(text.trim()) ? '<p>Ida doesn\'t have an answer to that in your deals, rules or apps.</p>' : '<p>Ida didn\'t recognize that as a question, a rule or a task.</p>') + HELP;
    }
    p.innerHTML = '<div class="ida-reply__q"><span>You: ' + esc(text) + '</span><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>' + body;
    p.hidden = false;
    p.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { p.hidden = true; var i = document.querySelector('.ask input'); if (i) i.focus(); }); });
    var ar = p.querySelector('[data-addrule]');
    if (ar) ar.addEventListener('click', function () { var id = A.addRule(r); p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Added to ' + esc(Ida.GROUPS[r.group]) + '.</b> ' + esc(r.text) + '. It applies to every task from now on.</span><a href="rules.html#' + esc(id) + '">See it in Your rules</a><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>'; p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; }); });
    var at = p.querySelector('[data-addtask]');
    if (at) at.addEventListener('click', function () { var id = A.addTask({ name: tk.name, area: tk.area, who: 'you' }); p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Added to Still yours.</b> ' + esc(tk.name) + '.</span><a href="tasks.html#' + esc(id) + '">See it on Tasks</a><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>'; p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; }); });
    var dr = p.querySelector('[data-draft]');
    if (dr) dr.addEventListener('click', function () {
      var per = tk.person, dl = Q.deal(per.deal), about = tk.about || ('where things stand on ' + dl.name);
      var subj = (tk.about ? Ida.util.cap(tk.about) : dl.name) + (tk.about && tk.about.indexOf(dl.name) < 0 ? ' · ' + dl.name : '');
      A.addDecision({ kind: 'note', deal: per.deal, secs: 30, label: 'Approve · 30 sec', meta: dl.name + ' · you asked Ida to draft this', q: 'Send this to ' + per.name + '?',
        tab: 'Message to ' + per.name, tabSub: dl.name + ' · drafted from what you typed',
        why: 'Ida drafted this from what you typed. Read it before you approve.',
        head: [['To', per.name + (per.org ? ', ' + per.org : '')], ['Subject', subj]],
        body: '<p>Hi ' + esc(per.hi) + ',</p><p>I\'m following up about ' + esc(about) + '. Could you let me know where things stand?</p><p>Thanks,<br>Dana</p>',
        primary: 'Approve and send', fine: Ida.SEND_RULE, toWho: per.name,
        doneLine: 'Sent your follow-up to ' + per.name + ' about ' + about + '.',
        sent: { wf: null, deal: dl.name, to: per.name, subj: subj } });
      p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Drafted.</b> The message to ' + esc(per.name) + ' is waiting for your approval on Today. Nothing has been sent.</span>' + (location.pathname.match(/\/$|index\.html$/) ? '' : '<a href="./">Open Today</a>') + '<button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>';
      p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; });
    });
    var dga = p.querySelector('[data-delegate-ask]'); if (dga) dga.addEventListener('click', function () { p.hidden = true; ui.delegate(text); });
    p.querySelectorAll('[data-try]').forEach(function (b) { b.addEventListener('click', function () { var i = document.querySelector('.ask input'); i.value = b.getAttribute('data-try'); respond(i.value); }); });
  }
  function wireAsk() {
    var i = document.querySelector('.ask input'); if (!i || i.closest('[hidden]')) return;
    i.setAttribute('aria-label', 'Tell Ida a change, or ask a question'); i.placeholder = 'Tell Ida a change, or ask a question'; i.maxLength = 500;
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && i.value.trim()) { e.preventDefault(); respond(i.value.trim()); } });
  }
  ui.respond = respond;

  /* ---------- Boot ---------- */
  function boot() { navCount(); resetControl(); wireAsk(); S.subscribe(navCount); syncToasts(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
