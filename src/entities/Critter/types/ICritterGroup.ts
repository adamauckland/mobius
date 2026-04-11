import { ICritter } from "./ICritter";

export interface ICritterGroup {
	originTile: number; // tile index where the group was spawned
	critters: ICritter[];
}
