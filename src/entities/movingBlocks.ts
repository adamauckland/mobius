import { Actor, Vector } from "excalibur";
import { rlSS } from "@/resources/resources";
import { TILE_SIZE, GRID_COLS, GRID_ROWS, tiles } from "@/tiles/tiledata";
import { game } from "@/game";
import { zFromY, Z_PLAYER_BACKGROUND_MOVER } from "@/ui/zIndex";
import type { PlayerActor } from "@/entities/Player/PlayerActor";
import { sfxPlatformStart, sfxPlatformStop } from "@/audio/sounds";

/** Accumulated elapsed time — advances only via delta, so pauses are excluded. */
let blockElapsed = 0;

/** Call when the game rewinds so blocks repeat from the same relative time. */
export function resetMovingBlocks() {
	blockElapsed = 0;
	for (const block of movingBlocks) {
		block.riders = [];
	}
}

export interface MovingBlock {
	actor: Actor;
	startPos: Vector;
	endPos: Vector;
	phase: number;
	speed: number;
	riders: PlayerActor[];
}

const movingBlocks: MovingBlock[] = [];

/** Ping-pong oscillation: 0→1→0→1… */
function pingPong(t: number): number {
	const cycle = ((t % 2) + 2) % 2;
	return cycle <= 1 ? cycle : 2 - cycle;
}

/** Find a moving block within a few pixels of a world position. */
export function getMovingBlockNear(pos: Vector): MovingBlock | undefined {
	const MOUNT_RADIUS_SQ = 6 * 6; // 6 px — close enough to feel seamless
	return movingBlocks.find((block) => {
		const dx = block.actor.pos.x - pos.x;
		const dy = block.actor.pos.y - pos.y;
		return dx * dx + dy * dy <= MOUNT_RADIUS_SQ;
	});
}

/** Mount a player onto a moving block. */
export function mountBlock(block: MovingBlock, player: PlayerActor) {
	block.riders.push(player);
	player.ridingBlock = block;
	player.playerActionBuffer = [];
	player.actions.clearActions();
	sfxPlatformStart();
}

/**
 * Dismount a player from a moving block.
 * Returns false if the player is over a solid tile and can't dismount.
 */
export function dismountBlock(player: PlayerActor): boolean {
	const block = player.ridingBlock;
	if (!block) return false;

	const tx = Math.floor(player.pos.x / TILE_SIZE);
	const ty = Math.floor(player.pos.y / TILE_SIZE);
	const currentTile = tx + ty * GRID_COLS;

	if (currentTile < 0 || currentTile >= GRID_COLS * GRID_ROWS) return false;
	if (tiles[currentTile].collider) return false;

	block.riders = block.riders.filter((r) => r !== player);
	player.ridingBlock = null;
	sfxPlatformStop();

	// Snap to tile centre
	player.pos.x = tx * TILE_SIZE + TILE_SIZE / 2;
	player.pos.y = ty * TILE_SIZE + TILE_SIZE / 2;
	player.logicalTileIndex = currentTile;
	player.currentMoveTileIndex = currentTile;

	return true;
}

/** Spawn moving blocks at specific positions (for custom maps). */
export function spawnMovingBlocksAt(entries: { start: number; end: number }[]) {
	blockElapsed = 0;
	for (const entry of entries) {
		const startX = entry.start % GRID_COLS;
		const startY = Math.floor(entry.start / GRID_COLS);
		const endX = entry.end % GRID_COLS;
		const endY = Math.floor(entry.end / GRID_COLS);

		const startPos = new Vector(
			startX * TILE_SIZE + TILE_SIZE / 2,
			startY * TILE_SIZE + TILE_SIZE / 2,
		);
		const endPos = new Vector(
			endX * TILE_SIZE + TILE_SIZE / 2,
			endY * TILE_SIZE + TILE_SIZE / 2,
		);

		const actor = new Actor({
			pos: startPos.clone(),
			width: TILE_SIZE,
			height: TILE_SIZE,
			z: zFromY(startY * TILE_SIZE + TILE_SIZE / 2, Z_PLAYER_BACKGROUND_MOVER),
		});
		actor.graphics.use(rlSS.getSprite(4, 0));

		const block: MovingBlock = {
			actor,
			startPos,
			endPos,
			phase: Math.random() * 2,
			speed: 0.0004,
			riders: [],
		};
		movingBlocks.push(block);
		game.add(actor);
	}
}

/** Update every moving block position (call once per frame). */
export function updateMovingBlocks(delta: number) {
	blockElapsed += delta;

	for (const block of movingBlocks) {
		const progress = pingPong(blockElapsed * block.speed + block.phase);

		const newX =
			block.startPos.x + (block.endPos.x - block.startPos.x) * progress;
		const newY =
			block.startPos.y + (block.endPos.y - block.startPos.y) * progress;

		// Apply the block's movement delta to riders — no snap on mount
		const dx = newX - block.actor.pos.x;
		const dy = newY - block.actor.pos.y;
		// Smoothly nudge riders toward the block centre after mounting so
		// they line up with exit tiles instead of keeping a fixed offset.
		const CENTER_RATE = 0.04; // pixels per ms
		const maxStep = CENTER_RATE * delta;
		for (const rider of block.riders) {
			rider.pos.x += dx;
			rider.pos.y += dy;
			const offX = newX - rider.pos.x;
			const offY = newY - rider.pos.y;
			rider.pos.x += Math.sign(offX) * Math.min(Math.abs(offX), maxStep);
			rider.pos.y += Math.sign(offY) * Math.min(Math.abs(offY), maxStep);
		}

		block.actor.pos.x = newX;
		block.actor.pos.y = newY;
		block.actor.z = zFromY(block.actor.pos.y, Z_PLAYER_BACKGROUND_MOVER);
	}
}
