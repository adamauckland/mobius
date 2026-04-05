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
    width = 0;
    height = 0;
    z = 0;
    graphics = { use: vi.fn(), visible: true };
    constructor(options?: any) {
      this.pos = options?.pos
        ? new MockVector(options.pos.x, options.pos.y)
        : new MockVector();
    }
  }
  return { Actor: MockActor, Vector: MockVector };
});

vi.mock("../resources", () => ({
  rlSS: { getSprite: vi.fn() },
}));

const { mockGame, mockEntries } = vi.hoisted(() => ({
  mockGame: { add: vi.fn() },
  mockEntries: [] as any[],
}));

vi.mock("../game", () => ({
  game: mockGame,
}));

vi.mock("../zIndex", () => ({
  zFromY: (y: number, layer: number) => y * 10 + layer,
  Z_LAYER_PLAYER: 3,
}));

vi.mock("../playerManager", () => ({
  entries: mockEntries,
}));

import {
  spawnMonstersAt,
  resetMonsters,
  updateMonsters,
  setOnPlayerKilled,
} from "../monsters";
import { generateWorld, TILE_SIZE, GRID_COLS } from "../tiledata";

describe("monsters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntries.length = 0;
    generateWorld(42);
  });

  describe("spawnMonstersAt", () => {
    it("creates monsters at specified positions and adds them to the game", () => {
      spawnMonstersAt([
        { start: 0, end: 50 },
        { start: 100, end: 150 },
      ]);
      expect(mockGame.add).toHaveBeenCalledTimes(2);
    });

    it("positions monsters based on tile coordinates", () => {
      spawnMonstersAt([{ start: 5, end: 10 }]);
      const addedActor = mockGame.add.mock.calls[0][0];
      const startX = (5 % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
      const startY = Math.floor(5 / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
      expect(addedActor.pos.x).toBe(startX);
      expect(addedActor.pos.y).toBe(startY);
    });
  });

  describe("setOnPlayerKilled", () => {
    it("accepts a callback without throwing", () => {
      expect(() => setOnPlayerKilled(vi.fn())).not.toThrow();
    });
  });

  describe("updateMonsters", () => {
    it("updates monster positions based on elapsed time", () => {
      spawnMonstersAt([{ start: 0, end: 100 }]);
      const actor = mockGame.add.mock.calls[0][0];
      const initialX = actor.pos.x;
      const initialY = actor.pos.y;

      updateMonsters(2000);
      // Position should have changed (or at least not crash)
      const moved = actor.pos.x !== initialX || actor.pos.y !== initialY;
      // It's possible the position hasn't changed much depending on phase, but the function shouldn't crash
      expect(moved).toBe(true);
    });

    it("kills player when monster is close enough", () => {
      spawnMonstersAt([{ start: 51, end: 52 }]);
      const actor = mockGame.add.mock.calls[0][0];

      const killCb = vi.fn();
      setOnPlayerKilled(killCb);

      // Place a player at the exact same position as the monster
      const mockPlayer = {
        pos: { x: actor.pos.x, y: actor.pos.y },
        graphics: { visible: true },
      };
      mockEntries.push({ player: mockPlayer });

      // Update with 0 delta so monster doesn't move from its start pos
      updateMonsters(0);
      expect(killCb).toHaveBeenCalledWith(mockPlayer);
    });

    it("does not kill invisible players", () => {
      spawnMonstersAt([{ start: 51, end: 52 }]);
      const actor = mockGame.add.mock.calls[0][0];

      const killCb = vi.fn();
      setOnPlayerKilled(killCb);

      const mockPlayer = {
        pos: { x: actor.pos.x, y: actor.pos.y },
        graphics: { visible: false },
      };
      mockEntries.push({ player: mockPlayer });

      updateMonsters(0);
      expect(killCb).not.toHaveBeenCalled();
    });
  });

  describe("resetMonsters", () => {
    it("does not throw", () => {
      expect(() => resetMonsters()).not.toThrow();
    });
  });
});
