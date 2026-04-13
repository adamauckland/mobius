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
import { CRITTER_SIZE } from "@/entities/Critter/SETTINGS";
import { getBlockedRockTiles } from "../Rock/rocks";

function isTileIndexBlocked(idx: number, rockTiles: ReadonlySet<number>): boolean {
	const tile = tiles[idx];
	if (tile instanceof Tree) return true;
	if (tile instanceof Barrier && tile.collider) return true;
	if (tile instanceof DropZone && !tile.fulfilled) return true;
	if (tile instanceof Fence) return true;
	return rockTiles.has(idx);
}

/** Check if a critter's bounding box overlaps any blocked tile. */
export function isTileBlocked(px: number, py: number): boolean {
	const half = CRITTER_SIZE / 2;
	const leftTx = Math.floor((px - half) / TILE_SIZE);
	const rightTx = Math.floor((px + half) / TILE_SIZE);
	const topTy = Math.floor((py - half) / TILE_SIZE);
	const bottomTy = Math.floor((py + half) / TILE_SIZE);

	if (leftTx < 0 || rightTx >= GRID_COLS || topTy < 0 || bottomTy >= GRID_ROWS) {
		return true;
	}

	const rockTiles = getBlockedRockTiles();
	const topRow = topTy * GRID_COLS;
	const bottomRow = bottomTy * GRID_COLS;
	if (isTileIndexBlocked(leftTx + topRow, rockTiles)) return true;
	if (rightTx !== leftTx && isTileIndexBlocked(rightTx + topRow, rockTiles)) return true;
	if (bottomTy !== topTy) {
		if (isTileIndexBlocked(leftTx + bottomRow, rockTiles)) return true;
		if (rightTx !== leftTx && isTileIndexBlocked(rightTx + bottomRow, rockTiles)) return true;
	}
	return false;
}
