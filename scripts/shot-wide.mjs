import { chromium } from 'playwright';
const out = process.argv[2];
const SCR = 'UDLFUBFFBDLFRRLBBRUURRFUFDDDLLUDDUBFBRRULDBBLUFRFBLDRL';
const EMPTY = ['U','R','F','D','L','B'].map((f) => '....' + f + '....').join('');
const browser = await chromium.launch();
const GPU = process.env.GPU ?? 'high';
for (const [name, url, f, learn] of [['wide-home', '/', EMPTY, null], ['wide-learn', '/learn', SCR, { start: SCR, card: 3, startedAt: Date.now(), elapsedMs: 30000 }]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript((g) => localStorage.setItem('cube.gpu', g), GPU);
  await page.goto('http://localhost:5173/');
  await page.evaluate(([f, l]) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: l, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })), [f, learn]);
  await page.goto('http://localhost:5173' + url);
  await page.mouse.move(400, 400);
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 40000 }).catch(() => {});
  await page.evaluate(() => { const c = window.__cube; if (c) { c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity(); c.invalidate(); } });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` }); await page.close(); console.log(name);
}
await browser.close();
