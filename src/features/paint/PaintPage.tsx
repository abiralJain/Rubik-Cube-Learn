import './Paint.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CubeStage } from '@/cube3d/CubeStage';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { RollingNumber } from '@/ui/RollingNumber';
import { useShellState } from '@/ui/Shell';
import { useSession, filledCount, type Facelet } from '@/store/session';
import { FACES, FACE_COLOUR, isCentre, type Face } from '@/cube/facelets';
import { validate, type Validation } from '@/cube/validate';
import * as sfx from '@/audio/sounds';

const COLOUR_CSS: Record<Face, string> = { U: 'var(--c-white)', R: 'var(--c-red)', F: 'var(--c-green)', D: 'var(--c-yellow)', L: 'var(--c-orange)', B: 'var(--c-blue)' };
const TINT: Record<Face, 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'blue'> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
const NOTE: Record<Face, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const LIGHT = new Set<Face>(['U', 'D']);

export default function PaintPage() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { facelets, paintHistory, paint, undoPaint, settings, setSetting } = useSession();
  const setShell = useShellState((s) => s.set);
  const [active, setActive] = useState<Face>('U');
  const [showSuspects, setShowSuspects] = useState(false);

  const remaining = useMemo(() => Object.fromEntries(FACES.map((f) => [f, 9 - facelets.split('').filter((c) => c === f).length])) as Record<Face, number>, [facelets]);
  const filled = filledCount(facelets);
  const complete = filled === 54;
  const validation: Validation | null = useMemo(() => (complete ? validate(facelets, { recentlyEdited: paintHistory.slice(-6).map((e) => e.index) }) : null), [complete, facelets, paintHistory]);
  const ready = validation?.ok === true;

  useEffect(() => { setShell({ tint: TINT[active], mode: undefined }); }, [active, setShell]);
  useEffect(() => () => setShell({ tint: null }), [setShell]);

  // a spent colour never stays selected
  useEffect(() => {
    if (remaining[active] <= 0) {
      const next = FACES.find((f) => remaining[f] > 0);
      if (next) setActive(next);
    }
  }, [remaining, active]);

  // 53 in → the 54th is not a decision
  useEffect(() => {
    if (filled !== 53) return;
    const short = FACES.find((f) => remaining[f] === 1);
    const hole = facelets.indexOf('.');
    if (short && hole >= 0) {
      const t = setTimeout(() => { paint(hole, short, true); sfx.cadence(); if (navigator.vibrate) navigator.vibrate([8, 40, 8]); }, 160);
      return () => clearTimeout(t);
    }
  }, [filled, facelets, remaining, paint]);

  useEffect(() => { setShowSuspects(false); }, [facelets]);

  const onStickerTap = useCallback((i: number) => {
    if (isCentre(i)) { sfx.bloop(); return; }
    const cur = facelets[i] as Facelet;
    if (cur === active) { paint(i, '.'); sfx.plink(NOTE[active], 0.12); return; }
    if (remaining[active] <= 0) { sfx.bloop(); return; }
    paint(i, active);
    sfx.plink(NOTE[active]);
    if (navigator.vibrate) navigator.vibrate(6);
    if (!settings.seenPaintHint) setSetting('seenPaintHint', true);
  }, [facelets, active, remaining, paint, settings.seenPaintHint, setSetting]);

  // keyboard: 1–6 colours, Space = primary, Backspace/Z = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6) { const f = FACES[n - 1]; if (remaining[f] > 0) setActive(f); return; }
      if (e.key === ' ' && ready) { e.preventDefault(); go(); }
      if ((e.key === 'Backspace' || e.key.toLowerCase() === 'z') && paintHistory.length) { e.preventDefault(); undoPaint(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const go = () => { nav('/learn'); };

  const highlight = useMemo(() => (showSuspects && validation && !validation.ok && validation.suspects.length ? new Set(validation.suspects) : null), [showSuspects, validation]);

  const hint = ready
    ? <>All 54 in. <b>Ready when you are.</b></>
    : validation && !validation.ok
      ? <>{validation.message}</>
      : filled <= 6 && !settings.seenPaintHint
        ? <><b>Tap a sticker</b> to colour it in. Drag to spin.</>
        : filled < 33
          ? <>Keep going. <b>Spin the cube</b> to reach the back.</>
          : <>Nearly there.</>;

  const wasReady = useRef(false);
  useEffect(() => { if (ready && !wasReady.current) { sfx.stageChime(); } wasReady.current = ready; }, [ready]);

  return (
    <main className="screen" aria-label="Colour in your cube">
      <div className="stage">
        <CubeStage facelets={facelets} onStickerTap={onStickerTap} highlight={highlight} interactive />
        <p className="paint-hint" aria-live="polite">{hint}</p>
        <p className="paint-count num"><RollingNumber value={filled} /> of 54 stickers</p>
      </div>
      <div className="dock">
        <div className="swatches" role="radiogroup" aria-label="Sticker colours">
          {FACES.map((f, i) => (
            <button
              key={f}
              className="sw"
              role="radio"
              style={{ '--fill': COLOUR_CSS[f] } as CSSProperties}
              aria-checked={f === active}
              aria-label={`${FACE_COLOUR[f]}, ${remaining[f]} left. Press ${i + 1}`}
              data-light={LIGHT.has(f) ? '' : undefined}
              data-empty={remaining[f] <= 0 ? '' : undefined}
              onPointerDown={() => { sfx.unlockAudio(); setActive(f); sfx.plink(NOTE[f], 0.1); }}
            >
              <i /><b className="num">{remaining[f]}</b>
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {validation && !validation.ok && validation.reason !== 'incomplete' && (
            <motion.div
              key="issue"
              className="glass paint-issue"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(6px)' }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              role="status"
            >
              <Icon name="bulb" style={{ width: 22, height: 22, flex: '0 0 auto', color: 'var(--c-orange-deep)' }} />
              <span style={{ flex: 1 }}>{validation.suspects.length ? 'Let’s find them.' : validation.message}</span>
              {validation.suspects.length > 0 && (
                <Button variant="ghost" aria-pressed={showSuspects} onClick={() => setShowSuspects((v) => !v)}>{showSuspects ? 'Show all' : 'Show me'}</Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="paint-row">
          <Button variant="ghost" onClick={() => { undoPaint(); sfx.plink(0, 0.08); }} disabled={!paintHistory.length} aria-label="Undo">
            <Icon name="undo" /> Undo
          </Button>
          <Button className="btn-primary" tone={TINT[active]} disabled={!ready} ready={ready} onClick={go} block>
            <Icon name="check" /> Solve this cube
          </Button>
        </div>
      </div>
    </main>
  );
}
