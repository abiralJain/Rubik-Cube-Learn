import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import { SOLVED, applyMove, applyMoves, rotateZ2, rotateY, PERM } from '../facelets';
import { BASES, invert, normalizeMoves, parseAlg, type Move } from '../notation';
import { toCubies, toFacelets, permutationParity } from '../cubies';

const ALL_MOVES: Move[] = BASES.flatMap((b) => [b, `${b}2`, `${b}'`] as Move[]);

describe('facelet permutations vs cubejs', () => {
  it('matches cubejs for all 18 moves from solved', () => {
    for (const m of ALL_MOVES) expect(applyMove(SOLVED, m)).toBe(new Cube().move(m).asString());
  });
  it('matches cubejs on 200 random states and sequences', () => {
    for (let n = 0; n < 200; n++) {
      const c = Cube.random();
      const s = c.asString();
      const seq = Array.from({ length: 8 }, () => ALL_MOVES[Math.floor(Math.random() * 18)]);
      expect(applyMoves(s, seq)).toBe(Cube.fromString(s).move(seq.join(' ')).asString());
    }
  });
  it('inverse restores', () => {
    for (const m of ALL_MOVES) expect(applyMove(applyMove(SOLVED, m), invert(m))).toBe(SOLVED);
  });
  it('sexy move ×6 is identity', () => {
    let s = SOLVED;
    for (let i = 0; i < 6; i++) s = applyMoves(s, parseAlg("R U R' U'"));
    expect(s).toBe(SOLVED);
  });
  it('perm tables are permutations', () => {
    for (const m of ALL_MOVES) expect(new Set(Array.from(PERM[m])).size).toBe(54);
  });
});

describe('whole-cube rotations', () => {
  it('z2 twice is identity and keeps centres canonical', () => {
    const s = Cube.random().asString();
    expect(rotateZ2(rotateZ2(s))).toBe(s);
    const r = rotateZ2(s);
    expect(r[4] + r[13] + r[22] + r[31] + r[40] + r[49]).toBe('URFDLB');
  });
  it('z2 conjugation: a U move in the rotated frame equals a D move in the original', () => {
    const s = Cube.random().asString();
    expect(rotateZ2(applyMove(rotateZ2(s), 'U'))).toBe(applyMove(s, 'D'));
    expect(rotateZ2(applyMove(rotateZ2(s), 'R'))).toBe(applyMove(s, 'L'));
    expect(rotateZ2(applyMove(rotateZ2(s), 'F'))).toBe(applyMove(s, 'F'));
  });
  it('y four times is identity, y conjugation maps F to R', () => {
    const s = Cube.random().asString();
    expect(rotateY(s, 4)).toBe(s);
    // After y, the face that was at R is now at F. Doing F in the rotated frame = doing R in the original.
    expect(rotateY(applyMove(rotateY(s, 1), 'F'), 3)).toBe(applyMove(s, 'R'));
  });
});

describe('cubies', () => {
  it('round-trips random states', () => {
    for (let n = 0; n < 50; n++) {
      const s = Cube.random().asString();
      const r = toCubies(s);
      expect(r.ok).toBe(true);
      if (r.ok) expect(toFacelets(r.cube)).toBe(s);
    }
  });
  it('detects an impossible piece', () => {
    const bad = SOLVED.split(''); bad[8] = 'D'; // white-yellow corner
    const r = toCubies(bad.join(''));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.badFacelets).toEqual([8, 9, 20]);
  });
  it('parity helper', () => {
    expect(permutationParity([0, 1, 2])).toBe(0);
    expect(permutationParity([1, 0, 2])).toBe(1);
    expect(permutationParity([1, 2, 0])).toBe(0);
  });
});

describe('notation', () => {
  it('normalizes', () => {
    expect(normalizeMoves(parseAlg("R R"))).toEqual(['R2']);
    expect(normalizeMoves(parseAlg("R R'"))).toEqual([]);
    expect(normalizeMoves(parseAlg("U U U"))).toEqual(["U'"]);
    expect(normalizeMoves(parseAlg("R U U' R"))).toEqual(['R2']);
  });
});
