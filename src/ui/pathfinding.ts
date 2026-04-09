import {
	ExcaliburAStar,
	ExcaliburGraph,
	GraphTileMap,
	aStarNode,
	GraphNode,
} from "@excaliburjs/plugin-pathfinding";
import { TileMap } from "excalibur";
import {
	Tree,
	Barrier,
	Fence,
	DropZone,
	tiles,
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
} from "../tiles/tiledata";
import { PlayerActor } from "../entities/Player/PlayerActor";
import { model } from "../model";
import {
	getRockAtTile,
	pickUpRock,
	dropRock,
	getParcelAtTile,
	pickUpParcel,
	dropParcel,
} from "../entities/worldObjects";
import { game } from "../game";
import { dismountBlock } from "../entities/movingBlocks";

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

/** Returns the tile index the player is currently on (or moving toward). */
function getPlayerTileIndex(player: PlayerActor): number {
	if (player.actions.getQueue().hasNext()) {
		return player.currentMoveTileIndex;
	}
	const tx = Math.floor(player.pos.x / TILE_SIZE);
	const ty = Math.floor(player.pos.y / TILE_SIZE);
	return tx + ty * GRID_COLS;
}

/** Returns a warning message if the tile is impassable, or null if walkable. */
function getBlockedTileWarning(tileIndex: number): string | null {
	if (tiles[tileIndex] instanceof Tree)
		return "CLICKING A TREE WILL BE IGNORED";
	if (tiles[tileIndex] instanceof Fence) return "CAN'T WALK THROUGH A FENCE";
	const tile = tiles[tileIndex];
	if (tile instanceof Barrier && tile.collider)
		return "BARRIER IS LOCKED — FIND THE SWITCH";
	return null;
}

/** If clicking own tile while carrying something, drop it. Returns true if an item was dropped. */
function tryDropCarriedItem(
	targetTileIndex: number,
	player: PlayerActor,
): boolean {
	const playerTile = getPlayerTileIndex(player);
	if (targetTileIndex !== playerTile) return false;

	if (player.carriedRock) {
		dropRock(player);
		return true;
	}
	if (player.carriedParcel) {
		dropParcel(player);
		return true;
	}
	return false;
}

/** Set up an arrival callback to pick up a rock or parcel at the target tile. */
function setArrivalPickup(targetTileIndex: number, player: PlayerActor) {
	player.onArriveAtTile = null;

	const isCarrying = player.carriedRock || player.carriedParcel;
	if (isCarrying) return;

	const rock = getRockAtTile(targetTileIndex);
	if (rock) {
		player.onArriveAtTile = () => {
			if (!rock.carriedBy && !player.carriedRock && !player.carriedParcel) {
				pickUpRock(rock, player);
			}
		};
		return;
	}

	const parcel = getParcelAtTile(targetTileIndex);
	if (parcel) {
		player.onArriveAtTile = () => {
			if (!parcel.carriedBy && !player.carriedRock && !player.carriedParcel) {
				pickUpParcel(parcel, player);
			}
		};
	}
}

/** Run the selected pathfinding algorithm and return { path, startingIndex }. */
function findPath(
	playerTileIndex: number,
	targetTileIndex: number,
): { path: GraphNode[] | aStarNode[]; startingIndex: number } {
	const letDiag = !!model.inputDiagonal;

	if (model.inputAlgo?.value == "dijkstra") {
		const path = myDijkstraGraph.shortestPath(
			myDijkstraGraph.nodes.get(`${playerTileIndex}`)!,
			myDijkstraGraph.nodes.get(`${targetTileIndex}`)!,
		);
		model.algoDuration = myDijkstraGraph.duration.toFixed(3);
		model.movesRemaining = path.length - 1;
		if (path.length == 1) {
			model.warningText = "UNREACHABLE TILE";
			showWarning();
		}
		return { path, startingIndex: 1 };
	}

	const path = myGraph.astar(
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
	return { path, startingIndex: 0 };
}

/** Push path nodes into the player's action buffer and update logical destination. */
function queuePath(
	player: PlayerActor,
	path: GraphNode[] | aStarNode[],
	startingIndex: number,
) {
	for (let i = startingIndex; i < path.length; i++) {
		player.playerActionBuffer.push(parseInt(path[i].id.toString()));
	}
	if (path.length > 0) {
		player.logicalTileIndex = parseInt(path[path.length - 1].id.toString());
	}
}

// Process a click on a target tile index: run pathfinding and queue movement
export function handleTileClick(
	targetTileIndex: number,
	targetPlayer: PlayerActor,
) {
	model.targetTileIndex = targetTileIndex;

	// If riding a moving block, dismount first
	if (targetPlayer.ridingBlock) {
		if (!dismountBlock(targetPlayer)) {
			model.warningText = "CAN'T DISMOUNT HERE — WAIT FOR OPEN GROUND";
			showWarning();
			return;
		}
	}

	// Carrying the matching parcel? Allow routing onto the (otherwise blocked)
	// drop zone for this single pathfinding call.
	const targetTile = tiles[targetTileIndex];
	const isMatchingDropZone =
		targetTile instanceof DropZone &&
		!targetTile.fulfilled &&
		targetPlayer.carriedParcel != null &&
		targetTile.id === targetPlayer.carriedParcel.id;

	if (!isMatchingDropZone) {
		const blockedWarning = getBlockedTileWarning(targetTileIndex);
		if (blockedWarning) {
			model.warningText = blockedWarning;
			showWarning();
			return;
		}
	}

	if (tryDropCarriedItem(targetTileIndex, targetPlayer)) return;

	setArrivalPickup(targetTileIndex, targetPlayer);

	targetPlayer.playerActionBuffer = [];

	// Derive start tile from pixel position when idle (not logicalTileIndex) because
	// logicalTileIndex may not match the player's physical position between frames.
	const playerTileIndex = getPlayerTileIndex(targetPlayer);

	const totalTiles = GRID_COLS * GRID_ROWS;
	if (playerTileIndex < 0 || playerTileIndex >= totalTiles) return;
	if (targetTileIndex < 0 || targetTileIndex >= totalTiles) return;
	if (playerTileIndex === targetTileIndex) return;

	// Temporarily mark the matching drop zone as walkable for pathfinding,
	// then restore so the world stays consistent for other actors.
	let restoreDropZone: (() => void) | null = null;
	if (isMatchingDropZone && targetTile instanceof DropZone) {
		const tilemapTile = storedTilemap.tiles[targetTileIndex];
		const prevSolid = tilemapTile.solid;
		const prevCollider = targetTile.collider;
		tilemapTile.solid = false;
		targetTile.collider = false;
		rebuildPathfinding();
		restoreDropZone = () => {
			tilemapTile.solid = prevSolid;
			targetTile.collider = prevCollider;
			rebuildPathfinding();
		};
	}

	const { path, startingIndex } = findPath(playerTileIndex, targetTileIndex);
	queuePath(targetPlayer, path, startingIndex);

	if (restoreDropZone) restoreDropZone();
}
