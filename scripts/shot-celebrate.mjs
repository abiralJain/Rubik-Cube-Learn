import { chromium } from 'playwright';
import Cube from 'cubejs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cube.fast', '1'); });
await page.evaluate((f) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })), Cube.random().asString());
await page.goto('http://localhost:5173/learn');
await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
// press Next until the praise line appears (first stage complete)
for (let i = 0; i < 80; i++) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(140);
  if (await page.locator('.praise').count()) break;
}
await page.waitForTimeout(350);
await page.screenshot({ path: 'shots/learn-celebrate-1440x900.png' });
await page.close();
// paint first-tap hint
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p2.goto('http://localhost:5173/');
await p2.evaluate(() => localStorage.clear());
await p2.goto('http://localhost:5173/paint');
await p2.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
await p2.waitForTimeout(900);
await p2.screenshot({ path: 'shots/paint-hint-390x844.png' });
await browser.close(); console.log('ok');
