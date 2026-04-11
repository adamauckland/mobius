// Synthesized retro sound effects using Web Audio API — no files needed.

import { game } from "../game";

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
		game.clock.schedule(
			() => playTone(freq, noteDuration, type, volume),
			i * noteDuration * 600,
		);
	});
}

// --- Helpers ---

function createNoiseSource(ac: AudioContext, duration: number): AudioBufferSourceNode {
	const bufferSize = Math.ceil(ac.sampleRate * duration);
	const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) {
		data[i] = Math.random() * 2 - 1;
	}
	const source = ac.createBufferSource();
	source.buffer = buffer;
	return source;
}

function createBandpassFilter(ac: AudioContext, frequency: number, q: number): BiquadFilterNode {
	const filter = ac.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = frequency;
	filter.Q.value = q;
	return filter;
}

function createFadeOutGain(ac: AudioContext, volume: number, duration: number): GainNode {
	const gain = ac.createGain();
	gain.gain.setValueAtTime(volume, ac.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
	return gain;
}

// --- Public sound effects ---

export function sfxCollect() {
	const ac = getCtx();
	const duration = 1;
	const source = createNoiseSource(ac, duration);
	const filter = createBandpassFilter(ac, Math.random() * 200 + 200, 0.8);
	const gain = createFadeOutGain(ac, 0.18, duration);
	source.connect(filter);
	filter.connect(gain);
	gain.connect(ac.destination);
	source.start();
	source.stop(ac.currentTime + duration);
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

export function sfxLevelComplete() {
	playArpeggio([523, 659, 784, 1047], 0.15, "sine", 0.15);
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

function playBeat(ac: AudioContext, freq: number, volume: number, startTime: number, duration: number) {
	const osc = ac.createOscillator();
	const gain = ac.createGain();
	osc.type = "sine";
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(volume, startTime);
	gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
	osc.connect(gain);
	gain.connect(ac.destination);
	osc.start(startTime);
	osc.stop(startTime + duration);
}

export function sfxHeartbeat() {
	const ac = getCtx();
	const t = ac.currentTime;
	playBeat(ac, 55, 0.25, t, 0.15);
	playBeat(ac, 45, 0.18, t + 0.15, 0.15);
}

export function sfxCountdownTick() {
	playTone(220, 0.15, "square", 0.12);
}

export function sfxCountdownGo() {
	playArpeggio([220, 330, 440], 0.08, "square", 0.15);
}

export function sfxCritterFlee() {
	const start = Math.random() * 600 + 300;
	const end = start - 100;
	playArpeggio([start, end], 0.06, "triangle", 0.08);
}

export function sfxExitDoorOpen() {
	playArpeggio([330, 440, 554, 659, 880], 0.12, "sine", 0.18);
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
	game.clock.schedule(() => {
		osc.stop();
	}, 250);
	platformOsc = null;
	platformGain = null;
}
