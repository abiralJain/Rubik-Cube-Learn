import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, dst, size] = process.argv.slice(2);
const browser = await chromium.launch(); const page = await browser.newPage();
const b64 = readFileSync(src).toString('base64');
const out = await page.evaluate(async ([s, n]) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = n; c.height = n; c.getContext('2d').drawImage(img, 0, 0, n, n); return c.toDataURL('image/webp', 0.88); }, [b64, Number(size)]);
writeFileSync(dst, out); await browser.close(); console.log('bytes', out.length);
