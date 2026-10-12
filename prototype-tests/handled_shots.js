// Usage: node handled_shots.js <port> <prefix>  -> shots/handled-<prefix>-{desktop,phone,phone-dark,panel}.png
const { chromium } = require('playwright');
const port = process.argv[2], pre = process.argv[3], O = __dirname + '/shots/handled-' + pre;
(async () => {
  const b = await chromium.launch(); const U = 'http://localhost:' + port + '/handled.html';
  const mk = async (o) => { const c = await b.newContext(o); const p = await c.newPage(); await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U); await p.waitForTimeout(400); return p; };
  let p = await mk({ viewport: { width: 1240, height: 900 } });
  await p.screenshot({ path: O + '-desktop.png', fullPage: true });
  if (await p.locator('[data-client]').count()) { await p.locator('[data-client="p-parks"]').first().click(); await p.waitForTimeout(300); await p.screenshot({ path: O + '-panel.png' }); }
  p = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.screenshot({ path: O + '-phone.png', fullPage: true });
  p = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await p.screenshot({ path: O + '-phone-dark.png', fullPage: true });
  await b.close();
})();
