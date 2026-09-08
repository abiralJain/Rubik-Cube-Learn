/** Tiny Web Audio synth. No assets. Everything under 120 ms except the chime. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) { enabled = on; if (master) master.gain.value = on ? 1 : 0; }

/** Call from a pointer-down handler once; safe to call repeatedly. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function env(node: AudioNode, t0: number, peak: number, attack: number, decay: number) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  node.connect(g); g.connect(master!);
  return g;
}
function tone(freq: number, type: OscillatorType, t0: number, peak: number, attack: number, decay: number, detune = 0) {
  const o = ctx!.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
  env(o, t0, peak, attack, decay);
  o.start(t0); o.stop(t0 + attack + decay + 0.02);
}
function noise(t0: number, peak: number, decay: number, cutoff: number) {
  const len = Math.floor(ctx!.sampleRate * (decay + 0.01));
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx!.createBufferSource(); src.buffer = buf;
  const f = ctx!.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
  src.connect(f); env(f, t0, peak, 0.002, decay);
  src.start(t0); src.stop(t0 + decay + 0.02);
}
const ready = () => !!ctx && enabled && ctx.state === 'running';

/** Wooden "tok" when a layer clicks home. */
export function tok(pitch = 1) {
  if (!ready()) return;
  const t = ctx!.currentTime;
  noise(t, 0.35, 0.05, 1800 * pitch);
  tone(180 * pitch, 'sine', t, 0.28, 0.003, 0.07);
}
/** Marimba-like note; index 0..5 maps to C major pentatonic (C5 D5 E5 G5 A5 C6). */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
export function plink(step: number, gain = 0.22) {
  if (!ready()) return;
  const t = ctx!.currentTime;
  const f = PENTA[((step % 6) + 6) % 6];
  tone(f, 'sine', t, gain, 0.004, 0.16);
  tone(f * 2.01, 'sine', t, gain * 0.25, 0.003, 0.08);
  tone(f * 4.2, 'triangle', t, gain * 0.08, 0.002, 0.04);
}
/** Soft low "bloop" for a not-yet turn. */
export function bloop() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  const o = ctx!.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
  env(o, t, 0.2, 0.005, 0.12); o.start(t); o.stop(t + 0.16);
}
/** Two-note cadence (all stickers in). */
export function cadence() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  tone(783.99, 'sine', t, 0.2, 0.005, 0.18);
  tone(1046.5, 'sine', t + 0.12, 0.22, 0.005, 0.32);
}
/** Stage complete: rising triad. */
export function stageChime() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => tone(f, 'sine', t + i * 0.07, 0.18, 0.005, 0.28));
}
/** Solved: soft bell chord with a shimmer. */
export function solvedChime() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    tone(f, 'sine', t + i * 0.09, 0.16, 0.01, 0.9);
    tone(f * 2, 'sine', t + i * 0.09, 0.04, 0.01, 0.5, 6);
  });
}
/** Ripple poke: four quick rising notes. */
export function ripplePlink() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  [0, 1, 2, 4].forEach((s, i) => setTimeout(() => plink(s, 0.14), i * 45));
  void t;
}
export function shutter() {
  if (!ready()) return;
  const t = ctx!.currentTime;
  noise(t, 0.3, 0.03, 4000); tone(1200, 'square', t, 0.05, 0.002, 0.03);
}
