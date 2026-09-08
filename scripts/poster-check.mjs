import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/home-poster-${w}x${h}.png` });
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/home-live-${w}x${h}.png` });
  await page.close();
}
await browser.close(); console.log('ok');
