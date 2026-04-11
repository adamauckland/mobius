import { Actor, Vector, Circle } from "excalibur";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	tiles,
	Tree,
	Barrier,
	DropZone,
	OneWayGate,
	Fence,
} from "../../tiles/tiledata";
import { getRocks } from "../worldObjects";
import { game } from "../../game";
import { zFromY, Z_LAYER_PICKUP, Z_LAYER_SHADOW } from "../../ui/zIndex";
import { spawnScoreLight } from "../lightTrail";
import { sfxCollect } from "../../audio/sounds";
import { addScore } from "../worldObjects";
import { playerEntries } from "../Player/playerManager";
import { ICritter } from "./ICritter";
import { ICritterGroup } from "./ICritterGroup";
import {
	CRITTER_SIZE,
	BOUNCE_FREQ,
	BOUNCE_AMPLITUDE,
	SHADOW_RADIUS_X,
	SHADOW_RADIUS_Y,
	SHADOW_COLOR,
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
	COLLECT_RADIUS,
} from "./CRITTER_SETTINGS";
import {
	EYE_BASE_LEFT_X,
	EYE_BASE_RIGHT_X,
	IDLE_LOOK_MIN_MS,
	IDLE_LOOK_MAX_MS,
	BLINK_HALF_DURATION,
	BLINK_CLOSED_DURATION,
	BLINK_TOTAL_DURATION,
	EYE_SHIFT_MAX,
	IDLE_LOOK_DIRECTIONS,
} from "./CRITTER_LOOK_SETTINGS";
import { critterGroups } from "./critterState";
import { createCritterGraphics } from "./createCritterGraphics";

/** Attach blink/bounce/eye-shift animation to a critter's actor. */
function attachCritterAnimation(actor: Actor, critter: ICritter) {
	const gfx = createCritterGraphics();
	actor.graphics.use(gfx.open);
	const phase = Math.random() * Math.PI * 2;
	let nextBlink = game.clock.now() + 1000 + Math.random() * 3000;
	let blinkStart = 0; // 0 = not blinking
	// Idle look-around state
	let idleLookShift = 0;
	let idleLookTarget = 0;
	let nextIdleLook =
		game.clock.now() +
		IDLE_LOOK_MIN_MS +
		Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);

	actor.graphics.onPreDraw = () => {
		const now = game.clock.now();
		const speed = Math.sqrt(
			critter.velocity.x * critter.velocity.x +
				critter.velocity.y * critter.velocity.y,
		);
		const facingAway = speed > 1 && critter.velocity.y < 0;
		// Start a new blink
		if (blinkStart === 0 && now >= nextBlink) {
			blinkStart = now;
		}
		// Determine blink phase: half-open -> closed -> half-open -> open
		let eyeState: "open" | "half" | "closed" = "open";
		if (blinkStart > 0) {
			const elapsed = now - blinkStart;
			if (elapsed < BLINK_HALF_DURATION) {
				eyeState = "half";
			} else if (elapsed < BLINK_HALF_DURATION + BLINK_CLOSED_DURATION) {
				eyeState = "closed";
			} else if (elapsed < BLINK_TOTAL_DURATION) {
				eyeState = "half";
			} else {
				// Blink finished
				blinkStart = 0;
				nextBlink = now + 1000 + Math.random() * 3000;
				eyeState = "open";
			}
		}
		if (facingAway) eyeState = "closed";
		if (eyeState === "closed") {
			actor.graphics.use(gfx.closed);
		} else if (eyeState === "half") {
			actor.graphics.use(gfx.halfOpen);
		} else {
			actor.graphics.use(gfx.open);
		}
		// Eye shift: follow movement when moving, look around when idle
		let shift: number;
		if (speed > 1) {
			shift = (critter.velocity.x / speed) * EYE_SHIFT_MAX;
			// Reset idle timer while moving
			nextIdleLook =
				now +
				IDLE_LOOK_MIN_MS +
				Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);
			idleLookShift = 0;
			idleLookTarget = 0;
		} else {
			// Pick a new random look direction on timer
			if (now >= nextIdleLook) {
				idleLookTarget =
					IDLE_LOOK_DIRECTIONS[
						Math.floor(Math.random() * IDLE_LOOK_DIRECTIONS.length)
					];
				nextIdleLook =
					now +
					IDLE_LOOK_MIN_MS +
					Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);
			}
			// Smoothly lerp toward the target
			idleLookShift += (idleLookTarget - idleLookShift) * 0.08;
			shift = idleLookShift;
		}
		gfx.leftEyeOffset.x = EYE_BASE_LEFT_X + shift;
		gfx.rightEyeOffset.x = EYE_BASE_RIGHT_X + shift;
		gfx.leftEyeHalfOffset.x = EYE_BASE_LEFT_X + shift;
		gfx.rightEyeHalfOffset.x = EYE_BASE_RIGHT_X + shift;
		if (critter.onGate) {
			actor.graphics.offset.y = 0;
		} else if (speed > 1) {
			actor.graphics.offset.y =
				-Math.abs(Math.sin(now * BOUNCE_FREQ + phase)) * BOUNCE_AMPLITUDE;
		} else {
			actor.graphics.offset.y = 0;
		}
	};
}

/** Create a small elliptical drop-shadow actor. */
function createShadowActor(px: number, py: number): Actor {
	const shadow = new Actor({
		pos: new Vector(px, py + CRITTER_SIZE / 2),
		width: SHADOW_RADIUS_X * 2,
		height: SHADOW_RADIUS_Y * 2,
		z: zFromY(py, Z_LAYER_SHADOW),
	});
	const shadowCircle = new Circle({
		radius: SHADOW_RADIUS_X,
		color: SHADOW_COLOR,
	});
	shadow.graphics.use(shadowCircle);
	shadow.graphics.offset.y = -CRITTER_SIZE - CRITTER_SIZE; // -SHADOW_RADIUS_Y;
	shadow.graphics.offset.x = -CRITTER_SIZE / 2;
	shadow.scale.y = SHADOW_RADIUS_Y / SHADOW_RADIUS_X;
	return shadow;
}

// --- Spawning ---

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
	};
	attachCritterAnimation(actor, critter);

	return { critter, shadow, actor };
}

// --- Tile collision ---

/** Check if a single tile index is blocked. */
function isTileIndexBlocked(idx: number): boolean {
	if (idx < 0 || idx >= GRID_COLS * GRID_ROWS) return true;
	const tile = tiles[idx];
	if (tile instanceof Tree) return true;
	if (tile instanceof Barrier && tile.collider) return true;
	if (tile instanceof DropZone && !tile.fulfilled) return true;
	if (tile instanceof Fence) return true;

	for (const rock of getRocks()) {
		if (rock.tileIndex === idx) return true;
	}
	return false;
}

/** Check if a critter's bounding box overlaps any blocked tile. */
function isTileBlocked(px: number, py: number): boolean {
	const half = CRITTER_SIZE / 2;
	const left = px - half;
	const right = px + half;
	const top = py - half;
	const bottom = py + half;

	// Check all four corners of the bounding box
	const corners: [number, number][] = [
		[left, top],
		[right, top],
		[left, bottom],
		[right, bottom],
	];
	for (const [cx, cy] of corners) {
		const tx = Math.floor(cx / TILE_SIZE);
		const ty = Math.floor(cy / TILE_SIZE);
		if (tx < 0 || tx >= GRID_COLS || ty < 0 || ty >= GRID_ROWS) return true;
		if (isTileIndexBlocked(tx + ty * GRID_COLS)) return true;
	}
	return false;
}

// --- Update (called each frame) ---

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
		if (blockedX) critter.velocity.x = -critter.velocity.x;
		if (blockedY) critter.velocity.y = -critter.velocity.y;
		if (!blockedX && !blockedY) {
			critter.velocity.x = -critter.velocity.x;
			critter.velocity.y = -critter.velocity.y;
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

// --- Collection ---

/** Check all critters against all visible players. Collect any within range. */
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
