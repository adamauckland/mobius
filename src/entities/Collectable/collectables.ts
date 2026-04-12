import { sfxCollect } from "@/audio/sounds";
import { game } from "@/game";
import { rlSS } from "@/resources/resources";
import { GRID_COLS, TILE_SIZE } from "@/tiles/tiledata";
import { zFromY, Z_LAYER_PICKUP } from "@/ui/zIndex";
import { Actor, Vector } from "excalibur";
import { spawnScoreLight } from "../Light/lightTrail";

// --- Collectables ---

export interface ICollectable {
	actor: Actor;
	tileIndex: number;
	collected: boolean;
}
const collectables: ICollectable[] = [];
export let score = 0;

export function getScore() {
	return score;
}

export function addScore(points: number) {
	score += points;
}
// Check if a collectable is at this tile and collect it (permanently)

export function tryCollectAtTile(tileIndex: number): boolean {
	const c = collectables.find((c) => c.tileIndex === tileIndex && !c.collected);
	if (!c) return false;
	c.collected = true;
	spawnScoreLight(c.actor.pos.clone());
	c.actor.kill();
	score += 100;
	sfxCollect();
	return true;
}

export function getCollectableCount(): { total: number; collected: number } {
	return {
		total: collectables.length,
		collected: collectables.filter((c) => c.collected).length,
	};
}
/** Spawn collectables at specific tile indices (for custom maps). */

export function spawnCollectablesAt(indices: number[]) {
	for (const tileIdx of indices) {
		const x = tileIdx % GRID_COLS;
		const y = Math.floor(tileIdx / GRID_COLS);
		const actor = new Actor({
			pos: new Vector(
				x * TILE_SIZE + TILE_SIZE / 2,
				y * TILE_SIZE + TILE_SIZE / 2,
			),
			width: TILE_SIZE,
			height: TILE_SIZE,
			z: zFromY(y * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
		});
		actor.graphics.use(rlSS.getSprite(45, 10));
		const phase = Math.random() * Math.PI * 2;
		actor.graphics.onPreDraw = () => {
			actor.graphics.offset.y = Math.sin(game.clock.now() * 0.003 + phase) * 2;
		};
		const collectable: ICollectable = {
			actor,
			tileIndex: tileIdx,
			collected: false,
		};
		collectables.push(collectable);
		game.add(actor);
	}
}
