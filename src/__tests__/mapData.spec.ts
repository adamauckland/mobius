import { describe, it, expect } from "vitest";
import {
	codeToTile,
	createEmptyMap,
	serializeMap,
	deserializeMap,
} from "@/levels/mapData";
import { type IMapData } from "@/interfaces/IMapData";

describe("codeToTile (legacy decode)", () => {
	it("decodes 'g' as grass", () => {
		expect(codeToTile("g")).toEqual({ type: "grass" });
	});

	it("decodes 'T' as tree", () => {
		expect(codeToTile("T")).toEqual({ type: "tree" });
	});

	it("decodes 'P' as portal", () => {
		expect(codeToTile("P")).toEqual({ type: "portal" });
	});

	it("decodes barrier codes", () => {
		expect(codeToTile("B0")).toEqual({ type: "barrier", groupId: 0 });
		expect(codeToTile("B3")).toEqual({ type: "barrier", groupId: 3 });
	});

	it("decodes switch codes", () => {
		expect(codeToTile("S1")).toEqual({ type: "switch", groupId: 1 });
		expect(codeToTile("S5")).toEqual({ type: "switch", groupId: 5 });
	});

	it("decodes 'F' as fence", () => {
		expect(codeToTile("F")).toEqual({ type: "fence" });
	});

	it("decodes direction codes as oneWayGate", () => {
		expect(codeToTile(">")).toEqual({ type: "oneWayGate", direction: "right" });
		expect(codeToTile("<")).toEqual({ type: "oneWayGate", direction: "left" });
		expect(codeToTile("^")).toEqual({ type: "oneWayGate", direction: "up" });
		expect(codeToTile("v")).toEqual({ type: "oneWayGate", direction: "down" });
	});

	it("decodes dropZone codes", () => {
		expect(codeToTile("D0")).toEqual({ type: "dropZone", id: 0 });
		expect(codeToTile("D2")).toEqual({ type: "dropZone", id: 2 });
	});

	it("returns grass for unknown codes", () => {
		expect(codeToTile("X")).toEqual({ type: "grass" });
		expect(codeToTile("")).toEqual({ type: "grass" });
		expect(codeToTile("ZZZ")).toEqual({ type: "grass" });
	});

	it("defaults groupId to 0 when missing number after B/S", () => {
		expect(codeToTile("B")).toEqual({ type: "barrier", groupId: 0 });
		expect(codeToTile("S")).toEqual({ type: "switch", groupId: 0 });
	});

	it("defaults dropZone id to 0 when missing number after D", () => {
		expect(codeToTile("D")).toEqual({ type: "dropZone", id: 0 });
	});
});

describe("createEmptyMap", () => {
	it("creates a map with correct dimensions", () => {
		const map = createEmptyMap(10, 8);
		expect(map.cols).toBe(10);
		expect(map.rows).toBe(8);
		expect(map.tiles).toHaveLength(80);
	});

	it("fills all tiles with grass", () => {
		const map = createEmptyMap(5, 5);
		expect(map.tiles.every((t) => t.type === "grass")).toBe(true);
	});

	it("sets startTile to center of map", () => {
		const map = createEmptyMap(10, 10);
		// Math.floor(10/2) + Math.floor(10/2) * 10 = 5 + 50 = 55
		expect(map.startTile).toBe(55);
	});

	it("has empty entity arrays", () => {
		const map = createEmptyMap(3, 3);
		expect(map.rocks).toEqual([]);
		expect(map.collectables).toEqual([]);
		expect(map.parcels).toEqual([]);
		expect(map.monsters).toEqual([]);
		expect(map.movingBlocks).toEqual([]);
		expect(map.critters).toEqual([]);
	});

	it("has default name 'Untitled'", () => {
		const map = createEmptyMap(1, 1);
		expect(map.name).toBe("Untitled");
	});
});

describe("serializeMap / deserializeMap", () => {
	it("round-trips a complete map", () => {
		const map: IMapData = {
			name: "Test Map",
			cols: 5,
			rows: 5,
			startTile: 12,
			tiles: [
				{ type: "grass" },
				{ type: "tree" },
				{ type: "portal" },
				{ type: "barrier", groupId: 0 },
				{ type: "switch", groupId: 1 },
				{ type: "fence" },
				{ type: "oneWayGate", direction: "right" },
				{ type: "oneWayGate", direction: "left" },
				{ type: "oneWayGate", direction: "up" },
				{ type: "oneWayGate", direction: "down" },
				{ type: "dropZone", id: 0 },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
				{ type: "grass" },
			],
			rocks: [3, 7],
			collectables: [1, 4],
			parcels: [{ id: 0, tile: 5 }],
			monsters: [{ start: 10, end: 20 }],
			movingBlocks: [{ start: 15, end: 25 }],
			critters: [6],
			timeLimit: 60000,
			instructions: "Tap grass to move",
		};
		const json = serializeMap(map);
		const restored = deserializeMap(json);
		expect(restored).toEqual(map);
	});

	it("decodes legacy string-coded tiles on load", () => {
		const json = JSON.stringify({
			name: "Legacy",
			cols: 3,
			rows: 1,
			startTile: 0,
			tiles: ["g", "T", "B2"],
			rocks: [],
			collectables: [],
			parcels: [],
			monsters: [],
			movingBlocks: [],
			critters: [],
			timeLimit: 60000,
		});
		const restored = deserializeMap(json);
		expect(restored.tiles).toEqual([
			{ type: "grass" },
			{ type: "tree" },
			{ type: "barrier", groupId: 2 },
		]);
	});

	it("handles missing fields with defaults", () => {
		const restored = deserializeMap("{}");
		expect(restored.name).toBe("Untitled");
		expect(restored.cols).toBe(0);
		expect(restored.rows).toBe(0);
		expect(restored.startTile).toBe(0);
		expect(restored.tiles).toEqual([]);
		expect(restored.rocks).toEqual([]);
		expect(restored.collectables).toEqual([]);
		expect(restored.parcels).toEqual([]);
		expect(restored.monsters).toEqual([]);
		expect(restored.movingBlocks).toEqual([]);
		expect(restored.critters).toEqual([]);
	});

	it("handles non-array fields gracefully", () => {
		const json = JSON.stringify({
			name: "Bad",
			cols: 1,
			rows: 1,
			startTile: 0,
			tiles: "not an array",
			rocks: 42,
			collectables: null,
		});
		const restored = deserializeMap(json);
		expect(restored.tiles).toEqual([]);
		expect(restored.rocks).toEqual([]);
		expect(restored.collectables).toEqual([]);
	});

	it("throws on invalid JSON", () => {
		expect(() => deserializeMap("not json")).toThrow();
	});
});
