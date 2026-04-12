import {
	GRID_COLS,
	GRID_ROWS,
	tiles,
	Tree,
	Barrier,
	DropZone,
	Fence,
	TILE_SIZE,
} from "@/tiles/tiledata";
import { getRocks } from "../rocks";
import { CRITTER_SIZE } from "@/entities/Critter/SETTINGS";

// --- Tile collision ---
/** Check if a single tile index is blocked. */
function isTileIndexBlocked(idx: number): boolean {
	if (idx < 0 || idx >= GRID_COLS * GRID_ROWS) return true;
	const tile = tiles[idx];
	if (tile instanceof Tree) return true;
	if (tile instanceof Barrier && tile.collider) return true;
	if (tile instanceof DropZone && !tile.fulfilled) return true;
	if (tile instanceof Fence) return true;

	for (const rock of getRocks()) {
		if (rock.tileIndex === idx) return true;
	}
	return false;
}
/** Check if a critter's bounding box overlaps any blocked tile. */
export function isTileBlocked(px: number, py: number): boolean {
	const half = CRITTER_SIZE / 2;
	const left = px - half;
	const right = px + half;
	const top = py - half;
	const bottom = py + half;

	// Check all four corners of the bounding box
	const corners: [number, number][] = [
		[left, top],
		[right, top],
		[left, bottom],
		[right, bottom],
	];
	for (const [cx, cy] of corners) {
		const tx = Math.floor(cx / TILE_SIZE);
		const ty = Math.floor(cy / TILE_SIZE);
		if (tx < 0 || tx >= GRID_COLS || ty < 0 || ty >= GRID_ROWS) return true;
		if (isTileIndexBlocked(tx + ty * GRID_COLS)) return true;
	}
	return false;
}
