import { BackSide, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry, type Texture, type WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BODY_COLOR, BODY_RADIUS, BODY_SEGMENTS, CUBELET, COLORS, CORE_SCALE, GLASS_TINT, LOW_GPU, STICKER_MAT, TILE_CHAMFER, TILE_DEPTH, TILE_RINGS, TILE_SIZE } from './constants';

export const bodyGeometry = new RoundedBoxGeometry(CUBELET, CUBELET, CUBELET, BODY_SEGMENTS, BODY_RADIUS);
/**
 * A step-cut stone: octagonal rings climbing from the wall to a small table. Non-indexed, so every facet is flat.
 * The vertex colour carries per-facet brightness; on the crown it is flat, on the core it jitters so the inside sparkles.
 */
export function stepCutGeometry(o: { size: number; chamfer: number; depth: number; rings: [number, number][]; shade: [number, number]; table: number; jitter?: boolean }) {
  const pos: number[] = [], col: number[] = [];
  const oct = (s: number) => { const h = (o.size / 2) * s, c = o.chamfer * h; return [[-h + c, -h], [h - c, -h], [h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c]]; };
  const tri = (a: number[], b: number[], c: number[], sh: number) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); col.push(sh, sh, sh); } };
  const base = oct(1);
  for (let i = 0; i < 8; i++) { const a = base[i], b = base[(i + 1) % 8]; tri([a[0], a[1], -o.depth], [b[0], b[1], -o.depth], [b[0], b[1], 0], 0.8); tri([a[0], a[1], -o.depth], [b[0], b[1], 0], [a[0], a[1], 0], 0.8); }
  const R = o.rings;
  for (let r = 0; r < R.length - 1; r++) {
    const [s0, z0] = R[r], [s1, z1] = R[r + 1]; const o0 = oct(s0), o1 = oct(s1); const k = r / (R.length - 2);
    for (let i = 0; i < 8; i++) {
      const j = o.jitter ? ((i * 5 + r * 3) % 8) / 8 : k; const sh = o.shade[0] + (o.shade[1] - o.shade[0]) * j;
      const a = o0[i], b = o0[(i + 1) % 8], c = o1[(i + 1) % 8], d = o1[i];
      tri([a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z1], sh); tri([a[0], a[1], z0], [c[0], c[1], z1], [d[0], d[1], z1], sh);
    }
  }
  const [st, zt] = R[R.length - 1]; const ot = oct(st);
  for (let i = 1; i < 7; i++) tri([ot[0][0], ot[0][1], zt], [ot[i][0], ot[i][1], zt], [ot[i + 1][0], ot[i + 1][1], zt], o.table);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const TILE = { size: TILE_SIZE, chamfer: TILE_CHAMFER, depth: TILE_DEPTH, rings: TILE_RINGS };
/** The glass crown. */
export const stickerGeometry = stepCutGeometry({ ...TILE, shade: [0.97, 1.03], table: 1 });
/** The lit core inside it. */
export const coreGeometry = (() => { const g = stepCutGeometry({ ...TILE, shade: [0.5, 1.8], table: 1.8, jitter: true }); g.scale(CORE_SCALE, CORE_SCALE, CORE_SCALE * 0.9); g.translate(0, 0, -0.01); return g; })();

/* obsidian body: glossy black, shows as bright seams between the stones */
export const bodyMaterial = new MeshPhysicalMaterial({ color: BODY_COLOR, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1 });

/** The glass crown: refracts the lit core beneath it; the crown's own colour is a light tint so yellow stays yellow. */
export function makeStickerMaterial(hex: string) {
  const empty = hex === COLORS['.'];
  const m = empty ? STICKER_MAT.empty : STICKER_MAT.full;
  const key = Object.keys(COLORS).find((k) => COLORS[k] === hex) ?? '.';
  return new MeshPhysicalMaterial({
    color: GLASS_TINT[key],
    vertexColors: true,
    roughness: m.roughness,
    metalness: 0,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    specularIntensity: 1,
    ior: 2.4,
    envMapIntensity: m.envMapIntensity,
    iridescence: m.iridescence,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [200, 500],
    transmission: LOW_GPU ? 0 : m.transmission,
    thickness: m.thickness,
    attenuationColor: new Color(GLASS_TINT[key]),
    attenuationDistance: m.attenuationDistance,
    // without the refraction pass the crown is ordinary translucent glass over the lit core
    transparent: LOW_GPU,
    opacity: LOW_GPU ? 0.55 : 1,
    depthWrite: !LOW_GPU,
    flatShading: true,
  });
}
/** The core: unlit, so it reads as light inside the stone; vertex colours make the facets sparkle. */
export function makeCoreMaterial(hex: string) {
  const empty = hex === COLORS['.'];
  const m = empty ? STICKER_MAT.empty : STICKER_MAT.full;
  return new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(m.coreBright), vertexColors: true });
}

/** A dimmed tile is the same pigment in shadow: scaled in linear light, so the hue never drifts. */
export function dimColor(base: Color, out: Color) {
  return out.copy(base).multiplyScalar(0.3);
}

let shadowTex: CanvasTexture | null = null;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  // on black the shadow reads as a contact darkening under the glow
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  shadowTex = new CanvasTexture(c);
  return shadowTex;
}
export const shadowMaterial = () => new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });

const envCache = new WeakMap<WebGLRenderer, Texture>();
/**
 * A jeweller's studio: a dim light tent so black stays black, one big warm key high front-left,
 * a cool vertical strip at the right for the wall facets, a strip above-behind the camera for the tables.
 * Small hard lights on black are what make cut facets read as facets.
 */
export function environmentFor(gl: WebGLRenderer) {
  let t = envCache.get(gl);
  if (!t) {
    const env = new Scene();
    const quad = (w: number, h: number, c: [number, number, number], pos: [number, number, number]) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(...c), side: DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    // glass wants small, hot lights on a dim tent: each facet catches one sharp highlight
    env.add(new Mesh(new SphereGeometry(20, 16, 12), new MeshBasicMaterial({ color: new Color(0.2, 0.2, 0.21), side: BackSide })));
    quad(2, 1, [16, 16, 15.5], [-3, 6, 4]);
    quad(0.4, 6, [10, 10, 9.7], [6, 1, 0]);
    quad(1.5, 0.8, [8, 8, 7.8], [0, 6, 9]);
    quad(4, 0.4, [6, 6, 5.8], [0, 6.5, -5]);
    const pmrem = new PMREMGenerator(gl);
    t = pmrem.fromScene(env, 0.01).texture;
    pmrem.dispose();
    env.traverse((o) => { if (o instanceof Mesh) { o.geometry.dispose(); (o.material as MeshBasicMaterial).dispose(); } });
    envCache.set(gl, t);
  }
  return t;
}

export const COLORS_FROM = (ch: string) => COLORS[ch] ?? COLORS['.'];
