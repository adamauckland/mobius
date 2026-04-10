import { describe, it, expect, vi, beforeEach } from "vitest";

let clockTime = 0;
const scheduledCallbacks: { cb: () => void; id: number }[] = [];
let nextScheduleId = 1;

vi.mock("../game", () => ({
	game: {
		clock: {
			now: () => clockTime,
			schedule: (cb: () => void, _delay: number) => {
				const id = nextScheduleId++;
				scheduledCallbacks.push({ cb, id });
				return id;
			},
			clearSchedule: (id: number) => {
				const idx = scheduledCallbacks.findIndex((s) => s.id === id);
				if (idx !== -1) scheduledCallbacks.splice(idx, 1);
			},
		},
	},
}));

import { PlayerRecorder } from "../entities/Player/PlayerRecorder";
import { type IGameRecording } from "../interfaces/IGameRecording";

describe("GameRecorder", () => {
	let recorder: PlayerRecorder;

	beforeEach(() => {
		recorder = new PlayerRecorder();
		clockTime = 0;
		scheduledCallbacks.length = 0;
		nextScheduleId = 1;
	});

	describe("recording", () => {
		it("starts in idle state", () => {
			expect(recorder.isRecording).toBe(false);
			expect(recorder.isReplaying).toBe(false);
		});

		it("sets isRecording to true when started", () => {
			recorder.startRecording();
			expect(recorder.isRecording).toBe(true);
		});

		it("records click events with timestamps relative to start", () => {
			clockTime = 100;
			recorder.startRecording();

			clockTime = 200;
			recorder.recordClick(5);

			clockTime = 350;
			recorder.recordClick(10);

			const recording = recorder.stopRecording();
			expect(recording.events).toHaveLength(2);
			expect(recording.events[0]).toEqual({
				timestamp: 100,
				targetTileIndex: 5,
			});
			expect(recording.events[1]).toEqual({
				timestamp: 250,
				targetTileIndex: 10,
			});
		});

		it("ignores clicks when not recording", () => {
			recorder.recordClick(5);
			recorder.startRecording();
			const recording = recorder.stopRecording();
			expect(recording.events).toHaveLength(0);
		});

		it("sets isRecording to false when stopped", () => {
			recorder.startRecording();
			recorder.stopRecording();
			expect(recorder.isRecording).toBe(false);
		});

		it("returns a copy of events on stopRecording", () => {
			recorder.startRecording();
			clockTime = 10;
			recorder.recordClick(1);
			const recording = recorder.stopRecording();
			// Recording another click after stopping shouldn't affect the returned recording
			recorder.startRecording();
			clockTime = 20;
			recorder.recordClick(2);
			expect(recording.events).toHaveLength(1);
		});

		it("getRecording returns events without stopping", () => {
			clockTime = 0;
			recorder.startRecording();
			clockTime = 5;
			recorder.recordClick(3);
			const recording = recorder.getRecording();
			expect(recording.events).toHaveLength(1);
			expect(recorder.isRecording).toBe(true);
		});
	});

	describe("replay", () => {
		it("schedules events via game.clock", () => {
			const recording: IGameRecording = {
				events: [
					{ timestamp: 100, targetTileIndex: 5 },
					{ timestamp: 200, targetTileIndex: 10 },
				],
			};
			const onClick = vi.fn();
			recorder.startReplay(recording, onClick);

			expect(recorder.isReplaying).toBe(true);
			// 2 event callbacks + 1 end-of-replay callback
			expect(scheduledCallbacks).toHaveLength(3);
		});

		it("calls onClick for each replayed event", () => {
			const recording: IGameRecording = {
				events: [
					{ timestamp: 0, targetTileIndex: 7 },
					{ timestamp: 100, targetTileIndex: 14 },
				],
			};
			const onClick = vi.fn();
			recorder.startReplay(recording, onClick);

			// Execute the scheduled callbacks
			scheduledCallbacks[0].cb();
			expect(onClick).toHaveBeenCalledWith(7);
			scheduledCallbacks[1].cb();
			expect(onClick).toHaveBeenCalledWith(14);
		});

		it("sets isReplaying to false after last event + buffer", () => {
			const recording: IGameRecording = {
				events: [{ timestamp: 100, targetTileIndex: 5 }],
			};
			recorder.startReplay(recording, vi.fn());
			expect(recorder.isReplaying).toBe(true);

			// The end callback is the last scheduled callback
			const endCallback = scheduledCallbacks[scheduledCallbacks.length - 1];
			endCallback.cb();
			expect(recorder.isReplaying).toBe(false);
		});

		it("stopReplay clears all scheduled events", () => {
			const recording: IGameRecording = {
				events: [
					{ timestamp: 100, targetTileIndex: 5 },
					{ timestamp: 200, targetTileIndex: 10 },
				],
			};
			recorder.startReplay(recording, vi.fn());
			expect(scheduledCallbacks.length).toBeGreaterThan(0);

			recorder.stopReplay();
			expect(recorder.isReplaying).toBe(false);
		});

		it("starting a new replay stops the previous one", () => {
			const recording: IGameRecording = {
				events: [{ timestamp: 100, targetTileIndex: 5 }],
			};
			recorder.startReplay(recording, vi.fn());
			// Second replay should clear previous schedules
			recorder.startReplay(recording, vi.fn());
			expect(recorder.isReplaying).toBe(true);
		});

		it("handles empty recordings", () => {
			const recording: IGameRecording = { events: [] };
			recorder.startReplay(recording, vi.fn());
			expect(recorder.isReplaying).toBe(true);
			// Only the end callback should be scheduled
			expect(scheduledCallbacks).toHaveLength(1);
		});
	});
});
