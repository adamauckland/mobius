import { Actor, Vector } from "excalibur";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	tiles,
	OneWayGate,
} from "@/tiles/tiledata";
import { game } from "@/game";
import { zFromY, Z_LAYER_PICKUP, Z_LAYER_SHADOW } from "@/ui/zIndex";
import { playerEntries } from "@/entities/Player/playerManager";
import { ICritter } from "@/entities/Critter/types/ICritter";
import { ICritterGroup } from "@/entities/Critter/types/ICritterGroup";
import {
	CRITTER_SIZE,
	CRITTERS_PER_GROUP,
	FLEE_RADIUS,
	FLEE_SPEED,
	SEPARATION_RADIUS,
	SEPARATION_STRENGTH,
	COHESION_STRENGTH,
	DAMPING,
	MAX_SPEED,
	GATE_DIRECTION_VECTORS,
	GATE_PUSH_SPEED,
	WALL_RESTITUTION,
} from "@/entities/Critter/SETTINGS";
import { sfxCritterFlee } from "@/audio/sounds";
import { critterGroups } from "@/entities/Critter/state";
import { isTileBlocked } from "@/entities/Critter/collision";
import { attachCritterAnimation } from "@/entities/Critter/animation";
import { createShadowActor } from "@/entities/Critter/graphics";

function gatherPlayerPositions(): Vector[] {
	const positions: Vector[] = [];
	for (const entry of playerEntries) {
		if (entry.player.graphics.isVisible) {
			positions.push(entry.player.pos);
		}
	}

	return positions;
}

function getAliveCrittersWithCenter(group: ICritterGroup): {
	alive: ICritter[];
	centerX: number;
	centerY: number;
} | null {
	const alive = group.critters.filter((c) => !c.collected);
	if (alive.length === 0) return null;

	let centerX = 0;
	let centerY = 0;
	for (const c of alive) {
		centerX += c.position.x;
		centerY += c.position.y;
	}
	return {
		alive,
		centerX: centerX / alive.length,
		centerY: centerY / alive.length,
	};
}

function computeFleeAcceleration(
	critter: ICritter,
	playerPositions: Vector[],
): { ax: number; ay: number } {
	let ax = 0;
	let ay = 0;
	const playerHalf = TILE_SIZE / 2;

	for (const ppos of playerPositions) {
		const nearX = Math.max(
			ppos.x - playerHalf,
			Math.min(critter.position.x, ppos.x + playerHalf),
		);
		const nearY = Math.max(
			ppos.y - playerHalf,
			Math.min(critter.position.y, ppos.y + playerHalf),
		);
		const dx = critter.position.x - nearX;
		const dy = critter.position.y - nearY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist >= FLEE_RADIUS) continue;

		if (dist < 0.1) {
			const cdx = critter.position.x - ppos.x;
			const cdy = critter.position.y - ppos.y;
			const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
			if (cdist > 0.1) {
				ax += (cdx / cdist) * FLEE_SPEED;
				ay += (cdy / cdist) * FLEE_SPEED;
			} else {
				ax += FLEE_SPEED;
			}
		} else {
			const strength = FLEE_SPEED * (1 - dist / FLEE_RADIUS);
			ax += (dx / dist) * strength;
			ay += (dy / dist) * strength;
		}
	}
	return { ax, ay };
}

function computeSeparationAcceleration(
	critter: ICritter,
	alive: ICritter[],
): { ax: number; ay: number } {
	let ax = 0;
	let ay = 0;
	for (const other of alive) {
		if (other === critter) continue;
		const dx = critter.position.x - other.position.x;
		const dy = critter.position.y - other.position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < SEPARATION_RADIUS && dist > 0.1) {
			const strength = SEPARATION_STRENGTH * (1 - dist / SEPARATION_RADIUS);
			ax += (dx / dist) * strength;
			ay += (dy / dist) * strength;
		}
	}
	return { ax, ay };
}

function computeCohesionAcceleration(
	critter: ICritter,
	centerX: number,
	centerY: number,
): { ax: number; ay: number } {
	const dcx = centerX - critter.position.x;
	const dcy = centerY - critter.position.y;
	const dcDist = Math.sqrt(dcx * dcx + dcy * dcy);
	if (dcDist > 1) {
		return {
			ax: (dcx / dcDist) * COHESION_STRENGTH,
			ay: (dcy / dcDist) * COHESION_STRENGTH,
		};
	}
	return { ax: 0, ay: 0 };
}

function applyVelocity(critter: ICritter, ax: number, ay: number, dt: number) {
	critter.velocity.x = (critter.velocity.x + ax * dt) * DAMPING;
	critter.velocity.y = (critter.velocity.y + ay * dt) * DAMPING;
}

function clampSpeed(critter: ICritter) {
	const speed = Math.sqrt(
		critter.velocity.x * critter.velocity.x +
			critter.velocity.y * critter.velocity.y,
	);
	if (speed > MAX_SPEED) {
		critter.velocity.x = (critter.velocity.x / speed) * MAX_SPEED;
		critter.velocity.y = (critter.velocity.y / speed) * MAX_SPEED;
	}
}

function moveCritter(
	critter: ICritter,
	dt: number,
): { prevX: number; prevY: number } {
	const prevX = critter.position.x;
	const prevY = critter.position.y;
	critter.position.x += critter.velocity.x * dt;
	critter.position.y += critter.velocity.y * dt;
	return { prevX, prevY };
}

function clampToWorldBounds(critter: ICritter) {
	const halfSize = CRITTER_SIZE / 2;
	const maxX = GRID_COLS * TILE_SIZE - halfSize;
	const maxY = GRID_ROWS * TILE_SIZE - halfSize;
	if (critter.position.x < halfSize) {
		critter.position.x = halfSize;
		critter.velocity.x = Math.abs(critter.velocity.x);
	}
	if (critter.position.x > maxX) {
		critter.position.x = maxX;
		critter.velocity.x = -Math.abs(critter.velocity.x);
	}
	if (critter.position.y < halfSize) {
		critter.position.y = halfSize;
		critter.velocity.y = Math.abs(critter.velocity.y);
	}
	if (critter.position.y > maxY) {
		critter.position.y = maxY;
		critter.velocity.y = -Math.abs(critter.velocity.y);
	}
}

function resolveBlockedAxis(critter: ICritter, blocked: boolean, axis: "x" | "y") {
	if (!blocked) return;
	if (critter.fleeing) {
		critter.velocity[axis] = 0;
	} else {
		critter.velocity[axis] = -critter.velocity[axis] * WALL_RESTITUTION;
	}
}

function handleTileCollisions(critter: ICritter, prevX: number, prevY: number) {
	const tileIdx =
		Math.floor(critter.position.x / TILE_SIZE) +
		Math.floor(critter.position.y / TILE_SIZE) * GRID_COLS;
	const currentTile = tiles[tileIdx];
	const onGate = currentTile instanceof OneWayGate;
	critter.onGate = onGate;

	if (!onGate && isTileBlocked(critter.position.x, critter.position.y)) {
		const blockedX = isTileBlocked(critter.position.x, prevY);
		const blockedY = isTileBlocked(prevX, critter.position.y);
		resolveBlockedAxis(critter, blockedX, "x");
		resolveBlockedAxis(critter, blockedY, "y");
		if (!blockedX && !blockedY) {
			resolveBlockedAxis(critter, true, "x");
			resolveBlockedAxis(critter, true, "y");
		}
		critter.position.x = prevX;
		critter.position.y = prevY;
	}

	if (onGate) {
		const [gdx, gdy] =
			GATE_DIRECTION_VECTORS[(currentTile as OneWayGate).direction];
		critter.velocity.x = gdx * GATE_PUSH_SPEED;
		critter.velocity.y = gdy * GATE_PUSH_SPEED;
	}
}

function syncCritterActors(critter: ICritter) {
	critter.actor.pos.x = critter.position.x;
	critter.actor.pos.y = critter.position.y;
	critter.actor.z = zFromY(critter.position.y, Z_LAYER_PICKUP);
	critter.shadow.pos.x = critter.position.x;
	critter.shadow.pos.y = critter.position.y + CRITTER_SIZE / 2;
	critter.shadow.z = zFromY(critter.position.y, Z_LAYER_SHADOW);
}

function updateCritter(
	critter: ICritter,
	alive: ICritter[],
	centerX: number,
	centerY: number,
	playerPositions: Vector[],
	dt: number,
) {
	const flee = computeFleeAcceleration(critter, playerPositions);
	const isFleeing = flee.ax !== 0 || flee.ay !== 0;
	if (isFleeing && !critter.fleeing) {
		sfxCritterFlee();
	}
	critter.fleeing = isFleeing;
	const sep = computeSeparationAcceleration(critter, alive);
	const coh = computeCohesionAcceleration(critter, centerX, centerY);
	const ax = flee.ax + sep.ax + coh.ax;
	const ay = flee.ay + sep.ay + coh.ay;

	applyVelocity(critter, ax, ay, dt);
	clampSpeed(critter);

	const { prevX, prevY } = moveCritter(critter, dt);

	clampToWorldBounds(critter);
	handleTileCollisions(critter, prevX, prevY);
	syncCritterActors(critter);
}

export function updateCritters(elapsedMs: number) {
	const dt = elapsedMs / 1000;
	if (dt <= 0) return;

	const playerPositions = gatherPlayerPositions();

	for (const group of critterGroups) {
		const result = getAliveCrittersWithCenter(group);
		if (!result) continue;
		const { alive, centerX, centerY } = result;

		for (const critter of alive) {
			updateCritter(critter, alive, centerX, centerY, playerPositions, dt);
		}
	}
}

// --- Reset ---

export function resetCritters() {
	for (const group of critterGroups) {
		const cx = (group.originTile % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
		const cy =
			Math.floor(group.originTile / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;

		for (let i = 0; i < group.critters.length; i++) {
			const critter = group.critters[i];
			const angle = (i / CRITTERS_PER_GROUP) * Math.PI * 2;
			const spread = 4;
			const px = cx + Math.cos(angle) * spread;
			const py = cy + Math.sin(angle) * spread;

			critter.position.x = px;
			critter.position.y = py;
			critter.velocity.x = 0;
			critter.velocity.y = 0;
			critter.collected = false;
			critter.fleeing = false;
			critter.actor.pos.x = px;
			critter.actor.pos.y = py;
			critter.shadow.pos.x = px;
			critter.shadow.pos.y = py + CRITTER_SIZE / 2;

			// Re-add killed actors
			if (!critter.actor.isKilled()) continue;
			const actor = new Actor({
				pos: new Vector(px, py),
				width: CRITTER_SIZE,
				height: CRITTER_SIZE,
				z: zFromY(py, Z_LAYER_PICKUP),
			});
			attachCritterAnimation(actor, critter);
			critter.actor = actor;
			game.add(actor);
			// Re-add shadow
			if (critter.shadow.isKilled()) {
				const newShadow = createShadowActor(px, py);
				critter.shadow = newShadow;
				game.add(newShadow);
			}
		}
	}
}
