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
		graphics = { use: vi.fn(), visible: true };
		actions = {
			clearActions: vi.fn(),
			getQueue: () => ({ hasNext: () => false }),
			easeTo: vi.fn().mockReturnThis(),
			callMethod: vi.fn().mockReturnThis(),
		};
		constructor(options?: any) {
			this.pos = options?.pos
				? new MockVector(options.pos.x, options.pos.y)
				: new MockVector();
		}
	}
	class MockTileMap {}
	return {
		Actor: MockActor,
		Vector: MockVector,
		TileMap: MockTileMap,
		EasingFunctions: { Linear: "linear" },
		Engine: class {},
	};
});

// Mock pathfinding plugin
const mockAstarPath: any[] = [];
const mockDijkstraPath: any[] = [];
vi.mock("@excaliburjs/plugin-pathfinding", () => {
	class MockExcaliburAStar {
		constructor(_tilemap: any) {}
		astar(_from: any, _to: any, _diag: boolean) {
			return mockAstarPath;
		}
		getNodeByIndex(idx: number) {
			return { id: idx };
		}
		duration = 1.5;
	}
	class MockExcaliburGraph {
		nodes = new Map();
		addTileMap(_map: any, _diag?: boolean) {
			// Populate nodes map
			for (let i = 0; i < 2500; i++) {
				this.nodes.set(`${i}`, { id: i });
			}
		}
		resetGraph() {
			this.nodes.clear();
		}
		shortestPath(_from: any, _to: any) {
			return mockDijkstraPath;
		}
		duration = 2.5;
	}
	return {
		ExcaliburAStar: MockExcaliburAStar,
		ExcaliburGraph: MockExcaliburGraph,
		GraphTileMap: class {},
		aStarNode: class {},
		GraphNode: class {},
	};
});

vi.mock("@/game", () => ({
	game: {
		clock: {
			schedule: vi.fn((_cb: any, _delay: any) => 0),
			clearSchedule: vi.fn(),
		},
		add: vi.fn(),
	},
}));

vi.mock("@/resources/resources", () => ({
	rlSS: { getSprite: vi.fn() },
	TileSheet: { getSprite: vi.fn() },
	playerWalkAnimation: {},
	playerImage: {},
}));

vi.mock("@/audio/sounds", () => ({
	sfxOneWayGate: vi.fn(),
	sfxPortal: vi.fn(),
	sfxPlatformStart: vi.fn(),
	sfxPlatformStop: vi.fn(),
	sfxCollect: vi.fn(),
	sfxPickUpRock: vi.fn(),
	sfxDropRock: vi.fn(),
	sfxPickUpParcel: vi.fn(),
	sfxDropParcel: vi.fn(),
	sfxParcelPlaced: vi.fn(),
	sfxSwitch: vi.fn(),
}));

vi.mock("@/entities/Light/lightTrail", () => ({
	spawnLight: vi.fn(),
	spawnScoreLight: vi.fn(),
	spawnCollectBurst: vi.fn(),
	spawnRewindPixels: vi.fn(),
}));

vi.mock("@/entities/MovingPlatform/movingPlatform", () => ({
	dismountBlock: vi.fn(() => true),
	getMovingBlockNear: vi.fn(),
	mountBlock: vi.fn(),
	resetMovingBlocks: vi.fn(),
}));

vi.mock("@/entities/Rock/rocks", () => ({
	getRockAtTile: vi.fn(),
	pickUpRock: vi.fn(),
	dropRock: vi.fn(),
	dropRockAtTile: vi.fn(),
	resetRocks: vi.fn(),
}));

vi.mock("@/entities/Parcel/Parcel", () => ({
	getParcelAtTile: vi.fn(),
	pickUpParcel: vi.fn(),
	dropParcel: vi.fn(),
	dropParcelAtTile: vi.fn(),
	resetParcels: vi.fn(),
}));

vi.mock("@/entities/Collectable/collectables", () => ({
	tryCollectAtTile: vi.fn(),
	addScore: vi.fn(),
	getScore: vi.fn(() => 0),
}));

vi.mock("@/entities/Barrier/barriers", () => ({}));

import {
	initPathfinding,
	handleTileClick,
	rebuildPathfinding,
	resetDijkstraGraph,
	findReachableTileNearTarget,
} from "@/ui/pathfinding";
import {
	tiles,
	Tree,
	Fence,
	Barrier,
	Grass,
	Void,
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	START_TILE_INDEX,
} from "@/tiles/tiledata";
import { setupTestWorld } from "@/__tests__/testWorld";
import { model } from "@/model";
import { dropParcel } from "@/entities/Parcel/Parcel";
import { dropRock, getRockAtTile } from "@/entities/Rock/rocks";

describe("pathfinding", () => {
	let mockTileMap: any;

	beforeEach(() => {
		vi.clearAllMocks();
		setupTestWorld();

		mockTileMap = {
			tiles: tiles.map((t) => ({ solid: t.collider })),
		};
		initPathfinding(mockTileMap);

		// Reset model state
		model.showWarning = false;
		model.inputDiagonal = true;
		model.inputAlgo = undefined;
		model.movesRemaining = 0;
		model.gameOver = false;
	});

	describe("initPathfinding", () => {
		it("does not throw", () => {
			expect(() => initPathfinding(mockTileMap)).not.toThrow();
		});
	});

	describe("rebuildPathfinding", () => {
		it("does not throw", () => {
			expect(() => rebuildPathfinding()).not.toThrow();
		});
	});

	describe("resetDijkstraGraph", () => {
		it("does not throw", () => {
			expect(() => resetDijkstraGraph()).not.toThrow();
		});
	});

	describe("findReachableTileNearTarget", () => {
		it("returns the target itself when it is passable", () => {
			// player at (4,0) → target at (10,0), both grass
			expect(findReachableTileNearTarget(4, 10)).toBe(10);
		});

		it("routes around blocked tiles to the closest reachable tile", () => {
			// Test world: indices 0=tree, 1=fence, 2=barrier (all blocked at row 0).
			// Player at (4,0)=index 4, target at (0,0)=index 0 (tree).
			// The closest reachable tile to (0,0) is (0,1)=index GRID_COLS,
			// reached by going down from row 0 and around the wall.
			expect(findReachableTileNearTarget(4, 0)).toBe(GRID_COLS);
		});

		it("treats void tiles as blocked and walks the player as close as possible", () => {
			// Drop a void tile at index 10 (col 10, row 0) and click it from
			// the player's spawn — the redirect should pick a passable neighbour.
			tiles[10] = new Void();
			const result = findReachableTileNearTarget(START_TILE_INDEX, 10);
			expect(result).not.toBeNull();
			expect(result).not.toBe(10);
			expect(tiles[result!].collider).toBe(false);
		});
	});

	describe("handleTileClick", () => {
		function createMockPlayer(tileIndex: number) {
			const x = (tileIndex % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
			const y = Math.floor(tileIndex / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
			return {
				pos: { x, y },
				ridingBlock: null,
				carriedRock: null,
				carriedParcel: null,
				onArriveAtTile: null,
				playerActionBuffer: [] as any[],
				logicalTileIndex: tileIndex,
				currentMoveTileIndex: tileIndex,
				actions: {
					getQueue: () => ({ hasNext: () => false }),
					clearActions: vi.fn(),
				},
			} as any;
		}

		it("redirects to nearest passable tile when clicking a tree tile", () => {
			const treeIdx = tiles.findIndex((t) => t instanceof Tree);
			if (treeIdx === -1) return;

			const player = createMockPlayer(START_TILE_INDEX);
			mockAstarPath.length = 0;
			mockAstarPath.push({ id: START_TILE_INDEX + 1 });
			handleTileClick(treeIdx, player);
			// Should not show a warning — it pathfinds to the nearest passable tile
			expect(model.showWarning).toBe(false);
		});

		it("redirects to nearest passable tile when clicking a fence tile", () => {
			const fenceIdx = tiles.findIndex((t) => t instanceof Fence);
			if (fenceIdx === -1) return;

			const player = createMockPlayer(START_TILE_INDEX);
			mockAstarPath.length = 0;
			mockAstarPath.push({ id: START_TILE_INDEX + 1 });
			handleTileClick(fenceIdx, player);
			expect(model.showWarning).toBe(false);
		});

		it("redirects to nearest passable tile when clicking a locked barrier", () => {
			const barrierIdx = tiles.findIndex(
				(t) => t instanceof Barrier && t.collider,
			);
			if (barrierIdx === -1) return;

			const player = createMockPlayer(START_TILE_INDEX);
			mockAstarPath.length = 0;
			mockAstarPath.push({ id: START_TILE_INDEX + 1 });
			handleTileClick(barrierIdx, player);
			expect(model.showWarning).toBe(false);
		});

		it("drops carried rock when clicking own tile", () => {
			const player = createMockPlayer(START_TILE_INDEX);
			player.carriedRock = {} as any;
			handleTileClick(START_TILE_INDEX, player);
			expect(dropRock).toHaveBeenCalledWith(player);
		});

		it("drops carried parcel when clicking own tile", () => {
			const player = createMockPlayer(START_TILE_INDEX);
			player.carriedParcel = {} as any;
			handleTileClick(START_TILE_INDEX, player);
			expect(dropParcel).toHaveBeenCalledWith(player);
		});

		it("does nothing when clicking same tile without carrying anything", () => {
			const player = createMockPlayer(START_TILE_INDEX);
			handleTileClick(START_TILE_INDEX, player);
			expect(player.playerActionBuffer).toEqual([]);
		});

		it("rejects out-of-bounds target tiles", () => {
			const player = createMockPlayer(START_TILE_INDEX);
			handleTileClick(-1, player);
			expect(player.playerActionBuffer).toEqual([]);
			handleTileClick(GRID_COLS * GRID_ROWS + 1, player);
			expect(player.playerActionBuffer).toEqual([]);
		});

		it("sets up arrival callback when rock is at target tile", () => {
			const targetTile = tiles.findIndex(
				(t, i) => t instanceof Grass && i !== START_TILE_INDEX,
			);
			if (targetTile === -1) return;

			(getRockAtTile as any).mockReturnValueOnce({ carriedBy: null });

			const player = createMockPlayer(START_TILE_INDEX);
			// Set up mock astar path
			mockAstarPath.length = 0;
			mockAstarPath.push({ id: targetTile });

			handleTileClick(targetTile, player);
			expect(player.onArriveAtTile).toBeTypeOf("function");
		});

		it("populates action buffer from astar path", () => {
			const targetTile = tiles.findIndex(
				(t, i) => t instanceof Grass && i !== START_TILE_INDEX,
			);
			if (targetTile === -1) return;

			const player = createMockPlayer(START_TILE_INDEX);
			mockAstarPath.length = 0;
			mockAstarPath.push({ id: START_TILE_INDEX + 1 }, { id: targetTile });

			handleTileClick(targetTile, player);
			expect(player.playerActionBuffer.length).toBeGreaterThan(0);
		});
	});
});
