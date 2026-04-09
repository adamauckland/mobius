export interface IMapData {
	name: string;
	cols: number;
	rows: number;
	startTile: number;
	tiles: string[]; // compact tile codes: "g","T","P","B0","S1","F",">","<","^","v","D0", etc.
	rocks: number[];
	collectables: number[];
	parcels: { id: number; tile: number }[];
	monsters: { start: number; end: number }[];
	movingBlocks: { start: number; end: number }[];
	timeLimit: number; // ms before time rewind triggers (0 = no limit)
}
