import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import Cube from 'cubejs';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const seed = (f: string, extra: Record<string, unknown> = {}) => JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, unlocked: {}, history: [], settings: { sound: false, voice: false, pace: 4, voiceURI: null, seenPaintHint: true, seenHold: true }, ...extra }, version: 2 });

const ROUTES: Array<[string, (f: string) => string, boolean]> = [
  ['/', (f) => seed(f), true],
  ['/fix', (f) => seed(f.slice(0, 30) + '.' + f.slice(31)), true],
  ['/play', (f) => seed(f), true],
  ['/journey', (f) => seed(f, { unlocked: { 'white-cross': Date.now() }, history: [{ at: Date.now(), ms: 60000, moves: 40, start: f }] }), false],
  ['/learn', (f) => seed(f), false],
  ['/learn/white-cross', (f) => seed(f), true],
  ['/solved', () => seed(SOLVED, { solved: { ms: 60000, moves: 40, at: Date.now(), start: SOLVED } }), true],
];

for (const [route, state, cube] of ROUTES) {
  test(`axe: no serious or critical issues on ${route}`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((s) => { localStorage.setItem('cube.gpu', 'low'); localStorage.setItem('cube.session.v1', s); }, state(Cube.random().asString()));
    await page.goto(route);
    if (cube) await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
    await page.waitForTimeout(route === '/solved' ? 3500 : 800);
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`)).toEqual([]);
  });
}

test('every tabbed screen fits one phone viewport: nothing below the fold, nothing under the tab bar', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only');
  for (const [route, state, cube] of ROUTES.filter(([r]) => ['/', '/journey', '/learn'].includes(r))) {
    await page.goto('/');
    await page.evaluate((s) => { localStorage.setItem('cube.gpu', 'low'); localStorage.setItem('cube.session.v1', s); }, state(Cube.random().asString()));
    await page.goto(route);
    if (cube) await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
    expect(m.sh, `${route} scrolls by ${m.sh - m.ih}px`).toBeLessThanOrEqual(m.ih + 1);
    // the primary action must not sit under the floating tab bar
    const btn = page.locator('.dock .btn-primary').first();
    if (await btn.count()) {
      const b = (await btn.boundingBox())!; const t = (await page.locator('.tabbar').boundingBox())!;
      expect(b.y + b.height, `${route}: primary action overlaps the tab bar`).toBeLessThanOrEqual(t.y + 1);
    }
  }
});
