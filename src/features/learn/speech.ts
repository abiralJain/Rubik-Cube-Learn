let voice: SpeechSynthesisVoice | null | undefined;
function pick() {
  if (voice !== undefined) return voice;
  const vs = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
  voice = vs.find((v) => /en/i.test(v.lang) && /Samantha|Google UK English Female|Karen|Moira|Serena|female/i.test(v.name)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;
  return voice;
}
export const speechSupported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
export function speak(text: string, opts: { aside?: boolean } = {}) {
  if (!speechSupported()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pick(); if (v) u.voice = v;
  u.rate = 0.95; u.pitch = opts.aside ? 1.15 : 1.05; u.volume = 1;
  speechSynthesis.speak(u);
}
export function hush() { if (speechSupported()) speechSynthesis.cancel(); }
if (speechSupported()) speechSynthesis.addEventListener?.('voiceschanged', () => { voice = undefined; });
