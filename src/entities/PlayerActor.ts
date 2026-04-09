import { Actor, Vector, EasingFunctions, Engine, Graphic } from "excalibur";
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

// create and configure player, and his action buffer

// Actors are the main unit of composition you'll likely use, anything that you want to draw and move around the screen
// is likely built with an actor

// They contain a bunch of useful components that you might use
// actor.transform
// actor.motion
// actor.graphics
// actor.body
// actor.collider
// actor.actions
// actor.pointer

export class PlayerActor extends Actor {
	playerActionBuffer: any = [];
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
	isTileBlocked: ((tileIndex: number) => boolean) | null = null;
	private idleGraphic: Graphic;
	private walkGraphic: Graphic;

	constructor(options: any, walkGraphic: Graphic, idleGraphic: Graphic) {
		// Giving your actor a name is optional, but helps in debugging using the dev tools or debug mode
		// https://github.com/excaliburjs/excalibur-extension/
		// Chrome: https://chromewebstore.google.com/detail/excalibur-dev-tools/dinddaeielhddflijbbcmpefamfffekc
		// Firefox: https://addons.mozilla.org/en-US/firefox/addon/excalibur-dev-tools/
		// anchor: vec(0, 0), // Actors default center colliders and graphics with anchor (0.5, 0.5)
		// collisionType: CollisionType.Active, // Collision Type Active means this participates in collisions read more https://excaliburjs.com/docs/collisiontypes
		super(options);

		this.walkGraphic = walkGraphic;
		this.idleGraphic = idleGraphic;
		this.graphics.use(walkGraphic);
		this.graphics.onPreDraw = () => {
			const isMoving =
				this.playerActionBuffer.length > 0 || this.actions.getQueue().hasNext();

			if (isMoving) {
				this.graphics.use(this.walkGraphic);
				this.graphics.offset.y =
					-Math.abs(Math.sin(game.clock.now() * 0.01)) * 3;
			} else {
				this.graphics.use(this.idleGraphic);
				this.graphics.offset.y = 0;
			}
		};
	}

	override onPreUpdate(_engine: Engine, _elapsedMs: number): void {
		// Put any update logic here runs every frame before Actor builtins
	}

	override onPostUpdate(_engine: Engine<any>, _delta: number): void {
		this.z = zFromY(this.pos.y, Z_LAYER_PLAYER);

		// While riding a moving block, skip normal movement processing
		if (this.ridingBlock) {
			// Carried rock/parcel still follows while riding
			if (this.carriedRock) {
				this.carriedRock.actor.pos.x = this.pos.x;
				this.carriedRock.actor.pos.y = this.pos.y - 10;
			}
			if (this.carriedParcel) {
				this.carriedParcel.actor.pos.x = this.pos.x;
				this.carriedParcel.actor.pos.y = this.pos.y - 10;
			}
			return;
		}

		if (
			this.playerActionBuffer.length > 0 &&
			!this.actions.getQueue().hasNext()
		) {
			// Wait if a ghost player is occupying the next tile
			if (this.isTileBlocked && this.isTileBlocked(this.playerActionBuffer[0])) {
				return;
			}
			// get next tile off action buffer and moveTo
			const nextTile = this.playerActionBuffer.shift();
			this.previousTileIndex = this.currentMoveTileIndex;
			this.currentMoveTileIndex = nextTile;
			model.currentTileIndex = nextTile;
			this.moveToTile(nextTile);
		}

		// Auto-mount: if idle and a moving block is within a few pixels, hop on
		if (
			this.playerActionBuffer.length === 0 &&
			!this.actions.getQueue().hasNext()
		) {
			const block = getMovingBlockNear(this.pos);
			if (block) {
				mountBlock(block, this);
				return;
			}
		}

		// Carried rock/parcel follows the player with a slight offset above
		if (this.carriedRock) {
			const bounce = this.actions.getQueue().hasNext()
				? -Math.abs(Math.sin(game.clock.now() * 0.01)) * 3
				: 0;
			this.carriedRock.actor.pos.x = this.pos.x;
			this.carriedRock.actor.pos.y = this.pos.y - 10 + bounce;
		}
		if (this.carriedParcel) {
			const bounce = this.actions.getQueue().hasNext()
				? -Math.abs(Math.sin(game.clock.now() * 0.01)) * 3
				: 0;
			this.carriedParcel.actor.pos.x = this.pos.x;
			this.carriedParcel.actor.pos.y = this.pos.y - 10 + bounce;
		}
	}

	moveToTile(node: number) {
		//convert node, which is flat array index into x and y
		let x = node % GRID_COLS;
		let y = Math.floor(node / GRID_COLS);
		//get vector between player and tile
		let target = new Vector(
			x * TILE_SIZE + TILE_SIZE / 2,
			y * TILE_SIZE + TILE_SIZE / 2,
		);

		this.actions.easeTo(target, 200, EasingFunctions.Linear).callMethod(() => {
			model.movesRemaining--;
			// Check for collectables on this tile
			tryCollectAtTile(node);
			// Auto-drop parcel when adjacent to its matching drop zone
			if (this.carriedParcel) {
				const px = node % GRID_COLS;
				const py = Math.floor(node / GRID_COLS);
				for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
					const nx = px + dx;
					const ny = py + dy;
					if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
					const adjIdx = nx + ny * GRID_COLS;
					const adjTile = tiles[adjIdx];
					if (adjTile instanceof DropZone && adjTile.id === this.carriedParcel.id && !adjTile.fulfilled) {
						dropParcelAtTile(this, adjIdx);
						break;
					}
				}
			}
			// Activate any switch on this tile
			tryActivateSwitch(node);
			// If path is complete, fire arrival callback
			if (this.playerActionBuffer.length === 0 && this.onArriveAtTile) {
				const cb = this.onArriveAtTile;
				this.onArriveAtTile = null;
				cb();
			}
			// If landing on the portal while carrying a rock/parcel, drop it on the previous tile
			if (portalTileIndices.includes(node) && this.carriedRock) {
				dropRockAtTile(this, this.previousTileIndex);
			}
			if (portalTileIndices.includes(node) && this.carriedParcel) {
				dropParcelAtTile(this, this.previousTileIndex);
			}
			// If path is complete and we landed on the portal
			if (
				this.playerActionBuffer.length === 0 &&
				portalTileIndices.includes(node)
			) {
				sfxPortal();
				const handled = this.onReachedPortal ? this.onReachedPortal() : false;
				if (!handled) {
					// Replaying player — shrink and disappear into the portal
					this.actions
						.scaleTo(new Vector(0, 0), new Vector(2, 2))
						.callMethod(() => {
							this.graphics.visible = false;
						});
				}
			}
			// If we landed on the exit door, complete immediately
			if (exitDoorTileIndices.includes(node)) {
				if (this.onReachedExitDoor) {
					this.onReachedExitDoor();
				}
			}
			// One-way gate: force movement in the gate's direction
			const gateTile = tiles[node];
			if (gateTile instanceof OneWayGate) {
				sfxOneWayGate();
				const gx = node % GRID_COLS;
				const gy = Math.floor(node / GRID_COLS);
				let nx = gx,
					ny = gy;
				switch (gateTile.direction) {
					case "up":
						ny--;
						break;
					case "down":
						ny++;
						break;
					case "left":
						nx--;
						break;
					case "right":
						nx++;
						break;
				}
				if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
					const nextIdx = nx + ny * GRID_COLS;
					const dest = tiles[nextIdx];
					const blocked =
						dest instanceof Tree ||
						dest instanceof Fence ||
						(dest instanceof Barrier && dest.collider);
					if (!blocked) {
						this.playerActionBuffer = [nextIdx];
					}
				}
			}
		});
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
