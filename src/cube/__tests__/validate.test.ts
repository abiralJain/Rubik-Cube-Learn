import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import { SOLVED } from '../facelets';
import { validate } from '../validate';
import { CORNER_FACELET, EDGE_FACELET } from '../cubies';

const swap = (f: string, a: number, b: number) => { const x = f.split(''); [x[a], x[b]] = [x[b], x[a]]; return x.join(''); };

describe('validate', () => {
  it('accepts solved and 100 random states', () => {
    expect(validate(SOLVED)).toEqual({ ok: true });
    for (let i = 0; i < 100; i++) expect(validate(Cube.random().asString()).ok).toBe(true);
  });
  it('flags incomplete', () => {
    const r = validate(SOLVED.slice(0, 10) + '.' + SOLVED.slice(11));
    expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toBe('incomplete');
  });
  it('flags counts with the over-represented colour as suspects', () => {
    const f = SOLVED.slice(0, 9) + 'U' + SOLVED.slice(10); // 10 whites, 8 reds
    const r = validate(f);
    expect(r.ok).toBe(false); if (!r.ok) { expect(r.reason).toBe('counts'); expect(r.suspects).toContain(9); }
  });
  it('flags a twisted corner', () => {
    const fc = CORNER_FACELET[0]; const x = SOLVED.split(''); const v = fc.map((i) => x[i]); fc.forEach((i, k) => { x[i] = v[(k + 1) % 3]; });
    const r = validate(x.join(''));
    expect(r.ok).toBe(false); if (!r.ok) { expect(r.reason).toBe('corner-twist'); expect(r.candidates).toBe(8); }
  });
  it('flags a flipped edge, and points at it when a recent edit narrows it', () => {
    const [a, b] = EDGE_FACELET[1];
    const r = validate(swap(SOLVED, a, b), { recentlyEdited: [a] });
    expect(r.ok).toBe(false); if (!r.ok) { expect(r.reason).toBe('edge-flip'); expect(r.suspects).toEqual(EDGE_FACELET[1]); }
  });
  it('flags parity when two edges are swapped', () => {
    const scr = Cube.random().asString();
    // swap the UF and UR edges (both stickers)
    let f = swap(scr, EDGE_FACELET[0][0], EDGE_FACELET[1][0]); f = swap(f, EDGE_FACELET[0][1], EDGE_FACELET[1][1]);
    const r = validate(f);
    expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toBe('parity');
  });
  it('flags an impossible piece with its exact facelets', () => {
    const f = swap(SOLVED, 9, 28); // URF corner becomes white+yellow+green; counts stay 9 each
    const r = validate(f);
    expect(r.ok).toBe(false); if (!r.ok) { expect(r.reason).toBe('bad-piece'); expect(r.suspects).toEqual([8, 9, 20]); }
  });
  it('two swapped stickers on one face are caught and the suspects include them', () => {
    for (let n = 0; n < 20; n++) {
      const scr = Cube.random().asString();
      const f = swap(scr, 19, 23); // two F-face edge stickers
      if (f === scr) continue;
      const r = validate(f, { recentlyEdited: [19, 23] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.suspects.length).toBeGreaterThan(0);
    }
  });
});
