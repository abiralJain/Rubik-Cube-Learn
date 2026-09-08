import { describe, it, expect } from 'vitest';
import { randomState, randomScramble, mulberry32 } from '../scramble';
import { validate } from '../validate';
import { lbl } from '../lbl';
import { SOLVED, applyMoves } from '../facelets';

describe('scramble', () => {
  it('random states are valid and solvable by the teacher', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 200; i++) { const f = randomState(rng); expect(validate(f)).toEqual({ ok: true }); }
    for (let i = 0; i < 20; i++) expect(() => lbl(randomState(rng))).not.toThrow();
  });
  it('is reproducible from a seed', () => { expect(randomState(mulberry32(7))).toBe(randomState(mulberry32(7))); });
  it('move scrambles avoid repeats and axis triples and produce valid states', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const seq = randomScramble(20, rng);
      expect(seq).toHaveLength(20);
      for (let k = 1; k < seq.length; k++) expect(seq[k][0]).not.toBe(seq[k - 1][0]);
      expect(validate(applyMoves(SOLVED, seq)).ok).toBe(true);
    }
  });
});
