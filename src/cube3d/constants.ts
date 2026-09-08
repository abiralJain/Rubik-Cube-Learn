export const CUBELET = 1.0;
export const PITCH = 1.03;
export const BODY_RADIUS = 0.2;
export const BODY_SEGMENTS = 4;

export const STICKER_SIZE = 0.74;
export const STICKER_DEPTH = 0.1;
export const STICKER_RADIUS = 0.05;
export const STICKER_SEGMENTS = 3;
export const STICKER_SINK = 0.04;
export const STICKER_OFFSET = CUBELET / 2 + STICKER_DEPTH / 2 - STICKER_SINK; // 0.51

export const CUBE_HALF = 1.5 * PITCH;
export const APPARENT_RADIUS = 2.3;
export const FILL = 0.68;
export const CAMERA_FOV = 32;
export const CAMERA_ELEVATION = 18; // degrees

export const LAYER_LIFT = 0.08;
export const TAP_MAX_PX = 8;
export const TAP_MAX_MS = 450;
export const ROT_PER_PX = 0.0075;
export const MOMENTUM_DECAY = 3.5;
export const MOMENTUM_MAX = 12;
export const MOMENTUM_STOP = 0.02;
export const LAYER_PX_PER_QUARTER = 140;

export const COLORS: Record<string, string> = {
  U: '#FFFDF8', D: '#FFD54A', R: '#F0574A', L: '#FF9440', F: '#3DBE72', B: '#3E7BE0',
  '.': '#7C7689',
};
export const BODY_COLOR = '#35304A';

export const SPRING = {
  press: { k: 800, c: 18 },
  turn: { k: 300, c: 22 },
  turnReduced: { k: 300, c: 34.6 },
  orient: { k: 120, c: 17.5 },
  orientReduced: { k: 120, c: 21.9 },
  squash: { k: 400, c: 24 },
};
export const HIGHLIGHT_DAMP = 12;
