import { BackSide, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, PMREMGenerator, Quaternion, Scene, SphereGeometry, Vector3, type Texture, type WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BEZEL, BODY_COLOR, BODY_RADIUS, BODY_SEGMENTS, CUBELET, COLORS, GLOW, STICKER_MAT, TILE_CHAMFER, TILE_DEPTH, TILE_RINGS, TILE_SIZE } from './constants';
import { FACES } from './placements';

/** Cut-corner square outline at scale `s` of the half size. */
function oct(size: number, chamfer: number, s: number): number[][] {
  const h = (size / 2) * s, c = chamfer * h;
  return [[-h + c, -h], [h - c, -h], [h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c]];
}

/**
 * An asscher step cut: a straight girdle wall, then broad rings climbing to a wide flat table. Non-indexed so every
 * facet is flat, with a per-facet brightness in the colour attribute: steps alternate light and dark around the
 * stone the way a real cut throws light, and the table is brightest.
 */
export function stepCutGeometry(o: { size: number; chamfer: number; depth: number; rings: [number, number][]; table: number }) {
  const pos: number[] = [], col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], sh: number) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); col.push(sh, sh, sh); } };
  const base = oct(o.size, o.chamfer, 1);
  for (let i = 0; i < 8; i++) { const a = base[i], b = base[(i + 1) % 8]; tri([a[0], a[1], -o.depth], [b[0], b[1], -o.depth], [b[0], b[1], 0], 0.55); tri([a[0], a[1], -o.depth], [b[0], b[1], 0], [a[0], a[1], 0], 0.55); }
  const R = o.rings;
  for (let r = 0; r < R.length - 1; r++) {
    const [s0, z0] = R[r], [s1, z1] = R[r + 1]; const o0 = oct(o.size, o.chamfer, s0), o1 = oct(o.size, o.chamfer, s1);
    for (let i = 0; i < 8; i++) {
      // long facets (even i) sit brighter than the short corner facets; each ring a little brighter than the last
      const corner = i % 2 === 1;
      const sh = (corner ? 0.5 : 0.92) + r * 0.1 + (i === 2 || i === 3 ? 0.18 : 0) - (i === 6 || i === 7 ? 0.12 : 0);
      const a = o0[i], b = o0[(i + 1) % 8], c = o1[(i + 1) % 8], d = o1[i];
      tri([a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z1], sh); tri([a[0], a[1], z0], [c[0], c[1], z1], [d[0], d[1], z1], sh);
    }
  }
  const [st, zt] = R[R.length - 1]; const ot = oct(o.size, o.chamfer, st);
  for (let i = 1; i < 7; i++) tri([ot[0][0], ot[0][1], zt], [ot[i][0], ot[i][1], zt], [ot[i + 1][0], ot[i + 1][1], zt], o.table);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
export const stickerGeometry = stepCutGeometry({ size: TILE_SIZE, chamfer: TILE_CHAMFER, depth: TILE_DEPTH, rings: TILE_RINGS, table: 1.2 });

/**
 * The black bezel around one stone: a raised octagonal rim just outside the stone's footprint, lying in the
 * z = 0 plane of the stone (its girdle). Merged into the cubie body so it costs no draw call.
 */
function bezelRing(): BufferGeometry {
  const pos: number[] = [];
  const inner = oct(TILE_SIZE, TILE_CHAMFER, 1), outer = oct(TILE_SIZE + 2 * BEZEL, TILE_CHAMFER * (TILE_SIZE / (TILE_SIZE + 2 * BEZEL)), 1);
  const h = TILE_DEPTH + 0.02; // top of the rim, just above the girdle
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (let i = 0; i < 8; i++) {
    const a = inner[i], b = inner[(i + 1) % 8], c = outer[(i + 1) % 8], d = outer[i];
    quad([a[0], a[1], h], [b[0], b[1], h], [c[0], c[1], h], [d[0], d[1], h]);          // top of the rim
    quad([d[0], d[1], h], [c[0], c[1], h], [c[0], c[1], 0], [d[0], d[1], 0]);          // outer wall down to the body
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2)); // the box has uvs; a merge needs matching attributes
  g.computeVertexNormals();
  return g;
}
const bezel = bezelRing();

/** The body of one cubie: a rounded black box with a bezel ring on each of its outward faces. */
const bodyCache = new Map<string, BufferGeometry>();
export function bodyGeometryFor(slot: [number, number, number]): BufferGeometry {
  const key = slot.join(',');
  let g = bodyCache.get(key);
  if (g) return g;
  const parts: BufferGeometry[] = [new RoundedBoxGeometry(CUBELET, CUBELET, CUBELET, BODY_SEGMENTS, BODY_RADIUS)];
  for (const face of ['U', 'D', 'R', 'L', 'F', 'B'] as const) {
    const n = FACES[face].n;
    if (slot[0] * n[0] + slot[1] * n[1] + slot[2] * n[2] !== 1) continue;
    const ring = bezel.clone();
    ring.applyQuaternion(quatFor(n));
    ring.translate(n[0] * (CUBELET / 2 - 0.004), n[1] * (CUBELET / 2 - 0.004), n[2] * (CUBELET / 2 - 0.004));
    parts.push(ring);
  }
  g = mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p), false)!;
  for (const p of parts) p.dispose();
  bodyCache.set(key, g);
  return g;
}
function quatFor(n: [number, number, number]) { return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...n)); }

/* obsidian body: glossy black, shows as bright seams and bezels between the stones */
export const bodyMaterial = new MeshPhysicalMaterial({ color: BODY_COLOR, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.0 });

/** One opaque stone: deep pigment, a little light of its own, hard clearcoat. */
export function makeStickerMaterial(hex: string) {
  const empty = hex === COLORS['.'];
  const m = empty ? STICKER_MAT.empty : STICKER_MAT.full;
  return new MeshPhysicalMaterial({
    color: hex,
    emissive: new Color(hex).multiplyScalar(m.glow),
    vertexColors: true,
    roughness: m.roughness,
    metalness: 0,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    specularIntensity: 1,
    ior: 1.9,
    envMapIntensity: m.envMapIntensity,
    iridescence: m.iridescence,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [160, 520],
    flatShading: true,
  });
}

/** A dimmed stone is the same pigment in shadow: scaled in linear light, so the hue never drifts. */
export function dimColor(base: Color, out: Color) {
  return out.copy(base).multiplyScalar(STICKER_MAT.dim.pigment);
}
export const glowOf = (base: Color, out: Color, k = GLOW) => out.copy(base).multiplyScalar(k);

let shadowTex: CanvasTexture | null = null;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  shadowTex = new CanvasTexture(c);
  return shadowTex;
}
export const shadowMaterial = () => new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });

/** A soft coloured pool under the cube: the stones' light falling on the floor. Repainted when the bottom colours change. */
export function reflectionTexture(colours: string[]): CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 128);
  const n = Math.max(1, colours.length);
  colours.forEach((hex, i) => {
    const x = 64 + ((i + 0.5) / n) * 128, y = 64;
    const grad = g.createRadialGradient(x, y, 2, x, y, 56);
    grad.addColorStop(0, hex + '99'); grad.addColorStop(0.45, hex + '33'); grad.addColorStop(1, hex + '00');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  });
  const t = new CanvasTexture(c); t.needsUpdate = true; return t;
}

const envCache = new WeakMap<WebGLRenderer, Texture>();
/**
 * A jeweller's studio for cut stones: a near-black tent so black stays black, and a few small, hard, very bright
 * strips. Small hot lights are what draw a crisp highlight on each facet; a soft wide light would smear them.
 */
export function environmentFor(gl: WebGLRenderer) {
  let t = envCache.get(gl);
  if (!t) {
    const env = new Scene();
    const quad = (w: number, h: number, c: [number, number, number], pos: [number, number, number]) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(...c), side: DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    env.add(new Mesh(new SphereGeometry(20, 16, 12), new MeshBasicMaterial({ color: new Color(0.045, 0.045, 0.05), side: BackSide })));
    quad(3.2, 0.5, [42, 42, 40], [-4, 6.5, 4]);        // key strip, high front-left
    quad(0.35, 7, [24, 25, 26], [6.5, 1.5, 1]);       // cool vertical strip, right: the wall facets
    quad(0.35, 7, [22, 21.5, 21], [-6.5, 1.2, 2.5]);   // warm vertical strip, left: the other wall
    quad(2.4, 0.4, [20, 20, 20], [0, 5.5, 9]);          // strip above the camera: the tables
    quad(5, 0.3, [12, 12, 12.5], [0, 7, -5]);              // rim strip behind
    quad(1.2, 1.2, [3, 3, 3.2], [-6, -3, 3]);           // a dim bounce from the floor-left
    const pmrem = new PMREMGenerator(gl);
    t = pmrem.fromScene(env, 0.01).texture;
    pmrem.dispose();
    env.traverse((o) => { if (o instanceof Mesh) { o.geometry.dispose(); (o.material as MeshBasicMaterial).dispose(); } });
    envCache.set(gl, t);
  }
  return t;
}

export const COLORS_FROM = (ch: string) => COLORS[ch] ?? COLORS['.'];
