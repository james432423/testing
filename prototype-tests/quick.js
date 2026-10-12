const { chromium } = require('playwright'); const B = process.env.BASE || 'http://localhost:8765/';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1240, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  for (const u of (process.argv[2] || '').split(',')) { await p.goto(B + u); await p.evaluate(() => localStorage.clear()); await p.goto(B + u); await p.waitForTimeout(400); await p.screenshot({ path: __dirname + '/shots/q-' + (u.replace(/\W/g, '') || 'index') + '.png', fullPage: true }); }
  console.log(errs); await b.close(); })();
