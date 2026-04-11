import { describe, it, expect, vi, beforeEach } from "vitest";

let clockTime = 0;
const scheduledCallbacks: { cb: () => void; id: number; delay: number }[] = [];
let nextScheduleId = 1;

vi.mock("../game", () => ({
	game: {
		clock: {
			now: () => clockTime,
			schedule: (cb: () => void, delay: number) => {
				const id = nextScheduleId++;
				scheduledCallbacks.push({ cb, id, delay });
				return id;
			},
			clearSchedule: (id: number) => {
				const idx = scheduledCallbacks.findIndex((s) => s.id === id);
				if (idx !== -1) scheduledCallbacks.splice(idx, 1);
			},
		},
	},
}));

import { gameEventBus } from "@/events/GameEventBus";

describe("GameEventBus", () => {
	beforeEach(() => {
		clockTime = 0;
		scheduledCallbacks.length = 0;
		nextScheduleId = 1;
		gameEventBus.reset();
	});

	describe("on / emit / dispatch", () => {
		it("dispatches events to subscribed handlers via emit", () => {
			const handler = vi.fn();
			gameEventBus.on("switch:activate", handler);
			gameEventBus.emit("switch:activate", { tileIndex: 5 });
			expect(handler).toHaveBeenCalledWith({ tileIndex: 5 });
		});

		it("dispatches events to subscribed handlers via dispatch", () => {
			const handler = vi.fn();
			gameEventBus.on("barrier:open", handler);
			gameEventBus.dispatch("barrier:open", { groupId: 2 });
			expect(handler).toHaveBeenCalledWith({ groupId: 2 });
		});

		it("supports multiple handlers for the same event", () => {
			const h1 = vi.fn();
			const h2 = vi.fn();
			gameEventBus.on("switch:activate", h1);
			gameEventBus.on("switch:activate", h2);
			gameEventBus.emit("switch:activate", { tileIndex: 3 });
			expect(h1).toHaveBeenCalledOnce();
			expect(h2).toHaveBeenCalledOnce();
		});

		it("does not call handlers for other event types", () => {
			const handler = vi.fn();
			gameEventBus.on("barrier:open", handler);
			gameEventBus.emit("switch:activate", { tileIndex: 1 });
			expect(handler).not.toHaveBeenCalled();
		});

		it("does nothing when emitting with no subscribers", () => {
			expect(() =>
				gameEventBus.emit("switch:activate", { tileIndex: 0 }),
			).not.toThrow();
		});
	});

	describe("off", () => {
		it("removes a handler so it no longer receives events", () => {
			const handler = vi.fn();
			gameEventBus.on("switch:activate", handler);
			gameEventBus.off("switch:activate", handler);
			gameEventBus.emit("switch:activate", { tileIndex: 1 });
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("recording", () => {
		it("does not record when not recording", () => {
			gameEventBus.emit("switch:activate", { tileIndex: 1 });
			const events = gameEventBus.stopRecording();
			expect(events).toHaveLength(0);
		});

		it("records emitted events with correct timestamps", () => {
			clockTime = 100;
			gameEventBus.startRecording();

			clockTime = 200;
			gameEventBus.emit("switch:activate", { tileIndex: 5 });

			clockTime = 400;
			gameEventBus.emit("switch:activate", { tileIndex: 10 });

			const events = gameEventBus.stopRecording();
			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({
				timestamp: 100,
				type: "switch:activate",
				data: { tileIndex: 5 },
			});
			expect(events[1]).toEqual({
				timestamp: 300,
				type: "switch:activate",
				data: { tileIndex: 10 },
			});
		});

		it("dispatch does NOT record events", () => {
			gameEventBus.startRecording();
			gameEventBus.dispatch("barrier:open", { groupId: 1 });
			const events = gameEventBus.stopRecording();
			expect(events).toHaveLength(0);
		});

		it("stopRecording returns a copy", () => {
			gameEventBus.startRecording();
			gameEventBus.emit("switch:activate", { tileIndex: 1 });
			const events1 = gameEventBus.stopRecording();

			gameEventBus.startRecording();
			gameEventBus.emit("switch:activate", { tileIndex: 2 });
			const events2 = gameEventBus.stopRecording();

			expect(events1).toHaveLength(1);
			expect(events2).toHaveLength(1);
			expect(events1[0].data).toEqual({ tileIndex: 1 });
		});

		it("isRecording reflects state", () => {
			expect(gameEventBus.isRecording).toBe(false);
			gameEventBus.startRecording();
			expect(gameEventBus.isRecording).toBe(true);
			gameEventBus.stopRecording();
			expect(gameEventBus.isRecording).toBe(false);
		});
	});

	describe("replayEvents", () => {
		it("schedules events via game.clock.schedule", () => {
			const handler = vi.fn();
			gameEventBus.on("switch:activate", handler);

			gameEventBus.replayEvents([
				{ timestamp: 100, type: "switch:activate", data: { tileIndex: 5 } },
				{ timestamp: 300, type: "switch:activate", data: { tileIndex: 10 } },
			]);

			expect(scheduledCallbacks).toHaveLength(2);
			expect(scheduledCallbacks[0].delay).toBe(100);
			expect(scheduledCallbacks[1].delay).toBe(300);
		});

		it("replayed events dispatch to handlers when callbacks fire", () => {
			const handler = vi.fn();
			gameEventBus.on("switch:activate", handler);

			gameEventBus.replayEvents([
				{ timestamp: 100, type: "switch:activate", data: { tileIndex: 7 } },
			]);

			scheduledCallbacks[0].cb();
			expect(handler).toHaveBeenCalledWith({ tileIndex: 7 });
		});

		it("replayed events are NOT re-recorded", () => {
			gameEventBus.startRecording();

			gameEventBus.replayEvents([
				{ timestamp: 50, type: "switch:activate", data: { tileIndex: 3 } },
			]);

			// Fire the scheduled callback
			scheduledCallbacks[0].cb();

			const events = gameEventBus.stopRecording();
			// The replayed event should NOT appear in the recording
			expect(events).toHaveLength(0);
		});

		it("cascade events from replayed handlers are not recorded", () => {
			// Simulate: switch handler dispatches barrier:open
			gameEventBus.on("switch:activate", () => {
				gameEventBus.dispatch("barrier:open", { groupId: 1 });
			});
			const barrierHandler = vi.fn();
			gameEventBus.on("barrier:open", barrierHandler);

			gameEventBus.startRecording();

			gameEventBus.replayEvents([
				{ timestamp: 50, type: "switch:activate", data: { tileIndex: 3 } },
			]);
			scheduledCallbacks[0].cb();

			expect(barrierHandler).toHaveBeenCalledWith({ groupId: 1 });

			const events = gameEventBus.stopRecording();
			expect(events).toHaveLength(0);
		});
	});

	describe("stopReplay", () => {
		it("cancels all scheduled replay events", () => {
			gameEventBus.replayEvents([
				{ timestamp: 100, type: "switch:activate", data: { tileIndex: 1 } },
				{ timestamp: 200, type: "switch:activate", data: { tileIndex: 2 } },
			]);
			expect(scheduledCallbacks).toHaveLength(2);

			gameEventBus.stopReplay();
			expect(scheduledCallbacks).toHaveLength(0);
		});
	});

	describe("reset", () => {
		it("stops recording and clears replay schedules", () => {
			gameEventBus.startRecording();
			gameEventBus.replayEvents([
				{ timestamp: 100, type: "switch:activate", data: { tileIndex: 1 } },
			]);

			gameEventBus.reset();

			expect(gameEventBus.isRecording).toBe(false);
			expect(scheduledCallbacks).toHaveLength(0);
		});

		it("preserves listeners after reset", () => {
			const handler = vi.fn();
			gameEventBus.on("switch:activate", handler);

			gameEventBus.reset();

			gameEventBus.emit("switch:activate", { tileIndex: 1 });
			expect(handler).toHaveBeenCalled();
		});
	});
});
