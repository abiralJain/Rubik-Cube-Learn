import './Play.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useStage, cubeHandle } from '@/cube3d/scene/stage';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import type { Tint as GlowTint } from '@/ui/Glow';
import { useSession } from '@/store/session';
import { validate } from '@/cube/validate';
import { isComplete, FACE_COLOUR } from '@/cube/facelets';
import { describe, invert, type Move } from '@/cube/notation';
import { STAGES, STAGE_NAME, STAGE_DONE_LINE, type StageId } from '@/cube/lbl';
import { usePlan, stateAt, movesBefore, type Card } from './plan';
import { faceSide } from '@/cube3d/orientation';
import { speak, hush } from './speech';
import * as sfx from '@/audio/sounds';
import { smartCubeAvailable, connectGan, type MoveSource } from '@/features/smartcube/gan';

const STAGE_TINT: Record<StageId, GlowTint> = { 'white-cross': 'white', 'white-corners': 'white', 'middle-edges': 'green', 'yellow-cross': 'yellow', 'yellow-corners': 'yellow', 'position-corners': 'orange', 'position-edges': 'blue' };
const GEM_HEX: Record<StageId, string> = { 'white-cross': '#ECEAE3', 'white-corners': '#ECEAE3', 'middle-edges': '#5CCB8E', 'yellow-cross': '#F5CC4A', 'yellow-corners': '#F5CC4A', 'position-corners': '#F5924A', 'position-edges': '#6F9AE6' };
/** The words in a sentence that name the layer being turned; they take the stage colour like Opal's data words. */
const LAYER_WORDS = ['top layer', 'bottom layer', 'right side', 'left side', 'front', 'back'];

export default function LearnPage() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { facelets, learn, startLearn, setLearnCard, finishLearn, settings, setFacelets, unlock } = useSession();
  const [params, setParams] = useSearchParams();
  const setShell = useShellState((s) => s.set);

  // entry guard: need a complete, valid cube. A shared link imports once (the store updates re-run this effect before the URL clears).
  const imported = useRef(false);
  useEffect(() => {
    const shared = params.get('c');
    if (shared && !imported.current && /^[URFDLB]{54}$/.test(shared) && validate(shared).ok) { imported.current = true; setFacelets(shared, 'paint'); startLearn(shared); setParams({}, { replace: true }); return; }
    if (shared) return;
    if (learn) return;
    if (!isComplete(facelets) || !validate(facelets).ok) return; // gated below
    startLearn(facelets);
  }, [learn, facelets, nav, startLearn, params, setParams, setFacelets]);
  const blocked = !learn && !params.get('c') ? (!isComplete(facelets) ? 'incomplete' : !validate(facelets).ok ? 'invalid' : null) : null;
  useEffect(() => { if (blocked) setShell({ tint: null }); }, [blocked, setShell]);

  const flat = usePlan(learn?.start ?? null);
  const cardIndex = learn?.card ?? 0;
  const card: Card | undefined = flat?.cards[cardIndex];
  const current = useMemo(() => (flat && learn ? stateAt(learn.start, flat.cards, cardIndex) : facelets), [flat, learn, cardIndex, facelets]);
  const moveNo = flat ? movesBefore(flat.cards, cardIndex) : 0;
  const stage: StageId = card && card.type !== 'done' ? card.stage : 'position-edges';
  const [milestone, setMilestone] = useState<StageId | null>(null);
  const [smart, setSmart] = useState<MoveSource | null>(null);
  const [deviation, setDeviation] = useState<Move[]>([]);
  const [wrong, setWrong] = useState(0);
  const busy = useRef(false);

  useEffect(() => { setShell({ tint: STAGE_TINT[stage] }); return () => setShell({ tint: null }); }, [stage, setShell]);

  // timer (pauses while hidden)
  const [elapsed, setElapsed] = useState(learn?.elapsedMs ?? 0);
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => { const now = performance.now(); if (!document.hidden) setElapsed((e) => e + (now - last)); last = now; }, 1000);
    return () => clearInterval(id);
  }, []);

  // speak on card change
  const spokenFor = useRef(-1);
  useEffect(() => {
    if (!card || spokenFor.current === cardIndex) return;
    spokenFor.current = cardIndex;
    if (!settings.voice) return;
    if (card.type === 'hold') speak(card.text);
    else if (card.type === 'move') { speak(card.firstOfStep ? `${card.explanation} ${describe(card.display)}` : describe(card.display)); if (card.tip && card.firstOfStep) setTimeout(() => speak(card.tip!, { aside: true }), 2600); }
  }, [card, cardIndex, settings.voice]);
  useEffect(() => () => hush(), []);

  const orientation = useMemo(() => {
    const front = (card && card.type !== 'done' ? card.front : 'F') as 'F' | 'R' | 'B' | 'L';
    // turn the presentation a little toward the face being turned so its arrow is in view
    const side = card?.type === 'move' ? faceSide('D', front, card.move[0] as 'U' | 'R' | 'F' | 'D' | 'L' | 'B') : 0;
    return { top: 'D' as const, front, yaw: side < 0 ? 0.5 : -0.5, pitch: 0.12 };
  }, [card]);
  const highlight = useMemo(() => (card?.type === 'move' && card.highlight.length ? new Set(card.highlight) : null), [card]);
  const cue = card?.type === 'move' ? card.move : null;
  const gate = useCallback((m: Move) => card?.type === 'move' && m === card.move, [card]);

  const advance = useCallback((fromUser: boolean) => {
    if (!flat || !learn || !card) return;
    const next = cardIndex + 1;
    const nextState = stateAt(learn.start, flat.cards, next);
    if (card.type === 'move' && card.lastOfStage) {
      const line = STAGE_DONE_LINE[card.stage];
      sfx.stageChime();
      cubeHandle()?.controller.celebrate(GEM_HEX[card.stage]); unlock(card.stage); if (settings.voice) setTimeout(() => speak(line), 200);
      if (navigator.vibrate) navigator.vibrate([8, 30, 12]);
      // every stage but the last is a milestone screen; the last one is the Solved page itself
      if (flat.cards[next]?.type !== 'done') setTimeout(() => setMilestone(card.stage), 650);
    }
    setWrong(0);
    if (flat.cards[next]?.type === 'done') {
      const ms = elapsed;
      finishLearn(ms, flat.totalMoves, nextState);
      setTimeout(() => nav('/solved'), fromUser ? 500 : 700);
      return;
    }
    setLearnCard(next, nextState, elapsed);
  }, [flat, learn, card, cardIndex, elapsed, setLearnCard, finishLearn, nav, settings.voice, unlock]);

  const onNext = useCallback(async () => {
    if (!card || busy.current) return;
    sfx.unlockAudio();
    if (milestone) { setMilestone(null); return; }
    if (card.type === 'move') {
      busy.current = true;
      await cubeHandle()?.play(card.move);
      busy.current = false;
    }
    advance(false);
  }, [card, advance, milestone]);

  const onPrev = useCallback(async () => {
    if (!flat || !learn || cardIndex === 0 || busy.current) return;
    const prev = cardIndex - 1;
    const pc = flat.cards[prev];
    if (pc.type === 'move') { busy.current = true; await cubeHandle()?.play(invert(pc.move)); busy.current = false; }
    setLearnCard(prev, stateAt(learn.start, flat.cards, prev), elapsed);
  }, [flat, learn, cardIndex, elapsed, setLearnCard]);

  const onAgain = useCallback(async () => {
    if (card?.type !== 'move' || busy.current) return;
    busy.current = true;
    const c = cubeHandle()?.controller;
    if (c) { await c.play([card.move], { speed: 0.6, ghost: true, replay: true }); await new Promise((r) => setTimeout(r, 250)); await c.play([invert(card.move)], { speed: 1.4, ghost: true, replay: true }); }
    busy.current = false;
  }, [card]);

  // the learner turned the on-screen cube
  const onMoveDone = useCallback((m: Move, _f: string, meta: { replay: boolean; user: boolean }) => {
    if (!meta.user || meta.replay) return;
    if (card?.type === 'move' && m === card.move) advance(true);
  }, [card, advance]);
  const onRejected = useCallback(() => { setWrong((w) => w + 1); }, []);
  useEffect(() => { if (wrong === 3) onAgain(); }, [wrong, onAgain]);

  // smart cube: a real turn arrives as notation in the standard frame
  useEffect(() => {
    if (!smart) return;
    return smart.onMove(async (m) => {
      if (card?.type !== 'move') return;
      if (deviation.length) {
        const recover = invert(deviation[deviation.length - 1]);
        await cubeHandle()?.play(m);
        setDeviation((d) => (m === recover ? d.slice(0, -1) : [...d, m]));
        return;
      }
      if (m === card.move) { busy.current = true; await cubeHandle()?.play(m); busy.current = false; advance(true); }
      else { await cubeHandle()?.play(m); setDeviation([m]); sfx.bloop(); }
    });
  }, [smart, card, deviation, advance]);
  useEffect(() => () => smart?.disconnect(), [smart]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); onNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); onPrev(); }
      else if (e.key.toLowerCase() === 'r') onAgain();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onNext, onPrev, onAgain]);

  // the step's moves for the ruler
  const stepMoves = useMemo(() => {
    if (!flat || card?.type !== 'move') return [];
    return flat.cards.filter((c): c is Extract<Card, { type: 'move' }> => c.type === 'move' && c.stepIndex === card.stepIndex).map((c) => c.display);
  }, [flat, card]);

  const stageRef = useStage({ facelets: current, layerTurns: true, interactive: true, highlight, orientation, cue, gate, onMoveDone, onRejected, fill: 0.72 });
  if (blocked) return <Navigate to="/" replace />;
  if (!flat || !card || !learn) return <main className="screen"><div className="stage" /><div className="dock" /></main>;

  const mm = Math.floor(elapsed / 60000), ss = Math.floor((elapsed % 60000) / 1000);
  const stageIdx = STAGES.indexOf(stage);
  const done = (st: StageId) => flat.stageLastCard[st] >= 0 ? cardIndex > flat.stageLastCard[st] : STAGES.indexOf(st) < stageIdx;
  const stageProgress = (st: StageId) => {
    if (done(st)) return 1;
    if (st !== stage) return 0;
    const a = flat.stageFirstCard[st], b = flat.stageLastCard[st];
    return b > a ? (cardIndex - a) / (b - a + 1) : 0;
  };
  const moveShown = Math.min(moveNo + (card.type === 'move' ? 1 : 0), flat.totalMoves);

  return (
    <main className="screen play" aria-label="Solve, one turn at a time">
      <div className="stage" ref={stageRef}>
        <div className="segs learn-segs" role="progressbar" aria-valuemin={1} aria-valuemax={7} aria-valuenow={stageIdx + 1} aria-label={`Stage ${stageIdx + 1} of 7: ${STAGE_NAME[stage]}`}>
          {STAGES.map((st) => <i key={st} data-done={done(st) ? '' : undefined} style={{ '--p': stageProgress(st) } as CSSProperties} />)}
        </div>
      </div>
      <AnimatePresence>
        {milestone && <Milestone key={milestone} stage={milestone} reduce={!!reduce} onContinue={() => setMilestone(null)} />}
      </AnimatePresence>

      <div className="dock" aria-live="polite">
        <div className="learn-head">
          <span className="caps meta num">Move {moveShown} of {flat.totalMoves} · {STAGE_NAME[stage]} · {mm}:{String(ss).padStart(2, '0')}</span>
        </div>

        {card.type === 'move' && <Ruler moves={stepMoves} index={card.moveIndex} />}

        <div className="learn-swap">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={cardIndex} className="learn-body"
              initial={{ opacity: 0, filter: reduce ? 'none' : 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: reduce ? 'none' : 'blur(2px)' }} transition={{ duration: 0.12 }}>
              {card.type === 'hold' && <p className="say">{card.text}</p>}
              {card.type === 'move' && (<>
                <p className="say">{colourLayer(describe(card.display))}</p>
                {card.firstOfStep && <p className="why">{card.explanation}</p>}
                {card.firstOfStep && card.tip && <p className="tip">{card.tip}</p>}
              </>)}
              {wrong >= 1 && card.type === 'move' && <p className="tip">Try sliding the other way, or follow the arrow on the cube.</p>}
              {deviation.length > 0 && <p className="tip" role="status">That turn wasn’t the one. Undo it: {describe(invert(deviation[deviation.length - 1]))}</p>}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="learn-actions">
          <Button className="btn-primary" tone={STAGE_TINT[stage]} onClick={onNext} block>{card.type === 'hold' ? 'Got it' : 'Next'}</Button>
        </div>
        <div className="learn-links">
          <Button variant="ghost" onClick={onAgain} disabled={card.type !== 'move'}>Show me again</Button>
          <Button variant="ghost" onClick={onPrev} disabled={cardIndex === 0}>Undo turn</Button>
        </div>
        <p className="learn-foot">
          {FACE_COLOUR[orientation.front]} in front · yellow on top
          {smartCubeAvailable() && !smart && <> · <button onClick={async () => { try { setSmart(await connectGan()); } catch { /* cancelled */ } }}>Connect smart cube</button></>}
          {smart && <> · {smart.name} connected</>}
        </p>
      </div>
    </main>
  );
}

/** Opal's gem-unlocked screen: the stage's stone on black, one title, one line, one pill. */
function Milestone({ stage, reduce, onContinue }: { stage: StageId; reduce: boolean; onContinue: () => void }) {
  const n = STAGES.indexOf(stage) + 1;
  const [noGem, setNoGem] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const ease = [0.23, 1, 0.32, 1] as const;
  return (
    <motion.div className="milestone" role="dialog" aria-modal="true" aria-label={`Stage ${n} complete`} style={{ '--glow': GEM_HEX[stage], '--tint': GEM_HEX[stage] } as CSSProperties}
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
        <Button block onClick={onContinue}>Continue</Button>
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
