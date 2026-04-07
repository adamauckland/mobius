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

vi.mock("../resources", () => ({
  rlSS: { getSprite: vi.fn() },
}));

vi.mock("../game", () => ({
  game: { add: vi.fn() },
}));

vi.mock("../zIndex", () => ({
  zFromY: (y: number, layer: number) => y * 10 + layer,
  Z_LAYER_TREE: 1,
  Z_LAYER_PICKUP: 2,
}));

vi.mock("../pathfinding", () => ({
  rebuildPathfinding: vi.fn(),
}));

vi.mock("../entities/lightTrail", () => ({
  spawnLight: vi.fn(),
}));

vi.mock("../sounds", () => ({
  sfxSwitch: vi.fn(),
}));

import {
  initBarriers,
  spawnBarriers,
  resetBarriers,
  tryActivateSwitch,
} from "../entities/barriers";
import { generateWorld, tiles, Barrier, Switch } from "../tiles/tiledata";
import { rebuildPathfinding } from "../pathfinding";
import { game } from "../game";

describe("barriers", () => {
  let mockTileMap: any;

  beforeEach(() => {
    vi.clearAllMocks();
    generateWorld(42);

    // Create a mock tilemap that mirrors the tiles array with a solid property
    mockTileMap = {
      tiles: tiles.map((t) => ({ solid: t.collider })),
    };
    initBarriers(mockTileMap);
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

  describe("tryActivateSwitch", () => {
    it("returns false for non-switch tiles", () => {
      // Find a grass tile
      const grassIdx = tiles.findIndex(
        (t) => !(t instanceof Switch) && !(t instanceof Barrier),
      );
      expect(tryActivateSwitch(grassIdx)).toBe(false);
    });

    it("activates a switch and opens matching barriers", () => {
      spawnBarriers();

      // Find a switch tile
      const switchIdx = tiles.findIndex((t) => t instanceof Switch);
      if (switchIdx === -1) return; // skip if no switches (unlikely with seed 42)

      const switchTile = tiles[switchIdx] as Switch;
      const groupId = switchTile.groupId;

      const result = tryActivateSwitch(switchIdx);
      expect(result).toBe(true);
      expect(switchTile.activated).toBe(true);

      // All barriers in the same group should have collider = false
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (t instanceof Barrier && t.groupId === groupId) {
          expect(t.collider).toBe(false);
          expect(mockTileMap.tiles[i].solid).toBe(false);
        }
      }

      // Pathfinding should be rebuilt
      expect(rebuildPathfinding).toHaveBeenCalled();
    });

    it("returns false for already-activated switches", () => {
      spawnBarriers();
      const switchIdx = tiles.findIndex((t) => t instanceof Switch);
      if (switchIdx === -1) return;

      tryActivateSwitch(switchIdx);
      expect(tryActivateSwitch(switchIdx)).toBe(false);
    });
  });

  describe("resetBarriers", () => {
    it("re-locks all barriers and resets switches", () => {
      spawnBarriers();
      const switchIdx = tiles.findIndex((t) => t instanceof Switch);
      if (switchIdx === -1) return;

      const switchTile = tiles[switchIdx] as Switch;
      const groupId = switchTile.groupId;
      tryActivateSwitch(switchIdx);

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
});
