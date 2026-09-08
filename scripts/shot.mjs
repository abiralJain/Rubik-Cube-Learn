// Screenshots every route at the plan's viewports. Usage: node scripts/shot.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const routes = (process.env.ROUTES ?? '/,/paint,/learn,/solved,/camera').split(',');
const sizes = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const name = `shots/${r === '/' ? 'home' : r.slice(1)}-${w}x${h}.png`;
    await page.screenshot({ path: name });
    console.log(name);
  }
  await ctx.close();
}
await browser.close();
