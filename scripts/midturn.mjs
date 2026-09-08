import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
await page.waitForTimeout(500);
const s = await page.evaluate(() => { const c = window.__cube; const canvas = document.querySelector('.cube3d canvas'); const r = canvas.getBoundingClientRect(); const p = c.stickers[18].position.clone(); p.applyQuaternion(c.qDrift.clone().multiply(c.qOrientation)); p.y += c.floatY; p.project(c.camera); return { x: r.left + (p.x+1)/2*r.width, y: r.top + (1-p.y)/2*r.height }; });
await page.mouse.move(s.x, s.y); await page.mouse.down();
for (let i = 1; i <= 6; i++) { await page.mouse.move(s.x + i * 12, s.y); await page.waitForTimeout(16); }
await page.screenshot({ path: 'shots/midturn-drag.png', clip: { x: 0, y: 60, width: 860, height: 840 } });
for (let i = 7; i <= 12; i++) { await page.mouse.move(s.x + i * 12, s.y); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(90);
await page.screenshot({ path: 'shots/midturn-snap.png', clip: { x: 0, y: 60, width: 860, height: 840 } });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/midturn-done.png', clip: { x: 0, y: 60, width: 860, height: 840 } });
await browser.close();
console.log('ok');
