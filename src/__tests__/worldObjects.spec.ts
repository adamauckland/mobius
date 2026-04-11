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

  class MockActor {
    pos: MockVector;
    width = 0;
    height = 0;
    z = 0;
    graphics = {
      use: vi.fn(),
      visible: true,
      onPreDraw: null,
      offset: { x: 0, y: 0 },
    };
    constructor(options?: any) {
      this.pos = options?.pos
        ? new MockVector(options.pos.x, options.pos.y)
        : new MockVector();
    }
    kill() {}
  }
  return { Actor: MockActor, Vector: MockVector };
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

vi.mock("../zIndex", () => ({
  zFromY: (y: number, layer: number) => y * 10 + layer,
  Z_LAYER_PICKUP: 2,
  Z_LAYER_ROCK: 4,
}));

vi.mock("../audio/sounds", () => ({
  sfxCollect: vi.fn(),
  sfxPickUpRock: vi.fn(),
  sfxDropRock: vi.fn(),
  sfxPickUpParcel: vi.fn(),
  sfxDropParcel: vi.fn(),
  sfxParcelPlaced: vi.fn(),
}));

vi.mock("../entities/lightTrail", () => ({
  spawnLight: vi.fn(),
  spawnScoreLight: vi.fn(),
}));

// Mock chap module - Player class (imported by worldObjects for typing)
vi.mock("../entities/chap", () => ({
  Player: class {},
}));

import {
  getRockAtTile,
  pickUpRock,
  dropRock,
  dropRockAtTile,
  resetRocks,
  spawnRocksAt,
  getRocks,
  tryCollectAtTile,
  getCollectableCount,
  getScore,
  spawnCollectablesAt,
  getParcelAtTile,
  pickUpParcel,
  dropParcel,
  dropParcelAtTile,
  resetParcels,
  spawnParcelsAt,
  getParcels,
  PARCEL_SPRITES,
} from "@/entities/worldObjects";
import { TILE_SIZE, GRID_COLS } from "@/tiles/tiledata";
import { setupTestWorld } from "@/__tests__/testWorld";

describe("worldObjects", () => {
  beforeEach(() => {
    setupTestWorld();
  });

  describe("rocks", () => {
    describe("spawnRocksAt", () => {
      it("creates rocks at specified tile indices", () => {
        spawnRocksAt([5, 10]);
        const rocks = getRocks();
        // At least the rocks we spawned should exist
        const rock5 = rocks.find((r) => r.originTileIndex === 5);
        const rock10 = rocks.find((r) => r.originTileIndex === 10);
        expect(rock5).toBeDefined();
        expect(rock10).toBeDefined();
        expect(rock5!.tileIndex).toBe(5);
        expect(rock10!.tileIndex).toBe(10);
        expect(rock5!.carriedBy).toBeNull();
      });
    });

    describe("getRockAtTile", () => {
      it("finds a rock at a tile", () => {
        spawnRocksAt([15]);
        expect(getRockAtTile(15)).toBeDefined();
      });

      it("returns undefined when no rock at tile", () => {
        expect(getRockAtTile(9999)).toBeUndefined();
      });

      it("does not return carried rocks", () => {
        spawnRocksAt([20]);
        const rock = getRockAtTile(20)!;
        rock.carriedBy = {} as any;
        expect(getRockAtTile(20)).toBeUndefined();
      });
    });

    describe("pickUpRock", () => {
      it("sets carriedBy on the rock and carriedRock on the player", () => {
        spawnRocksAt([25]);
        const rock = getRockAtTile(25)!;
        const player = { carriedRock: null } as any;
        pickUpRock(rock, player);
        expect(rock.carriedBy).toBe(player);
        expect(player.carriedRock).toBe(rock);
      });
    });

    describe("dropRockAtTile", () => {
      it("drops rock at specified tile and updates position", () => {
        spawnRocksAt([30]);
        const rock = getRockAtTile(30)!;
        const player = {
          carriedRock: null as any,
          logicalTileIndex: 30,
        } as any;
        pickUpRock(rock, player);

        dropRockAtTile(player, 35);
        expect(rock.carriedBy).toBeNull();
        expect(rock.tileIndex).toBe(35);
        expect(player.carriedRock).toBeNull();
        // Check position is updated to tile 35's pixel coords
        const x = 35 % GRID_COLS;
        const y = Math.floor(35 / GRID_COLS);
        expect(rock.actor.pos.x).toBe(x * TILE_SIZE + TILE_SIZE / 2);
        expect(rock.actor.pos.y).toBe(y * TILE_SIZE + TILE_SIZE / 2);
      });

      it("does nothing if player has no rock", () => {
        const player = { carriedRock: null } as any;
        expect(() => dropRockAtTile(player, 0)).not.toThrow();
      });
    });

    describe("dropRock", () => {
      it("drops rock at player's logical tile", () => {
        spawnRocksAt([40]);
        const rock = getRockAtTile(40)!;
        const player = {
          carriedRock: null as any,
          logicalTileIndex: 45,
        } as any;
        pickUpRock(rock, player);
        dropRock(player);
        expect(rock.tileIndex).toBe(45);
      });
    });

    describe("resetRocks", () => {
      it("returns all rocks to original positions", () => {
        spawnRocksAt([50]);
        const rock = getRocks().find((r) => r.originTileIndex === 50)!;
        rock.tileIndex = 99;
        rock.carriedBy = {} as any;
        rock.actor.pos.x = 999;

        resetRocks();
        expect(rock.tileIndex).toBe(50);
        expect(rock.carriedBy).toBeNull();
        const x = 50 % GRID_COLS;
        const y = Math.floor(50 / GRID_COLS);

        expect(rock.actor.pos.x).toBe(x * TILE_SIZE + TILE_SIZE / 2);
        expect(rock.actor.pos.y).toBe(y * TILE_SIZE + TILE_SIZE / 2);
      });
    });
  });

  describe("collectables", () => {
    describe("spawnCollectablesAt", () => {
      it("creates collectables at specified tiles", () => {
        spawnCollectablesAt([100, 101]);
        const count = getCollectableCount();
        expect(count.total).toBeGreaterThanOrEqual(2);
        expect(count.collected).toBe(0);
      });
    });

    describe("tryCollectAtTile", () => {
      it("collects a collectable and increases score", () => {
        spawnCollectablesAt([200]);
        const scoreBefore = getScore();
        const collected = tryCollectAtTile(200);
        expect(collected).toBe(true);
        expect(getScore()).toBe(scoreBefore + 100);
      });

      it("returns false when no collectable at tile", () => {
        expect(tryCollectAtTile(9999)).toBe(false);
      });

      it("cannot collect the same tile twice", () => {
        spawnCollectablesAt([201]);
        tryCollectAtTile(201);
        const scoreBefore = getScore();
        expect(tryCollectAtTile(201)).toBe(false);
        expect(getScore()).toBe(scoreBefore);
      });
    });

    describe("getCollectableCount", () => {
      it("tracks total and collected count", () => {
        const totalBefore = getCollectableCount().total;
        spawnCollectablesAt([202, 203, 204]);
        const count = getCollectableCount();
        expect(count.total).toBe(totalBefore + 3);
        tryCollectAtTile(202);
        expect(getCollectableCount().collected).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("parcels", () => {
    describe("PARCEL_SPRITES", () => {
      it("has 3 sprite definitions", () => {
        expect(PARCEL_SPRITES).toHaveLength(3);
        for (const [col, row] of PARCEL_SPRITES) {
          expect(typeof col).toBe("number");
          expect(typeof row).toBe("number");
        }
      });
    });

    describe("spawnParcelsAt", () => {
      it("creates parcels at specified positions", () => {
        spawnParcelsAt([{ id: 0, tile: 300 }]);
        const parcels = getParcels();
        const parcel = parcels.find((p) => p.originTileIndex === 300);
        expect(parcel).toBeDefined();
        expect(parcel!.id).toBe(0);
        expect(parcel!.placed).toBe(false);
        expect(parcel!.carriedBy).toBeNull();
      });
    });

    describe("getParcelAtTile", () => {
      it("finds an uncarried, unplaced parcel at a tile", () => {
        spawnParcelsAt([{ id: 0, tile: 301 }]);
        expect(getParcelAtTile(301)).toBeDefined();
      });

      it("returns undefined for carried parcels", () => {
        spawnParcelsAt([{ id: 0, tile: 302 }]);
        const parcel = getParcelAtTile(302)!;
        parcel.carriedBy = {} as any;
        expect(getParcelAtTile(302)).toBeUndefined();
      });

      it("returns undefined for placed parcels", () => {
        spawnParcelsAt([{ id: 0, tile: 303 }]);
        const parcel = getParcelAtTile(303)!;
        parcel.placed = true;
        expect(getParcelAtTile(303)).toBeUndefined();
      });
    });

    describe("pickUpParcel", () => {
      it("sets carriedBy on the parcel", () => {
        spawnParcelsAt([{ id: 0, tile: 304 }]);
        const parcel = getParcelAtTile(304)!;
        const player = { carriedParcel: null } as any;
        pickUpParcel(parcel, player);
        expect(parcel.carriedBy).toBe(player);
        expect(player.carriedParcel).toBe(parcel);
      });
    });

    describe("dropParcelAtTile", () => {
      it("drops parcel at specified tile", () => {
        spawnParcelsAt([{ id: 0, tile: 305 }]);
        const parcel = getParcelAtTile(305)!;
        const player = {
          carriedParcel: null as any,
          logicalTileIndex: 305,
        } as any;
        pickUpParcel(parcel, player);
        dropParcelAtTile(player, 310);
        expect(parcel.carriedBy).toBeNull();
        expect(parcel.tileIndex).toBe(310);
        expect(player.carriedParcel).toBeNull();
      });
    });

    describe("dropParcel", () => {
      it("drops at player's logical tile", () => {
        spawnParcelsAt([{ id: 0, tile: 306 }]);
        const parcel = getParcelAtTile(306)!;
        const player = {
          carriedParcel: null as any,
          logicalTileIndex: 320,
        } as any;
        pickUpParcel(parcel, player);
        dropParcel(player);
        expect(parcel.tileIndex).toBe(320);
      });
    });

    describe("resetParcels", () => {
      it("returns all parcels to origin", () => {
        spawnParcelsAt([{ id: 0, tile: 307 }]);
        const parcel = getParcels().find((p) => p.originTileIndex === 307)!;
        parcel.tileIndex = 999;
        parcel.carriedBy = {} as any;
        parcel.placed = true;

        resetParcels();
        expect(parcel.tileIndex).toBe(307);
        expect(parcel.carriedBy).toBeNull();
        expect(parcel.placed).toBe(false);
      });
    });
  });
});
