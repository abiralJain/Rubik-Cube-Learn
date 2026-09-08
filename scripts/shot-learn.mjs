import { chromium } from 'playwright';
import Cube from 'cubejs';
const browser = await chromium.launch();
const f = Cube.random().asString();
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5173/');
  await page.evaluate((f) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })), f);
  await page.goto('http://localhost:5173/learn');
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/learn-hold-${w}x${h}.png` });
  await page.getByRole('button', { name: /got it|next/i }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/learn-move-${w}x${h}.png` });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  console.log(w, 'errors', errs);
  await page.close();
}
await browser.close();
