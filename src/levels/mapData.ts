import { IMapData } from "../interfaces/IMapData";
import { IProjectData } from "../interfaces/IProjectData";
import { TileInfoType } from "./TileInfoType";

/**
 * Decode a legacy compact tile code into a TileInfo. Maps used to store tiles
 * as short strings ("g", "T", "B0", ">", ...). New maps store TileInfo objects
 * directly, but `deserializeMap` still runs legacy entries through this so old
 * saved data continues to load.
 */
export function codeToTile(code: string): TileInfoType {
	if (code === "g") return { type: "grass" };
	if (code === "T") return { type: "tree" };
	if (code === "V") return { type: "void" };
	if (code === "P") return { type: "portal" };
	if (code.startsWith("B"))
		return { type: "barrier", groupId: parseInt(code.slice(1)) || 0 };
	if (code.startsWith("S"))
		return { type: "switch", groupId: parseInt(code.slice(1)) || 0 };
	if (code === "F") return { type: "fence" };
	if (code === ">") return { type: "oneWayGate", direction: "right" };
	if (code === "<") return { type: "oneWayGate", direction: "left" };
	if (code === "^") return { type: "oneWayGate", direction: "up" };
	if (code === "v") return { type: "oneWayGate", direction: "down" };
	if (code.startsWith("D"))
		return { type: "dropZone", id: parseInt(code.slice(1)) || 0 };
	if (code === "E") return { type: "exitDoor" };
	return { type: "grass" };
}

export function createEmptyMap(cols: number, rows: number): IMapData {
	const tiles: TileInfoType[] = [];
	for (let i = 0; i < cols * rows; i++) {
		tiles.push({ type: "grass" });
	}
	return {
		name: "Untitled",
		cols,
		rows,
		startTile: Math.floor(cols / 2) + Math.floor(rows / 2) * cols,
		tiles,
		rocks: [],
		collectables: [],
		parcels: [],
		monsters: [],
		movingBlocks: [],
		critters: [],
		timeLimit: 60000,
	};
}

export function serializeProject(project: IProjectData): string {
	return JSON.stringify(project);
}

export function deserializeProject(json: string): IProjectData {
	const data = JSON.parse(json);
	const levels: IMapData[] = Array.isArray(data.levels)
		? data.levels.map((l: unknown) => deserializeMap(JSON.stringify(l)))
		: [];
	if (levels.length === 0) {
		// Legacy single-map file — wrap it as a one-level project
		const single = deserializeMap(json);
		levels.push(single);
	}
	return { levels };
}

export function serializeMap(map: IMapData): string {
	return JSON.stringify(map);
}

function normalizeTile(entry: unknown): TileInfoType {
	if (typeof entry === "string") return codeToTile(entry);
	if (entry && typeof entry === "object" && "type" in entry) {
		return entry as TileInfoType;
	}
	return { type: "grass" };
}

export function deserializeMap(json: string): IMapData {
	const data = JSON.parse(json);
	return {
		name: data.name ?? "Untitled",
		cols: data.cols ?? 0,
		rows: data.rows ?? 0,
		startTile: data.startTile ?? 0,
		tiles: Array.isArray(data.tiles) ? data.tiles.map(normalizeTile) : [],
		rocks: Array.isArray(data.rocks) ? data.rocks : [],
		collectables: Array.isArray(data.collectables) ? data.collectables : [],
		parcels: Array.isArray(data.parcels) ? data.parcels : [],
		monsters: Array.isArray(data.monsters) ? data.monsters : [],
		movingBlocks: Array.isArray(data.movingBlocks) ? data.movingBlocks : [],
		critters: Array.isArray(data.critters) ? data.critters : [],
		timeLimit: typeof data.timeLimit === "number" ? data.timeLimit : 60000,
	};
}
