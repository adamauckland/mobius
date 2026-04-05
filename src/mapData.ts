import type { Direction } from "./tiledata";

export interface MapData {
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

// Tile code encoding/decoding
export type TileInfo =
  | { type: "grass" }
  | { type: "tree" }
  | { type: "portal" }
  | { type: "barrier"; groupId: number }
  | { type: "switch"; groupId: number }
  | { type: "fence" }
  | { type: "oneWayGate"; direction: Direction }
  | { type: "dropZone"; id: number }
  | { type: "exitDoor" };

export function tileToCode(info: TileInfo): string {
  switch (info.type) {
    case "grass": return "g";
    case "tree": return "T";
    case "portal": return "P";
    case "barrier": return "B" + info.groupId;
    case "switch": return "S" + info.groupId;
    case "fence": return "F";
    case "oneWayGate":
      switch (info.direction) {
        case "right": return ">";
        case "left": return "<";
        case "up": return "^";
        case "down": return "v";
      }
      break;
    case "dropZone": return "D" + info.id;
    case "exitDoor": return "E";
  }
  return "g";
}

export function codeToTile(code: string): TileInfo {
  if (code === "g") return { type: "grass" };
  if (code === "T") return { type: "tree" };
  if (code === "P") return { type: "portal" };
  if (code.startsWith("B")) return { type: "barrier", groupId: parseInt(code.slice(1)) || 0 };
  if (code.startsWith("S")) return { type: "switch", groupId: parseInt(code.slice(1)) || 0 };
  if (code === "F") return { type: "fence" };
  if (code === ">") return { type: "oneWayGate", direction: "right" };
  if (code === "<") return { type: "oneWayGate", direction: "left" };
  if (code === "^") return { type: "oneWayGate", direction: "up" };
  if (code === "v") return { type: "oneWayGate", direction: "down" };
  if (code.startsWith("D")) return { type: "dropZone", id: parseInt(code.slice(1)) || 0 };
  if (code === "E") return { type: "exitDoor" };
  return { type: "grass" };
}

export function createEmptyMap(cols: number, rows: number): MapData {
  const tiles: string[] = [];
  for (let i = 0; i < cols * rows; i++) {
    tiles.push("g");
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
    timeLimit: 60000,
  };
}

export function serializeMap(map: MapData): string {
  return JSON.stringify(map);
}

export function deserializeMap(json: string): MapData {
  const data = JSON.parse(json);
  return {
    name: data.name ?? "Untitled",
    cols: data.cols ?? 0,
    rows: data.rows ?? 0,
    startTile: data.startTile ?? 0,
    tiles: Array.isArray(data.tiles) ? data.tiles : [],
    rocks: Array.isArray(data.rocks) ? data.rocks : [],
    collectables: Array.isArray(data.collectables) ? data.collectables : [],
    parcels: Array.isArray(data.parcels) ? data.parcels : [],
    monsters: Array.isArray(data.monsters) ? data.monsters : [],
    movingBlocks: Array.isArray(data.movingBlocks) ? data.movingBlocks : [],
    timeLimit: typeof data.timeLimit === "number" ? data.timeLimit : 60000,
  };
}
