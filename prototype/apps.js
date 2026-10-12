/* Connected apps: reconnect, manage with exact access, disconnect, connect new. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var CATALOG = [
    { id: 'docusign', name: 'DocuSign', logo: 'DS', desc: 'Tracks envelopes and chases missing signatures.', access: { see: ['Envelope status and signers'], do: ['Send reminders on envelopes you created'], never: ['Void or edit envelopes'] } },
    { id: 'skyslope', name: 'SkySlope', logo: 'SS', desc: 'Reads transaction files and checklists for your broker.', access: { see: ['Transaction files and checklist items'], do: ['Upload signed documents to the right file'], never: ['Submit files for broker review without you'] } },
    { id: 'showingtime', name: 'ShowingTime', logo: 'ST', desc: 'Sees showing requests and feedback on your listings.', access: { see: ['Showing requests and feedback'], do: ['Confirm showings you approve'], never: ['Change lockbox access'] } },
    { id: 'outlook', name: 'Outlook Calendar', logo: 'OC', desc: 'Reads and adds events, if you keep a second calendar.', access: { see: ['Events and free/busy times'], do: ['Add events you approve'], never: ['Delete your events'] } },
    { id: 'dropbox', name: 'Dropbox', logo: 'DB', desc: 'Files signed documents into your deal folders.', access: { see: ['Folders you pick'], do: ['Add files to those folders'], never: ['Delete or share files'] } },
    { id: 'kvcore', name: 'kvCORE', logo: 'KV', desc: 'Reads leads and updates their stage.', access: { see: ['Leads and activity'], do: ['Add notes and update stages'], never: ['Delete leads or send campaigns'] } },
    { id: 'realtor', name: 'Realtor.com', logo: 'RC', desc: 'Receives new leads from your Realtor.com profile.', access: { see: ['New leads and their messages'], do: ['Mark leads as contacted'], never: ['Change your profile'] } },
    { id: 'mls', name: 'Bright MLS', logo: 'ML', desc: 'Reads listing details, price changes and nearby sales.', access: { see: ['Listings, price changes and closed sales'], do: ['Nothing: read only'], never: ['Edit or publish listings'] } }
  ];
  var manageId = null, confirming = false;

  function usedBy(id) { return S.get().workflows.filter(function (w) { return (w.apps || []).indexOf(id) > -1; }); }
  function article(a) {
    var chip, btn, p = esc(a.desc), small = esc(a.sync);
    if (a.status === 'problem') { chip = '<span class="ida-chip ida-chip--problem">Problem · Disconnected</span>'; btn = '<button class="ida-btn ida-btn--primary" type="button" data-connect="' + esc(a.id) + '">Reconnect</button>'; p = esc(a.problemText || a.desc); }
    else if (a.status === 'off') { chip = '<span class="ida-chip">Not connected</span>'; btn = '<button class="ida-btn" type="button" data-connect="' + esc(a.id) + '">Connect</button>'; var paused = usedBy(a.id); if (paused.length) small = 'Paused until you connect it: ' + esc(paused.map(function (w) { return w.name; }).join(', ')); }
    else { chip = '<span class="ida-chip ida-chip--done">Connected</span>'; btn = '<button class="ida-btn ida-btn--quiet" type="button" data-manage="' + esc(a.id) + '">Manage</button>'; }
    if (a.id === 'qb' && a.status === 'connected') { var t = Q.task('t-commish'); small = Q.canHand(t) ? 'You can now hand Ida "Log commissions and expenses". <a href="tasks.html#t-commish" style="color:var(--ink)">Hand it over on Tasks</a>' : 'Logging commissions: ' + esc(Ida.LEVEL_NAME[Q.taskLevel(t)]); }
    return '<article class="ida-app' + (a.status === 'problem' ? ' is-problem' : '') + '" id="app-' + esc(a.id) + '">' + Ida.util.appLogo(a.id, a.name, a.logo) + '<div class="ida-app__t"><h2>' + esc(a.name) + ' ' + chip + '</h2><p>' + p + '</p><small>' + small + '</small></div>' + btn + '</article>';
  }
  function render() {
    var s = S.get(), list = s.apps.slice().sort(function (a, b) { return (a.status === 'problem' ? 0 : 1) - (b.status === 'problem' ? 0 : 1); });
    document.getElementById('applist').innerHTML = list.map(article).join('');
    if (manageId && ui.drawerOpen()) manage(manageId, true);
  }
  function connect(id, btn) {
    var a = Q.app(id), was = a.status;
    ui.busy(btn, was === 'problem' ? 'Reconnecting…' : 'Connecting…', 900, function () {
      A.connect(id);
      var msg = id === 'gcal' ? 'The showing scheduler is running again, and the showing for Marcus Lee is waiting on Today.' : id === 'qb' ? 'Log commissions and expenses can now be handed to Ida.' : 'Workflows that use it are running again.';
      ui.toast('<b>' + esc(a.name) + (was === 'problem' ? ' reconnected.' : ' connected.') + '</b> ' + msg);
    });
  }
  function list(title, items) { return '<div class="ida-access"><h3>' + title + '</h3><ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }
  function manage(id, keep) {
    var a = Q.app(id); manageId = id;
    var used = usedBy(id), html;
    if (a.status !== 'connected') {
      html = '<div class="ida-notice" role="status"><span><b>' + esc(a.name) + ' is disconnected.</b> ' + (used.length ? 'Paused until you connect it: ' + esc(used.map(function (w) { return w.name; }).join(', ')) + '.' : 'Nothing was using it.') + '</span></div><div class="ida-row-acts"><button class="ida-btn" type="button" data-connect="' + esc(id) + '">Connect again</button></div>';
    } else {
      html = list('Ida can see', a.access.see) + list('Ida can do', a.access.do) + list('Ida never', a.access.never) +
        '<dl class="ida-kv"><div><dt>Used by</dt><dd>' + (used.length ? used.map(function (w) { return '<a href="workflows.html#' + esc(w.id) + '">' + esc(w.name) + '</a>'; }).join(', ') : 'No workflows yet') + '</dd></div><div><dt>Status</dt><dd>' + esc(a.sync) + '</dd></div></dl>' +
        (confirming ? '<div class="ida-understood" role="alert"><b>Disconnect ' + esc(a.name) + '?</b><small>' + (used.length ? 'These pause until you connect it again: ' + esc(used.map(function (w) { return w.name; }).join(', ')) + '. ' : '') + 'Ida stops using it at once. Nothing already sent is affected.</small><div class="ida-row-acts" style="margin-top:8px"><button class="ida-btn" type="button" data-disconnect-yes="' + esc(id) + '">Disconnect</button><button class="ida-btn ida-btn--quiet" type="button" data-disconnect-no>Keep it connected</button></div></div>'
          : '<div class="ida-row-acts"><button class="ida-btn" type="button" data-disconnect="' + esc(id) + '">Disconnect</button></div>');
    }
    if (keep) { var m = document.querySelector('.ida-drawer__body'); if (m) { m.innerHTML = html; return; } }
    ui.openDrawer({ icon: a.logo, iconImg: Ida.util.appIcon(a.id), title: a.name, sub: 'Exactly what Ida can see and do', html: html });
  }
  function picker() {
    manageId = null;
    var have = {}; S.get().apps.forEach(function (a) { if (a.status === 'connected') have[a.id] = true; });
    var html = '<p class="ida-form__hint">Common tools for agents. Ida asks only for the access listed on each, and you can disconnect any time.</p>' +
      CATALOG.map(function (c) { return '<article class="ida-app" style="grid-template-columns:44px minmax(0,1fr) auto">' + Ida.util.appLogo(c.id, c.name, c.logo) + '<div class="ida-app__t"><h2 style="font-size:15px">' + esc(c.name) + '</h2><p style="font-size:14px;line-height:21px">' + esc(c.desc) + '</p></div>' + (have[c.id] ? '<span class="ida-chip ida-chip--done">Connected</span>' : '<button class="ida-btn" type="button" data-add="' + esc(c.id) + '">Connect</button>') + '</article>'; }).join('');
    ui.openDrawer({ title: 'Connect an app', sub: 'Pick a tool you already use', html: html });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var id;
    if ((id = b.getAttribute('data-connect'))) return connect(id, b);
    if ((id = b.getAttribute('data-manage'))) { confirming = false; return manage(id); }
    if ((id = b.getAttribute('data-disconnect'))) { confirming = true; return manage(id, true); }
    if (b.hasAttribute('data-disconnect-no')) { confirming = false; return manage(manageId, true); }
    if ((id = b.getAttribute('data-disconnect-yes'))) { confirming = false; var a = Q.app(id); ui.withUndo('<b>' + esc(a.name) + ' disconnected.</b> Ida stopped using it.', function () { A.disconnect(id); }); return; }
    if ((id = b.getAttribute('data-add'))) { var c = CATALOG.filter(function (x) { return x.id === id; })[0]; return ui.busy(b, 'Connecting…', 800, function () { A.addApp(c); picker(); ui.toast('<b>' + esc(c.name) + ' connected.</b> It\'s on your list with its access.'); }); }
    if (b.id === 'connect-app') return picker();
  });
  S.subscribe(render);
  render();
  ui.highlightHash();
})();
