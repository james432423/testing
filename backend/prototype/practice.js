/* Practice: Ida's private draft next to what you sent. The verdict updates the
   workflow's practice record in the store. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var m = location.search.match(/[?&]wf=([^&]+)/);
  var wfId = m ? decodeURIComponent(m[1]) : 'appraisal';
  if (!Q.wf(wfId)) wfId = 'appraisal';
  var TICK = Ida.TICK, reasonsOpen = false;

  function stats(w) {
    var runs = (w.practice && w.practice.runs) || [], decided = runs.filter(function (r) { return r.verdict; });
    var right = decided.filter(function (r) { return r.verdict === 'right'; }).length, streak = 0;
    for (var i = decided.length - 1; i >= 0 && decided[i].verdict === 'right'; i--) streak++;
    return { runs: runs, decided: decided.length, right: right, streak: streak, need: (w.practice && w.practice.need) || 5, cur: runs.filter(function (r) { return r.current; })[0] };
  }
  function render() {
    var w = Q.wf(wfId), st = stats(w), isApp = wfId === 'appraisal';
    document.title = 'Ida · ' + w.name + ' practice (design mock)';
    document.getElementById('crumb').innerHTML = '<a href="workflows.html#' + w.id + '">Workflows</a> / ' + esc(w.name) + ' · ' + esc(Ida.LEVEL_NAME[w.level]);
    ['ctx', 'cmp', 'diffs', 'verdict'].forEach(function (id) { document.getElementById(id).hidden = !isApp || !st.cur; });
    if (!isApp || !st.cur) {
      document.getElementById('ph1').textContent = 'Ida is practicing ' + w.name.charAt(0).toLowerCase() + w.name.slice(1);
      document.getElementById('pp').textContent = 'Nothing is sent while it practices. The next time this comes up, Ida drafts it privately and puts it here next to what you did.';
    }
    var line;
    if (!st.runs.length) line = 'No practice drafts yet. ' + w.when + ', Ida drafts one here.';
    else if (st.cur && !st.cur.verdict) line = (st.need - st.streak) + ' more before Ida suggests You approve. Ida needs ' + st.need + ' in a row to look right.';
    else if (st.cur && st.cur.verdict === 'not') line = 'The count starts over: ' + st.need + ' more in a row before Ida suggests You approve. Next time Ida will recommend one option.';
    else line = (st.need - st.streak) + ' more before Ida suggests You approve.';
    if (st.streak >= st.need && w.level === 'practice') line = 'Ida suggests moving ' + w.name + ' to You approve.';
    var slots = '';
    for (var i = 0; i < st.need; i++) {
      var r = st.runs[i];
      if (!r) slots += '<li aria-label="Run ' + (i + 1) + '">' + (i + 1) + '</li>';
      else if (r.verdict === 'right') slots += '<li class="ok" aria-label="Run ' + (i + 1) + ' looked right">' + TICK + '</li>';
      else if (r.verdict === 'not') slots += '<li class="miss" aria-label="Run ' + (i + 1) + ' not like you">Not</li>';
      else slots += '<li class="now" aria-label="Run ' + (i + 1) + ', waiting for you">' + (i + 1) + '</li>';
    }
    document.getElementById('rec').innerHTML = '<div class="rec__sum"><h2 class="h">Practice record</h2><div><span class="rec__big">' + st.right + ' of ' + st.decided + '</span><span class="rec__of">looked right</span></div><p class="muted">' + esc(line) + '</p>' +
      (st.streak >= st.need && w.level === 'practice' ? '<button class="ida-btn" type="button" data-promote style="justify-self:start;margin-top:8px">Move to You approve</button>' : '') + '</div>' +
      '<ol class="rec__steps" aria-label="Practice runs">' + slots + '</ol>' +
      '<ul class="rec__runs">' + (st.runs.length ? st.runs.map(function (r) { return '<li><span>' + esc(r.deal) + '<small>' + esc(r.detail) + '</small></span><small>' + esc(r.date) + ' · ' + (r.verdict === 'right' ? 'Looked right' : r.verdict === 'not' ? 'Not like you' : 'Waiting for you') + '</small></li>'; }).join('') : '<li><span>No runs yet<small>Ida starts on the next one</small></span><small></small></li>') + '</ul>';
    var v = document.getElementById('vbtns'), saved = document.getElementById('saved'), reason = document.getElementById('reason');
    if (st.cur && st.cur.verdict) {
      v.hidden = true; reason.hidden = true; saved.hidden = false;
      saved.innerHTML = st.cur.verdict === 'right'
        ? '<div class="saved" role="status">' + TICK + '<span>Saved: looked right. ' + st.right + ' of ' + st.decided + ' so far.</span><button class="ida-btn ida-btn--quiet" type="button" data-undo>Undo</button></div>'
        : '<div class="saved" role="status"><span>Saved: not like you. Ida will recommend one option next time, the way you did.' + (st.cur.reasons && st.cur.reasons.length ? ' Your reasons: ' + esc(st.cur.reasons.join(', ').toLowerCase()) + '.' : '') + '</span><button class="ida-btn ida-btn--quiet" type="button" data-undo>Undo</button></div>';
    } else {
      v.hidden = false; saved.hidden = true; reason.hidden = !reasonsOpen;
      v.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(reasonsOpen && b.dataset.v === 'not')); });
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v === 'right') { reasonsOpen = false; A.verdict(wfId, 'right'); return; }
    if (b.dataset.v === 'not') { reasonsOpen = !reasonsOpen; render(); var i = document.querySelector('#reason input'); if (i) i.focus(); return; }
    if (b.id === 'cancel') { reasonsOpen = false; render(); return; }
    if (b.hasAttribute('data-undo')) { A.verdict(wfId, null); return; }
    if (b.hasAttribute('data-promote')) { A.setLevel(wfId, 'approve'); ui.toast('<b>' + esc(Q.wf(wfId).name) + ' moved to You approve.</b> Nothing goes out until you tap Approve.'); }
  });
  document.getElementById('reason').addEventListener('submit', function (e) {
    e.preventDefault();
    var rs = []; this.querySelectorAll('input[type="checkbox"]:checked').forEach(function (c) { rs.push(c.parentNode.textContent.trim()); });
    var note = this.querySelector('textarea').value.trim(); if (note) rs.push(note);
    reasonsOpen = false; A.verdict(wfId, 'not', rs);
  });
  var cite = document.querySelector('.ida-cite'), src = document.getElementById('src');
  function t() { var o = cite.getAttribute('aria-expanded') === 'true'; cite.setAttribute('aria-expanded', String(!o)); src.hidden = o; }
  if (cite) { cite.addEventListener('click', t); cite.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); }
  S.subscribe(render);
  render();
})();
