import { sfxPickUpRock, sfxDropRock } from "@/audio/sounds";
import { game } from "@/game";
import { IRock } from "@/interfaces/IRock";
import { rlSS } from "@/resources/resources";
import { GRID_COLS, TILE_SIZE } from "@/tiles/tiledata";
import { zFromY, Z_LAYER_ROCK } from "@/ui/zIndex";
import { Actor, Vector } from "excalibur";
import { PlayerActor } from "../Player/PlayerActor";

const rocks: IRock[] = [];

export function getRocks() {
	return rocks;
}
// Find the rock at a given tile, if any (and not currently carried)

export function getRockAtTile(tileIndex: number): IRock | undefined {
	return rocks.find((r) => r.tileIndex === tileIndex && !r.carriedBy);
}
// Pick up a rock — it follows the player

export function pickUpRock(rock: IRock, player: PlayerActor) {
	rock.carriedBy = player;
	player.carriedRock = rock;
	sfxPickUpRock();
}
// Drop a rock at the player's current logical tile

export function dropRock(player: PlayerActor) {
	dropRockAtTile(player, player.logicalTileIndex);
}
// Drop a rock at a specific tile

export function dropRockAtTile(player: PlayerActor, tileIndex: number) {
	const rock = player.carriedRock;
	if (!rock) return;
	rock.carriedBy = null;
	rock.tileIndex = tileIndex;
	player.carriedRock = null;
	const x = tileIndex % GRID_COLS;
	const y = Math.floor(tileIndex / GRID_COLS);
	rock.actor.pos.x = x * TILE_SIZE + TILE_SIZE / 2;
	rock.actor.pos.y = y * TILE_SIZE + TILE_SIZE / 2;
	sfxDropRock();
}
// Reset all rocks to their original positions

export function resetRocks() {
	for (const rock of rocks) {
		rock.tileIndex = rock.originTileIndex;
		rock.carriedBy = null;
		const x = rock.originTileIndex % GRID_COLS;
		const y = Math.floor(rock.originTileIndex / GRID_COLS);
		rock.actor.pos.x = x * TILE_SIZE + TILE_SIZE / 2;
		rock.actor.pos.y = y * TILE_SIZE + TILE_SIZE / 2;
	}
}
/** Spawn rocks at specific tile indices (for custom maps). */

export function spawnRocksAt(indices: number[]) {
	for (const tileIdx of indices) {
		const x = tileIdx % GRID_COLS;
		const y = Math.floor(tileIdx / GRID_COLS);
		const actor = new Actor({
			pos: new Vector(
				x * TILE_SIZE + TILE_SIZE / 2,
				y * TILE_SIZE + TILE_SIZE / 2,
			),
			width: TILE_SIZE,
			height: TILE_SIZE,
			z: zFromY(y * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_ROCK),
		});
		actor.graphics.use(rlSS.getSprite(30, 11));
		const rock: IRock = {
			actor,
			originTileIndex: tileIdx,
			tileIndex: tileIdx,
			carriedBy: null,
		};
		rocks.push(rock);
		game.add(actor);
	}
}
