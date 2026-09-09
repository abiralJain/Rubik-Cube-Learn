// Every screen, phone size, headless. Usage: node scripts/shot-opal.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'shots';
const SCR = 'UDLFUBFFBDLFRRLBBRUURRFUFDDDLLUDDUBFBRRULDBBLUFRFBLDRL';
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const EMPTY = ['U','R','F','D','L','B'].map((f) => '....' + f + '....').join('');
const PARTIAL = 'UUU.U..U.RR..R.R.RF..FF.F..D..DD..DDL...L..LLB..BB.B..'.slice(0, 54);
const base = { paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } };
const seed = (state) => JSON.stringify({ state: { ...base, ...state }, version: 1 });
const shots = [
  { name: 'home-fresh', url: '/', state: { facelets: EMPTY } },
  { name: 'home-learning', url: '/', state: { facelets: SCR, learn: { start: SCR, card: 21, startedAt: Date.now() - 252000, elapsedMs: 252000 } } },
  { name: 'paint', url: '/paint', state: { facelets: PARTIAL, paintHistory: [{ index: 0, from: '.', to: 'U' }] } },
  { name: 'solved', url: '/solved', state: { facelets: SOLVED, solved: { ms: 512000, moves: 131, at: Date.now() } }, wait: 2600 },
  { name: 'camera', url: '/camera', state: { facelets: EMPTY }, nocube: true },
];
const browser = await chromium.launch();
const GPU = process.env.GPU ?? 'high';
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.addInitScript((g) => localStorage.setItem('cube.gpu', g), GPU);
  page.on('pageerror', (e) => console.log(s.name, 'pageerror', e.message));
  await page.goto('http://localhost:5173/');
  await page.evaluate((v) => localStorage.setItem('cube.session.v1', v), seed(s.state));
  await page.goto('http://localhost:5173' + s.url);
  if (!s.nocube) {
    await page.mouse.move(200, 300); // wakes a deferred cube
    await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 40000 }).catch(() => console.log(s.name, 'cube not ready'));
    await page.evaluate(() => { const c = window.__cube; if (c) { c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity(); c.invalidate(); } });
  }
  await page.waitForTimeout(s.wait ?? 900);
  await page.screenshot({ path: `${out}/${s.name}.png` });
  await page.close(); console.log(s.name);
}
await browser.close();
