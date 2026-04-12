import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
	class MockVector {
		x: number;
		y: number;
		constructor(x = 0, y = 0) {
			this.x = x;
			this.y = y;
		}
		clone() {
			return new MockVector(this.x, this.y);
		}
	}
	const vec = (x: number, y: number) => new MockVector(x, y);
	class MockActor {
		pos: MockVector;
		z = 0;
		scale = { x: 1, y: 1 };
		graphics = { use: vi.fn(), visible: true };
		actions = {
			clearActions: vi.fn().mockReturnThis(),
			scaleTo: vi.fn().mockReturnThis(),
			callMethod: vi.fn().mockReturnThis(),
		};
		constructor(options?: any) {
			this.pos = options?.pos
				? new MockVector(options.pos.x, options.pos.y)
				: new MockVector();
		}
	}
	return { Actor: MockActor, Vector: MockVector, vec, TileMap: class {} };
});

vi.mock("@/resources/resources", () => ({
	rlSS: { getSprite: vi.fn() },
}));

vi.mock("@/game", () => ({
	game: {
		add: vi.fn(),
		clock: {
			now: () => 0,
			schedule: vi.fn(),
			clearSchedule: vi.fn(),
		},
	},
}));

vi.mock("@/ui/zIndex", () => ({
	zFromY: (y: number, layer: number) => y * 10 + layer,
	Z_LAYER_TREE: 1,
	Z_LAYER_PICKUP: 2,
}));

vi.mock("@/ui/pathfinding", () => ({
	rebuildPathfinding: vi.fn(),
}));

vi.mock("@/entities/Light/lightTrail", () => ({
	spawnLight: vi.fn(),
	spawnScoreLight: vi.fn(),
	spawnCollectBurst: vi.fn(),
	spawnRewindPixels: vi.fn(),
}));

vi.mock("@/audio/sounds", () => ({
	sfxSwitch: vi.fn(),
}));

import {
	initBarriers,
	spawnBarriers,
	resetBarriers,
	setupBarrierEvents,
	teardownBarrierEvents,
} from "@/entities/Barrier/barriers";
import { tiles, Barrier, Switch } from "@/tiles/tiledata";
import { setupTestWorld } from "@/__tests__/testWorld";
import { rebuildPathfinding } from "@/ui/pathfinding";
import { game } from "@/game";
import { gameEventBus } from "@/events/GameEventBus";

describe("barriers", () => {
	let mockTileMap: any;

	beforeEach(() => {
		vi.clearAllMocks();
		setupTestWorld();
		teardownBarrierEvents();
		gameEventBus.reset();

		// Create a mock tilemap that mirrors the tiles array with a solid property
		mockTileMap = {
			tiles: tiles.map((t) => ({ solid: t.collider })),
		};
		initBarriers(mockTileMap);
		setupBarrierEvents();
	});

	describe("spawnBarriers", () => {
		it("creates actors for barrier and switch tiles", () => {
			spawnBarriers();
			// Should have called game.add for each barrier and switch tile
			const barrierCount = tiles.filter((t) => t instanceof Barrier).length;
			const switchCount = tiles.filter((t) => t instanceof Switch).length;
			expect(game.add).toHaveBeenCalledTimes(barrierCount + switchCount);
		});
	});

	describe("resetBarriers", () => {
		it("re-locks all barriers and resets switches", () => {
			spawnBarriers();
			const switchIdx = tiles.findIndex((t) => t instanceof Switch);
			if (switchIdx === -1) return;

			const switchTile = tiles[switchIdx] as Switch;
			const groupId = switchTile.groupId;
			gameEventBus.emit("switch:activate", { tileIndex: switchIdx });

			resetBarriers();

			// Switch should be deactivated
			expect(switchTile.activated).toBe(false);

			// Barriers should be re-locked
			for (const t of tiles) {
				if (t instanceof Barrier && t.groupId === groupId) {
					expect(t.collider).toBe(true);
				}
			}

			expect(rebuildPathfinding).toHaveBeenCalled();
		});
	});

	describe("event-driven activation", () => {
		it("switch:activate event triggers switch and barrier opening", () => {
			spawnBarriers();
			const switchIdx = tiles.findIndex((t) => t instanceof Switch);
			if (switchIdx === -1) return;

			const switchTile = tiles[switchIdx] as Switch;
			const groupId = switchTile.groupId;

			// Emit the event directly (simulating what a player would do)
			gameEventBus.emit("switch:activate", { tileIndex: switchIdx });

			expect(switchTile.activated).toBe(true);

			for (let i = 0; i < tiles.length; i++) {
				const t = tiles[i];
				if (t instanceof Barrier && t.groupId === groupId) {
					expect(t.collider).toBe(false);
				}
			}
		});

		it("dispatch also triggers handlers (for replay)", () => {
			spawnBarriers();
			const switchIdx = tiles.findIndex((t) => t instanceof Switch);
			if (switchIdx === -1) return;

			const switchTile = tiles[switchIdx] as Switch;

			// dispatch (used by replay) should also trigger the handler
			gameEventBus.dispatch("switch:activate", { tileIndex: switchIdx });

			expect(switchTile.activated).toBe(true);
		});

		it("switch:activate on non-switch tile is a no-op", () => {
			spawnBarriers();
			const grassIdx = tiles.findIndex(
				(t) => !(t instanceof Switch) && !(t instanceof Barrier),
			);

			// Should not throw
			gameEventBus.emit("switch:activate", { tileIndex: grassIdx });

			// Pathfinding should not have been rebuilt (no barrier opened)
			expect(rebuildPathfinding).not.toHaveBeenCalled();
		});

		it("emit records the event when recording is active", () => {
			spawnBarriers();
			const switchIdx = tiles.findIndex((t) => t instanceof Switch);
			if (switchIdx === -1) return;

			gameEventBus.startRecording();
			gameEventBus.emit("switch:activate", { tileIndex: switchIdx });
			const events = gameEventBus.stopRecording();

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("switch:activate");
			expect(events[0].data).toEqual({ tileIndex: switchIdx });
		});
	});
});
