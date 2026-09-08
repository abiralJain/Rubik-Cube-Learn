import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import { SOLVED, applyMoves, rotateZ2 } from '../facelets';
import { lbl, planMoveCount, STAGES } from '../lbl';
import { rotY, z2Relabel } from '../notation';

describe('lbl teaching solver', () => {
  it('solves 500 random states with chained steps and a sane move budget', () => {
    const totals: number[] = [];
    for (let n = 0; n < 500; n++) {
      const f = Cube.random().asString();
      const plan = lbl(f);
      let s = f;
      for (const step of plan) {
        expect(step.before).toBe(s);
        s = applyMoves(s, step.moves);
        expect(step.after).toBe(s);
        expect(step.moves.length).toBeLessThanOrEqual(14);
      }
      expect(s).toBe(SOLVED);
      totals.push(planMoveCount(plan));
    }
    totals.sort((a, b) => a - b);
    const p99 = totals[Math.floor(totals.length * 0.99)];
    console.info(`lbl moves: mean ${(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)}, p99 ${p99}, max ${totals[totals.length - 1]}`);
    expect(p99).toBeLessThan(200);
    expect(totals[totals.length - 1]).toBeLessThan(260);
  });
  it('stages appear in order and a solved cube yields only skips', () => {
    const plan = lbl(SOLVED);
    expect(plan.map((s) => s.stage)).toEqual(STAGES);
    expect(plan.every((s) => s.kind === 'skip')).toBe(true);
  });
  it('is deterministic', () => {
    const f = Cube.random().asString();
    expect(lbl(f)).toEqual(lbl(f));
  });
  it('display moves relabel to standard moves through the y and z2 maps', () => {
    const f = Cube.random().asString();
    const RING = ['F', 'R', 'B', 'L'];
    for (const step of lbl(f)) {
      const k = RING.indexOf(({ F: 'F', L: 'R', B: 'B', R: 'L' } as Record<string, string>)[step.orientation.front]);
      expect(step.moves).toEqual(step.displayMoves.map((m) => z2Relabel(rotY(m, k))));
    }
  });
  it('highlights point at the target piece in the standard frame', () => {
    const f = Cube.random().asString();
    const plan = lbl(f);
    const first = plan.find((s) => s.stage === 'white-cross' && s.kind === 'solve')!;
    // the first cross step targets the white-green edge: its two facelets must be white and green in the standard frame
    const cols = first.highlight.map((i) => f[i]).sort();
    expect(cols).toEqual(['F', 'U']);
    void rotateZ2;
  });
});
