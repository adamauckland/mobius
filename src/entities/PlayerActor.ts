import {
	Actor,
	ActorArgs,
	Vector,
	EasingFunctions,
	Engine,
	Graphic,
} from "excalibur";
import { model } from "../model";
import {
	GRID_COLS,
	GRID_ROWS,
	TILE_SIZE,
	portalTileIndices,
	exitDoorTileIndices,
	START_POS_X,
	START_POS_Y,
	START_TILE_INDEX,
	tiles,
	OneWayGate,
	Tree,
	Fence,
	Barrier,
	DropZone,
} from "../tiles/tiledata";
import type { Direction } from "../tiles/tiledata";
import { playerWalkAnimation, playerImage } from "../resources";
import type { Rock, Parcel } from "./worldObjects";
import {
	dropRockAtTile,
	dropParcelAtTile,
	tryCollectAtTile,
} from "./worldObjects";
import { tryActivateSwitch } from "./barriers";
import { zFromY, Z_LAYER_PLAYER } from "../zIndex";
import { sfxOneWayGate, sfxPortal } from "../sounds";
import { game } from "../game";
import type { MovingBlock } from "./movingBlocks";
import { getMovingBlockNear, mountBlock } from "./movingBlocks";
import { Collider, CollisionContact, Side } from "excalibur";

// --- Pure helpers (exported for unit testing) ---

const ADJACENT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
	[0, -1],
	[0, 1],
	[-1, 0],
	[1, 0],
];

const GATE_DELTAS: Record<Direction, readonly [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

const CARRIED_OFFSET_Y = -10;
const BOUNCE_AMPLITUDE = 3;
const BOUNCE_FREQ = 0.01;

/** Convert a flat tile index into the pixel-space centre of that tile. */
export function tileIndexToPixelCenter(tileIndex: number): {
	x: number;
	y: number;
} {
	const x = tileIndex % GRID_COLS;
	const y = Math.floor(tileIndex / GRID_COLS);
	return {
		x: x * TILE_SIZE + TILE_SIZE / 2,
		y: y * TILE_SIZE + TILE_SIZE / 2,
	};
}

/**
 * Search the four orthogonal neighbours of `tileIndex` for an unfulfilled
 * DropZone whose id matches `parcelId`. Returns the neighbour index, or null.
 */
export function findAdjacentDropZoneIndex(
	tileIndex: number,
	parcelId: number,
): number | null {
	const px = tileIndex % GRID_COLS;
	const py = Math.floor(tileIndex / GRID_COLS);
	for (const [dx, dy] of ADJACENT_OFFSETS) {
		const nx = px + dx;
		const ny = py + dy;
		if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
		const adjIdx = nx + ny * GRID_COLS;
		const adjTile = tiles[adjIdx];
		if (
			adjTile instanceof DropZone &&
			adjTile.id === parcelId &&
			!adjTile.fulfilled
		) {
			return adjIdx;
		}
	}
	return null;
}

/**
 * Compute the tile a one-way gate would push the player onto. Returns null if
 * the destination is off-grid or blocked by a tree, fence, or active barrier.
 */
export function gateExitTileIndex(
	gateTileIndex: number,
	direction: Direction,
): number | null {
	const gx = gateTileIndex % GRID_COLS;
	const gy = Math.floor(gateTileIndex / GRID_COLS);
	const [dx, dy] = GATE_DELTAS[direction];
	const nx = gx + dx;
	const ny = gy + dy;
	if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return null;
	const nextIdx = nx + ny * GRID_COLS;
	const dest = tiles[nextIdx];
	const blocked =
		dest instanceof Tree ||
		dest instanceof Fence ||
		(dest instanceof Barrier && dest.collider);
	return blocked ? null : nextIdx;
}

/** Sinusoidal vertical bounce for carried items / walk cycle. */
export function carryBounceOffset(nowMs: number): number {
	return -Math.abs(Math.sin(nowMs * BOUNCE_FREQ)) * BOUNCE_AMPLITUDE;
}

// create and configure player, and his action buffer

// Actors are the main unit of composition you'll likely use, anything that you want to draw and move around the screen
// is likely built with an actor

export class PlayerActor extends Actor {
	playerActionBuffer: number[] = [];
	playerActionStatus = "idle";
	logicalTileIndex = START_TILE_INDEX;
	currentMoveTileIndex = START_TILE_INDEX;
	previousTileIndex = START_TILE_INDEX; // the tile the player was on before the current move
	onReachedPortal: (() => boolean) | null = null; // return true if handled
	onReachedExitDoor: (() => void) | null = null;
	carriedRock: Rock | null = null;
	carriedParcel: Parcel | null = null;
	onArriveAtTile: (() => void) | null = null; // called when path completes
	ridingBlock: MovingBlock | null = null;
	private idleGraphic: Graphic;
	private walkGraphic: Graphic;

	constructor(options: ActorArgs, walkGraphic: Graphic, idleGraphic: Graphic) {
		super(options);

		this.walkGraphic = walkGraphic;
		this.idleGraphic = idleGraphic;
		this.graphics.use(walkGraphic);
		this.graphics.onPreDraw = () => this.updatePreDrawGraphics();
	}

	private updatePreDrawGraphics(): void {
		const isMoving =
			this.playerActionBuffer.length > 0 || this.actions.getQueue().hasNext();
		if (isMoving) {
			this.graphics.use(this.walkGraphic);
			this.graphics.offset.y = carryBounceOffset(game.clock.now());
		} else {
			this.graphics.use(this.idleGraphic);
			this.graphics.offset.y = 0;
		}
	}

	override onPreUpdate(_engine: Engine, _elapsedMs: number): void {
		// Put any update logic here runs every frame before Actor builtins
	}

	override onPostUpdate(_engine: Engine, _delta: number): void {
		this.z = zFromY(this.pos.y, Z_LAYER_PLAYER);

		// While riding a moving block, skip normal movement processing
		if (this.ridingBlock) {
			this.followCarriedWhileRiding();
			return;
		}

		this.processNextBufferedMove();

		// Auto-mount: if idle and a moving block is within a few pixels, hop on.
		// When mounted, skip the carried-bounce update so the rider state stays
		// consistent with the riding-block branch above.
		if (this.tryAutoMount()) return;

		this.updateCarriedBouncing();
	}

	private followCarriedWhileRiding(): void {
		if (this.carriedRock) {
			this.carriedRock.actor.pos.x = this.pos.x;
			this.carriedRock.actor.pos.y = this.pos.y + CARRIED_OFFSET_Y;
		}
		if (this.carriedParcel) {
			this.carriedParcel.actor.pos.x = this.pos.x;
			this.carriedParcel.actor.pos.y = this.pos.y + CARRIED_OFFSET_Y;
		}
	}

	private processNextBufferedMove(): void {
		if (this.playerActionBuffer.length === 0) return;
		if (this.actions.getQueue().hasNext()) return;
		const nextTile = this.playerActionBuffer[0];

		this.playerActionBuffer.shift();
		this.previousTileIndex = this.currentMoveTileIndex;
		this.currentMoveTileIndex = nextTile;
		model.currentTileIndex = nextTile;
		this.moveToTile(nextTile);
	}

	private tryAutoMount(): boolean {
		if (this.playerActionBuffer.length !== 0) return false;
		if (this.actions.getQueue().hasNext()) return false;
		const block = getMovingBlockNear(this.pos);
		if (!block) return false;
		mountBlock(block, this);
		return true;
	}

	private updateCarriedBouncing(): void {
		const isMoving = this.actions.getQueue().hasNext();
		const bounce = isMoving ? carryBounceOffset(game.clock.now()) : 0;
		if (this.carriedRock) {
			this.carriedRock.actor.pos.x = this.pos.x;
			this.carriedRock.actor.pos.y = this.pos.y + CARRIED_OFFSET_Y + bounce;
		}
		if (this.carriedParcel) {
			this.carriedParcel.actor.pos.x = this.pos.x;
			this.carriedParcel.actor.pos.y = this.pos.y + CARRIED_OFFSET_Y + bounce;
		}
	}

	moveToTile(node: number) {
		const center = tileIndexToPixelCenter(node);
		const target = new Vector(center.x, center.y);

		this.actions
			.easeTo(target, 200, EasingFunctions.Linear)
			.callMethod(() => this.onArriveAtNode(node));
	}

	/** Runs once the easeTo to `node` completes. Order matters — see callers. */
	private onArriveAtNode(node: number): void {
		model.movesRemaining--;
		tryCollectAtTile(node);
		this.tryAutoDropParcel(node);
		tryActivateSwitch(node);
		this.tryFireArrivalCallback();
		this.dropCarriedAtPortal(node);
		this.tryHandlePortal(node);
		this.tryHandleExitDoor(node);
		this.tryHandleOneWayGate(node);
	}

	/** Auto-drop a carried parcel onto its matching DropZone, here or adjacent. */
	private tryAutoDropParcel(node: number): void {
		const parcel = this.carriedParcel;
		if (!parcel) return;

		const currentTile = tiles[node];
		if (
			currentTile instanceof DropZone &&
			currentTile.id === parcel.id &&
			!currentTile.fulfilled
		) {
			dropParcelAtTile(this, node);
			return;
		}

		const adjIdx = findAdjacentDropZoneIndex(node, parcel.id);
		if (adjIdx !== null) {
			dropParcelAtTile(this, adjIdx);
		}
	}

	/** Fire and clear the arrival callback once the action buffer is empty. */
	private tryFireArrivalCallback(): void {
		if (this.playerActionBuffer.length !== 0) return;
		if (!this.onArriveAtTile) return;
		const cb = this.onArriveAtTile;
		this.onArriveAtTile = null;
		cb();
	}

	/** Drop any carried rock/parcel on the previous tile when entering a portal. */
	private dropCarriedAtPortal(node: number): void {
		if (!portalTileIndices.includes(node)) return;
		if (this.carriedRock) {
			dropRockAtTile(this, this.previousTileIndex);
		}
		if (this.carriedParcel) {
			dropParcelAtTile(this, this.previousTileIndex);
		}
	}

	/** Handle landing on a portal at the end of a path. */
	private tryHandlePortal(node: number): void {
		if (this.playerActionBuffer.length !== 0) return;
		if (!portalTileIndices.includes(node)) return;

		sfxPortal();
		const handled = this.onReachedPortal ? this.onReachedPortal() : false;
		if (handled) return;

		// Replaying player — shrink and disappear into the portal
		this.actions.scaleTo(new Vector(0, 0), new Vector(2, 2)).callMethod(() => {
			this.graphics.visible = false;
		});
	}

	private tryHandleExitDoor(node: number): void {
		if (!exitDoorTileIndices.includes(node)) return;
		if (this.onReachedExitDoor) {
			this.onReachedExitDoor();
		}
	}

	/** One-way gate: queue a forced move in the gate's direction. */
	private tryHandleOneWayGate(node: number): void {
		const gateTile = tiles[node];
		if (!(gateTile instanceof OneWayGate)) return;

		sfxOneWayGate();
		const nextIdx = gateExitTileIndex(node, gateTile.direction);
		if (nextIdx !== null) {
			this.playerActionBuffer = [nextIdx];
		}
	}

	override onPreCollisionResolve(
		_self: Collider,
		_other: Collider,
		_side: Side,
		_contact: CollisionContact,
	): void {
		// Called before a collision is resolved, if you want to opt out of this specific collision call contact.cancel()
	}

	override onPostCollisionResolve(
		_self: Collider,
		_other: Collider,
		_side: Side,
		_contact: CollisionContact,
	): void {
		// Called every time a collision is resolved and overlap is solved
	}

	override onCollisionStart(
		_self: Collider,
		_other: Collider,
		_side: Side,
		_contact: CollisionContact,
	): void {
		// Called when a pair of objects are in contact
	}

	override onCollisionEnd(
		_self: Collider,
		_other: Collider,
		_side: Side,
		_lastContact: CollisionContact,
	): void {
		// Called when a pair of objects separates
	}
}

export let player = new PlayerActor(
	{
		pos: new Vector(START_POS_X, START_POS_Y),
		width: TILE_SIZE,
		height: TILE_SIZE,
		z: zFromY(START_POS_Y, Z_LAYER_PLAYER),
	},
	playerWalkAnimation,
	playerImage,
);
