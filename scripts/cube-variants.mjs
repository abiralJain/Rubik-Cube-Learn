// Four cube finishes rendered from the live scene on pure white, for the user to choose from.
import { chromium } from 'playwright';
const out = process.argv[2];
const OFFICIAL = { U: '#FFFFFF', D: '#FFD500', R: '#C41E3A', L: '#FF5800', F: '#009E60', B: '#0051BA' };
const SOFT = { U: '#FFFFFF', D: '#F5C400', R: '#E23D3D', L: '#F27B21', F: '#1FA85A', B: '#2F62C9' };
const CLAY = { U: '#F7F5EE', D: '#F2C230', R: '#DE4B45', L: '#F0802A', F: '#2FA866', B: '#3468C4' };
const VARIANTS = process.argv[3] === 'clay' ? {
  clay: { body: { color: '#2B2726', roughness: 0.95, metalness: 0, clearcoat: 0 }, bodyRadius: 0.1, sticker: { depth: 0.04, radius: 0.09, size: 0.86, roughness: 0.85, clearcoat: 0, clearcoatRoughness: 1, env: 0.25, irid: 0 }, colours: CLAY, env: 0.35 },
  'clay-crisp': { body: { color: '#26232A', roughness: 0.9, metalness: 0, clearcoat: 0 }, bodyRadius: 0.06, sticker: { depth: 0.03, radius: 0.06, size: 0.9, roughness: 0.8, clearcoat: 0, clearcoatRoughness: 1, env: 0.3, irid: 0 }, colours: CLAY, env: 0.4 },
  'clay-satin': { body: { color: '#2A2730', roughness: 0.7, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.5 }, bodyRadius: 0.08, sticker: { depth: 0.035, radius: 0.08, size: 0.87, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.35, env: 0.6, irid: 0 }, colours: CLAY, env: 0.6 },
} : {
  studio: { body: { color: '#161616', roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }, bodyRadius: 0.06, sticker: { depth: 0.03, radius: 0.05, size: 0.88, roughness: 0.45, clearcoat: 0.15, clearcoatRoughness: 0.5, env: 0.5, irid: 0 }, colours: OFFICIAL, env: 0.55 },
  graphic: { body: { color: '#111111', roughness: 1, metalness: 0, clearcoat: 0 }, bodyRadius: 0.05, sticker: { depth: 0.02, radius: 0.2, size: 0.8, roughness: 1, clearcoat: 0, clearcoatRoughness: 1, env: 0, irid: 0, flat: true }, colours: SOFT, env: 0 },
  clay: { body: { color: '#2B2726', roughness: 0.95, metalness: 0, clearcoat: 0 }, bodyRadius: 0.1, sticker: { depth: 0.04, radius: 0.09, size: 0.86, roughness: 0.85, clearcoat: 0, clearcoatRoughness: 1, env: 0.25, irid: 0 }, colours: SOFT, env: 0.35 },
  glass: { body: { color: '#F4F6FA', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transmission: 0.9, thickness: 1.2, ior: 1.45 }, bodyRadius: 0.08, sticker: { depth: 0.03, radius: 0.06, size: 0.86, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, env: 1.0, irid: 0.25 }, colours: OFFICIAL, env: 1.0 },
};
const browser = await chromium.launch();
for (const [name, v] of Object.entries(VARIANTS)) {
  const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/?poster=1');
  await page.waitForFunction(() => window.__cube?.ready === true, null, { timeout: 30000 });
  await page.evaluate((v) => {
    document.documentElement.style.background = '#fff'; document.body.style.background = '#fff';
    const c = window.__cube;
    c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity();
    c.setOrientation({ top: 'U', front: 'F', yaw: -0.62, pitch: 0.2 }, false);
    const Phys = c.stickers[0].material.constructor;
    const RB = c.stickers[0].geometry.constructor;
    const bodyGeo = new RB(1, 1, 1, 5, v.bodyRadius);
    const body = new Phys({ ...v.body });
    c.bodies.forEach((m) => { m.geometry = bodyGeo; m.material = body; });
    const stGeo = new RB(v.sticker.size, v.sticker.size, v.sticker.depth, 3, Math.min(v.sticker.radius, v.sticker.depth / 2 + 0.001));
    const offset = 0.5 + v.sticker.depth / 2 - 0.004;
    for (const m of c.stickers) {
      const idx = m.userData.index; const face = 'URFDLB'[Math.floor(idx / 9)];
      const col = v.colours[c.displayFacelets[idx]] ?? '#ddd';
      m.geometry = stGeo;
      const p = m.position.clone(); const n = p.clone().normalize(); // normal ≈ direction of largest component
      const ax = ['x', 'y', 'z'].reduce((a, b) => Math.abs(n[a]) > Math.abs(n[b]) ? a : b);
      const nv = { x: 0, y: 0, z: 0 }; nv[ax] = Math.sign(n[ax]);
      const slot = { x: Math.round(p.x / 1.03), y: Math.round(p.y / 1.03), z: Math.round(p.z / 1.03) }; slot[ax] = Math.sign(n[ax]);
      m.position.set(slot.x * 1.03 + nv.x * offset, slot.y * 1.03 + nv.y * offset, slot.z * 1.03 + nv.z * offset);
      const mat = m.material;
      mat.color.set(col); mat.roughness = v.sticker.roughness; mat.clearcoat = v.sticker.clearcoat; mat.clearcoatRoughness = v.sticker.clearcoatRoughness; mat.envMapIntensity = v.sticker.env; mat.iridescence = v.sticker.irid; mat.metalness = 0;
      if (v.sticker.flat) { mat.emissive.set(col); mat.emissiveIntensity = 0.55; }
      void face;
    }
    const scene = c.stickers[0].parent.parent; scene.environmentIntensity = v.env;
    scene.traverse((o) => { if (o.geometry && o.geometry.type === 'PlaneGeometry') o.visible = false; });
    c.invalidate();
  }, v);
  await page.waitForTimeout(500);
  await page.locator('.cube3d canvas').screenshot({ path: `${out}/${name}.png` });
  await page.close();
  console.log(name);
}
await browser.close();
