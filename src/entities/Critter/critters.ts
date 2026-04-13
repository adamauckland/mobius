import { Actor, CollisionType, Vector } from "excalibur";
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

const playerPosScratch: Vector[] = [];
const aliveScratch: ICritter[] = [];
const aliveInfo = { count: 0, centerX: 0, centerY: 0 };
const accel = { ax: 0, ay: 0 };

function gatherPlayerPositions(): Vector[] {
	playerPosScratch.length = 0;
	for (const entry of playerEntries) {
		if (entry.player.graphics.isVisible) {
			playerPosScratch.push(entry.player.pos);
		}
	}
	return playerPosScratch;
}

function collectAliveCritters(group: ICritterGroup): boolean {
	aliveScratch.length = 0;
	let centerX = 0;
	let centerY = 0;
	for (const c of group.critters) {
		if (c.collected) continue;
		aliveScratch.push(c);
		centerX += c.position.x;
		centerY += c.position.y;
	}
	const count = aliveScratch.length;
	if (count === 0) {
		aliveInfo.count = 0;
		return false;
	}
	aliveInfo.count = count;
	aliveInfo.centerX = centerX / count;
	aliveInfo.centerY = centerY / count;
	return true;
}

function addFleeAcceleration(critter: ICritter, playerPositions: Vector[]): boolean {
	const playerHalf = TILE_SIZE / 2;
	let fleeing = false;

	for (let i = 0; i < playerPositions.length; i++) {
		const ppos = playerPositions[i];
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
		const distSq = dx * dx + dy * dy;
		if (distSq >= FLEE_RADIUS * FLEE_RADIUS) continue;
		fleeing = true;

		if (distSq < 0.01) {
			const cdx = critter.position.x - ppos.x;
			const cdy = critter.position.y - ppos.y;
			const cdistSq = cdx * cdx + cdy * cdy;
			if (cdistSq > 0.01) {
				const cdist = Math.sqrt(cdistSq);
				accel.ax += (cdx / cdist) * FLEE_SPEED;
				accel.ay += (cdy / cdist) * FLEE_SPEED;
			} else {
				accel.ax += FLEE_SPEED;
			}
		} else {
			const dist = Math.sqrt(distSq);
			const strength = FLEE_SPEED * (1 - dist / FLEE_RADIUS);
			accel.ax += (dx / dist) * strength;
			accel.ay += (dy / dist) * strength;
		}
	}
	return fleeing;
}

function addSeparationAcceleration(critter: ICritter) {
	const sepSq = SEPARATION_RADIUS * SEPARATION_RADIUS;
	for (let i = 0; i < aliveScratch.length; i++) {
		const other = aliveScratch[i];
		if (other === critter) continue;
		const dx = critter.position.x - other.position.x;
		const dy = critter.position.y - other.position.y;
		const distSq = dx * dx + dy * dy;
		if (distSq >= sepSq || distSq <= 0.01) continue;
		const dist = Math.sqrt(distSq);
		const strength = SEPARATION_STRENGTH * (1 - dist / SEPARATION_RADIUS);
		accel.ax += (dx / dist) * strength;
		accel.ay += (dy / dist) * strength;
	}
}

function addCohesionAcceleration(critter: ICritter) {
	const dcx = aliveInfo.centerX - critter.position.x;
	const dcy = aliveInfo.centerY - critter.position.y;
	const dcDistSq = dcx * dcx + dcy * dcy;
	if (dcDistSq <= 1) return;
	const dcDist = Math.sqrt(dcDistSq);
	accel.ax += (dcx / dcDist) * COHESION_STRENGTH;
	accel.ay += (dcy / dcDist) * COHESION_STRENGTH;
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
	playerPositions: Vector[],
	dt: number,
) {
	accel.ax = 0;
	accel.ay = 0;
	const isFleeing = addFleeAcceleration(critter, playerPositions);
	if (isFleeing && !critter.fleeing) {
		sfxCritterFlee();
	}
	critter.fleeing = isFleeing;
	addSeparationAcceleration(critter);
	addCohesionAcceleration(critter);

	applyVelocity(critter, accel.ax, accel.ay, dt);
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
		if (!collectAliveCritters(group)) continue;
		for (let i = 0; i < aliveScratch.length; i++) {
			updateCritter(aliveScratch[i], playerPositions, dt);
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
				collisionType: CollisionType.PreventCollision,
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
