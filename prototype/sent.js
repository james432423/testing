/* Sent by Ida: the log from the store, with filters, undo where it still works,
   and "This was wrong", which drops the workflow a level. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var DAYS = [
    { id: 'q', h: 'Not sent yet', sub: 'Scheduled · you can still stop it' },
    { id: 'mon', h: 'Today', sub: 'Monday, October 12' },
    { id: 'sun', h: 'Yesterday', sub: 'Sunday, October 11' },
    { id: 'sat', h: 'Saturday', sub: 'October 10' }
  ];
  var DOWNMEANS = { approve: 'Ida will ask before each one goes out', practice: 'Ida will draft privately and send nothing' };
  var CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
  var EXT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>';
  var open = {}, wrongOpen = null, drafted = {};
  S.get().sent.forEach(function (e) { if (e.open) open[e.id] = true; });

  function wfName(id, e) { if (e && e.pb) { var rr = Q.playbook(e.pb); if (rr) return rr.name + ' playbook'; } if (id === 'price') return 'Price-review notes'; if (!id) return 'Asked by you'; var w = Q.wf(id); return w ? w.name : id; }
  function howHtml(e) { return e.how === 'own' ? '<span class="how"><i class="sq sq--auto"></i>On its own</span>' : '<span class="how"><i class="sq sq--approve"></i>You approved' + (e.at ? ' at ' + esc(e.at) : '') + '</span>'; }
  function firstName(to) { return to.split(',')[0].split(' · ')[0]; }

  /* Approved messages wait 10 seconds in the store's outbox before they become Sent. They show
     here (and on every page, in the toast) as "Sending in N s" with Undo until then. */
  function pending() {
    return Q.outbox().map(function (ob) {
      var d = ob.dec && Q.decision(ob.dec), o = d && d.kind === 'choice' && (d.options || []).filter(function (x) { return x.opt === ob.opt; })[0];
      return { id: 'ob-' + ob.id, ob: ob, day: 'q', t: 'Sending', wf: d ? d.wf || null : 'price', pb: d && d.pb, deal: d ? ((d.sent && d.sent.deal) || Ida.DEAL_NAMES[d.deal] || '') : '17 Ash St', how: 'approve', to: ob.to, subj: ob.subj,
        head: d && d.head && d.head.length ? d.head : [['To', ob.to]], body: d && d.kind !== 'choice' ? d.body : '<p>' + esc(o ? o.next : 'Price review with the comparison attached.') + '</p>' };
    });
  }
  function rowSending(e) {
    var isOpen = !!open[e.id], left = Math.max(0, Math.ceil((e.ob.due - Date.now()) / 1000));
    return '<li class="ent is-sending' + (isOpen ? ' is-open' : '') + '" id="' + esc(e.id) + '" data-wf="' + esc(e.wf || '') + '" data-deal="' + esc(e.deal) + '" data-how="approve" data-q="1">' +
      '<span class="ent__time">Sending</span>' +
      '<button class="ent__open" type="button" aria-expanded="' + isOpen + '" aria-controls="b-' + esc(e.id) + '" data-toggle="' + esc(e.id) + '"><span class="ent__to">' + esc(e.to) + '</span><span class="ent__subj">' + esc(e.subj) + '</span><span class="ent__meta">' + esc(wfName(e.wf, e)) + (e.deal ? ' · ' + esc(e.deal) : '') + ' · ' + howHtml(e) + '</span></button>' +
      '<span class="ent__side"><span class="ent__state">Sending in <span data-due="' + Number(e.ob.due) + '">' + left + '</span> s</span><button class="ida-btn" type="button" data-cancel-send="' + esc(e.ob.id) + '">Undo</button><button class="chev" type="button" tabindex="-1" aria-hidden="true" data-toggle="' + esc(e.id) + '">' + CHEV + '</button></span>' +
      '<div class="ent__body" id="b-' + esc(e.id) + '"' + (isOpen ? '' : ' hidden') + '><div class="ida-letter"><dl>' + e.head.map(function (h) { return '<dt>' + esc(h[0]) + '</dt><dd>' + esc(h[1]) + '</dd>'; }).join('') + '</dl>' + Ida.util.safeHtml(e.body) + '</div>' +
      '<div class="ent__acts"><button class="ida-btn" type="button" data-cancel-send="' + esc(e.ob.id) + '">Undo</button><small>' + esc(Ida.SEND_RULE) + ' Undo puts it back in your decisions on Today.</small></div></div></li>';
  }
  function row(e) {
    if (e.ob) return rowSending(e);
    var w = Q.wf(e.wf), lvl = w && w.level, down = lvl && Q.levelDown(lvl), isOpen = !!open[e.id];
    var doc = e.src && Ida.doc(e.src.doc);
    var docName = doc ? (doc.icon === 'SIG' ? doc.title : doc.title.charAt(0).toLowerCase() + doc.title.slice(1)) : '';
    var meta = (e.ch === 'text' ? ['<span class="ch">Text</span>'] : []).concat([esc(wfName(e.wf, e)), esc(e.deal), howHtml(e)].concat(doc ? ['Cites the ' + esc(docName) + (e.src.pg !== 'status' ? ', ' + esc(e.src.pg) : '')] : [])).join(' · ');
    var canUndo = e.undo && !e.undone, hold = Q.sentHold(e);
    var side = hold ? '<span class="ent__state ent__held">On hold</span>' : canUndo ? '<button class="ida-btn" type="button" data-undo="' + esc(e.id) + '">Undo</button>' : '<span class="ent__state">' + (e.undone ? 'Undone · ' + (e.day === 'q' ? 'it won\'t go out' : 'invite removed') : esc(e.state)) + '</span>';
    var dl = e.head.map(function (h) { return '<dt>' + esc(h[0]) + '</dt><dd>' + esc(h[1]) + '</dd>'; }).join('');
    var src = doc ? '<div class="ida-source ida-source--card"><div class="ida-source__doc"><span class="ida-source__icon" aria-hidden="true">' + esc(doc.icon) + '</span><span><b>' + esc(doc.title) + '</b><small>' + esc(doc.who) + (doc.page ? ' · page ' + doc.page + (doc.pages ? ' of ' + doc.pages : '') : '') + '</small></span></div><blockquote>' + Ida.util.safeHtml(e.src.q) + '</blockquote><a class="ida-source__link" href="' + esc(doc.href || 'doc.html?d=' + encodeURIComponent(e.src.doc)) + '" data-doc="' + esc(e.src.doc) + '">' + esc(e.src.link) + EXT + '</a></div>' : '';
    var fine = canUndo ? esc(e.undo) + ' ' : e.undone ? '' : (e.day === 'q' ? '' : 'Already delivered, so it can\'t be pulled back. ');
    var wrongBtn = '', slot = '';
    if (e.wrong) {
      var c = e.wrong.to === 'approve' ? ['on', 'on cur', ''] : ['on cur', '', ''];
      slot = '<div class="moved" role="status"><b>' + esc(w ? w.name : '') + ' is back at ' + Ida.LEVEL_NAME[e.wrong.to] + '.</b><ol class="ida-trust" aria-label="Trust level" style="max-width:300px"><li class="' + c[0] + '"><span></span>Practice</li><li class="' + c[1] + '"><span></span>You approve</li><li class="' + c[2] + '"><span></span>On its own</li></ol>' +
        '<div>' + (drafted[e.id] ? '<span>Correction drafted. <a href="./" style="color:var(--ink);font-weight:600">It\'s waiting on Today</a></span>' : '<button class="ida-btn" type="button" data-correct="' + esc(e.id) + '">Draft a correction to ' + esc(firstName(e.to)) + '</button>') + '<button class="ida-btn ida-btn--quiet" type="button" data-unwrong="' + esc(e.id) + '">Undo</button></div></div>';
    } else if (w && down) {
      wrongBtn = '<button class="ida-btn" type="button" data-wrong="' + esc(e.id) + '"' + (wrongOpen === e.id ? ' disabled' : '') + '>This was wrong</button>';
      fine += 'This was wrong moves ' + esc(w.name) + ' back to ' + Ida.LEVEL_NAME[down] + '.';
      if (wrongOpen === e.id) slot = '<div class="wrong"><b>Move ' + esc(w.name) + ' back to ' + Ida.LEVEL_NAME[down] + '?</b><p>' + DOWNMEANS[down] + ' until its record earns your trust again. Your rules stay as they are.</p>' +
        '<fieldset class="why"><legend>What was wrong? (optional)</legend>' + ['A fact', 'The person', 'The tone', 'It shouldn\'t have gone out'].map(function (r) { return '<label><input type="radio" name="why-' + esc(e.id) + '" value="' + esc(r) + '">' + esc(r) + '</label>'; }).join('') + '</fieldset>' +
        '<div class="wrong__row"><button class="ida-btn" type="button" data-confirm="' + esc(e.id) + '">Move it back to ' + Ida.LEVEL_NAME[down] + '</button><button class="ida-btn ida-btn--quiet" type="button" data-cancel="' + esc(e.id) + '">Cancel</button></div></div>';
    } else if (w && !down) fine += esc(w.name) + ' is in Practice, so nothing from it goes out.';
    if (hold) fine = esc(hold.text) + '. It won\'t go out until that changes. ' + fine;
    var resume = hold && hold.by === 'duty' ? '<button class="ida-btn" type="button" data-dutyon="' + esc(hold.pb) + '" data-duty-id="' + esc(hold.duty) + '">Turn ' + esc(hold.name) + ' back on</button>' : hold && hold.by === 'person' ? '<a class="ida-btn ida-btn--quiet" href="handled.html#' + esc(hold.person) + '">Open on Being handled</a>' : '';
    var acts = '<div class="ent__acts">' + resume + (canUndo ? '<button class="ida-btn" type="button" data-undo="' + esc(e.id) + '">Undo</button>' : '') + wrongBtn + '<small>' + fine + '</small></div>';
    return '<li class="ent' + (isOpen ? ' is-open' : '') + (e.undone ? ' is-undone' : '') + '" id="' + esc(e.id) + '" data-wf="' + esc(e.wf || '') + '" data-deal="' + esc(e.deal) + '" data-how="' + esc(e.how) + '" data-q="' + (e.day === 'q' ? '1' : '0') + '">' +
      '<span class="ent__time">' + esc((fgroup.value !== 'day' && e.day !== 'q' ? ({ mon: 'Today', sun: 'Sun', sat: 'Sat' }[e.day] || '') + ' ' : '') + e.t) + '</span>' +
      '<button class="ent__open" type="button" aria-expanded="' + isOpen + '" aria-controls="b-' + esc(e.id) + '" data-toggle="' + esc(e.id) + '"><span class="ent__to">' + esc(e.to) + '</span><span class="ent__subj">' + esc(e.subj) + '</span><span class="ent__meta">' + meta + '</span></button>' +
      '<span class="ent__side">' + side + '<button class="chev" type="button" tabindex="-1" aria-hidden="true" data-toggle="' + esc(e.id) + '">' + CHEV + '</button></span>' +
      '<div class="ent__body" id="b-' + esc(e.id) + '"' + (isOpen ? '' : ' hidden') + '><div class="ida-letter"><dl>' + dl + '</dl>' + Ida.util.safeHtml(e.body) + '</div>' + src + acts + slot + '</div></li>';
  }
  var DORDER = { q: 0, mon: 1, sun: 2, sat: 3 }, collapsed = {};
  function mins(t) { var m = /(\d+):(\d+)\s*(am|pm)/.exec(t || ''); if (!m) return 0; return (+m[1] % 12 + (m[3] === 'pm' ? 12 : 0)) * 60 + +m[2]; }
  var fgroup = document.getElementById('f-group');
  try { var g0 = localStorage.getItem('ida-sent-group'); if (/^(person|deal|day)$/.test(g0 || '')) fgroup.value = g0; } catch (e) {}
  var mg = location.search.match(/[?&]group=(person|deal|day)\b/); if (mg) fgroup.value = mg[1];
  fgroup.addEventListener('change', function () { try { localStorage.setItem('ida-sent-group', fgroup.value); } catch (e) {} render(); setUrl(); });
  var fwf = document.getElementById('f-wf'), fdeal = document.getElementById('f-deal');
  function options() {
    var s = S.get(), seen = {}, wfs = [], deals = [];
    s.sent.forEach(function (e) { var k = e.wf || ''; if (!(k in seen)) { seen[k] = 1; wfs.push(k); } if (deals.indexOf(e.deal) < 0) deals.push(e.deal); });
    var cur = fwf.value, curD = fdeal.value;
    fwf.innerHTML = '<option value="">All workflows</option>' + s.workflows.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.name) + '</option>'; }).join('') + wfs.filter(function (k) { return !Q.wf(k); }).map(function (k) { return '<option value="' + (k || '_you') + '">' + esc(wfName(k)) + '</option>'; }).join('');
    fdeal.innerHTML = '<option value="">All deals</option>' + deals.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('');
    fwf.value = cur; fdeal.value = curD;
  }
  function render() {
    var s = S.get();
    options();
    var log = document.getElementById('log'), mode = fgroup.value, groups = [], by = {};
    var sorted = pending().concat(s.sent).sort(function (a, b) { return (DORDER[a.day] - DORDER[b.day]) || (mins(b.t) - mins(a.t)); });
    sorted.forEach(function (e) {
      var k = mode === 'day' ? e.day : mode === 'deal' ? e.deal : firstName(e.to);
      if (!by[k]) { by[k] = []; groups.push(k); } by[k].push(e);
    });
    if (mode === 'day') groups.sort(function (a, b) { return DORDER[a] - DORDER[b]; });
    log.innerHTML = groups.map(function (k, gi) {
      var d = mode === 'day' ? DAYS.filter(function (x) { return x.id === k; })[0] : null, h = d ? d.h : k, sub = d ? d.sub : '';
      var gid = 'g' + gi, isC = !!collapsed[mode + '|' + k];
      return '<section class="day" data-grp="' + esc(k) + '"><h2><button type="button" class="grp__btn" data-grp-toggle="' + esc(mode + '|' + k) + '" aria-expanded="' + !isC + '" aria-controls="' + gid + '">' + CHEV + '<b>' + esc(h) + '</b>' + (sub ? ' <span>' + esc(sub) + '</span>' : '') + '<span class="grp__n" data-n></span></button></h2><ul id="' + gid + '"' + (isC ? ' hidden' : '') + '>' + by[k].map(row).join('') + '</ul></section>';
    }).join('');
    apply();
    var n = Q.sentCount(), own = s.sent.filter(function (e) { return e.day !== 'q' && !e.undone && e.how === 'own'; }).length, wrong = s.sent.filter(function (e) { return e.wrong; }).length;
    document.getElementById('since').innerHTML = '<b style="color:var(--ink)">' + n + ' sent</b> · ' + own + ' on their own · ' + (n - own) + ' you approved · ' + wrong + ' marked wrong';
  }
  function apply() {
    var n = 0, own = 0, appr = 0, wv = fwf.value === '_you' ? '' : fwf.value, any = false;
    document.querySelectorAll('.ent').forEach(function (li) {
      var show = (!fwf.value || li.dataset.wf === wv) && (!fdeal.value || li.dataset.deal === fdeal.value);
      li.hidden = !show;
      if (show && li.dataset.q !== '1' && !li.classList.contains('is-undone')) { n++; if (li.dataset.how === 'own') own++; else appr++; }
    });
    document.querySelectorAll('.day').forEach(function (d) { var v = d.querySelectorAll('.ent:not([hidden])').length; d.hidden = !v; if (v) any = true; var nn = d.querySelector('[data-n]'); if (nn) nn.textContent = v + (v === 1 ? ' message' : ' messages'); });
    document.getElementById('empty').hidden = any;
    document.getElementById('tally').innerHTML = '<b>' + n + ' sent</b><span>' + own + ' on their own</span><span>' + appr + ' you approved</span>';
    var name = fwf.value ? fwf.options[fwf.selectedIndex].text : '';
    document.querySelector('.ida-pagehead p').textContent = name ? 'Everything ' + name + ' sent for you, on its own or after you approved it.' : 'Every message Ida sent for you, on its own or after you approved it.';
  }
  function setUrl() { try { var q = []; if (fwf.value) q.push('wf=' + encodeURIComponent(fwf.value)); if (fdeal.value) q.push('deal=' + encodeURIComponent(fdeal.value)); if (fgroup.value !== 'person') q.push('group=' + fgroup.value); history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '')); } catch (e) {} }
  fwf.addEventListener('change', function () { apply(); setUrl(); });
  fdeal.addEventListener('change', function () { apply(); setUrl(); });
  document.getElementById('clear').addEventListener('click', function () { fwf.value = ''; fdeal.value = ''; collapsed = {}; apply(); setUrl(); });

  document.getElementById('log').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return; var id;
    if ((id = b.getAttribute('data-grp-toggle'))) { collapsed[id] = !collapsed[id]; var ul = document.getElementById(b.getAttribute('aria-controls')); ul.hidden = collapsed[id]; b.setAttribute('aria-expanded', String(!collapsed[id])); return; }
    if ((id = b.getAttribute('data-toggle'))) { open[id] = !open[id]; var li = document.getElementById(id), body = document.getElementById('b-' + id); li.classList.toggle('is-open', open[id]); body.hidden = !open[id]; li.querySelector('.ent__open').setAttribute('aria-expanded', String(open[id])); return; }
    if ((id = b.getAttribute('data-cancel-send'))) { if (A.cancelSend(id)) ui.toast('<b>Cancelled.</b> Nothing was sent; it\'s back in your decisions on Today.'); return; }
    if ((id = b.getAttribute('data-dutyon'))) { var did = b.getAttribute('data-duty-id'), du = Q.duty(Q.playbook(id), did); ui.withUndo('<b>' + esc(du ? du.name : '') + ' is on</b> again.', function () { A.dutyToggle(id, did, true); }); return; }
    if ((id = b.getAttribute('data-undo'))) { var e0 = Q.wf && S.get().sent.filter(function (x) { return x.id === id; })[0]; A.sentUndo(id); ui.toast('<b>Undone.</b> ' + (e0.day === 'q' ? 'It won\'t go out.' : 'The invite is removed from every calendar.')); return; }
    if ((id = b.getAttribute('data-wrong'))) { wrongOpen = id; open[id] = true; render(); var c = document.querySelector('#' + esc(id) + ' [data-confirm]'); if (c) c.focus(); return; }
    if ((id = b.getAttribute('data-cancel'))) { wrongOpen = null; render(); return; }
    if ((id = b.getAttribute('data-confirm'))) { var r = document.querySelector('input[name="why-' + esc(id) + '"]:checked'); wrongOpen = null; A.sentWrong(id, r ? r.value : ''); return; }
    if ((id = b.getAttribute('data-unwrong'))) { A.sentUnwrong(id); return; }
    if ((id = b.getAttribute('data-correct'))) {
      var e = S.get().sent.filter(function (x) { return x.id === id; })[0], who = firstName(e.to), hi = who.split(' ')[0];
      A.addDecision({ kind: 'note', secs: 30, label: 'Approve · 30 sec', meta: e.deal + ' · correction to a message you marked wrong', q: 'Send a correction to ' + who + '?', tab: 'Correction to ' + who, tabSub: e.deal + ' · about "' + e.subj + '"',
        why: 'You marked "' + esc(e.subj) + '" as wrong. Ida drafted a short correction; change the wording before you approve.',
        head: [['To', e.to.split(' · ')[0]], ['Subject', 'Correction: ' + e.subj]],
        body: '<p>Hi ' + esc(hi) + ',</p><p>Please disregard my earlier message, "' + esc(e.subj) + '". Part of it wasn\'t right, and I\'ll follow up with the correct details shortly.</p><p>Sorry for the confusion,<br>Dana</p>',
        primary: 'Approve and send', fine: Ida.SEND_RULE, toWho: who, doneLine: 'Sent a correction to ' + who + ' about "' + e.subj + '".',
        sent: { wf: null, deal: e.deal, to: who, subj: 'Correction: ' + e.subj } });
      drafted[id] = true; render(); return;
    }
  });
  var m = location.search.match(/[?&]wf=([^&]+)/), md = location.search.match(/[?&]deal=([^&]+)/);
  render();
  if (m) { fwf.value = decodeURIComponent(m[1]); if (fwf.selectedIndex < 0) fwf.value = ''; }
  if (md) { fdeal.value = decodeURIComponent(md[1]).replace(/\+/g, ' '); if (fdeal.selectedIndex < 0) fdeal.value = ''; }
  apply();
  S.subscribe(render);
  /* sent.html#<id> (from a client's panel on Being handled, or Today) opens that message. */
  function openHash() {
    var id = location.hash.slice(1); if (!/^[A-Za-z0-9_-]+$/.test(id)) return;
    if (!S.get().sent.some(function (e) { return e.id === id; })) return;
    fwf.value = ''; fdeal.value = ''; collapsed = {}; open[id] = true; render();
    var li = document.getElementById(id); if (li) { li.querySelector('.ent__open').focus({ preventScroll: true }); ui.highlight(li); }
  }
  window.addEventListener('hashchange', openHash);
  openHash();
})();
