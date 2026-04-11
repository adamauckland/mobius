import { Actor, Vector, Circle, Color } from "excalibur";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	tiles,
	Tree,
	Barrier,
	DropZone,
	OneWayGate,
} from "../tiles/tiledata";
import { getRocks } from "./worldObjects";
import { game } from "../game";
import { zFromY, Z_LAYER_PICKUP } from "../ui/zIndex";
import { spawnScoreLight } from "./lightTrail";
import { sfxCollect } from "../audio/sounds";
import { addScore } from "./worldObjects";
import { playerEntries } from "./Player/playerManager";

// --- Types ---

export interface ICritter {
	actor: Actor;
	pos: Vector; // sub-pixel position (not tile-locked)
	vel: Vector;
	groupIndex: number; // which group this critter belongs to
	collected: boolean;
}

export interface ICritterGroup {
	originTile: number; // tile index where the group was spawned
	critters: ICritter[];
}

// --- Constants ---

const CRITTER_SIZE = 8;
const CRITTERS_PER_GROUP = 5;
const CRITTER_COLOR = Color.fromHex("#44eeff");

/** Half the player speed. Player moves 16px in 200ms = 80px/s. */
const FLEE_SPEED = 1000; // px/s
/** Distance at which critters start fleeing from a player */
const FLEE_RADIUS = 48; // px (3 tiles)
/** Separation: push apart when closer than this */
const SEPARATION_RADIUS = 10; // px
const SEPARATION_STRENGTH = 60; // px/s
/** Cohesion: pull toward group center */
const COHESION_STRENGTH = 15; // px/s
/** Collection radius — player must be this close to collect */
const COLLECT_RADIUS = 10; // px
/** Maximum velocity magnitude */
const MAX_SPEED = 50; // px/s
/** Damping applied each frame so critters slow when not fleeing */
const DAMPING = 0.92;
/** Speed at which a one-way gate pushes a critter (px/s) */
const GATE_PUSH_SPEED = 80;

const GATE_DIRECTION_VECTORS: Record<string, [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

// --- State ---

const critterGroups: ICritterGroup[] = [];

export function getCritterGroups(): ICritterGroup[] {
	return critterGroups;
}

export function getCritterCount(): { total: number; collected: number } {
	let total = 0;
	let collected = 0;
	for (const group of critterGroups) {
		for (const c of group.critters) {
			total++;
			if (c.collected) collected++;
		}
	}
	return { total, collected };
}

// --- Spawning ---

export function spawnCritterGroupsAt(tileIndices: number[]) {
	for (const tileIdx of tileIndices) {
		const cx = (tileIdx % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
		const cy = Math.floor(tileIdx / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
		const groupIndex = critterGroups.length;
		const critters: ICritter[] = [];

		for (let i = 0; i < CRITTERS_PER_GROUP; i++) {
			// Spread critters in a small circle around the tile center
			const angle = (i / CRITTERS_PER_GROUP) * Math.PI * 2;
			const spread = 4;
			const px = cx + Math.cos(angle) * spread;
			const py = cy + Math.sin(angle) * spread;

			const actor = new Actor({
				pos: new Vector(px, py),
				width: CRITTER_SIZE,
				height: CRITTER_SIZE,
				z: zFromY(py, Z_LAYER_PICKUP),
			});
			const circle = new Circle({
				radius: CRITTER_SIZE / 2,
				color: CRITTER_COLOR,
			});
			actor.graphics.use(circle);

			const critter: ICritter = {
				actor,
				pos: new Vector(px, py),
				vel: new Vector(0, 0),
				groupIndex,
				collected: false,
			};
			critters.push(critter);
			game.add(actor);
		}

		critterGroups.push({ originTile: tileIdx, critters });
	}
}

// --- Tile collision ---

/** Check if a single tile index is blocked. */
function isTileIndexBlocked(idx: number): boolean {
	if (idx < 0 || idx >= GRID_COLS * GRID_ROWS) return true;
	const tile = tiles[idx];
	if (tile instanceof Tree) return true;
	if (tile instanceof Barrier && tile.collider) return true;
	if (tile instanceof DropZone && !tile.fulfilled) return true;
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

export function updateCritters(elapsedMs: number) {
	const dt = elapsedMs / 1000; // seconds
	if (dt <= 0) return;

	// Gather all player positions (active + replaying)
	const playerPositions: Vector[] = [];
	for (const entry of playerEntries) {
		if (entry.player.graphics.isVisible) {
			playerPositions.push(entry.player.pos);
		}
	}

	for (const group of critterGroups) {
		const alive = group.critters.filter((c) => !c.collected);
		if (alive.length === 0) continue;

		// Compute group center for cohesion
		let centerX = 0;
		let centerY = 0;
		for (const c of alive) {
			centerX += c.pos.x;
			centerY += c.pos.y;
		}
		centerX /= alive.length;
		centerY /= alive.length;

		for (const critter of alive) {
			let ax = 0;
			let ay = 0;

			// 1. Flee from all players
			for (const ppos of playerPositions) {
				const dx = critter.pos.x - ppos.x;
				const dy = critter.pos.y - ppos.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < FLEE_RADIUS && dist > 0.1) {
					const strength = FLEE_SPEED * (1 - dist / FLEE_RADIUS);
					ax += (dx / dist) * strength;
					ay += (dy / dist) * strength;
				}
			}

			// 2. Separation from other critters in the same group
			for (const other of alive) {
				if (other === critter) continue;
				const dx = critter.pos.x - other.pos.x;
				const dy = critter.pos.y - other.pos.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < SEPARATION_RADIUS && dist > 0.1) {
					const strength = SEPARATION_STRENGTH * (1 - dist / SEPARATION_RADIUS);
					ax += (dx / dist) * strength;
					ay += (dy / dist) * strength;
				}
			}

			// 3. Cohesion — pull toward group center
			const dcx = centerX - critter.pos.x;
			const dcy = centerY - critter.pos.y;
			const dcDist = Math.sqrt(dcx * dcx + dcy * dcy);
			if (dcDist > 1) {
				ax += (dcx / dcDist) * COHESION_STRENGTH;
				ay += (dcy / dcDist) * COHESION_STRENGTH;
			}

			// Apply acceleration
			critter.vel.x += ax * dt;
			critter.vel.y += ay * dt;

			// Damping
			critter.vel.x *= DAMPING;
			critter.vel.y *= DAMPING;

			// Clamp speed
			const speed = Math.sqrt(
				critter.vel.x * critter.vel.x + critter.vel.y * critter.vel.y,
			);
			if (speed > MAX_SPEED) {
				critter.vel.x = (critter.vel.x / speed) * MAX_SPEED;
				critter.vel.y = (critter.vel.y / speed) * MAX_SPEED;
			}

			// Move
			const prevX = critter.pos.x;
			const prevY = critter.pos.y;
			critter.pos.x += critter.vel.x * dt;
			critter.pos.y += critter.vel.y * dt;

			// Keep within world bounds
			const halfSize = CRITTER_SIZE / 2;
			const maxX = GRID_COLS * TILE_SIZE - halfSize;
			const maxY = GRID_ROWS * TILE_SIZE - halfSize;
			if (critter.pos.x < halfSize) {
				critter.pos.x = halfSize;
				critter.vel.x = Math.abs(critter.vel.x);
			}
			if (critter.pos.x > maxX) {
				critter.pos.x = maxX;
				critter.vel.x = -Math.abs(critter.vel.x);
			}
			if (critter.pos.y < halfSize) {
				critter.pos.y = halfSize;
				critter.vel.y = Math.abs(critter.vel.y);
			}
			if (critter.pos.y > maxY) {
				critter.pos.y = maxY;
				critter.vel.y = -Math.abs(critter.vel.y);
			}

			// Bounce off impassable tiles
			if (isTileBlocked(critter.pos.x, critter.pos.y)) {
				// Try sliding along each axis to determine which to bounce
				const blockedX = isTileBlocked(critter.pos.x, prevY);
				const blockedY = isTileBlocked(prevX, critter.pos.y);
				if (blockedX) critter.vel.x = -critter.vel.x * 10;
				if (blockedY) critter.vel.y = -critter.vel.y * 10;
				if (!blockedX && !blockedY) {
					// Corner hit — reverse both
					critter.vel.x = -critter.vel.x * 10;
					critter.vel.y = -critter.vel.y * 10;
				}
				critter.pos.x = prevX;
				critter.pos.y = prevY;
			}

			// One-way gate: push critter in the gate's direction
			const tileIdx =
				Math.floor(critter.pos.x / TILE_SIZE) +
				Math.floor(critter.pos.y / TILE_SIZE) * GRID_COLS;
			const currentTile = tiles[tileIdx];
			if (currentTile instanceof OneWayGate) {
				const [gdx, gdy] = GATE_DIRECTION_VECTORS[currentTile.direction];
				critter.vel.x = gdx * GATE_PUSH_SPEED;
				critter.vel.y = gdy * GATE_PUSH_SPEED;
			}

			// Sync actor position
			critter.actor.pos.x = critter.pos.x;
			critter.actor.pos.y = critter.pos.y;
			critter.actor.z = zFromY(critter.pos.y, Z_LAYER_PICKUP);
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

		for (const group of critterGroups) {
			for (const critter of group.critters) {
				if (critter.collected) continue;
				const dx = critter.pos.x - px;
				const dy = critter.pos.y - py;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < COLLECT_RADIUS) {
					critter.collected = true;
					spawnScoreLight(critter.actor.pos.clone());
					critter.actor.kill();
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

			critter.pos.x = px;
			critter.pos.y = py;
			critter.vel.x = 0;
			critter.vel.y = 0;
			critter.collected = false;
			critter.actor.pos.x = px;
			critter.actor.pos.y = py;

			// Re-add killed actors
			if (!critter.actor.isKilled()) continue;
			const actor = new Actor({
				pos: new Vector(px, py),
				width: CRITTER_SIZE,
				height: CRITTER_SIZE,
				z: zFromY(py, Z_LAYER_PICKUP),
			});
			const circle = new Circle({
				radius: CRITTER_SIZE / 2,
				color: CRITTER_COLOR,
			});
			actor.graphics.use(circle);
			critter.actor = actor;
			game.add(actor);
		}
	}
}
