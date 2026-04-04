import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
  class MockVector {
    x: number;
    y: number;
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    clone() { return new MockVector(this.x, this.y); }
  }
  class MockActor {
    pos: MockVector;
    width = 0;
    height = 0;
    z = 0;
    graphics = { use: vi.fn(), visible: true };
    constructor(options?: any) {
      this.pos = options?.pos ? new MockVector(options.pos.x, options.pos.y) : new MockVector();
    }
  }
  return { Actor: MockActor, Vector: MockVector };
});

vi.mock("../resources", () => ({
  rlSS: { getSprite: vi.fn() },
}));

vi.mock("../game", () => ({
  game: { add: vi.fn() },
}));

vi.mock("../zIndex", () => ({
  zFromY: (y: number, layer: number) => y * 10 + layer,
  Z_LAYER_PICKUP: 2,
}));

vi.mock("../sounds", () => ({
  sfxPlatformStart: vi.fn(),
  sfxPlatformStop: vi.fn(),
}));

import {
  spawnMovingBlocksAt,
  resetMovingBlocks,
  updateMovingBlocks,
  getMovingBlockNear,
  mountBlock,
  dismountBlock,
} from "../movingBlocks";
import { Vector } from "excalibur";
import { generateWorld, tiles, TILE_SIZE, GRID_COLS } from "../tiledata";
import { game } from "../game";

describe("movingBlocks", () => {
  beforeEach(() => {
    generateWorld(42);
  });

  describe("spawnMovingBlocksAt", () => {
    it("creates blocks at specified start/end positions", () => {
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      expect(game.add).toHaveBeenCalled();
    });
  });

  describe("getMovingBlockNear", () => {
    it("finds a block within mount radius", () => {
      // Spawn a block at tile 0 (position 8, 8) going to tile 10
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      const startX = (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
      const startY = Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
      // Search near the block's start position
      const block = getMovingBlockNear(new Vector(startX, startY));
      expect(block).toBeDefined();
    });

    it("returns undefined when no block is nearby", () => {
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      // Far away from any block
      const block = getMovingBlockNear(new Vector(9999, 9999));
      expect(block).toBeUndefined();
    });
  });

  describe("mountBlock", () => {
    it("adds player to block riders and sets ridingBlock", () => {
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      const block = getMovingBlockNear(
        new Vector(
          (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
          Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
        ),
      )!;
      const mockPlayer = {
        ridingBlock: null as any,
        playerActionBuffer: [1, 2, 3],
        actions: { clearActions: vi.fn() },
      } as any;

      mountBlock(block, mockPlayer);
      expect(block.riders).toContain(mockPlayer);
      expect(mockPlayer.ridingBlock).toBe(block);
      expect(mockPlayer.playerActionBuffer).toEqual([]);
      expect(mockPlayer.actions.clearActions).toHaveBeenCalled();
    });
  });

  describe("dismountBlock", () => {
    it("removes player from block riders when on walkable tile", () => {
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      const block = getMovingBlockNear(
        new Vector(
          (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
          Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
        ),
      )!;

      // Place the player on a grass tile
      const grassIndex = tiles.findIndex((t) => !t.collider);
      const gx = grassIndex % GRID_COLS;
      const gy = Math.floor(grassIndex / GRID_COLS);
      const mockPlayer = {
        pos: { x: gx * TILE_SIZE + TILE_SIZE / 2, y: gy * TILE_SIZE + TILE_SIZE / 2 },
        ridingBlock: block,
        logicalTileIndex: 0,
        currentMoveTileIndex: 0,
      } as any;
      block.riders = [mockPlayer];

      const result = dismountBlock(mockPlayer);
      expect(result).toBe(true);
      expect(block.riders).not.toContain(mockPlayer);
      expect(mockPlayer.ridingBlock).toBeNull();
      // Player should be snapped to tile center
      expect(mockPlayer.pos.x).toBe(gx * TILE_SIZE + TILE_SIZE / 2);
      expect(mockPlayer.pos.y).toBe(gy * TILE_SIZE + TILE_SIZE / 2);
    });

    it("returns false when player is over a solid tile", () => {
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      const block = getMovingBlockNear(
        new Vector(
          (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
          Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
        ),
      )!;

      // Find a tree tile (collider = true)
      const treeIndex = tiles.findIndex((t) => t.collider);
      if (treeIndex === -1) return; // skip if no trees
      const tx = treeIndex % GRID_COLS;
      const ty = Math.floor(treeIndex / GRID_COLS);
      const mockPlayer = {
        pos: { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 },
        ridingBlock: block,
      } as any;
      block.riders = [mockPlayer];

      const result = dismountBlock(mockPlayer);
      expect(result).toBe(false);
      expect(mockPlayer.ridingBlock).toBe(block);
    });

    it("returns false if player is not riding a block", () => {
      const mockPlayer = { ridingBlock: null } as any;
      expect(dismountBlock(mockPlayer)).toBe(false);
    });
  });

  describe("updateMovingBlocks", () => {
    it("moves blocks along their path based on elapsed time", () => {
      spawnMovingBlocksAt([{ start: 0, end: 50 }]);
      const block = getMovingBlockNear(
        new Vector(
          (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
          Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
        ),
      )!;
      const initialX = block.actor.pos.x;

      // Update with a large delta to move the block
      updateMovingBlocks(1000);
      // Block should have moved
      expect(block.actor.pos.x !== initialX || block.actor.pos.y !== block.startPos.y).toBe(true);
    });

    it("applies movement delta to riders", () => {
      spawnMovingBlocksAt([{ start: 0, end: 50 }]);
      const block = getMovingBlockNear(
        new Vector(
          (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
          Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
        ),
      )!;

      const mockPlayer = {
        pos: { x: block.actor.pos.x, y: block.actor.pos.y },
      } as any;
      block.riders = [mockPlayer];

      const prevBlockX = block.actor.pos.x;
      const prevPlayerX = mockPlayer.pos.x;

      updateMovingBlocks(500);

      const blockDx = block.actor.pos.x - prevBlockX;
      // Player should have moved by the same delta
      expect(mockPlayer.pos.x).toBeCloseTo(prevPlayerX + blockDx, 5);
    });
  });

  describe("resetMovingBlocks", () => {
    it("clears riders from all blocks", () => {
      spawnMovingBlocksAt([{ start: 0, end: 10 }]);
      const block = getMovingBlockNear(
        new Vector(
          (0 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
          Math.floor(0 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2,
        ),
      )!;
      block.riders = [{} as any];

      resetMovingBlocks();
      expect(block.riders).toEqual([]);
    });
  });
});
