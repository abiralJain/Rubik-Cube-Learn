import { test, expect, chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCR = 'UDLFUBFFBDLFRRLBBRUURRFUFDDDLLUDDUBFBRRULDBBLUFRFBLDRL';

/** Chrome's fake camera plays a Y4M file on a loop; we render all six sides of a known cube into one. */
function sixFaces(facelets: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cube-scan-'));
  const out = join(dir, 'six.y4m');
  execFileSync('node', [resolve('scripts/make-scan-y4m.mjs'), facelets, out, '40', '12'], { stdio: 'ignore' });
  return out;
}

test('the scanner reads all six sides with no button and lands on the solve', async () => {
  test.setTimeout(120_000);
  const file = sixFaces(SCR);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${file}`] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('cube.gpu', 'low'); });
  await page.goto('http://localhost:5173/scan');
  await expect(page.locator('.cam-frame video')).toBeVisible();
  // sides land one after another while the video plays; no clicks
  await expect(page.locator('.cam-dots i[data-done]')).toHaveCount(3, { timeout: 40_000 });
  await expect(page.locator('.cam-dots i[data-done]')).toHaveCount(6, { timeout: 40_000 });
  await expect(page).toHaveURL(/\/play/, { timeout: 10_000 });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1')!).state);
  expect(state.facelets).toBe(SCR);
  expect(state.learn?.start).toBe(SCR);
  await browser.close();
});

test('a side shown twice is refused with a sentence, not captured again', async () => {
  test.setTimeout(60_000);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${resolve('tests/fixtures/face-green.y4m')}`] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('cube.gpu', 'low'); });
  await page.goto('http://localhost:5173/scan');
  await expect(page.locator('.cam-dots i[data-done]')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('.cam-prompt')).toContainText(/green side.*red/i, { timeout: 5_000 });
  await page.waitForTimeout(2500);
  await expect(page.locator('.cam-dots i[data-done]')).toHaveCount(1);
  await browser.close();
});
