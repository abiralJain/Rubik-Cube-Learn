export const CUBELET = 1.0;
export const PITCH = 1.03;
export const BODY_RADIUS = 0.07;
export const BODY_SEGMENTS = 5;

/* Gemstone tiles: a step-cut crown of glass over a faceted, self-lit core. Octagonal outline, five rings up to a small table. */
export const TILE_SIZE = 0.94;       // outer footprint
export const TILE_CHAMFER = 0.18;    // corner cut, as a fraction of the half size
export const TILE_DEPTH = 0.05;      // straight wall below the first ring
export const TILE_RINGS: [number, number][] = [[1, 0], [0.9, 0.06], [0.79, 0.11], [0.67, 0.15], [0.54, 0.18], [0.4, 0.2]]; // [scale, height]
export const TILE_TOP = TILE_RINGS[TILE_RINGS.length - 1][1]; // 0.2
export const CORE_SCALE = 0.86;      // the lit core sits just inside the crown
export const CORE_BRIGHT = 1.5;      // core colour = tile colour × this (HDR, the glass tones it down)
export const STICKER_OFFSET = CUBELET / 2 + TILE_DEPTH - 0.004; // 0.546: the wall bottom sits on the body face
export const TILE_PROUD = STICKER_OFFSET + TILE_TOP - CUBELET / 2; // 0.246

export const CUBE_HALF = 1.5 * PITCH;
export const APPARENT_RADIUS = 2.3;
export const FILL = 0.68;
export const MAX_RADIUS_PX = 250; // cube radius on screen never exceeds this
export const CAMERA_FOV = 32;
export const CAMERA_ELEVATION = 22; // degrees

export const LAYER_LIFT = 0.08;
export const TAP_MAX_PX = 8;
export const TAP_MAX_MS = 450;
export const ROT_PER_PX = 0.0075;
export const MOMENTUM_DECAY = 3.5;
export const MOMENTUM_MAX = 12;
export const MOMENTUM_STOP = 0.02;
export const LAYER_PX_PER_QUARTER = 140;

/* gemstone colours: the core carries them saturated; the glass above is tinted lighter so yellow stays yellow */
export const COLORS: Record<string, string> = {
  U: '#F6F4EC', D: '#F4BE14', R: '#B8121C', L: '#EA600C', F: '#12A050', B: '#2447D8',
  '.': '#2A2A30',
};
export const GLASS_TINT: Record<string, string> = {
  U: '#FFFFFF', D: '#FFE9A0', R: '#E8636A', L: '#FFA870', F: '#7BE0A6', B: '#8DA8FF',
  '.': '#55555C',
};
export const BODY_COLOR = '#08080A';

/** Software or otherwise weak GPUs skip the refraction pass: the crown becomes plain translucent glass. Override with localStorage 'cube.gpu' = 'low' | 'high'. */
export const LOW_GPU: boolean = (() => {
  try {
    const pref = localStorage.getItem('cube.gpu');
    if (pref === 'low') return true; if (pref === 'high') return false;
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const r = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software|mesa offscreen/i.test(r);
  } catch { return false; }
})();

/* material values per sticker state; shared by geometry.ts and the controller */
export const STICKER_MAT = {
  full: { roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2, iridescence: 0.25, transmission: 1, thickness: 0.25, attenuationDistance: 2.0, coreBright: CORE_BRIGHT },
  empty: { roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.6, iridescence: 0, transmission: 0.7, thickness: 0.25, attenuationDistance: 1.0, coreBright: 0.5 },
} as const;

export const SPRING = {
  press: { k: 800, c: 18 },
  turn: { k: 300, c: 22 },
  turnReduced: { k: 300, c: 34.6 },
  orient: { k: 120, c: 17.5 },
  orientReduced: { k: 120, c: 21.9 },
  squash: { k: 400, c: 24 },
};
export const HIGHLIGHT_DAMP = 12;
