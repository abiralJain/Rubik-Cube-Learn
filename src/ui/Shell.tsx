import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Glow, type Tint } from './Glow';
import { Button } from './Button';
import { Icon } from './Icon';
import { useSession } from '@/store/session';
import { create } from 'zustand';

/** Screen-level hints for the shell (room light tint, mode). */
export const useShellState = create<{ tint: Tint | null; mode?: 'holo' | 'off'; set: (s: { tint?: Tint | null; mode?: 'holo' | 'off' }) => void }>((set) => ({
  tint: null,
  mode: undefined,
  set: (s) => set(s),
}));

export function Shell() {
  const { tint, mode } = useShellState();
  const poster = typeof location !== 'undefined' && new URLSearchParams(location.search).get('poster') === '1';
  if (poster) return <Outlet />;
  const settings = useSession((s) => s.settings);
  const setSetting = useSession((s) => s.setSetting);
  const { pathname } = useLocation();
  const learning = useSession((s) => s.learn);
  const tabs = pathname === '/' || pathname === '/paint' || (pathname === '/learn' && !learning);
  return (
    <div className="shell" style={{ ['--tint' as string]: tint ? `var(--a-${tint})` : 'var(--a-mint)' }}>
      <Glow tint={tint} mode={mode} />
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Cube home">Cube</Link>
        <div className="toggles">
          <Button variant="icon" aria-label={settings.voice ? 'Turn read-aloud off' : 'Turn read-aloud on'} aria-pressed={settings.voice} onClick={() => setSetting('voice', !settings.voice)}>
            <Icon name={settings.voice ? 'voice' : 'voice-off'} />
          </Button>
          <Button variant="icon" aria-label={settings.sound ? 'Turn sound off' : 'Turn sound on'} aria-pressed={settings.sound} onClick={() => setSetting('sound', !settings.sound)}>
            <Icon name={settings.sound ? 'sound' : 'sound-off'} />
          </Button>
        </div>
      </header>
      <Outlet />
      {tabs && (
        <nav className="tabbar" aria-label="Sections">
          <NavLink to="/" end><Icon name="home" /><span>Home</span></NavLink>
          <NavLink to="/paint"><Icon name="cube" /><span>Cube</span></NavLink>
          <NavLink to="/learn"><Icon name="learn" /><span>Learn</span></NavLink>
        </nav>
      )}
    </div>
  );
}
