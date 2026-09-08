import { chromium } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
const browser = await chromium.launch();
const page = await browser.newPage();
const b64 = readFileSync('public/poster/home.png').toString('base64');
for (const size of [540, 810, 1080]) {
  const out = await page.evaluate(async ([src, size]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/webp', 0.86);
  }, [b64, size]);
  const buf = Buffer.from(out.split(',')[1], 'base64');
  writeFileSync(`public/poster/home-${size}.webp`, buf);
  console.log(size, buf.length);
}
unlinkSync('public/poster/home.png');
await browser.close();
