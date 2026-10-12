/* Your rules: add with a confirm step, edit inline, toggles, learned suggestion. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, Q = Ida.q, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
  var editing = null, pending = null;

  function usedBy(id) { return S.get().workflows.filter(function (w) { return w.except && w.except.rule === id; }).map(function (w) { return w.name; }); }
  function li(r) {
    var used = usedBy(r.id), meta = esc(r.src) + (used.length ? ' · used by ' + esc(used.join(', ')) : '') + (r.on ? '' : ' · Off: Ida ignores this rule');
    if (editing === r.id) return '<li class="ida-rule" id="' + esc(r.id) + '"><form class="ida-rule__t" data-editform="' + esc(r.id) + '" style="display:flex;flex-wrap:wrap;gap:8px"><input class="ida-input" style="flex:1 1 260px" type="text" value="' + esc(r.text) + '" aria-label="Edit rule"><button class="ida-btn" type="submit">Save</button><button class="ida-btn ida-btn--quiet" type="button" data-canceledit>Cancel</button></form></li>';
    var acts = r.locked ? '<span class="ida-lock" title="Ida\'s default. It can\'t be turned off.">' + LOCK + 'Always on</span>'
      : '<button class="ida-btn ida-btn--quiet" type="button" data-edit="' + esc(r.id) + '">Edit</button><label class="ida-switch"><input type="checkbox" data-toggle="' + esc(r.id) + '"' + (r.on ? ' checked' : '') + ' aria-label="' + esc(r.text) + ': ' + (r.on ? 'on' : 'off') + '"><i></i></label>';
    return '<li class="ida-rule" id="' + esc(r.id) + '"><span class="ida-rule__t"><b' + (r.on ? '' : ' style="color:var(--ink-muted)"') + '>' + esc(r.text) + '</b><small>' + meta + '</small></span><span class="ida-rule__acts">' + acts + '</span></li>';
  }
  function render() {
    var s = S.get();
    var html = ['ask', 'never', 'write', 'always'].map(function (g) {
      var list = s.rules.filter(function (r) { return r.group === g; });
      if (!list.length && g === 'always') return '';
      return '<section class="ida-rulegroup" data-group="' + g + '"><h2>' + Ida.GROUPS[g] + '</h2><ul>' + (list.length ? list.map(li).join('') : '<li class="ida-rule"><span class="ida-rule__t"><small>No rules here yet.</small></span></li>') + '</ul></section>';
    }).join('');
    document.getElementById('rulegroups').innerHTML = html;
    var lp = document.getElementById('learn');
    if (s.learn === 'open') lp.innerHTML = '<p>You added the property address to the subject line in 4 drafts.</p><b>Always put the address in the subject?</b><div><button class="ida-btn" type="button" data-learn="yes">Make it a rule</button><button class="ida-btn ida-btn--quiet" type="button" data-learn="no">Not now</button></div>';
    else if (s.learn === 'done') lp.innerHTML = '<p><b style="color:var(--ink)">Added to How you write.</b> Ida will put the address in every subject line. <a href="#r-subject" style="color:var(--ink)">See the rule</a></p>';
    else lp.innerHTML = '<p>Ida won\'t suggest this again unless you keep making the same edit. <button class="ida-link" type="button" data-learn="undo">Show it again</button></p>';
    if (editing) { var i = document.querySelector('[data-editform] input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function guess(text) {
    var r = Ida.parse.rule(text);
    if (r) return r;
    var t = text.trim().replace(/[.!]+$/, '');
    return { group: /\b(sign|subject|words|tone|greet|formal|short|call (the|them))\b/i.test(t) ? 'write' : 'always', text: Ida.util.cap(t), guessed: true };
  }
  function showConfirm() {
    var c = document.getElementById('confirm');
    if (!pending) { c.hidden = true; c.innerHTML = ''; return; }
    c.hidden = false;
    c.innerHTML = '<div class="ida-understood"><small>Ida understood this as…</small><b>' + esc(Ida.GROUPS[pending.group]) + ': ' + esc(pending.text) + '</b><small>' + esc(Ida.parse.ruleMeaning(pending)) + (pending.guessed ? ' If that\'s not what you meant, pick the right group.' : '') + '</small></div>' +
      '<div class="ida-row-acts" style="margin-top:8px"><label class="ida-field" style="flex:0 1 220px">Group<select id="c-group">' + ['ask', 'never', 'write', 'always'].map(function (g) { return '<option value="' + g + '"' + (g === pending.group ? ' selected' : '') + '>' + Ida.GROUPS[g] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="ida-row-acts" style="margin-top:8px"><button class="ida-btn" type="button" data-confirm>Yes, add it</button><button class="ida-btn ida-btn--quiet" type="button" data-change>Change the wording</button></div>';
    c.querySelector('#c-group').addEventListener('change', function (e) { pending.group = e.target.value; pending.guessed = false; showConfirm(); });
  }
  document.getElementById('addrule').addEventListener('submit', function (e) {
    e.preventDefault();
    var i = document.getElementById('newrule'), v = i.value.trim();
    if (!v) { i.focus(); i.placeholder = 'Type a rule first, for example: never text clients after 8 pm'; return; }
    pending = guess(v); showConfirm();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var id;
    if (b.hasAttribute('data-confirm')) {
      var nid = A.addRule(pending), g = pending.group; pending = null; showConfirm(); document.getElementById('newrule').value = '';
      ui.toast('<b>Added to ' + esc(Ida.GROUPS[g]) + '.</b> It applies to every task from now on.');
      var el = document.getElementById(nid); if (el) ui.highlight(el); return;
    }
    if (b.hasAttribute('data-change')) { pending = null; showConfirm(); document.getElementById('newrule').focus(); return; }
    if ((id = b.getAttribute('data-edit'))) { editing = id; render(); return; }
    if (b.hasAttribute('data-canceledit')) { editing = null; render(); return; }
    var l = b.getAttribute('data-learn');
    if (l === 'yes') { A.learn(true); var r = document.getElementById('r-subject'); if (r) ui.highlight(r); return; }
    if (l === 'no') return A.learn(false);
    if (l === 'undo') return S.update(function (s) { s.learn = 'open'; });
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-editform]'); if (!f) return; e.preventDefault();
    var id = f.getAttribute('data-editform'), v = f.querySelector('input').value.trim();
    editing = null; if (v) A.editRule(id, v); else render();
    var el = document.getElementById(id); if (el) ui.highlight(el);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && editing) { editing = null; render(); } });
  document.addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-toggle'); if (!id) return;
    var on = e.target.checked, r = Q.rule(id);
    A.toggleRule(id, on);
    ui.toast('<b>' + (on ? 'Turned on' : 'Turned off') + ':</b> ' + esc(r.text) + '.');
  });
  S.subscribe(render);
  render();
  ui.highlightHash();
  window.addEventListener('hashchange', ui.highlightHash);
})();

/* Notification levels: where each kind of development shows up (Today's Needs you, the
   daily briefing, or only the log). Today follows these settings. */
(function () {
  'use strict';
  var Ida = window.Ida, S = Ida.store, A = Ida.act, ui = Ida.ui, esc = Ida.util.esc;
  var LV = ['log', 'brief', 'now'], WHERE = { log: 'Only in Sent and on Being handled', brief: 'In Today\'s briefing', now: 'On Today under Needs you' };
  function render() {
    var s = S.get(), el = document.getElementById('notifylist'); if (!el) return;
    el.innerHTML = '<div class="ida-lvkey">' + LV.map(function (l) { var n = Ida.EVENT_TYPES.filter(function (t) { return s.notify[t.id] === l; }).length; return '<div><b>' + esc(Ida.LEVELS_N[l]) + '</b><small>' + esc(WHERE[l]) + ' · ' + n + (n === 1 ? ' kind' : ' kinds') + '</small></div>'; }).join('') + '</div>' +
      '<ul class="ida-lvlist">' + Ida.EVENT_TYPES.map(function (t) {
        var cur = s.notify[t.id] || 'now';
        return '<li><span class="ida-rule__t"><b>' + esc(t.label) + '</b><small>For example: ' + esc(t.eg) + '</small></span>' +
          (t.locked ? '<span class="ida-lock" title="Ida can\'t act on these, so they always come to you.">' + '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>' + 'Always right away</span>'
            : '<label class="ida-lvsel"><span class="ida-vh">Where "' + esc(t.label) + '" goes</span><select data-notify="' + esc(t.id) + '">' + LV.map(function (l) { return '<option value="' + l + '"' + (l === cur ? ' selected' : '') + '>' + esc(Ida.LEVELS_N[l]) + '</option>'; }).join('') + '</select></label>') + '</li>';
      }).join('') + '</ul>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.matches || !t.matches('[data-notify]')) return;
    var ev = t.getAttribute('data-notify'), lv = t.value, type = Ida.EVENT_TYPES.filter(function (x) { return x.id === ev; })[0];
    ui.withUndo('<b>' + esc(type ? type.label : '') + ':</b> ' + esc(Ida.LEVELS_N[lv] || '') + '. Today follows it now.', function () { A.setNotify(ev, lv); });
  });
  S.subscribe(render); render(); ui.highlightHash();
})();
