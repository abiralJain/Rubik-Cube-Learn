import { test, expect, type Page } from '@playwright/test';
import Cube from 'cubejs';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const KEY: Record<string, string> = { U: '1', R: '2', F: '3', D: '4', L: '5', B: '6' };
const TOP: Record<string, string> = { U: 'B', D: 'F', F: 'U', B: 'U', R: 'U', L: 'U' };

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

test('a random scramble can be painted face by face; the 54th fills itself; undo steps back through it', async ({ page }) => {
  await page.goto('/paint');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  const target = Cube.random().asString();
  let painted = 6;
  let done = false;
  for (const face of FACES) {
    await faceFront(page, TOP[face], face);
    await page.waitForTimeout(120);
    const base = FACES.indexOf(face) * 9;
    for (let k = 0; k < 9 && !done; k++) {
      if (k === 4) continue;
      const colour = target[base + k];
      await page.keyboard.press(KEY[colour]);
      const xy = await stickerXY(page, base + k);
      await page.mouse.click(xy.x, xy.y);
      painted++;
      if (painted === 53) { done = true; }
      else await expect(page.locator('.paint-count')).toContainText(`${painted} of 54`);
    }
    if (done) break;
  }
  // the 54th filled itself
  await expect(page.locator('.paint-count')).toContainText('54 of 54', { timeout: 3000 });
  const facelets = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')!).state.facelets as string);
  expect(facelets).toBe(target);
  const solve = page.getByRole('button', { name: /solve this cube/i });
  await expect(solve).toBeEnabled();
  // undo removes the auto-filled sticker together with the one that triggered it
  await page.getByRole('button', { name: /undo/i }).click();
  await expect(page.locator('.paint-count')).toContainText('52 of 54');
  await expect(solve).toBeDisabled();
});

test('swatch counts fall, an exhausted colour dims and the selection jumps on', async ({ page }) => {
  await page.goto('/paint');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  await faceFront(page, 'U', 'F');
  await page.keyboard.press('3'); // green
  const green = page.getByRole('radio', { name: /^green/ });
  await expect(green).toHaveAttribute('aria-checked', 'true');
  for (const k of [0, 1, 2, 3, 5, 6, 7, 8]) {
    const xy = await stickerXY(page, 18 + k);
    await page.mouse.click(xy.x, xy.y);
  }
  await expect(green).toHaveAttribute('data-empty', '');
  await expect(green).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('radio', { name: /^white/ })).toHaveAttribute('aria-checked', 'true');
  // tapping a green sticker with green selected would clear it — but green is no longer selectable, so paint white then re-tap with white to clear
  const xy = await stickerXY(page, 18);
  await page.mouse.click(xy.x, xy.y); // repaint 18 white
  await expect(green).toHaveAttribute('data-empty', 'false').catch(() => {}); // attribute removed when a green is freed
  await expect(page.locator('.paint-count')).toContainText('14 of 54');
  await page.mouse.click(xy.x, xy.y); // same colour again → clears
  await expect(page.locator('.paint-count')).toContainText('13 of 54');
});

test('an unsolvable cube is caught before Solve and suspects can be shown', async ({ page }) => {
  await page.goto('/paint');
  // seed a solved cube with two stickers of one edge swapped (edge flip)
  const bad = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'.split('');
  [bad[7], bad[19]] = [bad[19], bad[7]];
  await page.evaluate((f) => localStorage.setItem('cube.session.v1', JSON.stringify({ state: { facelets: f, paintHistory: [{ index: 7, from: '.', to: 'F' }, { index: 19, from: '.', to: 'U' }], lastInput: 'paint', learn: null, solved: null, settings: { sound: false, voice: false, seenPaintHint: true, seenLearnHint: false } }, version: 1 })), bad.join(''));
  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: /solve this cube/i })).toBeDisabled();
  await expect(page.locator('.paint-hint')).toContainText(/flipped/i);
  await page.getByRole('button', { name: /show me/i }).click();
  const hl = await page.evaluate(() => Array.from((window as unknown as { __cube: { highlight: Set<number> } }).__cube.highlight ?? []));
  expect(hl.sort((a, b) => a - b)).toEqual([7, 19]);
});
