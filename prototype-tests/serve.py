"""Local static server that sends the same response headers as site2/vercel.json, and applies
its redirects, so Playwright tests run under the production Content-Security-Policy.
Usage: python3 serve.py <site_dir> [port]"""
import http.server, json, os, re, sys, functools
SITE = os.path.abspath(sys.argv[1]); PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
CONF = json.load(open(os.path.join(SITE, 'vercel.json')))
RULES = [(re.compile('^' + r['source'] + '$'), r['headers']) for r in CONF.get('headers', [])]
REDIRECTS = {r['source']: (r['destination'], 308 if r.get('permanent') else 307) for r in CONF.get('redirects', [])}
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.ico': 'image/x-icon'}
    def send_head(self):
        path = self.path.split('?')[0].split('#')[0]
        if path in REDIRECTS:
            dest, code = REDIRECTS[path]
            q = self.path[len(path):].split('#')[0]
            self.send_response(code); self.send_header('Location', dest + q); self.send_header('Content-Length', '0'); self.end_headers()
            return None
        # cleanUrls: /handled serves handled.html, as on Vercel
        if CONF.get('cleanUrls') and path != '/' and '.' not in path.rsplit('/', 1)[-1] and os.path.isfile(os.path.join(SITE, path.lstrip('/') + '.html')):
            self.path = path + '.html' + self.path[len(path):]
        return super().send_head()
    def end_headers(self):
        path = self.path.split('?')[0].split('#')[0]
        sent = {}
        for rx, hs in RULES:
            if rx.match(path):
                for h in hs: sent[h['key']] = h['value']   # later rules override, like Vercel
        for k, v in sent.items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=SITE)).serve_forever()
