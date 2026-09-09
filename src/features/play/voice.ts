/**
 * The voice. Calm, slow and never talking over itself. Web Speech under the hood, with a ranked pick of the best
 * installed voice, one utterance per clause with a breath between, and a queue so nothing overlaps.
 */
const supported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

/** Voices we know sound good, best first. Matched against name; the first hit wins. */
const RANKED = [
  /Ava \(Premium\)/i, /Zoe \(Premium\)/i, /Samantha \(Enhanced\)/i, /Karen \(Premium\)/i, /Serena \(Premium\)/i, /Moira \(Premium\)/i,
  /Siri/i, /Ava/i, /Zoe/i, /Samantha/i, /Karen/i, /Serena/i, /Moira/i, /Tessa/i, /Fiona/i,
  /Google UK English Female/i, /Google US English/i, /Microsoft (Libby|Sonia|Aria|Jenny|Emma)/i, /Microsoft Zira/i,
  /en-GB/i, /en-US/i, /en/i,
];

let voices: SpeechSynthesisVoice[] = [];
let preferredURI: string | null = null;
function refresh() { if (supported()) voices = speechSynthesis.getVoices(); }
if (supported()) { refresh(); speechSynthesis.addEventListener?.('voiceschanged', refresh); }

export function listVoices(): SpeechSynthesisVoice[] {
  refresh();
  const english = voices.filter((v) => /^en/i.test(v.lang));
  return english.sort((a, b) => rank(a) - rank(b));
}
function rank(v: SpeechSynthesisVoice) { const i = RANKED.findIndex((re) => re.test(v.name) || re.test(v.lang)); return i < 0 ? RANKED.length : i; }
export function pickVoice(): SpeechSynthesisVoice | null {
  const all = listVoices();
  if (preferredURI) { const hit = all.find((v) => v.voiceURI === preferredURI); if (hit) return hit; }
  return all[0] ?? null;
}
export function setPreferredVoice(uri: string | null) { preferredURI = uri; }

type Job = { text: string; resolve: () => void; opts: SpeakOpts };
interface SpeakOpts { rate?: number; pitch?: number; /** Break the text into clauses with a breath between. */ clauses?: boolean; }
let queue: Job[] = [];
let speaking = false;
let muted = false;
let onState: ((speaking: boolean) => void) | null = null;
export function watchSpeaking(cb: ((s: boolean) => void) | null) { onState = cb; }
function setSpeaking(s: boolean) { if (speaking !== s) { speaking = s; onState?.(s); } }

/** Say something. Resolves when it has been said (or immediately if speech is unavailable or muted). */
export function say(text: string, opts: SpeakOpts = {}): Promise<void> {
  if (!supported() || muted || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => { queue.push({ text, resolve, opts }); pump(); });
}
/** Stop now and forget what was queued. */
export function hush() {
  queue.forEach((j) => j.resolve()); queue = [];
  if (supported()) speechSynthesis.cancel();
  setSpeaking(false);
}
export function setMuted(m: boolean) { muted = m; if (m) hush(); }
export const isSpeaking = () => speaking;

function pump() {
  if (speaking || !queue.length) return;
  const job = queue.shift()!;
  const parts = job.opts.clauses === false ? [job.text] : splitClauses(job.text);
  setSpeaking(true);
  let i = 0;
  const next = () => {
    if (i >= parts.length) { setSpeaking(false); job.resolve(); pump(); return; }
    const u = new SpeechSynthesisUtterance(parts[i++]);
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = job.opts.rate ?? 0.92; u.pitch = job.opts.pitch ?? 0.97; u.volume = 1;
    let settled = false;
    const done = () => { if (settled) return; settled = true; setTimeout(next, i < parts.length ? 220 : 0); };
    u.onend = done; u.onerror = done;
    // some engines never fire onend for a cancelled utterance; a generous fallback keeps the queue alive
    setTimeout(done, 1200 + parts[i - 1].length * 90);
    speechSynthesis.speak(u);
  };
  next();
}
function splitClauses(text: string): string[] {
  return text.split(/(?<=[.!?;:])\s+/).map((s) => s.trim()).filter(Boolean);
}

// pause while the tab is hidden
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden && supported()) speechSynthesis.pause(); else if (supported()) speechSynthesis.resume(); });

/** Kept for callers that only want fire-and-forget. */
export const speak = (text: string) => { void say(text); };
