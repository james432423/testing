// Screenshots after removing People: Today, Being handled with a client panel open, Connected apps.
// Desktop 1240 and phone 390, light and dark. Usage: BASE=http://127.0.0.1:8790/ node shots_noppl.js
const { chromium } = require('playwright'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765/'; const OUT = path.join(__dirname, 'shots');
(async () => {
  const b = await chromium.launch();
  for (const [dev, vp] of [['desktop', { width: 1240, height: 900 }], ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const { width, height, ...rest } = vp; const ctx = await b.newContext({ viewport: { width, height }, ...rest, colorScheme: scheme }); const p = await ctx.newPage();
      await p.goto(BASE); await p.evaluate(() => localStorage.clear());
      for (const [name, u] of [['today', ''], ['handled-panel', 'handled.html#p-sarah'], ['apps', 'apps.html']]) {
        await p.goto(BASE + u); await p.waitForTimeout(600);
        if (name === 'apps') { await p.locator('[data-manage="fub"]').click(); await p.waitForTimeout(300); }
        await p.screenshot({ path: path.join(OUT, `np-${name}-${dev}-${scheme}.png`) });
      }
      await ctx.close();
    }
  }
  await b.close(); console.log('shots done');
})();
