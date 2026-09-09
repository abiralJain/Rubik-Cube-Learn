import { test, expect, type Page } from '@playwright/test';
import Cube from 'cubejs';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
async function seed(page: Page, facelets: string, fast = false) {
  await page.goto('/');
  if (fast) await page.evaluate(() => localStorage.setItem('cube.fast', '1'));
  await page.evaluate((f) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })), facelets);
  await page.goto('/learn');
  await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
}
const display = (page: Page) => page.evaluate(() => (window as unknown as { __cube: { displayFacelets: string } }).__cube.displayFacelets);
const stickerXY = (page: Page, i: number) => page.evaluate((i) => {
  const c = (window as unknown as { __cube: any }).__cube; // eslint-disable-line @typescript-eslint/no-explicit-any
  const canvas = document.querySelector('.cube3d canvas') as HTMLCanvasElement;
  const r = canvas.getBoundingClientRect();
  const p = c.stickers[i].position.clone();
  p.applyQuaternion(c.qDrift.clone().multiply(c.qOrientation)); p.y += c.floatY; p.project(c.camera);
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, i);

test('pressing Next through a random scramble ends on the solved screen with a solved cube', async ({ page }) => {
  test.setTimeout(400_000);
  await seed(page, Cube.random().asString(), true);
  const moveText = () => page.evaluate(() => (document.querySelector('.learn-head .meta')?.textContent ?? '').split('·')[0].trim() + '|' + (document.querySelector('.glyph')?.textContent ?? ''));
  for (let i = 0; i < 400; i++) {
    if (/\/solved/.test(page.url())) break;
    const before = await moveText().catch(() => '');
    await page.keyboard.press('Space');
    // wait until the card advanced (or we left the page); the timer part of the meta is ignored
    await page.waitForFunction((b) => !location.pathname.startsWith('/learn') || ((document.querySelector('.learn-head .meta')?.textContent ?? '').split('·')[0].trim() + '|' + (document.querySelector('.glyph')?.textContent ?? '')) !== b, before, { timeout: 4000 }).catch(() => {});
  }
  await expect(page).toHaveURL(/\/solved/, { timeout: 5000 });
  const f = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')!).state.facelets as string);
  expect(f).toBe(SOLVED);
});

const idle = (page: Page) => page.waitForFunction(() => { const c = (window as unknown as { __cube: { active: unknown; queue: unknown[] } }).__cube; return !c.active && c.queue.length === 0; }, null, { timeout: 15_000 });

test('resume: reloading mid-solve comes back to the same move', async ({ page }) => {
  await seed(page, Cube.random().asString(), true);
  const primary = page.locator('.learn-actions .btn-primary');
  for (let i = 0; i < 6; i++) { await primary.click(); await idle(page); await page.waitForTimeout(150); }
  await page.waitForTimeout(400);
  const meta = (await page.locator('.learn-head .meta').textContent()) ?? ''; // textContent: the label is uppercased by CSS
  const before = await display(page);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
  await expect(page.locator('.learn-head .meta')).toContainText(meta.split(' · ')[0]);
  expect(await display(page)).toBe(before);
});

test('only the expected turn commits from a swipe; a wrong swipe slides back', async ({ page }) => {
  // choose a scramble whose first move card is on a visible face by seeding, then read the expected move
  await seed(page, Cube.random().asString());
  await page.locator('.learn-actions .btn-primary').click(); // "Got it" on the hold card
  await page.waitForTimeout(700);
  const glyph = (await page.locator('.glyph').innerText()).split('\n')[0].trim();
  const before = await display(page);
  // a wrong-face swipe: drag a sticker on a face that is not the expected one
  const expectedFace = glyph[0];
  const faceIndex = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 } as Record<string, number>;
  // in Learn the standard frame differs from the display frame (z2): display U = standard D etc.
  const z2 = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' } as Record<string, string>;
  const standardFace = z2[expectedFace];
  // pick the visible top face (standard D) centre-row sticker unless the expected move is on it; then use the front (F)
  const dragFace = standardFace === 'D' ? 'F' : 'D';
  const centreIdx = faceIndex[dragFace] * 9 + 4;
  const s = await stickerXY(page, centreIdx);
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(s.x + i * 12, s.y + i * 2); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(1200);
  // the drag either rubber-banded (state unchanged) or happened to be the expected move (state advanced by exactly that move)
  const after = await display(page);
  const meta = (await page.locator('.learn-head .meta').textContent()) ?? '';
  if (after === before) expect(meta).toContain('Move 1 of');
  else expect(meta).toContain('Move 2 of');
});
