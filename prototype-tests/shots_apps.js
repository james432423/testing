// Screenshots of Connected apps with the services' own icons (desktop, phone, picker, dark).
const { chromium } = require('playwright'); const O = process.argv[2] || __dirname + '/shots'; const B = process.env.BASE || 'http://localhost:8765/';
(async () => { const b = await chromium.launch();
  const d = await (await b.newContext({ viewport: { width: 1240, height: 900 } })).newPage();
  await d.goto(B + 'apps.html'); await d.waitForTimeout(600); await d.screenshot({ path: O + '/apps-desktop.png', fullPage: true });
  await d.locator('#connect-app').click(); await d.waitForTimeout(400); await d.screenshot({ path: O + '/apps-picker-desktop.png' });
  await d.locator('#drawer-close').click(); await d.locator('[data-manage]').first().click(); await d.waitForTimeout(300); await d.screenshot({ path: O + '/apps-manage-desktop.png' });
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await m.goto(B + 'apps.html'); await m.waitForTimeout(600); await m.screenshot({ path: O + '/apps-phone.png', fullPage: true });
  const k = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
  await k.goto(B + 'apps.html'); await k.waitForTimeout(600); await k.screenshot({ path: O + '/apps-phone-dark.png' });
  await k.goto(B + 'onboarding.html'); await k.locator('[data-go="3"]').click(); await k.waitForTimeout(400); await k.screenshot({ path: O + '/onboarding-apps-phone-dark.png' });
  await b.close(); })();
