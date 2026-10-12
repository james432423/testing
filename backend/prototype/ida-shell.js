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
    var ic = d.querySelector('.ida-source__icon'); ic.textContent = o.icon || ''; ic.hidden = !o.icon;
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
    var d = Ida.DOCS[id]; if (!d) return;
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

  /* ---------- Toast with a real undo ---------- */
  var toast, toastTimer, toastTick, toastRev = -1, restoring = false;
  ui.closeToast = function () { if (toast) { toast.remove(); toast = null; } clearInterval(toastTick); clearTimeout(toastTimer); toastRev = -1; };
  ui.toast = function (html, onUndo, secs) {
    ui.closeToast();
    secs = secs || 10;
    toast = document.createElement('div'); toast.className = 'ida-toast'; toast.setAttribute('role', 'status');
    toast.innerHTML = '<div class="ida-toast__row"><span>' + html + '</span>' + (onUndo ? '<button type="button" data-toast-undo>Undo · ' + secs + '</button>' : '<button type="button" data-toast-close>Close</button>') + '</div>' + (onUndo ? '<div class="ida-toast__bar"></div>' : '');
    document.body.appendChild(toast);
    toastRev = S.get().rev;
    var left = secs, bar = toast.querySelector('.ida-toast__bar'), btn = toast.querySelector('[data-toast-undo]');
    if (bar) { bar.style.transition = 'transform ' + secs + 's linear'; requestAnimationFrame(function () { requestAnimationFrame(function () { if (bar) bar.style.transform = 'scaleX(0)'; }); }); }
    if (btn) {
      toastTick = setInterval(function () { left--; if (btn.isConnected) btn.textContent = 'Undo · ' + Math.max(left, 0); }, 1000);
      btn.addEventListener('click', function () { ui.closeToast(); restoring = true; try { onUndo(); } finally { restoring = false; } });
    } else toast.querySelector('[data-toast-close]').addEventListener('click', ui.closeToast);
    toastTimer = setTimeout(ui.closeToast, secs * 1000);
  };
  /* Run an action with a 10-second undo that restores the store exactly. */
  ui.withUndo = function (html, fn, after) {
    var snap = S.snapshot();
    fn();
    ui.toast(html, function () { S.restore(snap); if (after) after(); });
  };
  S.subscribe(function (s) { if (toast && !restoring && toastRev !== -1 && s.rev !== toastRev) ui.closeToast(); });

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
        '<div class="ida-row-acts">' + (who === 'ida' ? '<a class="ida-btn" href="workflows.html#' + t.wf + '">See the workflow</a>' : '') + '<a class="ida-btn ida-btn--quiet" href="tasks.html#' + id + '">See it on Tasks</a><button class="ida-btn ida-btn--quiet" type="button" data-more>Add another</button></div>';
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
  var HELP = '<p>Ida can answer questions about your deals, take a rule, or take a task. Try one of these:</p><div class="ida-chips">' +
    ['When is the Linden closing?', 'Who\'s on the 17 Ash St deal?', 'What\'s waiting on me?', 'Never text clients after 8 pm', 'Follow up with Kim about the appraisal'].map(function (x) { return '<button class="ida-chipbtn" type="button" data-try="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>';

  function replyPanel() {
    var p = document.getElementById('ida-reply');
    if (!p) {
      p = document.createElement('section'); p.id = 'ida-reply'; p.className = 'ida-reply'; p.setAttribute('aria-live', 'polite'); p.setAttribute('aria-label', 'Ida\'s answer');
      var tb = document.querySelector('.topbar'); tb.parentNode.insertBefore(p, tb.nextSibling);
    }
    return p;
  }
  function respond(text) {
    var p = replyPanel(), body = '', s = S.get();
    var r = Ida.parse.rule(text), tk = !r && Ida.parse.task(text), ans = !r && answer(text);
    if (r) {
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
    if (ar) ar.addEventListener('click', function () { var id = A.addRule(r); p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Added to ' + esc(Ida.GROUPS[r.group]) + '.</b> ' + esc(r.text) + '. It applies to every task from now on.</span><a href="rules.html#' + id + '">See it in Your rules</a><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>'; p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; }); });
    var at = p.querySelector('[data-addtask]');
    if (at) at.addEventListener('click', function () { var id = A.addTask({ name: tk.name, area: tk.area, who: 'you' }); p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Added to Still yours.</b> ' + esc(tk.name) + '.</span><a href="tasks.html#' + id + '">See it on Tasks</a><button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>'; p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; }); });
    var dr = p.querySelector('[data-draft]');
    if (dr) dr.addEventListener('click', function () {
      var per = tk.person, dl = Q.deal(per.deal), about = tk.about || ('where things stand on ' + dl.name);
      var subj = (tk.about ? Ida.util.cap(tk.about) : dl.name) + (tk.about && tk.about.indexOf(dl.name) < 0 ? ' · ' + dl.name : '');
      A.addDecision({ kind: 'note', deal: per.deal, secs: 30, label: 'Approve · 30 sec', meta: dl.name + ' · you asked Ida to draft this', q: 'Send this to ' + per.name + '?',
        tab: 'Message to ' + per.name, tabSub: dl.name + ' · drafted from what you typed',
        why: 'Ida drafted this from what you typed. Read it before you approve.',
        head: [['To', per.name + (per.org ? ', ' + per.org : '')], ['Subject', subj]],
        body: '<p>Hi ' + esc(per.hi) + ',</p><p>I\'m following up about ' + esc(about) + '. Could you let me know where things stand?</p><p>Thanks,<br>Dana</p>',
        primary: 'Approve and send', fine: 'Nothing goes out until you approve, and you can undo for 10 seconds after.', toWho: per.name,
        doneLine: 'Sent your follow-up to ' + per.name + ' about ' + about + '.',
        sent: { wf: null, deal: dl.name, to: per.name, subj: subj } });
      p.innerHTML = '<div class="ida-notice" role="status">' + Ida.TICK + '<span><b>Drafted.</b> The message to ' + esc(per.name) + ' is waiting for your approval on Today. Nothing has been sent.</span>' + (location.pathname.match(/\/$|index\.html$/) ? '' : '<a href="./">Open Today</a>') + '<button class="ida-btn ida-btn--quiet" type="button" data-close>Close</button></div>';
      p.querySelector('[data-close]').addEventListener('click', function () { p.hidden = true; });
    });
    p.querySelectorAll('[data-try]').forEach(function (b) { b.addEventListener('click', function () { var i = document.querySelector('.ask input'); i.value = b.getAttribute('data-try'); respond(i.value); }); });
  }
  function wireAsk() {
    var i = document.querySelector('.ask input'); if (!i || i.closest('[hidden]')) return;
    i.setAttribute('aria-label', 'Tell Ida something, or ask a question');
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && i.value.trim()) { e.preventDefault(); respond(i.value.trim()); } });
  }
  ui.respond = respond;

  /* ---------- Boot ---------- */
  function boot() { navCount(); resetControl(); wireAsk(); S.subscribe(navCount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
