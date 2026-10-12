/* Tasks: the board, add a task, hand to Ida, and a detail side panel. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var COLS = [['auto', 'Ida does it', 'Runs on its own; you see every run', 'sq sq--auto'], ['approve', 'You approve', 'Ida drafts, you tap Approve', 'sq sq--approve'], ['yours', 'Still yours', '', 'sq']];
  var openTask = null;

  function trust(level) {
    var c = level === 'practice' ? ['on cur', '', ''] : level === 'approve' ? ['on', 'on cur', ''] : level === 'own' ? ['on', 'on', 'on cur'] : ['', '', ''];
    return '<ol class="ida-trust" aria-label="Trust level: ' + Ida.LEVEL_NAME[level] + '"><li class="' + c[0] + '"><span></span>Practice</li><li class="' + c[1] + '"><span></span>You approve</li><li class="' + c[2] + '"><span></span>On its own</li></ol>';
  }
  function item(t) {
    var note = Q.taskNote(t), l = Q.taskLevel(t), extra = '';
    var noteHtml = typeof note === 'object' ? (note.problem ? '<span class="ida-problem-text">Problem · ' + esc(note.text) + '</span>' : esc(note.text)) : esc(note);
    if (Q.canHand(t)) {
      extra = Q.handReady(t) ? '<button class="ida-handoff" type="button" data-hand="' + esc(t.id) + '">Hand to Ida</button>'
        : '<a class="ida-handoff" href="apps.html#app-' + esc(t.needsApp) + '" style="display:inline-flex;align-items:center;text-decoration:none">Connect ' + esc(Q.app(t.needsApp).name) + ' to hand this over</a>';
    }
    if (l === 'practice') extra = '<a class="ida-handoff" href="practice.html?wf=' + esc(t.wf) + '" style="display:inline-flex;align-items:center;text-decoration:none">See the practice drafts</a>';
    return '<div class="ida-board__item" id="' + esc(t.id) + '"><button class="ida-taskopen" type="button" data-open="' + esc(t.id) + '"><b>' + esc(t.name) + '</b><small>' + esc(t.area) + (t.pb && Q.playbook(t.pb) ? ' · ' + esc(Q.playbook(t.pb).name) + ' playbook' : '') + (noteHtml ? ' · ' + noteHtml : '') + '</small></button>' + extra + '</div>';
  }
  function render() {
    var s = S.get(), c = Q.counts();
    var sq = '';
    for (var i = 0; i < c.auto; i++) sq += '<i class="sq sq--auto"></i>';
    for (i = 0; i < c.approve; i++) sq += '<i class="sq sq--approve"></i>';
    s.tasks.forEach(function (t) { if (Q.taskLevel(t) === 'practice') sq += '<i class="sq sq--could"></i>'; });
    s.tasks.forEach(function (t) { if (Q.taskLevel(t) === 'yours') sq += '<i class="sq"></i>'; });
    document.getElementById('platebar').innerHTML = '<div class="ida-platebar__sq" aria-hidden="true">' + sq + '</div><p><b>' + c.off + ' of ' + c.total + '</b> off your plate · about ' + c.hours + ' hours back this week</p>';
    document.getElementById('board').innerHTML = COLS.map(function (col) {
      var list = s.tasks.filter(function (t) { return Q.taskCol(t) === col[0]; });
      if (col[0] === 'yours') list.sort(function (a, b) { var r = function (t) { return Q.taskLevel(t) === 'practice' ? 1 : Q.canHand(t) ? 0 : 2; }; return r(a) - r(b); });
      var sub = col[2] || (c.could ? 'Ida could take ' + c.could + ' of these' : 'Nothing here Ida could take yet');
      return '<section class="ida-board__col"' + (col[0] === 'yours' ? ' id="could"' : '') + '><h2><i class="' + col[3] + '"></i>' + col[1] + '<span class="ida-board__n">' + list.length + '</span></h2><p class="ida-board__sub">' + sub + '</p>' + list.map(item).join('') + '</section>';
    }).join('');
    if (openTask && ui.drawerOpen()) detail(openTask, true);
  }
  function detail(id, keep) {
    var t = Q.task(id); if (!t) return; openTask = id;
    var l = Q.taskLevel(t), w = t.wf && Q.wf(t.wf), note = Q.taskNote(t);
    var noteText = typeof note === 'object' ? note.text : note;
    var acts = '';
    if (Q.canHand(t)) acts += Q.handReady(t) ? '<button class="ida-btn" type="button" data-hand="' + esc(t.id) + '">Hand to Ida</button>' : '<a class="ida-btn" href="apps.html#app-' + esc(t.needsApp) + '">Connect ' + esc(Q.app(t.needsApp).name) + '</a>';
    if (l === 'practice') acts += '<a class="ida-btn" href="practice.html?wf=' + esc(t.wf) + '">See the practice drafts</a>';
    if (w) acts += '<a class="ida-btn ida-btn--quiet" href="workflows.html#' + esc(w.id) + '">Open the workflow</a>';
    if (w && w.created) acts += '<button class="ida-btn ida-btn--quiet" type="button" data-takeback="' + esc(t.id) + '">Take it back</button>';
    var who = l === 'yours' ? (t.keep ? 'You. Best kept by you.' : 'You, for now') : Ida.LEVEL_NAME[l] + (l === 'practice' ? ': Ida drafts privately, nothing is sent' : l === 'approve' ? ': Ida drafts, you tap Approve' : ': Ida acts and tells you after');
    var html = '<dl class="ida-kv">' +
      '<div><dt>What</dt><dd>' + esc(t.name) + '</dd></div>' +
      '<div><dt>Area</dt><dd>' + esc(t.area) + '</dd></div>' +
      (t.pb && Q.playbook(t.pb) ? '<div><dt>Playbook</dt><dd><a href="handled.html#' + esc(t.pb) + '">' + esc(Q.playbook(t.pb).name) + '</a>, for every ' + esc(Q.playbook(t.pb).one) + '</dd></div>' : '') +
      '<div><dt>Who does it</dt><dd>' + esc(who) + (l !== 'yours' ? trust(l) : '') + '</dd></div>' +
      '<div><dt>Record</dt><dd>' + esc([noteText, w ? Q.wfRecord(w) : ''].filter(Boolean).join(' · ') || 'Nothing yet') + '</dd></div>' +
      '<div><dt>Workflow</dt><dd>' + (w ? '<a href="workflows.html#' + esc(w.id) + '">' + esc(w.name) + '</a> · ' + esc(w.when) : t.keep ? 'None. Ida leaves this to you.' : l === 'yours' ? 'None yet. Hand it to Ida to start one in practice.' : 'Runs as part of Ida\'s weekly routine') + '</dd></div>' +
      (t.hours ? '<div><dt>Time it takes you</dt><dd>About ' + Math.round(t.hours * 60) + ' minutes a week</dd></div>' : '') +
      '</dl><div class="ida-row-acts">' + acts + '</div>';
    if (keep) { var m = document.querySelector('.ida-drawer__body'); if (m) { m.innerHTML = html; return; } }
    ui.openDrawer({ title: t.name, sub: t.area + ' · ' + (l === 'yours' ? 'Still yours' : Ida.LEVEL_NAME[l]), html: html });
  }
  function hand(id) {
    var t = Q.task(id);
    ui.withUndo('<b>Handed to Ida.</b> It starts in practice: drafts privately, sends nothing.', function () { A.hand(id); });
    var el = document.getElementById(id); if (el) ui.highlight(el);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var id;
    if ((id = b.getAttribute('data-hand'))) return hand(id);
    if ((id = b.getAttribute('data-open'))) return detail(id);
    if ((id = b.getAttribute('data-takeback'))) { ui.withUndo('<b>Taken back.</b> It\'s yours again, and its practice workflow is gone.', function () { A.takeBack(id); }); return; }
    if (b.id === 'addtask-btn') { openTask = null; ui.addTaskForm({ onAdd: function (nid) { setTimeout(function () { var el = document.getElementById(nid); if (el) el.scrollIntoView({ block: 'nearest' }); }, 30); } }); }
  });
  S.subscribe(render);
  render();
  ui.highlightHash();
  if (/[?&]add=1/.test(location.search)) { openTask = null; ui.addTaskForm(); }
})();
