import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import Cube from 'cubejs';

const seed = (f: string, extra: Record<string, unknown> = {}) => JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false }, ...extra }, version: 1 });
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

for (const route of ['/', '/paint', '/learn', '/solved']) {
  test(`axe: no serious or critical issues on ${route}`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((s) => localStorage.setItem('cube.session.v1', s), route === '/solved' ? seed(SOLVED, { solved: { ms: 60000, moves: 40, at: Date.now() } }) : seed(Cube.random().asString()));
    await page.goto(route);
    await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
    await page.waitForTimeout(route === '/solved' ? 3500 : 800);
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`)).toEqual([]);
  });
}
