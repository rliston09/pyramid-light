let ctx: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  context();
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number) {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, audio.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + dur);
}

export function playSelect() {
  blip(660, 0.03, "square", 0.012);
}

export function playCommit() {
  blip(420, 0.06, "square", 0.03);
}

export function playLock() {
  blip(523, 0.14, "sine", 0.05);
  window.setTimeout(() => blip(784, 0.2, "sine", 0.045), 110);
}
