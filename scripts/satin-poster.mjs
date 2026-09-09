// Renders the cube with a satin, premium finish (runtime material overrides) into a transparent PNG for the design mock.
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'satin.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/?poster=1');
await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
await page.evaluate(() => {
  const c = window.__cube;
  c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity();
  // yellow-up, green-front hold as in Learn, slight yaw to reveal the right side
  c.setOrientation({ top: 'D', front: 'F', yaw: -0.5, pitch: 0.14 }, false);
  const Phys = c.stickers[0].material.constructor;
  // satin body with a faint thin-film edge shimmer
  const body = new Phys({ color: '#2B2A33', roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.35, iridescence: 0.35, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 380], envMapIntensity: 0.9 });
  c.bodies.forEach((m) => { m.material = body; });
  for (const m of c.stickers) { const mat = m.material; mat.roughness = 0.22; mat.clearcoat = 1; mat.clearcoatRoughness = 0.08; mat.iridescence = 0.06; mat.envMapIntensity = 1.25; }
  // hide the ground shadow plane: the mock draws its own
  c.stickers[0].parent.parent.traverse((o) => { if (o.geometry && o.geometry.type === 'PlaneGeometry') o.visible = false; });
  c.invalidate();
});
await page.waitForTimeout(400);
await page.locator('.cube3d canvas').screenshot({ path: out, omitBackground: true });
await browser.close();
console.log('ok', out);
