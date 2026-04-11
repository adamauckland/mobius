import { Actor, Vector } from "excalibur";
import { game } from "@/game";
import { GRID_COLS, TILE_SIZE } from "@/tiles/tiledata";
import { zFromY, Z_LAYER_PICKUP } from "@/ui/zIndex";
import { CRITTERS_PER_GROUP, CRITTER_SIZE } from "@/entities/Critter/SETTINGS";
import { attachCritterAnimation } from "@/entities/Critter/animation";
import { critterGroups } from "@/entities/Critter/state";
import { ICritter } from "@/entities/Critter/types/ICritter";
import { createShadowActor } from "@/entities/Critter/graphics";

export function spawnCritterGroupsAt(tileIndices: number[]) {
	for (const tileIdx of tileIndices) {
		spawnCrittersAt(tileIdx);
	}
}

export function spawnCrittersAt(tileIndex: number) {
	const cx = (tileIndex % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
	const cy = Math.floor(tileIndex / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
	const groupIndex = critterGroups.length;
	const critters: ICritter[] = [];

	for (let i = 0; i < CRITTERS_PER_GROUP; i++) {
		// Spread critters in a small circle around the tile center
		const angle = (i / CRITTERS_PER_GROUP) * Math.PI * 2;
		const spread = 4;
		const px = cx + Math.cos(angle) * spread;
		const py = cy + Math.sin(angle) * spread;

		const { critter, shadow, actor } = spawnNewCritter(px, py, groupIndex);

		critters.push(critter);
		game.add(shadow);
		game.add(actor);
	}

	critterGroups.push({ originTile: tileIndex, critters });
}

export function spawnNewCritter(px: number, py: number, groupIndex: number) {
	const actor = new Actor({
		pos: new Vector(px, py),
		width: CRITTER_SIZE,
		height: CRITTER_SIZE,
		z: zFromY(py, Z_LAYER_PICKUP),
	});
	const shadow = createShadowActor(px, py);
	const critter: ICritter = {
		actor,
		shadow,
		position: new Vector(px, py),
		velocity: new Vector(0, 0),
		groupIndex,
		collected: false,
		onGate: false,
		fleeing: false,
	};
	attachCritterAnimation(actor, critter);

	return { critter, shadow, actor };
}
