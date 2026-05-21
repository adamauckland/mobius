import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/assets/music/This Trip Might Be Our Last v1.0.mp3", () => ({
	default: "menu-track.mp3",
}));
vi.mock("@/assets/music/The Speed Consumes Me v1.0.mp3", () => ({
	default: "level-track.mp3",
}));
vi.mock("@/assets/music/Hello There v1.0.mp3", () => ({
	default: "end-track.mp3",
}));

let mockPlay: ReturnType<typeof vi.fn>;
let mockPause: ReturnType<typeof vi.fn>;
let capturedAudios: Array<{
	src: string;
	loop: boolean;
	volume: number;
	muted: boolean;
	currentTime: number;
}>;

beforeEach(() => {
	mockPlay = vi.fn().mockResolvedValue(undefined);
	mockPause = vi.fn();
	capturedAudios = [];

	vi.stubGlobal(
		"Audio",
		class {
			src: string;
			loop = false;
			volume = 1;
			muted = false;
			currentTime = 0;
			play = mockPlay;
			pause = mockPause;
			constructor(src: string) {
				this.src = src;
				capturedAudios.push(this as any);
			}
		},
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

function latestAudio() {
	return capturedAudios[capturedAudios.length - 1];
}

describe("music", () => {
	it("playMenu plays the menu track", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		expect(latestAudio().src).toBe("menu-track.mp3");
		expect(latestAudio().volume).toBe(0.3);
		expect(latestAudio().loop).toBe(true);
		expect(mockPlay).toHaveBeenCalled();
	});

	it("playLevel plays the level track", async () => {
		const { music } = await import("@/audio/music");
		music.playLevel();
		expect(latestAudio().src).toBe("level-track.mp3");
		expect(latestAudio().volume).toBe(0.3);
	});

	it("playEnd plays the end track", async () => {
		const { music } = await import("@/audio/music");
		music.playEnd();
		expect(latestAudio().src).toBe("end-track.mp3");
		expect(latestAudio().volume).toBe(0.3);
	});

	it("is muted by default", async () => {
		const { music } = await import("@/audio/music");
		expect(music.isMuted()).toBe(true);
		music.playMenu();
		expect(latestAudio().muted).toBe(true);
	});

	it("setMuted(false) unmutes the current track", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		expect(latestAudio().muted).toBe(true);
		music.setMuted(false);
		expect(music.isMuted()).toBe(false);
		expect(latestAudio().muted).toBe(false);
	});

	it("tracks started after setMuted(false) play unmuted", async () => {
		const { music } = await import("@/audio/music");
		music.setMuted(false);
		music.playMenu();
		expect(latestAudio().muted).toBe(false);
	});

	it("setMuted(true) mutes the current track", async () => {
		const { music } = await import("@/audio/music");
		music.setMuted(false);
		music.playMenu();
		music.setMuted(true);
		expect(latestAudio().muted).toBe(true);
	});

	it("calling the same track function twice does not restart it", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		music.playMenu();
		expect(mockPlay).toHaveBeenCalledTimes(1);
		expect(capturedAudios).toHaveLength(1);
	});

	it("switching tracks stops the previous one", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		music.playLevel();
		expect(mockPause).toHaveBeenCalledTimes(1);
		expect(capturedAudios).toHaveLength(2);
		expect(latestAudio().src).toBe("level-track.mp3");
	});

	it("accepts a custom volume", async () => {
		const { music } = await import("@/audio/music");
		music.playLevel(0.5);
		expect(latestAudio().volume).toBe(0.5);
	});

	it("stop pauses and resets playback", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		music.stop();
		expect(mockPause).toHaveBeenCalled();
		expect(latestAudio().currentTime).toBe(0);
	});

	it("stop does nothing if music was never started", async () => {
		const { music } = await import("@/audio/music");
		expect(() => music.stop()).not.toThrow();
	});

	it("can restart a track after stop", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		music.stop();
		music.playMenu();
		expect(mockPlay).toHaveBeenCalledTimes(2);
	});

	it("registers a pointerdown listener if play is rejected", async () => {
		mockPlay = vi.fn().mockRejectedValue(new Error("autoplay blocked"));
		const mockAddEventListener = vi.fn();
		vi.stubGlobal("document", { addEventListener: mockAddEventListener });
		const { music } = await import("@/audio/music");
		music.playMenu();
		await vi.waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalledWith(
				"pointerdown",
				expect.any(Function),
				{ once: true },
			);
		});
	});

	it("full lifecycle: menu → level → end", async () => {
		const { music } = await import("@/audio/music");
		music.playMenu();
		expect(latestAudio().src).toBe("menu-track.mp3");

		music.playLevel();
		expect(mockPause).toHaveBeenCalledTimes(1);
		expect(latestAudio().src).toBe("level-track.mp3");

		music.playEnd();
		expect(mockPause).toHaveBeenCalledTimes(2);
		expect(latestAudio().src).toBe("end-track.mp3");
	});
});
