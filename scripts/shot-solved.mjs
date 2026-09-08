import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', paintHistory: [], lastInput: 'paint', learn: null, solved: { ms: 252000, moves: 84, at: Date.now() }, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })));
  await page.goto('http://localhost:5173/solved');
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `shots/solved-${w}x${h}.png` });
  if (w === 390) { await page.getByRole('button', { name: /share/i }).click(); await page.waitForTimeout(1200); await page.screenshot({ path: `shots/solved-share-${w}x${h}.png` }); }
  await page.close();
}
await browser.close(); console.log('ok');
