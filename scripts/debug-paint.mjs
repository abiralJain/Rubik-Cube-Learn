import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/paint');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
await page.evaluate(() => window.__cube.setOrientation({ top: 'U', front: 'F', yaw: 0, pitch: 0 }, false));
await page.waitForTimeout(150);
await page.keyboard.press('3');
const xy = (i) => page.evaluate((i) => { const c = window.__cube; const canvas = document.querySelector('.cube3d canvas'); const r = canvas.getBoundingClientRect(); const p = c.stickers[i].position.clone(); p.applyQuaternion(c.qDrift.clone().multiply(c.qOrientation)); p.y += c.floatY; p.project(c.camera); return { x: r.left + (p.x+1)/2*r.width, y: r.top + (1-p.y)/2*r.height }; }, i);
const pick = (x, y) => page.evaluate(([x, y]) => { const c = window.__cube; const canvas = document.querySelector('.cube3d canvas'); const r = canvas.getBoundingClientRect(); const THREE = c.stickers[0].position.constructor; const ray = new (Object.getPrototypeOf(c).constructor.Raycaster || window.__Raycaster || function(){}); return null; }, [x, y]).catch(() => null);
for (const k of [0, 1, 2, 3, 5, 6, 7, 8]) {
  const p = await xy(18 + k);
  await page.mouse.click(p.x, p.y);
  const f = await page.evaluate(() => window.__cube.displayFacelets.slice(18, 27));
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')).state.paintHistory.map(e => e.index + ':' + e.to).join(' '));
  console.log(k, p.x.toFixed(0), p.y.toFixed(0), f, '|', hist);
}
await browser.close();
