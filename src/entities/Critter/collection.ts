import { sfxCollect } from "../../audio/sounds";
import { TILE_SIZE } from "../../tiles/tiledata";
import { spawnScoreLight } from "../lightTrail";
import { playerEntries } from "../Player/playerManager";
import { addScore } from "../worldObjects";
import { COLLECT_RADIUS } from "./SETTINGS";
import { critterGroups } from "./state";

export function tryCollectCritters(): number {
	let count = 0;
	for (const entry of playerEntries) {
		if (!entry.player.graphics.isVisible) continue;
		const px = entry.player.pos.x;
		const py = entry.player.pos.y;

		const playerHalf = TILE_SIZE / 2;
		for (const group of critterGroups) {
			for (const critter of group.critters) {
				if (critter.collected) continue;
				// Distance from critter center to nearest point on player bounding box
				const closestX = Math.max(
					px - playerHalf,
					Math.min(critter.position.x, px + playerHalf),
				);
				const closestY = Math.max(
					py - playerHalf,
					Math.min(critter.position.y, py + playerHalf),
				);
				const dx = critter.position.x - closestX;
				const dy = critter.position.y - closestY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < COLLECT_RADIUS) {
					critter.collected = true;
					spawnScoreLight(critter.actor.pos.clone());
					critter.actor.kill();
					critter.shadow.kill();
					addScore(50);
					sfxCollect();
					count++;
				}
			}
		}
	}
	return count;
}
