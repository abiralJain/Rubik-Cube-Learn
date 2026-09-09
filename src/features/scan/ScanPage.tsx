import './Scan.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useShellState } from '@/ui/Shell';
import { useStage } from '@/cube3d/scene/stage';
import { useSession, EMPTY_FACELETS } from '@/store/session';
import { FACE_COLOUR, FACES, idx, type Face } from '@/cube/facelets';
import { medianRGB } from './classify';
import { assign, cubePresent, nearest, rgbToOklab, identifyFaces, centreDistance, DEFAULT_ANCHORS, type RGB, type Lab } from './assign';
import { speak, hush } from '@/features/play/speech';
import * as sfx from '@/audio/sounds';

/** The order we ask for the sides, and how to hold the cube for each: white on top for the four sides, then tip for white and yellow. */
const ORDER: Array<{ face: Face; say: string; hint: string; top: Face }> = [
  { face: 'F', say: 'Green to the camera, white on top.', hint: 'Hold the cube still, an arm’s length away.', top: 'U' },
  { face: 'R', say: 'Turn it to the left. Red to the camera.', hint: 'White stays on top.', top: 'U' },
  { face: 'B', say: 'Left again. Blue.', hint: 'White stays on top.', top: 'U' },
  { face: 'L', say: 'Left once more. Orange.', hint: 'White stays on top.', top: 'U' },
  { face: 'U', say: 'Back to green, then tip it forward. White to the camera.', hint: 'Green ends up at the bottom.', top: 'B' },
  { face: 'D', say: 'Now tip it right over. Yellow to the camera.', hint: 'Green ends up on top.', top: 'F' },
];
const COLOUR_CSS: Record<Face, string> = { U: '#FFFDF8', R: '#F0574A', F: '#3DBE72', D: '#FFD54A', L: '#FF9440', B: '#3E7BE0' };
const SAMPLE = 240, INSET = 0.22, PATCH = 0.4;
const STABLE_MS = 650;
const KEY = 'cube.scan.v2';

/** One side as read: nine colours, centre at index 4. Which face it is comes from its centre, decided jointly. */
type Capture = { rgb: RGB[] };
const load = (): Capture[] => { try { const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); return Array.isArray(s) ? s.filter((c) => c?.rgb?.length === 9) : []; } catch { return []; } };

/**
 * Scan: show the cube to the camera one side at a time. No button: a side is taken when its colours hold still, and
 * it is recognised by its centre, so the order never matters. The shared cube below fills in as you go.
 */
export default function ScanPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const recover = params.get('recover') === '1';
  const { setFacelets, startLearn, replan, learn, settings } = useSession();
  const setShell = useShellState((s) => s.set);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'starting' | 'live' | 'denied' | 'none'>('starting');
  const [mirror, setMirror] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>(load);
  const [live, setLive] = useState<Array<Face | null>>(Array(9).fill(null));
  const [present, setPresent] = useState(false);
  const [steady, setSteady] = useState(0);
  const [flash, setFlash] = useState(false);
  const [finished, setFinished] = useState<null | { valid: boolean; repaired: string }>(null);
  const [seenAgain, setSeenAgain] = useState<Face | null>(null);
  const stableSince = useRef(0);
  const lastLab = useRef<Lab[] | null>(null);
  const capturesRef = useRef(captures);
  capturesRef.current = captures;

  // which face each capture is, from its centre colour
  const faces = useMemo(() => identifyFaces(captures.map((c) => rgbToOklab(c.rgb[4]))), [captures]);
  const have = useMemo(() => new Set(faces), [faces]);
  const done = captures.length >= 6;
  const stepIdx = ORDER.findIndex((o) => !have.has(o.face));
  const step = ORDER[Math.max(0, stepIdx)];

  useEffect(() => { setShell({ tint: null }); return () => { setShell({ tint: null }); hush(); }; }, [setShell]);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(captures)); } catch { /* full */ } }, [captures]);

  // anchors for the live preview: centres seen so far, defaults for the rest
  const anchors = useMemo(() => {
    const a = Object.fromEntries(FACES.map((f) => [f, rgbToOklab(DEFAULT_ANCHORS[f])])) as Record<Face, Lab>;
    captures.forEach((c, k) => { a[faces[k]] = rgbToOklab(c.rgb[4]); });
    return a;
  }, [captures, faces]);

  // camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('none'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const track = stream.getVideoTracks()[0];
        setMirror(track.getSettings().facingMode === 'user');
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setStatus('live');
      } catch { setStatus('denied'); }
    })();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // say each prompt once
  const said = useRef(-1);
  useEffect(() => {
    if (status !== 'live' || done || said.current === stepIdx) return;
    said.current = stepIdx;
    if (settings.voice) speak(step.say);
  }, [status, done, stepIdx, step, settings.voice]);

  const capture = useCallback((rgb: RGB[]) => {
    setCaptures((prev) => (prev.length >= 6 ? prev : [...prev, { rgb }]));
    stableSince.current = 0; lastLab.current = null; setSteady(0);
    setFlash(true); setTimeout(() => setFlash(false), 260);
    sfx.shutter(); if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  // sampling loop ~12 fps
  useEffect(() => {
    if (status !== 'live' || done) return;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
    canvas.width = SAMPLE; canvas.height = SAMPLE;
    const g = canvas.getContext('2d', { willReadFrequently: true })!;
    let raf = 0, last = 0;
    const inset = SAMPLE * INSET, cell = (SAMPLE - 2 * inset) / 3, patch = cell * PATCH;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 80) return; last = t;
      const v = videoRef.current; if (!v || v.readyState < 2) return;
      const vw = v.videoWidth, vh = v.videoHeight, s = Math.min(vw, vh);
      g.drawImage(v, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, SAMPLE, SAMPLE);
      const data = g.getImageData(0, 0, SAMPLE, SAMPLE).data;
      const rgb: RGB[] = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const x0 = inset + c * cell + (cell - patch) / 2, y0 = inset + r * cell + (cell - patch) / 2;
        rgb.push(medianRGB(data, SAMPLE, Math.round(x0), Math.round(y0), Math.round(patch)));
      }
      const labs = rgb.map(rgbToOklab);
      // the gaps between stickers: four points between the centre cell and its neighbours
      const gaps: Lab[] = [[1, 0], [0, 1], [2, 1], [1, 2]].map(([c, r]) => rgbToOklab(medianRGB(data, SAMPLE, Math.round(inset + c * cell + (c === 1 ? cell / 2 - 3 : c === 0 ? cell - 3 : 0)), Math.round(inset + r * cell + (r === 1 ? cell / 2 - 3 : r === 0 ? cell - 3 : 0)), 6)));
      const here = cubePresent(labs, gaps);
      setPresent(here);
      setLive(here ? labs.map((p) => nearest(p, anchors).face) : Array(9).fill(null));
      if (!here) { stableSince.current = 0; setSteady(0); setSeenAgain(null); return; }
      // a side we already have: its centre sits on a captured centre
      const again = capturesRef.current.findIndex((c) => centreDistance(labs[4], rgbToOklab(c.rgb[4])) < 0.06);
      setSeenAgain(again >= 0 ? faces[again] : null);
      if (again >= 0) { stableSince.current = 0; setSteady(0); return; }
      // stability: every patch within a small distance of the last frame
      const prev = lastLab.current; lastLab.current = labs;
      const still = !!prev && labs.every((p, i) => Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1], p[2] - prev[i][2]) < 0.035);
      if (!still) { stableSince.current = 0; setSteady(0); return; }
      if (!stableSince.current) stableSince.current = t;
      const held = t - stableSince.current;
      setSteady(Math.min(1, held / STABLE_MS));
      if (held >= STABLE_MS) capture(rgb);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, done, anchors, faces, capture]);

  // the 54 samples, once every side is identified
  const samples = useMemo(() => {
    const out: Array<RGB | null> = Array(54).fill(null);
    captures.forEach((c, k) => { const f = faces[k]; c.rgb.forEach((v, i) => { out[idx(f, i)] = v; }); });
    return out;
  }, [captures, faces]);

  // all six in: assign globally, then go
  const finishedOnce = useRef(false);
  useEffect(() => {
    if (!done || finishedOnce.current) return;
    finishedOnce.current = true;
    const result = assign(samples as RGB[]);
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (result.valid) {
      if (recover && learn) replan(result.facelets, learn.elapsedMs); else { setFacelets(result.facelets, 'camera'); startLearn(result.facelets); }
      setFinished({ valid: true, repaired: result.repaired });
      sfx.stageChime();
      if (settings.voice) speak(result.repaired === 'none' ? 'Got it.' : 'Got it. One sticker read wrong, so I fixed it.');
      setTimeout(() => nav('/play'), 1100);
    } else {
      setFacelets(result.facelets, 'camera');
      setFinished({ valid: false, repaired: 'failed' });
      if (settings.voice) speak('Got all six, but something is off. Let’s look.');
      setTimeout(() => nav('/fix'), 1300);
    }
  }, [done, samples, recover, learn, replan, setFacelets, startLearn, nav, settings.voice]);

  const retake = () => { setCaptures((prev) => prev.slice(0, -1)); said.current = -1; finishedOnce.current = false; setFinished(null); };

  // what the shared cube shows: sides taken so far, plus the live side
  const preview = useMemo(() => {
    const arr = EMPTY_FACELETS.split('');
    for (let i = 0; i < 54; i++) { const s = samples[i]; if (s && i % 9 !== 4) arr[i] = nearest(rgbToOklab(s), anchors).face; }
    if (!done && !seenAgain) live.forEach((f, k) => { if (k !== 4 && f) arr[idx(step.face, k)] = f; });
    return arr.join('');
  }, [samples, live, step.face, done, anchors, seenAgain]);
  const orientation = useMemo(() => ({ top: step.top, front: step.face, yaw: -0.4, pitch: 0.22 }), [step]);
  const stageRef = useStage({ facelets: preview, interactive: false, orientation, rippleOnTap: false, fill: 0.9 });

  if (status === 'denied' || status === 'none') {
    return (
      <main className="screen"><div className="stage" ref={stageRef} /><div className="dock cam-nocam">
        <Icon name="camera" style={{ width: 40, height: 40, color: 'var(--ink-3)' }} />
        <h1 style={{ fontSize: 28 }}>{status === 'none' ? 'No camera here.' : 'The camera is off.'}</h1>
        <p className="body">{status === 'none' ? 'That is fine. Colouring the stickers in takes about a minute.' : 'Allow the camera in your browser settings, or colour the stickers in instead.'}</p>
        <Button onClick={() => nav('/fix')} block><Icon name="paint" /> Colour it in</Button>
      </div></main>
    );
  }

  const prompt = finished
    ? (finished.valid ? (finished.repaired === 'none' ? 'Got it.' : 'Got it. One sticker read wrong, so I fixed it.') : 'Got all six, but something is off.')
    : seenAgain ? `I have the ${FACE_COLOUR[seenAgain]} side. Show me ${FACE_COLOUR[step.face]}.` : step.say;
  const sub = finished ? (finished.valid ? 'Hold it with yellow on top, green facing you.' : 'Let’s look at it together.') : status === 'starting' ? 'Starting the camera…' : !present ? 'Bring the cube into the square.' : steady > 0 ? 'Hold still…' : step.hint;

  return (
    <main className="screen scan" aria-label="Scan your cube">
      <div className="scan-top">
        <div className="cam-frame" data-mirror={mirror ? '' : undefined} data-present={present ? '' : undefined}>
          <video ref={videoRef} playsInline muted />
          <div className="guide" data-steady={steady > 0.3 ? '' : undefined} aria-hidden style={{ '--steady': steady } as CSSProperties}>
            {live.map((f, i) => <i key={i} style={{ '--cell': f ? COLOUR_CSS[f] : 'transparent' } as CSSProperties} />)}
          </div>
          <div className="cam-flash" data-on={flash ? '' : undefined} />
        </div>
        <div className="stage scan-cube" ref={stageRef} />
      </div>
      <div className="dock">
        <p className="cam-prompt" aria-live="polite">{prompt}<small>{sub}</small></p>
        <div className="cam-dots" role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={captures.length} aria-label={`${captures.length} of 6 sides`}>
          {ORDER.map((o) => <i key={o.face} style={{ '--dot': COLOUR_CSS[o.face] } as CSSProperties} data-done={have.has(o.face) ? '' : undefined} data-active={!done && o.face === step.face ? '' : undefined} />)}
        </div>
        <div className="scan-links">
          <Button variant="ghost" onClick={retake} disabled={!captures.length}>Retake the last side</Button>
          <Button variant="ghost" onClick={() => nav('/fix')}>Colour it in instead</Button>
        </div>
      </div>
    </main>
  );
}
