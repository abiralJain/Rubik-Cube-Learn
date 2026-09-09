import './StatePill.css';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

export type PillState = 'idle' | 'speaking' | 'turn' | 'paused' | 'checking' | 'done';

/**
 * One control that shows what the app is doing and morphs between states: a waveform while it speaks, a draining
 * ring while it waits for your turn, a play glyph when paused, dots while it checks. Tap to pause/resume.
 * Inspired by the morphing pill in the references (logo → pause → thinking).
 */
export function StatePill({ state, progress = 0, label, onTap, onHold, tint }: { state: PillState; progress?: number; label?: string; onTap?: () => void; onHold?: () => void; tint?: string }) {
  const r = 9, c = 2 * Math.PI * r;
  let holdTimer: number | undefined;
  return (
    <motion.button
      type="button"
      className="state-pill"
      data-state={state}
      layout
      transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
      onClick={onTap}
      onPointerDown={() => { if (onHold) holdTimer = window.setTimeout(onHold, 520); }}
      onPointerUp={() => clearTimeout(holdTimer)}
      onPointerLeave={() => clearTimeout(holdTimer)}
      aria-label={label ?? state}
      style={tint ? ({ '--pill-tint': tint } as React.CSSProperties) : undefined}
    >
      <span className="pill-glyph">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={state} className="pill-glyph-in" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
            {state === 'speaking' && <i className="wave" aria-hidden><b /><b /><b /><b /></i>}
            {state === 'turn' && (
              <svg className="ring" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r={r} className="track" />
                <circle cx="12" cy="12" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))} />
              </svg>
            )}
            {state === 'paused' && <Icon name="play" weight={0} style={{ fill: 'currentColor' }} />}
            {state === 'checking' && <i className="dots" aria-hidden><b /><b /><b /></i>}
            {state === 'done' && <Icon name="check" />}
            {state === 'idle' && <Icon name="play" weight={0} style={{ fill: 'currentColor' }} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        {label && (
          <motion.span key={label} className="pill-label" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
