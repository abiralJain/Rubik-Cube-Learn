import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', paintHistory: [], lastInput: 'paint', learn: null, solved: { ms: 252000, moves: 84, at: Date.now() }, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })));
await page.goto('http://localhost:5173/solved');
const t0 = Date.now();
for (const wait of [1500, 2500, 4000, 6000]) {
  await page.waitForTimeout(wait - (Date.now() - t0));
  console.log(wait, await page.evaluate(() => { const a = document.querySelector('.solved-actions'); const c = document.querySelector('.solved-copy'); return { copy: c ? getComputedStyle(c).opacity : null, actions: a ? [getComputedStyle(a).opacity, a.style.transform, a.style.opacity] : null, ready: window.__cube?.ready }; }));
}
await browser.close();
