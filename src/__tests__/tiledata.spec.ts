import { describe, it, expect, beforeEach } from "vitest";
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  COLLECTABLE_COUNT,
  PARCEL_COUNT,
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
  generateWorld,
  loadWorld,
  tiles,
  portalTileIndices,
  dropZoneTileIndices,
  customStartTile,
} from "../tiledata";
import { createEmptyMap, type MapData } from "../mapData";

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
  beforeEach(() => {
    // Initialize seededRandom so Grass constructor works
    generateWorld(42);
  });

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
    it("has collider = false", () => {
      expect(new DropZone(0).collider).toBe(false);
    });

    it("stores id", () => {
      expect(new DropZone(1).id).toBe(1);
    });

    it("starts unfulfilled", () => {
      expect(new DropZone(0).fulfilled).toBe(false);
    });
  });
});

describe("generateWorld", () => {
  beforeEach(() => {
    generateWorld(42);
  });

  it("populates tiles array with correct total count", () => {
    expect(tiles).toHaveLength(GRID_COLS * GRID_ROWS);
  });

  it("places grass at the start tile", () => {
    expect(tiles[START_TILE_INDEX]).toBeInstanceOf(Grass);
  });

  it("contains a mix of Grass and Tree tiles", () => {
    const grassCount = tiles.filter((t) => t instanceof Grass).length;
    const treeCount = tiles.filter((t) => t instanceof Tree).length;
    expect(grassCount).toBeGreaterThan(0);
    expect(treeCount).toBeGreaterThan(0);
  });

  it("places exactly 4 portals", () => {
    const portalCount = tiles.filter((t) => t instanceof Portal).length;
    expect(portalCount).toBe(4);
    expect(portalTileIndices).toHaveLength(4);
  });

  it("portal indices match tile positions", () => {
    for (const idx of portalTileIndices) {
      expect(tiles[idx]).toBeInstanceOf(Portal);
    }
  });

  it("places barrier groups with corresponding switches", () => {
    const barriers = tiles.filter((t) => t instanceof Barrier);
    const switches = tiles.filter((t) => t instanceof Switch);
    expect(barriers.length).toBeGreaterThan(0);
    expect(switches.length).toBeGreaterThan(0);
  });

  it("places fences", () => {
    const fences = tiles.filter((t) => t instanceof Fence);
    expect(fences.length).toBeGreaterThan(0);
  });

  it("places one-way gates", () => {
    const gates = tiles.filter((t) => t instanceof OneWayGate);
    expect(gates.length).toBeGreaterThan(0);
  });

  it("places drop zones for parcels", () => {
    const dropZones = tiles.filter((t) => t instanceof DropZone);
    expect(dropZones.length).toBe(PARCEL_COUNT);
    expect(dropZoneTileIndices).toHaveLength(PARCEL_COUNT);
  });

  it("drop zone indices match tile positions", () => {
    for (const idx of dropZoneTileIndices) {
      expect(tiles[idx]).toBeInstanceOf(DropZone);
    }
  });

  it("is deterministic - same seed produces same world", () => {
    generateWorld(42);
    const tiles1 = tiles.map((t) => t.constructor.name);
    generateWorld(42);
    const tiles2 = tiles.map((t) => t.constructor.name);
    expect(tiles1).toEqual(tiles2);
  });

  it("different seeds produce different worlds", () => {
    generateWorld(42);
    const tiles1 = tiles.map((t) => t.constructor.name);
    generateWorld(99);
    const tiles2 = tiles.map((t) => t.constructor.name);
    expect(tiles1).not.toEqual(tiles2);
  });

  it("never places a non-grass tile at the start position", () => {
    for (const seed of [0, 1, 42, 100, 999]) {
      generateWorld(seed);
      expect(tiles[START_TILE_INDEX]).toBeInstanceOf(Grass);
    }
  });
});

describe("loadWorld", () => {
  it("loads tiles from MapData tile codes", () => {
    const map: MapData = {
      name: "Test",
      cols: 3,
      rows: 3,
      startTile: 4,
      tiles: ["g", "T", "P", "B0", "S1", "F", ">", "D0", "g"],
      rocks: [],
      collectables: [],
      parcels: [],
      monsters: [],
      movingBlocks: [],
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
    const map: MapData = {
      name: "Test",
      cols: 2,
      rows: 2,
      startTile: 0,
      tiles: ["g", "P", "P", "g"],
      rocks: [],
      collectables: [],
      parcels: [],
      monsters: [],
      movingBlocks: [],
    };
    loadWorld(map);
    expect(portalTileIndices).toEqual([1, 2]);
  });

  it("tracks drop zone indices", () => {
    const map: MapData = {
      name: "Test",
      cols: 2,
      rows: 2,
      startTile: 0,
      tiles: ["g", "D0", "D1", "g"],
      rocks: [],
      collectables: [],
      parcels: [],
      monsters: [],
      movingBlocks: [],
    };
    loadWorld(map);
    expect(dropZoneTileIndices).toEqual([1, 2]);
  });

  it("sets customStartTile", () => {
    const map: MapData = {
      name: "Test",
      cols: 2,
      rows: 2,
      startTile: 3,
      tiles: ["g", "g", "g", "g"],
      rocks: [],
      collectables: [],
      parcels: [],
      monsters: [],
      movingBlocks: [],
    };
    loadWorld(map);
    expect(customStartTile).toBe(3);
  });

  it("defaults missing tile codes to grass", () => {
    const map: MapData = {
      name: "Test",
      cols: 2,
      rows: 2,
      startTile: 0,
      tiles: ["T"], // only 1 tile provided for 4-tile map
      rocks: [],
      collectables: [],
      parcels: [],
      monsters: [],
      movingBlocks: [],
    };
    loadWorld(map);
    expect(tiles[0]).toBeInstanceOf(Tree);
    expect(tiles[1]).toBeInstanceOf(Grass);
    expect(tiles[2]).toBeInstanceOf(Grass);
    expect(tiles[3]).toBeInstanceOf(Grass);
  });
});
