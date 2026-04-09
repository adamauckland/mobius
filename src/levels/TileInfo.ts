import type { Direction } from "../tiles/tiledata";

// Tile code encoding/decoding

export type TileInfo =
	| { type: "grass" }
	| { type: "tree" }
	| { type: "void" }
	| { type: "portal" }
	| { type: "barrier"; groupId: number }
	| { type: "switch"; groupId: number }
	| { type: "fence" }
	| { type: "oneWayGate"; direction: Direction }
	| { type: "dropZone"; id: number }
	| { type: "exitDoor" };
