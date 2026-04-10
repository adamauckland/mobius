// Vitest global setup. The Web Audio API is unavailable under the `node`
// environment, so any code path that constructs an AudioContext (e.g. the
// retro-sfx helpers in src/audio/sounds.ts) blows up with `ReferenceError:
// AudioContext is not defined`. Provide a no-op stub so tests that touch
// gameplay code which incidentally plays a sound can still run.

import { vi } from "vitest";

class FakeAudioParam {
	value = 0;
	setValueAtTime = vi.fn();
	exponentialRampToValueAtTime = vi.fn();
	linearRampToValueAtTime = vi.fn();
}

class FakeOscillator {
	type = "sine";
	frequency = new FakeAudioParam();
	connect = vi.fn();
	disconnect = vi.fn();
	start = vi.fn();
	stop = vi.fn();
}

class FakeGain {
	gain = new FakeAudioParam();
	connect = vi.fn();
	disconnect = vi.fn();
}

class FakeAudioContext {
	currentTime = 0;
	destination = {};
	createOscillator() {
		return new FakeOscillator();
	}
	createGain() {
		return new FakeGain();
	}
}

(globalThis as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext =
	FakeAudioContext;
