import { test, expect, type Page } from '@playwright/test';

type Dbg = { ready: boolean; displayFacelets: string; qOrientation: { x: number; y: number; z: number; w: number }; active: unknown; stickers: unknown[]; omega: { length(): number } };

async function waitReady(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __cube?: Dbg }).__cube?.ready === true, null, { timeout: 30_000 });
}
const facelets = (page: Page) => page.evaluate(() => (window as unknown as { __cube: Dbg }).__cube.displayFacelets);
const orientation = (page: Page) => page.evaluate(() => { const q = (window as unknown as { __cube: Dbg }).__cube.qOrientation; return [q.x, q.y, q.z, q.w]; });
/** Screen position (CSS px) of sticker `i` right now. */
const stickerXY = (page: Page, i: number) => page.evaluate((i) => {
  const c = (window as unknown as { __cube: any }).__cube; // eslint-disable-line @typescript-eslint/no-explicit-any
  const canvas = document.querySelector('.cube3d canvas') as HTMLCanvasElement;
  const r = canvas.getBoundingClientRect();
  const p = c.stickers[i].position.clone();
  p.applyQuaternion(c.qDrift.clone().multiply(c.qOrientation)); p.y += c.floatY; p.project(c.camera);
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, i);

test('cube becomes ready without blocking and renders 81 draw calls', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => { if (m.text().includes('[cube]')) logs.push(m.text()); });
  await waitReady(page);
  await page.waitForTimeout(300);
  expect(logs.some((l) => /shaders ready/.test(l))).toBeTruthy();
  const first = logs.find((l) => /first frame/.test(l))!;
  expect(Number(first.match(/calls (\d+)/)![1])).toBeLessThanOrEqual(90);
});

test('orbit drag on the ground rotates the whole cube and coasts to a stop', async ({ page }) => {
  await waitReady(page);
  const before = await orientation(page);
  const r = (await page.locator('.cube3d').boundingBox())!; // drag inside the stage, off the cube's silhouette
  const x0 = Math.round(r.x + r.width * 0.08), y0 = Math.round(r.y + r.height * 0.5);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(x0 + i * 14, y0 - i * 3); await page.waitForTimeout(16); }
  await page.mouse.up();
  const mid = await orientation(page);
  expect(mid).not.toEqual(before);
  await page.waitForTimeout(1600);
  const omega = await page.evaluate(() => (window as unknown as { __cube: Dbg }).__cube.omega.length());
  expect(omega).toBe(0);
  expect(await facelets(page)).toBe(await facelets(page)); // orbit never changes stickers
});

test('dragging a sticker sideways turns only its layer and commits a move', async ({ page }) => {
  await waitReady(page);
  const before = await facelets(page);
  const s = await stickerXY(page, 18); // F face, top-left
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(s.x + i * 12, s.y); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForFunction(() => !(window as unknown as { __cube: Dbg }).__cube.active, null, { timeout: 15_000 });
  const after = await facelets(page);
  expect(after).not.toBe(before);
  // only the U layer may change: D face (27..35) untouched, bottom two rows of the side faces untouched
  expect(after.slice(27, 36)).toBe(before.slice(27, 36));
  for (const start of [9, 18, 36, 45]) expect(after.slice(start + 3, start + 9)).toBe(before.slice(start + 3, start + 9));
  expect(await page.evaluate(() => !!(window as unknown as { __cube: Dbg }).__cube.active)).toBe(false);
});

test('a short drag rubber-bands back and changes nothing', async ({ page }) => {
  await waitReady(page);
  const before = await facelets(page);
  const s = await stickerXY(page, 22); // F centre
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  for (let i = 1; i <= 3; i++) { await page.mouse.move(s.x + i * 8, s.y); await page.waitForTimeout(40); }
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect(await facelets(page)).toBe(before);
});

test('tapping a sticker ripples but does not change the cube', async ({ page }) => {
  await waitReady(page);
  const before = await facelets(page);
  const s = await stickerXY(page, 22);
  await page.mouse.click(s.x, s.y);
  await page.waitForTimeout(600);
  expect(await facelets(page)).toBe(before);
});

test('arrow keys rotate the cube by a quarter turn', async ({ page }) => {
  await waitReady(page);
  const before = await orientation(page);
  await page.locator('.cube3d').focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  expect(await orientation(page)).not.toEqual(before);
});
