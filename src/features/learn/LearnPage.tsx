import './Learn.css';
import { useEffect, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import { useSession } from '@/store/session';
import { STAGES, STAGE_NAME, type StageId } from '@/cube/lbl';
import { CHAPTERS } from './chapters';

/** Learn: the theory, one chapter per stage. You come here when you want to, never because you have to. */
export default function LearnPage() {
  const nav = useNavigate();
  const { chapter } = useParams();
  const { unlocked, history } = useSession();
  const setShell = useShellState((s) => s.set);
  useEffect(() => { setShell({ tint: null, mode: undefined }); }, [setShell]);
  const openAll = history.length > 0;
  const isOpen = (st: StageId) => openAll || !!unlocked[st] || STAGES.indexOf(st) === 0;
  const stage = STAGES.includes(chapter as StageId) ? (chapter as StageId) : null;

  if (stage) {
    const ch = CHAPTERS[stage];
    const i = STAGES.indexOf(stage);
    return (
      <main className="learn chapter has-tabs" aria-label={STAGE_NAME[stage]}>
        <Button variant="icon" className="flow-close" aria-label="All chapters" onClick={() => nav('/learn')}><Icon name="arrow-left" /></Button>
        <article className="chapter-body">
          <p className="caps" data-tint>Chapter {i + 1} of 7</p>
          <h1>{STAGE_NAME[stage]}</h1>
          <p className="lede">{ch.idea}</p>
          {ch.sections.map((sec) => (
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              {sec.body.map((para, k) => <p key={k} className="body">{para}</p>)}
            </section>
          ))}
        </article>
        <div className="dock">
          {i < 6 && <Button variant="secondary" onClick={() => nav(`/learn/${STAGES[i + 1]}`)} block>Next chapter <Icon name="arrow-right" /></Button>}
        </div>
      </main>
    );
  }

  return (
    <main className="learn has-tabs" aria-label="Learn">
      <div className="section-head">
        <p className="caps">Learn</p>
        <h1>Why it works.</h1>
        <p className="body">{openAll ? 'Seven short chapters, one per stage.' : 'Chapters open as you pass each stage. Everything opens after your first solve.'}</p>
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
