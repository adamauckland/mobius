import { Actor, Vector, vec, TileMap } from "excalibur";
import { rlSS } from "../resources/resources";
import {
	tiles,
	Barrier,
	Switch,
	GRID_COLS,
	TILE_SIZE,
} from "../tiles/tiledata";
import { game } from "../game";
import { zFromY, Z_LAYER_TREE, Z_LAYER_PICKUP } from "../ui/zIndex";
import { rebuildPathfinding } from "../ui/pathfinding";
import { spawnLight } from "./lightTrail";
import { sfxSwitch } from "../audio/sounds";
import { IBarrierEntry } from "../interfaces/IBarrierEntry";
import { gameEventBus } from "../events/GameEventBus";

const barrierActors: IBarrierEntry[] = [];
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
				pos: new Vector(
					x * TILE_SIZE + TILE_SIZE / 2,
					y * TILE_SIZE + TILE_SIZE / 2,
				),
				width: TILE_SIZE,
				height: TILE_SIZE,
				z: zFromY(y * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_TREE),
			});
			actor.graphics.use(rlSS.getSprite(33, 3)); // barrier wall sprite
			barrierActors.push({ actor, tileIndex: i, groupId: tile.groupId });
			game.add(actor);
		} else if (tile instanceof Switch) {
			const actor = new Actor({
				pos: new Vector(
					x * TILE_SIZE + TILE_SIZE / 2,
					y * TILE_SIZE + TILE_SIZE / 2,
				),
				width: TILE_SIZE,
				height: TILE_SIZE,
				z: zFromY(y * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
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

// --- Event handlers ---

/** Handle the switch:activate event. Validates the tile, performs visual
 *  changes on the switch, and dispatches barrier:open for matching barriers. */
function handleSwitchActivate({ tileIndex }: { tileIndex: number }) {
	const tile = tiles[tileIndex];
	if (!(tile instanceof Switch) || tile.activated) return;

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
	const switchPos = new Vector(
		sx * TILE_SIZE + TILE_SIZE / 2,
		sy * TILE_SIZE + TILE_SIZE / 2,
	);
	for (const b of barrierActors) {
		if (b.groupId === groupId) {
			spawnLight(switchPos, b.actor.pos.clone(), 1000);
		}
	}

	// Dispatch barrier:open (not recorded — it cascades from switch:activate)
	gameEventBus.dispatch("barrier:open", { groupId });
}

/** Handle the barrier:open event. Opens all barriers in the group,
 *  animates them away, and rebuilds pathfinding. */
function handleBarrierOpen({ groupId }: { groupId: number }) {
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
			b.actor.actions.scaleTo(vec(0, 0), vec(3, 3)).callMethod(() => {
				b.actor.graphics.visible = false;
			});
		}
	}

	// Rebuild pathfinding so newly-opened tiles are walkable
	rebuildPathfinding();
}

/** Subscribe barrier event handlers to the game event bus. */
export function setupBarrierEvents() {
	gameEventBus.on("switch:activate", handleSwitchActivate);
	gameEventBus.on("barrier:open", handleBarrierOpen);
}

/** Unsubscribe barrier event handlers from the game event bus. */
export function teardownBarrierEvents() {
	gameEventBus.off("switch:activate", handleSwitchActivate);
	gameEventBus.off("barrier:open", handleBarrierOpen);
}
