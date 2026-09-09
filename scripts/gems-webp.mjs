// public/gems/stage-N.png → stage-N.webp at 1024px (the milestone screen loads one at a time)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch(); const page = await browser.newPage();
for (let n = 1; n <= 7; n++) {
  const b64 = readFileSync(`public/gems/stage-${n}.png`).toString('base64');
  const out = await page.evaluate(async ([s]) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = c.height = 1024; c.getContext('2d').drawImage(img, 0, 0, 1024, 1024); return c.toDataURL('image/webp', 0.9); }, [b64]);
  const buf = Buffer.from(out.split(',')[1], 'base64'); writeFileSync(`public/gems/stage-${n}.webp`, buf); console.log(n, buf.length);
}
await browser.close();
