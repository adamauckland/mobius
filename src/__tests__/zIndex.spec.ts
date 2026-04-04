import { describe, it, expect } from "vitest";
import {
  zFromY,
  Z_LAYER_TREE,
  Z_LAYER_PICKUP,
  Z_LAYER_PLAYER,
  Z_LAYER_ROCK,
  Z_RIPPLE,
  Z_HUD,
  Z_COUNTDOWN,
} from "../zIndex";

describe("zFromY", () => {
  it("returns y * 10 + layer", () => {
    expect(zFromY(0, 0)).toBe(0);
    expect(zFromY(10, 0)).toBe(100);
    expect(zFromY(10, 3)).toBe(103);
    expect(zFromY(100, Z_LAYER_PLAYER)).toBe(1003);
  });

  it("orders layers correctly within the same y", () => {
    const y = 50;
    const tree = zFromY(y, Z_LAYER_TREE);
    const pickup = zFromY(y, Z_LAYER_PICKUP);
    const player = zFromY(y, Z_LAYER_PLAYER);
    const rock = zFromY(y, Z_LAYER_ROCK);

    expect(tree).toBeLessThan(pickup);
    expect(pickup).toBeLessThan(player);
    expect(player).toBeLessThan(rock);
  });

  it("orders objects at higher y in front of lower y", () => {
    // Even the highest layer at y=10 should be behind the lowest layer at y=20
    const rockAtY10 = zFromY(10, Z_LAYER_ROCK);
    const treeAtY20 = zFromY(20, Z_LAYER_TREE);
    expect(rockAtY10).toBeLessThan(treeAtY20);
  });
});

describe("z-index constants", () => {
  it("has correct layer values", () => {
    expect(Z_LAYER_TREE).toBe(1);
    expect(Z_LAYER_PICKUP).toBe(2);
    expect(Z_LAYER_PLAYER).toBe(3);
    expect(Z_LAYER_ROCK).toBe(4);
  });

  it("has UI layers far above game layers", () => {
    // Max game world Y is ~800px (50 rows * 16px)
    const maxGameZ = zFromY(800, Z_LAYER_ROCK);
    expect(Z_RIPPLE).toBeGreaterThan(maxGameZ);
    expect(Z_HUD).toBeGreaterThan(Z_RIPPLE);
    expect(Z_COUNTDOWN).toBeGreaterThan(Z_HUD);
  });
});
