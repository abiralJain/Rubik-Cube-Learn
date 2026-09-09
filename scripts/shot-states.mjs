// States and viewports. Usage: node scripts/shot-states.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2];
const SCR = 'UDLFUBFFBDLFRRLBBRUURRFUFDDDLLUDDUBFBRRULDBBLUFRFBLDRL';
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const bad = SOLVED.split(''); [bad[7], bad[19]] = [bad[19], bad[7]]; const BAD = bad.join('');
const EMPTY = ['U','R','F','D','L','B'].map((f) => '....' + f + '....').join('');
const base = { paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } };
const TAB = { width: 820, height: 1180 }, PH = { width: 390, height: 844 };
const shots = [
  { name: 'tab-home-invalid', vp: TAB, url: '/', state: { facelets: BAD, paintHistory: [{ index: 7, from: '.', to: 'F' }, { index: 19, from: '.', to: 'U' }] } },
  { name: 'tab-paint-invalid', vp: TAB, url: '/paint', state: { facelets: BAD, paintHistory: [{ index: 7, from: '.', to: 'F' }, { index: 19, from: '.', to: 'U' }] }, showme: true },
  { name: 'tab-learn-gate', vp: TAB, url: '/learn', state: { facelets: EMPTY }, nocube: true },
  { name: 'tab-learn', vp: TAB, url: '/learn', state: { facelets: SCR, learn: { start: SCR, card: 3, startedAt: Date.now(), elapsedMs: 30000 } } },
  { name: 'ph-home-ready', vp: PH, url: '/', state: { facelets: SCR } },
  { name: 'ph-home-fresh', vp: PH, url: '/', state: { facelets: EMPTY } },
];
const browser = await chromium.launch();
const GPU = process.env.GPU ?? 'high';
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.vp, deviceScaleFactor: 2 });
  await page.addInitScript((g) => localStorage.setItem('cube.gpu', g), GPU);
  page.on('pageerror', (e) => console.log(s.name, 'pageerror', e.message));
  await page.goto('http://localhost:5173/');
  await page.evaluate((v) => localStorage.setItem('cube.session.v1', v), JSON.stringify({ state: { ...base, ...s.state }, version: 1 }));
  await page.goto('http://localhost:5173' + s.url);
  if (!s.nocube) {
    await page.mouse.move(200, 300);
    await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 40000 }).catch(() => console.log(s.name, 'cube not ready'));
    await page.evaluate(() => { const c = window.__cube; if (c) { c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity(); c.invalidate(); } });
  }
  if (s.showme) { await page.getByRole('button', { name: /show me/i }).click().catch(() => {}); await page.waitForTimeout(600); }
  await page.waitForTimeout(900);
  try { await page.screenshot({ path: `${out}/${s.name}.png` }); } catch { await page.reload(); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${s.name}.png` }); }
  await page.close(); console.log(s.name);
}
await browser.close();
