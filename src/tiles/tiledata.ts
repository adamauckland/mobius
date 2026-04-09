import type { IMapData } from "../levels/IMapData";
import { codeToTile } from "../levels/mapData";

// for tilemap creation, create tiles with a sprite info and
// a collider setting for Graph parsing

export const TILE_SIZE = 16;
export const GRID_COLS = 50;
export const GRID_ROWS = 50;

const grassTileIndices = [
	{ value: 2, weight: 1 },
	{ value: 1, weight: 3 },
	{ value: 0, weight: 6 },
];

function weightedRandom<T>(options: { value: T; weight: number }[]): T {
	const total = options.reduce((sum, o) => sum + o.weight, 0);
	let r = Math.random() * total;
	for (const o of options) {
		if ((r -= o.weight) <= 0) return o.value;
	}
	return options[options.length - 1].value; // fallback
}

export class Grass {
	sprite: number[];
	collider: boolean = false;
	constructor() {
		this.sprite = [weightedRandom(grassTileIndices), 0];
	}
}

export class Tree {
	sprite = [3, 0];
	collider: boolean = true;
}

export class Void {
	sprite = [0, 0]; // not rendered, acts as edge of world
	collider: boolean = true;
}

export class Portal {
	sprite = [0, 0]; // base grass sprite, overlay added separately
	collider: boolean = false;
}

export class Barrier {
	sprite = [0, 0]; // grass base, overlay added as separate Actor
	collider: boolean = true;
	groupId: number;
	constructor(groupId: number) {
		this.groupId = groupId;
	}
}

export class Switch {
	sprite = [0, 0]; // grass base, overlay added as separate Actor
	collider: boolean = false;
	groupId: number;
	activated: boolean = false;
	constructor(groupId: number) {
		this.groupId = groupId;
	}
}

export class Fence {
	sprite = [0, 0]; // grass base, overlay chosen by auto-tiling
	collider: boolean = true;
}

export type Direction = "up" | "down" | "left" | "right";

export class OneWayGate {
	sprite = [0, 0]; // grass base, overlay added as separate Actor
	collider: boolean = false;
	direction: Direction;
	constructor(direction: Direction) {
		this.direction = direction;
	}
}

export class DropZone {
	sprite = [0, 0]; // grass base, overlay added as separate Actor
	collider: boolean = true; // impassable until correct parcel placed
	id: number; // which parcel belongs here
	fulfilled: boolean = false;
	constructor(id: number) {
		this.id = id;
	}
}

export class ExitDoor {
	sprite = [0, 0]; // grass base, overlay added as separate Actor
	collider: boolean = false;
}

export type TileType =
	| Grass
	| Tree
	| Void
	| Portal
	| Barrier
	| Switch
	| Fence
	| OneWayGate
	| DropZone
	| ExitDoor;

export let tiles: TileType[] = [];
export let portalTileIndices: number[] = [];
export let exitDoorTileIndices: number[] = [];
export let dropZoneTileIndices: number[] = [];
export let customStartTile: number | null = null;

// Start position — center of the map (pixel coordinates)
export const START_TILE_X = Math.floor(GRID_COLS / 2);
export const START_TILE_Y = Math.floor(GRID_ROWS / 2);
export const START_POS_X = START_TILE_X * TILE_SIZE + TILE_SIZE / 2;
export const START_POS_Y = START_TILE_Y * TILE_SIZE + TILE_SIZE / 2;
export const START_TILE_INDEX = START_TILE_X + START_TILE_Y * GRID_COLS;

/** Load a hand-crafted map from editor data. */
export function loadWorld(map: IMapData) {
	const total = map.cols * map.rows;
	const result: TileType[] = [];
	const portalIndices: number[] = [];
	const exitDoorIndices: number[] = [];
	const dzIndices: number[] = [];

	for (let i = 0; i < total; i++) {
		const code = map.tiles[i] || "g";
		const info = codeToTile(code);
		switch (info.type) {
			case "grass":
				result.push(new Grass());
				break;
			case "tree":
				result.push(new Tree());
				break;
			case "void":
				result.push(new Void());
				break;
			case "portal":
				result.push(new Portal());
				portalIndices.push(i);
				break;
			case "barrier":
				result.push(new Barrier(info.groupId));
				break;
			case "switch":
				result.push(new Switch(info.groupId));
				break;
			case "fence":
				result.push(new Fence());
				break;
			case "oneWayGate":
				result.push(new OneWayGate(info.direction));
				break;
			case "dropZone":
				result.push(new DropZone(info.id));
				dzIndices[info.id] = i;
				break;
			case "exitDoor":
				result.push(new ExitDoor());
				exitDoorIndices.push(i);
				break;
		}
	}

	tiles = result;
	portalTileIndices = portalIndices;
	exitDoorTileIndices = exitDoorIndices;
	dropZoneTileIndices = dzIndices;
	customStartTile = map.startTile;
}
