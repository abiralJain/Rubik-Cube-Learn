import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('the camera fills the guide with detected colours and auto-captures a steady face', async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${resolve('tests/fixtures/face-green.y4m')}`] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await page.goto('http://localhost:5173/camera');
  await expect(page.locator('.cam-frame video')).toBeVisible();
  // the fake camera shows a green-centred face: the guide cells fill and the face auto-captures
  await expect(page.locator('.cam-dots i[data-done]')).toHaveCount(1, { timeout: 15_000 });
  const facelets = await page.evaluate(() => JSON.parse(localStorage.getItem('cube.session.v1') ?? '{}')?.state?.facelets ?? null);
  // F face is indices 18..26 in the store once all six are captured; before that the page keeps it locally — check the live preview instead
  const preview = await page.evaluate(() => (window as unknown as { __cube: { displayFacelets: string } }).__cube.displayFacelets);
  expect(preview.slice(18, 27)).toBe('FUFRFLDBF');
  void facelets;
  await expect(page.locator('.cam-prompt')).toContainText(/red/i);
  await browser.close();
});
