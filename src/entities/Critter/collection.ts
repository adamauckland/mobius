import { Vector } from "excalibur";
import { sfxCollect } from "@/audio/sounds";
import { TILE_SIZE } from "@/tiles/tiledata";
import {
	spawnScoreLight,
	spawnCollectBurst,
} from "@/entities/Light/lightTrail";
import { playerEntries } from "@/entities/Player/playerManager";
import { addScore } from "../Collectable/collectables";
import { COLLECT_RADIUS } from "@/entities/Critter/SETTINGS";
import { critterGroups } from "@/entities/Critter/state";
import { getCritterCount } from "@/entities/Critter/state";

let allCollectedCallback: (() => void) | null = null;
let allCollectedFired = false;

export function setOnAllCrittersCollected(cb: () => void) {
	allCollectedCallback = cb;
	allCollectedFired = false;
}

export function resetAllCrittersCollectedFlag() {
	allCollectedFired = false;
}

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
					spawnCollectBurst(critter.actor.pos.clone(), new Vector(px, py));
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

	if (count > 0 && !allCollectedFired && allCollectedCallback) {
		const { total, collected } = getCritterCount();
		if (total > 0 && collected >= total) {
			allCollectedFired = true;
			allCollectedCallback();
		}
	}

	return count;
}
