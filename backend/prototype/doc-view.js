/* Source document viewer. Renders one document from Ida.DOCS + Ida.DOCTEXT:
   - Readable: every page of the original as easy-to-read text, the cited passage
     highlighted and scrolled into view, each page one tap from the original.
   - Original: the real file (docs/<id>.pdf) at the cited page, plus Open PDF / Download.
   Document id: <body data-doc> or ?d=<id>. ?embed=1 for the side panel.
   ?view=original opens the Original tab; #page-N jumps to a page; #cite to the highlight. */
(function () {
  'use strict';
  var Ida = window.Ida, esc = Ida.util.esc;
  var qs = location.search;
  var embed = /[?&]embed=1/.test(qs);
  if (embed) document.documentElement.classList.add('embed');
  var m = qs.match(/[?&]d=([^&]+)/);
  var id = document.body.getAttribute('data-doc') || (m ? decodeURIComponent(m[1]) : '');
  var d = Ida.DOCS[id], T = Ida.DOCTEXT && Ida.DOCTEXT[id];
  var root = document.getElementById('dv');
  var EXT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>';

  if (!d || !T) {
    root.innerHTML = '<div class="rp-bar"><a href="./">← Back to Today</a></div><div class="rp-wrap"><section class="rp-page"><h2>This sample doesn\'t include that document.</h2><p><a href="./">Back to Today</a></p></section></div>';
    return;
  }

  var n = T.pages.length, cp = d.page || 1, file = T.file;
  /* Phones and tablets often can't show a PDF inside a page (Android shows nothing, iOS only page 1),
     so touch devices see a picture of the original page, with the file itself one tap away. */
  var pictures = !!T.img && (/[?&]orig=img/.test(qs) || (window.matchMedia && matchMedia('(pointer: coarse)').matches && !/[?&]orig=pdf/.test(qs)));
  var KIND = { pdf: ['Original PDF', 'the original PDF'], email: ['Original email', 'the original email, printed to PDF'], mls: ['Original listing', 'the original MLS printout'], sig: ['Original record', 'the original envelope record, printed to PDF'] };
  var kind = KIND[T.kind] || KIND.pdf;
  var whoShort = d.who.split(' · ').slice(0, 2).join(' · ');
  document.title = d.title + ' · ' + d.who.split(' · ')[0] + ' (sample)';

  function withCite(text) {
    var t = esc(text);
    if (!d.cite) return t;
    var c = esc(d.cite), i = t.indexOf(c);
    if (i < 0) return t;
    return t.slice(0, i) + '<mark id="cite">' + c + '</mark>' + t.slice(i + c.length);
  }
  function hasCite(b) { return d.cite && JSON.stringify(b).indexOf(d.cite.slice(0, 40)) > -1; }
  function block(b, pageN) {
    var k = b[0], pre = '';
    if (hasCite(b) && pageN === cp) pre = '<span class="dv-from">Ida read this · page ' + cp + ' of the original</span>';
    if (k === 'h') return '<h2>' + esc(b[1]) + '</h2>';
    if (k === 'p') return pre + '<p>' + withCite(b[1]) + '</p>';
    if (k === 'small') return '<p class="dv-small">' + withCite(b[1]) + '</p>';
    if (k === 'item') return pre + '<p><b>' + esc(b[1]) + ' · ' + esc(b[2]) + '.</b> ' + withCite(b[3]) + '</p>';
    if (k === 'ul') return '<ul>' + b[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (k === 'kv') return '<dl class="rp-facts">' + b[1].map(function (r) { return '<div class="rp-f"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (k === 'table') return '<div class="dv-tbl"><table><thead><tr>' + b[1].map(function (x) { return '<th scope="col">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      b[2].map(function (r) { return '<tr>' + r.map(function (x, i) { return i === 0 ? '<th scope="row">' + esc(x) + '</th>' : '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (k === 'sig') return '<div class="dv-sig">' + b[1].map(esc).join('<br>') + '</div>';
    return '';
  }
  function pdfHref(p) { return file + '#page=' + p; }

  var pagesHtml = T.pages.map(function (pg) {
    return '<article class="rp-page" id="page-' + pg.n + '" aria-label="Page ' + pg.n + ' of ' + n + '">' +
      '<header class="rp-ph"><span>' + esc(T.org) + ' · ' + esc(T.title) + '</span><span>Page ' + pg.n + ' of ' + n + ' · <button type="button" class="dv-linkbtn" data-orig="' + pg.n + '">See this page in the original</button></span></header>' +
      pg.blocks.map(function (b) { return block(b, pg.n); }).join('') + '</article>';
  }).join('');

  root.innerHTML =
    '<div class="rp-bar"><a href="./">← Back to Today</a><div class="rp-doc"><span class="ida-source__icon" aria-hidden="true">' + esc(d.icon) + '</span><span><b>' + esc(d.title) + '</b><small>' + esc(d.who) + ' · ' + n + (n === 1 ? ' page' : ' pages') + '</small></span></div></div>' +
    '<div class="dv-tools"><div class="dv-tabs" role="tablist" aria-label="How to view this document">' +
      '<button type="button" role="tab" id="tab-read" aria-controls="pane-read" aria-selected="true">Readable</button>' +
      '<button type="button" role="tab" id="tab-orig" aria-controls="pane-orig" aria-selected="false" tabindex="-1">' + kind[0] + '</button></div>' +
      '<span class="dv-links"><a id="open-pdf" href="' + esc(pdfHref(cp)) + '" target="_blank" rel="noopener">Open PDF' + EXT + '</a><a href="' + esc(file) + '" download="' + esc(id) + '.pdf">Download</a></span></div>' +
    '<div class="rp-wrap" id="pane-read" role="tabpanel" aria-labelledby="tab-read">' +
      '<p class="dv-note">Readable text converted from ' + kind[1] + (n > 1 ? ', all ' + n + ' pages' : '') + '. ' +
        (d.cite ? 'The highlighted passage is on <b>page ' + cp + '</b>. ' : '') + '<button type="button" class="dv-linkbtn" data-orig="' + cp + '">See page ' + cp + ' in the original</button></p>' +
      pagesHtml + '</div>' +
    '<div class="dv-orig" id="pane-orig" role="tabpanel" aria-labelledby="tab-orig" hidden>' +
      '<p class="dv-note" id="orig-note"></p>' +
      (pictures ? '<figure class="dv-shot"><div class="dv-pager"><button type="button" class="ida-btn" data-step="-1">Previous page</button><span id="shot-n" aria-live="polite"></span><button type="button" class="ida-btn" data-step="1">Next page</button></div><img id="shot" alt=""></figure>'
                : '<iframe class="dv-pdf" id="pdf" title="' + esc(kind[0]) + '"></iframe>') + '</div>';

  var tabR = document.getElementById('tab-read'), tabO = document.getElementById('tab-orig');
  var paneR = document.getElementById('pane-read'), paneO = document.getElementById('pane-orig');
  var frame = document.getElementById('pdf'), openPdf = document.getElementById('open-pdf'), note = document.getElementById('orig-note');
  var shownPage = 0;

  function setUrl(view) {
    try { var u = new URL(location.href); if (view === 'original') u.searchParams.set('view', 'original'); else u.searchParams.delete('view'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* ignore */ }
  }
  function showOriginal(p, focus, keepScroll) {
    p = Math.min(Math.max(1, p || cp), n);
    tabR.setAttribute('aria-selected', 'false'); tabR.tabIndex = -1; tabO.setAttribute('aria-selected', 'true'); tabO.tabIndex = 0;
    paneR.hidden = true; paneO.hidden = false;
    if (pictures) {
      var img = document.getElementById('shot');
      img.src = T.img.replace('{n}', p); img.alt = 'Page ' + p + ' of ' + n + ' of the original ' + d.title.toLowerCase();
      document.getElementById('shot-n').textContent = 'Page ' + p + ' of ' + n;
      paneO.querySelector('[data-step="-1"]').disabled = p <= 1; paneO.querySelector('[data-step="1"]').disabled = p >= n;
      shownPage = p;
    } else {
      if (shownPage !== p) { frame.src = file + '?p=' + p + '#page=' + p; shownPage = p; }
      frame.title = kind[0] + ', page ' + p + ' of ' + n;
    }
    openPdf.href = pdfHref(p);
    note.innerHTML = (pictures ? 'A picture of the original file at <b>page ' + p + ' of ' + n + '</b>' : 'The original file, opened at <b>page ' + p + ' of ' + n + '</b>') + (p === cp && d.cite ? ', where Ida read the highlighted passage' : '') + '. It has no highlight. ' + (pictures ? 'For the file itself, use' : 'If it doesn\'t show here, use') + ' <a class="dv-linkbtn" href="' + esc(pdfHref(p)) + '" target="_blank" rel="noopener">Open PDF</a>. ' +
      '<button type="button" class="dv-linkbtn" data-read="' + p + '">Back to the readable text</button>';
    setUrl('original'); if (!keepScroll) window.scrollTo(0, 0);
    if (focus) tabO.focus();
  }
  function showReadable(target, focus) {
    tabO.setAttribute('aria-selected', 'false'); tabO.tabIndex = -1; tabR.setAttribute('aria-selected', 'true'); tabR.tabIndex = 0;
    paneO.hidden = true; paneR.hidden = false; openPdf.href = pdfHref(cp);
    setUrl('readable');
    var el = target && document.getElementById(target);
    if (el) el.scrollIntoView({ block: target === 'cite' ? 'center' : 'start' });
    if (focus) tabR.focus();
  }

  tabR.addEventListener('click', function () { showReadable(null); });
  tabO.addEventListener('click', function () { showOriginal(cp); });
  document.querySelector('.dv-tabs').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); if (tabR.getAttribute('aria-selected') === 'true') showOriginal(cp, true); else showReadable(null, true); }
  });
  root.addEventListener('click', function (e) {
    var st = e.target.closest('[data-step]');
    if (st) { showOriginal(shownPage + +st.getAttribute('data-step'), false, true); return; }
    var t = e.target.closest('[data-orig],[data-read]'); if (!t) return;
    if (t.hasAttribute('data-orig')) showOriginal(+t.getAttribute('data-orig'));
    else showReadable('page-' + t.getAttribute('data-read'));
  });

  // initial view
  var hp = location.hash.match(/^#page-(\d+)$/), qp = qs.match(/[?&]page=(\d+)/);
  if (/[?&]view=original/.test(qs)) showOriginal(qp ? +qp[1] : (hp ? +hp[1] : cp));
  else {
    var target = hp ? 'page-' + hp[1] : (d.cite ? 'cite' : null);
    var go = function () { var el = target && document.getElementById(target); if (el) el.scrollIntoView({ block: target === 'cite' ? 'center' : 'start' }); };
    go(); setTimeout(go, 60);
    var c = document.getElementById('cite'); if (c && (!hp || +hp[1] === cp)) c.classList.add('is-flash');
  }
})();
