// Renders the live cube once at the hero orientation into a transparent square poster (shown before WebGL boots).
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/?poster=1');
await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(() => { const c = window.__cube; c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity(); c.invalidate(); });
await page.waitForTimeout(200);
const canvas = page.locator('.cube3d canvas');
await canvas.screenshot({ path: 'public/poster/home.png', omitBackground: true });
await browser.close();
console.log('poster ok');
