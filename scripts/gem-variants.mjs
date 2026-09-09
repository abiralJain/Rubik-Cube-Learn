// Faceted-stone cube finishes on black. Usage: node scripts/gem-variants.mjs <outDir> [names]
import { chromium } from 'playwright';
const out = process.argv[2];
const DEEP = { U: '#EDEDE8', D: '#E9A90A', R: '#C8231F', L: '#E0640C', F: '#128F4E', B: '#1F4FC2' };
const MID  = { U: '#F2F1EC', D: '#F0B929', R: '#D62F2A', L: '#EA7318', F: '#1AA25B', B: '#2A5DD0' };
const V = {
  facet1: { col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.05, bevelT: 0.09, bevelS: 0.1, segs: 1 }, mat: { roughness: 0.05, clearcoat: 1, ccR: 0.03, env: 1.7, irid: 0.15, emis: 0, ior: 1.9 }, env: 1.3, expo: 1.15 },
  facet2: { col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.05, clearcoat: 1, ccR: 0.03, env: 1.7, irid: 0.15, emis: 0, ior: 1.9 }, env: 1.3, expo: 1.15 },
  facet2b: { col: MID, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.08, clearcoat: 1, ccR: 0.05, env: 1.4, irid: 0.3, emis: 0.05, ior: 2.2 }, env: 1.2, expo: 1.15 },
  facet3: { col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.92, depth: 0.03, bevelT: 0.14, bevelS: 0.16, segs: 3 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 2.0, irid: 0.2, emis: 0, ior: 2.0 }, env: 1.4, expo: 1.2 },
};
const DEEPER = { U: '#E6E6E1', D: '#D99A00', R: '#B31C1A', L: '#CF5708', F: '#0E7F45', B: '#1A45B0' };
Object.assign(V, {
  dark1: { col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.05, clearcoat: 1, ccR: 0.03, env: 1.3, irid: 0.15, emis: 0, ior: 1.9 }, env: 1.3, expo: 1.0, lights: { dir: 0.3, hemi: 0.15 } },
  dark2: { col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 1.8, irid: 0.25, emis: 0, ior: 2.0 }, env: 1.8, expo: 1.0, lights: { dir: 0.2, hemi: 0.1 } },
  dark3: { col: DEEPER, body: { color: '#08080A', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.03, clearcoat: 1, ccR: 0.02, env: 2.2, irid: 0.3, emis: 0, ior: 2.2 }, env: 2.2, expo: 1.0, lights: { dir: 0.15, hemi: 0.08 } },
  dark4: { col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 1.8, irid: 0.25, emis: 0, ior: 2.0, trans: 0.3 }, env: 1.8, expo: 1.0, lights: { dir: 0.2, hemi: 0.1 } },
});
Object.assign(V, {
  studioA: { studio: 'A', col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 1.0, irid: 0.2, emis: 0, ior: 2.0 }, env: 1.0, expo: 1.0, lights: { dir: 0.25, hemi: 0.1 } },
  studioB: { studio: 'B', col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 1.0, irid: 0.2, emis: 0, ior: 2.0 }, env: 1.0, expo: 1.0, lights: { dir: 0.35, hemi: 0.12 } },
  studioC: { studio: 'B', col: MID, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.06, clearcoat: 1, ccR: 0.03, env: 1.2, irid: 0.3, emis: 0.04, ior: 2.2 }, env: 1.2, expo: 1.05, lights: { dir: 0.4, hemi: 0.15 } },
});
Object.assign(V, {
  studioD: { studio: 'D', col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 1.0, irid: 0.2, emis: 0, ior: 2.0 }, env: 1.0, expo: 1.05, lights: { dir: 0.35, hemi: 0.15 } },
  studioE: { studio: 'D', col: MID, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.05, clearcoat: 1, ccR: 0.03, env: 1.0, irid: 0.25, emis: 0, ior: 2.0 }, env: 1.0, expo: 1.05, lights: { dir: 0.35, hemi: 0.15 } },
  studioF: { studio: 'F', col: DEEP, body: { color: '#0A0A0C', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }, bodyR: 0.06, tile: { size: 0.9, depth: 0.04, bevelT: 0.11, bevelS: 0.13, segs: 2 }, mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, env: 1.2, irid: 0.2, emis: 0, ior: 2.0 }, env: 1.2, expo: 1.05, lights: { dir: 0.3, hemi: 0.12 } },
});
const only = process.argv[3]?.split(',');
const browser = await chromium.launch();
for (const [name, v] of Object.entries(V)) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://localhost:5173/?poster=1');
  await page.waitForFunction(() => window.__cube?.ready === true && !!window.__THREE, null, { timeout: 40000 });
  await page.evaluate((v) => {
    document.documentElement.style.background = '#000'; document.body.style.background = '#000';
    const T = window.__THREE; const c = window.__cube; c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity();
    c.setOrientation({ top: 'D', front: 'F', yaw: -0.5, pitch: 0.12 }, false);
    const RB = c.stickers[0].geometry.constructor; // RoundedBoxGeometry
    const body = new T.MeshPhysicalMaterial({ ...v.body, envMapIntensity: 1.0 });
    const bg = new RB(1, 1, 1, 5, v.bodyR);
    c.bodies.forEach((m) => { m.geometry = bg; m.material = body; });
    // faceted tile: a square extruded with a chamfer ring — flat table, sharp facets
    const h = v.tile.size / 2 - v.tile.bevelS; const sh = new T.Shape(); sh.moveTo(-h, -h); sh.lineTo(h, -h); sh.lineTo(h, h); sh.lineTo(-h, h); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: v.tile.depth, bevelEnabled: true, bevelThickness: v.tile.bevelT, bevelSize: v.tile.bevelS, bevelSegments: v.tile.segs, curveSegments: 1 });
    geo.computeVertexNormals();
    const total = v.tile.depth + v.tile.bevelT * 2; // extrude spans z ∈ [-bevelT, depth+bevelT]
    geo.translate(0, 0, -(v.tile.depth / 2)); // centre it
    const offset = 0.5 + v.tile.bevelT - 0.02;   // table sits proud of the body face
    for (const m of c.stickers) {
      const idx = m.userData.index; const col = v.col[c.displayFacelets[idx]] ?? '#ddd';
      m.geometry = geo;
      const p = m.position.clone(); const n = p.clone().normalize();
      const ax = ['x', 'y', 'z'].reduce((a, b) => Math.abs(n[a]) > Math.abs(n[b]) ? a : b);
      const nv = { x: 0, y: 0, z: 0 }; nv[ax] = Math.sign(n[ax]);
      const slot = { x: Math.round(p.x / 1.03), y: Math.round(p.y / 1.03), z: Math.round(p.z / 1.03) }; slot[ax] = Math.sign(n[ax]);
      m.position.set(slot.x * 1.03 + nv.x * offset, slot.y * 1.03 + nv.y * offset, slot.z * 1.03 + nv.z * offset);
      const mat = m.material; mat.color.set(col); mat.roughness = v.mat.roughness; mat.clearcoat = v.mat.clearcoat; mat.clearcoatRoughness = v.mat.ccR; mat.envMapIntensity = v.mat.env; mat.iridescence = v.mat.irid; mat.metalness = 0; mat.specularIntensity = 1; mat.ior = v.mat.ior; mat.flatShading = true; mat.needsUpdate = true;
      mat.emissive.set(col); mat.emissiveIntensity = v.mat.emis;
      if (v.mat.trans) { mat.transmission = v.mat.trans; mat.thickness = 0.5; mat.attenuationColor.set(col); mat.attenuationDistance = 0.4; }
    }
    if (v.studio) {
      const env = new T.Scene(); env.background = new T.Color(0x000000);
      const quad = (w, h, col, pos, look) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(...col), side: T.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); void look; };
      quad(3.0, 1.8, [7, 6.8, 6.4], [-2.5, 4.5, 3.5]);      // key: warm softbox, high front-left
      quad(0.6, 4.0, [4.5, 4.7, 5.2], [5.0, 1.5, -1.0]);     // rim: cool strip right
      quad(2.0, 0.5, [3.5, 3.6, 4.0], [0, 5.5, -4.0]);       // top-back strip
      quad(1.2, 1.2, [1.2, 1.2, 1.3], [0.5, -0.5, 6.0]);     // fill: dim, behind camera
      if (v.studio === 'D' || v.studio === 'F') {
        env.children.length = 0;
        const dome = new T.Mesh(new T.SphereGeometry(20, 16, 12), new T.MeshBasicMaterial({ color: new T.Color(0.32, 0.32, 0.34), side: T.BackSide })); env.add(dome);
        quad(6, 3, [12, 11.5, 10.8], [-3, 6, 4]);            // key: big warm softbox, high front-left
        quad(0.8, 8, [8, 8.4, 9], [6, 1, 0]);                // rim: cool vertical strip, right
        quad(8, 0.6, [6, 6, 6.5], [0, 6.5, -5]);             // top-back strip
        quad(4, 2, [v.studio === 'F' ? 9 : 6, v.studio === 'F' ? 9 : 6, v.studio === 'F' ? 9 : 6], [0, 6, 9]);   // above-behind camera: lights the tables
        quad(3, 3, [2, 2, 2.2], [0, -6, 2]);                 // floor bounce, dim
      }
      if (v.studio === 'B') { const dome = new T.Mesh(new T.SphereGeometry(20, 16, 12), new T.MeshBasicMaterial({ color: new T.Color(0.06, 0.06, 0.07), side: T.BackSide })); env.add(dome); }
      const p = new T.PMREMGenerator(window.__gl); const tex = p.fromScene(env, 0.02).texture; p.dispose();
      scene0(c).environment = tex;
    }
    if (v.lights) scene0(c).traverse((o) => { if (o.isHemisphereLight) o.intensity = v.lights.hemi; else if (o.isDirectionalLight) o.intensity *= v.lights.dir; });
    function scene0(c) { let s = c.stickers[0]; while (s.parent) s = s.parent; return s; }
    const scene = c.stickers[0].parent.parent; scene.environmentIntensity = v.env;
    c.invalidate(); void total;
  }, v);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/gem-${name}.png` });
  await page.close(); console.log(name);
}
await browser.close();
