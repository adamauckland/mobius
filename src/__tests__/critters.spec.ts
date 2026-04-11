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

	class MockCircle {
		radius: number;
		color: any;
		constructor(options?: any) {
			this.radius = options?.radius ?? 0;
			this.color = options?.color ?? null;
		}
	}

	class MockColor {
		static fromHex(_hex: string) {
			return {};
		}
		static fromRGB(_r: number, _g: number, _b: number, _a?: number) {
			return {};
		}
	}

	class MockActor {
		pos: MockVector;
		width = 0;
		height = 0;
		z = 0;
		scale = { x: 1, y: 1 };
		private _killed = false;
		graphics = {
			use: vi.fn(),
			visible: true,
			isVisible: true,
			onPreDraw: null,
			offset: { x: 0, y: 0 },
		};
		constructor(options?: any) {
			this.pos = options?.pos
				? new MockVector(options.pos.x, options.pos.y)
				: new MockVector();
		}
		kill() {
			this._killed = true;
		}
		isKilled() {
			return this._killed;
		}
	}
	class MockGraphicsGroup {
		members: any[];
		constructor(options?: any) {
			this.members = options?.members ?? [];
		}
	}

	function mockVec(x: number, y: number) {
		return new MockVector(x, y);
	}

	return {
		Actor: MockActor,
		Vector: MockVector,
		Circle: MockCircle,
		Color: MockColor,
		GraphicsGroup: MockGraphicsGroup,
		vec: mockVec,
	};
});

vi.mock("../resources/resources", () => ({
	rlSS: { getSprite: vi.fn() },
}));

vi.mock("../game", () => ({
	game: {
		add: vi.fn(),
		clock: {
			now: () => 0,
			schedule: vi.fn((_cb: any, _delay: any) => 0),
			clearSchedule: vi.fn(),
		},
	},
}));

vi.mock("../ui/zIndex", () => ({
	zFromY: (y: number, layer: number) => y * 10 + layer,
	Z_LAYER_SHADOW: 0,
	Z_LAYER_PICKUP: 4,
	Z_LAYER_ROCK: 5,
}));

vi.mock("../audio/sounds", () => ({
	sfxCollect: vi.fn(),
	sfxCritterFlee: vi.fn(),
	sfxPickUpRock: vi.fn(),
	sfxDropRock: vi.fn(),
	sfxPickUpParcel: vi.fn(),
	sfxDropParcel: vi.fn(),
	sfxParcelPlaced: vi.fn(),
}));

vi.mock("../entities/lightTrail", () => ({
	spawnLight: vi.fn(),
	spawnScoreLight: vi.fn(),
	spawnCollectBurst: vi.fn(),
}));

vi.mock("../entities/Player/PlayerActor", () => ({
	Player: class {},
	player: { pos: { x: 0, y: 0 }, graphics: { isVisible: true } },
}));

vi.mock("../ui/pathfinding", () => ({
	handleTileClick: vi.fn(),
	rebuildPathfinding: vi.fn(),
}));

import { sfxCritterFlee } from "@/audio/sounds";
import { spawnCollectBurst } from "@/entities/lightTrail";
import { updateCritters, resetCritters } from "@/entities/Critter/critters";
import {
	tryCollectCritters,
	setOnAllCrittersCollected,
	resetAllCrittersCollectedFlag,
} from "@/entities/Critter/collection";
import { spawnCritterGroupsAt } from "@/entities/Critter/spawn";
import {
	getCritterGroups,
	getCritterCount,
	clearCritters,
} from "@/entities/Critter/state";
import { playerEntries } from "@/entities/Player/playerManager";
import { TILE_SIZE, GRID_COLS, tiles, Fence } from "@/tiles/tiledata";
import { setupTestWorld } from "@/__tests__/testWorld";

describe("critters", () => {
	beforeEach(() => {
		setupTestWorld();
		clearCritters();
		// Reset playerEntries to a single mock player
		playerEntries.length = 0;
		playerEntries.push({
			player: {
				pos: { x: 0, y: 0 },
				graphics: { isVisible: true },
			} as any,
			recorder: { stopReplay: vi.fn() } as any,
			recording: null,
		});
	});

	describe("spawnCritterGroupsAt", () => {
		it("creates a group of 5 critters at a tile index", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			expect(groups.length).toBeGreaterThanOrEqual(1);
			const group = groups[groups.length - 1];
			expect(group.critters).toHaveLength(5);
			expect(group.originTile).toBe(100);
		});

		it("places critters near the tile center", () => {
			spawnCritterGroupsAt([55]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const cx = (55 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
			const cy = Math.floor(55 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
			for (const critter of group.critters) {
				expect(Math.abs(critter.position.x - cx)).toBeLessThan(TILE_SIZE);
				expect(Math.abs(critter.position.y - cy)).toBeLessThan(TILE_SIZE);
			}
		});

		it("spawns multiple groups", () => {
			const before = getCritterGroups().length;
			spawnCritterGroupsAt([10, 20, 30]);
			expect(getCritterGroups().length).toBe(before + 3);
		});
	});

	describe("getCritterCount", () => {
		it("returns total and collected counts", () => {
			spawnCritterGroupsAt([150]);
			const count = getCritterCount();
			expect(count.total).toBeGreaterThanOrEqual(5);
			expect(count.collected).toBe(0);
		});
	});

	describe("updateCritters", () => {
		it("does not throw with no groups", () => {
			expect(() => updateCritters(16)).not.toThrow();
		});

		it("moves critters away from a nearby player", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Place player right on top of the critter
			const px = critter.position.x;
			playerEntries[0].player.pos.x = px;
			playerEntries[0].player.pos.y = critter.position.y;

			const origX = critter.position.x;
			// Simulate a few frames
			for (let i = 0; i < 10; i++) {
				updateCritters(16);
			}
			// Critter should have moved away
			expect(critter.position.x).not.toBeCloseTo(origX, 0);
		});

		it("does not move critters through a fence tile", () => {
			// Tile index 1 is a Fence in the test world
			expect(tiles[1]).toBeInstanceOf(Fence);
			// Spawn critters at tile 2 (just right of the fence at index 1)
			spawnCritterGroupsAt([2]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Place player to the right to push critter left toward the fence
			playerEntries[0].player.pos.x = critter.position.x + TILE_SIZE;
			playerEntries[0].player.pos.y = critter.position.y;

			const fenceLeftEdge = (1 % GRID_COLS) * TILE_SIZE;
			const fenceRightEdge = fenceLeftEdge + TILE_SIZE;

			for (let i = 0; i < 100; i++) {
				updateCritters(16);
			}

			// Critter should not have entered the fence tile
			for (const c of group.critters) {
				// Critter center should stay to the right of the fence tile
				expect(c.position.x).toBeGreaterThanOrEqual(fenceRightEdge - 1);
			}
		});

		it("does not get stuck oscillating when fleeing into a wall", () => {
			// Tile index 1 is a Fence in the test world
			expect(tiles[1]).toBeInstanceOf(Fence);
			// Spawn critters at tile 2 (just right of the fence)
			spawnCritterGroupsAt([2]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Place player to the right so critter flees left into the fence
			playerEntries[0].player.pos.x = critter.position.x + TILE_SIZE;
			playerEntries[0].player.pos.y = critter.position.y;

			// Run many frames to let the situation stabilise
			for (let i = 0; i < 200; i++) {
				updateCritters(16);
			}

			// Sample position over several frames — it should not be oscillating
			const samples: number[] = [];
			for (let i = 0; i < 10; i++) {
				updateCritters(16);
				samples.push(critter.position.x);
			}

			const minX = Math.min(...samples);
			const maxX = Math.max(...samples);
			// Position should be stable (not bouncing back and forth)
			expect(maxX - minX).toBeLessThan(2);
		});

		it("plays flee sound when critter starts fleeing", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Place player right on top of the critter to trigger flee
			playerEntries[0].player.pos.x = critter.position.x;
			playerEntries[0].player.pos.y = critter.position.y;

			updateCritters(16);
			expect(sfxCritterFlee).toHaveBeenCalled();
		});

		it("does not replay flee sound if already fleeing", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			playerEntries[0].player.pos.x = critter.position.x;
			playerEntries[0].player.pos.y = critter.position.y;

			updateCritters(16);
			(sfxCritterFlee as ReturnType<typeof vi.fn>).mockClear();

			// Keep player nearby — critter is still fleeing
			playerEntries[0].player.pos.x = critter.position.x;
			playerEntries[0].player.pos.y = critter.position.y;
			updateCritters(16);

			// Sound should not play again since critter was already fleeing
			expect(sfxCritterFlee).not.toHaveBeenCalled();
		});

		it("keeps critters within world bounds", () => {
			spawnCritterGroupsAt([0]); // top-left corner
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];

			// Push player into the critters to force them to the edge
			playerEntries[0].player.pos.x = group.critters[0].position.x;
			playerEntries[0].player.pos.y = group.critters[0].position.y;

			for (let i = 0; i < 100; i++) {
				updateCritters(16);
			}

			for (const critter of group.critters) {
				expect(critter.position.x).toBeGreaterThanOrEqual(0);
				expect(critter.position.y).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("tryCollectCritters", () => {
		it("collects critters within range of a player", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Move player directly on top of this critter
			playerEntries[0].player.pos.x = critter.position.x;
			playerEntries[0].player.pos.y = critter.position.y;

			const collected = tryCollectCritters();
			expect(collected).toBeGreaterThanOrEqual(1);
			expect(critter.collected).toBe(true);
		});

		it("does not collect critters far from any player", () => {
			spawnCritterGroupsAt([100]);
			// Player is at (0, 0), critters are at tile 100 which is far away
			playerEntries[0].player.pos.x = 0;
			playerEntries[0].player.pos.y = 0;

			const collected = tryCollectCritters();
			expect(collected).toBe(0);
		});

		it("spawns collect burst effect toward player on collection", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			playerEntries[0].player.pos.x = critter.position.x;
			playerEntries[0].player.pos.y = critter.position.y;

			tryCollectCritters();
			expect(spawnCollectBurst).toHaveBeenCalled();
		});

		it("does not collect already-collected critters", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Collect it once
			playerEntries[0].player.pos.x = critter.position.x;
			playerEntries[0].player.pos.y = critter.position.y;
			tryCollectCritters();

			// Try again — should not count again
			tryCollectCritters();
			expect(critter.collected).toBe(true);
		});
	});

	describe("setOnAllCrittersCollected", () => {
		it("fires callback when all critters are collected", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];

			const callback = vi.fn();
			setOnAllCrittersCollected(callback);

			// Place player on each critter and collect them all
			for (const critter of group.critters) {
				playerEntries[0].player.pos.x = critter.position.x;
				playerEntries[0].player.pos.y = critter.position.y;
				tryCollectCritters();
			}

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("does not fire callback when only some critters are collected", () => {
			// Two groups — collecting one group leaves the other uncollected
			spawnCritterGroupsAt([100, 200]);

			const callback = vi.fn();
			setOnAllCrittersCollected(callback);

			// Collect only the first group
			const groups = getCritterGroups();
			const firstGroup = groups[groups.length - 2];
			for (const critter of firstGroup.critters) {
				playerEntries[0].player.pos.x = critter.position.x;
				playerEntries[0].player.pos.y = critter.position.y;
				tryCollectCritters();
			}

			expect(callback).not.toHaveBeenCalled();
		});

		it("does not fire callback twice without reset", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];

			const callback = vi.fn();
			setOnAllCrittersCollected(callback);

			// Collect all
			for (const critter of group.critters) {
				playerEntries[0].player.pos.x = critter.position.x;
				playerEntries[0].player.pos.y = critter.position.y;
				tryCollectCritters();
			}

			expect(callback).toHaveBeenCalledTimes(1);

			// Call again — should not fire again
			tryCollectCritters();
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("fires again after resetAllCrittersCollectedFlag", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];

			const callback = vi.fn();
			setOnAllCrittersCollected(callback);

			// Collect all
			for (const critter of group.critters) {
				playerEntries[0].player.pos.x = critter.position.x;
				playerEntries[0].player.pos.y = critter.position.y;
				tryCollectCritters();
			}
			expect(callback).toHaveBeenCalledTimes(1);

			// Reset flag and re-collect (simulate rewind then re-collect)
			resetAllCrittersCollectedFlag();
			// Mark all as collected again directly (simulating re-collection)
			for (const critter of group.critters) {
				critter.collected = true;
			}
			// Spawn a fresh group so tryCollectCritters can collect something new
			spawnCritterGroupsAt([100]);
			const newGroup = getCritterGroups()[getCritterGroups().length - 1];
			for (const critter of newGroup.critters) {
				playerEntries[0].player.pos.x = critter.position.x;
				playerEntries[0].player.pos.y = critter.position.y;
				tryCollectCritters();
			}

			expect(callback).toHaveBeenCalledTimes(2);
		});
	});

	describe("resetCritters", () => {
		it("returns all critters to origin and marks uncollected", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];

			// Collect and move the critter
			critter.collected = true;
			critter.position.x = 9999;
			critter.position.y = 9999;

			resetCritters();

			expect(critter.collected).toBe(false);
			const cx = (100 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
			const cy = Math.floor(100 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
			expect(Math.abs(critter.position.x - cx)).toBeLessThan(TILE_SIZE);
			expect(Math.abs(critter.position.y - cy)).toBeLessThan(TILE_SIZE);
		});

		it("re-creates killed actors", () => {
			spawnCritterGroupsAt([100]);
			const groups = getCritterGroups();
			const group = groups[groups.length - 1];
			const critter = group.critters[0];
			const oldActor = critter.actor;
			oldActor.kill();

			resetCritters();

			// Actor should be a new instance (re-created)
			expect(critter.actor).not.toBe(oldActor);
			expect(critter.actor.isKilled()).toBe(false);
		});
	});
});
