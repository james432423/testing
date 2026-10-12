/* Workflows (setup page): what Ida may do for each TYPE of client, and how much.
   One compact row per workflow inside each type section; details expand in place.
   Grouping is derived read-only from the store: playbook duties first, then the task
   that owns the workflow (its playbook, then its area). Live status lives on Being handled. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var LV = Ida.LEVELS || ['practice', 'approve', 'own'];
  var AREA_TYPE = { Leads: 'lead', Deals: 'buyer', Listings: 'seller' };
  var TYPE_ORDER = ['buyer', 'seller', 'lead'];
  var open = {};               /* expanded rows survive re-renders */

  /* ---------- Derived grouping ---------- */
  function groups(s) {
    var home = {}, also = {}, order = [];
    var sec = {};
    function section(key) {
      if (!sec[key]) {
        var pb = key === 'admin' ? null : Q.pbByType(key);
        sec[key] = { key: key, pb: pb, rows: [], also: [] };
      }
      return sec[key];
    }
    s.playbooks.forEach(function (pb) {
      pb.duties.forEach(function (du) {
        if (!du.wf) return; var w = Q.wf(du.wf); if (!w) return;
        if (!home[w.id]) { home[w.id] = pb.type; section(pb.type).rows.push(w); }
        else if (home[w.id] !== pb.type && !(also[pb.type + w.id])) { also[pb.type + w.id] = 1; section(pb.type).also.push(w); }
      });
    });
    s.workflows.forEach(function (w) {
      if (home[w.id]) return;
      var t = s.tasks.filter(function (x) { return x.wf === w.id; })[0], type = 'admin';
      if (t && t.pb) { var pb = Q.playbook(t.pb); if (pb) type = pb.type; }
      else if (t && AREA_TYPE[t.area] && Q.pbByType(AREA_TYPE[t.area])) type = AREA_TYPE[t.area];
      home[w.id] = type; section(type).rows.push(w);
    });
    TYPE_ORDER.concat(s.playbooks.map(function (pb) { return pb.type; })).concat(['admin']).forEach(function (k) { if (sec[k] && order.indexOf(sec[k]) < 0) order.push(sec[k]); });
    return { list: order, home: home, sec: sec };
  }
  function clientName(p) { if (/ and /.test(p.name)) { var last = p.name.split(' ').pop(); return 'the ' + last + (/s$/.test(last) ? 'es' : 's'); } return p.name; }
  function joinNames(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }
  function applies(pb) {
    var cov = Q.pbCovered(pb), names = cov.map(clientName), shown = names.length > 4 ? names.slice(0, 3).concat([(names.length - 3) + ' more']) : names;
    var lead = 'Applies to ' + cov.length + ' ' + (cov.length === 1 ? pb.one : pb.many) + (cov.length ? ': ' + joinNames(shown) : '') + '.';
    return esc(lead) + ' New ' + esc(pb.many) + ' get ' + (pb.status === 'paused' ? 'these once you resume.' : 'these automatically.');
  }
  function exceptions(pb) {
    var out = [];
    (pb.except || []).forEach(function (x) { var p = Q.person(x.person); if (p) out.push('<b>' + esc(clientName(p)) + '</b>: ' + esc(x.text.charAt(0).toLowerCase() + x.text.slice(1))); });
    (pb.excluded || []).forEach(function (id) { var p = Q.person(id); if (p) out.push('<b>' + esc(clientName(p)) + '</b>: not covered'); });
    Q.pbCovered(pb).forEach(function (p) { if (p.ida === 'you') out.push('<b>' + esc(clientName(p)) + '</b>: you\'re handling'); else if (p.ida === 'paused') out.push('<b>' + esc(clientName(p)) + '</b>: Ida paused'); });
    return out;
  }

  /* ---------- Suggestions (collected at the top) ---------- */
  function suggestions(s) {
    var out = [];
    s.workflows.forEach(function (w) {
      if (Q.wfPause(w)) return;
      if (w.id === 'inspection' && w.nudge === 'open' && w.level === 'approve')
        out.push('<li><p><b>' + esc(w.name) + '.</b> You approved ' + esc(String(w.approved)) + ' of ' + esc(String(w.approved)) + ' buyer summaries without changes to the facts. Let Ida send those on its own? Repair requests still come to you.</p><button class="ida-btn" type="button" data-promote="' + esc(w.id) + '">Let it send summaries on its own</button></li>');
      else if (w.id === 'inspection' && w.nudge === 'accepted' && w.level === 'own')
        out.push('<li><p><b>' + esc(w.name) + '.</b> Buyer summaries now send on their own. Repair requests still come to you.</p><button class="ida-btn ida-btn--quiet" type="button" data-unpromote="' + esc(w.id) + '">Undo</button></li>');
      else if (w.level === 'practice' && w.practice) {
        var right = w.practice.runs.filter(function (r) { return r.verdict === 'right'; }).length;
        if (right >= w.practice.need) out.push('<li><p><b>' + esc(w.name) + '.</b> ' + right + ' practice drafts in a row looked right. Move it to You approve? Nothing goes out until you tap Approve.</p><button class="ida-btn" type="button" data-level="approve" data-wf="' + esc(w.id) + '">Move to You approve</button></li>');
      }
    });
    return out;
  }

  /* ---------- One row ---------- */
  function trust(w) {
    var cur = LV.indexOf(w.level);
    return '<div class="wf-trust" role="group" aria-label="How much Ida does for ' + esc(w.name) + '">' + LV.map(function (l, i) {
      return '<button type="button" class="' + (i < cur ? 'on' : i === cur ? 'on cur' : '') + '" data-level="' + l + '" data-wf="' + esc(w.id) + '" aria-pressed="' + (i === cur) + '"><span aria-hidden="true"></span>' + esc(Ida.LEVEL_NAME[l]) + '</button>';
    }).join('') + '</div>';
  }
  function record(w, p) {
    var rec = esc(Q.wfRecord(w));
    var link = w.level === 'practice'
      ? '<a href="practice.html?wf=' + esc(w.id) + '">' + (w.practice && w.practice.runs.length ? 'Compare the drafts' : 'See practice') + '</a>'
      : '<a href="sent.html?wf=' + esc(w.id) + '">See what it sent</a>';
    var line = '<p class="wf-row__rec">' + (rec ? rec + ' · ' : '') + link + '</p>';
    if (p && p.by === 'app') line = '<p class="wf-row__prob">' + esc(p.app.name) + (p.app.status === 'problem' ? ' disconnected' : ' not connected') + ', so nothing runs. <button class="ida-link" type="button" data-reconnect="' + esc(p.app.id) + '">' + (p.app.status === 'problem' ? 'Reconnect' : 'Connect') + '</button></p>' + line;
    return line;
  }
  function details(w, p) {
    var r = w.except && Q.rule(w.except.rule);
    var apps = (w.apps || []).map(Q.app).filter(Boolean).map(function (a) { return esc(a.name); });
    return '<dl class="wf-row__dl">' +
      '<dt>When</dt><dd>' + esc(w.when) + '</dd>' +
      '<dt>Ida</dt><dd>' + esc(w.does) + '</dd>' +
      (w.except ? '<dt>Except</dt><dd>' + esc(w.except.text) + ' · <a href="rules.html#' + esc(w.except.rule) + '">your rule</a>' + (r && !r.on ? ' (turned off)' : '') + '</dd>' : '') +
      (apps.length ? '<dt>Uses</dt><dd>' + apps.join(', ') + '</dd>' : '') +
      (p && p.by === 'you' ? '<dt>Paused</dt><dd>By you. Nothing runs until you resume it.</dd>' : '') +
      '</dl>';
  }
  function row(w) {
    var p = Q.wfPause(w), isOpen = !!open[w.id];
    var chip = p ? '<span class="ida-chip' + (p.by === 'app' ? ' ida-chip--problem' : '') + '">' + (p.by === 'app' ? 'Problem · Paused' : 'Paused') + '</span>' : '';
    return '<li class="wf-row' + (p ? ' is-paused' : '') + '" id="' + esc(w.id) + '">' +
      '<div class="wf-row__top"><button class="wf-row__name" type="button" data-wf-toggle="' + esc(w.id) + '" aria-expanded="' + isOpen + '" aria-controls="wfd-' + esc(w.id) + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>' + esc(w.name) + '</button>' + chip +
      '<span class="wf-row__opt"><button class="ida-btn ida-btn--quiet" type="button" data-menu="' + esc(w.id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="Options for ' + esc(w.name) + '">Options</button></span></div>' +
      '<div class="wf-row__mid">' + trust(w) + record(w, p) + '</div>' +
      '<div class="wf-row__more" id="wfd-' + esc(w.id) + '"' + (isOpen ? '' : ' hidden') + '>' + details(w, p) + '</div></li>';
  }

  /* ---------- Page ---------- */
  function render() {
    var s = S.get(), g = groups(s), ws = s.workflows;
    var n = { own: 0, approve: 0, practice: 0 }, paused = 0;
    ws.forEach(function (w) { n[w.level] = (n[w.level] || 0) + 1; if (Q.wfPause(w)) paused++; });
    var bits = [ws.length + ' workflow' + (ws.length === 1 ? '' : 's')];
    if (n.own) bits.push(n.own + ' on their own'); if (n.approve) bits.push(n.approve + ' you approve'); if (n.practice) bits.push(n.practice + ' practicing');
    if (paused) bits.push(paused + ' paused');
    var html = '<p class="wf-sum" id="wfsum"><b>' + esc(bits.join(' · ')) + '</b><span>What\'s running right now is on <a href="handled.html">Being handled</a>.</span></p>';
    var sug = suggestions(s);
    if (sug.length) html += '<section class="wf-sug" aria-labelledby="wf-sug-h"><h2 id="wf-sug-h">Ida suggests</h2><ul>' + sug.join('') + '</ul></section>';
    g.list.forEach(function (sec) {
      var pb = sec.pb, id = 'wg-' + esc(sec.key), exc = pb ? exceptions(pb) : [];
      var head = pb
        ? '<h2 id="' + id + '">' + esc(pb.name) + (pb.status === 'paused' ? ' <span class="ida-chip">Paused</span>' : '') + '</h2><p class="wf-type__applies">' + applies(pb) + '</p>' +
          (exc.length ? '<p class="wf-type__exc"><span>Except</span> ' + exc.join('; ') + '</p>' : '')
        : '<h2 id="' + id + '">Admin</h2><p class="wf-type__applies">Your own back-office work, not tied to a type of client.</p>';
      html += '<section class="wf-type" aria-labelledby="' + id + '"><div class="wf-type__h">' + head + '</div><ul class="wf-rows">' + sec.rows.map(row).join('') + '</ul>' +
        sec.also.map(function (w) { var h = g.sec[g.home[w.id]]; return '<p class="wf-type__also">Also uses <a href="#' + esc(w.id) + '" data-jump="' + esc(w.id) + '">' + esc(w.name) + '</a>, set once under ' + esc(h && h.pb ? h.pb.name : 'Admin') + '.</p>'; }).join('') + '</section>';
    });
    document.getElementById('wflist').innerHTML = html;
  }

  /* ---------- Actions (all through the store) ---------- */
  function setLevel(id, to) {
    var w = Q.wf(id); if (!w || w.level === to || LV.indexOf(to) < 0) return;
    if (w.id === 'inspection' && w.level === 'approve' && to === 'own') return promote(id);
    var up = LV.indexOf(to) > LV.indexOf(w.level);
    var what = to === 'own' ? 'Ida acts and tells you after.' : to === 'approve' ? 'Ida asks before each one goes out.' : 'Ida drafts privately and sends nothing.';
    ui.withUndo('<b>' + esc(w.name) + ' moved ' + (up ? 'up' : '') + ' to ' + esc(Ida.LEVEL_NAME[to]) + '.</b> ' + what, function () { A.setLevel(id, to); });
  }
  function promote(id) { ui.withUndo('<b>Buyer summaries now send on their own.</b> Repair requests still come to you.', function () { A.nudge(id, true); }); }
  function menu(btn, id) {
    var w = Q.wf(id), p = Q.wfPause(w), items = [], down = Q.levelDown(w.level);
    if (p && p.by === 'app') items.push({ label: (p.app.status === 'problem' ? 'Reconnect ' : 'Connect ') + p.app.name, run: function () { reconnect(p.app.id); } });
    else if (w.paused) items.push({ label: 'Resume', run: function () { A.pause(id, false); ui.toast('<b>' + esc(w.name) + ' is running again.</b>'); } });
    else items.push({ label: 'Pause', run: function () { ui.withUndo('<b>Paused ' + esc(w.name) + '.</b> Nothing runs until you resume it.', function () { A.pause(id, true); }); } });
    if (down) items.push({ label: 'Move down to ' + Ida.LEVEL_NAME[down], run: function () { setLevel(id, down); } });
    if (w.level === 'practice') items.push({ label: 'See the practice drafts', run: function () { location.href = 'practice.html?wf=' + encodeURIComponent(id); } });
    else items.push({ label: 'See what it sent', run: function () { location.href = 'sent.html?wf=' + encodeURIComponent(id); } });
    items.push({ note: w.level === 'practice' ? 'Ida suggests You approve after 5 drafts in a row look right.' : 'Ida suggests moving up when its record earns it. You decide.' });
    ui.menu(btn, items);
  }
  function reconnect(appId, btn) {
    var a = Q.app(appId); if (!a) return; var name = a.name, was = a.status;
    var go = function () { A.connect(appId); ui.toast('<b>' + esc(name) + ' ' + (was === 'problem' ? 'reconnected' : 'connected') + '.</b> Workflows that use it are running again.'); };
    if (btn) ui.busy(btn, 'Connecting…', 800, go); else go();
  }
  function toggle(id, force) {
    open[id] = force === undefined ? !open[id] : force;
    var b = document.querySelector('[data-wf-toggle="' + CSS.escape(id) + '"]'), d = document.getElementById('wfd-' + id);
    if (b) b.setAttribute('aria-expanded', String(!!open[id])); if (d) d.hidden = !open[id];
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-jump]');
    if (a) { e.preventDefault(); var jid = a.getAttribute('data-jump'); toggle(jid, true); ui.highlight(document.getElementById(jid)); return; }
    var b = e.target.closest('button'); if (!b || !document.getElementById('wflist').contains(b) && b.id !== 'newtask') return; var id;
    if ((id = b.getAttribute('data-menu'))) { e.stopPropagation(); return menu(b, id); }
    if ((id = b.getAttribute('data-wf-toggle'))) return toggle(id);
    if ((id = b.getAttribute('data-level'))) return setLevel(b.getAttribute('data-wf'), id);
    if ((id = b.getAttribute('data-promote'))) return promote(id);
    if ((id = b.getAttribute('data-unpromote'))) return A.nudge(id, false);
    if ((id = b.getAttribute('data-reconnect'))) return reconnect(id, b);
    if (b.id === 'newtask') ui.addTaskForm({ who: 'ida', title: 'Hand Ida a new task', onAdd: function () {} });
  });
  /* A link like workflows.html#inspection opens that row. */
  function openHash() { var h = location.hash.slice(1); try { h = decodeURIComponent(h); } catch (e) { return; } if (h && Q.wf(h)) toggle(h, true); }
  window.addEventListener('hashchange', function () { openHash(); ui.highlightHash(); });
  S.subscribe(render);
  render();
  openHash();
  ui.highlightHash();
})();
