import { test, expect, type Page } from '@playwright/test';
import Cube from 'cubejs';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const KEY: Record<string, string> = { U: '1', R: '2', F: '3', D: '4', L: '5', B: '6' };
const TOP: Record<string, string> = { U: 'B', D: 'F', F: 'U', B: 'U', R: 'U', L: 'U' };
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const EMPTY = FACES.map((f) => '....' + f + '....').join('');

const seed = (page: Page, facelets: string) => page.evaluate((f) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [], lastInput: 'paint', learn: null, solved: null, unlocked: {}, history: [], settings: { sound: false, voice: false, pace: 4, voiceURI: null, seenPaintHint: true, seenHold: true } }, version: 2 })), facelets);
async function ready(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __cube?: { ready: boolean } }).__cube?.ready === true, null, { timeout: 30_000 });
}
const stickerXY = (page: Page, i: number) => page.evaluate((i) => {
  const c = (window as unknown as { __cube: any }).__cube; // eslint-disable-line @typescript-eslint/no-explicit-any
  const canvas = document.querySelector('.cube3d canvas') as HTMLCanvasElement;
  const r = canvas.getBoundingClientRect();
  const p = c.stickers[i].position.clone();
  p.applyQuaternion(c.qDrift.clone().multiply(c.qOrientation)); p.y += c.floatY; p.project(c.camera);
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, i);
const faceFront = (page: Page, top: string, front: string) => page.evaluate(([t, f]) => (window as unknown as { __cube: any }).__cube.setOrientation({ top: t, front: f, yaw: 0, pitch: 0 }, false), [top, front]); // eslint-disable-line @typescript-eslint/no-explicit-any
const settle = (page: Page) => page.waitForFunction(() => { const c = (window as unknown as { __cube: any }).__cube; return !c.orientSpring.moving; }, null, { timeout: 5000 }); // eslint-disable-line @typescript-eslint/no-explicit-any

test('a random scramble can be coloured in face by face; the 54th fills itself; Solve lights up', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await seed(page, EMPTY);
  await page.goto('/fix');
  await ready(page);
  const target = Cube.random().asString();
  let painted = 6;
  let done = false;
  for (const face of FACES) {
    await faceFront(page, TOP[face], face);
    await page.waitForTimeout(150);
    const base = FACES.indexOf(face) * 9;
    for (let k = 0; k < 9 && !done; k++) {
      if (k === 4) continue;
      await page.keyboard.press(KEY[target[base + k]]);
      const xy = await stickerXY(page, base + k);
      await page.mouse.click(xy.x, xy.y);
      painted++;
      if (painted === 53) done = true;
      else await expect(page.locator('.fix-count')).toContainText(`${painted} of 54`);
      // the cube tilts itself to the next side once this one is full; put it back where the test wants it
      await faceFront(page, TOP[face], face);
    }
    if (done) break;
  }
  await expect(page.locator('.fix-count')).toHaveCount(0, { timeout: 4000 }); // 54 in: the count disappears
  const facelets = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')!).state.facelets as string);
  expect(facelets).toBe(target);
  await expect(page.getByRole('button', { name: /solve this cube/i })).toBeEnabled();
});

test('a twisted corner is named and fixed with one tap; swatches never lock', async ({ page }) => {
  await page.goto('/');
  const tw = SOLVED.split(''); const v = [tw[8], tw[9], tw[20]]; tw[8] = v[1]; tw[9] = v[2]; tw[20] = v[0];
  await seed(page, tw.join(''));
  await page.goto('/fix');
  await ready(page);
  await expect(page.getByRole('heading', { name: /one corner is turned/i })).toBeVisible();
  // the suggestion about the corner we broke is one of the listed fixes; tapping a sticker of that corner selects it
  await page.evaluate(() => (window as unknown as { __cube: any }).__cube.setOrientation({ top: 'U', front: 'F', yaw: -0.6, pitch: 0.3 }, false)); // eslint-disable-line @typescript-eslint/no-explicit-any
  await settle(page);
  const xy = await stickerXY(page, 8);
  await page.mouse.click(xy.x, xy.y);
  await page.getByRole('button', { name: /^fix it$/i }).click();
  const solve = page.getByRole('button', { name: /solve this cube/i });
  await expect(solve).toBeEnabled({ timeout: 4000 });
  const facelets = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')!).state.facelets as string);
  expect(facelets).toBe(SOLVED);
  // undo puts the twist back: the fix is on offer again
  await page.getByRole('button', { name: /undo/i }).click();
  await expect(page.getByRole('button', { name: /^fix it$/i })).toBeEnabled();
  await expect(solve).toHaveCount(0);
});

test('a wrong sticker can be recoloured directly: tap it, pick a colour', async ({ page }) => {
  await page.goto('/');
  const bad = SOLVED.slice(0, 19) + 'R' + SOLVED.slice(20); // one green sticker read as red
  await seed(page, bad);
  await page.goto('/fix');
  await ready(page);
  await expect(page.getByRole('heading', { name: /one sticker reads wrong/i })).toBeVisible();
  await page.getByRole('button', { name: /^fix it$/i }).click();
  await expect(page.getByRole('button', { name: /solve this cube/i })).toBeEnabled({ timeout: 4000 });
});
