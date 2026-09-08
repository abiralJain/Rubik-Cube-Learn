import { chromium } from 'playwright';
import Cube from 'cubejs';
const browser = await chromium.launch();
// --- solved timing
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[solved]')) console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', paintHistory: [], lastInput: 'paint', learn: null, solved: { ms: 252000, moves: 84, at: Date.now() }, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })));
  await page.goto('http://localhost:5173/solved');
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  const t0 = Date.now();
  for (const w of [300, 1000, 1800, 2600, 4000]) { await page.waitForTimeout(Math.max(1, w - (Date.now() - t0))); console.log('solved +' + w, await page.evaluate(() => ({ copy: !!document.querySelector('.solved-copy'), actions: document.querySelector('.solved-actions') ? getComputedStyle(document.querySelector('.solved-actions')).opacity : null, bloom: window.__cube.bloomValue.toFixed(2), glow: document.querySelector('.glow')?.dataset.mode }))); }
  await page.close();
}
// --- learn highlight at desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/');
  await page.evaluate((f) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })), Cube.random().asString());
  await page.goto('http://localhost:5173/learn');
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /got it/i }).click();
  for (const w of [200, 900, 1800]) { await page.waitForTimeout(w); console.log('learn +' + w, await page.evaluate(() => { const c = window.__cube; const hl = c.highlight ? [...c.highlight] : null; const i = [...Array(54).keys()].find(k => !hl || !hl.includes(k)); const m = c.stickers[i].material; return { hl, i, color: m.color.getHexString(), env: m.envMapIntensity.toFixed(2), dimmed: c.dimmed[i].getHexString(), base: c.baseColor[i].getHexString(), cue: c.cue }; })); }
  await page.close();
}
await browser.close();
