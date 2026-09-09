import { describe, it, expect } from 'vitest';
import { suggest } from '../suggest';
import { rotateCornerAt, flipEdgeAt, swapAt, setAt, validate } from '../validate';
import { randomState, mulberry32 } from '../scramble';
import { FACES, isCentre } from '../facelets';

describe('suggest', () => {
  const rng = mulberry32(2024);
  const pick = (n: number) => Math.floor(rng() * n);
  const N = 500;

  it('a twisted corner: the exact undo is always listed, and is the top pick when the corner was just painted', () => {
    let listed = 0, top = 0;
    for (let n = 0; n < N; n++) {
      const cube = randomState(rng);
      const corner = pick(8);
      const bad = rotateCornerAt(cube, corner, rng() < 0.5 ? 1 : 2);
      const s = suggest(bad);
      if (s.all.some((x) => x.kind === 'twist' && x.facelets === cube)) listed++;
      const touched = s.all.find((x) => x.facelets === cube)!.touched;
      const hinted = suggest(bad, { recentlyEdited: [touched[0]] });
      if (hinted.top?.facelets === cube) top++;
    }
    expect(listed).toBe(N);
    expect(top).toBe(N);
  });
  it('a flipped edge: the exact undo is always listed, and is the top pick when the edge was just painted', () => {
    let listed = 0, top = 0;
    for (let n = 0; n < N; n++) {
      const cube = randomState(rng);
      const bad = flipEdgeAt(cube, pick(12));
      const s = suggest(bad);
      if (s.all.some((x) => x.kind === 'flip' && x.facelets === cube)) listed++;
      const touched = s.all.find((x) => x.facelets === cube)!.touched;
      if (suggest(bad, { recentlyEdited: [touched[1]] }).top?.facelets === cube) top++;
    }
    expect(listed).toBe(N);
    expect(top).toBe(N);
  });
  it('recovers a single misread sticker as the top suggestion almost always, and always within the list', () => {
    let top = 0, listed = 0;
    for (let n = 0; n < N; n++) {
      const cube = randomState(rng);
      let i = pick(54); while (isCentre(i)) i = pick(54);
      const c = FACES.filter((f) => f !== cube[i])[pick(5)];
      const bad = setAt(cube, i, c);
      const s = suggest(bad, { recentlyEdited: [i] });
      if (s.top?.facelets === cube) top++;
      if (s.all.some((x) => x.facelets === cube)) listed++;
    }
    expect(listed / N).toBeGreaterThan(0.97);
    expect(top / N).toBeGreaterThan(0.9);
  });
  it('recovers two swapped stickers within the list', () => {
    let listed = 0, top = 0;
    for (let n = 0; n < 150; n++) {
      const cube = randomState(rng);
      let a = pick(54), b = pick(54);
      while (isCentre(a)) a = pick(54);
      while (isCentre(b) || b === a || cube[a] === cube[b]) b = pick(54);
      const bad = swapAt(cube, a, b);
      if (validate(bad).ok) continue; // some swaps make another valid cube; nothing to suggest
      const s = suggest(bad, { recentlyEdited: [a, b] });
      if (s.all.some((x) => x.facelets === cube)) listed++;
      if (s.top?.facelets === cube) top++;
    }
    expect(listed).toBeGreaterThan(120);
    expect(top).toBeGreaterThan(90);
  });
  it('every suggestion is a valid cube and has words', () => {
    const cube = randomState(rng);
    const s = suggest(rotateCornerAt(cube, 3, 1));
    for (const x of s.all) { expect(validate(x.facelets).ok).toBe(true); expect(x.sentence.length).toBeGreaterThan(5); expect(x.detail.length).toBeGreaterThan(10); }
  });
});
