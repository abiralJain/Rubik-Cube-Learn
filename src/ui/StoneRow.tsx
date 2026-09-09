import './StoneRow.css';
import { STAGES, STAGE_NAME, type StageId } from '@/cube/lbl';

/**
 * The seven stage stones in a row: lit when unlocked, the current one ringed with progress, the rest dim.
 * Always visible on Solve, so the journey is never out of sight.
 */
export function StoneRow({ unlocked, current, progress = 0, size = 28, onPick }: { unlocked: Partial<Record<StageId, number>>; current?: StageId | null; progress?: number; size?: number; onPick?: (s: StageId) => void }) {
  const r = size / 2 + 4, c = 2 * Math.PI * r;
  return (
    <ol className="stones" style={{ '--stone': `${size}px` } as React.CSSProperties} aria-label="Stages">
      {STAGES.map((st, i) => {
        const lit = !!unlocked[st];
        const now = st === current;
        return (
          <li key={st} data-lit={lit ? '' : undefined} data-now={now ? '' : undefined}>
            <button type="button" onClick={onPick ? () => onPick(st) : undefined} aria-label={`${STAGE_NAME[st]}${lit ? ', unlocked' : now ? ', in progress' : ''}`} tabIndex={onPick ? 0 : -1}>
              <img src={`${import.meta.env.BASE_URL}gems/stage-${i + 1}.webp`} alt="" decoding="async" />
              {now && (
                <svg className="stone-ring" viewBox={`0 0 ${(r + 2) * 2} ${(r + 2) * 2}`} aria-hidden>
                  <circle cx={r + 2} cy={r + 2} r={r} pathLength={100} strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 100} 100`} style={{ strokeDashoffset: 0, ['--c' as string]: c }} />
                </svg>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
