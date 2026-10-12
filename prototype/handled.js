/* Being handled: live status of what Ida is doing for each client, grouped the way Workflows is
   set up (Buyer deals / Seller listings / Leads), one row per client. Three plain counts at the top
   double as filters. Stuck rows come first with the one action that unblocks them. Playbook and
   per-client controls (pause, scope, trust, duties, exceptions, take over, leave out) live in the
   side panel. "Changes you told Ida" is a collapsible section with undo.
   Everything here is derived from the shared store; every action goes through Ida.act. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc, own = Ida.util.own;
  var filter = '', panel = null, exForm = false, chOpen = /^#changes$/.test(location.hash);
  var BUCKETS = [
    { id: 'you', label: 'Need you', hint: 'Ida can\'t go on without your answer' },
    { id: 'wait', label: 'Waiting on someone', hint: 'The next move is someone else\'s' },
    { id: 'track', label: 'On track', hint: 'Ida is doing the routine follow-through' },
    { id: 'off', label: 'Paused or quiet', hint: 'Nothing goes out right now' }
  ];
  var RANK = { stuck: 0, needs: 1, waiting: 2, running: 3, held: 4, idle: 5, paused: 6, off: 7 };
  var BUCKET = { stuck: 'you', needs: 'you', waiting: 'wait', running: 'track', held: 'off', idle: 'off', paused: 'off', off: 'off' };
  var CHIP = { stuck: 'ida-chip--attention', needs: 'ida-chip--attention', waiting: 'ida-chip--running', running: 'ida-chip--done' };

  /* ---------- Derived per-client view ---------- */
  function lc(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : ''; }
  function shortName(p) { return /\band\b/.test(p.name) ? 'the ' + p.name.split(' ').pop() + 's' : p.name; }
  /* Status, reason and the unblocking action all come from the store (Q.clientStatus), the same
     model Today and People use. */
  function view(pb, p) {
    var st = Q.clientStatus(pb, p), inf = own(pb.info || {}, p.id) || {}, key = st.key, why = st.why || '', acts = [];
    if (key === 'stuck' && st.fix) acts.push({ href: st.fix.href, label: st.fix.label });
    else if (key === 'needs') st.decs.forEach(function (d) { acts.push({ href: './#dec-' + d.id, label: st.idaOff ? 'Your answer, on Today' : 'Answer on Today', q: d.q }); });
    var word = { stuck: 'Stuck', needs: 'Your answer', waiting: 'Waiting', running: 'On track', held: 'On hold', idle: 'Quiet', off: 'Not covered' }[key] || st.text;
    return { p: p, pb: pb, inf: inf, st: st, key: key, bucket: BUCKET[key] || 'off', word: word, why: why, acts: acts, nx: Q.nextFor(p, inf),
      ex: pb.except.filter(function (x) { return x.person === p.id; }) };
  }
  function views() {
    return S.get().playbooks.map(function (pb) {
      var rows = Q.pbClients(pb).map(function (p) { return view(pb, p); });
      rows.sort(function (a, b) { return RANK[a.key] - RANK[b.key]; });
      return { pb: pb, rows: rows };
    });
  }

  /* ---------- Small pieces ---------- */
  /* "5 of 6 title items clear" gets a row of small boxes; everything else stays plain text. */
  function progress(text) {
    var m = /(\d+) of (\d+) ([^·]+)/.exec(text || '');
    if (!m || +m[2] > 12 || +m[1] > +m[2]) return esc(text || '');
    var n = +m[1], t = +m[2], dots = '';
    for (var i = 0; i < t; i++) dots += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    var before = text.slice(0, m.index), after = text.slice(m.index + m[0].length);
    return esc(before) + '<span class="hd-meter"><span class="hd-meter__dots" aria-hidden="true">' + dots + '</span>' + esc(m[0].trim()) + '</span>' + (after ? ' ' + esc(after.trim()) : '');
  }
  /* Next action skips held items; held ones are listed with why and the switch that resumes them. */
  function nextLine(v) {
    var n = v.nx.next, out = '';
    if (n && n.text) out += '<p class="hd-next">' + (n.when ? '<span class="hd-next__when">' + esc(n.when) + '</span>' : '') + '<span>' + esc(n.text) + '</span></p>';
    var seen = {};
    v.nx.held.forEach(function (x) {
      if (x.hold.by === 'person') return;
      var k = x.hold.by + (x.hold.duty || x.hold.pb); if (seen[k]) { seen[k].n++; return; }
      seen[k] = { n: 1, x: x };
    });
    Object.keys(seen).forEach(function (k) { var x = seen[k].x, h = x.hold;
      out += '<p class="hd-held"><span class="hd-held__what"><b>Held:</b> ' + esc(x.h.text) + ' · ' + esc(x.h.when) + (seen[k].n > 1 ? ' (and ' + (seen[k].n - 1) + ' more)' : '') + '. ' + esc(h.text.replace(/^On hold: /, '')) + '.</span>' +
        (h.by === 'duty' ? '<button class="ida-btn ida-btn--quiet" type="button" data-dutyon="' + esc(h.pb) + '" data-duty-id="' + esc(h.duty) + '">Turn ' + esc(h.name) + ' back on</button>' : '') + '</p>'; });
    return out;
  }
  function funnel(pb) {
    return pb.duties.filter(function (du) { return du.on && du.progress; }).map(function (du) {
      var i = du.progress.indexOf(': '), lab = i > 0 ? du.progress.slice(0, i) : '', parts = (i > 0 ? du.progress.slice(i + 2) : du.progress).split(' · ');
      return '<p class="hd-funnel"><span class="hd-funnel__lab">' + esc(du.name) + (lab ? ' · ' + esc(lab) : '') + '</span><span class="hd-funnel__nums">' + parts.map(function (x) {
        var m = /^(\d+) (.+)$/.exec(x); return m ? '<span><b>' + esc(m[1]) + '</b> ' + esc(m[2]) + '</span>' : '<span>' + esc(x) + '</span>';
      }).join('<span aria-hidden="true" class="hd-sep"> · </span>') + '</span></p>';
    }).join('');
  }
  function trust(level) {
    var c = level === 'practice' ? ['on cur', '', ''] : level === 'approve' ? ['on', 'on cur', ''] : ['on', 'on', 'on cur'];
    return '<ol class="ida-trust" aria-label="Trust level for this type: ' + esc(Ida.LEVEL_NAME[level]) + '"><li class="' + c[0] + '"><span></span>Practice</li><li class="' + c[1] + '"><span></span>You approve</li><li class="' + c[2] + '"><span></span>On its own</li></ol>';
  }

  /* ---------- Page ---------- */
  var primaryUsed;
  function row(v) {
    var p = v.p, inf = v.inf, off = v.st.key === 'off', act = '';
    if (v.acts.length) act = '<div class="hd-act">' + v.acts.map(function (a) {
      var cls = 'ida-btn' + (!primaryUsed && v.key === 'stuck' ? ' ida-btn--primary' : ''); if (v.key === 'stuck') primaryUsed = true;
      return (a.q ? '<span class="hd-q">' + esc(a.q) + '</span>' : '') + '<a class="' + cls + '" href="' + esc(a.href) + '">' + esc(a.label) + '</a>';
    }).join('') + '</div>';
    var doing = off ? 'Ida does nothing for ' + esc(shortName(p)) + ' in this playbook.'
      : v.st.key === 'waiting' ? '<b>' + esc(v.st.text) + '.</b> ' + progress(inf.progress)
      : v.st.key === 'paused' || v.st.idaOff || v.st.key === 'held' ? '<b>' + esc(v.st.text) + '.</b> ' + progress(inf.progress)
      : progress(inf.progress);
    return '<li class="hd-row hd-row--' + esc(v.key) + '" id="cl-' + esc(v.pb.id) + '-' + esc(p.id) + '" data-bucket="' + v.bucket + '"' + (filter && filter !== v.bucket ? ' hidden' : '') + '>' +
      '<div class="hd-who"><button class="hd-name" type="button" data-client="' + esc(p.id) + '" data-pb="' + esc(v.pb.id) + '" aria-haspopup="dialog">' + esc(p.name) + '</button><small>' + esc(inf.deal || p.role) + '</small></div>' +
      '<div class="hd-doing"><p>' + doing + '</p>' + (off || v.st.key === 'paused' || v.st.idaOff ? '' : nextLine(v)) +
        (v.why ? '<p class="hd-why"><b>Why it\'s stuck:</b> ' + esc(v.why) + '</p>' : '') + act +
        v.ex.map(function (x) { return '<p class="hd-ex">Except ' + esc(shortName(p)) + ': ' + esc(x.text) + '</p>'; }).join('') + '</div>' +
      '<span class="ida-chip hd-chip ' + (CHIP[v.key] || '') + '">' + esc(v.word) + '</span></li>';
  }
  function group(g) {
    var pb = g.pb, c = {}, paused = pb.status === 'paused';
    g.rows.forEach(function (v) { c[v.bucket] = (c[v.bucket] || 0) + 1; });
    var parts = [g.rows.length + ' ' + (g.rows.length === 1 ? pb.one : pb.many)];
    BUCKETS.forEach(function (b) { if (c[b.id] && b.id !== 'off') parts.push(c[b.id] + ' ' + (b.id === 'you' ? (c[b.id] === 1 ? 'needs you' : 'need you') : b.id === 'wait' ? 'waiting' : 'on track')); });
    var shown = g.rows.filter(function (v) { return !filter || v.bucket === filter; }).length;
    return '<section class="hd-group" id="' + esc(pb.id) + '" aria-labelledby="h-' + esc(pb.id) + '">' +
      '<header class="hd-group__head"><div><h2 id="h-' + esc(pb.id) + '">' + esc(pb.name) + '</h2><p class="hd-group__sum">' + esc(parts.join(' · ')) + '</p></div>' +
      '<div class="hd-group__acts">' + (paused ? '<span class="ida-chip">Paused by you</span><button class="ida-btn" type="button" data-rresume="' + esc(pb.id) + '">Resume</button>' : '') +
      '<button class="ida-btn ida-btn--quiet" type="button" data-pbpanel="' + esc(pb.id) + '" aria-haspopup="dialog">Playbook and controls</button></div></header>' +
      (paused ? '<p class="hd-paused">Nothing goes out for any ' + esc(pb.one) + ' until you resume.</p>' : funnel(pb)) +
      (g.rows.length ? '<ul class="hd-rows">' + g.rows.map(row).join('') + '</ul>' + (shown ? '' : '<p class="muted hd-none">None of your ' + esc(pb.many) + ' here.</p>')
        : '<p class="muted hd-none">No ' + esc(pb.many) + ' right now. The next one is covered automatically.</p>') + '</section>';
  }
  function counts(gs) {
    var c = { you: 0, wait: 0, track: 0, off: 0 };
    gs.forEach(function (g) { g.rows.forEach(function (v) { c[v.bucket]++; }); });
    return '<div class="hd-counts" role="group" aria-label="Show clients by status">' + BUCKETS.map(function (b) {
      if (b.id === 'off' && !c.off) return '';
      return '<button type="button" class="hd-count hd-count--' + b.id + '" data-filter="' + b.id + '" aria-pressed="' + (filter === b.id) + '"' + (c[b.id] ? '' : ' disabled') + '><b>' + c[b.id] + '</b><span>' + esc(b.label) + '<small>: ' + esc(b.hint) + '</small></span></button>';
    }).join('') + '</div>' + (filter ? '<p class="hd-filtered">Showing only "' + esc(BUCKETS.filter(function (b) { return b.id === filter; })[0].label) + '". <button class="ida-link" type="button" data-filter="">Show everyone</button></p>' : '');
  }
  function changes(s) {
    var latest = s.changes.filter(function (c) { return !c.undone; })[0], el = document.getElementById('changes');
    el.open = chOpen;
    document.getElementById('ch-sum').innerHTML = 'Changes you told Ida <span class="hd-chn">' + s.changes.length + '</span>' + (latest ? '<small>Latest: ' + esc(latest.title) + '</small>' : '');
    document.getElementById('chlist').innerHTML = s.changes.length ? '<ul class="ida-chlist">' + s.changes.map(function (c) {
      return '<li class="' + (c.undone ? 'is-undone' : '') + '" id="' + esc(c.id) + '"><div><b>' + esc(c.title) + '</b><small>You told Ida "' + esc(c.text) + '" · ' + esc(c.at) + (c.undone ? ' · undone ' + esc(c.undoneAt || '') : '') + '</small>' +
        '<ul>' + c.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        (c.undone ? '<span class="ida-chip">Undone</span>' : c === latest ? '<button class="ida-btn" type="button" data-cundo="' + esc(c.id) + '">Undo</button>' : '<small class="muted">Undo the newer change first</small>') + '</li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing yet. Type a change in the field at the top, for example "Don\'t book anyone Thursday". Ida lists every item it would update before it changes anything.</p>';
  }

  /* ---------- Side panel: one client, or one playbook ----------
     Contact details and history live in Follow Up Boss; the panel shows a read-only summary of
     it, plus Ida's own layer: what needs you, what Ida does next, what Ida told them, controls. */
  var EXT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>';
  function chName(ch) { return ch === 'text' ? 'Text' : 'Email'; }
  function firstOf(p) { return (p.short || p.name).split(' ')[0]; }
  /* Everything that needs the agent for this person. Obligations you own (a question only you can
     answer, a promise Ida made for you) stay here with owner You, even while Ida is paused. */
  function needsSec(p) {
    var off = Q.idaOff(p), nm = firstOf(p), items = Q.personNeeds(p.id).map(function (n) {
      if (n.type === 'work') {
        var x = Q.expectFor(n.d), m = x && x.promise && Q.msgAt(p, x.at);
        var promise = m ? '<small class="hd-promise"><b>' + esc(x.promise) + '.</b> <q>' + esc(m.m.text) + '</q> ' + esc(chName(m.m.ch)) + ' · ' + esc(m.m.t) + (m.m.sid ? ' · <a href="sent.html#' + esc(m.m.sid) + '">Open in Sent</a>' : '') + '</small>' : '';
        return '<li class="hd-need"><span class="ida-chip ida-chip--attention">Owner: You</span><div><b>' + esc(n.d.q) + '</b>' + promise +
          '<small>' + esc(off ? (p.ida === 'you' ? 'You\'re handling ' + nm + ', so Ida won\'t answer. ' : 'Ida is paused for ' + nm + ', so it won\'t answer. ') + 'Stays here and on Today until you mark it done or dismiss it.' : 'Only you can answer this. It\'s on Today.') + '</small>' +
          '<span class="hd-need__acts">' + (off ? '<button class="ida-btn" type="button" data-workdone="' + esc(n.d.id) + '">Done</button><button class="ida-btn ida-btn--quiet" type="button" data-workdismiss="' + esc(n.d.id) + '">Dismiss</button>' : '') + '<a href="./#dec-' + esc(n.d.id) + '">' + (off ? 'See it on Today' : 'Answer on Today') + '</a></span></div></li>';
      }
      if (n.type === 'approve') return '<li class="hd-need"><span class="ida-chip ida-chip--attention">Your OK</span><div><b>' + esc(n.d.q) + '</b><small>Ida drafted it; nothing goes out until you approve.</small><span class="hd-need__acts"><a href="./#dec-' + esc(n.d.id) + '">Decide on Today</a></span></div></li>';
      if (n.type === 'stuck') return '<li class="hd-need"><span class="ida-chip ida-chip--attention">Stuck</span><div><b>' + esc(n.d.q) + '</b><small>' + esc(n.why) + '</small><span class="hd-need__acts"><a href="' + esc(n.fix.href) + '">' + esc(n.fix.label) + '</a></span></div></li>';
      return '<li class="hd-need"><span class="ida-chip ida-chip--attention">Owner: You</span><div><b>' + esc(n.e.text) + '</b>' + (n.e.recommend ? '<small>' + esc(n.e.recommend) + '</small>' : '') + '<span class="hd-need__acts"><a href="./#ev-' + esc(n.e.id) + '">Open on Today</a></span></div></li>';
    });
    var aside = Q.asideDecisions().filter(function (d) { return d.person === p.id; });
    return '<section class="hd-sec" id="hp-needs"><h3 class="hd-ph">What needs you</h3>' + (items.length ? '<ul class="hd-needs">' + items.join('') + '</ul>' : '<p class="muted">Nothing right now.</p>') +
      (aside.length ? '<p class="hd-aside">Set aside while ' + (p.ida === 'you' ? 'you handle ' + esc(nm) : 'Ida is paused') + ': ' + aside.map(function (d) { return '<b>' + esc(d.tab) + '</b>'; }).join(', ') + '. Back when Ida is.</p>' : '') + '</section>';
  }
  /* Ida's scheduled actions. Held ones say why, with the switch that resumes them. */
  function nextSec(p, progressText) {
    var hs = p.handling || [], nm = firstOf(p);
    var list = hs.map(function (h) {
      var r = h.pb && Q.playbook(h.pb), du = r && h.duty && Q.duty(r, h.duty), hold = Q.holdOf(p, h);
      var resume = hold && hold.by === 'duty' ? '<button class="ida-btn ida-btn--quiet" type="button" data-dutyon="' + esc(hold.pb) + '" data-duty-id="' + esc(hold.duty) + '">Turn ' + esc(hold.name) + ' back on</button>'
        : hold && hold.by === 'pb' ? '<button class="ida-btn ida-btn--quiet" type="button" data-rresume="' + esc(hold.pb) + '">Resume the playbook</button>' : '';
      return '<li class="hd-sched' + (hold ? ' is-held' : '') + '"><span class="hd-sched__when">' + esc(h.when) + '</span><div><b>' + esc(h.text) + '</b><small>' + chName(h.ch) + (du ? ' · ' + esc(du.name) : r ? ' · ' + esc(r.name) : ' · just for ' + esc(nm)) + '</small>' +
        (hold ? '<small class="hd-sched__hold"><b>Held.</b> ' + esc(hold.text.replace(/^On hold: /, '')) + '.</small>' + resume : '') + '</div></li>';
    });
    return '<section class="hd-sec" id="hp-next"><h3 class="hd-ph">What Ida is handling next</h3>' + (progressText ? '<p>' + progress(progressText) + '</p>' : '') +
      (list.length ? '<ul class="hd-scheds">' + list.join('') + '</ul>' : '<p class="muted">Nothing scheduled for ' + esc(nm) + '.</p>') + '</section>';
  }
  function toldSec(p) {
    var t = Q.told(p.id, 3), nm = firstOf(p);
    return '<section class="hd-sec" id="hp-told"><h3 class="hd-ph">What Ida told ' + esc(nm) + ' recently</h3>' + (t.length ? '<ul class="hd-told">' + t.map(function (x) {
      return '<li><span class="hd-sched__when">' + esc(x.m.t) + '</span><div>' + (x.sent ? '<a href="sent.html#' + esc(x.sent.id) + '">' + esc(x.m.sum || x.m.text) + '</a>' : '<span>' + esc(x.m.sum || x.m.text) + '</span>') + '<small>' + chName(x.m.ch) + (x.sent ? ' · in Sent' : '') + '</small></div></li>';
    }).join('') + '</ul>' : '<p class="muted">Ida hasn\'t written to ' + esc(nm) + ' yet.</p>') + '</section>';
  }
  function fubSec(p) {
    var c = Q.crm(p.id); if (!c) return '';
    var notes = (p.notes || []).slice(-2).reverse();
    return '<section class="hd-sec hd-fub" id="hp-fub" aria-labelledby="hp-fub-h"><h3 class="hd-ph" id="hp-fub-h">From Follow Up Boss · ' + esc(c.synced) + '</h3>' +
      '<dl class="hd-fub__kv"><div><dt>Stage</dt><dd>' + esc(c.stage) + '</dd></div><div><dt>Phone</dt><dd>' + esc(c.phone) + '</dd></div><div><dt>Email</dt><dd>' + esc(c.email) + '</dd></div>' +
      '<div><dt>Last contact</dt><dd>' + (c.last ? esc(c.last.t) + ' · ' + esc(c.last.ch) + ' · ' + esc(c.last.who) : 'None yet') + '</dd></div></dl>' +
      (notes.length ? '<p class="hd-fub__notes"><b>Ida\'s notes, written back:</b> ' + notes.map(function (n) { return esc(n.text) + ' <small>(' + esc(n.t) + ')</small>'; }).join('; ') + '</p>' : '') +
      '<p class="hd-fub__foot"><a class="hd-fub__open" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open in Follow Up Boss' + EXT + '</a><small>Ida reads this. Edit contact details in Follow Up Boss.</small></p></section>';
  }
  function ctlSec(p, pb, off) {
    var nm = firstOf(p);
    var banner = p.ida === 'you' ? '<p class="hd-pbanner" role="status"><b>You\'re handling ' + esc(nm) + ' · Ida paused.</b> Ida sends ' + esc(nm) + ' nothing' + (p.since ? ' since ' + esc(p.since) : '') + '. What only you can answer stays in What needs you.</p>'
      : p.ida === 'paused' ? '<p class="hd-pbanner" role="status"><b>Ida paused for ' + esc(nm) + '.</b> Nothing goes out until you resume' + (p.since ? ' (paused ' + esc(p.since) + ')' : '') + '. What you owe ' + esc(nm) + ' stays in What needs you.</p>' : '';
    return '<section class="hd-sec" id="hp-ctl"><h3 class="hd-ph">Controls for ' + esc(shortName(p)) + '</h3>' + banner + '<div class="hd-ctl">' +
      (off ? '' : p.ida === 'you' ? '<button class="ida-btn" type="button" data-handback="' + esc(p.id) + '">Hand back to Ida</button>'
        : '<button class="ida-btn" type="button" data-takeover="' + esc(p.id) + '">Take over ' + esc(nm) + '</button>' +
          (p.ida === 'paused' ? '<button class="ida-btn" type="button" data-presume="' + esc(p.id) + '">Resume Ida</button>' : '<button class="ida-btn" type="button" data-ppause="' + esc(p.id) + '">Pause Ida for ' + esc(nm) + '</button>')) +
      (pb ? '<button class="ida-btn ida-btn--quiet" type="button" data-excl="' + esc(pb.id) + '" data-p="' + esc(p.id) + '" data-on="' + (off ? '0' : '1') + '">' + (off ? 'Cover again' : 'Leave out of this playbook') + '</button>' : '') + '</div>' +
      '<p class="muted hd-small">Take over: Ida stops writing to ' + esc(nm) + ' until you hand back. Pause: nothing goes out until you resume.' + (pb ? ' Leave out: the ' + esc(pb.name) + ' playbook stops for ' + esc(nm) + ' only.' : '') + '</p></section>';
  }
  function clientPanel(pb, p) {
    var v = view(pb, p), inf = v.inf, off = v.st.key === 'off';
    var dut = pb.duties.filter(function (du) { return Q.dutyFor(pb, du, p); });
    return '<div class="hd-panel" data-hpanel="client" data-pid="' + esc(p.id) + '">' +
      '<p class="hd-pstat"><span class="ida-chip ' + (CHIP[v.key] || '') + '">' + esc(v.word) + '</span><span>' + esc(v.key === 'off' || v.key === 'paused' || v.key === 'waiting' || v.key === 'held' ? v.st.text : inf.deal || p.role) + '</span></p>' +
      (v.why ? '<p class="hd-why"><b>Why it\'s stuck:</b> ' + esc(v.why) + '</p>' : '') +
      fubSec(p) + needsSec(p) + (off ? '' : nextSec(p, inf.progress)) + toldSec(p) + ctlSec(p, pb, off) +
      (off ? '' : '<section class="hd-sec"><h3 class="hd-ph">From the ' + esc(pb.name) + ' playbook</h3><ul class="hd-dlist">' + (dut.length ? dut.map(function (du) { return '<li>' + esc(du.name) + '</li>'; }).join('') : '<li>Nothing is switched on.</li>') + '</ul>' +
        '<button class="ida-link" type="button" data-pbpanel="' + esc(pb.id) + '">Change this for every ' + esc(pb.one) + '</button></section>') +
      '<section class="hd-sec"><h3 class="hd-ph">Exceptions for ' + esc(shortName(p)) + '</h3>' +
        (v.ex.length ? '<ul class="hd-exlist">' + v.ex.map(function (x) { return '<li><span>Except ' + esc(shortName(p)) + ': ' + esc(x.text) + '</span><button class="ida-link" type="button" data-exdel="' + esc(pb.id) + '" data-x="' + esc(x.id) + '">Remove</button></li>'; }).join('') + '</ul>' : '<p class="muted">None yet. The playbook runs as set for every ' + esc(pb.one) + '.</p>') +
        (exForm ? '<form class="ida-cl__form" data-exform="' + esc(pb.id) + '" data-p="' + esc(p.id) + '"><label class="ida-field">Exception for ' + esc(p.name) + '<input type="text" maxlength="300" placeholder="For example: ask me before any price note"></label><div class="ida-row-acts"><button class="ida-btn" type="submit">Save exception</button><button class="ida-btn ida-btn--quiet" type="button" data-excancel>Cancel</button></div></form>'
          : '<button class="ida-btn" type="button" data-exadd="' + esc(pb.id) + '" data-p="' + esc(p.id) + '">Add an exception</button>') + '</section></div>';
  }
  /* Deal contacts (lender, title officer) aren't clients, so no playbook row; Ida writes to them
     only as part of a client's deal. Same layer, without playbook controls. */
  function contactPanel(p) {
    return '<div class="hd-panel" data-hpanel="contact" data-pid="' + esc(p.id) + '">' +
      '<p class="hd-pstat"><span class="ida-chip">Deal contact</span><span>' + esc(p.role) + ' · Ida writes to ' + esc(firstOf(p)) + ' only as part of a client\'s deal</span></p>' +
      fubSec(p) + needsSec(p) + nextSec(p, '') + toldSec(p) + ctlSec(p, null, false) + '</div>';
  }
  function pbPanel(pb) {
    var sc = pb.scope, cov = Q.pbCovered(pb), paused = pb.status === 'paused';
    return '<div class="hd-panel" data-hpanel="pb">' +
      '<p class="hd-pstat"><span class="ida-chip ' + (paused ? '' : 'ida-chip--done') + '">' + (paused ? 'Paused by you' : 'Running') + '</span><span>Running for ' + cov.length + ' ' + esc(cov.length === 1 ? pb.one : pb.many) + ' · applies automatically to new ' + esc(pb.many) + ' · ' + esc(pb.since) + (pb.edited ? ' · ' + esc(pb.edited) : '') + '</span></p>' +
      '<div class="hd-ctl">' + (paused ? '<button class="ida-btn" type="button" data-rresume="' + esc(pb.id) + '">Resume</button>' : '<button class="ida-btn" type="button" data-rpause="' + esc(pb.id) + '">Pause for every ' + esc(pb.one) + '</button>') +
        '<button class="ida-btn" type="button" data-scope="' + esc(pb.id) + '">Change scope and trust</button></div>' +
      '<section><h3 class="hd-ph">Trust for every ' + esc(pb.one) + '</h3>' + trust(pb.level) + '</section>' +
      '<section><h3 class="hd-ph">What Ida does for each ' + esc(pb.one) + '</h3><ul class="ida-duties">' + pb.duties.map(function (du) {
        var lim = du.only && du.only.length ? 'Only for ' + du.only.map(Q.person).filter(Boolean).map(function (p) { return p.name; }).join(', ') : 'Every ' + pb.one;
        return '<li' + (du.on ? '' : ' class="is-off"') + '><span><b>' + esc(du.name) + '</b><small>' + (du.on ? esc(lim) : 'Off') + '</small></span>' +
          '<label class="ida-switch" title="' + (du.on ? 'Turn off' : 'Turn on') + '"><input type="checkbox" data-duty="' + esc(pb.id) + '" value="' + esc(du.id) + '"' + (du.on ? ' checked' : '') + ' aria-label="' + esc(du.name) + ' for ' + esc(pb.many) + '"><i></i></label></li>';
      }).join('') + '</ul></section>' +
      '<section><h3 class="hd-ph">Scope</h3><dl class="ida-kv ida-scope" id="sc-' + esc(pb.id) + '"><div><dt>Who</dt><dd>' + esc(sc.who) + '</dd></div><div><dt>What Ida may say and ask</dt><dd>' + esc(sc.say) + '</dd></div><div><dt>How often</dt><dd>' + esc(sc.cadence) + '</dd></div><div><dt>Ida stops for</dt><dd>' + esc(sc.stop) + '</dd></div><div><dt>What comes to you</dt><dd>' + esc(sc.toYou) + '</dd></div><div><dt>Texting</dt><dd>Only people who opted in; everyone else gets email. STOP ends texting at once.</dd></div></dl></section>' +
      '<p><a class="hd-plink" href="workflows.html">See how this is set up on Workflows</a></p></div>';
  }
  function panelHtml() {
    if (!panel) return '';
    if (panel.kind === 'contact') { var c = Q.person(panel.p); return c ? contactPanel(c) : ''; }
    var pb = Q.playbook(panel.pb); if (!pb) return '';
    if (panel.kind === 'pb') return pbPanel(pb);
    var p = Q.person(panel.p); return p ? clientPanel(pb, p) : '';
  }
  function openPanel(o) {
    panel = o; exForm = false;
    var p = o.p && Q.person(o.p);
    if (o.kind === 'contact') { if (p) ui.openDrawer({ title: p.name, sub: 'Deal contact · ' + p.role, html: panelHtml() }); return; }
    var pb = Q.playbook(o.pb); if (!pb) return;
    if (o.kind === 'pb') ui.openDrawer({ title: pb.name + ' playbook', sub: 'Applies to every ' + pb.one + ', including new ones', html: panelHtml() });
    else if (p) { var deal = (own(pb.info || {}, p.id) || {}).deal; ui.openDrawer({ title: p.name, sub: pb.name + (deal ? ' · ' + deal : ''), html: panelHtml() }); }
  }
  /* handled.html#<person id> opens that client's panel (links from Today, Sent and the ask bar). */
  function openFromHash() {
    var h = location.hash.slice(1), p = /^[A-Za-z0-9_-]+$/.test(h) && Q.person(h); if (!p) return false;
    var pb = Q.personPb(p);
    if (pb) { openPanel({ kind: 'client', p: p.id, pb: pb.id }); var row = document.getElementById('cl-' + pb.id + '-' + p.id); if (row) { if (filter && row.hidden) { filter = ''; render(); row = document.getElementById(row.id); } ui.highlight(row); } }
    else openPanel({ kind: 'contact', p: p.id });
    return true;
  }
  function panelBody() { var el = document.querySelector('#drawer [data-hpanel]'); return el && ui.drawerOpen() ? el.parentNode : null; }
  function refreshPanel() {
    var body = panelBody(); if (!body) { panel = null; return; }
    var h = panelHtml(); if (!h) { ui.closeDrawer(); panel = null; return; }
    body.innerHTML = h;
    var f = body.querySelector('[data-exform] input'); if (f) f.focus();
  }

  function render() {
    var s = S.get(), gs = views();
    primaryUsed = false;
    document.getElementById('hsum').innerHTML = counts(gs);
    document.getElementById('resps').innerHTML = gs.map(group).join('');
    changes(s);
    refreshPanel();
  }

  /* ---------- Events (page and side panel) ---------- */
  function inScope(t) { return t && (t.closest('main') || t.closest('#drawer [data-hpanel]')); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) { var r = e.target.closest('main .hd-row'); if (r && !e.target.closest('a')) { var nb = r.querySelector('[data-client]'); if (nb) nb.click(); } return; }
    if (!inScope(t)) return; var id;
    if (t.hasAttribute('data-delegate')) return ui.delegate('');
    if (t.hasAttribute('data-filter')) { var f = t.getAttribute('data-filter'); filter = filter === f ? '' : f; return render(); }
    if ((id = t.getAttribute('data-client'))) return openPanel({ kind: 'client', p: id, pb: t.getAttribute('data-pb') });
    if ((id = t.getAttribute('data-pbpanel'))) return openPanel({ kind: 'pb', pb: id });
    if ((id = t.getAttribute('data-scope'))) { panel = null; return ui.scopeForm(id); }
    if ((id = t.getAttribute('data-rpause'))) { var pb = Q.playbook(id); return ui.withUndo('<b>Paused ' + esc(pb.name) + '.</b> Nothing goes out for any ' + esc(pb.one) + ' until you resume.', function () { A.pbPause(id, true); }); }
    if ((id = t.getAttribute('data-rresume'))) { A.pbPause(id, false); return ui.toast('<b>Running again.</b> ' + esc(Q.playbook(id).name)); }
    if ((id = t.getAttribute('data-excl'))) { var pid = t.getAttribute('data-p'), on = t.getAttribute('data-on') === '1', p = Q.person(pid);
      return ui.withUndo(on ? '<b>' + esc(p.name) + ' left out of ' + esc(Q.playbook(id).name) + '.</b> Ida stops this playbook for them only.' : '<b>' + esc(p.name) + ' is covered again.</b>', function () { A.pbExclude(id, pid, on); }); }
    if ((id = t.getAttribute('data-takeover'))) { var p1 = Q.person(id); return ui.withUndo('<b>You\'re handling ' + esc(p1.name) + '.</b> Ida stopped writing to ' + esc(p1.short || p1.name) + '. What only you can answer stays on Today.', function () { A.takeOver(id); }); }
    if ((id = t.getAttribute('data-dutyon'))) { var did = t.getAttribute('data-duty-id'), dd = Q.duty(Q.playbook(id), did); return ui.withUndo('<b>' + esc(dd ? dd.name : '') + ' is on</b> again for every ' + esc(Q.playbook(id).one) + '.', function () { A.dutyToggle(id, did, true); }); }
    if ((id = t.getAttribute('data-handback'))) { var p2 = Q.person(id); return ui.withUndo('<b>Ida is back on ' + esc(p2.name) + '.</b>', function () { A.handBack(id); }); }
    if ((id = t.getAttribute('data-ppause'))) { var p3 = Q.person(id); return ui.withUndo('<b>Ida paused for ' + esc(p3.name) + '.</b> Nothing goes out until you resume.', function () { A.pausePerson(id, true); }); }
    if ((id = t.getAttribute('data-presume'))) { A.pausePerson(id, false); return ui.toast('<b>Ida is back on ' + esc(Q.person(id).name) + '.</b>'); }
    if (t.hasAttribute('data-exadd')) { exForm = true; return refreshPanel(); }
    if (t.hasAttribute('data-excancel')) { exForm = false; return refreshPanel(); }
    if ((id = t.getAttribute('data-exdel'))) { var x = t.getAttribute('data-x'); return ui.withUndo('<b>Exception removed.</b>', function () { A.pbExceptRemove(id, x); }); }
    if ((id = t.getAttribute('data-cundo'))) return ui.undoChange(id);
    if ((id = t.getAttribute('data-workdone'))) { var wd = Q.decision(id); return ui.withUndo('<b>Marked done.</b> ' + esc(wd.q), function () { A.workDone(id); }); }
    if ((id = t.getAttribute('data-workdismiss'))) { var wx = Q.decision(id); return ui.withUndo('<b>Dismissed.</b> ' + esc(wx.q), function () { A.workDismiss(id); }); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-exform]'); if (!f || !inScope(f)) return; e.preventDefault();
    var v = f.querySelector('input').value.trim(); if (!v) return f.querySelector('input').focus();
    var id = f.getAttribute('data-exform'), pid = f.getAttribute('data-p'); exForm = false;
    ui.withUndo('<b>Exception saved.</b> ' + esc(Q.person(pid).name) + ': ' + esc(v), function () { A.pbExcept(id, pid, v); });
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.matches('[data-duty]') || !inScope(t)) return;
    var id = t.getAttribute('data-duty'), du = Q.duty(Q.playbook(id), t.value), on = t.checked;
    ui.withUndo('<b>' + esc(du.name) + (on ? ' is on' : ' is off') + '</b> for every ' + esc(Q.playbook(id).one) + '.', function () { A.dutyToggle(id, t.value, on); });
  });
  document.getElementById('changes').addEventListener('toggle', function (e) { chOpen = e.target.open; });
  /* The "What the words mean" explainer is collapsible; remember the choice for this viewer. */
  var how = document.getElementById('hd-how');
  if (how) { try { how.open = localStorage.getItem('ida-hd-how') === '1'; } catch (e) {} how.addEventListener('toggle', function () { try { localStorage.setItem('ida-hd-how', how.open ? '1' : '0'); } catch (e) {} }); }
  window.addEventListener('hashchange', function () { if (location.hash === '#changes') { chOpen = true; document.getElementById('changes').open = true; } else openFromHash(); });
  S.subscribe(render);
  render();
  if (!openFromHash()) ui.highlightHash();
})();
