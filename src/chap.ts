import { Actor, Vector, EasingFunctions, Engine, Graphic } from "excalibur";
import { model } from "./model";
import { GRID_COLS, GRID_ROWS, TILE_SIZE, portalTileIndices, START_POS_X, START_POS_Y, START_TILE_INDEX, tiles, OneWayGate, Tree, Fence, Barrier } from "./tiledata";
import { plrWalk, plrImage } from "./resources";
import type { Rock, Parcel } from "./worldObjects";
import { dropRockAtTile, dropParcelAtTile, tryCollectAtTile } from "./worldObjects";
import { tryActivateSwitch } from "./barriers";
import { zFromY, Z_LAYER_PLAYER } from "./zIndex";
import { sfxOneWayGate, sfxPortal } from "./sounds";
import { game } from "./game";
import type { MovingBlock } from "./movingBlocks";
import { getMovingBlockNear, mountBlock } from "./movingBlocks";

// create and configure player, and his action buffer

export class Player extends Actor {
  playerActionBuffer: any = [];
  playerActionStatus = "idle";
  logicalTileIndex = START_TILE_INDEX;
  currentMoveTileIndex = START_TILE_INDEX;
  previousTileIndex = 0; // the tile the player was on before the current move
  onReachedPortal: (() => boolean) | null = null; // return true if handled
  carriedRock: Rock | null = null;
  carriedParcel: Parcel | null = null;
  onArriveAtTile: (() => void) | null = null; // called when path completes
  ridingBlock: MovingBlock | null = null;
  private idleGraphic: Graphic;
  private walkGraphic: Graphic;

  constructor(options: any, walkGraphic: Graphic, idleGraphic: Graphic) {
    super(options);
    this.walkGraphic = walkGraphic;
    this.idleGraphic = idleGraphic;
    this.graphics.use(walkGraphic);
    this.graphics.onPreDraw = () => {
      const isMoving =
        this.playerActionBuffer.length > 0 ||
        this.actions.getQueue().hasNext();
      if (isMoving) {
        this.graphics.use(this.walkGraphic);
        this.graphics.offset.y = -Math.abs(Math.sin(game.clock.now() * 0.01)) * 3;
      } else {
        this.graphics.use(this.idleGraphic);
        this.graphics.offset.y = 0;
      }
    };
  }

  override onPostUpdate(engine: Engine<any>, delta: number): void {
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
    let target = new Vector(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);

    this.actions
      .easeTo(target, 400, EasingFunctions.Linear)
      .callMethod(() => {
        model.movesRemaining--;
        // Check for collectables on this tile
        tryCollectAtTile(node);
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
        // One-way gate: force movement in the gate's direction
        const gateTile = tiles[node];
        if (gateTile instanceof OneWayGate) {
          sfxOneWayGate();
          const gx = node % GRID_COLS;
          const gy = Math.floor(node / GRID_COLS);
          let nx = gx, ny = gy;
          switch (gateTile.direction) {
            case 'up': ny--; break;
            case 'down': ny++; break;
            case 'left': nx--; break;
            case 'right': nx++; break;
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
}

export let player = new Player(
  { pos: new Vector(START_POS_X, START_POS_Y), width: TILE_SIZE, height: TILE_SIZE, z: zFromY(START_POS_Y, Z_LAYER_PLAYER) },
  plrWalk,
  plrImage,
);
