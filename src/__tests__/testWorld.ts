import { GRID_COLS, GRID_ROWS, loadWorld } from "@/tiles/tiledata";
import type { IMapData } from "@/interfaces/IMapData";
import type { TileInfoType } from "@/levels/TileInfoType";

/**
 * Build and load a 50x50 grass map for tests, with a few non-grass tiles
 * sprinkled in so tests that look for trees, fences, or barriers can find them.
 *
 * Layout (top-left of the grid):
 *   index 0 → Tree
 *   index 1 → Fence
 *   index 2 → Barrier (group 0)
 *   index 3 → Switch  (group 0)
 *   everything else → Grass
 */
export function setupTestWorld() {
	const tiles: TileInfoType[] = new Array(GRID_COLS * GRID_ROWS)
		.fill(null)
		.map(() => ({ type: "grass" }));
	tiles[0] = { type: "tree" };
	tiles[1] = { type: "fence" };
	tiles[2] = { type: "barrier", groupId: 0 };
	tiles[3] = { type: "switch", groupId: 0 };

	const map: IMapData = {
		name: "Test",
		cols: GRID_COLS,
		rows: GRID_ROWS,
		startTile:
			Math.floor(GRID_COLS / 2) + Math.floor(GRID_ROWS / 2) * GRID_COLS,
		tiles,
		rocks: [],
		collectables: [],
		parcels: [],
		monsters: [],
		movingBlocks: [],
		critters: [],
		timeLimit: 0,
	};
	loadWorld(map);
}
