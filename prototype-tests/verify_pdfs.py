"""Check each docs/<id>.pdf: page count matches DOCS, cited sentence is verbatim on the cited page,
every page has 'Page N of M', and the readable text (ida-doctext.js) has the same pages."""
import json, subprocess, sys, re, os
site, docs_json = sys.argv[1], sys.argv[2]
DOCS = json.load(open(docs_json)); bad = []
js = open(os.path.join(site, 'ida-doctext.js')).read(); T = json.loads(js[js.index('DOCTEXT = ') + 10: js.rindex('; })')])
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
for id_, d in DOCS.items():
    f = os.path.join(site, 'docs', id_ + '.pdf')
    if not os.path.exists(f): bad.append(id_ + ' missing'); continue
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.check_output(['pdfinfo', f]).decode()).group(1))
    want = d.get('pages', 1)
    if n != want: bad.append('%s pages %d != %d' % (id_, n, want))
    if len(T[id_]['pages']) != n: bad.append(id_ + ' readable page count differs')
    for i in range(1, n + 1):
        t = norm(subprocess.check_output(['pdftotext', '-f', str(i), '-l', str(i), '-layout', f, '-']).decode())
        tr = norm(subprocess.check_output(['pdftotext', '-f', str(i), '-l', str(i), f, '-']).decode())
        if 'Page %d of %d' % (i, n) not in t: bad.append('%s p%d footer' % (id_, i))
        if d.get('cite') and i == d.get('page', 1) and norm(d['cite']) not in tr: bad.append('%s cite not on p%d' % (id_, i))
print('PDF CHECK', 'OK' if not bad else bad, len(DOCS), 'docs')
