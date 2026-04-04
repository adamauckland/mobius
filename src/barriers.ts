import { Actor, Vector, vec, TileMap } from "excalibur";
import { rlSS } from "./resources";
import { tiles, Barrier, Switch, GRID_COLS } from "./tiledata";
import { game } from "./game";
import { zFromY, Z_LAYER_TREE, Z_LAYER_PICKUP } from "./zIndex";
import { rebuildPathfinding } from "./pathfinding";
import { spawnLight } from "./lightTrail";
import { sfxSwitch } from "./sounds";

interface BarrierEntry {
  actor: Actor;
  tileIndex: number;
  groupId: number;
}

const barrierActors: BarrierEntry[] = [];
const switchActors = new Map<number, Actor>(); // tileIndex → Actor
let tileMapRef: TileMap;

export function initBarriers(tilemap: TileMap) {
  tileMapRef = tilemap;
}

/** Create overlay actors for every Barrier and Switch tile. */
export function spawnBarriers() {
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const x = i % GRID_COLS;
    const y = Math.floor(i / GRID_COLS);

    if (tile instanceof Barrier) {
      const actor = new Actor({
        pos: new Vector(x * 16 + 8, y * 16 + 8),
        width: 16,
        height: 16,
        z: zFromY(y * 16 + 8, Z_LAYER_TREE),
      });
      actor.graphics.use(rlSS.getSprite(33, 3)); // barrier wall sprite
      barrierActors.push({ actor, tileIndex: i, groupId: tile.groupId });
      game.add(actor);
    } else if (tile instanceof Switch) {
      const actor = new Actor({
        pos: new Vector(x * 16 + 8, y * 16 + 8),
        width: 16,
        height: 16,
        z: zFromY(y * 16 + 8, Z_LAYER_PICKUP),
      });
      actor.graphics.use(rlSS.getSprite(42, 16)); // switch sprite
      switchActors.set(i, actor);
      game.add(actor);
    }
  }
}

/** Reset all barriers and switches to their initial state (for rewind). */
export function resetBarriers() {
  // Re-lock all barriers
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t instanceof Barrier) {
      t.collider = true;
      tileMapRef.tiles[i].solid = true;
    } else if (t instanceof Switch) {
      t.activated = false;
    }
  }

  // Restore barrier actors
  for (const b of barrierActors) {
    b.actor.actions.clearActions();
    b.actor.scale.x = 1;
    b.actor.scale.y = 1;
    b.actor.graphics.visible = true;
  }

  // Restore switch actor sprites
  for (const [, actor] of switchActors) {
    actor.graphics.use(rlSS.getSprite(42, 16)); // inactive look
  }

  rebuildPathfinding();
}

/**
 * Called when the player lands on a tile.
 * If it is an un-activated Switch, open every Barrier in the same group.
 */
export function tryActivateSwitch(tileIndex: number): boolean {
  const tile = tiles[tileIndex];
  if (!(tile instanceof Switch) || tile.activated) return false;

  tile.activated = true;
  const { groupId } = tile;
  sfxSwitch();

  // Visual feedback on the switch itself
  const switchActor = switchActors.get(tileIndex);
  if (switchActor) {
    switchActor.graphics.use(rlSS.getSprite(43, 16)); // activated look
  }

  // Light trail from switch to each barrier in the group
  const sx = tileIndex % GRID_COLS;
  const sy = Math.floor(tileIndex / GRID_COLS);
  const switchPos = new Vector(sx * 16 + 8, sy * 16 + 8);
  for (const b of barrierActors) {
    if (b.groupId === groupId) {
      spawnLight(switchPos, b.actor.pos.clone(), 1000);
    }
  }

  // Open every barrier in this group
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t instanceof Barrier && t.groupId === groupId) {
      t.collider = false;
      tileMapRef.tiles[i].solid = false;
    }
  }

  // Animate barrier actors away (hide, don't kill — needed for reset on rewind)
  for (const b of barrierActors) {
    if (b.groupId === groupId) {
      b.actor.actions.clearActions();
      b.actor.actions
        .scaleTo(vec(0, 0), vec(3, 3))
        .callMethod(() => {
          b.actor.graphics.visible = false;
        });
    }
  }

  // Rebuild pathfinding so newly-opened tiles are walkable
  rebuildPathfinding();

  return true;
}
