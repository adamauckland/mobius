import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("excalibur", () => ({}));
vi.mock("../game", () => ({
	game: {
		clock: {
			schedule: (fn: () => void, _delay: number) => fn(),
		},
	},
}));

// Mock AudioContext and its nodes
function createMockOscillator() {
	return {
		type: "sine",
		frequency: {
			value: 0,
			setValueAtTime: vi.fn(),
			exponentialRampToValueAtTime: vi.fn(),
		},
		connect: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	};
}

function createMockGain() {
	return {
		gain: {
			value: 0,
			setValueAtTime: vi.fn(),
			exponentialRampToValueAtTime: vi.fn(),
		},
		connect: vi.fn(),
	};
}

function createMockBiquadFilter() {
	return {
		type: "lowpass",
		frequency: { value: 350 },
		Q: { value: 1 },
		connect: vi.fn(),
	};
}

function createMockBuffer(channels: number, length: number) {
	const data = new Float32Array(length);
	return { getChannelData: (_ch: number) => data, numberOfChannels: channels };
}

function createMockBufferSource() {
	return {
		buffer: null as any,
		connect: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	};
}

const mockDestination = {};
let mockOscillators: ReturnType<typeof createMockOscillator>[];
let mockGains: ReturnType<typeof createMockGain>[];
let mockBufferSources: ReturnType<typeof createMockBufferSource>[];
let mockFilters: ReturnType<typeof createMockBiquadFilter>[];

beforeEach(() => {
	mockOscillators = [];
	mockGains = [];
	mockBufferSources = [];
	mockFilters = [];
	vi.useFakeTimers();

	// Use a proper class so `new AudioContext()` works
	(globalThis as any).AudioContext = class MockAudioContext {
		currentTime = 0;
		sampleRate = 44100;
		destination = mockDestination;
		createOscillator() {
			const osc = createMockOscillator();
			mockOscillators.push(osc);
			return osc;
		}
		createGain() {
			const gain = createMockGain();
			mockGains.push(gain);
			return gain;
		}
		createBuffer(channels: number, length: number, _sampleRate: number) {
			return createMockBuffer(channels, length);
		}
		createBufferSource() {
			const src = createMockBufferSource();
			mockBufferSources.push(src);
			return src;
		}
		createBiquadFilter() {
			const f = createMockBiquadFilter();
			mockFilters.push(f);
			return f;
		}
	};
});

afterEach(() => {
	vi.useRealTimers();
	delete (globalThis as any).AudioContext;
	vi.resetModules();
});

describe("sound effects", () => {
	it("sfxCollect creates a white-noise burst with filter", async () => {
		const { sfxCollect } = await import("@/audio/sounds");
		sfxCollect();
		expect(mockBufferSources).toHaveLength(1);
		expect(mockBufferSources[0].start).toHaveBeenCalled();
		expect(mockFilters).toHaveLength(1);
		expect(mockFilters[0].type).toBe("bandpass");
	});

	it("sfxPickUpRock creates a single tone", async () => {
		const { sfxPickUpRock } = await import("@/audio/sounds");
		sfxPickUpRock();
		expect(mockOscillators).toHaveLength(1);
		expect(mockOscillators[0].frequency.value).toBe(220);
		expect(mockOscillators[0].type).toBe("triangle");
	});

	it("sfxDropRock creates a single tone", async () => {
		const { sfxDropRock } = await import("@/audio/sounds");
		sfxDropRock();
		expect(mockOscillators).toHaveLength(1);
		expect(mockOscillators[0].frequency.value).toBe(150);
	});

	it("sfxPickUpParcel plays an arpeggio", async () => {
		const { sfxPickUpParcel } = await import("@/audio/sounds");
		sfxPickUpParcel();
		vi.advanceTimersByTime(200);
		expect(mockOscillators).toHaveLength(2);
	});

	it("sfxDropParcel plays a single tone", async () => {
		const { sfxDropParcel } = await import("@/audio/sounds");
		sfxDropParcel();
		expect(mockOscillators).toHaveLength(1);
	});

	it("sfxParcelPlaced plays a 4-note arpeggio", async () => {
		const { sfxParcelPlaced } = await import("@/audio/sounds");
		sfxParcelPlaced();
		vi.advanceTimersByTime(500);
		expect(mockOscillators).toHaveLength(4);
	});

	it("sfxSwitch plays a 2-note arpeggio", async () => {
		const { sfxSwitch } = await import("@/audio/sounds");
		sfxSwitch();
		vi.advanceTimersByTime(200);
		expect(mockOscillators).toHaveLength(2);
	});

	it("sfxOneWayGate plays a sawtooth tone", async () => {
		const { sfxOneWayGate } = await import("@/audio/sounds");
		sfxOneWayGate();
		expect(mockOscillators).toHaveLength(1);
		expect(mockOscillators[0].type).toBe("sawtooth");
	});

	it("sfxDeath plays a descending 4-note arpeggio", async () => {
		const { sfxDeath } = await import("@/audio/sounds");
		sfxDeath();
		vi.advanceTimersByTime(500);
		expect(mockOscillators).toHaveLength(4);
	});

	it("sfxCritterFlee plays a descending 2-note arpeggio", async () => {
		const { sfxCritterFlee } = await import("@/audio/sounds");
		sfxCritterFlee();
		vi.advanceTimersByTime(200);
		expect(mockOscillators).toHaveLength(2);
		expect(mockOscillators[0].type).toBe("triangle");
	});

	it("sfxPortal creates a frequency sweep", async () => {
		const { sfxPortal } = await import("@/audio/sounds");
		sfxPortal();
		expect(mockOscillators).toHaveLength(1);
		expect(mockOscillators[0].type).toBe("sine");
		expect(mockOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
			200,
			0,
		);
		expect(
			mockOscillators[0].frequency.exponentialRampToValueAtTime,
		).toHaveBeenCalled();
	});

	it("sfxPlatformStart creates a looping sine oscillator", async () => {
		const { sfxPlatformStart } = await import("@/audio/sounds");
		sfxPlatformStart();
		expect(mockOscillators).toHaveLength(1);
		expect(mockOscillators[0].type).toBe("sine");
		expect(mockOscillators[0].frequency.value).toBe(80);
		expect(mockOscillators[0].start).toHaveBeenCalled();
		expect(mockOscillators[0].stop).not.toHaveBeenCalled();
	});

	it("sfxPlatformStart does not create a second oscillator if already playing", async () => {
		const { sfxPlatformStart } = await import("@/audio/sounds");
		sfxPlatformStart();
		sfxPlatformStart();
		expect(mockOscillators).toHaveLength(1);
	});

	it("sfxPlatformStop fades out and stops the oscillator", async () => {
		const { sfxPlatformStart, sfxPlatformStop } =
			await import("@/audio/sounds");
		sfxPlatformStart();
		sfxPlatformStop();
		expect(mockGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(mockOscillators[0].stop).toHaveBeenCalled();
	});

	it("sfxPlatformStop does nothing if no oscillator is playing", async () => {
		const { sfxPlatformStop } = await import("@/audio/sounds");
		expect(() => sfxPlatformStop()).not.toThrow();
	});

	it("oscillators connect to gain nodes which connect to destination", async () => {
		const { sfxPickUpRock } = await import("@/audio/sounds");
		sfxPickUpRock();
		expect(mockOscillators[0].connect).toHaveBeenCalledWith(mockGains[0]);
		expect(mockGains[0].connect).toHaveBeenCalledWith(mockDestination);
	});

	it("sfxLevelComplete plays a 4-note arpeggio", async () => {
		const { sfxLevelComplete } = await import("@/audio/sounds");
		sfxLevelComplete();
		vi.advanceTimersByTime(500);
		expect(mockOscillators).toHaveLength(4);
	});

	it("sfxHeartbeat creates two beats (lub and dub)", async () => {
		const { sfxHeartbeat } = await import("@/audio/sounds");
		sfxHeartbeat();
		expect(mockOscillators).toHaveLength(2);
		expect(mockOscillators[0].frequency.value).toBe(55);
		expect(mockOscillators[1].frequency.value).toBe(45);
	});

	it("sfxCountdownTick plays a single tone", async () => {
		const { sfxCountdownTick } = await import("@/audio/sounds");
		sfxCountdownTick();
		expect(mockOscillators).toHaveLength(1);
		expect(mockOscillators[0].frequency.value).toBe(220);
		expect(mockOscillators[0].type).toBe("square");
	});

	it("sfxCountdownGo plays a 3-note arpeggio", async () => {
		const { sfxCountdownGo } = await import("@/audio/sounds");
		sfxCountdownGo();
		vi.advanceTimersByTime(300);
		expect(mockOscillators).toHaveLength(3);
	});

	it("sfxExitDoorOpen plays a 5-note arpeggio", async () => {
		const { sfxExitDoorOpen } = await import("@/audio/sounds");
		sfxExitDoorOpen();
		vi.advanceTimersByTime(500);
		expect(mockOscillators).toHaveLength(5);
	});
});
