import './Learn.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import { useStage, cubeHandle } from '@/cube3d/scene/stage';
import { useSession } from '@/store/session';
import { STAGES, STAGE_NAME, type StageId } from '@/cube/lbl';
import { SOLVED, applyMoves } from '@/cube/facelets';
import { parseAlg, describe, type Move } from '@/cube/notation';
import { CHAPTERS } from './chapters';
import * as sfx from '@/audio/sounds';

const STAGE_TINT: Record<StageId, 'white' | 'green' | 'yellow' | 'orange' | 'blue'> = { 'white-cross': 'white', 'white-corners': 'white', 'middle-edges': 'green', 'yellow-cross': 'yellow', 'yellow-corners': 'yellow', 'position-corners': 'orange', 'position-edges': 'blue' };

/** Learn: the theory, one chapter per stage. You come here when you want to, never because you have to. */
export default function LearnPage() {
  const nav = useNavigate();
  const { chapter } = useParams();
  const { unlocked, history } = useSession();
  const setShell = useShellState((s) => s.set);
  const openAll = history.length > 0;
  const isOpen = (st: StageId) => openAll || !!unlocked[st] || STAGES.indexOf(st) === 0;
  const stage = STAGES.includes(chapter as StageId) ? (chapter as StageId) : null;
  useEffect(() => { setShell({ tint: stage ? STAGE_TINT[stage] : null, mode: undefined }); }, [setShell, stage]);

  if (stage) return <Chapter stage={stage} onBack={() => nav('/learn')} onNext={STAGES.indexOf(stage) < 6 ? () => nav(`/learn/${STAGES[STAGES.indexOf(stage) + 1]}`) : undefined} />;

  return (
    <main className="learn has-tabs" aria-label="Learn">
      <div className="section-head">
        <p className="caps">Learn</p>
        <h1>Why it works.</h1>
        <p className="body">{openAll ? 'Seven short chapters, one per stage, each with its move to watch and try.' : 'Chapters open as you pass each stage. Everything opens after your first solve.'}</p>
      </div>
      <ol className="chapters">
        {STAGES.map((st, i) => {
          const open = isOpen(st);
          return (
            <li key={st} className="enter" style={{ '--i': i } as CSSProperties}>
              <button type="button" className="opt chapter-row" disabled={!open} onClick={() => nav(`/learn/${st}`)}>
                <img src={`${import.meta.env.BASE_URL}gems/stage-${i + 1}.webp`} alt="" data-lit={open ? '' : undefined} />
                <span className="chapter-text"><b>{STAGE_NAME[st]}</b><span className="caption">{CHAPTERS[st].idea}</span></span>
                <Icon name={open ? 'chevron-right' : 'lock'} />
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/** One chapter: the cube performs the stage's move on a loop; Try it hands you the cube with the arrow as your guide. */
function Chapter({ stage, onBack, onNext }: { stage: StageId; onBack: () => void; onNext?: () => void }) {
  const ch = CHAPTERS[stage];
  const i = STAGES.indexOf(stage);
  const moves = useMemo(() => (ch.algorithm ? parseAlg(ch.algorithm) : []), [ch.algorithm]);
  const [mode, setMode] = useState<'watch' | 'try'>('watch');
  const [k, setK] = useState(0);
  const [done, setDone] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // watch: the move plays on a loop, one turn at a time, then the cube resets
  useEffect(() => {
    if (mode !== 'watch' || !moves.length) return;
    let stop = false;
    (async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      await wait(600);
      while (!stop) {
        const h = cubeHandle(); if (!h) { await wait(300); continue; }
        h.controller.setFacelets(SOLVED);
        for (let j = 0; j < moves.length && !stop; j++) {
          setK(j);
          h.controller.cueLoop = false; h.controller.startSweep();
          await wait(950);
          if (stop) break;
          await h.play(moves[j], { speed: 0.9 });
          await wait(300);
        }
        setK(moves.length);
        await wait(1400);
      }
    })();
    return () => { stop = true; };
  }, [mode, moves]);

  // try: you turn the on-screen cube; only the expected move goes through
  useEffect(() => { if (mode === 'try') { setK(0); setDone(false); cubeHandle()?.controller.setFacelets(SOLVED); } }, [mode]);
  const onMoveDone = useCallback((m: Move, _f: string, meta: { replay: boolean; user: boolean }) => {
    if (mode !== 'try' || !meta.user || meta.replay) return;
    if (m === moves[k]) {
      sfx.plink(k % 6, 0.14);
      if (k + 1 >= moves.length) { setDone(true); setK(moves.length); cubeHandle()?.controller.celebrate('#F5CC4A'); sfx.stageChime(); setTimeout(() => { if (alive.current) { setK(0); setDone(false); cubeHandle()?.controller.setFacelets(SOLVED); } }, 1800); }
      else setK(k + 1);
    }
  }, [mode, moves, k]);
  const cue = mode === 'try' ? (k < moves.length ? moves[k] : null) : (k < moves.length ? moves[k] : null);
  const gate = useCallback((m: Move) => mode === 'try' && m === moves[k], [mode, moves, k]);
  const shown = useMemo(() => applyMoves(SOLVED, moves.slice(0, Math.min(k, moves.length))), [moves, k]);
  const stageRef = useStage({ facelets: mode === 'try' ? shown : SOLVED, orientation: { top: 'D', front: 'F', yaw: -0.5, pitch: 0.12 }, interactive: true, layerTurns: mode === 'try', cue, gate, onMoveDone, rippleOnTap: false, fill: 0.8 });
  useEffect(() => { const c = cubeHandle()?.controller; if (c) { c.cueLoop = mode === 'try'; if (mode === 'try') c.startSweep(); } }, [mode, k]);

  return (
    <main className="learn chapter has-tabs" aria-label={STAGE_NAME[stage]}>
      <div className="stage chapter-stage" ref={stageRef}>
        {moves.length > 0 && (
          <div className="chapter-alg" aria-label="The move">
            {moves.map((m, j) => <span key={j} className={j === k ? 'now' : j < k ? 'done' : ''}>{m}</span>)}
          </div>
        )}
      </div>
      <article className="chapter-body">
        <button type="button" className="chapter-back" onClick={onBack}><Icon name="arrow-left" /> All chapters</button>
        <p className="caps" data-tint>Chapter {i + 1} of 7</p>
        <h1>{STAGE_NAME[stage]}</h1>
        <p className="lede">{ch.idea}</p>
        {moves.length > 0 && (
          <div className="chapter-try">
            <p className="say-small">{mode === 'try' ? (done ? 'That’s it.' : k < moves.length ? describe(moves[k]) : '') : 'Watch it once, then try it.'}</p>
            <div className="chips">
              <button type="button" className="chip" aria-pressed={mode === 'watch'} onClick={() => setMode('watch')}>Watch</button>
              <button type="button" className="chip" aria-pressed={mode === 'try'} onClick={() => setMode('try')}>Try it</button>
            </div>
          </div>
        )}
        {ch.sections.map((sec) => (
          <section key={sec.title}>
            <h3>{sec.title}</h3>
            {sec.body.map((para, n) => <p key={n} className="body">{para}</p>)}
          </section>
        ))}
        <div className="chapter-foot">
          {onNext && <Button variant="secondary" onClick={onNext} block>Next chapter <Icon name="arrow-right" /></Button>}
        </div>
      </article>
    </main>
  );
}
