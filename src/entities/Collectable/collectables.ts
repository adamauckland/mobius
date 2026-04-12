import { sfxCollect } from "@/audio/sounds";
import { game } from "@/game";
import { rlSS } from "@/resources/resources";
import { GRID_COLS, TILE_SIZE } from "@/tiles/tiledata";
import { zFromY, Z_LAYER_PICKUP } from "@/ui/zIndex";
import { Actor, Vector } from "excalibur";
import { spawnScoreLight } from "../Light/lightTrail";
import { ICollectable } from "./ICollectable";
import { addScore, collectables } from "./state";

export function tryCollectAtTile(tileIndex: number): boolean {
	const foundCollectables = collectables.find(
		(c) => c.tileIndex === tileIndex && !c.collected,
	);
	if (!foundCollectables) return false;
	foundCollectables.collected = true;
	spawnScoreLight(foundCollectables.actor.pos.clone());
	foundCollectables.actor.kill();
	addScore(100);
	sfxCollect();
	return true;
}

export function getCollectableCount(): { total: number; collected: number } {
	return {
		total: collectables.length,
		collected: collectables.filter((c) => c.collected).length,
	};
}

export function spawnCollectablesAt(indices: number[]) {
	for (const tileIndex of indices) {
		const x = tileIndex % GRID_COLS;
		const y = Math.floor(tileIndex / GRID_COLS);
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
			tileIndex: tileIndex,
			collected: false,
		};
		collectables.push(collectable);
		game.add(actor);
	}
}
