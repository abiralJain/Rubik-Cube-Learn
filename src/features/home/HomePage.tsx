import './Home.css';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from '@/ui/Icon';
import { CubeStage } from '@/cube3d/CubeStage';
import { useSession, filledCount, EMPTY_FACELETS } from '@/store/session';
import { useEffect } from 'react';
import { useShellState } from '@/ui/Shell';
import type { CSSProperties } from 'react';

const ENTRIES: Array<{ to: string; icon: IconName; tone: string; title: string; text: string }> = [
  { to: '/camera', icon: 'camera', tone: 'var(--c-green)', title: 'Scan my cube', text: 'Point the camera at each side.' },
  { to: '/paint', icon: 'paint', tone: 'var(--c-blue)', title: 'Colour it in', text: 'Tap the stickers to match yours.' },
  { to: '/learn', icon: 'learn', tone: 'var(--c-orange)', title: 'Teach me', text: 'One turn at a time, with tips.' },
];

export default function HomePage() {
  const nav = useNavigate();
  const poster = typeof location !== 'undefined' && new URLSearchParams(location.search).get('poster') === '1';
  const { facelets, learn, clearSession } = useSession();
  const setShell = useShellState((s) => s.set);
  useEffect(() => { setShell({ tint: null, mode: undefined }); }, [setShell]);

  const painted = filledCount(facelets);
  const inProgress = learn ? 'learn' : painted > 6 ? 'paint' : null;
  const continueText = learn ? 'Teach me · keep solving' : `Colour it in · ${painted} of 54`;

  if (poster) { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; }
  if (poster) return <main style={{ position: 'fixed', inset: 0, background: 'transparent' }}><CubeStage facelets={HOME_PATTERN} interactive={false} rippleOnTap={false} /></main>;
  return (
    <main className="home">
      <div className="home-stage">
        <CubeStage facelets={inProgress ? facelets : HOME_PATTERN} layerTurns interactive defer={!inProgress} poster={inProgress ? undefined : '/poster/home'} />
      </div>
      <div className="home-dock">
        <div>
          <h1>Solve the cube in your hand.</h1>
          <p className="lede">Show it to the app, then follow along one turn at a time.</p>
        </div>
        <div className="entries">
          {inProgress && (
            <button className="entry entry-continue enter" style={{ '--i': 0 } as CSSProperties} onClick={() => nav(inProgress === 'learn' ? '/learn' : '/paint')}>
              <span className="badge"><Icon name="arrow-right" /></span>
              <span><h2>Keep going</h2><p>{continueText}</p></span>
              <Icon className="chev" name="arrow-right" />
            </button>
          )}
          {ENTRIES.map((e, i) => (
            <button key={e.to} className="entry enter" style={{ '--tone': e.tone, '--i': i + (inProgress ? 1 : 0) } as CSSProperties} onClick={() => nav(e.to)}>
              <span className="badge"><Icon name={e.icon} /></span>
              <span><h2>{e.title}</h2><p>{e.text}</p></span>
              <Icon className="chev" name="arrow-right" />
            </button>
          ))}
        </div>
        {inProgress && facelets !== EMPTY_FACELETS && (
          <button className="startover" onClick={() => clearSession()}>Start over</button>
        )}
      </div>
    </main>
  );
}

/** A pleasant fixed pattern for the home cube (a "checkerboard" from U2 D2 F2 B2 L2 R2). */
export const HOME_PATTERN = 'UDUDUDUDURLRLRLRLRFBFBFBFBFDUDUDUDUDLRLRLRLRLBFBFBFBFB';
