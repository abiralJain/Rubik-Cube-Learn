import './Solved.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { randomState } from '@/cube/scramble';
import { CubeStage } from '@/cube3d/CubeStage';
import type { CubeHandle } from '@/cube3d/Cube3D';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import { useSession } from '@/store/session';
import { SOLVED, isSolved } from '@/cube/facelets';
import { renderCard, shareBlob } from '@/features/share/renderCard';
import { speak } from '@/features/learn/speech';
import * as sfx from '@/audio/sounds';

const ease = [0.23, 1, 0.32, 1] as const;

export default function SolvedPage() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { solved, facelets, setFacelets, clearSession, lastInput, settings, startLearn } = useSession();
  const setShell = useShellState((s) => s.set);
  const cubeRef = useRef<CubeHandle>(null);
  const [display, setDisplay] = useState<string>(isSolved(facelets) ? SOLVED : facelets);
  const [phase, setPhase] = useState<'settle' | 'bloom' | 'copy'>('settle');
  const [sheet, setSheet] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const stats = solved ?? { ms: 0, moves: 0, at: Date.now() };
  const [cubeReady, setCubeReady] = useState(false);
  const onReady = useCallback(() => setCubeReady(true), []);

  // choreography: settle → bloom (glow + iridescence + chime) → copy and actions
  useEffect(() => {
    setShell({ tint: null, mode: undefined });
    if (!cubeReady) return;
    const t1 = setTimeout(() => {
      setPhase('bloom');
      setShell({ mode: 'holo' });
      const c = cubeRef.current?.controller; if (c) { c.bloom(); c.celebrate('#FFF3B0'); }
      sfx.solvedChime(); if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      if (settings.voice) setTimeout(() => speak('You solved it!'), 300);
    }, reduce ? 200 : 700);
    const t2 = setTimeout(() => setPhase('copy'), reduce ? 400 : 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); setShell({ mode: undefined, tint: null }); };
  }, [setShell, reduce, settings.voice, cubeReady]);

  // turning the cube out of solved dims the memento honestly
  const onMoveDone = useCallback((_m: string, f: string) => {
    setDisplay(f);
    const c = cubeRef.current?.controller;
    if (c) c.setBloom(isSolved(f) ? 0.25 : 0);
    setShell({ mode: isSolved(f) ? 'holo' : undefined });
  }, [setShell]);

  const share = async () => {
    sfx.unlockAudio();
    setSheet(true);
    const canvas = document.querySelector('.cube3d canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const c = cubeRef.current?.controller; c?.invalidate();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const blob = await renderCard(canvas, { ms: stats.ms, moves: stats.moves });
      setCard(URL.createObjectURL(blob));
    }
  };
  const sendCard = async () => {
    if (!card) return;
    const blob = await (await fetch(card)).blob();
    await shareBlob(blob, 'cube-solved.png', 'I solved my Rubik’s cube!');
  };
  const copyLink = async () => {
    const url = `${location.origin}/learn?c=${(solved ? sessionStartFacelets() : facelets)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  const scrambleForMe = () => {
    const f = randomState();
    setFacelets(f, 'paint');
    startLearn(f);
    nav('/learn');
  };
  const solveAgain = () => { clearSession(); nav(lastInput === 'camera' ? '/camera' : '/paint'); };

  const mm = Math.floor(stats.ms / 60000), ss = Math.floor((stats.ms % 60000) / 1000);

  return (
    <main className="screen" aria-label="Solved">
      <div className="stage">
        <CubeStage facelets={display} layerTurns interactive orientation={{ top: 'D', front: 'F', yaw: -0.55, pitch: 0.12 }} onMoveDone={onMoveDone} cubeRef={cubeRef} onReady={onReady} />
      </div>
      <div className="dock">
        <AnimatePresence>
          {phase === 'copy' && (
            <motion.div key="copy" className="solved-copy" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.4, ease }}>
              <h1>You solved it!</h1>
              <motion.div className="solved-stats" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}>
                {[[`${mm}:${String(ss).padStart(2, '0')}`, 'time'], [String(stats.moves), 'turns'], ['7', 'stages']].map(([v, l]) => (
                  <motion.span key={l} variants={{ hidden: { opacity: 0, transform: 'translateY(6px)' }, show: { opacity: 1, transform: 'translateY(0px)' } }} transition={{ duration: 0.3, ease }}>
                    <b className="num">{v}</b>{l}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {phase === 'copy' && (
          <Reveal className="solved-actions" delay={450}>
            <Button tone="holo" onClick={share} block><Icon name="share" /> Share</Button>
            <div className="row">
              <Button variant="ghost" onClick={solveAgain}><Icon name="replay" /> Solve again</Button>
              <Button variant="ghost" onClick={scrambleForMe}><Icon name="rotate" /> Scramble for me</Button>
            </div>
            <p className="keep">Keep turning it. Solved is a place you can always get back to.</p>
          </Reveal>
        )}
      </div>
      <AnimatePresence>
        {sheet && (<>
          <motion.div key="bd" className="sheet-backdrop" onClick={() => setSheet(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div key="sheet" className="sheet" role="dialog" aria-label="Share" initial={{ transform: 'translateY(100%)' }} animate={{ transform: 'translateY(0%)' }} exit={{ transform: 'translateY(100%)' }} transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) setSheet(false); }}>
            <div className="grab" />
            <h3>Share your solve</h3>
            {card ? <img className="preview" src={card} alt="Your solved cube with the time and number of turns" /> : <div className="preview" aria-hidden />}
            <div className="row">
              <Button tone="blue" onClick={sendCard} disabled={!card}><Icon name="share" /> Send the card</Button>
              <Button variant="ghost" onClick={copyLink}><Icon name="link" /> {copied ? 'Copied' : 'Copy link'}</Button>
            </div>
            <Button variant="ghost" onClick={() => setSheet(false)}>Done</Button>
          </motion.div>
        </>)}
      </AnimatePresence>
    </main>
  );
}

/** CSS-driven entrance (off the main thread): fades and rises after `delay` ms. */
function Reveal({ className, delay, children }: { className?: string; delay: number; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); return () => cancelAnimationFrame(id); }, []);
  return <div className={`reveal ${className ?? ''}`} data-in={on ? '' : undefined} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function sessionStartFacelets(): string {
  try { const s = JSON.parse(localStorage.getItem('cube.session.v1') ?? '{}'); return s?.state?.learn?.start ?? SOLVED; } catch { return SOLVED; }
}
