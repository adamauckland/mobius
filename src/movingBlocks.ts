import { Actor, Vector } from "excalibur";
import { rlSS } from "./resources";
import {
  GRID_COLS,
  GRID_ROWS,
  Grass,
  tiles,
  seededRandom,
  START_TILE_INDEX,
} from "./tiledata";
import { game } from "./game";
import { zFromY, Z_LAYER_PICKUP } from "./zIndex";
import type { Player } from "./chap";

/** Accumulated elapsed time — advances only via delta, so pauses are excluded. */
let blockElapsed = 0;

/** Call when the game rewinds so blocks repeat from the same relative time. */
export function resetMovingBlocks() {
  blockElapsed = 0;
  for (const block of movingBlocks) {
    block.riders = [];
  }
}

export interface MovingBlock {
  actor: Actor;
  startPos: Vector;
  endPos: Vector;
  phase: number;
  speed: number;
  riders: Player[];
}

const movingBlocks: MovingBlock[] = [];

/** Ping-pong oscillation: 0→1→0→1… */
function pingPong(t: number): number {
  const cycle = ((t % 2) + 2) % 2;
  return cycle <= 1 ? cycle : 2 - cycle;
}

/** Find a moving block within a few pixels of a world position. */
export function getMovingBlockNear(pos: Vector): MovingBlock | undefined {
  const MOUNT_RADIUS_SQ = 6 * 6; // 6 px — close enough to feel seamless
  return movingBlocks.find((block) => {
    const dx = block.actor.pos.x - pos.x;
    const dy = block.actor.pos.y - pos.y;
    return dx * dx + dy * dy <= MOUNT_RADIUS_SQ;
  });
}

/** Mount a player onto a moving block. */
export function mountBlock(block: MovingBlock, player: Player) {
  block.riders.push(player);
  player.ridingBlock = block;
  player.playerActionBuffer = [];
  player.actions.clearActions();
}

/**
 * Dismount a player from a moving block.
 * Returns false if the player is over a solid tile and can't dismount.
 */
export function dismountBlock(player: Player): boolean {
  const block = player.ridingBlock;
  if (!block) return false;

  const tx = Math.floor(player.pos.x / 16);
  const ty = Math.floor(player.pos.y / 16);
  const currentTile = tx + ty * GRID_COLS;

  if (currentTile < 0 || currentTile >= GRID_COLS * GRID_ROWS) return false;
  if (tiles[currentTile].collider) return false;

  block.riders = block.riders.filter((r) => r !== player);
  player.ridingBlock = null;

  // Snap to tile centre
  player.pos.x = tx * 16 + 8;
  player.pos.y = ty * 16 + 8;
  player.logicalTileIndex = currentTile;
  player.currentMoveTileIndex = currentTile;

  return true;
}

/** Spawn moving blocks at random positions with random paths. */
export function spawnMovingBlocks(count: number) {
  blockElapsed = 0;
  for (let n = 0; n < count; n++) {
    const validIndices = tiles
      .map((t, i) => (t instanceof Grass && i !== START_TILE_INDEX ? i : -1))
      .filter((i) => i !== -1);

    if (validIndices.length === 0) break;

    const startIdx =
      validIndices[Math.floor(seededRandom() * validIndices.length)];
    const startX = startIdx % GRID_COLS;
    const startY = Math.floor(startIdx / GRID_COLS);

    const horizontal = seededRandom() < 0.5;
    const distance = 5 + Math.floor(seededRandom() * 8); // 5–12 tiles

    const endX = Math.min(
      horizontal ? startX + distance : startX,
      GRID_COLS - 2,
    );
    const endY = Math.min(
      horizontal ? startY : startY + distance,
      GRID_ROWS - 2,
    );

    const startPos = new Vector(startX * 16 + 8, startY * 16 + 8);
    const endPos = new Vector(endX * 16 + 8, endY * 16 + 8);

    const actor = new Actor({
      pos: startPos.clone(),
      width: 16,
      height: 16,
      z: zFromY(startY * 16 + 8, Z_LAYER_PICKUP),
    });
    actor.graphics.use(rlSS.getSprite(4, 0)); // stone platform sprite

    const block: MovingBlock = {
      actor,
      startPos,
      endPos,
      phase: seededRandom() * 2,
      speed: 0.0003 + seededRandom() * 0.0002, // ~3–5 s per traverse
      riders: [],
    };
    movingBlocks.push(block);
    game.add(actor);
  }
}

/** Update every moving block position (call once per frame). */
export function updateMovingBlocks(delta: number) {
  blockElapsed += delta;

  for (const block of movingBlocks) {
    const progress = pingPong(blockElapsed * block.speed + block.phase);

    const newX =
      block.startPos.x + (block.endPos.x - block.startPos.x) * progress;
    const newY =
      block.startPos.y + (block.endPos.y - block.startPos.y) * progress;

    // Apply the block's movement delta to riders — no snap on mount
    const dx = newX - block.actor.pos.x;
    const dy = newY - block.actor.pos.y;
    for (const rider of block.riders) {
      rider.pos.x += dx;
      rider.pos.y += dy;
    }

    block.actor.pos.x = newX;
    block.actor.pos.y = newY;
    block.actor.z = zFromY(block.actor.pos.y, Z_LAYER_PICKUP);
  }
}
