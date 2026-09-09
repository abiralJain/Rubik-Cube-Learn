import { describe, it, expect } from 'vitest';
import { classify, rgbToHsv, DEFAULT_REFS } from '../classify';

const patches: Array<[string, [number, number, number]]> = [
  ['U', [245, 242, 235]], ['U', [220, 225, 230]], ['U', [255, 250, 230]],
  ['D', [255, 213, 74]], ['D', [240, 200, 60]], ['D', [250, 225, 120]],
  ['R', [240, 87, 74]], ['R', [200, 40, 40]], ['R', [230, 70, 90]],
  ['L', [255, 148, 64]], ['L', [235, 130, 40]], ['L', [255, 165, 90]],
  ['F', [61, 190, 114]], ['F', [30, 150, 80]], ['F', [90, 200, 130]],
  ['B', [62, 123, 224]], ['B', [40, 90, 200]], ['B', [90, 140, 230]],
];
const warm = ([r, g, b]: [number, number, number]): [number, number, number] => [Math.min(255, r * 1.05), g * 0.95, b * 0.8];
describe('camera classifier', () => {
  it('classifies the standard colours under defaults', () => {
    let ok = 0;
    for (const [face, rgb] of patches) if (classify(rgbToHsv(...rgb), DEFAULT_REFS).face === face) ok++;
    expect(ok / patches.length).toBeGreaterThanOrEqual(0.94);
  });
  it('under a warm lamp, calibrating on the centres keeps red and orange apart', () => {
    const refs = { ...DEFAULT_REFS };
    const centres: Record<string, [number, number, number]> = { U: [245, 242, 235], D: [255, 213, 74], R: [240, 87, 74], L: [255, 148, 64], F: [61, 190, 114], B: [62, 123, 224] };
    for (const f of Object.keys(centres)) refs[f as keyof typeof refs] = rgbToHsv(...warm(centres[f]));
    let ok = 0;
    for (const [face, rgb] of patches) if (classify(rgbToHsv(...warm(rgb)), refs).face === face) ok++;
    expect(ok / patches.length).toBeGreaterThanOrEqual(0.94);
  });
});
