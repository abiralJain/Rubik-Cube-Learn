import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', paintHistory: [], lastInput: 'paint', learn: null, solved: { ms: 252000, moves: 84, at: Date.now() }, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })));
  await page.goto('http://localhost:5173/solved');
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now(); let frames = 0; let timers = 0;
    const iv = setInterval(() => timers++, 50);
    const loop = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else { clearInterval(iv); res({ fps: frames / 2, timersPerSec: timers / 2, reveal: document.querySelector('.reveal')?.hasAttribute('data-in'), copy: !!document.querySelector('.solved-copy'), vis: document.visibilityState }); } };
    requestAnimationFrame(loop);
  }));
  console.log(w, r);
  await page.close();
}
await browser.close();
