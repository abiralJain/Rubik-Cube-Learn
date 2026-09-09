import { test, expect, type Page } from '@playwright/test';
import Cube from 'cubejs';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
async function seed(page: Page, facelets: string, fast = false) {
  await page.goto('/');
  await page.evaluate(([f, fast]) => {
    if (fast) localStorage.setItem('cube.fast', '1'); else localStorage.removeItem('cube.fast');
    localStorage.setItem('cube.gpu', 'low');
    localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, unlocked: {}, history: [], settings: { sound: false, voice: false, pace: 4, voiceURI: null, seenPaintHint: true, seenHold: true } }, version: 2 }));
  }, [facelets, fast] as const);
  await page.goto('/play');
  await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
}
const display = (page: Page) => page.evaluate(() => (window as unknown as { __cube: { displayFacelets: string } }).__cube.displayFacelets);
const meta = async (page: Page) => ((await page.locator('.play-head .meta').textContent()) ?? '');

test('the autopilot solves a random scramble with zero clicks and ends on the solved screen', async ({ page }) => {
  test.setTimeout(480_000); // headless software WebGL runs at ~10 fps; a 140-turn solve takes a few minutes
  await seed(page, Cube.random().asString(), true);
  await expect(page).toHaveURL(/\/solved/, { timeout: 450_000 });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')!).state);
  expect(state.facelets).toBe(SOLVED);
  expect(state.history.length).toBe(1);
  expect(Object.keys(state.unlocked).length).toBe(7);
});

test('a tap pauses the autopilot; a second tap resumes it', async ({ page }) => {
  await seed(page, Cube.random().asString());
  const pill = page.locator('.state-pill');
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(pill).toHaveAttribute('data-state', 'paused');
  const before = await meta(page);
  await page.waitForTimeout(2500);
  expect(await meta(page)).toBe(before); // nothing advanced while paused
  await pill.click();
  await expect(pill).not.toHaveAttribute('data-state', 'paused');
});

test('resume: reloading mid-solve comes back to the same move', async ({ page }) => {
  await seed(page, Cube.random().asString());
  await page.locator('.state-pill').click(); // pause so the card stays put
  const idle = () => page.waitForFunction(() => { const c = (window as unknown as { __cube: { active: unknown; queue: unknown[] } }).__cube; return !c.active && c.queue.length === 0; }, null, { timeout: 15_000 });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); await idle(); }
  await page.waitForTimeout(600); // let the last advance reach the store
  const m = await meta(page);
  const before = await display(page);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
  await page.locator('.state-pill').click(); // pause again before the autopilot moves on
  await expect(page.locator('.play-head .meta')).toContainText(m.split(' · ')[0]);
  expect(await display(page)).toBe(before);
});

test('with an invalid cube, Play sends you home', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBR', paintHistory: [], lastInput: 'paint', learn: null, solved: null, unlocked: {}, history: [], settings: { sound: false, voice: false, pace: 4, voiceURI: null, seenPaintHint: true, seenHold: true } }, version: 2 })));
  await page.goto('/play');
  await expect(page).toHaveURL(/\/$/);
});
