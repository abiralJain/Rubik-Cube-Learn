// node scripts/shot-one.mjs /paint 390x844 1440x900 ...
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [route, ...sizes] = process.argv.slice(2);
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
for (const sz of sizes.length ? sizes : ['390x844', '1440x900']) {
  const [w, h] = sz.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5173' + route);
  await page.waitForFunction(() => !document.querySelector('.cube3d') || window.__cube?.ready === true, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
  const name = `shots/${route === '/' ? 'home' : route.slice(1).replace(/\W+/g, '-')}-${w}x${h}.png`;
  await page.screenshot({ path: name });
  console.log(name);
  await page.close();
}
await browser.close();
