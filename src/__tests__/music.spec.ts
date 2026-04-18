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
	it("playMenuMusic plays the menu track", async () => {
		const { playMenuMusic } = await import("@/audio/music");
		playMenuMusic();
		expect(latestAudio().src).toBe("menu-track.mp3");
		expect(latestAudio().volume).toBe(0.3);
		expect(latestAudio().loop).toBe(true);
		expect(mockPlay).toHaveBeenCalled();
	});

	it("playLevelMusic plays the level track", async () => {
		const { playLevelMusic } = await import("@/audio/music");
		playLevelMusic();
		expect(latestAudio().src).toBe("level-track.mp3");
		expect(latestAudio().volume).toBe(0.3);
	});

	it("playEndMusic plays the end track", async () => {
		const { playEndMusic } = await import("@/audio/music");
		playEndMusic();
		expect(latestAudio().src).toBe("end-track.mp3");
		expect(latestAudio().volume).toBe(0.3);
	});

	it("calling the same track function twice does not restart it", async () => {
		const { playMenuMusic } = await import("@/audio/music");
		playMenuMusic();
		playMenuMusic();
		expect(mockPlay).toHaveBeenCalledTimes(1);
		expect(capturedAudios).toHaveLength(1);
	});

	it("switching tracks stops the previous one", async () => {
		const { playMenuMusic, playLevelMusic } = await import("@/audio/music");
		playMenuMusic();
		playLevelMusic();
		expect(mockPause).toHaveBeenCalledTimes(1);
		expect(capturedAudios).toHaveLength(2);
		expect(latestAudio().src).toBe("level-track.mp3");
	});

	it("accepts a custom volume", async () => {
		const { playLevelMusic } = await import("@/audio/music");
		playLevelMusic(0.5);
		expect(latestAudio().volume).toBe(0.5);
	});

	it("stopMusic pauses and resets playback", async () => {
		const { playMenuMusic, stopMusic } = await import("@/audio/music");
		playMenuMusic();
		stopMusic();
		expect(mockPause).toHaveBeenCalled();
		expect(latestAudio().currentTime).toBe(0);
	});

	it("stopMusic does nothing if music was never started", async () => {
		const { stopMusic } = await import("@/audio/music");
		expect(() => stopMusic()).not.toThrow();
	});

	it("can restart a track after stopMusic", async () => {
		const { playMenuMusic, stopMusic } = await import("@/audio/music");
		playMenuMusic();
		stopMusic();
		playMenuMusic();
		expect(mockPlay).toHaveBeenCalledTimes(2);
	});

	it("registers a pointerdown listener if play is rejected", async () => {
		mockPlay = vi.fn().mockRejectedValue(new Error("autoplay blocked"));
		const mockAddEventListener = vi.fn();
		vi.stubGlobal("document", { addEventListener: mockAddEventListener });
		const { playMenuMusic } = await import("@/audio/music");
		playMenuMusic();
		await vi.waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalledWith(
				"pointerdown",
				expect.any(Function),
				{ once: true },
			);
		});
	});

	it("full lifecycle: menu → level → end", async () => {
		const { playMenuMusic, playLevelMusic, playEndMusic } =
			await import("@/audio/music");
		playMenuMusic();
		expect(latestAudio().src).toBe("menu-track.mp3");

		playLevelMusic();
		expect(mockPause).toHaveBeenCalledTimes(1);
		expect(latestAudio().src).toBe("level-track.mp3");

		playEndMusic();
		expect(mockPause).toHaveBeenCalledTimes(2);
		expect(latestAudio().src).toBe("end-track.mp3");
	});
});
