import './Learn.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CubeStage } from '@/cube3d/CubeStage';
import type { CubeHandle } from '@/cube3d/Cube3D';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import type { Tint as GlowTint } from '@/ui/Glow';
import { useSession } from '@/store/session';
import { validate } from '@/cube/validate';
import { isComplete, FACE_COLOUR } from '@/cube/facelets';
import { describe, invert, type Move } from '@/cube/notation';
import { STAGES, STAGE_NAME, STAGE_DONE_LINE, type StageId } from '@/cube/lbl';
import { usePlan, stateAt, movesBefore, type Card } from './useLearnSession';
import { faceSide } from '@/cube3d/orientation';
import { speak, hush } from './speech';
import * as sfx from '@/audio/sounds';
import { smartCubeAvailable, connectGan, type MoveSource } from '@/features/smartcube/gan';

const STAGE_TINT: Record<StageId, GlowTint> = { 'white-cross': 'white', 'white-corners': 'white', 'middle-edges': 'green', 'yellow-cross': 'yellow', 'yellow-corners': 'yellow', 'position-corners': 'orange', 'position-edges': 'blue' };
const GEM: Record<StageId, string> = { 'white-cross': 'var(--c-white-deep)', 'white-corners': 'var(--c-white-deep)', 'middle-edges': 'var(--c-green)', 'yellow-cross': 'var(--c-yellow)', 'yellow-corners': 'var(--c-yellow)', 'position-corners': 'var(--c-orange)', 'position-edges': 'var(--c-blue)' };

export default function LearnPage() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { facelets, learn, startLearn, setLearnCard, finishLearn, settings, setFacelets } = useSession();
  const [params, setParams] = useSearchParams();
  const setShell = useShellState((s) => s.set);
  const cubeRef = useRef<CubeHandle>(null);

  // entry guard: need a complete, valid cube
  useEffect(() => {
    const shared = params.get('c');
    if (shared && /^[URFDLB]{54}$/.test(shared) && validate(shared).ok) { setFacelets(shared, 'paint'); startLearn(shared); setParams({}, { replace: true }); return; }
    if (learn) return;
    if (!isComplete(facelets) || !validate(facelets).ok) { nav('/paint', { replace: true }); return; }
    startLearn(facelets);
  }, [learn, facelets, nav, startLearn, params, setParams, setFacelets]);

  const flat = usePlan(learn?.start ?? null);
  const cardIndex = learn?.card ?? 0;
  const card: Card | undefined = flat?.cards[cardIndex];
  const current = useMemo(() => (flat && learn ? stateAt(learn.start, flat.cards, cardIndex) : facelets), [flat, learn, cardIndex, facelets]);
  const moveNo = flat ? movesBefore(flat.cards, cardIndex) : 0;
  const stage: StageId = card && card.type !== 'done' ? card.stage : 'position-edges';
  const [praise, setPraise] = useState<string | null>(null);
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
      setPraise(line); sfx.stageChime(); if (settings.voice) setTimeout(() => speak(line), 200);
      setTimeout(() => setPraise(null), 2200);
    }
    setWrong(0);
    if (flat.cards[next]?.type === 'done') {
      const ms = elapsed;
      finishLearn(ms, flat.totalMoves, nextState);
      setTimeout(() => nav('/solved'), fromUser ? 500 : 700);
      return;
    }
    setLearnCard(next, nextState, elapsed);
  }, [flat, learn, card, cardIndex, elapsed, setLearnCard, finishLearn, nav, settings.voice]);

  const onNext = useCallback(async () => {
    if (!card || busy.current) return;
    sfx.unlockAudio();
    if (card.type === 'move') {
      busy.current = true;
      await cubeRef.current?.play(card.move);
      busy.current = false;
    }
    advance(false);
  }, [card, advance]);

  const onPrev = useCallback(async () => {
    if (!flat || !learn || cardIndex === 0 || busy.current) return;
    const prev = cardIndex - 1;
    const pc = flat.cards[prev];
    if (pc.type === 'move') { busy.current = true; await cubeRef.current?.play(invert(pc.move)); busy.current = false; }
    setLearnCard(prev, stateAt(learn.start, flat.cards, prev), elapsed);
  }, [flat, learn, cardIndex, elapsed, setLearnCard]);

  const onAgain = useCallback(async () => {
    if (card?.type !== 'move' || busy.current) return;
    busy.current = true;
    const c = cubeRef.current?.controller;
    if (c) { await c.play([card.move], { speed: 0.6, ghost: true, replay: true }); await new Promise((r) => setTimeout(r, 250)); await c.play([invert(card.move)], { speed: 1.4, ghost: true, replay: true }); }
    busy.current = false;
  }, [card]);

  // the child turned the on-screen cube
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
        await cubeRef.current?.play(m);
        setDeviation((d) => (m === recover ? d.slice(0, -1) : [...d, m]));
        return;
      }
      if (m === card.move) { busy.current = true; await cubeRef.current?.play(m); busy.current = false; advance(true); }
      else { await cubeRef.current?.play(m); setDeviation([m]); sfx.bloop(); }
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

  if (!flat || !card || !learn) return <main className="screen"><div className="stage" /><div className="dock" /></main>;

  const mm = Math.floor(elapsed / 60000), ss = Math.floor((elapsed % 60000) / 1000);
  const stageIdx = STAGES.indexOf(stage);
  const done = (st: StageId) => flat.stageLastCard[st] >= 0 ? cardIndex > flat.stageLastCard[st] : STAGES.indexOf(st) < stageIdx;

  return (
    <main className="screen" aria-label="Learn to solve">
      <div className="stage">
        <CubeStage facelets={current} layerTurns interactive highlight={highlight} orientation={orientation} cue={cue} gate={gate} onMoveDone={onMoveDone} onRejected={onRejected} cubeRef={cubeRef} />
        <AnimatePresence>
          {praise && (
            <motion.p key={praise} className="praise" initial={{ opacity: 0, transform: 'translateY(6px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>{praise}</motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="dock">
        <section className="glass learn-card" aria-live="polite">
          <div className="gems" aria-label={`Stage ${stageIdx + 1} of 7: ${STAGE_NAME[stage]}`}>
            {STAGES.map((st) => (
              <span key={st} className="gem" style={{ '--gem': GEM[st] } as CSSProperties} data-done={done(st) ? '' : undefined} data-active={st === stage && !done(st) ? '' : undefined} title={STAGE_NAME[st]} />
            ))}
          </div>
          <div className="learn-head">
            <h2>{STAGE_NAME[stage]}</h2>
            <span className="meta num">Move {Math.min(moveNo + (card.type === 'move' ? 1 : 0), flat.totalMoves)} of {flat.totalMoves} · {mm}:{String(ss).padStart(2, '0')}</span>
          </div>
          <div className="learn-swap">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={cardIndex} className="learn-body"
                initial={{ opacity: 0, filter: reduce ? 'none' : 'blur(2px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: reduce ? 'none' : 'blur(2px)' }} transition={{ duration: 0.12 }}>
                {card.type === 'hold' && (<>
                  <div className="glyph" data-hold><Icon name="rotate" style={{ width: 40, height: 40 }} /></div>
                  <p className="sentence">{card.text}</p>
                </>)}
                {card.type === 'move' && (<>
                  <div className="glyph">{card.display}<small>{card.display.endsWith("'") ? 'anticlockwise' : card.display.endsWith('2') ? 'twice' : 'clockwise'}</small></div>
                  <p className="sentence">{describe(card.display)}{card.firstOfStep && <span className="why">{card.explanation}</span>}</p>
                </>)}
              </motion.div>
            </AnimatePresence>
          </div>
          {card.type === 'move' && card.tip && card.firstOfStep && <p className="tip"><Icon name="bulb" />{card.tip}</p>}
          {wrong >= 1 && card.type === 'move' && <p className="tip"><Icon name="rotate" />Try sliding the other way, or follow the arrow on the cube.</p>}
          <div className="learn-actions">
            <Button variant="ghost" onClick={onPrev} disabled={cardIndex === 0} aria-label="Previous"><Icon name="arrow-left" /></Button>
            <Button className="btn-primary" tone={STAGE_TINT[stage]} onClick={onNext} block>
              {card.type === 'hold' ? 'Got it' : 'Next'} <Icon name="arrow-right" />
            </Button>
          </div>
          <div className="learn-secondary">
            <Button variant="ghost" onClick={onAgain} disabled={card.type !== 'move'}><Icon name="replay" /> <span className="long">Show me again</span><span className="short">Again</span></Button>
            <Button variant="ghost" onClick={onPrev} disabled={cardIndex === 0}><Icon name="undo" /> <span className="long">Undo my last turn</span><span className="short">Undo turn</span></Button>
          </div>
        </section>
        {deviation.length > 0 && <p className="tip" role="status"><Icon name="rotate" />That turn wasn’t the one. Undo it: {describe(invert(deviation[deviation.length - 1]))}</p>}
        <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontWeight: 600 }}>
          {FACE_COLOUR[orientation.front]} in front · yellow on top
          {smartCubeAvailable() && !smart && <> · <button className="startover" style={{ padding: 0, color: 'inherit', textDecoration: 'underline' }} onClick={async () => { try { setSmart(await connectGan()); } catch { /* cancelled */ } }}>Connect smart cube</button></>}
          {smart && <> · {smart.name} connected</>}
        </p>
      </div>
    </main>
  );
}
