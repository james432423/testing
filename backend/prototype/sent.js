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

  function wfName(id) { if (id === 'price') return 'Price-review notes'; if (!id) return 'Asked by you'; var w = Q.wf(id); return w ? w.name : id; }
  function howHtml(e) { return e.how === 'own' ? '<span class="how"><i class="sq sq--auto"></i>On its own</span>' : '<span class="how"><i class="sq sq--approve"></i>You approved' + (e.at ? ' at ' + esc(e.at) : '') + '</span>'; }
  function firstName(to) { return to.split(',')[0].split(' · ')[0]; }

  function row(e) {
    var w = Q.wf(e.wf), lvl = w && w.level, down = lvl && Q.levelDown(lvl), isOpen = !!open[e.id];
    var doc = e.src && Ida.DOCS[e.src.doc];
    var docName = doc ? (doc.icon === 'SIG' ? doc.title : doc.title.charAt(0).toLowerCase() + doc.title.slice(1)) : '';
    var meta = [esc(wfName(e.wf)), esc(e.deal), howHtml(e)].concat(doc ? ['Cites the ' + esc(docName) + (e.src.pg !== 'status' ? ', ' + esc(e.src.pg) : '')] : []).join(' · ');
    var canUndo = e.undo && !e.undone;
    var side = canUndo ? '<button class="ida-btn" type="button" data-undo="' + e.id + '">Undo</button>' : '<span class="ent__state">' + (e.undone ? 'Undone · ' + (e.day === 'q' ? 'it won\'t go out' : 'invite removed') : esc(e.state)) + '</span>';
    var dl = e.head.map(function (h) { return '<dt>' + esc(h[0]) + '</dt><dd>' + esc(h[1]) + '</dd>'; }).join('');
    var src = doc ? '<div class="ida-source ida-source--card"><div class="ida-source__doc"><span class="ida-source__icon" aria-hidden="true">' + doc.icon + '</span><span><b>' + esc(doc.title) + '</b><small>' + esc(doc.who) + (doc.page ? ' · page ' + doc.page + (doc.pages ? ' of ' + doc.pages : '') : '') + '</small></span></div><blockquote>' + e.src.q + '</blockquote><a class="ida-source__link" href="' + (doc.href || 'doc.html?d=' + e.src.doc) + '" data-doc="' + e.src.doc + '">' + esc(e.src.link) + EXT + '</a></div>' : '';
    var fine = canUndo ? esc(e.undo) + ' ' : e.undone ? '' : (e.day === 'q' ? '' : 'Already delivered, so it can\'t be pulled back. ');
    var wrongBtn = '', slot = '';
    if (e.wrong) {
      var c = e.wrong.to === 'approve' ? ['on', 'on cur', ''] : ['on cur', '', ''];
      slot = '<div class="moved" role="status"><b>' + esc(w ? w.name : '') + ' is back at ' + Ida.LEVEL_NAME[e.wrong.to] + '.</b><ol class="ida-trust" aria-label="Trust level" style="max-width:300px"><li class="' + c[0] + '"><span></span>Practice</li><li class="' + c[1] + '"><span></span>You approve</li><li class="' + c[2] + '"><span></span>On its own</li></ol>' +
        '<div>' + (drafted[e.id] ? '<span>Correction drafted. <a href="./" style="color:var(--ink);font-weight:600">It\'s waiting on Today</a></span>' : '<button class="ida-btn" type="button" data-correct="' + e.id + '">Draft a correction to ' + esc(firstName(e.to)) + '</button>') + '<button class="ida-btn ida-btn--quiet" type="button" data-unwrong="' + e.id + '">Undo</button></div></div>';
    } else if (w && down) {
      wrongBtn = '<button class="ida-btn" type="button" data-wrong="' + e.id + '"' + (wrongOpen === e.id ? ' disabled' : '') + '>This was wrong</button>';
      fine += 'This was wrong moves ' + esc(w.name) + ' back to ' + Ida.LEVEL_NAME[down] + '.';
      if (wrongOpen === e.id) slot = '<div class="wrong"><b>Move ' + esc(w.name) + ' back to ' + Ida.LEVEL_NAME[down] + '?</b><p>' + DOWNMEANS[down] + ' until its record earns your trust again. Your rules stay as they are.</p>' +
        '<fieldset class="why"><legend>What was wrong? (optional)</legend>' + ['A fact', 'The person', 'The tone', 'It shouldn\'t have gone out'].map(function (r) { return '<label><input type="radio" name="why-' + e.id + '" value="' + esc(r) + '">' + esc(r) + '</label>'; }).join('') + '</fieldset>' +
        '<div class="wrong__row"><button class="ida-btn" type="button" data-confirm="' + e.id + '">Move it back to ' + Ida.LEVEL_NAME[down] + '</button><button class="ida-btn ida-btn--quiet" type="button" data-cancel="' + e.id + '">Cancel</button></div></div>';
    } else if (w && !down) fine += esc(w.name) + ' is in Practice, so nothing from it goes out.';
    var acts = '<div class="ent__acts">' + (canUndo ? '<button class="ida-btn" type="button" data-undo="' + e.id + '">Undo</button>' : '') + wrongBtn + '<small>' + fine + '</small></div>';
    return '<li class="ent' + (isOpen ? ' is-open' : '') + (e.undone ? ' is-undone' : '') + '" id="' + e.id + '" data-wf="' + esc(e.wf || '') + '" data-deal="' + esc(e.deal) + '" data-how="' + e.how + '">' +
      '<span class="ent__time">' + esc(e.t) + '</span>' +
      '<button class="ent__open" type="button" aria-expanded="' + isOpen + '" aria-controls="b-' + e.id + '" data-toggle="' + e.id + '"><span class="ent__to">' + esc(e.to) + '</span><span class="ent__subj">' + esc(e.subj) + '</span><span class="ent__meta">' + meta + '</span></button>' +
      '<span class="ent__side">' + side + '<button class="chev" type="button" tabindex="-1" aria-hidden="true" data-toggle="' + e.id + '">' + CHEV + '</button></span>' +
      '<div class="ent__body" id="b-' + e.id + '"' + (isOpen ? '' : ' hidden') + '><div class="ida-letter"><dl>' + dl + '</dl>' + e.body + '</div>' + src + acts + slot + '</div></li>';
  }
  var fwf = document.getElementById('f-wf'), fdeal = document.getElementById('f-deal');
  function options() {
    var s = S.get(), seen = {}, wfs = [], deals = [];
    s.sent.forEach(function (e) { var k = e.wf || ''; if (!(k in seen)) { seen[k] = 1; wfs.push(k); } if (deals.indexOf(e.deal) < 0) deals.push(e.deal); });
    var cur = fwf.value, curD = fdeal.value;
    fwf.innerHTML = '<option value="">All workflows</option>' + s.workflows.map(function (w) { return '<option value="' + w.id + '">' + esc(w.name) + '</option>'; }).join('') + wfs.filter(function (k) { return !Q.wf(k); }).map(function (k) { return '<option value="' + (k || '_you') + '">' + esc(wfName(k)) + '</option>'; }).join('');
    fdeal.innerHTML = '<option value="">All deals</option>' + deals.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('');
    fwf.value = cur; fdeal.value = curD;
  }
  function render() {
    var s = S.get();
    options();
    var log = document.getElementById('log');
    log.innerHTML = DAYS.map(function (d) {
      var items = s.sent.filter(function (e) { return e.day === d.id; }).map(row).join('');
      return '<section class="day" data-day="' + d.id + '"><h2>' + d.h + ' <span>' + d.sub + '</span></h2><ul>' + items + '</ul></section>';
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
      if (show && !li.closest('[data-day="q"]') && !li.classList.contains('is-undone')) { n++; if (li.dataset.how === 'own') own++; else appr++; }
    });
    document.querySelectorAll('.day').forEach(function (d) { var v = d.querySelectorAll('.ent:not([hidden])').length; d.hidden = !v; if (v) any = true; });
    document.getElementById('empty').hidden = any;
    document.getElementById('tally').innerHTML = '<b>' + n + ' sent</b><span>' + own + ' on their own</span><span>' + appr + ' you approved</span>';
    var name = fwf.value ? fwf.options[fwf.selectedIndex].text : '';
    document.querySelector('.ida-pagehead p').textContent = name ? 'Everything ' + name + ' sent for you, on its own or after you approved it.' : 'Every message Ida sent for you, on its own or after you approved it.';
  }
  function setUrl() { try { var q = []; if (fwf.value) q.push('wf=' + encodeURIComponent(fwf.value)); if (fdeal.value) q.push('deal=' + encodeURIComponent(fdeal.value)); history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '')); } catch (e) {} }
  fwf.addEventListener('change', function () { apply(); setUrl(); });
  fdeal.addEventListener('change', function () { apply(); setUrl(); });
  document.getElementById('clear').addEventListener('click', function () { fwf.value = ''; fdeal.value = ''; apply(); setUrl(); });

  document.getElementById('log').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return; var id;
    if ((id = b.getAttribute('data-toggle'))) { open[id] = !open[id]; var li = document.getElementById(id), body = document.getElementById('b-' + id); li.classList.toggle('is-open', open[id]); body.hidden = !open[id]; li.querySelector('.ent__open').setAttribute('aria-expanded', String(open[id])); return; }
    if ((id = b.getAttribute('data-undo'))) { var e0 = Q.wf && S.get().sent.filter(function (x) { return x.id === id; })[0]; A.sentUndo(id); ui.toast('<b>Undone.</b> ' + (e0.day === 'q' ? 'It won\'t go out.' : 'The invite is removed from every calendar.')); return; }
    if ((id = b.getAttribute('data-wrong'))) { wrongOpen = id; open[id] = true; render(); var c = document.querySelector('#' + id + ' [data-confirm]'); if (c) c.focus(); return; }
    if ((id = b.getAttribute('data-cancel'))) { wrongOpen = null; render(); return; }
    if ((id = b.getAttribute('data-confirm'))) { var r = document.querySelector('input[name="why-' + id + '"]:checked'); wrongOpen = null; A.sentWrong(id, r ? r.value : ''); return; }
    if ((id = b.getAttribute('data-unwrong'))) { A.sentUnwrong(id); return; }
    if ((id = b.getAttribute('data-correct'))) {
      var e = S.get().sent.filter(function (x) { return x.id === id; })[0], who = firstName(e.to), hi = who.split(' ')[0];
      A.addDecision({ kind: 'note', secs: 30, label: 'Approve · 30 sec', meta: e.deal + ' · correction to a message you marked wrong', q: 'Send a correction to ' + who + '?', tab: 'Correction to ' + who, tabSub: e.deal + ' · about "' + e.subj + '"',
        why: 'You marked "' + esc(e.subj) + '" as wrong. Ida drafted a short correction; change the wording before you approve.',
        head: [['To', e.to.split(' · ')[0]], ['Subject', 'Correction: ' + e.subj]],
        body: '<p>Hi ' + esc(hi) + ',</p><p>Please disregard my earlier message, "' + esc(e.subj) + '". Part of it wasn\'t right, and I\'ll follow up with the correct details shortly.</p><p>Sorry for the confusion,<br>Dana</p>',
        primary: 'Approve and send', fine: 'Nothing goes out until you approve, and you can undo for 10 seconds after.', toWho: who, doneLine: 'Sent a correction to ' + who + ' about "' + e.subj + '".',
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
})();
