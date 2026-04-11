import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock excalibur
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
	class MockActor {
		pos: MockVector;
		z = 0;
		scale = { x: 1, y: 1 };
		graphics = {
			use: vi.fn(),
			isVisible: true,
			onPreDraw: null,
			offset: { x: 0, y: 0 },
		};
		actions = {
			clearActions: vi.fn(),
			getQueue: () => ({ hasNext: () => false }),
			easeTo: vi.fn().mockReturnThis(),
			scaleTo: vi.fn().mockReturnThis(),
			callMethod: vi.fn().mockReturnThis(),
		};
		on = vi.fn();
		off = vi.fn();
		constructor(options?: any) {
			this.pos = options?.pos
				? new MockVector(options.pos.x, options.pos.y)
				: new MockVector();
			if (options?.width) this.width = options.width;
			if (options?.height) this.height = options.height;
		}
		width = 0;
		height = 0;
	}
	class MockCircle {}
	class MockPolygon {}
	class MockColor {
		static fromHex() {
			return new MockColor();
		}
	}
	class MockEngine {}
	return {
		Actor: MockActor,
		Vector: MockVector,
		Circle: MockCircle,
		Polygon: MockPolygon,
		Color: MockColor,
		Engine: MockEngine,
		EasingFunctions: { Linear: "linear" },
		ScreenElement: MockActor,
	};
});

vi.mock("../game", () => ({
	game: {
		add: vi.fn(),
		clock: {
			now: () => 0,
			schedule: vi.fn((_cb: any, _delay: any) => 0),
			clearSchedule: vi.fn(),
		},
		currentScene: {
			camera: { strategy: { radiusAroundActor: vi.fn() } },
			tileMaps: [],
		},
		drawWidth: 800,
		drawHeight: 600,
		input: { pointers: { primary: { on: vi.fn() } } },
	},
}));

vi.mock("../resources/resources", () => ({
	rlSS: { getSprite: vi.fn() },
	playerWalkAnimation: { kind: "walk" },
	playerImage: { kind: "idle" },
}));

vi.mock("../sounds", () => ({
	sfxOneWayGate: vi.fn(),
	sfxPortal: vi.fn(),
	sfxPlatformStart: vi.fn(),
	sfxPlatformStop: vi.fn(),
}));

vi.mock("../entities/lightTrail", () => ({
	spawnLight: vi.fn(),
	spawnScoreLight: vi.fn(),
}));

vi.mock("../pathfinding", () => ({
	handleTileClick: vi.fn(),
	rebuildPathfinding: vi.fn(),
	resetDijkstraGraph: vi.fn(),
	initPathfinding: vi.fn(),
}));

vi.mock("../entities/worldObjects", () => ({
	resetRocks: vi.fn(),
	resetParcels: vi.fn(),
	getRockAtTile: vi.fn(),
	pickUpRock: vi.fn(),
	dropRock: vi.fn(),
	getParcelAtTile: vi.fn(),
	pickUpParcel: vi.fn(),
	dropParcel: vi.fn(),
	dropRockAtTile: vi.fn(),
	dropParcelAtTile: vi.fn(),
	tryCollectAtTile: vi.fn(),
}));

vi.mock("../entities/monsters", () => ({
	resetMonsters: vi.fn(),
}));

vi.mock("../entities/barriers", () => ({
	resetBarriers: vi.fn(),
	tryActivateSwitch: vi.fn(),
}));

vi.mock("../entities/movingBlocks", () => ({
	resetMovingBlocks: vi.fn(),
	getMovingBlockNear: vi.fn(),
	mountBlock: vi.fn(),
}));

vi.mock("../events/GameEventBus", () => ({
	gameEventBus: {
		emit: vi.fn(),
		dispatch: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		startRecording: vi.fn(),
		stopRecording: vi.fn(() => []),
		replayEvents: vi.fn(),
		stopReplay: vi.fn(),
		reset: vi.fn(),
		isRecording: false,
	},
}));

vi.mock("../gameSetup", () => ({
	resetGameTimer: vi.fn(),
}));

import {
	playerEntries,
	activeEntry,
	replayAll,
	setupClickHandler,
} from "../entities/Player/playerManager";
import { model } from "../model";
import { START_POS_X, START_POS_Y, START_TILE_INDEX } from "../tiles/tiledata";
import { resetRocks, resetParcels } from "../entities/worldObjects";
import { resetMonsters } from "../entities/monsters";
import { resetBarriers } from "../entities/barriers";
import { resetMovingBlocks } from "../entities/movingBlocks";
import { game } from "../game";
import { gameEventBus } from "../events/GameEventBus";

describe("playerManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("entries", () => {
		it("starts with one player entry", () => {
			expect(playerEntries.length).toBeGreaterThanOrEqual(1);
		});

		it("each entry has player, recorder, recording, and spawnTileIndex", () => {
			const entry = playerEntries[0];
			expect(entry.player).toBeDefined();
			expect(entry.recorder).toBeDefined();
			expect(entry).toHaveProperty("recording");
			expect(entry).toHaveProperty("spawnTileIndex");
		});
	});

	describe("activeEntry", () => {
		it("returns the last entry in the array", () => {
			const active = activeEntry();
			expect(active).toBe(playerEntries[playerEntries.length - 1]);
		});
	});

	describe("replayAll", () => {
		it("sets model.isReplaying to true", () => {
			model.isReplaying = false;
			replayAll();
			expect(model.isReplaying).toBe(true);
		});

		it("resets all game subsystems", () => {
			replayAll();
			expect(resetRocks).toHaveBeenCalled();
			expect(resetParcels).toHaveBeenCalled();
			expect(resetBarriers).toHaveBeenCalled();
			expect(resetMovingBlocks).toHaveBeenCalled();
			expect(resetMonsters).toHaveBeenCalled();
		});

		it("resets each player to their own spawn position", () => {
			replayAll();
			for (const entry of playerEntries) {
				const idx = entry.spawnTileIndex;
				const expectedX = (idx % 50) * 16 + 8; // GRID_COLS=50, TILE_SIZE=16
				const expectedY = Math.floor(idx / 50) * 16 + 8;
				expect(entry.player.pos.x).toBe(expectedX);
				expect(entry.player.pos.y).toBe(expectedY);
				expect(entry.player.logicalTileIndex).toBe(idx);
				expect(entry.player.currentMoveTileIndex).toBe(idx);
				expect(entry.player.previousTileIndex).toBe(idx);
			}
		});

		it("clears player carried items", () => {
			playerEntries[0].player.carriedRock = {} as any;
			playerEntries[0].player.carriedParcel = {} as any;
			replayAll();
			expect(playerEntries[0].player.carriedRock).toBeNull();
			expect(playerEntries[0].player.carriedParcel).toBeNull();
		});

		it("clears player action buffers", () => {
			playerEntries[0].player.playerActionBuffer = [1, 2, 3];
			replayAll();
			expect(playerEntries[0].player.playerActionBuffer).toEqual([]);
		});

		it("makes all players visible", () => {
			playerEntries[0].player.graphics.isVisible = false;
			replayAll();
			expect(playerEntries[0].player.graphics.isVisible).toBe(true);
		});

		it("stops event bus replay before resetting", () => {
			replayAll();
			expect(gameEventBus.stopReplay).toHaveBeenCalled();
		});

		it("marks entries without recordings as not ghost", () => {
			replayAll();
			// The first (and only) entry has no recording, so should not be a ghost
			expect(playerEntries[0].player.isGhost).toBe(false);
		});
	});

	describe("setupClickHandler", () => {
		it("registers a pointer down event handler", () => {
			setupClickHandler();
			expect(game.input.pointers.primary.on).toHaveBeenCalledWith(
				"down",
				expect.any(Function),
			);
		});
	});
});
