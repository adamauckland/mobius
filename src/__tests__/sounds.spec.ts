import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const mockDestination = {};
let mockOscillators: ReturnType<typeof createMockOscillator>[];
let mockGains: ReturnType<typeof createMockGain>[];

beforeEach(() => {
  mockOscillators = [];
  mockGains = [];
  vi.useFakeTimers();

  // Use a proper class so `new AudioContext()` works
  (globalThis as any).AudioContext = class MockAudioContext {
    currentTime = 0;
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
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).AudioContext;
  vi.resetModules();
});

describe("sound effects", () => {
  it("sfxCollect creates oscillators for an arpeggio", async () => {
    const { sfxCollect } = await import("../sounds");
    sfxCollect();
    // playArpeggio uses game.clock.schedule even for the first note (delay 0)
    vi.advanceTimersByTime(0);
    expect(mockOscillators.length).toBeGreaterThanOrEqual(1);
    expect(mockOscillators[0].start).toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(mockOscillators).toHaveLength(3);
  });

  it("sfxPickUpRock creates a single tone", async () => {
    const { sfxPickUpRock } = await import("../sounds");
    sfxPickUpRock();
    expect(mockOscillators).toHaveLength(1);
    expect(mockOscillators[0].frequency.value).toBe(220);
    expect(mockOscillators[0].type).toBe("triangle");
  });

  it("sfxDropRock creates a single tone", async () => {
    const { sfxDropRock } = await import("../sounds");
    sfxDropRock();
    expect(mockOscillators).toHaveLength(1);
    expect(mockOscillators[0].frequency.value).toBe(150);
  });

  it("sfxPickUpParcel plays an arpeggio", async () => {
    const { sfxPickUpParcel } = await import("../sounds");
    sfxPickUpParcel();
    vi.advanceTimersByTime(200);
    expect(mockOscillators).toHaveLength(2);
  });

  it("sfxDropParcel plays a single tone", async () => {
    const { sfxDropParcel } = await import("../sounds");
    sfxDropParcel();
    expect(mockOscillators).toHaveLength(1);
  });

  it("sfxParcelPlaced plays a 4-note arpeggio", async () => {
    const { sfxParcelPlaced } = await import("../sounds");
    sfxParcelPlaced();
    vi.advanceTimersByTime(500);
    expect(mockOscillators).toHaveLength(4);
  });

  it("sfxSwitch plays a 2-note arpeggio", async () => {
    const { sfxSwitch } = await import("../sounds");
    sfxSwitch();
    vi.advanceTimersByTime(200);
    expect(mockOscillators).toHaveLength(2);
  });

  it("sfxOneWayGate plays a sawtooth tone", async () => {
    const { sfxOneWayGate } = await import("../sounds");
    sfxOneWayGate();
    expect(mockOscillators).toHaveLength(1);
    expect(mockOscillators[0].type).toBe("sawtooth");
  });

  it("sfxDeath plays a descending 4-note arpeggio", async () => {
    const { sfxDeath } = await import("../sounds");
    sfxDeath();
    vi.advanceTimersByTime(500);
    expect(mockOscillators).toHaveLength(4);
  });

  it("sfxPortal creates a frequency sweep", async () => {
    const { sfxPortal } = await import("../sounds");
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
    const { sfxPlatformStart } = await import("../sounds");
    sfxPlatformStart();
    expect(mockOscillators).toHaveLength(1);
    expect(mockOscillators[0].type).toBe("sine");
    expect(mockOscillators[0].frequency.value).toBe(80);
    expect(mockOscillators[0].start).toHaveBeenCalled();
    expect(mockOscillators[0].stop).not.toHaveBeenCalled();
  });

  it("sfxPlatformStart does not create a second oscillator if already playing", async () => {
    const { sfxPlatformStart } = await import("../sounds");
    sfxPlatformStart();
    sfxPlatformStart();
    expect(mockOscillators).toHaveLength(1);
  });

  it("sfxPlatformStop fades out and stops the oscillator", async () => {
    const { sfxPlatformStart, sfxPlatformStop } = await import("../sounds");
    sfxPlatformStart();
    sfxPlatformStop();
    expect(mockGains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(mockOscillators[0].stop).toHaveBeenCalled();
  });

  it("sfxPlatformStop does nothing if no oscillator is playing", async () => {
    const { sfxPlatformStop } = await import("../sounds");
    expect(() => sfxPlatformStop()).not.toThrow();
  });

  it("oscillators connect to gain nodes which connect to destination", async () => {
    const { sfxPickUpRock } = await import("../sounds");
    sfxPickUpRock();
    expect(mockOscillators[0].connect).toHaveBeenCalledWith(mockGains[0]);
    expect(mockGains[0].connect).toHaveBeenCalledWith(mockDestination);
  });
});
