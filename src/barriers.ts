import { Actor, Vector, vec, TileMap } from "excalibur";
import { rlSS } from "./resources";
import { tiles, Barrier, Switch, GRID_COLS } from "./tiledata";
import { game } from "./game";
import { Z_BARRIERS } from "./zIndex";
import { rebuildPathfinding } from "./pathfinding";

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
        z: Z_BARRIERS,
      });
      actor.graphics.use(rlSS.getSprite(33, 3)); // barrier wall sprite
      barrierActors.push({ actor, tileIndex: i, groupId: tile.groupId });
      game.add(actor);
    } else if (tile instanceof Switch) {
      const actor = new Actor({
        pos: new Vector(x * 16 + 8, y * 16 + 8),
        width: 16,
        height: 16,
        z: Z_BARRIERS,
      });
      actor.graphics.use(rlSS.getSprite(42, 16)); // switch sprite
      // Gentle bob so the player notices it
      const phase = Math.random() * Math.PI * 2;
      actor.graphics.onPreDraw = () => {
        actor.graphics.offset.y = Math.sin(Date.now() * 0.003 + phase) * 2;
      };
      switchActors.set(i, actor);
      game.add(actor);
    }
  }
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

  // Visual feedback on the switch itself
  const switchActor = switchActors.get(tileIndex);
  if (switchActor) {
    switchActor.graphics.use(rlSS.getSprite(43, 16)); // activated look
  }

  // Open every barrier in this group
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t instanceof Barrier && t.groupId === groupId) {
      t.collider = false;
      tileMapRef.tiles[i].solid = false;
    }
  }

  // Animate barrier actors away
  for (const b of barrierActors) {
    if (b.groupId === groupId) {
      b.actor.actions
        .scaleTo(vec(0, 0), vec(3, 3))
        .callMethod(() => b.actor.kill());
    }
  }

  // Rebuild pathfinding so newly-opened tiles are walkable
  rebuildPathfinding();

  return true;
}
