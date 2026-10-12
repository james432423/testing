// Load every page, collect every href/src it references (after scripts run, including the side panel
// and Original views), add every file in docs/, and fetch each one: all must return 200 with no page errors.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765/'; const SITE = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1240, height: 900 } }); const p = await ctx.newPage();
  const errs = [], bad = [], urls = new Set();
  p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(p.url() + ' console :: ' + m.text()); });
  p.on('response', r => { if (r.status() >= 400) bad.push(r.url() + ' ' + r.status()); });
  const docs = JSON.parse(fs.readFileSync(path.join(__dirname, 'docs.json'), 'utf8'));
  const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).concat(Object.keys(docs).map(k => 'doc.html?d=' + k), Object.keys(docs).map(k => 'doc.html?d=' + k + '&view=original'));
  const collect = async () => (await p.evaluate(() => [...document.querySelectorAll('[href],[src]')].map(e => e.href || e.src).filter(Boolean))).forEach(u => urls.add(u.split('#')[0]));
  for (const u of pages) {
    await p.goto(BASE + u); await p.waitForTimeout(250); await collect();
    for (const f of p.frames()) { try { (await f.evaluate(() => [...document.querySelectorAll('[href],[src]')].map(e => e.href || e.src))).forEach(x => x && urls.add(x.split('#')[0])); } catch (e) {} }
  }
  // every client and contact panel on Being handled (Follow Up Boss link, Sent links, Today links)
  const pids = await (async () => { await p.goto(BASE + 'handled.html'); await p.waitForTimeout(250); return p.evaluate(() => Ida.store.get().people.map(x => x.id)); })();
  for (const id of pids) { await p.goto(BASE + 'handled.html#' + id); await p.waitForTimeout(200); await collect(); }
  // the old People URL redirects
  for (const u of ['people', 'people.html']) { const r = await ctx.request.get(BASE + u, { maxRedirects: 0 }); if (![301, 307, 308].includes(r.status()) || r.headers()['location'] !== '/handled') bad.push('redirect ' + u + ' ' + r.status()); }
  // open every source in the side panel from Today
  await p.goto(BASE); for (const k of Object.keys(docs)) { await p.evaluate(k => window.Ida.ui.openDoc(k), k); await p.waitForTimeout(400); await collect(); for (const f of p.frames()) { try { (await f.evaluate(() => [...document.querySelectorAll('[href],[src]')].map(e => e.href || e.src))).forEach(x => x && urls.add(x.split('#')[0])); } catch (e) {} } }
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  walk(path.join(SITE, 'docs')).forEach(f => urls.add(BASE + path.relative(SITE, f)));
  let n = 0;
  for (const u of urls) { if (!u.startsWith(BASE)) { if (!/^https:\/\/fonts\.g/.test(u) && u !== 'https://app.followupboss.com/' && !/^(mailto|tel|about|data|blob):/.test(u)) bad.push('external ' + u); continue; } const r = await ctx.request.get(u); n++; if (r.status() !== 200) bad.push(u + ' ' + r.status()); }
  console.log(JSON.stringify({ pagesLoaded: pages.length, urlsFetched: n, bad: [...new Set(bad)], errs }, null, 1));
  await b.close();
})();
