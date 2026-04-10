import { Actor, Vector } from "excalibur";
import { rlSS } from "../resources/resources";
import { TILE_SIZE, GRID_COLS } from "../tiles/tiledata";
import { game } from "../game";
import { zFromY, Z_LAYER_PLAYER } from "../ui/zIndex";
import type { PlayerActor } from "./Player/PlayerActor";
import { playerEntries } from "./Player/playerManager";
import { IMonster } from "../interfaces/IMonster";

const monsters: IMonster[] = [];

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

		const monster: IMonster = {
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
		for (const entry of playerEntries) {
			const p = entry.player;
			if (!p.graphics.isVisible) continue;
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
