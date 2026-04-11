import { rlSS } from "@/resources/resources";
import { tiles, Fence, GRID_COLS, GRID_ROWS } from "@/tiles/tiledata";

/** Auto-tile fence sprites from roguelike sheet (wooden fence at rows 23-24, cols 45-51) */
export function getFenceSprite(index: number) {
	const x = index % GRID_COLS;
	const y = Math.floor(index / GRID_COLS);

	const isFence = (dx: number, dy: number) => {
		const nx = x + dx;
		const ny = y + dy;
		if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return false;
		return tiles[nx + ny * GRID_COLS] instanceof Fence;
	};

	const up = isFence(0, -1);
	const down = isFence(0, 1);
	const left = isFence(-1, 0);
	const right = isFence(1, 0);

	// Wooden fence sprites from rlSS (col, row):
	// (47, 23) = vertical segment    (47, 24) = horizontal segment
	// (46, 23) = cross/junction      (46, 24) = T-up (left+right+down)
	// (48, 24) = left end cap        (49, 24) = right end cap
	// (49, 23) = T-right (up+down+left)  (50, 23) = bottom-left corner
	// (48, 23) = T-left (up+down+right)  (51, 23) = bottom-right corner

	if (up && down && left && right) return rlSS.getSprite(46, 23); // cross
	if (up && down && right) return rlSS.getSprite(48, 23); // T-right
	if (up && down && left) return rlSS.getSprite(49, 23); // T-left
	if (left && right && down) return rlSS.getSprite(46, 24); // T-down
	if (left && right && up) return rlSS.getSprite(50, 24); // T-up
	if (up && down) return rlSS.getSprite(47, 23); // vertical
	if (left && right) return rlSS.getSprite(47, 24); // horizontal
	if (down && right) return rlSS.getSprite(48, 24); // corner top-left
	if (down && left) return rlSS.getSprite(49, 24); // corner top-right
	if (up && right) return rlSS.getSprite(50, 23); // corner bottom-left
	if (up && left) return rlSS.getSprite(51, 23); // corner bottom-right
	if (up || down) return rlSS.getSprite(47, 23); // vertical end cap
	if (left || right) return rlSS.getSprite(47, 24); // horizontal end cap
	return rlSS.getSprite(46, 23); // isolated post
}
