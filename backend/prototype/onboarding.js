/* Onboarding: 2 Your week → 3 Connect apps → 4 First practice run → Today. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, ui = Ida.ui, esc = Ida.util.esc;
  var COLS = ['Leads', 'Deals', 'Listings', 'Admin'];
  var ITEMS = [
    ['leads', 'Leads', 'Reply to new leads', 'ready', 0.8, true, ['gmail', 'zillow']], ['prep', 'Leads', 'Prep for listing appointments', 'ready', 0.7, true, ['fub']], ['book', 'Leads', 'Book showings', 'setup', 0.3, false, ['gcal']], ['hot', 'Leads', 'Call back hot leads', 'yours'],
    ['deadlines', 'Deals', 'Track contract deadlines', 'ready', 0.6, true, ['dotloop']], ['chase', 'Deals', 'Chase missing documents', 'ready', 0.7, true, ['dotloop', 'gmail']], ['insp', 'Deals', 'Inspection summaries and repair requests', 'ready', 0.5, true, ['gmail']], ['offers', 'Deals', 'Compare offers for sellers', 'setup', 0.3, false, ['dotloop']], ['appr', 'Deals', 'Check appraisals', 'setup', 0.3, false, ['dotloop']], ['neg', 'Deals', 'Negotiate offers', 'yours'],
    ['report', 'Listings', 'Weekly showing report', 'ready', 0.4, true, ['gmail']], ['price', 'Listings', 'Price-review notes', 'setup', 0.2, false, ['mls']], ['stage', 'Listings', 'Stage and photograph homes', 'yours'],
    ['file', 'Admin', 'File signed documents', 'setup', 0.2, false, ['dotloop']], ['comm', 'Admin', 'Log commissions and expenses', 'setup', 0.5, false, ['qb']], ['lic', 'Admin', 'Renew license and CE hours', 'yours']
  ];
  var APPS = { gmail: ['Gmail', 'GM', 'Reads leads and reports, drafts your emails'], zillow: ['Zillow Premier Agent', 'ZP', 'Sends Ida new leads the moment they arrive'], fub: ['Follow Up Boss', 'FB', 'Your leads, notes and past clients'], gcal: ['Google Calendar', 'GC', 'Finds showing times and adds events'], dotloop: ['Dotloop', 'DL', 'Deal documents, dates and signatures'], mls: ['Bright MLS', 'ML', 'Listing details and nearby price changes'], qb: ['QuickBooks', 'QB', 'Commission income and expenses'] };
  var ob = function () { return S.get().onboarding; };
  var verdictOpen = false;

  function picks() {
    var o = ob(); if (o.picks) return o.picks;
    var p = {}; ITEMS.forEach(function (i) { if (i[3] !== 'yours') p[i[0]] = !!i[5]; }); return p;
  }
  function chosen() { var p = picks(), list = ITEMS.filter(function (i) { return p[i[0]]; }); ob().extra.forEach(function (x) { if (p[x.id] !== false) list.push([x.id, x.col, x.name, 'ready', 0.3, true, []]); }); return list; }
  function stepsBar(n) {
    var names = ['Your work', 'Your week', 'Connect apps', 'First practice run'];
    return '<ol class="ida-onb__steps">' + names.map(function (x, i) { return '<li class="' + (i + 1 < n ? 'done' : i + 1 === n ? 'cur' : '') + '"' + (i + 1 === n ? ' aria-current="step"' : '') + '>' + x + '</li>'; }).join('') + '</ol>';
  }
  function hoursText(list) { var h = list.reduce(function (a, i) { return a + (i[4] || 0); }, 0); return h < 0.75 ? 'under an hour a week back' : 'about ' + Math.round(h) + ' hour' + (Math.round(h) === 1 ? '' : 's') + ' a week back'; }

  function step2() {
    var p = picks(), extra = ob().extra;
    var cols = COLS.map(function (c) {
      var items = ITEMS.filter(function (i) { return i[1] === c; }).map(function (i) {
        var cls = i[3] === 'ready' ? 'is-ready' : i[3] === 'setup' ? 'is-setup' : 'is-yours', sub = i[3] === 'ready' ? 'Ida can do this now' : i[3] === 'setup' ? 'Needs an app connected' : 'Best kept by you';
        return '<li class="ida-map__item ' + cls + '"><label><input type="checkbox" data-pick="' + i[0] + '"' + (p[i[0]] ? ' checked' : '') + (i[3] === 'yours' ? ' disabled' : '') + ' aria-label="Hand to Ida: ' + esc(i[2]) + '"><span><b>' + esc(i[2]) + '</b><small>' + sub + '</small></span></label></li>';
      }).join('') + extra.filter(function (x) { return x.col === c; }).map(function (x) {
        return '<li class="ida-map__item is-ready"><label><input type="checkbox" data-pick="' + x.id + '"' + (p[x.id] !== false ? ' checked' : '') + ' aria-label="Hand to Ida: ' + esc(x.name) + '"><span><b>' + esc(x.name) + '</b><small>You added this · Ida practices it first</small></span></label></li>';
      }).join('');
      return '<section class="ida-map__col"><h3>' + c + '</h3><ul>' + items + '</ul></section>';
    }).join('');
    var list = chosen();
    return stepsBar(2) + '<h1>Here\'s a typical week for a listing and buyer\'s agent</h1>' +
      '<p class="lead">Ida built this from what agents like you do every week and what you told it: <span class="ida-marker">"mostly buyers, about 4 deals at a time, I hate chasing paperwork"</span>. Tick what you\'d like off your plate. You can change this any time.</p>' +
      '<div class="ida-map">' + cols + '</div>' +
      '<form class="ida-addrule" id="missed" hidden novalidate><label class="h" for="m-name">Add a task we missed</label><div><input id="m-name" type="text" placeholder="For example: send closing gifts"><select id="m-col" class="ida-input" style="flex:0 1 160px" aria-label="Area">' + COLS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select><button class="ida-btn" type="submit">Add it</button><button class="ida-btn ida-btn--quiet" type="button" data-hide-missed>Cancel</button></div><small>Ida adds it ticked and practices it first, like everything else.</small></form>' +
      '<div class="ida-onb__foot"><p><b>' + list.length + (list.length === 1 ? ' task' : ' tasks') + ' selected</b> · ' + hoursText(list) + '. Ida starts every task in practice mode: it drafts, you compare, nothing is sent.</p><div><button class="ida-btn ida-btn--quiet" type="button" data-show-missed>Add a task we missed</button><button class="ida-btn ida-btn--primary" type="button" data-go="3"' + (list.length ? '' : ' disabled') + '>Continue</button></div></div>';
  }
  function neededApps() { var need = {}; chosen().forEach(function (i) { (i[6] || []).forEach(function (a) { (need[a] = need[a] || []).push(i[2]); }); }); return need; }
  function step3() {
    var need = neededApps(), ids = Object.keys(APPS).filter(function (k) { return need[k]; }), con = ob().apps, done = ids.filter(function (k) { return con[k]; }).length;
    return stepsBar(3) + '<h1>Connect the apps these tasks use</h1><p class="lead">Ida only touches the apps you connect, with the access shown when you connect them. You can skip any and connect it later.</p>' +
      '<div>' + ids.map(function (k) { var a = APPS[k]; return '<article class="ida-app"><span class="ida-app__logo" aria-hidden="true">' + a[1] + '</span><div class="ida-app__t"><h2>' + a[0] + ' ' + (con[k] ? '<span class="ida-chip ida-chip--done">Connected</span>' : '') + '</h2><p>' + a[2] + '.</p><small>For: ' + esc(need[k].join(', ')) + '</small></div>' + (con[k] ? '<span></span>' : '<button class="ida-btn" type="button" data-conn="' + k + '">Connect</button>') + '</article>'; }).join('') + '</div>' +
      '<div class="ida-onb__foot"><p><b>' + done + ' of ' + ids.length + ' connected.</b> Tasks that need an app wait until it\'s connected.</p><div><button class="ida-btn ida-btn--quiet" type="button" data-go="2">Back</button><button class="ida-btn ida-btn--primary" type="button" data-go="4">Continue</button></div></div>';
  }
  function step4() {
    var v = ob().verdict;
    var verdict = v ? '<div class="ida-notice" role="status">' + (v === 'right' ? Ida.TICK + '<span><b>Saved: looks right.</b> 1 of 5 practice runs for Lead replies. Ida keeps practicing on real leads and shows you each one.</span>' : '<span><b>Saved: not like you.</b> Ida will keep it shorter and skip the listing details next time.</span>') + '<button class="ida-btn ida-btn--quiet" type="button" data-verdict="">Undo</button></div>'
      : '<div class="ida-row-acts"><button class="ida-btn" type="button" data-verdict="right" style="min-width:160px;justify-content:center">Looks right</button><button class="ida-btn" type="button" data-verdict-not style="min-width:160px;justify-content:center">Not like me</button></div>' +
        (verdictOpen ? '<form class="ida-addrule" id="why" novalidate><fieldset class="ida-choice"><legend>What\'s not like you?</legend><label><input type="checkbox" checked>Too long</label><label><input type="checkbox">Too formal</label><label><input type="checkbox">I\'d ask a question first</label><label><input type="checkbox">A fact is wrong</label></fieldset><div><button class="ida-btn" type="submit">Save my answer</button><button class="ida-btn ida-btn--quiet" type="button" data-verdict-cancel>Cancel</button></div></form>' : '');
    return stepsBar(4) + '<h1>Does Ida\'s first draft sound like you?</h1><p class="lead">Ida practiced on a lead from last Tuesday and compared it with the reply you sent. Nothing was sent.</p>' +
      '<p class="ctx muted"><b style="color:var(--ink)">230 Mercer Ave</b> · Dev Patel, Zillow lead · asked about the HOA fee and parking</p>' +
      '<div class="ob-cmp"><div><h2 class="h">Ida\'s draft</h2><small class="muted">Practice · not sent</small><div class="ida-letter"><dl><dt>To</dt><dd>Dev Patel</dd><dt>Subject</dt><dd>230 Mercer Ave: HOA fee and parking</dd></dl><p>Hi Dev,</p><p>Thanks for asking about 230 Mercer Ave. The <span class="ida-marker" role="button" tabindex="0" data-doc="mercer-listing">HOA fee is $412 a month and includes one deeded parking space</span>, plus water and trash.</p><p>Would you like to see it this week? I have Thursday afternoon open.</p><p>Dana</p></div><span class="ida-hand">from the listing sheet, page 2</span></div>' +
      '<div><h2 class="h">What you sent</h2><small class="muted">From your email · Tue 10:20 am</small><div class="ida-letter"><dl><dt>To</dt><dd>Dev Patel</dd><dt>Subject</dt><dd>Re: 230 Mercer Ave</dd></dl><p>Hi Dev,</p><p>HOA is $412/mo and covers one deeded spot plus water and trash. Want to swing by Thursday after 2?</p><p>Dana</p></div></div></div>' +
      '<h2 class="h" style="margin-top:8px">Is this how you\'d reply?</h2>' + verdict +
      '<div class="ida-onb__foot"><p>Ida keeps practicing on every task you picked and shows you each draft. When 5 in a row look right, it suggests You approve; you decide.</p><div><button class="ida-btn ida-btn--quiet" type="button" data-go="3">Back</button>' + (v ? '<a class="ida-btn ida-btn--primary" href="./" data-finish style="text-decoration:none">Go to Today</a>' : '<a class="ida-btn ida-btn--quiet" href="./" data-finish>Skip to Today</a>') + '</div></div>';
  }
  function render() {
    var o = ob(), el = document.getElementById('onb');
    el.innerHTML = o.step === 3 ? step3() : o.step === 4 ? step4() : step2();
  }
  function setPick(id, on) { Ida.act.onboarding(function (o) { if (!o.picks) o.picks = picks(); o.picks[id] = on; }); }
  document.addEventListener('change', function (e) { var id = e.target.getAttribute && e.target.getAttribute('data-pick'); if (id) setPick(id, e.target.checked); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button, a'); if (!b) return; var v;
    if ((v = b.getAttribute('data-go'))) { verdictOpen = false; Ida.act.onboarding(function (o) { if (!o.picks) o.picks = picks(); o.step = +v; }); window.scrollTo(0, 0); var h = document.querySelector('#onb h1'); if (h) { h.tabIndex = -1; h.focus(); } return; }
    if (b.hasAttribute('data-show-missed')) { var f = document.getElementById('missed'); f.hidden = false; f.querySelector('input').focus(); return; }
    if (b.hasAttribute('data-hide-missed')) { document.getElementById('missed').hidden = true; return; }
    if ((v = b.getAttribute('data-conn'))) return ui.busy(b, 'Connecting…', 700, function () { Ida.act.onboarding(function (o) { o.apps[v] = true; }); });
    if (b.hasAttribute('data-verdict-not')) { verdictOpen = true; render(); return; }
    if (b.hasAttribute('data-verdict-cancel')) { verdictOpen = false; render(); return; }
    if (b.hasAttribute('data-verdict')) { verdictOpen = false; var x = b.getAttribute('data-verdict'); Ida.act.onboarding(function (o) { o.verdict = x || null; }); return; }
    if (b.hasAttribute('data-finish')) { Ida.act.onboarding(function (o) { o.finished = true; }); }
  });
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.id === 'missed') {
      var name = document.getElementById('m-name').value.trim(), col = document.getElementById('m-col').value;
      if (!name) { document.getElementById('m-name').focus(); return; }
      Ida.act.onboarding(function (o) { var id = 'x' + Date.now(); o.extra.push({ id: id, col: col, name: Ida.util.cap(name) }); if (!o.picks) o.picks = picks(); o.picks[id] = true; });
      return;
    }
    if (e.target.id === 'why') { verdictOpen = false; Ida.act.onboarding(function (o) { o.verdict = 'not'; }); }
  });
  S.subscribe(render);
  render();
})();
