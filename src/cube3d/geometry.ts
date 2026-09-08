import { CanvasTexture, Color, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PMREMGenerator, type Texture, type WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BODY_COLOR, BODY_RADIUS, BODY_SEGMENTS, CUBELET, STICKER_DEPTH, STICKER_RADIUS, STICKER_SEGMENTS, STICKER_SIZE, COLORS } from './constants';

export const bodyGeometry = new RoundedBoxGeometry(CUBELET, CUBELET, CUBELET, BODY_SEGMENTS, BODY_RADIUS);
export const stickerGeometry = new RoundedBoxGeometry(STICKER_SIZE, STICKER_SIZE, STICKER_DEPTH, STICKER_SEGMENTS, STICKER_RADIUS);

export const bodyMaterial = new MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.55, metalness: 0, envMapIntensity: 0.35 });

export function makeStickerMaterial(hex: string) {
  const empty = hex === COLORS['.'];
  return new MeshPhysicalMaterial({
    color: hex,
    roughness: empty ? 0.6 : 0.28,
    metalness: 0,
    clearcoat: empty ? 0.3 : 1,
    clearcoatRoughness: 0.12,
    specularIntensity: 0.6,
    envMapIntensity: empty ? 0.5 : 1.1,
    iridescence: empty ? 0 : 0.12,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [200, 500],
  });
}

const hsl = { h: 0, s: 0, l: 0 };
export function dimColor(base: Color, out: Color) {
  base.getHSL(hsl);
  return out.setHSL(hsl.h, hsl.s * 0.25, hsl.l * 0.6);
}

let shadowTex: CanvasTexture | null = null;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(40,32,60,0.5)');
  grad.addColorStop(0.5, 'rgba(40,32,60,0.18)');
  grad.addColorStop(1, 'rgba(40,32,60,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  shadowTex = new CanvasTexture(c);
  return shadowTex;
}
export const shadowMaterial = () => new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });

const envCache = new WeakMap<WebGLRenderer, Texture>();
export function environmentFor(gl: WebGLRenderer) {
  let t = envCache.get(gl);
  if (!t) {
    const pmrem = new PMREMGenerator(gl);
    t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    envCache.set(gl, t);
  }
  return t;
}

export const COLORS_FROM = (ch: string) => COLORS[ch] ?? COLORS['.'];
