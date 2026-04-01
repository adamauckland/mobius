import { Actor, Vector } from "excalibur";
import { rlSS } from "./resources";
import { GRID_COLS, Grass, tiles, seededRandom, START_TILE_INDEX } from "./tiledata";
import { game } from "./game";
import { Z_ROCKS, Z_COLLECTABLES } from "./zIndex";
import { Player } from "./chap";

export interface Rock {
  actor: Actor;
  originTileIndex: number;
  tileIndex: number;
  carriedBy: Player | null;
}

const rocks: Rock[] = [];

export function getRocks() {
  return rocks;
}

// Find the rock at a given tile, if any (and not currently carried)
export function getRockAtTile(tileIndex: number): Rock | undefined {
  return rocks.find((r) => r.tileIndex === tileIndex && !r.carriedBy);
}

// Pick up a rock — it follows the player
export function pickUpRock(rock: Rock, player: Player) {
  rock.carriedBy = player;
  player.carriedRock = rock;
}

// Drop a rock at the player's current logical tile
export function dropRock(player: Player) {
  dropRockAtTile(player, player.logicalTileIndex);
}

// Drop a rock at a specific tile
export function dropRockAtTile(player: Player, tileIndex: number) {
  const rock = player.carriedRock;
  if (!rock) return;
  rock.carriedBy = null;
  rock.tileIndex = tileIndex;
  player.carriedRock = null;
  const x = tileIndex % GRID_COLS;
  const y = Math.floor(tileIndex / GRID_COLS);
  rock.actor.pos.x = x * 16 + 8;
  rock.actor.pos.y = y * 16 + 8;
}

// Reset all rocks to their original positions
export function resetRocks() {
  for (const rock of rocks) {
    rock.tileIndex = rock.originTileIndex;
    rock.carriedBy = null;
    const x = rock.originTileIndex % GRID_COLS;
    const y = Math.floor(rock.originTileIndex / GRID_COLS);
    rock.actor.pos.x = x * 16 + 8;
    rock.actor.pos.y = y * 16 + 8;
  }
}

// Create rocks at random grass tiles (not spawn, not portal)
export function spawnRocks(count: number) {
  const validIndices = tiles
    .map((t, i) => (t instanceof Grass && i !== 0 ? i : -1))
    .filter((i) => i !== -1);

  for (let n = 0; n < count; n++) {
    if (validIndices.length === 0) break;
    const pick = Math.floor(seededRandom() * validIndices.length);
    const tileIdx = validIndices.splice(pick, 1)[0];

    const x = tileIdx % GRID_COLS;
    const y = Math.floor(tileIdx / GRID_COLS);

    const actor = new Actor({
      pos: new Vector(x * 16 + 8, y * 16 + 8),
      width: 16,
      height: 16,
      z: Z_ROCKS,
    });
    actor.graphics.use(rlSS.getSprite(1, 28)); // rock sprite from roguelike sheet

    const rock: Rock = {
      actor,
      originTileIndex: tileIdx,
      tileIndex: tileIdx,
      carriedBy: null,
    };
    rocks.push(rock);
    game.add(actor);
  }
}

// --- Collectables ---

export interface Collectable {
  actor: Actor;
  tileIndex: number;
  collected: boolean;
}

const collectables: Collectable[] = [];

let score = 0;

export function getScore() {
  return score;
}

// Check if a collectable is at this tile and collect it (permanently)
export function tryCollectAtTile(tileIndex: number): boolean {
  const c = collectables.find((c) => c.tileIndex === tileIndex && !c.collected);
  if (!c) return false;
  c.collected = true;
  c.actor.kill();
  score += 100;
  return true;
}

export function getCollectableCount(): { total: number; collected: number } {
  return {
    total: collectables.length,
    collected: collectables.filter((c) => c.collected).length,
  };
}

// Spawn collectables — these persist across rewinds once collected
export function spawnCollectables(count: number) {
  // Build valid indices excluding start tile, rocks, and portal
  const rockTiles = new Set(rocks.map((r) => r.originTileIndex));
  const validIndices = tiles
    .map((t, i) =>
      t instanceof Grass && i !== START_TILE_INDEX && !rockTiles.has(i) ? i : -1,
    )
    .filter((i) => i !== -1);

  for (let n = 0; n < count; n++) {
    if (validIndices.length === 0) break;
    const pick = Math.floor(seededRandom() * validIndices.length);
    const tileIdx = validIndices.splice(pick, 1)[0];

    const x = tileIdx % GRID_COLS;
    const y = Math.floor(tileIdx / GRID_COLS);

    const actor = new Actor({
      pos: new Vector(x * 16 + 8, y * 16 + 8),
      width: 16,
      height: 16,
      z: Z_COLLECTABLES,
    });
    actor.graphics.use(rlSS.getSprite(11, 28)); // gem/coin sprite
    // Gentle bob animation
    const phase = seededRandom() * Math.PI * 2;
    actor.graphics.onPreDraw = () => {
      actor.graphics.offset.y = Math.sin(Date.now() * 0.003 + phase) * 2;
    };

    const collectable: Collectable = {
      actor,
      tileIndex: tileIdx,
      collected: false,
    };
    collectables.push(collectable);
    game.add(actor);
  }
}
