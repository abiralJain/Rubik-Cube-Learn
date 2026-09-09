// Drive Learn to the end of stage 1 and capture the milestone screen. Usage: node scripts/shot-milestone.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2];
const SCR = 'UDLFUBFFBDLFRRLBBRUURRFUFDDDLLUDDUBFBRRULDBBLUFRFBLDRL';
const browser = await chromium.launch();
const GPU = process.env.GPU ?? 'high';
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.addInitScript((g) => localStorage.setItem('cube.gpu', g), GPU);
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/');
await page.evaluate((f) => { localStorage.setItem('cube.fast', '1'); localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })); }, SCR);
await page.goto('http://localhost:5173/learn');
await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 40000 });
for (let i = 0; i < 60; i++) {
  if (await page.locator('.milestone').count()) break;
  await page.keyboard.press('Space');
  await page.waitForTimeout(140);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/milestone.png` });
await browser.close(); console.log('ok');
