import { describe, it, expect } from "vitest";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	START_TILE_X,
	START_TILE_Y,
	START_POS_X,
	START_POS_Y,
	START_TILE_INDEX,
	Grass,
	Tree,
	Portal,
	Barrier,
	Switch,
	Fence,
	OneWayGate,
	DropZone,
	loadWorld,
	tiles,
	portalTileIndices,
	dropZoneTileIndices,
	customStartTile,
} from "../tiles/tiledata";
import { type IMapData } from "../levels/IMapData";

describe("constants", () => {
	it("has correct tile size", () => {
		expect(TILE_SIZE).toBe(16);
	});

	it("has correct grid dimensions", () => {
		expect(GRID_COLS).toBe(50);
		expect(GRID_ROWS).toBe(50);
	});

	it("has correct start position derived from grid center", () => {
		expect(START_TILE_X).toBe(Math.floor(GRID_COLS / 2));
		expect(START_TILE_Y).toBe(Math.floor(GRID_ROWS / 2));
		expect(START_POS_X).toBe(START_TILE_X * TILE_SIZE + TILE_SIZE / 2);
		expect(START_POS_Y).toBe(START_TILE_Y * TILE_SIZE + TILE_SIZE / 2);
		expect(START_TILE_INDEX).toBe(START_TILE_X + START_TILE_Y * GRID_COLS);
	});
});

describe("tile classes", () => {
	describe("Grass", () => {
		it("has collider = false", () => {
			expect(new Grass().collider).toBe(false);
		});

		it("has a sprite with 2 elements", () => {
			const g = new Grass();
			expect(g.sprite).toHaveLength(2);
			expect(g.sprite[1]).toBe(0);
		});

		it("sprite column is one of the valid indices (0, 1, or 2)", () => {
			// Generate several to check range
			for (let i = 0; i < 20; i++) {
				const g = new Grass();
				expect([0, 1, 2]).toContain(g.sprite[0]);
			}
		});
	});

	describe("Tree", () => {
		it("has collider = true", () => {
			expect(new Tree().collider).toBe(true);
		});

		it("has sprite [3, 0]", () => {
			expect(new Tree().sprite).toEqual([3, 0]);
		});
	});

	describe("Portal", () => {
		it("has collider = false", () => {
			expect(new Portal().collider).toBe(false);
		});

		it("has sprite [0, 0]", () => {
			expect(new Portal().sprite).toEqual([0, 0]);
		});
	});

	describe("Barrier", () => {
		it("has collider = true", () => {
			expect(new Barrier(0).collider).toBe(true);
		});

		it("stores groupId", () => {
			expect(new Barrier(3).groupId).toBe(3);
		});
	});

	describe("Switch", () => {
		it("has collider = false", () => {
			expect(new Switch(0).collider).toBe(false);
		});

		it("stores groupId", () => {
			expect(new Switch(2).groupId).toBe(2);
		});

		it("starts un-activated", () => {
			expect(new Switch(0).activated).toBe(false);
		});
	});

	describe("Fence", () => {
		it("has collider = true", () => {
			expect(new Fence().collider).toBe(true);
		});
	});

	describe("OneWayGate", () => {
		it("has collider = false", () => {
			expect(new OneWayGate("up").collider).toBe(false);
		});

		it("stores direction", () => {
			expect(new OneWayGate("left").direction).toBe("left");
			expect(new OneWayGate("right").direction).toBe("right");
			expect(new OneWayGate("up").direction).toBe("up");
			expect(new OneWayGate("down").direction).toBe("down");
		});
	});

	describe("DropZone", () => {
		it("has collider = true (impassable until parcel placed)", () => {
			expect(new DropZone(0).collider).toBe(true);
		});

		it("stores id", () => {
			expect(new DropZone(1).id).toBe(1);
		});

		it("starts unfulfilled", () => {
			expect(new DropZone(0).fulfilled).toBe(false);
		});
	});
});

describe("loadWorld", () => {
	it("loads tiles from MapData tile codes", () => {
		const map: IMapData = {
			name: "Test",
			cols: 3,
			rows: 3,
			startTile: 4,
			tiles: [
				{ type: "grass" },
				{ type: "tree" },
				{ type: "portal" },
				{ type: "barrier", groupId: 0 },
				{ type: "switch", groupId: 1 },
				{ type: "fence" },
				{ type: "oneWayGate", direction: "right" },
				{ type: "dropZone", id: 0 },
				{ type: "grass" },
			],
			rocks: [],
			collectables: [],
			parcels: [],
			monsters: [],
			movingBlocks: [],
			timeLimit: 60,
		};
		loadWorld(map);

		expect(tiles[0]).toBeInstanceOf(Grass);
		expect(tiles[1]).toBeInstanceOf(Tree);
		expect(tiles[2]).toBeInstanceOf(Portal);
		expect(tiles[3]).toBeInstanceOf(Barrier);
		expect((tiles[3] as Barrier).groupId).toBe(0);
		expect(tiles[4]).toBeInstanceOf(Switch);
		expect((tiles[4] as Switch).groupId).toBe(1);
		expect(tiles[5]).toBeInstanceOf(Fence);
		expect(tiles[6]).toBeInstanceOf(OneWayGate);
		expect((tiles[6] as OneWayGate).direction).toBe("right");
		expect(tiles[7]).toBeInstanceOf(DropZone);
		expect((tiles[7] as DropZone).id).toBe(0);
		expect(tiles[8]).toBeInstanceOf(Grass);
	});

	it("tracks portal indices", () => {
		const map: IMapData = {
			name: "Test",
			cols: 2,
			rows: 2,
			startTile: 0,
			tiles: [
				{ type: "grass" },
				{ type: "portal" },
				{ type: "portal" },
				{ type: "grass" },
			],
			rocks: [],
			collectables: [],
			parcels: [],
			monsters: [],
			movingBlocks: [],
			timeLimit: 60,
		};
		loadWorld(map);
		expect(portalTileIndices).toEqual([1, 2]);
	});

	it("tracks drop zone indices", () => {
		const map: IMapData = {
			name: "Test",
			cols: 2,
			rows: 2,
			startTile: 0,
			tiles: [
				{ type: "grass" },
				{ type: "dropZone", id: 0 },
				{ type: "dropZone", id: 1 },
				{ type: "grass" },
			],
			rocks: [],
			collectables: [],
			parcels: [],
			monsters: [],
			movingBlocks: [],
			timeLimit: 60,
		};
		loadWorld(map);
		expect(dropZoneTileIndices).toEqual([1, 2]);
	});

	it("sets customStartTile", () => {
		const map: IMapData = {
			name: "Test",
			cols: 2,
			rows: 2,
			startTile: 3,
			tiles: [
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
			],
			rocks: [],
			collectables: [],
			parcels: [],
			monsters: [],
			movingBlocks: [],
			timeLimit: 60,
		};
		loadWorld(map);
		expect(customStartTile).toBe(3);
	});

	it("defaults missing tile codes to grass", () => {
		const map: IMapData = {
			name: "Test",
			cols: 2,
			rows: 2,
			startTile: 0,
			tiles: [{ type: "tree" }], // only 1 tile provided for 4-tile map
			rocks: [],
			collectables: [],
			parcels: [],
			monsters: [],
			movingBlocks: [],
			timeLimit: 60,
		};
		loadWorld(map);
		expect(tiles[0]).toBeInstanceOf(Tree);
		expect(tiles[1]).toBeInstanceOf(Grass);
		expect(tiles[2]).toBeInstanceOf(Grass);
		expect(tiles[3]).toBeInstanceOf(Grass);
	});
});
