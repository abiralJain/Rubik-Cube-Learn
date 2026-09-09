export const CUBELET = 1.0;
export const PITCH = 1.03;
export const BODY_RADIUS = 0.07;
export const BODY_SEGMENTS = 5;

/* Asscher-cut stones: a square with cut corners, a straight girdle wall, three broad steps up to a wide flat table.
   Few big facets read as a cut stone; many small ones read as a pyramid. */
export const TILE_SIZE = 0.92;       // outer footprint (the bezel sits outside it)
export const TILE_CHAMFER = 0.24;    // corner cut, as a fraction of the half size
export const TILE_DEPTH = 0.06;      // girdle wall below the first step
export const TILE_RINGS: [number, number][] = [[1, 0], [0.84, 0.075], [0.7, 0.13], [0.54, 0.165]]; // [scale, height]
export const TILE_TOP = TILE_RINGS[TILE_RINGS.length - 1][1];
export const BEZEL = 0.05;           // width of the black rim around each stone
export const STICKER_OFFSET = CUBELET / 2 + TILE_DEPTH - 0.004;
export const TILE_PROUD = STICKER_OFFSET + TILE_TOP - CUBELET / 2;

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

/* pigments: deep, saturated, as the gems in the reference renders */
export const COLORS: Record<string, string> = {
  U: '#EDEBE4', D: '#F2B600', R: '#B3101B', L: '#E85A0A', F: '#0E8F45', B: '#1E3FC9',
  '.': '#26262C',
};
export const BODY_COLOR = '#070709';
/** How much of the pigment the stone emits itself: the light inside. */
export const GLOW = 0.32;

/* material values per sticker state; shared by geometry.ts and the controller */
export const STICKER_MAT = {
  full: { roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.1, iridescence: 0.12, glow: GLOW },
  empty: { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.5, iridescence: 0, glow: 0.05 },
  dim: { roughness: 0.2, envMapIntensity: 0.7, iridescence: 0, glow: 0.12, pigment: 0.5 },
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
