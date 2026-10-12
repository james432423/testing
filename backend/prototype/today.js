/* Today: renders the decision pile, fixes, insight, logs and Your work from the store. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var CIRCLE = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M27 5.5C17 2.5 5.5 8 5 19.5S13.5 36 22.5 35s13.2-8.5 12-17.5C33.6 10.5 27.5 6 19 7.2"/></svg>';
  var CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
  var EXT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5c2 1.2 3.6 3 4.8 5.2C11.6 12 15.4 7.2 20.5 4.2"/></svg>';
  var editing = null, editBuf = null, recent = null, recentTimer, srcClosed = {};

  function circle(n, sm) { return '<span class="ida-circle' + (sm ? ' sm' : '') + '" aria-label="Item ' + n + '">' + n + CIRCLE + '</span>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function greet(s, fixes, open) {
    var n = fixes.length + open.length, secs = fixes.length * 30 + open.reduce(function (a, d) { return a + (d.secs || 60); }, 0);
    var c = Q.counts(), el = document.getElementById('greet');
    var parts = []; if (fixes.length) parts.push(plural(fixes.length, 'fix', 'fixes')); if (open.length) parts.push(plural(open.length, 'decision', 'decisions'));
    var mins = secs < 60 ? 'Under a minute' : 'About ' + plural(Math.round(secs / 60), 'minute', 'minutes');
    el.innerHTML = n
      ? '<h1>' + n + (n === 1 ? ' thing needs you' : ' things need you') + '</h1><p>' + mins + ', Dana. ' + parts.join(' and ') + '; everything else is handled.</p>'
      : '<h1>Nothing needs you right now</h1><p>Everything else is handled, Dana. Ida puts anything that needs you here.</p>';
    el.innerHTML += '<a class="mini" href="tasks.html">' + c.off + ' of ' + c.total + ' tasks off your plate</a>';
    document.title = (n ? '(' + n + ') ' : '') + 'Ida · Today (design mock)';
  }

  function srcCard(d) {
    var doc = Ida.DOCS[d.doc]; if (!doc) return '';
    var full = doc.href || ('doc.html?d=' + d.doc);
    return '<div class="ida-source ida-source--card" id="src-' + d.id + '"' + (srcClosed[d.id] ? ' hidden' : '') + '><div class="ida-source__doc"><span class="ida-source__icon" aria-hidden="true">' + doc.icon + '</span><span><b>' + esc(doc.title) + '</b><small>' + esc(doc.who) + ' · ' + esc(d.srcLabel || '') + '</small></span></div><blockquote>' + d.quote + '</blockquote><a class="ida-source__link" href="' + full + '" data-doc="' + d.doc + '" data-doc-note="Check the highlight, then approve or edit on the card.">' + esc(d.link) + EXT + '</a></div>';
  }
  function bodyHtml(d) {
    var b = editing === d.id && editBuf != null ? editBuf : d.body;
    if (d.doc) b = b.replace('<span class="ida-marker" data-cite>', '<span role="button" tabindex="0" class="ida-marker ida-cite" aria-expanded="' + (srcClosed[d.id] ? 'false' : 'true') + '" aria-controls="src-' + d.id + '" data-cite>');
    return b;
  }
  function card(d, n, pos, total) {
    var ed = editing === d.id;
    return '<article class="ida-pile__card" id="dec-' + d.id + '" data-dec="' + d.id + '">' +
      '<header class="ida-pile__head">' + circle(n, true) + '<span>' + esc(d.label) + '</span><span class="ida-pile__pos">Decision ' + pos + ' of ' + total + '</span></header>' +
      '<article class="ida-decision"><span class="ida-decision__meta">' + esc(d.meta) + '</span><h2 class="ida-decision__q">' + esc(d.q) + '</h2>' +
      (d.why ? '<p class="ida-decision__why">' + d.why + '</p>' : '') +
      '<div class="ida-letter"><dl>' + d.head.map(function (h) { return '<dt>' + esc(h[0]) + '</dt><dd>' + esc(h[1]) + '</dd>'; }).join('') + '</dl><div class="ida-letter__body"' + (ed ? ' contenteditable="true" aria-label="Edit the draft"' : '') + '>' + bodyHtml(d) + '</div></div>' +
      srcCard(d) +
      '<div class="ida-decision__actions"><button class="ida-btn ida-btn--primary" type="button" data-approve="' + d.id + '">' + CHECK + esc(d.primary) + '</button>' +
      '<button class="ida-btn" type="button" data-edit="' + d.id + '">' + (ed ? 'Done editing' : 'Edit first') + '</button>' +
      '<button class="ida-btn ida-btn--quiet" type="button" data-later="' + d.id + '">Not now</button></div>' +
      '<span class="ida-decision__fine">' + esc(d.fine) + (d.edited ? ' Your edits are saved.' : '') + '</span></article></article>';
  }
  function tab(d, n, first) {
    var quick = d.kind === 'ask' ? '<span class="ida-chip ida-chip--attention">Needs you</span><button class="ida-btn" type="button" data-quick="' + d.id + '">' + esc(d.primary) + '</button>' : '';
    return '<div class="ida-pile__tab" role="group" aria-label="' + (first ? 'Up next' : 'After that') + '" data-dec="' + d.id + '">' + circle(n, true).replace('aria-label="Item ' + n + '"', 'aria-hidden="true"') +
      '<span class="ida-pile__t"><span class="ida-pile__up">' + (first ? 'Up next' : 'After that') + ' · ' + esc(d.label) + '</span><b>' + esc(d.tab) + '</b><small>' + esc(d.tabSub) + '</small></span>' +
      '<span class="ida-pile__acts">' + quick + '<button class="ida-pile__open" type="button" data-open="' + d.id + '" aria-label="Open this decision: ' + esc(d.tab) + '">' + CHEV + '</button></span></div>';
  }

  function nextUp(s) {
    var L = [];
    s.workflows.forEach(function (w) { if (w.next && !Q.wfPause(w) && w.level !== 'practice') L.push([w.next.split(' · ')[0], w.next.split(' · ').slice(1).join(' · ') + ' (' + w.name + ')']); });
    s.upcoming.forEach(function (u) { if (u.from) L.push([u.day + ' ' + u.time, u.text]); });
    if (Q.wf('appraisal') && Q.wf('appraisal').level === 'practice') L.push(['Next appraisal', 'Practice draft for Appraisal check, kept private']);
    return L.slice(0, 5);
  }

  function insight(s) {
    var st = s.insight.status;
    if (st === 'sent') return '<div><span class="k">Worth a look · 17 Ash St</span><div class="sent ida-notice" role="status" style="margin-top:8px">' + Ida.TICK + '<span><b>Sent to Luis and Ana Garcia.</b> Price review with the comparison attached.</span><a href="sent.html">See it in Sent by Ida</a></div></div>';
    if (st === 'draft') return '<div><span class="k">Draft · price-review note · 17 Ash St</span><h3>Send the price review to the Garcias?</h3><div class="ida-letter" style="background:var(--paper-raised)"><dl><dt>To</dt><dd>Luis and Ana Garcia</dd><dt>Subject</dt><dd>17 Ash St: showings and nearby prices</dd><dt>Attached</dt><dd>Price comparison (3 homes)</dd></dl><p>Hi Luis and Ana,</p><p>Showings at 17 Ash St went from 9 a week to 3 over the last month. In the same weeks, <span class="ida-marker" role="button" tabindex="0" data-doc="comps-ash">two similar homes within half a mile cut their price by about 4%</span>, and both picked up showings again. I\'ve attached the comparison.</p><p>Could we talk this week about whether to adjust the price? I have time Wednesday or Thursday afternoon.</p><p>Dana</p></div><p style="margin:12px 0 0;font-size:13px;color:var(--ink-muted)">Ida doesn\'t suggest a new price. <a href="rules.html#r-price" style="color:var(--ink)">Your rule</a>: always ask before quoting a price.</p><div class="ida-decision__actions" style="margin-top:12px"><button class="ida-btn" type="button" data-insight="send">Approve and send</button><button class="ida-btn ida-btn--quiet" type="button" data-doc="comps-ash">See the comparison</button><button class="ida-btn ida-btn--quiet" type="button" data-insight="open">Not now</button></div></div>';
    return '<div><span class="k">Worth a look · 17 Ash St</span><h3>Showings dropped from 9 to 3 in a month</h3><div class="chart" role="img" aria-label="Showings per week: 9, 7, 5, 3"><div class="bars"><div><b>9</b><i style="height:72px"></i></div><div><b>7</b><i style="height:56px"></i></div><div><b>5</b><i style="height:40px"></i></div><div><b>3</b><i style="height:24px"></i></div></div><div class="wk"><span>Sep 14</span><span>Sep 21</span><span>Sep 28</span><span>Oct 5</span></div><small>Showings per week</small></div><p>Two similar homes within half a mile cut their price by about 4% in the last two weeks. Ida can draft a price-review note for the Garcias with the comparison attached.</p><div class="ida-decision__actions"><button class="ida-btn" type="button" data-insight="draft">Draft the note</button><button class="ida-btn ida-btn--quiet" type="button" data-doc="comps-ash" data-doc-note="Similar homes within half a mile, last 30 days.">See the comparison</button></div></div>';
  }

  function plate(s) {
    var c = Q.counts(), el = document.getElementById('work');
    el.setAttribute('aria-label', c.off + ' of ' + c.total + ' recurring tasks are off your plate');
    var rows = c.order.map(function (a) {
      var x = c.areas[a], sq = '';
      for (var i = 0; i < x.auto; i++) sq += '<span class="sq sq--auto"></span>';
      for (i = 0; i < x.approve; i++) sq += '<span class="sq sq--approve"></span>';
      for (i = 0; i < x.practice; i++) sq += '<span class="sq sq--could"></span>';
      for (i = 0; i < x.yours; i++) sq += '<span class="sq"></span>';
      return '<div class="ida-plate__row"><span>' + esc(a) + ' <small>' + (x.auto + x.approve) + '/' + x.total + '</small></span><div class="ida-plate__sq">' + sq + '</div></div>';
    }).join('');
    var running = s.workflows.filter(function (w) { return !Q.wfPause(w); }).length;
    var paused = s.workflows.filter(function (w) { return Q.wfPause(w); });
    var hasPractice = c.order.some(function (a) { return c.areas[a].practice; });
    el.innerHTML = '<h2 class="h">Your work</h2><div class="ida-plate__head"><span class="ida-plate__big">' + c.off + ' of ' + c.total + '</span><span class="ida-plate__of">tasks off your plate</span></div>' +
      '<span class="ida-plate__sub">About ' + plural(c.hours, 'hour', 'hours') + ' back this week</span><span class="ida-plate__sub">6 decisions for you this week, down from 11</span>' +
      '<div class="ida-plate__rows">' + rows + '</div>' +
      '<div class="ida-plate__key"><span><i class="sq sq--auto"></i>Ida does it</span><span><i class="sq sq--approve"></i>You approve</span>' + (hasPractice ? '<span><i class="sq sq--could"></i>Practicing</span>' : '') + '<span><i class="sq"></i>Still yours</span></div>' +
      (c.could ? '<a class="ida-btn ida-btn--quiet" href="tasks.html#could">See ' + plural(c.could, 'task', 'tasks') + ' Ida could take</a>' : '<a class="ida-btn ida-btn--quiet" href="tasks.html">See all tasks</a>') +
      '<div class="wfline"><span class="ida-chip ida-chip--done">Running</span> ' + plural(running, 'workflow', 'workflows') +
      paused.map(function (w) { var p = Q.wfPause(w); return ' · ' + (p.by === 'app' ? '<span class="ida-chip ida-chip--problem">Problem · Paused</span> ' + esc(w.name) + ', until ' + esc(p.app.name) + ' is reconnected' : '<span class="ida-chip">Paused</span> ' + esc(w.name) + ', by you'); }).join('') +
      ' · <a href="workflows.html" style="color:var(--ink)">Workflows</a></div>';
  }

  function timeBack() {
    var c = Q.counts(), el = document.getElementById('timeback'); if (!el) return;
    var h = Math.round(c.hours * 2) / 2, max = 4.5;
    var wk = [[1.5, 'Sep 21'], [2, 'Sep 28'], [3, 'Oct 5'], [h, 'This week']];
    el.innerHTML = '<h2 class="h">Time back, last 4 weeks</h2><div class="tb" role="img" aria-label="Hours back per week: ' + wk.map(function (w) { return w[0]; }).join(', ') + '">' +
      wk.map(function (w) { return '<div><b>' + w[0] + 'h</b><i style="height:' + Math.max(4, Math.round(w[0] / max * 100)) + '%"></i><span>' + w[1] + '</span></div>'; }).join('') +
      '</div><p class="tbnote">Mostly from Contract deadlines and Document chase. Your decisions went from 11 to 6 a week.</p>';
  }

  /* This week: compact strip under the heading, from s.upcoming. Items with a source open it. */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DATE0 = 12;
  function mins(t) { var m = /(\d+):(\d+)\s*(am|pm)/.exec(t || ''); if (!m) return 0; return (+m[1] % 12 + (m[3] === 'pm' ? 12 : 0)) * 60 + +m[2]; }
  function week(s, num) {
    var ups = s.upcoming.slice().sort(function (a, b) { return (DAYS.indexOf(a.day) - DAYS.indexOf(b.day)) || (mins(a.time) - mins(b.time)); });
    var by = {}; ups.forEach(function (u) { (by[u.day] = by[u.day] || []).push(u); });
    var el = document.getElementById('week');
    var days = DAYS.filter(function (d) { return by[d]; });
    if (!days.length) { el.innerHTML = '<li class="tw__none">Nothing scheduled for the rest of the week.</li>'; return; }
    el.innerHTML = days.map(function (day) {
      return '<li class="tw__day"><span class="tw__d">' + day + ' <span>' + (DATE0 + DAYS.indexOf(day)) + '</span></span><ul>' + by[day].map(function (u) {
        var flag = '';
        if (u.flag) { var fd = Q.decision(u.flag); if (fd && num[fd.id]) flag = '<span class="ida-chip ida-chip--attention">Needs you · item ' + num[fd.id] + '</span>'; else if (fd && fd.status === 'later') flag = '<span class="ida-chip ida-chip--attention">Needs you · tomorrow</span>'; }
        var doc = u.doc && Ida.DOCS[u.doc];
        var inner = '<span class="tw__t">' + esc(u.time) + '</span><span class="tw__x">' + esc(u.short || u.text) + '</span>' + flag;
        return '<li>' + (doc
          ? '<button type="button" class="tw__i" data-doc="' + esc(u.doc) + '" data-doc-note="' + esc(u.text) + '" aria-label="' + esc(day + ' ' + u.time + ': ' + (u.short || u.text) + (flag ? ', needs you' : '') + '. Open the ' + doc.title.toLowerCase()) + '">' + inner + '</button>'
          : '<div class="tw__i">' + inner + '</div>') + '</li>';
      }).join('') + '</ul></li>';
    }).join('');
  }

  function render() {
    var s = S.get(), fixes = Q.problems(), open = Q.openDecisions();
    greet(s, fixes, open);
    var h = '', n = 0, num = {};
    fixes.forEach(function (a) {
      n++;
      var blocked = s.decisions.filter(function (d) { return d.status === 'blocked' && d.blockedBy === a.id; });
      h += '<div class="ida-line row" id="fix-' + a.id + '"><div class="ida-line__m mm">' + circle(n) + '<span class="mt">Fix · 30 sec</span></div><div class="ida-line__c rowc"><span><span class="ida-chip ida-chip--problem">Problem</span> <b>' + esc(a.name) + ' disconnected</b><small>' + (blocked.length ? 'Opens after you reconnect: ' + esc(blocked.map(function (d) { return d.tab; }).join(', ')) : esc(a.problemText || '')) + '</small></span><button class="ida-btn" type="button" data-reconnect="' + a.id + '">Reconnect</button></div></div>';
    });
    var later = s.decisions.filter(function (d) { return d.status === 'later'; });
    var rec = recent && Q.decision(recent);
    var recentRow = rec && rec.status === 'done' ? '<div class="sent" role="status">' + Ida.TICK + '<span><b>' + (rec.kind === 'book' ? 'Booked and sent to ' : 'Sent to ') + esc(rec.toWho) + '</b> · just now</span></div>' : '';
    if (open.length) {
      var top = open[0]; n++; num[top.id] = n;
      var pile = card(top, n, 1, open.length);
      open.slice(1).forEach(function (d, i) { n++; num[d.id] = n; pile += tab(d, n, i === 0); });
      h += '<div class="ida-line"><div class="ida-line__m"></div><section class="ida-line__c" aria-label="Decisions">' + recentRow + '<div class="ida-pile">' + pile + '</div></section></div>';
    } else if (!fixes.length) {
      var nx = nextUp(s);
      h += '<div class="ida-line"><div class="ida-line__m">' + Ida.TICK + '</div><section class="ida-line__c calm" aria-label="Nothing needs you">' + recentRow + '<span class="ida-hand ida-hand--lg">all caught up</span><p>What Ida does next:</p><ul class="nextlist">' + nx.map(function (x) { return '<li><small>' + esc(x[0]) + '</small><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul></section></div>';
    } else if (recentRow) {
      h += '<div class="ida-line"><div class="ida-line__m"></div><div class="ida-line__c">' + recentRow + '</div></div>';
    }
    if (later.length) h += '<div class="ida-line"><div class="ida-line__m"></div><div class="ida-line__c later">' + later.map(function (d) { return '<span>Moved to tomorrow morning: <b style="color:var(--ink);font-weight:600">' + esc(d.tab) + '</b></span><button class="ida-btn ida-btn--quiet" type="button" data-back="' + d.id + '">Bring it back</button>'; }).join('') + '</div></div>';
    h += '<div class="ida-line"><div class="ida-line__m"></div><section class="ida-line__c insight" aria-label="Worth a look">' + insight(s) + '</section></div>';
    var items = document.getElementById('items');
    items.innerHTML = h;
    if (editing) { var b = items.querySelector('[contenteditable="true"]'); if (b) b.focus(); }

    document.getElementById('sentlink').textContent = 'See all ' + Q.sentCount() + ' messages Ida sent';
    var shown = s.done.slice(0, 4);
    document.getElementById('donelog').innerHTML = shown.map(function (d) {
      return '<li>' + Ida.TICK + '<span>' + esc(d.text) + '<small>' + esc((d.src ? d.src + ' · ' : '') + d.time) + '</small></span></li>';
    }).join('') + (s.done.length > shown.length ? '<li><span></span><span><small>And ' + plural(s.done.length - shown.length, 'more', 'more') + ' in Sent by Ida</small></span></li>' : '');
    timeBack();
    week(s, num);
    plate(s);
  }

  function readEdit() { var b = document.querySelector('[data-dec="' + editing + '"] .ida-letter__body'); if (!b) return null; var c = b.cloneNode(true); c.querySelectorAll('.ida-cite').forEach(function (x) { x.className = 'ida-marker'; x.removeAttribute('role'); x.removeAttribute('tabindex'); x.removeAttribute('aria-expanded'); x.removeAttribute('aria-controls'); }); return c.innerHTML; }
  function approve(id) {
    var d = Q.decision(id), body = null;
    if (editing === id) { body = readEdit(); editing = null; editBuf = null; }
    var subj = (d.head.filter(function (h) { return h[0] === 'Subject'; })[0] || [, ''])[1];
    var msg = d.kind === 'book' ? '<b>Booked.</b> Invite sent to ' + esc(d.toWho) + ' for Wednesday at 2:30 pm.' : '<b>Sent to ' + esc(d.toWho) + '.</b> ' + esc(subj);
    recent = id; clearTimeout(recentTimer); recentTimer = setTimeout(function () { recent = null; render(); }, 10000);
    ui.withUndo(msg, function () { A.approve(id, body ? { body: body } : null); }, function () { recent = null; });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, [data-cite]'); if (!t) return;
    var id;
    if (t.matches('[data-cite]') && t.classList.contains('ida-cite')) {
      if (t.closest('[contenteditable="true"]')) return;
      var dec = t.closest('[data-dec]').getAttribute('data-dec'), box = document.getElementById('src-' + dec);
      srcClosed[dec] = !srcClosed[dec]; box.hidden = srcClosed[dec]; t.setAttribute('aria-expanded', String(!srcClosed[dec])); return;
    }
    if ((id = t.getAttribute('data-approve'))) return approve(id);
    if ((id = t.getAttribute('data-quick'))) return approve(id);
    if ((id = t.getAttribute('data-edit'))) {
      if (editing === id) { var html = readEdit(); editing = null; editBuf = null; A.saveDraft(id, html); }
      else { if (editing) { A.saveDraft(editing, readEdit()); } editing = id; editBuf = null; render(); }
      return;
    }
    if ((id = t.getAttribute('data-later'))) { if (editing === id) { editing = null; } return ui.withUndo('<b>Moved to tomorrow morning.</b> ' + esc(Q.decision(id).tab), function () { A.later(id); }); }
    if ((id = t.getAttribute('data-open'))) { if (editing) { A.saveDraft(editing, readEdit()); editing = null; } A.toFront(id); var c = document.getElementById('dec-' + id); if (c) { c.scrollIntoView({ block: 'nearest' }); var q = c.querySelector('.ida-btn--primary'); if (q) q.focus(); } return; }
    if ((id = t.getAttribute('data-back'))) return A.bringBack(id);
    if ((id = t.getAttribute('data-reconnect'))) {
      return ui.busy(t, 'Connecting…', 900, function () {
        var a = Q.app(id), blocked = S.get().decisions.filter(function (d) { return d.status === 'blocked' && d.blockedBy === id; });
        A.connect(id);
        ui.toast('<b>' + esc(a.name) + ' reconnected.</b> ' + (blocked.length ? 'The showing for Marcus Lee is back in your decisions.' : 'Everything that used it is running again.'));
      });
    }
    var ins = t.getAttribute('data-insight');
    if (ins === 'send') return ui.withUndo('<b>Sent to Luis and Ana Garcia.</b> Price review with the comparison attached.', function () { A.insight('sent'); });
    if (ins) return A.insight(ins);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!(e.key === 'Enter' || e.key === ' ')) return;
    if (t.classList && t.classList.contains('ida-cite') && !t.closest('[contenteditable="true"]')) { e.preventDefault(); t.click(); }
    if (t.matches && t.matches('.ida-marker[data-doc]')) { e.preventDefault(); ui.openDoc(t.getAttribute('data-doc')); }
  });
  document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('.ida-letter__body[contenteditable="true"]')) editBuf = e.target.innerHTML; });

  S.subscribe(render);
  render();
})();
