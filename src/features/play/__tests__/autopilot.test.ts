import { describe, it, expect } from 'vitest';
import { initial, reduce, waitFor, type Auto, type Event } from '../autopilot';

const run = (events: Event[], start: Auto = initial) => events.reduce<{ state: Auto; effects: string[] }>((acc, e) => { const r = reduce(acc.state, e); return { state: r.state, effects: [...acc.effects, ...r.effects] }; }, { state: start, effects: [] });

describe('autopilot', () => {
  it('speaks, sweeps, waits the pace, plays, breathes, advances', () => {
    const r = run([{ type: 'card', index: 0 }, { type: 'spoken' }, { type: 'tick', dt: 2, pace: 4 }, { type: 'tick', dt: 2.1, pace: 4 }, { type: 'played' }, { type: 'breathed' }]);
    expect(r.effects).toEqual(['speak', 'sweep', 'play', 'advance']);
    expect(r.state.phase).toBe('breath');
  });
  it('reports progress while waiting', () => {
    const r = run([{ type: 'card', index: 0 }, { type: 'spoken' }, { type: 'tick', dt: 1, pace: 4 }]);
    expect(r.state.phase).toBe('waiting');
    expect(r.state.progress).toBeCloseTo(0.25);
  });
  it('pause freezes the wait and resume continues from the same point without re-speaking', () => {
    const a = run([{ type: 'card', index: 0 }, { type: 'spoken' }, { type: 'tick', dt: 1, pace: 4 }, { type: 'pause' }, { type: 'tick', dt: 10, pace: 4 }]);
    expect(a.state.phase).toBe('paused');
    expect(a.state.progress).toBeCloseTo(0.25);
    const b = run([{ type: 'resume' }], a.state);
    expect(b.state.phase).toBe('waiting');
    expect(b.effects).toEqual(['sweep']);
    expect(b.state.waited).toBeCloseTo(1);
  });
  it('a new card while paused stays paused and speaks on resume', () => {
    const a = run([{ type: 'card', index: 0 }, { type: 'pause' }, { type: 'card', index: 1 }]);
    expect(a.state.phase).toBe('paused');
    expect(a.state.card).toBe(1);
    const b = run([{ type: 'resume' }], a.state);
    expect(b.effects).toEqual(['speak']);
  });
  it('again replays and restarts the wait, and the wait grows', () => {
    const a = run([{ type: 'card', index: 0 }, { type: 'spoken' }, { type: 'tick', dt: 3, pace: 4 }, { type: 'again' }]);
    expect(a.effects.slice(-2)).toEqual(['replay', 'speak']);
    expect(a.state.waited).toBe(0);
    expect(a.state.replays).toBe(1);
    expect(waitFor(4, { type: 'move' }, 1)).toBe(5.5);
  });
  it('holds wait longer, first moves of a step a little longer', () => {
    expect(waitFor(4, { type: 'hold' }, 0)).toBe(6);
    expect(waitFor(2, { type: 'hold' }, 0)).toBe(5);
    expect(waitFor(4, { type: 'move', firstOfStep: true }, 0)).toBe(5);
  });
  it('spoken while playing is ignored; finish ends everything', () => {
    const a = run([{ type: 'card', index: 0 }, { type: 'spoken' }, { type: 'tick', dt: 5, pace: 4 }, { type: 'spoken' }]);
    expect(a.state.phase).toBe('playing');
    expect(run([{ type: 'finish' }], a.state).state.phase).toBe('done');
  });
});
