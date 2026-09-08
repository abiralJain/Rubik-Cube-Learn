import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: name !== 'apple-touch-icon.png' });
  await page.close();
}
await browser.close(); console.log('icons ok');
