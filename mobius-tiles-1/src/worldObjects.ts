import { Actor, Vector } from "excalibur";
import { rlSS } from "./resources";
import { GRID_COLS, Grass, tiles, seededRandom } from "./tiledata";
import { game } from "./game";
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
      z: 1,
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
