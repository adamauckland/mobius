import {
  ExcaliburAStar,
  ExcaliburGraph,
  GraphTileMap,
  aStarNode,
  GraphNode,
} from "@excaliburjs/plugin-pathfinding";
import { TileMap } from "excalibur";
import { Tree, Barrier, Fence, tiles, TILE_SIZE, GRID_COLS, GRID_ROWS } from "./tiles/tiledata";
import { Player } from "./entities/chap";
import { model } from "./model";
import { getRockAtTile, pickUpRock, dropRock, getParcelAtTile, pickUpParcel, dropParcel } from "./entities/worldObjects";
import { game } from "./game";
import { dismountBlock } from "./entities/movingBlocks";

// create graph for dijkstra — deferred until initPathfinding so tiles are populated
let myDijkstraGraph = new ExcaliburGraph();
let myGraphTileMap: GraphTileMap;

let myGraph: ExcaliburAStar;
let storedTilemap: TileMap;

export function initPathfinding(tilemap: TileMap) {
  storedTilemap = tilemap;
  myGraph = new ExcaliburAStar(tilemap);
  // Build the Dijkstra graph now that tiles are populated
  myGraphTileMap = {
    name: "myGraph",
    tiles: [...tiles],
    rows: GRID_ROWS,
    cols: GRID_COLS,
  };
  myDijkstraGraph = new ExcaliburGraph();
  myDijkstraGraph.addTileMap(myGraphTileMap, true);
}

/** Rebuild both pathfinding graphs after barrier tiles change. */
export function rebuildPathfinding() {
  myGraphTileMap = {
    name: "myGraph",
    tiles: [...tiles],
    rows: GRID_ROWS,
    cols: GRID_COLS,
  };
  resetDijkstraGraph();
  if (storedTilemap) {
    myGraph = new ExcaliburAStar(storedTilemap);
  }
}

export function resetDijkstraGraph() {
  myDijkstraGraph.resetGraph();
  if (model.inputDiagonal) {
    myDijkstraGraph.addTileMap(myGraphTileMap, true);
  } else {
    myDijkstraGraph.addTileMap(myGraphTileMap);
  }
}

function showWarning() {
  model.showWarning = true;
  model.warningColor = "red";
  game.clock.schedule(() => {
    model.showWarning = false;
    model.warningColor = "white";
  }, 2000);
}

// Process a click on a target tile index: run pathfinding and queue movement
export function handleTileClick(targetTileIndex: number, targetPlayer: Player) {
  model.targetTileIndex = targetTileIndex;

  // If riding a moving block, dismount first
  if (targetPlayer.ridingBlock) {
    if (!dismountBlock(targetPlayer)) {
      model.warningText = "CAN'T DISMOUNT HERE — WAIT FOR OPEN GROUND";
      showWarning();
      return;
    }
    // Player is now dismounted — continue with normal pathfinding
  }

  // guard: solid tiles are not valid targets
  if (tiles[targetTileIndex] instanceof Tree) {
    model.warningText = "CLICKING A TREE WILL BE IGNORED";
    showWarning();
    return;
  }
  if (tiles[targetTileIndex] instanceof Fence) {
    model.warningText = "CAN'T WALK THROUGH A FENCE";
    showWarning();
    return;
  }
  const barrierTile = tiles[targetTileIndex];
  if (barrierTile instanceof Barrier && barrierTile.collider) {
    model.warningText = "BARRIER IS LOCKED — FIND THE SWITCH";
    showWarning();
    return;
  }

  // If carrying a rock and clicking the player's own tile, drop it
  const idleMoving = targetPlayer.actions.getQueue().hasNext();
  let playerTileIdle: number;
  if (idleMoving) {
    playerTileIdle = targetPlayer.currentMoveTileIndex;
  } else {
    const itx = Math.floor(targetPlayer.pos.x / TILE_SIZE);
    const ity = Math.floor(targetPlayer.pos.y / TILE_SIZE);
    playerTileIdle = itx + ity * GRID_COLS;
  }
  if (targetTileIndex === playerTileIdle) {
    if (targetPlayer.carriedRock) {
      dropRock(targetPlayer);
      return;
    }
    if (targetPlayer.carriedParcel) {
      dropParcel(targetPlayer);
      return;
    }
  }

  // Clear stale arrival callback — a new click replaces the old destination
  targetPlayer.onArriveAtTile = null;

  // Check if there's a rock or parcel at the target tile — pathfind to it then pick up on arrival
  // Player can only carry one thing at a time (rock OR parcel)
  const isCarrying = targetPlayer.carriedRock || targetPlayer.carriedParcel;
  const rock = getRockAtTile(targetTileIndex);
  if (rock && !isCarrying) {
    targetPlayer.onArriveAtTile = () => {
      if (!rock.carriedBy && !targetPlayer.carriedRock && !targetPlayer.carriedParcel) {
        pickUpRock(rock, targetPlayer);
      }
    };
  }
  const parcel = getParcelAtTile(targetTileIndex);
  if (!rock && parcel && !isCarrying) {
    targetPlayer.onArriveAtTile = () => {
      if (!parcel.carriedBy && !targetPlayer.carriedRock && !targetPlayer.carriedParcel) {
        pickUpParcel(parcel, targetPlayer);
      }
    };
  }

  // Clear remaining path — the player will finish its current tile move then start the new path
  targetPlayer.playerActionBuffer = [];

  // Path starts from the tile the player is currently moving toward (or on if idle).
  // When idle, derive from actual pixel position — NOT logicalTileIndex — because
  // logicalTileIndex is set to the *destination* as soon as a path is calculated,
  // which may not match the player's physical position if clicks arrive between frames.
  const isMoving = targetPlayer.actions.getQueue().hasNext();
  let playerTileIndex: number;
  if (isMoving) {
    playerTileIndex = targetPlayer.currentMoveTileIndex;
  } else {
    const tx = Math.floor(targetPlayer.pos.x / TILE_SIZE);
    const ty = Math.floor(targetPlayer.pos.y / TILE_SIZE);
    playerTileIndex = tx + ty * GRID_COLS;
  }

  // Guard: both indices must be within the grid
  const totalTiles = GRID_COLS * GRID_ROWS;
  if (playerTileIndex < 0 || playerTileIndex >= totalTiles) return;
  if (targetTileIndex < 0 || targetTileIndex >= totalTiles) return;

  // Guard: already on the target tile — nothing to do
  if (playerTileIndex === targetTileIndex) return;

  const letDiag = model.inputDiagonal ? true : false;

  // pick which algorithm
  let startingIndex = 0;
  let path: GraphNode[] | aStarNode[] = [];

  if (model.inputAlgo?.value == "dijkstra") {
    path = myDijkstraGraph.shortestPath(
      myDijkstraGraph.nodes.get(`${playerTileIndex}`)!,
      myDijkstraGraph.nodes.get(`${targetTileIndex}`)!,
    );

    model.algoDuration = myDijkstraGraph.duration.toFixed(3);
    model.movesRemaining = path.length - 1;
    startingIndex = 1;
    if (path.length == 1 && startingIndex == 1) {
      model.warningText = "UNREACHABLE TILE";
      showWarning();
    }
  } else {
    // Default to astar when no algorithm input is set
    path = myGraph.astar(
      myGraph.getNodeByIndex(playerTileIndex),
      myGraph.getNodeByIndex(targetTileIndex),
      letDiag,
    );

    model.algoDuration = myGraph.duration.toFixed(3);
    model.movesRemaining = path.length;
    if (path.length == 0) {
      model.warningText = "UNREACHABLE TILE";
      showWarning();
    }
  }

  // don't push the player's current tile, so we start at index 1
  for (let i = startingIndex; i < path.length; i++) {
    const nxtPath = path[i];
    targetPlayer.playerActionBuffer.push(parseInt(nxtPath.id.toString()));
  }

  // update the player's logical destination to the end of the path
  if (path.length > 0) {
    targetPlayer.logicalTileIndex = parseInt(
      path[path.length - 1].id.toString(),
    );
  }
}
