import { Link, Outlet } from 'react-router';
import { Glow, type Tint } from './Glow';
import { Button } from './Button';
import { Icon } from './Icon';
import { useSession } from '@/store/session';
import { create } from 'zustand';

/** Screen-level hints for the shell (glow tint, glow mode). */
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
  return (
    <div className="shell">
      <Glow tint={tint} mode={mode} />
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Cube home">
          <span className="dot" aria-hidden />
          Cube
        </Link>
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
    </div>
  );
}
