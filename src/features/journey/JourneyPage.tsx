import './Journey.css';
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import { useSession } from '@/store/session';
import { STAGES, STAGE_NAME, STAGE_DONE_LINE, type StageId } from '@/cube/lbl';

const GEM_HEX: Record<StageId, string> = { 'white-cross': '#ECEAE3', 'white-corners': '#ECEAE3', 'middle-edges': '#5CCB8E', 'yellow-cross': '#F5CC4A', 'yellow-corners': '#F5CC4A', 'position-corners': '#F5924A', 'position-edges': '#6F9AE6' };
const STONE_NAME: Record<StageId, string> = { 'white-cross': 'Daisy', 'white-corners': 'Four-petal', 'middle-edges': 'Emerald', 'yellow-cross': 'Citrine', 'yellow-corners': 'Amber cushion', 'position-corners': 'Spessartite', 'position-edges': 'Sapphire' };

/** Journey: Opal's gems screen. Seven stones, the ones you have earned lit; your solves below. */
export default function JourneyPage() {
  const nav = useNavigate();
  const { unlocked, history, learn } = useSession();
  const setShell = useShellState((s) => s.set);
  const [open, setOpen] = useState<StageId | null>(null);
  useEffect(() => { setShell({ tint: null, mode: undefined }); }, [setShell]);
  const solves = history.length;
  const best = history.reduce<number | null>((b, h) => (b === null || h.ms < b ? h.ms : b), null);
  const streak = streakDays(history.map((h) => h.at));
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  return (
    <main className="journey has-tabs" aria-label="Journey">
      <div className="section-head">
        <p className="caps">Journey</p>
        <h1>{solves === 0 ? 'Seven stones to earn.' : solves === 1 ? 'One solve. Seven stones.' : `${solves} solves.`}</h1>
        <p className="body">{solves === 0 ? 'Each stage of your first solve lights one.' : 'Every stage you pass lights its stone again.'}</p>
      </div>
      <ol className="gem-grid">
        {STAGES.map((st, i) => {
          const at = unlocked[st];
          return (
            <li key={st} className="gem-cell enter" style={{ '--i': i, '--glow': GEM_HEX[st] } as CSSProperties} data-lit={at ? '' : undefined}>
              <button type="button" onClick={() => setOpen(st)} aria-label={`${STAGE_NAME[st]}${at ? ', unlocked' : ', locked'}`}>
                <img src={`${import.meta.env.BASE_URL}gems/stage-${i + 1}.webp`} alt="" decoding="async" />
                <span className="gem-name">{STAGE_NAME[st]}</span>
                <span className="caption">{at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : <><Icon name="lock" /> Stage {i + 1}</>}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="dock">
        <div className="stats">
          <div className="stat"><b>{solves}</b><span>Solves</span></div>
          <div className="stat"><b>{best === null ? '–' : fmt(best)}</b><span>Best</span></div>
          <div className="stat"><b>{streak}</b><span>Day streak</span></div>
        </div>
        <Button onClick={() => nav(learn ? '/play' : '/')} block>{learn ? 'Continue the solve' : solves ? 'Solve again' : 'Start your first solve'}</Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div key={open} className="milestone" role="dialog" aria-modal="true" aria-label={STAGE_NAME[open]} style={{ '--glow': GEM_HEX[open], '--tint': GEM_HEX[open] } as CSSProperties}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}>
            <Button variant="icon" className="flow-close" aria-label="Close" onClick={() => setOpen(null)}><Icon name="close" /></Button>
            <div className="milestone-copy">
              <p className="caps" data-tint>Stage {STAGES.indexOf(open) + 1} of 7 · {STONE_NAME[open]}</p>
              <h1>{STAGE_NAME[open]}</h1>
              <p className="body">{unlocked[open] ? STAGE_DONE_LINE[open] : 'Pass this stage in a solve to light it.'}</p>
            </div>
            <motion.div className="milestone-gem" data-locked={unlocked[open] ? undefined : ''} initial={{ opacity: 0, transform: 'scale(0.9)' }} animate={{ opacity: 1, transform: 'scale(1)' }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}>
              <img src={`${import.meta.env.BASE_URL}gems/stage-${STAGES.indexOf(open) + 1}.webp`} alt="" />
            </motion.div>
            <div className="milestone-foot">
              <p className="caption">{unlocked[open] ? <><Icon name="check" /> Unlocked {new Date(unlocked[open]!).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</> : <><Icon name="lock" /> Locked</>}</p>
              <Button block onClick={() => { setOpen(null); nav(`/learn/${open}`); }}>Learn this stage</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function streakDays(times: number[]): number {
  if (!times.length) return 0;
  const days = [...new Set(times.map((t) => Math.floor(t / 86400000)))].sort((a, b) => b - a);
  const today = Math.floor(Date.now() / 86400000);
  if (days[0] < today - 1) return 0;
  let n = 1;
  for (let i = 1; i < days.length; i++) { if (days[i] === days[i - 1] - 1) n++; else break; }
  return n;
}
