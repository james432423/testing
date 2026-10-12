/* Phone tab bar: the More tab opens a sheet with the pages that don't fit in the bar.
   Standalone (no store), so the static first mock can use it too. */
(function () {
  'use strict';
  var PAGES = [['workflows.html', 'Workflows', 'What runs on its own, and trust levels'], ['rules.html', 'Your rules', 'What Ida always or never does, and when it tells you'], ['apps.html', 'Connected apps', 'What Ida can see and do in each tool']];
  var sheet, scrim, btn;
  function close() { if (!sheet) return; sheet.remove(); scrim.remove(); sheet = null; if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); } }
  function open(b) {
    btn = b; if (sheet) return close();
    scrim = document.createElement('div'); scrim.className = 'ida-scrim'; scrim.addEventListener('click', close);
    sheet = document.createElement('div'); sheet.className = 'ida-moresheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'More pages');
    var here = location.pathname.split('/').pop() || 'index.html'; if (here === 'practice.html') here = 'workflows.html';
    var head = document.createElement('div'); head.className = 'ida-moresheet__head';
    var h = document.createElement('b'); h.textContent = 'More'; head.appendChild(h);
    var x = document.createElement('button'); x.type = 'button'; x.className = 'ida-btn ida-btn--quiet'; x.textContent = 'Close'; x.addEventListener('click', close); head.appendChild(x);
    sheet.appendChild(head);
    PAGES.forEach(function (p) {
      var a = document.createElement('a'); a.href = p[0]; if (p[0] === here) a.setAttribute('aria-current', 'page');
      var t = document.createElement('b'); t.textContent = p[1]; var s = document.createElement('small'); s.textContent = p[2];
      a.appendChild(t); a.appendChild(s); sheet.appendChild(a);
    });
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    b.setAttribute('aria-expanded', 'true');
    var f = sheet.querySelector('a'); if (f) f.focus();
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-tabmore]'); if (b) { e.preventDefault(); open(b); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet) close(); });
})();
