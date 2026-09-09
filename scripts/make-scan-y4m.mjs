// Writes a Y4M video that shows all six sides of a cube in the scanner's capture order, each held still for a
// moment with a blank room between them, for Chrome's fake camera. Usage: node scripts/make-scan-y4m.mjs <facelets> <out.y4m> [hold=45] [gap=12]
import { writeFileSync } from 'node:fs';
const W = 320, H = 240;
const facelets = process.argv[2]; const out = process.argv[3]; const HOLD = +(process.argv[4] ?? 45), GAP = +(process.argv[5] ?? 12);
if (!/^[URFDLB]{54}$/.test(facelets ?? '')) { console.error('need 54 facelets'); process.exit(1); }
const colours = { U: [246, 244, 236], R: [200, 30, 40], F: [30, 160, 80], D: [245, 205, 40], L: [240, 125, 35], B: [40, 80, 200] };
const ORDER = ['F', 'R', 'B', 'L', 'U', 'D']; const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const idx = (f, k) => FACES.indexOf(f) * 9 + k;
function frameFor(face) {
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = [96, 92, 100]; // a grey room
    if (face) {
      const s = Math.min(W, H), ox = (W - s) / 2, oy = (H - s) / 2;
      const inset = s * 0.18, cell = (s - 2 * inset) / 3;
      const cx = x - ox - inset, cy = y - oy - inset;
      if (cx >= 0 && cy >= 0 && cx < 3 * cell && cy < 3 * cell) {
        c = [18, 18, 22];
        const col = Math.floor(cx / cell), row = Math.floor(cy / cell);
        const lx = cx - col * cell, ly = cy - row * cell, pad = cell * 0.09;
        if (lx > pad && lx < cell - pad && ly > pad && ly < cell - pad) c = colours[facelets[idx(face, row * 3 + col)]];
      }
    }
    const i = (y * W + x) * 3; rgb[i] = c[0]; rgb[i + 1] = c[1]; rgb[i + 2] = c[2];
  }
  const Y = new Uint8Array(W * H), U = new Uint8Array((W / 2) * (H / 2)), V = new Uint8Array((W / 2) * (H / 2));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    Y[y * W + x] = Math.round(0.257 * r + 0.504 * g + 0.098 * b + 16);
    if (y % 2 === 0 && x % 2 === 0) { const j = (y / 2) * (W / 2) + x / 2; U[j] = Math.round(-0.148 * r - 0.291 * g + 0.439 * b + 128); V[j] = Math.round(0.439 * r - 0.368 * g - 0.071 * b + 128); }
  }
  return Buffer.concat([Buffer.from('FRAME\n'), Buffer.from(Y), Buffer.from(U), Buffer.from(V)]);
}
const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`);
const room = frameFor(null);
const parts = [header];
for (const f of ORDER) { const fr = frameFor(f); for (let i = 0; i < HOLD; i++) parts.push(fr); for (let i = 0; i < GAP; i++) parts.push(room); }
writeFileSync(out, Buffer.concat(parts));
console.log('wrote', out, `${(parts.length - 1)} frames`);
