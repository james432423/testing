/* Workflows: trust levels, nudges, pause/resume, move down, reconnect. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;

  function trust(level) {
    var c = level === 'practice' ? ['on cur', '', ''] : level === 'approve' ? ['on', 'on cur', ''] : ['on', 'on', 'on cur'];
    return '<ol class="ida-trust" aria-label="Trust level: ' + Ida.LEVEL_NAME[level] + '"><li class="' + c[0] + '"><span></span>Practice</li><li class="' + c[1] + '"><span></span>You approve</li><li class="' + c[2] + '"><span></span>On its own</li></ol>';
  }
  function article(w) {
    var p = Q.wfPause(w), chip;
    if (p && p.by === 'app') chip = '<span class="ida-chip ida-chip--problem">Problem · Paused</span>';
    else if (p) chip = '<span class="ida-chip">Paused</span>';
    else if (w.level === 'practice') chip = '<span class="ida-chip ida-chip--running">Practicing</span>';
    else chip = '<span class="ida-chip ida-chip--done">Running</span>';
    var exc = '';
    if (w.except) { var r = Q.rule(w.except.rule); exc = '<p class="ida-wf__exc"><span>Except</span><em>' + esc(w.except.text) + ' · <a href="rules.html#' + w.except.rule + '">your rule</a>' + (r && !r.on ? ' (turned off)' : '') + '</em></p>'; }
    var nudge = '';
    if (w.id === 'inspection' && w.nudge === 'open' && w.level === 'approve') nudge = '<p class="ida-nudge">You approved ' + w.approved + ' of ' + w.approved + ' buyer summaries. <button class="ida-link" type="button" data-promote="' + w.id + '">Let it send those on its own</button> <span>Repair requests still come to you.</span></p>';
    if (w.id === 'inspection' && w.nudge === 'accepted' && w.level === 'own') nudge = '<p class="ida-nudge">Buyer summaries now send on their own. Repair requests still come to you. <button class="ida-link" type="button" data-unpromote="' + w.id + '">Undo</button></p>';
    var rec = Q.wfRecord(w), last;
    if (p && p.by === 'app') last = '<small>Paused: ' + esc(p.text) + ' · <button class="ida-link" type="button" data-reconnect="' + p.app.id + '">' + (p.app.status === 'problem' ? 'Reconnect' : 'Connect') + '</button></small><small>' + esc(w.last) + '</small>';
    else if (w.level === 'practice') last = '<small>' + esc(w.last) + ' · <a href="practice.html?wf=' + w.id + '">' + (w.practice && w.practice.runs.length ? 'Compare the drafts' : 'See practice') + '</a></small>';
    else last = '<small>' + esc(w.last) + ' · <a href="sent.html?wf=' + w.id + '">See what it sent</a></small>';
    if (p && p.by === 'you') last = '<small>Paused by you. Nothing runs until you resume it.</small>' + last;
    return '<article class="ida-wf" id="' + w.id + '"><div class="ida-wf__main"><h2>' + esc(w.name) + '</h2><p class="ida-wf__trig"><span>When</span> ' + esc(w.when) + '</p><p class="ida-wf__does"><span>Ida</span> ' + esc(w.does) + '</p>' + exc + nudge + '</div>' +
      '<div class="ida-wf__side"><div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:8px">' + chip + '<span><button class="ida-btn ida-btn--quiet" type="button" data-menu="' + w.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="Options for ' + esc(w.name) + '">Options</button></span></div>' + trust(w.level) + '<small>' + esc(rec) + '</small>' + last + '</div></article>';
  }
  function render() {
    var s = S.get();
    document.getElementById('wflist').innerHTML = s.workflows.map(article).join('');
  }
  function menu(btn, id) {
    var w = Q.wf(id), p = Q.wfPause(w), items = [], down = Q.levelDown(w.level);
    if (p && p.by === 'app') items.push({ label: (p.app.status === 'problem' ? 'Reconnect ' : 'Connect ') + p.app.name, run: function () { reconnect(p.app.id); } });
    else if (w.paused) items.push({ label: 'Resume', run: function () { A.pause(id, false); ui.toast('<b>' + esc(w.name) + ' is running again.</b>'); } });
    else items.push({ label: 'Pause', run: function () { ui.withUndo('<b>Paused ' + esc(w.name) + '.</b> Nothing runs until you resume it.', function () { A.pause(id, true); }); } });
    if (down) items.push({ label: 'Move down to ' + Ida.LEVEL_NAME[down], run: function () { ui.withUndo('<b>' + esc(w.name) + ' moved to ' + Ida.LEVEL_NAME[down] + '.</b> ' + (down === 'approve' ? 'Ida asks before each one goes out.' : 'Ida drafts privately and sends nothing.'), function () { A.setLevel(id, down); }); } });
    if (w.level === 'practice') items.push({ label: 'See the practice drafts', run: function () { location.href = 'practice.html?wf=' + id; } });
    else items.push({ label: 'See what it sent', run: function () { location.href = 'sent.html?wf=' + id; } });
    items.push({ note: w.level === 'practice' ? 'Ida suggests You approve after 5 drafts in a row look right.' : 'Ida suggests moving up when its record earns it. You decide.' });
    ui.menu(btn, items);
  }
  function reconnect(appId, btn) {
    var a = Q.app(appId);
    var go = function () { A.connect(appId); ui.toast('<b>' + esc(a.name) + ' ' + (a.status === 'problem' ? 'reconnected' : 'connected') + '.</b> Workflows that use it are running again.'); };
    if (btn) ui.busy(btn, 'Connecting…', 800, go); else go();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var id;
    if ((id = b.getAttribute('data-menu'))) { e.stopPropagation(); return menu(b, id); }
    if ((id = b.getAttribute('data-promote'))) return ui.withUndo('<b>Buyer summaries now send on their own.</b> Repair requests still come to you.', function () { A.nudge(id, true); });
    if ((id = b.getAttribute('data-unpromote'))) return A.nudge(id, false);
    if ((id = b.getAttribute('data-reconnect'))) return reconnect(id, b);
    if (b.id === 'newtask') ui.addTaskForm({ who: 'ida', title: 'Hand Ida a new task', onAdd: function () {} });
  });
  S.subscribe(render);
  render();
  ui.highlightHash();
})();
