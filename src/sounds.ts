// Synthesized retro sound effects using Web Audio API — no files needed.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Play a short tone with an envelope. */
function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.15,
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

/** Play a sequence of tones (arpeggio). */
function playArpeggio(
  freqs: number[],
  noteDuration: number,
  type: OscillatorType = "square",
  volume = 0.12,
) {
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(freq, noteDuration, type, volume), i * noteDuration * 600);
  });
}

// --- Public sound effects ---

export function sfxCollect() {
  playArpeggio([880, 1100, 1320], 0.08, "square", 0.1);
}

export function sfxPickUpRock() {
  playTone(220, 0.15, "triangle", 0.15);
}

export function sfxDropRock() {
  playTone(150, 0.2, "triangle", 0.15);
}

export function sfxPickUpParcel() {
  playArpeggio([330, 440], 0.1, "square", 0.1);
}

export function sfxDropParcel() {
  playTone(200, 0.15, "square", 0.1);
}

export function sfxParcelPlaced() {
  playArpeggio([440, 550, 660, 880], 0.1, "sine", 0.15);
}

export function sfxSwitch() {
  playArpeggio([400, 600], 0.12, "square", 0.1);
}

export function sfxOneWayGate() {
  playTone(300, 0.12, "sawtooth", 0.08);
}

export function sfxDeath() {
  playArpeggio([440, 330, 220, 110], 0.15, "sawtooth", 0.15);
}

export function sfxPortal() {
  const ac = getCtx();
  const duration = 0.6;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + duration);
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

// --- Looping platform hum ---

let platformOsc: OscillatorNode | null = null;
let platformGain: GainNode | null = null;

export function sfxPlatformStart() {
  if (platformOsc) return; // already playing
  const ac = getCtx();
  platformOsc = ac.createOscillator();
  platformGain = ac.createGain();
  platformOsc.type = "sine";
  platformOsc.frequency.value = 80;
  platformGain.gain.value = 0.06;
  platformOsc.connect(platformGain);
  platformGain.connect(ac.destination);
  platformOsc.start();
}

export function sfxPlatformStop() {
  if (!platformOsc || !platformGain) return;
  const ac = getCtx();
  platformGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
  const osc = platformOsc;
  setTimeout(() => {
    osc.stop();
  }, 250);
  platformOsc = null;
  platformGain = null;
}
