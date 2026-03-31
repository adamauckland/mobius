import {
  ExcaliburAStar,
  ExcaliburGraph,
  GraphTileMap,
  aStarNode,
  GraphNode,
} from "@excaliburjs/plugin-pathfinding";
import { TileMap } from "excalibur";
import { Tree, tiles, GRID_COLS, GRID_ROWS } from "./tiledata";
import { Player } from "./chap";
import { model } from "./model";
import { getRockAtTile, pickUpRock, dropRock } from "./worldObjects";

// create graph for dijkstra
let myDijkstraGraph = new ExcaliburGraph();
let myGraphTileMap: GraphTileMap = {
  name: "myGraph",
  tiles: [...tiles],
  rows: GRID_ROWS,
  cols: GRID_COLS,
};
myDijkstraGraph.addTileMap(myGraphTileMap, true);

let myGraph: ExcaliburAStar;

export function initPathfinding(tilemap: TileMap) {
  myGraph = new ExcaliburAStar(tilemap);
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
  setTimeout(() => {
    model.showWarning = false;
    model.warningColor = "white";
  }, 2000);
}

// Process a click on a target tile index: run pathfinding and queue movement
export function handleTileClick(targetTileIndex: number, targetPlayer: Player) {
  model.targetTileIndex = targetTileIndex;

  // guard: tree tiles are not valid targets
  if (tiles[targetTileIndex] instanceof Tree) {
    model.warningText = "CLICKING A TREE WILL BE IGNORED";
    showWarning();
    return;
  }

  // If carrying a rock and clicking the player's own tile, drop it
  const playerTileIdle = targetPlayer.actions.getQueue().hasNext()
    ? targetPlayer.currentMoveTileIndex
    : targetPlayer.logicalTileIndex;
  if (targetPlayer.carriedRock && targetTileIndex === playerTileIdle) {
    dropRock(targetPlayer);
    return;
  }

  // Check if there's a rock at the target tile — pathfind to it then pick up on arrival
  const rock = getRockAtTile(targetTileIndex);
  if (rock && !targetPlayer.carriedRock) {
    targetPlayer.onArriveAtTile = () => {
      // Re-check the rock is still there when we arrive
      if (!rock.carriedBy && !targetPlayer.carriedRock) {
        pickUpRock(rock, targetPlayer);
      }
    };
  }

  // Clear remaining path — the player will finish its current tile move then start the new path
  targetPlayer.playerActionBuffer = [];

  // Path starts from the tile the player is currently moving toward (or on if idle)
  const isMoving = targetPlayer.actions.getQueue().hasNext();
  const playerTileIndex = isMoving
    ? targetPlayer.currentMoveTileIndex
    : targetPlayer.logicalTileIndex;
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
