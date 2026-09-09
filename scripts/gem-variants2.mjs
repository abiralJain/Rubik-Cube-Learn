// Step-cut gemstone tiles with a luminous core, against the user's reference. Usage: node scripts/gem-variants2.mjs <outDir> [names]
import { chromium } from 'playwright';
const out = process.argv[2]; const only = process.argv[3]?.split(',');
const GEM = { U: '#ECE9E0', D: '#E8A800', R: '#B8121C', L: '#E85F0A', F: '#0E8A46', B: '#1836C8' };
const base = { col: GEM, body: { color: '#08080A', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }, bodyR: 0.07,
  tile: { size: 0.94, chamfer: 0.18, depth: 0.05, rings: [[1, 0], [0.9, 0.06], [0.79, 0.11], [0.67, 0.15], [0.54, 0.18], [0.4, 0.2]], shade: [0.55, 1.45], table: 1.5 },
  mat: { roughness: 0.04, clearcoat: 1, ccR: 0.02, ior: 2.4, irid: 0.35, env: 1.3, emis: 0.16 }, env: 1.0, expo: 1.15, lights: { dir: 0.35, hemi: 0.12 }, cam: { yaw: -0.785, pitch: 0.5 } };
const dark = { ...base, tile: { ...base.tile, shade: [0.7, 1.15], table: 1.2 }, mat: { ...base.mat, emis: 0.1, env: 0.9, irid: 0.3 }, expo: 1.0, lights: { dir: 0.25, hemi: 0.08 } };
const two = { ...base, tile: { ...base.tile, shade: [0.97, 1.03], table: 1.0 }, mat: { ...base.mat, emis: 0, env: 1.2, irid: 0.25, roughness: 0.03 }, expo: 1.05, lights: { dir: 0.25, hemi: 0.08 },
  studio: { dome: 0.2, key: [2, 1, 16, [-3, 6, 4]], rim: [0.4, 6, 10, [6, 1, 0]], cam: [1.5, 0.8, 8, [0, 6, 9]], back: [4, 0.4, 6, [0, 6.5, -5]] } };
const GEM2 = { U: '#F6F4EC', D: '#F6C21A', R: '#C0141E', L: '#EE6410', F: '#12A050', B: '#2040D8' };
const V = {
  coreP: { ...two, col: GEM2, core: { scale: 0.86, bright: 1.35, shade: [0.55, 1.6] }, crown: { transmission: 1, thickness: 0.3, attDist: 1.4 } },
  coreQ: { ...two, col: GEM2, core: { scale: 0.86, bright: 1.7, shade: [0.5, 1.8] }, crown: { transmission: 1, thickness: 0.25, attDist: 2.0 }, expo: 1.1 },
  coreM: { ...two, core: { scale: 0.86, bright: 1.25, shade: [0.55, 1.6] }, crown: { opacity: 0.5 } },
  coreN: { ...two, core: { scale: 0.86, bright: 1.6, shade: [0.5, 1.8] }, crown: { opacity: 0.35 } },
  coreO: { ...two, core: { scale: 0.86, bright: 1.3, shade: [0.55, 1.6] }, crown: { transmission: 1, thickness: 0.3 } },
  stepJ: { ...dark, studio: { dome: 0.12, key: [2, 1, 20, [-3, 6, 4]], rim: [0.3, 6, 12, [6, 1, 0]], cam: [1.5, 0.8, 10, [0, 6, 9]], back: [4, 0.4, 6, [0, 6.5, -5]] } },
  stepK: { ...dark, mat: { ...dark.mat, env: 0.7, emis: 0.08 }, studio: { dome: 0.06, key: [2, 1, 24, [-3, 6, 4]], rim: [0.3, 6, 14, [6, 1, 0]], cam: [1.5, 0.8, 12, [0, 6, 9]], back: [4, 0.4, 8, [0, 6.5, -5]] } },
  stepL: { ...dark, mat: { ...dark.mat, trans: 0.35, emis: 0.14 }, studio: { dome: 0.12, key: [2, 1, 20, [-3, 6, 4]], rim: [0.3, 6, 12, [6, 1, 0]], cam: [1.5, 0.8, 10, [0, 6, 9]], back: [4, 0.4, 6, [0, 6.5, -5]] } },
  stepG: base,
  stepH: { ...base, mat: { ...base.mat, trans: 0.45, emis: 0.22, env: 1.5 } },
  stepI: { ...base, tile: { ...base.tile, chamfer: 0.12, rings: [[1, 0], [0.86, 0.08], [0.7, 0.14], [0.52, 0.18], [0.36, 0.2]], shade: [0.5, 1.6], table: 1.7 }, mat: { ...base.mat, emis: 0.24, irid: 0.45 } },
};
const browser = await chromium.launch();
const GPU = process.env.GPU ?? 'high';
for (const [name, v] of Object.entries(V)) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
  await page.addInitScript((g) => localStorage.setItem('cube.gpu', g), GPU);
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://localhost:5173/?poster=1');
  await page.waitForFunction(() => window.__cube?.ready === true && !!window.__THREE && !!window.__gl, null, { timeout: 40000 });
  await page.evaluate((v) => {
    document.documentElement.style.background = '#000'; document.body.style.background = '#000';
    const T = window.__THREE; const c = window.__cube; c.reduced = true; c.floatY = 0; c.breath = 1; c.qDrift.identity();
    c.setOrientation({ top: 'U', front: 'F', yaw: v.cam.yaw, pitch: v.cam.pitch }, false);
    const RB = c.bodies.values().next().value.geometry.constructor; // RoundedBoxGeometry
    c.bodies.forEach((m) => { m.geometry = new RB(1, 1, 1, 5, v.bodyR); m.material = new T.MeshPhysicalMaterial({ ...v.body, envMapIntensity: 1.1 }); });
    // step-cut tile: octagonal rings climbing to a small table; vertex colour brightens toward the centre (light inside the stone)
    function stepCut(t) {
      const pos = [], col = [];
      const oct = (s) => { const h = (t.size / 2) * s, ch = t.chamfer * h; return [[-h + ch, -h], [h - ch, -h], [h, -h + ch], [h, h - ch], [h - ch, h], [-h + ch, h], [-h, h - ch], [-h, -h + ch]]; };
      const tri = (a, b, c2, sh) => { for (const p of [a, b, c2]) { pos.push(p[0], p[1], p[2]); col.push(sh, sh, sh); } };
      const o = oct(1);
      for (let i = 0; i < 8; i++) { const a = o[i], b = o[(i + 1) % 8]; tri([a[0], a[1], -t.depth], [b[0], b[1], -t.depth], [b[0], b[1], 0], 0.8); tri([a[0], a[1], -t.depth], [b[0], b[1], 0], [a[0], a[1], 0], 0.8); }
      const R = t.rings;
      for (let r = 0; r < R.length - 1; r++) {
        const [s0, z0] = R[r], [s1, z1] = R[r + 1]; const o0 = oct(s0), o1 = oct(s1);
        const k = r / (R.length - 2);
        for (let i = 0; i < 8; i++) { const j = t.facetJitter ? (((i * 5 + r * 3) % 8) / 8) : k; const sh = t.shade[0] + (t.shade[1] - t.shade[0]) * j; const a = o0[i], b = o0[(i + 1) % 8], c2 = o1[(i + 1) % 8], d = o1[i]; tri([a[0], a[1], z0], [b[0], b[1], z0], [c2[0], c2[1], z1], sh); tri([a[0], a[1], z0], [c2[0], c2[1], z1], [d[0], d[1], z1], sh); }
      }
      const [st, zt] = R[R.length - 1]; const ot = oct(st);
      for (let i = 1; i < 7; i++) tri([ot[0][0], ot[0][1], zt], [ot[i][0], ot[i][1], zt], [ot[i + 1][0], ot[i + 1][1], zt], t.table);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    }
    const geo = stepCut(v.tile);
    const coreGeo = v.core ? stepCut({ ...v.tile, shade: v.core.shade, table: v.core.shade[1], facetJitter: true }) : null;
    if (coreGeo) coreGeo.scale(v.core.scale, v.core.scale, v.core.scale * 0.9);
    const offset = 0.5 + v.tile.depth - 0.004;
    for (const m of c.stickers) {
      const idx = m.userData.index; const colHex = v.col[c.displayFacelets[idx]] ?? '#ddd';
      m.geometry = geo;
      const p = m.position.clone(); const n = p.clone().normalize();
      const ax = ['x', 'y', 'z'].reduce((a, b) => Math.abs(n[a]) > Math.abs(n[b]) ? a : b);
      const nv = { x: 0, y: 0, z: 0 }; nv[ax] = Math.sign(n[ax]);
      const slot = { x: Math.round(p.x / 1.03), y: Math.round(p.y / 1.03), z: Math.round(p.z / 1.03) }; slot[ax] = Math.sign(n[ax]);
      m.position.set(slot.x * 1.03 + nv.x * offset, slot.y * 1.03 + nv.y * offset, slot.z * 1.03 + nv.z * offset);
      const mat = new T.MeshPhysicalMaterial({ color: colHex, vertexColors: true, roughness: v.mat.roughness, metalness: 0, clearcoat: v.mat.clearcoat, clearcoatRoughness: v.mat.ccR, ior: v.mat.ior, iridescence: v.mat.irid, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 500], envMapIntensity: v.mat.env, specularIntensity: 1, flatShading: true, emissive: new T.Color(colHex), emissiveIntensity: v.mat.emis });
      if (v.mat.trans) { mat.transmission = v.mat.trans; mat.thickness = 0.5; mat.attenuationColor = new T.Color(colHex); mat.attenuationDistance = 0.5; }
      if (v.crown) {
        if (v.crown.transmission) { mat.transmission = v.crown.transmission; mat.thickness = v.crown.thickness; mat.attenuationColor = new T.Color(colHex); mat.attenuationDistance = v.crown.attDist ?? 0.8; }
        else { mat.transparent = true; mat.opacity = v.crown.opacity; mat.depthWrite = false; }
        m.renderOrder = 2;
        m.children.slice().forEach((ch) => m.remove(ch));
        const cc = new T.Color(colHex).multiplyScalar(v.core.bright);
        const core = new T.Mesh(coreGeo, new T.MeshBasicMaterial({ color: cc, vertexColors: true }));
        core.position.z = -0.01; core.renderOrder = 1; m.add(core);
      }
      m.material = mat;
    }
    let scene = c.stickers[0]; while (scene.parent) scene = scene.parent;
    scene.environmentIntensity = v.env;
    if (v.studio) {
      const env = new T.Scene();
      const quad = ([w, h, i, pos]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(i, i, i * 0.97), side: T.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
      env.add(new T.Mesh(new T.SphereGeometry(20, 16, 12), new T.MeshBasicMaterial({ color: new T.Color(v.studio.dome, v.studio.dome, v.studio.dome * 1.05), side: T.BackSide })));
      quad(v.studio.key); quad(v.studio.rim); quad(v.studio.cam); quad(v.studio.back);
      const pm = new T.PMREMGenerator(window.__gl); scene.environment = pm.fromScene(env, 0.01).texture; pm.dispose();
    }
    scene.traverse((o) => { if (o.isHemisphereLight) o.intensity = v.lights.hemi; else if (o.isDirectionalLight) o.intensity *= v.lights.dir; });
    window.__gl.toneMappingExposure = v.expo;
    c.invalidate();
  }, v);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/gem-${name}.png` });
  await page.close(); console.log(name);
}
await browser.close();
