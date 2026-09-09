import './Fix.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { RollingNumber } from '@/ui/RollingNumber';
import { useShellState } from '@/ui/Shell';
import { useStage, cubeHandle } from '@/cube3d/scene/stage';
import { faceSide, type Orientation } from '@/cube3d/orientation';
import { useSession, filledCount, type Facelet } from '@/store/session';
import { FACES, FACE_COLOUR, faceOf, isCentre, idx, type Face } from '@/cube/facelets';
import { validate } from '@/cube/validate';
import { suggest, type Suggestion } from '@/cube/suggest';
import { speak, hush } from '@/features/play/voice';
import * as sfx from '@/audio/sounds';

const COLOUR_CSS: Record<Face, string> = { U: 'var(--c-white)', R: 'var(--c-red)', F: 'var(--c-green)', D: 'var(--c-yellow)', L: 'var(--c-orange)', B: 'var(--c-blue)' };
const TINT: Record<Face, 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'blue'> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
const NOTE: Record<Face, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const LIGHT = new Set<Face>(['U', 'D']);
/** The order the cube presents its faces while you colour it in: the four sides, then top and bottom. */
const FILL_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];

/**
 * Fix: the cube's colours. Two moods in one screen.
 *  - Colouring in (some stickers empty): six colour stones, tap stickers, the cube tilts to the face you are filling.
 *  - One thing off (all 54 in, not a cube): the app names the fix and offers it as one tap; tap any sticker to recolour.
 */
export default function FixPage() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { facelets, paintHistory, paint, undoPaint, settings, setSetting } = useSession();
  const setShell = useShellState((s) => s.set);
  const [active, setActive] = useState<Face>('F');
  const [pick, setPick] = useState<number | null>(null);
  const [alt, setAlt] = useState(0);
  const [view, setView] = useState<Orientation>({ top: 'U', front: 'F', yaw: -0.55, pitch: 0.16 });

  const counts = useMemo(() => Object.fromEntries(FACES.map((f) => [f, facelets.split('').filter((c) => c === f).length])) as Record<Face, number>, [facelets]);
  const filled = filledCount(facelets);
  const complete = filled === 54;
  const validation = useMemo(() => (complete ? validate(facelets) : null), [complete, facelets]);
  const ready = validation?.ok === true;
  const recent = useMemo(() => paintHistory.slice(-6).map((e) => e.index), [paintHistory]);
  const sug = useMemo(() => (complete && !ready ? suggest(facelets, { recentlyEdited: recent }) : null), [complete, ready, facelets, recent]);
  const current: Suggestion | null = sug && sug.all.length ? sug.all[alt % sug.all.length] : null;
  useEffect(() => { setAlt(0); }, [facelets]);

  useEffect(() => { setShell({ tint: complete ? null : TINT[active], mode: undefined }); }, [active, complete, setShell]);
  useEffect(() => () => { setShell({ tint: null }); hush(); }, [setShell]);

  // the cube shows what the suggestion is about
  useEffect(() => {
    if (current) setView(orientationFor(current.touched));
  }, [current]);
  // say the suggestion once per fix
  const said = useRef('');
  useEffect(() => {
    if (!current || !settings.voice) return;
    const key = current.facelets;
    if (said.current === key) return; said.current = key;
    speak(`${current.sentence} ${current.detail}`);
  }, [current, settings.voice]);

  // colouring in: after a face fills, tilt to the next face with holes
  const tiltTo = useCallback((face: Face) => {
    setView(face === 'U' ? { top: 'B', front: 'U', yaw: 0, pitch: 0.35 } : face === 'D' ? { top: 'F', front: 'D', yaw: 0, pitch: 0.35 } : { top: 'U', front: face, yaw: -0.5, pitch: 0.16 });
  }, []);
  useEffect(() => {
    if (complete) return;
    const holes = (f: Face) => Array.from({ length: 9 }, (_, k) => facelets[idx(f, k)]).filter((c) => c === '.').length;
    const last = paintHistory[paintHistory.length - 1];
    const cur = last ? faceOf(last.index) : 'F';
    if (holes(cur) > 0) return;
    const start = FILL_ORDER.indexOf(cur);
    const next = FILL_ORDER.map((_, i) => FILL_ORDER[(start + 1 + i) % 6]).find((f) => holes(f) > 0);
    if (next) tiltTo(next);
  }, [facelets, paintHistory, complete, tiltTo]);

  const highlight = useMemo(() => (current ? new Set(current.touched) : pick !== null ? new Set([pick]) : null), [current, pick]);

  const onStickerTap = useCallback((i: number) => {
    if (isCentre(i)) { sfx.bloop(); return; }
    sfx.unlockAudio();
    if (complete) {
      // a tap on a piece the suggestions mention picks that fix; otherwise choose a sticker, then a colour
      const k = sug?.all.findIndex((x) => x.touched.includes(i)) ?? -1;
      if (k >= 0 && pick === null && !(current && current.touched.includes(i))) { setAlt(k); sfx.plink(3, 0.1); return; }
      setPick((p) => (p === i ? null : i));
      sfx.plink(2, 0.1);
      return;
    }
    const cur = facelets[i] as Facelet;
    if (cur === active) { paint(i, '.'); sfx.plink(NOTE[active], 0.12); return; }
    paint(i, active);
    sfx.plink(NOTE[active]);
    if (navigator.vibrate) navigator.vibrate(6);
    if (!settings.seenPaintHint) setSetting('seenPaintHint', true);
  }, [complete, facelets, active, paint, settings.seenPaintHint, setSetting, sug, pick, current]);

  const recolour = useCallback((f: Face) => {
    if (pick === null) return;
    paint(pick, f); sfx.plink(NOTE[f]); setPick(null);
  }, [pick, paint]);

  const apply = useCallback(() => {
    if (!current) return;
    sfx.unlockAudio();
    for (const i of current.touched) paint(i, current.facelets[i] as Facelet);
    sfx.cadence(); if (navigator.vibrate) navigator.vibrate([8, 40, 8]);
    cubeHandle()?.controller.ripple(current.touched[0], false);
  }, [current, paint]);

  const stageRef = useStage({ facelets, orientation: view, highlight, interactive: true, onStickerTap, rippleOnTap: false, fill: 0.72 });

  // keyboard: 1–6 colours, Enter = primary, Backspace/Z = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6) { const f = FACES[n - 1]; if (pick !== null) recolour(f); else setActive(f); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ready) go(); else if (current) apply(); }
      if ((e.key === 'Backspace' || e.key.toLowerCase() === 'z') && paintHistory.length) { e.preventDefault(); undoPaint(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const go = () => nav('/play');
  const wasReady = useRef(ready);
  useEffect(() => { if (ready && !wasReady.current) sfx.stageChime(); wasReady.current = ready; }, [ready]);

  const hint = ready
    ? <>That’s a cube. <b>Ready when you are.</b></>
    : complete
      ? null
      : filled <= 6 && !settings.seenPaintHint
        ? <><b>Tap a sticker</b> to colour it in. Drag to spin.</>
        : filled < 33
          ? <>Keep going. The cube turns to the <b>next side</b> for you.</>
          : <>Nearly there.</>;

  const showSwatches = !complete || pick !== null;

  return (
    <main className="screen fix" aria-label={complete ? 'Fix the colours' : 'Colour in your cube'}>
      <div className="stage" ref={stageRef}>
        {!complete && <p className="caps fix-count num"><RollingNumber value={filled} /> of 54</p>}
      </div>
      <div className="dock">
        <AnimatePresence initial={false} mode="popLayout">
          {current && pick === null ? (
            <motion.div key={'sug' + current.facelets} className="fix-card" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} role="status">
              <h1>{current.sentence}</h1>
              <p className="body">{current.detail}{sug && sug.all.length > 1 ? ' If it is a different piece, tap it.' : ''}</p>
            </motion.div>
          ) : complete && !ready && pick !== null ? (
            <motion.div key="pick" className="fix-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <h1>What colour is the lit sticker?</h1>
            </motion.div>
          ) : complete && !ready ? (
            <motion.div key="none" className="fix-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <h1>{validation && !validation.ok ? validation.message : ''}</h1>
              <p className="body">Tap the sticker that looks wrong and pick its colour.</p>
            </motion.div>
          ) : (
            <motion.p key="hint" className="fix-hint" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>{hint}</motion.p>
          )}
        </AnimatePresence>

        {showSwatches && (
          <div className="swatches" role="radiogroup" aria-label="Sticker colours">
            {FACES.map((f, i) => {
              const remaining = 9 - counts[f];
              return (
                <button
                  key={f}
                  className="sw"
                  role="radio"
                  style={{ '--fill': COLOUR_CSS[f] } as CSSProperties}
                  aria-checked={pick === null && f === active}
                  aria-label={`${FACE_COLOUR[f]}${remaining > 0 ? `, ${remaining} left` : remaining < 0 ? `, ${-remaining} too many` : ''}. Press ${i + 1}`}
                  data-light={LIGHT.has(f) ? '' : undefined}
                  data-over={remaining < 0 ? '' : undefined}
                  data-spent={remaining === 0 && !complete ? '' : undefined}
                  onPointerDown={() => { sfx.unlockAudio(); if (pick !== null) recolour(f); else { setActive(f); sfx.plink(NOTE[f], 0.1); } }}
                >
                  <i /><b className="num">{remaining > 0 ? remaining : remaining < 0 ? `+${-remaining}` : ''}</b>
                </button>
              );
            })}
          </div>
        )}

        <div className="fix-row">
          <Button variant="secondary" onClick={() => { undoPaint(); sfx.plink(0, 0.08); }} disabled={!paintHistory.length} aria-label="Undo"><Icon name="undo" /> Undo</Button>
          {ready ? (
            <Button className="btn-primary" tone="holo" ready onClick={go} block>Solve this cube</Button>
          ) : current && pick === null ? (
            <Button className="btn-primary" onClick={apply} block>Fix it</Button>
          ) : (
            <Button className="btn-primary" tone={complete ? 'holo' : TINT[active]} disabled block>{complete ? 'Fix it' : 'Solve this cube'}</Button>
          )}
        </div>
        {current && pick === null && (
          <div className="fix-links">
            {sug && sug.all.length > 1 && <Button variant="ghost" onClick={() => { setAlt((a) => a + 1); sfx.plink(1, 0.08); }}>Not this one</Button>}
            <Button variant="ghost" onClick={() => { setPick(-1); }}>Something else is off</Button>
          </div>
        )}
        {pick === -1 && <p className="caption fix-foot">Tap the sticker that is wrong.</p>}
      </div>
    </main>
  );
}

/** A hold that shows the given stickers: the face most of them are on in front, a second face on top or to one side. */
function orientationFor(indices: number[]): Orientation {
  const faces = [...new Set(indices.map(faceOf))];
  const sides: Face[] = ['F', 'R', 'B', 'L'];
  const side = faces.find((f) => sides.includes(f));
  const cap = faces.find((f) => f === 'U' || f === 'D');
  if (side && cap) {
    const other = faces.find((f) => f !== side && f !== cap && sides.includes(f));
    const yaw = other ? (faceSide(cap, side, other) > 0 ? -0.6 : 0.6) : -0.5;
    return { top: cap, front: side, yaw, pitch: 0.28 };
  }
  if (side) {
    const other = faces.find((f) => f !== side && sides.includes(f));
    const yaw = other ? (faceSide('U', side, other) > 0 ? -0.6 : 0.6) : -0.5;
    return { top: 'U', front: side, yaw, pitch: 0.16 };
  }
  if (cap) return cap === 'U' ? { top: 'B', front: 'U', yaw: 0, pitch: 0.35 } : { top: 'F', front: 'D', yaw: 0, pitch: 0.35 };
  return { top: 'U', front: 'F', yaw: -0.5, pitch: 0.16 };
}
