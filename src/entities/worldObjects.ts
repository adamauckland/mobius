import { Actor, Vector, TileMap } from "excalibur";
import { rlSS } from "../resources/resources";
import {
	TILE_SIZE,
	GRID_COLS,
	DropZone,
	tiles,
	dropZoneTileIndices,
} from "../tiles/tiledata";
import { game } from "../game";
import { zFromY, Z_LAYER_PICKUP, Z_LAYER_ROCK } from "../ui/zIndex";
import { spawnLight, spawnScoreLight } from "./lightTrail";
import {
	sfxCollect,
	sfxPickUpRock,
	sfxDropRock,
	sfxPickUpParcel,
	sfxDropParcel,
	sfxParcelPlaced,
} from "../audio/sounds";
import { PlayerActor } from "./Player/PlayerActor";
import { rebuildPathfinding } from "../ui/pathfinding";
import { IRock } from "../interfaces/IRock";

let tileMapRef: TileMap;

export function initWorldObjectsTileMap(tilemap: TileMap) {
	tileMapRef = tilemap;
}

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

// --- Collectables ---

export interface ICollectable {
	actor: Actor;
	tileIndex: number;
	collected: boolean;
}

const collectables: ICollectable[] = [];

let score = 0;

export function getScore() {
	return score;
}

export function addScore(points: number) {
	score += points;
}

// Check if a collectable is at this tile and collect it (permanently)
export function tryCollectAtTile(tileIndex: number): boolean {
	const c = collectables.find((c) => c.tileIndex === tileIndex && !c.collected);
	if (!c) return false;
	c.collected = true;
	spawnScoreLight(c.actor.pos.clone());
	c.actor.kill();
	score += 100;
	sfxCollect();
	return true;
}

export function getCollectableCount(): { total: number; collected: number } {
	return {
		total: collectables.length,
		collected: collectables.filter((c) => c.collected).length,
	};
}

/** Spawn collectables at specific tile indices (for custom maps). */
export function spawnCollectablesAt(indices: number[]) {
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
			z: zFromY(y * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
		});
		actor.graphics.use(rlSS.getSprite(45, 10));
		const phase = Math.random() * Math.PI * 2;
		actor.graphics.onPreDraw = () => {
			actor.graphics.offset.y = Math.sin(game.clock.now() * 0.003 + phase) * 2;
		};
		const collectable: ICollectable = {
			actor,
			tileIndex: tileIdx,
			collected: false,
		};
		collectables.push(collectable);
		game.add(actor);
	}
}

// --- Parcels (carryable objects that must be placed on a DropZone) ---

export interface Parcel {
	actor: Actor;
	id: number; // matches DropZone.id
	originTileIndex: number;
	tileIndex: number;
	carriedBy: PlayerActor | null;
	placed: boolean; // true when correctly placed on its drop zone
	lightInterval: number | null;
}

const parcels: Parcel[] = [];

// Each parcel uses a distinct item sprite
// [col, row] into the roguelike spritesheet
export const PARCEL_SPRITES: [number, number][] = [
	[45, 10], // gem
	[41, 9], // key
	[43, 8], // potion
];

// Drop zones use distinct receptacle/container sprites so they aren't confused with parcels
export const DROPZONE_SPRITES: [number, number][] = [
	[45, 7], // chest/container for gem
	[41, 11], // scroll/pedestal for key
	[43, 13], // crate/stand for potion
];

export function getParcels() {
	return parcels;
}

export function getParcelAtTile(tileIndex: number): Parcel | undefined {
	return parcels.find(
		(p) => p.tileIndex === tileIndex && !p.carriedBy && !p.placed,
	);
}

export function pickUpParcel(parcel: Parcel, player: PlayerActor) {
	parcel.carriedBy = player;
	player.carriedParcel = parcel;
	sfxPickUpParcel();

	// Light trail from pickup position to matching drop zone
	const dzTileIndex = dropZoneTileIndices[parcel.id];
	if (dzTileIndex !== undefined) {
		const dzX = (dzTileIndex % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
		const dzY = Math.floor(dzTileIndex / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
		spawnLight(parcel.actor.pos.clone(), new Vector(dzX, dzY), 1000);

		// Repeat the light trail while carrying, using game clock so it pauses with the game
		const scheduleNext = () => {
			parcel.lightInterval = game.clock.schedule(() => {
				if (parcel.carriedBy) {
					spawnLight(parcel.actor.pos.clone(), new Vector(dzX, dzY), 1000);
					scheduleNext();
				}
			}, 1000);
		};
		scheduleNext();
	}
}

function clearParcelLightInterval(parcel: Parcel) {
	if (!parcel.lightInterval) return;
	game.clock.clearSchedule(parcel.lightInterval!);
	parcel.lightInterval = null;
}

function positionActorAtTile(actor: Actor, tileIndex: number) {
	const x = tileIndex % GRID_COLS;
	const y = Math.floor(tileIndex / GRID_COLS);
	actor.pos.x = x * TILE_SIZE + TILE_SIZE / 2;
	actor.pos.y = y * TILE_SIZE + TILE_SIZE / 2;
}

function fulfillDropZone(parcel: Parcel, tileIndex: number) {
	const tile = tiles[tileIndex];
	if (!(tile instanceof DropZone) || tile.id !== parcel.id || tile.fulfilled) return false;
	parcel.placed = true;
	tile.fulfilled = true;
	tile.collider = false;
	if (tileMapRef) {
		tileMapRef.tiles[tileIndex].solid = false;
	}
	rebuildPathfinding();
	score += 500;
	sfxParcelPlaced();
	spawnScoreLight(parcel.actor.pos.clone(), 5);
	return true;
}

export function dropParcel(player: PlayerActor) {
	dropParcelAtTile(player, player.logicalTileIndex);
}

export function dropParcelAtTile(player: PlayerActor, tileIndex: number) {
	const parcel = player.carriedParcel;
	if (!parcel) return;
	clearParcelLightInterval(parcel);
	parcel.carriedBy = null;
	parcel.tileIndex = tileIndex;
	player.carriedParcel = null;
	positionActorAtTile(parcel.actor, tileIndex);

	if (!fulfillDropZone(parcel, tileIndex)) {
		sfxDropParcel();
	}
}

export function resetParcels() {
	for (const parcel of parcels) {
		clearParcelLightInterval(parcel);
		parcel.tileIndex = parcel.originTileIndex;
		parcel.carriedBy = null;
		parcel.placed = false;
		parcel.actor.graphics.visible = true;
		positionActorAtTile(parcel.actor, parcel.originTileIndex);
	}
	// Reset drop zone fulfilled state and re-block tiles
	for (const idx of dropZoneTileIndices) {
		const tile = tiles[idx];
		if (tile instanceof DropZone) {
			tile.fulfilled = false;
			tile.collider = true;
			if (tileMapRef) {
				tileMapRef.tiles[idx].solid = true;
			}
		}
	}
	rebuildPathfinding();
}

/** Spawn parcels at specific tile indices (for custom maps). */
export function spawnParcelsAt(entries: { id: number; tile: number }[]) {
	for (const entry of entries) {
		const x = entry.tile % GRID_COLS;
		const y = Math.floor(entry.tile / GRID_COLS);
		const actor = new Actor({
			pos: new Vector(
				x * TILE_SIZE + TILE_SIZE / 2,
				y * TILE_SIZE + TILE_SIZE / 2,
			),
			width: TILE_SIZE,
			height: TILE_SIZE,
			z: zFromY(y * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_ROCK),
		});
		const [sc, sr] = PARCEL_SPRITES[entry.id % PARCEL_SPRITES.length];
		actor.graphics.use(rlSS.getSprite(sc, sr));
		const parcel: Parcel = {
			actor,
			id: entry.id,
			originTileIndex: entry.tile,
			tileIndex: entry.tile,
			carriedBy: null,
			placed: false,
			lightInterval: null,
		};
		parcels.push(parcel);
		game.add(actor);
	}
}
