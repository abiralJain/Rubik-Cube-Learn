import './Solve.css';
import { useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { StoneRow } from '@/ui/StoneRow';
import { useShellState } from '@/ui/Shell';
import { useStage, IDLE_FACELETS } from '@/cube3d/scene/stage';
import { HERO } from '@/cube3d/orientation';
import { useSession, filledCount, EMPTY_FACELETS } from '@/store/session';
import { STAGES, STAGE_NAME } from '@/cube/lbl';
import { usePlan } from '@/features/play/plan';
import { validate } from '@/cube/validate';
import { suggest } from '@/cube/suggest';

/** Solve: the home. One object, one sentence, one pill; the seven stones always in view. */
export default function SolvePage() {
  const nav = useNavigate();
  const { facelets, learn, unlocked, clearSession } = useSession();
  const setShell = useShellState((s) => s.set);
  useEffect(() => { setShell({ tint: null, mode: undefined }); }, [setShell]);

  const painted = filledCount(facelets);
  const check = painted === 54 ? validate(facelets) : null;
  const state = learn ? 'learn' : check?.ok ? 'ready' : check && !check.ok ? 'invalid' : painted > 6 ? 'paint' : 'fresh';
  const flat = usePlan(learn?.start ?? null);
  const card = flat && learn ? flat.cards[learn.card] : undefined;
  const stage = card && card.type !== 'done' ? card.stage : STAGES[0];
  const stageNo = STAGES.indexOf(stage) + 1;
  const progress = flat && learn ? stageProgress(flat.stageFirstCard[stage], flat.stageLastCard[stage], learn.card) : 0;
  const ms = learn?.elapsedMs ?? 0;
  const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
  const fix = useMemo(() => (state === 'invalid' ? suggest(facelets) : null), [state, facelets]);

  const stageRef = useStage({
    facelets: state === 'fresh' ? IDLE_FACELETS : facelets,
    orientation: state === 'ready' || state === 'learn' ? { top: 'D', front: 'F', yaw: -0.55, pitch: 0.14 } : HERO,
    interactive: true,
    layerTurns: true,
    rippleOnTap: true,
    fill: 0.74,
  });

  return (
    <main className="screen solve has-tabs" aria-label="Solve">
      <div className="stage" ref={stageRef} />
      <div className="dock">
        <StoneRow unlocked={unlocked} current={state === 'learn' ? stage : null} progress={progress} />
        {state === 'learn' && card && (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps num">Stage {stageNo} of 7 · {mm}:{String(ss).padStart(2, '0')}</p>
              <h1>{STAGE_NAME[stage]}</h1>
              <p className="body">Your cube is waiting where you left it.</p>
            </div>
            <Button className="enter" style={{ '--i': 1 } as CSSProperties} onClick={() => nav('/play')} block>Continue</Button>
            <div className="links enter" style={{ '--i': 2 } as CSSProperties}>
              <Button variant="ghost" onClick={() => nav('/scan?recover=1')}>Show me the cube again</Button>
              <Button variant="ghost" onClick={() => clearSession()}>Start over</Button>
            </div>
          </>
        )}
        {state === 'ready' && (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps" data-tint>Ready</p>
              <h1>Hold it with yellow on top.</h1>
              <p className="body">Green facing you. Then I’ll take you through it, one turn at a time.</p>
            </div>
            <Button className="enter" style={{ '--i': 1 } as CSSProperties} onClick={() => nav('/play')} block>Start</Button>
            <div className="links enter" style={{ '--i': 2 } as CSSProperties}>
              <Button variant="ghost" onClick={() => nav('/fix')}>Check the colours</Button>
            </div>
          </>
        )}
        {state === 'invalid' && (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps">One thing to fix</p>
              <h1>{fix?.top?.sentence ?? (check && !check.ok ? check.message : '')}</h1>
              {fix?.top && <p className="body">{fix.top.detail}</p>}
            </div>
            <Button className="enter" style={{ '--i': 1 } as CSSProperties} onClick={() => nav('/fix')} block>{fix?.top ? 'Fix it' : 'Show me'}</Button>
            <div className="links enter" style={{ '--i': 2 } as CSSProperties}>
              <Button variant="ghost" onClick={() => nav('/scan')}>Scan it again</Button>
              <Button variant="ghost" onClick={() => clearSession()}>Start over</Button>
            </div>
          </>
        )}
        {state === 'paint' && (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps num">{painted} of 54 stickers</p>
              <h1>Your cube is taking shape.</h1>
            </div>
            <Button className="enter" style={{ '--i': 1 } as CSSProperties} onClick={() => nav('/fix')} block>Continue</Button>
            <div className="links enter" style={{ '--i': 2 } as CSSProperties}>
              {facelets !== EMPTY_FACELETS && <Button variant="ghost" onClick={() => clearSession()}>Start over</Button>}
            </div>
          </>
        )}
        {state === 'fresh' && (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps">Your cube</p>
              <h1>Show me your cube.</h1>
              <p className="body">Prop the phone up and turn each side to the camera. Then put your hands on the cube; I’ll do the rest.</p>
            </div>
            <Button className="enter" style={{ '--i': 1 } as CSSProperties} onClick={() => nav('/scan')} block><Icon name="camera" /> Scan</Button>
            <div className="links enter" style={{ '--i': 2 } as CSSProperties}>
              <Button variant="ghost" onClick={() => nav('/fix')}>Colour it in instead</Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function stageProgress(first: number, last: number, card: number) {
  if (first < 0 || last < first) return 0;
  return Math.max(0, Math.min(1, (card - first) / (last - first + 1)));
}
