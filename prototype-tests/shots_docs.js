// Screenshots: Today (desktop + phone, light + dark), side panel in Readable and Original modes, full-screen viewer.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/'; const O = __dirname + '/shots';
(async () => {
  const b = await chromium.launch({ channel: 'chromium' }); const errs = [];
  const shot = async (vp, scheme, url, name, fn) => {
    const c = await b.newContext({ viewport: vp, colorScheme: scheme, hasTouch: vp.width < 500, isMobile: vp.width < 500 }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(name + ' ' + e.message));
    await p.goto(BASE + url); await p.waitForTimeout(500); if (fn) await fn(p);
    await p.screenshot({ path: O + '/' + name + '.png' }); await c.close();
  };
  const D = { width: 1240, height: 900 }, M = { width: 390, height: 844 };
  await shot(D, 'light', '', 'today-desktop-light');
  await shot(D, 'dark', '', 'today-desktop-dark');
  await shot(M, 'light', '', 'today-phone-light');
  await shot(M, 'dark', '', 'today-phone-dark');
  const panel = async p => { await p.getByText('Open the report at page 4').first().click(); await p.waitForTimeout(1200); };
  await shot(D, 'light', '', 'panel-readable-desktop', panel);
  await shot(D, 'light', '', 'panel-original-desktop', async p => { await panel(p); const f = p.frameLocator('.ida-drawer iframe'); await f.getByRole('tab', { name: 'Original PDF' }).click(); await p.waitForTimeout(5000); });
  await shot(M, 'dark', '', 'panel-readable-phone-dark', async p => { await p.locator('.tw__i[data-doc="kim-email"]').click(); await p.waitForTimeout(1200); });
  await shot(M, 'light', '', 'panel-original-phone', async p => { await p.locator('.tw__i[data-doc="linden-agreement"]').click(); await p.waitForTimeout(1000); await p.frameLocator('.ida-drawer iframe').getByRole('tab', { name: 'Original PDF' }).click(); await p.waitForTimeout(5000); });
  await shot(D, 'light', 'report.html#cite', 'full-readable-report');
  await shot(D, 'dark', 'comps.html', 'full-readable-comps-dark');
  await shot(D, 'light', 'doc.html?d=ash-appraisal&view=original', 'full-original-appraisal', async p => { await p.waitForTimeout(5000); });
  console.log('shots done', errs);
  await b.close();
})();
