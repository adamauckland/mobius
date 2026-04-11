import { TileInfoType } from "../levels/TileInfoType";

export interface IMapData {
	name: string;
	cols: number;
	rows: number;
	startTile: number;
	tiles: TileInfoType[];
	rocks: number[];
	collectables: number[];
	parcels: { id: number; tile: number }[];
	monsters: { start: number; end: number }[];
	movingBlocks: { start: number; end: number }[];
	critters: number[]; // tile indices where critter groups (5 each) spawn
	timeLimit: number; // ms before time rewind triggers (0 = no limit)
}
