import './Scan.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { useStage } from '@/cube3d/scene/stage';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import { useSession, EMPTY_FACELETS } from '@/store/session';
import { FACE_COLOUR, idx, type Face } from '@/cube/facelets';
import { validate } from '@/cube/validate';
import { classify, medianRGB, rgbToHsv, DEFAULT_REFS, type HSV } from './classify';
import * as sfx from '@/audio/sounds';

/** Capture order and how to hold the cube for each (white on top for the sides; tip forward/back for white and yellow). */
const ORDER: Array<{ face: Face; prompt: string; hint: string; top: Face }> = [
  { face: 'F', prompt: 'Point the green centre at the camera.', hint: 'Keep the white centre on top.', top: 'U' },
  { face: 'R', prompt: 'Turn the cube to your left: red faces the camera.', hint: 'White stays on top.', top: 'U' },
  { face: 'B', prompt: 'Turn left again: blue.', hint: 'White stays on top.', top: 'U' },
  { face: 'L', prompt: 'Left once more: orange.', hint: 'White stays on top.', top: 'U' },
  { face: 'U', prompt: 'Turn left to green again, then tip the cube forward so white faces the camera.', hint: 'Green ends up at the bottom.', top: 'B' },
  { face: 'D', prompt: 'Tip it back the other way so yellow faces the camera.', hint: 'Green ends up on top.', top: 'F' },
];
const COLOUR_CSS: Record<Face, string> = { U: '#FFFDF8', R: '#F0574A', F: '#3DBE72', D: '#FFD54A', L: '#FF9440', B: '#3E7BE0' };

export default function CameraPage() {
  const nav = useNavigate();
  const { setFacelets } = useSession();
  const setShell = useShellState((s) => s.set);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'starting' | 'live' | 'denied' | 'none'>('starting');
  const [mirror, setMirror] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [captured, setCaptured] = useState<string>(EMPTY_FACELETS);
  const [live, setLive] = useState<Array<Face | null>>(Array(9).fill(null));
  const [steady, setSteady] = useState(0);
  const [flash, setFlash] = useState(false);
  const refs = useRef<Record<Face, HSV>>({ ...DEFAULT_REFS });
  const stableSince = useRef<number>(0);
  const lastKey = useRef<string>('');
  const done = stepIdx >= ORDER.length;
  const step = ORDER[Math.min(stepIdx, ORDER.length - 1)];

  useEffect(() => { setShell({ tint: null }); return () => setShell({ tint: null }); }, [setShell]);

  // camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('none'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const track = stream.getVideoTracks()[0];
        setMirror(track.getSettings().facingMode === 'user' || !track.getSettings().facingMode);
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setStatus('live');
      } catch { setStatus('denied'); }
    })();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // sampling loop ~10 fps
  useEffect(() => {
    if (status !== 'live' || done) return;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
    canvas.width = 240; canvas.height = 240;
    const g = canvas.getContext('2d', { willReadFrequently: true })!;
    let raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 100) return; last = t;
      const v = videoRef.current; if (!v || v.readyState < 2) return;
      // crop the centre square of the video
      const vw = v.videoWidth, vh = v.videoHeight, s = Math.min(vw, vh);
      g.drawImage(v, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, 240, 240);
      const data = g.getImageData(0, 0, 240, 240).data;
      const cells: Array<Face | null> = [];
      const inset = 240 * 0.22, cell = (240 - 2 * inset) / 3, patch = cell * 0.4;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const x0 = inset + c * cell + (cell - patch) / 2, y0 = inset + r * cell + (cell - patch) / 2;
        const [R, G, B] = medianRGB(data, 240, Math.round(x0), Math.round(y0), Math.round(patch));
        const hsv = rgbToHsv(R, G, B);
        const res = classify(hsv, refs.current);
        cells.push(res.confidence > 0.15 ? res.face : null);
        if (r === 1 && c === 1) (cells as unknown as { centreHSV?: HSV }).centreHSV = hsv;
      }
      setLive(cells);
      const key = cells.join('');
      const complete = cells.every(Boolean) && cells[4] === step.face;
      if (complete && key === lastKey.current) {
        if (!stableSince.current) stableSince.current = t;
        const held = t - stableSince.current;
        setSteady(Math.min(1, held / 700));
        if (held > 700) capture(cells as Face[], (cells as unknown as { centreHSV: HSV }).centreHSV);
      } else { stableSince.current = 0; setSteady(0); lastKey.current = key; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, done, stepIdx, mirror]);

  const capture = useCallback((cells: Face[], centreHSV: HSV) => {
    stableSince.current = 0; setSteady(0);
    refs.current = { ...refs.current, [step.face]: centreHSV }; // the user's own colour for this face
    setCaptured((prev) => { const arr = prev.split(''); cells.forEach((f, i) => { arr[idx(step.face, i)] = i === 4 ? step.face : f; }); return arr.join(''); });
    setFlash(true); setTimeout(() => setFlash(false), 260);
    sfx.shutter(); if (navigator.vibrate) navigator.vibrate(10);
    setStepIdx((i) => i + 1);
  }, [step.face]);

  const manual = () => { if (live.every(Boolean)) capture(live as Face[], refs.current[step.face]); else sfx.bloop(); };
  const retake = () => { if (stepIdx > 0) setStepIdx((i) => i - 1); };

  const validation = useMemo(() => (done ? validate(captured) : null), [done, captured]);
  useEffect(() => {
    if (!done) return;
    setFacelets(captured, 'camera');
    if (validation?.ok) { sfx.stageChime(); setTimeout(() => nav('/play'), 900); }
  }, [done, captured, validation, setFacelets, nav]);

  const preview = useMemo(() => {
    if (done) return captured;
    const arr = captured.split('');
    live.forEach((f, i) => { if (i !== 4) arr[idx(step.face, i)] = f ?? '.'; });
    return arr.join('');
  }, [captured, live, step.face, done]);
  const orientation = useMemo(() => ({ top: step.top, front: step.face, yaw: -0.35, pitch: 0.2 }), [step]);
  const stageRef = useStage({ facelets: preview, interactive: false, orientation, rippleOnTap: false, fill: 0.9 });

  if (status === 'denied' || status === 'none') {
    return (
      <main className="screen"><div className="stage" /><div className="dock cam-nocam">
        <Icon name="camera" style={{ width: 40, height: 40, color: 'var(--ink-3)' }} />
        <h1 style={{ fontSize: 30 }}>{status === 'none' ? 'No camera here.' : 'The camera is off.'}</h1>
        <p style={{ color: 'var(--ink-2)' }}>{status === 'none' ? 'That is fine. Colouring the stickers in takes about a minute.' : 'Allow the camera in your browser settings, or colour the stickers in instead.'}</p>
        <Button onClick={() => nav('/fix')} block><Icon name="paint" /> Colour it in</Button>
      </div></main>
    );
  }

  return (
    <main className="screen scan" aria-label="Scan your cube">
      <Button variant="icon" className="flow-close" aria-label="Back" onClick={() => nav('/')}><Icon name="close" /></Button>
      <div className="stage cam-stage">
        <div className="cam-frame" data-mirror={mirror ? '' : undefined}>
          <video ref={videoRef} playsInline muted />
          <div className="guide" data-steady={steady > 0.3 ? '' : undefined} aria-hidden>
            {live.map((f, i) => <i key={i} style={{ '--cell': f ? COLOUR_CSS[f] + (i === 4 ? 'cc' : '99') : 'transparent' } as CSSProperties} />)}
          </div>
          <div className="cam-flash" data-on={flash ? '' : undefined} />
        </div>
        <div className="stage cam-cube" ref={stageRef} />
      </div>
      <div className="dock">
        <p className="cam-prompt" aria-live="polite">
          {done ? (validation?.ok ? 'Got all six. Off we go.' : 'Got all six, but something is off. Let’s fix it by hand.') : step.prompt}
          {!done && <small>{status === 'starting' ? 'Starting the camera…' : steady > 0 ? 'Hold still…' : step.hint}</small>}
        </p>
        <div className="cam-dots" aria-label={`Face ${Math.min(stepIdx + 1, 6)} of 6`}>
          {ORDER.map((o, i) => <i key={o.face} style={{ '--dot': COLOUR_CSS[o.face] } as CSSProperties} data-done={i < stepIdx ? '' : undefined} data-active={i === stepIdx ? '' : undefined} />)}
        </div>
        <div className="cam-row">
          <Button variant="secondary" onClick={retake} disabled={stepIdx === 0}><Icon name="undo" /> Retake</Button>
          {done && !validation?.ok
            ? <Button onClick={() => nav('/fix')}><Icon name="paint" /> Fix by hand</Button>
            : <Button tone={FACE_COLOUR[step.face] as 'green'} onClick={manual} disabled={done}><Icon name="camera" /> Capture</Button>}
        </div>
      </div>
    </main>
  );
}
