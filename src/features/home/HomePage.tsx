import './Home.css';
import { useNavigate } from 'react-router';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { CubeStage } from '@/cube3d/CubeStage';
import { useSession, filledCount, EMPTY_FACELETS } from '@/store/session';
import { useEffect, type CSSProperties } from 'react';
import { useShellState } from '@/ui/Shell';
import { STAGES, STAGE_NAME } from '@/cube/lbl';
import { usePlan } from '@/features/learn/useLearnSession';
import { validate } from '@/cube/validate';

export default function HomePage() {
  const nav = useNavigate();
  const poster = typeof location !== 'undefined' && new URLSearchParams(location.search).get('poster') === '1';
  const { facelets, learn, clearSession } = useSession();
  const setShell = useShellState((s) => s.set);
  useEffect(() => { setShell({ tint: null, mode: undefined }); }, [setShell]);

  const painted = filledCount(facelets);
  const check = painted === 54 ? validate(facelets) : null;
  const inProgress = learn ? 'learn' : check?.ok ? 'ready' : check && !check.ok ? 'invalid' : painted > 6 ? 'paint' : null;
  const flat = usePlan(learn?.start ?? null);
  const card = flat && learn ? flat.cards[learn.card] : undefined;
  const stage = card && card.type !== 'done' ? card.stage : STAGES[0];
  const stageNo = STAGES.indexOf(stage) + 1;
  const ms = learn?.elapsedMs ?? 0;
  const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);

  if (poster) { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; }
  if (poster) return <main style={{ position: 'fixed', inset: 0, background: 'transparent' }}><CubeStage facelets={HOME_PATTERN} interactive={false} rippleOnTap={false} /></main>;

  return (
    <main className="home has-tabs">
      <div className="home-stage">
        <CubeStage facelets={inProgress ? facelets : HOME_PATTERN} layerTurns interactive defer={!inProgress} poster={inProgress ? undefined : `${import.meta.env.BASE_URL}poster/home`} />
      </div>
      <div className="home-dock">
        {inProgress === 'learn' ? (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps">Stage {stageNo} of 7</p>
              <h1>{STAGE_NAME[stage]}</h1>
            </div>
            <div className="stats enter" style={{ '--i': 1 } as CSSProperties}>
              <div className="stat"><b><Icon name="learn" />{stageNo}<span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>/7</span></b><span>Stage</span></div>
              <div className="stat"><b><Icon name="rotate" />{flat ? Math.min(flat.totalMoves, learn!.card) : 0}</b><span>Turns</span></div>
              <div className="stat"><b>{mm}:{String(ss).padStart(2, '0')}</b><span>Time</span></div>
            </div>
            <section className="card home-card enter" style={{ '--i': 2 } as CSSProperties}>
              <p className="crumb">Learn <i>/</i> {STAGE_NAME[stage]}</p>
              <h3>Keep going</h3>
              <p className="body">Your cube is waiting exactly where you left it.</p>
              <Button onClick={() => nav('/learn')} block>Continue</Button>
            </section>
            <div className="home-alt enter" style={{ '--i': 3 } as CSSProperties}>
              <Button variant="ghost" onClick={() => clearSession()}>Start over</Button>
            </div>
          </>
        ) : inProgress === 'ready' ? (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps" data-tint>Ready</p>
              <h1>Your cube is in.</h1>
            </div>
            <section className="card home-card enter" style={{ '--i': 1 } as CSSProperties}>
              <p className="crumb">Learn <i>/</i> {STAGE_NAME[STAGES[0]]}</p>
              <h3>Start solving</h3>
              <p className="body">Seven stages. One turn at a time.</p>
              <Button onClick={() => nav('/learn')} block>Start</Button>
            </section>
            <div className="home-alt enter" style={{ '--i': 2 } as CSSProperties}>
              <Button variant="ghost" onClick={() => nav('/paint')}>Check the colours</Button>
            </div>
          </>
        ) : inProgress === 'invalid' ? (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps">54 of 54 · one thing off</p>
              <h1>{check && !check.ok ? check.message : ''}</h1>
            </div>
            <section className="card home-card enter" style={{ '--i': 1 } as CSSProperties}>
              <p className="crumb">Cube <i>/</i> Colour it in</p>
              <h3>Fix it</h3>
              <p className="body">The likely stickers light up. Tap one and pick its real colour.</p>
              <Button onClick={() => nav('/paint')} block>Show me</Button>
            </section>
            <div className="home-alt enter" style={{ '--i': 2 } as CSSProperties}>
              <Button variant="ghost" onClick={() => clearSession()}>Start over</Button>
            </div>
          </>
        ) : inProgress === 'paint' ? (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps">{painted} of 54 stickers</p>
              <h1>Your cube is taking shape.</h1>
            </div>
            <section className="card home-card enter" style={{ '--i': 1 } as CSSProperties}>
              <p className="crumb">Cube <i>/</i> Colour it in</p>
              <h3>Keep going</h3>
              <p className="body">Tap the stickers to match the cube in your hand.</p>
              <Button onClick={() => nav('/paint')} block>Continue</Button>
            </section>
            <div className="home-alt enter" style={{ '--i': 2 } as CSSProperties}>
              {facelets !== EMPTY_FACELETS && <Button variant="ghost" onClick={() => clearSession()}>Start over</Button>}
            </div>
          </>
        ) : (
          <>
            <div className="hero-copy enter" style={{ '--i': 0 } as CSSProperties}>
              <p className="caps">Your cube</p>
              <h1>Solve the cube in your hand.</h1>
              <p className="body">Show it to the app. Then one turn at a time.</p>
            </div>
            <div className="stats enter" style={{ '--i': 1 } as CSSProperties}>
              <div className="stat"><b>7</b><span>Stages</span></div>
              <div className="stat"><b>~130</b><span>Turns</span></div>
              <div className="stat"><b>~20m</b><span>First solve</span></div>
            </div>
            <section className="card home-card enter" style={{ '--i': 2 } as CSSProperties}>
              <p className="crumb">Start <i>/</i> Scan</p>
              <h3>Scan my cube</h3>
              <p className="body">Point the camera at each side. Or colour it in by hand.</p>
              <Button onClick={() => nav('/camera')} block><Icon name="camera" /> Scan</Button>
            </section>
            <div className="home-alt enter" style={{ '--i': 3 } as CSSProperties}>
              <Button variant="ghost" onClick={() => nav('/paint')}>Colour it in instead</Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/** A pleasant fixed pattern for the home cube (a "checkerboard" from U2 D2 F2 B2 L2 R2). */
export const HOME_PATTERN = 'UDUDUDUDURLRLRLRLRFBFBFBFBFDUDUDUDUDLRLRLRLRLBFBFBFBFB';
