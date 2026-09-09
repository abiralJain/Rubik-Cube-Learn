import './Glow.css';
import type { CSSProperties } from 'react';

export type Tint = 'white' | 'yellow' | 'red' | 'orange' | 'green' | 'blue';

const ACCENT: Record<Tint, string> = {
  white: 'var(--a-white)', yellow: 'var(--a-yellow)', red: 'var(--a-red)',
  orange: 'var(--a-orange)', green: 'var(--a-green)', blue: 'var(--a-blue)',
};

/**
 * The room. One soft light behind the hero object (Opal's gem glow), coloured by the current stage,
 * and a faint vignette so the black has depth. Also publishes `--tint` for accent text and rims.
 */
export function Glow({ tint, mode }: { tint?: Tint | null; mode?: 'holo' | 'off' }) {
  const style = { '--glow': tint ? ACCENT[tint] : 'var(--a-mint)' } as CSSProperties;
  return <div className="room" aria-hidden data-tint={tint ?? undefined} data-mode={mode} style={style} />;
}

export const accentFor = (t: Tint | null | undefined) => (t ? ACCENT[t] : 'var(--a-mint)');
