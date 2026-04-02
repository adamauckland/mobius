import { Actor, Vector, EasingFunctions, Engine, Graphic } from "excalibur";
import { model } from "./model";
import { GRID_COLS, portalTileIndices, START_POS_X, START_POS_Y, START_TILE_INDEX } from "./tiledata";
import { plrWalk, plrImage } from "./resources";
import type { Rock } from "./worldObjects";
import { dropRockAtTile, tryCollectAtTile } from "./worldObjects";
import { tryActivateSwitch } from "./barriers";
import { Z_PLAYER_BASE } from "./zIndex";
import { game } from "./game";

// create and configure player, and his action buffer

export class Player extends Actor {
  playerActionBuffer: any = [];
  playerActionStatus = "idle";
  logicalTileIndex = START_TILE_INDEX;
  currentMoveTileIndex = START_TILE_INDEX;
  previousTileIndex = 0; // the tile the player was on before the current move
  onReachedPortal: (() => boolean) | null = null; // return true if handled
  carriedRock: Rock | null = null;
  onArriveAtTile: (() => void) | null = null; // called when path completes
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

    // Carried rock follows the player with a slight offset above
    if (this.carriedRock) {
      const bounce = this.actions.getQueue().hasNext()
        ? -Math.abs(Math.sin(game.clock.now() * 0.01)) * 3
        : 0;
      this.carriedRock.actor.pos.x = this.pos.x;
      this.carriedRock.actor.pos.y = this.pos.y - 10 + bounce;
    }
  }

  moveToTile(node: number) {
    //convert node, which is flat array index into x and y
    let x = node % GRID_COLS;
    let y = Math.floor(node / GRID_COLS);
    //get vector between player and tile
    let target = new Vector(x * 16 + 8, y * 16 + 8);

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
        // If landing on the portal while carrying a rock, drop it on the previous tile
        if (portalTileIndices.includes(node) && this.carriedRock) {
          dropRockAtTile(this, this.previousTileIndex);
        }
        // If path is complete and we landed on the portal
        if (
          this.playerActionBuffer.length === 0 &&
          portalTileIndices.includes(node)
        ) {
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
      });
  }
}

export let player = new Player(
  { pos: new Vector(START_POS_X, START_POS_Y), width: 16, height: 16, z: Z_PLAYER_BASE },
  plrWalk,
  plrImage,
);
