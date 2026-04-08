import { Actor, Vector } from "excalibur";
import { rlSS } from "../resources";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	Grass,
	tiles,
	seededRandom,
	START_TILE_INDEX,
} from "../tiles/tiledata";
import { game } from "../game";
import { zFromY, Z_LAYER_PLAYER } from "../zIndex";
import type { PlayerActor } from "./PlayerActor";
import { entries } from "./playerManager";

export interface Monster {
	actor: Actor;
	startPos: Vector;
	endPos: Vector;
	phase: number;
	speed: number;
}

const monsters: Monster[] = [];

/** Accumulated elapsed time — advances only via delta, so pauses are excluded. */
let monsterElapsed = 0;

/** Ping-pong oscillation: 0->1->0->1... */
function pingPong(t: number): number {
	const cycle = ((t % 2) + 2) % 2;
	return cycle <= 1 ? cycle : 2 - cycle;
}

export function resetMonsters() {
	monsterElapsed = 0;
}

/** Spawn monsters at random positions with random patrol paths. */
export function spawnMonsters(count: number) {
	monsters.length = 0;
	monsterElapsed = 0;
	for (let n = 0; n < count; n++) {
		const validIndices = tiles
			.map((t, i) => (t instanceof Grass && i !== START_TILE_INDEX ? i : -1))
			.filter((i) => i !== -1);

		if (validIndices.length === 0) break;

		const startIdx =
			validIndices[Math.floor(seededRandom() * validIndices.length)];
		const startX = startIdx % GRID_COLS;
		const startY = Math.floor(startIdx / GRID_COLS);

		const horizontal = seededRandom() < 0.5;
		const distance = 3 + Math.floor(seededRandom() * 6); // 3-8 tiles

		const endX = Math.min(
			horizontal ? startX + distance : startX,
			GRID_COLS - 2,
		);
		const endY = Math.min(
			horizontal ? startY : startY + distance,
			GRID_ROWS - 2,
		);

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
			z: zFromY(startY * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PLAYER),
		});
		actor.graphics.use(rlSS.getSprite(26, 0)); // monster sprite

		const monster: Monster = {
			actor,
			startPos,
			endPos,
			phase: seededRandom() * 2,
			speed: 0.0004 + seededRandom() * 0.0003, // slightly faster than platforms
		};
		monsters.push(monster);
		game.add(actor);
	}
}

/** Spawn monsters at specific positions (for custom maps). */
export function spawnMonstersAt(entries: { start: number; end: number }[]) {
	monsters.length = 0;
	monsterElapsed = 0;
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
			z: zFromY(startY * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PLAYER),
		});
		actor.graphics.use(rlSS.getSprite(26, 0));

		const monster: Monster = {
			actor,
			startPos,
			endPos,
			phase: Math.random() * 2,
			speed: 0.0005,
		};
		monsters.push(monster);
		game.add(actor);
	}
}

const KILL_RADIUS_SQ = 8 * 8; // 8px — half a tile

/** Called when a player is killed by a monster. Returns the callback or null. */
let onPlayerKilled: ((player: PlayerActor) => void) | null = null;

export function setOnPlayerKilled(cb: (player: PlayerActor) => void) {
	onPlayerKilled = cb;
}

/** Update monster positions and check for player collisions. Call once per frame. */
export function updateMonsters(delta: number) {
	monsterElapsed += delta;

	for (const monster of monsters) {
		const progress = pingPong(monsterElapsed * monster.speed + monster.phase);

		monster.actor.pos.x =
			monster.startPos.x + (monster.endPos.x - monster.startPos.x) * progress;
		monster.actor.pos.y =
			monster.startPos.y + (monster.endPos.y - monster.startPos.y) * progress;
		monster.actor.z = zFromY(monster.actor.pos.y, Z_LAYER_PLAYER);
	}

	// Collision check against all active (visible) players
	for (const monster of monsters) {
		for (const entry of entries) {
			const p = entry.player;
			if (!p.graphics.visible) continue;
			const dx = monster.actor.pos.x - p.pos.x;
			const dy = monster.actor.pos.y - p.pos.y;
			if (dx * dx + dy * dy <= KILL_RADIUS_SQ) {
				if (onPlayerKilled) {
					onPlayerKilled(p);
				}
				return; // handle one death per frame
			}
		}
	}
}
