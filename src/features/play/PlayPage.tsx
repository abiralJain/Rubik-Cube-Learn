import './Play.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useStage, cubeHandle, useStageStore } from '@/cube3d/scene/stage';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { StatePill, type PillState } from '@/ui/StatePill';
import { useShellState } from '@/ui/Shell';
import type { Tint as GlowTint } from '@/ui/Glow';
import { useSession } from '@/store/session';
import { validate } from '@/cube/validate';
import { isComplete, FACE_COLOUR } from '@/cube/facelets';
import { describe, invert, type Move } from '@/cube/notation';
import { STAGES, STAGE_NAME, STAGE_DONE_LINE, type StageId } from '@/cube/lbl';
import { usePlan, stateAt, movesBefore, type Card } from './plan';
import { faceSide } from '@/cube3d/orientation';
import { initial, reduce, waitFor, type Auto, type Event } from './autopilot';
import { say, hush, setMuted, listVoices, setPreferredVoice } from './voice';
import { CHAPTERS } from '@/features/learn/chapters';
import * as sfx from '@/audio/sounds';

const STAGE_TINT: Record<StageId, GlowTint> = { 'white-cross': 'white', 'white-corners': 'white', 'middle-edges': 'green', 'yellow-cross': 'yellow', 'yellow-corners': 'yellow', 'position-corners': 'orange', 'position-edges': 'blue' };
const GEM_HEX: Record<StageId, string> = { 'white-cross': '#ECEAE3', 'white-corners': '#ECEAE3', 'middle-edges': '#5CCB8E', 'yellow-cross': '#F5CC4A', 'yellow-corners': '#F5CC4A', 'position-corners': '#F5924A', 'position-edges': '#6F9AE6' };
const LAYER_WORDS = ['top layer', 'bottom layer', 'right side', 'left side', 'front', 'back'];
const MILESTONE_MS = 2800;
/** Test hook (localStorage 'cube.fast' = '1'): the whole cycle runs in a few tenths of a second. */
const FAST = typeof localStorage !== 'undefined' && localStorage.getItem('cube.fast') === '1';

/**
 * Play: the solve, hands-free. The app says the turn, sweeps the arrow, waits, turns the cube on screen, moves on.
 * Tap the cube or the pill to pause. Hold the pill to hear it again. Swipe the sentence for the previous or next turn.
 */
export default function PlayPage() {
  const nav = useNavigate();
  const reduce_ = useReducedMotion();
  const { facelets, learn, startLearn, setLearnCard, finishLearn, settings, setSetting, setFacelets, unlock } = useSession();
  const [params, setParams] = useSearchParams();
  const setShell = useShellState((s) => s.set);

  // entry: a shared link imports once; otherwise we need a complete, valid cube
  const imported = useRef(false);
  useEffect(() => {
    const shared = params.get('c');
    if (shared && !imported.current && /^[URFDLB]{54}$/.test(shared) && validate(shared).ok) { imported.current = true; setFacelets(shared, 'paint'); startLearn(shared); setParams({}, { replace: true }); return; }
    if (shared || learn) return;
    if (!isComplete(facelets) || !validate(facelets).ok) return;
    startLearn(facelets);
  }, [learn, facelets, startLearn, params, setParams, setFacelets]);
  const blocked = !learn && !params.get('c') && (!isComplete(facelets) || !validate(facelets).ok);

  const flat = usePlan(learn?.start ?? null);
  const cardIndex = learn?.card ?? 0;
  const card: Card | undefined = flat?.cards[cardIndex];
  const current = useMemo(() => (flat && learn ? stateAt(learn.start, flat.cards, cardIndex) : facelets), [flat, learn, cardIndex, facelets]);
  const moveNo = flat ? movesBefore(flat.cards, cardIndex) : 0;
  const stage: StageId = card && card.type !== 'done' ? card.stage : 'position-edges';
  const [milestone, setMilestone] = useState<StageId | null>(null);
  const [linger, setLinger] = useState(false);
  const [why, setWhy] = useState(false);
  const [wrong, setWrong] = useState(0);
  const busy = useRef(false);

  useEffect(() => { setShell({ tint: STAGE_TINT[stage] }); return () => setShell({ tint: null }); }, [stage, setShell]);
  useEffect(() => { setMuted(!settings.voice); setPreferredVoice(settings.voiceURI); }, [settings.voice, settings.voiceURI]);
  useEffect(() => () => hush(), []);

  // timer (pauses while hidden or paused)
  const [elapsed, setElapsed] = useState(learn?.elapsedMs ?? 0);
  const autoRef = useRef<Auto>(initial);
  const [auto, setAutoState] = useState<Auto>(initial);
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => { const now = performance.now(); const dt = Math.max(0, now - last); last = now; if (!document.hidden && autoRef.current.phase !== 'paused') setElapsed((e) => Math.max(0, e) + dt); }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------- the autopilot ---------- */
  const dispatch = useCallback((e: Event) => {
    const { state, effects } = reduce(autoRef.current, e);
    autoRef.current = state; setAutoState(state);
    for (const fx of effects) runEffect.current(fx);
  }, []);
  const runEffect = useRef<(fx: string) => void>(() => {});

  const sentenceFor = useCallback((c: Card): string => {
    if (c.type === 'hold') return c.text;
    if (c.type === 'move') return c.firstOfStep ? `${c.explanation} ${describe(c.display)}` : describe(c.display);
    return '';
  }, []);

  const advance = useCallback((fromUser: boolean) => {
    if (!flat || !learn || !card) return;
    const next = cardIndex + 1;
    const nextState = stateAt(learn.start, flat.cards, next);
    if (card.type === 'move' && card.lastOfStage) {
      sfx.stageChime();
      cubeHandle()?.controller.celebrate(GEM_HEX[card.stage]);
      for (const st of STAGES.slice(0, STAGES.indexOf(card.stage) + 1)) unlock(st); // a passed stage lights every stone before it too
      if (navigator.vibrate) navigator.vibrate([8, 30, 12]);
      if (flat.cards[next]?.type !== 'done') { setLinger(false); setTimeout(() => setMilestone(card.stage), 650); void say(STAGE_DONE_LINE[card.stage]); }
    }
    setWrong(0);
    if (flat.cards[next]?.type === 'done') {
      finishLearn(elapsed, flat.totalMoves, nextState);
      dispatch({ type: 'finish' });
      setTimeout(() => nav('/solved'), fromUser ? 500 : 700);
      return;
    }
    setLearnCard(next, nextState, elapsed);
  }, [flat, learn, card, cardIndex, elapsed, setLearnCard, finishLearn, nav, unlock, dispatch]);

  // effects the reducer asks for
  useEffect(() => {
    runEffect.current = (fx) => {
      const c = cubeHandle()?.controller;
      switch (fx) {
        case 'speak': {
          const text = card ? sentenceFor(card) : '';
          const idx = cardIndex;
          if (!settings.voice || !text || FAST) { setTimeout(() => { if (autoRef.current.card === idx) dispatch({ type: 'spoken' }); }, FAST ? 30 : 600); break; }
          void say(text).then(() => { if (autoRef.current.card === idx) dispatch({ type: 'spoken' }); });
          break;
        }
        case 'sweep': if (c) { c.cueLoop = true; c.startSweep(); } break;
        case 'play': {
          if (c) c.cueLoop = false;
          if (card?.type !== 'move') { dispatch({ type: 'played' }); break; }
          const idx = cardIndex; const move = card.move;
          const go = () => {
            if (autoRef.current.card !== idx) return;
            const h = cubeHandle();
            if (!h) { setTimeout(go, 150); return; } // the cube is still booting
            busy.current = true;
            void h.play(move).then(() => { busy.current = false; dispatch({ type: 'played' }); });
          };
          go();
          break;
        }
        case 'advance': advance(false); break;
        case 'replay': {
          if (card?.type === 'move' && c) { (async () => { await c.play([card.move], { speed: 0.6, ghost: true, replay: true }); await new Promise((r) => setTimeout(r, 250)); await c.play([invert(card.move)], { speed: 1.4, ghost: true, replay: true }); })(); }
          break;
        }
      }
    };
  }, [card, cardIndex, settings.voice, sentenceFor, dispatch, advance]);

  // a new card starts the cycle once the cube is on screen; a milestone or the Why sheet holds it
  const cubeReady = useStageStore((st) => st.ready);
  useEffect(() => {
    if (!card || card.type === 'done' || !cubeReady) return;
    dispatch({ type: 'card', index: cardIndex });
  }, [cardIndex, card?.type, cubeReady, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (milestone || why) { if (autoRef.current.phase !== 'paused') dispatch({ type: 'pause' }); pausedByUs.current = true; }
    else if (pausedByUs.current) { pausedByUs.current = false; dispatch({ type: 'resume' }); }
  }, [milestone, why, dispatch]);
  const pausedByUs = useRef(false);
  // breath after a played turn
  useEffect(() => {
    if (auto.phase !== 'breath') return;
    const t = setTimeout(() => dispatch({ type: 'breathed' }), FAST ? 30 : 450);
    return () => clearTimeout(t);
  }, [auto.phase, dispatch]);
  // the wait clock
  useEffect(() => {
    if (auto.phase !== 'waiting' || !card) return;
    let raf = 0, last = performance.now();
    const pace = FAST ? 0.12 : waitFor(settings.pace, card, auto.replays);
    const tick = () => { raf = requestAnimationFrame(tick); const now = performance.now(); const dt = (now - last) / 1000; last = now; if (!document.hidden) dispatch({ type: 'tick', dt, pace }); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto.phase, auto.replays, card, settings.pace, dispatch]);

  /* ---------- user input ---------- */
  const togglePause = useCallback(() => {
    sfx.unlockAudio();
    if (milestone) { setLinger(false); setMilestone(null); return; }
    if (autoRef.current.phase === 'paused') dispatch({ type: 'resume' }); else { dispatch({ type: 'pause' }); hush(); }
  }, [dispatch, milestone]);
  const again = useCallback(() => { sfx.unlockAudio(); hush(); dispatch({ type: 'again' }); }, [dispatch]);
  const next = useCallback(async () => {
    if (!card || busy.current || card.type === 'done') return;
    sfx.unlockAudio(); hush();
    if (card.type === 'move') { busy.current = true; await cubeHandle()?.play(card.move); busy.current = false; }
    advance(true);
  }, [card, advance]);
  const prev = useCallback(async () => {
    if (!flat || !learn || cardIndex === 0 || busy.current) return;
    hush();
    const p = cardIndex - 1; const pc = flat.cards[p];
    if (pc.type === 'move') { busy.current = true; await cubeHandle()?.play(invert(pc.move)); busy.current = false; }
    setLearnCard(p, stateAt(learn.start, flat.cards, p), elapsed);
  }, [flat, learn, cardIndex, elapsed, setLearnCard]);

  // the learner turned the on-screen cube themselves
  const onMoveDone = useCallback((m: Move, _f: string, meta: { replay: boolean; user: boolean }) => {
    if (!meta.user || meta.replay) return;
    if (card?.type === 'move' && m === card.move) { hush(); advance(true); }
  }, [card, advance]);
  const onRejected = useCallback(() => { setWrong((w) => w + 1); }, []);
  useEffect(() => { if (wrong === 3) again(); }, [wrong, again]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); togglePause(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); void next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); void prev(); }
      else if (e.key.toLowerCase() === 'r') again();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [togglePause, next, prev, again]);

  // milestone: lights the stone, then goes on by itself unless you tap to linger
  useEffect(() => {
    if (!milestone || linger) return;
    const t = setTimeout(() => setMilestone(null), FAST ? 250 : MILESTONE_MS);
    return () => clearTimeout(t);
  }, [milestone, linger]);

  /* ---------- the cube ---------- */
  const orientation = useMemo(() => {
    const front = (card && card.type !== 'done' ? card.front : 'F') as 'F' | 'R' | 'B' | 'L';
    const side = card?.type === 'move' ? faceSide('D', front, card.move[0] as 'U' | 'R' | 'F' | 'D' | 'L' | 'B') : 0;
    return { top: 'D' as const, front, yaw: side < 0 ? 0.5 : -0.5, pitch: 0.12 };
  }, [card]);
  const highlight = useMemo(() => (card?.type === 'move' && card.firstOfStep && card.highlight.length ? new Set(card.highlight) : null), [card]);
  const cue = card?.type === 'move' ? card.move : null;
  const gate = useCallback((m: Move) => card?.type === 'move' && m === card.move, [card]);
  const stageRef = useStage({ facelets: current, layerTurns: true, interactive: true, highlight, orientation, cue, gate, onMoveDone, onRejected, onStickerTap: togglePause, onBackgroundTap: togglePause, rippleOnTap: false, fill: 0.74 });

  const stepMoves = useMemo(() => {
    if (!flat || card?.type !== 'move') return [];
    return flat.cards.filter((c): c is Extract<Card, { type: 'move' }> => c.type === 'move' && c.stepIndex === card.stepIndex).map((c) => c.display);
  }, [flat, card]);

  if (blocked) return <Navigate to="/" replace />;
  if (learn && flat === null) return <Lost onScan={() => nav('/scan?recover=1')} onFix={() => nav('/fix')} />;
  if (!flat || !card || !learn) return <main className="screen"><div className="stage" /><div className="dock" /></main>;

  const mm = Math.floor(elapsed / 60000), ss = Math.floor((elapsed % 60000) / 1000);
  const stageIdx = STAGES.indexOf(stage);
  const done = (st: StageId) => (flat.stageLastCard[st] >= 0 ? cardIndex > flat.stageLastCard[st] : STAGES.indexOf(st) < stageIdx);
  const stageProgress = (st: StageId) => { if (done(st)) return 1; if (st !== stage) return 0; const a = flat.stageFirstCard[st], b = flat.stageLastCard[st]; return b > a ? (cardIndex - a) / (b - a + 1) : 0; };
  const moveShown = Math.min(moveNo + (card.type === 'move' ? 1 : 0), flat.totalMoves);
  const pill: PillState = auto.phase === 'paused' ? 'paused' : auto.phase === 'speaking' ? 'speaking' : auto.phase === 'waiting' ? 'turn' : auto.phase === 'playing' || auto.phase === 'breath' ? 'checking' : auto.phase === 'done' ? 'done' : 'idle';
  const pillLabel = pill === 'paused' ? 'Paused' : pill === 'turn' ? 'Your turn' : pill === 'speaking' ? undefined : pill === 'checking' ? undefined : undefined;
  const chapter = CHAPTERS[stage];

  return (
    <main className="screen play" aria-label="Solve, one turn at a time">
      <div className="stage" ref={stageRef}>
        <div className="segs play-segs" role="progressbar" aria-valuemin={1} aria-valuemax={7} aria-valuenow={stageIdx + 1} aria-label={`Stage ${stageIdx + 1} of 7: ${STAGE_NAME[stage]}`}>
          {STAGES.map((st) => <i key={st} data-done={done(st) ? '' : undefined} style={{ '--p': stageProgress(st) } as CSSProperties} />)}
        </div>
      </div>
      <AnimatePresence>
        {milestone && <Milestone key={milestone} stage={milestone} reduce={!!reduce_} onTap={() => setLinger(true)} onContinue={() => { setLinger(false); setMilestone(null); }} />}
      </AnimatePresence>

      <div className="dock">
        <div className="play-head"><span className="caps meta num">Move {moveShown} of {flat.totalMoves} · {STAGE_NAME[stage]} · {mm}:{String(ss).padStart(2, '0')}</span></div>
        {card.type === 'move' && <Ruler moves={stepMoves} index={card.moveIndex} />}
        <motion.div className="play-swap" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} onDragEnd={(_, info) => { if (info.offset.x < -70 || info.velocity.x < -500) void next(); else if (info.offset.x > 70 || info.velocity.x > 500) void prev(); }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={cardIndex} className="play-body" initial={{ opacity: 0, filter: reduce_ ? 'none' : 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: reduce_ ? 'none' : 'blur(2px)' }} transition={{ duration: 0.12 }}>
              {card.type === 'hold' && <p className="say">{card.text}</p>}
              {card.type === 'move' && (<>
                <p className="say">{colourLayer(describe(card.display))}</p>
                {card.firstOfStep && <p className="why">{card.explanation}</p>}
              </>)}
              {wrong >= 1 && card.type === 'move' && <p className="tip">Try sliding the other way, or follow the arrow.</p>}
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <div className="play-actions">
          <StatePill state={pill} progress={auto.progress} label={pillLabel} onTap={togglePause} onHold={again} tint={`var(--a-${STAGE_TINT[stage]})`} />
          <button type="button" className="why-link" onClick={() => setWhy(true)} aria-haspopup="dialog">Why <Icon name="chevron-up" /></button>
        </div>
        <p className="play-foot">{FACE_COLOUR[orientation.front]} in front · yellow on top · <button onClick={() => nav('/scan?recover=1')}>Show me the cube</button></p>
      </div>

      <AnimatePresence>
        {why && (<>
          <motion.div key="bd" className="sheet-backdrop" onClick={() => setWhy(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div key="sheet" className="sheet why-sheet" role="dialog" aria-label="Why this works" initial={{ transform: 'translateY(100%)' }} animate={{ transform: 'translateY(0%)' }} exit={{ transform: 'translateY(100%)' }} transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) setWhy(false); }}>
            <div className="grab" />
            <p className="caps" data-tint>{STAGE_NAME[stage]}</p>
            <h3>{chapter.idea}</h3>
            {card.type === 'move' && <p className="body">{card.explanation}</p>}
            {card.type === 'move' && card.tip && <p className="body">{card.tip}</p>}
            <div className="why-row">
              <label className="why-pace"><span className="caption">Pace · {settings.pace.toFixed(1)} s a turn</span><input type="range" min={2} max={8} step={0.5} value={settings.pace} onChange={(e) => setSetting('pace', +e.target.value)} aria-label="Seconds per turn" /></label>
            </div>
            <VoiceRow value={settings.voiceURI} onChange={(uri) => setSetting('voiceURI', uri)} />
            <div className="why-links">
              <Button variant="ghost" onClick={() => { setWhy(false); nav(`/learn/${stage}`); }}>Read the chapter</Button>
              <Button variant="ghost" onClick={() => setWhy(false)}>Back to the cube</Button>
            </div>
          </motion.div>
        </>)}
      </AnimatePresence>
    </main>
  );
}

function VoiceRow({ value, onChange }: { value: string | null; onChange: (uri: string | null) => void }) {
  const voices = listVoices();
  if (!voices.length) return null;
  return (
    <label className="why-voice">
      <span className="caption">Voice</span>
      <select value={value ?? ''} onChange={(e) => { onChange(e.target.value || null); void say('One turn at a time.'); }} aria-label="Voice">
        <option value="">Best available</option>
        {voices.slice(0, 12).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()}</option>)}
      </select>
    </label>
  );
}

/** The plan could not be built from this state (a cube that was turned off-plan). Read it again. */
function Lost({ onScan, onFix }: { onScan: () => void; onFix: () => void }) {
  return (
    <main className="screen play" aria-label="Lost the thread">
      <div className="stage" />
      <div className="dock">
        <div className="hero-copy">
          <p className="caps">One moment</p>
          <h1>I lost the thread.</h1>
          <p className="body">Show me the cube again and I’ll pick up from where it really is.</p>
        </div>
        <Button onClick={onScan} block><Icon name="camera" /> Show me the cube</Button>
        <div className="play-links"><Button variant="ghost" onClick={onFix}>Check the colours</Button></div>
      </div>
    </main>
  );
}

/** Opal's gem-unlocked screen: the stage's stone on black, one title, one line. Goes on by itself; a tap makes it stay. */
function Milestone({ stage, reduce, onTap, onContinue }: { stage: StageId; reduce: boolean; onTap: () => void; onContinue: () => void }) {
  const n = STAGES.indexOf(stage) + 1;
  const [noGem, setNoGem] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const ease = [0.23, 1, 0.32, 1] as const;
  return (
    <motion.div className="milestone" role="dialog" aria-modal="true" aria-label={`Stage ${n} complete`} style={{ '--glow': GEM_HEX[stage], '--tint': GEM_HEX[stage] } as CSSProperties} onClick={onTap}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.3, ease }}>
      <div className="milestone-copy">
        <p className="caps" data-tint>Stage {n} of 7</p>
        <h1>{STAGE_NAME[stage]}</h1>
        <p className="body">{STAGE_DONE_LINE[stage]}</p>
      </div>
      <motion.div className="milestone-gem" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.88) translateY(12px)' }} animate={{ opacity: 1, transform: 'scale(1) translateY(0px)' }} transition={{ duration: 0.6, ease, delay: 0.1 }}>
        {noGem ? <i className="milestone-orb" aria-hidden /> : <img src={`${import.meta.env.BASE_URL}gems/stage-${n}.webp`} alt="" decoding="async" onError={() => setNoGem(true)} />}
      </motion.div>
      <motion.div className="milestone-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.45 }}>
        <p className="caption"><Icon name="check" /> Unlocked {today}</p>
        <Button block onClick={(e) => { e.stopPropagation(); onContinue(); }}>Continue</Button>
      </motion.div>
    </motion.div>
  );
}

/** Every move of the step laid out as a scrubber; the current one sits at the centre mark, large. */
function Ruler({ moves, index }: { moves: string[]; index: number }) {
  return (
    <div className="ruler" aria-hidden>
      <div className="ruler-ticks" />
      <div className="ruler-row" style={{ transform: `translateX(${-index * 64}px)` }}>
        {moves.map((m, i) => <span key={i} className={i === index ? 'glyph now' : i < index ? 'done' : ''}>{m}</span>)}
      </div>
      <i className="ruler-mark" />
    </div>
  );
}

/** Wraps the layer name in <em> so it takes the stage colour. */
function colourLayer(sentence: string) {
  for (const w of LAYER_WORDS) {
    const i = sentence.indexOf(w);
    if (i >= 0) return <>{sentence.slice(0, i)}<em>{w}</em>{sentence.slice(i + w.length)}</>;
  }
  return sentence;
}
