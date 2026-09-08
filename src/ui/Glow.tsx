import './Glow.css';
import type { CSSProperties } from 'react';

export type Tint = 'white' | 'yellow' | 'red' | 'orange' | 'green' | 'blue';

const BLOBS: Array<{ c: Tint; x0: string; y0: string; x1: string; y1: string; dur: string; delay: string }> = [
  { c: 'yellow', x0: '5vw',  y0: '-5vh', x1: '20vw', y1: '10vh', dur: '29s', delay: '-4s' },
  { c: 'red',    x0: '60vw', y0: '0vh',  x1: '48vw', y1: '18vh', dur: '37s', delay: '-11s' },
  { c: 'blue',   x0: '55vw', y0: '55vh', x1: '70vw', y1: '40vh', dur: '41s', delay: '-2s' },
  { c: 'green',  x0: '-5vw', y0: '55vh', x1: '10vw', y1: '38vh', dur: '31s', delay: '-17s' },
  { c: 'orange', x0: '30vw', y0: '70vh', x1: '38vw', y1: '52vh', dur: '35s', delay: '-8s' },
  { c: 'white',  x0: '25vw', y0: '25vh', x1: '35vw', y1: '35vh', dur: '23s', delay: '-1s' },
];

const COLOR: Record<Tint, string> = {
  white: '#FFF3C4', yellow: 'var(--c-yellow)', red: 'var(--c-red)',
  orange: 'var(--c-orange)', green: 'var(--c-green)', blue: 'var(--c-blue)',
};

export function Glow({ tint, mode }: { tint?: Tint | null; mode?: 'holo' | 'off' }) {
  return (
    <div className="glow" aria-hidden data-tint={tint ?? undefined} data-mode={mode}>
      {BLOBS.map((b) => (
        <i
          key={b.c}
          data-c={b.c}
          style={{ '--blob': COLOR[b.c], '--x0': b.x0, '--y0': b.y0, '--x1': b.x1, '--y1': b.y1, '--dur': b.dur, '--delay': b.delay } as CSSProperties}
        />
      ))}
    </div>
  );
}
