import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { create } from 'zustand';
import { Glow, type Tint } from './Glow';
import { Button } from './Button';
import { Icon } from './Icon';
import { PersistentStage } from '@/cube3d/PersistentStage';
import { useSession } from '@/store/session';

/** Screen-level hints for the shell (room light tint, mode, whether the top bar shows). */
export const useShellState = create<{ tint: Tint | null; mode?: 'holo' | 'off'; set: (s: { tint?: Tint | null; mode?: 'holo' | 'off' }) => void }>((set) => ({
  tint: null,
  mode: undefined,
  set: (s) => set(s),
}));

/** Routes that show the floating tab bar: the three sections. Flows (scan, fix, play, solved) run full-screen. */
const TABBED = /^\/(journey|learn(\/.*)?)?$/;
const FLOW = /^\/(scan|fix|play|solved)/;

export function Shell() {
  const { tint, mode } = useShellState();
  const settings = useSession((s) => s.settings);
  const setSetting = useSession((s) => s.setSetting);
  const { pathname } = useLocation();
  const tabs = TABBED.test(pathname);
  const flow = FLOW.test(pathname);
  const nav = useNavigate();
  return (
    <div className="shell" style={{ ['--tint' as string]: tint ? `var(--a-${tint})` : 'var(--a-mint)' }}>
      <Glow tint={tint} mode={mode} />
      <PersistentStage />
      <header className="topbar">
        {flow ? <Button variant="icon" aria-label="Close" onClick={() => nav('/')}><Icon name="close" /></Button> : <Link to="/" className="wordmark" aria-label="Cube home">Cube</Link>}
        <div className="toggles">
          <Button variant="icon" aria-label={settings.voice ? 'Turn the voice off' : 'Turn the voice on'} aria-pressed={settings.voice} onClick={() => setSetting('voice', !settings.voice)}>
            <Icon name={settings.voice ? 'voice' : 'voice-off'} />
          </Button>
          <Button variant="icon" aria-label={settings.sound ? 'Turn sound off' : 'Turn sound on'} aria-pressed={settings.sound} onClick={() => setSetting('sound', !settings.sound)}>
            <Icon name={settings.sound ? 'sound' : 'sound-off'} />
          </Button>
        </div>
      </header>
      <div className="content"><Outlet /></div>
      {tabs && (
        <nav className="tabbar" aria-label="Sections">
          <NavLink to="/" end><Icon name="cube" /><span>Solve</span></NavLink>
          <NavLink to="/journey"><Icon name="gem" /><span>Journey</span></NavLink>
          <NavLink to="/learn"><Icon name="learn" /><span>Learn</span></NavLink>
        </nav>
      )}
    </div>
  );
}
