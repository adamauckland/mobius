import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Excalibur mock (kept tiny — only what PlayerActor touches) ---
vi.mock("excalibur", () => {
	class MockVector {
		constructor(
			public x = 0,
			public y = 0,
		) {}
		clone() {
			return new MockVector(this.x, this.y);
		}
	}

	class MockActionQueue {
		private next = false;
		setHasNext(v: boolean) {
			this.next = v;
		}
		hasNext() {
			return this.next;
		}
	}

	class MockActions {
		queue = new MockActionQueue();
		easeTo = vi.fn().mockReturnThis();
		scaleTo = vi.fn().mockReturnThis();
		callMethod = vi.fn(function (this: any, fn: () => void) {
			this.lastCallback = fn;
			return this;
		});
		clearActions = vi.fn().mockReturnThis();
		lastCallback: (() => void) | null = null;
		getQueue() {
			return this.queue;
		}
	}

	class MockActor {
		pos: MockVector;
		z = 0;
		width = 0;
		height = 0;
		graphics = {
			use: vi.fn(),
			visible: true,
			onPreDraw: null as null | (() => void),
			offset: { x: 0, y: 0 },
		};
		actions = new MockActions();
		constructor(options?: any) {
			this.pos = options?.pos
				? new MockVector(options.pos.x, options.pos.y)
				: new MockVector();
			if (options?.width) this.width = options.width;
			if (options?.height) this.height = options.height;
			if (options?.z != null) this.z = options.z;
		}
	}

	return {
		Actor: MockActor,
		Vector: MockVector,
		EasingFunctions: { Linear: "linear" },
		Engine: class {},
		Graphic: class {},
		Collider: class {},
		CollisionContact: class {},
		Side: {},
	};
});

vi.mock("../resources/resources", () => ({
	playerWalkAnimation: { kind: "walk" },
	playerImage: { kind: "idle" },
}));

let mockNow = 0;
vi.mock("../game", () => ({
	game: {
		clock: {
			now: () => mockNow,
		},
	},
}));

vi.mock("../zIndex", () => ({
	zFromY: (y: number, layer: number) => y * 10 + layer,
	Z_LAYER_PLAYER: 5,
}));

vi.mock("../audio/sounds", () => ({
	sfxOneWayGate: vi.fn(),
	sfxPortal: vi.fn(),
}));

vi.mock("../entities/worldObjects", () => ({
	dropRockAtTile: vi.fn(),
	dropParcelAtTile: vi.fn(),
	tryCollectAtTile: vi.fn(),
}));

vi.mock("../entities/barriers", () => ({
	tryActivateSwitch: vi.fn(),
}));

const mockGetMovingBlockNear = vi.fn<(pos: unknown) => unknown>();
const mockMountBlock = vi.fn<(block: unknown, player: unknown) => void>();
vi.mock("../entities/movingBlocks", () => ({
	getMovingBlockNear: (pos: unknown) => mockGetMovingBlockNear(pos),
	mountBlock: (block: unknown, player: unknown) =>
		mockMountBlock(block, player),
}));

vi.mock("../model", () => ({
	model: { currentTileIndex: 0, movesRemaining: 0 },
}));

import {
	PlayerActor,
	tileIndexToPixelCenter,
	findAdjacentDropZoneIndex,
	gateExitTileIndex,
	carryBounceOffset,
} from "../entities/Player/PlayerActor";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	tiles,
	Grass,
	Tree,
	Fence,
	Barrier,
	DropZone,
	OneWayGate,
	portalTileIndices,
	exitDoorTileIndices,
} from "../tiles/tiledata";
import { setupTestWorld } from "./testWorld";
import {
	dropParcelAtTile,
	dropRockAtTile,
	tryCollectAtTile,
} from "../entities/worldObjects";
import { tryActivateSwitch } from "../entities/barriers";
import { sfxOneWayGate, sfxPortal } from "../audio/sounds";
import { model } from "../model";

function makePlayer() {
	return new PlayerActor(
		{ pos: { x: 0, y: 0 } as any, width: TILE_SIZE, height: TILE_SIZE },
		{ kind: "walk" } as any,
		{ kind: "idle" } as any,
	);
}

function setHasNext(player: PlayerActor, v: boolean) {
	(player.actions.getQueue() as any).setHasNext(v);
}

function getLastEaseCallback(player: PlayerActor): () => void {
	const cb = (player.actions as any).lastCallback;
	if (!cb) throw new Error("No callMethod callback captured");
	return cb;
}

describe("PlayerActor pure helpers", () => {
	beforeEach(() => {
		setupTestWorld();
	});

	describe("tileIndexToPixelCenter", () => {
		it("returns the centre of tile 0", () => {
			expect(tileIndexToPixelCenter(0)).toEqual({
				x: TILE_SIZE / 2,
				y: TILE_SIZE / 2,
			});
		});

		it("wraps on GRID_COLS", () => {
			const idx = GRID_COLS + 3; // row 1, col 3
			expect(tileIndexToPixelCenter(idx)).toEqual({
				x: 3 * TILE_SIZE + TILE_SIZE / 2,
				y: 1 * TILE_SIZE + TILE_SIZE / 2,
			});
		});

		it("handles a tile at the bottom-right", () => {
			const idx = GRID_COLS * GRID_ROWS - 1;
			expect(tileIndexToPixelCenter(idx)).toEqual({
				x: (GRID_COLS - 1) * TILE_SIZE + TILE_SIZE / 2,
				y: (GRID_ROWS - 1) * TILE_SIZE + TILE_SIZE / 2,
			});
		});
	});

	describe("findAdjacentDropZoneIndex", () => {
		it("returns the matching neighbour index", () => {
			// Place a player tile and a matching DropZone north of it
			const px = 10;
			const py = 10;
			const playerIdx = px + py * GRID_COLS;
			const northIdx = px + (py - 1) * GRID_COLS;
			tiles[northIdx] = new DropZone(2);

			expect(findAdjacentDropZoneIndex(playerIdx, 2)).toBe(northIdx);
		});

		it("returns null when adjacent DropZone has wrong id", () => {
			const px = 12;
			const py = 12;
			const playerIdx = px + py * GRID_COLS;
			const eastIdx = px + 1 + py * GRID_COLS;
			tiles[eastIdx] = new DropZone(1);

			expect(findAdjacentDropZoneIndex(playerIdx, 0)).toBeNull();
		});

		it("ignores fulfilled DropZones", () => {
			const px = 14;
			const py = 14;
			const playerIdx = px + py * GRID_COLS;
			const southIdx = px + (py + 1) * GRID_COLS;
			const dz = new DropZone(0);
			dz.fulfilled = true;
			tiles[southIdx] = dz;

			expect(findAdjacentDropZoneIndex(playerIdx, 0)).toBeNull();
		});

		it("does not walk off the top edge", () => {
			// tile in row 0 has no north neighbour to inspect
			const playerIdx = 5; // (col 5, row 0)
			expect(() => findAdjacentDropZoneIndex(playerIdx, 0)).not.toThrow();
		});

		it("does not walk off the bottom-right corner", () => {
			const playerIdx = GRID_COLS * GRID_ROWS - 1;
			expect(() => findAdjacentDropZoneIndex(playerIdx, 0)).not.toThrow();
		});

		it("returns the first matching neighbour in north/south/west/east order", () => {
			const px = 20;
			const py = 20;
			const playerIdx = px + py * GRID_COLS;
			const northIdx = px + (py - 1) * GRID_COLS;
			const southIdx = px + (py + 1) * GRID_COLS;
			tiles[northIdx] = new DropZone(7);
			tiles[southIdx] = new DropZone(7);

			// North is iterated first
			expect(findAdjacentDropZoneIndex(playerIdx, 7)).toBe(northIdx);
		});
	});

	describe("gateExitTileIndex", () => {
		it("returns the tile in the gate's direction when walkable", () => {
			const gx = 25;
			const gy = 25;
			const gateIdx = gx + gy * GRID_COLS;
			const eastIdx = gx + 1 + gy * GRID_COLS;
			tiles[eastIdx] = new Grass();

			expect(gateExitTileIndex(gateIdx, "right")).toBe(eastIdx);
		});

		it("returns null when blocked by a Tree", () => {
			const gx = 26;
			const gy = 26;
			const gateIdx = gx + gy * GRID_COLS;
			tiles[gx + (gy - 1) * GRID_COLS] = new Tree();

			expect(gateExitTileIndex(gateIdx, "up")).toBeNull();
		});

		it("returns null when blocked by a Fence", () => {
			const gx = 27;
			const gy = 27;
			const gateIdx = gx + gy * GRID_COLS;
			tiles[gx - 1 + gy * GRID_COLS] = new Fence();

			expect(gateExitTileIndex(gateIdx, "left")).toBeNull();
		});

		it("returns null when blocked by an active Barrier", () => {
			const gx = 28;
			const gy = 28;
			const gateIdx = gx + gy * GRID_COLS;
			const downIdx = gx + (gy + 1) * GRID_COLS;
			const barrier = new Barrier(0);
			barrier.collider = true;
			tiles[downIdx] = barrier;

			expect(gateExitTileIndex(gateIdx, "down")).toBeNull();
		});

		it("treats an opened Barrier (collider=false) as walkable", () => {
			const gx = 29;
			const gy = 29;
			const gateIdx = gx + gy * GRID_COLS;
			const downIdx = gx + (gy + 1) * GRID_COLS;
			const barrier = new Barrier(0);
			barrier.collider = false;
			tiles[downIdx] = barrier;

			expect(gateExitTileIndex(gateIdx, "down")).toBe(downIdx);
		});

		it("returns null when the destination is off the top edge", () => {
			const gateIdx = 5; // row 0
			expect(gateExitTileIndex(gateIdx, "up")).toBeNull();
		});

		it("returns null when the destination is off the right edge", () => {
			const gateIdx = GRID_COLS - 1; // last col, row 0
			expect(gateExitTileIndex(gateIdx, "right")).toBeNull();
		});
	});

	describe("carryBounceOffset", () => {
		it("is zero at t=0", () => {
			// -Math.abs(0) yields -0; treat as numerically zero
			expect(Math.abs(carryBounceOffset(0))).toBe(0);
		});

		it("is always non-positive (item rises above the player)", () => {
			for (const t of [50, 100, 314, 1000, 9999]) {
				expect(carryBounceOffset(t)).toBeLessThanOrEqual(0);
			}
		});

		it("magnitude does not exceed the bounce amplitude (3 px)", () => {
			for (const t of [50, 100, 314, 1000, 9999]) {
				expect(Math.abs(carryBounceOffset(t))).toBeLessThanOrEqual(3 + 1e-9);
			}
		});
	});
});

describe("PlayerActor onPostUpdate", () => {
	beforeEach(() => {
		setupTestWorld();
		vi.clearAllMocks();
		mockGetMovingBlockNear.mockReturnValue(undefined as any);
		mockNow = 0;
		model.movesRemaining = 0;
		model.currentTileIndex = 0;
	});

	it("skips movement when riding a block but still follows carried items", () => {
		const player = makePlayer();
		player.pos.x = 100;
		player.pos.y = 200;
		player.ridingBlock = { riders: [] } as any;

		const rockActor = { pos: { x: 0, y: 0 } } as any;
		player.carriedRock = { actor: rockActor } as any;

		player.onPostUpdate({} as any, 16);

		expect(rockActor.pos.x).toBe(100);
		expect(rockActor.pos.y).toBe(200 - 10);
		// Should NOT have advanced any buffered moves
		expect(player.actions.easeTo).not.toHaveBeenCalled();
	});

	it("consumes the next buffered tile and calls easeTo at its centre", () => {
		const player = makePlayer();
		const target = 5 + 6 * GRID_COLS;
		player.playerActionBuffer = [target];
		player.currentMoveTileIndex = 100;

		player.onPostUpdate({} as any, 16);

		expect(player.playerActionBuffer).toEqual([]);
		expect(player.previousTileIndex).toBe(100);
		expect(player.currentMoveTileIndex).toBe(target);
		expect(model.currentTileIndex).toBe(target);

		const expected = tileIndexToPixelCenter(target);
		const arg = (player.actions.easeTo as any).mock.calls[0][0];
		expect(arg.x).toBe(expected.x);
		expect(arg.y).toBe(expected.y);
	});

	it("auto-mounts when idle and a moving block is nearby", () => {
		const player = makePlayer();
		const fakeBlock = { riders: [] } as any;
		mockGetMovingBlockNear.mockReturnValue(fakeBlock);

		player.onPostUpdate({} as any, 16);

		expect(mockMountBlock).toHaveBeenCalledWith(fakeBlock, player);
	});

	it("does NOT auto-mount while the action queue is still busy", () => {
		const player = makePlayer();
		// Pending moves AND a busy queue: nothing should be consumed and no mount.
		player.playerActionBuffer = [1, 2];
		setHasNext(player, true);
		mockGetMovingBlockNear.mockReturnValue({ riders: [] } as any);

		player.onPostUpdate({} as any, 16);

		expect(player.actions.easeTo).not.toHaveBeenCalled();
		expect(mockMountBlock).not.toHaveBeenCalled();
	});

	it("bounces a carried rock while the action queue is busy", () => {
		const player = makePlayer();
		player.pos.x = 50;
		player.pos.y = 80;
		setHasNext(player, true);
		mockNow = Math.PI / (2 * 0.01); // sin(π/2)=1 → bounce = -3
		const rockActor = { pos: { x: 0, y: 0 } } as any;
		player.carriedRock = { actor: rockActor } as any;

		player.onPostUpdate({} as any, 16);

		expect(rockActor.pos.x).toBe(50);
		// y = pos.y + (-10) + bounce(-3) = 80 - 13
		expect(rockActor.pos.y).toBeCloseTo(80 - 10 - 3, 5);
	});

	it("does not bounce a carried rock when idle", () => {
		const player = makePlayer();
		player.pos.x = 60;
		player.pos.y = 90;
		setHasNext(player, false);
		mockNow = 1234;
		const rockActor = { pos: { x: 0, y: 0 } } as any;
		player.carriedRock = { actor: rockActor } as any;

		player.onPostUpdate({} as any, 16);

		expect(rockActor.pos.y).toBe(90 - 10);
	});
});

describe("PlayerActor moveToTile arrival callback", () => {
	beforeEach(() => {
		setupTestWorld();
		vi.clearAllMocks();
		mockGetMovingBlockNear.mockReturnValue(undefined as any);
		model.movesRemaining = 5;
		portalTileIndices.length = 0;
		exitDoorTileIndices.length = 0;
	});

	function arriveAt(player: PlayerActor, node: number) {
		player.moveToTile(node);
		getLastEaseCallback(player)();
	}

	it("decrements movesRemaining and tries to collect", () => {
		const player = makePlayer();
		arriveAt(player, 30);

		expect(model.movesRemaining).toBe(4);
		expect(tryCollectAtTile).toHaveBeenCalledWith(30);
		expect(tryActivateSwitch).toHaveBeenCalledWith(30);
	});

	it("auto-drops a parcel onto a matching DropZone underfoot", () => {
		const player = makePlayer();
		const dzIdx = 15 + 15 * GRID_COLS;
		tiles[dzIdx] = new DropZone(2);
		player.carriedParcel = { id: 2 } as any;

		arriveAt(player, dzIdx);

		expect(dropParcelAtTile).toHaveBeenCalledWith(player, dzIdx);
	});

	it("auto-drops a parcel onto an adjacent matching DropZone", () => {
		const player = makePlayer();
		const px = 18;
		const py = 18;
		const playerIdx = px + py * GRID_COLS;
		const eastIdx = px + 1 + py * GRID_COLS;
		tiles[playerIdx] = new Grass();
		tiles[eastIdx] = new DropZone(0);
		player.carriedParcel = { id: 0 } as any;

		arriveAt(player, playerIdx);

		expect(dropParcelAtTile).toHaveBeenCalledWith(player, eastIdx);
	});

	it("does not auto-drop when no matching DropZone is reachable", () => {
		const player = makePlayer();
		player.carriedParcel = { id: 99 } as any;

		arriveAt(player, 33);

		expect(dropParcelAtTile).not.toHaveBeenCalled();
	});

	it("fires the arrival callback only when the buffer is empty", () => {
		const player = makePlayer();
		const cb = vi.fn();
		player.onArriveAtTile = cb;
		player.playerActionBuffer = [99]; // still pending

		arriveAt(player, 1);
		expect(cb).not.toHaveBeenCalled();
		expect(player.onArriveAtTile).toBe(cb); // still set

		player.playerActionBuffer = [];
		arriveAt(player, 2);
		expect(cb).toHaveBeenCalledTimes(1);
		expect(player.onArriveAtTile).toBeNull(); // cleared
	});

	it("drops a carried rock on the previous tile when stepping onto a portal", () => {
		const player = makePlayer();
		player.previousTileIndex = 77;
		const portalIdx = 200;
		portalTileIndices.push(portalIdx);
		player.carriedRock = {} as any;

		arriveAt(player, portalIdx);

		expect(dropRockAtTile).toHaveBeenCalledWith(player, 77);
	});

	it("drops a carried parcel on the previous tile when stepping onto a portal", () => {
		const player = makePlayer();
		player.previousTileIndex = 88;
		const portalIdx = 201;
		portalTileIndices.push(portalIdx);
		player.carriedParcel = { id: 5 } as any;

		arriveAt(player, portalIdx);

		expect(dropParcelAtTile).toHaveBeenCalledWith(player, 88);
	});

	it("invokes onReachedPortal at end of path and skips the shrink animation when handled", () => {
		const player = makePlayer();
		const portalIdx = 202;
		portalTileIndices.push(portalIdx);
		player.onReachedPortal = vi.fn(() => true);

		arriveAt(player, portalIdx);

		expect(sfxPortal).toHaveBeenCalled();
		expect(player.onReachedPortal).toHaveBeenCalled();
		expect(player.actions.scaleTo).not.toHaveBeenCalled();
	});

	it("plays the shrink animation when onReachedPortal is unhandled", () => {
		const player = makePlayer();
		const portalIdx = 203;
		portalTileIndices.push(portalIdx);
		player.onReachedPortal = vi.fn(() => false);

		arriveAt(player, portalIdx);

		expect(player.actions.scaleTo).toHaveBeenCalled();
	});

	it("invokes onReachedExitDoor when landing on an exit door tile", () => {
		const player = makePlayer();
		const doorIdx = 250;
		exitDoorTileIndices.push(doorIdx);
		const onExit = vi.fn();
		player.onReachedExitDoor = onExit;

		arriveAt(player, doorIdx);

		expect(onExit).toHaveBeenCalled();
	});

	it("queues the next move when landing on a one-way gate", () => {
		const player = makePlayer();
		const gx = 30;
		const gy = 30;
		const gateIdx = gx + gy * GRID_COLS;
		const eastIdx = gx + 1 + gy * GRID_COLS;
		tiles[gateIdx] = new OneWayGate("right");
		tiles[eastIdx] = new Grass();

		arriveAt(player, gateIdx);

		expect(sfxOneWayGate).toHaveBeenCalled();
		expect(player.playerActionBuffer).toEqual([eastIdx]);
	});

	it("does not queue a move when a one-way gate is blocked", () => {
		const player = makePlayer();
		const gx = 31;
		const gy = 31;
		const gateIdx = gx + gy * GRID_COLS;
		const eastIdx = gx + 1 + gy * GRID_COLS;
		tiles[gateIdx] = new OneWayGate("right");
		tiles[eastIdx] = new Tree();

		arriveAt(player, gateIdx);

		expect(sfxOneWayGate).toHaveBeenCalled();
		expect(player.playerActionBuffer).toEqual([]);
	});
});
