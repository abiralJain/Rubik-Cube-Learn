// Writes a Y4M video of a cube face (3x3 coloured stickers on a dark body) for Chrome's fake camera.
import { writeFileSync } from 'node:fs';
const W = 640, H = 480, FRAMES = 30;
const colours = { U: [255, 253, 248], R: [240, 87, 74], F: [61, 190, 114], D: [255, 213, 74], L: [255, 148, 64], B: [62, 123, 224] };
const face = (process.argv[2] ?? 'FUFRFLDBF').split(''); // 9 letters row-major; centre must be the face
const rgb = new Uint8Array(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let c = [232, 226, 236]; // room
  const s = Math.min(W, H), ox = (W - s) / 2, oy = (H - s) / 2; // the app crops this centre square
  const inset = s * 0.18, cell = (s - 2 * inset) / 3;
  const cx = x - ox - inset, cy = y - oy - inset;
  if (cx >= 0 && cy >= 0 && cx < 3 * cell && cy < 3 * cell) {
    c = [52, 48, 66];
    const col = Math.floor(cx / cell), row = Math.floor(cy / cell);
    const lx = cx - col * cell, ly = cy - row * cell, pad = cell * 0.09;
    if (lx > pad && lx < cell - pad && ly > pad && ly < cell - pad) c = colours[face[row * 3 + col]];
  }
  const i = (y * W + x) * 3; rgb[i] = c[0]; rgb[i + 1] = c[1]; rgb[i + 2] = c[2];
}
// RGB → YUV420
const Y = new Uint8Array(W * H), U = new Uint8Array((W / 2) * (H / 2)), V = new Uint8Array((W / 2) * (H / 2));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
  Y[y * W + x] = Math.round(0.257 * r + 0.504 * g + 0.098 * b + 16);
  if (y % 2 === 0 && x % 2 === 0) { const j = (y / 2) * (W / 2) + x / 2; U[j] = Math.round(-0.148 * r - 0.291 * g + 0.439 * b + 128); V[j] = Math.round(0.439 * r - 0.368 * g - 0.071 * b + 128); }
}
const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`);
const frame = Buffer.concat([Buffer.from('FRAME\n'), Buffer.from(Y), Buffer.from(U), Buffer.from(V)]);
writeFileSync(process.argv[3] ?? 'tests/fixtures/face.y4m', Buffer.concat([header, ...Array(FRAMES).fill(frame)]));
console.log('wrote', process.argv[3] ?? 'tests/fixtures/face.y4m');
