// Workflows page screenshots: desktop (full), phone (full), phone dark, desktop dark.
// Usage: BASE=http://localhost:8772/ node shots_workflows.js <prefix>   (prefix: before | after)
const { chromium } = require('playwright');
const O = __dirname + '/shots'; const B = process.env.BASE || 'http://localhost:8765/'; const P = process.argv[2] || 'after';
(async () => {
  const b = await chromium.launch();
  const shot = async (opts, name, fn) => {
    const pg = await (await b.newContext(opts)).newPage();
    await pg.goto(B); await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.goto(B + 'workflows.html'); await pg.waitForTimeout(400);
    if (fn) await fn(pg);
    await pg.screenshot({ path: O + '/workflows-' + P + '-' + name + '.png', fullPage: true });
  };
  await shot({ viewport: { width: 1240, height: 900 } }, 'desktop');
  await shot({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone');
  await shot({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' }, 'phone-dark');
  if (P !== 'before') {
    await shot({ viewport: { width: 1240, height: 900 }, colorScheme: 'dark' }, 'desktop-dark-open', async pg => { await pg.locator('[data-wf-toggle="inspection"]').click(); await pg.waitForTimeout(200); });
    await shot({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone-open', async pg => { await pg.locator('[data-wf-toggle="showings"]').click(); await pg.waitForTimeout(200); });
  }
  await b.close();
})();
